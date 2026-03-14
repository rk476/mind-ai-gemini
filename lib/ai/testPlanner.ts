import { TestPlanSchema, type TestPlan } from '@/lib/config';
import type { DomSummary } from './domAnalyzer';
import { AVAILABLE_TOOLS } from '@/lib/mcp/mcpServer';
import { callGeminiJson } from './geminiClient';

/**
 * AI Test Planner — takes a DOM summary + user instructions and
 * produces a structured test plan validated by Zod.
 */

const SYSTEM_PROMPT = `You are an expert QA engineer that generates structured browser test plans.

Given a page DOM summary and natural-language test instructions, produce a JSON object with this exact schema:

{
  "testCases": [
    {
      "name": "string - descriptive name of test case",
      "steps": [
        {
          "action": "one of: navigate | fillByLabel | fillByPlaceholder | clickByText | assertVisible | assertNotVisible | assertUrlChange | assertTextPresent | waitForSelector",
          "label": "optional - for fillByLabel",
          "text": "optional - for clickByText, assertVisible, assertNotVisible, assertTextPresent, fillByPlaceholder",
          "selector": "optional - CSS selector for waitForSelector",
          "value": "optional - value to fill",
          "url": "optional - for navigate, assertUrlChange"
        }
      ]
    }
  ]
}

Rules:
- Maximum 10 test cases
- Maximum 20 steps per test case
- Do not generate duplicate or similar test cases
- All Test cases must be unique and only necessary steps should be included as per the Test Instructions
- Do not add any extra steps or test cases
- Output ONLY valid JSON. No markdown, no explanation, no code fences
- Use fillByLabel when the input has an associated label
- Use fillByPlaceholder when the input has a placeholder
- Use clickByText for buttons/links
- Always start each test case with a navigate step to reset state
- For login tests, always generate: valid login, wrong username, wrong password, empty username, empty password, both empty
- assertUrlChange checks if the URL contains the given string
- assertVisible/assertNotVisible check if text is visible/hidden on page

Available actions: ${AVAILABLE_TOOLS.filter(t => t !== 'getConsoleLogs' && t !== 'getNetworkLogs').join(', ')}`;

export async function generateTestPlan(
  domSummary: DomSummary,
  instructions: string,
  targetUrl: string
): Promise<TestPlan> {
  const userPrompt = `Target URL: ${targetUrl}

Page DOM Summary:
${JSON.stringify(domSummary, null, 2)}

Test Instructions:
${instructions}

Generate a comprehensive test plan as JSON.`;

  const parsed = await callGeminiJson(userPrompt, SYSTEM_PROMPT, 'pro');
  const validated = TestPlanSchema.parse(parsed);
  return validated;
}
