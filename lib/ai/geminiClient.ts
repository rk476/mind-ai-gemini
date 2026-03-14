import { GoogleGenAI } from '@google/genai';
import { config } from '@/lib/config';

/**
 * Unified Gemini API client — uses the new @google/genai SDK.
 * Provides text generation, JSON extraction, and multimodal (image) analysis.
 * Includes rate limiting and retry-with-backoff for quota protection.
 */

let genAI: GoogleGenAI | null = null;

function getGenAI(): GoogleGenAI {
  if (!genAI) {
    genAI = new GoogleGenAI({ apiKey: config.gemini.apiKey });
  }
  return genAI;
}

// ─── Rate Limiter ────────────────────────────────────────────────────

const RATE_LIMIT = {
  maxPerMinute: 15,
  callTimestamps: [] as number[],
};

async function waitForRateLimit(): Promise<void> {
  const now = Date.now();
  RATE_LIMIT.callTimestamps = RATE_LIMIT.callTimestamps.filter(
    (t) => now - t < 60_000
  );

  if (RATE_LIMIT.callTimestamps.length >= RATE_LIMIT.maxPerMinute) {
    const oldest = RATE_LIMIT.callTimestamps[0];
    const waitMs = 60_000 - (now - oldest) + 1000;
    console.log(`[Gemini] Rate limit reached, waiting ${Math.ceil(waitMs / 1000)}s...`);
    await sleep(waitMs);
  }

  RATE_LIMIT.callTimestamps.push(Date.now());
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Retry with Backoff ──────────────────────────────────────────────

async function withRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      await waitForRateLimit();
      return await fn();
    } catch (err: unknown) {
      const isRateLimit =
        err instanceof Error && err.message?.includes('429');

      if (isRateLimit && attempt < maxRetries) {
        const backoffMs = Math.min(2000 * Math.pow(2, attempt), 45_000);
        console.log(
          `[Gemini] 429 rate limit hit (attempt ${attempt + 1}/${maxRetries}), retrying in ${Math.ceil(backoffMs / 1000)}s...`
        );
        await sleep(backoffMs);
        continue;
      }
      throw err;
    }
  }
  throw new Error('Unreachable');
}

// ─── Public API ──────────────────────────────────────────────────────

export interface GeminiResponse {
  text: string;
}

/**
 * Call Gemini Flash — optimized for fast, low-latency tasks.
 */
export async function callGeminiFlash(
  prompt: string,
  systemInstruction?: string
): Promise<GeminiResponse> {
  return withRetry(async () => {
    const ai = getGenAI();
    console.log('[Gemini Flash] Calling...');

    const response = await ai.models.generateContent({
      model: config.gemini.flashModel,
      contents: prompt,
      ...(systemInstruction ? { config: { systemInstruction } } : {}),
    });

    const text = response.text ?? '';
    console.log('[Gemini Flash] Response received (' + text.length + ' chars)');
    return { text };
  });
}

/**
 * Call Gemini Pro — for heavy reasoning tasks.
 */
export async function callGeminiPro(
  prompt: string,
  systemInstruction?: string
): Promise<GeminiResponse> {
  return withRetry(async () => {
    const ai = getGenAI();
    console.log('[Gemini Pro] Calling...');

    const response = await ai.models.generateContent({
      model: config.gemini.proModel,
      contents: prompt,
      ...(systemInstruction ? { config: { systemInstruction } } : {}),
    });

    const text = response.text ?? '';
    console.log('[Gemini Pro] Response received (' + text.length + ' chars)');
    return { text };
  });
}

/**
 * Call Gemini Flash with image (multimodal) — for screenshot analysis.
 * imageBase64: raw base64 string (no data URI prefix)
 */
export async function callGeminiFlashWithImage(
  prompt: string,
  imageBase64: string,
  mimeType: 'image/png' | 'image/jpeg' | 'image/webp' = 'image/png',
  systemInstruction?: string
): Promise<GeminiResponse> {
  return withRetry(async () => {
    const ai = getGenAI();
    console.log('[Gemini Flash+Image] Calling with multimodal input...');

    const response = await ai.models.generateContent({
      model: config.gemini.flashModel,
      contents: [
        {
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType,
                data: imageBase64,
              },
            },
          ],
        },
      ],
      ...(systemInstruction ? { config: { systemInstruction } } : {}),
    });

    const text = response.text ?? '';
    console.log('[Gemini Flash+Image] Response received (' + text.length + ' chars)');
    return { text };
  });
}

/**
 * Call Gemini Flash with TWO images (before + after screenshots).
 */
export async function callGeminiFlashWithTwoImages(
  prompt: string,
  image1Base64: string,
  image2Base64: string,
  mimeType: 'image/png' | 'image/jpeg' = 'image/png',
  systemInstruction?: string
): Promise<GeminiResponse> {
  return withRetry(async () => {
    const ai = getGenAI();
    console.log('[Gemini Flash+2Images] Calling with before+after screenshots...');

    const response = await ai.models.generateContent({
      model: config.gemini.flashModel,
      contents: [
        {
          parts: [
            { text: prompt },
            { inlineData: { mimeType, data: image1Base64 } },
            { inlineData: { mimeType, data: image2Base64 } },
          ],
        },
      ],
      ...(systemInstruction ? { config: { systemInstruction } } : {}),
    });

    const text = response.text ?? '';
    console.log('[Gemini Flash+2Images] Response received (' + text.length + ' chars)');
    return { text };
  });
}

/**
 * Call Gemini with JSON output — parses response as JSON.
 */
export async function callGeminiJson<T>(
  prompt: string,
  systemInstruction: string,
  model: 'flash' | 'pro' = 'flash'
): Promise<T> {
  const fullSystem = `${systemInstruction}\n\nIMPORTANT: Respond ONLY with valid JSON. No markdown, no code fences, no explanation.`;
  const response =
    model === 'flash'
      ? await callGeminiFlash(prompt, fullSystem)
      : await callGeminiPro(prompt, fullSystem);

  let cleaned = response.text.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
  }
  return JSON.parse(cleaned) as T;
}
