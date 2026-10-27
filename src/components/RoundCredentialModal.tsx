import React, { useState, useEffect, useRef } from 'react';
import { Icon } from './Icon';
import type { Participant, RoundStatus } from '../types/competition';
import { apiRequest } from '../services/apiClient';

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
  const [isSubmitting, setIsSubmitting] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);

  const roundNameMap: Record<number, { title: string; subtitle: string; tag: string }> = {
    1: {
      title: 'Round 1: Data MCQ',
      subtitle: 'Multiple-choice questions testing foundational data science. Registration open.',
      tag: 'ROUND 1 ACCESS',
    },
    2: {
      title: 'Round 2: Graph Challenge',
      subtitle: 'Existing candidates only. Enter your registered credentials from Round 1 to continue.',
      tag: 'ROUND 2 ACCESS',
    },
    3: {
      title: 'Round 3: Rapid Fire',
      subtitle: 'Final stage. Enter your registered credentials from previous rounds to continue.',
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
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

    const trimmedRoll = rollNumber.trim().toUpperCase();
    if (!trimmedRoll || trimmedRoll.length < 2) {
      setError('Please enter your college roll number or participant ID.');
      return;
    }

    const trimmedCode = joinCode.trim().toUpperCase();
    if (!trimmedCode) {
      setError('Please enter the event join code.');
      return;
    }

    setIsSubmitting(true);
    try {
      const participant = await apiRequest<Participant & { token?: string }>('/participants/register', {
        method: 'POST',
        body: JSON.stringify({
          fullName: trimmedName,
          rollNumber: trimmedRoll,
          collegeName: existingParticipant?.collegeName || 'Department of Computer Science',
          joinCode: trimmedCode,
          roundId: roundId ?? undefined,
        }),
      });

      if (participant.token) {
        localStorage.setItem('bb_participant_token', participant.token);
      }
      localStorage.setItem('bb_last_join_code', trimmedCode);

      onSubmit({
        ...participant,
        joinCode: trimmedCode,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Entry failed.';
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSubmitting) onClose();
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
            disabled={isSubmitting}
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

        {/* Prerequisite notice for subsequent rounds */}
        {roundId > 1 && (
          <div style={{
            background: 'rgba(142, 35, 59, 0.15)',
            border: '1px solid rgba(142, 35, 59, 0.4)',
            borderRadius: '6px',
            padding: '10px 14px',
            fontSize: '0.82rem',
            color: '#F5F3F4',
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            lineHeight: 1.4,
          }}>
            <Icon name="shield" size={16} style={{ color: '#F59E0B', flexShrink: 0 }} />
            <span>
              <strong>Round 1 Appearance Required:</strong> No new entries are allowed in Round {roundId}. Only candidates who appeared in Round 1 may proceed.
            </span>
          </div>
        )}

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
              disabled={isSubmitting}
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
              disabled={isSubmitting}
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
              disabled={isSubmitting}
              required
            />
          </div>

          <div className="demo-fill-row">
            <button
              type="button"
              className="btn-text-demo"
              onClick={handleFillDemo}
              disabled={isSubmitting}
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
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary btn-enter-round"
              id="btn-confirm-round-entry"
              disabled={isSubmitting}
            >
              <span>{isSubmitting ? 'Entering Round...' : `Enter ${currentRound.title}`}</span>
              <Icon name="arrow-right" size={16} />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
