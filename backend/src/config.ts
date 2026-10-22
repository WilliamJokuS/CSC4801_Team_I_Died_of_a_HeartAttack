import 'dotenv/config';

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

export const config = {
  port: Number(process.env.PORT ?? 8080),
  databaseUrl: required('DATABASE_URL'),
  jwtSecret: jwtSecret(),
  // Contract/API_Contract.md "Resolved decisions" #1: 24 hours, no refresh token.
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '24h',
};
