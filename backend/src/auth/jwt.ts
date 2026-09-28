import jwt from 'jsonwebtoken';
import type { Role } from '../generated/prisma/enums.js';

export interface TokenClaims {
  sub: string; // user id
  role: Role;
}

export function signToken(claims: TokenClaims, secret: string, expiresIn: string): string {
  return jwt.sign({ role: claims.role }, secret, {
    subject: claims.sub,
    expiresIn: expiresIn as jwt.SignOptions['expiresIn'],
    algorithm: 'HS256',
  });
}

/** Returns the claims, or null if the token is missing, malformed, tampered, or expired. */
export function verifyToken(token: string, secret: string): TokenClaims | null {
  try {
    const payload = jwt.verify(token, secret, { algorithms: ['HS256'] });
    if (typeof payload === 'string' || typeof payload.sub !== 'string') return null;
    if (payload.role !== 'Candidate' && payload.role !== 'Employer') return null;
    return { sub: payload.sub, role: payload.role };
  } catch {
    return null;
  }
}
