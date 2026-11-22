import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { logger } from '@librechat/data-schemas';
import type { Request, Response, NextFunction } from 'express';
import { getLocalHardwareFingerprint } from './hardwareId';

export interface LicensePayload {
  tenantId: string;
  hardwareFingerprint?: string;
  maxSeats?: number;
  issuedAt: number;
  expiresAt: number;
  gracePeriodSeconds?: number;
  plan?: string;
  features?: string[];
  status?: number;
}

let cachedLicense: { payload: LicensePayload; valid: boolean; expires: number } | null = null;
let lastCheckTime = 0;
let lastMonotonicTimestamp = Date.now();

/**
 * Hardcoded Satchida Master Authority Ed25519 Public Key.
 * Embedded directly in compiled bytecode so tenant IT or local agents cannot
 * substitute a rogue public key by editing .env.
 */
export const SATCHIDA_MASTER_PUBLIC_KEY: string = `-----BEGIN PUBLIC KEY-----\nMCowBQYDK2VwAyEAbR6Cz0USZkPutuGIoq69nWmPHbrUt71aG5YDpkCuBiM=\n-----END PUBLIC KEY-----\n`;

/**
 * Persistent monotonic clock ledger path to prevent system clock rollback.
 */
function getClockLedgerPath(): string {
  return (
    process.env.SATCHIDA_CLOCK_LEDGER_PATH || path.resolve(process.cwd(), '.satchida-clock.dat')
  );
}

/**
 * Anti-clock-tampering check: verifies current time against in-memory monotonic watermark
 * AND persistent tamper-evident disk ledger.
 */
export function verifyClockIntegrity(): { valid: boolean; reason?: string } {
  const now = Date.now();

  // 1. In-memory backward jump detection (allowing max 60s NTP drift jitter)
  if (now < lastMonotonicTimestamp - 60000) {
    logger.error('[LicenseGuard] System clock tampering detected (in-memory rewind)!', {
      current: now,
      previous: lastMonotonicTimestamp,
    });
    return { valid: false, reason: 'SYSTEM_CLOCK_TAMPERED' };
  }

  // 2. Persistent disk ledger check
  const ledgerPath = getClockLedgerPath();
  try {
    if (fs.existsSync(ledgerPath)) {
      const raw = fs.readFileSync(ledgerPath, 'utf8').trim();
      const storedWatermark = Number(raw);
      if (!isNaN(storedWatermark) && now < storedWatermark - 60000) {
        logger.error('[LicenseGuard] System clock tampering detected (disk watermark rewind)!', {
          current: now,
          storedWatermark,
        });
        return { valid: false, reason: 'SYSTEM_CLOCK_TAMPERED' };
      }
    }
    // Update watermark forward monotonically
    const newWatermark = Math.max(now, lastMonotonicTimestamp);
    lastMonotonicTimestamp = newWatermark;
    fs.writeFileSync(ledgerPath, String(newWatermark), { encoding: 'utf8', flag: 'w' });
  } catch (err) {
    logger.warn('[LicenseGuard] Warning updating clock ledger:', err);
  }

  return { valid: true };
}

/**
 * Validates cryptographic license lease, verifies Ed25519 signature,
 * checks expiration and seat allocations, and guards against clock tampering.
 */
