'use client';

import type { MissionStatus } from '@/lib/config';

interface Props {
  status: MissionStatus;
  isMicOn: boolean;
  onMicToggle: () => void;
}

const STATUS_LABELS: Record<MissionStatus, string> = {
  idle: 'STANDING BY',
  listening: 'LISTENING',
  planning: 'PLANNING',
  executing: 'EXECUTING',
  verifying: 'VERIFYING',
  completed: 'MISSION COMPLETE',
  error: 'ERROR',
};

const STATUS_COLORS: Record<MissionStatus, string> = {
  idle: 'text-mission-muted',
  listening: 'text-mission-primary',
  planning: 'text-mission-accent',
  executing: 'text-mission-highlight',
  verifying: 'text-mission-warning',
  completed: 'text-mission-success',
  error: 'text-mission-danger',
};

export default function MissionControlHeader({ status, isMicOn, onMicToggle }: Props) {
  return (
    <header className="h-[72px] glass border-b border-mission-border flex items-center justify-between px-6 z-50 relative">
      {/* Left — Logo */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-mission-primary to-mission-accent flex items-center justify-center shadow-lg shadow-mission-primary/20">
          <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </div>
        <div>
          <h1 className="text-sm font-bold text-mission-text font-display tracking-wide">M.I.N.D. AI</h1>
          <p className="text-[10px] text-mission-text-dim uppercase tracking-widest">Autonomous QA Engineer</p>
        </div>
      </div>

      {/* Center — Status */}
      <div className="flex items-center gap-3">
        <span className={`status-dot status-dot-${status}`} />
        <div className="text-center">
          <p className="text-[10px] text-mission-text-dim uppercase tracking-widest">MISSION STATUS</p>
          <p className={`text-sm font-semibold font-display tracking-wider ${STATUS_COLORS[status]}`}>
            {STATUS_LABELS[status]}
          </p>
        </div>
      </div>

      {/* Right — Controls */}
      <div className="flex items-center gap-3">
        <button
          onClick={onMicToggle}
          className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300 ${isMicOn
            ? 'bg-mission-primary/20 text-mission-primary neon-border'
            : 'bg-mission-surface text-mission-muted hover:text-mission-text-dim'
            }`}
          title={isMicOn ? 'Mute' : 'Unmute'}
        >
          {isMicOn ? (
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
              <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zm-4.02.17c0-.06.02-.11.02-.17V5c0-1.66-1.34-3-3-3S9 3.34 9 5v.18l5.98 5.99zM4.27 3L3 4.27l6.01 6.01V11c0 1.66 1.33 3 2.99 3 .22 0 .44-.03.65-.08l1.66 1.66c-.71.33-1.5.52-2.31.52-2.76 0-5.3-2.1-5.3-5.1H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c.91-.13 1.77-.45 2.54-.9L19.73 21 21 19.73 4.27 3z" />
            </svg>
          )}
        </button>
        {/* <button className="w-10 h-10 rounded-xl bg-mission-surface text-mission-muted hover:text-mission-text-dim flex items-center justify-center transition-colors">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button> */}
      </div>
    </header>
  );
}
