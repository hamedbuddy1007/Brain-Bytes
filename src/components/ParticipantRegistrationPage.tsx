import React, { useState, useEffect } from 'react';
import { Icon } from './Icon';
import { apiRequest } from '../services/apiClient';

interface ParticipantRegistrationPageProps {
  onBackToHome: () => void;
  onProceedToArena: (accessCode: string) => void;
}

type RegistrationStep = 'form' | 'waiting' | 'approved';

const DEPARTMENTS = ['CSE', 'CSM', 'CSD', 'ECE', 'ME', 'CIVIL'];
const YEARS = ['1st Year', '2nd Year', '3rd Year', '4th Year'];

export const ParticipantRegistrationPage: React.FC<ParticipantRegistrationPageProps> = ({
  onBackToHome,
  onProceedToArena,
}) => {
  // Always initialize with fresh, completely empty values on every new registration
  const [fullName, setFullName] = useState('');
  const [rollNumber, setRollNumber] = useState('');
  const [department, setDepartment] = useState('');
  const [yearOfStudy, setYearOfStudy] = useState('');

  const [step, setStep] = useState<RegistrationStep>('form');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Status polling data
  const [registeredRoll, setRegisteredRoll] = useState('');
  const [approvedAccessCode, setApprovedAccessCode] = useState<string | null>(null);
  const [hasCopied, setHasCopied] = useState(false);

  // Poll registration approval status when in 'waiting' step
  useEffect(() => {
    if (step !== 'waiting' || !registeredRoll) return;

    let isMounted = true;
    const checkStatus = async () => {
      try {
        let regToken: string | null = null;
        try {
          regToken = sessionStorage.getItem(`bb_reg_token_${registeredRoll}`);
        } catch {}

        const res = await apiRequest<{
          fullName: string;
          rollNumber: string;
          approvalStatus: 'PENDING' | 'APPROVED' | 'REJECTED';
          accessCode: string | null;
        }>(`/participants/registration-status/${encodeURIComponent(registeredRoll)}`, {
          headers: regToken ? { 'x-registration-token': regToken } : undefined,
        });

        if (!isMounted) return;

        if (res?.approvalStatus === 'APPROVED' && res?.accessCode) {
          setApprovedAccessCode(res.accessCode);
          setStep('approved');
        } else if (res?.approvalStatus === 'REJECTED') {
          setErrorMessage('Your registration was not approved by the event proctors. Please contact an administrator.');
          setStep('form');
        }
      } catch {
        // Silently tolerate polling errors
      }
    };

    // Immediate check + interval every 2.5 seconds
    void checkStatus();
    const interval = setInterval(checkStatus, 2500);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [step, registeredRoll]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const trimmedName = fullName.trim();
    const trimmedRoll = rollNumber.trim().toUpperCase();

    if (!trimmedName || trimmedName.length < 2) {
      setErrorMessage('Please provide your full legal name (minimum 2 characters).');
      return;
    }
    if (!trimmedRoll || trimmedRoll.length < 1) {
      setErrorMessage('Please enter your valid Roll Number / Hall Ticket ID.');
      return;
    }
    if (!department) {
      setErrorMessage('Please select your department.');
      return;
    }
    if (!yearOfStudy) {
      setErrorMessage('Please select your year of study.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await apiRequest<{
        status: string;
        approvalStatus?: string;
        rollNumber: string;
        accessCode?: string | null;
        registrationToken?: string;
        message?: string;
      }>('/participants/register', {
        method: 'POST',
        body: JSON.stringify({
          fullName: trimmedName,
          rollNumber: trimmedRoll,
          department,
          yearOfStudy,
        }),
      });

      setRegisteredRoll(trimmedRoll);
      if (res?.registrationToken) {
        try {
          sessionStorage.setItem(`bb_reg_token_${trimmedRoll}`, res.registrationToken);
        } catch {}
      }

      if (res?.approvalStatus === 'APPROVED' && res?.accessCode) {
        setApprovedAccessCode(res.accessCode);
        setStep('approved');
      } else {
        setStep('waiting');
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Registration failed. Please check your details and try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyCode = async () => {
    if (!approvedAccessCode) return;
    try {
      await navigator.clipboard.writeText(approvedAccessCode);
      setHasCopied(true);
      setTimeout(() => setHasCopied(false), 2500);
    } catch {
      // Fallback
    }
  };

  return (
    <div className="registration-page-root" id="participant-registration-page">
      {/* Background ambient solar flair */}
      <div className="landing-ambient-flare" aria-hidden="true" />

      {/* Top Header Bar */}
      <header className="reg-top-bar">
        <button
          type="button"
          onClick={onBackToHome}
          className="btn-back-home"
          id="btn-back-home"
        >
          <Icon name="arrow-left" size={16} />
          <span>Back to Arena Home</span>
        </button>

        <button
          type="button"
          onClick={onBackToHome}
          className="reg-header-brand-btn"
          id="btn-reg-brand-home"
          title="Brain Bytes - Return to Landing Page"
        >
          <img
            src="/brand-logo.png"
            alt="Brain Bytes Logo"
            className="reg-brand-logo-img"
          />
          <div className="reg-brand-text-block">
            <span className="brand-kicker">DATA MANIA</span>
            <span className="brand-name">BRAIN BYTES</span>
          </div>
        </button>
      </header>

      <main className="reg-content-container">
        {/* STEP 1: FRESH REGISTRATION FORM */}
        {step === 'form' && (
          <div className="reg-card-wrapper animate-fadeIn">
            <div className="reg-card-header">
              <div className="reg-icon-badge">
                <Icon name="user-check" size={26} />
              </div>
              <h1 className="reg-title">Candidate Roster Registration</h1>
              <p className="reg-subtitle">
                Enter your official student credentials. Once submitted, the administrator will verify your desk and issue your unique access code.
              </p>
            </div>

            {errorMessage && (
              <div className="reg-alert-error" role="alert">
                <Icon name="alert-circle" size={18} />
                <span>{errorMessage}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="reg-form" autoComplete="off">
              {/* Full Name */}
              <div className="reg-form-group">
                <label htmlFor="reg-full-name" className="reg-label">
                  Full Name <span className="req-star">*</span>
                </label>
                <div className="reg-input-wrapper">
                  <Icon name="user" size={17} className="reg-input-icon" />
                  <input
                    id="reg-full-name"
                    type="text"
                    required
                    placeholder="Enter your full name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="reg-input"
                    autoFocus
                  />
                </div>
              </div>

              {/* Roll Number */}
              <div className="reg-form-group">
                <label htmlFor="reg-roll-number" className="reg-label">
                  Roll Number / Hall Ticket <span className="req-star">*</span>
                </label>
                <div className="reg-input-wrapper">
                  <Icon name="hash" size={17} className="reg-input-icon" />
                  <input
                    id="reg-roll-number"
                    type="text"
                    required
                    placeholder="Enter roll number / hall ticket ID"
                    value={rollNumber}
                    onChange={(e) => setRollNumber(e.target.value.toUpperCase())}
                    className="reg-input uppercase-text"
                  />
                </div>
              </div>

              {/* Department & Year of Study Grid */}
              <div className="reg-grid-row">
                <div className="reg-form-group">
                  <label htmlFor="reg-dept" className="reg-label">
                    Department <span className="req-star">*</span>
                  </label>
                  <div className="reg-input-wrapper">
                    <Icon name="book" size={17} className="reg-input-icon" />
                    <select
                      id="reg-dept"
                      required
                      value={department}
                      onChange={(e) => setDepartment(e.target.value)}
                      className="reg-select"
                    >
                      <option value="" disabled>
                        Select Department
                      </option>
                      {DEPARTMENTS.map((dept) => (
                        <option key={dept} value={dept}>
                          {dept}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="reg-form-group">
                  <label htmlFor="reg-year" className="reg-label">
                    Year of Study <span className="req-star">*</span>
                  </label>
                  <div className="reg-input-wrapper">
                    <Icon name="calendar" size={17} className="reg-input-icon" />
                    <select
                      id="reg-year"
                      required
                      value={yearOfStudy}
                      onChange={(e) => setYearOfStudy(e.target.value)}
                      className="reg-select"
                    >
                      <option value="" disabled>
                        Select Year of Study
                      </option>
                      {YEARS.map((yr) => (
                        <option key={yr} value={yr}>
                          {yr}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="btn-submit-registration"
                id="btn-submit-registration"
              >
                {isSubmitting ? (
                  <>
                    <span className="spinner-border spinner-sm" />
                    <span>Transmitting Registration...</span>
                  </>
                ) : (
                  <>
                    <span>Submit Registration & Request Access</span>
                    <Icon name="arrow-right" size={18} />
                  </>
                )}
              </button>
            </form>
          </div>
        )}

        {/* STEP 2: WAITING FOR HOST / ADMIN APPROVAL */}
        {step === 'waiting' && (
          <div className="reg-card-wrapper waiting-card animate-fadeIn">
            <div className="waiting-radar-container">
              <div className="waiting-radar-pulse" />
              <div className="waiting-radar-pulse pulse-delay-1" />
              <div className="waiting-radar-icon">
                <Icon name="shield" size={36} />
              </div>
            </div>

            <div className="waiting-header">
              <span className="waiting-status-pill">
                <span className="active-pulse-dot" />
                <span>AWAITING ADMIN APPROVAL</span>
              </span>
              <h2 className="waiting-title">Registration Submitted</h2>
              <p className="waiting-desc">
                Please wait on this screen. The event administrator is reviewing and approving participant stations. Your access code will appear here automatically in real time.
              </p>
            </div>

            <div className="waiting-candidate-details">
              <div className="detail-item">
                <span className="detail-label">CANDIDATE</span>
                <span className="detail-value">{fullName}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">ROLL NUMBER</span>
                <span className="detail-value">{registeredRoll}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">DEPARTMENT / YEAR</span>
                <span className="detail-value">{department} • {yearOfStudy}</span>
              </div>
            </div>

            <div className="waiting-polling-indicator">
              <div className="polling-bars">
                <span className="p-bar bar-1" />
                <span className="p-bar bar-2" />
                <span className="p-bar bar-3" />
                <span className="p-bar bar-4" />
              </div>
              <span>Listening for administrator verification signal...</span>
            </div>
          </div>
        )}

        {/* STEP 3: REGISTRATION APPROVED - SHOW UNIQUE ACCESS CODE */}
        {step === 'approved' && approvedAccessCode && (
          <div className="reg-card-wrapper approved-card animate-fadeIn">
            <div className="approved-icon-container">
              <div className="approved-check-ring">
                <Icon name="check" size={38} />
              </div>
            </div>

            <div className="approved-header">
              <span className="approved-status-pill">
                <Icon name="check-circle" size={14} />
                <span>APPROVAL VERIFIED</span>
              </span>
              <h2 className="approved-title">Welcome, {fullName}!</h2>
              <p className="approved-desc">
                Your registration has been accepted by the administrator. Use your unique Access Code below to enter the competition arena.
              </p>
            </div>

            {/* Glowing Access Code Box */}
            <div className="access-code-hero-box">
              <div className="code-label-top">YOUR UNIQUE ARENA ACCESS CODE</div>
              <div className="code-display-value" id="approved-access-code">
                {approvedAccessCode}
              </div>
              <div className="code-hint-bottom">Keep this code handy. It is required to log in to all rounds.</div>

              <button
                type="button"
                onClick={handleCopyCode}
                className={`btn-copy-code ${hasCopied ? 'is-copied' : ''}`}
                id="btn-copy-access-code"
              >
                <Icon name={hasCopied ? 'check' : 'copy'} size={16} />
                <span>{hasCopied ? 'Access Code Copied!' : 'Copy Access Code'}</span>
              </button>
            </div>

            <div className="approved-actions">
              <button
                type="button"
                onClick={() => onProceedToArena(approvedAccessCode)}
                className="btn-enter-arena-now"
                id="btn-enter-arena-now"
              >
                <span>Enter Competition Arena</span>
                <Icon name="arrow-right" size={20} />
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
