import { z } from 'zod';
import type { PrismaClient } from '../generated/prisma/client.js';
import { Prisma } from '../generated/prisma/client.js';
import { conflict, unauthorized } from '../lib/errors.js';
import { persistedText } from '../lib/validation.js';
import { DUMMY_HASH, hashPassword, isBcryptCompatiblePassword, verifyPassword } from './password.js';
import { signToken } from './jwt.js';

/** The `AuthUser` shape returned by the auth endpoints and GET /api/me. Never includes password_hash. */
export interface AuthUser {
  id: string;
  email: string;
  role: 'Candidate' | 'Employer';
  display_name: string;
  created_at: string;
}

export interface AuthResult {
  token: string;
  user: AuthUser;
}

export interface AuthDeps {
  prisma: PrismaClient;
  jwtSecret: string;
  jwtExpiresIn: string;
}

const normalizedEmail = persistedText.trim().toLowerCase();
const emailAddress = z.email({ message: 'must be a valid email address' });

export const registerSchema = z.object({
  email: normalizedEmail.max(254, 'must be at most 254 characters').pipe(emailAddress),
  password: z
    .string()
    .refine((password) => Buffer.byteLength(password, 'utf8') >= 8, 'must be at least 8 bytes')
    .refine(isBcryptCompatiblePassword, 'must be at most 72 bytes and contain no NUL characters'),
  display_name: persistedText.trim().min(1, 'must not be empty').max(100),
  role: z.enum(['Candidate', 'Employer']),
});

export const loginSchema = z.object({
  // Existing accounts may have been registered before the length limit was added.
  email: normalizedEmail.pipe(emailAddress),
  password: z.string().min(1, 'must not be empty'),
});

type UserRow = {
  id: string;
  email: string;
  role: 'Candidate' | 'Employer';
  displayName: string;
  createdAt: Date;
};

export function toAuthUser(u: UserRow): AuthUser {
  return {
    id: u.id,
    email: u.email,
    role: u.role,
    display_name: u.displayName,
    created_at: u.createdAt.toISOString(),
  };
}

const userSelect = { id: true, email: true, role: true, displayName: true, createdAt: true } as const;

function issue(deps: AuthDeps, user: UserRow): AuthResult {
  const token = signToken({ sub: user.id, role: user.role }, deps.jwtSecret, deps.jwtExpiresIn);
  return { token, user: toAuthUser(user) };
}

/**
 * FP-AUTH-1: creates the user and its role-specific profile row in one transaction.
 * 409 EMAIL_TAKEN on duplicate email (enforced by the users.email UNIQUE constraint,
 * so two concurrent registrations can't both succeed).
 */
export async function register(deps: AuthDeps, input: unknown): Promise<AuthResult> {
  const data = registerSchema.parse(input);
  const passwordHash = await hashPassword(data.password);

  try {
    const user = await deps.prisma.user.create({
      data: {
        email: data.email,
        passwordHash,
        role: data.role,
        displayName: data.display_name,
        ...(data.role === 'Candidate'
          ? { candidateProfile: { create: {} } }
          : // company_name is NOT NULL; start with the display name, editable via PUT profile.
            { companyProfile: { create: { companyName: data.display_name } } }),
      },
      select: userSelect,
    });
    return issue(deps, user);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw conflict('An account with this email already exists', 'EMAIL_TAKEN');
    }
    throw err;
  }
}

/** 401 INVALID_CREDENTIALS for unknown email or wrong password (same message for both). */
export async function login(deps: AuthDeps, input: unknown): Promise<AuthResult> {
  const data = loginSchema.parse(input);
  const user = await deps.prisma.user.findUnique({
    where: { email: data.email },
    select: { ...userSelect, passwordHash: true },
  });

  const ok = await verifyPassword(data.password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !ok) {
    throw unauthorized('Invalid email or password', 'INVALID_CREDENTIALS');
  }
  return issue(deps, user);
}

/** GET /api/me. A valid token for a since-deleted user is treated as unauthenticated. */
export async function getMe(deps: AuthDeps, userId: string): Promise<AuthUser> {
  const user = await deps.prisma.user.findUnique({ where: { id: userId }, select: userSelect });
  if (!user) throw unauthorized();
  return toAuthUser(user);
}
