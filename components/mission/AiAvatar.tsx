'use client';

import { motion } from 'framer-motion';
import type { MissionStatus } from '@/lib/config';

interface Props {
  status: MissionStatus;
}

const STATUS_TEXT: Record<MissionStatus, string> = {
  idle: 'Standing by…',
  listening: 'Listening…',
  planning: 'Thinking…',
  executing: 'Testing…',
  verifying: 'Verifying…',
  completed: 'Mission Complete',
  error: 'Error Detected',
};

const ORB_VARIANTS: Record<MissionStatus, string> = {
  idle: 'animate-orb-idle',
  listening: 'animate-orb-listen',
  planning: 'animate-orb-think',
  executing: 'animate-orb-speak',
  verifying: 'animate-orb-think',
  completed: '',
  error: '',
};

export default function AiAvatar({ status }: Props) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-6 px-4">
      {/* Orb Container */}
      <motion.div
        className="relative"
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', duration: 0.8 }}
      >
        {/* Outer Ring */}
        <div className={`orb-ring-outer ${status === 'listening' || status === 'executing' ? 'animate-pulse-slow' : ''}`} />

        {/* Inner Ring */}
        <div className={`orb-ring ${status !== 'idle' && status !== 'completed' ? 'animate-pulse' : ''}`} />

        {/* Main Orb */}
        <div className={`orb ${ORB_VARIANTS[status]}`}>
          {/* Thinking spinner overlay */}
          {(status === 'planning' || status === 'verifying') && (
            <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-mission-accent animate-spin" />
          )}

          {/* Completed checkmark */}
          {status === 'completed' && (
            <motion.div
              className="absolute inset-0 flex items-center justify-center"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', delay: 0.3 }}
            >
              <svg className="w-12 h-12 text-mission-success" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
            </motion.div>
          )}

          {/* Error X */}
          {status === 'error' && (
            <motion.div
              className="absolute inset-0 flex items-center justify-center"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
            >
              <svg className="w-12 h-12 text-mission-danger" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </motion.div>
          )}
        </div>
      </motion.div>

      {/* Status Text */}
      <motion.div
        className="text-center"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        <p className="text-sm font-medium text-mission-text-dim tracking-wide">
          {STATUS_TEXT[status]}
        </p>
      </motion.div>

      {/* Audio Waveform for listening/speaking */}
      {(status === 'listening' || status === 'executing') && (
        <div className="flex items-center gap-1 h-6">
          {[...Array(5)].map((_, i) => (
            <motion.div
              key={i}
              className="w-1 bg-mission-primary rounded-full"
              animate={{
                height: [8, 24, 8],
              }}
              transition={{
                duration: 0.6,
                repeat: Infinity,
                delay: i * 0.1,
                ease: 'easeInOut',
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
