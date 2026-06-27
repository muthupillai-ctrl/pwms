import { app } from './app';
import { env } from './config/env';
import { testConnection } from './config/db';
import { connectRedis } from './config/redis';
import { logger } from './utils/logger';

async function bootstrap(): Promise<void> {
  logger.info('Starting PWMS API', { env: env.nodeEnv });

  try {
    await testConnection();
    await connectRedis();
  } catch (err: any) {
    logger.error('Startup failed', { error: err.message });
    process.exit(1);
  }

  const server = app.listen(env.port, () => {
    logger.info(`PWMS API listening on port ${env.port}`, {
      api: `http://localhost:${env.port}${env.apiPrefix}`,
      health: `http://localhost:${env.port}/health`,
    });
  });

  // ── Graceful shutdown ────────────────────────────────────
  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal} — shutting down gracefully`);
    server.close(async () => {
      logger.info('HTTP server closed');
      process.exit(0);
    });
    setTimeout(() => {
      logger.error('Forced shutdown after timeout');
      process.exit(1);
    }, 10_000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT',  () => shutdown('SIGINT'));

  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled promise rejection', { reason });
  });

  process.on('uncaughtException', (err) => {
    // Network timeouts (ETIMEDOUT, ECONNRESET) from Redis/DB are transient — log and continue.
    // Only exit on truly fatal errors.
    const transient = ['ETIMEDOUT', 'ECONNRESET', 'ECONNREFUSED', 'EPIPE', 'ENOTFOUND'];
    if (transient.some(code => (err as NodeJS.ErrnoException).code === code)) {
      logger.error('Transient network error (ignored)', { code: (err as NodeJS.ErrnoException).code, message: err.message });
    } else {
      logger.error('Fatal uncaught exception — exiting', { message: err.message, stack: err.stack });
      process.exit(1);
    }
  });
}

bootstrap();
