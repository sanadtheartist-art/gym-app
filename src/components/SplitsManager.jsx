import { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, FolderOpen, Play, Plus, Trash2, Edit2, Check, Download } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { getCachedData, cacheData } from '../lib/offlineSync';

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

    const { data, error } = await supabase
      .from('splits')
      .insert({ name })
      .select('id, name, created_at')
      .single();

    if (error) {
      setStatus(error.message);
      return;
    }

    setNewSplitName('');
    setExpandedSplitId(data.id);
    setSplits((current) => [{ ...data, exercises: [] }, ...current]);
    setStatus('Routine created');
    onChanged?.();
  };

  const updateSplitName = async (splitId) => {
    const name = editNameValue.trim();
    if (!name) {
      setEditingSplitId('');
      return;
    }
    
    const { error } = await supabase.from('splits').update({ name }).eq('id', splitId);
    if (error) {
      setStatus(error.message);
      return;
    }
    
    setSplits(current => current.map(s => s.id === splitId ? { ...s, name } : s));
    setEditingSplitId('');
    onChanged?.();
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
    const { data, error } = await supabase
      .from('split_exercises')
      .insert({
        split_id: split.id,
        exercise_name: newExerciseName.trim(),
        display_order: nextOrder,
      })
      .select('id, exercise_name, display_order')
      .single();

    if (error) {
      setStatus(error.message);
      return;
    }

    setNewExerciseName('');
    setSplits((current) => current.map((s) => (
      s.id === split.id
        ? { ...s, exercises: [...s.exercises, data] }
        : s
    )));
    setStatus('Exercise added');
    onChanged?.();
  };

  const deleteExercise = async (splitId, exerciseId) => {
    const { error } = await supabase.from('split_exercises').delete().eq('id', exerciseId);

    if (error) {
      setStatus(error.message);
      return;
    }

    setSplits((current) => current.map((split) => (
      split.id === splitId
        ? { ...split, exercises: split.exercises.filter((exercise) => exercise.id !== exerciseId) }
        : split
    )));
    onChanged?.();
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
    
    setSplits(current => current.map(s => 
      s.id === splitId 
        ? { ...s, exercises: newExercises } 
        : s
    ));
    
    const updates = [
      { id: newExercises[currentIndex].id, display_order: currentIndex },
      { id: newExercises[newIndex].id, display_order: newIndex }
    ];
    
    for (const update of updates) {
      await supabase.from('split_exercises').update({ display_order: update.display_order }).eq('id', update.id);
    }
  };

  const deleteSplit = async (splitId) => {
    if (window.confirm("Are you sure you want to delete this routine? This will delete all its exercises.")) {
      const { error } = await supabase.from('splits').delete().eq('id', splitId);

      if (error) {
        setStatus(error.message);
        return;
      }

      setSplits((current) => current.filter((split) => split.id !== splitId));
      if (expandedSplitId === splitId) {
        setExpandedSplitId('');
      }
      setStatus('Routine deleted');
      onChanged?.();
    }
  };

  const loadTemplates = async () => {
    setStatus('Loading templates...');
    const templates = [
      { name: 'Push (Science-Based)', exercises: ['Incline Dumbbell Press', 'Flat Barbell Bench Press', 'Seated Dumbbell Shoulder Press', 'Cable Lateral Raises', 'Tricep Rope Pushdowns', 'Overhead Cable Extension'] },
      { name: 'Pull (Science-Based)', exercises: ['Pull-ups', 'Chest-Supported Row', 'Single-Arm Dumbbell Row', 'Face Pulls', 'Incline Dumbbell Curls', 'Hammer Curls'] },
      { name: 'Legs (Science-Based)', exercises: ['Barbell Back Squats', 'Romanian Deadlifts (RDLs)', 'Bulgarian Split Squats', 'Lying Leg Curls', 'Standing Calf Raises', 'Seated Calf Raises'] },
      { name: 'Upper (Strength/Hypertrophy)', exercises: ['Bench Press', 'Barbell Rows', 'Overhead Press', 'Lat Pulldowns', 'Lateral Raises', 'Bicep Curls', 'Skullcrushers'] },
      { name: 'Lower (Strength/Hypertrophy)', exercises: ['Squats', 'Deadlifts', 'Leg Press', 'Leg Extensions', 'Seated Leg Curls', 'Calf Raises'] },
      { name: 'Full Body A (Squat Focus)', exercises: ['Barbell Squats', 'Bench Press', 'Barbell Rows', 'Lateral Raises', 'Tricep Pushdowns', 'Bicep Curls'] },
      { name: 'Full Body B (Deadlift Focus)', exercises: ['Deadlifts', 'Overhead Press', 'Lat Pulldowns', 'Leg Curls', 'Hammer Curls', 'Overhead Tricep Extension'] },
      { name: 'Arnold: Chest & Back', exercises: ['Bench Press', 'Lat Pulldowns', 'Incline Dumbbell Press', 'T-Bar Rows', 'Dumbbell Pullovers', 'Cable Crossovers'] },
      { name: 'Arnold: Shoulders & Arms', exercises: ['Seated Dumbbell Press', 'Lateral Raises', 'Barbell Curls', 'Skullcrushers', 'Preacher Curls', 'Tricep Pushdowns'] }
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
                  onClick={() => !isEditing && setExpandedSplitId(isExpanded ? '' : split.id)}
                  className={`flex flex-wrap items-center justify-between p-4 cursor-pointer hover:bg-white/5 transition-colors ${isExpanded ? 'bg-white/5' : ''}`}
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
                      onClick={(e) => { e.stopPropagation(); deleteSplit(split.id); }}
                      className="grid h-8 w-8 place-items-center rounded bg-card-elevated text-text-muted transition active:scale-95 hover:text-quiet-red hover:bg-quiet-red/10"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
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
