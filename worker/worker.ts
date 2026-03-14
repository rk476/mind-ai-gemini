/**
 * Worker process — runs outside the Next.js request/response lifecycle.
 * Consumes jobs from the Redis queue and executes browser tests.
 *
 * Usage: npx tsx worker/worker.ts
 */

import 'dotenv/config';
import { createTestWorker, type TestJobData, getRedisConnection } from '../lib/queue/queue';
import { executeTestRun } from '../lib/executor/testRunner';
import { migrate } from '../lib/db/db';
import type { Job } from 'bullmq';

async function checkRedisConnection(): Promise<void> {
  console.log('[Worker] Checking Redis connection...');
  const redis = getRedisConnection();
  try {
    await redis.ping();
    console.log('[Worker] Redis connection successful.');
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error(`[Worker] Redis connection failed: ${errorMessage}`);
    console.error(`[Worker] Please ensure Redis is running and accessible at ${process.env.REDIS_URL || 'redis://localhost:6379'}`);
    throw new Error('Redis connection check failed');
  }
}

async function processJob(job: Job<TestJobData>): Promise<void> {
  const { runId, url, instructions, headless } = job.data;
  console.log(`[Worker] Processing job ${job.id} — runId=${runId} url=${url}`);

  const result = await executeTestRun(runId, url, instructions, headless);

  console.log(`[Worker] Job ${job.id} completed — status=${result.status}`);
}

async function main(): Promise<void> {
  await checkRedisConnection();

  console.log('[Worker] Ensuring database indexes...');
  await migrate();
  console.log('[Worker] Indexes ready.');

  console.log('[Worker] Starting worker...');
  const worker = createTestWorker(processJob);

  // Graceful shutdown
  const shutdown = async () => {
    console.log('[Worker] Shutting down...');
    await worker.close();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  console.log('[Worker] Ready. Waiting for jobs...');
}

main().catch((err) => {
  console.error('[Worker] Fatal error:', err);
  process.exit(1);
});
