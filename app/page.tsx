'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import type { MissionStatus, ConversationMessage } from '@/lib/config';
import { useGeminiLive } from '@/lib/hooks/useGeminiLive';
import MissionControlHeader from '@/components/mission/MissionControlHeader';
import BrowserPreview from '@/components/mission/BrowserPreview';
import LaunchScreen from '@/components/mission/LaunchScreen';
import TestResults from '@/components/mission/TestResults';

// ─── Types ──────────────────────────────────────────────────────────────

type AppPhase = 'launch' | 'conversation' | 'analyzing' | 'execution' | 'results';

interface InputRequest {
  type: 'url' | 'email' | 'password' | 'text' | 'file';
  label: string;
  placeholder?: string;
}

interface MissionState {
  phase: AppPhase;
  missionId: string | null;
  status: MissionStatus;
  conversation: ConversationMessage[];
  reasoning: string[];
  inputRequest: InputRequest | null;
  isProcessing: boolean;
  runId: string | null;
  screenshotUrl: string | null;
  currentStep: string | null;
  websiteUrl: string | null;
  analysis: { description: string; suggestedFlows: string[] } | null;
  results: {
    totalTests: number;
    passed: number;
    failed: number;
    coverage: number;
    aiSummary: string | null;
    videoUrl: string | null;
    testCases: { name: string; status: string; stepsCount: number }[];
  } | null;
}

// System instruction — establishes the M.I.N.D. AI persona
const INITIAL_INSTRUCTION = `You are "M.I.N.D.", a professional AI QA engineer having a real-time voice conversation. 

CONVERSATION FLOW:
The user just said "Hello, I need help with testing". Respond naturally:
1. GREETING: Say "Hey, how can I help you with testing today?"
2. WAIT FOR THE USER TO REPLY.
3. GET URL: When the user says they want to test a website, ask for the URL.
4. WAIT FOR THE USER TO REPLY.
5. After they give the URL, say "Got it! Let me analyze that website." then go silent — the system is running analysis.

STRICT RULES:
- LANGUAGE: English ONLY. Never switch languages.
- CONCISE: Max 2 sentences per response. This is a voice conversation.
- NEVER say "Starting tests now" during this initial phase.
- NO HALLUCINATIONS: Never invent URLs, credentials, or flows.
- INPUT FIELDS: When asking for a URL, say "website URL".`;

// Ready-phrase detection — triggers the test execution pipeline
const READY_PHRASES = [
  'starting tests now', 'starting test now', 'starting the test',
  'begin testing', 'start testing', 'commence testing', 'execute the test',
  'running the tests', 'initiating test', 'let me begin', 'launching the test',
];

function isReadyPhrase(text: string): boolean {
  const lower = text.toLowerCase();
  return READY_PHRASES.some((p) => lower.includes(p));
}

// Input field detection — maps AI speech to the right input type
function detectInputRequest(text: string): InputRequest | null {
  const lower = text.toLowerCase();

  if (lower.includes('url') || lower.includes('website address') || lower.includes('web address')) {
    return { type: 'text', label: 'Website URL', placeholder: 'https://example.com' };
  }
  if ((lower.includes('username') || lower.includes('email')) && lower.includes('password')) {
    return { type: 'text', label: 'Username and Password', placeholder: 'e.g. demo@gmail.com  Hgt@123' };
  }
  if (lower.includes('username') || (lower.includes('email') && !lower.includes('send'))) {
    return { type: 'text', label: 'Username / Email', placeholder: 'Enter your username or email' };
  }
  if (lower.includes('password') || lower.includes('credential')) {
    return { type: 'text', label: 'Password', placeholder: 'Enter your password' };
  }
  if (lower.includes('search') && (lower.includes('keyword') || lower.includes('criteria') || lower.includes('term') || lower.includes('query'))) {
    return { type: 'text', label: 'Search Criteria', placeholder: 'e.g. Trackin Tech' };
  }
  if (lower.includes('provide') || lower.includes('give me') || lower.includes('enter') || lower.includes('type')) {
    return { type: 'text', label: 'Your Input', placeholder: 'Type your response here...' };
  }
  return null;
}

