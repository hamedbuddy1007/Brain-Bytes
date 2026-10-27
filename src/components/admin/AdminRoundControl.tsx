import React, { useState, useEffect } from 'react';
import { Icon } from '../Icon';
import type { AdminSettings, RoundStatus } from '../../types/competition';
import {
  getAllSubmissions,
  getGlobalCompetitionState,
  setGlobalCompetitionState,
  subscribeToCompetitionSync,
  resetRoundState,
  getRoundProgressCount,
  type SubmissionRecord,
} from '../../services/competitionStateService';
import { apiRequest } from '../../services/apiClient';

interface AdminRoundControlProps {
  settings: AdminSettings;
  onUpdateSettings: (newSettings: AdminSettings) => void;
  onLogAudit?: (action: string) => void;
}

export const AdminRoundControl: React.FC<AdminRoundControlProps> = ({
  settings,
  onUpdateSettings,
  onLogAudit,
}) => {
  const [competitionState, setCompetitionStateLocal] = useState(getGlobalCompetitionState);
  const savedDurations = (() => {
    try {
      const raw = localStorage.getItem('bb_admin_durations');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  })();
  const [r1Duration, setR1Duration] = useState<number>(savedDurations?.['1'] ?? 10);
  const [r2Duration, setR2Duration] = useState<number>(savedDurations?.['2'] ?? 10);
  const [r3Duration, setR3Duration] = useState<number>(savedDurations?.['3'] ?? 3);

  // Selected Event & Notification State
  const [selectedRound, setSelectedRound] = useState<1 | 2 | 3>(1);
  const [resetToast, setResetToast] = useState<{
    message: string;
    roundId: number;
  } | null>(null);

  // Live Submissions
  const [submissions, setSubmissions] = useState<SubmissionRecord[]>(getAllSubmissions);
  const [dbStats, setDbStats] = useState<{
    totalParticipants: number;
    activeAttempts: number;
    completedAttempts: number;
    r1Completed: number;
    r2Completed: number;
    r3Completed: number;
  } | null>(null);

  useEffect(() => {
    if (!resetToast) return;
    const timer = setTimeout(() => setResetToast(null), 6000);
    return () => clearTimeout(timer);
  }, [resetToast]);

  useEffect(() => {
    const handleSync = () => {
      setSubmissions(getAllSubmissions());
      setCompetitionStateLocal(getGlobalCompetitionState());
    };
    const unsubscribe = subscribeToCompetitionSync(handleSync);
    return () => unsubscribe();
  }, []);

  // Poll authoritative database stats so submission counts match reality
  useEffect(() => {
    let active = true;
    const fetchDbStats = () => {
      apiRequest<{
        totalParticipants: number;
        activeAttempts: number;
        completedAttempts: number;
        r1Completed: number;
        r2Completed: number;
        r3Completed: number;
      }>('/admin/overview-stats')
        .then((data) => {
          if (active && data) setDbStats(data);
        })
        .catch(() => {});
    };
    fetchDbStats();
    const interval = setInterval(fetchDbStats, 4000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  // Load the authoritative global status and round durations from the server
  useEffect(() => {
    let isMounted = true;
    apiRequest<{
      status: 'NOT_STARTED' | 'LIVE' | 'PAUSED' | 'COMPLETED';
      round_durations?: Record<string, number>;
    }>('/competition/state')
      .then((state) => {
        if (!isMounted || !state) return;
        if (state.status) setCompetitionStateLocal(state.status);
        if (state.round_durations) {
          const d1 = state.round_durations['1'] ? Math.round(state.round_durations['1'] / 60) : undefined;
          const d2 = state.round_durations['2'] ? Math.round(state.round_durations['2'] / 60) : undefined;
          const d3 = state.round_durations['3'] ? Math.round(state.round_durations['3'] / 60) : undefined;
          if (d1 !== undefined) setR1Duration(d1);
          if (d2 !== undefined) setR2Duration(d2);
          if (d3 !== undefined) setR3Duration(d3);
          try {
            localStorage.setItem(
              'bb_admin_durations',
              JSON.stringify({
                '1': d1 ?? 10,
                '2': d2 ?? 10,
                '3': d3 ?? 3,
              })
            );
          } catch {
            // ignore
          }
        }
      })
      .catch(() => { /* keep local value if server unreachable */ });
    return () => {
      isMounted = false;
    };
  }, []);

  // Push the global status to the server; participants are only affected if this succeeds
  const pushGlobalStatus = (status: 'NOT_STARTED' | 'LIVE' | 'PAUSED' | 'COMPLETED') => {
    apiRequest('/admin/competition/state', {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }).catch((err: unknown) => {
      alert(`The server did not accept the state change (${err instanceof Error ? err.message : 'unknown error'}). Participants are NOT affected. Check that you are signed in and the backend is running.`);
    });
  };

  // Confirmation Modal for Consequential Actions
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    description: '',
    onConfirm: () => { },
  });

  const handleCompleteRound = (roundId: 1 | 2 | 3) => {
    const isAlreadyCompleted = settings.roundStates[roundId] === 'completed';
    if (isAlreadyCompleted) {
      setConfirmModal({
        isOpen: true,
        title: `Reopen Round ${roundId}`,
        description: `Round ${roundId} is currently marked as Completed. Would you like to reopen this round to Active status?`,
        onConfirm: () => {
          const nextStates = {
            ...settings.roundStates,
            [roundId]: 'active' as RoundStatus,
          };
          onUpdateSettings({
            ...settings,
            adminCustomized: true,
            roundStates: nextStates,
          });
          apiRequest('/admin/competition/state', {
            method: 'PATCH',
            body: JSON.stringify({ roundStates: { [roundId]: 'active' } }),
          }).catch((err) => console.warn('Failed updating round state:', err));
          if (onLogAudit) {
            onLogAudit(`Admin reopened Round ${roundId} to active`);
          }
          setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        },
      });
      return;
    }

    setConfirmModal({
      isOpen: true,
      title: `Complete Round ${roundId} — Conclude Stage`,
      description: `Are you sure you want to officially mark Round ${roundId} as Completed? This will conclude testing for this stage, lock candidate entries, and finalize submissions.`,
      onConfirm: () => {
        const nextStates = {
          ...settings.roundStates,
          [roundId]: 'completed' as RoundStatus,
        };
        onUpdateSettings({
          ...settings,
          adminCustomized: true,
          roundStates: nextStates,
        });
        apiRequest('/admin/competition/state', {
          method: 'PATCH',
          body: JSON.stringify({ roundStates: { [roundId]: 'completed' } }),
        }).catch((err) => console.warn('Failed updating round state:', err));
        if (onLogAudit) {
          onLogAudit(`Admin marked Round ${roundId} as Completed`);
        }
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
      },
    });
  };

  const handleToggleRound = (roundId: 1 | 2 | 3) => {
    const currentStatus = settings.roundStates[roundId];
    const newStatus: RoundStatus = currentStatus === 'active' ? 'locked' : 'active';

    if (newStatus === 'locked') {
      setConfirmModal({
        isOpen: true,
        title: `Lock Entry for Round ${roundId}`,
        description: `Are you sure you want to lock new entries for Round ${roundId}? Existing candidate sessions will continue until their countdown expires.`,
        onConfirm: () => {
          const nextStates = {
            ...settings.roundStates,
            [roundId]: 'locked' as RoundStatus,
          };
          onUpdateSettings({
            ...settings,
            adminCustomized: true,
            roundStates: nextStates,
          });
          apiRequest('/admin/competition/state', {
            method: 'PATCH',
            body: JSON.stringify({ roundStates: { [roundId]: 'locked' } }),
          }).catch((err) => console.warn('Failed updating round state:', err));
          setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        },
      });
    } else {
      const nextStates = {
        ...settings.roundStates,
        [roundId]: 'active' as RoundStatus,
      };
      onUpdateSettings({
        ...settings,
        adminCustomized: true,
        roundStates: nextStates,
      });
      apiRequest('/admin/competition/state', {
        method: 'PATCH',
        body: JSON.stringify({ roundStates: { [roundId]: 'active' } }),
      }).catch((err) => console.warn('Failed updating round state:', err));
    }
  };

  const handleUpdateDuration = (roundId: 1 | 2 | 3, newMinutes: number) => {
    if (newMinutes < 1 || newMinutes > 120) {
      alert('Round duration must be between 1 and 120 minutes.');
      return;
    }
    const nextR1 = roundId === 1 ? newMinutes : r1Duration;
    const nextR2 = roundId === 2 ? newMinutes : r2Duration;
    const nextR3 = roundId === 3 ? newMinutes : r3Duration;

    if (roundId === 1) setR1Duration(newMinutes);
    if (roundId === 2) setR2Duration(newMinutes);
    if (roundId === 3) setR3Duration(newMinutes);

    try {
      localStorage.setItem(
        'bb_admin_durations',
        JSON.stringify({
          '1': nextR1,
          '2': nextR2,
          '3': nextR3,
        })
      );
    } catch {
      // ignore
    }

    apiRequest('/admin/competition/state', {
      method: 'PATCH',
      body: JSON.stringify({
        roundDurations: {
          '1': nextR1 * 60,
          '2': nextR2 * 60,
          '3': nextR3 * 60,
        },
      }),
    }).catch((err: unknown) => {
      console.warn('Failed saving duration to server:', err);
    });
  };

  const handleGlobalStateChange = (newState: 'NOT_STARTED' | 'LIVE' | 'PAUSED' | 'COMPLETED') => {
    if (newState === 'PAUSED' || newState === 'COMPLETED') {
      setConfirmModal({
        isOpen: true,
        title: `Change Competition State to ${newState}`,
        description: `Warning: Setting global state to ${newState} will broadcast a tournament state update to all connected competitor terminals. Continue?`,
        onConfirm: () => {
          setGlobalCompetitionState(newState);
          setCompetitionStateLocal(newState);
          pushGlobalStatus(newState);
          setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        },
      });
    } else {
      setGlobalCompetitionState(newState);
      setCompetitionStateLocal(newState);
      pushGlobalStatus(newState);
    }
  };



  const handleResetRound = (targetRoundId: 1 | 2 | 3) => {
    const roundName =
      targetRoundId === 1
        ? 'Round 1   Data MCQ'
        : targetRoundId === 2
          ? 'Round 2   Graph Challenge'
          : 'Round 3   Rapid Fire';

    const targetSubs =
      targetRoundId === 1
        ? (dbStats?.r1Completed ?? submissions.filter((s) => s.roundId === 1).length)
        : targetRoundId === 2
          ? (dbStats?.r2Completed ?? submissions.filter((s) => s.roundId === 2).length)
          : (dbStats?.r3Completed ?? submissions.filter((s) => s.roundId === 3).length);
    const inProgressCount = dbStats?.activeAttempts ?? getRoundProgressCount(targetRoundId);

    setConfirmModal({
      isOpen: true,
      title: `Reset ${roundName}   Confirm Action`,
      description: `Warning: You are about to reset all entries and participant progress for ${roundName}. This will permanently delete ${targetSubs} verified submissions, clear ${inProgressCount} in-progress candidate answer sheets and timers, and clear leaderboard standings for this stage. Connected participant terminals will be reset for a fresh attempt. Continue?`,
      onConfirm: async () => {
        try {
          await apiRequest(`/admin/rounds/${targetRoundId}/reset`, { method: 'POST' });
        } catch (err) {
          console.warn('Server round reset notice:', err);
        }
        resetRoundState(targetRoundId);
        setSubmissions(getAllSubmissions());
        if (onLogAudit) {
          onLogAudit(`Admin reset all entries and participant progress for Round ${targetRoundId}`);
        }
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        setResetToast({
          message: `Successfully reset ${roundName} on the server! All attempts and in-progress drafts cleared.`,
          roundId: targetRoundId,
        });
      },
    });
  };

  const r1State = settings.roundStates[1] || 'locked';
  const r2State = settings.roundStates[2] || 'locked';
  const r3State = settings.roundStates[3] || 'locked';

  const r1SubmissionsCount = dbStats ? dbStats.r1Completed : submissions.filter((s) => s.roundId === 1).length;
  const r2SubmissionsCount = dbStats ? dbStats.r2Completed : submissions.filter((s) => s.roundId === 2).length;
  const r3SubmissionsCount = dbStats ? dbStats.r3Completed : submissions.filter((s) => s.roundId === 3).length;

  const selectedRoundSubmissionsCount =
    selectedRound === 1 ? r1SubmissionsCount : selectedRound === 2 ? r2SubmissionsCount : r3SubmissionsCount;
  const selectedRoundProgressCount = dbStats ? dbStats.activeAttempts : getRoundProgressCount(selectedRound);
  const selectedRoundName =
    selectedRound === 1
      ? 'Round 1   Data MCQ'
      : selectedRound === 2
        ? 'Round 2   Graph Challenge'
        : 'Round 3   Rapid Fire';

  return (
    <div className="overview-container">
      {/* Screen Header */}
      <div className="screen-header-block">
        <h1 className="screen-maintitle">Round Control</h1>
        <p className="screen-subtitle">Manage stage authorization, monitor live submissions, and control competition flow</p>
      </div>

      {/* Success Notification Banner for Reset Action */}
      {resetToast && (
        <div className="admin-reset-toast-banner" role="status">
          <div className="reset-toast-left">
            <Icon name="check-circle" size={18} className="toast-icon-success" />
            <div>
              <strong style={{ color: '#22C55E' }}>Round Reset Completed: </strong>
              <span>{resetToast.message}</span>
            </div>
          </div>
          <button
            type="button"
            className="btn-close-toast"
            onClick={() => setResetToast(null)}
            aria-label="Dismiss toast"
          >
            ✕
          </button>
        </div>
      )}

      {/* SELECTED EVENT MANAGEMENT & RESET BAR */}
      <section className="admin-panel-card selected-event-panel" aria-label="Selected Event Management">
        <div className="panel-card-header">
          <div className="panel-title-group">
            <Icon name="sliders" size={17} className="panel-header-icon" />
            <div>
              <h3 className="panel-title">Selected Event Stage Operations</h3>
              <span className="panel-subtitle">
                Select a tournament stage to monitor live entries and execute administrative resets
              </span>
            </div>
          </div>

          {/* Stage Selector Tabs */}
          <div className="event-stage-pill-selector" role="tablist" aria-label="Select Event Round">
            <button
              type="button"
              role="tab"
              aria-selected={selectedRound === 1}
              className={`event-selector-tab ${selectedRound === 1 ? 'is-active-tab' : ''}`}
              onClick={() => setSelectedRound(1)}
            >
              <span className="tab-round-num">01</span>
              <span>Round 1 (MCQ)</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={selectedRound === 2}
              className={`event-selector-tab ${selectedRound === 2 ? 'is-active-tab' : ''}`}
              onClick={() => setSelectedRound(2)}
            >
              <span className="tab-round-num">02</span>
              <span>Round 2 (Graph)</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={selectedRound === 3}
              className={`event-selector-tab ${selectedRound === 3 ? 'is-active-tab' : ''}`}
              onClick={() => setSelectedRound(3)}
            >
              <span className="tab-round-num">03</span>
              <span>Round 3 (Rapid)</span>
            </button>
          </div>
        </div>

        <div className="selected-event-content-box">
          {/* 4 Quick Metrics for Selected Event */}
          <div className="selected-event-stats-row">
            <div className="event-stat-card">
              <span className="stat-label">SELECTED STAGE</span>
              <span className="stat-value-highlight">{selectedRoundName}</span>
              <span className="stat-subtext">
                {selectedRound === 1
                  ? 'Screening Phase • Top 15 Advance'
                  : selectedRound === 2
                    ? 'Visual Analytical • Top 8 Finalists'
                    : 'Grand Finale • Podium Ranking'}
              </span>
            </div>

            <div className="event-stat-card">
              <span className="stat-label">GATE ACCESS</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                <span
                  className={`status-pill ${
                    settings.roundStates[selectedRound] === 'completed'
                      ? 'is-completed'
                      : settings.roundStates[selectedRound] === 'active'
                        ? 'is-active'
                        : 'is-locked'
                  }`}
                >
                  {settings.roundStates[selectedRound] === 'completed'
                    ? 'Completed'
                    : settings.roundStates[selectedRound] === 'active'
                      ? 'Active / Open'
                      : 'Locked'}
                </span>
                <span style={{ fontSize: '0.8rem', color: '#B8B2B7', fontFamily: 'JetBrains Mono, monospace' }}>
                  {selectedRound === 1 ? r1Duration : selectedRound === 2 ? r2Duration : r3Duration} min limit
                </span>
              </div>
              <span className="stat-subtext">
                {settings.roundStates[selectedRound] === 'completed'
                  ? 'Stage concluded • Submissions frozen'
                  : settings.roundStates[selectedRound] === 'active'
                    ? 'Candidates may enter and attempt'
                    : 'Candidate entry restricted'}
              </span>
            </div>

            <div className="event-stat-card">
              <span className="stat-label">VERIFIED SUBMISSIONS</span>
              <span
                className="stat-value"
                style={{
                  color: selectedRoundSubmissionsCount > 0 ? '#22C55E' : '#B8B2B7',
                }}
              >
                {selectedRoundSubmissionsCount} Submissions
              </span>
              <span className="stat-subtext">Scored & recorded attempts</span>
            </div>

            <div className="event-stat-card">
              <span className="stat-label">IN-PROGRESS DRAFTS</span>
              <span
                className="stat-value"
                style={{
                  color: selectedRoundProgressCount > 0 ? '#F59E0B' : '#B8B2B7',
                }}
              >
                {selectedRoundProgressCount} In-Session
              </span>
              <span className="stat-subtext">Active countdown timers & drafts</span>
            </div>
          </div>

          {/* Reset Round Action Bar */}
          <div className="selected-event-reset-bar">
            <div className="reset-bar-info">
              <div className="reset-bar-title">
                <Icon name="sliders" size={16} style={{ color: '#F59E0B' }} />
                <span>Stage Actions for Selected Event</span>
              </div>
              <p className="reset-bar-desc">
                Conclude stage testing or reset submissions, scores, and draft attempts for{' '}
                <strong>{selectedRoundName}</strong>.
              </p>
            </div>

            <div className="reset-bar-actions" style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
              <button
                type="button"
                className={`btn ${settings.roundStates[selectedRound] === 'completed' ? 'btn-success-outline' : 'btn-success'}`}
                onClick={() => handleCompleteRound(selectedRound)}
                id="btn-complete-selected-round"
                title={settings.roundStates[selectedRound] === 'completed' ? 'Round is completed. Click to reopen.' : 'Officially mark this round as completed'}
              >
                <Icon name="check-circle" size={15} />
                <span>{settings.roundStates[selectedRound] === 'completed' ? `Round ${selectedRound} Completed (Reopen)` : `Complete Round ${selectedRound}`}</span>
              </button>
              <button
                type="button"
                className="btn btn-danger btn-reset-stage"
                onClick={() => handleResetRound(selectedRound)}
                id="btn-reset-selected-round"
              >
                <Icon name="refresh-cw" size={15} />
                <span>Reset Round {selectedRound}</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Three Round Cards */}
      <section className="round-control-cards-grid" aria-label="Competition Rounds Control">
        {/* Card 1: Round 1   Data MCQ */}
        <div className={`round-control-card ${r1State === 'active' ? 'is-active-card' : ''}`}>
          <div className="round-card-main-content">
            <div className="round-card-header-row">
              <span className="round-card-num-badge">ROUND 1</span>
              <span className={`status-pill ${r1State === 'completed' ? 'is-completed' : r1State === 'active' ? 'is-active' : 'is-locked'}`}>
                {r1State === 'completed' ? 'Completed' : r1State === 'active' ? 'Active' : 'Locked'}
              </span>
            </div>

            <h3 className="round-control-title">Round 1   Data MCQ</h3>

            <div className="round-control-meta-list">
              <div className="meta-list-item">
                <span className="meta-item-label">Duration:</span>
                <span className="meta-item-value">{r1Duration} minutes</span>
              </div>
              <div className="meta-list-item">
                <span className="meta-item-label">Submissions Recorded:</span>
                <span className="meta-item-value" style={{ color: '#22C55E', fontWeight: 700 }}>
                  {r1SubmissionsCount} verified submissions
                </span>
              </div>
            </div>
          </div>

          <div className="round-card-action-wrapper">
            <div className="round-card-actions-stack">
              <button
                type="button"
                className={`btn w-full ${r1State === 'active' ? 'btn-secondary' : 'btn-primary'}`}
                onClick={() => handleToggleRound(1)}
              >
                <Icon name={r1State === 'active' ? 'lock' : 'play'} size={15} />
                <span>{r1State === 'active' ? 'Lock Round 1 Entry' : 'Start Round 1'}</span>
              </button>
              <button
                type="button"
                className={`btn w-full ${r1State === 'completed' ? 'btn-success-outline' : 'btn-success'}`}
                onClick={() => handleCompleteRound(1)}
                title={r1State === 'completed' ? 'Round 1 is completed. Click to reopen.' : 'Officially mark Round 1 as completed'}
              >
                <Icon name="check-circle" size={15} />
                <span>{r1State === 'completed' ? 'Round 1 Completed (Reopen)' : 'Complete Round 1'}</span>
              </button>
              <button
                type="button"
                className="btn btn-danger-outline w-full"
                onClick={() => handleResetRound(1)}
                title="Reset all entries and participant progress for Round 1"
              >
                <Icon name="refresh-cw" size={13} />
                <span>Reset Round 1</span>
              </button>
            </div>
          </div>
        </div>

        {/* Card 2: Round 2   Graph Challenge */}
        <div className={`round-control-card ${r2State === 'active' ? 'is-active-card' : ''}`}>
          <div className="round-card-main-content">
            <div className="round-card-header-row">
              <span className="round-card-num-badge">ROUND 2</span>
              <span className={`status-pill ${r2State === 'completed' ? 'is-completed' : r2State === 'active' ? 'is-active' : 'is-locked'}`}>
                {r2State === 'completed' ? 'Completed' : r2State === 'active' ? 'Active' : 'Locked'}
              </span>
            </div>

            <h3 className="round-control-title">Round 2   Graph Challenge</h3>

            <div className="round-control-meta-list">
              <div className="meta-list-item">
                <span className="meta-item-label">Duration:</span>
                <span className="meta-item-value">{r2Duration} minutes</span>
              </div>
              <div className="meta-list-item">
                <span className="meta-item-label">Submissions Recorded:</span>
                <span className="meta-item-value" style={{ color: '#22C55E', fontWeight: 700 }}>
                  {r2SubmissionsCount} verified submissions
                </span>
              </div>
            </div>
          </div>

          <div className="round-card-action-wrapper">
            <div className="round-card-actions-stack">
              <button
                type="button"
                className={`btn w-full ${r2State === 'active' ? 'btn-secondary' : 'btn-primary'}`}
                onClick={() => handleToggleRound(2)}
              >
                <Icon name={r2State === 'active' ? 'lock' : 'play'} size={15} />
                <span>{r2State === 'active' ? 'Lock Round 2 Entry' : 'Start Round 2'}</span>
              </button>
              <button
                type="button"
                className={`btn w-full ${r2State === 'completed' ? 'btn-success-outline' : 'btn-success'}`}
                onClick={() => handleCompleteRound(2)}
                title={r2State === 'completed' ? 'Round 2 is completed. Click to reopen.' : 'Officially mark Round 2 as completed'}
              >
                <Icon name="check-circle" size={15} />
                <span>{r2State === 'completed' ? 'Round 2 Completed (Reopen)' : 'Complete Round 2'}</span>
              </button>
              <button
                type="button"
                className="btn btn-danger-outline w-full"
                onClick={() => handleResetRound(2)}
                title="Reset all entries and participant progress for Round 2"
              >
                <Icon name="refresh-cw" size={13} />
                <span>Reset Round 2</span>
              </button>
            </div>
          </div>
        </div>

        {/* Card 3: Round 3   Rapid Fire */}
        <div className={`round-control-card ${r3State === 'active' ? 'is-active-card' : ''}`}>
          <div className="round-card-main-content">
            <div className="round-card-header-row">
              <span className="round-card-num-badge">ROUND 3</span>
              <span className={`status-pill ${r3State === 'completed' ? 'is-completed' : r3State === 'active' ? 'is-active' : 'is-locked'}`}>
                {r3State === 'completed' ? 'Completed' : r3State === 'active' ? 'Active' : 'Locked'}
              </span>
            </div>

            <h3 className="round-control-title">Round 3   Rapid Fire</h3>

            <div className="round-control-meta-list">
              <div className="meta-list-item">
                <span className="meta-item-label">Duration:</span>
                <span className="meta-item-value">{r3Duration} minutes</span>
              </div>
              <div className="meta-list-item">
                <span className="meta-item-label">Submissions Recorded:</span>
                <span className="meta-item-value" style={{ color: '#F59E0B', fontWeight: 700 }}>
                  {r3SubmissionsCount} final submissions
                </span>
              </div>
              <div className="meta-list-item">
                <span className="meta-item-label">Stage Purpose:</span>
                <span className="meta-item-value">Grand Podium Final</span>
              </div>
              <div className="meta-list-item">
                <span className="meta-item-label">Marking Rules:</span>
                <span className="meta-item-value" style={{ color: '#22C55E' }}>+5 correct / −2 incorrect / 0 unanswered</span>
              </div>
            </div>
          </div>

          <div className="round-card-action-wrapper">
            <div className="round-card-actions-stack">
              <button
                type="button"
                className={`btn w-full ${r3State === 'active' ? 'btn-secondary' : 'btn-primary'}`}
                onClick={() => handleToggleRound(3)}
              >
                <Icon name={r3State === 'active' ? 'lock' : 'play'} size={15} />
                <span>{r3State === 'active' ? 'Lock Round 3 Entry' : 'Start Round 3'}</span>
              </button>
              <button
                type="button"
                className={`btn w-full ${r3State === 'completed' ? 'btn-success-outline' : 'btn-success'}`}
                onClick={() => handleCompleteRound(3)}
                title={r3State === 'completed' ? 'Round 3 is completed. Click to reopen.' : 'Officially mark Round 3 as completed'}
              >
                <Icon name="check-circle" size={15} />
                <span>{r3State === 'completed' ? 'Round 3 Completed (Reopen)' : 'Complete Round 3'}</span>
              </button>
              <button
                type="button"
                className="btn btn-danger-outline w-full"
                onClick={() => handleResetRound(3)}
                title="Reset all entries and participant progress for Round 3"
              >
                <Icon name="refresh-cw" size={13} />
                <span>Reset Round 3</span>
              </button>
            </div>
          </div>
        </div>
      </section>



      {/* Secondary Controls Section */}
      <section className="admin-panel-card secondary-controls-panel" aria-label="Secondary Controls">
        <div className="panel-card-header">
          <div className="panel-title-group">
            <Icon name="sliders" size={17} className="panel-header-icon" />
            <div>
              <h3 className="panel-title">Round Durations & Global Controls</h3>
              <span className="panel-subtitle">Configure attempt durations and overarching tournament state</span>
            </div>
          </div>
          <span className="badge-secondary-label">Secondary Controls</span>
        </div>

        <div className="secondary-controls-grid">
          {/* Duration Editing */}
          <div className="secondary-block">
            <h4 className="secondary-block-title">Adjust Default Durations</h4>
            <p className="secondary-block-desc">Modifications apply strictly to new candidate attempts; live sessions preserve timers.</p>

            <div className="duration-steppers-list">
              <div className="duration-stepper-row">
                <span className="stepper-label">Round 1 (Data MCQ):</span>
                <div className="stepper-controls">
                  <button
                    type="button"
                    className="btn-stepper"
                    onClick={() => handleUpdateDuration(1, r1Duration - 1)}
                    aria-label="Decrease Round 1 duration"
                  >
                    -
                  </button>
                  <span className="stepper-value">{r1Duration} min</span>
                  <button
                    type="button"
                    className="btn-stepper"
                    onClick={() => handleUpdateDuration(1, r1Duration + 1)}
                    aria-label="Increase Round 1 duration"
                  >
                    +
                  </button>
                </div>
              </div>

              <div className="duration-stepper-row">
                <span className="stepper-label">Round 2 (Graph Challenge):</span>
                <div className="stepper-controls">
                  <button
                    type="button"
                    className="btn-stepper"
                    onClick={() => handleUpdateDuration(2, r2Duration - 1)}
                    aria-label="Decrease Round 2 duration"
                  >
                    -
                  </button>
                  <span className="stepper-value">{r2Duration} min</span>
                  <button
                    type="button"
                    className="btn-stepper"
                    onClick={() => handleUpdateDuration(2, r2Duration + 1)}
                    aria-label="Increase Round 2 duration"
                  >
                    +
                  </button>
                </div>
              </div>

              <div className="duration-stepper-row">
                <span className="stepper-label">Round 3 (Rapid Fire):</span>
                <div className="stepper-controls">
                  <button
                    type="button"
                    className="btn-stepper"
                    onClick={() => handleUpdateDuration(3, r3Duration - 1)}
                    aria-label="Decrease Round 3 duration"
                  >
                    -
                  </button>
                  <span className="stepper-value">{r3Duration} min</span>
                  <button
                    type="button"
                    className="btn-stepper"
                    onClick={() => handleUpdateDuration(3, r3Duration + 1)}
                    aria-label="Increase Round 3 duration"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Global Competition State */}
          <div className="secondary-block">
            <h4 className="secondary-block-title">Tournament Master State</h4>
            <p className="secondary-block-desc">Broadcasts tournament state status to connected auditorium terminals.</p>

            <div className="state-buttons-row">
              <button
                type="button"
                className={`btn-state-selector ${competitionState === 'NOT_STARTED' ? 'is-selected' : ''}`}
                onClick={() => handleGlobalStateChange('NOT_STARTED')}
              >
                Not Started
              </button>
              <button
                type="button"
                className={`btn-state-selector ${competitionState === 'LIVE' ? 'is-selected' : ''}`}
                onClick={() => handleGlobalStateChange('LIVE')}
              >
                Live
              </button>
              <button
                type="button"
                className={`btn-state-selector ${competitionState === 'PAUSED' ? 'is-selected' : ''}`}
                onClick={() => handleGlobalStateChange('PAUSED')}
              >
                Paused
              </button>
              <button
                type="button"
                className={`btn-state-selector ${competitionState === 'COMPLETED' ? 'is-selected' : ''}`}
                onClick={() => handleGlobalStateChange('COMPLETED')}
              >
                Completed
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Confirmation Dialog for Consequential Actions */}
      {confirmModal.isOpen && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="admin-confirm-modal-card">
            <div className="confirm-modal-header">
              <Icon name="alert-triangle" size={20} className="confirm-icon-warning" />
              <h3 className="confirm-modal-title">{confirmModal.title}</h3>
            </div>
            <p className="confirm-modal-desc">{confirmModal.description}</p>
            <div className="confirm-modal-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setConfirmModal((prev) => ({ ...prev, isOpen: false }))}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={confirmModal.onConfirm}
              >
                Confirm Action
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
