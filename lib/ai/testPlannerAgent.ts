import { callGeminiJson } from './geminiClient';
import type { TestRequirement, MissionPlan } from '@/lib/config';

/**
 * Test Planner Agent — uses Gemini Flash to transform structured requirements
 * into executable test cases with clear pass/fail criteria.
 */

const SYSTEM_INSTRUCTION = `You are an elite QA Test Architect. Your job is to take high-level user testing requirements and architect a deterministic, step-by-step browser automation test plan.

CRITICAL WORKFLOW RULES:
1. INITIALIZATION: Always start with a "navigate" step to load the target URL.
2. AUTHENTICATION: If credentials are provided, include steps to fill the login form, submit, and verify success.
3. CUSTOM CRITERIA: If expected_outcomes are provided (e.g. "at least 3 videos in last 7 days"), include scroll and extract steps to verify this specific criterion.
4. VERIFICATION: Every major action must be followed by a "verify" step confirming the UI changed as expected.
5. RESILIENCE: Describe elements by visible text/label (e.g., "Click the 'Sign In' button") rather than CSS selectors.
6. SCROLLING: For content-heavy pages (e.g. search results), include scroll steps before verification.

AVAILABLE ACTION TYPES:
- "navigate": Load a URL.
- "fillByLabel": Fill a text input field identified by its label text.
- "fillByPlaceholder": Fill a field identified by placeholder text.
- "clickByText": Click a button or link by its visible text.
- "assertVisible": Assert that specific text is visible on the page.
- "assertNotVisible": Assert that specific text is NOT visible.
- "assertUrlChange": Assert the URL contains a specific substring after navigation.
- "assertTextPresent": Assert page body contains a specific text string.
- "waitForSelector": Wait for a CSS selector to become visible.

RESPONSE FORMAT (JSON):
{
  "testCases": [
    {
      "name": "Descriptive test case name",
      "steps": [
        { "action": "navigate", "url": "https://..." },
        { "action": "fillByLabel", "label": "Email", "value": "user@example.com" },
        { "action": "clickByText", "text": "Sign In" },
        { "action": "assertVisible", "text": "Welcome" }
      ]
    }
  ]
}`;

export async function generateMissionPlan(
  requirements: TestRequirement & { expected_outcomes?: string[] }
): Promise<MissionPlan> {
  const prompt = `Generate a test plan for the following requirements:

Website: ${requirements.website_url}
Workflows to test: ${requirements.workflows.join(', ')}
Credentials required: ${requirements.credentials_required}
${requirements.credentials?.email ? `Email: ${requirements.credentials.email}` : ''}
${requirements.credentials?.password ? `Password: ${requirements.credentials.password}` : ''}
Test depth: ${requirements.test_depth}
${requirements.expected_outcomes?.length ? `\nExpected Outcomes / Pass Criteria:\n${requirements.expected_outcomes.map((o, i) => `${i + 1}. ${o}`).join('\n')}` : ''}

${requirements.conversation_transcript ? `CONVERSATION TRANSCRIPT (extract any credentials, URLs, or specific requirements mentioned):\n${requirements.conversation_transcript}\n` : ''}

Generate a comprehensive, executable test plan. Each test case should have clear, executable steps.`;

  return callGeminiJson<MissionPlan>(prompt, SYSTEM_INSTRUCTION, 'flash');
}
