import { NextRequest, NextResponse } from 'next/server';
import { validateAuth } from '@/lib/security/security';
import { getScreenshotPath } from '@/lib/storage/screenshot';
import * as fs from 'fs';

export async function GET(
  req: NextRequest,
  { params }: { params: { runId: string; stepId: string } }
) {
  if (!validateAuth(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { runId, stepId } = params;

  // Sanitize to prevent path traversal
  if (!/^[a-zA-Z0-9_-]+$/.test(runId) || !/^[a-zA-Z0-9_-]+$/.test(stepId)) {
    return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 });
  }

  const filePath = await getScreenshotPath(runId, stepId);

  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ error: 'Screenshot not found' }, { status: 404 });
  }

  const stat = fs.statSync(filePath);
  const stream = fs.createReadStream(filePath);
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
      'Content-Type': 'image/png',
      'Content-Length': stat.size.toString(),
      'Cache-Control': 'private, max-age=3600',
    },
  });
}
