import { callGeminiFlash } from './geminiClient';
import type { ScreenshotAnalysis } from './screenshotAnalyzer';

/**
 * AI Result Summarizer — generates a comprehensive QA report from test results.
 * Now includes per-case AI screenshot analysis for richer insights.
 */

interface StepSummary {
  action: string;
  status: string;
  error?: string;
}

interface CaseSummary {
  name: string;
  status: string;
  steps: StepSummary[];
  screenshotAnalysis?: ScreenshotAnalysis;
}

export async function summarizeResults(
  url: string,
  instructions: string,
  cases: CaseSummary[]
): Promise<string> {
  const systemPrompt = `You are a senior QA analyst writing a final test report. Given structured test results including 
AI visual analysis of screenshots, provide a clear professional report.

Structure your response as:
1. SUMMARY: Overall pass/fail (X of Y passed), tested URL, and what was tested.
2. TEST CASES: For each case, state pass/fail and any key observations.
3. ISSUES FOUND: List any errors, warnings, or unexpected behaviors found during visual analysis.
4. SUGGESTIONS: Actionable next steps for the development team.

Be concise but informative. Write in plain text paragraphs, no markdown headers.`;

  const passed = cases.filter((c) => c.status === 'passed').length;
  const failed = cases.filter((c) => c.status !== 'passed').length;

  const caseDetails = cases.map((c) => {
    const analysis = c.screenshotAnalysis;
    return `
Test Case: ${c.name} — ${c.status.toUpperCase()}
Steps executed: ${c.steps.length}
${c.steps.filter((s) => s.status === 'failed').length > 0 ? `Failed steps: ${c.steps.filter((s) => s.status === 'failed').map((s) => s.action).join(', ')}` : ''}
${analysis ? `Visual Analysis: ${analysis.observations}` : ''}
${analysis?.issues?.length ? `Issues seen: ${analysis.issues.join('; ')}` : ''}
${analysis?.successIndicators?.length ? `Success indicators: ${analysis.successIndicators.join('; ')}` : ''}
${analysis?.suggestion ? `Suggestion: ${analysis.suggestion}` : ''}`.trim();
  }).join('\n\n');

  const userPrompt = `URL Tested: ${url}
Test Instructions: ${instructions}
Results: ${passed} passed, ${failed} failed out of ${cases.length} total

Test Case Details:
${caseDetails}

Write a professional test report based on the above.`;

  console.log('[AI] Generating comprehensive test report...');

  try {
    const response = await callGeminiFlash(userPrompt, systemPrompt);
    console.log('[AI] Report generated (' + response.text.length + ' chars)');
    return response.text;
  } catch (err) {
    console.error('[AI] Report generation failed:', err);
    return `Test completed: ${passed} of ${cases.length} test cases passed. ${failed > 0 ? `${failed} case(s) failed.` : 'All cases passed.'} URL: ${url}`;
  }
}