export function verifyDeadManLease(): {
  valid: boolean;
  reason?: string;
  payload?: LicensePayload;
} {
  const clockCheck = verifyClockIntegrity();
  if (!clockCheck.valid) {
    return clockCheck;
  }

  const now = Date.now();

  // Return cached result if checked within 30 seconds
  if (cachedLicense && now - lastCheckTime < 30000) {
    if (!cachedLicense.valid) {
      const isLocked =
        cachedLicense.payload?.status === 2 || cachedLicense.payload?.status === 3;
      return {
        valid: false,
        reason: isLocked ? 'TENANT_LOCKED_BY_OPERATOR' : 'LICENSE_EXPIRED',
      };
    }
    if (now > cachedLicense.expires) {
      return { valid: false, reason: 'LICENSE_EXPIRED' };
    }
    return { valid: true, payload: cachedLicense.payload };
  }

  lastCheckTime = now;

  const licensePath =
    process.env.SATCHIDA_LICENSE_PATH || path.resolve(process.cwd(), 'satchida.lic');
  if (!fs.existsSync(licensePath)) {
    // If enforcement is disabled and in development, allow pass-through
    if (process.env.NODE_ENV !== 'production' && !process.env.ENFORCE_SATCHIDA_LICENSE) {
      return { valid: true };
    }
    return { valid: false, reason: 'LICENSE_FILE_MISSING' };
  }

  try {
    const raw = fs.readFileSync(licensePath, 'utf8').trim();
    const [headerB64, payloadB64, signatureB64] = raw.split('.');

    if (!headerB64 || !payloadB64 || !signatureB64) {
      return { valid: false, reason: 'INVALID_LICENSE_FORMAT' };
    }

    // Cryptographic Ed25519 Signature Verification
    const dataToVerify = Buffer.from(`${headerB64}.${payloadB64}`, 'utf8');
    const signatureBuffer = Buffer.from(signatureB64, 'base64url');

    const isVerified = crypto.verify(
      null,
      dataToVerify,
      SATCHIDA_MASTER_PUBLIC_KEY,
      signatureBuffer,
    );

    if (!isVerified) {
      logger.error(
        '[LicenseGuard] Ed25519 cryptographic signature verification FAILED! License file was forged or altered.',
      );
      return { valid: false, reason: 'CRYPTOGRAPHIC_SIGNATURE_INVALID' };
    }

    const payload: LicensePayload = JSON.parse(
      Buffer.from(payloadB64, 'base64url').toString('utf8'),
    );
    const gracePeriod = (payload.gracePeriodSeconds || 0) * 1000;
    const hardExpiry = payload.expiresAt * 1000 + gracePeriod;

    // Hardware fingerprint binding check (prevents folder copying to another PC)
    if (
      payload.hardwareFingerprint &&
      payload.hardwareFingerprint.trim().length > 0 &&
      payload.hardwareFingerprint.trim() !== getLocalHardwareFingerprint()
    ) {
      logger.error('[LicenseGuard] Hardware fingerprint mismatch! License bound to another machine.');
      cachedLicense = { payload, valid: false, expires: hardExpiry };
      return { valid: false, reason: 'HARDWARE_MISMATCH' };
    }

    // Check expiration or remote lockout status
    if (payload.status === 3 || payload.status === 2) {
      cachedLicense = { payload, valid: false, expires: hardExpiry };
      return { valid: false, reason: 'TENANT_LOCKED_BY_OPERATOR' };
    }

    if (now > hardExpiry) {
      cachedLicense = { payload, valid: false, expires: hardExpiry };
      return { valid: false, reason: 'LICENSE_EXPIRED' };
    }

    cachedLicense = { payload, valid: true, expires: hardExpiry };
    return { valid: true, payload };
  } catch (err) {
    logger.error('[LicenseGuard] Error verifying license file:', err);
    return { valid: false, reason: 'LICENSE_VERIFICATION_FAILED' };
  }
}

export interface BrandedNoticeOptions {
  badgeText: string;
  badgeTone?: 'warning' | 'error';
  headline: string;
  detail: string;
  actionHint?: string;
  showHomeButton?: boolean;
}

