import React, { useState, useEffect } from 'react';
import { Icon } from './Icon';
import type { RoundStateMap, Participant, RoundQualificationInfo } from '../types/competition';

interface CompetitionArenaPageProps {
  roundStates: RoundStateMap;
  competitionStatus?: 'NOT_STARTED' | 'LIVE' | 'PAUSED' | 'COMPLETED';
  activeParticipant: Participant | null;
  onSelectRound: (roundId: number) => void;
  onShowQualificationPopup?: (targetRound: 2 | 3) => void;
  onBackToHome: () => void;
  onOpenLogin: () => void;
  onSignOut?: () => void;
}

interface RoundTabMeta {
  id: number;
  label: string;
  phase: string;
  title: string;
  duration: string;
  questionCount: string;
  scoringRule: string;
  icon: 'terminal' | 'chart' | 'flame';
  accentColor: string;
  glowColor: string;
  description: string;
  prerequisite: string | null;
}

const ARENA_ROUNDS: RoundTabMeta[] = [
  {
    id: 1,
    label: 'ROUND 1',
    phase: 'STAGE 01 • DATA GATEWAY',
    title: 'Data MCQ',
    duration: '10 Minutes',
    questionCount: '50 Multiple Choice Questions',
    scoringRule: '+1 mark per correct answer, 0 penalty',
    icon: 'terminal',
    accentColor: '#8E233B',
    glowColor: 'rgba(142, 35, 59, 0.35)',
    description:
      'Foundational data analytics, exploratory statistics, SQL queries, and probabilistic reasoning. Qualify to unlock Round 2.',
    prerequisite: null,
  },
  {
    id: 2,
    label: 'ROUND 2',
    phase: 'STAGE 02 • VISUAL ANALYTICS',
    title: 'Graph Challenge',
    duration: '10 Minutes',
    questionCount: '30 Visual Graph & Trend Queries',
    scoringRule: '+1 mark per correct answer, 0 penalty',
    icon: 'chart',
    accentColor: '#B94B68',
    glowColor: 'rgba(185, 75, 104, 0.35)',
    description:
      'High-dimension scatter regressions, multi-axis visual trend analysis, correlation heatmaps, and outlier detection.',
    prerequisite: 'Requires Round 1 Submission & Official Qualification',
  },
  {
    id: 3,
    label: 'ROUND 3',
    phase: 'STAGE 03 • CHAMPIONSHIP FINALE',
    title: 'Rapid Fire',
    duration: '3 Minutes',
    questionCount: '30 Rapid-Fire Questions',
    scoringRule: '+5 marks for correct, -2 marks penalty for wrong',
    icon: 'flame',
    accentColor: '#8E233B',
    glowColor: 'rgba(142, 35, 59, 0.35)',
    description:
      'The ultimate sprint! Speed questions with real-time millisecond countdowns. Podium finishers crowned upon completion.',
    prerequisite: 'Requires Round 2 Submission & Official Qualification',
  },
];

