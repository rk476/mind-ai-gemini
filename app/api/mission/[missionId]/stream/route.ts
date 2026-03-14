import { NextRequest } from 'next/server';
import { getMission } from '@/lib/db/missionStore';
import { testRuns, testCases, testSteps } from '@/lib/db/db';

/**
 * SSE endpoint for real-time mission progress updates.
 * Polls the database and streams updates to the client.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { missionId: string } }
) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      let lastStatus = '';
      let lastStepCount = 0;
      let lastScreenshotUrl = '';
      let iterations = 0;
      const maxIterations = 300; // 5 minutes at 1s interval

      const poll = async () => {
        try {
          const mission = await getMission(params.missionId);
          if (!mission) {
            send({ type: 'error', message: 'Mission not found' });
            controller.close();
            return;
          }

          // Send status update if changed
          if (mission.status !== lastStatus) {
            lastStatus = mission.status;
            send({
              type: 'status',
              status: mission.status,
              reasoning: mission.reasoning.slice(-5),
            });
          }

          // If executing, stream test progress
          if (mission.runId && ['executing', 'verifying'].includes(mission.status)) {
            const runs = await testRuns();
            const run = await runs.findOne({ _id: mission.runId });

            if (run) {
              const cases = await testCases();
              const caseDocs = await cases.find({ run_id: mission.runId }).toArray();

              const steps = await testSteps();
              let totalSteps = 0;
              const fullTestCases = [];

              for (const c of caseDocs) {
                const stepDocs = await steps.find({ test_case_id: c._id }).toArray();
                totalSteps += stepDocs.length;
                fullTestCases.push({
                  id: c._id.toString(),
                  name: c.name,
                  status: c.status,
                  stepsCount: stepDocs.length,
                  steps: stepDocs.map(s => ({
                    id: s._id.toString(),
                    action: s.action,
                    status: s.status,
                    screenshot_url: s.screenshot_url,
                  }))
                });
              }

              // Fire screenshot event if a new screenshot exists on the run document
              if (run.current_screenshot_url && run.current_screenshot_url !== lastScreenshotUrl) {
                lastScreenshotUrl = run.current_screenshot_url;
                send({
                  type: 'screenshot',
                  url: run.current_screenshot_url,
                  step: run.current_step_name || 'Executing step...',
                });
              }

              if (totalSteps !== lastStepCount) {
                lastStepCount = totalSteps;
                send({
                  type: 'progress',
                  runStatus: run.status,
                  testCases: caseDocs.length,
                  totalSteps,
                });
              }

              // If run completed, send final results
              if (['passed', 'failed', 'error', 'timeout'].includes(run.status)) {
                send({
                  type: 'completed',
                  runStatus: run.status,
                  aiSummary: run.ai_summary,
                  testCases: fullTestCases,
                  totalSteps,
                });
                controller.close();
                return;
              }
            }
          }

          // If mission is in terminal state
          if (['completed', 'error'].includes(mission.status)) {
            send({ type: 'done', status: mission.status });
            controller.close();
            return;
          }

          iterations++;
          if (iterations >= maxIterations) {
            send({ type: 'timeout', message: 'Stream timeout after 5 minutes' });
            controller.close();
            return;
          }

          // Poll every second
          await new Promise((resolve) => setTimeout(resolve, 1000));
          await poll();
        } catch (err) {
          send({ type: 'error', message: err instanceof Error ? err.message : 'Stream error' });
          controller.close();
        }
      };

      await poll();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
