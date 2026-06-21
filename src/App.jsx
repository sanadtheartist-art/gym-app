import { useCallback, useEffect, useState } from 'react';
import { Activity, ClipboardList, FolderOpen, Grid2X2, Plus, User, MessageSquare } from 'lucide-react';
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
import PrivacyPolicyDialog from './components/PrivacyPolicyDialog';
import OnboardingDialog from './components/OnboardingDialog';
import SearchUsersModal from './components/SearchUsersModal';
import ConversationList from './components/ConversationList';
import ChatScreen from './components/ChatScreen';
import { cleanupOldMedia } from './lib/mediaCleanup';

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
  const [restTimerState, setRestTimerState] = useState({ seconds: 0, active: false });
  const [profileVisible, setProfileVisible] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [avatarSvg, setAvatarSvg] = useState(null);
  const [showWelcome, setShowWelcome] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [summaryData, setSummaryData] = useState(null);
  const [topBarVisible, setTopBarVisible] = useState(true);
  const [prevScrollY, setPrevScrollY] = useState(0);
  const [showPrivacyPolicy, setShowPrivacyPolicy] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  
  // Chat state
  const [showSearchUsers, setShowSearchUsers] = useState(false);
  const [showConversationList, setShowConversationList] = useState(false);
  const [showChatScreen, setShowChatScreen] = useState(false);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [selectedOtherUser, setSelectedOtherUser] = useState(null);

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

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setAuthInitialized(true);
      if (session) {
        setShowWelcome(true);
        // Run background media cleanup
        cleanupOldMedia();
        // After welcome screen, check if user has seen privacy OR onboarding (treat as returning if so)
        setTimeout(() => {
          setShowWelcome(false);
          const hasSeenPrivacy = localStorage.getItem('jexi_has_seen_privacy');
          const hasSeenOnboarding = localStorage.getItem('jexi_has_seen_onboarding');
          // Only show privacy if NEITHER are set (brand new user)
          if (!hasSeenPrivacy && !hasSeenOnboarding) {
            setShowPrivacyPolicy(true);
          }
        }, 1500);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        setShowWelcome(true);
        setTimeout(() => {
          setShowWelcome(false);
          const hasSeenPrivacy = localStorage.getItem('jexi_has_seen_privacy');
          const hasSeenOnboarding = localStorage.getItem('jexi_has_seen_onboarding');
          if (!hasSeenPrivacy && !hasSeenOnboarding) {
            setShowPrivacyPolicy(true);
          }
        }, 1500);
      }
    });

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
      setTopBarVisible(false);
    } else if (currentScrollY < prevScrollY) {
      setTopBarVisible(true);
    }
    setPrevScrollY(currentScrollY);
  };

  // Convert email username to CamelCase (capitalize first letter only)
  const displayName = (() => {
    const name = session.user.email.split('@')[0];
    return name.charAt(0).toUpperCase() + name.slice(1);
  })();

  const handlePrivacyPolicyClose = () => {
    setShowPrivacyPolicy(false);
    localStorage.setItem('jexi_has_seen_privacy', 'true');
    // Check if user has seen onboarding before
    const hasSeenOnboarding = localStorage.getItem('jexi_has_seen_onboarding');
    if (!hasSeenOnboarding) {
      setShowOnboarding(true);
    }
  };

  const handleOnboardingComplete = () => {
    localStorage.setItem('jexi_has_seen_onboarding', 'true');
    setShowOnboarding(false);
  };

  const handleOnboardingSkip = () => {
    localStorage.setItem('jexi_has_seen_onboarding', 'true');
    setShowOnboarding(false);
  };

  // Chat handlers
  const handleStartChat = async (user) => {
    try {
      console.log('Starting chat with user:', user);
      
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) {
        console.error('No current user found!');
        return;
      }
      
      // First, get all conversations where current user is a participant
      const { data: userParticipantConvos, error: userConvError } = await supabase
        .from('conversation_participants')
        .select(`
          conversation_id
        `)
        .eq('user_id', currentUser.id);
        
      if (userConvError) throw userConvError;
      
      console.log('Current user conversation participant entries:', userParticipantConvos);
      
      // For each conversation the user is in, check if the other user is also a participant
      let existingConversationId = null;
      
      for (const pc of userParticipantConvos || []) {
        // Get all participants for this conversation
        const { data: convParticipants, error: cpError } = await supabase
          .from('conversation_participants')
          .select('user_id')
          .eq('conversation_id', pc.conversation_id);
          
        if (cpError) continue;
        
        // Check if the other user is in this conversation
        const otherUserIsParticipant = convParticipants?.some(p => p.user_id === user.id);
        if (otherUserIsParticipant) {
          existingConversationId = pc.conversation_id;
          break;
        }
      }
      
      let conversationId;
      
      if (existingConversationId) {
        console.log('Found existing conversation with id:', existingConversationId);
        
        // Get the conversation data
        const { data: convData, error: convDataError } = await supabase
          .from('conversations')
          .select('*')
          .eq('id', existingConversationId)
          .single();
          
        if (convDataError) throw convDataError;
        
        setSelectedConversation(convData);
        conversationId = existingConversationId;
      } else {
        console.log('Creating new conversation...');
        
        // Step 1: Create conversation
        const { data: newConv, error: createError } = await supabase
          .from('conversations')
          .insert({ created_by: currentUser.id })
          .select('*')
          .single();

        if (createError) throw createError;
        
        conversationId = newConv.id;
        setSelectedConversation(newConv);

        // Step 2: Add current user as participant
        const { error: addSelfError } = await supabase
          .from('conversation_participants')
          .insert({ conversation_id: conversationId, user_id: currentUser.id });
          
        if (addSelfError) throw addSelfError;
        
        // Step 3: Add other user as participant
        const { error: addOtherError } = await supabase
          .from('conversation_participants')
          .insert({ conversation_id: conversationId, user_id: user.id });
          
        if (addOtherError) throw addOtherError;
        
        console.log('Participants added!');
      }

      setSelectedOtherUser(user);
      setShowChatScreen(true);
    } catch (err) {
      console.error('Error starting chat:', err);
      alert('Error starting chat: ' + err.message);
    }
  };

  const handleSelectConversation = async (conv) => {
    // Get other user
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    const otherParticipants = conv.conversation_participants?.filter(
      (p) => p.user_id !== currentUser?.id
    );
    const otherUser = conv.other_user || otherParticipants?.[0]?.profiles || null;

    setSelectedConversation(conv);
    setSelectedOtherUser(otherUser);
    setShowConversationList(false);
    setShowChatScreen(true);
  };

  return (
    <div className="bg-app-bg h-[100dvh] flex justify-center overflow-hidden">
      {showWelcome && (
        <WelcomeScreen username={session.user.email.split('@')[0]} onComplete={() => setShowWelcome(false)} />
      )}
      {showPrivacyPolicy && (
        <PrivacyPolicyDialog onClose={handlePrivacyPolicyClose} />
      )}
      {showOnboarding && (
        <OnboardingDialog onComplete={handleOnboardingComplete} onSkip={handleOnboardingSkip} />
      )}
      {/* Centered mobile-like container */}
      <div className="w-full max-w-md bg-app-bg text-text-main font-sans relative h-[100dvh] flex flex-col">

        {/* Scrolling Content Area */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden relative" onScroll={handleScroll}>

          {/* Top User Bar — single line, scroll-sensitive */}
          <div className={`flex items-center justify-between px-4 py-3 border-b border-glass-border transition-transform duration-300 ease-in-out ${topBarVisible ? 'translate-y-0' : '-translate-y-[120%]'}`}>
            <div className="flex items-center gap-3">
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm overflow-hidden border-2 flex-shrink-0"
                style={{ background: 'var(--card-elevated)', borderColor: 'var(--accent-primary)', color: 'var(--accent-primary)' }}
              >
                {avatarSvg ? (
                  <div className="w-full h-full p-0.5 [&>svg]:w-full [&>svg]:h-full" dangerouslySetInnerHTML={{ __html: avatarSvg }} />
                ) : avatarUrl ? (
                  <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  displayName[0]
                )}
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-xs font-normal" style={{ color: 'var(--text-muted)' }}>Welcome back,</span>
                <span
                  className="text-lg font-extrabold leading-none"
                  style={{
                    background: 'var(--greeting-gradient)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                    backgroundSize: '200% auto',
                    animation: 'greetingShimmer 4s linear infinite',
                  }}
                >
                  {displayName}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setShowConversationList(true);
                }}
                className="grid h-10 w-10 place-items-center rounded-xl bg-card-elevated text-text-muted hover:text-text-main transition active:scale-95"
                aria-label="Conversations"
              >
                <MessageSquare size={18} />
              </button>
              <button
                onClick={() => setProfileVisible(true)}
                className="p-2 transition-colors rounded-lg"
                style={{ color: 'var(--text-muted)' }}
                aria-label="Manage Profile"
              >
                <User size={18} />
              </button>
            </div>
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

        {restOverlayVisible && (
          <RestTimerOverlay
            seconds={restTimerState.seconds}
            isActive={restTimerState.active}
            sessionTools={sessionTools}
            onClose={() => setRestOverlayVisible(false)}
          />
        )}

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

        {/* Chat Components */}
        <SearchUsersModal
          isOpen={showSearchUsers}
          onClose={() => setShowSearchUsers(false)}
          onStartChat={handleStartChat}
        />

        <ConversationList
          isOpen={showConversationList}
          onClose={() => setShowConversationList(false)}
          onSelectConversation={handleSelectConversation}
          onOpenFindUsers={() => setShowSearchUsers(true)}
        />

        <ChatScreen
          isOpen={showChatScreen}
          onClose={() => {
            setShowChatScreen(false);
            setSelectedConversation(null);
            setSelectedOtherUser(null);
          }}
          conversation={selectedConversation}
          otherUser={selectedOtherUser}
        />
      </div>
    </div>
  );
}
