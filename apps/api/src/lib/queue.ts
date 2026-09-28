import PgBoss from 'pg-boss';
import { QUEUES, QUEUE_DEFINITIONS, type PhotoProcessJob, type ZipBuildJob } from '@wm/shared';
import { env } from '../env';
import { logger } from './logger';

// The API only sends jobs; the worker process owns maintenance and scheduling.
const boss = new PgBoss({
  connectionString: env.DATABASE_URL,
  supervise: false,
  schedule: false,
  max: 3,
});

boss.on('error', (err) => logger.error({ err }, 'pg-boss error'));

/**
 * On a fresh database the API and worker start together and both create the queues; Postgres
 * can report a deadlock between them. The other process will have succeeded, so just retry.
 */
async function ensureQueues(b: PgBoss) {
  for (const def of QUEUE_DEFINITIONS) {
    for (let attempt = 1; ; attempt++) {
      try {
        if (!(await b.getQueue(def.name))) await b.createQueue(def.name, { ...def });
        break;
      } catch (err) {
        if ((err as { code?: string }).code !== '40P01' || attempt >= 5) throw err;
        await new Promise((r) => setTimeout(r, 200 * attempt + Math.random() * 300));
      }
    }
  }
}

let started: Promise<PgBoss> | null = null;

export function startQueue() {
  started ??= boss.start().then(async () => {
    await ensureQueues(boss);
    return boss;
  });
  return started;
}

export async function stopQueue() {
  if (started) await boss.stop({ graceful: true });
}

export async function enqueueZipBuild(data: ZipBuildJob) {
  const b = await startQueue();
  await b.send(QUEUES.zipBuild, data);
}

export async function enqueuePhotoProcess(data: PhotoProcessJob) {
  const b = await startQueue();
  await b.send(QUEUES.photoProcess, data, { singletonKey: data.photoId });
}