// ─── Main Page ──────────────────────────────────────────────────────────

export default function LiveMissionPage() {
  const [state, setState] = useState<MissionState>({
    phase: 'launch',
    missionId: null,
    status: 'idle',
    conversation: [],
    reasoning: [],
    inputRequest: null,
    isProcessing: false,
    runId: null,
    screenshotUrl: null,
    currentStep: null,
    websiteUrl: null,
    analysis: null,
    results: null,
  });

  const [expandedThinking, setExpandedThinking] = useState<Set<number>>(new Set());
  const [instruction, setInstruction] = useState(INITIAL_INSTRUCTION);
  const [isThinking, setIsThinking] = useState(false);

  const streamRef = useRef<EventSource | null>(null);
  const aiTextBuffer = useRef<string>('');
  const hasAnalyzedRef = useRef(false);
  const executionTriggeredRef = useRef(false);
  const stateRef = useRef(state);
  stateRef.current = state;
  const conversationEndRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    conversationEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [state.conversation]);

  // ─── Gemini Live WebSocket ─────────────────────────────────────────

  const handleTranscript = useCallback((role: 'user' | 'ai', text: string) => {
    console.log(`[Live] Transcript [${role}]:`, text.substring(0, 100));
    if (role === 'ai') {
      aiTextBuffer.current += text + ' ';
      return;
    }
    // User transcript — show immediately
    setState((prev) => ({
      ...prev,
      conversation: [
        ...prev.conversation,
        { role: 'user' as const, content: text, timestamp: new Date() },
      ],
    }));
  }, []);

  const {
    connect,
    disconnect,
    isConnected,
    isAISpeaking,
    isUserSpeaking,
    interimTranscript,
    startMic,
    stopMic,
    forceResponse,
  } = useGeminiLive({
    onTranscript: handleTranscript,
    onConnected: () => {
      console.log('[Live] ✅ WebSocket connected');
      setState((prev) => ({
        ...prev,
        status: 'listening',
        conversation: prev.conversation.some((m) => m.hidden && m.content === 'Hello, I need help with testing')
          ? prev.conversation
          : [
            ...prev.conversation,
            { role: 'user' as const, content: 'Hello, I need help with testing', timestamp: new Date(), hidden: true },
          ],
      }));
    },
    onDisconnected: () => {
      console.log('[Live] WebSocket disconnected');
      setState((prev) => ({ ...prev, status: 'idle' }));
    },
    onError: (error) => {
      console.error('[Live] ❌ Error:', error);
      setState((prev) => ({
        ...prev,
        conversation: [
          ...prev.conversation,
          { role: 'system' as const, content: `⚠️ ${error}`, timestamp: new Date() },
        ],
      }));
    },
    systemInstruction: instruction,
  });

  // Reconnect when instruction updates (after URL analysis injects context)
  useEffect(() => {
    if (isConnected && instruction !== INITIAL_INSTRUCTION) {
      console.log('[Live] 🔄 Instruction updated — reconnecting with new context...');
      disconnect();
      setTimeout(() => connect(), 1000);
    }
  }, [instruction]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-start mic and force AI greeting
  useEffect(() => {
    if (isConnected) {
      const t1 = setTimeout(() => {
        console.log('[Live] ⚡ Forcing AI greeting...');
        forceResponse();
      }, 500);
      const t2 = setTimeout(() => {
        if (!isUserSpeaking && !isAISpeaking) {
          console.log('[Live] 🎙️ Auto-starting mic...');
          startMic();
        }
      }, 1000);
      return () => { clearTimeout(t1); clearTimeout(t2); };
    }
  }, [isConnected, forceResponse]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Flush AI Text Buffer → Add to Conversation ────────────────────

  useEffect(() => {
    const interval = setInterval(() => {
      if (aiTextBuffer.current.trim()) {
        const text = aiTextBuffer.current.trim();
        aiTextBuffer.current = '';
        console.log('[Live] AI text flush:', text.substring(0, 120));

        setState((prev) => ({
          ...prev,
          conversation: [
            ...prev.conversation,
            { role: 'ai' as const, content: text, timestamp: new Date() },
          ],
          // Show input field based on what AI asked for
          inputRequest: detectInputRequest(text) ?? prev.inputRequest,
        }));

        // Detect execution trigger phrase — check accumulated transcript so chunks don't split the phrase
        const resentTranscript = stateRef.current.conversation.slice(-4).map((m) => m.content).join(' ') + ' ' + text;
        if (isReadyPhrase(resentTranscript) && stateRef.current.websiteUrl && !executionTriggeredRef.current) {
          console.log('[Live] ✅ AI ready — triggering test execution pipeline');
          executionTriggeredRef.current = true;
          setState((prev) => ({ ...prev, status: 'planning' }));
        }
      }
    }, 1500);
    return () => clearInterval(interval);
  }, []);

  // ─── AUTO-EXECUTE when status becomes 'planning' ──────────────────

  useEffect(() => {
    if (state.status === 'planning' && state.missionId && state.websiteUrl && !state.isProcessing) {
      console.log('[Live] Status=planning → triggering execution...');
      triggerExecution();
    }
  }, [state.status]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── URL Analysis ─────────────────────────────────────────────────

  const analyzeUrl = useCallback(async (url: string) => {
    console.log('[Live] Analyzing URL:', url);
    setState((prev) => ({
      ...prev,
      phase: 'analyzing',
      isProcessing: true,
      inputRequest: null,
      reasoning: [...prev.reasoning, `🔍 Analyzing ${url}...`],
    }));
    setIsThinking(true);

    try {
      const res = await fetch('/api/analyze-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();

      if (res.ok && data.analysis) {
        console.log('[Live] Analysis result:', data.analysis.description);
        setIsThinking(false);

        setState((prev) => ({
          ...prev,
          phase: 'conversation',
          isProcessing: false,
          screenshotUrl: data.screenshot,
          analysis: data.analysis,
          reasoning: [
            ...prev.reasoning,
            `✅ ${data.analysis.description}`,
            `Flows: ${data.analysis.suggestedFlows.join(', ')}`,
          ],
          // Inject a hidden system turn so the AI has the context
          conversation: [
            ...prev.conversation,
            {
              role: 'user' as const,
              content: 'Please describe this website briefly and list the flows that can be tested, then ask which one I want to test.',
              timestamp: new Date(),
              hidden: true,
            },
          ],
        }));

        // Patch system instruction with website context, then reconnect
        const updatedInstruction = `You are "M.I.N.D.", a professional AI QA engineer in a real-time voice conversation.

WEBSITE CONTEXT (Analysis Complete):
- URL: ${url}
- Description: ${data.analysis.description}
- Testable Flows Found: ${data.analysis.suggestedFlows.join(', ')}

CONVERSATION FLOW:
The user just provided the URL and we have completed the analysis.
1. Start by saying: "I've analyzed the website. It looks like [brief 1-sentence summary based on context above]."
2. Ask: "I found a few testable flows: [list flows]. Which one would you like to test? You can choose one of these or suggest any custom scenario (like searching, form filling, or visual checks)."
3. STRICTLY WAIT FOR THE USER TO REPLY with their chosen flow.
4. Assess the flow the user chose. If it requires ANY specific input data to test properly (like login credentials, search queries, shipping details, or specific button names), ask the user to provide that data. STRICTLY WAIT FOR THE USER TO REPLY with the data.
5. Once you understand the flow and have all necessary data (if any), ask the user to confirm: "I have everything mapped out for [brief description of flow]. Please confirm if I should proceed." STRICTLY WAIT FOR CONFIRMATION.
6. ONLY AFTER THE USER EXPLICITLY CONFIRMS, say exactly: "Starting tests now."

STRICT RULES:
- NEVER say "Starting tests now" until the user has explicitly given you confirmation in Step 5.
- DO NOT answer for the user. Always wait for their reply.
- DO NOT describe the website more than once.
- DO NOT ask for the URL again.
- YOU MUST BE VERSATILE: Accommodate and ask questions for ANY test scenario requested: e.g., form submissions, search queries, specific UI clicks, or complex multi-step navigations.
- English ONLY. Max 2 sentences per turn.`;

        setInstruction(updatedInstruction);

      } else {
        console.error('[Live] Analysis failed:', data.error);
        setIsThinking(false);
        setState((prev) => ({
          ...prev,
          phase: 'conversation',
          isProcessing: false,
          reasoning: [...prev.reasoning, `⚠️ Analysis failed — proceeding with general testing`],
        }));
      }
    } catch (err) {
      console.error('[Live] Analysis error:', err);
      setIsThinking(false);
      setState((prev) => ({
        ...prev,
        phase: 'conversation',
        isProcessing: false,
      }));
    }
  }, []);

  // ─── Launch ────────────────────────────────────────────────────────

  const handleLaunch = useCallback(async () => {
    console.log('[Live] Launching mission...');
    try {
      const res = await fetch('/api/mission', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      executionTriggeredRef.current = false;
      hasAnalyzedRef.current = false;
      setState((prev) => ({
        ...prev,
        phase: 'conversation',
        missionId: data.missionId,
        status: 'idle',
        conversation: [
          { role: 'system' as const, content: '🔌 Connecting to Gemini Live...', timestamp: new Date() },
        ],
      }));
      await connect();
    } catch (err) {
      console.error('[Live] Launch error:', err);
      throw err;
    }
  }, [connect]);

  // ─── Mic Button ─────────────────────────────────────────────────────

  const handleSpeak = useCallback(() => {
    if (isUserSpeaking) stopMic();
    else startMic();
  }, [isUserSpeaking, startMic, stopMic]);

  // ─── Text Input Submit ────────────────────────────────────────────

  const handleInputSubmit = useCallback(
    (value: string) => {
      const s = stateRef.current;
      console.log('[Live] Input submitted:', value.substring(0, 100), '| Label:', s.inputRequest?.label);

      setState((prev) => ({
        ...prev,
        inputRequest: null,
        conversation: [
          ...prev.conversation,
          { role: 'user' as const, content: value, timestamp: new Date() },
        ],
      }));

      // If this is a URL input, start analysis
      if (!s.websiteUrl && (value.startsWith('http') || value.includes('.'))) {
        const url = value.startsWith('http') ? value : `https://${value}`;
        setState((prev) => ({ ...prev, websiteUrl: url }));
        if (!hasAnalyzedRef.current) {
          hasAnalyzedRef.current = true;
          analyzeUrl(url);
        }
        return;
      }

      // Otherwise inject the typed text into the AI's context so it responds
      setInstruction((prev) => {
        const base = prev.split('\n--- USER TYPED ---')[0];
        return `${base}\n\n--- USER TYPED ---\n[SYSTEM]: The user just typed: "${value}". Acknowledge this input immediately and continue the conversation.`;
      });
    },
    [analyzeUrl]
  );

  // ─── Trigger Execution Pipeline ────────────────────────────────────

  const triggerExecution = useCallback(async () => {
    const s = stateRef.current;
    if (!s.missionId || !s.websiteUrl) {
      console.error('[Live] Cannot execute — missing missionId or URL');
      return;
    }

    console.log('[Live] 🚀 TRIGGERING EXECUTION PIPELINE');
    disconnect();

    setState((prev) => ({
      ...prev,
      phase: 'execution',
      status: 'executing',
      isProcessing: true,
      inputRequest: null,
      conversation: [
        ...prev.conversation,
        {
          role: 'system' as const,
          content: '🚀 Starting automated test execution...',
          timestamp: new Date(),
        },
      ],
      reasoning: [
        '🧠 Analysing conversation for requirements...',
        '📋 Generating test plan...',
        '🖥️ Launching browser...',
      ],
    }));

    try {
      // Save conversation transcript to mission (for analyserAgent)
      const transcript = s.conversation
        .filter((m) => !m.hidden)
        .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
        .join('\n');

      await fetch(`/api/mission/${s.missionId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: `[TRANSCRIPT] ${transcript}`,
          requirements: {
            website_url: s.websiteUrl,
            workflows: s.analysis?.suggestedFlows || ['General page test'],
            credentials_required: transcript.toLowerCase().includes('password'),
            conversation_transcript: transcript,
            test_depth: 'standard' as const,
            expected_outputs: ['screenshots', 'video', 'test_report'],
          },
        }),
      });

      // Execute — the execute route will call analyserAgent to extract full details
      const res = await fetch(`/api/mission/${s.missionId}/execute`, { method: 'POST' });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || 'Execution failed');

      if (data.runId) {
        setState((prev) => ({
          ...prev,
          runId: data.runId,
          isProcessing: false,
          reasoning: [
            ...prev.reasoning,
            `✅ Test plan ready: ${(data.plan?.testCases?.length || data.plan?.steps?.length || 0)} cases`,
            '🧪 Running test cases...',
          ],
        }));
        startProgressStream(s.missionId);
      }
    } catch (err) {
      console.error('[Live] ❌ Execute error:', err);
      const msg = err instanceof Error ? err.message : 'Execution error';
      setState((prev) => ({
        ...prev,
        status: 'error',
        isProcessing: false,
        reasoning: [...prev.reasoning, `❌ ${msg}`],
      }));
    }
  }, [disconnect]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── SSE Progress Stream ──────────────────────────────────────────

  const startProgressStream = useCallback((missionId: string) => {
    if (streamRef.current) streamRef.current.close();
    const es = new EventSource(`/api/mission/${missionId}/stream`);
    streamRef.current = es;

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        switch (data.type) {
          case 'status':
            setState((prev) => ({
              ...prev,
              status: data.status,
              reasoning: data.reasoning || prev.reasoning,
            }));
            break;
          case 'screenshot':
            setState((prev) => ({
              ...prev,
              screenshotUrl: data.url,
              currentStep: data.step || prev.currentStep,
            }));
            break;
          case 'progress':
            setState((prev) => ({
              ...prev,
              currentStep: `Running test ${data.testCases} (${data.totalSteps} steps)`,
            }));
            break;
          case 'completed':
            setState((prev) => ({
              ...prev,
              phase: 'results',
              status: 'completed',
              results: {
                totalTests: Array.isArray(data.testCases) ? data.testCases.length : data.testCases || 0,
                passed: Array.isArray(data.testCases)
                  ? data.testCases.filter((c: { status: string }) => c.status === 'passed').length
                  : (data.runStatus === 'passed' ? data.testCases : 0),
                failed: Array.isArray(data.testCases)
                  ? data.testCases.filter((c: { status: string }) => c.status !== 'passed').length
                  : (data.runStatus === 'failed' ? data.testCases : 0),
                coverage: data.runStatus === 'passed' ? 100 : Math.round(
                  (Array.isArray(data.testCases)
                    ? data.testCases.filter((c: { status: string }) => c.status === 'passed').length
                    : 0) / Math.max(1, Array.isArray(data.testCases) ? data.testCases.length : 1) * 100
                ),
                aiSummary: data.aiSummary,
                videoUrl: stateRef.current.runId ? `/api/test/${stateRef.current.runId}/video` : null,
                testCases: Array.isArray(data.testCases)
                  ? data.testCases.map((c: { name: string; status: string; stepsCount?: number }) => ({
                    name: c.name,
                    status: c.status,
                    stepsCount: c.stepsCount || 0,
                  }))
                  : [],
              },
            }));
            es.close();
            break;
          case 'error':
            setState((prev) => ({
              ...prev,
              status: 'error',
              reasoning: [...prev.reasoning, `❌ Test error`],
            }));
            es.close();
            break;
        }
      } catch { /* ignore parse errors */ }
    };
    es.onerror = () => es.close();
  }, []);

  // Cleanup
  useEffect(() => {
    return () => {
      streamRef.current?.close();
      disconnect();
    };
  }, [disconnect]);

  // ─── Restart ──────────────────────────────────────────────────────

  const handleRestart = useCallback(() => {
    streamRef.current?.close();
    disconnect();
    hasAnalyzedRef.current = false;
    executionTriggeredRef.current = false;
    setState({
      phase: 'launch',
      missionId: null,
      status: 'idle',
      conversation: [],
      reasoning: [],
      inputRequest: null,
      isProcessing: false,
      runId: null,
      screenshotUrl: null,
      currentStep: null,
      websiteUrl: null,
      analysis: null,
      results: null,
    });
    setInstruction(INITIAL_INSTRUCTION);
  }, [disconnect]);

  const toggleThinking = useCallback((idx: number) => {
    setExpandedThinking((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }, []);

  // ─── Render ───────────────────────────────────────────────────────

  if (state.phase === 'launch') {
    return <LaunchScreen onLaunch={handleLaunch} />;
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-[#0a0a0f]">
      <MissionControlHeader status={state.status} isMicOn={isUserSpeaking} onMicToggle={handleSpeak} />

      {/* Live indicator bar */}
      <div className="bg-red-500/10 border-b border-red-500/20 px-4 py-1.5 flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
        <span className="text-[10px] font-bold text-red-400 uppercase tracking-widest">Live — Gemini Native Audio</span>
        {isConnected && <span className="text-[10px] text-green-400 ml-2">● Connected</span>}
        {state.phase === 'analyzing' && (
          <span className="text-[10px] text-yellow-400 ml-2 animate-pulse">🔍 Analyzing URL...</span>
        )}
        {state.phase === 'execution' && (
          <span className="text-[10px] text-blue-400 ml-2 animate-pulse">🧪 Running tests...</span>
        )}
        {isAISpeaking && (
          <span className="text-[10px] text-purple-400 ml-2 animate-pulse">🔊 AI Speaking...</span>
        )}
        <span className="ml-auto text-[10px] text-gray-500">
          {state.websiteUrl && `Testing: ${state.websiteUrl}`}
        </span>
      </div>

      {state.phase === 'results' && state.results ? (
        <div className="flex-1 overflow-hidden">
          <TestResults {...state.results} onRestart={handleRestart} />
        </div>
      ) : (
        <div className="flex-1 flex overflow-hidden">
          {/* Left — Conversation Panel */}
          <div className={`border-r border-white/10 transition-all duration-500 flex flex-col ${state.phase === 'execution' ? 'w-[35%]' : 'w-[50%]'}`}>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {state.conversation.filter((m) => !m.hidden).map((msg, i) => {
                const isAiThinking = msg.role === 'ai' && (
                  msg.content.includes('**') || msg.content.includes('Acquiring') ||
                  msg.content.includes('Initiating') || msg.content.includes('Detecting') ||
                  msg.content.length < 15
                );
                return (
                  <div key={i}>
                    {msg.role === 'system' ? (
                      <div className="text-center text-xs text-gray-500 py-1">{msg.content}</div>
                    ) : msg.role === 'user' ? (
                      <div className="flex justify-end">
                        <div className="bg-blue-600/20 border border-blue-500/30 rounded-xl px-3 py-2 max-w-[80%]">
                          <p className="text-[10px] text-blue-300 font-semibold mb-0.5 uppercase tracking-wider">You</p>
                          <p className="text-sm text-white">{msg.content}</p>
                        </div>
                      </div>
                    ) : isAiThinking ? (
                      <div className="flex justify-start">
                        <div className="bg-gray-800/50 border border-gray-700/30 rounded-xl px-3 py-1.5 max-w-[85%]">
                          <button onClick={() => toggleThinking(i)} className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-300 w-full">
                            <span className="text-[9px]">{expandedThinking.has(i) ? '▼' : '▶'}</span>
                            <span>🧠 M.I.N.D. Thought</span>
                          </button>
                          {expandedThinking.has(i) && (
                            <p className="text-xs text-gray-400 mt-1.5 leading-relaxed">{msg.content}</p>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="flex justify-start">
                        <div className="bg-purple-600/15 border border-purple-500/30 rounded-xl px-3 py-2 max-w-[80%]">
                          <p className="text-[10px] text-purple-300 font-semibold mb-0.5 uppercase tracking-wider">M.I.N.D. AI</p>
                          <p className="text-sm text-white leading-relaxed">{msg.content}</p>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* MIND Thinking indicator */}
              {(isThinking || (isAISpeaking && state.conversation.filter(m => !m.hidden && m.role === 'ai').length === 0)) && (
                <div className="flex justify-start">
                  <div className="bg-purple-600/10 border border-purple-500/20 rounded-xl px-3 py-2">
                    <p className="text-[10px] text-purple-300 font-semibold mb-1 uppercase tracking-wider">M.I.N.D. is Thinking</p>
                    <div className="flex gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              )}

              {/* Execution Log */}
              {state.reasoning.length > 0 && state.phase === 'execution' && (
                <div className="bg-gray-900/50 border border-gray-700/30 rounded-xl p-3 mt-2">
                  <p className="text-[10px] text-gray-400 uppercase tracking-widest mb-2">Execution Log</p>
                  {state.reasoning.map((r, i) => (
                    <p key={i} className="text-xs text-gray-300 py-0.5">{r}</p>
                  ))}
                </div>
              )}
              <div ref={conversationEndRef} />
            </div>

            {/* Interim transcript while user is speaking */}
            {interimTranscript && (
              <div className="border-t border-white/10 px-4 py-2 bg-blue-900/20">
                <p className="text-[10px] text-blue-400 uppercase tracking-widest mb-0.5">You&apos;re saying...</p>
                <p className="text-sm text-blue-200 italic">{interimTranscript}</p>
              </div>
            )}

            {/* Input area */}
            <div className="border-t border-white/10 p-3 space-y-2">
              {/* Dynamic input field based on what AI asked for */}
              {/* {state.inputRequest && (
                <div className="bg-white/5 rounded-lg px-3 py-2 border border-white/10">
                  <p className="text-[10px] text-gray-400 mb-1">{state.inputRequest.label}</p>
                  <form onSubmit={(e) => {
                    e.preventDefault();
                    const input = e.currentTarget.elements.namedItem('dynamicInput') as HTMLInputElement;
                    if (input.value.trim()) { handleInputSubmit(input.value.trim()); input.value = ''; }
                  }} className="flex gap-2">
                    <input
                      name="dynamicInput"
                      type="text"
                      autoFocus
                      placeholder={state.inputRequest.placeholder || 'Type here...'}
                      className="flex-1 bg-transparent text-sm text-white placeholder-gray-500 focus:outline-none"
                    />
                    <button type="submit" className="text-xs px-3 py-1 bg-blue-600 rounded-md text-white hover:bg-blue-500">
                      Send
                    </button>
                  </form>
                </div>
              )} */}

              <div className="flex gap-2 items-center">
                {/* Mic button */}
                <button
                  onClick={handleSpeak}
                  title={isUserSpeaking ? 'Stop Mic' : 'Start Mic'}
                  className={`flex-shrink-0 w-[42px] h-[42px] flex items-center justify-center rounded-lg transition-all ${isUserSpeaking
                    ? 'bg-red-600/20 text-red-500 animate-pulse border border-red-500/50'
                    : 'bg-gray-800 border border-gray-600 text-gray-400 hover:text-white hover:bg-gray-700'
                    }`}
                >
                  {isUserSpeaking ? '🔴' : '🎙️'}
                </button>

                {/* Chat-style text input */}
                <form onSubmit={(e) => {
                  e.preventDefault();
                  const input = e.currentTarget.elements.namedItem('liveInput') as HTMLInputElement;
                  if (input.value.trim()) { handleInputSubmit(input.value.trim()); input.value = ''; }
                }} className="flex-1 flex gap-2">
                  <input
                    name="liveInput"
                    type="text"
                    placeholder="Or type a message..."
                    className="flex-1 bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                  />
                  <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-500 transition-colors">
                    Send
                  </button>
                </form>
              </div>
            </div>
          </div>

          {/* Right — Browser Preview */}
          <div className={`transition-all duration-500 ${state.phase === 'execution' ? 'w-[65%]' : 'w-[50%]'}`}>
            <BrowserPreview
              screenshotUrl={state.screenshotUrl}
              currentStep={state.currentStep}
              confidence={null}
              detectedElements={[]}
              isExecuting={state.phase === 'execution'}
            />
          </div>
        </div>
      )}
    </div>
  );
}
