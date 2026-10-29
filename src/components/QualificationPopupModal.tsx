import React from 'react';
import { Icon } from './Icon';
import type { RoundQualificationInfo, RoundStatus } from '../types/competition';

interface QualificationPopupModalProps {
  isOpen: boolean;
  participantName: string;
  rollNumber: string;
  qualification: RoundQualificationInfo | null;
  targetRoundStatus?: RoundStatus;
  onClose: () => void;
  onProceedToNextRound?: (targetRound: number) => void;
}

const ROUND_TITLES: Record<number, { title: string; subtitle: string }> = {
  1: { title: 'Data Blitz — Rapid MCQ', subtitle: 'Foundation Stage' },
  2: { title: 'Visualizing Visionaries — Graph & Insight', subtitle: 'Semi-Final Analytical Stage' },
  3: { title: 'Grand Finale — Rapid Fire Showdown', subtitle: 'Championship Stage' },
};

export const QualificationPopupModal: React.FC<QualificationPopupModalProps> = ({
  isOpen,
  participantName,
  rollNumber,
  qualification,
  targetRoundStatus = 'locked',
  onClose,
  onProceedToNextRound,
}) => {
  if (!isOpen || !qualification) return null;

  const {
    sourceRound,
    targetRound,
    status,
    score,
  } = qualification;

  const targetMeta = ROUND_TITLES[targetRound] || {
    title: `Round ${targetRound}`,
    subtitle: 'Next Stage',
  };

  const isQualified = status === 'QUALIFIED';
  const isNotQualified = status === 'NOT_QUALIFIED';
  const isAwaiting = status === 'AWAITING_DECISION';

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10000,
        backgroundColor: 'rgba(9, 12, 20, 0.82)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        animation: 'fadeIn 0.22s ease-out',
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="qualification-modal-title"
    >
      <div
        style={{
          background: 'linear-gradient(180deg, rgba(18, 22, 36, 0.98) 0%, rgba(12, 14, 24, 0.99) 100%)',
          borderRadius: '20px',
          maxWidth: '540px',
          width: '100%',
          maxHeight: '92dvh',
          overflowY: 'auto',
          border: isQualified
            ? '1.5px solid rgba(16, 185, 129, 0.5)'
            : isNotQualified
              ? '1.5px solid rgba(239, 68, 68, 0.5)'
              : '1.5px solid rgba(245, 158, 11, 0.5)',
          boxShadow: isQualified
            ? '0 25px 60px -12px rgba(16, 185, 129, 0.35), 0 0 0 1px rgba(16, 185, 129, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.12)'
            : isNotQualified
              ? '0 25px 60px -12px rgba(239, 68, 68, 0.35), 0 0 0 1px rgba(239, 68, 68, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.12)'
              : '0 25px 60px -12px rgba(245, 158, 11, 0.3), 0 0 0 1px rgba(245, 158, 11, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.12)',
          fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif",
          color: '#FFFFFF',
        }}
      >
        {/* Top Accent Banner */}
        <div
          style={{
            padding: 'clamp(20px, 4vw, 28px) clamp(16px, 4vw, 28px) 22px',
            background: isQualified
              ? 'linear-gradient(135deg, rgba(6, 78, 59, 0.9) 0%, rgba(5, 150, 105, 0.78) 55%, rgba(4, 120, 87, 0.9) 100%)'
              : isNotQualified
                ? 'linear-gradient(135deg, rgba(127, 29, 29, 0.92) 0%, rgba(185, 28, 28, 0.8) 55%, rgba(142, 35, 59, 0.92) 100%)'
                : 'linear-gradient(135deg, rgba(120, 53, 15, 0.92) 0%, rgba(180, 83, 9, 0.8) 55%, rgba(146, 64, 14, 0.92) 100%)',
            borderBottom: isQualified
              ? '1px solid rgba(52, 211, 153, 0.35)'
              : isNotQualified
                ? '1px solid rgba(248, 113, 113, 0.35)'
                : '1px solid rgba(251, 191, 36, 0.35)',
            color: '#FFFFFF',
            position: 'relative',
            textAlign: 'center',
          }}
        >
          {/* Status Pill */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '5px 14px',
              borderRadius: '999px',
              background: 'rgba(12, 14, 24, 0.45)',
              border: '1px solid rgba(255, 255, 255, 0.28)',
              fontSize: '11px',
              fontWeight: 800,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              marginBottom: '16px',
              color: isQualified ? '#A7F3D0' : isNotQualified ? '#FECACA' : '#FDE68A',
            }}
          >
            <Icon
              name={isQualified ? 'award' : isNotQualified ? 'shield' : 'clock'}
              size={13}
            />
            <span>
              {isQualified
                ? `Official Selection — Round ${targetRound} Qualifier`
                : isNotQualified
                  ? `Official Round ${sourceRound} Qualification Result`
                  : `Qualification Verification In Progress`}
            </span>
          </div>

          {/* Center Icon */}
          <div
            style={{
              width: '68px',
              height: '68px',
              borderRadius: '50%',
              background: 'rgba(12, 14, 24, 0.38)',
              border: '2px solid rgba(255, 255, 255, 0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 14px',
              boxShadow: '0 8px 24px rgba(0, 0, 0, 0.35)',
              color: isQualified ? '#34D399' : isNotQualified ? '#FCA5A5' : '#FBBF24',
            }}
          >
            <Icon
              name={isQualified ? 'trophy' : isNotQualified ? 'x-circle' : 'clock'}
              size={34}
            />
          </div>

          <h2
            id="qualification-modal-title"
            style={{
              margin: '0 0 6px',
              fontSize: '22px',
              fontWeight: 800,
              lineHeight: 1.25,
              letterSpacing: '-0.02em',
              color: '#FFFFFF',
            }}
          >
            {isQualified
              ? `Congratulations! You Are Selected for Round ${targetRound}!`
              : isNotQualified
                ? `You Have Not Qualified for Round ${targetRound}`
                : `Awaiting Round ${targetRound} Qualification Results`}
          </h2>

          <p
            style={{
              margin: 0,
              fontSize: '13.5px',
              color: '#E2E8F0',
              fontWeight: 600,
            }}
          >
            {participantName} • <span style={{ fontFamily: "'JetBrains Mono', monospace", color: '#F8FAFC' }}>{rollNumber}</span>
          </p>
        </div>

        {/* Body Content */}
        <div style={{ padding: 'clamp(18px, 4vw, 24px) clamp(16px, 4vw, 28px) clamp(20px, 4vw, 28px)' }}>
          {/* Score & Metrics Summary Strip */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(115px, 1fr))',
              gap: '10px',
              marginBottom: '20px',
            }}
          >
            <div
              style={{
                background: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                borderRadius: '12px',
                padding: '12px 14px',
                textAlign: 'center',
              }}
            >
              <div
                style={{
                  fontSize: '10px',
                  fontWeight: 800,
                  color: '#94A3B8',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  marginBottom: '4px',
                }}
              >
                Round {sourceRound} Score
              </div>
              <div
                style={{
                  fontSize: '20px',
                  fontWeight: 800,
                  color: '#FFFFFF',
                  fontFamily: "'JetBrains Mono', monospace",
                }}
              >
                {score !== null && score !== undefined ? `${score} PTS` : 'Recorded'}
              </div>
            </div>

            <div
              style={{
                background: isQualified
                  ? 'rgba(16, 185, 129, 0.14)'
                  : isNotQualified
                    ? 'rgba(239, 68, 68, 0.14)'
                    : 'rgba(245, 158, 11, 0.14)',
                border: `1px solid ${
                  isQualified
                    ? 'rgba(16, 185, 129, 0.4)'
                    : isNotQualified
                      ? 'rgba(239, 68, 68, 0.4)'
                      : 'rgba(245, 158, 11, 0.4)'
                }`,
                borderRadius: '12px',
                padding: '12px 14px',
                textAlign: 'center',
              }}
            >
              <div
                style={{
                  fontSize: '10px',
                  fontWeight: 800,
                  color: isQualified ? '#6EE7B7' : isNotQualified ? '#FCA5A5' : '#FDE68A',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  marginBottom: '4px',
                }}
              >
                Decision Status
              </div>
              <div
                style={{
                  fontSize: '14px',
                  fontWeight: 800,
                  color: isQualified ? '#34D399' : isNotQualified ? '#F87171' : '#FBBF24',
                  marginTop: '3px',
                }}
              >
                {isQualified
                  ? 'SELECTED ✓'
                  : isNotQualified
                    ? 'NOT SELECTED'
                    : 'PENDING'}
              </div>
            </div>
          </div>

          {/* Detailed Message Card */}
          <div
            style={{
              background: isQualified
                ? 'rgba(16, 185, 129, 0.1)'
                : isNotQualified
                  ? 'rgba(239, 68, 68, 0.1)'
                  : 'rgba(245, 158, 11, 0.1)',
              border: `1px solid ${
                isQualified
                  ? 'rgba(16, 185, 129, 0.35)'
                  : isNotQualified
                    ? 'rgba(239, 68, 68, 0.35)'
                    : 'rgba(245, 158, 11, 0.35)'
              }`,
              borderRadius: '14px',
              padding: '16px 18px',
              marginBottom: '22px',
              color: '#F1F5F9',
              fontSize: '14px',
              lineHeight: 1.6,
            }}
          >
            {isQualified && (
              <>
                <div style={{ fontWeight: 800, color: '#34D399', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Icon name="check-circle" size={17} />
                  <span>Unlocked Stage: {targetMeta.title}</span>
                </div>
                <p style={{ margin: 0, color: '#E2E8F0', fontSize: '13.5px' }}>
                  Based on your Round {sourceRound} performance, you have officially qualified to advance to{' '}
                  <strong style={{ color: '#FFFFFF' }}>Round {targetRound}</strong>.{' '}
                  {targetRoundStatus === 'active'
                    ? `Round ${targetRound} is currently LIVE — you may enter the stage immediately!`
                    : `Proceed to the Round ${targetRound} stage cockpit and stand by for the administrator to start the timer.`}
                </p>
              </>
            )}

            {isNotQualified && (
              <>
                <div style={{ fontWeight: 800, color: '#FCA5A5', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Icon name="alert-circle" size={17} />
                  <span>Elimination Cutoff Applied for Round {targetRound}</span>
                </div>
                <p style={{ margin: 0, color: '#E2E8F0', fontSize: '13.5px' }}>
                  Thank you for competing in <strong style={{ color: '#FFFFFF' }}>Round {sourceRound}</strong> of Data Mania: Brain Bytes. You have not qualified to progress to{' '}
                  <strong style={{ color: '#FFFFFF' }}>Round {targetRound} ({targetMeta.title})</strong>. Your Round {sourceRound} score has been permanently recorded in the tournament database.
                </p>
              </>
            )}

            {isAwaiting && (
              <>
                <div style={{ fontWeight: 800, color: '#FDE68A', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Icon name="clock" size={17} />
                  <span>Administrator Qualification Cutoff Pending</span>
                </div>
                <p style={{ margin: 0, color: '#E2E8F0', fontSize: '13.5px' }}>
                  Your <strong style={{ color: '#FFFFFF' }}>Round {sourceRound}</strong> submission is safely recorded. Progression to{' '}
                  <strong style={{ color: '#FFFFFF' }}>Round {targetRound}</strong> is restricted until the tournament administrator executes the official qualification cutoff. You will automatically see your selection result here as soon as it is published.
                </p>
              </>
            )}
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            {isQualified && onProceedToNextRound ? (
              <>
                <button
                  type="button"
                  onClick={onClose}
                  style={{
                    padding: '12px 18px',
                    borderRadius: '10px',
                    border: '1px solid rgba(255, 255, 255, 0.18)',
                    background: 'rgba(255, 255, 255, 0.06)',
                    color: '#E2E8F0',
                    fontSize: '13.5px',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  Stay on Current Screen
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onProceedToNextRound(targetRound);
                  }}
                  style={{
                    flex: 1,
                    padding: '12px 20px',
                    borderRadius: '10px',
                    border: '1px solid rgba(52, 211, 153, 0.4)',
                    background: 'linear-gradient(135deg, #059669, #10B981)',
                    color: '#FFFFFF',
                    fontSize: '14px',
                    fontWeight: 800,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    boxShadow: '0 6px 18px rgba(16, 185, 129, 0.35)',
                  }}
                >
                  <span>
                    {targetRoundStatus === 'active'
                      ? `Launch Round ${targetRound} Now`
                      : `Proceed to Round ${targetRound} Stage`}
                  </span>
                  <Icon name="arrow-right" size={17} />
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={onClose}
                style={{
                  width: '100%',
                  padding: '13px 20px',
                  borderRadius: '10px',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  background: isNotQualified
                    ? 'linear-gradient(135deg, #8E233B 0%, #B94B68 100%)'
                    : 'linear-gradient(135deg, #D97706 0%, #B45309 100%)',
                  color: '#FFFFFF',
                  fontSize: '14px',
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  boxShadow: isNotQualified
                    ? '0 6px 18px rgba(142, 35, 59, 0.4)'
                    : '0 6px 18px rgba(217, 119, 6, 0.35)',
                }}
              >
                <Icon name="check-circle" size={17} />
                <span>
                  {isNotQualified ? 'Acknowledge & Return to Arena' : 'Understood — Stand By'}
                </span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
