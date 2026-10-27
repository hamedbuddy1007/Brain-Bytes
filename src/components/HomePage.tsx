import React from 'react';
import { Icon } from './Icon';
import type { RoundStateMap, Participant } from '../types/competition';

interface HomePageProps {
  roundStates: RoundStateMap;
  isRegistrationOpen: boolean;
  activeParticipant: Participant | null;
  onOpenRegister: () => void;
  onOpenLogin: () => void;
  onOpenAdmin: () => void;
  onEnterArena: () => void;
}

interface RoundIntro {
  id: number;
  phase: string;
  title: string;
  subtitle: string;
  duration: string;
  format: string;
  icon: 'terminal' | 'chart' | 'flame';
  accentColor: string;
  glowColor: string;
  description: string;
  curriculum: string[];
  rules: string;
}

const ROUND_INTROS: RoundIntro[] = [
  {
    id: 1,
    phase: 'STAGE 01 • GATEWAY',
    title: 'Data MCQ',
    subtitle: 'Foundational Data Science & Analytics',
    duration: '10 Minutes',
    format: 'Multiple Choice Questions',
    icon: 'terminal',
    accentColor: '#8E233B',
    glowColor: 'rgba(142, 35, 59, 0.35)',
    description:
      'Tests core concepts in data science, exploratory data analysis, probability, relational logic, and statistical deduction.',
    curriculum: [
      'Probability distributions & expected values',
      'SQL data queries & aggregation logic',
      'Model performance & classification metrics',
      'Data intuition & error identification',
    ],
    rules: 'Qualifying benchmark required to unlock Round 2. Positive marks awarded for correct answers with penalty deductions for mistakes.',
  },
  {
    id: 2,
    phase: 'STAGE 02 • ANALYTICAL DEPTH',
    title: 'Graph Challenge',
    subtitle: 'Visual Analytics & Trend Matrices',
    duration: '10 Minutes',
    format: 'Visual Data Interpretation',
    icon: 'chart',
    accentColor: '#B94B68',
    glowColor: 'rgba(185, 75, 104, 0.35)',
    description:
      'Interpret multi-dimensional charts, regression scatter plots, heatmaps, and correlation matrices under tight time constraints.',
    curriculum: [
      'Multi-axis visual chart comprehension',
      'Non-linear trend analysis & regression curves',
      'Outlier detection & variance analysis',
      'Correlation vs. causation matrix deduction',
    ],
    rules: 'Open exclusively to Round 1 qualifiers. High-precision score cutoff determines qualification for the Championship Finale.',
  },
  {
    id: 3,
    phase: 'STAGE 03 • CHAMPIONSHIP FINALE',
    title: 'Rapid Fire',
    subtitle: 'High-Octane Technical Showdown',
    duration: '3 Minutes',
    format: 'Rapid-Fire Speed Questions',
    icon: 'flame',
    accentColor: '#8E233B',
    glowColor: 'rgba(142, 35, 59, 0.35)',
    description:
      'A thrilling 180-second rapid-fire finale where every millisecond counts toward crowning the overall Brain Bytes champion.',
    curriculum: [
      'Rapid-response algorithmic reasoning',
      'Instantaneous data puzzles & boolean algebra',
      'High-speed statistical deduction',
      'Split-second technical problem solving',
    ],
    rules: 'Finalists battle for the podium. Scores are tiebroken using high-resolution millisecond timer precision (MM:SS.mmm).',
  },
];

