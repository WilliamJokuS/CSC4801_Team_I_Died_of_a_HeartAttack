import express from 'express';
import type { PrismaClient } from './generated/prisma/client.js';
import { errorHandler, notFoundHandler } from './lib/errors.js';
import { authRouter } from './routes/auth.js';
import { jobsRouter } from './routes/jobs.js';
import { profilesRouter } from './routes/profiles.js';

export interface AppDeps {
  prisma: PrismaClient;
  jwtSecret: string;
  jwtExpiresIn: string;
}

/**
 * Builds the Express app without starting a listener, so tests can inject a
 * test-database Prisma client and a test JWT secret.
 */
export function createApp(deps: AppDeps) {
  const app = express();
  app.disable('x-powered-by');
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

  api.use(authRouter(deps));
  api.use(profilesRouter(deps));
  api.use(jobsRouter(deps));

  app.use('/api', api);
  app.use('/api', notFoundHandler);
  app.use(errorHandler);
  return app;
}
