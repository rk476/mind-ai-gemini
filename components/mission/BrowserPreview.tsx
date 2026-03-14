'use client';

import { motion } from 'framer-motion';

interface Props {
  screenshotUrl: string | null;
  currentStep: string | null;
  confidence: number | null;
  detectedElements: string[];
  isExecuting: boolean;
}

export default function BrowserPreview({
  screenshotUrl,
  currentStep,
  confidence,
  detectedElements,
  isExecuting,
}: Props) {
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-mission-border flex items-center justify-between">
        <h2 className="text-xs font-semibold text-mission-text-dim uppercase tracking-widest font-display">
          Browser Preview
        </h2>
        {isExecuting && (
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-mission-highlight animate-pulse" />
            <span className="text-[10px] text-mission-highlight font-medium uppercase">LIVE</span>
          </div>
        )}
      </div>

      {/* Browser View */}
      <div className="flex-1 relative overflow-hidden bg-mission-bg">
        {screenshotUrl ? (
          <motion.div
            className="w-full h-full"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={screenshotUrl}
              alt="Browser preview"
              className="w-full h-full object-contain"
            />

            {/* Detected Elements Overlay */}
            {detectedElements.length > 0 && (
              <div className="absolute top-3 left-3 space-y-1">
                <p className="text-[10px] font-semibold text-mission-highlight uppercase tracking-wider">
                  AI DETECTED:
                </p>
                {detectedElements.map((el, i) => (
                  <div
                    key={i}
                    className="text-[11px] text-mission-text bg-mission-bg/80 px-2 py-0.5 rounded border border-mission-highlight/20"
                  >
                    {el}
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-mission-muted gap-4">
            <div className="w-16 h-12 rounded-lg border-2 border-dashed border-mission-border flex items-center justify-center">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <p className="text-xs text-center">
              Browser preview will appear here<br />
              during test execution
            </p>
          </div>
        )}
      </div>

      {/* Step Info Bar */}
      {currentStep && (
        <motion.div
          className="px-4 py-2.5 border-t border-mission-border glass-light"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-mission-highlight animate-pulse" />
              <span className="text-xs text-mission-text">Step: {currentStep}</span>
            </div>
            {confidence !== null && (
              <span className="text-xs text-mission-highlight font-mono">
                Confidence: {confidence}%
              </span>
            )}
          </div>
        </motion.div>
      )}
    </div>
  );
}
