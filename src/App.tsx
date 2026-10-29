import { useState, useEffect } from 'react';
import { HomePage } from './components/HomePage';
import { CompetitionArenaPage } from './components/CompetitionArenaPage';
import { ParticipantRegistrationPage } from './components/ParticipantRegistrationPage';
import { LoginPage } from './components/LoginPage';
import { ArenaTransitionOverlay } from './components/ArenaTransitionOverlay';
import { BroadcastNotification } from './components/BroadcastNotification';
import { QualificationPopupModal } from './components/QualificationPopupModal';
import { Round1MCQ } from './components/rounds/Round1MCQ';
import { Round2GraphChallenge } from './components/rounds/Round2GraphChallenge';
import { Round3RapidFire } from './components/rounds/Round3RapidFire';
import { AdminSecurityGate } from './components/AdminSecurityGate';
import { AdminDashboard } from './components/AdminDashboard';
import { ProjectorLeaderboard } from './components/ProjectorLeaderboard';
import type {
  Participant,
  AdminSettings,
  RoundStatus,
  RoundQualificationInfo,
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
  const [activeQualificationPopup, setActiveQualificationPopup] = useState<RoundQualificationInfo | null>(null);

  const setActiveParticipant = (p: Participant | null) => {
    setActiveParticipantState(p);
    persistActiveParticipant(p);
  };

  // Automatically trigger QualificationPopupModal once per qualification execution for logged-in participant
  const evaluateQualificationPopups = (p: Participant) => {
    if (!p?.rollNumber || !p?.qualifications) return;
    const r3Qual = p.qualifications.round3;
    const r2Qual = p.qualifications.round2;

    if (r3Qual?.qualificationExecuted && (r3Qual.sourceSubmitted || r3Qual.isQualified)) {
      const seenKey = `bb_qual_popup_${p.rollNumber}_r3_${r3Qual.executedAt || 'exec'}_${r3Qual.status}`;
      try {
        if (!sessionStorage.getItem(seenKey)) {
          sessionStorage.setItem(seenKey, '1');
          setActiveQualificationPopup(r3Qual);
          return;
        }
      } catch {}
    }

    if (r2Qual?.qualificationExecuted && (r2Qual.sourceSubmitted || r2Qual.isQualified)) {
      const seenKey = `bb_qual_popup_${p.rollNumber}_r2_${r2Qual.executedAt || 'exec'}_${r2Qual.status}`;
      try {
        if (!sessionStorage.getItem(seenKey)) {
          sessionStorage.setItem(seenKey, '1');
          setActiveQualificationPopup(r2Qual);
          return;
        }
      } catch {}
    }
  };

  // Restore/verify and poll active participant session with backend GET /api/participants/me
  useEffect(() => {
    if (currentView === 'admin' || currentView === 'projector') return;
    let isMounted = true;

    const refreshParticipantMe = (isInitial = false) => {
      // Only poll if initial mount or participant is currently logged in
      if (!isInitial && !getActiveParticipant() && !localStorage.getItem('bb_participant_token')) {
        return;
      }
      apiRequest<Participant>('/participants/me')
        .then((p) => {
          if (!isMounted) return;
          if (p?.rollNumber) {
            setActiveParticipantState(p);
            persistActiveParticipant(p);
            evaluateQualificationPopups(p);

            // Enforce strict qualification gating on round-2 and round-3
            const isQualR2 = Boolean(p.qualifications?.round2?.isQualified);
            const isQualR3 = Boolean(p.qualifications?.round3?.isQualified);

            if (currentView === 'round-2' && !isQualR2) {
              setCurrentView('arena');
              window.history.replaceState(null, '', '#/arena');
            } else if (currentView === 'round-3' && !isQualR3) {
              setCurrentView('arena');
              window.history.replaceState(null, '', '#/arena');
            }
          } else if (isInitial) {
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
          if (!isMounted || !isInitial) return;
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
    };

    refreshParticipantMe(true);
    const intervalId = setInterval(() => refreshParticipantMe(false), 3500);

    return () => {
      isMounted = false;
      clearInterval(intervalId);
    };
  }, [currentView]);

  // Synchronized Event State across Participant and Admin interfaces
  const [settings, setSettingsState] = useState<AdminSettings>(() => getAdminSettings());

  // Restore and synchronize competition state with Neon PostgreSQL
  useEffect(() => {
    let isMounted = true;

    const syncState = () => {
      apiRequest<{
        status: 'NOT_STARTED' | 'LIVE' | 'PAUSED' | 'COMPLETED';
        active_round: number | null;
        registration_open: boolean;
        leaderboard_published?: boolean;
        leaderboardPublished?: boolean;
        round_states: Record<string, 'active' | 'locked' | 'completed'>;
      }>('/competition/state')
        .then((state) => {
          if (!isMounted || !state) return;
          setSettingsState((prev) => {
            const nextStatus = (state.status as 'NOT_STARTED' | 'LIVE' | 'PAUSED' | 'COMPLETED') || prev.competitionStatus || 'LIVE';
            const nextLeaderboardPublished =
              state.leaderboard_published !== undefined
                ? Boolean(state.leaderboard_published)
                : state.leaderboardPublished !== undefined
                  ? Boolean(state.leaderboardPublished)
                  : Boolean(prev.leaderboardPublished);
            const updated: AdminSettings = {
              ...prev,
              competitionStatus: nextStatus,
              isRegistrationOpen: state.registration_open ?? prev.isRegistrationOpen,
              leaderboardPublished: nextLeaderboardPublished,
              roundStates: {
                1: state.round_states?.['1'] || (state.round_states as Record<string, RoundStatus>)?.[1] || prev.roundStates[1] || 'active',
                2: state.round_states?.['2'] || (state.round_states as Record<string, RoundStatus>)?.[2] || prev.roundStates[2] || 'locked',
                3: state.round_states?.['3'] || (state.round_states as Record<string, RoundStatus>)?.[3] || prev.roundStates[3] || 'locked',
              },
            };
            saveAdminSettings(updated);
            try {
              localStorage.setItem('bb_tournament_global_state', nextStatus);
            } catch {}
            return updated;
          });
        })
        .catch((err) => {
          console.warn('Unable to synchronize competition state from database:', err);
        });
    };

    syncState();
    const pollId = setInterval(syncState, 3000);

    return () => {
      isMounted = false;
      clearInterval(pollId);
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
          status: next.competitionStatus,
          registrationOpen: next.isRegistrationOpen,
          leaderboardPublished: Boolean(next.leaderboardPublished),
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

  // Open the Qualification Popup Modal for Round 2 or Round 3
  const handleShowQualificationPopup = (targetRound: 2 | 3) => {
    if (!activeParticipant) return;
    const qual = targetRound === 2 ? activeParticipant.qualifications?.round2 : activeParticipant.qualifications?.round3;
    if (qual) {
      setActiveQualificationPopup(qual);
      return;
    }
    const sourceRound = targetRound - 1;
    const sourceAttempt = activeParticipant.attempts?.find(
      (a) => a.roundId === sourceRound || (a as { round_id?: number }).round_id === sourceRound
    );
    const sourceSubmitted = Boolean(
      sourceAttempt && ((sourceAttempt as { submittedAt?: string | null }).submittedAt || (sourceAttempt as { submitted_at?: string | null }).submitted_at)
    );
    setActiveQualificationPopup({
      sourceRound,
      targetRound,
      qualificationExecuted: false,
      executedAt: null,
      qualifiedCount: 0,
      sourceSubmitted,
      isQualified: false,
      status: sourceSubmitted ? 'AWAITING_DECISION' : 'NOT_SUBMITTED',
      rank: null,
      score: sourceAttempt?.score ?? null,
    });
  };

  // Participant Card Selection in Arena
  const handleSelectRoundCard = (roundId: number) => {
    if (!activeParticipant) {
      navigateToView('login');
      return;
    }

    // Strict Qualification Check for Round 2 and Round 3
    if (roundId === 2 || roundId === 3) {
      const qual = roundId === 2 ? activeParticipant.qualifications?.round2 : activeParticipant.qualifications?.round3;
      if (!qual?.isQualified) {
        if (qual?.status === 'NOT_QUALIFIED' || qual?.status === 'AWAITING_DECISION') {
          setActiveQualificationPopup(qual);
          return;
        }
        handleShowQualificationPopup(roundId as 2 | 3);
        return;
      }
    }

    if (settings.competitionStatus === 'PAUSED') {
      alert('The tournament master has temporarily paused the competition. Round entries and test terminals are on standby.');
      return;
    }
    if (settings.competitionStatus === 'NOT_STARTED') {
      alert('The competition has not started yet. Please standby for the tournament administrator.');
      return;
    }
    if (settings.competitionStatus === 'COMPLETED') {
      alert('The competition has concluded.');
      return;
    }

    const targetStatus = settings.roundStates[roundId] || (settings.roundStates as Record<string, RoundStatus>)[String(roundId)] || 'locked';
    if (targetStatus === 'completed') {
      alert(`Round ${roundId} has concluded. Stage entries and submissions are closed.`);
      return;
    }
    if (targetStatus === 'locked') {
      navigateToView('arena');
      alert(`Round ${roundId} is currently locked by the event administration. Stand by in the Arena Cockpit for stage unlock.`);
      return;
    }

    setTransitioningRound({ participant: activeParticipant, roundId });
  };

  // Handler when participant clicks "Proceed to Round 2 / 3" from post-submission screen
  const handleProceedFromSubmittedRound = (targetRound: 2 | 3) => {
    if (!activeParticipant) {
      navigateToView('login');
      return;
    }
    const qual = targetRound === 2 ? activeParticipant.qualifications?.round2 : activeParticipant.qualifications?.round3;
    if (!qual?.isQualified) {
      handleShowQualificationPopup(targetRound);
      return;
    }
    const targetStatus = settings.roundStates[targetRound] || (settings.roundStates as Record<string, RoundStatus>)[String(targetRound)] || 'locked';
    if (targetStatus === 'active' && settings.competitionStatus === 'LIVE') {
      handleSelectRoundCard(targetRound);
    } else {
      navigateToView('arena');
    }
  };

  const handleParticipantLogin = (participant: Participant) => {
    if (participant.token) {
      localStorage.setItem('bb_participant_token', participant.token);
    }
    setActiveParticipant(participant);
    evaluateQualificationPopups(participant);
    navigateToView('arena');
  };

  const handleParticipantSignOut = async () => {
    try {
      await apiRequest('/auth/logout', { method: 'POST' });
    } catch {}
    localStorage.removeItem('bb_participant_token');
    setActiveParticipant(null);
    setActiveQualificationPopup(null);
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

  // Enforce access control: derive effective view so locked rounds or unqualified sessions fallback to arena / home
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
      if (!activeParticipant.qualifications?.round2?.isQualified) {
        return 'arena';
      }
    }
    if (currentView === 'round-3') {
      if (settings.roundStates[3] === 'locked' || !activeParticipant) return 'arena';
      if (!activeParticipant.qualifications?.round3?.isQualified) {
        return 'arena';
      }
    }
    return currentView;
  })();

  const handleRecordRoundScore = () => {
    void refreshLeaderboardFromServer();
    apiRequest<Participant>('/participants/me')
      .then((p) => {
        if (p?.rollNumber) {
          setActiveParticipantState(p);
          persistActiveParticipant(p);
          evaluateQualificationPopups(p);
        }
      })
      .catch(() => {});
  };

  // Admin Actions
  const handleResetParticipants = () => {
    setActiveParticipant(null);
    setActiveQualificationPopup(null);
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
          competitionStatus={settings.competitionStatus}
          activeParticipant={activeParticipant}
          showLeaderboard={Boolean(settings.leaderboardPublished)}
          onOpenLeaderboard={() => navigateToView('projector')}
          onSelectRound={handleSelectRoundCard}
          onShowQualificationPopup={handleShowQualificationPopup}
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
          onProceedToNextRound={() => handleProceedFromSubmittedRound(2)}
        />
      )}

      {/* 6. DEDICATED ROUND 2 COMPETITION PAGE (Graph Challenge) */}
      {effectiveView === 'round-2' && (
        <Round2GraphChallenge
          participant={activeParticipant}
          onExit={() => navigateToView('arena')}
          onRecordScore={handleRecordRoundScore}
          onProceedToNextRound={() => handleProceedFromSubmittedRound(3)}
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
            onReturnToLanding={() => navigateToView('home')}
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

      {/* 9. PROJECTOR SCOREBOARD (Restricted for participants unless published by Admin) */}
      {effectiveView === 'projector' && (
        isAdminAuthenticated || settings.leaderboardPublished ? (
          <ProjectorLeaderboard
            onReturnToArena={() => navigateToView(activeParticipant ? 'arena' : 'home')}
            onOpenAdmin={() => navigateToView('admin')}
          />
        ) : (
          <div
            style={{
              minHeight: '100vh',
              background: '#050814',
              color: '#F8FAFC',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '24px',
            }}
          >
            <div
              style={{
                maxWidth: '520px',
                width: '100%',
                background: 'linear-gradient(160deg, rgba(15, 23, 42, 0.96), rgba(9, 13, 28, 0.98))',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                borderRadius: '18px',
                padding: '32px 28px',
                textAlign: 'center',
                boxShadow: '0 24px 64px rgba(0, 0, 0, 0.75)',
              }}
            >
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '5px 14px',
                  borderRadius: '999px',
                  background: 'rgba(245, 158, 11, 0.14)',
                  border: '1px solid rgba(245, 158, 11, 0.35)',
                  color: '#FBBF24',
                  fontSize: '0.75rem',
                  fontWeight: 800,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  marginBottom: '16px',
                }}
              >
                🔒 Official Leaderboard Restricted
              </div>
              <h2 style={{ fontSize: '1.45rem', fontWeight: 900, color: '#F8FAFC', marginBottom: '10px' }}>
                Standings Currently Hidden by Admin
              </h2>
              <p style={{ fontSize: '0.92rem', color: '#94A3B8', lineHeight: 1.6, marginBottom: '24px' }}>
                Live leaderboard standings and rank telemetry are restricted during active evaluation. The leaderboard will be displayed here only when published by the Tournament Administrator.
              </p>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => navigateToView(activeParticipant ? 'arena' : 'home')}
                style={{ width: '100%', justifyContent: 'center', padding: '12px 20px', fontWeight: 800 }}
              >
                ← Return to Competition Arena
              </button>
            </div>
          </div>
        )
      )}

      {/* ARENA TRANSITION ANIMATION OVERLAY */}
      {transitioningRound && (
        <ArenaTransitionOverlay
          participantName={transitioningRound.participant.fullName}
          roundId={transitioningRound.roundId}
          onComplete={handleTransitionComplete}
        />
      )}

      {/* QUALIFICATION SELECTION / ELIMINATION POPUP MODAL */}
      {activeParticipant && activeQualificationPopup && effectiveView !== 'admin' && effectiveView !== 'projector' && (
        <QualificationPopupModal
          isOpen={Boolean(activeQualificationPopup)}
          participantName={activeParticipant.fullName}
          rollNumber={activeParticipant.rollNumber}
          qualification={activeQualificationPopup}
          targetRoundStatus={
            settings.roundStates[activeQualificationPopup.targetRound] ||
            (settings.roundStates as Record<string, RoundStatus>)[String(activeQualificationPopup.targetRound)] ||
            'locked'
          }
          onClose={() => setActiveQualificationPopup(null)}
          onProceedToNextRound={(targetRound) => {
            if (targetRound === 2 || targetRound === 3) {
              handleProceedFromSubmittedRound(targetRound);
            }
          }}
        />
      )}

      {/* LIVE PROCTOR BROADCAST NOTIFICATION POPUP (5s auto-hide + Participant Announcement Centre) */}
      <BroadcastNotification currentView={effectiveView} />
    </div>
  );
}

export default App;
