import crypto from 'node:crypto';

declare global {
  // eslint-disable-next-line no-var
  var __satchidaFleetPepper: string | undefined;
}

/**
 * Returns the active fleet pepper.
 * Priority:
 * 1. Dynamic in-memory volatile pepper set during HQ handshake.
 * 2. Process environment FLEET_PEPPER_KEY (if configured).
 * 3. Fallback deterministic local entropy key based on JWT_SECRET / CREDS_KEY.
 */
export function getFleetPepper(): string {
  if (globalThis.__satchidaFleetPepper) {
    return globalThis.__satchidaFleetPepper;
  }
  if (process.env.FLEET_PEPPER_KEY && process.env.FLEET_PEPPER_KEY.trim()) {
    return process.env.FLEET_PEPPER_KEY.trim();
  }
  // Deterministic edge fallback derived from master secrets if not yet handshook
  const fallbackSource = process.env.JWT_SECRET || process.env.CREDS_KEY || 'satchida_default_pepper_2026';
  return crypto.createHash('sha256').update(`satchida_pepper:${fallbackSource}`).digest('hex');
}

/**
 * Sets the active in-memory fleet pepper. Stored strictly in RAM.
 */
export function setFleetPepper(pepper: string): void {
  if (typeof pepper === 'string' && pepper.trim().length >= 16) {
    globalThis.__satchidaFleetPepper = pepper.trim();
  }
}

/**
 * Wraps a plaintext password with the active fleet pepper via HMAC-SHA256.
 * Any direct raw bcrypt comparison against an unpeppered input will fail.
 */
export function wrapPasswordWithPepper(rawPassword: string, customPepper?: string): string {
  const pepper = customPepper || getFleetPepper();
  return crypto.createHmac('sha256', pepper).update(rawPassword).digest('hex');
}
