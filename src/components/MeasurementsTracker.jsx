import { useEffect, useState, useMemo } from 'react';
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

const SITE_COLORS = {
  Neck: '#A78BFA',     // Purple
  Shoulders: '#FF8F5C', // Orange light
  Chest: '#60A5FA',    // Blue
  Bicep: '#C8FF00',    // Lime
  Forearm: '#34D399',  // Emerald
  Waist: '#FF6B2C',    // Orange
  Hips: '#FBBF24',     // Amber
  Thigh: '#F472B6',    // Pink
  Calf: '#38BDF8',     // Sky
};

const SITES = Object.keys(SITE_COLORS);

export default function MeasurementsTracker({ refreshKey }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [site, setSite] = useState(SITES[5]); // Default to Waist
  const [measurement, setMeasurement] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [selectedSiteFilter, setSelectedSiteFilter] = useState(SITES[5]);

  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      const { data: records } = await supabase
        .from('body_metrics')
        .select('timestamp, site_measurements_cm')
        .not('site_measurements_cm', 'is', null)
        .order('timestamp', { ascending: true });

      if (isMounted && records) {
        setData(records);
      }
      if (isMounted) setLoading(false);
    }
    loadData();
    return () => { isMounted = false; };
  }, [refreshKey]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const val = parseFloat(measurement);
    if (!val || val <= 0) return;

    setSubmitting(true);
    const newRecord = {
      timestamp: new Date().toISOString(),
      site_measurements_cm: { [site]: val },
    };

    if (navigator.onLine) {
      await supabase.from('body_metrics').insert(newRecord);
    } else {
      await queueSyncData('body_metrics', newRecord);
    }
    setMeasurement('');
    setSelectedSiteFilter(site);
    
    // Optimistic update
    setData(prev => [...prev, newRecord]);
    setSubmitting(false);
  };

  const chartData = useMemo(() => {
    return data
      .filter((r) => r.site_measurements_cm && r.site_measurements_cm[selectedSiteFilter])
      .map((r) => ({
        date: new Date(r.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        value: r.site_measurements_cm[selectedSiteFilter],
      }));
  }, [data, selectedSiteFilter]);

  const activeColor = SITE_COLORS[selectedSiteFilter] || '#C8FF00';

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-extrabold text-text-main">Measurements</h2>
          <p className="text-[10px] text-text-muted">Circumference in cm</p>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-2 pb-1">
        {SITES.map((s) => (
          <button
            type="button"
            key={s}
            onClick={() => setSelectedSiteFilter(s)}
            className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-bold transition ${
              selectedSiteFilter === s
                ? 'bg-text-main text-app-bg'
                : 'glass-card text-text-muted hover:text-text-main'
            }`}
            style={{ 
              color: selectedSiteFilter === s ? '#0D0D0D' : undefined,
              backgroundColor: selectedSiteFilter === s ? SITE_COLORS[s] : undefined 
            }}
          >
            {s}
          </button>
        ))}
      </div>

      <div className="mb-4 h-48 rounded-card glass-card p-3 transition-colors duration-500" style={{ borderColor: `${activeColor}20` }}>
        {loading ? (
          <div className="grid h-full place-items-center text-text-muted shimmer-bg rounded-xl">Loading chart...</div>
        ) : chartData.length > 1 ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 0, bottom: 0, left: -25 }}>
              <XAxis dataKey="date" tick={{ fill: '#6B6B6B', fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis domain={['auto', 'auto']} tick={{ fill: '#6B6B6B', fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: '#6B6B6B', marginBottom: '4px' }} />
              <Area
                type="monotone"
                dataKey="value"
                name={`${selectedSiteFilter} (cm)`}
                stroke={activeColor}
                strokeWidth={2.5}
                fill={`url(#gradient-${selectedSiteFilter})`}
                activeDot={{ r: 5, fill: activeColor, stroke: activeColor }}
              />
              <defs>
                <linearGradient id={`gradient-${selectedSiteFilter}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={activeColor} stopOpacity={0.3} />
                  <stop offset="100%" stopColor={activeColor} stopOpacity={0.02} />
                </linearGradient>
              </defs>
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="grid h-full place-items-center text-center text-sm text-text-muted">
            Log at least two measurements for {selectedSiteFilter} to see trend
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2">
        <select
          value={site}
          onChange={(e) => setSite(e.target.value)}
          className="h-12 w-[110px] shrink-0 rounded-xl glass-card px-3 text-sm font-medium text-text-main outline-none appearance-none bg-app-bg"
        >
          {SITES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <input
          type="number"
          step="0.5"
          placeholder="Size (cm)"
          value={measurement}
          onChange={(e) => setMeasurement(e.target.value)}
          className="h-12 flex-1 rounded-xl glass-card px-4 text-sm font-medium text-text-main outline-none focus:border-accent-lime transition"
        />
        <button
          type="submit"
          disabled={submitting || !measurement}
          className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-card-elevated text-text-main transition active:scale-95 disabled:opacity-50 hover:text-accent-lime hover:bg-white/10"
        >
          <Plus size={18} />
        </button>
      </form>
    </div>
  );
}
