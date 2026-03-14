'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface InputRequest {
  type: 'url' | 'email' | 'password' | 'text' | 'file';
  label: string;
  placeholder?: string;
}

interface Props {
  inputRequest: InputRequest | null;
  onSubmit: (value: string) => void;
}

export default function DynamicInputPanel({ inputRequest, onSubmit }: Props) {
  const [value, setValue] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!value.trim()) return;
    onSubmit(value.trim());
    setValue('');
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
    <AnimatePresence>
      {inputRequest && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          className="border-t border-mission-border overflow-hidden"
        >
          <div className="glass-light px-6 py-5">
            <form onSubmit={handleSubmit} className="max-w-2xl mx-auto">
              <p className="text-xs text-mission-primary font-semibold uppercase tracking-widest mb-1">
                AI Request
              </p>
              <p className="text-sm text-mission-text mb-3">{inputRequest.label}</p>

              <div className="flex items-center gap-3">
                <div className="relative flex-1">
                  <input
                    type={inputType}
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    placeholder={inputRequest.placeholder || `Enter ${inputRequest.type}...`}
                    className="w-full bg-mission-surface text-mission-text text-sm rounded-lg px-4 py-3 border border-mission-border focus:border-mission-primary focus:outline-none focus:ring-1 focus:ring-mission-primary/30 placeholder:text-mission-muted transition-colors"
                    autoFocus
                  />
                  {inputRequest.type === 'password' && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <svg className="w-4 h-4 text-mission-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                    </div>
                  )}
                </div>
                <button
                  type="submit"
                  disabled={!value.trim()}
                  className="px-6 py-3 bg-gradient-to-r from-mission-primary to-mission-accent text-white text-sm font-semibold rounded-lg hover:opacity-90 disabled:opacity-30 transition-opacity"
                >
                  Submit
                </button>
              </div>
            </form>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
