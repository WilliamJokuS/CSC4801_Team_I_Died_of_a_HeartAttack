import 'dotenv/config';
import jwt from 'jsonwebtoken';
import { signToken } from './auth/jwt.js';

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable ${name} (see .env.example)`);
  }
  return value;
}

// HS256 is only as strong as its key: anyone who knows the secret can sign a token for any
// user and role. Refuse short or placeholder secrets (like .env.example's) instead of
// starting with a forgeable one.
const MIN_JWT_SECRET_LENGTH = 32;

function jwtSecret(): string {
  const secret = required('JWT_SECRET');
  if (secret.length < MIN_JWT_SECRET_LENGTH) {
    throw new Error(
      `JWT_SECRET must be at least ${MIN_JWT_SECRET_LENGTH} characters. Generate one with: ` +
        `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`,
    );
  }
  return secret;
}

function jwtLifetime(secret: string): string {
  // Contract/API_Contract.md "Resolved decisions" #1: 24 hours, no refresh token.
  const lifetime = process.env.JWT_EXPIRES_IN ?? '24h';
  try {
    const token = signToken({ sub: 'configuration-check', role: 'Candidate' }, secret, lifetime);
    const claims = jwt.decode(token);
    if (
      claims && typeof claims !== 'string' && typeof claims.iat === 'number' &&
      typeof claims.exp === 'number' && Number.isSafeInteger(claims.exp) && claims.exp > claims.iat
    ) {
      return lifetime;
    }
  } catch {
    // Signing rejects invalid duration syntax.
  }
  throw new Error('JWT_EXPIRES_IN must be a duration of at least one second (for example, 24h)');
}

const databaseUrl = required('DATABASE_URL');
const secret = jwtSecret();
export const config = {
  port: Number(process.env.PORT ?? 8080),
  databaseUrl,
  jwtSecret: secret,
  jwtExpiresIn: jwtLifetime(secret),
};
