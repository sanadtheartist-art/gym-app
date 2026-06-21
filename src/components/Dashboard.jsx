import { useEffect, useMemo, useState } from 'react';
import { ChartNoAxesColumnIncreasing, Flame, Target, TrendingUp, Zap } from 'lucide-react';
import { loadWorkouts } from '../lib/offlineSync';
import { MUSCLE_GROUP_MAPPING } from '../data/muscles';

const toDateKey = (value) => {
  const date = new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

const monthTitle = (date) => date.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });

function MonthGrid({ monthOffset, activeDateKeys }) {
  const today = new Date();
  const monthDate = new Date(today.getFullYear(), today.getMonth() + monthOffset, 1);
  const daysInMonth = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).getDate();
  const firstDay = monthDate.getDay();
  const cells = [];

  for (let index = 0; index < firstDay; index += 1) {
    cells.push({ type: 'blank', id: `blank-${index}` });
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const key = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    cells.push({ type: 'day', id: key, active: activeDateKeys.has(key) });
  }

  return (
    <div className="min-w-[164px]">
      <p className="mb-3 text-[10px] font-semibold text-text-muted tracking-wider">{monthTitle(monthDate)}</p>
      <div className="grid grid-cols-7 gap-[3px]">
        {cells.map((cell, i) => (
          <span
            key={cell.id}
            className={`h-[14px] w-[14px] rounded-[3px] transition-all duration-300 ${
              cell.type === 'blank'
                ? 'bg-transparent'
                : cell.active
                  ? 'bg-accent-lime shadow-[0_0_6px_rgba(200,255,0,0.3)]'
                  : 'bg-card-bg'
            }`}
            style={{ animationDelay: `${i * 15}ms` }}
          />
        ))}
      </div>
    </div>
  );
}

const MUSCLE_GROUPS = [
  'Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps',
  'Legs', 'Glutes', 'Core', 'Calves'
];

const MUSCLE_ALIAS_LOOKUP = new Map(
  Object.entries(MUSCLE_GROUP_MAPPING).flatMap(([group, aliases]) =>
    aliases.map((alias) => [alias.toLowerCase(), group])
  )
);

const normalizeMuscleValue = (value) => {
  const raw = (value || '').trim().toLowerCase();
  if (!raw) return null;

  if (MUSCLE_ALIAS_LOOKUP.has(raw)) {
    return MUSCLE_ALIAS_LOOKUP.get(raw);
  }

  for (const [alias, group] of MUSCLE_ALIAS_LOOKUP.entries()) {
    if (raw.includes(alias) || alias.includes(raw)) {
      return group;
    }
  }

  return raw;
};

const getWorkoutMuscleGroups = (workout) => {
  if (!workout?.muscle_group) return [];

  return [...new Set(
    workout.muscle_group
      .split(',')
      .map((item) => normalizeMuscleValue(item))
      .filter(Boolean)
  )];
};

function muscleColor(daysSince) {
  if (daysSince === null) return { bg: 'bg-card-bg', text: 'text-text-muted', dot: 'bg-text-muted/30' };
  if (daysSince <= 1) return { bg: 'bg-accent-lime/10', text: 'text-accent-lime', dot: 'bg-accent-lime' };
  if (daysSince <= 3) return { bg: 'bg-text-main/8', text: 'text-text-main', dot: 'bg-text-main' };
  if (daysSince <= 5) return { bg: 'bg-accent-orange/10', text: 'text-accent-orange', dot: 'bg-accent-orange' };
  return { bg: 'bg-quiet-red/10', text: 'text-quiet-red', dot: 'bg-quiet-red' };
}

