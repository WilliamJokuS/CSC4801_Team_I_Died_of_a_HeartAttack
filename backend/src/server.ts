import { createApp } from './app.js';
import { config } from './config.js';
import { prisma } from './lib/prisma.js';

const app = createApp({
  prisma,
  jwtSecret: config.jwtSecret,
  jwtExpiresIn: config.jwtExpiresIn,
});

app.listen(config.port, () => {
  console.log(`API listening on http://localhost:${config.port}/api`);
});