export function renderBrandedNoticeHtml(opts: BrandedNoticeOptions): string {
  const isError = opts.badgeTone === 'error';
  const badgeBg = isError ? 'rgba(239, 68, 68, 0.12)' : 'rgba(245, 158, 11, 0.12)';
  const badgeColor = isError ? '#f87171' : '#fbbf24';
  const badgeBorder = isError ? 'rgba(239, 68, 68, 0.28)' : 'rgba(245, 158, 11, 0.28)';
  const actionHint =
    opts.actionHint ||
    'Please contact your <strong>Organization / Tenant Administrator</strong> if this issue persists.';
  const buttonHtml = opts.showHomeButton
    ? '<a class="btn" href="/">Return to Workspace</a>'
    : '<button class="btn" type="button" onclick="window.location.reload()">Check Access Again</button>';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Satchida AI — ${opts.headline}</title>
  <link rel="icon" type="image/png" href="/assets/satchida/favicon-32.png" />
  <style>
    :root { color-scheme: dark; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Inter, sans-serif;
      background: radial-gradient(circle at top, #181c24 0%, #0b0d12 65%);
      color: #e5e7eb;
    }
    .card {
      width: 100%;
      max-width: 500px;
      background: rgba(20, 24, 33, 0.92);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 18px;
      padding: 40px 36px;
      text-align: center;
      box-shadow: 0 24px 64px rgba(0, 0, 0, 0.55);
    }
    .logo {
      width: 68px;
      height: 68px;
      object-fit: contain;
      margin: 0 auto 14px;
      display: block;
    }
    .wordmark {
      height: 24px;
      object-fit: contain;
      margin: 0 auto 22px;
      display: block;
      opacity: 0.92;
    }
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 6px 14px;
      border-radius: 999px;
      font-size: 12px;
      font-weight: 600;
      letter-spacing: 0.03em;
      background: ${badgeBg};
      color: ${badgeColor};
      border: 1px solid ${badgeBorder};
      margin-bottom: 18px;
    }
    .dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: ${badgeColor};
    }
    h1 {
      font-size: 22px;
      font-weight: 600;
      color: #f9fafb;
      margin-bottom: 12px;
      letter-spacing: -0.01em;
    }
    p {
      font-size: 14.5px;
      line-height: 1.6;
      color: #9ca3af;
      margin-bottom: 22px;
    }
    .notice-box {
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(255, 255, 255, 0.07);
      border-radius: 12px;
      padding: 14px 16px;
      font-size: 13.5px;
      line-height: 1.55;
      color: #d1d5db;
      margin-bottom: 26px;
    }
    .notice-box strong { color: #f9fafb; }
    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 10px 22px;
      border-radius: 10px;
      border: 1px solid rgba(255, 255, 255, 0.14);
      background: #1f2937;
      color: #f9fafb;
      font-size: 13.5px;
      font-weight: 500;
      text-decoration: none;
      cursor: pointer;
      transition: background 0.15s ease;
    }
    .btn:hover { background: #374151; }
    .footer {
      margin-top: 24px;
      font-size: 11.5px;
      color: #6b7280;
    }
  </style>
</head>
<body>
  <main class="card">
    <img class="logo" src="/assets/satchida/satchida-splash-mandala-dark.png" alt="Satchida AI" />
    <img class="wordmark" src="/assets/satchida/satchida-splash-wordmark-dark.png" alt="Satchida" />
    <div class="badge"><span class="dot"></span>${opts.badgeText}</div>
    <h1>${opts.headline}</h1>
    <p>${opts.detail}</p>
    <div class="notice-box">${actionHint}</div>
    ${buttonHtml}
    <div class="footer">Satchida AI Workspace &bull; Managed Organization Node</div>
  </main>
</body>
</html>`;
}

function renderServiceNoticeHtml(reason?: string): string {
  const isPaused = reason === 'TENANT_LOCKED_BY_OPERATOR';
  return renderBrandedNoticeHtml({
    badgeText: isPaused ? 'Service Paused' : 'Renewal Pending',
    badgeTone: 'warning',
    headline: isPaused
      ? 'Workspace Temporarily Paused'
      : 'Workspace Access Temporarily Unavailable',
    detail: isPaused
      ? 'AI Workspace access for your organization has been temporarily paused by your administrator. Your existing projects, files, and conversations remain safely preserved.'
      : 'The subscription lease for this organization workspace requires renewal. Your existing projects, files, and conversations remain safely preserved.',
    actionHint:
      'Please contact your <strong>Organization / Tenant Administrator</strong> for assistance or to restore workspace access.',
    showHomeButton: false,
  });
}

/**
 * Express middleware to enforce dead-man lease across all protected endpoints.
 */
export function deadManLeaseGuard(req: Request, res: Response, next: NextFunction): void {
  // Allow health checks, status checks, branding assets for the notice page, and admin license renewal
  if (
    req.path === '/health' ||
    req.path === '/livez' ||
    req.path === '/readyz' ||
    req.path === '/api/health' ||
    req.path === '/api/admin/license/update' ||
    req.path === '/favicon.ico' ||
    req.path.startsWith('/assets/satchida/')
  ) {
    return next();
  }

  const result = verifyDeadManLease();
  if (!result.valid) {
    const acceptsHtml =
      !req.path.startsWith('/api/') &&
      typeof req.headers.accept === 'string' &&
      req.headers.accept.includes('text/html');

    if (acceptsHtml) {
      res
        .status(402)
        .setHeader('Content-Type', 'text/html; charset=utf-8')
        .send(renderServiceNoticeHtml(result.reason));
      return;
    }

    res.status(402).json({
      error: 'Workspace access is temporarily paused for this organization.',
      error_code: result.reason || 'SUBSCRIPTION_EXPIRED',
      message:
        'Please contact your Organization / Tenant Administrator to restore workspace access.',
    });
    return;
  }

  next();
}

/**
 * Updates the local license file and resets monotonic clock checks
 */
export function updateNodeLicense(licenseToken: string): { success: boolean; error?: string; payload?: LicensePayload } {
  try {
    const parts = (licenseToken || '').trim().split('.');
    if (parts.length !== 3) {
      return { success: false, error: 'INVALID_TOKEN_FORMAT' };
    }

    const [headerB64, payloadB64, signatureB64] = parts;
    const dataToVerify = Buffer.from(`${headerB64}.${payloadB64}`, 'utf8');
    const signatureBuffer = Buffer.from(signatureB64, 'base64url');

    const isVerified = crypto.verify(
      null,
      dataToVerify,
      SATCHIDA_MASTER_PUBLIC_KEY,
      signatureBuffer,
    );

    if (!isVerified) {
      logger.error('[LicenseGuard] Rejected license update: Invalid cryptographic signature.');
      return { success: false, error: 'CRYPTOGRAPHIC_SIGNATURE_INVALID' };
    }

    const payload: LicensePayload = JSON.parse(
      Buffer.from(payloadB64, 'base64url').toString('utf8'),
    );

    if (
      cachedLicense?.payload?.issuedAt &&
      typeof payload.issuedAt === 'number' &&
      payload.issuedAt < cachedLicense.payload.issuedAt
    ) {
      logger.warn('[LicenseGuard] Rejected replayed/older license token.', {
        incomingIssuedAt: payload.issuedAt,
        currentIssuedAt: cachedLicense.payload.issuedAt,
      });
      return { success: false, error: 'LICENSE_REPLAY_REJECTED' };
    }

    if (
      payload.hardwareFingerprint &&
      payload.hardwareFingerprint.trim().length > 0 &&
      payload.hardwareFingerprint.trim() !== getLocalHardwareFingerprint()
    ) {
      logger.error('[LicenseGuard] Rejected license update: Hardware fingerprint mismatch.');
      return { success: false, error: 'HARDWARE_MISMATCH' };
    }

    const licensePath =
      process.env.SATCHIDA_LICENSE_PATH || path.resolve(process.cwd(), 'satchida.lic');
    fs.writeFileSync(licensePath, licenseToken.trim(), { encoding: 'utf8', flag: 'w' });

    // Update in-memory clock watermark and cached license
    const now = Date.now();
    lastMonotonicTimestamp = now;
    const ledgerPath = getClockLedgerPath();
    try {
      fs.writeFileSync(ledgerPath, String(now), { encoding: 'utf8', flag: 'w' });
    } catch (e) {
      logger.warn('[LicenseGuard] Failed to write clock watermark on license update:', e);
    }

    const gracePeriod = (payload.gracePeriodSeconds || 0) * 1000;
    const hardExpiry = payload.expiresAt * 1000 + gracePeriod;
    const isLocked = payload.status === 2 || payload.status === 3;
    cachedLicense = { payload, valid: !isLocked, expires: hardExpiry };
    lastCheckTime = now;

    logger.info('[LicenseGuard] Successfully installed and verified new Satchida license', {
      tenantId: payload.tenantId,
      expiresAt: payload.expiresAt,
      plan: payload.plan,
    });

    return { success: true, payload };
  } catch (err: any) {
    logger.error('[LicenseGuard] Exception while installing license:', err);
    return { success: false, error: err?.message || 'LICENSE_UPDATE_FAILED' };
  }
}
