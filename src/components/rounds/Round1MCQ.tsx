import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { Icon } from '../Icon';
import type { Participant } from '../../types/competition';
import { ROUND_1_QUESTIONS } from '../../data/round1Questions';
import { useExamTimer } from '../../hooks/useExamTimer';
import { recordSubmission, getParticipantSubmission } from '../../services/competitionStateService';
import './Round1MCQ.css';

interface Round1MCQProps {
  participant: Participant | null;
  onExit: () => void;
  onRecordScore?: (score: number) => void;
  onProceedToNextRound?: () => void;
}

export const Round1MCQ: React.FC<Round1MCQProps> = ({
  participant,
  onExit,
  onRecordScore,
}) => {
  // Current active question index (0-based)
  const [currentIndex, setCurrentIndex] = useState(0);

  // User state maps
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number>>({});

  // Questions marked for review
  const [markedForReview, setMarkedForReview] = useState<Set<number>>(
    new Set([4, 6])
  );

  // Visited tracking
  const [visitedQuestions, setVisitedQuestions] = useState<Set<number>>(
    new Set([1, 2, 3, 4, 5, 6])
  );

  // Submission state
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const isSubmittingRef = useRef(false);
  const [finalScore, setFinalScore] = useState<number | null>(null);
  const [scoreDetails, setScoreDetails] = useState<{
    correctCount: number;
    incorrectCount: number;
    unansweredCount: number;
    rawMarks: number;
  }>({ correctCount: 0, incorrectCount: 0, unansweredCount: 0, rawMarks: 0 });

  // Current Question Data
  const currentQuestion = ROUND_1_QUESTIONS[currentIndex];

  // Helper calculations
  const totalQuestions = ROUND_1_QUESTIONS.length;

  // Restore previous submission if participant already submitted Round 1
  useEffect(() => {
    if (participant?.rollNumber) {
      const existing = getParticipantSubmission(1, participant.rollNumber);
      if (existing) {
        setFinalScore(existing.score);
        setScoreDetails({
          correctCount: existing.correctCount,
          incorrectCount: existing.incorrectCount,
          unansweredCount: existing.unansweredCount,
          rawMarks: existing.score,
        });
        setIsSubmitted(true);
      }
    }
  }, [participant]);

  // Synchronize on authoritative round reset
  useEffect(() => {
    const handleReset = (e: Event) => {
      const ce = e as CustomEvent<{ roundId: number }>;
      if (!ce.detail || ce.detail.roundId === 1) {
        setSelectedAnswers({});
        setMarkedForReview(new Set());
        setVisitedQuestions(new Set([1]));
        setCurrentIndex(0);
        setIsSubmitted(false);
        setFinalScore(null);
        isSubmittingRef.current = false;
      }
    };
    window.addEventListener('bb_round_reset', handleReset);
    return () => window.removeEventListener('bb_round_reset', handleReset);
  }, []);

  // Submit Handler
  const handleConfirmSubmit = useCallback(() => {
    if (isSubmittingRef.current || isSubmitted) return;
    isSubmittingRef.current = true;

    setIsSubmitModalOpen(false);

    let correct = 0;
    let incorrect = 0;
    let unanswered = 0;

    ROUND_1_QUESTIONS.forEach((q) => {
      const chosen = selectedAnswers[q.id];
      if (chosen === undefined) {
        unanswered += 1;
      } else if (chosen === q.correctAnswer) {
        correct += 1;
      } else {
        incorrect += 1;
      }
    });

    // Scoring: +1 for correct, 0 for wrong, 0 for unanswered
    const rawScore = correct * 1;

    setScoreDetails({
      correctCount: correct,
      incorrectCount: incorrect,
      unansweredCount: unanswered,
      rawMarks: rawScore,
    });

    setFinalScore(rawScore);
    setIsSubmitted(true);

    if (participant) {
      recordSubmission(1, participant, selectedAnswers);
    }

    if (onRecordScore) {
      onRecordScore(rawScore);
    }
  }, [isSubmitted, selectedAnswers, participant, onRecordScore]);

  const handleAutoSubmit = useCallback(() => {
    handleConfirmSubmit();
  }, [handleConfirmSubmit]);

  // Timer: Exactly 10 minutes (600 seconds)
  const { formattedTime } = useExamTimer({
    durationSeconds: 10 * 60,
    isRunning: !isSubmitted,
    roundId: 1,
    rollNumber: participant?.rollNumber,
    onExpire: handleAutoSubmit,
  });

  const answeredCount = useMemo(() => {
    return Object.keys(selectedAnswers).length;
  }, [selectedAnswers]);

  const reviewCount = useMemo(() => {
    return markedForReview.size;
  }, [markedForReview]);

  const unvisitedCount = useMemo(() => {
    // Questions that have not yet been answered or visited/attempted
    const count = ROUND_1_QUESTIONS.filter(
      (q) =>
        !visitedQuestions.has(q.id) &&
        selectedAnswers[q.id] === undefined &&
        !markedForReview.has(q.id)
    ).length;
    return count;
  }, [visitedQuestions, selectedAnswers, markedForReview]);

  // Navigate to Question
  const handleSelectQuestion = (index: number) => {
    setCurrentIndex(index);
    setVisitedQuestions((prev) => new Set(prev).add(ROUND_1_QUESTIONS[index].id));
  };

  // Option selection
  const handleOptionClick = (optionIdx: number) => {
    if (isSubmitted) return;
    const qId = currentQuestion.id;

    setSelectedAnswers((prev) => {
      // If clicking the currently selected option, toggle / deselect it
      if (prev[qId] === optionIdx) {
        const next = { ...prev };
        delete next[qId];
        return next;
      }
      return {
        ...prev,
        [qId]: optionIdx,
      };
    });
  };

  // Clear current question response
  const handleClearResponse = () => {
    if (isSubmitted) return;
    const qId = currentQuestion.id;
    setSelectedAnswers((prev) => {
      const next = { ...prev };
      delete next[qId];
      return next;
    });
  };

  // Toggle Mark for Review
  const handleToggleReview = () => {
    if (isSubmitted) return;
    const qId = currentQuestion.id;
    setMarkedForReview((prev) => {
      const next = new Set(prev);
      if (next.has(qId)) {
        next.delete(qId);
      } else {
        next.add(qId);
      }
      return next;
    });
  };

  // Navigation: Previous
  const handlePrev = () => {
    if (currentIndex > 0) {
      handleSelectQuestion(currentIndex - 1);
    }
  };

  // Navigation: Next
  const handleNext = () => {
    if (currentIndex < totalQuestions - 1) {
      handleSelectQuestion(currentIndex + 1);
    }
  };

  // Save & Move to Next
  const handleSaveAndNext = () => {
    if (currentIndex < totalQuestions - 1) {
      handleSelectQuestion(currentIndex + 1);
    }
  };

  // Participant details with safe fallbacks
  const participantId =
    participant?.ticketId || participant?.rollNumber || 'BB-2025-0842';
  const participantName = participant?.fullName || 'Candidate Demo';

  // Determine active question status label & dot color
  const isCurrentAnswered = selectedAnswers[currentQuestion.id] !== undefined;
  const isCurrentMarked = markedForReview.has(currentQuestion.id);

  let statusLabel = 'NOT ATTEMPTED';
  let statusDotClass = 'dot-orange';

  if (isCurrentAnswered && isCurrentMarked) {
    statusLabel = 'ANSWERED & MARKED FOR REVIEW';
    statusDotClass = 'dot-purple';
  } else if (isCurrentAnswered) {
    statusLabel = 'ANSWERED & ACTIVE';
    statusDotClass = 'dot-orange';
  } else if (isCurrentMarked) {
    statusLabel = 'MARKED FOR REVIEW';
    statusDotClass = 'dot-purple';
  }

  // Render Completed Summary
  if (isSubmitted) {
    return (
      <div className="stitch-exam-root">
        <header className="stitch-header-bar">
          <div className="stitch-header-left">
            <span className="sys-tag-badge">[SYS_01]</span>
            <span className="stitch-brand-logo">BRAIN BYTES</span>
            <span className="stitch-brand-sub">// DATA MANIA</span>
            <div className="stitch-round-pill">
              <span className="pill-dot" />
              <span className="pill-text">ROUND 1 — COMPLETED</span>
            </div>
          </div>
          <div className="stitch-header-right">
            <button
              type="button"
              className="header-btn-exit"
              onClick={onExit}
              title="Return to Landing Page"
            >
              ← Return to Arena
            </button>
          </div>
        </header>

        <main className="stitch-main-layout" style={{ justifyContent: 'center' }}>
          <div className="stitch-result-view">
            <div className="result-hero-box">
              <span className="result-badge-top">AUDIT COMPLETE • TELEMETRY COMMITTED</span>
              <h1 className="result-main-heading">Round 1 Screening Submission Successful</h1>
              <p className="result-candidate-info">
                Candidate <strong>{participantName}</strong> ({participantId}) •
                Session recording and answers verified.
              </p>

              <div className="result-score-callout">
                <div className="score-big-number">{finalScore} PTS</div>
                <div className="score-sub-label">
                  SCORE RATIO: {scoreDetails.correctCount}/{totalQuestions} CORRECT • TOTAL SCORE: {scoreDetails.rawMarks} PTS
                </div>
              </div>
            </div>

            <div className="stitch-modal-stats-grid" style={{ margin: '0' }}>
              <div className="modal-stat-box">
                <span className="modal-stat-val" style={{ color: '#00E699' }}>
                  {scoreDetails.correctCount}
                </span>
                <span className="modal-stat-label">CORRECT (+1.00)</span>
              </div>
              <div className="modal-stat-box">
                <span className="modal-stat-val" style={{ color: '#FF6B6B' }}>
                  {scoreDetails.incorrectCount}
                </span>
                <span className="modal-stat-label">INCORRECT (0.00)</span>
              </div>
              <div className="modal-stat-box">
                <span className="modal-stat-val" style={{ color: '#777777' }}>
                  {scoreDetails.unansweredCount}
                </span>
                <span className="modal-stat-label">SKIPPED / UNANSWERED (0.00)</span>
              </div>
            </div>

            <h3 style={{ margin: '12px 0 4px', fontSize: '1rem', color: '#E0E0E0' }}>
              Performance Diagnostic Log:
            </h3>

            <div className="result-breakdown-list">
              {ROUND_1_QUESTIONS.map((q, idx) => {
                const userAns = selectedAnswers[q.id];
                const isCorrect = userAns === q.correctAnswer;
                const isSkipped = userAns === undefined;

                return (
                  <div
                    key={q.id}
                    className={`result-q-item ${
                      isSkipped ? 'skipped' : isCorrect ? 'correct' : 'incorrect'
                    }`}
                  >
                    <div className="result-q-head">
                      <span style={{ color: '#FFFFFF' }}>
                        Q{idx + 1}. {q.prompt}
                      </span>
                      <span
                        style={{
                          fontFamily: 'monospace',
                          color: isSkipped ? '#777777' : isCorrect ? '#00E699' : '#FF6B6B',
                        }}
                      >
                        {isSkipped
                          ? 'SKIPPED (0.0)'
                          : isCorrect
                          ? '✓ CORRECT (+1.0)'
                          : '✗ INCORRECT (0.0)'}
                      </span>
                    </div>
                    <p className="result-q-exp">{q.explanation}</p>
                  </div>
                );
              })}
            </div>

            <div style={{ display: 'flex', justifyContent: 'center', marginTop: '16px' }}>
              <button
                type="button"
                className="btn-save-next-prominent"
                onClick={onExit}
                id="btn-return-landing"
              >
                <span>Return to Competition Arena</span>
                <Icon name="arrow-right" size={18} />
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="stitch-exam-root" id="round1-exam-cockpit">
      {/* ----------------------------------------------------------------------
          1. HEADER BAR
         ---------------------------------------------------------------------- */}
      <header className="stitch-header-bar">
        <div className="stitch-header-left">
          <span className="sys-tag-badge">[SYS_01]</span>
          <span className="stitch-brand-logo">BRAIN BYTES</span>
          <span className="stitch-brand-sub">// DATA MANIA</span>

          <div className="stitch-round-pill">
            <span className="pill-dot" />
            <span className="pill-text">ROUND 1 — DATA MCQ</span>
          </div>
        </div>

        <div className="stitch-header-right">
          {/* Participant ID */}
          <div className="header-meta-group">
            <span className="meta-group-label">PARTICIPANT ID</span>
            <span className="meta-group-val">{participantId}</span>
          </div>

          <div className="meta-divider" />

          {/* Assessment Matrix */}
          <div className="header-meta-group">
            <span className="meta-group-label">ASSESSMENT MATRIX</span>
            <span className="meta-group-val val-matrix">
              QUESTION <strong>{currentIndex + 1}</strong> OF {totalQuestions}
            </span>
          </div>

          <div className="meta-divider" />

          {/* Remaining Timer */}
          <div className="header-meta-group">
            <span className="meta-group-label">REMAINING</span>
            <span className="meta-group-val val-timer" title="Time remaining in Round 1">
              {formattedTime}
              <Icon name="clock" size={16} />
            </span>
          </div>

          {/* User Profile Avatar */}
          <div className="header-user-avatar" title={`Active: ${participantName}`}>
            <Icon name="users" size={18} />
          </div>

          {/* Exit / Return option */}
          <button
            type="button"
            className="header-btn-exit"
            onClick={onExit}
            title="Return to Landing Page"
          >
            Arena
          </button>
        </div>
      </header>

      {/* ----------------------------------------------------------------------
          2. MAIN COCKPIT: TWO COLUMNS
         ---------------------------------------------------------------------- */}
      <main className="stitch-main-layout">
        {/* ====================================================================
            LEFT COLUMN: QUESTION PALETTE
           ==================================================================== */}
        <aside className="stitch-palette-card" aria-label="Question Navigation Palette">
          {/* Palette Title Row */}
          <div className="palette-title-row">
            <div className="palette-heading-group">
              <span className="palette-pip" />
              <h2 className="palette-main-title">QUESTION PALETTE</h2>
            </div>
            <span className="palette-sec-badge">SEC: STAT_A</span>
          </div>

          {/* Counter Stats Row */}
          <div className="palette-stats-row">
            {/* Answered */}
            <div className="palette-stat-item">
              <span className="stat-header">ANSWERED</span>
              <div className="stat-numeric color-answered">
                {String(answeredCount).padStart(2, '0')}
                <span className="stat-suffix">/{totalQuestions}</span>
              </div>
            </div>

            {/* Review */}
            <div className="palette-stat-item">
              <span className="stat-header">REVIEW</span>
              <div className="stat-numeric color-review">
                {String(reviewCount).padStart(2, '0')}
                <span className="stat-suffix color-review"> flagged</span>
              </div>
            </div>

            {/* Unvisited */}
            <div className="palette-stat-item">
              <span className="stat-header">UNVISITED</span>
              <div className="stat-numeric color-unvisited">
                {String(unvisitedCount).padStart(2, '0')}
                <span className="stat-suffix color-unvisited"> left</span>
              </div>
            </div>
          </div>

          {/* Node Grid Meta Row */}
          <div className="palette-grid-meta-row">
            <span className="grid-sub-title">// NODE NAVIGATION GRID</span>
            <span className="grid-block-tag">BLOCK: 01-20</span>
          </div>

          {/* 4x5 Node Grid */}
          <div className="palette-nodes-grid" role="group" aria-label="Question grid">
            {ROUND_1_QUESTIONS.map((q, idx) => {
              const isCurrent = idx === currentIndex;
              const hasAnswer = selectedAnswers[q.id] !== undefined;
              const isMarked = markedForReview.has(q.id);

              let stateClass = 'state-unvisited';
              if (hasAnswer && isMarked) {
                stateClass = 'state-ans-marked';
              } else if (hasAnswer) {
                stateClass = 'state-answered';
              } else if (isMarked) {
                stateClass = 'state-marked';
              }

              return (
                <button
                  key={q.id}
                  type="button"
                  id={`palette-node-${q.id}`}
                  className={`palette-node-btn ${stateClass} ${isCurrent ? 'is-active' : ''}`}
                  onClick={() => handleSelectQuestion(idx)}
                  aria-label={`Question ${q.numberStr}: ${
                    hasAnswer ? 'Answered' : 'Unanswered'
                  } ${isMarked ? ', Marked for review' : ''}`}
                >
                  <span>{q.numberStr}</span>

                  {/* Corner Pips matching Stitch reference */}
                  {isCurrent && !hasAnswer && !isMarked && (
                    <span className="node-corner-pip pip-orange" />
                  )}

                  {hasAnswer && !isMarked && (
                    <span className="node-corner-pip pip-green" />
                  )}

                  {!hasAnswer && isMarked && (
                    <span className="node-corner-pip pip-purple" />
                  )}

                  {hasAnswer && isMarked && (
                    <span className="node-dual-pips">
                      <span className="pip-dot-purple" />
                      <span className="pip-sq-green" />
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* State Legend */}
          <div className="palette-legend-section">
            <div className="legend-header-row">
              <span className="legend-title">STATE LEGEND</span>
              <span className="legend-version">[v2.4]</span>
            </div>

            <div className="legend-items-grid">
              <div className="legend-item">
                <span className="legend-box box-active" />
                <span>Current Active</span>
              </div>
              <div className="legend-item">
                <span className="legend-box box-answered" />
                <span>Answered</span>
              </div>
              <div className="legend-item">
                <span className="legend-box box-review" />
                <span>Marked Review</span>
              </div>
              <div className="legend-item">
                <span className="legend-box box-ans-marked" />
                <span>Ans + Marked</span>
              </div>
              <div className="legend-item full-width">
                <span className="legend-box box-unvisited" />
                <span>Unvisited / Not Attempted</span>
              </div>
            </div>
          </div>

          {/* Palette Bottom Status */}
          <div className="palette-heartbeat-bar">
            <span className="heartbeat-text">HEARTBEAT_ACK</span>
            <span className="heartbeat-status">
              <span className="pulse-dot-green" />
              ONLINE
            </span>
          </div>
        </aside>

        {/* ====================================================================
            RIGHT COLUMN: QUESTION PANEL
           ==================================================================== */}
        <section className="stitch-question-card" aria-label="Current Question Details">
          {/* Top Meta Row */}
          <div className="question-meta-top-row">
            <div className="meta-top-left">
              <span className="q-badge-orange">QUESTION {currentQuestion.numberStr}</span>
              <span className="q-diamond-icon">◆</span>
              <span className="q-type-text">MULTIPLE CHOICE QUESTION (SINGLE ANSWER)</span>
            </div>

            <div className="meta-top-right">
              <span className="q-marks-pill">
                <span className="marks-pos">+1.00 MARK</span>
                <span className="marks-slash">/</span>
                <span className="marks-neg">0.00 WRONG</span>
              </span>

              <span className="q-status-chip status-active">
                <span className={`status-dot ${statusDotClass}`} />
                <span>STATUS: {statusLabel}</span>
              </span>
            </div>
          </div>

          {/* Sub-meta Row */}
          <div className="question-sub-meta-row">
            <span>INDEX REF: {currentQuestion.indexRef}</span>
            <span>DIFFICULTY COEFFICIENT: {currentQuestion.difficulty}</span>
          </div>

          {/* Question Framing Box */}
          <div className="question-framing-box">
            <span className="tech-corner-cross cross-tl">+</span>
            <span className="tech-corner-cross cross-tr">+</span>

            <h3 className="question-prompt-text">{currentQuestion.prompt}</h3>

            <div className="question-domain-line">
              <span>🗂 DATASET_DOMAIN: {currentQuestion.domain}</span>
              <span className="domain-bullet">•</span>
              <span>⚙ PARADIGM: {currentQuestion.paradigm}</span>
            </div>
          </div>

          {/* Options List */}
          <div className="question-options-list" role="radiogroup" aria-label="Answer options">
            {currentQuestion.options.map((opt, optIdx) => {
              const isSelected = selectedAnswers[currentQuestion.id] === optIdx;

              return (
                <div
                  key={opt.key}
                  role="radio"
                  tabIndex={0}
                  aria-checked={isSelected}
                  id={`opt-${currentQuestion.id}-${opt.key}`}
                  className={`stitch-option-row ${isSelected ? 'is-selected' : ''}`}
                  onClick={() => handleOptionClick(optIdx)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleOptionClick(optIdx);
                    }
                  }}
                >
                  <div className="option-left-cluster">
                    <div className="option-key-box">{opt.key}</div>
                    <div className="option-text-cluster">
                      <span className="option-main-label">{opt.label}</span>
                      <span className="option-sub-desc">{opt.subtext}</span>
                    </div>
                  </div>

                  <div className="option-right-cluster">
                    {isSelected ? (
                      <>
                        <span className="option-selected-tag">[SELECTED]</span>
                        <button
                          type="button"
                          className="option-clear-x-btn"
                          title="Deselect this answer"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleClearResponse();
                          }}
                        >
                          ✕
                        </button>
                      </>
                    ) : (
                      <span className="option-unselected-box" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Proctoring & Autosave Sensor Bar */}
          <div className="proctor-sensors-bar">
            <div className="sensor-state-left">
              <Icon name="shield" size={14} />
              <span>PROCTORING SENSORS: VIDEO_AUDIO_TAB_FOCUS = STABLE</span>
            </div>
            <div className="sensor-state-right">
              <span>AUTOSAVE STATE: BUFFER_COMMITTED_LOCAL</span>
            </div>
          </div>

          {/* Exam Action Buttons Bar */}
          <div className="exam-actions-bar">
            {/* Left: Mark For Review */}
            <div className="actions-left-group">
              <button
                type="button"
                id="btn-mark-review"
                className={`btn-terminal-action btn-review-toggle ${
                  isCurrentMarked ? 'is-marked' : ''
                }`}
                onClick={handleToggleReview}
              >
                <Icon name="ticket" size={14} />
                <span>{isCurrentMarked ? 'MARKED FOR REVIEW ✓' : 'MARK FOR REVIEW'}</span>
              </button>
            </div>

            {/* Middle: Clear & Prev / Next */}
            <div className="actions-mid-group">
              <button
                type="button"
                id="btn-clear-response"
                className="btn-terminal-action btn-clear-choice"
                onClick={handleClearResponse}
                disabled={!isCurrentAnswered}
              >
                <Icon name="close" size={14} />
                <span>CLEAR RESPONSE</span>
              </button>

              <button
                type="button"
                id="btn-nav-prev"
                className="btn-terminal-action"
                onClick={handlePrev}
                disabled={currentIndex === 0}
              >
                <span>← PREVIOUS</span>
              </button>

              <button
                type="button"
                id="btn-nav-next"
                className="btn-terminal-action"
                onClick={handleNext}
                disabled={currentIndex === totalQuestions - 1}
              >
                <span>NEXT →</span>
              </button>
            </div>

            {/* Right: Save & Move To Next AND Submit Test Buttons */}
            <div className="actions-right-group">
              <button
                type="button"
                id="btn-save-next"
                className="btn-terminal-action btn-save-action"
                onClick={handleSaveAndNext}
                disabled={currentIndex === totalQuestions - 1}
              >
                <span>SAVE & MOVE TO NEXT</span>
                <Icon name="arrow-right" size={14} />
              </button>

              <button
                type="button"
                id="btn-submit-test"
                className="btn-save-next-prominent"
                onClick={() => setIsSubmitModalOpen(true)}
              >
                <span>SUBMIT TEST</span>
                <Icon name="check-circle" size={16} />
              </button>
            </div>
          </div>
        </section>
      </main>

      {/* ----------------------------------------------------------------------
          3. BOTTOM TERMINAL FOOTER
         ---------------------------------------------------------------------- */}
      <footer className="stitch-exam-footer">
        <div>
          TERMINAL: EXEC_NODE_04 &nbsp;&nbsp; ENCRYPTION: AES-256 &nbsp;&nbsp; STATE: SESSION_RECORDING
        </div>
        <div>DATA MANIA © 2025 // STRICT TELEMETRY ENFORCED</div>
      </footer>

      {/* ----------------------------------------------------------------------
          4. CONFIRM SUBMISSION MODAL
         ---------------------------------------------------------------------- */}
      {isSubmitModalOpen && (
        <div className="stitch-modal-overlay" role="dialog" aria-modal="true">
          <div className="stitch-modal-card">
            <div className="stitch-modal-header">
              <Icon name="alert-circle" size={24} className="text-molten" />
              <h3 className="stitch-modal-title">Confirm Final Submission</h3>
            </div>

            <p className="stitch-modal-desc">
              Are you sure you want to submit your test? You may have unanswered questions.
            </p>

            <div className="stitch-modal-stats-grid">
              <div className="modal-stat-box">
                <span className="modal-stat-val" style={{ color: '#00E699' }}>
                  {answeredCount}
                </span>
                <span className="modal-stat-label">ANSWERED</span>
              </div>
              <div className="modal-stat-box">
                <span className="modal-stat-val" style={{ color: '#A855F7' }}>
                  {reviewCount}
                </span>
                <span className="modal-stat-label">FOR REVIEW</span>
              </div>
              <div className="modal-stat-box">
                <span className="modal-stat-val" style={{ color: '#F5F5F5' }}>
                  {totalQuestions - answeredCount}
                </span>
                <span className="modal-stat-label">UNANSWERED</span>
              </div>
            </div>

            <div className="stitch-modal-actions">
              <button
                type="button"
                className="btn-terminal-action"
                onClick={() => setIsSubmitModalOpen(false)}
              >
                Return to Test
              </button>

              <button
                type="button"
                className="btn-save-next-prominent"
                onClick={handleConfirmSubmit}
                id="btn-confirm-final-submit"
              >
                <span>Commit & Finalize</span>
                <Icon name="check-circle" size={16} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
