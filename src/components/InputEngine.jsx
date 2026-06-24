import { useEffect, useMemo, useState } from 'react';
import React from 'react';
import { Dumbbell, Save, Upload, X, Plus, Trash2, CheckCircle2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { EXPLICIT_MUSCLE_LIST } from '../data/muscles';
import { queueSyncAction, queueSyncData } from '../lib/offlineSync';
import { playSuccessSound } from '../lib/sounds';

const pad2 = (value) => String(value).padStart(2, '0');

const toLocalDateTimeInputValue = (value) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}T${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
};

const toIsoFromLocalDateTimeInputValue = (value) => {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const date = new Date(year, month - 1, day, hour, minute, 0, 0);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
};

const initialFormState = {
  timestampLocal: toLocalDateTimeInputValue(new Date()),
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
  editWorkoutData,
}) {
  const [form, setForm] = useState(initialFormState);
  const [exerciseSuggestions, setExerciseSuggestions] = useState([]);
  const [exerciseMetadataDict, setExerciseMetadataDict] = useState({});
  const [mediaFile, setMediaFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);
  const [activeDuration, setActiveDuration] = useState(0);
  
  // Track the last launch so we know when to reset the form
  const lastLaunchKeyRef = React.useRef(null);

  useEffect(() => {
    let interval;
    if (visible && !saving && !showSuccess) {
      interval = setInterval(() => {
        setActiveDuration((prev) => prev + 1);
      }, 1000);
    } else if (!visible) {
      setActiveDuration(0);
    }
    return () => clearInterval(interval);
  }, [visible, saving, showSuccess]);

  useEffect(() => {
    if (!visible) return undefined;

    let isMounted = true;

    async function loadSuggestions() {
      const { data, error } = await supabase
        .from('workouts')
        .select('exercise_name, muscle_group, mechanic_type, machine_used, timestamp')
        .not('exercise_name', 'is', null)
        .order('timestamp', { ascending: false })
        .limit(300);

      if (!isMounted) return;

      if (error) {
        setExerciseSuggestions([]);
        return;
      }

      const dict = {};
      (data || []).forEach(row => {
        const name = row.exercise_name?.trim();
        if (name && !dict[name]) {
          dict[name] = {
            muscle_group: row.muscle_group,
            mechanic_type: row.mechanic_type,
            machine_used: row.machine_used,
          };
        }
      });
      
      setExerciseMetadataDict(dict);
      setExerciseSuggestions(Object.keys(dict).sort(function(a, b) {
        return a.toLowerCase().localeCompare(b.toLowerCase());
      }));
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

    if (editWorkoutData) {
      if (lastLaunchKeyRef.current !== `edit-${editWorkoutData.id}`) {
        lastLaunchKeyRef.current = `edit-${editWorkoutData.id}`;
        setForm({
          ...initialFormState,
          timestampLocal: toLocalDateTimeInputValue(editWorkoutData.timestamp),
          exerciseName: editWorkoutData.exercise_name || '',
          muscleGroups: editWorkoutData.muscle_group ? editWorkoutData.muscle_group.split(',').map(m => m.trim()) : ['Upper Chest'],
          unit: editWorkoutData.input_unit || 'KG',
          dynamicSets: editWorkoutData.sets_data && editWorkoutData.sets_data.length > 0
            ? editWorkoutData.sets_data.map(s => ({ reps: String(s.reps), weight: String(s.weight), type: s.type || 'N', rpe: s.rpe ? String(s.rpe) : '' }))
            : [{ reps: '8', weight: '', type: 'N', rpe: '' }],
          machineUsed: editWorkoutData.machine_used || '',
          mechanicType: editWorkoutData.mechanic_type || 'N/A',
          customNotes: editWorkoutData.custom_notes || '',
        });
      }
    } else if (repeatWorkoutData) {
      if (lastLaunchKeyRef.current !== repeatWorkoutData.id) {
        lastLaunchKeyRef.current = repeatWorkoutData.id;
        setForm({
          ...initialFormState,
          timestampLocal: toLocalDateTimeInputValue(new Date()),
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
          timestampLocal: toLocalDateTimeInputValue(new Date()),
          exerciseName: activeSplit.exercises[0].exercise_name,
        });
      }
    } else {
      if (lastLaunchKeyRef.current !== 'blank') {
        lastLaunchKeyRef.current = 'blank';
        setForm({ ...initialFormState, timestampLocal: toLocalDateTimeInputValue(new Date()) });
      }
    }
  }, [activeSplit, visible, repeatWorkoutData, editWorkoutData]);

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

  const handleExerciseNameChange = (name) => {
    const meta = exerciseMetadataDict[name.trim()];
    
    // Check if we are freshly hitting an exact match
    const isNewMatch = meta && form.exerciseName.trim() !== name.trim();

    setForm((current) => ({ 
      ...current, 
      exerciseName: name,
      ...(isNewMatch && meta.muscle_group ? { muscleGroups: meta.muscle_group.split(',').map(s => s.trim()) } : {}),
      ...(isNewMatch && meta.mechanic_type ? { mechanicType: meta.mechanic_type } : {}),
      ...(isNewMatch && meta.machine_used ? { machineUsed: meta.machine_used } : {}),
    }));
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

  const compressImage = async (file, targetSizeKB) => {
    return new Promise((resolve) => {
      if (!file.type.startsWith('image/')) return resolve(file);
      
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target.result;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let { width, height } = img;
          const maxDim = 480; // Extremely aggressive compression limit
          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height *= maxDim / width));
              width = maxDim;
            } else {
              width = Math.round((width *= maxDim / height));
              height = maxDim;
            }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);

          let quality = 0.5; // Start at 50%
          const attemptCompress = () => {
            canvas.toBlob((blob) => {
              if (blob.size / 1024 <= targetSizeKB || quality <= 0.1) {
                // Ensure it gets saved as jpeg to support the compression
                resolve(new File([blob], file.name.replace(/\.[^/.]+$/, "") + ".jpg", { type: 'image/jpeg' }));
              } else {
                quality -= 0.1;
                attemptCompress();
              }
            }, 'image/jpeg', quality);
          };
          attemptCompress();
        };
      };
    });
  };

  const uploadMedia = async () => {
    if (!mediaFile) return '';
    
    setStatus('Compressing media...');
    const processedFile = await compressImage(mediaFile, 25);
    setStatus('Uploading media...');

    const fileExt = processedFile.name.split('.').pop();
    const fileName = `${Math.random()}.${fileExt}`;
    const filePath = `entries/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('workout-media')
      .upload(filePath, processedFile);

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
      const mediaUrl = editWorkoutData?.media_url || await uploadMedia();
      const timestampIso = toIsoFromLocalDateTimeInputValue(form.timestampLocal) || new Date().toISOString();

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
        timestamp: timestampIso,
        muscle_group: form.muscleGroups.join(', '),
        exercise_name: form.exerciseName.trim(),
        sets: legacySets,
        reps: legacyReps,
        input_weight: legacyWeight,
        input_unit: form.unit,
        weight_kg: legacyWeightKg,
        sets_data: parsedSets,
        session_duration_seconds: sessionTools?.getSessionDuration?.() || 0,
        set_duration_seconds: activeDuration,
        mechanic_type: form.mechanicType,
        machine_used: form.machineUsed.trim(),
        custom_notes: form.customNotes.trim(),
        split_id: activeSplit?.id || null,
        media_url: mediaUrl,
      };

      if (editWorkoutData) {
        // Update existing workout
        if (navigator.onLine) {
          const { error } = await supabase
            .from('workouts')
            .update(payload)
            .eq('id', editWorkoutData.id);
          if (error) throw error;
        } else {
          await queueSyncAction('update', 'workouts', {
            id: editWorkoutData.id,
            data: payload
          });
        }
      } else {
        // Insert new workout
        if (navigator.onLine) {
          const { error } = await supabase.from('workouts').insert(payload);
          if (error) throw error;
        } else {
          await queueSyncData('workouts', payload);
        }
      }

      sessionTools?.resetSetTimer?.();
      setForm((current) => ({
        ...initialFormState,
        timestampLocal: toLocalDateTimeInputValue(new Date()),
        muscleGroups: current.muscleGroups,
        unit: current.unit,
      }));
      setMediaFile(null);
      
      playSuccessSound();
      setShowSuccess(true);
      setTimeout(() => {
        if (editWorkoutData) {
          onSaved?.(null);
          onClose();
          setShowSuccess(false);
          return;
        }

        if (activeSplit?.exercises?.length) {
          const currentIndex = activeSplit.exercises.findIndex(e => e.exercise_name === form.exerciseName);
          if (currentIndex !== -1 && currentIndex < activeSplit.exercises.length - 1) {
            const nextExercise = activeSplit.exercises[currentIndex + 1];
            setForm(current => ({
              ...initialFormState,
              timestampLocal: toLocalDateTimeInputValue(new Date()),
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
      console.error('Supabase Error Details:', error);
      const msg = (error.message || '').toLowerCase();
      
      // Specifically check for storage-related RLS errors vs database errors
      if (error.name === 'StorageError' || msg.includes('bucket') || (msg.includes('row-level security') && !msg.includes('insert'))) {
        setStatus(`Storage Error: ${error.message} (Make sure your RLS policies allow INSERT)`);
      } else if (msg.includes('row-level security') || msg.includes('column "sets_data"')) {
        setStatus('Database error: Please run the SQL command to add missing columns.');
      } else {
        setStatus(`Error: ${error.message || 'Save failed'}`);
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
              <div className="flex items-center gap-2">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-text-muted">Workout Log</p>
                <div className="flex items-center gap-1 rounded-md bg-card-elevated px-1.5 py-0.5">
                  <div className="h-1.5 w-1.5 rounded-full bg-accent-lime animate-pulse" />
                  <span className="font-mono text-[10px] font-bold text-text-main">
                    {Math.floor(activeDuration / 60).toString().padStart(2, '0')}:
                    {(activeDuration % 60).toString().padStart(2, '0')}
                  </span>
                </div>
              </div>
              <h2 className="mt-0.5 text-2xl font-extrabold text-text-main">{editWorkoutData ? 'Edit Entry' : 'New Entry'}</h2>
            </div>
            <div className="flex gap-2">
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
                    onClick={() => handleExerciseNameChange(exercise.exercise_name)}
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
                onChange={(event) => handleExerciseNameChange(event.target.value)}
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
                      onClick={() => handleExerciseNameChange(name)}
                      className="whitespace-nowrap rounded-lg bg-card-elevated px-3 py-1.5 text-[11px] font-semibold text-text-muted hover:text-text-main transition"
                    >
                      {name}
                    </button>
                  ))}
                </div>
              ) : null}
            </label>

            {/* Machine used */}
            <label className="block min-w-0">
              <span className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.2em] text-text-muted">Machine Used</span>
              <input
                value={form.machineUsed}
                onChange={(event) => updateForm('machineUsed', event.target.value)}
                placeholder="Cable stack, plate-loaded press"
                className="h-14 w-full rounded-2xl bg-app-bg px-5 text-sm font-medium text-text-main outline-none border border-glass-border focus:border-accent-lime transition-colors"
              />
            </label>

            <label className="block min-w-0">
              <span className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.2em] text-text-muted">Date</span>
              <input
                required
                type="datetime-local"
                value={form.timestampLocal}
                onChange={(event) => updateForm('timestampLocal', event.target.value)}
                className="h-14 w-full rounded-2xl bg-app-bg px-5 text-sm font-medium text-text-main outline-none border border-glass-border focus:border-accent-lime transition-colors"
              />
            </label>

            {/* Muscles */}
            <div className="min-w-0">
              <span className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.2em] text-text-muted">Muscles</span>
              <div className="flex flex-wrap gap-2">
                {EXPLICIT_MUSCLE_LIST.map((muscle) => {
                  const isSelected = form.muscleGroups.includes(muscle);
                  return (
                    <button
                      type="button"
                      key={muscle}
                      onClick={() => {
                        setForm((current) => {
                          const has = current.muscleGroups.includes(muscle);
                          const nextGroups = has
                            ? current.muscleGroups.filter((m) => m !== muscle)
                            : [...current.muscleGroups, muscle];
                          
                          if (nextGroups.length === 0) nextGroups.push(muscle);
                          return { ...current, muscleGroups: nextGroups };
                        });
                      }}
                      className={`whitespace-nowrap rounded-lg px-3 py-2 text-xs font-bold transition ${
                        isSelected ? 'bg-text-main text-app-bg' : 'bg-card-elevated text-text-muted hover:text-text-main'
                      }`}
                    >
                      {muscle}
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
                        max="10"
                        step="0.5"
                        type="number"
                        inputMode="decimal"
                        placeholder="-"
                        value={set.rpe}
                        onChange={(event) => {
                          let val = event.target.value;
                          if (val !== '' && parseFloat(val) > 10) val = '10';
                          updateSet(index, 'rpe', val);
                        }}
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

            {/* Notes */}
            <label className="block">
              <span className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.2em] text-text-muted">Notes</span>
              <textarea
                value={form.customNotes}
                onChange={(event) => updateForm('customNotes', event.target.value)}
                rows="3"
                placeholder="Tempo, pain signals, setup cues"
                className="w-full resize-none rounded-xl bg-card-elevated px-4 py-3 text-sm font-medium text-text-main outline-none focus:ring-1 focus:ring-accent-lime"
              />
            </label>

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
    </div>
  );
}
