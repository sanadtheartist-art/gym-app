import { useEffect, useState } from 'react';
import { Trash2, RotateCcw, Search, Dumbbell } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { loadWorkouts, cacheData, queueSyncAction } from '../lib/offlineSync';
import { playTapSound } from '../lib/sounds';
import CountdownAction from './CountdownAction';
export default function HistoryLog({ refreshKey, onChanged, onRepeatWorkout }) {
  const [workouts, setWorkouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedLogId, setExpandedLogId] = useState('');
  const [deletingWorkoutId, setDeletingWorkoutId] = useState('');
  const [deleteCountdown, setDeleteCountdown] = useState(0);

  useEffect(() => {
    let isMounted = true;

    async function loadHistory() {
      setLoading(true);
      const data = await loadWorkouts();
      if (isMounted) {
        setWorkouts(data || []);
        setLoading(false);
      }
    }

    loadHistory();
    return () => {
      isMounted = false;
    };
  }, [refreshKey]);

  useEffect(() => {
    let timer;

    if (deletingWorkoutId && deleteCountdown > 0) {
      timer = setTimeout(() => setDeleteCountdown((count) => count - 1), 1000);
    } else if (deletingWorkoutId && deleteCountdown === 0) {
      handleDelete(deletingWorkoutId);
      setDeletingWorkoutId('');
    }

    return () => clearTimeout(timer);
  }, [deletingWorkoutId, deleteCountdown]);

  const handleDelete = async (id) => {
    // Optimistic Update
    const updatedWorkouts = workouts.filter((w) => w.id !== id);
    setWorkouts(updatedWorkouts);
    cacheData('workouts', updatedWorkouts).catch(console.error);

    if (navigator.onLine) {
      const { error } = await supabase.from('workouts').delete().eq('id', id);
      if (error) {
        console.error('Error deleting workout:', error);
        // Rollback if needed
        setWorkouts(workouts);
        cacheData('workouts', workouts).catch(console.error);
      } else {
        if (onChanged) onChanged();
      }
    } else {
      await queueSyncAction('delete', 'workouts', { id });
      if (onChanged) onChanged();
    }
  };


  const filteredWorkouts = workouts.filter(workout => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      (workout.exercise_name || '').toLowerCase().includes(q) ||
      (workout.muscle_group || '').toLowerCase().includes(q)
    );
  });

  return (
    <section className="mx-auto w-full max-w-3xl px-4 pb-28 pt-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-text-muted">History</p>
          <h1 className="mt-0.5 text-3xl font-extrabold text-text-main">Logbook</h1>
        </div>
        <div className="grid h-11 w-11 place-items-center rounded-xl glass-card text-accent-lime">
          <Dumbbell size={20} />
        </div>
      </div>

      <div className="mt-6 relative">
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-text-muted">
          <Search size={18} />
        </div>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search exercise or muscle..."
          className="h-14 w-full rounded-2xl glass-card pl-11 pr-4 text-sm font-medium text-text-main outline-none focus:border-accent-lime transition-colors"
        />
      </div>

      <div className="mt-6 space-y-3 stagger-children">
        {loading ? (
          <div className="rounded-card glass-card p-8 text-center text-text-muted shimmer-bg">Loading logbook...</div>
        ) : filteredWorkouts.length === 0 ? (
          <div className="rounded-card glass-card p-8 text-center text-text-muted">
            <p className="font-bold text-text-main mb-1">No workouts found</p>
            <p className="text-sm">Log a set to see it here.</p>
          </div>
        ) : (
          filteredWorkouts.map((workout) => {
            const isExpanded = expandedLogId === workout.id;
            
            return (
              <div 
                key={workout.id} 
                className="group flex flex-col rounded-card glass-card relative overflow-hidden transition-all duration-300 cursor-pointer hover:bg-white/5"
                onClick={() => {
                  playTapSound();
                  setExpandedLogId(isExpanded ? '' : workout.id);
                }}
              >
                <div className={`flex items-start justify-between gap-3 p-5 ${isExpanded ? 'bg-white/5 pb-3 border-b border-glass-border' : ''}`}>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-lg font-extrabold text-text-main">{workout.exercise_name}</p>
                    <div className="mt-1.5 flex items-center gap-2.5">
                      {workout.media_url && (
                        <div 
                          className="h-8 w-8 shrink-0 overflow-hidden rounded border-[1.5px] bg-transparent shadow-sm"
                          style={{ borderColor: 'var(--accent-primary)' }}
                        >
                          {workout.media_url.match(/\.(mp4|webm|ogg)$/i) ? (
                            <video src={workout.media_url} className="h-full w-full object-cover mix-blend-luminosity opacity-80" />
                          ) : (
                            <img src={workout.media_url} alt="Workout Media" className="h-full w-full object-cover mix-blend-luminosity opacity-80" />
                          )}
                        </div>
                      )}
                      <p className="text-xs font-medium text-text-muted">
                        {new Date(workout.timestamp).toLocaleDateString(undefined, {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit'
                        })}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex gap-2 shrink-0 items-center">
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); onRepeatWorkout?.(workout); }}
                      className="grid h-10 w-10 place-items-center rounded-lg bg-card-elevated text-text-main transition active:scale-95 hover:bg-white/10 hover:text-accent-lime"
                      aria-label="Repeat workout"
                    >
                      <RotateCcw size={16} />
                    </button>
                    {deletingWorkoutId === workout.id ? (
                      <div onClick={(e) => e.stopPropagation()}>
                        <CountdownAction
                          label="Deleting"
                          countdown={deleteCountdown}
                          onCancel={() => {
                            setDeletingWorkoutId('');
                            setDeleteCountdown(0);
                          }}
                          compact
                        />
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeletingWorkoutId(workout.id);
                          setDeleteCountdown(3);
                        }}
                        className="grid h-10 w-10 place-items-center rounded-lg bg-card-elevated text-text-muted transition active:scale-95 hover:bg-white/10 hover:text-text-main"
                        aria-label="Delete workout"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </div>

                {isExpanded && (
                  <div className="p-5 pt-4 flex flex-col gap-3">
                    {workout.sets_data && workout.sets_data.length > 0 ? (
                      <div className="grid gap-1.5">
                        {workout.sets_data.map((set, i) => {
                          const typeColors = 
                            set.type === 'W' ? 'text-accent-orange bg-accent-orange/10' : 
                            set.type === 'D' ? 'text-accent-lime bg-accent-lime/10' : 
                            set.type === 'F' ? 'text-quiet-red bg-quiet-red/10' : 
                            'text-text-muted bg-card-elevated';
                          
                          return (
                            <div key={i} className="flex justify-between items-center text-sm font-semibold text-text-main bg-app-bg px-3 py-2 rounded-xl border border-glass-border">
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider ${typeColors}`}>
                                {set.type && set.type !== 'N' ? set.type : `SET ${set.set_number || i + 1}`}
                              </span>
                              <span className="flex items-center gap-3 font-mono text-base">
                                <span>{set.reps} &times; {set.weight} <span className="text-[10px] text-text-muted font-sans font-bold">{workout.input_unit || 'KG'}</span></span>
                                {set.rpe && <span className="text-[10px] font-sans font-bold text-text-muted bg-card-elevated px-1.5 py-0.5 rounded">RPE {set.rpe}</span>}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="inline-block font-mono text-base font-bold text-text-main bg-app-bg px-4 py-2 rounded-xl border border-glass-border w-fit">
                        {workout.sets} &times; {workout.reps} @ {workout.weight_kg} kg
                      </div>
                    )}
                    
                    {workout.custom_notes ? (
                      <div className="rounded-xl bg-card-elevated/50 px-4 py-3 border-l-2 border-accent-lime">
                        <p className="text-xs font-medium leading-relaxed text-text-muted italic">
                          &ldquo;{workout.custom_notes}&rdquo;
                        </p>
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