function WeeklyGoalRing({ done, goal }) {
  const pct = Math.min(done / goal, 1);
  const radius = 30;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - pct);
  const isComplete = done >= goal;

  return (
    <div className="relative grid h-[80px] w-[80px] place-items-center">
      <svg className="absolute inset-0" width="80" height="80" viewBox="0 0 80 80">
        <circle cx="40" cy="40" r={radius} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="5" />
        <circle
          cx="40" cy="40" r={radius} fill="none"
          stroke={isComplete ? '#C8FF00' : '#FF6B2C'}
          strokeWidth="5"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          className="progress-ring-circle"
        />
      </svg>
      <span className="text-sm font-bold text-text-main leading-tight text-center number-animate">
        {done}<span className="text-text-muted font-normal text-xs">/{goal}</span>
      </span>
    </div>
  );
}

function VolumeSparkline({ workouts }) {
  const data = useMemo(() => {
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = toDateKey(d);
      const vol = workouts
        .filter(w => toDateKey(w.timestamp) === key)
        .reduce((sum, w) => {
          const s = Number(w.sets) || 0;
          const r = Number(w.reps) || 0;
          const wt = Number(w.weight_kg) || 0;
          return sum + s * r * wt;
        }, 0);
      days.push(vol);
    }
    return days;
  }, [workouts]);

  const max = Math.max(...data, 1);

  return (
    <div className="flex items-end gap-[3px] h-8">
      {data.map((v, i) => (
        <div
          key={i}
          className="w-[4px] rounded-full bg-accent-lime/60 transition-all duration-500"
          style={{
            height: `${Math.max((v / max) * 100, 8)}%`,
            animationDelay: `${i * 50}ms`,
          }}
        />
      ))}
    </div>
  );
}

