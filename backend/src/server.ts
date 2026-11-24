import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createApp } from './app.js';
import { config } from './config.js';
import { prisma } from './lib/prisma.js';

const frontendDist = fileURLToPath(new URL('../../frontend/dist/', import.meta.url));
const frontendIndex = fileURLToPath(new URL('../../frontend/dist/index.html', import.meta.url));

const app = createApp({
  prisma,
  jwtSecret: config.jwtSecret,
  jwtExpiresIn: config.jwtExpiresIn,
  authLimits: { requestsPerMinute: 20, concurrency: 4 },
  trustedProxies: process.env.AUTH_TRUSTED_PROXIES?.trim(),
  staticDir: existsSync(frontendIndex) ? frontendDist : undefined,
});

app.listen(config.port, () => {
  console.log(`API listening on http://localhost:${config.port}/api`);
});
