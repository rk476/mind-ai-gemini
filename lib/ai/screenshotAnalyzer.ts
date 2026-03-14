import { callGeminiFlashWithTwoImages, callGeminiFlashWithImage } from './geminiClient';

/**
 * Screenshot Analyzer — uses Gemini Flash multimodal to visually analyse
 * before and after screenshots of a test case, determining if it passed or failed.
 */

export interface ScreenshotAnalysis {
  status: 'passed' | 'failed';
  observations: string;
  issues: string[];
  successIndicators: string[];
  suggestion: string;
}

const ANALYSIS_SYSTEM_INSTRUCTION = `You are a senior QA analyst with computer vision capabilities. 
You are given screenshots from a browser automation test — the first image is BEFORE the test action, 
the second is AFTER. Your job is to determine if the test passed or failed.

Look for:
- Success: toast notifications, success banners, redirects to a new page, correct data displayed, 
  expected content visible, confirmation messages
- Failure: error messages, validation errors, unchanged UI state when change was expected, 
  page crashes, loading spinners stuck, unexpected redirects, missing expected elements

Be precise and technical. Only mark as "failed" if there is clear evidence of failure.

RESPONSE FORMAT (JSON only, no markdown):
{
  "status": "passed" | "failed",
  "observations": "concise description of what happened between before and after screenshots",
  "issues": ["list any errors, warnings, or unexpected elements seen"],
  "successIndicators": ["list any success messages, redirects, or confirmations seen"],
  "suggestion": "if failed, what to fix; if passed, empty string"
}`;

const SINGLE_IMAGE_SYSTEM_INSTRUCTION = `You are a senior QA analyst with computer vision capabilities.
You are given a screenshot from a browser automation test. Your job is to determine if the visible state 
indicates success or failure based on the test description.

Look for: error messages, validation errors, success messages, redirects, expected content.

RESPONSE FORMAT (JSON only, no markdown):
{
  "status": "passed" | "failed",
  "observations": "concise description of what is visible in the screenshot",
  "issues": ["list any errors or problems"],
  "successIndicators": ["list success indicators"],
  "suggestion": "if failed, what to fix; if passed, empty string"
}`;

/**
 * Analyse before + after screenshots to determine if a test case passed.
 */
export async function analyseTestCaseScreenshots(
  beforeBase64: string,
  afterBase64: string,
  testCaseName: string,
  testDescription: string,
  expectedOutcome?: string
): Promise<ScreenshotAnalysis> {
  const prompt = `Test Case: "${testCaseName}"
Description: ${testDescription}
${expectedOutcome ? `Expected Outcome: ${expectedOutcome}` : ''}

The first image is the BEFORE state (before the test steps ran).
The second image is the AFTER state (after the test steps completed).

Analyse both images and determine if the test passed or failed.`;

  try {
    const response = await callGeminiFlashWithTwoImages(
      prompt,
      beforeBase64,
      afterBase64,
      'image/png',
      ANALYSIS_SYSTEM_INSTRUCTION
    );

    let cleaned = response.text.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
    }

    const result = JSON.parse(cleaned) as ScreenshotAnalysis;
    console.log(`[ScreenshotAnalyzer] Test "${testCaseName}": ${result.status} — ${result.observations.substring(0, 100)}`);
    return result;
  } catch (err) {
    console.error('[ScreenshotAnalyzer] Analysis failed:', err);
    // Fallback: mark as failed if we can't analyse
    return {
      status: 'failed',
      observations: 'Screenshot analysis failed — could not determine test outcome',
      issues: [err instanceof Error ? err.message : 'Analysis error'],
      successIndicators: [],
      suggestion: 'Review the screenshot manually and re-run the test',
    };
  }
}

/**
 * Analyse a single screenshot (after-only, when before is unavailable).
 */
export async function analyseSingleScreenshot(
  screenshotBase64: string,
  testCaseName: string,
  testDescription: string,
  expectedOutcome?: string
): Promise<ScreenshotAnalysis> {
  const prompt = `Test Case: "${testCaseName}"
Description: ${testDescription}
${expectedOutcome ? `Expected Outcome: ${expectedOutcome}` : ''}

Analyse this screenshot and determine if the test passed or failed.`;

  try {
    const response = await callGeminiFlashWithImage(
      prompt,
      screenshotBase64,
      'image/png',
      SINGLE_IMAGE_SYSTEM_INSTRUCTION
    );

    let cleaned = response.text.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
    }

    return JSON.parse(cleaned) as ScreenshotAnalysis;
  } catch (err) {
    console.error('[ScreenshotAnalyzer] Single image analysis failed:', err);
    return {
      status: 'failed',
      observations: 'Screenshot analysis failed',
      issues: [err instanceof Error ? err.message : 'Analysis error'],
      successIndicators: [],
      suggestion: 'Review screenshot manually',
    };
  }
}