export const CompetitionArenaPage: React.FC<CompetitionArenaPageProps> = ({
  roundStates,
  competitionStatus = 'LIVE',
  activeParticipant,
  onSelectRound,
  onShowQualificationPopup,
  onBackToHome,
  onOpenLogin,
  onSignOut,
}) => {
  const r2Qual: RoundQualificationInfo | undefined = activeParticipant?.qualifications?.round2;
  const r3Qual: RoundQualificationInfo | undefined = activeParticipant?.qualifications?.round3;

  // Determine initially selected tab based on participant qualification and active round
  const [selectedTabId, setSelectedTabId] = useState<number>(() => {
    if (activeParticipant) {
      if (r3Qual?.isQualified && roundStates[3] !== 'locked') return 3;
      if (r2Qual?.isQualified && roundStates[2] !== 'locked') return 2;
    }
    return 1;
  });

  // Auto-advance selected tab if participant becomes newly qualified and the target round is unlocked
  useEffect(() => {
    if (!activeParticipant) return;
    if (r3Qual?.isQualified && roundStates[3] === 'active' && selectedTabId === 2) {
      setSelectedTabId(3);
    } else if (r2Qual?.isQualified && roundStates[2] === 'active' && selectedTabId === 1) {
      const r1Sub = activeParticipant.attempts?.some(
        (a) => (a.roundId === 1 || (a as { round_id?: number }).round_id === 1) && ((a as { submittedAt?: string | null }).submittedAt || (a as { submitted_at?: string | null }).submitted_at)
      );
      if (r1Sub) setSelectedTabId(2);
    }
  }, [r2Qual?.isQualified, r3Qual?.isQualified, roundStates]);

  const activeRoundMeta = ARENA_ROUNDS.find((r) => r.id === selectedTabId) || ARENA_ROUNDS[0];
  const activeRoundStatus = roundStates[activeRoundMeta.id] || (roundStates as Record<string, 'active' | 'locked' | 'completed'>)[String(activeRoundMeta.id)] || 'locked';
  const isLocked = activeRoundStatus === 'locked';
  const isCompleted = activeRoundStatus === 'completed';

  // Check participant attempt status for active tab
  const participantAttempt = activeParticipant?.attempts?.find(
    (a) => a.roundId === activeRoundMeta.id || (a as { round_id?: number }).round_id === activeRoundMeta.id
  );
  const isSubmittedByParticipant = Boolean(
    participantAttempt &&
    ((participantAttempt as { submittedAt?: string | null }).submittedAt ||
      (participantAttempt as { submitted_at?: string | null }).submitted_at)
  );

  // Strict qualification prerequisite check for Round 2 and Round 3
  const activeStageQual: RoundQualificationInfo | undefined =
    activeRoundMeta.id === 2 ? r2Qual : activeRoundMeta.id === 3 ? r3Qual : undefined;

  const isPrerequisiteMet =
    activeRoundMeta.id === 1 ||
    (activeRoundMeta.id === 2 && Boolean(r2Qual?.isQualified)) ||
    (activeRoundMeta.id === 3 && Boolean(r3Qual?.isQualified));

  // Next round qualification info when viewing a completed/submitted round
  const nextStageQual: RoundQualificationInfo | undefined =
    activeRoundMeta.id === 1 ? r2Qual : activeRoundMeta.id === 2 ? r3Qual : undefined;

  const [announcementCount, setAnnouncementCount] = useState<{ total: number; unread: number }>({
    total: 0,
    unread: 0,
  });

  useEffect(() => {
    const handleCountUpdate = (e: Event) => {
      const detail = (e as CustomEvent<{ total: number; unread: number }>).detail;
      if (detail) {
        setAnnouncementCount(detail);
      }
    };
    window.addEventListener('bb:announcement-count-updated', handleCountUpdate);
    return () => window.removeEventListener('bb:announcement-count-updated', handleCountUpdate);
  }, []);

  return (
    <main className="arena-cockpit-root" id="arena-game-page">
      {/* Top Glass Navigation for Arena */}
      <header className="arena-top-header">
        <div className="arena-header-container">
          <div className="arena-header-left">
            <button
              type="button"
              onClick={onBackToHome}
              className="arena-brand-nav-btn"
              id="btn-arena-brand-home"
              title="Brain Bytes - Return to Landing Page"
            >
              <img
                src="/brand-logo.png"
                alt="Brain Bytes Logo"
                className="arena-brand-logo-img"
              />
              <div className="arena-brand-titles">
                <span className="arena-brand-kicker">DATA MANIA</span>
                <span className="arena-brand-title">BRAIN BYTES</span>
              </div>
            </button>
            <div className="arena-title-divider" />
            <button
              type="button"
              onClick={onBackToHome}
              className="arena-back-btn"
              id="btn-arena-back-home"
              title="Return to Landing Page"
            >
              <Icon name="arrow-left" size={16} />
              <span>Back to Home</span>
            </button>
          </div>

          <div className="arena-header-right" style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => window.dispatchEvent(new CustomEvent('bb:open-announcement-centre'))}
              id="btn-arena-announcement-centre"
              title="Open Participant Announcement Centre"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 14px',
                borderRadius: '999px',
                border: announcementCount.unread > 0
                  ? '1.5px solid #FB7185'
                  : '1px solid rgba(15, 23, 42, 0.14)',
                background: announcementCount.unread > 0
                  ? 'linear-gradient(135deg, #8E233B 0%, #E11D48 100%)'
                  : '#FFFFFF',
                color: announcementCount.unread > 0 ? '#FFFFFF' : '#0F172A',
                fontSize: '12.5px',
                fontWeight: 800,
                cursor: 'pointer',
                boxShadow: announcementCount.unread > 0
                  ? '0 6px 16px rgba(225, 29, 72, 0.3)'
                  : '0 2px 6px rgba(15, 23, 42, 0.06)',
                transition: 'all 0.2s ease',
              }}
            >
              <Icon name="bell" size={15} />
              <span>Announcement Centre</span>
              {announcementCount.total > 0 && (
                <span
                  style={{
                    padding: '1px 7px',
                    borderRadius: '999px',
                    fontSize: '11px',
                    fontWeight: 800,
                    background: announcementCount.unread > 0 ? '#FFFFFF' : '#F1F5F9',
                    color: announcementCount.unread > 0 ? '#9F1239' : '#475569',
                  }}
                >
                  {announcementCount.unread > 0 ? `${announcementCount.unread} NEW` : announcementCount.total}
                </span>
              )}
            </button>
            {activeParticipant ? (
              <div className="arena-user-cluster">
                <div className="arena-candidate-badge" id="arena-candidate-chip">
                  <span className="candidate-pulse-dot" />
                  <div className="candidate-info">
                    <span className="candidate-name">{activeParticipant.fullName}</span>
                    <span className="candidate-meta">
                      {activeParticipant.rollNumber}
                      {activeParticipant.department ? ` • ${activeParticipant.department}` : ''}
                    </span>
                  </div>
                </div>
                {onSignOut && (
                  <button
                    type="button"
                    onClick={onSignOut}
                    className="arena-signout-btn"
                    title="Sign Out / Switch Station"
                    id="btn-arena-signout"
                  >
                    <Icon name="log-out" size={14} />
                    <span>Sign Out</span>
                  </button>
                )}
              </div>
            ) : (
              <button
                type="button"
                onClick={onOpenLogin}
                className="arena-login-header-btn"
                id="btn-arena-header-login"
              >
                <Icon name="key" size={15} />
                <span>Login with Access Code</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Arena Ambient Lighting */}
      <div className="arena-ambient-glow" aria-hidden="true" />

      <div className="arena-main-content">
        {/* Tournament Master State Banners */}
        {competitionStatus === 'PAUSED' && (
          <div className="arena-status-banner-paused" role="alert">
            <Icon name="clock" size={20} />
            <div className="banner-text">
              <strong>TOURNAMENT PAUSED BY MASTER CONTROL:</strong> Testing is currently paused. Round entries and candidate timers are on standby.
            </div>
          </div>
        )}
        {competitionStatus === 'NOT_STARTED' && (
          <div className="arena-status-banner-standby" role="alert">
            <Icon name="clock" size={20} />
            <div className="banner-text">
              <strong>COMPETITION NOT STARTED:</strong> Waiting for the tournament proctor to launch the live arena.
            </div>
          </div>
        )}
        {competitionStatus === 'COMPLETED' && (
          <div className="arena-status-banner-completed" role="alert">
            <Icon name="check-circle" size={20} />
            <div className="banner-text">
              <strong>TOURNAMENT CONCLUDED:</strong> All stages have concluded. Check live standings on the auditorium broadcast.
            </div>
          </div>
        )}

        {/* Cockpit Intro Banner */}
        <section className="arena-hero-banner">
          <div className="arena-badge-pill">
            <span className="pulse-beacon" />
            <span>REAL-TIME COMPETITION STAGES</span>
          </div>
          <h1 className="arena-main-heading">Tournament Arena Cockpit</h1>
          <p className="arena-sub-heading">
            Switch between the competition round tabs below to launch your exam sessions. Progression to Round 2 and
            Round 3 is strictly reserved for officially qualified candidates.
          </p>
        </section>

        {/* ONLY Tabs to the Game Pages */}
        <nav className="arena-tabs-nav" aria-label="Game Pages Tabs" id="arena-game-tabs">
          {ARENA_ROUNDS.map((round) => {
            const status = roundStates[round.id] || (roundStates as Record<string, 'active' | 'locked' | 'completed'>)[String(round.id)] || 'locked';
            const isTabSelected = selectedTabId === round.id;
            const roundSubmitted = Boolean(
              activeParticipant?.attempts?.some(
                (a) => (a.roundId === round.id || (a as { round_id?: number }).round_id === round.id) && ((a as { submittedAt?: string | null }).submittedAt || (a as { submitted_at?: string | null }).submitted_at)
              )
            );
            const tabQual = round.id === 2 ? r2Qual : round.id === 3 ? r3Qual : undefined;

            return (
              <button
                key={round.id}
                type="button"
                role="tab"
                aria-selected={isTabSelected}
                onClick={() => setSelectedTabId(round.id)}
                className={`arena-tab-item ${isTabSelected ? 'is-active' : ''} tab-round-${round.id}`}
                id={`arena-tab-round-${round.id}`}
                style={
                  {
                    '--tab-accent': round.accentColor,
                    '--tab-glow': round.glowColor,
                  } as React.CSSProperties
                }
              >
                <div className="tab-icon-wrap">
                  <Icon name={round.icon} size={20} />
                </div>
                <div className="tab-label-wrap">
                  <span className="tab-round-num">{round.label}</span>
                  <span className="tab-round-title">{round.title}</span>
                </div>

                <div className="tab-status-pill">
                  {status === 'completed' ? (
                    <span className="pill-concluded">
                      <Icon name="check-circle" size={12} />
                      <span>Concluded</span>
                    </span>
                  ) : roundSubmitted ? (
                    <span className="pill-completed">
                      <Icon name="check-circle" size={12} />
                      <span>Submitted</span>
                    </span>
                  ) : tabQual?.status === 'NOT_QUALIFIED' ? (
                    <span
                      className="pill-locked"
                      style={{
                        background: 'rgba(220, 38, 38, 0.14)',
                        color: '#DC2626',
                        borderColor: 'rgba(220, 38, 38, 0.35)',
                      }}
                    >
                      <Icon name="x-circle" size={12} />
                      <span>Not Qualified</span>
                    </span>
                  ) : tabQual?.status === 'QUALIFIED' ? (
                    <span
                      className="pill-completed"
                      style={{
                        background: 'rgba(22, 163, 74, 0.14)',
                        color: '#15803D',
                        borderColor: 'rgba(22, 163, 74, 0.35)',
                      }}
                    >
                      <Icon name="award" size={12} />
                      <span>Qualified ✓</span>
                    </span>
                  ) : tabQual?.status === 'AWAITING_DECISION' ? (
                    <span
                      className="pill-locked"
                      style={{
                        background: 'rgba(217, 119, 6, 0.14)',
                        color: '#B45309',
                        borderColor: 'rgba(217, 119, 6, 0.35)',
                      }}
                    >
                      <Icon name="clock" size={12} />
                      <span>Awaiting Cutoff</span>
                    </span>
                  ) : status === 'locked' ? (
                    <span className="pill-locked">
                      <Icon name="lock" size={12} />
                      <span>Locked</span>
                    </span>
                  ) : (
                    <span className="pill-active">
                      <span className="tab-dot-pulse" />
                      <span>Active</span>
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </nav>

        {/* Selected Game Tab Stage Cockpit */}
        <section
          className="arena-stage-cockpit"
          id={`stage-view-round-${activeRoundMeta.id}`}
          style={
            {
              '--stage-accent': activeRoundMeta.accentColor,
              '--stage-glow': activeRoundMeta.glowColor,
            } as React.CSSProperties
          }
        >
          <div className="stage-cockpit-header">
            <div className="stage-header-meta">
              <span className="stage-phase-tag">{activeRoundMeta.phase}</span>
              <h2 className="stage-main-title">{activeRoundMeta.title}</h2>
              <p className="stage-desc-text">{activeRoundMeta.description}</p>
            </div>

            <div className="stage-status-box">
              {isCompleted ? (
                <div className="stage-status-indicator stage-status-completed">
                  <Icon name="check-circle" size={18} />
                  <span>Stage Concluded</span>
                </div>
              ) : isSubmittedByParticipant ? (
                <div className="stage-status-indicator stage-status-completed">
                  <Icon name="check-circle" size={18} />
                  <span>Submission Received</span>
                </div>
              ) : activeStageQual?.status === 'NOT_QUALIFIED' ? (
                <div
                  className="stage-status-indicator stage-status-locked"
                  style={{
                    background: '#FEF2F2',
                    color: '#DC2626',
                    borderColor: '#FECACA',
                  }}
                >
                  <Icon name="x-circle" size={18} />
                  <span>Not Qualified for Stage</span>
                </div>
              ) : activeStageQual?.status === 'QUALIFIED' ? (
                <div
                  className="stage-status-indicator stage-status-completed"
                  style={{
                    background: '#ECFDF5',
                    color: '#059669',
                    borderColor: '#A7F3D0',
                  }}
                >
                  <Icon name="award" size={18} />
                  <span>Selected for Round {activeRoundMeta.id}</span>
                </div>
              ) : isLocked ? (
                <div className="stage-status-indicator stage-status-locked">
                  <Icon name="lock" size={18} />
                  <span>Stage Locked by Host</span>
                </div>
              ) : (
                <div className="stage-status-indicator stage-status-active">
                  <span className="live-dot" />
                  <span>Stage Live & Open</span>
                </div>
              )}
            </div>
          </div>

          {/* Round Specifications Grid */}
          <div className="stage-spec-grid">
            <div className="spec-card">
              <div className="spec-icon">
                <Icon name="clock" size={18} />
              </div>
              <div className="spec-info">
                <span className="spec-label">Duration</span>
                <span className="spec-value">{activeRoundMeta.duration}</span>
              </div>
            </div>

            <div className="spec-card">
              <div className="spec-icon">
                <Icon name="grid" size={18} />
              </div>
              <div className="spec-info">
                <span className="spec-label">Format</span>
                <span className="spec-value">{activeRoundMeta.questionCount}</span>
              </div>
            </div>

            <div className="spec-card">
              <div className="spec-icon">
                <Icon name="award" size={18} />
              </div>
              <div className="spec-info">
                <span className="spec-label">Scoring Logic</span>
                <span className="spec-value">{activeRoundMeta.scoringRule}</span>
              </div>
            </div>
          </div>

          {/* Official Qualification Decision Banner for Round 2 & Round 3 */}
          {activeParticipant && activeStageQual && (
            <div style={{ marginBottom: '20px' }}>
              {activeStageQual.status === 'QUALIFIED' && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '14px',
                    padding: '16px 20px',
                    borderRadius: '14px',
                    background: 'linear-gradient(135deg, #ECFDF5 0%, #D1FAE5 100%)',
                    border: '1px solid #6EE7B7',
                    color: '#065F46',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div
                      style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '10px',
                        background: '#059669',
                        color: '#FFFFFF',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <Icon name="trophy" size={20} />
                    </div>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: '14.5px', color: '#064E3B' }}>
                        Congratulations! You Are Officially Qualified for Round {activeRoundMeta.id}!
                      </div>
                      <div style={{ fontSize: '13px', color: '#047857', marginTop: '2px' }}>
                        Round {activeStageQual.sourceRound} Score: <strong>{activeStageQual.score ?? 0} PTS</strong>
                        {activeStageQual.rank ? ` • Qualifier Rank #${activeStageQual.rank}` : ''}
                      </div>
                    </div>
                  </div>
                  {onShowQualificationPopup && (
                    <button
                      type="button"
                      onClick={() => onShowQualificationPopup(activeRoundMeta.id as 2 | 3)}
                      style={{
                        padding: '8px 14px',
                        borderRadius: '8px',
                        border: '1px solid #059669',
                        background: '#FFFFFF',
                        color: '#059669',
                        fontSize: '12.5px',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      View Selection Pop-up
                    </button>
                  )}
                </div>
              )}

              {activeStageQual.status === 'NOT_QUALIFIED' && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '14px',
                    padding: '16px 20px',
                    borderRadius: '14px',
                    background: 'linear-gradient(135deg, #FEF2F2 0%, #FEE2E2 100%)',
                    border: '1px solid #FCA5A5',
                    color: '#991B1B',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div
                      style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '10px',
                        background: '#DC2626',
                        color: '#FFFFFF',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <Icon name="x-circle" size={20} />
                    </div>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: '14.5px', color: '#7F1D1D' }}>
                        You Have Not Qualified for Round {activeRoundMeta.id}
                      </div>
                      <div style={{ fontSize: '13px', color: '#B91C1C', marginTop: '2px' }}>
                        Only the top {activeStageQual.qualifiedCount > 0 ? `${activeStageQual.qualifiedCount} ` : ''}candidates from Round {activeStageQual.sourceRound} were selected to advance to Round {activeRoundMeta.id}.
                      </div>
                    </div>
                  </div>
                  {onShowQualificationPopup && (
                    <button
                      type="button"
                      onClick={() => onShowQualificationPopup(activeRoundMeta.id as 2 | 3)}
                      style={{
                        padding: '8px 14px',
                        borderRadius: '8px',
                        border: '1px solid #DC2626',
                        background: '#FFFFFF',
                        color: '#DC2626',
                        fontSize: '12.5px',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      View Result Pop-up
                    </button>
                  )}
                </div>
              )}

              {activeStageQual.status === 'AWAITING_DECISION' && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '14px',
                    padding: '16px 20px',
                    borderRadius: '14px',
                    background: 'linear-gradient(135deg, #FFFBEB 0%, #FEF3C7 100%)',
                    border: '1px solid #FCD34D',
                    color: '#92400E',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div
                      style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '10px',
                        background: '#D97706',
                        color: '#FFFFFF',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <Icon name="clock" size={20} />
                    </div>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: '14.5px', color: '#78350F' }}>
                        Round {activeStageQual.sourceRound} Submitted — Awaiting Official Qualification Cutoff
                      </div>
                      <div style={{ fontSize: '13px', color: '#B45309', marginTop: '2px' }}>
                        Your Round {activeStageQual.sourceRound} score ({activeStageQual.score ?? 0} PTS) is recorded. You will receive an automatic pop-up notification once the administrator publishes qualifiers for Round {activeRoundMeta.id}.
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeStageQual.status === 'NOT_SUBMITTED' && (
                <div className="stage-prereq-alert" style={{ marginBottom: 0 }}>
                  <Icon name="alert-triangle" size={18} />
                  <div>
                    <strong>Prerequisite Requirement</strong>
                    <p>
                      You must complete, submit, and qualify in Round {activeStageQual.sourceRound} before attempting {activeRoundMeta.title}.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Next Round Qualification Status Banner when viewing a submitted Round 1 or Round 2 */}
          {activeParticipant && isSubmittedByParticipant && nextStageQual && (
            <div style={{ marginBottom: '20px' }}>
              {nextStageQual.status === 'QUALIFIED' && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '12px',
                    padding: '15px 18px',
                    borderRadius: '12px',
                    background: '#ECFDF5',
                    border: '1px solid #6EE7B7',
                    color: '#065F46',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 700, fontSize: '13.5px' }}>
                    <Icon name="award" size={18} />
                    <span>
                      You have qualified for <strong>Round {nextStageQual.targetRound}</strong>!{nextStageQual.rank ? ` (Rank #${nextStageQual.rank})` : ''}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {onShowQualificationPopup && (
                      <button
                        type="button"
                        onClick={() => onShowQualificationPopup(nextStageQual.targetRound as 2 | 3)}
                        style={{
                          padding: '7px 13px',
                          borderRadius: '8px',
                          border: '1px solid #059669',
                          background: '#FFFFFF',
                          color: '#059669',
                          fontSize: '12px',
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        View Pop-up
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setSelectedTabId(nextStageQual.targetRound)}
                      style={{
                        padding: '7px 14px',
                        borderRadius: '8px',
                        border: 'none',
                        background: '#059669',
                        color: '#FFFFFF',
                        fontSize: '12px',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      Go to Round {nextStageQual.targetRound} Tab →
                    </button>
                  </div>
                </div>
              )}

              {nextStageQual.status === 'NOT_QUALIFIED' && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '12px',
                    padding: '15px 18px',
                    borderRadius: '12px',
                    background: '#FEF2F2',
                    border: '1px solid #FCA5A5',
                    color: '#991B1B',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 700, fontSize: '13.5px' }}>
                    <Icon name="x-circle" size={18} />
                    <span>
                      Round {activeRoundMeta.id} Qualification Result: You were not selected to advance to Round {nextStageQual.targetRound}.
                    </span>
                  </div>
                  {onShowQualificationPopup && (
                    <button
                      type="button"
                      onClick={() => onShowQualificationPopup(nextStageQual.targetRound as 2 | 3)}
                      style={{
                        padding: '7px 13px',
                        borderRadius: '8px',
                        border: '1px solid #DC2626',
                        background: '#FFFFFF',
                        color: '#DC2626',
                        fontSize: '12px',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      View Details Pop-up
                    </button>
                  )}
                </div>
              )}

              {nextStageQual.status === 'AWAITING_DECISION' && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '14px 18px',
                    borderRadius: '12px',
                    background: '#FFFBEB',
                    border: '1px solid #FDE68A',
                    color: '#92400E',
                    fontSize: '13px',
                    fontWeight: 600,
                  }}
                >
                  <Icon name="clock" size={18} />
                  <span>
                    Awaiting Round {nextStageQual.targetRound} qualification cutoff from the administrator. You will receive a pop-up notification automatically once qualifiers are selected.
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Direct Launch Action for the Selected Tab */}
          <div className="stage-cta-container">
            {isCompleted ? (
              <div className="stage-done-notice" style={{ borderColor: 'rgba(34, 197, 94, 0.4)', background: 'rgba(34, 197, 94, 0.08)', color: '#15803D' }}>
                <Icon name="check-circle" size={20} />
                <span>Stage Concluded — Entries and submissions are closed.</span>
              </div>
            ) : isSubmittedByParticipant ? (
              <div className="stage-done-notice">
                <Icon name="check-circle" size={20} />
                <span>You have already submitted this round. Answers are locked.</span>
              </div>
            ) : activeStageQual?.status === 'NOT_QUALIFIED' ? (
              <button
                type="button"
                onClick={() => onShowQualificationPopup && onShowQualificationPopup(activeRoundMeta.id as 2 | 3)}
                className="btn-stage-action btn-disabled"
                style={{
                  borderColor: '#FCA5A5',
                  background: '#FEF2F2',
                  color: '#DC2626',
                  cursor: 'pointer',
                }}
              >
                <Icon name="x-circle" size={18} />
                <span>Not Qualified for Round {activeRoundMeta.id} — Click to View Official Result</span>
              </button>
            ) : activeStageQual?.status === 'AWAITING_DECISION' ? (
              <button
                type="button"
                onClick={() => onShowQualificationPopup && onShowQualificationPopup(activeRoundMeta.id as 2 | 3)}
                className="btn-stage-action btn-disabled"
                style={{
                  borderColor: '#FCD34D',
                  background: '#FFFBEB',
                  color: '#B45309',
                  cursor: 'pointer',
                }}
              >
                <Icon name="clock" size={18} />
                <span>Awaiting Round {activeRoundMeta.id} Qualification Decision</span>
              </button>
            ) : !isPrerequisiteMet ? (
              <button type="button" disabled className="btn-stage-action btn-disabled">
                <Icon name="alert-circle" size={18} />
                <span>Requires Round {activeRoundMeta.id - 1} Submission & Qualification</span>
              </button>
            ) : competitionStatus === 'PAUSED' ? (
              <button type="button" disabled className="btn-stage-action btn-disabled" style={{ borderColor: 'rgba(245, 158, 11, 0.4)', color: '#F59E0B', background: 'rgba(245, 158, 11, 0.08)' }}>
                <Icon name="clock" size={18} />
                <span>Competition Paused by Tournament Master</span>
              </button>
            ) : competitionStatus === 'NOT_STARTED' ? (
              <button type="button" disabled className="btn-stage-action btn-disabled">
                <Icon name="clock" size={18} />
                <span>Competition Not Started</span>
              </button>
            ) : isLocked ? (
              <button type="button" disabled className="btn-stage-action btn-disabled">
                <Icon name="lock" size={18} />
                <span>Stage Locked by Administrator — Stand By for Unlock</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  if (!activeParticipant) {
                    onOpenLogin();
                  } else {
                    onSelectRound(activeRoundMeta.id);
                  }
                }}
                className="btn-stage-action btn-stage-launch"
                id={`btn-launch-round-${activeRoundMeta.id}`}
              >
                <Icon name="play" size={18} />
                <span>
                  {activeParticipant ? `Enter ${activeRoundMeta.title} Now` : `Login with Access Code to Enter`}
                </span>
                <Icon name="arrow-right" size={16} />
              </button>
            )}
          </div>
        </section>

      </div>
    </main>
  );
};
