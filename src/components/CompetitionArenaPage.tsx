import React, { useState } from 'react';
import { Icon } from './Icon';
import type { RoundStateMap, Participant } from '../types/competition';

interface CompetitionArenaPageProps {
  roundStates: RoundStateMap;
  activeParticipant: Participant | null;
  onSelectRound: (roundId: number) => void;
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
    prerequisite: 'Requires Round 1 Submission & Qualification',
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
    prerequisite: 'Requires Round 2 Qualification',
  },
];

export const CompetitionArenaPage: React.FC<CompetitionArenaPageProps> = ({
  roundStates,
  activeParticipant,
  onSelectRound,
  onBackToHome,
  onOpenLogin,
  onSignOut,
}) => {
  // Determine initially selected tab based on participant progress or active round
  const [selectedTabId, setSelectedTabId] = useState<number>(() => {
    if (activeParticipant) {
      const hasR1 = activeParticipant.attempts?.some(
        (a) => (a.roundId === 1 || (a as { round_id?: number }).round_id === 1) && ((a as { submittedAt?: string | null }).submittedAt || (a as { submitted_at?: string | null }).submitted_at)
      );
      const hasR2 = activeParticipant.attempts?.some(
        (a) => (a.roundId === 2 || (a as { round_id?: number }).round_id === 2) && ((a as { submittedAt?: string | null }).submittedAt || (a as { submitted_at?: string | null }).submitted_at)
      );
      if (hasR2 && roundStates[3] !== 'locked') return 3;
      if (hasR1 && roundStates[2] !== 'locked') return 2;
    }
    return 1;
  });

  const activeRoundMeta = ARENA_ROUNDS.find((r) => r.id === selectedTabId) || ARENA_ROUNDS[0];
  const activeRoundStatus = roundStates[activeRoundMeta.id] || 'locked';
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

  // Prerequisite validation
  const hasR1Submitted = Boolean(
    activeParticipant?.attempts?.some(
      (a) => (a.roundId === 1 || (a as { round_id?: number }).round_id === 1) && ((a as { submittedAt?: string | null }).submittedAt || (a as { submitted_at?: string | null }).submitted_at)
    )
  );
  const hasR2Submitted = Boolean(
    activeParticipant?.attempts?.some(
      (a) => (a.roundId === 2 || (a as { round_id?: number }).round_id === 2) && ((a as { submittedAt?: string | null }).submittedAt || (a as { submitted_at?: string | null }).submitted_at)
    )
  );

  const isPrerequisiteMet =
    activeRoundMeta.id === 1 ||
    (activeRoundMeta.id === 2 && hasR1Submitted) ||
    (activeRoundMeta.id === 3 && hasR2Submitted);

  return (
    <main className="arena-cockpit-root" id="arena-game-page">
      {/* Top Glass Navigation for Arena */}
      <header className="arena-top-header">
        <div className="arena-header-container">
          <div className="arena-header-left">
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
            <div className="arena-title-divider" />
            <div className="arena-brand-tag">
              <span className="arena-brand-kicker">COMPETITION ARENA</span>
              <span className="arena-brand-title">GAME TABS</span>
            </div>
          </div>

          <div className="arena-header-right">
            {activeParticipant ? (
              <div className="arena-user-cluster">
                <div className="arena-candidate-badge" id="arena-candidate-chip">
                  <span className="candidate-pulse-dot" />
                  <div className="candidate-info">
                    <span className="candidate-name">{activeParticipant.fullName}</span>
                    <span className="candidate-meta">
                      {activeParticipant.rollNumber} • {activeParticipant.collegeName || 'Proctored Station'}
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
        {/* Cockpit Intro Banner */}
        <section className="arena-hero-banner">
          <div className="arena-badge-pill">
            <span className="pulse-beacon" />
            <span>REAL-TIME COMPETITION STAGES</span>
          </div>
          <h1 className="arena-main-heading">Tournament Arena Cockpit</h1>
          <p className="arena-sub-heading">
            Switch between the competition round tabs below to launch your exam sessions. Each stage requires
            proctor unlock and prerequisite stage submission.
          </p>
        </section>

        {/* ONLY Tabs to the Game Pages */}
        <nav className="arena-tabs-nav" aria-label="Game Pages Tabs" id="arena-game-tabs">
          {ARENA_ROUNDS.map((round) => {
            const status = roundStates[round.id] || 'locked';
            const isTabSelected = selectedTabId === round.id;
            const roundSubmitted = Boolean(
              activeParticipant?.attempts?.some(
                (a) => (a.roundId === round.id || (a as { round_id?: number }).round_id === round.id) && ((a as { submittedAt?: string | null }).submittedAt || (a as { submitted_at?: string | null }).submitted_at)
              )
            );

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
                  {roundSubmitted ? (
                    <span className="pill-completed">
                      <Icon name="check-circle" size={12} />
                      <span>Submitted</span>
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
              {isSubmittedByParticipant ? (
                <div className="stage-status-indicator stage-status-completed">
                  <Icon name="check-circle" size={18} />
                  <span>Submission Received</span>
                </div>
              ) : isCompleted ? (
                <div className="stage-status-indicator stage-status-completed">
                  <Icon name="check-circle" size={18} />
                  <span>Stage Concluded</span>
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

          {/* Prerequisite & Instructions Notice */}
          {activeRoundMeta.prerequisite && !isPrerequisiteMet && (
            <div className="stage-prereq-alert">
              <Icon name="alert-triangle" size={18} />
              <div>
                <strong>Prerequisite Requirement</strong>
                <p>
                  You must complete and qualify in the preceding stage before attempting {activeRoundMeta.title}.
                </p>
              </div>
            </div>
          )}

          {/* Direct Launch Action for the Selected Tab */}
          <div className="stage-cta-container">
            {isSubmittedByParticipant ? (
              <div className="stage-done-notice">
                <Icon name="check-circle" size={20} />
                <span>You have already submitted this round. Answers are locked.</span>
              </div>
            ) : isLocked ? (
              <button type="button" disabled className="btn-stage-action btn-disabled">
                <Icon name="lock" size={18} />
                <span>Stage Locked by Administrator</span>
              </button>
            ) : !isPrerequisiteMet ? (
              <button type="button" disabled className="btn-stage-action btn-disabled">
                <Icon name="alert-circle" size={18} />
                <span>Prerequisites Not Met</span>
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

        {/* Quick-Switch Thumbnails for all 3 rounds */}
        <section className="arena-all-stages-grid" aria-label="Direct Stage Launchers">
          {ARENA_ROUNDS.map((r) => {
            const status = roundStates[r.id] || 'locked';
            const isTabActive = selectedTabId === r.id;
            const isSub = Boolean(
              activeParticipant?.attempts?.some(
                (a) => (a.roundId === r.id || (a as { round_id?: number }).round_id === r.id) && ((a as { submittedAt?: string | null }).submittedAt || (a as { submitted_at?: string | null }).submitted_at)
              )
            );

            return (
              <div
                key={r.id}
                role="button"
                tabIndex={0}
                onClick={() => {
                  setSelectedTabId(r.id);
                  if (status !== 'locked') {
                    if (!activeParticipant) {
                      onOpenLogin();
                    } else {
                      onSelectRound(r.id);
                    }
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setSelectedTabId(r.id);
                    if (status !== 'locked') {
                      if (!activeParticipant) {
                        onOpenLogin();
                      } else {
                        onSelectRound(r.id);
                      }
                    }
                  }
                }}
                className={`arena-quick-card ${isTabActive ? 'is-current-tab' : ''} ${
                  status === 'locked' ? 'is-card-locked' : ''
                }`}
                id={`quick-stage-card-${r.id}`}
              >
                <div className="quick-card-header">
                  <span className="quick-card-badge">{r.label}</span>
                  <span className={`quick-card-status status-${status}`}>
                    {isSub ? 'Submitted' : status}
                  </span>
                </div>
                <div className="quick-card-body">
                  <div className="quick-card-icon">
                    <Icon name={r.icon} size={22} />
                  </div>
                  <div>
                    <h3 className="quick-card-title">{r.title}</h3>
                    <p className="quick-card-duration">{r.duration}</p>
                  </div>
                </div>
                <div className="quick-card-footer">
                  <span>{status === 'locked' ? 'Locked' : isSub ? 'Completed' : 'Click to Launch →'}</span>
                </div>
              </div>
            );
          })}
        </section>
      </div>
    </main>
  );
};
