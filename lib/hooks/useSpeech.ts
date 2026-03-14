'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Voice hooks:
 * - useTTS: Google Cloud TTS (with browser SpeechSynthesis fallback)
 * - useSTT: Deepgram Nova-2 via MediaRecorder + /api/stt
 */

// ─── Text-to-Speech (Google Cloud TTS → browser fallback) ───────────

export function useTTS() {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const speak = useCallback(async (text: string) => {
    if (typeof window === 'undefined') return;

    // Stop current speech
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (abortRef.current) abortRef.current.abort();

    setIsSpeaking(true);
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        if (errData.fallback) {
          speakWithBrowser(text);
          return;
        }
        throw new Error('TTS API failed');
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;

      audio.onended = () => {
        setIsSpeaking(false);
        URL.revokeObjectURL(url);
        audioRef.current = null;
      };
      audio.onerror = () => {
        setIsSpeaking(false);
        URL.revokeObjectURL(url);
        audioRef.current = null;
      };

      await audio.play();
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      console.warn('[TTS] Falling back to browser:', err);
      speakWithBrowser(text);
    }
  }, []);

  const speakWithBrowser = useCallback((text: string) => {
    if (!window.speechSynthesis) {
      setIsSpeaking(false);
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    const voices = window.speechSynthesis.getVoices();
    const preferred = voices.find(
      (v) => v.name.includes('Samantha') || v.name.includes('Google') || v.lang.startsWith('en')
    );
    if (preferred) utterance.voice = preferred;
    utterance.rate = 1.05;
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    window.speechSynthesis.speak(utterance);
  }, []);

  const stop = useCallback(() => {
    if (abortRef.current) abortRef.current.abort();
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.getVoices();
      window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
    }
  }, []);

  return { speak, stop, isSpeaking };
}

// ─── Speech-to-Text (Deepgram via MediaRecorder) ────────────────────

interface STTOptions {
  onResult: (transcript: string) => void;
  onListeningChange?: (listening: boolean) => void;
}

export function useSTT({ onResult, onListeningChange }: STTOptions) {
  const [isListening, setIsListening] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  const updateListening = useCallback(
    (val: boolean) => {
      setIsListening(val);
      onListeningChange?.(val);
    },
    [onListeningChange]
  );

  const start = useCallback(async () => {
    if (isListening) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus',
      });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        // Stop all tracks
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;

        const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
        chunksRef.current = [];

        if (audioBlob.size < 1000) {
          // Too small — probably no speech
          updateListening(false);
          return;
        }

        // Send to Deepgram via our API
        try {
          const res = await fetch('/api/stt', {
            method: 'POST',
            headers: { 'Content-Type': 'audio/webm' },
            body: audioBlob,
          });

          if (res.ok) {
            const data = await res.json();
            if (data.transcript && data.transcript.trim()) {
              onResult(data.transcript.trim());
            }
          } else {
            console.error('[STT] API error:', res.status);
          }
        } catch (err) {
          console.error('[STT] Error:', err);
        }

        updateListening(false);
      };

      mediaRecorder.start();
      updateListening(true);
    } catch (err) {
      console.error('[STT] Mic access error:', err);
      updateListening(false);
    }
  }, [isListening, onResult, updateListening]);

  const stop = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    // isListening will be set to false in onstop handler
  }, []);

  const toggle = useCallback(() => {
    if (isListening) {
      stop();
    } else {
      start();
    }
  }, [isListening, start, stop]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current?.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  return { isListening, start, stop, toggle };
}
