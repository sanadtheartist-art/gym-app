import { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, FolderOpen, Play, Plus, Trash2, Edit2, Check, Download } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { getCachedData, cacheData } from '../lib/offlineSync';
import { playTapSound } from '../lib/sounds';
import CountdownAction from './CountdownAction';

export default function SplitsManager({ activeSplit, onLaunchSplit, refreshKey, onChanged }) {
  const [splits, setSplits] = useState([]);
  const [expandedSplitId, setExpandedSplitId] = useState('');
  const [newSplitName, setNewSplitName] = useState('');
  const [newExerciseName, setNewExerciseName] = useState('');
  const [exerciseSuggestions, setExerciseSuggestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');
  
  // For editing split name
  const [editingSplitId, setEditingSplitId] = useState('');
  const [editNameValue, setEditNameValue] = useState('');
  
  // For deleting split
  const [deletingSplitId, setDeletingSplitId] = useState('');
  const [deleteCountdown, setDeleteCountdown] = useState(0);

  useEffect(() => {
    let timer;
    if (deletingSplitId && deleteCountdown > 0) {
      timer = setTimeout(() => setDeleteCountdown(c => c - 1), 1000);
    } else if (deletingSplitId && deleteCountdown === 0) {
      executeDeleteSplit(deletingSplitId);
      setDeletingSplitId('');
    }
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deletingSplitId, deleteCountdown]);

  useEffect(() => {
    let isMounted = true;

    async function loadSplits() {
      setLoading(true);
      
      try {
        const cached = await getCachedData('splits_manager');
        if (cached && isMounted) {
          setSplits(cached.splits || []);
          setExerciseSuggestions(cached.suggestions || []);
          setLoading(false);
        }
      } catch (err) {
        console.error('Cache load error', err);
      }

      if (!navigator.onLine) {
        if (isMounted) setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('splits')
        .select('id, name, created_at, split_exercises(id, exercise_name, display_order)')
        .order('created_at', { ascending: false });

      let normalized = [];
      if (error) {
        setStatus(error.message);
      } else {
        normalized = (data || []).map((split) => ({
          ...split,
          exercises: [...(split.split_exercises || [])].sort((a, b) => a.display_order - b.display_order),
        }));
        if (isMounted) {
          setSplits(normalized);
        }
      }

      const { data: workoutsData } = await supabase
        .from('workouts')
        .select('exercise_name')
        .not('exercise_name', 'is', null)
        .limit(500);

      let distinct = [];
      if (workoutsData) {
        distinct = [...new Set(workoutsData.map((row) => row.exercise_name).filter(Boolean))].sort();
        if (isMounted) setExerciseSuggestions(distinct);
      }

      if (isMounted) {
        setLoading(false);
        cacheData('splits_manager', { splits: normalized, suggestions: distinct }).catch(console.error);
      }
    }

    loadSplits();
    return () => {
      isMounted = false;
    };
  }, [refreshKey]);

  const matchingSuggestions = useMemo(() => {
    const search = newExerciseName.trim().toLowerCase();
    if (!search) return exerciseSuggestions.slice(0, 5);
    return exerciseSuggestions
      .filter((name) => name.toLowerCase().includes(search))
      .slice(0, 5);
  }, [exerciseSuggestions, newExerciseName]);

  const createSplit = async (event) => {
    event.preventDefault();
    const name = newSplitName.trim();
    if (!name) return;

    const tempId = crypto.randomUUID();
    const newSplit = { id: tempId, name, created_at: new Date().toISOString(), exercises: [] };

    setNewSplitName('');
    setExpandedSplitId(tempId);
    
    const updatedSplits = [newSplit, ...splits];
    setSplits(updatedSplits);
    cacheData('splits_manager', { splits: updatedSplits, suggestions: exerciseSuggestions }).catch(console.error);
    onChanged?.();

    if (navigator.onLine) {
      const { error } = await supabase.from('splits').insert({ id: tempId, name });
      if (error) setStatus(error.message);
    } else {
      import('../lib/offlineSync').then(({ queueSyncAction }) => {
        queueSyncAction('insert', 'splits', { id: tempId, name });
      });
    }
  };

  const updateSplitName = async (splitId) => {
    const name = editNameValue.trim();
    if (!name) {
      setEditingSplitId('');
      return;
    }
    
    const updatedSplits = splits.map(s => s.id === splitId ? { ...s, name } : s);
    setSplits(updatedSplits);
    cacheData('splits_manager', { splits: updatedSplits, suggestions: exerciseSuggestions }).catch(console.error);
    setEditingSplitId('');
    onChanged?.();
    
    if (navigator.onLine) {
      const { error } = await supabase.from('splits').update({ name }).eq('id', splitId);
      if (error) setStatus(error.message);
    } else {
      import('../lib/offlineSync').then(({ queueSyncAction }) => {
        queueSyncAction('update', 'splits', { id: splitId, data: { name } });
      });
    }
  };

  const saveTodayAsSplit = async () => {
    setStatus('Saving today as split...');
    
    // Get today's start date
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const { data: workouts } = await supabase
      .from('workouts')
      .select('exercise_name, timestamp')
      .gte('timestamp', today.toISOString())
      .order('timestamp', { ascending: true });
      
    if (!workouts || workouts.length === 0) {
      setStatus('No workouts found today');
      return;
    }
    
    // Get unique exercises
    const uniqueExercises = [...new Set(workouts.map(w => w.exercise_name).filter(Boolean))];
    
    if (uniqueExercises.length === 0) {
      setStatus('No valid exercises found today');
      return;
    }
    
    const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const splitName = `Workout ${dateStr}`;
    
    const { data: split, error: splitError } = await supabase
      .from('splits')
      .insert({ name: splitName })
      .select('id')
      .single();
      
    if (splitError) {
      setStatus(splitError.message);
      return;
    }
    
    const exercises = uniqueExercises.map((ex, i) => ({
      split_id: split.id,
      exercise_name: ex,
      display_order: i
    }));
    
    await supabase.from('split_exercises').insert(exercises);
    
    setStatus('Today saved as a new split!');
    onChanged?.();
  };

  const addExercise = async (event, splitId) => {
    event.preventDefault();
    const split = splits.find(s => s.id === splitId);
    if (!split || !newExerciseName.trim()) return;

    const nextOrder = split.exercises.length;
    const tempId = crypto.randomUUID();
    const newEx = {
      id: tempId,
      split_id: split.id,
      exercise_name: newExerciseName.trim(),
      display_order: nextOrder,
    };

    setNewExerciseName('');
    const updatedSplits = splits.map((s) => s.id === split.id ? { ...s, exercises: [...s.exercises, newEx] } : s);
    setSplits(updatedSplits);
    cacheData('splits_manager', { splits: updatedSplits, suggestions: exerciseSuggestions }).catch(console.error);
    onChanged?.();

    if (navigator.onLine) {
      const { error } = await supabase.from('split_exercises').insert(newEx);
      if (error) setStatus(error.message);
    } else {
      import('../lib/offlineSync').then(({ queueSyncAction }) => {
        queueSyncAction('insert', 'split_exercises', newEx);
      });
    }
  };

  const deleteExercise = async (splitId, exerciseId) => {
    const updatedSplits = splits.map((split) => split.id === splitId ? { ...split, exercises: split.exercises.filter((exercise) => exercise.id !== exerciseId) } : split);
    setSplits(updatedSplits);
    cacheData('splits_manager', { splits: updatedSplits, suggestions: exerciseSuggestions }).catch(console.error);
    onChanged?.();

    if (navigator.onLine) {
      const { error } = await supabase.from('split_exercises').delete().eq('id', exerciseId);
      if (error) setStatus(error.message);
    } else {
      import('../lib/offlineSync').then(({ queueSyncAction }) => {
        queueSyncAction('delete', 'split_exercises', { id: exerciseId });
      });
    }
  };

  const moveExercise = async (splitId, exercise, direction) => {
    const split = splits.find(s => s.id === splitId);
    if (!split) return;
    const currentIndex = split.exercises.findIndex(e => e.id === exercise.id);
    const newIndex = currentIndex + direction;
    
    if (newIndex < 0 || newIndex >= split.exercises.length) return;
    
    const newExercises = [...split.exercises];
    const temp = newExercises[currentIndex];
    newExercises[currentIndex] = newExercises[newIndex];
    newExercises[newIndex] = temp;
    
    const updatedSplits = splits.map(s => s.id === splitId ? { ...s, exercises: newExercises } : s);
    setSplits(updatedSplits);
    cacheData('splits_manager', { splits: updatedSplits, suggestions: exerciseSuggestions }).catch(console.error);
    
    const updates = [
      { id: newExercises[currentIndex].id, display_order: currentIndex },
      { id: newExercises[newIndex].id, display_order: newIndex }
    ];
    
    if (navigator.onLine) {
      for (const update of updates) {
        await supabase.from('split_exercises').update({ display_order: update.display_order }).eq('id', update.id);
      }
    } else {
      import('../lib/offlineSync').then(({ queueSyncAction }) => {
        for (const update of updates) {
          queueSyncAction('update', 'split_exercises', { id: update.id, data: { display_order: update.display_order } });
        }
      });
    }
  };

  const executeDeleteSplit = async (splitId) => {
    const updatedSplits = splits.filter((split) => split.id !== splitId);
    setSplits(updatedSplits);
    if (expandedSplitId === splitId) setExpandedSplitId('');
    cacheData('splits_manager', { splits: updatedSplits, suggestions: exerciseSuggestions }).catch(console.error);
    onChanged?.();

    if (navigator.onLine) {
      const { error } = await supabase.from('splits').delete().eq('id', splitId);
      if (error) setStatus(error.message);
    } else {
      import('../lib/offlineSync').then(({ queueSyncAction }) => {
        queueSyncAction('delete', 'splits', { id: splitId });
      });
    }
  };

  const loadTemplates = async () => {
    setStatus('Loading templates...');
    const templates = [
      { name: 'Push Day (Hypertrophy)', exercises: ['Flat Barbell Bench Press', 'Incline Dumbbell Press', 'Seated Dumbbell Shoulder Press', 'Cable Lateral Raises', 'Dips', 'Tricep Rope Pushdowns', 'Overhead Cable Tricep Extension'] },
      { name: 'Pull Day (Hypertrophy)', exercises: ['Pull-ups', 'Barbell Rows', 'Seated Cable Rows', 'Face Pulls', 'Incline Dumbbell Curls', 'Hammer Curls', 'Rear Delt Flyes'] },
      { name: 'Leg Day (Hypertrophy)', exercises: ['Barbell Back Squats', 'Romanian Deadlifts', 'Bulgarian Split Squats', 'Leg Press', 'Lying Leg Curls', 'Standing Calf Raises', 'Seated Calf Raises'] },
      { name: 'Upper Body (Strength)', exercises: ['Barbell Bench Press', 'Weighted Pull-ups', 'Overhead Press', 'Barbell Rows', 'Close-Grip Bench Press', 'Barbell Curls'] },
      { name: 'Lower Body (Strength)', exercises: ['Barbell Back Squats', 'Conventional Deadlifts', 'Front Squats', 'Walking Lunges', 'Hanging Leg Raises', 'Standing Calf Raises'] },
      { name: 'Full Body A (Beginner - Squat Focus)', exercises: ['Barbell Squats', 'Bench Press', 'Bent-Over Rows', 'Overhead Press', 'Bicep Curls', 'Plank'] },
      { name: 'Full Body B (Beginner - Deadlift Focus)', exercises: ['Deadlifts', 'Incline Bench Press', 'Lat Pulldowns', 'Dumbbell Lunges', 'Lateral Raises', 'Cable Crunches'] },
      { name: 'Chest & Triceps (Bro Split)', exercises: ['Flat Barbell Bench Press', 'Incline Dumbbell Press', 'Cable Crossovers', 'Dumbbell Flyes', 'Tricep Dips', 'Overhead Tricep Extension', 'Tricep Pushdowns'] },
      { name: 'Back & Biceps (Bro Split)', exercises: ['Deadlifts', 'Pull-ups', 'T-Bar Rows', 'Single-Arm Dumbbell Row', 'Barbell Curls', 'Preacher Curls', 'Hammer Curls'] },
      { name: 'Glutes & Hamstrings (Posterior Chain Focus)', exercises: ['Romanian Deadlifts', 'Hip Thrusts', 'Bulgarian Split Squats', 'Cable Pull-Throughs', 'Lying Leg Curls', 'Glute Kickbacks', 'Standing Calf Raises'] }
    ];

    const { data: existingSplits } = await supabase.from('splits').select('name');
    const existingNames = new Set((existingSplits || []).map(s => s.name));

    let addedCount = 0;
    for (const t of templates) {
      if (existingNames.has(t.name)) continue;
      
      const { data: split, error: splitError } = await supabase
        .from('splits')
        .insert({ name: t.name })
        .select('id')
        .single();
      
      if (split) {
        const exercises = t.exercises.map((ex, i) => ({
          split_id: split.id,
          exercise_name: ex,
          display_order: i
        }));
        await supabase.from('split_exercises').insert(exercises);
        addedCount++;
      }
    }
    
    setStatus(addedCount > 0 ? `Loaded ${addedCount} new templates!` : 'All templates already loaded.');
    onChanged?.();
  };

  return (
    <section className="mx-auto w-full max-w-3xl px-4 pb-28 pt-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-text-muted">Routines</p>
          <h1 className="mt-0.5 text-3xl font-extrabold text-text-main">Splits</h1>
        </div>
        <div className="flex items-center gap-2">
          <button 
            type="button" 
            onClick={saveTodayAsSplit} 
            className="h-11 px-3 text-[11px] font-bold bg-card-elevated text-text-muted rounded-xl hover:text-accent-lime transition active:scale-95 flex items-center gap-1.5"
          >
            <Download size={14} /> Today
          </button>
          <button 
            type="button" 
            onClick={loadTemplates} 
            className="h-11 px-3 text-[11px] font-bold bg-card-elevated text-text-muted rounded-xl hover:text-text-main transition active:scale-95"
          >
            Load Templates
          </button>
        </div>
      </div>

      <form onSubmit={createSplit} className="mt-6 flex gap-2">
        <input
          value={newSplitName}
          onChange={(event) => setNewSplitName(event.target.value)}
          placeholder="New routine (e.g. Pull Day)"
          className="h-14 min-w-0 flex-1 rounded-2xl glass-card px-5 text-sm font-medium text-text-main outline-none focus:border-accent-lime transition-colors"
        />
        <button
          type="submit"
          aria-label="Create routine"
          className="grid h-14 w-14 place-items-center rounded-2xl bg-text-main text-app-bg transition active:scale-95 hover:bg-accent-lime"
        >
          <Plus size={22} strokeWidth={2.5} />
        </button>
      </form>

      <div className="mt-6 flex flex-col gap-3">
        {loading && splits.length === 0 ? (
          <div className="text-center text-text-muted py-8 shimmer-bg rounded-xl">Loading routines</div>
        ) : splits.length > 0 ? (
          splits.map((split) => {
            const isExpanded = expandedSplitId === split.id;
            const isEditing = editingSplitId === split.id;
            
            return (
              <div key={split.id} className="rounded-card glass-card overflow-hidden transition-all duration-300">
                {/* Accordion Header */}
                <div 
                  onClick={() => {
                    if (!isEditing && deletingSplitId !== split.id) {
                      playTapSound();
                      setExpandedSplitId(isExpanded ? '' : split.id);
                    }
                  }}
                  className={`flex flex-wrap items-center justify-between p-4 cursor-pointer hover:bg-white/5 transition-colors relative overflow-hidden ${isExpanded ? 'bg-white/5' : ''}`}
                >
                  <div className="min-w-0 flex-1 flex items-center gap-2">
                    {isEditing ? (
                      <input 
                        value={editNameValue}
                        onChange={(e) => setEditNameValue(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        className="bg-app-bg border border-accent-lime rounded px-2 py-1 text-base font-extrabold text-text-main outline-none"
                        autoFocus
                      />
                    ) : (
                      <h2 className="text-lg font-extrabold text-text-main truncate">
                        {split.name}
                        {activeSplit?.id === split.id && <span className="live-dot ml-2" />}
                      </h2>
                    )}
                  </div>
                  
                    {deletingSplitId === split.id ? (
                      <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                        <CountdownAction
                          label="Deleting"
                          countdown={deleteCountdown}
                          onCancel={() => {
                            setDeletingSplitId('');
                            setDeleteCountdown(0);
                          }}
                          compact
                        />
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 ml-4">
                        {isEditing ? (
                          <button 
                            onClick={(e) => { e.stopPropagation(); updateSplitName(split.id); }}
                            className="grid h-8 w-8 place-items-center rounded bg-accent-lime text-app-bg hover:shadow-glow-lime active:scale-95"
                          >
                            <Check size={16} />
                          </button>
                        ) : (
                          <button 
                            onClick={(e) => { 
                              e.stopPropagation(); 
                              setEditNameValue(split.name);
                              setEditingSplitId(split.id);
                              setExpandedSplitId(split.id); // Ensure it's open
                            }}
                            className="grid h-8 w-8 place-items-center rounded bg-card-elevated text-text-muted hover:text-text-main active:scale-95"
                          >
                            <Edit2 size={14} />
                          </button>
                        )}
                        
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); onLaunchSplit?.(split); }}
                          className="flex h-8 items-center gap-1.5 rounded bg-accent-lime px-3 text-[11px] font-extrabold text-app-bg transition hover:shadow-glow-lime active:scale-95"
                        >
                          <Play size={12} className="fill-current" /> Launch
                        </button>
                        
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setDeletingSplitId(split.id); setDeleteCountdown(3); }}
                          className="grid h-8 w-8 place-items-center rounded bg-card-elevated text-text-muted transition active:scale-95 hover:text-quiet-red hover:bg-quiet-red/10"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    )}
                  </div>

                {/* Accordion Body */}
                {isExpanded && (
                  <div className="p-4 pt-0 border-t border-glass-border">
                    <div className="mt-4">
                      <form onSubmit={(e) => addExercise(e, split.id)} className="flex gap-2 relative">
                        <input
                          value={newExerciseName}
                          onChange={(event) => setNewExerciseName(event.target.value)}
                          list="split-exercise-suggestions"
                          autoComplete="off"
                          placeholder="Add exercise..."
                          className="h-12 min-w-0 flex-1 rounded-xl bg-app-bg border border-glass-border px-4 text-sm font-medium text-text-main outline-none focus:border-accent-lime transition"
                        />
                        <button
                          type="submit"
                          aria-label="Add exercise"
                          className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-card-elevated text-text-main transition active:scale-95 hover:bg-white/10"
                        >
                          <Plus size={19} />
                        </button>
                      </form>
                      
                      {matchingSuggestions.length > 0 && newExerciseName && (
                        <div className="mt-2 flex flex-wrap gap-1.5 pb-1">
                          {matchingSuggestions.map((name) => (
                            <button
                              type="button"
                              key={name}
                              onClick={() => setNewExerciseName(name)}
                              className="whitespace-nowrap rounded-lg bg-app-bg border border-glass-border px-3 py-1.5 text-[11px] font-semibold text-text-muted transition active:scale-95 hover:text-text-main"
                            >
                              {name}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="mt-4 grid gap-2">
                      {split.exercises.length ? split.exercises.map((exercise, index) => (
                        <div key={exercise.id} className="group flex min-h-[48px] items-center justify-between rounded-xl bg-app-bg border border-glass-border px-2 sm:px-4 py-1.5 transition hover:border-white/20">
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <div className="grid h-7 w-7 place-items-center rounded-lg bg-card-elevated text-[10px] font-bold text-text-muted font-mono shrink-0">
                              {String(index + 1).padStart(2, '0')}
                            </div>
                            <p className="text-sm font-bold text-text-main flex-1 break-words whitespace-normal py-1" title={exercise.exercise_name}>
                              {exercise.exercise_name}
                            </p>
                          </div>
                          
                          <div className="flex items-center gap-1 shrink-0 ml-2">
                            <div className="flex flex-col bg-card-elevated rounded-lg p-0.5 mr-1">
                              <button
                                type="button"
                                disabled={index === 0}
                                onClick={() => moveExercise(split.id, exercise, -1)}
                                className="grid h-4 w-6 place-items-center rounded-[4px] text-text-muted transition hover:bg-white/10 hover:text-text-main active:scale-95 disabled:opacity-20"
                              >
                                <ArrowUp size={11} />
                              </button>
                              <button
                                type="button"
                                disabled={index === split.exercises.length - 1}
                                onClick={() => moveExercise(split.id, exercise, 1)}
                                className="grid h-4 w-6 place-items-center rounded-[4px] text-text-muted transition hover:bg-white/10 hover:text-text-main active:scale-95 disabled:opacity-20"
                              >
                                <ArrowDown size={11} />
                              </button>
                            </div>
                            <button
                              type="button"
                              onClick={() => deleteExercise(split.id, exercise.id)}
                              className="grid h-8 w-8 place-items-center rounded-lg text-text-muted transition hover:bg-quiet-red/10 hover:text-quiet-red active:scale-95"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      )) : (
                        <div className="rounded-xl bg-app-bg border border-glass-border border-dashed p-4 text-center text-xs font-medium text-text-muted">
                          Empty routine. Add exercises above.
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        ) : (
          <div className="text-center py-8">
            <FolderOpen className="mx-auto h-12 w-12 text-text-muted/30 mb-3" />
            <p className="text-text-muted font-medium">Create a routine to start building splits</p>
          </div>
        )}
      </div>

      {status ? <p className="mt-4 text-center text-[11px] font-semibold text-text-muted bg-card-elevated px-3 py-1.5 rounded-full w-fit mx-auto">{status}</p> : null}
    </section>
  );
}
