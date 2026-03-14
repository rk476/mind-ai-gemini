import { NextRequest, NextResponse } from 'next/server';
import { testRuns, testCases, testSteps } from '@/lib/db/db';
import { validateAuth } from '@/lib/security/security';
import * as fs from 'fs/promises';
import * as path from 'path';

export async function GET(
  req: NextRequest,
  { params }: { params: { runId: string } }
) {
  // Auth
  if (!validateAuth(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { runId } = params;

  // Fetch run
  const runs = await testRuns();
  const run = await runs.findOne({ _id: runId });

  if (!run) {
    return NextResponse.json({ error: 'Run not found' }, { status: 404 });
  }

  // Fetch test cases
  const cases = await testCases();
  const caseDocs = await cases.find({ run_id: runId }).toArray();

  // Fetch steps for each case
  const steps = await testSteps();
  const testCaseResults = await Promise.all(
    caseDocs.map(async (tc) => {
      const stepDocs = await steps
        .find({ test_case_id: tc._id })
        .sort({ created_at: 1 })
        .toArray();
      return { ...tc, steps: stepDocs };
    })
  );

  // Check video availability
  let videoAvailable = false;
  if (run.video_path) {
    try {
      const videoAbsPath = path.resolve(process.cwd(), run.video_path);
      await fs.access(videoAbsPath);
      videoAvailable = true;
    } catch {
      // video not yet available
    }
  }

  return NextResponse.json({
    run,
    testCases: testCaseResults,
    videoAvailable,
  });
}
