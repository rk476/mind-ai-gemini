import { MongoClient, type Db, type Collection } from 'mongodb';
import { config } from '@/lib/config';
import type { TestRunDoc, TestCaseDoc, TestStepDoc } from '@/lib/config';

let client: MongoClient | null = null;
let db: Db | null = null;

export async function getDb(): Promise<Db> {
  if (db) return db;
  client = new MongoClient(config.database.url);
  await client.connect();
  db = client.db();
  return db;
}

export async function getCollection<T extends { _id: string }>(
  name: string
): Promise<Collection<T>> {
  const database = await getDb();
  return database.collection<T>(name);
}

export function testRuns(): Promise<Collection<TestRunDoc>> {
  return getCollection<TestRunDoc>('test_runs');
}

export function testCases(): Promise<Collection<TestCaseDoc>> {
  return getCollection<TestCaseDoc>('test_cases');
}

export function testSteps(): Promise<Collection<TestStepDoc>> {
  return getCollection<TestStepDoc>('test_steps');
}

// ─── Indexes (called once at worker startup) ───────────────────────────

export async function migrate(): Promise<void> {
  const cases = await testCases();
  await cases.createIndex({ run_id: 1 });

  const steps = await testSteps();
  await steps.createIndex({ test_case_id: 1 });
  await steps.createIndex({ created_at: 1 });
}
