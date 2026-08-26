import { createApp } from './app.js';
import { prisma } from './db/prisma.js';
import { sessionPool } from './db/sessionPool.js';

const port = Number(process.env.PORT ?? 3000);
const app = createApp();

const server = app.listen(port, '0.0.0.0', () => {
  console.log(`API is running on port ${port}`);
});

const shutdown = () => {
  server.close(async () => {
    await Promise.all([
      prisma.$disconnect(),
      sessionPool.end(),
    ]);
    process.exit(0);
  });
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
