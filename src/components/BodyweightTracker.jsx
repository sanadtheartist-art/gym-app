import { useEffect, useState } from 'react';
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Plus } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { queueSyncData } from '../lib/offlineSync';

const tooltipStyle = {
  background: '#1A1A1A',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: '12px',
  color: '#F0F0F0',
  fontSize: '12px',
  boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
};

export default function BodyweightTracker({ refreshKey }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [weight, setWeight] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      const { data: records } = await supabase
        .from('body_metrics')
        .select('timestamp, bodyweight_kg')
        .not('bodyweight_kg', 'is', null)
        .order('timestamp', { ascending: true });

      if (isMounted && records) {
        setData(
          records.map((r) => ({
            date: new Date(r.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
            weight: r.bodyweight_kg,
          }))
        );
      }
      if (isMounted) setLoading(false);
    }
    loadData();
    return () => { isMounted = false; };
  }, [refreshKey]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const val = parseFloat(weight);
    if (!val || val <= 0) return;

    setSubmitting(true);
    const payload = {
      timestamp: new Date().toISOString(),
      bodyweight_kg: val,
    };
    if (navigator.onLine) {
      await supabase.from('body_metrics').insert(payload);
    } else {
      await queueSyncData('body_metrics', payload);
    }
    setWeight('');
    
    // Optimistic update
    setData(prev => [...prev, { date: new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric' }), weight: val }]);
    setSubmitting(false);
  };

  const currentWeight = data.length > 0 ? data[data.length - 1].weight : null;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-extrabold text-text-main">Bodyweight</h2>
          <p className="text-[10px] text-text-muted">Trend over time</p>
        </div>
        {currentWeight && (
          <div className="text-right">
            <span className="text-2xl font-extrabold text-accent-lime number-animate">{currentWeight}</span>
            <span className="ml-1 text-xs text-text-muted">kg</span>
          </div>
        )}
      </div>

      <div className="mb-4 h-48 rounded-card glass-card p-3">
        {loading ? (
          <div className="grid h-full place-items-center text-text-muted shimmer-bg rounded-xl">Loading chart...</div>
        ) : data.length > 1 ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 10, right: 0, bottom: 0, left: -25 }}>
              <XAxis dataKey="date" tick={{ fill: '#6B6B6B', fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis domain={['auto', 'auto']} tick={{ fill: '#6B6B6B', fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: '#6B6B6B', marginBottom: '4px' }} />
              <Area
                type="monotone"
                dataKey="weight"
                name="Weight (kg)"
                stroke="#C8FF00"
                strokeWidth={2.5}
                fill="url(#limeGradientBW)"
                activeDot={{ r: 5, fill: '#C8FF00', stroke: '#C8FF00' }}
              />
              <defs>
                <linearGradient id="limeGradientBW" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#C8FF00" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#C8FF00" stopOpacity={0.02} />
                </linearGradient>
              </defs>
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="grid h-full place-items-center text-center text-sm text-text-muted">
            Log at least two weigh-ins to see your trend
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="number"
          step="0.1"
          placeholder="New weight (kg)"
          value={weight}
          onChange={(e) => setWeight(e.target.value)}
          className="h-12 flex-1 rounded-xl glass-card px-4 text-sm font-medium text-text-main outline-none focus:border-accent-lime transition"
        />
        <button
          type="submit"
          disabled={submitting || !weight}
          className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-card-elevated text-text-main transition active:scale-95 disabled:opacity-50 hover:text-accent-lime hover:bg-white/10"
        >
          <Plus size={18} />
        </button>
      </form>
    </div>
  );
}
