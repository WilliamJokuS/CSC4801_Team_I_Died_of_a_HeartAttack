import bcrypt from 'bcryptjs';

// bcrypt with a per-hash random salt (FP-AUTH-2). Cost 12 ≈ 200-300 ms per hash.
const COST = 12;

export function isBcryptCompatiblePassword(plain: string): boolean {
  return !plain.includes('\0') && !bcrypt.truncates(plain);
}

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, COST);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  if (!isBcryptCompatiblePassword(plain)) {
    await bcrypt.compare('', DUMMY_HASH);
    return false;
  }
  return bcrypt.compare(plain, hash);
}

// Keep the bcrypt cost on login attempts with an unknown email or invalid password input.
export const DUMMY_HASH = bcrypt.hashSync('dummy-password-for-timing', COST);
