import * as fs from 'fs/promises';
import * as path from 'path';
import type { TestRunDoc, TestCaseDoc, TestStepDoc } from '@/lib/config';

const REPORTS_DIR = path.resolve(process.cwd(), 'reports');

export interface TestReport {
  run: TestRunDoc;
  testCases: (TestCaseDoc & { steps: TestStepDoc[] })[];
}

export async function saveReport(runId: string, report: TestReport): Promise<string> {
  await fs.mkdir(REPORTS_DIR, { recursive: true });
  const filePath = path.join(REPORTS_DIR, `${runId}.json`);
  await fs.writeFile(filePath, JSON.stringify(report, null, 2), 'utf-8');
  return filePath;
}

export async function loadReport(runId: string): Promise<TestReport | null> {
  const filePath = path.join(REPORTS_DIR, `${runId}.json`);
  try {
    const data = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(data) as TestReport;
  } catch {
    return null;
  }
}
