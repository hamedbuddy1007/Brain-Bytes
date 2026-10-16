import React from 'react';
import { Icon } from './Icon';
import type { RoundStateMap } from '../types/competition';

interface ParticipantLandingPageProps {
  roundStates: RoundStateMap;
  isRegistrationOpen: boolean;
  onSelectRound: (roundId: number) => void;
  onOpenAdmin: () => void;
}

interface RoundCardData {
  id: number;
  label: string;
  title: string;
  desc: string;
  icon: 'terminal' | 'chart' | 'flame';
  accentColor: string;
  glowColor: string;
}

const ROUND_CARDS: RoundCardData[] = [
  {
    id: 1,
    label: 'ROUND 1',
    title: 'Data MCQ',
    desc: 'Multiple-choice questions • 10 minutes',
    icon: 'terminal',
    accentColor: '#8E233B',
    glowColor: 'rgba(142, 35, 59, 0.28)',
  },
  {
    id: 2,
    label: 'ROUND 2',
    title: 'Graph Challenge',
    desc: 'Interpret and analyse graphs • 10 minutes',
    icon: 'chart',
    accentColor: '#B94B68',
    glowColor: 'rgba(185, 75, 104, 0.28)',
  },
  {
    id: 3,
    label: 'ROUND 3',
    title: 'Rapid Fire',
    desc: 'Final round • 3 minutes',
    icon: 'flame',
    accentColor: '#8E233B',
    glowColor: 'rgba(142, 35, 59, 0.28)',
  },
];

export const ParticipantLandingPage: React.FC<ParticipantLandingPageProps> = ({
  roundStates,
  isRegistrationOpen,
  onSelectRound,
  onOpenAdmin,
}) => {
  return (
    <main className="landing-page-root" id="participant-landing">
      {/* Top Right Admin Navigation */}
      <div className="landing-top-bar">
        <button
          type="button"
          onClick={onOpenAdmin}
          className="landing-admin-btn"
          id="btn-landing-admin"
          aria-label="Direct to Admin Page"
        >
          <Icon name="shield" size={15} />
          <span>Admin</span>
        </button>
      </div>

      {/* Background ambient solar flair */}
      <div className="landing-ambient-flare" aria-hidden="true" />

      <div className="landing-container">
        {/* Top Centered Event Titles */}
        <header className="landing-header">
          <h1 className="event-primary-title">DATA MANIA</h1>
          <h2 className="competition-primary-title">BRAIN BYTES</h2>
        </header>

        {/* The Exactly Three Clickable Round Cards */}
        <section className="round-cards-grid" aria-label="Competition Rounds">
          {ROUND_CARDS.map((card) => {
            const status = roundStates[card.id] || 'locked';
            const isLocked = status === 'locked';

            return (
              <div
                key={card.id}
                role="button"
                tabIndex={0}
                className={`minimal-round-card card-round-${card.id} ${
                  isLocked ? 'is-locked' : 'is-active'
                }`}
                style={
                  {
                    '--card-accent': card.accentColor,
                    '--card-glow': card.glowColor,
                  } as React.CSSProperties
                }
                onClick={() => onSelectRound(card.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelectRound(card.id);
                  }
                }}
                aria-label={`${card.label}: ${card.title} - ${card.desc}`}
                id={`round-card-${card.id}`}
              >
                <div className="card-top-row">
                  <span className="card-round-badge">{card.label}</span>
                  <div className="card-status-indicator">
                    {isLocked ? (
                      <span className="status-badge-locked" title="Locked by Host">
                        <Icon name="lock" size={13} />
                        <span>Locked</span>
                      </span>
                    ) : (
                      <span className="status-badge-active" title="Round is Active">
                        <span className="active-pulse-dot" />
                        <span>Active</span>
                      </span>
                    )}
                  </div>
                </div>

                <div className="card-icon-container">
                  <Icon name={card.icon} size={28} className="card-main-icon" />
                </div>

                <div className="card-content">
                  <h3 className="card-round-title">{card.title}</h3>
                  <p className="card-round-desc">{card.desc}</p>
                </div>

                <div className="card-action-bar">
                  <span className="card-action-text">
                    {isLocked ? 'Locked by Host' : 'Click to Enter'}
                  </span>
                  <Icon
                    name={isLocked ? 'lock' : 'arrow-right'}
                    size={16}
                    className="card-action-icon"
                  />
                </div>
              </div>
            );
          })}
        </section>

        {/* Small unobtrusive footer */}
        <footer className="landing-subtle-footer">
          <span>DATA MANIA • BRAIN BYTES TECH CHAMPIONSHIP</span>
          {!isRegistrationOpen && (
            <span className="footer-notice"> (Registration paused by host)</span>
          )}
        </footer>
      </div>
    </main>
  );
};
