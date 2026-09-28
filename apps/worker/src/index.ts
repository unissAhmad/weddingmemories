import PgBoss from 'pg-boss';
import { prisma } from '@wm/db';
import { QUEUES, QUEUE_DEFINITIONS, type PhotoProcessJob } from '@wm/shared';
import { env } from './env';
import { logger } from './lib/logger';
import { handleProcessPhoto } from './jobs/processPhoto';
import { runCleanup } from './jobs/cleanup';

/**
 * On a fresh database the API and worker start together and both create the queues; Postgres
 * can report a deadlock between them. The other process will have succeeded, so just retry.
 */
async function ensureQueues(boss: PgBoss) {
  for (const def of QUEUE_DEFINITIONS) {
    for (let attempt = 1; ; attempt++) {
      try {
        if (!(await boss.getQueue(def.name))) await boss.createQueue(def.name, { ...def });
        break;
      } catch (err) {
        if ((err as { code?: string }).code !== '40P01' || attempt >= 5) throw err;
        await new Promise((r) => setTimeout(r, 200 * attempt + Math.random() * 300));
      }
    }
  }
}

async function main() {
  const boss = new PgBoss({ connectionString: env.DATABASE_URL, max: env.WORKER_CONCURRENCY + 4 });
  boss.on('error', (err) => logger.error({ err }, 'pg-boss error'));
  await boss.start();

  await ensureQueues(boss);

  // One poller per slot gives us WORKER_CONCURRENCY photos in flight.
  for (let i = 0; i < env.WORKER_CONCURRENCY; i++) {
    await boss.work<PhotoProcessJob>(
      QUEUES.photoProcess,
      { batchSize: 1, includeMetadata: true, pollingIntervalSeconds: 2 },
      handleProcessPhoto,
    );
  }

  await boss.schedule(QUEUES.cleanup, '*/15 * * * *');
  await boss.work(QUEUES.cleanup, { batchSize: 1 }, async () => {
    await runCleanup(boss);
  });

  logger.info({ concurrency: env.WORKER_CONCURRENCY }, 'worker started');

  const shutdown = async (signal: string) => {
    logger.info(`${signal} received, finishing in-flight jobs`);
    await boss.stop({ graceful: true, timeout: 60_000 });
    await prisma.$disconnect();
    process.exit(0);
  };
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

main().catch((err) => {
  logger.fatal({ err }, 'worker failed to start');
  process.exit(1);
});
