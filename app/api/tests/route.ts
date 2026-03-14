import { NextRequest, NextResponse } from 'next/server';
import { testRuns, testCases, testSteps } from '@/lib/db/db';
import { validateAuth } from '@/lib/security/security';

export async function GET(req: NextRequest) {
  // Auth
  if (!validateAuth(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const runs = await testRuns();
  const testList = await runs
    .find({})
    .sort({ created_at: -1 })
    .limit(50)
    .toArray();

  // Get test case counts for each run
  const cases = await testCases();
  const runsWithCounts = await Promise.all(
    testList.map(async (run) => {
      const caseCount = await cases.countDocuments({ run_id: run._id });
      return {
        ...run,
        caseCount,
      };
    })
  );

  return NextResponse.json({ runs: runsWithCounts });
}
