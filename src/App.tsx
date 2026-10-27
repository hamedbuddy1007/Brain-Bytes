import { useState, useEffect } from 'react';
import { HomePage } from './components/HomePage';
import { CompetitionArenaPage } from './components/CompetitionArenaPage';
import { ParticipantRegistrationPage } from './components/ParticipantRegistrationPage';
import { LoginPage } from './components/LoginPage';
import { ArenaTransitionOverlay } from './components/ArenaTransitionOverlay';
import { BroadcastNotification } from './components/BroadcastNotification';
import { Round1MCQ } from './components/rounds/Round1MCQ';
import { Round2GraphChallenge } from './components/rounds/Round2GraphChallenge';
import { Round3RapidFire } from './components/rounds/Round3RapidFire';
import { AdminSecurityGate } from './components/AdminSecurityGate';
import { AdminDashboard } from './components/AdminDashboard';
import { ProjectorLeaderboard } from './components/ProjectorLeaderboard';
import type {
  Participant,
  AdminSettings,
} from './types/competition';
import { checkAdminSession, terminateAdminSession } from './services/adminAuthService';
import {
  getActiveParticipant,
  setActiveParticipant as persistActiveParticipant,
  getAdminSettings,
  saveAdminSettings,
  subscribeToCompetitionSync,
  refreshLeaderboardFromServer,
} from './services/competitionStateService';

import { apiRequest } from './services/apiClient';
import './App.css';

type AppView = 'home' | 'arena' | 'login' | 'register' | 'round-1' | 'round-2' | 'round-3' | 'admin' | 'projector';

