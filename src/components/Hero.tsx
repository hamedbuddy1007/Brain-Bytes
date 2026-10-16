import React from 'react';
import { Icon } from './Icon';
import type { RoundStateMap } from '../types/competition';

interface HeroProps {
  onOpenJoin: () => void;
  onExploreRounds: () => void;
  onOpenProjector: () => void;
  roundStates: RoundStateMap;
  isRegistrationOpen: boolean;
  activeCount: number;
}

export const Hero: React.FC<HeroProps> = ({
  onOpenJoin,
  onExploreRounds,
  onOpenProjector,
  roundStates,
  isRegistrationOpen,
  activeCount,
}) => {
  const getRoundStatusLabel = (id: number) => {
    const s = roundStates[id] || 'locked';
    if (s === 'active') return { text: 'ACTIVE', className: 'status-active' };
    if (s === 'completed') return { text: 'CONCLUDED', className: 'status-done' };
    return { text: 'LOCKED', className: 'status-locked' };
  };

  return (
    <section className="hero-section" id="hero-overview">
      <div className="hero-ambient-glow solar-glow" />
      <div className="hero-container">
        {/* Left Column: Headings & Call to Action */}
        <div className="hero-content">
          <div className="hero-event-badge solar-badge">
            <Icon name="flame" size={15} className="text-molten" />
            <span className="badge-text">DATA MANIA • TECH CHAMPIONSHIP</span>
          </div>

          <h1 className="hero-title">
            <span className="event-primary-tag">DATA MANIA PRESENTS</span>
            <span className="competition-main-name">BRAIN BYTES</span>
            <span className="gradient-text-solar hero-tagline">
              Think Smart. Decode Data. Win Big.
            </span>
          </h1>

          <p className="hero-lead">
            The premier collegiate data science championship conducted under <strong>DATA MANIA</strong>.
            Three rigorous rounds testing statistical reasoning, visual data forensics, and lightning-speed
            stage buzzer reflexes.
          </p>

          <div className="hero-feature-pills">
            <span className="feature-pill">
              <Icon name="zap" size={14} className="pill-icon text-molten" />
              <span>3 Competitive Rounds</span>
            </span>
            <span className="feature-pill">
              <Icon name="lock" size={14} className="pill-icon text-solar" />
              <span>Host-Administered Access</span>
            </span>
            <span className="feature-pill">
              <Icon name="shield" size={14} className="pill-icon text-gold" />
              <span>Solo & Duo Squads</span>
            </span>
          </div>

          <div className="hero-cta-group">
            {isRegistrationOpen ? (
              <button
                type="button"
                className="btn btn-primary btn-lg hero-main-cta"
                onClick={onOpenJoin}
                id="hero-join-btn"
              >
                <Icon name="terminal" size={20} />
                <span>Join Competition</span>
                <Icon name="arrow-right" size={16} className="btn-arrow" />
              </button>
            ) : (
              <button
                type="button"
                className="btn btn-secondary btn-lg disabled-cta"
                disabled
              >
                <Icon name="lock" size={18} />
                <span>Registration Paused by Host</span>
              </button>
            )}

            <button
              type="button"
              className="btn btn-secondary btn-lg"
              onClick={onExploreRounds}
            >
              <Icon name="chart" size={18} />
              <span>View Round Status</span>
            </button>

            <button
              type="button"
              className="btn btn-ghost btn-lg"
              onClick={onOpenProjector}
              title="Open full-screen auditorium projector leaderboard"
            >
              <Icon name="monitor" size={18} />
              <span>Scoreboard</span>
            </button>
          </div>

          <div className="hero-footnote">
            <Icon name="check-circle" size={16} className="text-solar" />
            <span>
              {isRegistrationOpen
                ? 'Join code required. Default test code: BYTE2026'
                : 'Registration is currently paused in the Admin Console.'}
            </span>
          </div>
        </div>

        {/* Right Column: High-Energy Live Arena Telemetry Card */}
        <div className="hero-graphic-col">
          <div className="arena-telemetry-card">
            <div className="telemetry-header">
              <div className="telemetry-title-group">
                <span className="live-dot-solar" />
                <span className="telemetry-title">ARENA TELEMETRY</span>
              </div>
              <span className="telemetry-badge">
                {isRegistrationOpen ? 'REGISTRATION OPEN' : 'REGISTRATION CLOSED'}
              </span>
            </div>

            <div className="telemetry-stats-row">
              <div className="telemetry-stat-box">
                <span className="stat-num text-molten">{activeCount}</span>
                <span className="stat-label">Active Competitors</span>
              </div>
              <div className="telemetry-stat-box">
                <span className="stat-num text-gold">3</span>
                <span className="stat-label">Total Stages</span>
              </div>
              <div className="telemetry-stat-box">
                <span className="stat-num text-solar">Live</span>
                <span className="stat-label">Admin Sync</span>
              </div>
            </div>

            <div className="telemetry-rounds-status-list">
              <span className="telemetry-section-label">LIVE ROUND ACCESS CONTROL:</span>

              {/* Round 1 Item */}
              <div className="telemetry-round-item">
                <div className="round-item-left">
                  <span className="round-idx">R1</span>
                  <div>
                    <span className="round-name">Data MCQ</span>
                    <span className="round-sub">Elimination Screening</span>
                  </div>
                </div>
                <span className={`status-pill ${getRoundStatusLabel(1).className}`}>
                  {roundStates[1] === 'locked' && <Icon name="lock" size={12} />}
                  {roundStates[1] === 'active' && <Icon name="zap" size={12} />}
                  {roundStates[1] === 'completed' && <Icon name="check-circle" size={12} />}
                  <span>{getRoundStatusLabel(1).text}</span>
                </span>
              </div>

              {/* Round 2 Item */}
              <div className="telemetry-round-item">
                <div className="round-item-left">
                  <span className="round-idx">R2</span>
                  <div>
                    <span className="round-name">Graph Challenge</span>
                    <span className="round-sub">Visual Data Forensics</span>
                  </div>
                </div>
                <span className={`status-pill ${getRoundStatusLabel(2).className}`}>
                  {roundStates[2] === 'locked' && <Icon name="lock" size={12} />}
                  {roundStates[2] === 'active' && <Icon name="zap" size={12} />}
                  {roundStates[2] === 'completed' && <Icon name="check-circle" size={12} />}
                  <span>{getRoundStatusLabel(2).text}</span>
                </span>
              </div>

              {/* Round 3 Item */}
              <div className="telemetry-round-item">
                <div className="round-item-left">
                  <span className="round-idx gold">R3</span>
                  <div>
                    <span className="round-name">Rapid Fire</span>
                    <span className="round-sub">Grand Finale Buzzer</span>
                  </div>
                </div>
                <span className={`status-pill ${getRoundStatusLabel(3).className}`}>
                  {roundStates[3] === 'locked' && <Icon name="lock" size={12} />}
                  {roundStates[3] === 'active' && <Icon name="zap" size={12} />}
                  {roundStates[3] === 'completed' && <Icon name="check-circle" size={12} />}
                  <span>{getRoundStatusLabel(3).text}</span>
                </span>
              </div>
            </div>

            <div className="telemetry-footer">
              <span className="telemetry-hint">
                <Icon name="shield" size={14} className="text-solar" />
                <span>Rounds are locked until authorized by event administration.</span>
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
