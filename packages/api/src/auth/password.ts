import crypto from 'node:crypto';
import { getFleetPepper, setFleetPepper, wrapPasswordWithPepper } from './fleetPepper';

interface UserWithPassword {
  password?: string;
  passwordSig?: string | null;
  [key: string]: unknown;
}

export interface ComparePasswordDeps {
  compare: (candidatePassword: string, hash: string) => Promise<boolean>;
  onLegacyMatch?: (pepperedCandidateHash: string) => Promise<void> | void;
}

/**
 * Calculates a cryptographic signature for a stored password hash using the active pepper.
 */
export function calculatePasswordSignature(passwordHash: string, customPepper?: string): string {
  const pepper = customPepper || getFleetPepper();
  return crypto.createHmac('sha256', pepper).update(passwordHash).digest('hex');
}

/**
 * Verifies if the stored password's signature matches the active pepper.
 * If someone modifies `user.password` directly in MongoDB without calculating
 * the HMAC signature with the pepper, this check returns false.
 */
export function verifyPasswordSignature(user: UserWithPassword, customPepper?: string): boolean {
  if (!user?.password) return false;
  if (!user.passwordSig) return false;
  const expectedSig = calculatePasswordSignature(user.password, customPepper);
  try {
    return crypto.timingSafeEqual(Buffer.from(user.passwordSig, 'hex'), Buffer.from(expectedSig, 'hex'));
  } catch {
    return false;
  }
}

/**
 * Compares a candidate password against a user's hashed password.
 * 
 * Defense-in-depth:
 * 1. Mandatory Integrity Check: Every user with a local password must hold a valid
 *    `passwordSig` signed with the active fleet pepper. Any out-of-band direct MongoDB
 *    write (or signature wipe) will instantly fail verification.
 * 2. Compares candidate password against the signed database hash.
 */
export async function comparePassword(
  user: UserWithPassword,
  candidatePassword: string,
  deps: ComparePasswordDeps,
): Promise<boolean> {
  if (!user) {
    throw new Error('No user provided');
  }

  if (!user.password) {
    throw new Error('No password, likely an email first registered via Social/OIDC login');
  }

  // Mandatory Cryptographic Signature Verification
  // If passwordSig is missing or does not match HMAC-SHA256(password, fleetPepper), reject immediately.
  if (!verifyPasswordSignature(user)) {
    return false;
  }

  // 1. Primary check: Peppered candidate password
  const pepperedCandidate = wrapPasswordWithPepper(candidatePassword);
  const pepperMatch = await deps.compare(pepperedCandidate, user.password);
  if (pepperMatch) {
    return true;
  }

  // 2. Fallback check: Legacy unpeppered password (for seamless upgrade)
  const legacyMatch = await deps.compare(candidatePassword, user.password);
  if (legacyMatch) {
    return true;
  }

  return false;
}

export { getFleetPepper, setFleetPepper, wrapPasswordWithPepper };
