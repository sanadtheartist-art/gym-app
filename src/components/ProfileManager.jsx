import { useState, useRef, useEffect } from 'react';
import { X, Upload, User, Palette, LogOut, Check, Pencil, Target, Ruler, Scale, Trash2, AlertTriangle } from 'lucide-react';
import { supabase } from '../lib/supabase';

const THEMES = [
  { id: 'default',    name: 'Cyberpunk',  bg: '#0D0D0D', card: '#1A1A1A', accent: '#C8FF00', text: '#F0F0F0' },
  { id: 'ocean',      name: 'Ocean',      bg: '#060B19', card: '#0B132B', accent: '#00F0FF', text: '#E2E8F0' },
  { id: 'monochrome', name: 'Mono',       bg: '#000000', card: '#111111', accent: '#FFFFFF', text: '#FFFFFF' },
  { id: 'light',      name: 'Light',      bg: '#F0F4F8', card: '#FFFFFF', accent: '#059669', text: '#0D1117' },
  { id: 'retro',      name: 'Retro',      bg: '#12002A', card: '#1E0040', accent: '#FF2DF7', text: '#F0E6FF' },
  { id: 'newspaper',  name: 'Newspaper',  bg: '#FFFEF7', card: '#FAFAF2', accent: '#1C1C1C', text: '#1C1C1C' },
  { id: 'matrix',     name: 'Matrix',     bg: '#000A00', card: '#001500', accent: '#00FF41', text: '#00FF41' },
  { id: 'sunset',     name: 'Sunset',     bg: '#0F0616', card: '#1A0A24', accent: '#FF6B35', text: '#FFE4D6' },
  { id: 'arctic',     name: 'Arctic',     bg: '#071726', card: '#0D2136', accent: '#7ECFFF', text: '#E8F4FF' },
  { id: 'forest',     name: 'Forest',     bg: '#020E06', card: '#071A0D', accent: '#4ADE80', text: '#DCFCE7' },
  { id: 'volcanic',   name: 'Volcanic',   bg: '#0D0200', card: '#1A0600', accent: '#FF4500', text: '#FFD6B8' },
  { id: 'rose',       name: 'Rose',       bg: '#0F0008', card: '#1A0013', accent: '#FF6EB4', text: '#FFE4F0' },
  { id: 'slate',      name: 'Slate',      bg: '#0A0C10', card: '#131720', accent: '#94A3B8', text: '#E2E8F0' },
];

const FITNESS_GOALS = ['Build Muscle', 'Lose Fat', 'Increase Strength', 'Improve Endurance', 'Athletic Performance', 'General Fitness'];

const loadProfile = () => {
  try { return JSON.parse(localStorage.getItem('jexi_profile') || '{}'); } catch { return {}; }
};

const saveProfile = (data) => localStorage.setItem('jexi_profile', JSON.stringify(data));

