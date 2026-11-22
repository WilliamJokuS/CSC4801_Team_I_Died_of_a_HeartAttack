import type { RequestHandler } from 'express';
import type { PrismaClient } from '../generated/prisma/client.js';
import { verifyToken, type TokenClaims } from '../auth/jwt.js';
import { forbidden, unauthorized } from '../lib/errors.js';
import type { Role } from '../generated/prisma/enums.js';

declare global {
  namespace Express {
    interface Request {
      /** Set by requireAuth. */
      auth?: TokenClaims;
    }
  }
}

/** Verifies the bearer token and, when given Prisma, checks that its account and role still exist. */
export function requireAuth(jwtSecret: string, prisma?: PrismaClient): RequestHandler {
  return async (req, _res, next) => {
    const header = req.headers.authorization;
    const match = header?.match(/^Bearer\s+(\S+)$/i);
    const claims = match ? verifyToken(match[1], jwtSecret) : null;
    if (!claims) {
      next(unauthorized());
      return;
    }
    if (prisma) {
      const user = await prisma.user.findUnique({
        where: { id: claims.sub },
        select: { role: true },
      });
      if (!user || user.role !== claims.role) throw unauthorized();
    }
    req.auth = claims;
    next();
  };
}

/** 403 unless the authenticated user has one of the given roles. Use after requireAuth. */
export function requireRole(...roles: Role[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.auth) {
      next(unauthorized());
      return;
    }
    if (!roles.includes(req.auth.role)) {
      next(forbidden(`Requires role: ${roles.join(' or ')}`));
      return;
    }
    next();
  };
}