export const HomePage: React.FC<HomePageProps> = ({
  roundStates,
  isRegistrationOpen,
  activeParticipant,
  onOpenRegister,
  onOpenLogin,
  onOpenAdmin,
  onEnterArena,
}) => {
  return (
    <div className="home-page-root" id="home-landing-page">
      {/* Top Glass Navigation Bar */}
      <header className="home-navbar">
        <div className="home-nav-container">
          <div className="home-brand">
            <div className="home-brand-icon">
              <Icon name="brain" size={24} />
            </div>
            <div className="home-brand-text">
              <span className="home-event-kicker">DATA MANIA</span>
              <span className="home-event-title">BRAIN BYTES</span>
            </div>
          </div>

          <div className="home-nav-actions">
            {activeParticipant ? (
              <div className="home-active-user-pill">
                <span className="user-dot" />
                <span className="user-name">{activeParticipant.fullName}</span>
                <span className="user-roll">({activeParticipant.rollNumber})</span>
              </div>
            ) : null}

            <button
              type="button"
              onClick={onOpenRegister}
              className="btn-glass-nav btn-nav-register"
              id="btn-home-register"
            >
              <Icon name="user-check" size={15} />
              <span>Register</span>
            </button>

            <button
              type="button"
              onClick={activeParticipant ? onEnterArena : onOpenLogin}
              className="btn-glass-nav btn-nav-login"
              id="btn-home-login"
            >
              <Icon name="key" size={15} />
              <span>{activeParticipant ? 'Enter Arena' : 'Login / Access Code'}</span>
            </button>

            <button
              type="button"
              onClick={onOpenAdmin}
              className="btn-glass-nav btn-nav-admin"
              id="btn-home-admin"
            >
              <Icon name="shield" size={15} />
              <span>Admin Dashboard</span>
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="home-hero-section">
        <div className="home-hero-container">
          <div className="hero-pill-badge">
            <span className="badge-glow-dot" />
            <span>ANNUAL TECHNICAL & DATA INTELLIGENCE CHAMPIONSHIP</span>
          </div>

          <h1 className="hero-display-title">
            DATA MANIA <span className="title-highlight">× BRAIN BYTES</span>
          </h1>

          <p className="hero-lead-text">
            Compete across three progressive arenas testing foundational data intuition, visual graph reasoning,
            and high-octane rapid-fire deduction. Register your station, unlock your proctor-approved Access Code,
            and fight for the championship podium.
          </p>

          <div className="hero-cta-group">
            <button
              type="button"
              onClick={onOpenRegister}
              className="btn-hero-primary"
              id="btn-hero-register"
              disabled={!isRegistrationOpen}
            >
              <Icon name="user-check" size={18} />
              <span>{isRegistrationOpen ? 'Register as Candidate' : 'Registration Paused'}</span>
            </button>

            <button
              type="button"
              onClick={activeParticipant ? onEnterArena : onOpenLogin}
              className="btn-hero-secondary"
              id="btn-hero-arena"
            >
              <Icon name="play" size={17} />
              <span>{activeParticipant ? 'Proceed to Arena Cockpit' : 'Enter Arena with Access Code'}</span>
            </button>

            <button
              type="button"
              onClick={onOpenAdmin}
              className="btn-hero-ghost"
              id="btn-hero-admin"
            >
              <Icon name="shield" size={16} />
              <span>Admin Control</span>
            </button>
          </div>

          {/* Quick Stat Highlights */}
          <div className="hero-kpi-strip">
            <div className="kpi-strip-item">
              <span className="kpi-strip-num">3</span>
              <span className="kpi-strip-lbl">Distinct Round Arenas</span>
            </div>
            <div className="kpi-strip-divider" />
            <div className="kpi-strip-item">
              <span className="kpi-strip-num">MM:SS.mmm</span>
              <span className="kpi-strip-lbl">Millisecond Tiebreaker</span>
            </div>
            <div className="kpi-strip-divider" />
            <div className="kpi-strip-item">
              <span className="kpi-strip-num">100% Sync</span>
              <span className="kpi-strip-lbl">Real-Time Proctored Arena</span>
            </div>
          </div>
        </div>
      </section>

      {/* Rounds Introduction Section */}
      <section className="home-rounds-section" id="rounds-introduction">
        <div className="home-section-container">
          <div className="section-header-block">
            <span className="section-tag-pill">THE BATTLEGROUND</span>
            <h2 className="section-hero-heading">Three Progressive Arenas</h2>
            <p className="section-desc">
              Each round challenges a unique dimension of technical intuition. Pass Round 1 to qualify for the Graph
              Challenge, then sprint through the final 180-second Rapid Fire showdown.
            </p>
          </div>

          <div className="rounds-intro-grid">
            {ROUND_INTROS.map((round) => {
              const status = roundStates[round.id] || 'locked';
              const isLocked = status === 'locked';
              const isCompleted = status === 'completed';

              return (
                <div
                  key={round.id}
                  className={`round-intro-card round-card-${round.id}`}
                  style={
                    {
                      '--card-accent': round.accentColor,
                      '--card-glow': round.glowColor,
                    } as React.CSSProperties
                  }
                >
                  <div className="round-card-top">
                    <span className="round-phase-tag">{round.phase}</span>
                    <span
                      className={`round-status-chip ${
                        isCompleted ? 'status-completed' : isLocked ? 'status-locked' : 'status-active'
                      }`}
                    >
                      <span className="status-dot" />
                      <span>{isCompleted ? 'Concluded' : isLocked ? 'Stage Locked' : 'Stage Live'}</span>
                    </span>
                  </div>

                  <div className="round-icon-header">
                    <div className="round-icon-glass">
                      <Icon name={round.icon} size={28} />
                    </div>
                    <div>
                      <h3 className="round-title-heading">{round.title}</h3>
                      <p className="round-subtitle-text">{round.subtitle}</p>
                    </div>
                  </div>

                  <p className="round-card-narrative">{round.description}</p>

                  <div className="round-meta-metrics">
                    <div className="meta-metric-item">
                      <Icon name="clock" size={15} />
                      <span>{round.duration}</span>
                    </div>
                    <div className="meta-metric-item">
                      <Icon name="grid" size={15} />
                      <span>{round.format}</span>
                    </div>
                  </div>

                  <div className="round-curriculum-list">
                    <span className="curriculum-title">Domain Competencies:</span>
                    <ul>
                      {round.curriculum.map((topic, i) => (
                        <li key={i}>
                          <Icon name="check" size={14} className="curriculum-check" />
                          <span>{topic}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="round-rules-box">
                    <Icon name="alert-circle" size={15} className="rules-icon" />
                    <span>{round.rules}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Rules & Architecture Overview */}
      <section className="home-rules-section">
        <div className="home-section-container">
          <div className="rules-glass-panel">
            <div className="rules-panel-header">
              <Icon name="shield" size={24} className="rules-header-icon" />
              <div>
                <h3 className="rules-heading">Competition Integrity & Proctored Guidelines</h3>
                <p className="rules-subheading">Essential protocol for all registered participants</p>
              </div>
            </div>

            <div className="rules-grid-layout">
              <div className="rule-card">
                <span className="rule-num">01</span>
                <h4>Station Registration & Verification</h4>
                <p>
                  Every participant must register their station once on the registration form. Event administrators
                  approve desk stations and issue a unique alphanumeric Access Code.
                </p>
              </div>

              <div className="rule-card">
                <span className="rule-num">02</span>
                <h4>Stage Gate Qualification</h4>
                <p>
                  Rounds operate on prerequisite qualification. Submitting Round 1 is required to enter Round 2.
                  Only top qualifiers from Round 2 advance to the Rapid Fire finale.
                </p>
              </div>

              <div className="rule-card">
                <span className="rule-num">03</span>
                <h4>Millisecond Precision Scoring</h4>
                <p>
                  In the event of score parity, rank positions are resolved through response timestamps measured in
                  milliseconds (MM:SS.mmm). Accuracy paired with speed delivers victory.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="home-footer">
        <div className="footer-container">
          <div className="footer-brand">
            <Icon name="brain" size={20} />
            <span>DATA MANIA × BRAIN BYTES 2026</span>
          </div>
          <div className="footer-links">
            <button type="button" onClick={onOpenRegister} className="footer-link-btn">
              Register
            </button>
            <span className="footer-bullet">•</span>
            <button type="button" onClick={activeParticipant ? onEnterArena : onOpenLogin} className="footer-link-btn">
              Arena Login
            </button>
            <span className="footer-bullet">•</span>
            <button type="button" onClick={onOpenAdmin} className="footer-link-btn">
              Admin Gateway
            </button>
          </div>
          <p className="footer-copy">Department of Technical Education • Proctored Arena Environment</p>
        </div>
      </footer>
    </div>
  );
};