export default function Dashboard({ activeSplit, onOpenInput, onOpenPortability, refreshKey }) {
  const [workouts, setWorkouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [weeklyGoal, setWeeklyGoal] = useState(() => {
    return parseInt(localStorage.getItem('weeklyGoal') || '5', 10);
  });
  const [editingGoal, setEditingGoal] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function loadDashboard() {
      setLoading(true);
      const data = await loadWorkouts();
      if (isMounted) {
        setWorkouts(data || []);
        setLoading(false);
      }
    }

    loadDashboard();
    return () => { isMounted = false; };
  }, [refreshKey]);

  const activeDateKeys = useMemo(() => new Set(workouts.map((w) => toDateKey(w.timestamp))), [workouts]);

  // --- Streak Calculation ---
  const streak = useMemo(() => {
    if (activeDateKeys.size === 0) return 0;
    const today = new Date();
    let count = 0;
    let cursor = new Date(today);

    while (true) {
      const key = toDateKey(cursor);
      if (activeDateKeys.has(key)) {
        count += 1;
        cursor.setDate(cursor.getDate() - 1);
      } else if (count === 0) {
        cursor.setDate(cursor.getDate() - 1);
        const yesterKey = toDateKey(cursor);
        if (activeDateKeys.has(yesterKey)) {
          count += 1;
          cursor.setDate(cursor.getDate() - 1);
        } else {
          break;
        }
      } else {
        break;
      }
    }
    return count;
  }, [activeDateKeys]);

  // --- Weekly Workouts This Week ---
  const weeklyCount = useMemo(() => {
    const now = new Date();
    const startOfWeek = new Date(now);
    const day = now.getDay();
    const diffToMonday = (day + 6) % 7;
    startOfWeek.setDate(now.getDate() - diffToMonday);
    startOfWeek.setHours(0, 0, 0, 0);

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 7);

    return workouts.filter((w) => {
      const timestamp = new Date(w.timestamp);
      return !Number.isNaN(timestamp.getTime()) && timestamp >= startOfWeek && timestamp < endOfWeek;
    }).length;
  }, [workouts]);

  // --- Muscle Recency ---
  const muscleRecency = useMemo(() => {
    const now = new Date();
    const result = {};

    MUSCLE_GROUPS.forEach((muscle) => {
      const lastWorkout = [...workouts]
        .filter((w) => getWorkoutMuscleGroups(w).includes(muscle))
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0];

      if (!lastWorkout) {
        result[muscle] = null;
      } else {
        const diff = now - new Date(lastWorkout.timestamp);
        result[muscle] = Math.floor(diff / (1000 * 60 * 60 * 24));
      }
    });

    return result;
  }, [workouts]);

  // --- Today's Focus (muscles needing attention) ---
  const todaysFocus = useMemo(() => {
    const sorted = MUSCLE_GROUPS
      .map(muscle => ({ muscle, days: muscleRecency[muscle] }))
      .filter(m => m.days === null || m.days >= 3)
      .sort((a, b) => {
        if (a.days === null && b.days === null) return 0;
        if (a.days === null) return -1;
        if (b.days === null) return 1;
        return b.days - a.days;
      })
      .slice(0, 4);
    return sorted;
  }, [muscleRecency]);

  // --- Quick Stats ---
  const totalWorkouts = workouts.length;

  const topMuscle = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);
    const counts = {};

    workouts
      .filter((w) => new Date(w.timestamp) >= cutoff && w.muscle_group)
      .forEach((w) => {
        getWorkoutMuscleGroups(w).forEach((muscle) => {
          counts[muscle] = (counts[muscle] || 0) + 1;
        });
      });

    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    return sorted[0]?.[0] || '—';
  }, [workouts]);

  const sevenDayVolume = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - 6);

    return workouts
      .filter((w) => new Date(w.timestamp) >= start)
      .reduce((sum, w) => {
        const sets = Number(w.sets) || 0;
        const reps = Number(w.reps) || 0;
        const weightKg = Number(w.weight_kg) || 0;
        return sum + sets * reps * weightKg;
      }, 0);
  }, [workouts]);

  return (
    <section className="mx-auto w-full max-w-3xl px-4 pb-28 pt-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-text-muted">Overview</p>
          <h1 className="mt-0.5 text-3xl font-extrabold text-text-main">Workouts</h1>
        </div>
      </div>

      {/* Bento Grid Row 1 */}
      <div className="mt-5 grid grid-cols-2 gap-3 stagger-children">
        {/* Routine Card — Orange Accent */}
        <button
          type="button"
          onClick={onOpenInput}
          className="min-h-[140px] rounded-card glass-card-orange p-5 text-left active:scale-[0.98]"
        >
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/70">Routine</p>
          <p className="mt-6 text-2xl font-extrabold leading-tight text-white">
            {activeSplit?.name || 'Quick Log'}
          </p>
          <p className="mt-1 text-xs font-medium text-white/60">Tap to start</p>
        </button>

        {/* All-Time Stats */}
        <div className="min-h-[140px] rounded-card glass-card p-5 flex flex-col justify-between">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-text-muted">All-Time</p>
          <div>
            <p className="text-3xl font-extrabold text-text-main number-animate">{loading ? '—' : totalWorkouts.toLocaleString()}</p>
            <p className="mt-0.5 text-xs text-text-muted">sets logged</p>
          </div>
          <p className="text-[10px] font-semibold text-text-muted truncate">
            Top 30d: <span className="text-accent-lime">{loading ? '—' : topMuscle}</span>
          </p>
        </div>
      </div>

      {/* Bento Grid Row 2 — Streak + Weekly */}
      <div className="mt-3 grid grid-cols-2 gap-3 stagger-children">
        {/* Streak */}
        <div className="rounded-card glass-card p-5 flex flex-col justify-between">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-text-muted">Streak</p>
          <div className="mt-3 flex items-center gap-2">
            <div className={`grid h-10 w-10 place-items-center rounded-xl ${streak > 0 ? 'bg-accent-orange/15' : 'bg-card-elevated'}`}>
              <Flame size={22} className={streak > 0 ? 'text-accent-orange' : 'text-text-muted'} />
            </div>
            <span className="text-3xl font-extrabold text-text-main number-animate">{streak}</span>
            <span className="text-text-muted text-xs font-medium">days</span>
          </div>
        </div>

        {/* Weekly Goal */}
        <div className="rounded-card glass-card p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-text-muted">This Week</p>
            <button
              type="button"
              onClick={() => setEditingGoal(v => !v)}
              className="grid h-7 w-7 place-items-center rounded-md text-text-muted transition hover:text-text-main active:scale-95 bg-card-elevated"
            >
              <Target size={13} />
            </button>
          </div>
          {editingGoal ? (
            <div className="mt-3">
              <input
                type="number"
                min="1"
                max="14"
                value={weeklyGoal}
                onChange={e => {
                  const val = parseInt(e.target.value, 10);
                  if (val > 0) {
                    setWeeklyGoal(val);
                    localStorage.setItem('weeklyGoal', String(val));
                  }
                }}
                className="w-full rounded-xl bg-app-bg px-3 py-2 text-center text-lg font-bold text-text-main outline-none"
              />
              <p className="text-center text-[10px] text-text-muted mt-1">workouts/week goal</p>
            </div>
          ) : (
            <div className="mt-2 flex items-center gap-3">
              <WeeklyGoalRing done={weeklyCount} goal={weeklyGoal} />
              <div>
                <p className="text-xl font-extrabold text-text-main number-animate">{weeklyCount}</p>
                <p className="text-[10px] text-text-muted">of {weeklyGoal} goal</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Today's Focus */}
      {todaysFocus.length > 0 && (
        <div className="mt-3 rounded-card glass-card p-5">
          <div className="flex items-center gap-2 mb-3">
            <Zap size={16} className="text-accent-lime" />
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-text-muted">Today's Focus</p>
          </div>
          <div className="flex flex-wrap gap-2 pb-1">
            {todaysFocus.map(({ muscle, days }) => (
              <span
                key={muscle}
                className="whitespace-nowrap rounded-lg bg-accent-lime/8 border border-accent-lime/15 px-3 py-2 text-xs font-bold text-accent-lime"
              >
                {muscle}
                <span className="ml-1.5 text-text-muted font-medium">
                  {days === null ? 'Never' : `${days}d ago`}
                </span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Muscle Frequency Widget */}
      <div className="mt-3 rounded-card glass-card p-5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-text-muted mb-3">Muscle Recency</p>
        <div className="flex flex-wrap gap-2">
          {MUSCLE_GROUPS.map(muscle => {
            const days = muscleRecency[muscle];
            const colors = muscleColor(days);
            return (
              <span
                key={muscle}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold ${colors.bg} ${colors.text}`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${colors.dot}`} />
                {muscle}
                {days !== null ? <span className="text-text-muted/70 font-medium">{days}d</span> : null}
              </span>
            );
          })}
        </div>
        <div className="mt-3 flex items-center gap-4 text-[10px] text-text-muted">
          <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-accent-lime" /> ≤1d</span>
          <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-text-main" /> ≤3d</span>
          <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-accent-orange" /> ≤5d</span>
          <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-quiet-red" /> 6d+</span>
        </div>
      </div>

      {/* Consistency Calendar */}
      <div className="mt-3 rounded-card glass-card p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-text-muted">Consistency</p>
            <p className="mt-1 text-lg font-bold text-text-main">{loading ? 'Syncing' : `${activeDateKeys.size} active days`}</p>
          </div>
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-card-elevated">
            <ChartNoAxesColumnIncreasing className="text-text-muted" size={18} />
          </div>
        </div>
        <div className="mt-4 flex flex-col gap-4 pb-1">
          <MonthGrid monthOffset={-1} activeDateKeys={activeDateKeys} />
          <MonthGrid monthOffset={0} activeDateKeys={activeDateKeys} />
        </div>
      </div>

      {/* Rolling Volume */}
      <div className="mt-3 rounded-card glass-card p-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-text-muted">Rolling 7-Day Volume</p>
          <div className="grid h-8 w-8 place-items-center rounded-xl bg-card-elevated">
            <TrendingUp size={14} className="text-accent-lime" />
          </div>
        </div>
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-3xl font-extrabold text-text-main number-animate">{Math.round(sevenDayVolume).toLocaleString()}</p>
            <p className="mt-0.5 text-xs text-text-muted">kg total tonnage</p>
          </div>
          <VolumeSparkline workouts={workouts} />
        </div>
      </div>
    </section>
  );
}
