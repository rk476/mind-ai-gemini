'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';

// ─── Interfaces ────────────────────────────────────────────────────────
interface TestStep {
  _id: string;
  test_case_id: string;
  action: string;
  target: string | null;
  value: string | null;
  status: 'passed' | 'failed' | 'pending';
  screenshot_url: string | null;
  error_message: string | null;
  duration_ms: number | null;
  healed: boolean;
}

interface TestCase {
  _id: string;
  run_id: string;
  name: string;
  status: string;
  steps: TestStep[];
}

interface TestRun {
  _id: string;
  url: string;
  instructions: string;
  status: string;
  headless: boolean;
  video_path: string | null;
  network_logs: { url: string; method: string; status: number; statusText: string }[] | null;
  console_logs: { errors: string[]; warnings: string[]; info: string[] } | null;
  ai_summary: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

interface RunResponse {
  run: TestRun;
  testCases: TestCase[];
  videoAvailable: boolean;
}

// ─── Components ────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const isPassed = status === 'passed';
  const isFailed = status === 'failed' || status === 'error';
  const isPending = status === 'pending' || status === 'running' || status === 'queued';

  let colors = 'bg-gray-500/10 text-gray-400 border-gray-500/20';
  if (isPassed) colors = 'bg-mission-success/10 text-mission-success border-mission-success/20';
  else if (isFailed) colors = 'bg-mission-danger/10 text-mission-danger border-mission-danger/20';
  else if (isPending) colors = 'bg-blue-500/10 text-blue-400 border-blue-500/20 animate-pulse';

