import { NextRequest, NextResponse } from 'next/server';
import { nanoid } from 'nanoid';
import {
  getMission,
  updateMissionStatus,
  setMissionPlan,
  setMissionRunId,
  setRequirements,
  addReasoning,
} from '@/lib/db/missionStore';
import { analyseConversation } from '@/lib/ai/analyserAgent';
import { generateMissionPlan } from '@/lib/ai/testPlannerAgent';
import { testRuns } from '@/lib/db/db';
import { enqueueTestRun } from '@/lib/queue/queue';
import type { ConversationMessage } from '@/lib/config';

export async function POST(
  _req: NextRequest,
  { params }: { params: { missionId: string } }
) {
  try {
    const mission = await getMission(params.missionId);
    if (!mission) {
      return NextResponse.json({ error: 'Mission not found' }, { status: 404 });
    }

    // Step 1: If requirements weren't saved during chat, extract from conversation transcript
    let requirements = mission.requirements;

    if (!requirements || !requirements.website_url) {
      await addReasoning(params.missionId, '🧠 Analysing conversation transcript for requirements...');

      const conversationTranscript = (mission.conversation as ConversationMessage[])
        .filter((m) => !m.hidden)
        .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
        .join('\n');

      requirements = await analyseConversation(conversationTranscript);

      if (!requirements.website_url) {
        return NextResponse.json(
          { error: 'Could not extract website URL from conversation. Please restart and provide a URL.' },
          { status: 400 }
        );
      }

      await setRequirements(params.missionId, requirements);
      await addReasoning(params.missionId, `✅ Requirements extracted: ${requirements.website_url}`);
    }

    // Step 2: Generate test plan
    await updateMissionStatus(params.missionId, 'planning');
    await addReasoning(params.missionId, '📋 Generating test plan from requirements...');

    const plan = await generateMissionPlan(requirements);
    await setMissionPlan(params.missionId, plan);

    const testCaseCount = (plan as { testCases?: { name: string }[] }).testCases?.length
      || plan.steps?.length
      || 0;
    await addReasoning(params.missionId, `✅ Plan generated: ${testCaseCount} test cases`);

    // Step 3: Create test run and enqueue
    await updateMissionStatus(params.missionId, 'executing');
    await addReasoning(params.missionId, '🖥️ Launching browser test execution...');

    const runId = nanoid(16);
    const runs = await testRuns();

    // Build rich instructions string from requirements
    const instructions = [
      `Test website: ${requirements.website_url}`,
      `Flows to test: ${requirements.workflows.join(', ')}`,
      requirements.credentials_required && requirements.credentials?.email
        ? `Use email: ${requirements.credentials.email}, password: ${requirements.credentials.password}`
        : '',
      (requirements as typeof requirements & { expected_outcomes?: string[] }).expected_outcomes?.length
        ? `Expected outcomes: ${(requirements as typeof requirements & { expected_outcomes?: string[] }).expected_outcomes?.join('; ')}`
        : '',
    ].filter(Boolean).join('\n');

    await runs.insertOne({
      _id: runId,
      url: requirements.website_url,
      instructions,
      status: 'queued',
      headless: true,
      video_path: null,
      har_path: null,
      network_logs: null,
      console_logs: null,
      ai_summary: null,
      started_at: null,
      completed_at: null,
      created_at: new Date(),
    });

    await setMissionRunId(params.missionId, runId);
    await enqueueTestRun({
      runId,
      url: requirements.website_url,
      instructions,
      headless: true,
    });

    return NextResponse.json({
      status: 'executing',
      runId,
      plan,
    });
  } catch (err) {
    await updateMissionStatus(params.missionId, 'error');
    const msg = err instanceof Error ? err.message : 'Execution error';
    console.error('[Execute API]', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
