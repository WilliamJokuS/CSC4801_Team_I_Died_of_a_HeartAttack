import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { createApp } from './app.js';
import { config } from './config.js';
import { prisma } from './lib/prisma.js';

const app = createApp({
  prisma,
  jwtSecret: config.jwtSecret,
  jwtExpiresIn: config.jwtExpiresIn,
});

const frontendDist = fileURLToPath(new URL('../../frontend/dist/', import.meta.url));
const frontendIndex = fileURLToPath(new URL('../../frontend/dist/index.html', import.meta.url));
if (existsSync(frontendIndex)) {
  app.use(express.static(frontendDist));
  app.get(/^(?!\/api(?:\/|$)).*/, (_req, res) => {
    res.sendFile(frontendIndex);
  });
}

app.listen(config.port, () => {
  console.log(`API listening on http://localhost:${config.port}/api`);
});
