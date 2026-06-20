import { useEffect, useMemo, useState } from 'react';
import React from 'react';
import { ChevronDown, Dumbbell, Save, Upload, X, Plus, Trash2, Calculator, CheckCircle2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import PlateCalculator from './PlateCalculator';
import { COMMON_MUSCLE_PRESETS, EXPLICIT_MUSCLE_LIST } from '../data/muscles';
import { queueSyncData } from '../lib/offlineSync';

const initialFormState = {
  muscleGroups: ['Upper Chest'],
  exerciseName: '',
  unit: 'KG',
  dynamicSets: [{ reps: '8', weight: '', type: 'N', rpe: '' }],
  mechanicType: 'N/A',
  machineUsed: '',
  customNotes: '',
};

export default function InputEngine({
  visible,
  onClose,
  activeSplit,
  sessionTools,
  onSaved,
  repeatWorkoutData,
}) {
  const [form, setForm] = useState(initialFormState);
  const [exerciseSuggestions, setExerciseSuggestions] = useState([]);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [assistedMuscles, setAssistedMuscles] = useState({});
  const [mediaFile, setMediaFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState('');
  const [calcOpen, setCalcOpen] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  
  // Track the last launch so we know when to reset the form
  const lastLaunchKeyRef = React.useRef(null);

  useEffect(() => {
    if (!visible) return undefined;

    let isMounted = true;

    async function loadSuggestions() {
      const { data, error } = await supabase
        .from('workouts')
        .select('exercise_name')
        .not('exercise_name', 'is', null)
        .limit(500);

      if (!isMounted) return;

      if (error) {
        setExerciseSuggestions([]);
        return;
      }

      const distinct = [...new Set((data || []).map((row) => row.exercise_name).filter(Boolean))].sort();
      setExerciseSuggestions(distinct);
    }

    loadSuggestions();
    return () => {
      isMounted = false;
    };
  }, [visible]);

  useEffect(() => {
    if (!visible) {
      setShowSuccess(false);
      return;
    }

    if (repeatWorkoutData) {
      if (lastLaunchKeyRef.current !== repeatWorkoutData.id) {
        lastLaunchKeyRef.current = repeatWorkoutData.id;
        setForm({
          ...initialFormState,
          exerciseName: repeatWorkoutData.exercise_name || '',
          muscleGroups: repeatWorkoutData.muscle_group ? repeatWorkoutData.muscle_group.split(',').map(m => m.trim()) : ['Upper Chest'],
          unit: repeatWorkoutData.input_unit || 'KG',
          dynamicSets: repeatWorkoutData.sets_data && repeatWorkoutData.sets_data.length > 0
            ? repeatWorkoutData.sets_data.map(s => ({ reps: String(s.reps), weight: String(s.weight), type: s.type || 'N', rpe: s.rpe ? String(s.rpe) : '' }))
            : [{ reps: '8', weight: '', type: 'N', rpe: '' }]
        });
      }
    } else if (activeSplit?.exercises?.length) {
      if (lastLaunchKeyRef.current !== activeSplit._launchKey) {
        lastLaunchKeyRef.current = activeSplit._launchKey;
        setForm({
          ...initialFormState,
          exerciseName: activeSplit.exercises[0].exercise_name,
        });
      }
    } else {
      if (lastLaunchKeyRef.current !== 'blank') {
        lastLaunchKeyRef.current = 'blank';
        setForm(initialFormState);
      }
    }
  }, [activeSplit, visible, repeatWorkoutData]);

  const matchingSuggestions = useMemo(() => {
    const search = form.exerciseName.trim().toLowerCase();
    if (!search) return exerciseSuggestions.slice(0, 5);
    return exerciseSuggestions
      .filter((name) => name.toLowerCase().includes(search))
      .slice(0, 5);
  }, [exerciseSuggestions, form.exerciseName]);

  const updateForm = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const updateSet = (index, key, value) => {
    setForm((current) => {
      const newSets = [...current.dynamicSets];
      newSets[index] = { ...newSets[index], [key]: value };
      return { ...current, dynamicSets: newSets };
    });
  };

  const addSet = () => {
    setForm((current) => {
      const lastSet = current.dynamicSets[current.dynamicSets.length - 1];
      return {
        ...current,
        dynamicSets: [...current.dynamicSets, { reps: lastSet?.reps || '8', weight: lastSet?.weight || '', type: lastSet?.type || 'N', rpe: lastSet?.rpe || '' }]
      };
    });
  };

  const cycleSetType = (index) => {
    setForm((current) => {
      const types = ['N', 'W', 'D', 'F'];
      const newSets = [...current.dynamicSets];
      const currentType = newSets[index].type || 'N';
      const nextType = types[(types.indexOf(currentType) + 1) % types.length];
      newSets[index] = { ...newSets[index], type: nextType };
      return { ...current, dynamicSets: newSets };
    });
  };

  const removeSet = (index) => {
    setForm((current) => {
      if (current.dynamicSets.length <= 1) return current; // Keep at least one set
      return {
        ...current,
        dynamicSets: current.dynamicSets.filter((_, i) => i !== index)
      };
    });
  };

  const toggleMuscle = (muscle) => {
    setAssistedMuscles((current) => {
      if (Object.prototype.hasOwnProperty.call(current, muscle)) {
        const next = { ...current };
        delete next[muscle];
        return next;
      }

      return { ...current, [muscle]: 25 };
    });
  };

  const uploadMedia = async () => {
    if (!mediaFile) return '';

    const fileExt = mediaFile.name.split('.').pop();
    const fileName = `${Math.random()}.${fileExt}`;
    const filePath = `entries/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('workout-media')
      .upload(filePath, mediaFile);

    if (uploadError) {
      throw uploadError;
    }

    const { data } = supabase.storage.from('workout-media').getPublicUrl(filePath);
    return data.publicUrl;
  };

  const submitEntry = async (event) => {
    event.preventDefault();
    setSaving(true);
    setStatus('');

    try {
      const mediaUrl = await uploadMedia();
      const assistedPayload = JSON.parse(JSON.stringify(assistedMuscles));

      const parsedSets = form.dynamicSets.map((s, idx) => {
        const weightRaw = parseFloat(s.weight || '0');
        const weightKg = form.unit === 'LBS' ? parseFloat((weightRaw * 0.45359237).toFixed(2)) : weightRaw;
        return {
          set_number: idx + 1,
          reps: parseInt(s.reps, 10) || 0,
          weight: weightRaw,
          weight_kg: weightKg,
          type: s.type || 'N',
          rpe: parseFloat(s.rpe) || null
        };
      });

      const legacySets = parsedSets.length;
      const legacyReps = parsedSets[0]?.reps || 0;
      const legacyWeight = parsedSets[0]?.weight || 0;
      const legacyWeightKg = parsedSets[0]?.weight_kg || 0;

      const payload = {
        timestamp: new Date().toISOString(),
        muscle_group: form.muscleGroups.join(', '),
        exercise_name: form.exerciseName.trim(),
        sets: legacySets,
        reps: legacyReps,
        input_weight: legacyWeight,
        input_unit: form.unit,
        weight_kg: legacyWeightKg,
        sets_data: parsedSets,
        session_duration_seconds: sessionTools?.getSessionDuration?.() || 0,
        set_duration_seconds: sessionTools?.getSetDuration?.() || 0,
        mechanic_type: form.mechanicType,
        machine_used: form.machineUsed.trim(),
        assisted_muscles: assistedPayload,
        custom_notes: form.customNotes.trim(),
        split_id: activeSplit?.id || null,
        media_url: mediaUrl,
      };

      if (navigator.onLine) {
        const { error } = await supabase.from('workouts').insert(payload);
        if (error) throw error;
      } else {
        await queueSyncData('workouts', payload);
      }

      sessionTools?.resetSetTimer?.();
      setForm((current) => ({
        ...initialFormState,
        muscleGroups: current.muscleGroups,
        unit: current.unit,
      }));
      setAssistedMuscles({});
      setMediaFile(null);
      
      setShowSuccess(true);
      setTimeout(() => {
        // Auto-advance logic for active splits
        if (activeSplit?.exercises?.length) {
          const currentIndex = activeSplit.exercises.findIndex(e => e.exercise_name === form.exerciseName);
          if (currentIndex !== -1 && currentIndex < activeSplit.exercises.length - 1) {
            const nextExercise = activeSplit.exercises[currentIndex + 1];
            setForm(current => ({
              ...initialFormState,
              exerciseName: nextExercise.exercise_name,
              unit: current.unit
            }));
            setShowSuccess(false);
            onSaved?.(null); // Passing null tells App.jsx NOT to show the Workout Summary modal yet
            return; // Don't close, just move to next
          }
        }
        
        onSaved?.(payload);
        onClose();
        setShowSuccess(false);
      }, 1000);
      
    } catch (error) {
      if ((error.message || '').toLowerCase().includes('row-level security') || (error.message || '').toLowerCase().includes('column "sets_data"')) {
        setStatus('Supabase error: Please run the SQL command to add sets_data column.');
      } else {
        setStatus(error.message || 'Save failed');
      }
    } finally {
      setSaving(false);
    }
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 backdrop-blur-md sheet-overlay">
      <form
        onSubmit={submitEntry}
        className="flex w-full max-w-3xl flex-col rounded-t-[32px] glass-card shadow-sheet sheet-content border-b-0 rounded-b-none"
        style={{ maxHeight: '92dvh' }}
      >
        <div
          className="w-full flex-1 overflow-y-auto px-4 pt-4"
          style={{ paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom))' }}
        >
          {/* Handle bar */}
          <div className="mx-auto mb-6 h-1.5 w-12 rounded-pill bg-white/20" />

          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-text-muted">Workout Log</p>
              <h2 className="mt-0.5 text-2xl font-extrabold text-text-main">New Entry</h2>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                aria-label="Open plate calculator"
                onClick={() => setCalcOpen(true)}
                className="grid h-10 w-10 place-items-center rounded-xl bg-card-elevated text-text-main transition active:scale-95"
              >
                <Calculator size={18} />
              </button>
              <button
                type="button"
                aria-label="Close workout entry"
                onClick={onClose}
                className="grid h-10 w-10 place-items-center rounded-xl bg-card-elevated text-text-main transition active:scale-95"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Split exercise picker */}
          {activeSplit?.exercises?.length ? (
            <div className="mt-6 min-w-0">
              <div className="flex flex-wrap gap-2 pb-1">
                {activeSplit.exercises.map((exercise) => (
                  <button
                    type="button"
                    key={exercise.id || exercise.exercise_name}
                    onClick={() => updateForm('exerciseName', exercise.exercise_name)}
                    className={`whitespace-nowrap rounded-lg px-4 py-2.5 text-xs font-bold transition ${form.exerciseName === exercise.exercise_name
                        ? 'glass-card-orange text-white'
                        : 'bg-card-elevated text-text-muted hover:text-text-main'
                      }`}
                  >
                    {exercise.exercise_name}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <div className="mt-5 flex flex-col gap-4 min-w-0">

            {/* Exercise name */}
            <label className="block min-w-0">
              <span className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.2em] text-text-muted">Exercise</span>
              <input
                required
                value={form.exerciseName}
                onChange={(event) => updateForm('exerciseName', event.target.value)}
                list="exercise-suggestions"
                placeholder="e.g. Bench Press"
                autoComplete="off"
                className="h-14 w-full rounded-2xl bg-app-bg px-5 text-sm font-medium text-text-main outline-none border border-glass-border focus:border-accent-lime transition-colors"
              />
              <datalist id="exercise-suggestions">
                {exerciseSuggestions.map((name) => (
                  <option key={name} value={name} />
                ))}
              </datalist>
              {matchingSuggestions.length ? (
                <div className="mt-2 flex flex-wrap gap-2 pb-1">
                  {matchingSuggestions.map((name) => (
                    <button
                      type="button"
                      key={name}
                      onClick={() => updateForm('exerciseName', name)}
                      className="whitespace-nowrap rounded-lg bg-card-elevated px-3 py-1.5 text-[11px] font-semibold text-text-muted hover:text-text-main transition"
                    >
                      {name}
                    </button>
                  ))}
                </div>
              ) : null}
            </label>

            {/* Muscle groups */}
            <div className="min-w-0">
              <span className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.2em] text-text-muted">Muscle Groups</span>
              <div className="flex flex-wrap gap-2">
                {COMMON_MUSCLE_PRESETS.map((group) => {
                  const isSelected = form.muscleGroups.includes(group);
                  return (
                    <button
                      type="button"
                      key={group}
                      onClick={() => {
                        setForm((current) => {
                          const has = current.muscleGroups.includes(group);
                          const nextGroups = has
                            ? current.muscleGroups.filter((m) => m !== group)
                            : [...current.muscleGroups, group];
                          
                          if (nextGroups.length === 0) nextGroups.push(group);
                          return { ...current, muscleGroups: nextGroups };
                        });
                      }}
                      className={`whitespace-nowrap rounded-lg px-3 py-2 text-xs font-bold transition ${
                        isSelected ? 'bg-text-main text-app-bg' : 'bg-card-elevated text-text-muted hover:text-text-main'
                      }`}
                    >
                      {group}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Dynamic Sets */}
            <div className="mt-2 min-w-0">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-text-muted">Sets</span>
                <div className="flex items-center gap-1.5 bg-card-elevated p-1 rounded-lg">
                  {['KG', 'LBS'].map((unit) => (
                    <button
                      type="button"
                      key={unit}
                      onClick={() => updateForm('unit', unit)}
                      className={`rounded-md px-3 py-1.5 text-[11px] font-bold transition ${
                        form.unit === unit ? 'bg-text-main text-app-bg shadow-sm' : 'text-text-muted'
                      }`}
                    >
                      {unit}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-2 stagger-children">
                {form.dynamicSets.map((set, index) => (
                  <div key={index} className="flex items-center gap-2 rounded-2xl bg-app-bg p-2 border border-glass-border">
                    <button
                      type="button"
                      onClick={() => cycleSetType(index)}
                      className={`grid h-12 w-12 shrink-0 place-items-center rounded-xl text-sm font-extrabold transition active:scale-95 ${
                        set.type === 'W' ? 'bg-accent-orange/15 text-accent-orange' :
                        set.type === 'D' ? 'bg-accent-lime/15 text-accent-lime' :
                        set.type === 'F' ? 'bg-quiet-red/15 text-quiet-red' :
                        'bg-card-elevated text-text-muted'
                      }`}
                    >
                      {set.type === 'N' || !set.type ? index + 1 : set.type}
                    </button>
                    
                    <label className="flex flex-1 flex-col items-center justify-center h-12">
                      <span className="text-[9px] font-bold uppercase tracking-widest text-text-muted/70">Reps</span>
                      <input
                        required
                        min="1"
                        type="number"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={set.reps}
                        onChange={(event) => updateSet(index, 'reps', event.target.value)}
                        className="w-full bg-transparent text-center text-xl font-extrabold text-text-main outline-none font-mono"
                      />
                    </label>

                    <div className="h-8 w-px bg-card-elevated" />

                    <label className="flex flex-1 flex-col items-center justify-center h-12">
                      <span className="text-[9px] font-bold uppercase tracking-widest text-text-muted/70">Weight</span>
                      <input
                        required
                        min="0"
                        step="0.5"
                        type="number"
                        inputMode="decimal"
                        value={set.weight}
                        onChange={(event) => updateSet(index, 'weight', event.target.value)}
                        className="w-full bg-transparent text-center text-xl font-extrabold text-text-main outline-none font-mono"
                      />
                    </label>

                    <div className="h-8 w-px bg-card-elevated" />

                    <label className="flex flex-1 flex-col items-center justify-center h-12">
                      <span className="text-[9px] font-bold uppercase tracking-widest text-text-muted/70" title="Rate of Perceived Exertion (1-10)">RPE</span>
                      <input
                        min="1"
                        step="0.5"
                        type="number"
                        inputMode="decimal"
                        placeholder="-"
                        value={set.rpe}
                        onChange={(event) => updateSet(index, 'rpe', event.target.value)}
                        className="w-full bg-transparent text-center text-xl font-extrabold text-text-main outline-none font-mono"
                      />
                    </label>

                    {form.dynamicSets.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeSet(index)}
                        className="grid h-12 w-12 shrink-0 place-items-center rounded-xl text-text-muted transition hover:text-quiet-red hover:bg-quiet-red/10 active:scale-95"
                      >
                        <Trash2 size={18} />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={addSet}
                className="mt-3 flex h-14 w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-text-muted/30 text-sm font-bold text-text-muted transition hover:border-text-muted hover:text-text-main active:scale-[0.98]"
              >
                <Plus size={18} strokeWidth={2.5} />
                Add Set
              </button>
            </div>

            {/* Advanced metadata toggle */}
            <button
              type="button"
              onClick={() => setAdvancedOpen((open) => !open)}
              className="mt-2 flex h-14 w-full items-center justify-between rounded-2xl bg-app-bg border border-glass-border px-5 text-left transition hover:bg-card-elevated"
            >
              <span className="text-sm font-bold text-text-main">Advanced Metadata</span>
              <ChevronDown className={`text-text-muted transition-transform duration-300 ${advancedOpen ? 'rotate-180' : ''}`} size={20} />
            </button>

            {advancedOpen ? (
              <div className="grid gap-5 rounded-2xl bg-app-bg border border-glass-border p-5">
                {/* Mechanic */}
                <div>
                  <span className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.2em] text-text-muted">Mechanic</span>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    {['Compound', 'Isolation', 'N/A'].map((type) => (
                      <button
                        type="button"
                        key={type}
                        onClick={() => updateForm('mechanicType', type)}
                        className={`h-11 rounded-lg text-xs font-bold transition ${
                          form.mechanicType === type ? 'bg-text-main text-app-bg' : 'bg-card-elevated text-text-muted'
                        }`}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Machine used */}
                <label>
                  <span className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.2em] text-text-muted">Machine Used</span>
                  <input
                    value={form.machineUsed}
                    onChange={(event) => updateForm('machineUsed', event.target.value)}
                    placeholder="Cable stack, plate-loaded press"
                    className="h-12 w-full rounded-xl bg-card-elevated px-4 text-sm font-medium text-text-main outline-none focus:ring-1 focus:ring-accent-lime"
                  />
                </label>

                {/* Assisted muscles */}
                <div>
                  <span className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.2em] text-text-muted">Assisted Muscles</span>
                  <div className="flex flex-wrap gap-2">
                    {EXPLICIT_MUSCLE_LIST.map((muscle) => {
                      const selected = Object.prototype.hasOwnProperty.call(assistedMuscles, muscle);
                      return (
                        <button
                          type="button"
                          key={muscle}
                          onClick={() => toggleMuscle(muscle)}
                          className={`rounded-lg px-3 py-2 text-xs font-bold transition ${
                            selected ? 'bg-text-main text-app-bg' : 'bg-card-elevated text-text-muted'
                          }`}
                        >
                          {muscle}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Assisted muscle sliders */}
                {Object.keys(assistedMuscles).length ? (
                  <div className="grid gap-4 mt-2">
                    {Object.entries(assistedMuscles).map(([muscle, value]) => (
                      <label key={muscle} className="block">
                        <span className="mb-2 flex items-center justify-between text-[11px] font-bold text-text-main">
                          <span>{muscle}</span>
                          <span className="text-accent-lime">{value}%</span>
                        </span>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={value}
                          onChange={(event) => {
                            const nextValue = parseInt(event.target.value, 10);
                            setAssistedMuscles((current) => ({ ...current, [muscle]: nextValue }));
                          }}
                          className="w-full"
                        />
                      </label>
                    ))}
                  </div>
                ) : null}

                {/* Notes */}
                <label>
                  <span className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.2em] text-text-muted">Notes</span>
                  <textarea
                    value={form.customNotes}
                    onChange={(event) => updateForm('customNotes', event.target.value)}
                    rows="3"
                    placeholder="Tempo, pain signals, setup cues"
                    className="w-full resize-none rounded-xl bg-card-elevated px-4 py-3 text-sm font-medium text-text-main outline-none focus:ring-1 focus:ring-accent-lime"
                  />
                </label>
              </div>
            ) : null}

            {/* Media upload */}
            <label className="flex cursor-pointer items-center gap-4 rounded-2xl bg-app-bg border border-glass-border px-4 py-3 transition hover:bg-card-elevated">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-card-elevated text-text-main">
                <Upload size={18} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold text-text-main">Media Vault</span>
                <span className="block truncate text-xs font-medium text-text-muted">{mediaFile?.name || 'Image or video'}</span>
              </span>
              <input
                type="file"
                accept="image/*,video/*"
                className="hidden"
                onChange={(event) => setMediaFile(event.target.files?.[0] || null)}
              />
            </label>

            {/* Save button */}
            <button
              type="submit"
              disabled={saving || showSuccess}
              className={`mt-2 flex h-14 w-full items-center justify-center gap-2 rounded-2xl px-5 font-extrabold transition-all duration-300 active:scale-[0.98] disabled:opacity-80 ${
                showSuccess 
                  ? 'bg-accent-lime text-app-bg shadow-glow-lime' 
                  : 'bg-text-main text-app-bg hover:shadow-glow-lime'
              }`}
            >
              {showSuccess ? (
                <>
                  <CheckCircle2 size={20} />
                  Saved!
                </>
              ) : saving ? (
                <>
                  <Dumbbell size={20} className="animate-pulse" />
                  Saving…
                </>
              ) : (
                <>
                  <Save size={20} />
                  Save Entry
                </>
              )}
            </button>

            {status ? (
              <p className="text-center text-sm font-semibold text-text-muted">{status}</p>
            ) : null}

          </div>
        </div>
      </form>
      {calcOpen && <PlateCalculator onClose={() => setCalcOpen(false)} />}
    </div>
  );
}
