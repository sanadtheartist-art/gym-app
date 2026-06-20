import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Dumbbell, Mail, Lock, ArrowRight, Loader2 } from 'lucide-react';

export default function AuthScreen({ onAuthSuccess }) {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Append a fake domain so Supabase accepts it as an "email"
      const formattedEmail = `${username.trim().toLowerCase()}@jexi.app`;

      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email: formattedEmail, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({ email: formattedEmail, password });
        if (error) throw error;
      }
      onAuthSuccess?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-app-bg text-text-main flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Background decorations */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-accent-lime/10 blur-[100px] rounded-full" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-accent-orange/10 blur-[100px] rounded-full" />
      
      <div className="w-full max-w-sm glass-card rounded-[2rem] p-8 relative z-10 animate-fade-up">
        <div className="flex justify-center mb-8">
          <div className="w-16 h-16 rounded-2xl glass-card-lime flex items-center justify-center shadow-glow-lime">
            <Dumbbell size={32} className="text-app-bg" />
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
    </div>
  );
}
