import { useEffect, useState } from 'react';
import { Dumbbell } from 'lucide-react';

export default function WelcomeScreen({ username, onComplete }) {
  const [stage, setStage] = useState(0);

  useEffect(() => {
    // Stage 0: Initial render (hidden/setup)
    // Stage 1: Fade in logo and bg
    const t1 = setTimeout(() => setStage(1), 100);
    // Stage 2: Slide up welcome text
    const t2 = setTimeout(() => setStage(2), 600);
    // Stage 3: Pulse logo / loading complete
    const t3 = setTimeout(() => setStage(3), 1600);
    // Stage 4: Fade out everything
    const t4 = setTimeout(() => {
      setStage(4);
      setTimeout(onComplete, 500); // 500ms fade out duration
    }, 2500);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
    };
  }, [onComplete]);

  return (
    <div className={`fixed inset-0 z-[200] flex flex-col items-center justify-center bg-app-bg transition-opacity duration-500 ease-in-out ${stage === 4 ? 'opacity-0' : 'opacity-100'}`}>
      {/* Background decorations */}
      <div className={`absolute top-[20%] left-[10%] w-[60%] h-[60%] bg-accent-primary/20 blur-[120px] rounded-full transition-all duration-1000 ${stage >= 1 ? 'scale-150 opacity-100' : 'scale-50 opacity-0'}`} />
      
      <div className={`relative flex flex-col items-center justify-center transition-all duration-700 transform ${stage >= 1 ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'}`}>
        {/* Animated Logo */}
        <div className={`w-20 h-20 rounded-3xl mb-6 flex items-center justify-center shadow-2xl transition-all duration-1000 ${stage >= 3 ? 'scale-110 shadow-[0_0_40px_var(--accent-primary)]' : 'scale-100'} glass-card`} style={{ borderColor: 'var(--accent-primary)' }}>
          <Dumbbell size={40} className="text-text-main" style={{ color: 'var(--accent-primary)' }} />
        </div>
        
        {/* Welcome Text */}
        <div className="text-center overflow-hidden">
          <h2 className={`text-4xl font-black tracking-tighter text-text-main transition-transform duration-700 ease-out transform ${stage >= 2 ? 'translate-y-0' : 'translate-y-[100%]'}`}>
            JEXI
          </h2>
          <p className={`text-lg font-medium mt-2 transition-all duration-700 delay-100 ease-out transform ${stage >= 2 ? 'translate-y-0 opacity-100' : 'translate-y-[100%] opacity-0'}`} style={{ color: 'var(--text-muted)' }}>
            Welcome back, <span className="font-bold text-text-main">{username}</span>
          </p>
        </div>
      </div>
      
      {/* Loading Bar */}
      <div className={`absolute bottom-20 w-48 h-1 bg-card-elevated rounded-full overflow-hidden transition-opacity duration-500 ${stage >= 2 ? 'opacity-100' : 'opacity-0'}`}>
        <div className={`h-full rounded-full transition-all duration-[2000ms] ease-out ${stage >= 3 ? 'w-full' : 'w-[20%]'}`} style={{ background: 'var(--accent-primary)' }} />
      </div>
    </div>
  );
}
