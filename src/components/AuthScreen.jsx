import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Dumbbell, Mail, Lock, ArrowRight, Loader2, Sparkles } from 'lucide-react';

export default function AuthScreen({ onAuthSuccess }) {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showWelcome, setShowWelcome] = useState(false);
  const [phase, setPhase] = useState('idle');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setShowWelcome(false);

    try {
      const formattedEmail = `${username.trim().toLowerCase()}@jexi.app`;
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email: formattedEmail, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({ email: formattedEmail, password });
        if (error) throw error;
      }
      setShowWelcome(true);
      setPhase('loading');
      setTimeout(() => {
        setPhase('ready');
        onAuthSuccess?.();
      }, 1600);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const label = useMemo(() => {
    const clean = username.trim() || 'athlete';
    return clean.toLowerCase();
  }, [username]);

  useEffect(() => {
    if (!showWelcome) return;
    const id = window.setTimeout(() => setPhase('ready'), 1400);
    return () => window.clearTimeout(id);
  }, [showWelcome]);

  return (
    <div className="min-h-screen bg-app-bg text-text-main flex flex-col items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(124,156,255,0.16),transparent_18%),radial-gradient(circle_at_bottom,rgba(255,122,89,0.12),transparent_20%)]" />
      <div className="absolute top-[-8%] left-[-10%] w-[42%] h-[42%] bg-accent-lime/10 blur-[120px] rounded-full" />
      <div className="absolute bottom-[-8%] right-[-10%] w-[42%] h-[42%] bg-accent-orange/10 blur-[120px] rounded-full" />

      <div className="relative z-10 w-full max-w-sm">
        {showWelcome ? (
          <div className="glass-card rounded-[2rem] p-8 text-center animate-fade-up overflow-hidden">
            <div className="relative mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-accent-lime via-white/10 to-accent-orange shadow-2xl">
              <div className="absolute inset-0 animate-pulse rounded-3xl bg-white/5" />
              <Dumbbell size={34} className="relative text-app-bg" />
            </div>
            <div className="mb-4 flex justify-center">
              <Sparkles className="text-accent-lime" size={18} />
            </div>
            <h2 className="text-2xl font-black tracking-tight">Welcome back</h2>
            <p className="mt-2 text-sm text-text-muted">{label}</p>
            <div className="mt-6 h-2 w-full overflow-hidden rounded-full bg-white/5">
              <div className={`h-full rounded-full bg-gradient-to-r from-accent-lime to-accent-orange transition-all duration-700 ${phase === 'ready' ? 'w-full' : 'w-1/2'}`} />
            </div>
            <p className="mt-3 text-xs text-text-muted">{phase === 'ready' ? 'You’re in — opening your dashboard.' : 'Preparing your workout space…'}</p>
          </div>
        ) : (
          <div className="glass-card rounded-[2rem] p-8 animate-fade-up">
            <div className="flex justify-center mb-8">
              <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-accent-lime to-accent-orange flex items-center justify-center shadow-2xl">
                <div className="absolute inset-0 rounded-2xl bg-white/10 blur-sm" />
                <Dumbbell size={32} className="relative text-app-bg" />
              </div>
            </div>
            <div className="text-center mb-8">
              <h1 className="text-3xl font-black tracking-tight mb-2">JEXI</h1>
              <p className="text-sm font-medium text-text-muted">
                {isLogin ? 'Welcome back, lifter.' : 'Create your account to start tracking.'}
              </p>
            </div>

            {error && (
              <div className="mb-6 p-4 rounded-xl bg-quiet-red/10 border border-quiet-red/20 text-quiet-red text-sm font-semibold text-center">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted" size={20} />
                <input
                  type="text"
                  required
                  placeholder="Username (e.g. sanad)"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full h-14 pl-12 pr-4 rounded-xl glass-card bg-app-bg text-text-main font-medium placeholder:text-text-muted/50 focus:border-accent-lime outline-none transition"
                />
              </div>

              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted" size={20} />
                <input
                  type="password"
                  required
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full h-14 pl-12 pr-4 rounded-xl glass-card bg-app-bg text-text-main font-medium placeholder:text-text-muted/50 focus:border-accent-lime outline-none transition"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full h-14 mt-4 rounded-xl glass-card-lime text-app-bg font-bold text-lg flex items-center justify-center gap-2 hover:shadow-glow-lime transition active:scale-95 disabled:opacity-70"
              >
                {loading ? <Loader2 className="animate-spin" size={24} /> : (isLogin ? 'Sign In' : 'Create Account')}
                {!loading && <ArrowRight size={20} />}
              </button>
            </form>

            <div className="mt-8 text-center">
              <button
                type="button"
                onClick={() => setIsLogin(!isLogin)}
                className="text-sm font-semibold text-text-muted hover:text-text-main transition"
              >
                {isLogin ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
