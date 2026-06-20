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
import WelcomeScreen from './components/WelcomeScreen';

const tabs = [
  { id: 'dashboard', label: 'Dashboard', icon: Grid2X2 },
  { id: 'analytics', label: 'Analytics', icon: Activity },
  { id: 'log', label: 'Log', icon: ClipboardList },
  { id: 'splits', label: 'Splits', icon: FolderOpen },
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

  const [showWelcome, setShowWelcome] = useState(false);
  const [topBarVisible, setTopBarVisible] = useState(true);
  const [prevScrollY, setPrevScrollY] = useState(0);

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
      if (session) setShowWelcome(true);
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
    return <AuthScreen onAuthSuccess={() => { bumpRefresh(); setShowWelcome(true); }} />;
  }

  const handleScroll = (e) => {
    const currentScrollY = e.target.scrollTop;
    if (currentScrollY > prevScrollY && currentScrollY > 50) {
      setTopBarVisible(false); // scrolling down
    } else if (currentScrollY < prevScrollY) {
      setTopBarVisible(true); // scrolling up
    }
    setPrevScrollY(currentScrollY);
  };

  return (
    <div className="bg-app-bg h-[100dvh] flex justify-center overflow-hidden">
      {showWelcome && (
        <WelcomeScreen username={session.user.email.split('@')[0]} onComplete={() => setShowWelcome(false)} />
      )}
      {/* Centered mobile-like container */}
      <div className="w-full max-w-md bg-app-bg text-text-main font-sans relative h-[100dvh] flex flex-col">
        
        {/* Scrolling Content Area */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden relative" onScroll={handleScroll}>
          
          {/* Top User Bar (Scrolls with content) */}
          <div className={`flex items-center justify-between px-4 py-3 border-b border-glass-border transition-transform duration-300 ease-in-out ${topBarVisible ? 'translate-y-0' : '-translate-y-[120%]'}`}>
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

        <nav className={`absolute bottom-0 w-full px-4 pb-6 pt-2 z-40 transition-transform duration-300 ease-in-out ${topBarVisible ? 'translate-y-0' : 'translate-y-[120%]'}`}>
          <div className="mx-auto flex max-w-full items-center justify-around rounded-2xl px-2 py-1.5 backdrop-blur-2xl border border-glass-border shadow-2xl bg-white/5 relative">
            {tabs.map((tab, index) => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              const btn = (
                <button
                  type="button"
                  key={tab.id}
                  aria-label={tab.label}
                  onClick={() => setActiveTab(tab.id)}
                  className={`relative grid h-12 w-12 place-items-center rounded-xl transition-all duration-200 active:scale-90 ${
                    active ? 'text-accent-primary' : 'text-text-muted hover:text-text-main/70'
                  }`}
                >
                  <Icon size={21} />
                  {active && (
                    <span className="absolute -bottom-0.5 left-1/2 h-1 w-5 -translate-x-1/2 rounded-full bg-accent-primary animate-scale-in" />
                  )}
                </button>
              );

              if (index === 1) {
                return (
                  <div key={tab.id} className="flex items-center gap-1">
                    {btn}
                    <button
                      type="button"
                      aria-label="Log new set"
                      onClick={handleOpenInput}
                      className="mx-2 z-50 grid h-12 w-12 flex-shrink-0 place-items-center rounded-full bg-accent-primary text-app-bg transition active:scale-90"
                    >
                      <Plus size={22} strokeWidth={3} />
                    </button>
                  </div>
                );
              }

              return btn;
            })}
          </div>
        </nav>

        <InputEngine
          visible={inputVisible}
          onClose={() => setInputVisible(false)}
          activeSplit={activeSplit}
          sessionTools={sessionTools}
          onSaved={handleWorkoutSaved}
          repeatWorkoutData={repeatWorkoutData}
        />

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
          onOpenDataVault={() => { setActiveTab('data'); setProfileVisible(false); }}
        />
      </div>
    </div>
  );
}
