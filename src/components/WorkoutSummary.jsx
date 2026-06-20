import { useEffect, useState } from 'react';
import { Trophy, Dumbbell, Timer, Flame, CheckCircle, Share } from 'lucide-react';
import { supabase } from '../lib/supabase';

export default function WorkoutSummary({ data, onClose }) {
  const [prBroken, setPrBroken] = useState(false);
  const [animating, setAnimating] = useState(false);

  useEffect(() => {
    // Check if this workout broke a PR
    async function checkPR() {
      if (!data || !data.exercise_name) return;
      
      const { data: previousWorkouts } = await supabase
        .from('workouts')
        .select('weight_kg, reps, sets_data')
        .eq('exercise_name', data.exercise_name)
        .lt('timestamp', data.timestamp)
        .order('timestamp', { ascending: false });

      if (!previousWorkouts || previousWorkouts.length === 0) {
        setPrBroken(true); // First time = PR!
        return;
      }

      let max1RMBefore = 0;
      previousWorkouts.forEach(w => {
        if (w.sets_data && w.sets_data.length > 0) {
          w.sets_data.forEach(s => {
            if (s.type === 'W') return;
            const e1rm = (s.weight_kg || s.weight || 0) * (1 + (s.reps || 0) / 30);
            if (e1rm > max1RMBefore) max1RMBefore = e1rm;
          });
        } else {
          const e1rm = (w.weight_kg || 0) * (1 + (w.reps || 0) / 30);
          if (e1rm > max1RMBefore) max1RMBefore = e1rm;
        }
      });

      let current1RM = 0;
      if (data.sets_data && data.sets_data.length > 0) {
        data.sets_data.forEach(s => {
          if (s.type === 'W') return;
          const e1rm = (s.weight_kg || s.weight || 0) * (1 + (s.reps || 0) / 30);
          if (e1rm > current1RM) current1RM = e1rm;
        });
      } else {
        current1RM = (data.weight_kg || 0) * (1 + (data.reps || 0) / 30);
      }

      if (current1RM > max1RMBefore) {
        setPrBroken(true);
      }
    }

    checkPR();
    
    // Trigger entrance animations
    setTimeout(() => setAnimating(true), 100);
  }, [data]);

  if (!data) return null;

  let totalVolume = 0;
  let totalSets = 0;
  let maxWeight = 0;

  if (data.sets_data && data.sets_data.length > 0) {
    data.sets_data.forEach(s => {
      if (s.type !== 'W') {
        const w = s.weight_kg || s.weight || 0;
        const r = s.reps || 0;
        totalVolume += w * r;
        totalSets += 1;
        if (w > maxWeight) maxWeight = w;
      }
    });
  } else {
    totalSets = data.sets || 0;
    maxWeight = data.weight_kg || 0;
    totalVolume = totalSets * (data.reps || 0) * maxWeight;
  }

  const durationMin = Math.round((data.session_duration_seconds || 0) / 60);

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/80 backdrop-blur-md p-4 pb-12 sm:items-center animate-fade-in">
      <div className={`w-full max-w-sm rounded-[32px] glass-card overflow-hidden shadow-2xl transition-all duration-700 ${animating ? 'translate-y-0 opacity-100' : 'translate-y-12 opacity-0'}`}>
        
        {/* Header Graphic */}
        <div 
          className={`relative h-40 flex items-center justify-center overflow-hidden bg-cover bg-center ${prBroken ? 'bg-accent-orange' : 'bg-accent-lime'}`}
          style={data.media_url && !data.media_url.match(/\.(mp4|webm|ogg)$/i) ? { backgroundImage: `url(${data.media_url})` } : {}}
        >
          <div className="absolute inset-0 bg-black/40" />
          <div className="absolute -left-10 -top-10 h-32 w-32 rounded-full bg-white/20 blur-2xl" />
          <div className="absolute -right-10 -bottom-10 h-32 w-32 rounded-full bg-black/60 blur-2xl" />
          
          <div className="relative z-10 flex flex-col items-center text-app-bg drop-shadow-[0_4px_4px_rgba(0,0,0,0.8)]">
            {prBroken ? (
              <Trophy size={48} className="drop-shadow-lg mb-2" />
            ) : (
              <CheckCircle size={48} className="drop-shadow-lg mb-2" />
            )}
            <h2 className="text-xl font-black tracking-tight uppercase">
              {prBroken ? 'New Record!' : 'Workout Complete'}
            </h2>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="text-center mb-6">
            <h3 className="text-2xl font-extrabold text-text-main">{data.exercise_name}</h3>
            <p className="text-sm font-medium text-text-muted mt-1">{data.muscle_group}</p>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-6">
            <div className="rounded-2xl bg-app-bg p-4 flex flex-col items-center justify-center border border-glass-border">
              <Dumbbell size={20} className="text-text-muted mb-2" />
              <p className="text-2xl font-extrabold text-text-main font-mono number-animate">{Math.round(totalVolume)}</p>
              <p className="text-[10px] font-bold uppercase tracking-wider text-text-muted">Volume (kg)</p>
            </div>
            <div className="rounded-2xl bg-app-bg p-4 flex flex-col items-center justify-center border border-glass-border">
              <Flame size={20} className="text-accent-orange mb-2" />
              <p className="text-2xl font-extrabold text-text-main font-mono number-animate">{totalSets}</p>
              <p className="text-[10px] font-bold uppercase tracking-wider text-text-muted">Working Sets</p>
            </div>
            <div className="rounded-2xl bg-app-bg p-4 flex flex-col items-center justify-center border border-glass-border">
              <Trophy size={20} className={prBroken ? 'text-accent-lime' : 'text-text-muted'} style={{ marginBottom: '8px' }} />
              <p className="text-2xl font-extrabold text-text-main font-mono number-animate">{maxWeight}</p>
              <p className="text-[10px] font-bold uppercase tracking-wider text-text-muted">Max Wt (kg)</p>
            </div>
            <div className="rounded-2xl bg-app-bg p-4 flex flex-col items-center justify-center border border-glass-border">
              <Timer size={20} className="text-text-muted mb-2" />
              <p className="text-2xl font-extrabold text-text-main font-mono number-animate">{durationMin}</p>
              <p className="text-[10px] font-bold uppercase tracking-wider text-text-muted">Minutes</p>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              className="flex-1 flex items-center justify-center gap-2 h-14 rounded-xl glass-card text-sm font-bold text-text-main transition active:scale-95 hover:bg-white/5"
            >
              <Share size={18} /> Share
            </button>
            <button
              type="button"
              onClick={onClose}
              className={`flex-1 h-14 rounded-xl text-sm font-extrabold text-app-bg transition active:scale-95 shadow-lg ${
                prBroken ? 'bg-accent-orange shadow-glow-orange' : 'bg-accent-lime shadow-glow-lime'
              }`}
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
