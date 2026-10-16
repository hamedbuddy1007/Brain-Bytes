import React, { useState, useEffect, useRef } from 'react';
import { Icon } from './Icon';
import type { Participant, RoundStatus } from '../types/competition';

interface RoundCredentialModalProps {
  roundId: number | null;
  onClose: () => void;
  onSubmit: (participant: Participant) => void;
  existingParticipant: Participant | null;
  isRegistrationOpen: boolean;
  roundStatus: RoundStatus;
  activeJoinCodes: string[];
}

export const RoundCredentialModal: React.FC<RoundCredentialModalProps> = ({
  roundId,
  onClose,
  onSubmit,
  existingParticipant,
  isRegistrationOpen,
  roundStatus,
  activeJoinCodes,
}) => {
  const [fullName, setFullName] = useState(existingParticipant?.fullName || '');
  const [rollNumber, setRollNumber] = useState(existingParticipant?.rollNumber || '');
  const [joinCode, setJoinCode] = useState(existingParticipant?.joinCode || '');
  const [error, setError] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  const roundNameMap: Record<number, { title: string; subtitle: string; tag: string }> = {
    1: {
      title: 'Round 1: Data MCQ',
      subtitle: 'Multiple-choice questions testing foundational data science.',
      tag: 'ROUND 1 ACCESS',
    },
    2: {
      title: 'Round 2: Graph Challenge',
      subtitle: 'Interpret and analyse complex visual data charts and anomalies.',
      tag: 'ROUND 2 ACCESS',
    },
    3: {
      title: 'Round 3: Rapid Fire',
      subtitle: 'Live stage buzzer round with fast-paced data science prompts. Marking: +5 for correct, −2 for incorrect, and 0 for unanswered.',
      tag: 'ROUND 3 ACCESS',
    },
  };

  useEffect(() => {
    if (roundId) {
      const timer = setTimeout(() => {
        setError(null);
        inputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [roundId]);

  if (!roundId) return null;

  const currentRound = roundNameMap[roundId] || {
    title: `Round ${roundId}`,
    subtitle: 'Competition Round',
    tag: `ROUND ${roundId} ACCESS`,
  };

  const handleFillDemo = () => {
    setFullName('Aarav Sharma');
    setRollNumber('CS23-B1042');
    setJoinCode(activeJoinCodes[0] || 'BYTE2026');
    setError(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // 1. Host Gate Validations
    if (!isRegistrationOpen) {
      setError('Competition entry is currently paused by the event host.');
      return;
    }

    if (roundStatus === 'locked') {
      setError(`Round ${roundId} is currently locked by event administration. Please wait until the host activates this round.`);
      return;
    }

    // 2. Field Validations
    const trimmedName = fullName.trim();
    if (!trimmedName || trimmedName.length < 2) {
      setError('Please enter your full name or team name (at least 2 characters).');
      return;
    }

    const trimmedRoll = rollNumber.trim();
    if (!trimmedRoll || trimmedRoll.length < 3) {
      setError('Please enter your college roll number or participant ID.');
      return;
    }

    const trimmedCode = joinCode.trim().toUpperCase();
    if (!trimmedCode) {
      setError('Please enter the event join code.');
      return;
    }

    const isValidCode = activeJoinCodes.some(
      (code) => code.toUpperCase() === trimmedCode
    );

    if (!isValidCode) {
      setError(
        `Invalid event join code. Check auditorium screen. (Demo code: ${activeJoinCodes[0] || 'BYTE2026'})`
      );
      return;
    }

    // Construct participant record
    const participant: Participant = {
      fullName: trimmedName,
      rollNumber: trimmedRoll,
      joinCode: trimmedCode,
      registeredAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      ticketId: `DM-26-${Math.floor(1000 + Math.random() * 9000)}`,
      assignedSeat: `Station #${Math.floor(1 + Math.random() * 60)}`,
      collegeName: existingParticipant?.collegeName || 'Department of Computer Science',
      status: 'verified',
    };

    onSubmit(participant);
  };

  return (
    <div
      className="modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="credential-modal-title"
    >
      <div className="credential-modal-card">
        {/* Header */}
        <div className="credential-modal-header">
          <div className="credential-header-tag">
            <Icon name="terminal" size={14} className="text-molten" />
            <span>{currentRound.tag}</span>
          </div>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            aria-label="Close modal"
          >
            <Icon name="close" size={20} />
          </button>
        </div>

        <div className="credential-modal-title-group">
          <h2 id="credential-modal-title" className="credential-title">
            {currentRound.title}
          </h2>
          <p className="credential-subtitle">{currentRound.subtitle}</p>
        </div>

        {/* Lock warning if round is locked */}
        {roundStatus === 'locked' && (
          <div className="credential-warning-box">
            <Icon name="lock" size={16} className="text-molten" />
            <span>
              <strong>Notice:</strong> This round is currently locked by the event host. You may
              pre-enter credentials, but entry requires the host to activate Round {roundId} in the
              Admin Console.
            </span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="credential-form">
          {error && (
            <div className="form-error-alert" role="alert">
              <Icon name="alert-circle" size={18} />
              <span>{error}</span>
            </div>
          )}

          <div className="form-field-group">
            <label htmlFor="participant-name" className="field-label">
              Participant Name / Team Name
            </label>
            <input
              id="participant-name"
              ref={inputRef}
              type="text"
              className="field-input"
              placeholder="e.g. Aarav Sharma"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
            />
          </div>

          <div className="form-field-group">
            <label htmlFor="participant-roll" className="field-label">
              College Roll Number / Participant ID
            </label>
            <input
              id="participant-roll"
              type="text"
              className="field-input"
              placeholder="e.g. CS23-B1042"
              value={rollNumber}
              onChange={(e) => setRollNumber(e.target.value)}
              required
            />
          </div>

          <div className="form-field-group">
            <div className="field-label-row">
              <label htmlFor="participant-code" className="field-label">
                Event Join Code
              </label>
              <span className="field-hint">
                Default: <code>{activeJoinCodes[0] || 'BYTE2026'}</code>
              </span>
            </div>
            <input
              id="participant-code"
              type="text"
              className="field-input code-input"
              placeholder="e.g. BYTE2026"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              required
            />
          </div>

          <div className="demo-fill-row">
            <button
              type="button"
              className="btn-text-demo"
              onClick={handleFillDemo}
            >
              <Icon name="sparkles" size={14} />
              <span>Fill Demo Credentials</span>
            </button>
          </div>

          <div className="credential-modal-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary btn-enter-round"
              id="btn-confirm-round-entry"
            >
              <span>Enter {currentRound.title}</span>
              <Icon name="arrow-right" size={16} />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
