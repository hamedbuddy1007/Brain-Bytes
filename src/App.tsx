import { useState, useEffect } from 'react';
import { ParticipantLandingPage } from './components/ParticipantLandingPage';
import { RoundCredentialModal } from './components/RoundCredentialModal';
import { Round1MCQ } from './components/rounds/Round1MCQ';
import { Round2GraphChallenge } from './components/rounds/Round2GraphChallenge';
import { Round3RapidFire } from './components/rounds/Round3RapidFire';
import { AdminSecurityGate } from './components/AdminSecurityGate';
import { AdminDashboard } from './components/AdminDashboard';
import { ProjectorLeaderboard } from './components/ProjectorLeaderboard';
import { MOCK_TEST_SAMPLE_DATA } from './data/mockData';
import type {
  Participant,
  AdminSettings,
  LeaderboardEntry,
} from './types/competition';
import { checkAdminSession, terminateAdminSession } from './services/adminAuthService';
import {
  getActiveParticipant,
  setActiveParticipant as persistActiveParticipant,
  getAdminSettings,
  saveAdminSettings,
  getUnifiedLeaderboard,
  subscribeToCompetitionSync,
} from './services/competitionStateService';
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
    return 'landing';
  };

  const [currentView, setCurrentView] = useState<AppView>(getInitialView);
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState<boolean>(() => checkAdminSession());
  const [selectedRoundForCredentials, setSelectedRoundForCredentials] = useState<number | null>(null);
  
  // Persistent Active Participant across page refreshes
  const [activeParticipant, setActiveParticipantState] = useState<Participant | null>(() => getActiveParticipant());
  const setActiveParticipant = (p: Participant | null) => {
    setActiveParticipantState(p);
    persistActiveParticipant(p);
  };

  // Synchronized Event State across Participant and Admin interfaces
  const [settings, setSettingsState] = useState<AdminSettings>(() => getAdminSettings());
  const setSettings = (newSettings: AdminSettings | ((prev: AdminSettings) => AdminSettings)) => {
    setSettingsState((prev) => {
      const next = typeof newSettings === 'function' ? newSettings(prev) : newSettings;
      saveAdminSettings(next);
      return next;
    });
  };

  const [participants, setParticipants] = useState<Participant[]>([
    {
      fullName: MOCK_TEST_SAMPLE_DATA.defaultDemo.fullName,
      rollNumber: MOCK_TEST_SAMPLE_DATA.defaultDemo.rollNumber,
      joinCode: MOCK_TEST_SAMPLE_DATA.defaultDemo.joinCode,
      collegeName: MOCK_TEST_SAMPLE_DATA.defaultDemo.collegeName,
      registeredAt: '09:15 AM',
      ticketId: 'DM-BB-8042',
      assignedSeat: 'Auditorium Hall B • Desk #14',
      status: 'verified',
    },
    {
      fullName: 'Priya Iyer',
      rollNumber: 'DS24-A089',
      joinCode: 'BYTE2026',
      collegeName: 'Data Analytics Division',
      registeredAt: '09:22 AM',
      ticketId: 'DM-BB-7721',
      assignedSeat: 'Auditorium Hall B • Desk #18',
      status: 'verified',
    },
  ]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>(() => getUnifiedLeaderboard());

  // Cross-tab and local state synchronization
  useEffect(() => {
    const handleSync = () => {
      setSettingsState(getAdminSettings());
      setLeaderboard(getUnifiedLeaderboard());
      const active = getActiveParticipant();
      if (active) setActiveParticipantState(active);
    };
    const unsubscribe = subscribeToCompetitionSync(handleSync);
    return () => unsubscribe();
  }, []);

  // Synchronize browser history and hash navigation
  useEffect(() => {
    const handleLocationChange = () => {
      const path = window.location.pathname.toLowerCase();
      const hash = window.location.hash.toLowerCase();

      if (path === '/projector' || path === '/admin/projector' || hash.includes('projector')) {
        setCurrentView('projector');
      } else if (path.startsWith('/admin') || hash.includes('admin')) {
        setCurrentView('admin');
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
    } else if (view === 'landing') {
      window.history.pushState(null, '', window.location.pathname === '/admin' ? '/' : '#/');
    }
  };

  // Participant Card Selection & Credential Handlers
  const handleSelectRoundCard = (roundId: number) => {
    setSelectedRoundForCredentials(roundId);
  };

  const handleCredentialSuccess = (participant: Participant) => {
    setActiveParticipant(participant);

    // Add to participants roster if not already present
    setParticipants((prev) => {
      const exists = prev.some((p) => p.rollNumber === participant.rollNumber);
      if (exists) return prev;
      return [participant, ...prev];
    });

    const targetRound = selectedRoundForCredentials;
    setSelectedRoundForCredentials(null);

    if (!targetRound) return;
    const targetStatus = settings.roundStates[targetRound] || 'locked';
    if (targetStatus === 'locked') {
      setCurrentView('landing');
      return;
    }

    // Route to that round's dedicated competition page
    if (targetRound === 1) setCurrentView('round-1');
    else if (targetRound === 2) setCurrentView('round-2');
    else if (targetRound === 3) setCurrentView('round-3');
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

  const handleRecordRoundScore = (roundId: number, score: number) => {
    if (!activeParticipant) return;

    setLeaderboard((prev) => {
      const existingIdx = prev.findIndex((e) => e.rollNumber === activeParticipant.rollNumber);
      if (existingIdx !== -1) {
        const updated = [...prev];
        const prevEntry = updated[existingIdx];
        const r1 = roundId === 1 ? score : prevEntry.round1Score;
        const r2 = roundId === 2 ? score : prevEntry.round2Score;
        const r3 = roundId === 3 ? score : prevEntry.round3Score;
        updated[existingIdx] = {
          ...prevEntry,
          round1Score: r1,
          round2Score: r2,
          round3Score: r3,
          totalScore: r1 + r2 + r3,
          lastActive: 'Just now',
        };
        return updated.sort((a, b) => b.totalScore - a.totalScore);
      } else {
        const newEntry: LeaderboardEntry = {
          id: `ld-${Date.now()}`,
          rank: prev.length + 1,
          name: activeParticipant.fullName,
          rollNumber: activeParticipant.rollNumber,
          collegeName: activeParticipant.collegeName || 'Department of Computing',
          round1Score: roundId === 1 ? score : 0,
          round2Score: roundId === 2 ? score : 0,
          round3Score: roundId === 3 ? score : 0,
          totalScore: score,
          stage: roundId === 3 ? 'Podium Winner' : roundId === 2 ? 'Top 8 Finalist' : 'Qualified R1',
          lastActive: 'Just now',
        };
        return [newEntry, ...prev].sort((a, b) => b.totalScore - a.totalScore);
      }
    });
  };

  // Admin Actions
  const handleRemoveParticipant = (rollNumber: string) => {
    setParticipants((prev) => prev.filter((p) => p.rollNumber !== rollNumber));
    if (activeParticipant?.rollNumber === rollNumber) {
      setActiveParticipant(null);
    }
  };

  const handleResetParticipants = () => {
    setParticipants([]);
    setActiveParticipant(null);
  };

  const handleResetRounds = () => {
    setSettings((prev) => ({
      ...prev,
      roundStates: {
        1: 'active',
        2: 'active',
        3: 'active',
      },
    }));
  };

  return (
    <div className="app-shell" id="app-root">
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
          onExit={() => setCurrentView('landing')}
          onRecordScore={(score) => handleRecordRoundScore(1, score)}
          onProceedToNextRound={() => setCurrentView('round-2')}
        />
      )}

      {/* 3. DEDICATED ROUND 2 COMPETITION PAGE (Graph Challenge) */}
      {effectiveView === 'round-2' && (
        <Round2GraphChallenge
          participant={activeParticipant}
          onExit={() => setCurrentView('landing')}
          onRecordScore={(score) => handleRecordRoundScore(2, score)}
          onProceedToNextRound={() => setCurrentView('round-3')}
        />
      )}

      {/* 4. DEDICATED ROUND 3 COMPETITION PAGE (Rapid Fire) */}
      {effectiveView === 'round-3' && (
        <Round3RapidFire
          participant={activeParticipant}
          onExit={() => setCurrentView('landing')}
          onRecordScore={(score) => handleRecordRoundScore(3, score)}
          onOpenProjector={() => navigateToView('projector')}
        />
      )}

      {/* 5. ADMIN INTERFACE (Accessible via /admin, protected by AdminSecurityGate) */}
      {effectiveView === 'admin' && (
        <AdminSecurityGate
          isAuthenticated={isAdminAuthenticated}
          onAuthenticate={() => setIsAdminAuthenticated(true)}
          onReturnToLanding={() => navigateToView('landing')}
        >
          <AdminDashboard
            settings={settings}
            onUpdateSettings={setSettings}
            participants={participants}
            onRemoveParticipant={handleRemoveParticipant}
            onResetParticipants={handleResetParticipants}
            onResetRounds={handleResetRounds}
            onReturnToArena={() => navigateToView('landing')}
            onOpenProjector={() => navigateToView('projector')}
            onSignOut={() => {
              terminateAdminSession();
              setIsAdminAuthenticated(false);
            }}
            leaderboard={leaderboard}
          />
        </AdminSecurityGate>
      )}

      {/* 6. PROJECTOR SCOREBOARD (Accessible via /projector) */}
      {effectiveView === 'projector' && (
        <ProjectorLeaderboard
          leaderboard={leaderboard}
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