export function App() {
  // Determine initial view from URL path or hash
  const getInitialView = (): AppView => {
    const path = window.location.pathname.toLowerCase();
    const hash = window.location.hash.toLowerCase();

    if (path === '/projector' || path === '/admin/projector' || hash.includes('projector')) {
      return 'projector';
    }
    if (path.startsWith('/admin') || hash.includes('admin')) {
      return 'admin';
    }
    if (path === '/register' || hash.includes('register')) {
      return 'register';
    }
    if (path === '/login' || hash.includes('login')) {
      return 'login';
    }
    if (path === '/arena' || hash.includes('arena')) {
      return 'arena';
    }

    // A participant session is required to open any competition round directly
    const participant = getActiveParticipant();
    if (!participant) {
      if (typeof window !== 'undefined' && (hash.includes('round-') || path.includes('/round-'))) {
        window.history.replaceState(null, '', '#/');
      }
      return 'home';
    }

    if (hash.includes('round-1') || path.includes('/round-1')) {
      return 'round-1';
    }
    if (hash.includes('round-2') || path.includes('/round-2')) {
      return 'round-2';
    }
    if (hash.includes('round-3') || path.includes('/round-3')) {
      return 'round-3';
    }
    return 'home';
  };

  const [currentView, setCurrentView] = useState<AppView>(getInitialView);
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState<boolean>(() => {
    return Boolean(typeof window !== 'undefined' && localStorage.getItem('bb_admin_token'));
  });
  const [isVerifyingAdminSession, setIsVerifyingAdminSession] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const path = window.location.pathname.toLowerCase();
    const hash = window.location.hash.toLowerCase();
    const isAdminView = path.startsWith('/admin') || hash.includes('admin');
    return isAdminView && !localStorage.getItem('bb_admin_token');
  });
  const [prefilledAccessCode, setPrefilledAccessCode] = useState<string>('');
  const [transitioningRound, setTransitioningRound] = useState<{ participant: Participant; roundId: number } | null>(null);

  // Restore/verify active admin session with backend GET /api/auth/admin/me
  useEffect(() => {
    if (currentView !== 'admin') return;
    let isMounted = true;
    checkAdminSession().then((authenticated) => {
      if (isMounted) {
        setIsAdminAuthenticated(authenticated);
        if (!authenticated) {
          localStorage.removeItem('bb_admin_token');
        }
        setIsVerifyingAdminSession(false);
      }
    });
    return () => {
      isMounted = false;
    };
  }, [currentView]);

  // Persistent Active Participant across page refreshes
  const [activeParticipant, setActiveParticipantState] = useState<Participant | null>(() => getActiveParticipant());
  const setActiveParticipant = (p: Participant | null) => {
    setActiveParticipantState(p);
    persistActiveParticipant(p);
  };

  // Restore/verify active participant session with backend GET /api/participants/me
  useEffect(() => {
    let isMounted = true;
    apiRequest<Participant>('/participants/me')
      .then((p) => {
        if (!isMounted) return;
        if (p?.rollNumber) {
          setActiveParticipantState(p);
          persistActiveParticipant(p);

          // If participant is on round-2/round-3 but has not submitted the prerequisite round, redirect to arena
          const hasR1 = p.attempts?.some((a) => (a.roundId === 1 || (a as { round_id?: number }).round_id === 1) && ((a as { submittedAt?: string | null }).submittedAt || (a as { submitted_at?: string | null }).submitted_at));
          const hasR2 = p.attempts?.some((a) => (a.roundId === 2 || (a as { round_id?: number }).round_id === 2) && ((a as { submittedAt?: string | null }).submittedAt || (a as { submitted_at?: string | null }).submitted_at));

          if (currentView === 'round-2' && !hasR1) {
            setCurrentView('arena');
            window.history.replaceState(null, '', '#/arena');
          } else if (currentView === 'round-3' && !hasR2) {
            setCurrentView('arena');
            window.history.replaceState(null, '', '#/arena');
          }
        } else {
          setActiveParticipantState(null);
          persistActiveParticipant(null);
          try {
            sessionStorage.removeItem('bb_active_participant');
          } catch {}
          if (currentView.startsWith('round-')) {
            setCurrentView('home');
            window.history.replaceState(null, '', '#/');
          }
        }
      })
      .catch(() => {
        if (!isMounted) return;
        // Participant session expired, invalid, or reset in database: wipe local session immediately
        setActiveParticipantState(null);
        persistActiveParticipant(null);
        try {
          sessionStorage.removeItem('bb_active_participant');
        } catch {}
        if (currentView.startsWith('round-')) {
          setCurrentView('home');
          window.history.replaceState(null, '', '#/');
        }
      });
    return () => {
      isMounted = false;
    };
  }, []);

  // Synchronized Event State across Participant and Admin interfaces
  const [settings, setSettingsState] = useState<AdminSettings>(() => getAdminSettings());

  // Restore and synchronize competition state with Neon PostgreSQL
  useEffect(() => {
    let isMounted = true;
    apiRequest<{
      status: string;
      active_round: number | null;
      registration_open: boolean;
      round_states: Record<string, 'active' | 'locked' | 'completed'>;
    }>('/competition/state')
      .then((state) => {
        if (!isMounted || !state) return;
        setSettingsState((prev) => {
          const updated: AdminSettings = {
            ...prev,
            isRegistrationOpen: state.registration_open ?? prev.isRegistrationOpen,
            roundStates: {
              1: state.round_states?.['1'] || prev.roundStates[1] || 'active',
              2: state.round_states?.['2'] || prev.roundStates[2] || 'locked',
              3: state.round_states?.['3'] || prev.roundStates[3] || 'locked',
            },
          };
          saveAdminSettings(updated);
          return updated;
        });
      })
      .catch((err) => {
        console.warn('Unable to synchronize competition state from database:', err);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  const setSettings = (newSettings: AdminSettings | ((prev: AdminSettings) => AdminSettings)) => {
    setSettingsState((prev) => {
      const next = typeof newSettings === 'function' ? newSettings(prev) : newSettings;
      saveAdminSettings(next);

      // Persist changes to Neon PostgreSQL competition_state
      apiRequest('/admin/competition/state', {
        method: 'PATCH',
        body: JSON.stringify({
          registrationOpen: next.isRegistrationOpen,
          roundStates: {
            '1': next.roundStates[1] || 'active',
            '2': next.roundStates[2] || 'locked',
            '3': next.roundStates[3] || 'locked',
          },
        }),
      }).catch(() => {
        // Handled silently if unauthenticated
      });

      return next;
    });
  };

  const [isOffline, setIsOffline] = useState(() => (typeof navigator !== 'undefined' ? !navigator.onLine : false));

  // Network offline detection for auditorium Wi-Fi resilience
  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Cross-tab and local state synchronization
  useEffect(() => {
    const handleSync = () => {
      setSettingsState(getAdminSettings());
      const active = getActiveParticipant();
      if (active) setActiveParticipantState(active);
    };
    const unsubscribe = subscribeToCompetitionSync(handleSync);
    return () => unsubscribe();
  }, []);

  // Live leaderboard comes from the server database; poll while admin or projector is on screen
  useEffect(() => {
    if (currentView !== 'admin' && currentView !== 'projector') return;
    void refreshLeaderboardFromServer();
    const id = setInterval(() => void refreshLeaderboardFromServer(), 5000);
    return () => clearInterval(id);
  }, [currentView]);

  // Synchronize browser history and hash navigation
  useEffect(() => {
    const handleLocationChange = () => {
      const path = window.location.pathname.toLowerCase();
      const hash = window.location.hash.toLowerCase();

      if (path === '/projector' || path === '/admin/projector' || hash.includes('projector')) {
        setCurrentView('projector');
      } else if (path.startsWith('/admin') || hash.includes('admin')) {
        setCurrentView('admin');
      } else if (path === '/register' || hash.includes('register')) {
        setCurrentView('register');
      } else if (path === '/login' || hash.includes('login')) {
        setCurrentView('login');
      } else if (path === '/arena' || hash.includes('arena')) {
        setCurrentView('arena');
      } else if (hash.includes('round-1')) {
        setCurrentView('round-1');
      } else if (hash.includes('round-2')) {
        setCurrentView('round-2');
      } else if (hash.includes('round-3')) {
        setCurrentView('round-3');
      } else if (hash === '#/' || hash === '' || path === '/') {
        setCurrentView('home');
      } else if (currentView === 'admin' || currentView === 'projector' || currentView === 'register') {
        setCurrentView('home');
      }
    };

    window.addEventListener('popstate', handleLocationChange);
    window.addEventListener('hashchange', handleLocationChange);
    return () => {
      window.removeEventListener('popstate', handleLocationChange);
      window.removeEventListener('hashchange', handleLocationChange);
    };
  }, [currentView]);

  const navigateToView = (view: AppView) => {
    setCurrentView(view);
    if (view === 'admin') {
      window.history.pushState(null, '', '#/admin');
    } else if (view === 'projector') {
      window.history.pushState(null, '', '#/projector');
    } else if (view === 'register') {
      window.history.pushState(null, '', '#/register');
    } else if (view === 'login') {
      window.history.pushState(null, '', '#/login');
    } else if (view === 'arena') {
      window.history.pushState(null, '', '#/arena');
    } else if (view === 'round-1') {
      window.history.pushState(null, '', '#/round-1');
    } else if (view === 'round-2') {
      window.history.pushState(null, '', '#/round-2');
    } else if (view === 'round-3') {
      window.history.pushState(null, '', '#/round-3');
    } else if (view === 'home') {
      window.history.pushState(null, '', window.location.pathname === '/admin' ? '/' : '#/');
    }
  };

  // Participant Card Selection in Arena
  const handleSelectRoundCard = (roundId: number) => {
    if (!activeParticipant) {
      navigateToView('login');
      return;
    }

    const targetStatus = settings.roundStates[roundId] || 'locked';
    if (targetStatus === 'locked') {
      alert(`Round ${roundId} is currently locked by the event administration.`);
      return;
    }

    // Prerequisite checks
    if (roundId === 2) {
      const hasR1 = activeParticipant.attempts?.some(
        (a) => (a.roundId === 1 || (a as { round_id?: number }).round_id === 1) &&
               ((a as { submittedAt?: string | null }).submittedAt || (a as { submitted_at?: string | null }).submitted_at)
      );
      if (activeParticipant.attempts && activeParticipant.attempts.length > 0 && !hasR1) {
        alert('You must qualify and submit Round 1 before entering Round 2.');
        return;
      }
    } else if (roundId === 3) {
      const hasR2 = activeParticipant.attempts?.some(
        (a) => (a.roundId === 2 || (a as { round_id?: number }).round_id === 2) &&
               ((a as { submittedAt?: string | null }).submittedAt || (a as { submitted_at?: string | null }).submitted_at)
      );
      if (activeParticipant.attempts && activeParticipant.attempts.length > 0 && !hasR2) {
        alert('You must qualify and submit Round 2 before entering the Round 3 Finale.');
        return;
      }
    }

    setTransitioningRound({ participant: activeParticipant, roundId });
  };

  const handleParticipantLogin = (participant: Participant) => {
    if (participant.token) {
      localStorage.setItem('bb_participant_token', participant.token);
    }
    setActiveParticipant(participant);
    navigateToView('arena');
  };

  const handleParticipantSignOut = async () => {
    try {
      await apiRequest('/auth/logout', { method: 'POST' });
    } catch {}
    localStorage.removeItem('bb_participant_token');
    setActiveParticipant(null);
    navigateToView('home');
  };

  const handleTransitionComplete = () => {
    if (!transitioningRound) return;
    const { roundId } = transitioningRound;
    setTransitioningRound(null);

    const targetStatus = settings.roundStates[roundId] || 'locked';
    if (targetStatus === 'locked') {
      navigateToView('arena');
      return;
    }

    if (roundId === 1) {
      navigateToView('round-1');
    } else if (roundId === 2) {
      navigateToView('round-2');
    } else if (roundId === 3) {
      navigateToView('round-3');
    } else {
      navigateToView('arena');
    }
  };

  // Enforce access control: derive effective view so locked rounds or unverified sessions fallback to arena / home
  const effectiveView: AppView = (() => {
    if (currentView === 'home') return 'home';
    if (currentView === 'arena') return 'arena';
    if (currentView === 'login') return 'login';
    if (currentView === 'register') return 'register';
    if (currentView === 'admin') return 'admin';
    if (currentView === 'projector') return 'projector';

    if (currentView === 'round-1' && (settings.roundStates[1] === 'locked' || !activeParticipant)) {
      return 'arena';
    }
    if (currentView === 'round-2') {
      if (settings.roundStates[2] === 'locked' || !activeParticipant) return 'arena';
      const hasR1 = activeParticipant.attempts?.some((a) => (a.roundId === 1 || (a as { round_id?: number }).round_id === 1) && ((a as { submittedAt?: string | null }).submittedAt || (a as { submitted_at?: string | null }).submitted_at));
      if (activeParticipant.attempts && activeParticipant.attempts.length > 0 && !hasR1) {
        return 'arena';
      }
    }
    if (currentView === 'round-3') {
      if (settings.roundStates[3] === 'locked' || !activeParticipant) return 'arena';
      const hasR2 = activeParticipant.attempts?.some((a) => (a.roundId === 2 || (a as { round_id?: number }).round_id === 2) && ((a as { submittedAt?: string | null }).submittedAt || (a as { submitted_at?: string | null }).submitted_at));
      if (activeParticipant.attempts && activeParticipant.attempts.length > 0 && !hasR2) {
        return 'arena';
      }
    }
    return currentView;
  })();

  const handleRecordRoundScore = () => {
    void refreshLeaderboardFromServer();
  };

  // Admin Actions
  const handleResetParticipants = () => {
    setActiveParticipant(null);
  };

  const handleResetRounds = () => {
    setSettings((prev) => ({
      ...prev,
      roundStates: {
        1: 'active',
        2: 'locked',
        3: 'locked',
      },
    }));
  };

  return (
    <div className="app-shell" id="app-root">
      {isOffline && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 99999,
          background: '#DC2626',
          color: '#FFFFFF',
          padding: '10px 16px',
          textAlign: 'center',
          fontSize: '0.85rem',
          fontWeight: 700,
          letterSpacing: '0.02em',
          boxShadow: '0 4px 14px rgba(0,0,0,0.6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '10px',
        }}>
          <span style={{ fontSize: '1.1rem' }}>⚠️</span>
          <span>Connection Lost: Local Wi-Fi disconnected. All exam answers are safely saved on this terminal. Do not close or refresh.</span>
        </div>
      )}

      {/* 1. CLEAN HOMEPAGE WITH ROUNDS INTRODUCTION AND REGISTER/LOGIN/ADMIN BUTTONS */}
      {effectiveView === 'home' && (
        <HomePage
          roundStates={settings.roundStates}
          isRegistrationOpen={settings.isRegistrationOpen}
          activeParticipant={activeParticipant}
          onOpenRegister={() => navigateToView('register')}
          onOpenLogin={() => navigateToView('login')}
          onOpenAdmin={() => navigateToView('admin')}
          onEnterArena={() => navigateToView('arena')}
          onSignOut={handleParticipantSignOut}
        />
      )}

      {/* 2. DEDICATED ARENA PAGE WITH ONLY TABS TO THE GAME PAGES */}
      {effectiveView === 'arena' && (
        <CompetitionArenaPage
          roundStates={settings.roundStates}
          activeParticipant={activeParticipant}
          onSelectRound={handleSelectRoundCard}
          onBackToHome={() => navigateToView('home')}
          onOpenLogin={() => navigateToView('login')}
          onSignOut={handleParticipantSignOut}
        />
      )}

      {/* 3. DEDICATED PARTICIPANT ACCESS CODE LOGIN PAGE */}
      {effectiveView === 'login' && (
        <LoginPage
          onLoginSuccess={handleParticipantLogin}
          onBackToHome={() => navigateToView('home')}
          onNavigateToRegister={() => navigateToView('register')}
          initialAccessCode={prefilledAccessCode}
        />
      )}

      {/* 4. DEDICATED PARTICIPANT REGISTRATION PAGE */}
      {effectiveView === 'register' && (
        <ParticipantRegistrationPage
          onBackToHome={() => navigateToView('home')}
          onProceedToArena={async (code) => {
            setPrefilledAccessCode(code);
            try {
              const participant = await apiRequest<Participant & { token?: string }>('/participants/login-access-code', {
                method: 'POST',
                body: JSON.stringify({ accessCode: code }),
              });
              if (participant?.rollNumber) {
                handleParticipantLogin(participant);
                return;
              }
            } catch {}
            navigateToView('login');
          }}
        />
      )}

      {/* 5. DEDICATED ROUND 1 COMPETITION PAGE (Data MCQ) */}
      {effectiveView === 'round-1' && (
        <Round1MCQ
          participant={activeParticipant}
          onExit={() => navigateToView('arena')}
          onRecordScore={handleRecordRoundScore}
          onProceedToNextRound={() => navigateToView('round-2')}
        />
      )}

      {/* 6. DEDICATED ROUND 2 COMPETITION PAGE (Graph Challenge) */}
      {effectiveView === 'round-2' && (
        <Round2GraphChallenge
          participant={activeParticipant}
          onExit={() => navigateToView('arena')}
          onRecordScore={handleRecordRoundScore}
          onProceedToNextRound={() => navigateToView('round-3')}
        />
      )}

      {/* 7. DEDICATED ROUND 3 COMPETITION PAGE (Rapid Fire) */}
      {effectiveView === 'round-3' && (
        <Round3RapidFire
          participant={activeParticipant}
          onExit={() => navigateToView('arena')}
          onRecordScore={handleRecordRoundScore}
          onOpenProjector={() => navigateToView('projector')}
        />
      )}

      {/* 8. ADMIN INTERFACE (Protected by AdminSecurityGate) */}
      {effectiveView === 'admin' && (
        <AdminSecurityGate
          isAuthenticated={isAdminAuthenticated}
          isVerifyingSession={isVerifyingAdminSession}
          onAuthenticate={() => {
            setIsAdminAuthenticated(true);
            setIsVerifyingAdminSession(false);
          }}
          onReturnToLanding={() => navigateToView('home')}
        >
          <AdminDashboard
            settings={settings}
            onUpdateSettings={setSettings}
            onResetParticipants={handleResetParticipants}
            onResetRounds={handleResetRounds}
            onReturnToArena={() => navigateToView('arena')}
            onOpenProjector={() => navigateToView('projector')}
            onSignOut={async () => {
              await terminateAdminSession();
              localStorage.removeItem('bb_admin_token');
              setIsAdminAuthenticated(false);
              setIsVerifyingAdminSession(false);
            }}
          />
        </AdminSecurityGate>
      )}

      {/* 9. PROJECTOR SCOREBOARD */}
      {effectiveView === 'projector' && (
        <ProjectorLeaderboard
          onReturnToArena={() => navigateToView('home')}
          onOpenAdmin={() => navigateToView('admin')}
        />
      )}

      {/* ARENA TRANSITION ANIMATION OVERLAY */}
      {transitioningRound && (
        <ArenaTransitionOverlay
          participantName={transitioningRound.participant.fullName}
          roundId={transitioningRound.roundId}
          onComplete={handleTransitionComplete}
        />
      )}

      {/* LIVE PROCTOR BROADCAST NOTIFICATION POPUP (Bottom-Right with X mark & flashing glow) */}
      <BroadcastNotification />
    </div>
  );
}

export default App;
