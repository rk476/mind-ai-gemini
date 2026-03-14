import { callGeminiJson, callGeminiFlash } from './geminiClient';
import type { ConversationMessage, TestRequirement } from '@/lib/config';

/**
 * Requirement Agent — uses Gemini Flash to conversationally extract
 * structured testing requirements from the user.
 */

const SYSTEM_INSTRUCTION = `You are an AI QA Engineer named "Test Pilot". Your job is to collect testing requirements from the user through natural conversation.

You need to gather the following information:
1. Website URL to test
2. What workflows/features to test (e.g., login, checkout, search)
3. Whether credentials are required (and if so, collect email/password)
4. Test depth preference (shallow/standard/deep)

BEHAVIOR RULES:
- Be conversational, friendly, and professional
- Ask one question at a time
- When you need structured input (URL, email, password), include an "inputRequest" in your response
- When you have enough information, set "complete" to true and include the structured requirements

RESPONSE FORMAT (JSON):
{
  "message": "Your conversational response to the user",
  "inputRequest": null | { "type": "url"|"email"|"password"|"text", "label": "Field label", "placeholder": "hint text" },
  "complete": false | true,
  "requirements": null | { "website_url": "...", "workflows": [...], "credentials_required": true/false, "test_depth": "shallow"|"standard"|"deep" }
}

START by greeting the user and asking what website they'd like to test.`;

export interface RequirementAgentResponse {
  message: string;
  inputRequest: {
    type: 'url' | 'email' | 'password' | 'text' | 'file';
    label: string;
    placeholder?: string;
  } | null;
  complete: boolean;
  requirements: TestRequirement | null;
}

export async function processConversation(
  conversation: ConversationMessage[]
): Promise<RequirementAgentResponse> {
  // Build conversation context
  const conversationText = conversation
    .map((msg) => `${msg.role.toUpperCase()}: ${msg.content}`)
    .join('\n');

  const prompt = conversation.length === 0
    ? 'Start the conversation. Greet the user and ask what website they want to test.'
    : `Conversation so far:\n${conversationText}\n\nProvide your next response based on the conversation above.`;

  return callGeminiJson<RequirementAgentResponse>(prompt, SYSTEM_INSTRUCTION, 'flash');
}

/**
 * Get the initial greeting from the AI agent.
 */
export async function getGreeting(): Promise<RequirementAgentResponse> {
  return processConversation([]);
}
