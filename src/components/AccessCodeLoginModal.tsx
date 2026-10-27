import React, { useState } from 'react';
import { Icon } from './Icon';
import { apiRequest } from '../services/apiClient';
import type { Participant } from '../types/competition';

interface AccessCodeLoginModalProps {
  roundId: number | null;
  roundStatus: 'active' | 'locked' | 'completed';
  onClose: () => void;
  onSuccess: (participant: Participant, roundId: number) => void;
  onOpenRegister: () => void;
  initialAccessCode?: string;
}

export const AccessCodeLoginModal: React.FC<AccessCodeLoginModalProps> = ({
  roundId,
  roundStatus,
  onClose,
  onSuccess,
  onOpenRegister,
  initialAccessCode = '',
}) => {
  const [accessCode, setAccessCode] = useState(initialAccessCode);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!roundId) return null;

  const roundName =
    roundId === 1
      ? 'Round 1 — Data MCQ'
      : roundId === 2
        ? 'Round 2 — Graph Challenge'
        : 'Round 3 — Rapid Fire';

  const isLocked = roundStatus === 'locked';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const trimmed = accessCode.trim().toUpperCase();
    if (!trimmed) {
      setErrorMessage('Please enter your Access Code (e.g. BB-XXXX).');
      return;
    }

    if (isLocked) {
      setErrorMessage(`${roundName} is currently locked by the event administrator.`);
      return;
    }

    setIsLoading(true);
    try {
      const participant = await apiRequest<Participant>('/participants/login-access-code', {
        method: 'POST',
        body: JSON.stringify({ accessCode: trimmed }),
      });

      if (!participant || !participant.rollNumber) {
        throw new Error('Invalid response from authentication server.');
      }

      onSuccess(participant, roundId);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Invalid Access Code. Please check and try again.';
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="credential-modal-backdrop animate-fadeIn"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isLoading) onClose();
      }}
      role="dialog"
      aria-modal="true"
      id="access-code-modal"
    >
      <div className="credential-modal-card access-code-card">
        {/* Modal Close Button */}
        <button
          type="button"
          className="modal-close-btn"
          onClick={onClose}
          disabled={isLoading}
          aria-label="Close dialog"
        >
          <Icon name="x" size={18} />
        </button>

        {/* Modal Header */}
        <div className="modal-header-area">
          <div className="modal-icon-badge">
            <Icon name="key" size={24} />
          </div>
          <span className="modal-round-tag">ARENA ACCESS // {roundName}</span>
          <h2 className="modal-title">Enter Access Code</h2>
          <p className="modal-description">
            Provide the unique access code assigned to you upon registration approval.
          </p>
        </div>

        {errorMessage && (
          <div className="form-error-alert" role="alert" style={{ marginBottom: '16px' }}>
            <Icon name="alert-circle" size={18} />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-field-group">
            <label htmlFor="input-access-code" className="field-label">
              <span>Access Code</span>
              <span className="field-required">*</span>
            </label>
            <div className="field-input-wrapper">
              <Icon name="lock" size={16} className="field-icon-left" />
              <input
                id="input-access-code"
                type="text"
                required
                placeholder="BB-XXXX"
                value={accessCode}
                onChange={(e) => setAccessCode(e.target.value.toUpperCase())}
                className="field-input-control uppercase-text monospace-font code-input-field"
                autoFocus
                disabled={isLoading}
              />
            </div>
            <span className="field-hint-text">
              Example format: <code className="hint-code">BB-XXXX</code>
            </span>
          </div>

          <div className="modal-actions-group">
            <button
              type="submit"
              disabled={isLoading || isLocked}
              className="btn btn-primary btn-block btn-enter-arena"
              id="btn-login-access-code"
            >
              {isLoading ? (
                <>
                  <span className="spinner-border spinner-sm" />
                  <span>Verifying Credentials...</span>
                </>
              ) : (
                <>
                  <span>Enter Arena</span>
                  <Icon name="arrow-right" size={16} />
                </>
              )}
            </button>
          </div>
        </form>

        {/* Register Link for New Participants */}
        <div className="modal-footer-register">
          <span>Don't have an Access Code yet?</span>
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenRegister();
            }}
            className="link-register-action"
          >
            Register Here & Get Code →
          </button>
        </div>
      </div>
    </div>
  );
};
