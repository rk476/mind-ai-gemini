'use client';

import { useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { ConversationMessage } from '@/lib/config';

interface InputRequest {
  type: 'url' | 'email' | 'password' | 'text' | 'file';
  label: string;
  placeholder?: string;
}

interface Props {
  messages: ConversationMessage[];
  reasoning: string[];
  isProcessing: boolean;
  isSpeaking: boolean;
  isListening: boolean;
  inputRequest: InputRequest | null;
  onSpeak: () => void;
  onStopSpeaking: () => void;
  onSubmitInput: (value: string) => void;
}

export default function ConversationPanel({
  messages,
  reasoning,
  isProcessing,
  isSpeaking,
  isListening,
  inputRequest,
  onSpeak,
  onStopSpeaking,
  onSubmitInput,
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, reasoning]);

  useEffect(() => {
    if (inputRequest && inputRef.current) {
      inputRef.current.focus();
    }
  }, [inputRequest]);

  const handleInputSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const val = inputRef.current?.value?.trim();
    if (val) {
      onSubmitInput(val);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const inputType = (() => {
    switch (inputRequest?.type) {
      case 'url': return 'url';
      case 'email': return 'email';
      case 'password': return 'password';
      default: return 'text';
    }
  })();

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-mission-border">
        <h2 className="text-xs font-semibold text-mission-text-dim uppercase tracking-widest font-display">
          Voice Conversation
        </h2>
      </div>

      {/* Live Transcript */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        <AnimatePresence>
          {messages.map((msg, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className="flex gap-3 items-start"
            >
              <span
                className={`text-[10px] font-bold uppercase tracking-wider mt-0.5 w-8 shrink-0 ${msg.role === 'ai'
                  ? 'text-mission-primary'
                  : msg.role === 'user'
                    ? 'text-mission-accent'
                    : 'text-mission-highlight'
                  }`}
              >
                {msg.role === 'ai' ? 'AI' : msg.role === 'user' ? 'YOU' : 'SYS'}
              </span>
              <p className="text-sm text-mission-text leading-relaxed">{msg.content}</p>
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Processing indicator — shows "Thinking..." while waiting for AI */}
        {isProcessing && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex gap-3 items-center"
          >
            <span className="text-[10px] font-bold text-mission-primary uppercase tracking-wider w-8 shrink-0">
              AI
            </span>
            <div className="flex items-center gap-2">
              <div className="flex gap-1">
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    className="w-1.5 h-1.5 bg-mission-primary rounded-full"
                    animate={{ opacity: [0.3, 1, 0.3] }}
                    transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.15 }}
                  />
                ))}
              </div>
              <span className="text-xs text-mission-muted">Thinking...</span>
            </div>
          </motion.div>
        )}
      </div>

      {/* AI Reasoning strip */}
      {reasoning.length > 0 && (
        <div className="border-t border-mission-border px-4 py-2 max-h-20 overflow-y-auto">
          <p className="text-[10px] font-semibold text-mission-highlight uppercase tracking-widest mb-1">
            M.I.N.D. Thought
          </p>
          {reasoning.slice(-3).map((line, i) => (
            <p key={i} className="reasoning-line">{line}</p>
          ))}
        </div>
      )}

      {/* ─── Bottom Control ──────────────────────────────────────────── */}
      <div className="border-t border-mission-border p-4">
        <AnimatePresence mode="wait">
          {inputRequest ? (
            /* ─── Text Input Mode (AI needs URL / email / password) ──── */
            <motion.form
              key="input"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              onSubmit={handleInputSubmit}
              className="space-y-2"
            >
              <p className="text-xs text-mission-primary font-semibold uppercase tracking-widest">
                {inputRequest.label}
              </p>
              <div className="flex gap-2">
                <input
                  ref={inputRef}
                  type={inputType}
                  placeholder={inputRequest.placeholder || `Enter ${inputRequest.type}...`}
                  className="flex-1 bg-mission-surface text-mission-text text-sm rounded-lg px-3 py-2.5 border border-mission-border focus:border-mission-primary focus:outline-none focus:ring-1 focus:ring-mission-primary/30 placeholder:text-mission-muted transition-colors"
                />
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-gradient-to-r from-mission-primary to-mission-accent text-white text-sm font-semibold rounded-lg hover:opacity-90 transition-opacity"
                >
                  Submit
                </button>
              </div>
            </motion.form>
          ) : (
            /* ─── Voice Mode (Speak / Stop / Processing) ──── */
            <motion.div
              key="speak"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex flex-col items-center gap-3"
            >
              {isListening ? (
                /* ── Recording: show STOP icon ── */
                <button
                  onClick={onSpeak}
                  className="w-16 h-16 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center hover:bg-red-500/30 transition-all animate-pulse"
                  style={{ boxShadow: '0 0 30px rgba(239, 68, 68, 0.25)' }}
                >
                  <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 24 24">
                    <rect x="6" y="6" width="12" height="12" rx="2" />
                  </svg>
                </button>
              ) : isSpeaking ? (
                /* ── AI speaking: show stop button ── */
                <button
                  onClick={onStopSpeaking}
                  className="w-16 h-16 rounded-full bg-mission-accent/20 text-mission-accent flex items-center justify-center hover:bg-mission-accent/30 transition-all neon-border-accent"
                >
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                    <rect x="6" y="6" width="12" height="12" rx="2" />
                  </svg>
                </button>
              ) : (
                /* ── Idle: show mic button ── */
                <button
                  onClick={onSpeak}
                  disabled={isProcessing}
                  className="w-16 h-16 rounded-full bg-mission-primary/15 text-mission-primary flex items-center justify-center hover:bg-mission-primary/25 disabled:opacity-30 transition-all neon-border"
                >
                  <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
                    <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
                  </svg>
                </button>
              )}

              <p className="text-xs text-mission-muted">
                {isListening
                  ? '🔴 Recording — Click to stop speaking'
                  : isSpeaking
                    ? '🔊 AI is speaking — Click to skip'
                    : isProcessing
                      ? '⏳ Processing your input...'
                      : '🎙️ Tap to speak'}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
