import { NextRequest, NextResponse } from 'next/server';
import { nanoid } from 'nanoid';
import { RunTestInputSchema } from '@/lib/config';
import { testRuns } from '@/lib/db/db';
import { enqueueTestRun } from '@/lib/queue/queue';
import { validateTargetUrl, checkRateLimit, validateAuth, getClientIp } from '@/lib/security/security';

export async function POST(req: NextRequest) {
  // Auth
  if (!validateAuth(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Rate limit
  const ip = getClientIp(req);
  const rl = checkRateLimit(ip);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded', retryAfterMs: rl.retryAfterMs },
      { status: 429 }
    );
  }

  // Parse & validate body
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = RunTestInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { url, instructions, headless } = parsed.data;

  // Validate target URL security
  const urlCheck = validateTargetUrl(url);
  if (!urlCheck.valid) {
    return NextResponse.json({ error: urlCheck.reason }, { status: 400 });
  }

  // Create run record
  const runId = nanoid(16);
  const runs = await testRuns();
  await runs.insertOne({
    _id: runId,
    url,
    instructions,
    status: 'queued',
    headless,
    video_path: null,
    har_path: null,
    network_logs: null,
    console_logs: null,
    ai_summary: null,
    started_at: null,
    completed_at: null,
    created_at: new Date(),
  });

  // Enqueue job
  await enqueueTestRun({ runId, url, instructions, headless });

  return NextResponse.json({ runId, status: 'queued' }, { status: 201 });
}
