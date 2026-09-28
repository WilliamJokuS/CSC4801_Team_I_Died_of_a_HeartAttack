import 'dotenv/config';

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable ${name} (see .env.example)`);
  }
  return value;
}

export const config = {
  port: Number(process.env.PORT ?? 8080),
  databaseUrl: required('DATABASE_URL'),
  jwtSecret: required('JWT_SECRET'),
  // Contract/API_Contract.md "Resolved decisions" #1: 24 hours, no refresh token.
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '24h',
};
