import { resolve } from 'node:path';
import express from 'express';
import type { AuthLimits } from './auth/limits.js';
import type { PrismaClient } from './generated/prisma/client.js';
import { errorHandler, notFoundHandler } from './lib/errors.js';
import { applicationsRouter } from './routes/applications.js';
import { authRouter } from './routes/auth.js';
import { jobsRouter } from './routes/jobs.js';
import { profilesRouter } from './routes/profiles.js';
import { schedulingRouter } from './routes/scheduling.js';

export interface AppDeps {
  prisma: PrismaClient;
  jwtSecret: string;
  jwtExpiresIn: string;
  staticDir?: string;
  authLimits?: AuthLimits;
  trustedProxies?: string;
}

/**
 * Builds the Express app without starting a listener, so tests can inject a
 * test-database Prisma client and a test JWT secret.
 */
export function createApp(deps: AppDeps) {
  const app = express();
  app.disable('x-powered-by');
  if (deps.trustedProxies) app.set('trust proxy', deps.trustedProxies);
  app.use(express.json({ limit: '100kb' }));

  const api = express.Router();

  api.get('/health', async (_req, res) => {
    try {
      await deps.prisma.$queryRaw`SELECT 1`;
      res.json({ status: 'ok' });
    } catch {
      res.status(503).json({ error: { code: 'DB_UNAVAILABLE', message: 'Database unreachable' } });
    }
  });

  api.use(authRouter(deps, deps.authLimits));
  api.use(profilesRouter(deps));
  api.use(jobsRouter(deps));
  api.use(applicationsRouter(deps));
  api.use(schedulingRouter(deps));

  app.use('/api', api);
  app.use('/api', notFoundHandler);

  const { staticDir } = deps;
  if (staticDir) {
    const index = resolve(staticDir, 'index.html');
    app.use(express.static(staticDir));
    app.get(/^(?!\/api(?:\/|$)).*/, (_req, res) => {
      res.sendFile(index);
    });
  }

  app.use(errorHandler);
  return app;
}
