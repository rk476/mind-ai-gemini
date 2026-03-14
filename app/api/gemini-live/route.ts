import { NextResponse } from 'next/server';

/**
 * GET /api/gemini-live — Returns session config for the Gemini Live WebSocket.
 * The client connects directly to the Gemini WebSocket — no server proxy needed.
 */

export async function GET() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'GEMINI_API_KEY not configured' }, { status: 500 });
  }

  // Use the latest native audio model per the gemini-live-api-dev skill
  const model = process.env.GEMINI_NATIVE_AUDIO_MODEL || 'gemini-2.5-flash-native-audio-preview-12-2025';

  const wsUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${apiKey}`;

  return NextResponse.json({
    wsUrl,
    model: `models/${model}`,
    config: {
      responseModalities: ['AUDIO'],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: {
            voiceName: 'Aoede',
          },
        },
      },
      // Enable transcription for both AI speech and user speech
      inputAudioTranscription: {},
      outputAudioTranscription: {},
    },
  });
}
