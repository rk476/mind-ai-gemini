import { NextRequest, NextResponse } from 'next/server';
import { validateAuth } from '@/lib/security/security';
import { loadReport } from '@/lib/storage/report';

export async function GET(
  req: NextRequest,
  { params }: { params: { runId: string } }
) {
  if (!validateAuth(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { runId } = params;

  if (!/^[a-zA-Z0-9_-]+$/.test(runId)) {
    return NextResponse.json({ error: 'Invalid runId' }, { status: 400 });
  }

  const report = await loadReport(runId);
  if (!report) {
    return NextResponse.json({ error: 'Report not found' }, { status: 404 });
  }

  return new NextResponse(JSON.stringify(report, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="report-${runId}.json"`,
    },
  });
}
