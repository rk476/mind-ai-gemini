'use client';

import { motion } from 'framer-motion';

interface TestStepResult {
  id: string;
  action: string;
  status: string;
  screenshot_url?: string | null;
}

interface TestCaseResult {
  id?: string;
  name: string;
  status: 'passed' | 'failed' | string;
  stepsCount?: number;
  steps?: TestStepResult[];
}

interface Props {
  totalTests: number;
  passed: number;
  failed: number;
  coverage: number;
  aiSummary: string | null;
  videoUrl: string | null;
  testCases: TestCaseResult[];
  onRestart: () => void;
}

export default function TestResults({
  totalTests,
  passed,
  failed,
  coverage,
  aiSummary,
  videoUrl,
  testCases,
  onRestart,
}: Props) {
  return (
    <motion.div
      className="h-full overflow-y-auto p-6 space-y-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      {/* Header */}
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold font-display text-mission-text tracking-wide">
          TEST RESULTS
        </h2>
        <div className="w-16 h-0.5 bg-gradient-to-r from-mission-primary to-mission-accent mx-auto mt-3" />
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-4 gap-4 max-w-3xl mx-auto">
        <div className="glass rounded-xl p-4 text-center neon-border">
          <p className="text-2xl font-bold font-display text-mission-text">{totalTests}</p>
          <p className="text-[10px] text-mission-text-dim uppercase tracking-widest mt-1">Total Tests</p>
        </div>
        <div className="glass rounded-xl p-4 text-center" style={{ borderColor: 'rgba(16, 185, 129, 0.3)', boxShadow: '0 0 15px rgba(16, 185, 129, 0.1)' }}>
          <p className="text-2xl font-bold font-display text-mission-success">{passed}</p>
          <p className="text-[10px] text-mission-text-dim uppercase tracking-widest mt-1">Passed</p>
        </div>
        <div className="glass rounded-xl p-4 text-center" style={{ borderColor: 'rgba(239, 68, 68, 0.3)', boxShadow: '0 0 15px rgba(239, 68, 68, 0.1)' }}>
          <p className="text-2xl font-bold font-display text-mission-danger">{failed}</p>
          <p className="text-[10px] text-mission-text-dim uppercase tracking-widest mt-1">Failed</p>
        </div>
        <div className="glass rounded-xl p-4 text-center neon-border-highlight">
          <p className="text-2xl font-bold font-display text-mission-highlight">{coverage}%</p>
          <p className="text-[10px] text-mission-text-dim uppercase tracking-widest mt-1">Coverage</p>
        </div>
      </div>

      {/* Test Cases */}
      <div className="glass rounded-xl overflow-hidden max-w-3xl mx-auto neon-border">
        <div className="px-5 py-3 border-b border-mission-border">
          <h3 className="text-xs font-semibold text-mission-text-dim uppercase tracking-widest font-display">
            Test Cases
          </h3>
        </div>
        <div className="divide-y divide-mission-border">
          {testCases.map((tc, i) => (
            <div key={i} className="px-5 py-3 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {tc.status === 'passed' ? (
                    <span className="text-mission-success text-lg">✔</span>
                  ) : (
                    <span className="text-mission-danger text-lg">✖</span>
                  )}
                  <span className="text-sm font-medium text-mission-text">{tc.name}</span>
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-widest border ${tc.status === 'passed'
                  ? 'bg-mission-success/10 text-mission-success border-mission-success/20'
                  : 'bg-mission-danger/10 text-mission-danger border-mission-danger/20'
                  }`}>
                  {tc.status}
                </span>
              </div>

              {tc.steps && Array.isArray(tc.steps) && tc.steps.length > 0 && (
                <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-mission-border scrollbar-track-transparent">
                  {tc.steps.map(step => (
                    <div key={step.id} className="flex-shrink-0 w-44 flex flex-col gap-1.5 p-2 rounded-lg bg-gray-900/30 border border-white/5 relative group">
                      <div className="flex justify-between items-center text-[10px] uppercase font-bold tracking-wider">
                        <span className="text-gray-400 truncate pr-2" title={step.action}>{step.action}</span>
                        {step.status === 'passed' ? <span className="text-mission-success">✔</span> : step.status === 'failed' ? <span className="text-mission-danger">✖</span> : <span className="text-gray-500">⏳</span>}
                      </div>
                      {step.screenshot_url ? (
                        <a href={step.screenshot_url} target="_blank" rel="noreferrer" className="block relative aspect-video rounded-md overflow-hidden bg-black/50 border border-white/10 hover:border-mission-primary transition-colors">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={step.screenshot_url} alt={step.action} className="object-cover w-full h-full opacity-70 group-hover:opacity-100 transition-opacity" loading="lazy" />
                        </a>
                      ) : (
                        <div className="aspect-video rounded-md bg-black/30 border border-white/5 flex items-center justify-center">
                          <span className="text-[10px] text-gray-500">No Image</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* AI Summary */}
      {aiSummary && (
        <div className="glass rounded-xl p-5 max-w-3xl mx-auto neon-border-accent">
          <h3 className="text-xs font-semibold text-mission-accent uppercase tracking-widest font-display mb-3">
            AI Insights
          </h3>
          <p className="text-sm text-mission-text-dim leading-relaxed whitespace-pre-wrap">
            {aiSummary}
          </p>
        </div>
      )}

      {/* Video Replay */}
      {videoUrl && (
        <div className="glass rounded-xl p-5 max-w-3xl mx-auto neon-border">
          <h3 className="text-xs font-semibold text-mission-text-dim uppercase tracking-widest font-display mb-3">
            🎥 AI Test Replay
          </h3>
          <video
            controls
            className="w-full rounded-lg border border-mission-border"
            src={videoUrl}
          />
        </div>
      )}

      {/* Restart */}
      <div className="text-center pt-4 flex gap-4 justify-center">
        <button
          onClick={onRestart}
          className="px-6 py-3 bg-white/5 border border-white/10 text-white font-semibold rounded-xl hover:bg-white/10 transition-colors shadow-lg"
        >
          🚀 Launch New Mission
        </button>
        {videoUrl && (
          <a
            href={`/mission-live/${videoUrl.replace('/video', '').split('/').pop()}`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-6 py-3 bg-gradient-to-r from-mission-primary to-mission-accent text-white font-semibold rounded-xl hover:opacity-90 transition-opacity flex items-center gap-2 shadow-[0_0_15px_rgba(59,130,246,0.2)]"
          >
            📊 View Full Test Report
          </a>
        )}
      </div>
    </motion.div>
  );
}
