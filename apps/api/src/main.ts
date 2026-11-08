import { createApp } from './app';
import { env } from './config/env';
import { logger } from './common/logger';
import { prisma } from './common/prisma';

const server = createApp().listen(env.PORT, () => {
  logger.info(`Fleet-Pulse API listening on http://localhost:${env.PORT}/api`);
});

// Close the database connection cleanly on Ctrl+C or a container stop
async function shutdown(signal: string) {
  logger.info(`${signal} received, shutting down`);
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
