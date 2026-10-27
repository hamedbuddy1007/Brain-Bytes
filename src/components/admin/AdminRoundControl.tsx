import React, { useState, useEffect, useCallback } from 'react';
import { Icon } from '../Icon';
import type { AdminSettings, RoundStatus } from '../../types/competition';
import {
  getAllSubmissions,
  getGlobalCompetitionState,
  setGlobalCompetitionState,
  subscribeToCompetitionSync,
  resetRoundState,
  getRoundProgressCount,
  clearAllAttemptsOnly,
  purgeAllTournamentData,
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
    r2Qualified?: number;
    r3Qualified?: number;
  } | null>(null);

  // Qualification State & Modal
  const [qualifyModal, setQualifyModal] = useState<{
    isOpen: boolean;
    sourceRound: 1 | 2;
    limit: number;
    completedCount: number;
  }>({
    isOpen: false,
    sourceRound: 1,
    limit: 50,
    completedCount: 0,
  });
  const [isQualifying, setIsQualifying] = useState(false);

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

  const fetchDbStats = useCallback(() => {
    apiRequest<{
      totalParticipants: number;
      activeAttempts: number;
      completedAttempts: number;
      r1Completed: number;
      r2Completed: number;
      r3Completed: number;
      r2Qualified?: number;
      r3Qualified?: number;
    }>('/admin/overview-stats')
      .then((data) => {
        if (data) setDbStats(data);
      })
      .catch(() => {});
  }, []);

  // Poll authoritative database stats so submission counts match reality
  useEffect(() => {
    fetchDbStats();
    const interval = setInterval(fetchDbStats, 4000);
    return () => {
      clearInterval(interval);
    };
  }, [fetchDbStats]);

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

  // Push the global status to the server; participants and UI are synced upon confirmation
  const pushGlobalStatus = async (status: 'NOT_STARTED' | 'LIVE' | 'PAUSED' | 'COMPLETED') => {
    try {
      await apiRequest('/admin/competition/state', {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      setGlobalCompetitionState(status);
      setCompetitionStateLocal(status);
      onUpdateSettings({
        ...settings,
        competitionStatus: status,
      });

      const messageMap: Record<string, string> = {
        PAUSED: 'Tournament Master State set to PAUSED. Active timers are frozen on all candidate terminals and question interactions are locked.',
        LIVE: 'Tournament Master State set to LIVE. Examination resumed; pause duration has been automatically credited to active participant countdowns.',
        NOT_STARTED: 'Tournament Master State set to NOT STARTED. Candidate stage entries are blocked.',
        COMPLETED: 'Tournament Master State set to COMPLETED. Concluded competition.',
      };

      setResetToast({
        message: messageMap[status] || `Tournament Master State updated to ${status}.`,
        roundId: 0,
      });

      if (onLogAudit) {
        onLogAudit(`Admin changed Tournament Master State to ${status}`);
      }
    } catch (err: unknown) {
      alert(`The server did not accept the state change (${err instanceof Error ? err.message : 'unknown error'}). Participants are NOT affected. Check that you are signed in and the backend is running.`);
    }
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

  const handleOpenQualify = (sourceRound: 1 | 2) => {
    const completedCount = sourceRound === 1
      ? (dbStats?.r1Completed ?? submissions.filter((s) => s.roundId === 1).length)
      : (dbStats?.r2Completed ?? submissions.filter((s) => s.roundId === 2).length);

    const defaultLimit = sourceRound === 1
      ? Math.max(1, Math.min(completedCount || 50, 200))
      : Math.max(1, Math.min(completedCount || 8, 200));

    setQualifyModal({
      isOpen: true,
      sourceRound,
      limit: defaultLimit,
      completedCount,
    });
  };

  const handleExecuteQualify = async () => {
    if (isQualifying) return;
    setIsQualifying(true);
    try {
      const res = await apiRequest<{
        sourceRound: number;
        nextRound: number;
        qualifiedCount: number;
        qualifiedParticipantIds: number[];
      }>(`/admin/qualify/${qualifyModal.sourceRound}`, {
        method: 'POST',
        body: JSON.stringify({ limit: qualifyModal.limit }),
      });

      setQualifyModal((prev) => ({ ...prev, isOpen: false }));
      setResetToast({
        message: `Successfully qualified ${res.qualifiedCount} candidates for Round ${res.nextRound}! They are now authorized in the database to enter and submit Round ${res.nextRound}.`,
        roundId: qualifyModal.sourceRound,
      });

      // Refresh overview stats immediately
      apiRequest<{
        totalParticipants: number;
        activeAttempts: number;
        completedAttempts: number;
        r1Completed: number;
        r2Completed: number;
        r3Completed: number;
        r2Qualified?: number;
        r3Qualified?: number;
      }>('/admin/overview-stats').then((data) => {
        if (data) setDbStats(data);
      }).catch(() => {});

      if (onLogAudit) {
        onLogAudit(`Admin executed qualification for Round ${qualifyModal.sourceRound}: ${res.qualifiedCount} promoted to Round ${res.nextRound} (limit ${qualifyModal.limit})`);
      }
    } catch (err: unknown) {
      alert(`Qualification failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsQualifying(false);
    }
  };

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

  const [extendingRound, setExtendingRound] = useState<number | null>(null);

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
    })
      .then(() => {
        setResetToast({
          message: `Round ${roundId} default duration successfully updated to ${newMinutes} minutes. Synced to database & active sessions.`,
          roundId,
        });
        if (onLogAudit) {
          onLogAudit(`Admin updated Round ${roundId} default duration to ${newMinutes} minutes`);
        }
      })
      .catch((err: unknown) => {
        console.warn('Failed saving duration to server:', err);
        alert(`Failed to save duration: ${err instanceof Error ? err.message : 'Unknown error'}`);
      });
  };

  const handleExtendTimeEveryone = async (roundId: 1 | 2 | 3, minutes: number) => {
    if (extendingRound !== null) return;
    setExtendingRound(roundId);
    try {
      const res = await apiRequest<{
        success: boolean;
        roundId: number;
        additionalMinutes: number;
        affectedCount: number;
        message: string;
      }>(`/admin/rounds/${roundId}/extend-time`, {
        method: 'POST',
        body: JSON.stringify({ additionalMinutes: minutes }),
      });
      setResetToast({
        message: res?.message || `Successfully added +${minutes} minute(s) to all active candidates in Round ${roundId}!`,
        roundId,
      });
      if (onLogAudit) {
        onLogAudit(`Admin extended Round ${roundId} time by +${minutes}m for all active candidates (${res?.affectedCount ?? 0} affected)`);
      }
      fetchDbStats();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to extend time.';
      alert(`Could not extend time: ${msg}`);
    } finally {
      setExtendingRound(null);
    }
  };

  const handleGlobalStateChange = (newState: 'NOT_STARTED' | 'LIVE' | 'PAUSED' | 'COMPLETED') => {
    if (newState === 'PAUSED' || newState === 'COMPLETED') {
      setConfirmModal({
        isOpen: true,
        title: `Change Competition State to ${newState}`,
        description: `Warning: Setting global state to ${newState} will broadcast a tournament state update to all connected competitor terminals. Continue?`,
        onConfirm: () => {
          pushGlobalStatus(newState);
          setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        },
      });
    } else {
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

  const handleResetAttemptsKeepParticipants = () => {
    setConfirmModal({
      isOpen: true,
      title: 'Reset All Attempts (Keep Registered Participants)',
      description: 'Are you sure you want to reset all round attempts? All registered participants will remain in the database with their roll numbers, names, and departments, but ALL round submissions, answer sheets, scores, and qualifications will be wiped clean. Participants will be able to take the rounds again fresh.',
      onConfirm: async () => {
        try {
          await apiRequest('/admin/reset-attempts', { method: 'POST' });
          clearAllAttemptsOnly();
          setSubmissions([]);
          setResetToast({
            message: 'All participant attempts have been reset. Registered participants are retained.',
            roundId: 0,
          });
          fetchDbStats();
        } catch (err) {
          alert(`Failed to reset attempts: ${err instanceof Error ? err.message : 'Unknown error'}`);
        } finally {
          setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        }
      },
    });
  };

  const handleResetAllParticipantsAndAttempts = () => {
    setConfirmModal({
      isOpen: true,
      title: 'DANGER: Full Tournament Reset (Participants & Attempts)',
      description: 'WARNING: You are about to permanently purge ALL participant registrations, round attempts, submitted answers, and qualification logs from the PostgreSQL database. This completely resets the tournament to blank state. Are you sure you want to proceed?',
      onConfirm: async () => {
        try {
          await apiRequest('/admin/reset-all', { method: 'POST' });
          purgeAllTournamentData();
          setSubmissions([]);
          setGlobalCompetitionState('NOT_STARTED');
          setCompetitionStateLocal('NOT_STARTED');
          setResetToast({
            message: 'Complete reset executed. All participants and attempts have been removed.',
            roundId: 0,
          });
          fetchDbStats();
        } catch (err) {
          alert(`Failed to reset tournament: ${err instanceof Error ? err.message : 'Unknown error'}`);
        } finally {
          setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        }
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
              {(selectedRound === 1 || selectedRound === 2) && (
                <button
                  type="button"
                  className="btn btn-promote-qualifiers"
                  onClick={() => handleOpenQualify(selectedRound)}
                  id="btn-qualify-selected-round"
                  style={{
                    background: 'linear-gradient(135deg, #8E233B 0%, #B94B68 100%)',
                    color: '#FFFFFF',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontWeight: 700,
                  }}
                  title={`Execute qualification for Round ${selectedRound + 1}`}
                >
                  <Icon name="award" size={15} />
                  <span>Qualify for Round {selectedRound + 1}</span>
                </button>
              )}
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
              <div className="meta-list-item">
                <span className="meta-item-label">Round 2 Qualifiers:</span>
                <span className="meta-item-value" style={{ color: (dbStats?.r2Qualified ?? 0) > 0 ? '#22C55E' : '#F59E0B', fontWeight: 700 }}>
                  {dbStats?.r2Qualified ? `${dbStats.r2Qualified} candidates promoted` : 'Pending Qualification'}
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
                className="btn w-full btn-promote-qualifiers"
                onClick={() => handleOpenQualify(1)}
                style={{
                  background: 'linear-gradient(135deg, #8E233B 0%, #B94B68 100%)',
                  color: '#FFFFFF',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  fontWeight: 700,
                }}
                title="Promote top Round 1 participants to qualify for Round 2"
              >
                <Icon name="award" size={15} />
                <span>{dbStats?.r2Qualified ? `Re-Qualify for Round 2 (${dbStats.r2Qualified})` : 'Qualify Candidates for Round 2'}</span>
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
              <div className="meta-list-item">
                <span className="meta-item-label">Round 3 Finalists:</span>
                <span className="meta-item-value" style={{ color: (dbStats?.r3Qualified ?? 0) > 0 ? '#22C55E' : '#F59E0B', fontWeight: 700 }}>
                  {dbStats?.r3Qualified ? `${dbStats.r3Qualified} finalists promoted` : 'Pending Qualification'}
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
                className="btn w-full btn-promote-qualifiers"
                onClick={() => handleOpenQualify(2)}
                style={{
                  background: 'linear-gradient(135deg, #8E233B 0%, #B94B68 100%)',
                  color: '#FFFFFF',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  fontWeight: 700,
                }}
                title="Promote top Round 2 participants to qualify for Round 3"
              >
                <Icon name="award" size={15} />
                <span>{dbStats?.r3Qualified ? `Re-Qualify for Round 3 (${dbStats.r3Qualified})` : 'Qualify Finalists for Round 3'}</span>
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
            <h4 className="secondary-block-title">Adjust Default Durations (Time Limit)</h4>
            <p className="secondary-block-desc">Configure base duration for each round. Applies to all candidate attempts.</p>

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

          {/* Extend Time For Everyone (All 3 Rounds) */}
          <div className="secondary-block" style={{ border: '1px solid rgba(56, 189, 248, 0.35)', background: 'rgba(15, 23, 42, 0.45)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
              <h4 className="secondary-block-title" style={{ color: '#38BDF8', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Icon name="clock" size={16} />
                <span>Extend Time For Everyone</span>
              </h4>
              <span style={{ fontSize: '0.72rem', background: 'rgba(56, 189, 248, 0.15)', color: '#38BDF8', padding: '2px 8px', borderRadius: '4px', fontWeight: 700 }}>
                ALL 3 ROUNDS
              </span>
            </div>
            <p className="secondary-block-desc">
              Instantly extends the active exam countdown for <strong>all current unsubmitted participants</strong> in real-time across candidate terminals.
            </p>

            <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {/* Round 1 Extension */}
              <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '8px 12px', borderRadius: '6px', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#F1F5F9' }}>Round 1: Data MCQ</span>
                  <span style={{ fontSize: '0.72rem', color: '#94A3B8' }}>Active: {dbStats?.activeAttempts ?? '—'}</span>
                </div>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {[1, 2, 5, 10].map((mins) => (
                    <button
                      key={mins}
                      type="button"
                      disabled={extendingRound !== null}
                      onClick={() => handleExtendTimeEveryone(1, mins)}
                      style={{
                        background: 'rgba(56, 189, 248, 0.12)',
                        border: '1px solid rgba(56, 189, 248, 0.35)',
                        color: '#38BDF8',
                        padding: '4px 10px',
                        borderRadius: '4px',
                        fontSize: '0.8rem',
                        fontWeight: 700,
                        cursor: extendingRound !== null ? 'not-allowed' : 'pointer',
                      }}
                    >
                      {extendingRound === 1 ? '...' : `+${mins} Min`}
                    </button>
                  ))}
                </div>
              </div>

              {/* Round 2 Extension */}
              <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '8px 12px', borderRadius: '6px', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#F1F5F9' }}>Round 2: Graph Challenge</span>
                  <span style={{ fontSize: '0.72rem', color: '#94A3B8' }}>Active: {dbStats?.activeAttempts ?? '—'}</span>
                </div>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {[1, 2, 5, 10].map((mins) => (
                    <button
                      key={mins}
                      type="button"
                      disabled={extendingRound !== null}
                      onClick={() => handleExtendTimeEveryone(2, mins)}
                      style={{
                        background: 'rgba(56, 189, 248, 0.12)',
                        border: '1px solid rgba(56, 189, 248, 0.35)',
                        color: '#38BDF8',
                        padding: '4px 10px',
                        borderRadius: '4px',
                        fontSize: '0.8rem',
                        fontWeight: 700,
                        cursor: extendingRound !== null ? 'not-allowed' : 'pointer',
                      }}
                    >
                      {extendingRound === 2 ? '...' : `+${mins} Min`}
                    </button>
                  ))}
                </div>
              </div>

              {/* Round 3 Extension */}
              <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '8px 12px', borderRadius: '6px', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#F1F5F9' }}>Round 3: Rapid Fire</span>
                  <span style={{ fontSize: '0.72rem', color: '#94A3B8' }}>Active: {dbStats?.activeAttempts ?? '—'}</span>
                </div>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {[1, 2, 5, 10].map((mins) => (
                    <button
                      key={mins}
                      type="button"
                      disabled={extendingRound !== null}
                      onClick={() => handleExtendTimeEveryone(3, mins)}
                      style={{
                        background: 'rgba(56, 189, 248, 0.12)',
                        border: '1px solid rgba(56, 189, 248, 0.35)',
                        color: '#38BDF8',
                        padding: '4px 10px',
                        borderRadius: '4px',
                        fontSize: '0.8rem',
                        fontWeight: 700,
                        cursor: extendingRound !== null ? 'not-allowed' : 'pointer',
                      }}
                    >
                      {extendingRound === 3 ? '...' : `+${mins} Min`}
                    </button>
                  ))}
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

          {/* Tournament Reset Management */}
          <div className="secondary-block" style={{ border: '1px solid rgba(239, 68, 68, 0.25)', background: 'rgba(239, 68, 68, 0.03)' }}>
            <h4 className="secondary-block-title" style={{ color: '#EF4444' }}>Tournament Reset Controls</h4>
            <p className="secondary-block-desc">
              Authoritative database reset options for tournament administrators.
            </p>

            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginTop: '12px' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleResetAttemptsKeepParticipants}
                style={{
                  borderColor: '#F59E0B',
                  color: '#F59E0B',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontWeight: 700,
                  fontSize: '0.82rem',
                }}
                title="Wipe round submissions and test answers while keeping all registered participants"
              >
                <Icon name="refresh-cw" size={15} />
                <span>Keep Participants & Reset Attempts</span>
              </button>

              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleResetAllParticipantsAndAttempts}
                style={{
                  borderColor: '#EF4444',
                  color: '#EF4444',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontWeight: 700,
                  fontSize: '0.82rem',
                }}
                title="Purge all participants, submissions, and qualifications from the database"
              >
                <Icon name="trash" size={15} />
                <span>Reset Participants Entry & Attempts</span>
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

      {/* Qualification Modal Dialog */}
      {qualifyModal.isOpen && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="admin-confirm-modal-card" style={{ maxWidth: '520px' }}>
            <div className="confirm-modal-header">
              <Icon name="award" size={22} style={{ color: '#F59E0B' }} />
              <h3 className="confirm-modal-title">
                Qualify Candidates for Round {qualifyModal.sourceRound + 1}
              </h3>
            </div>

            <p className="confirm-modal-desc">
              Candidates who completed Round {qualifyModal.sourceRound} will be ranked by score and speed. Top participants up to this limit will be authorized in the database to enter and submit Round {qualifyModal.sourceRound + 1}.
            </p>

            <div style={{
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid var(--admin-border-subtle)',
              borderRadius: '8px',
              padding: '14px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--admin-text-muted)' }}>Verified Round {qualifyModal.sourceRound} Submissions:</span>
                <strong style={{ color: '#22C55E' }}>{qualifyModal.completedCount} candidates</strong>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label htmlFor="qualify-limit-input" style={{ fontSize: '0.85rem', fontWeight: 700, color: '#FFFFFF' }}>
                  Number of Candidates to Advance (Max 200):
                </label>
                <input
                  id="qualify-limit-input"
                  type="number"
                  min="1"
                  max="200"
                  className="field-input"
                  value={qualifyModal.limit}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10);
                    setQualifyModal((prev) => ({
                      ...prev,
                      limit: isNaN(val) ? 1 : Math.max(1, Math.min(200, val)),
                    }));
                  }}
                  style={{
                    backgroundColor: 'rgba(0, 0, 0, 0.4)',
                    color: '#FFFFFF',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    borderRadius: '6px',
                    padding: '8px 12px',
                    fontSize: '1rem',
                    fontWeight: 700,
                  }}
                />
              </div>

              {/* Quick Preset Buttons */}
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setQualifyModal((prev) => ({ ...prev, limit: qualifyModal.sourceRound === 1 ? 15 : 8 }))}
                  style={{ fontSize: '0.78rem', padding: '4px 10px' }}
                >
                  {qualifyModal.sourceRound === 1 ? 'Top 15' : 'Top 8 Finalists'}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setQualifyModal((prev) => ({ ...prev, limit: 50 }))}
                  style={{ fontSize: '0.78rem', padding: '4px 10px' }}
                >
                  Top 50
                </button>
                {qualifyModal.completedCount > 0 && (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setQualifyModal((prev) => ({ ...prev, limit: Math.min(200, qualifyModal.completedCount) }))}
                    style={{ fontSize: '0.78rem', padding: '4px 10px' }}
                  >
                    All Completed ({qualifyModal.completedCount})
                  </button>
                )}
              </div>
            </div>

            <div className="confirm-modal-actions" style={{ marginTop: '8px' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setQualifyModal((prev) => ({ ...prev, isOpen: false }))}
                disabled={isQualifying}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleExecuteQualify}
                disabled={isQualifying}
                style={{
                  background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
                  borderColor: '#059669',
                  color: '#FFFFFF',
                  fontWeight: 700,
                }}
              >
                {isQualifying ? 'Authorizing in Database...' : `Promote Top ${qualifyModal.limit} to Round ${qualifyModal.sourceRound + 1}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
