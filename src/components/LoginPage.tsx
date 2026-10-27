import React, { useState } from 'react';
import { Icon } from './Icon';
import { apiRequest } from '../services/apiClient';
import type { Participant } from '../types/competition';

interface LoginPageProps {
  onLoginSuccess: (participant: Participant) => void;
  onBackToHome: () => void;
  onNavigateToRegister: () => void;
  initialAccessCode?: string;
}

export const LoginPage: React.FC<LoginPageProps> = ({
  onLoginSuccess,
  onBackToHome,
  onNavigateToRegister,
  initialAccessCode = '',
}) => {
  const [accessCode, setAccessCode] = useState(initialAccessCode);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPendingApproval, setIsPendingApproval] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsPendingApproval(false);

    const trimmed = accessCode.trim().toUpperCase();
    if (!trimmed) {
      setErrorMessage('Please enter your unique candidate Access Code (e.g. BB-XXXX).');
      return;
    }

    setIsLoading(true);
    try {
      const res = await apiRequest<Participant & { token?: string }>('/participants/login-access-code', {
        method: 'POST',
        body: JSON.stringify({ accessCode: trimmed }),
      });

      if (!res || !res.rollNumber) {
        throw new Error('Authentication response did not contain participant data.');
      }

      // Store the JWT session token in localStorage for persistent Bearer authentication
      if (res.token) {
        localStorage.setItem('bb_participant_token', res.token);
      }
      localStorage.setItem('bb_last_access_code', trimmed);

      onLoginSuccess(res);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Invalid Access Code. Please check and try again.';
      setErrorMessage(msg);
      if (msg.toLowerCase().includes('approval') || msg.toLowerCase().includes('awaiting')) {
        setIsPendingApproval(true);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-page-root" id="participant-login-page">
      {/* Background ambient solar flair */}
      <div className="landing-ambient-flare" aria-hidden="true" />

      {/* Top Header Bar */}
      <header className="login-top-bar">
        <button
          type="button"
          onClick={onBackToHome}
          className="btn-back-home"
          id="btn-login-back-home"
        >
          <Icon name="arrow-left" size={16} />
          <span>Back to Home</span>
        </button>

        <div className="login-header-brand">
          <div className="brand-icon-box">
            <Icon name="brain" size={18} />
          </div>
          <span className="brand-dot" />
          <span className="brand-name">DATA MANIA • BRAIN BYTES 2026</span>
        </div>
      </header>

      {/* Main Login Card Section */}
      <main className="login-content-container">
        <div className="login-card-wrapper animate-fadeIn">
          {/* Card Header */}
          <div className="login-card-header">
            <div className="login-icon-badge">
              <Icon name="key" size={28} />
            </div>
            <span className="login-stage-tag">ARENA AUTHENTICATION // STATION ACCESS</span>
            <h1 className="login-title">Enter Access Code</h1>
            <p className="login-subtitle">
              Provide your individual candidate code issued upon registration approval to unlock the Competition Arena.
            </p>
          </div>

          {/* Error & Pending Alerts */}
          {errorMessage && (
            <div className={`login-alert ${isPendingApproval ? 'alert-warning' : 'alert-error'}`} role="alert">
              <Icon name={isPendingApproval ? 'clock' : 'alert-circle'} size={18} />
              <div className="alert-text-block">
                <span>{errorMessage}</span>
                {isPendingApproval && (
                  <p className="alert-subtext">
                    Ask your proctor or room administrator to approve your desk entry in the Admin Dashboard.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="login-form" id="form-participant-login">
            <div className="login-field-group">
              <label htmlFor="input-access-code" className="login-field-label">
                <span>CANDIDATE ACCESS CODE</span>
                <span className="field-required">*</span>
              </label>

              <div className="login-input-wrapper">
                <span className="login-input-icon">
                  <Icon name="lock" size={18} />
                </span>
                <input
                  id="input-access-code"
                  type="text"
                  required
                  placeholder="e.g. BB-A4X9"
                  value={accessCode}
                  onChange={(e) => setAccessCode(e.target.value.toUpperCase())}
                  className="login-input-control"
                  autoFocus
                  disabled={isLoading}
                  autoComplete="off"
                  spellCheck="false"
                />
              </div>

              <span className="login-hint-text">
                Your individual Access Code is assigned after desk registration and proctor approval.
              </span>
            </div>

            <div className="login-action-group">
              <button
                type="submit"
                disabled={isLoading}
                className="btn-login-submit"
                id="btn-submit-access-code"
              >
                {isLoading ? (
                  <>
                    <span className="spinner-border spinner-sm" />
                    <span>Verifying Access Code...</span>
                  </>
                ) : (
                  <>
                    <span>Unlock Arena Cockpit</span>
                    <Icon name="arrow-right" size={18} />
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Alternative Navigation */}
          <div className="login-card-footer">
            <p className="login-register-prompt">
              Don&apos;t have an Access Code yet?{' '}
              <button
                type="button"
                onClick={onNavigateToRegister}
                className="btn-link-register"
                id="btn-goto-register"
              >
                Register as Candidate
              </button>
            </p>
          </div>

          {/* Tournament Security Notice */}
          <div className="login-security-notice">
            <Icon name="shield" size={14} />
            <span>
              Each station is individually proctored. Your Access Code grants single-candidate access to all three competition stages.
            </span>
          </div>
        </div>
      </main>
    </div>
  );
};
