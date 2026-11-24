import { Router, type RequestHandler } from 'express';
import { limitAuthRequests, type AuthLimits } from '../auth/limits.js';
import { getMe, login, register, type AuthDeps } from '../auth/service.js';
import { requireAuth } from '../middleware/auth.js';

export function authRouter(deps: AuthDeps, limits?: AuthLimits): Router {
  const router = Router();
  const protect = limits ? limitAuthRequests(limits) : (handler: RequestHandler) => [handler];
  const authenticated = requireAuth(deps.jwtSecret, deps.prisma);

  router.post('/auth/register', ...protect(async (req, res) => {
    res.status(201).json(await register(deps, req.body));
  }));

  router.post('/auth/login', ...protect(async (req, res) => {
    res.json(await login(deps, req.body));
  }));

  // JWTs are stateless (no refresh/session table in the contract), so logout is the
  // client discarding its token. The endpoint still requires a valid token so the
  // frontend gets a 401 for an already-expired session.
  router.post('/auth/logout', authenticated, (_req, res) => {
    res.status(204).end();
  });

  router.get('/me', authenticated, async (req, res) => {
    res.json(await getMe(deps, req.auth!.sub));
  });

  return router;
}
