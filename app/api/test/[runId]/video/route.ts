import { NextRequest, NextResponse } from 'next/server';
import { validateAuth } from '@/lib/security/security';
import * as fs from 'fs';
import * as path from 'path';

export async function GET(
  req: NextRequest,
  { params }: { params: { runId: string } }
) {
  if (!validateAuth(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { runId } = params;

  // Sanitize runId to prevent path traversal
  if (!/^[a-zA-Z0-9_-]+$/.test(runId)) {
    return NextResponse.json({ error: 'Invalid runId' }, { status: 400 });
  }

  // Check database if it has a GCS URL
  const { testRuns } = await import('@/lib/db/db');
  const runs = await testRuns();
  const run = await runs.findOne({ _id: runId });
  if (run?.video_path && run.video_path.startsWith('http')) {
    return NextResponse.redirect(run.video_path);
  }

  const videoPath = path.resolve(process.cwd(), run?.video_path || '');

  if (!fs.existsSync(videoPath)) {
    return NextResponse.json({ error: 'Video not found' }, { status: 404 });
  }

  const stat = fs.statSync(videoPath);
  const stream = fs.createReadStream(videoPath);
  const readableStream = new ReadableStream({
    start(controller) {
      stream.on('data', (chunk) => {
        controller.enqueue(chunk);
      });
      stream.on('end', () => {
        controller.close();
      });
      stream.on('error', (err) => {
        controller.error(err);
      });
    },
  });

  return new NextResponse(readableStream, {
    headers: {
      'Content-Type': 'video/webm',
      'Content-Length': stat.size.toString(),
      'Content-Disposition': `inline; filename="session-${runId}.webm"`,
      'Cache-Control': 'private, max-age=3600',
    },
  });
}
