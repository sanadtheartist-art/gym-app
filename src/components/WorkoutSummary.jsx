import { useEffect, useRef, useState } from 'react';
import { Trophy, Dumbbell, Timer, Flame, CheckCircle, Share, Loader2, Zap } from 'lucide-react';
import { supabase } from '../lib/supabase';
import html2canvas from 'html2canvas';

export default function WorkoutSummary({ data, onClose }) {
  const [prBroken, setPrBroken] = useState(false);
  const [animating, setAnimating] = useState(false);
  const [sharing, setSharing] = useState(false);
  const cardRef = useRef(null);

  useEffect(() => {
    async function checkPR() {
      if (!data?.exercise_name) return;
      const { data: prev } = await supabase
        .from('workouts')
        .select('weight_kg, reps, sets_data')
        .eq('exercise_name', data.exercise_name)
        .lt('timestamp', data.timestamp)
        .order('timestamp', { ascending: false });

      if (!prev || prev.length === 0) { setPrBroken(true); return; }

      let maxBefore = 0;
      prev.forEach(w => {
        (w.sets_data?.length ? w.sets_data : [{ weight_kg: w.weight_kg, reps: w.reps }]).forEach(s => {
          if (s.type === 'W') return;
          const e = (s.weight_kg || s.weight || 0) * (1 + (s.reps || 0) / 30);
          if (e > maxBefore) maxBefore = e;
        });
      });

      let cur = 0;
      (data.sets_data?.length ? data.sets_data : [{ weight_kg: data.weight_kg, reps: data.reps }]).forEach(s => {
        if (s.type === 'W') return;
        const e = (s.weight_kg || s.weight || 0) * (1 + (s.reps || 0) / 30);
        if (e > cur) cur = e;
      });

      if (cur > maxBefore) setPrBroken(true);
    }

    checkPR();
    setTimeout(() => setAnimating(true), 80);
  }, [data]);

  if (!data) return null;

  let totalVolume = 0, totalSets = 0, maxWeight = 0, est1RM = 0;
  const sets = data.sets_data?.length ? data.sets_data : [];

  sets.forEach(s => {
    if (s.type === 'W') return;
    const w = s.weight_kg || s.weight || 0;
    const r = s.reps || 0;
    totalVolume += w * r;
    totalSets++;
    if (w > maxWeight) maxWeight = w;
    const e = w * (1 + r / 30);
    if (e > est1RM) est1RM = e;
  });

  if (!sets.length) {
    totalSets = data.sets || 0;
    maxWeight = data.weight_kg || 0;
    totalVolume = totalSets * (data.reps || 0) * maxWeight;
    est1RM = maxWeight * (1 + (data.reps || 0) / 30);
  }

  const durationMin = Math.round((data.session_duration_seconds || 0) / 60);
  const accentColor = prBroken ? 'var(--accent-secondary)' : 'var(--accent-primary)';

  const fallbackDownload = (blob) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Jexi_${data.exercise_name?.replace(/\s+/g, '_')}_${Date.now()}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleShare = async () => {
    const card = cardRef.current;
    if (!card) return;
    setSharing(true);

    const btnDiv = document.getElementById('summary-buttons');
    if (btnDiv) btnDiv.style.visibility = 'hidden';

    try {
      const canvas = await html2canvas(card, {
        scale: 2.5,
        useCORS: true,
        allowTaint: true,
        backgroundColor: null,
        logging: false,
      });

      if (btnDiv) btnDiv.style.visibility = 'visible';

      canvas.toBlob(async (blob) => {
        if (!blob) { setSharing(false); return; }
        const file = new File([blob], 'workout.png', { type: 'image/png' });
        const title = prBroken ? '🏆 New PR!' : '🔥 Workout Done!';
        const text = `${data.exercise_name} — ${totalSets} sets, ${Math.round(totalVolume)}kg volume`;

        if (navigator.canShare?.({ files: [file] })) {
          try { await navigator.share({ files: [file], title, text }); }
          catch (e) { if (e.name !== 'AbortError') fallbackDownload(blob); }
        } else {
          fallbackDownload(blob);
        }
        setSharing(false);
      }, 'image/png');
    } catch (err) {
      console.error(err);
      if (btnDiv) btnDiv.style.visibility = 'visible';
      setSharing(false);
    }
  };

  const Stat = ({ icon: Icon, value, label, accent }) => (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-glass-border bg-app-bg p-4 gap-1">
      <Icon size={18} style={{ color: accent || 'var(--text-muted)', marginBottom: 4 }} />
      <p className="text-2xl font-extrabold text-text-main font-mono leading-none number-animate">{value}</p>
      <p className="text-[9px] font-bold uppercase tracking-wider text-text-muted mt-0.5">{label}</p>
    </div>
  );

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/75 backdrop-blur-md pb-6 px-4 sm:items-center animate-fade-in">
      {/* The card — this is what gets screenshotted */}
      <div
        ref={cardRef}
        className={`w-full max-w-sm overflow-hidden rounded-[28px] glass-card shadow-2xl transition-all duration-600 ${
          animating ? 'translate-y-0 opacity-100' : 'translate-y-16 opacity-0'
        }`}
      >
        {/* ── Hero banner ─────────────────────────── */}
        <div
          className="relative flex h-44 items-center justify-center overflow-hidden bg-cover bg-center"
          style={
            data.media_url && !data.media_url.match(/\.(mp4|webm|ogg)$/i)
              ? { backgroundImage: `url(${data.media_url})` }
              : { background: `linear-gradient(135deg, var(--card-bg) 0%, var(--card-elevated) 100%)` }
          }
        >
          {/* Overlay gradient */}
          <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.25) 0%, rgba(0,0,0,0.6) 100%)' }} />

          {/* Accent glow blob */}
          <div className="absolute -top-8 -right-8 h-32 w-32 rounded-full blur-3xl opacity-50"
            style={{ background: accentColor }} />
          <div className="absolute -bottom-8 -left-8 h-24 w-24 rounded-full blur-3xl opacity-30"
            style={{ background: accentColor }} />

          <div className="relative z-10 flex flex-col items-center text-white drop-shadow-lg">
            <div
              className="mb-3 flex h-16 w-16 items-center justify-center rounded-2xl shadow-xl"
              style={{ background: accentColor }}
            >
              {prBroken
                ? <Trophy size={34} color="#000" strokeWidth={2.5} />
                : <CheckCircle size={34} color="#000" strokeWidth={2.5} />}
            </div>
            <h2 className="text-xl font-black uppercase tracking-wider leading-tight">
              {prBroken ? '🏆 New Record!' : 'Workout Complete'}
            </h2>
            <p className="mt-1 text-sm font-semibold opacity-75">{data.exercise_name}</p>
          </div>
        </div>

        {/* ── Stats ───────────────────────────────── */}
        <div className="p-5">
          {/* Muscle group label */}
          {data.muscle_group && (
            <p className="mb-4 text-center text-[11px] font-bold uppercase tracking-[0.18em] text-text-muted">
              {data.muscle_group}
            </p>
          )}

          <div className="grid grid-cols-2 gap-2.5 mb-5">
            <Stat icon={Dumbbell} value={Math.round(totalVolume)} label="Volume kg" />
            <Stat icon={Flame}    value={totalSets}              label="Working Sets" accent="var(--accent-secondary)" />
            <Stat icon={Trophy}   value={maxWeight}              label="Max Wt kg"    accent={prBroken ? accentColor : undefined} />
            <Stat icon={Zap}      value={Math.round(est1RM)}     label="Est. 1RM kg"  accent="var(--accent-primary)" />
          </div>

          {durationMin > 0 && (
            <div className="mb-4 flex items-center justify-center gap-2 rounded-xl bg-card-elevated px-4 py-2.5 border border-glass-border">
              <Timer size={14} className="text-text-muted" />
              <span className="text-sm font-bold text-text-main">{durationMin} min session</span>
            </div>
          )}

          {/* Branding watermark — shows in screenshot */}
          <p className="mb-4 text-center text-[10px] font-bold tracking-widest uppercase" style={{ color: accentColor, opacity: 0.7 }}>
            JEXI · Gym Tracker
          </p>

          {/* ── Buttons ── hidden during screenshot ── */}
          <div id="summary-buttons" className="flex gap-3">
            <button
              type="button"
              onClick={handleShare}
              disabled={sharing}
              className="flex-1 flex items-center justify-center gap-2 h-13 rounded-xl glass-card text-sm font-bold text-text-main transition active:scale-95 hover:bg-white/5 disabled:opacity-50 py-3.5"
            >
              {sharing ? <Loader2 size={17} className="animate-spin" /> : <Share size={17} />}
              {sharing ? 'Capturing…' : 'Share'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 h-13 rounded-xl text-sm font-extrabold text-app-bg transition active:scale-95 shadow-lg py-3.5"
              style={{ background: accentColor }}
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
