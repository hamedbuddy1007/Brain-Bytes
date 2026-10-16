import React, { useState } from 'react';
import type { CompetitionRound, RoundStatus } from '../types/competition';
import { Icon } from './Icon';

interface RoundCardProps {
  round: CompetitionRound;
  status: RoundStatus;
  isRegistered: boolean;
  onEnterRound: (roundId: number) => void;
  onOpenJoin: () => void;
}

export const RoundCard: React.FC<RoundCardProps> = ({
  round,
  status,
  isRegistered,
  onEnterRound,
  onOpenJoin,
}) => {
  const [showSample, setShowSample] = useState(false);

  const getCardIcon = (id: number) => {
    switch (id) {
      case 1:
        return 'database';
      case 2:
        return 'chart';
      case 3:
        return 'zap';
      default:
        return 'award';
    }
  };

  const isLocked = status === 'locked';
  const isActive = status === 'active';
  const isCompleted = status === 'completed';

  return (
    <article
      className={`round-card round-card-${round.id} ${
        isLocked ? 'card-locked' : isActive ? 'card-active' : 'card-completed'
      }`}
    >
      {/* Top Header Row */}
      <div className="round-card-header">
        <div className="round-number-pill">
          <span className="round-label">ROUND</span>
          <span className="round-digits">{round.numberStr}</span>
        </div>

        {/* Status Badge */}
        <div className="round-badges-group">
          <span
            className={`round-stage-badge ${
              round.isElimination ? 'badge-elimination' : 'badge-finals'
            }`}
          >
            {round.isElimination ? 'Elimination' : 'Grand Finale'}
          </span>

          <span className={`round-access-status-badge status-${status}`}>
            {isLocked && (
              <>
                <Icon name="lock" size={13} />
                <span>Locked by Host</span>
              </>
            )}
            {isActive && (
              <>
                <Icon name="zap" size={13} className="text-molten" />
                <span>Active Arena</span>
              </>
            )}
            {isCompleted && (
              <>
                <Icon name="check-circle" size={13} />
                <span>Concluded</span>
              </>
            )}
          </span>
        </div>
      </div>

      {/* Main Title Row */}
      <div className="round-title-row">
        <div className={`round-icon-circle icon-style-${round.id}`}>
          <Icon name={getCardIcon(round.id)} size={24} />
        </div>
        <div>
          <h3 className="round-title">{round.title}</h3>
          <span className="round-subtitle">
            {round.id === 1 && 'Statistical Reasoning & Data Slicing'}
            {round.id === 2 && 'Visual Diagnostics & Hidden Anomalies'}
            {round.id === 3 && 'Live Stage Buzzer & Direct Podium'}
          </span>
        </div>
      </div>

      <p className="round-desc">{round.shortDesc}</p>

      {/* Round Specs Grid */}
      <div className="round-specs-grid">
        <div className="spec-item">
          <div className="spec-label">
            <Icon name="clock" size={13} />
            <span>Duration</span>
          </div>
          <div className="spec-val">{round.duration}</div>
        </div>

        <div className="spec-item">
          <div className="spec-label">
            <Icon name="terminal" size={13} />
            <span>Format</span>
          </div>
          <div className="spec-val">{round.questionsCount}</div>
        </div>

        <div className="spec-item full-width">
          <div className="spec-label">
            <Icon name="shield" size={13} />
            <span>Advancement Rule</span>
          </div>
          <div className="spec-val-highlight">{round.qualificationCriteria}</div>
        </div>
      </div>

      {/* Topics */}
      <div className="round-topics-section">
        <span className="topics-label">Key Competencies:</span>
        <div className="topics-list">
          {round.topics.map((topic, i) => (
            <span key={i} className="topic-tag">
              {topic}
            </span>
          ))}
        </div>
      </div>

      {/* Sample Challenge Preview */}
      <div className="sample-challenge-wrapper">
        <button
          type="button"
          className="sample-toggle-btn"
          onClick={() => setShowSample(!showSample)}
          aria-expanded={showSample}
        >
          <span className="btn-inner">
            <Icon name={showSample ? 'chevron-down' : 'search'} size={15} />
            <span>{showSample ? 'Hide Sample Problem' : 'Preview Sample Challenge'}</span>
          </span>
          <span className="toggle-hint">{showSample ? '▲ Close' : '▼ Inspect'}</span>
        </button>

        {showSample && (
          <div className="sample-challenge-card">
            <div className="sample-challenge-badge">
              <Icon name="code" size={13} />
              <span>Sample Question Prototype</span>
            </div>
            <h4 className="sample-q-title">{round.samplePreview.questionTitle}</h4>
            <p className="sample-q-text">{round.samplePreview.description}</p>
            <div className="sample-q-hint">
              <Icon name="sparkles" size={14} className="hint-icon" />
              <span>{round.samplePreview.sampleDataHint}</span>
            </div>
          </div>
        )}
      </div>

      {/* Main Access Button */}
      <div className="round-card-footer">
        {isLocked ? (
          <div className="locked-action-wrapper">
            <button type="button" className="btn btn-locked w-full" disabled>
              <Icon name="lock" size={16} />
              <span>Locked — Waiting for Host Authorization</span>
            </button>
            <span className="locked-hint-sub">
              Access will unlock automatically when the host initiates this round.
            </span>
          </div>
        ) : isActive ? (
          isRegistered ? (
            <button
              type="button"
              className="btn btn-primary w-full pulse-btn"
              onClick={() => onEnterRound(round.id)}
            >
              <Icon name="play" size={16} />
              <span>Enter Round {round.numberStr} Challenge</span>
              <Icon name="arrow-right" size={16} />
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-primary w-full"
              onClick={onOpenJoin}
            >
              <Icon name="terminal" size={16} />
              <span>Register to Enter Round {round.numberStr}</span>
            </button>
          )
        ) : (
          <button
            type="button"
            className="btn btn-secondary w-full"
            onClick={() => onEnterRound(round.id)}
          >
            <Icon name="check-circle" size={16} />
            <span>Round Concluded — View Archive</span>
          </button>
        )}
      </div>
    </article>
  );
};
