import React, { useState, useEffect } from 'react';
import { Icon } from '../Icon';
import type { AdminSettings, RoundStatus } from '../../types/competition';
import {
  getAllSubmissions,
  getQualifications,
  saveQualifications,
  autoQualifyTopN,
  getGlobalCompetitionState,
  setGlobalCompetitionState,
  subscribeToCompetitionSync,
  resetRoundState,
  getRoundProgressCount,
  type SubmissionRecord,
  type QualificationMap,
} from '../../services/competitionStateService';

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
  const [r1Duration, setR1Duration] = useState<number>(10);
  const [r2Duration, setR2Duration] = useState<number>(10);
  const [r3Duration, setR3Duration] = useState<number>(3);

  // Selected Event & Notification State
  const [selectedRound, setSelectedRound] = useState<1 | 2 | 3>(1);
  const [resetToast, setResetToast] = useState<{
    message: string;
    roundId: number;
  } | null>(null);

  // Live Submissions and Qualifications
  const [submissions, setSubmissions] = useState<SubmissionRecord[]>(getAllSubmissions);
  const [qualifications, setQualifications] = useState<QualificationMap>(getQualifications);

  useEffect(() => {
    if (!resetToast) return;
    const timer = setTimeout(() => setResetToast(null), 6000);
    return () => clearTimeout(timer);
  }, [resetToast]);

  useEffect(() => {
    const handleSync = () => {
      setSubmissions(getAllSubmissions());
      setQualifications(getQualifications());
      setCompetitionStateLocal(getGlobalCompetitionState());
    };
    const unsubscribe = subscribeToCompetitionSync(handleSync);
    return () => unsubscribe();
  }, []);

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
    onConfirm: () => {},
  });

  const handleToggleRound = (roundId: 1 | 2 | 3) => {
    const currentStatus = settings.roundStates[roundId];
    const newStatus: RoundStatus = currentStatus === 'active' ? 'locked' : 'active';

    if (newStatus === 'locked') {
      setConfirmModal({
        isOpen: true,
        title: `Lock Entry for Round ${roundId}`,
        description: `Are you sure you want to lock new entries for Round ${roundId}? Existing candidate sessions will continue until their countdown expires.`,
        onConfirm: () => {
          onUpdateSettings({
            ...settings,
            adminCustomized: true,
            roundStates: {
              ...settings.roundStates,
              [roundId]: 'locked',
            },
          });
          setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        },
      });
    } else {
      onUpdateSettings({
        ...settings,
        adminCustomized: true,
        roundStates: {
          ...settings.roundStates,
          [roundId]: 'active',
        },
      });
    }
  };

  const handleUpdateDuration = (roundId: 1 | 2 | 3, newMinutes: number) => {
    if (newMinutes < 1 || newMinutes > 120) {
      alert('Round duration must be between 1 and 120 minutes.');
      return;
    }
    if (roundId === 1) setR1Duration(newMinutes);
    if (roundId === 2) setR2Duration(newMinutes);
    if (roundId === 3) setR3Duration(newMinutes);
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
          setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        },
      });
    } else {
      setGlobalCompetitionState(newState);
      setCompetitionStateLocal(newState);
    }
  };

  // Qualification handlers
  const handleAutoQualifyR1 = () => {
    setConfirmModal({
      isOpen: true,
      title: 'Qualify Top Candidates for Round 2',
      description: 'Automatically qualify the top 15 highest-scoring verified candidates from Round 1 for Round 2 (Graph Challenge). Remaining candidates will receive elimination notifications. Proceed?',
      onConfirm: () => {
        const res = autoQualifyTopN(1, 15);
        setQualifications(getQualifications());
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        alert(`Successfully qualified ${res.qualifiedCount} candidates for Round 2!`);
      },
    });
  };

  const handleAutoQualifyR2 = () => {
    setConfirmModal({
      isOpen: true,
      title: 'Qualify Top 8 Finalists for Round 3',
      description: 'Automatically qualify the top 8 candidates from Round 2 for Round 3 (Rapid Fire Championship Final). Proceed?',
      onConfirm: () => {
        const res = autoQualifyTopN(2, 8);
        setQualifications(getQualifications());
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        alert(`Successfully qualified ${res.qualifiedCount} finalists for Round 3!`);
      },
    });
  };

  const handleResetQualifications = () => {
    setConfirmModal({
      isOpen: true,
      title: 'Reset All Round Qualifications',
      description: 'Warning: This will clear the current qualification lists for Round 2 and Round 3. Existing test scores will not be lost. Continue?',
      onConfirm: () => {
        saveQualifications({
          round2QualifiedRolls: [],
          round3QualifiedRolls: [],
          eliminatedRolls: [],
        });
        setQualifications(getQualifications());
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
      },
    });
  };

  const handleResetRound = (targetRoundId: 1 | 2 | 3) => {
    const roundName =
      targetRoundId === 1
        ? 'Round 1 — Data MCQ'
        : targetRoundId === 2
        ? 'Round 2 — Graph Challenge'
        : 'Round 3 — Rapid Fire';

    const targetSubs = submissions.filter((s) => s.roundId === targetRoundId).length;
    const inProgressCount = getRoundProgressCount(targetRoundId);

    setConfirmModal({
      isOpen: true,
      title: `Reset ${roundName} — Confirm Action`,
      description: `Warning: You are about to reset all entries and participant progress for ${roundName}. This will permanently delete ${targetSubs} verified submissions, clear ${inProgressCount} in-progress candidate answer sheets and timers, and clear leaderboard standings for this stage. Connected participant terminals will be reset for a fresh attempt. Continue?`,
      onConfirm: () => {
        const result = resetRoundState(targetRoundId);
        setSubmissions(getAllSubmissions());
        setQualifications(getQualifications());
        if (onLogAudit) {
          onLogAudit(`Admin reset all entries and participant progress for Round ${targetRoundId}`);
        }
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        setResetToast({
          message: `Successfully reset ${roundName}! Cleared ${result.deletedSubmissionsCount} submissions and ${result.clearedProgressCount} in-progress candidate test drafts.`,
          roundId: targetRoundId,
        });
      },
    });
  };

  const r1State = settings.roundStates[1] || 'locked';
  const r2State = settings.roundStates[2] || 'locked';
  const r3State = settings.roundStates[3] || 'locked';

  const r1Submissions = submissions.filter((s) => s.roundId === 1);
  const r2Submissions = submissions.filter((s) => s.roundId === 2);
  const r3Submissions = submissions.filter((s) => s.roundId === 3);

  const selectedRoundSubmissions = submissions.filter((s) => s.roundId === selectedRound);
  const selectedRoundProgressCount = getRoundProgressCount(selectedRound);
  const selectedRoundName =
    selectedRound === 1
      ? 'Round 1 — Data MCQ'
      : selectedRound === 2
      ? 'Round 2 — Graph Challenge'
      : 'Round 3 — Rapid Fire';

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
                    settings.roundStates[selectedRound] === 'active' ? 'is-active' : 'is-locked'
                  }`}
                >
                  {settings.roundStates[selectedRound] === 'active' ? 'Active / Open' : 'Locked'}
                </span>
                <span style={{ fontSize: '0.8rem', color: '#B8B2B7', fontFamily: 'JetBrains Mono, monospace' }}>
                  {selectedRound === 1 ? r1Duration : selectedRound === 2 ? r2Duration : r3Duration} min limit
                </span>
              </div>
              <span className="stat-subtext">
                {settings.roundStates[selectedRound] === 'active'
                  ? 'Candidates may enter and attempt'
                  : 'Candidate entry restricted'}
              </span>
            </div>

            <div className="event-stat-card">
              <span className="stat-label">VERIFIED SUBMISSIONS</span>
              <span
                className="stat-value"
                style={{
                  color: selectedRoundSubmissions.length > 0 ? '#22C55E' : '#B8B2B7',
                }}
              >
                {selectedRoundSubmissions.length} Submissions
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
                <Icon name="refresh-cw" size={16} style={{ color: '#EF4444' }} />
                <span>Reset All Entries & Participant Progress for Selected Event</span>
              </div>
              <p className="reset-bar-desc">
                Permanently clears all submissions, scores, saved answers, and persistent timers for{' '}
                <strong>{selectedRoundName}</strong>. All participating terminals will be synchronized and reset to allow fresh re-entry.
              </p>
            </div>

            <div className="reset-bar-actions">
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
        {/* Card 1: Round 1 — Data MCQ */}
        <div className={`round-control-card ${r1State === 'active' ? 'is-active-card' : ''}`}>
          <div className="round-card-main-content">
            <div className="round-card-header-row">
              <span className="round-card-num-badge">ROUND 1</span>
              <span className={`status-pill ${r1State === 'active' ? 'is-active' : 'is-locked'}`}>
                {r1State === 'active' ? 'Active' : 'Locked'}
              </span>
            </div>

            <h3 className="round-control-title">Round 1 — Data MCQ</h3>

            <div className="round-control-meta-list">
              <div className="meta-list-item">
                <span className="meta-item-label">Duration:</span>
                <span className="meta-item-value">{r1Duration} minutes</span>
              </div>
              <div className="meta-list-item">
                <span className="meta-item-label">Submissions Recorded:</span>
                <span className="meta-item-value" style={{ color: '#22C55E', fontWeight: 700 }}>
                  {r1Submissions.length} verified submissions
                </span>
              </div>
              <div className="meta-list-item">
                <span className="meta-item-label">Advancement Target:</span>
                <span className="meta-item-value">Top 15 to Round 2</span>
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

        {/* Card 2: Round 2 — Graph Challenge */}
        <div className={`round-control-card ${r2State === 'active' ? 'is-active-card' : ''}`}>
          <div className="round-card-main-content">
            <div className="round-card-header-row">
              <span className="round-card-num-badge">ROUND 2</span>
              <span className={`status-pill ${r2State === 'active' ? 'is-active' : 'is-locked'}`}>
                {r2State === 'active' ? 'Active' : 'Locked'}
              </span>
            </div>

            <h3 className="round-control-title">Round 2 — Graph Challenge</h3>

            <div className="round-control-meta-list">
              <div className="meta-list-item">
                <span className="meta-item-label">Duration:</span>
                <span className="meta-item-value">{r2Duration} minutes</span>
              </div>
              <div className="meta-list-item">
                <span className="meta-item-label">Submissions Recorded:</span>
                <span className="meta-item-value" style={{ color: '#22C55E', fontWeight: 700 }}>
                  {r2Submissions.length} verified submissions
                </span>
              </div>
              <div className="meta-list-item">
                <span className="meta-item-label">Advancement Target:</span>
                <span className="meta-item-value">Top 8 Finalists</span>
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

        {/* Card 3: Round 3 — Rapid Fire */}
        <div className={`round-control-card ${r3State === 'active' ? 'is-active-card' : ''}`}>
          <div className="round-card-main-content">
            <div className="round-card-header-row">
              <span className="round-card-num-badge">ROUND 3</span>
              <span className={`status-pill ${r3State === 'active' ? 'is-active' : 'is-locked'}`}>
                {r3State === 'active' ? 'Active' : 'Locked'}
              </span>
            </div>

            <h3 className="round-control-title">Round 3 — Rapid Fire</h3>

            <div className="round-control-meta-list">
              <div className="meta-list-item">
                <span className="meta-item-label">Duration:</span>
                <span className="meta-item-value">{r3Duration} minutes</span>
              </div>
              <div className="meta-list-item">
                <span className="meta-item-label">Submissions Recorded:</span>
                <span className="meta-item-value" style={{ color: '#F59E0B', fontWeight: 700 }}>
                  {r3Submissions.length} final submissions
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

      {/* Qualification & Elimination Workflow Management */}
      <section className="admin-panel-card" style={{ marginBottom: '24px' }}>
        <div className="panel-card-header">
          <div className="panel-title-group">
            <Icon name="award" size={17} className="panel-header-icon" />
            <div>
              <h3 className="panel-title">Qualification & Elimination Manager</h3>
              <span className="panel-subtitle">
                Evaluate verified submissions and authorize advancement to Round 2 & Round 3
              </span>
            </div>
          </div>
          <span className="badge-secondary-label" style={{ background: 'rgba(142, 35, 59, 0.2)', color: '#F5F3F4' }}>
            Authoritative Gate
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', padding: '16px 20px' }}>
          {/* Box 1: R1 to R2 */}
          <div style={{ background: '#202124', border: '1px solid #414047', borderRadius: '8px', padding: '16px' }}>
            <div style={{ fontSize: '0.8rem', color: '#B8B2B7', fontWeight: 700, letterSpacing: '0.05em' }}>
              ROUND 1 → ROUND 2 ADVANCEMENT
            </div>
            <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#F5F3F4', marginTop: '6px' }}>
              {qualifications.round2QualifiedRolls.length} Qualified Candidates
            </div>
            <p style={{ color: '#B8B2B7', fontSize: '0.85rem', margin: '8px 0 16px 0', lineHeight: 1.4 }}>
              Eligible candidates can enter Round 2 once opened. Unqualified candidates receive respectful elimination notices.
            </p>
            <button
              type="button"
              className="btn btn-primary"
              style={{ width: '100%', fontSize: '0.85rem', padding: '10px' }}
              onClick={handleAutoQualifyR1}
            >
              <Icon name="check-circle" size={14} />
              <span>Auto-Qualify Top 15 from R1</span>
            </button>
          </div>

          {/* Box 2: R2 to R3 */}
          <div style={{ background: '#202124', border: '1px solid #414047', borderRadius: '8px', padding: '16px' }}>
            <div style={{ fontSize: '0.8rem', color: '#B8B2B7', fontWeight: 700, letterSpacing: '0.05em' }}>
              ROUND 2 → ROUND 3 (FINALISTS)
            </div>
            <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#F59E0B', marginTop: '6px' }}>
              {qualifications.round3QualifiedRolls.length} Championship Finalists
            </div>
            <p style={{ color: '#B8B2B7', fontSize: '0.85rem', margin: '8px 0 16px 0', lineHeight: 1.4 }}>
              Top 8 finalists qualify for the Rapid Fire championship round.
            </p>
            <button
              type="button"
              className="btn btn-primary"
              style={{ width: '100%', fontSize: '0.85rem', padding: '10px', background: '#8E233B' }}
              onClick={handleAutoQualifyR2}
            >
              <Icon name="award" size={14} />
              <span>Auto-Qualify Top 8 for R3</span>
            </button>
          </div>

          {/* Box 3: Reset / Audit */}
          <div style={{ background: '#202124', border: '1px solid #414047', borderRadius: '8px', padding: '16px' }}>
            <div style={{ fontSize: '0.8rem', color: '#B8B2B7', fontWeight: 700, letterSpacing: '0.05em' }}>
              QUALIFICATION AUDIT
            </div>
            <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#F5F3F4', marginTop: '6px' }}>
              {qualifications.eliminatedRolls.length} Marked Eliminated
            </div>
            <p style={{ color: '#B8B2B7', fontSize: '0.85rem', margin: '8px 0 16px 0', lineHeight: 1.4 }}>
              Resetting qualifications clears promotion states without deleting submitted exam scores.
            </p>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ width: '100%', fontSize: '0.85rem', padding: '10px' }}
              onClick={handleResetQualifications}
            >
              <Icon name="refresh-cw" size={14} />
              <span>Reset Qualification Lists</span>
            </button>
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