  return (
    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest border ${colors}`}>
      {status}
    </span>
  );
}

function ScreenshotModal({ url, onClose }: { url: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md" onClick={onClose}>
      <div
        className="relative max-w-5xl max-h-[90vh] bg-mission-bg border border-mission-border rounded-xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full bg-black/50 border border-white/10 text-white flex items-center justify-center hover:bg-white/10 transition-colors"
        >
          ✕
        </button>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt="Test detail" className="max-w-full max-h-[85vh] object-contain" />
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────

export default function MissionLiveTestDetailPage() {
  const params = useParams();
  const runId = params.testId as string;
  const router = useRouter();

  const [runData, setRunData] = useState<RunResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedScreenshot, setSelectedScreenshot] = useState<string | null>(null);
  const [expandedCases, setExpandedCases] = useState<Set<string>>(new Set());

  useEffect(() => {
    async function fetchTestData() {
      try {
        const res = await fetch(`/api/test/${runId}`);
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || 'Failed to fetch test details');
          return;
        }
        setRunData(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Network error');
      } finally {
        setLoading(false);
      }
    }
    fetchTestData();
  }, [runId]);

  const toggleCase = (caseId: string) => {
    setExpandedCases((prev) => {
      const next = new Set(prev);
      if (next.has(caseId)) next.delete(caseId);
      else next.add(caseId);
      return next;
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] text-white flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 rounded-full border-2 border-mission-highlight border-t-transparent animate-spin" />
          <p className="text-sm text-mission-text-dim uppercase tracking-widest font-display animate-pulse">
            Loading Mission Data...
          </p>
        </div>
      </div>
    );
  }

  if (error || !runData) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] text-white p-8">
        <div className="max-w-3xl mx-auto glass rounded-xl border border-mission-danger/30 p-6 text-center">
          <h2 className="text-xl font-display text-mission-danger mb-2">Error Loading Mission</h2>
          <p className="text-mission-text-dim mb-6">{error || 'Mission not found'}</p>
          <button
            onClick={() => router.push('/')}
            className="px-6 py-2 bg-mission-bg border border-white/10 rounded-lg text-sm hover:bg-white/5 transition-colors"
          >
            ← Back to Mission Control
          </button>
        </div>
      </div>
    );
  }

  const { run, testCases } = runData;
  const totalSteps = testCases.reduce((acc, tc) => acc + (tc.steps?.length || 0), 0);
  const passedCases = testCases.filter((tc) => tc.status === 'passed').length;

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white overflow-y-auto">
      {/* Top Navigation */}
      <div className="sticky top-0 z-40 bg-[#0a0a0f]/80 backdrop-blur-md border-b border-white/10 px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.replace('/')}
            className="text-mission-text-dim hover:text-white transition-colors flex items-center gap-2 text-sm"
          >
            <span>←</span> Back
          </button>
          <div className="h-4 w-px bg-white/20" />
          <h1 className="text-lg font-bold font-display tracking-widest text-mission-text uppercase">
            Mission Report
          </h1>
          <span className="text-xs font-mono text-mission-text-dim bg-white/5 px-2 py-1 rounded">
            {runId.substring(0, 8)}
          </span>
        </div>
        <div>
          <button
            onClick={() => router.push('/')}
            className="px-5 py-2 bg-gradient-to-r from-mission-primary to-mission-accent text-white text-xs font-bold uppercase tracking-wider rounded-lg shadow-[0_0_15px_rgba(59,130,246,0.3)] hover:shadow-[0_0_20px_rgba(59,130,246,0.5)] transition-shadow"
          >
            Launch New Mission
          </button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-8 py-8 space-y-8">

        {/* Overview Header */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-4 gap-4">
          <div className="col-span-4 glass rounded-xl border border-white/10 p-6 flex items-center justify-between">
            <div>
              <p className="text-xs text-mission-text-dim uppercase tracking-widest mb-1">Target Website</p>
              <h2 className="text-xl font-mono text-mission-highlight">{run.url}</h2>
            </div>
            <div className="text-right">
              <p className="text-xs text-mission-text-dim uppercase tracking-widest mb-2">Final Status</p>
              <StatusBadge status={run.status} />
            </div>
          </div>

          <div className="glass rounded-xl border border-white/10 p-4 text-center">
            <p className="text-2xl font-bold font-display text-white">{testCases.length}</p>
            <p className="text-[10px] text-mission-text-dim uppercase tracking-widest mt-1">Total Cases</p>
          </div>
          <div className="glass rounded-xl border border-mission-success/30 p-4 text-center shadow-[0_0_15px_rgba(16,185,129,0.05)]">
            <p className="text-2xl font-bold font-display text-mission-success">{passedCases}</p>
            <p className="text-[10px] text-mission-success/70 uppercase tracking-widest mt-1">Passed</p>
          </div>
          <div className="glass rounded-xl border border-white/10 p-4 text-center">
            <p className="text-2xl font-bold font-display text-white">{totalSteps}</p>
            <p className="text-[10px] text-mission-text-dim uppercase tracking-widest mt-1">Total Steps Executed</p>
          </div>
          <div className="glass rounded-xl border border-white/10 p-4 text-center">
            <p className="text-2xl font-bold font-display text-white">
              {run.completed_at && run.started_at
                ? ((new Date(run.completed_at).getTime() - new Date(run.started_at).getTime()) / 1000).toFixed(1) + 's'
                : '---'}
            </p>
            <p className="text-[10px] text-mission-text-dim uppercase tracking-widest mt-1">Execution Time</p>
          </div>
        </motion.div>

        {/* AI Summary */}
        {run.ai_summary && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass rounded-xl border border-mission-highlight/30 p-6 shadow-[0_0_20px_rgba(59,130,246,0.1)]">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-xl">🧠</span>
              <h3 className="text-sm font-semibold text-mission-highlight uppercase tracking-widest font-display">M.I.N.D. Test Summary</h3>
            </div>
            <p className="text-sm text-mission-text leading-relaxed whitespace-pre-wrap">
              {run.ai_summary}
            </p>
          </motion.div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* Main Content — Test Cases Details */}
          <div className="lg:col-span-2 space-y-6">
            <h3 className="text-lg font-bold font-display text-mission-text uppercase tracking-widest border-b border-white/10 pb-3">
              Detailed Execution Log
            </h3>

            <div className="space-y-4">
              {testCases.map((tc, tcIdx) => (
                <motion.div
                  key={tc._id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 + (tcIdx * 0.05) }}
                  className="glass rounded-xl border border-white/10 overflow-hidden"
                >
                  <button
                    onClick={() => toggleCase(tc._id)}
                    className="w-full px-5 py-4 flex items-center justify-between hover:bg-white/5 transition-colors text-left"
                  >
                    <div className="flex items-center gap-4">
                      <span className={`text-xl ${tc.status === 'passed' ? 'text-mission-success' : 'text-mission-danger'}`}>
                        {tc.status === 'passed' ? '✔' : '✖'}
                      </span>
                      <span className="text-sm font-medium text-white">{tc.name}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <StatusBadge status={tc.status} />
                      <span className="text-mission-text-dim text-xs w-4">
                        {expandedCases.has(tc._id) ? '▼' : '▶'}
                      </span>
                    </div>
                  </button>

                  {expandedCases.has(tc._id) && (
                    <div className="bg-black/40 border-t border-white/5 p-4">
                      <div className="space-y-2">
                        {tc.steps?.length > 0 ? (
                          tc.steps.map((step, stepIdx) => (
                            <div key={step._id} className="grid grid-cols-[auto_1fr_auto] gap-4 items-center bg-white/[0.02] border border-white/5 rounded-lg p-3 hover:bg-white/[0.04] transition-colors">

                              {/* Left: Step Index & Status */}
                              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-white/5 text-xs text-mission-text-dim font-mono">
                                {stepIdx + 1}
                              </div>

                              {/* Middle: Action Details */}
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-[11px] font-bold text-mission-accent uppercase tracking-widest">{step.action}</span>
                                  {step.healed && <span className="px-1.5 py-0.5 rounded text-[8px] uppercase tracking-wider bg-orange-500/20 text-orange-400 font-bold">Healed</span>}
                                  {step.duration_ms && <span className="text-[10px] text-gray-500 font-mono">{step.duration_ms}ms</span>}
                                </div>

                                {step.target && (
                                  <div className="text-xs text-mission-text truncate">
                                    <span className="text-gray-500">Target:</span> <span className="font-mono text-gray-300">{step.target}</span>
                                  </div>
                                )}

                                {step.value && (
                                  <div className="text-xs text-mission-text mt-0.5 truncate">
                                    <span className="text-gray-500">Input:</span> <span className="font-mono text-gray-300">"{step.value}"</span>
                                  </div>
                                )}

                                {step.error_message && (
                                  <div className="mt-2 text-xs text-red-400 bg-red-950/30 border border-red-900/50 p-2 rounded break-words font-mono">
                                    {step.error_message}
                                  </div>
                                )}
                              </div>

                              {/* Right: Status Icon + Screenshot */}
                              <div className="flex flex-col items-end gap-2 shrink-0">
                                {step.status === 'passed' ? (
                                  <span className="text-mission-success text-sm">✔</span>
                                ) : (
                                  <span className="text-mission-danger text-sm">✖</span>
                                )}

                                {step.screenshot_url && (
                                  <button
                                    onClick={(e) => { e.stopPropagation(); setSelectedScreenshot(step.screenshot_url!); }}
                                    className="relative w-20 h-12 bg-black rounded border border-white/10 overflow-hidden group hover:border-mission-primary transition-colors"
                                  >
                                    <div className="absolute inset-0 bg-black/40 group-hover:bg-transparent transition-colors z-10" />
                                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 z-20">
                                      <span className="text-[10px] font-bold text-white uppercase tracking-wider drop-shadow-md">View</span>
                                    </div>
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src={step.screenshot_url} alt="step view" className="object-cover w-full h-full opacity-60 group-hover:opacity-100 transition-opacity" />
                                  </button>
                                )}
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="text-center py-4 text-xs text-mission-text-dim">No steps recorded for this test case.</div>
                        )}
                      </div>
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          </div>

          {/* Sidebar — Video & Logs */}
          <div className="space-y-6">

            {/* Video Player */}
            <h3 className="text-lg font-bold font-display text-mission-text uppercase tracking-widest border-b border-white/10 pb-3">
              Session Replay
            </h3>
            <div className="glass rounded-xl border border-white/10 p-4">
              {run?.video_path ? (
                <video
                  controls
                  className="w-full aspect-video rounded-lg border border-white/10 bg-black"
                  src={run.video_path.startsWith('http') ? run.video_path : `/api/test/${runId}/video`}
                />
              ) : (
                <div className="w-full aspect-video rounded-lg border border-white/10 bg-black/30 flex flex-col items-center justify-center text-mission-text-dim">
                  <span className="text-2xl mb-2">📹</span>
                  <p className="text-xs uppercase tracking-widest">No Video Recorded</p>
                </div>
              )}
            </div>

            {/* Network / Console Snippets */}
            {(run.network_logs?.length || run.console_logs?.errors?.length) ? (
              <>
                <h3 className="text-lg font-bold font-display text-mission-text uppercase tracking-widest border-b border-white/10 pb-3 pt-4">
                  Diagnostics
                </h3>

                {run.console_logs?.errors && run.console_logs.errors.length > 0 && (
                  <div className="glass rounded-xl border border-red-500/20 p-4">
                    <p className="text-xs font-bold uppercase tracking-widest text-red-400 mb-3">Console Errors ({run.console_logs.errors.length})</p>
                    <div className="space-y-2 max-h-48 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-white/10">
                      {run.console_logs.errors.map((err, i) => (
                        <div key={i} className="text-[10px] font-mono text-red-300 bg-red-950/20 p-2 rounded border border-red-900/30 break-words">
                          {err}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {run.network_logs && run.network_logs.length > 0 && (
                  <div className="glass rounded-xl border border-orange-500/20 p-4">
                    <p className="text-xs font-bold uppercase tracking-widest text-orange-400 mb-3">Network Warnings ({run.network_logs.length})</p>
                    <div className="space-y-2 max-h-48 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-white/10">
                      {run.network_logs.map((log, i) => (
                        <div key={i} className="flex flex-col gap-1 text-[10px] font-mono text-orange-300 bg-orange-950/20 p-2 rounded border border-orange-900/30">
                          <div className="flex justify-between items-center">
                            <span className="font-bold">{log.method}</span>
                            <span className={log.status >= 500 ? 'text-red-400 font-bold' : ''}>{log.status} {log.statusText}</span>
                          </div>
                          <div className="break-all opacity-80">{log.url}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : null}

          </div>
        </div>
      </div>

      {selectedScreenshot && (
        <ScreenshotModal url={selectedScreenshot} onClose={() => setSelectedScreenshot(null)} />
      )}
    </div>
  );
}
