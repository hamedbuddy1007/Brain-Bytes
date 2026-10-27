import React, { useState } from 'react';
import { Icon } from './Icon';
import { authenticateAdmin } from '../services/adminAuthService';
import './AdminSecurityGate.css';

interface AdminSecurityGateProps {
  isAuthenticated: boolean;
  isVerifyingSession?: boolean;
  onAuthenticate: () => void;
  onReturnToLanding: () => void;
  children: React.ReactNode;
}

export const AdminSecurityGate: React.FC<AdminSecurityGateProps> = ({
  isAuthenticated,
  isVerifyingSession = false,
  onAuthenticate,
  onReturnToLanding,
  children,
}) => {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // If already authenticated, render the protected dashboard immediately (no flicker!)
  if (isAuthenticated) {
    return <>{children}</>;
  }

  // If verifying session upon page reload, show clean spinner instead of glitching/flashing the login form
  if (isVerifyingSession) {
    return (
      <div className="admin-login-viewport" id="admin-login-verifying">
        <div className="admin-login-container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
          <div className="admin-login-top-pill" role="status">
            <span className="pill-dot" />
            <span className="pill-text">ADMIN CONTROL CENTER</span>
          </div>
          <div className="admin-login-card" style={{ padding: '48px 36px', textAlign: 'center', maxWidth: '420px', width: '100%', marginTop: '20px' }}>
            <div className="admin-login-brand-icon" style={{ margin: '0 auto 20px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="shield" size={32} />
            </div>
            <h2 className="admin-login-title" style={{ fontSize: '1.25rem', marginBottom: '8px', color: '#FFFFFF' }}>Verifying Admin Session</h2>
            <p className="admin-login-subtitle" style={{ fontSize: '0.85rem', color: '#8F9CAE', margin: 0 }}>Restoring secure dashboard access...</p>
          </div>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    setError(null);

    // Front-end validation for empty fields
    if (!identifier.trim()) {
      setError('Please enter your username or email.');
      return;
    }
    if (!password.trim()) {
      setError('Please enter your password.');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await authenticateAdmin(identifier, password);
      if (result.success) {
        onAuthenticate();
      } else {
        setError(result.error || 'Invalid credentials. Please verify your username and password.');
      }
    } catch {
      setError('An unexpected system error occurred. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="admin-login-viewport" id="admin-login-screen">
      {/* Decorative Constellation / Data Network Background Overlay */}
      <svg
        className="admin-login-bg-constellation"
        aria-hidden="true"
        viewBox="0 0 1440 900"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <circle cx="280" cy="240" r="2.5" fill="#8E233B" opacity="0.6" />
        <circle cx="340" cy="180" r="1.5" fill="#FFFFFF" opacity="0.4" />
        <circle cx="240" cy="360" r="1.5" fill="#FFFFFF" opacity="0.3" />
        <path d="M280 240L340 180M280 240L240 360" stroke="#FFFFFF" strokeWidth="1" strokeDasharray="3 3" opacity="0.12" />

        <circle cx="1140" cy="220" r="2.5" fill="#8E233B" opacity="0.6" />
        <circle cx="1060" cy="290" r="1.5" fill="#FFFFFF" opacity="0.4" />
        <circle cx="1190" cy="380" r="1.5" fill="#FFFFFF" opacity="0.3" />
        <path d="M1140 220L1060 290M1140 220L1190 380" stroke="#FFFFFF" strokeWidth="1" strokeDasharray="3 3" opacity="0.12" />

        <circle cx="280" cy="640" r="1.5" fill="#FFFFFF" opacity="0.3" />
        <circle cx="360" cy="720" r="2" fill="#8E233B" opacity="0.5" />
        <path d="M280 640L360 720" stroke="#FFFFFF" strokeWidth="1" strokeDasharray="3 3" opacity="0.1" />

        <circle cx="1120" cy="680" r="1.5" fill="#FFFFFF" opacity="0.3" />
        <circle cx="1200" cy="630" r="2" fill="#8E233B" opacity="0.5" />
        <path d="M1120 680L1200 630" stroke="#FFFFFF" strokeWidth="1" strokeDasharray="3 3" opacity="0.1" />
      </svg>

      {/* Main Container */}
      <div className="admin-login-container">
        {/* Top Header Pill Badge */}
        <div className="admin-login-top-pill" role="status">
          <span className="pill-dot" />
          <span className="pill-text">ADMIN CONTROL CENTER</span>
        </div>

        {/* Central Login Card */}
        <div className="admin-login-card">
          {/* Card Top Brand & Icon */}
          <div className="admin-login-header">
            <div className="admin-brand-icon-box">
              <Icon name="brain" size={24} className="admin-brand-brain-svg" />
            </div>

            <div className="admin-brand-title-row">
              <span className="admin-brand-name">BRAIN BYTES</span>
            </div>

            <h1 className="admin-card-heading">Admin Login</h1>
            <p className="admin-card-subheading">Sign in to manage the competition</p>
          </div>

          {/* Login Form */}
          <form className="admin-login-form" onSubmit={handleSubmit} noValidate>
            {/* Field 1: Username or Email */}
            <div className="admin-input-group">
              <div className="admin-input-label-row">
                <label htmlFor="admin-username-input" className="admin-input-label">
                  Username or Email
                </label>
              </div>
              <div className="admin-input-field-wrapper">
                <Icon name="id-card" size={16} className="admin-field-icon" />
                <input
                  id="admin-username-input"
                  name="username"
                  type="text"
                  autoComplete="username"
                  className="admin-text-input"
                  placeholder="Enter username or email"
                  value={identifier}
                  onChange={(e) => {
                    setIdentifier(e.target.value);
                    if (error) setError(null);
                  }}
                  disabled={isSubmitting}
                  required
                />
              </div>
            </div>

            {/* Field 2: Password with Show/Hide Toggle */}
            <div className="admin-input-group">
              <div className="admin-input-label-row">
                <label htmlFor="admin-password-input" className="admin-input-label">
                  Password
                </label>
              </div>
              <div className="admin-input-field-wrapper">
                <Icon name="key" size={16} className="admin-field-icon" />
                <input
                  id="admin-password-input"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  className="admin-text-input"
                  placeholder="Enter password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (error) setError(null);
                  }}
                  disabled={isSubmitting}
                  required
                />
                <button
                  type="button"
                  className="admin-password-toggle-btn"
                  onClick={() => setShowPassword((prev) => !prev)}
                  title={showPassword ? 'Hide password' : 'Show password'}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  tabIndex={0}
                >
                  <Icon name={showPassword ? 'eye-off' : 'eye'} size={16} />
                </button>
              </div>
            </div>

            {/* Error Notification Alert */}
            {error && (
              <div className="admin-login-error-alert" role="alert">
                <Icon name="alert-circle" size={15} className="error-alert-icon" />
                <span>{error}</span>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              className="admin-signin-btn"
              disabled={isSubmitting}
              id="admin-submit-btn"
            >
              {isSubmitting ? (
                <>
                  <span className="admin-btn-spinner" />
                  <span>AUTHENTICATING...</span>
                </>
              ) : (
                <>
                  <span>SIGN IN</span>
                  <Icon name="arrow-right" size={16} />
                </>
              )}
            </button>
          </form>

          {/* Card Footer Security Row */}
          <div className="admin-card-footer">
            <div className="admin-footer-security">
              <Icon name="lock" size={13} className="admin-footer-lock-icon" />
              <span>Encrypted Secure Session</span>
            </div>
          </div>
        </div>

        {/* Back to Home Link */}
        <button
          type="button"
          className="admin-back-home-btn"
          onClick={onReturnToLanding}
          id="admin-back-to-home"
        >
          <span className="back-arrow">←</span>
          <span>Back to Home</span>
        </button>
      </div>
    </div>
  );
};
