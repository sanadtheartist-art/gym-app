import { useCallback, useEffect, useState } from 'react';
import { Activity, ClipboardList, Database, FolderOpen, Grid2X2, Plus, User } from 'lucide-react';
import { supabase } from './lib/supabase';
import AuthScreen from './components/AuthScreen';
import ActiveSessionHeader from './components/ActiveSessionHeader';
import AnalyticsDash from './components/AnalyticsDash';
import Dashboard from './components/Dashboard';
import DataPortability from './components/DataPortability';
import HistoryLog from './components/HistoryLog';
import InputEngine from './components/InputEngine';
import SplitsManager from './components/SplitsManager';
import RestTimerOverlay from './components/RestTimerOverlay';
import WorkoutSummary from './components/WorkoutSummary';
import ProfileManager from './components/ProfileManager';

const tabs = [
  { id: 'dashboard', label: 'Dashboard', icon: Grid2X2 },
  { id: 'analytics', label: 'Analytics', icon: Activity },
  { id: 'log', label: 'Log', icon: ClipboardList },
  { id: 'splits', label: 'Splits', icon: FolderOpen },
  { id: 'data', label: 'Data', icon: Database },
];

export default function App() {
  const [session, setSession] = useState(null);
  const [authInitialized, setAuthInitialized] = useState(false);

  const [activeTab, setActiveTab] = useState('dashboard');
  const [inputVisible, setInputVisible] = useState(false);
  const [activeSplit, setActiveSplit] = useState(null);
  const [sessionTools, setSessionTools] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [repeatWorkoutData, setRepeatWorkoutData] = useState(null);
  const [restOverlayVisible, setRestOverlayVisible] = useState(false);
  const [profileVisible, setProfileVisible] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [avatarSvg, setAvatarSvg] = useState(null);

  useEffect(() => {
    const savedTheme = localStorage.getItem('jexi_theme') || 'default';
    document.documentElement.setAttribute('data-theme', savedTheme);
    setAvatarUrl(localStorage.getItem('jexi_avatar'));
    setAvatarSvg(localStorage.getItem('jexi_avatar_svg'));

    const handleAvatarUpdate = () => {
      setAvatarUrl(localStorage.getItem('jexi_avatar'));
      setAvatarSvg(localStorage.getItem('jexi_avatar_svg'));
    };
    window.addEventListener('avatarUpdated', handleAvatarUpdate);
    return () => window.removeEventListener('avatarUpdated', handleAvatarUpdate);
  }, []);
  const [restTimerState, setRestTimerState] = useState({ seconds: 0, active: false });
  const [showSummary, setShowSummary] = useState(false);
  const [summaryData, setSummaryData] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setAuthInitialized(true);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    const savedTheme = localStorage.getItem('theme') || 'cyberpunk';
    document.documentElement.setAttribute('data-theme', savedTheme);

    return () => subscription.unsubscribe();
  }, []);

  const handleOpenInput = useCallback(() => {
    setRepeatWorkoutData(null);
    setActiveSplit(null);
    setInputVisible(true);
  }, []);

  const handleRepeatWorkout = useCallback((workout) => {
    setRepeatWorkoutData(workout);
    setInputVisible(true);
  }, []);

  const bumpRefresh = useCallback(() => {
    setRefreshKey((key) => key + 1);
  }, []);

  useEffect(() => {
    if (inputVisible) {
      document.body.classList.add('sheet-open');
    } else {
      document.body.classList.remove('sheet-open');
    }
    return () => document.body.classList.remove('sheet-open');
  }, [inputVisible]);

  const handleSessionToolsChange = useCallback((tools) => {
    setSessionTools(tools);
  }, []);

  const handleRestTimerUpdate = useCallback((seconds, active) => {
    setRestTimerState({ seconds, active });
  }, []);

  const launchSplit = useCallback((split) => {
    setRepeatWorkoutData(null);
    setActiveSplit({ ...split, _launchKey: Date.now() });
    setInputVisible(true);
  }, []);

  const handleWorkoutSaved = useCallback((savedData) => {
    bumpRefresh();
    if (savedData) {
      setSummaryData(savedData);
      setShowSummary(true);
    }
  }, [bumpRefresh]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  if (!authInitialized) {
    return <div className="min-h-screen bg-app-bg" />;
  }

  if (!session) {
    return <AuthScreen onAuthSuccess={() => bumpRefresh()} />;
  }

  return (
    <div className="bg-[#000000] h-[100dvh] flex justify-center overflow-hidden">
      {/* Centered mobile-like container */}
      <div className="w-full max-w-md bg-app-bg text-text-main font-sans relative h-[100dvh] border-x border-glass-border/30 shadow-2xl flex flex-col">
        
        {/* Scrolling Content Area */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden relative">
          
          {/* Top User Bar (Scrolls with content) */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-glass-border">
            <div className="flex items-center gap-3">
               <div className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm overflow-hidden border-2 flex-shrink-0"
                 style={{ background: 'var(--card-elevated)', borderColor: 'var(--accent-primary)', color: 'var(--accent-primary)' }}
               >
                 {avatarSvg ? (
                   <div className="w-full h-full p-0.5 [&>svg]:w-full [&>svg]:h-full" dangerouslySetInnerHTML={{ __html: avatarSvg }} />
                 ) : avatarUrl ? (
                   <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                 ) : (
                   session.user.email.split('@')[0][0].toUpperCase()
                 )}
               </div>
               <div className="flex flex-col">
                 <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Welcome back</span>
                 <span
                   className="text-base font-extrabold leading-tight greeting-animated"
                   style={{
                     background: 'var(--greeting-gradient)',
                     WebkitBackgroundClip: 'text',
                     WebkitTextFillColor: 'transparent',
                     backgroundClip: 'text',
                     backgroundSize: '200% auto',
                     animation: 'greetingShimmer 4s linear infinite',
                   }}
                 >
                   {session.user.email.split('@')[0]}
                 </span>
               </div>
            </div>
            <button 
              onClick={() => setProfileVisible(true)}
              className="p-2 transition-colors rounded-lg"
              style={{ color: 'var(--text-muted)' }}
              aria-label="Manage Profile"
            >
              <User size={18} />
            </button>
          </div>

          <ActiveSessionHeader
            onSessionToolsChange={handleSessionToolsChange}
            onRestTimerUpdate={handleRestTimerUpdate}
            onRestTimerClick={() => setRestOverlayVisible(true)}
          />

          <main className="relative pb-6">
            {activeTab === 'dashboard' ? (
              <Dashboard
                activeSplit={activeSplit}
                onOpenInput={handleOpenInput}
                onOpenPortability={() => setActiveTab('data')}
                refreshKey={refreshKey}
              />
            ) : null}

            {activeTab === 'analytics' ? <AnalyticsDash refreshKey={refreshKey} /> : null}

            {activeTab === 'log' ? <HistoryLog refreshKey={refreshKey} onChanged={bumpRefresh} onRepeatWorkout={handleRepeatWorkout} /> : null}

            {activeTab === 'splits' ? (
              <SplitsManager
                activeSplit={activeSplit}
                onLaunchSplit={launchSplit}
                refreshKey={refreshKey}
                onChanged={bumpRefresh}
              />
            ) : null}

            {activeTab === 'data' ? <DataPortability onImported={bumpRefresh} /> : null}
          </main>
        </div> {/* End of Scrolling Content Area */}

        <InputEngine
          visible={inputVisible}
          onClose={() => setInputVisible(false)}
          activeSplit={activeSplit}
          sessionTools={sessionTools}
          onSaved={handleWorkoutSaved}
          repeatWorkoutData={repeatWorkoutData}
        />

        {/* Floating Action Button */}
        <button
          type="button"
          aria-label="Log new set"
          onClick={handleOpenInput}
          className="fixed bottom-24 right-[calc(50%-10rem)] md:right-[calc(50%-12rem)] z-30 grid h-14 w-14 place-items-center rounded-full bg-accent-lime text-app-bg shadow-glow-lime transition hover:shadow-[0_0_32px_rgba(200,255,0,0.35)] active:scale-90"
          style={{ transform: 'translateX(50%)' }}
        >
          <Plus size={24} strokeWidth={2.5} />
        </button>

        {/* Bottom Nav (Fixed to bottom of screen) */}
        <nav className="shrink-0 safe-bottom bg-app-bg/90 px-4 pb-3 pt-2 backdrop-blur-xl border-t border-glass-border z-40">
          <div className="mx-auto flex max-w-full items-center justify-around rounded-2xl glass-card px-2 py-1.5">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  type="button"
                  key={tab.id}
                  aria-label={tab.label}
                  onClick={() => setActiveTab(tab.id)}
                  className={`relative grid h-12 w-12 place-items-center rounded-xl transition-all duration-200 active:scale-90 ${
                    active ? 'text-accent-lime' : 'text-text-muted hover:text-text-main/70'
                  }`}
                >
                  <Icon size={21} />
                  {active && (
                    <span className="absolute -bottom-0.5 left-1/2 h-1 w-5 -translate-x-1/2 rounded-full bg-accent-lime animate-scale-in" />
                  )}
                </button>
              );
            })}
          </div>
        </nav>

        {/* Rest Timer Overlay */}
        {restOverlayVisible && (
          <RestTimerOverlay
            seconds={restTimerState.seconds}
            isActive={restTimerState.active}
            sessionTools={sessionTools}
            onClose={() => setRestOverlayVisible(false)}
          />
        )}

        {/* Workout Summary */}
        {showSummary && summaryData && (
          <WorkoutSummary
            data={summaryData}
            onClose={() => {
              setShowSummary(false);
              setSummaryData(null);
            }}
          />
        )}

        <ProfileManager 
          visible={profileVisible}
          onClose={() => setProfileVisible(false)}
          session={session}
          onLogout={handleLogout}
        />
      </div>
    </div>
  );
}
