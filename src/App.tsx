import { useState, useEffect } from 'react';
import { ParticipantLandingPage } from './components/ParticipantLandingPage';
import { RoundCredentialModal } from './components/RoundCredentialModal';
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

type AppView = 'landing' | 'round-1' | 'round-2' | 'round-3' | 'admin' | 'projector';

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
    if (hash.includes('round-1') || path.includes('/round-1')) {
      return 'round-1';
    }
    if (hash.includes('round-2') || path.includes('/round-2')) {
      return 'round-2';
    }
    if (hash.includes('round-3') || path.includes('/round-3')) {
      return 'round-3';
    }
    return 'landing';
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
  const [selectedRoundForCredentials, setSelectedRoundForCredentials] = useState<number | null>(null);

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
        if (isMounted && p?.rollNumber) {
          setActiveParticipantState(p);
          persistActiveParticipant(p);
        }
      })
      .catch(() => {
        // No active session cookie
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
      } else if (hash.includes('round-1')) {
        setCurrentView('round-1');
      } else if (hash.includes('round-2')) {
        setCurrentView('round-2');
      } else if (hash.includes('round-3')) {
        setCurrentView('round-3');
      } else if (currentView === 'admin' || currentView === 'projector') {
        setCurrentView('landing');
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
    } else if (view === 'round-1') {
      window.history.pushState(null, '', '#/round-1');
    } else if (view === 'round-2') {
      window.history.pushState(null, '', '#/round-2');
    } else if (view === 'round-3') {
      window.history.pushState(null, '', '#/round-3');
    } else if (view === 'landing') {
      window.history.pushState(null, '', window.location.pathname === '/admin' ? '/' : '#/');
    }
  };

  // Participant Card Selection & Credential Handlers
  const handleSelectRoundCard = (roundId: number) => {
    // If active participant is already authenticated and appeared for Round 1, directly enter!
    if (activeParticipant && roundId > 1) {
      const targetStatus = settings.roundStates[roundId] || 'locked';
      if (targetStatus === 'locked') {
        alert(`Round ${roundId} is currently locked by the event administration.`);
        return;
      }
      navigateToView(roundId === 2 ? 'round-2' : 'round-3');
      return;
    }
    setSelectedRoundForCredentials(roundId);
  };

  const handleCredentialSuccess = (participant: Participant) => {
    setActiveParticipant(participant);

    const targetRound = selectedRoundForCredentials;
    setSelectedRoundForCredentials(null);

    if (!targetRound) return;
    const targetStatus = settings.roundStates[targetRound] || 'locked';
    if (targetStatus === 'locked') {
      navigateToView('landing');
      return;
    }

    // Route to that round's dedicated competition page
    if (targetRound === 1) {
      navigateToView('round-1');
    } else if (targetRound === 2) {
      navigateToView('round-2');
    } else if (targetRound === 3) {
      navigateToView('round-3');
    }
  };

  // Enforce access control: derive effective view so locked rounds or unverified sessions fallback to landing
  const effectiveView: AppView = (() => {
    if (currentView === 'round-1' && (settings.roundStates[1] === 'locked' || !activeParticipant)) {
      return 'landing';
    }
    if (currentView === 'round-2' && (settings.roundStates[2] === 'locked' || !activeParticipant)) {
      return 'landing';
    }
    if (currentView === 'round-3' && (settings.roundStates[3] === 'locked' || !activeParticipant)) {
      return 'landing';
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
          <span style={{ fontSize: '1.1rem' }}>âš ï¸</span>
          <span>Connection Lost: Local Wi-Fi disconnected. All exam answers are safely saved on this terminal. Do not close or refresh.</span>
        </div>
      )}

      {/* 1. PARTICIPANT LANDING PAGE (Centered titles, 3 round cards, top-right Admin link) */}
      {effectiveView === 'landing' && (
        <ParticipantLandingPage
          roundStates={settings.roundStates}
          isRegistrationOpen={settings.isRegistrationOpen}
          onSelectRound={handleSelectRoundCard}
          onOpenAdmin={() => navigateToView('admin')}
        />
      )}

      {/* 2. DEDICATED ROUND 1 COMPETITION PAGE (Data MCQ) */}
      {effectiveView === 'round-1' && (
        <Round1MCQ
          participant={activeParticipant}
          onExit={() => navigateToView('landing')}
          onRecordScore={handleRecordRoundScore}
          onProceedToNextRound={() => navigateToView('round-2')}
        />
      )}

      {/* 3. DEDICATED ROUND 2 COMPETITION PAGE (Graph Challenge) */}
      {effectiveView === 'round-2' && (
        <Round2GraphChallenge
          participant={activeParticipant}
          onExit={() => navigateToView('landing')}
          onRecordScore={handleRecordRoundScore}
          onProceedToNextRound={() => navigateToView('round-3')}
        />
      )}

      {/* 4. DEDICATED ROUND 3 COMPETITION PAGE (Rapid Fire) */}
      {effectiveView === 'round-3' && (
        <Round3RapidFire
          participant={activeParticipant}
          onExit={() => navigateToView('landing')}
          onRecordScore={handleRecordRoundScore}
          onOpenProjector={() => navigateToView('projector')}
        />
      )}


      {/* 5. ADMIN INTERFACE (Accessible via /admin, protected by AdminSecurityGate) */}
      {effectiveView === 'admin' && (
        <AdminSecurityGate
          isAuthenticated={isAdminAuthenticated}
          isVerifyingSession={isVerifyingAdminSession}
          onAuthenticate={() => {
            setIsAdminAuthenticated(true);
            setIsVerifyingAdminSession(false);
          }}
          onReturnToLanding={() => navigateToView('landing')}
        >
          <AdminDashboard
            settings={settings}
            onUpdateSettings={setSettings}
            onResetParticipants={handleResetParticipants}
            onResetRounds={handleResetRounds}
            onReturnToArena={() => navigateToView('landing')}
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

      {/* 6. PROJECTOR SCOREBOARD (Accessible via /projector) */}
      {effectiveView === 'projector' && (
        <ProjectorLeaderboard
          onReturnToArena={() => navigateToView('landing')}
          onOpenAdmin={() => navigateToView('admin')}
        />
      )}


      {/* CREDENTIAL ENTRY MODAL FOR SELECTED ROUND */}
      <RoundCredentialModal
        roundId={selectedRoundForCredentials}
        onClose={() => setSelectedRoundForCredentials(null)}
        onSubmit={handleCredentialSuccess}
        existingParticipant={activeParticipant}
        isRegistrationOpen={settings.isRegistrationOpen}
        roundStatus={
          selectedRoundForCredentials ? settings.roundStates[selectedRoundForCredentials] || 'locked' : 'locked'
        }
        activeJoinCodes={settings.activeJoinCodes}
      />
    </div>
  );
}

export default App;
