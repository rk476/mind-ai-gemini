'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';

interface Props {
  onLaunch: () => Promise<void> | void;
}

export default function LaunchScreen({ onLaunch }: Props) {
  const [isLaunching, setIsLaunching] = useState(false);

  const handleLaunchClick = async () => {
    if (isLaunching) return;
    setIsLaunching(true);
    try {
      await onLaunch();
    } catch (err) {
      console.error(err);
      setIsLaunching(false);
    }
  };

  return (
    <div className="fixed inset-0 gradient-bg flex flex-col items-center justify-center z-40">
      {/* Particle dots */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(20)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-1 h-1 rounded-full bg-mission-primary/20"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
            }}
            animate={{
              opacity: [0, 0.5, 0],
              scale: [0, 1, 0],
            }}
            transition={{
              duration: 3 + Math.random() * 2,
              repeat: Infinity,
              delay: Math.random() * 3,
            }}
          />
        ))}
      </div>

      {/* Main Content */}
      <motion.div
        className="text-center z-10"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
      >
        {/* Orb */}
        <motion.div
          className="mx-auto mb-8 relative"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', delay: 0.3, duration: 1 }}
        >
          <div className="orb mx-auto animate-orb-idle" />
          <div className="orb-ring" />
          <div className="orb-ring-outer" />
        </motion.div>

        {/* Title */}
        <motion.h1
          className="text-5xl md:text-6xl font-bold font-display tracking-wide text-mission-text mb-3"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          M.I.N.D. AI
        </motion.h1>

        <motion.p
          className="text-lg text-mission-text mb-3 tracking-[0.15em] font-display uppercase"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
        >
          Machine Interface for Navigation & Diagnostics
        </motion.p>

        <motion.p
          className="text-sm text-mission-text-dim mb-12 tracking-widest leading-relaxed max-w-2xl mx-auto uppercase opacity-70 font-mono"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.9 }}
        >
          LIVE INTERACTION • AUTONOMOUS QA AGENT • SELF-HEALING SELECTORS • GEMINI VISUAL VALIDATION • HEADLESS BROSWER ORCHESTRATION
        </motion.p>

        <motion.p
          className="text-sm text-mission-text-dim mb-6 tracking-widest leading-relaxed max-w-2xl mx-auto uppercase opacity-70 font-mono"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.9 }}
        >
          Engage with your first mission.
        </motion.p>

        {/* Launch Button */}
        <motion.button
          onClick={handleLaunchClick}
          disabled={isLaunching}
          className={`launch-btn px-8 py-4 bg-mission-surface text-mission-text font-semibold text-lg rounded-xl transition-colors relative z-10 ${isLaunching ? 'opacity-80 cursor-not-allowed' : 'hover:bg-mission-card'
            }`}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1 }}
          whileHover={!isLaunching ? { scale: 1.05 } : {}}
          whileTap={!isLaunching ? { scale: 0.98 } : {}}
        >
          <span className="flex items-center justify-center gap-3">
            {isLaunching ? (
              <>
                <div className="w-5 h-5 border-2 border-white/20 border-t-white border-r-white rounded-full animate-spin transition-all" />
                <span>Initializing AI Session...</span>
              </>
            ) : (
              <>
                <span className="text-2xl">🚀</span>
                <span>Launch Test Mission</span>
              </>
            )}
          </span>
        </motion.button>
      </motion.div>

      {/* Bottom branding */}
      <motion.p
        className="absolute bottom-8 text-xs text-mission-muted tracking-widest uppercase"
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.5 }}
        transition={{ delay: 1.5 }}
      >
        Powered by Gemini AI
      </motion.p>
    </div>
  );
}
