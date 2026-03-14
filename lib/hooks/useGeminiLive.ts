'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * useGeminiLive — Real-time voice conversation via Gemini Live API WebSocket.
 *
 * Audio flow:
 *   Mic (16kHz PCM) → base64 → WebSocket → Gemini → PCM audio back → AudioContext playback
 *
 * No separate STT / TTS needed — Gemini handles everything natively.
 */

interface GeminiLiveOptions {
  onTranscript?: (role: 'user' | 'ai', text: string) => void;
  onConnected?: () => void;
  onDisconnected?: () => void;
  onError?: (error: string) => void;
  systemInstruction?: string;
}

interface GeminiLiveReturn {
  connect: () => Promise<void>;
  disconnect: () => void;
  isConnected: boolean;
  isAISpeaking: boolean;
  isUserSpeaking: boolean;
  interimTranscript: string;
  startMic: () => Promise<void>;
  stopMic: () => void;
  forceResponse: () => void;
}

// PCM audio helpers
function floatTo16BitPCM(float32Array: Float32Array): ArrayBuffer {
  const buffer = new ArrayBuffer(float32Array.length * 2);
  const view = new DataView(buffer);
  for (let i = 0; i < float32Array.length; i++) {
    const s = Math.max(-1, Math.min(1, float32Array[i]));
    view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return buffer;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

export function useGeminiLive(options: GeminiLiveOptions = {}): GeminiLiveReturn {
  const { onTranscript, onConnected, onDisconnected, onError, systemInstruction } = options;

  const [isConnected, setIsConnected] = useState(false);
  const [isAISpeaking, setIsAISpeaking] = useState(false);
  const [isUserSpeaking, setIsUserSpeaking] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState('');

  const wsRef = useRef<WebSocket | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const audioQueueRef = useRef<ArrayBuffer[]>([]);
  const isPlayingRef = useRef(false);

  // Stable refs for callbacks
  const onTranscriptRef = useRef(onTranscript);
  const onConnectedRef = useRef(onConnected);
  const onDisconnectedRef = useRef(onDisconnected);
  const onErrorRef = useRef(onError);
  onTranscriptRef.current = onTranscript;
  onConnectedRef.current = onConnected;
  onDisconnectedRef.current = onDisconnected;
  onErrorRef.current = onError;

  // ─── Audio Playback (Gapless) ──────────────────────────────────────

  const nextPlayTimeRef = useRef<number>(0);

  const scheduleNextChunks = useCallback(() => {
    const ctx = audioCtxRef.current;
    if (!ctx) return;

    // Fast-forward nextPlayTime if we fell behind the current time
    if (nextPlayTimeRef.current < ctx.currentTime) {
      nextPlayTimeRef.current = ctx.currentTime + 0.05; // tiny buffer
    }

    while (audioQueueRef.current.length > 0) {
      const chunk = audioQueueRef.current.shift()!;

      // Convert 16-bit PCM (24kHz) to Float32
      const int16 = new Int16Array(chunk);
      const float32 = new Float32Array(int16.length);
      for (let i = 0; i < int16.length; i++) {
        float32[i] = int16[i] / 32768;
      }

      const audioBuffer = ctx.createBuffer(1, float32.length, 24000);
      audioBuffer.getChannelData(0).set(float32);

      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(ctx.destination);

      // Schedule precisely
      source.start(nextPlayTimeRef.current);

      // Advance the play time by the duration of this chunk
      nextPlayTimeRef.current += audioBuffer.duration;

      // Update state when playback eventually finishes
      source.onended = () => {
        // If the queue is empty and we've reached the end of the scheduled time
        if (audioQueueRef.current.length === 0 && ctx.currentTime >= nextPlayTimeRef.current - 0.1) {
          isPlayingRef.current = false;
          setIsAISpeaking(false);
          nextPlayTimeRef.current = 0;
        }
      };
    }
  }, []);

  const queueAudio = useCallback(
    (pcmBase64: string) => {
      const pcmData = base64ToArrayBuffer(pcmBase64);
      audioQueueRef.current.push(pcmData);

      if (!isPlayingRef.current) {
        isPlayingRef.current = true;
        setIsAISpeaking(true);
      }

      scheduleNextChunks();
    },
    [scheduleNextChunks]
  );

  // ─── WebSocket Connection ──────────────────────────────────────────

  const connect = useCallback(async () => {
    try {
      // 1. Get session config from our API
      const res = await fetch('/api/gemini-live');
      const config = await res.json();
      if (!res.ok) throw new Error(config.error);

      console.log('[GeminiLive] Config received:', { model: config.model, wsUrl: config.wsUrl.substring(0, 80) + '...' });

      // 2. Create AudioContext for playback
      audioCtxRef.current = new AudioContext({ sampleRate: 24000 });

      // 3. Connect WebSocket
      const ws = new WebSocket(config.wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('[GeminiLive] WebSocket opened, sending setup...');

        // Send setup message
        const setupMsg: Record<string, unknown> = {
          setup: {
            model: config.model,
            generationConfig: {
              responseModalities: config.config.responseModalities,
              speechConfig: config.config.speechConfig,
            },
          },
        };

        if (systemInstruction) {
          (setupMsg.setup as Record<string, unknown>).systemInstruction = {
            parts: [{ text: systemInstruction }],
          };
        }

        console.log('[GeminiLive] Setup message:', JSON.stringify(setupMsg).substring(0, 200));
        ws.send(JSON.stringify(setupMsg));
      };

      ws.onmessage = async (event) => {
        try {
          // Handle both string and Blob messages
          let raw: string;
          if (typeof event.data === 'string') {
            raw = event.data;
          } else if (event.data instanceof Blob) {
            raw = await event.data.text();
          } else {
            console.warn('[GeminiLive] Unknown message type:', typeof event.data);
            return;
          }

          const msg = JSON.parse(raw);
          console.log('[GeminiLive] Message received:', Object.keys(msg), raw.substring(0, 300));

          // Setup complete
          if (msg.setupComplete) {
            console.log('[GeminiLive] ✅ Setup complete!');
            setIsConnected(true);
            onConnectedRef.current?.();
            return;
          }

          // Server content (audio + text)
          if (msg.serverContent) {
            const parts = msg.serverContent.modelTurn?.parts || [];

            for (const part of parts) {
              // Audio response
              if (part.inlineData?.mimeType?.startsWith('audio/')) {
                console.log('[GeminiLive] 🔊 Audio chunk received:', part.inlineData.mimeType);
                queueAudio(part.inlineData.data);
              }

              // Text transcript from AI
              if (part.text) {
                console.log('[GeminiLive] 💬 AI text:', part.text);
                onTranscriptRef.current?.('ai', part.text);
              }
            }

            // Check for turn complete
            if (msg.serverContent.turnComplete) {
              console.log('[GeminiLive] Turn complete');
              setIsAISpeaking(false);
              setInterimTranscript('');
            }
          }

          // User speech transcription (interim/final)
          if (msg.inputTranscription) {
            const text = msg.inputTranscription.text || '';
            console.log('[GeminiLive] 🎤 User transcript:', text, msg.inputTranscription.isFinal ? '(final)' : '(interim)');
            if (msg.inputTranscription.isFinal) {
              setInterimTranscript('');
              onTranscriptRef.current?.('user', text);
            } else {
              setInterimTranscript(text);
            }
          }

          // Handle error messages from Gemini
          if (msg.error) {
            console.error('[GeminiLive] ❌ Server error:', msg.error);
            onErrorRef.current?.(msg.error.message || 'Gemini server error');
          }
        } catch (e) {
          console.error('[GeminiLive] Parse error:', e);
        }
      };

      ws.onerror = (e) => {
        console.error('[GeminiLive] ❌ WebSocket error:', e);
        onErrorRef.current?.('WebSocket connection error');
      };

      ws.onclose = (e) => {
        console.log('[GeminiLive] WebSocket closed:', e.code, e.reason);
        setIsConnected(false);
        setIsAISpeaking(false);
        onDisconnectedRef.current?.();
        if (e.code !== 1000) {
          onErrorRef.current?.(`Connection closed: ${e.reason || `Code ${e.code}`}`);
        }
      };
    } catch (err) {
      console.error('[GeminiLive] Connect error:', err);
      onErrorRef.current?.(err instanceof Error ? err.message : 'Connection failed');
    }
  }, [systemInstruction, queueAudio]);

  // ─── Force Response ──────────────────────────────────────────────────

  const forceResponse = useCallback(() => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    console.log('[GeminiLive] ⚡ Forcing model response (turnComplete: true)...');

    // To prevent the 1007 Error, we must send a valid clientContent shape
    // that triggers the model response. Sending an empty string "" is often
    // rejected, but a single space " " is processed as a turn.
    wsRef.current.send(JSON.stringify({
      clientContent: {
        turns: [
          { role: 'user', parts: [{ text: "Hello" }] }
        ],
        turnComplete: true
      }
    }));
  }, []);

  // ─── Disconnect ────────────────────────────────────────────────────

  const disconnect = useCallback(() => {
    stopMic();
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close();
      audioCtxRef.current = null;
    }
    audioQueueRef.current = [];
    isPlayingRef.current = false;
    setIsConnected(false);
    setIsAISpeaking(false);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Microphone ────────────────────────────────────────────────────

  const startMic = useCallback(async () => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { sampleRate: 16000, channelCount: 1, echoCancellation: true },
      });
      streamRef.current = stream;

      // Use AudioContext for resampling to 16kHz
      const micCtx = new AudioContext({ sampleRate: 16000 });
      const source = micCtx.createMediaStreamSource(stream);
      sourceRef.current = source;

      // ScriptProcessor to capture raw PCM
      const processor = micCtx.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      processor.onaudioprocess = (e) => {
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

        const inputData = e.inputBuffer.getChannelData(0);
        const pcmBuffer = floatTo16BitPCM(inputData);
        const base64 = arrayBufferToBase64(pcmBuffer);

        wsRef.current.send(
          JSON.stringify({
            realtimeInput: {
              mediaChunks: [
                {
                  mimeType: 'audio/pcm;rate=16000',
                  data: base64,
                },
              ],
            },
          })
        );
      };

      source.connect(processor);
      processor.connect(micCtx.destination);
      setIsUserSpeaking(true);
    } catch (err) {
      console.error('[GeminiLive] Mic error:', err);
      onErrorRef.current?.('Microphone access denied');
    }
  }, []);

  const stopMic = useCallback(() => {
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (sourceRef.current) {
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setIsUserSpeaking(false);
  }, []);

  // ─── Send Text ─────────────────────────────────────────────────────

  const sendText = useCallback((text: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

    wsRef.current.send(
      JSON.stringify({
        clientContent: {
          turns: [
            {
              role: 'user',
              parts: [{ text }],
            },
          ],
          turnComplete: true,
        },
      })
    );
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (wsRef.current) wsRef.current.close();
      if (audioCtxRef.current) audioCtxRef.current.close();
      if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
    };
  }, []);

  return {
    connect,
    disconnect,
    isConnected,
    isAISpeaking,
    isUserSpeaking,
    interimTranscript,
    startMic,
    stopMic,
    forceResponse,
  };
}
