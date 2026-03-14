import { NextRequest, NextResponse } from 'next/server';
import { testRuns, testCases, testSteps } from '@/lib/db/db';
import { validateAuth } from '@/lib/security/security';
import * as fs from 'fs/promises';
import * as path from 'path';

export async function DELETE(
  req: NextRequest,
  { params }: { params: { runId: string } }
) {
  // Auth
  if (!validateAuth(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { runId } = params;

  // Get the test run to find associated files
  const runs = await testRuns();
  const run = await runs.findOne({ _id: runId });

  if (!run) {
    return NextResponse.json({ error: 'Run not found' }, { status: 404 });
  }

  // Get all test cases for this run
  const cases = await testCases();
  const caseDocs = await cases.find({ run_id: runId }).toArray();

  // Get all test steps for each test case
  const steps = await testSteps();
  const stepDocs: { screenshot_url: string | null }[] = [];
  for (const tc of caseDocs) {
    const s = await steps.find({ test_case_id: tc._id }).toArray();
    stepDocs.push(...s);
  }

  // Delete associated screenshots
  const imagesDir = path.join(process.cwd(), 'images');
  for (const step of stepDocs) {
    if (step.screenshot_url) {
      try {
        // Extract filename from URL like /api/test/{runId}/screenshot/{stepId}
        const urlParts = step.screenshot_url.split('/');
        const filename = urlParts[urlParts.length - 1];
        const filepath = path.join(imagesDir, filename);
        await fs.unlink(filepath);
      } catch {
        // File might not exist, continue
      }
    }
  }

  // Delete video if exists
  if (run.video_path) {
    try {
      await fs.unlink(path.join(process.cwd(), run.video_path));
    } catch {
      // File might not exist
    }
  }

  // Delete from database (cascade: steps first, then cases, then run)
  await steps.deleteMany({ test_case_id: { $in: caseDocs.map((c) => c._id) } });
  await cases.deleteMany({ run_id: runId });
  await runs.deleteOne({ _id: runId });

  return NextResponse.json({ success: true });
}
