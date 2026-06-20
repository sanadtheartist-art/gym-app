import { useEffect, useMemo, useRef, useState } from 'react';
import { Pause, Play, RotateCcw, TimerReset } from 'lucide-react';

const formatDuration = (totalSeconds) => {
  const hours = Math.floor(totalSeconds / 3600).toString().padStart(2, '0');
  const minutes = Math.floor((totalSeconds % 3600) / 60).toString().padStart(2, '0');
  const seconds = Math.floor(totalSeconds % 60).toString().padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
};

export default function ActiveSessionHeader({ onSessionToolsChange, onRestTimerUpdate, onRestTimerClick }) {
  const [isRestActive, setIsRestActive] = useState(false);
  const [restSeconds, setRestSeconds] = useState(0);

  useEffect(() => {
    if (!isRestActive || restSeconds <= 0) {
      if (restSeconds <= 0 && isRestActive) {
        setIsRestActive(false); // Timer finished
      }
      return undefined;
    }

    const interval = window.setInterval(() => {
      setRestSeconds((seconds) => seconds - 1);
    }, 1000);

    return () => window.clearInterval(interval);
  }, [isRestActive, restSeconds]);

  // Notify parent of rest timer state
  useEffect(() => {
    onRestTimerUpdate?.(restSeconds, isRestActive);
  }, [restSeconds, isRestActive, onRestTimerUpdate]);

  const sessionTools = useMemo(() => ({
    getSessionDuration: () => 0,
    getSetDuration: () => 0,
    resetSetTimer: () => {
      setRestSeconds(90);
      setIsRestActive(true);
    },
    setRestTime: (time) => {
      setRestSeconds(time);
      setIsRestActive(true);
    },
    pauseRest: () => setIsRestActive(false),
    resumeRest: () => { if (restSeconds > 0) setIsRestActive(true); },
    resetRest: () => { setRestSeconds(0); setIsRestActive(false); },
    formatDuration,
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), []);

  useEffect(() => {
    onSessionToolsChange?.(sessionTools);
  }, [onSessionToolsChange, sessionTools]);

  const restPct = restSeconds > 0 ? Math.min(restSeconds / 90, 1) : 0;

  return (
    <header className="px-4 pb-3 pt-3 border-b border-glass-border">
      {/* Rest Timer Bar */}
      <button
        type="button"
        onClick={onRestTimerClick}
        className={`mx-auto flex w-full max-w-3xl flex-wrap items-center justify-between gap-3 rounded-card px-3 py-3 sm:px-4 transition-all ${
          restSeconds === 0 && !isRestActive
            ? 'glass-card-dark border-quiet-red/20'
            : 'glass-card'
        }`}
      >
        <div className="flex items-center gap-3">
          {/* Mini progress ring */}
          <div className="relative h-10 w-10 shrink-0">
            <svg width="40" height="40" viewBox="0 0 40 40" className="absolute inset-0">
              <circle cx="20" cy="20" r="16" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="3" />
              <circle
                cx="20" cy="20" r="16" fill="none"
                stroke={restSeconds > 0 ? '#C8FF00' : '#FF4D4D'}
                strokeWidth="3"
                strokeDasharray={2 * Math.PI * 16}
                strokeDashoffset={2 * Math.PI * 16 * (1 - restPct)}
                strokeLinecap="round"
                className="progress-ring-circle"
              />
            </svg>
            <span className="absolute inset-0 grid place-items-center text-[10px] font-bold font-mono text-text-main">
              {restSeconds > 0 ? restSeconds : '—'}
            </span>
          </div>
          <div className="text-left">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-text-muted">Rest Timer</p>
            <p className={`mt-0.5 font-mono text-sm font-bold ${restSeconds === 0 && !isRestActive ? 'text-quiet-red' : 'text-text-main'}`}>
              {formatDuration(restSeconds)}
            </p>
          </div>
        </div>
        
        <div className="flex flex-wrap items-center gap-1 sm:gap-1.5" onClick={(e) => e.stopPropagation()}>
          {[60, 90, 120].map((time) => (
            <button
              key={time}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setRestSeconds(time);
                setIsRestActive(true);
              }}
              className="rounded-lg bg-app-bg px-2.5 py-1.5 text-[11px] font-bold text-text-muted transition active:scale-95 hover:text-text-main"
            >
              {time}s
            </button>
          ))}
          <div className="w-px h-5 bg-glass-border mx-0.5" />
          <button
            type="button"
            aria-label={isRestActive ? 'Pause rest timer' : 'Start rest timer'}
            onClick={(e) => {
              e.stopPropagation();
              setIsRestActive((active) => !active);
            }}
            className="grid h-9 w-9 place-items-center rounded-lg bg-app-bg text-text-main transition active:scale-95"
          >
            {isRestActive ? <Pause size={15} /> : <Play size={15} />}
          </button>
          <button
            type="button"
            aria-label="Reset rest timer"
            onClick={(e) => {
              e.stopPropagation();
              setRestSeconds(0);
              setIsRestActive(false);
            }}
            className="grid h-9 w-9 place-items-center rounded-lg bg-app-bg text-text-muted transition active:scale-95 hover:text-text-main"
          >
            <TimerReset size={15} />
          </button>
        </div>
      </button>
    </header>
  );
}
