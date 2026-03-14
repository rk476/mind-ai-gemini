import { callGeminiJson } from './geminiClient';
import type { TestRequirement } from '@/lib/config';

/**
 * Analyser Agent — reads the full voice conversation transcript from the Live Agent
 * and extracts a structured TestRequirement for the Planner Agent to use.
 *
 * This bridges the conversational phase (Gemini Live) with the automated test phase.
 */

const SYSTEM_INSTRUCTION = `You are an expert QA requirements analyst. You are given the transcript 
of a conversation between a user and an AI QA assistant. The user has described what they want to test.

Extract ALL of the following information if present:
- website_url: the URL to test (normalize with https:// if missing)
- workflows: list of specific flows/scenarios to test (e.g. "Login flow", "Search flow")
- credentials_required: true if the user mentioned needing login or provided credentials
- credentials: { email, password } if explicitly provided in the conversation
- expected_outcomes: any specific pass/fail criteria mentioned by the user (e.g. "at least 3 videos in last 7 days should appear")
- test_depth: default to "standard"

RESPONSE FORMAT (JSON only):
{
  "website_url": "https://...",
  "workflows": ["Flow 1", "Flow 2"],
  "credentials_required": false,
  "credentials": { "email": "...", "password": "..." },
  "expected_outcomes": ["criteria 1", "criteria 2"],
  "test_depth": "standard",
  "conversation_transcript": "<full transcript passed through>"
}`;

export interface AnalyserResult extends TestRequirement {
  expected_outcomes: string[];
}

export async function analyseConversation(
  conversationTranscript: string
): Promise<AnalyserResult> {
  const prompt = `Here is the conversation transcript to analyse:

---
${conversationTranscript}
---

Extract the testing requirements from this conversation. Pass the full conversation_transcript through as-is.`;

  try {
    const result = await callGeminiJson<AnalyserResult>(
      prompt,
      SYSTEM_INSTRUCTION,
      'flash'
    );

    // Ensure required fields have defaults
    return {
      website_url: result.website_url || '',
      workflows: result.workflows || ['General navigation'],
      credentials_required: result.credentials_required || false,
      credentials: result.credentials || {},
      expected_outcomes: result.expected_outcomes || [],
      test_depth: result.test_depth || 'standard',
      conversation_transcript: conversationTranscript,
      expected_outputs: ['screenshots', 'video', 'test_report'],
    };
  } catch (err) {
    console.error('[AnalyserAgent] Failed to parse conversation:', err);
    // Return a minimal fallback
    return {
      website_url: extractUrlFromTranscript(conversationTranscript),
      workflows: ['General page test'],
      credentials_required: false,
      credentials: {},
      expected_outcomes: [],
      test_depth: 'standard',
      conversation_transcript: conversationTranscript,
      expected_outputs: ['screenshots', 'video', 'test_report'],
    };
  }
}

/** Simple regex fallback to extract URL if AI parsing fails */
function extractUrlFromTranscript(transcript: string): string {
  const urlMatch = transcript.match(/https?:\/\/[^\s"']+/i);
  if (urlMatch) return urlMatch[0];
  const domainMatch = transcript.match(/\b([a-z0-9-]+\.(com|io|org|net|co))\b/i);
  if (domainMatch) return `https://${domainMatch[0]}`;
  return '';
}
