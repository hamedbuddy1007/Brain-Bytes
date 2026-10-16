import React, { useState, useEffect, useRef } from 'react';
import type { Participant } from '../types/competition';
import { MOCK_TEST_SAMPLE_DATA } from '../data/mockData';
import { Icon } from './Icon';

interface JoinModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeParticipant: Participant | null;
  onParticipantRegistered: (participant: Participant) => void;
  onClearParticipant: () => void;
  isRegistrationOpen: boolean;
  activeJoinCodes: string[];
}

interface FormState {
  fullName: string;
  rollNumber: string;
  joinCode: string;
  collegeName: string;
}

interface FormErrors {
  fullName?: string;
  rollNumber?: string;
  joinCode?: string;
}

export const JoinModal: React.FC<JoinModalProps> = ({
  isOpen,
  onClose,
  activeParticipant,
  onParticipantRegistered,
  onClearParticipant,
  isRegistrationOpen,
  activeJoinCodes,
}) => {
  const [formData, setFormData] = useState<FormState>({
    fullName: '',
    rollNumber: '',
    joinCode: '',
    collegeName: '',
  });

  const [errors, setErrors] = useState<FormErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copiedNotification, setCopiedNotification] = useState(false);

  const modalRef = useRef<HTMLDivElement>(null);
  const firstInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', handleKeyDown);
    if (!activeParticipant && isRegistrationOpen) {
      setTimeout(() => firstInputRef.current?.focus(), 100);
    }

    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, activeParticipant, isRegistrationOpen]);

  if (!isOpen) return null;

  const validateField = (name: keyof FormState, value: string): string | undefined => {
    const trimmed = value.trim();

    if (name === 'fullName') {
      if (!trimmed) return 'Full name is required';
      if (trimmed.length < 3) return 'Name must be at least 3 characters';
      if (!/^[a-zA-Z\s.'-]+$/.test(trimmed)) {
        return 'Please enter letters and spaces only';
      }
    }

    if (name === 'rollNumber') {
      if (!trimmed) return 'College roll number or participant ID is required';
      if (trimmed.length < 4) return 'Roll number must be at least 4 characters';
      if (!/^[a-zA-Z0-9\-_./]+$/.test(trimmed)) {
        return 'Roll number can only contain letters, numbers, and - / _';
      }
    }

    if (name === 'joinCode') {
      if (!trimmed) return 'Event join code is required';
      const upper = trimmed.toUpperCase();
      if (upper.length < 4) return 'Join code must be at least 4 characters';
      const isRecognized = activeJoinCodes.includes(upper);
      if (!isRecognized && !/^[A-Z0-9]{4,12}$/.test(upper)) {
        return `Invalid code. Authorized codes: ${activeJoinCodes.join(', ')}`;
      }
    }

    return undefined;
  };

  const handleBlur = (field: keyof FormState) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
    const errorMsg = validateField(field, formData[field]);
    setErrors((prev) => ({ ...prev, [field]: errorMsg }));
  };

  const handleChange = (field: keyof FormState, val: string) => {
    const processedVal = field === 'joinCode' ? val.toUpperCase() : val;
    setFormData((prev) => ({ ...prev, [field]: processedVal }));

    if (touched[field]) {
      const errorMsg = validateField(field, processedVal);
      setErrors((prev) => ({ ...prev, [field]: errorMsg }));
    }
  };

  const handleFillDemo = () => {
    const demo = MOCK_TEST_SAMPLE_DATA.defaultDemo;
    const defaultCode = activeJoinCodes[0] || demo.joinCode;
    setFormData({
      fullName: demo.fullName,
      rollNumber: demo.rollNumber,
      joinCode: defaultCode,
      collegeName: demo.collegeName,
    });
    setErrors({});
    setTouched({
      fullName: true,
      rollNumber: true,
      joinCode: true,
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!isRegistrationOpen) return;

    const nameErr = validateField('fullName', formData.fullName);
    const rollErr = validateField('rollNumber', formData.rollNumber);
    const codeErr = validateField('joinCode', formData.joinCode);

    setTouched({
      fullName: true,
      rollNumber: true,
      joinCode: true,
    });

    if (nameErr || rollErr || codeErr) {
      setErrors({
        fullName: nameErr,
        rollNumber: rollErr,
        joinCode: codeErr,
      });
      return;
    }

    setIsSubmitting(true);

    setTimeout(() => {
      const randomSeed = Math.floor(1000 + Math.random() * 9000);
      const deskNum = Math.floor(1 + Math.random() * 60);

      const newParticipant: Participant = {
        fullName: formData.fullName.trim(),
        rollNumber: formData.rollNumber.trim().toUpperCase(),
        joinCode: formData.joinCode.trim().toUpperCase(),
        collegeName: formData.collegeName.trim() || 'Department of Computing & Data Sciences',
        registeredAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        ticketId: `DM-BB-${randomSeed}`,
        assignedSeat: `Auditorium Hall B • Desk #${deskNum}`,
        status: 'verified',
      };

      onParticipantRegistered(newParticipant);
      setIsSubmitting(false);
    }, 350);
  };

  const handleCopyPass = () => {
    if (!activeParticipant) return;
    const text = `DATA MANIA × BRAIN BYTES ARENA PASS\nParticipant: ${activeParticipant.fullName}\nRoll/ID: ${activeParticipant.rollNumber}\nJoin Code: ${activeParticipant.joinCode}\nAssigned Station: ${activeParticipant.assignedSeat}\nPass ID: ${activeParticipant.ticketId}\nStatus: Verified in Tournament Lobby`;

    navigator.clipboard.writeText(text).then(() => {
      setCopiedNotification(true);
      setTimeout(() => setCopiedNotification(false), 2500);
    });
  };

  return (
    <div
      className="modal-backdrop"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      role="presentation"
    >
      <div
        className="join-modal-container solar-modal"
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-headline"
      >
        <button
          type="button"
          className="modal-close-btn"
          onClick={onClose}
          aria-label="Close dialog"
        >
          <Icon name="close" size={20} />
        </button>

        {/* VIEW A: Verified Participant Admit Pass / Lobby */}
        {activeParticipant ? (
          <div className="participant-pass-view">
            <div className="pass-status-header">
              <div className="pass-badge-solar">
                <Icon name="check-circle" size={16} className="text-molten" />
                <span>Verified Candidate Active</span>
              </div>
              <span className="pass-timestamp text-muted">Check-in: {activeParticipant.registeredAt}</span>
            </div>

            <div className="digital-admit-card solar-admit-card">
              <div className="card-flame-accent" />

              <div className="card-top-row">
                <div className="card-event-brand">
                  <div className="solar-badge-sm">
                    <Icon name="flame" size={18} className="text-molten" />
                  </div>
                  <div>
                    <span className="card-brand-name">DATA MANIA</span>
                    <span className="card-brand-sub">BRAIN BYTES • ADMIT VOUCHER</span>
                  </div>
                </div>
                <div className="card-barcode-box">
                  <div className="barcode-bars-dark" />
                  <span className="barcode-code text-gold">{activeParticipant.ticketId}</span>
                </div>
              </div>

              <div className="card-divider-dashed" />

              <div className="card-details-grid">
                <div className="detail-field">
                  <span className="detail-label">Competitor Name</span>
                  <span className="detail-value highlight text-warm-white">{activeParticipant.fullName}</span>
                </div>

                <div className="detail-field">
                  <span className="detail-label">Roll No / ID</span>
                  <span className="detail-value mono-val text-solar">{activeParticipant.rollNumber}</span>
                </div>

                <div className="detail-field">
                  <span className="detail-label">Authorized Join Code</span>
                  <span className="detail-value code-pill">{activeParticipant.joinCode}</span>
                </div>

                <div className="detail-field">
                  <span className="detail-label">Workstation Desk</span>
                  <span className="detail-value text-gold font-bold">{activeParticipant.assignedSeat}</span>
                </div>

                <div className="detail-field full-row">
                  <span className="detail-label">Department / School</span>
                  <span className="detail-value text-muted">{activeParticipant.collegeName}</span>
                </div>
              </div>

              <div className="card-bottom-banner solar-banner">
                <div className="lobby-indicator">
                  <span className="live-dot-solar" />
                  <span>Competition Lobby Active • Waiting for Host Round Signals</span>
                </div>
              </div>
            </div>

            {copiedNotification && (
              <div className="copy-alert solar-copy-alert" role="status">
                <Icon name="check-circle" size={16} />
                <span>Voucher details copied to clipboard!</span>
              </div>
            )}

            <div className="pass-actions-row">
              <button
                type="button"
                className="btn btn-secondary flex-1"
                onClick={handleCopyPass}
              >
                <Icon name="copy" size={16} />
                <span>{copiedNotification ? 'Copied!' : 'Copy Voucher'}</span>
              </button>

              <button
                type="button"
                className="btn btn-primary flex-1"
                onClick={onClose}
              >
                <Icon name="zap" size={16} />
                <span>Enter Arena</span>
              </button>
            </div>

            <div className="pass-footer-note">
              <span>Need to switch student credentials?</span>
              <button
                type="button"
                className="link-btn text-solar"
                onClick={() => {
                  onClearParticipant();
                  setFormData({ fullName: '', rollNumber: '', joinCode: '', collegeName: '' });
                  setErrors({});
                  setTouched({});
                }}
              >
                Register another competitor
              </button>
            </div>

            <p className="local-state-disclaimer">
              ℹ️ <em>Session held in browser memory for local competition evaluation.</em>
            </p>
          </div>
        ) : (
          /* VIEW B: Registration / Join Screen */
          <div className="join-form-view">
            <div className="modal-header-area">
              <div className="modal-title-pill solar-pill">
                <Icon name="flame" size={13} className="text-molten" />
                <span>DATA MANIA CANDIDATE PORTAL</span>
              </div>
              <h2 id="modal-headline" className="modal-headline">
                Register for <span className="text-molten">BRAIN BYTES</span>
              </h2>
              <p className="modal-subhead text-muted">
                Enter your student credentials and authorized event join code to access the competition arena.
              </p>
            </div>

            {/* If Registration is Paused by Host */}
            {!isRegistrationOpen ? (
              <div className="registration-closed-alert">
                <Icon name="lock" size={24} className="text-molten" />
                <div>
                  <h4>Registration Currently Paused</h4>
                  <p>
                    The event hosts have paused candidate check-ins in the Admin Console. Please
                    wait for the live auditorium announcement before joining.
                  </p>
                </div>
              </div>
            ) : (
              <>
                {/* Quick Demo Autofill Banner */}
                <div className="quick-demo-banner solar-demo-banner">
                  <div className="demo-text">
                    <Icon name="sparkles" size={15} className="text-gold" />
                    <span>Evaluation mode: 1-click test credential population</span>
                  </div>
                  <button
                    type="button"
                    className="demo-fill-btn solar-fill-btn"
                    onClick={handleFillDemo}
                  >
                    Fill Demo Data
                  </button>
                </div>

                <form onSubmit={handleSubmit} noValidate className="join-form">
                  {/* Field 1: Full Name */}
                  <div className={`form-group ${touched.fullName && errors.fullName ? 'has-error' : ''} ${touched.fullName && !errors.fullName ? 'is-valid' : ''}`}>
                    <label htmlFor="student-full-name" className="form-label">
                      Student Full Name <span className="required-star">*</span>
                    </label>
                    <div className="input-wrapper">
                      <input
                        ref={firstInputRef}
                        id="student-full-name"
                        name="fullName"
                        type="text"
                        className="form-input solar-input"
                        placeholder="e.g. Aarav Sharma"
                        value={formData.fullName}
                        onChange={(e) => handleChange('fullName', e.target.value)}
                        onBlur={() => handleBlur('fullName')}
                        autoComplete="name"
                        aria-required="true"
                        aria-invalid={touched.fullName && !!errors.fullName}
                      />
                      <div className="input-feedback-icon">
                        {touched.fullName && !errors.fullName && (
                          <Icon name="check-circle" size={16} className="valid-icon" />
                        )}
                        {touched.fullName && errors.fullName && (
                          <Icon name="alert-circle" size={16} className="invalid-icon" />
                        )}
                      </div>
                    </div>
                    {touched.fullName && errors.fullName && (
                      <p className="field-error-msg" role="alert">
                        <Icon name="alert-circle" size={13} />
                        <span>{errors.fullName}</span>
                      </p>
                    )}
                  </div>

                  {/* Field 2: Roll Number */}
                  <div className={`form-group ${touched.rollNumber && errors.rollNumber ? 'has-error' : ''} ${touched.rollNumber && !errors.rollNumber ? 'is-valid' : ''}`}>
                    <label htmlFor="student-roll-number" className="form-label">
                      College Roll Number / Participant ID <span className="required-star">*</span>
                    </label>
                    <div className="input-wrapper">
                      <input
                        id="student-roll-number"
                        name="rollNumber"
                        type="text"
                        className="form-input solar-input mono-font"
                        placeholder="e.g. CS23-B1042"
                        value={formData.rollNumber}
                        onChange={(e) => handleChange('rollNumber', e.target.value)}
                        onBlur={() => handleBlur('rollNumber')}
                        autoComplete="off"
                        aria-required="true"
                        aria-invalid={touched.rollNumber && !!errors.rollNumber}
                      />
                      <div className="input-feedback-icon">
                        {touched.rollNumber && !errors.rollNumber && (
                          <Icon name="check-circle" size={16} className="valid-icon" />
                        )}
                        {touched.rollNumber && errors.rollNumber && (
                          <Icon name="alert-circle" size={16} className="invalid-icon" />
                        )}
                      </div>
                    </div>
                    {touched.rollNumber && errors.rollNumber && (
                      <p className="field-error-msg" role="alert">
                        <Icon name="alert-circle" size={13} />
                        <span>{errors.rollNumber}</span>
                      </p>
                    )}
                  </div>

                  {/* Field 3: Join Code */}
                  <div className={`form-group ${touched.joinCode && errors.joinCode ? 'has-error' : ''} ${touched.joinCode && !errors.joinCode ? 'is-valid' : ''}`}>
                    <div className="label-with-hint">
                      <label htmlFor="competition-join-code" className="form-label">
                        Event Join Code <span className="required-star">*</span>
                      </label>
                      <span className="code-hint-badge solar-hint">
                        Code: <strong>{activeJoinCodes[0] || 'BYTE2026'}</strong>
                      </span>
                    </div>
                    <div className="input-wrapper">
                      <input
                        id="competition-join-code"
                        name="joinCode"
                        type="text"
                        className="form-input solar-input mono-font"
                        placeholder={activeJoinCodes[0] || 'BYTE2026'}
                        value={formData.joinCode}
                        onChange={(e) => handleChange('joinCode', e.target.value)}
                        onBlur={() => handleBlur('joinCode')}
                        autoComplete="off"
                        aria-required="true"
                        aria-invalid={touched.joinCode && !!errors.joinCode}
                      />
                      <div className="input-feedback-icon">
                        {touched.joinCode && !errors.joinCode && (
                          <Icon name="check-circle" size={16} className="valid-icon" />
                        )}
                        {touched.joinCode && errors.joinCode && (
                          <Icon name="alert-circle" size={16} className="invalid-icon" />
                        )}
                      </div>
                    </div>
                    {touched.joinCode && errors.joinCode && (
                      <p className="field-error-msg" role="alert">
                        <Icon name="alert-circle" size={13} />
                        <span>{errors.joinCode}</span>
                      </p>
                    )}
                  </div>

                  {/* Field 4: College / Dept */}
                  <div className="form-group">
                    <label htmlFor="student-college-name" className="form-label">
                      Department / College <span className="optional-tag">(Optional)</span>
                    </label>
                    <div className="input-wrapper">
                      <input
                        id="student-college-name"
                        name="collegeName"
                        type="text"
                        className="form-input solar-input"
                        placeholder="e.g. School of Computing & AI"
                        value={formData.collegeName}
                        onChange={(e) => handleChange('collegeName', e.target.value)}
                      />
                    </div>
                  </div>

                  {/* Submit CTA */}
                  <div className="form-actions-area">
                    <button
                      type="submit"
                      className="btn btn-primary btn-lg w-full submit-join-btn"
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? (
                        <span>Authorizing Credentials...</span>
                      ) : (
                        <>
                          <Icon name="terminal" size={18} />
                          <span>Enter Data Mania Arena</span>
                          <Icon name="arrow-right" size={16} />
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </>
            )}

            <div className="form-modal-footer">
              <Icon name="shield" size={14} className="text-solar" />
              <span>Host-synchronized access control • Local session evaluation</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
