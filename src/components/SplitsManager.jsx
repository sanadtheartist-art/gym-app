import { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, FolderOpen, Play, Plus, Trash2, GripVertical } from 'lucide-react';
import { supabase } from '../lib/supabase';

export default function SplitsManager({ activeSplit, onLaunchSplit, refreshKey, onChanged }) {
  const [splits, setSplits] = useState([]);
  const [selectedSplitId, setSelectedSplitId] = useState('');
  const [newSplitName, setNewSplitName] = useState('');
  const [newExerciseName, setNewExerciseName] = useState('');
  const [exerciseSuggestions, setExerciseSuggestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');

  const selectedSplit = splits.find((split) => split.id === selectedSplitId) || splits[0] || null;

  useEffect(() => {
    let isMounted = true;

    async function loadSplits() {
      setLoading(true);
      const { data, error } = await supabase
        .from('splits')
        .select('id, name, created_at, split_exercises(id, exercise_name, display_order)')
        .order('created_at', { ascending: false });

      if (!isMounted) return;

      if (error) {
        setSplits([]);
        setStatus(error.message);
      } else {
        const normalized = (data || []).map((split) => ({
          ...split,
          exercises: [...(split.split_exercises || [])].sort((a, b) => a.display_order - b.display_order),
        }));
        setSplits(normalized);
        if (!selectedSplitId && normalized[0]?.id) setSelectedSplitId(normalized[0].id);
      }

      const { data: workoutsData } = await supabase
        .from('workouts')
        .select('exercise_name')
        .not('exercise_name', 'is', null)
        .limit(500);

      if (isMounted && workoutsData) {
        const distinct = [...new Set(workoutsData.map((row) => row.exercise_name).filter(Boolean))].sort();
        setExerciseSuggestions(distinct);
      }

      setLoading(false);
    }

    loadSplits();
    return () => {
      isMounted = false;
    };
  }, [refreshKey, selectedSplitId]);

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
    setSelectedSplitId(data.id);
    setSplits((current) => [{ ...data, exercises: [] }, ...current]);
    setStatus('Routine created');
    onChanged?.();
  };

  const addExercise = async (event) => {
    event.preventDefault();
    if (!selectedSplit || !newExerciseName.trim()) return;

    const nextOrder = selectedSplit.exercises.length;
    const { data, error } = await supabase
      .from('split_exercises')
      .insert({
        split_id: selectedSplit.id,
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
    setSplits((current) => current.map((split) => (
      split.id === selectedSplit.id
        ? { ...split, exercises: [...split.exercises, data] }
        : split
    )));
    setStatus('Exercise added');
    onChanged?.();
  };

  const deleteExercise = async (exerciseId) => {
    const { error } = await supabase.from('split_exercises').delete().eq('id', exerciseId);

    if (error) {
      setStatus(error.message);
      return;
    }

    setSplits((current) => current.map((split) => (
      split.id === selectedSplit?.id
        ? { ...split, exercises: split.exercises.filter((exercise) => exercise.id !== exerciseId) }
        : split
    )));
    onChanged?.();
  };

  const moveExercise = async (exercise, direction) => {
    if (!selectedSplit) return;
    const currentIndex = selectedSplit.exercises.findIndex(e => e.id === exercise.id);
    const newIndex = currentIndex + direction;
    
    if (newIndex < 0 || newIndex >= selectedSplit.exercises.length) return;
    
    const newExercises = [...selectedSplit.exercises];
    const temp = newExercises[currentIndex];
    newExercises[currentIndex] = newExercises[newIndex];
    newExercises[newIndex] = temp;
    
    // Update local state for immediate feedback
    setSplits(current => current.map(split => 
      split.id === selectedSplit.id 
        ? { ...split, exercises: newExercises } 
        : split
    ));
    
    // Update Supabase
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
      if (selectedSplitId === splitId) {
        setSelectedSplitId('');
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
    onChanged?.(); // triggers refresh in parent
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
            onClick={loadTemplates} 
            className="h-11 px-3 text-[11px] font-bold bg-card-elevated text-text-muted rounded-xl hover:text-text-main transition active:scale-95"
          >
            Load Templates
          </button>
          <div className="grid h-11 w-11 place-items-center rounded-xl glass-card text-accent-lime">
            <FolderOpen size={20} />
          </div>
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

      {/* Split Picker */}
      <div className="mt-6 flex flex-wrap gap-2 pb-2">
        {splits.map((split) => (
          <button
            type="button"
            key={split.id}
            onClick={() => setSelectedSplitId(split.id)}
            className={`whitespace-nowrap rounded-xl px-4 py-3 text-sm font-bold transition-all ${
              selectedSplit?.id === split.id 
                ? 'glass-card-orange text-white transform -translate-y-0.5' 
                : 'glass-card text-text-muted hover:text-text-main'
            }`}
          >
            {split.name}
          </button>
        ))}
      </div>

      <div className="mt-4 rounded-card glass-card p-5">
        {loading ? (
          <div className="text-center text-text-muted py-8 shimmer-bg rounded-xl">Loading routines</div>
        ) : selectedSplit ? (
          <>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-text-muted">
                  {activeSplit?.id === selectedSplit.id ? 'Active Routine' : 'Selected Routine'}
                </p>
                <h2 className="mt-1 flex items-center gap-2 text-2xl font-extrabold text-text-main">
                  {selectedSplit.name}
                  {activeSplit?.id === selectedSplit.id && <span className="live-dot ml-1" />}
                </h2>
              </div>
              <div className="ml-auto flex shrink-0 gap-2">
                <button
                  type="button"
                  onClick={() => deleteSplit(selectedSplit.id)}
                  className="grid h-11 w-11 place-items-center rounded-xl bg-card-elevated text-text-muted transition active:scale-95 hover:text-quiet-red hover:bg-quiet-red/10"
                  aria-label="Delete split"
                >
                  <Trash2 size={18} />
                </button>
                <button
                  type="button"
                  onClick={() => onLaunchSplit?.(selectedSplit)}
                  className="flex h-11 shrink-0 items-center gap-2 whitespace-nowrap rounded-xl bg-accent-lime px-4 text-sm font-extrabold text-app-bg transition hover:shadow-glow-lime active:scale-95"
                >
                  <Play size={16} className="fill-current" />
                  Launch
                </button>
              </div>
            </div>

            <div className="mt-6">
              <form onSubmit={addExercise} className="flex gap-2 relative">
                <input
                  value={newExerciseName}
                  onChange={(event) => setNewExerciseName(event.target.value)}
                  list="split-exercise-suggestions"
                  autoComplete="off"
                  placeholder="Add exercise..."
                  className="h-12 min-w-0 flex-1 rounded-xl bg-app-bg border border-glass-border px-4 text-sm font-medium text-text-main outline-none focus:border-accent-lime transition"
                />
                <datalist id="split-exercise-suggestions">
                  {exerciseSuggestions.map((name) => (
                    <option key={name} value={name} />
                  ))}
                </datalist>
                <button
                  type="submit"
                  aria-label="Add exercise"
                  className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-card-elevated text-text-main transition active:scale-95 hover:bg-white/10"
                >
                  <Plus size={19} />
                </button>
              </form>
              
              {matchingSuggestions.length > 0 && (
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

            <div className="mt-6 grid gap-2 stagger-children">
              {selectedSplit.exercises.length ? selectedSplit.exercises.map((exercise, index) => (
                <div key={exercise.id} className="group flex min-h-[56px] items-center justify-between rounded-xl bg-app-bg border border-glass-border px-2 sm:px-4 py-2 transition hover:border-white/20">
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <div className="mt-0.5 grid h-8 w-8 place-items-center rounded-lg bg-card-elevated text-[10px] font-bold text-text-muted font-mono shrink-0">
                      {String(index + 1).padStart(2, '0')}
                    </div>
                    <p className="text-sm font-bold text-text-main flex-1 break-words whitespace-normal leading-snug py-1.5" title={exercise.exercise_name}>
                      {exercise.exercise_name}
                    </p>
                  </div>
                  
                  <div className="flex items-center gap-1 shrink-0 ml-2">
                    <div className="flex flex-col bg-card-elevated rounded-lg p-0.5 mr-1">
                      <button
                        type="button"
                        disabled={index === 0}
                        onClick={() => moveExercise(exercise, -1)}
                        className="grid h-5 w-7 place-items-center rounded-[4px] text-text-muted transition hover:bg-white/10 hover:text-text-main active:scale-95 disabled:opacity-20"
                      >
                        <ArrowUp size={13} />
                      </button>
                      <button
                        type="button"
                        disabled={index === selectedSplit.exercises.length - 1}
                        onClick={() => moveExercise(exercise, 1)}
                        className="grid h-5 w-7 place-items-center rounded-[4px] text-text-muted transition hover:bg-white/10 hover:text-text-main active:scale-95 disabled:opacity-20"
                      >
                        <ArrowDown size={13} />
                      </button>
                    </div>
                    <button
                      type="button"
                      aria-label={`Remove ${exercise.exercise_name}`}
                      onClick={() => deleteExercise(exercise.id)}
                      className="grid h-10 w-10 place-items-center rounded-lg text-text-muted transition hover:bg-quiet-red/10 hover:text-quiet-red active:scale-95"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              )) : (
                <div className="rounded-xl bg-app-bg border border-glass-border border-dashed p-6 text-center text-sm font-medium text-text-muted">
                  Your routine is empty.<br/>Add exercises above to build your split.
                </div>
              )}
            </div>
          </>
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
