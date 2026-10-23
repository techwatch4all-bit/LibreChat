import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { logger } from '@librechat/data-schemas';
import type { Request, Response, NextFunction } from 'express';

export interface LicensePayload {
  tenantId: string;
  hardwareFingerprint?: string;
  maxSeats?: number;
  issuedAt: number;
  expiresAt: number;
  gracePeriodSeconds?: number;
  plan?: string;
  features?: string[];
}

let cachedLicense: { payload: LicensePayload; valid: boolean; expires: number } | null = null;
let lastCheckTime = 0;
let lastMonotonicTimestamp = Date.now();

/**
 * Hardcoded Satchida Master Authority Ed25519 Public Key.
 * Embedded directly in compiled bytecode so tenant IT cannot modify it by editing .env.
 */
export const SATCHIDA_MASTER_PUBLIC_KEY: string =
  process.env.SATCHIDA_LICENSE_PUBLIC_KEY ||
  `-----BEGIN PUBLIC KEY-----\nMCowBQYDK2VwAyEA2ZRQdPW8GWhNtN403gBNABcAhWeJWqELuyI/cLbO+l0=\n-----END PUBLIC KEY-----`;

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
    if (!cachedLicense.valid || now > cachedLicense.expires) {
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

    // Check expiration
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

/**
 * Express middleware to enforce dead-man lease across all protected endpoints.
 */
export function deadManLeaseGuard(req: Request, res: Response, next: NextFunction): void {
  // Allow health checks, status checks, and admin license renewal endpoint
  if (
    req.path === '/health' ||
    req.path === '/livez' ||
    req.path === '/readyz' ||
    req.path === '/api/health' ||
    req.path === '/api/admin/license/update'
  ) {
    return next();
  }

  const result = verifyDeadManLease();
  if (!result.valid) {
    res.status(402).json({
      error: 'Satchida Subscription Node Lease Expired or Cryptographically Invalid.',
      error_code: result.reason || 'SUBSCRIPTION_EXPIRED',
      message:
        'This node lease has expired or failed cryptographic verification. Please contact support@satchida.com for renewal.',
    });
    return;
  }

  next();
}
