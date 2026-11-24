import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';
import { config } from '../config.js';

export const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: config.databaseUrl,
    connectionTimeoutMillis: 1_500,
    lock_timeout: 1_500,
    statement_timeout: 2_500,
    query_timeout: 3_000,
  }),
});
