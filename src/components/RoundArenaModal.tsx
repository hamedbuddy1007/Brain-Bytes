import React, { useState } from 'react';
import { ROUND_1_SAMPLE_QUESTIONS } from '../data/mockData';
import { Icon } from './Icon';
import type { Participant } from '../types/competition';

interface RoundArenaModalProps {
  roundId: number | null;
  onClose: () => void;
  activeParticipant: Participant | null;
  onScoreSubmitted: (score: number) => void;
}

export const RoundArenaModal: React.FC<RoundArenaModalProps> = ({
  roundId,
  onClose,
  activeParticipant,
  onScoreSubmitted,
}) => {
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number>>({});
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [submittedScore, setSubmittedScore] = useState<number | null>(null);

  if (!roundId) return null;

  const handleSelect = (questionId: number, optionIdx: number) => {
    if (isSubmitted) return;
    setSelectedAnswers((prev) => ({
      ...prev,
      [questionId]: optionIdx,
    }));
  };

  const handleSubmit = () => {
    let score = 0;
    ROUND_1_SAMPLE_QUESTIONS.forEach((q) => {
      if (selectedAnswers[q.id] === q.correctAnswer) {
        score += 33.3; // 100 max
      }
    });
    const finalScore = Math.min(100, Math.round(score));
    setSubmittedScore(finalScore);
    setIsSubmitted(true);
    onScoreSubmitted(finalScore);
  };

  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="round-arena-container" role="dialog" aria-modal="true">
        {/* Arena Header */}
        <div className="round-arena-header">
          <div className="arena-title-area">
            <div className="arena-event-tag">
              <Icon name="flame" size={14} className="text-molten" />
              <span>DATA MANIA • BRAIN BYTES ARENA</span>
            </div>
            <h2 className="arena-heading">
              {roundId === 1 && 'Round 01: Data MCQ Screening'}
              {roundId === 2 && 'Round 02: Graph Challenge Forensics'}
              {roundId === 3 && 'Round 03: Rapid Fire Stage Buzzer'}
            </h2>
            <div className="arena-user-strip">
              <span>Candidate: <strong>{activeParticipant?.fullName || 'Solo Competitor'}</strong></span>
              <span className="dot-sep">•</span>
              <span>Seat: <code>{activeParticipant?.assignedSeat || 'Station #12'}</code></span>
            </div>
          </div>

          <div className="arena-header-actions">
            <div className="live-clock-pill">
              <Icon name="clock" size={14} className="text-molten" />
              <span>Time Left: 43:20</span>
            </div>
            <button
              type="button"
              className="modal-close-btn"
              onClick={onClose}
              aria-label="Exit arena"
            >
              <Icon name="close" size={20} />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="round-arena-body">
          {isSubmitted ? (
            <div className="score-completion-card">
              <div className="completion-icon-wrapper">
                <Icon name="award" size={40} className="text-gold" />
              </div>
              <h3>Round Submission Logged!</h3>
              <p>Your responses have been recorded in this local session.</p>
              <div className="final-score-display">
                <span className="score-num">{submittedScore} / 100</span>
                <span className="score-label">Screening Accuracy Score</span>
              </div>
              <p className="completion-note">
                ℹ️ <em>Demo evaluation mode. Results synced to local session leaderboard.</em>
              </p>
              <button type="button" className="btn btn-primary" onClick={onClose}>
                Return to Tournament Arena
              </button>
            </div>
          ) : (
            <div className="questions-feed">
              <div className="questions-instructions-banner">
                <Icon name="shield" size={16} className="text-solar" />
                <span>
                  Select your answers carefully. Complete all questions before time expires.
                </span>
              </div>

              {ROUND_1_SAMPLE_QUESTIONS.map((q, idx) => (
                <div key={q.id} className="question-card">
                  <div className="q-card-header">
                    <span className="q-number">Question {idx + 1} of 3</span>
                    <span className="q-topic">{q.title}</span>
                  </div>
                  <h4 className="q-prompt">{q.prompt}</h4>

                  <div className="q-options-list">
                    {q.options.map((opt, optIdx) => {
                      const isSelected = selectedAnswers[q.id] === optIdx;
                      return (
                        <button
                          key={optIdx}
                          type="button"
                          className={`q-option-btn ${isSelected ? 'selected' : ''}`}
                          onClick={() => handleSelect(q.id, optIdx)}
                        >
                          <span className="option-indicator">
                            {String.fromCharCode(65 + optIdx)}
                          </span>
                          <span className="option-text">{opt}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}

              <div className="arena-submit-bar">
                <div className="answered-count">
                  <span>Questions Answered: </span>
                  <strong>
                    {Object.keys(selectedAnswers).length} / {ROUND_1_SAMPLE_QUESTIONS.length}
                  </strong>
                </div>
                <button
                  type="button"
                  className="btn btn-primary btn-lg"
                  onClick={handleSubmit}
                  disabled={Object.keys(selectedAnswers).length === 0}
                >
                  <Icon name="check-circle" size={18} />
                  <span>Submit Round Answers</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
