import { useEffect, useState } from 'react';
import { Dumbbell } from 'lucide-react';

export default function WelcomeScreen({ username, onComplete }) {
  const [stage, setStage] = useState(0);

  // CamelCase the username
  const display = username
    ? username.charAt(0).toUpperCase() + username.slice(1)
    : 'Athlete';

  useEffect(() => {
    const t1 = setTimeout(() => setStage(1), 40);    // bg blob + logo fade in
    const t2 = setTimeout(() => setStage(2), 220);   // text slides up
    const t3 = setTimeout(() => setStage(3), 550);   // logo pulses + bar fills
    const t4 = setTimeout(() => {
      setStage(4);
      setTimeout(onComplete, 280);
    }, 1150);

    return () => [t1, t2, t3, t4].forEach(clearTimeout);
  }, [onComplete]);

  return (
    <div
      className={`fixed inset-0 z-[200] flex flex-col items-center justify-center overflow-hidden bg-app-bg transition-opacity duration-300 ease-in-out ${
        stage === 4 ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      {/* Ambient glow blobs */}
      <div
        className={`absolute top-[-10%] left-[-20%] h-[50vh] w-[70vw] rounded-full blur-[100px] transition-all duration-700 ease-out ${
          stage >= 1 ? 'opacity-30 scale-110' : 'opacity-0 scale-75'
        }`}
        style={{ background: 'var(--accent-primary)' }}
      />
      <div
        className={`absolute bottom-[-5%] right-[-10%] h-[35vh] w-[50vw] rounded-full blur-[120px] transition-all duration-700 delay-100 ease-out ${
          stage >= 1 ? 'opacity-20 scale-110' : 'opacity-0 scale-75'
        }`}
        style={{ background: 'var(--accent-secondary)' }}
      />

      {/* Main content */}
      <div
        className={`relative flex flex-col items-center justify-center transition-all duration-350 ease-out ${
          stage >= 1 ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0'
        }`}
      >
        {/* Logo badge */}
        <div
          className={`mb-7 flex h-24 w-24 items-center justify-center rounded-[28px] shadow-2xl transition-all duration-400 ${
            stage >= 3
              ? 'scale-110'
              : 'scale-100'
          }`}
          style={{
            background: 'var(--card-bg)',
            border: '2px solid var(--accent-primary)',
            boxShadow: stage >= 3
              ? '0 0 50px var(--accent-primary), 0 0 80px color-mix(in srgb, var(--accent-primary) 30%, transparent)'
              : '0 20px 60px rgba(0,0,0,0.5)',
          }}
        >
          <Dumbbell size={46} style={{ color: 'var(--accent-primary)' }} strokeWidth={1.75} />
        </div>

        {/* Text group */}
        <div className="text-center overflow-hidden">
          <h1
            className={`text-5xl font-black tracking-tighter text-text-main transition-all duration-350 ease-out ${
              stage >= 2 ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0'
            }`}
          >
            JEXI
          </h1>
          <div
            className={`mt-2.5 transition-all duration-350 delay-75 ease-out ${
              stage >= 2 ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
            }`}
          >
            <span className="text-base font-medium" style={{ color: 'var(--text-muted)' }}>
              Welcome back,{' '}
            </span>
            <span
              className="text-base font-black"
              style={{
                background: 'var(--greeting-gradient)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              {display}
            </span>
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div
        className={`absolute bottom-16 w-44 overflow-hidden rounded-full transition-opacity duration-300 ${
          stage >= 2 ? 'opacity-100' : 'opacity-0'
        }`}
        style={{ height: 3, background: 'var(--card-elevated)' }}
      >
        <div
          className="h-full rounded-full transition-all duration-700 ease-out"
          style={{
            width: stage >= 3 ? '100%' : '15%',
            background: 'var(--accent-primary)',
          }}
        />
      </div>
    </div>
  );
}
