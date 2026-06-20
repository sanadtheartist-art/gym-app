import { useEffect, useState } from 'react';
import { Play, Pause, X, Plus, Minus, SkipForward } from 'lucide-react';

const formatTime = (totalSeconds) => {
  const m = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
  const s = (totalSeconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
};

export default function RestTimerOverlay({ seconds, isActive, sessionTools, onClose }) {
  const [localSeconds, setLocalSeconds] = useState(seconds);
  const [localActive, setLocalActive] = useState(isActive);
  const [initialTime, setInitialTime] = useState(seconds > 0 ? seconds : 90);

  // Sync with props
  useEffect(() => {
    setLocalSeconds(seconds);
    setLocalActive(isActive);
    if (seconds > initialTime) setInitialTime(seconds);
  }, [seconds, isActive, initialTime]);

  // Calculate progress circle (0 to 1)
  const pct = initialTime > 0 ? Math.min(localSeconds / initialTime, 1) : 0;
  const radius = 120;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - pct);

  const adjustTime = (amount) => {
    const newTime = Math.max(0, localSeconds + amount);
    sessionTools?.setRestTime(newTime);
    setInitialTime((prev) => Math.max(prev, newTime));
  };

  const togglePause = () => {
    if (localActive) {
      sessionTools?.pauseRest();
    } else {
      sessionTools?.resumeRest();
    }
  };

  const skipTimer = () => {
    sessionTools?.resetRest();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-app-bg/95 backdrop-blur-2xl animate-fade-in px-6">
      
      {/* Top Close Button */}
      <button
        type="button"
        onClick={onClose}
        className="absolute top-6 right-6 grid h-12 w-12 place-items-center rounded-full bg-card-elevated text-text-muted transition active:scale-90 hover:text-text-main"
      >
        <X size={24} />
      </button>

      <div className="text-center mb-12 animate-fade-up">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-accent-lime mb-2">Rest Timer</p>
        <h2 className="text-2xl font-bold text-text-main">Recover &amp; Breathe</h2>
      </div>

      {/* Big Circular Timer */}
      <div className="relative flex items-center justify-center mb-16 animate-fade-in" style={{ animationDelay: '0.05s' }}>
        <svg width="280" height="280" viewBox="0 0 280 280">
          {/* Background circle */}
          <circle
            cx="140" cy="140" r={radius}
            fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="8"
          />
          {/* Progress circle */}
          <circle
            cx="140" cy="140" r={radius}
            fill="none"
            stroke={localSeconds > 10 ? '#C8FF00' : '#FF4D4D'}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            transform="rotate(-90 140 140)"
            className="transition-all duration-1000 ease-linear"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className={`text-7xl font-black tabular-nums leading-none -translate-y-1 ${localSeconds <= 10 && localSeconds > 0 ? 'text-quiet-red animate-pulse' : 'text-text-main'}`}>
            {formatTime(localSeconds)}
          </span>
          <span className="text-sm font-medium text-text-muted mt-2">remaining</span>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-6 animate-fade-up" style={{ animationDelay: '0.1s' }}>
        <button
          type="button"
          onClick={() => adjustTime(-15)}
          className="grid h-16 w-16 place-items-center rounded-2xl glass-card text-text-main transition active:scale-90 hover:border-white/20"
        >
          <span className="flex flex-col items-center text-xs font-bold text-text-muted mb-1">-15s</span>
        </button>

        <button
          type="button"
          onClick={togglePause}
          className={`grid h-20 w-20 place-items-center rounded-3xl transition active:scale-90 shadow-lg ${
            localActive 
              ? 'bg-card-elevated text-text-main border border-glass-border' 
              : 'bg-accent-lime text-app-bg shadow-glow-lime border border-transparent'
          }`}
        >
          {localActive ? <Pause size={32} /> : <Play size={32} className="ml-1" />}
        </button>

        <button
          type="button"
          onClick={() => adjustTime(15)}
          className="grid h-16 w-16 place-items-center rounded-2xl glass-card text-text-main transition active:scale-90 hover:border-white/20"
        >
          <span className="flex flex-col items-center text-xs font-bold text-text-muted mb-1">+15s</span>
        </button>
      </div>

      <button
        type="button"
        onClick={skipTimer}
        className="mt-12 flex items-center gap-2 rounded-full px-6 py-3 text-sm font-bold text-text-muted transition hover:bg-white/5 active:scale-95 animate-fade-up"
        style={{ animationDelay: '0.2s' }}
      >
        <SkipForward size={18} />
        Skip Rest
      </button>

    </div>
  );
}