export default function ProfileManager({ visible, onClose, session, onLogout }) {
  const fileInputRef = useRef(null);
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [avatarSvgContent, setAvatarSvgContent] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [currentTheme, setCurrentTheme] = useState('default');
  const [profile, setProfile] = useState({ age: '', weight: '', weightUnit: 'kg', height: '', heightUnit: 'cm', goal: '' });
  const [editingField, setEditingField] = useState(null);
  const [deleteStep, setDeleteStep] = useState(0); // 0=idle 1=warn 2=confirm
  const [deleteInput, setDeleteInput] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  useEffect(() => {
    if (!visible) return;
    const savedTheme = localStorage.getItem('jexi_theme') || 'default';
    setCurrentTheme(savedTheme);
    document.documentElement.setAttribute('data-theme', savedTheme);

    setAvatarUrl(localStorage.getItem('jexi_avatar'));
    setAvatarSvgContent(localStorage.getItem('jexi_avatar_svg'));

    const saved = loadProfile();
    setProfile(p => ({ ...p, ...saved }));
  }, [visible]);

  if (!visible || !session) return null;

  const handleThemeChange = (themeId) => {
    setCurrentTheme(themeId);
    document.documentElement.setAttribute('data-theme', themeId);
    localStorage.setItem('jexi_theme', themeId);
  };

  const handleDeleteAccount = async () => {
    if (deleteInput.trim().toUpperCase() !== 'DELETE') {
      setDeleteError('Type DELETE exactly to confirm.');
      return;
    }
    setDeleting(true);
    setDeleteError('');
    try {
      // Call the Supabase SECURITY DEFINER function that deletes the auth user
      // (cascades to all tables). Requires delete_account_function.sql to be run.
      const { error } = await supabase.rpc('delete_my_account');
      if (error) throw error;

      // Clear all local storage
      localStorage.removeItem('jexi_theme');
      localStorage.removeItem('jexi_avatar');
      localStorage.removeItem('jexi_avatar_svg');
      localStorage.removeItem('jexi_profile');

      // Sign out (session is now invalid)
      await supabase.auth.signOut();
    } catch (err) {
      setDeleting(false);
      setDeleteError(err.message?.includes('not exist') 
        ? 'Setup required: run delete_account_function.sql in Supabase dashboard first.'
        : err.message || 'Deletion failed. Try again.');
    }
  };

  const uploadAvatar = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const isSvg = file.type === 'image/svg+xml' || file.name.toLowerCase().endsWith('.svg');
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target.result;
      if (isSvg) {
        setAvatarSvgContent(result);
        setAvatarUrl(null);
        localStorage.setItem('jexi_avatar_svg', result);
        localStorage.removeItem('jexi_avatar');
      } else {
        setAvatarUrl(result);
        setAvatarSvgContent(null);
        localStorage.setItem('jexi_avatar', result);
        localStorage.removeItem('jexi_avatar_svg');
      }
      window.dispatchEvent(new Event('avatarUpdated'));
    };
    isSvg ? reader.readAsText(file) : reader.readAsDataURL(file);
    try {
      setUploading(true);
      const fileExt = file.name.split('.').pop();
      await supabase.storage.from('workout-media').upload(
        `avatars/avatar_${session.user.id}_${Date.now()}.${fileExt}`, file, { upsert: true }
      );
    } catch (e) { /* silent fail, local preview works */ } finally { setUploading(false); }
  };

  const updateProfile = (key, value) => {
    const updated = { ...profile, [key]: value };
    setProfile(updated);
    saveProfile(updated);
  };

  const username = session.user.email.split('@')[0];

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/80 backdrop-blur-md sheet-overlay">
      <div
        className="flex w-full max-w-md flex-col rounded-t-[32px] glass-card sheet-content border-b-0"
        style={{ maxHeight: '93dvh' }}
      >
        <div className="w-full flex-1 overflow-y-auto px-5 pt-4 pb-14">
          {/* Drag handle */}
          <div className="mx-auto mb-5 h-1.5 w-14 rounded-full bg-white/20" />

          {/* Header */}
          <div className="flex items-center justify-between mb-7">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-text-muted">Customize</p>
              <h2 className="mt-0.5 text-2xl font-extrabold text-text-main">Your Profile</h2>
            </div>
            <button onClick={onClose} className="grid h-10 w-10 place-items-center rounded-xl bg-card-elevated text-text-muted transition hover:text-text-main active:scale-95">
              <X size={18} />
            </button>
          </div>

          {/* Avatar + Name */}
          <div className="flex items-center gap-5 mb-8 p-4 rounded-2xl bg-card-elevated border border-glass-border">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="relative group flex-shrink-0 w-20 h-20 rounded-2xl overflow-hidden border-2 border-glass-border bg-card-elevated flex items-center justify-center transition hover:border-accent-primary hover:scale-105"
            >
              {avatarSvgContent ? (
                <div className="w-full h-full flex items-center justify-center p-1.5 [&>svg]:w-full [&>svg]:h-full" dangerouslySetInnerHTML={{ __html: avatarSvgContent }} />
              ) : avatarUrl ? (
                <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <User size={32} className="text-text-muted" />
              )}
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity rounded-2xl">
                <Upload size={20} className="text-white" />
              </div>
            </button>
            <input ref={fileInputRef} type="file" accept="image/*,.svg" className="hidden" onChange={uploadAvatar} disabled={uploading} />

            <div className="flex-1 min-w-0">
              <p className="text-lg font-extrabold text-text-main truncate">{username}</p>
              <p className="text-xs text-text-muted mt-0.5 truncate">{session.user.email}</p>
              <p className="text-[11px] text-accent-primary mt-1.5 font-medium">
                {uploading ? 'Syncing avatar…' : 'Tap to change avatar · SVG supported'}
              </p>
            </div>
          </div>

          {/* Profile Data */}
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <User size={14} className="text-accent-primary" />
              <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-text-muted">Body Stats</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {/* Age */}
              <div className="rounded-xl bg-card-elevated border border-glass-border p-3 flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted">Age</span>
                  <Pencil size={11} className="text-text-muted" />
                </div>
                <input
                  type="number"
                  min="10" max="100"
                  value={profile.age}
                  onChange={(e) => updateProfile('age', e.target.value)}
                  placeholder="—"
                  className="w-full bg-transparent text-xl font-extrabold text-text-main outline-none placeholder:text-text-muted/40"
                />
                <span className="text-[10px] text-text-muted">years</span>
              </div>

              {/* Weight */}
              <div className="rounded-xl bg-card-elevated border border-glass-border p-3 flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted">Weight</span>
                  <Scale size={11} className="text-text-muted" />
                </div>
                <input
                  type="number"
                  min="20" max="500"
                  value={profile.weight}
                  onChange={(e) => updateProfile('weight', e.target.value)}
                  placeholder="—"
                  className="w-full bg-transparent text-xl font-extrabold text-text-main outline-none placeholder:text-text-muted/40"
                />
                <div className="flex gap-2 mt-0.5">
                  {['kg', 'lbs'].map(u => (
                    <button key={u} onClick={() => updateProfile('weightUnit', u)}
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md transition ${profile.weightUnit === u ? 'bg-accent-primary text-app-bg' : 'text-text-muted'}`}>
                      {u}
                    </button>
                  ))}
                </div>
              </div>

              {/* Height */}
              <div className="rounded-xl bg-card-elevated border border-glass-border p-3 flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted">Height</span>
                  <Ruler size={11} className="text-text-muted" />
                </div>
                <input
                  type="number"
                  min="50" max="300"
                  value={profile.height}
                  onChange={(e) => updateProfile('height', e.target.value)}
                  placeholder="—"
                  className="w-full bg-transparent text-xl font-extrabold text-text-main outline-none placeholder:text-text-muted/40"
                />
                <div className="flex gap-2 mt-0.5">
                  {['cm', 'ft'].map(u => (
                    <button key={u} onClick={() => updateProfile('heightUnit', u)}
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md transition ${profile.heightUnit === u ? 'bg-accent-primary text-app-bg' : 'text-text-muted'}`}>
                      {u}
                    </button>
                  ))}
                </div>
              </div>

              {/* Fitness Goal */}
              <div className="rounded-xl bg-card-elevated border border-glass-border p-3 flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted">Goal</span>
                  <Target size={11} className="text-text-muted" />
                </div>
                <select
                  value={profile.goal}
                  onChange={(e) => updateProfile('goal', e.target.value)}
                  className="w-full bg-transparent text-sm font-bold text-text-main outline-none mt-1 appearance-none cursor-pointer"
                  style={{ WebkitAppearance: 'none' }}
                >
                  <option value="" style={{ background: 'var(--card-elevated)', color: 'var(--text-muted)' }}>Pick goal…</option>
                  {FITNESS_GOALS.map(g => (
                    <option key={g} value={g} style={{ background: 'var(--card-elevated)', color: 'var(--text-main)' }}>{g}</option>
                  ))}
                </select>
                {profile.goal && (
                  <span className="text-[10px] text-accent-primary font-medium mt-1 truncate">{profile.goal}</span>
                )}
              </div>
            </div>
          </div>

          {/* Theme Selector */}
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <Palette size={14} className="text-accent-primary" />
              <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-text-muted">App Theme</span>
            </div>
            <div className="grid grid-cols-4 gap-2.5">
              {THEMES.map((theme) => {
                const active = currentTheme === theme.id;
                return (
                  <button
                    key={theme.id}
                    onClick={() => handleThemeChange(theme.id)}
                    title={theme.name}
                    className={`flex flex-col items-center gap-1.5 p-1.5 rounded-2xl border-2 transition-all active:scale-90 ${
                      active ? 'border-accent-primary scale-[1.06]' : 'border-transparent hover:border-glass-border'
                    }`}
                  >
                    {/* Mini theme preview */}
                    <div
                      className="w-full aspect-square rounded-xl overflow-hidden relative shadow-md"
                      style={{ background: theme.bg }}
                    >
                      {/* Card strip */}
                      <div className="absolute bottom-1.5 left-1 right-1 rounded-lg h-3.5" style={{ background: theme.card }} />
                      {/* Accent bar top */}
                      <div className="absolute top-1.5 left-1 right-1 rounded-full h-1" style={{ background: theme.accent, opacity: 0.9 }} />
                      {/* Text stub */}
                      <div className="absolute top-3.5 left-1 w-3 rounded-full h-0.5" style={{ background: theme.text, opacity: 0.5 }} />
                      {/* Accent dot corner */}
                      <div className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full shadow-sm" style={{ background: theme.accent }} />
                      {/* Active checkmark overlay */}
                      {active && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-xl">
                          <Check size={14} className="text-white drop-shadow" />
                        </div>
                      )}
                    </div>
                    <span
                      className="text-[9px] font-bold leading-none text-center w-full truncate"
                      style={{ color: active ? theme.accent : undefined }}
                    >
                      {theme.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Sign Out */}
          <div className="border-t border-glass-border pt-5 flex flex-col gap-3">
            <button
              onClick={() => { onClose(); onLogout(); }}
              className="w-full flex items-center justify-center gap-3 py-3.5 rounded-2xl font-bold transition active:scale-95 border"
              style={{ color: 'var(--quiet-red)', borderColor: 'rgba(255,77,77,0.2)' }}
            >
              <LogOut size={18} />
              Sign Out
            </button>

            {/* Delete Account — Danger Zone */}
            {deleteStep === 0 && (
              <button
                onClick={() => setDeleteStep(1)}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl font-bold text-[13px] text-text-muted transition hover:text-quiet-red active:scale-95"
              >
                <Trash2 size={15} />
                Delete Account
              </button>
            )}

            {deleteStep === 1 && (
              <div className="rounded-2xl border-2 border-quiet-red/40 bg-quiet-red/5 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle size={16} className="text-quiet-red flex-shrink-0" />
                  <span className="text-sm font-extrabold text-quiet-red">Delete Account?</span>
                </div>
                <p className="text-xs text-text-muted mb-4 leading-relaxed">
                  This will permanently delete your account and <strong className="text-text-main">all workout data, splits, and history</strong>. This cannot be undone.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setDeleteStep(0)}
                    className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-card-elevated text-text-muted transition active:scale-95"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => { setDeleteStep(2); setDeleteInput(''); setDeleteError(''); }}
                    className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-quiet-red text-white transition active:scale-95"
                  >
                    Yes, Delete
                  </button>
                </div>
              </div>
            )}

            {deleteStep === 2 && (
              <div className="rounded-2xl border-2 border-quiet-red bg-quiet-red/5 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <AlertTriangle size={16} className="text-quiet-red" />
                  <span className="text-sm font-extrabold text-quiet-red">Final confirmation</span>
                </div>
                <p className="text-xs text-text-muted mb-3">Type <strong className="text-quiet-red font-mono tracking-widest">DELETE</strong> below to permanently erase your account.</p>
                <input
                  type="text"
                  value={deleteInput}
                  onChange={(e) => { setDeleteInput(e.target.value); setDeleteError(''); }}
                  placeholder="Type DELETE"
                  className="w-full rounded-xl bg-card-elevated border border-quiet-red/40 px-3 py-2.5 text-sm font-mono font-bold text-quiet-red placeholder:text-text-muted/40 outline-none mb-3"
                  autoCapitalize="characters"
                />
                {deleteError && <p className="text-xs text-quiet-red mb-2">{deleteError}</p>}
                <div className="flex gap-2">
                  <button
                    onClick={() => setDeleteStep(0)}
                    disabled={deleting}
                    className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-card-elevated text-text-muted transition active:scale-95 disabled:opacity-40"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDeleteAccount}
                    disabled={deleting}
                    className="flex-1 py-2.5 rounded-xl text-sm font-extrabold bg-quiet-red text-white transition active:scale-95 disabled:opacity-60"
                  >
                    {deleting ? 'Deleting…' : 'Confirm Delete'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
