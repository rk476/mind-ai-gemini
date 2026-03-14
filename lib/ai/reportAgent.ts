import { callGeminiPro } from './geminiClient';

/**
 * Report Agent — uses Gemini Pro to generate a human-readable
 * QA report narrative from test execution results.
 */

interface TestCaseResult {
  name: string;
  status: 'passed' | 'failed';
  steps: { action: string; status: string; error?: string }[];
}

export async function generateReport(
  url: string,
  testCases: TestCaseResult[],
  coveragePercent: number
): Promise<string> {
  const systemInstruction = `You are a senior QA analyst creating a professional test report narrative.

Write a clear, concise report covering:
1. Executive summary (2-3 sentences)
2. Test results breakdown
3. Issues detected (with severity)
4. Performance observations
5. Recommendations

Use a professional tone. Be specific about what was tested and what passed/failed.`;

  const prompt = `Website tested: ${url}
Total test cases: ${testCases.length}
Passed: ${testCases.filter(t => t.status === 'passed').length}
Failed: ${testCases.filter(t => t.status === 'failed').length}
Coverage: ${coveragePercent}%

Test Results:
${JSON.stringify(testCases, null, 2)}

Generate a professional QA report.`;

  const response = await callGeminiPro(prompt, systemInstruction);
  return response.text;
}
