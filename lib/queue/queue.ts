import { Queue, Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import { config } from '@/lib/config';

let connection: IORedis | null = null;

export function getRedisConnection(): IORedis {
  if (!connection) {
    const redisUrl = config.redis.url;
    const isUpstash = redisUrl.includes('upstash.io');

    connection = new IORedis(redisUrl, {
      maxRetriesPerRequest: null,
      ...(isUpstash ? { tls: {}, family: 6 } : {}),
    });
  }
  return connection;
}

const QUEUE_NAME = 'test-runs';

let testQueue: Queue | null = null;

export function getTestQueue(): Queue {
  if (!testQueue) {
    testQueue = new Queue(QUEUE_NAME, {
      connection: getRedisConnection(),
      defaultJobOptions: {
        attempts: 1,
        removeOnComplete: { count: 1000 },
        removeOnFail: { count: 500 },
      },
    });
  }
  return testQueue;
}

export interface TestJobData {
  runId: string;
  url: string;
  instructions: string;
  headless: boolean;
}

export async function enqueueTestRun(data: TestJobData): Promise<string> {
  const queue = getTestQueue();
  const job = await queue.add('run-test', data, {
    jobId: data.runId,
  });
  return job.id ?? data.runId;
}

export function createTestWorker(
  processor: (job: Job<TestJobData>) => Promise<void>
): Worker<TestJobData> {
  const worker = new Worker<TestJobData>(QUEUE_NAME, processor, {
    connection: getRedisConnection(),
    concurrency: 2,
    limiter: {
      max: 5,
      duration: 60000,
    },
  });

  worker.on('failed', (job, err) => {
    console.error(`Job ${job?.id} failed:`, err.message);
  });

  worker.on('completed', (job) => {
    console.log(`Job ${job.id} completed`);
  });

  return worker;
}
