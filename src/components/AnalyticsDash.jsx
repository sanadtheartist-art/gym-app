import { useEffect, useMemo, useState } from 'react';
import { Activity, Trophy, X } from 'lucide-react';
import BodyweightTracker from './BodyweightTracker';
import MeasurementsTracker from './MeasurementsTracker';
import {
  Area,
  ComposedChart,
  Line,
  Legend,
  CartesianGrid,
  PolarGrid,
  PolarAngleAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { supabase } from '../lib/supabase';

const keyForDate = (value) => {
  const date = new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

const tooltipStyle = {
  background: '#1A1A1A',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: '12px',
  color: '#F0F0F0',
  fontSize: '12px',
  boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
};

export default function AnalyticsDash({ refreshKey }) {
  const [workouts, setWorkouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedMuscle, setSelectedMuscle] = useState('All');
  const [timeframe, setTimeframe] = useState('All');
  const [selectedPrExercise, setSelectedPrExercise] = useState(null);

  useEffect(() => {
    let isMounted = true;

    async function loadAnalytics() {
      setLoading(true);
      const { data, error } = await supabase
        .from('workouts')
        .select('timestamp, sets, reps, weight_kg, sets_data, muscle_group, exercise_name')
        .order('timestamp', { ascending: true })
        .limit(1000);

      if (!isMounted) return;
      setWorkouts(error ? [] : data || []);
      setLoading(false);
    }

    loadAnalytics();
    return () => {
      isMounted = false;
    };
  }, [refreshKey]);

  const { allMuscles, prs } = useMemo(() => {
    const muscleSet = new Set();
    const prMap = new Map();
    const exerciseNameMap = new Map(); // Map normalized name -> original name

    workouts.forEach((workout) => {
      if (workout.muscle_group) {
        workout.muscle_group.split(',').forEach(m => muscleSet.add(m.trim()));
      }

      if (workout.exercise_name) {
        const normalized = workout.exercise_name.trim().toLowerCase();
        
        // Keep track of the first original name we see for each normalized name
        if (!exerciseNameMap.has(normalized)) {
          exerciseNameMap.set(normalized, workout.exercise_name.trim());
        }
        
        let max1RM = 0;
        if (workout.sets_data && workout.sets_data.length > 0) {
          workout.sets_data.forEach(set => {
            if (set.type === 'W') return;
            const w = Number(set.weight_kg || set.weight) || 0;
            const r = Number(set.reps) || 0;
            const e1rm = w * (1 + r / 30);
            if (e1rm > max1RM) max1RM = e1rm;
          });
        } else {
          const w = Number(workout.weight_kg) || 0;
          const r = Number(workout.reps) || 0;
          max1RM = w * (1 + r / 30);
        }
        
        const currentPr = prMap.get(normalized) || 0;
        if (max1RM > currentPr) prMap.set(normalized, max1RM);
      }
    });

    const prs = Array.from(prMap.entries())
      .map(([normalized, maxWeight]) => ({ 
        exercise: exerciseNameMap.get(normalized), 
        maxWeight 
      }))
      .sort((a, b) => b.maxWeight - a.maxWeight);

    return { allMuscles: ['All', ...Array.from(muscleSet).sort()], prs };
  }, [workouts]);

  const filteredWorkouts = useMemo(() => {
    let result = workouts;
    if (selectedMuscle !== 'All') {
      result = result.filter(w => w.muscle_group && w.muscle_group.includes(selectedMuscle));
    }
    
    if (timeframe !== 'All') {
      const cutoff = new Date();
      if (timeframe === '1M') cutoff.setMonth(cutoff.getMonth() - 1);
      else if (timeframe === '3M') cutoff.setMonth(cutoff.getMonth() - 3);
      else if (timeframe === '6M') cutoff.setMonth(cutoff.getMonth() - 6);
      else if (timeframe === 'YTD') {
        cutoff.setMonth(0, 1);
        cutoff.setHours(0, 0, 0, 0);
      }
      result = result.filter(w => new Date(w.timestamp) >= cutoff);
    }
    
    return result;
  }, [workouts, selectedMuscle, timeframe]);

  const chartData = useMemo(() => {
    const dataMap = new Map();

    filteredWorkouts.forEach((workout) => {
      const key = keyForDate(workout.timestamp);
      let tonnage = 0;
      let totalSets = 0;
      let totalReps = 0;

      if (workout.sets_data && workout.sets_data.length > 0) {
        workout.sets_data.forEach(set => {
          if (set.type === 'W') return;
          totalSets += 1;
          totalReps += Number(set.reps) || 0;
          tonnage += (Number(set.reps) || 0) * (Number(set.weight_kg || set.weight) || 0);
        });
      } else {
        totalSets = Number(workout.sets) || 0;
        const reps = Number(workout.reps) || 0;
        const weight = Number(workout.weight_kg) || 0;
        totalReps = totalSets * reps;
        tonnage = totalSets * reps * weight;
      }

      if (!dataMap.has(key)) {
        dataMap.set(key, { tonnage: 0, sets: 0, reps: 0 });
      }

      const current = dataMap.get(key);
      current.tonnage += tonnage;
      current.sets += totalSets;
      current.reps += totalReps;
    });

    return Array.from(dataMap.entries()).map(([date, metrics]) => ({
      date: date.slice(5),
      tonnage: Math.round(metrics.tonnage),
      sets: metrics.sets,
      reps: metrics.reps,
    }));
  }, [filteredWorkouts]);

  const prChartData = useMemo(() => {
    if (!selectedPrExercise) return [];
    
    const dataPoints = [];
    const normalizedSelected = selectedPrExercise.trim().toLowerCase();
    
    workouts.forEach(w => {
      const normalizedExercise = (w.exercise_name || '').trim().toLowerCase();
      if (normalizedExercise !== normalizedSelected) return;
      
      let max1RM = 0;
      if (w.sets_data && w.sets_data.length > 0) {
        w.sets_data.forEach(set => {
          if (set.type === 'W') return;
          const wt = Number(set.weight_kg || set.weight) || 0;
          const r = Number(set.reps) || 0;
          const e1rm = wt * (1 + r / 30);
          if (e1rm > max1RM) max1RM = e1rm;
        });
      } else {
        const wt = Number(w.weight_kg) || 0;
        const r = Number(w.reps) || 0;
        max1RM = wt * (1 + r / 30);
      }
      
      if (max1RM > 0) {
        const dateObj = new Date(w.timestamp);
        const dateLabel = `${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`;
        dataPoints.push({
          date: dateLabel,
          e1rm: Math.round(max1RM),
          timestamp: dateObj.getTime()
        });
      }
    });
    
    // Sort by timestamp
    dataPoints.sort((a, b) => a.timestamp - b.timestamp);
    return dataPoints;
  }, [selectedPrExercise, workouts]);

  const totalVolume = chartData.reduce((sum, day) => sum + day.tonnage, 0);
  const peakDay = chartData.reduce((max, day) => Math.max(max, day.tonnage), 0);

  const radarData = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);
    const RADAR_MUSCLES = [
      { label: 'Chest', keys: ['chest', 'upper chest', 'lower chest'] },
      { label: 'Back', keys: ['back', 'lats', 'traps', 'rhomboids'] },
      { label: 'Shoulders', keys: ['shoulders', 'delt', 'shoulder'] },
      { label: 'Biceps', keys: ['biceps', 'bicep'] },
      { label: 'Triceps', keys: ['triceps', 'tricep'] },
      { label: 'Legs', keys: ['legs', 'quads', 'hamstrings', 'leg'] },
      { label: 'Glutes', keys: ['glutes', 'glute'] },
      { label: 'Core', keys: ['core', 'abs', 'abdominals'] },
    ];
    const totals = {};
    RADAR_MUSCLES.forEach(({ label }) => { totals[label] = 0; });

    workouts.filter(w => new Date(w.timestamp) >= cutoff && w.muscle_group).forEach(w => {
      const mg = w.muscle_group.toLowerCase();
      RADAR_MUSCLES.forEach(({ label, keys }) => {
        if (keys.some(k => mg.includes(k))) {
          let vol = 0;
          if (w.sets_data?.length) {
            w.sets_data.forEach(s => {
              if (s.type !== 'W') vol += (Number(s.reps) || 0) * (Number(s.weight_kg || s.weight) || 0);
            });
          } else {
            vol = (Number(w.sets) || 0) * (Number(w.reps) || 0) * (Number(w.weight_kg) || 0);
          }
          totals[label] += vol;
        }
      });
    });

    const maxVal = Math.max(...Object.values(totals), 1);
    return RADAR_MUSCLES.map(({ label }) => ({
      muscle: label,
      volume: Math.round((totals[label] / maxVal) * 100),
    }));
  }, [workouts]);

  return (
    <section className="mx-auto w-full max-w-3xl px-4 pb-28 pt-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-text-muted">Analytics</p>
          <h1 className="mt-0.5 text-3xl font-extrabold text-text-main">Load Curve</h1>
        </div>
        <div className="grid h-11 w-11 place-items-center rounded-xl glass-card text-accent-orange">
          <Activity size={21} />
        </div>
      </div>

      {/* Filters (Muscle & Timeframe) */}
      <div className="mt-5 flex flex-col gap-3">
        {/* Muscle Filter */}
        <div className="flex flex-wrap gap-2 pb-1">
          {allMuscles.map(muscle => (
            <button
              key={muscle}
              type="button"
              onClick={() => setSelectedMuscle(muscle)}
              className={`whitespace-nowrap rounded-lg px-3.5 py-2 text-xs font-bold transition ${
                selectedMuscle === muscle
                  ? 'glass-card-lime text-app-bg'
                  : 'glass-card text-text-muted hover:text-text-main'
              }`}
            >
              {muscle}
            </button>
          ))}
        </div>
        
        {/* Timeframe Filter */}
        <div className="flex gap-2">
          {['1M', '3M', '6M', 'YTD', 'All'].map(tf => (
            <button
              key={tf}
              type="button"
              onClick={() => setTimeframe(tf)}
              className={`rounded-lg px-3 py-1.5 text-[11px] font-bold transition ${
                timeframe === tf
                  ? 'bg-text-main text-app-bg'
                  : 'bg-card-elevated text-text-muted hover:text-text-main'
              }`}
            >
              {tf}
            </button>
          ))}
        </div>
      </div>

      {/* Stat Cards */}
      <div className="mt-5 grid grid-cols-2 gap-3 stagger-children">
        <div className="rounded-card glass-card p-5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-text-muted">Total</p>
          <p className="mt-3 text-3xl font-extrabold text-text-main number-animate">{Math.round(totalVolume).toLocaleString()}</p>
          <p className="mt-0.5 text-xs text-text-muted">kg volume</p>
        </div>
        <div className="rounded-card glass-card p-5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-text-muted">Peak Day</p>
          <p className="mt-3 text-3xl font-extrabold text-accent-orange number-animate">{Math.round(peakDay).toLocaleString()}</p>
          <p className="mt-0.5 text-xs text-text-muted">kg volume</p>
        </div>
      </div>

      {/* Main Chart */}
      <div className="mt-3 h-[360px] rounded-card glass-card p-4">
        {loading ? (
          <div className="grid h-full place-items-center text-text-muted shimmer-bg rounded-xl">Loading chart</div>
        ) : chartData.length ? (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 20, right: 12, bottom: 8, left: -20 }}>
              <CartesianGrid stroke="rgba(255,255,255,0.04)" vertical={false} />
              <XAxis dataKey="date" tick={{ fill: '#6B6B6B', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis yAxisId="left" tick={{ fill: '#6B6B6B', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis yAxisId="right" orientation="right" tick={{ fill: '#6B6B6B', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: '#6B6B6B', marginBottom: '8px' }} />
              <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: '11px', color: '#6B6B6B' }} />
              
              <Area
                yAxisId="left"
                type="monotone"
                dataKey="tonnage"
                name="Volume (kg)"
                stroke="#FF6B2C"
                strokeWidth={2.5}
                fill="url(#orangeGradient)"
                activeDot={{ r: 5, fill: '#FF6B2C', stroke: '#FF6B2C' }}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="sets"
                name="Total Sets"
                stroke="#C8FF00"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 5 }}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="reps"
                name="Total Reps"
                stroke="#60A5FA"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 5 }}
              />
              <defs>
                <linearGradient id="orangeGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#FF6B2C" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#FF6B2C" stopOpacity={0.02} />
                </linearGradient>
              </defs>
            </ComposedChart>
          </ResponsiveContainer>
        ) : (
          <div className="grid h-full place-items-center text-center text-text-muted">
            Log workouts to build the curve
          </div>
        )}
      </div>

      {/* Personal Records */}
      <div className="mt-8">
        <div className="flex items-center gap-2 mb-4">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-accent-orange/15">
            <Trophy size={16} className="text-accent-orange" />
          </div>
          <div>
            <h2 className="text-lg font-extrabold text-text-main">Personal Records</h2>
            <p className="text-[10px] text-text-muted">Estimated 1RM</p>
          </div>
        </div>
        
        <div className="grid gap-2 sm:grid-cols-2 stagger-children">
          {prs.length > 0 ? prs.map((pr, i) => (
            <button
              type="button"
              key={pr.exercise}
              onClick={() => setSelectedPrExercise(pr.exercise)}
              className="flex items-center justify-between rounded-card glass-card p-4 transition active:scale-[0.98] text-left"
              style={{ animationDelay: `${i * 50}ms` }}
            >
              <span className="font-semibold text-text-main truncate pr-4">{pr.exercise}</span>
              <span className="shrink-0 text-lg font-extrabold text-accent-lime">{Math.round(pr.maxWeight)} kg</span>
            </button>
          )) : (
            <p className="text-text-muted col-span-2">No PRs recorded yet.</p>
          )}
        </div>
      </div>

      {/* Bodyweight Tracker */}
      <div className="mt-8 border-t border-glass-border pt-8">
        <BodyweightTracker refreshKey={refreshKey} />
      </div>

      {/* Measurements Tracker */}
      <div className="mt-8 border-t border-glass-border pt-8">
        <MeasurementsTracker refreshKey={refreshKey} />
      </div>

      {/* Muscle Balance Radar */}
      <div className="mt-8 border-t border-glass-border pt-8">
        <div className="flex items-center gap-2 mb-4">
          <div>
            <h2 className="text-lg font-extrabold text-text-main">Muscle Balance</h2>
            <p className="text-[10px] text-text-muted">Last 30 days — relative volume</p>
          </div>
        </div>
        <div className="h-72 rounded-card glass-card p-4">
          {radarData.every(d => d.volume === 0) ? (
            <div className="grid h-full place-items-center text-center text-text-muted">Log workouts to see balance</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="70%">
                <PolarGrid stroke="rgba(255,255,255,0.06)" />
                <PolarAngleAxis dataKey="muscle" tick={{ fill: '#6B6B6B', fontSize: 11 }} />
                <Radar
                  name="Volume"
                  dataKey="volume"
                  stroke="#C8FF00"
                  fill="#C8FF00"
                  fillOpacity={0.12}
                  strokeWidth={2}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(value) => [`${value}%`, 'Relative Volume']}
                />
              </RadarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* PR Chart Modal */}
      {selectedPrExercise && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-md p-4 pb-20 sheet-overlay">
          <div className="w-full max-w-xl rounded-2xl glass-card p-6 shadow-xl sheet-content" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-text-muted">Progression</p>
                <h2 className="text-xl font-extrabold text-text-main">{selectedPrExercise}</h2>
              </div>
              <button
                type="button"
                onClick={() => setSelectedPrExercise(null)}
                className="grid h-10 w-10 place-items-center rounded-xl bg-app-bg text-text-main transition active:scale-95"
              >
                <X size={18} />
              </button>
            </div>
            
            <div className="h-64 w-full">
              {prChartData.length > 1 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={prChartData} margin={{ top: 10, right: 0, bottom: 0, left: -25 }}>
                    <CartesianGrid stroke="rgba(255,255,255,0.04)" vertical={false} />
                    <XAxis dataKey="date" tick={{ fill: '#6B6B6B', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#6B6B6B', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Area
                      type="monotone"
                      dataKey="e1rm"
                      name="Est. 1RM (kg)"
                      stroke="#C8FF00"
                      strokeWidth={2.5}
                      fill="url(#limeGradient)"
                      activeDot={{ r: 5, fill: '#C8FF00', stroke: '#C8FF00' }}
                    />
                    <defs>
                      <linearGradient id="limeGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#C8FF00" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="#C8FF00" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                  </ComposedChart>
                </ResponsiveContainer>
              ) : (
                <div className="grid h-full place-items-center text-center text-text-muted">
                  Need more than 1 workout log to show progression.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
