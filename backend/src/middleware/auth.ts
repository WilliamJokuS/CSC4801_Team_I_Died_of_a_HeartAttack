import type { RequestHandler } from 'express';
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

/** 401 unless the request carries a valid, unexpired `Authorization: Bearer <jwt>`. */
export function requireAuth(jwtSecret: string): RequestHandler {
  return (req, _res, next) => {
    const header = req.headers.authorization;
    const match = header?.match(/^Bearer\s+(\S+)$/i);
    const claims = match ? verifyToken(match[1], jwtSecret) : null;
    if (!claims) {
      next(unauthorized());
      return;
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
