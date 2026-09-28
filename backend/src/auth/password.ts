import bcrypt from 'bcryptjs';

// bcrypt with a per-hash random salt (FP-AUTH-2). Cost 12 ≈ 200-300 ms per hash.
const COST = 12;

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, COST);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

// Compared against when the email doesn't exist, so a login for an unknown email
// takes as long as one with a wrong password (no account enumeration by timing).
export const DUMMY_HASH = bcrypt.hashSync('dummy-password-for-timing', COST);
