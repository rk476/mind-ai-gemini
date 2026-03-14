import { chromium, type Browser } from 'playwright';
import { nanoid } from 'nanoid';
import { BrowserTools } from '@/lib/mcp/browserTools';
import { executeTool } from '@/lib/mcp/mcpServer';
import { analyzeDom } from '@/lib/ai/domAnalyzer';
import { generateTestPlan } from '@/lib/ai/testPlanner';
import { summarizeResults } from '@/lib/ai/resultSummarizer';
import { analyseTestCaseScreenshots, type ScreenshotAnalysis } from '@/lib/ai/screenshotAnalyzer';
import { testRuns, testCases, testSteps } from '@/lib/db/db';
import { ensureVideoDir, getVideoPath, videoExists } from '@/lib/storage/video';
import { uploadVideo } from '@/lib/storage/gcs';
import { uploadScreenshot } from '@/lib/storage/screenshot';
import { saveReport } from '@/lib/storage/report';
import type { TestRunDoc, TestCaseDoc, TestStepDoc } from '@/lib/config';
import { config } from '@/lib/config';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface RunResult {
  runId: string;
  status: 'passed' | 'failed' | 'error' | 'timeout';
  summary: string;
}

export async function executeTestRun(
  runId: string,
  url: string,
  instructions: string,
  headless: boolean
): Promise<RunResult> {
  let browser: Browser | null = null;
  const startTime = Date.now();

  try {
    // Mark run as running
    const runs = await testRuns();
    await runs.updateOne({ _id: runId }, { $set: { status: 'running', started_at: new Date() } });

    // Set up video directory
    const videoDir = await ensureVideoDir(runId);

    // Launch browser
    browser = await chromium.launch({
      headless: headless ?? config.playwright.headless,
    });

    const context = await browser.newContext({
      recordVideo: { dir: videoDir, size: { width: 1280, height: 720 } },
      viewport: { width: 1280, height: 720 },
      ignoreHTTPSErrors: true,
    });

    // Block downloads & file access
    await context.route('**/*', (route) => {
      const reqUrl = route.request().url();
      if (reqUrl.startsWith('file://')) {
        return route.abort();
      }
      return route.continue();
    });

    const page = await context.newPage();
    const tools = new BrowserTools(page, context, runId);

    // Step 1: Navigate to target URL
    await page.goto(url, { timeout: 60000, waitUntil: 'domcontentloaded' });

    // Step 2: Analyze DOM
    const domSummary = await analyzeDom(page);

    // Step 3: Generate test plan via AI
    const testPlan = await generateTestPlan(domSummary, instructions, url);

    // Step 4: Execute all test cases
    const cases = await testCases();
    const steps = await testSteps();
    const caseResults: {
      name: string;
      status: string;
      steps: { action: string; status: string; error?: string }[];
      screenshotAnalysis?: ScreenshotAnalysis;
    }[] = [];
    let overallPassed = true;

    for (const testCase of testPlan.testCases) {
      // Check timeout
      if (Date.now() - startTime > config.playwright.maxDurationMs) {
        await runs.updateOne({ _id: runId }, { $set: { status: 'timeout', completed_at: new Date() } });
        return { runId, status: 'timeout', summary: 'Test run exceeded maximum duration' };
      }

      const caseId = nanoid(12);
      await cases.insertOne({
        _id: caseId,
        run_id: runId,
        name: testCase.name,
        status: 'running',
      });

      // ── BEFORE screenshot ─────────────────────────────────────────────
      const beforeStepId = `${caseId}-before`;
      let beforeScreenshotBase64: string | null = null;
      try {
        await page.waitForTimeout(500);
        const beforeBuffer = await page.screenshot({ fullPage: false });
        beforeScreenshotBase64 = beforeBuffer.toString('base64');
        // Upload before screenshot (for UI preview)
        await uploadScreenshot(runId, beforeStepId, beforeBuffer);
        console.log(`[TestRunner] 📸 Before screenshot captured for "${testCase.name}"`);
      } catch (err) {
        console.warn(`[TestRunner] Could not capture before screenshot for "${testCase.name}":`, err);
      }

      let casePassed = true;
      const stepResults: { action: string; status: string; error?: string }[] = [];

      for (const step of testCase.steps) {
        const stepId = nanoid(12);
        const target = step.label || step.text || step.selector || step.url || '';

        await steps.insertOne({
          _id: stepId,
          test_case_id: caseId,
          action: step.action,
          target,
          value: step.value ?? null,
          status: 'pending',
          screenshot_url: null,
          error_message: null,
          duration_ms: null,
          healed: false,
          created_at: new Date(),
        });

        const result = await executeTool(tools, step, stepId);

        await steps.updateOne(
          { _id: stepId },
          {
            $set: {
              status: result.status,
              screenshot_url: result.screenshotUrl,
              error_message: result.error ?? null,
              duration_ms: result.durationMs,
              healed: result.healed,
            },
          }
        );

        if (result.screenshotUrl) {
          await runs.updateOne(
            { _id: runId },
            {
              $set: {
                current_screenshot_url: result.screenshotUrl,
                current_step_name: step.action,
              }
            }
          );
        }

        stepResults.push({
          action: step.action,
          status: result.status,
          error: result.error,
        });

        if (result.status === 'failed') {
          casePassed = false;
          break;
        }
      }

      // ── AFTER screenshot ──────────────────────────────────────────────
      const afterStepId = `${caseId}-after`;
      let afterBuffer: Buffer | null = null;
      let afterScreenshotUrl = '';
      let afterScreenshotBase64: string | null = null;
      try {
        await page.waitForTimeout(500);
        afterBuffer = await page.screenshot({ fullPage: false });
        afterScreenshotBase64 = afterBuffer.toString('base64');
        afterScreenshotUrl = await uploadScreenshot(runId, afterStepId, afterBuffer);
        console.log(`[TestRunner] 📸 After screenshot captured for "${testCase.name}": ${afterScreenshotUrl}`);
      } catch (err) {
        console.warn(`[TestRunner] Could not capture after screenshot for "${testCase.name}":`, err);
      }

      // ── GEMINI FLASH VISUAL ANALYSIS ──────────────────────────────────
      let screenshotAnalysis: ScreenshotAnalysis | undefined;
      if (afterScreenshotBase64) {
        try {
          console.log(`[TestRunner] 🤖 Sending screenshots to Gemini Flash for analysis: "${testCase.name}"`);
          screenshotAnalysis = await analyseTestCaseScreenshots(
            beforeScreenshotBase64 || afterScreenshotBase64, // fallback to after if no before
            afterScreenshotBase64,
            testCase.name,
            `Test case: ${testCase.name}`,
          );
          console.log(`[TestRunner] 🤖 AI analysis result: ${screenshotAnalysis.status} — ${screenshotAnalysis.observations.substring(0, 80)}`);

          // Override case status with AI's visual determination
          if (screenshotAnalysis.status === 'failed') {
            casePassed = false;
          }
        } catch (err) {
          console.error(`[TestRunner] Screenshot analysis failed for "${testCase.name}":`, err);
        }
      }

      const caseStatus = casePassed ? 'passed' : 'failed';
      await cases.updateOne({ _id: caseId }, {
        $set: {
          status: caseStatus,
          // Store after screenshot URL on the case for the UI
          screenshot_url: afterScreenshotUrl || null,
          ai_observations: screenshotAnalysis?.observations || null,
        } as Partial<TestCaseDoc & { screenshot_url: string | null; ai_observations: string | null }>,
      });

      caseResults.push({
        name: testCase.name,
        status: caseStatus,
        steps: stepResults,
        screenshotAnalysis,
      });

      if (!casePassed) overallPassed = false;
    }

    // Step 5: Capture logs
    const consoleLogs = tools.getConsoleLogs();
    const networkLogs = tools.getNetworkLogs();

    // Step 6: AI summary (now includes screenshot analysis per case)
    let aiSummary = '';
    try {
      aiSummary = await summarizeResults(url, instructions, caseResults);
    } catch {
      aiSummary = 'AI report generation failed';
    }

    // Step 7: Close browser and save video
    const video = page.video();
    let actualVideoPath = '';

    await page.close();
    await context.close();

    if (video) {
      actualVideoPath = await video.path().catch(() => '');
    }

    await browser.close();
    browser = null;

    let videoPath = `videos/${runId}/session.webm`;

    if (actualVideoPath) {
      try {
        const expectedAbsPath = path.resolve(process.cwd(), videoPath);
        await fs.rename(actualVideoPath, expectedAbsPath);
      } catch (err) {
        console.warn(`[TestRunner] Failed to rename video:`, err);
      }
    }

    // Try to upload video to GCS
    try {
      if (await videoExists(runId)) {
        const localVideoPath = await getVideoPath(runId);
        const videoBuffer = await fs.readFile(localVideoPath);
        const gcsVideoUrl = await uploadVideo(runId, videoBuffer);
        if (gcsVideoUrl) {
          videoPath = gcsVideoUrl;
          console.log(`[TestRunner] 🎬 Video uploaded to GCS: ${gcsVideoUrl}`);
        }
      }
    } catch (err) {
      console.error(`[TestRunner] Error uploading video for ${runId} to GCS:`, err);
    }

    // Step 8: Update run record
    const finalStatus = overallPassed ? 'passed' : 'failed';
    await runs.updateOne(
      { _id: runId },
      {
        $set: {
          status: finalStatus,
          video_path: videoPath,
          network_logs: networkLogs,
          console_logs: consoleLogs,
          ai_summary: aiSummary,
          completed_at: new Date(),
        },
      }
    );

    // Step 9: Save report
    const runDoc = await runs.findOne({ _id: runId });
    const caseDocs = await cases.find({ run_id: runId }).toArray();
    const report = {
      run: runDoc!,
      testCases: await Promise.all(
        caseDocs.map(async (c) => {
          const stepDocs = await steps.find({ test_case_id: c._id }).sort({ created_at: 1 }).toArray();
          return { ...c, steps: stepDocs };
        })
      ),
    };
    await saveReport(runId, report);

    console.log(`[TestRunner] ✅ Run ${runId} complete: ${finalStatus}`);
    return { runId, status: finalStatus, summary: aiSummary };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    const runs = await testRuns();
    await runs.updateOne(
      { _id: runId },
      { $set: { status: 'error', ai_summary: `Execution error: ${errorMsg}`, completed_at: new Date() } }
    );
    return { runId, status: 'error', summary: errorMsg };
  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch {
        // ignore
      }
    }
  }
}
