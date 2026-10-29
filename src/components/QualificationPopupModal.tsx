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
    rank,
    qualifiedCount,
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
        backgroundColor: 'rgba(15, 23, 42, 0.78)',
        backdropFilter: 'blur(8px)',
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
          background: '#FFFFFF',
          borderRadius: '20px',
          maxWidth: '540px',
          width: '100%',
          maxHeight: '92dvh',
          overflowY: 'auto',
          boxShadow: isQualified
            ? '0 25px 60px -15px rgba(22, 163, 74, 0.35), 0 0 0 2px #86EFAC'
            : isNotQualified
              ? '0 25px 60px -15px rgba(220, 38, 38, 0.3), 0 0 0 2px #FCA5A5'
              : '0 25px 60px -15px rgba(217, 119, 6, 0.25), 0 0 0 2px #FDE68A',
          fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif",
        }}
      >
        {/* Top Accent Banner */}
        <div
          style={{
            padding: 'clamp(20px, 4vw, 28px) clamp(16px, 4vw, 28px) 20px',
            background: isQualified
              ? 'linear-gradient(135deg, #059669 0%, #10B981 55%, #047857 100%)'
              : isNotQualified
                ? 'linear-gradient(135deg, #991B1B 0%, #DC2626 55%, #7F1D1D 100%)'
                : 'linear-gradient(135deg, #B45309 0%, #D97706 55%, #92400E 100%)',
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
              background: 'rgba(255, 255, 255, 0.18)',
              border: '1px solid rgba(255, 255, 255, 0.32)',
              fontSize: '11px',
              fontWeight: 800,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              marginBottom: '16px',
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
              background: 'rgba(255, 255, 255, 0.2)',
              border: '2px solid rgba(255, 255, 255, 0.45)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 14px',
              boxShadow: '0 8px 20px rgba(0, 0, 0, 0.15)',
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
              fontSize: '23px',
              fontWeight: 800,
              lineHeight: 1.25,
              letterSpacing: '-0.02em',
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
              opacity: 0.92,
              fontWeight: 500,
            }}
          >
            {participantName} • <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>{rollNumber}</span>
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
                background: '#F8FAFC',
                border: '1px solid #E2E8F0',
                borderRadius: '12px',
                padding: '12px 14px',
                textAlign: 'center',
              }}
            >
              <div
                style={{
                  fontSize: '10px',
                  fontWeight: 800,
                  color: '#64748B',
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
                  color: '#0F172A',
                  fontFamily: "'JetBrains Mono', monospace",
                }}
              >
                {score !== null && score !== undefined ? `${score} PTS` : 'Recorded'}
              </div>
            </div>

            {rank && (
              <div
                style={{
                  background: '#ECFDF5',
                  border: '1px solid #A7F3D0',
                  borderRadius: '12px',
                  padding: '12px 14px',
                  textAlign: 'center',
                }}
              >
                <div
                  style={{
                    fontSize: '10px',
                    fontWeight: 800,
                    color: '#047857',
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    marginBottom: '4px',
                  }}
                >
                  Qualifier Rank
                </div>
                <div
                  style={{
                    fontSize: '20px',
                    fontWeight: 800,
                    color: '#065F46',
                    fontFamily: "'JetBrains Mono', monospace",
                  }}
                >
                  #{rank}
                </div>
              </div>
            )}

            <div
              style={{
                background: isQualified ? '#ECFDF5' : isNotQualified ? '#FEF2F2' : '#FFFBEB',
                border: `1px solid ${isQualified ? '#A7F3D0' : isNotQualified ? '#FECACA' : '#FDE68A'}`,
                borderRadius: '12px',
                padding: '12px 14px',
                textAlign: 'center',
              }}
            >
              <div
                style={{
                  fontSize: '10px',
                  fontWeight: 800,
                  color: isQualified ? '#047857' : isNotQualified ? '#B91C1C' : '#B45309',
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
                  color: isQualified ? '#065F46' : isNotQualified ? '#991B1B' : '#92400E',
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
              background: isQualified ? '#F0FDF4' : isNotQualified ? '#FFF1F2' : '#FFFBEB',
              border: `1px solid ${isQualified ? '#BBF7D0' : isNotQualified ? '#FECDD3' : '#FDE68A'}`,
              borderRadius: '14px',
              padding: '16px 18px',
              marginBottom: '22px',
              color: '#1E293B',
              fontSize: '14px',
              lineHeight: 1.6,
            }}
          >
            {isQualified && (
              <>
                <div style={{ fontWeight: 700, color: '#166534', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Icon name="check-circle" size={17} />
                  <span>Unlocked Stage: {targetMeta.title}</span>
                </div>
                <p style={{ margin: 0, color: '#334155', fontSize: '13.5px' }}>
                  Based on your Round {sourceRound} performance, you have officially qualified among the top{' '}
                  <strong>{qualifiedCount > 0 ? `${qualifiedCount} ` : ''}candidates</strong> to advance to{' '}
                  <strong>Round {targetRound}</strong>.{' '}
                  {targetRoundStatus === 'active'
                    ? `Round ${targetRound} is currently LIVE — you may enter the stage immediately!`
                    : `Proceed to the Round ${targetRound} stage cockpit and stand by for the administrator to start the timer.`}
                </p>
              </>
            )}

            {isNotQualified && (
              <>
                <div style={{ fontWeight: 700, color: '#991B1B', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Icon name="alert-circle" size={17} />
                  <span>Elimination Cutoff Applied for Round {targetRound}</span>
                </div>
                <p style={{ margin: 0, color: '#334155', fontSize: '13.5px' }}>
                  Thank you for competing in <strong>Round {sourceRound}</strong> of Data Mania: Brain Bytes. Only the top{' '}
                  <strong>{qualifiedCount > 0 ? `${qualifiedCount} ` : ''}qualifying participants</strong> from Round {sourceRound} were selected to progress to{' '}
                  <strong>Round {targetRound} ({targetMeta.title})</strong>. Your Round {sourceRound} score has been permanently recorded on the tournament leaderboard.
                </p>
              </>
            )}

            {isAwaiting && (
              <>
                <div style={{ fontWeight: 700, color: '#92400E', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Icon name="clock" size={17} />
                  <span>Administrator Qualification Cutoff Pending</span>
                </div>
                <p style={{ margin: 0, color: '#334155', fontSize: '13.5px' }}>
                  Your <strong>Round {sourceRound}</strong> submission is safely recorded. Progression to{' '}
                  <strong>Round {targetRound}</strong> is restricted until the tournament administrator executes the official qualification cutoff. You will automatically see your selection result here as soon as it is published.
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
                    border: '1px solid #CBD5E1',
                    background: '#FFFFFF',
                    color: '#475569',
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
                    border: 'none',
                    background: 'linear-gradient(135deg, #059669, #10B981)',
                    color: '#FFFFFF',
                    fontSize: '14px',
                    fontWeight: 800,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    boxShadow: '0 6px 16px rgba(16, 185, 129, 0.35)',
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
                  border: 'none',
                  background: isNotQualified
                    ? 'linear-gradient(135deg, #1E293B, #0F172A)'
                    : 'linear-gradient(135deg, #D97706, #B45309)',
                  color: '#FFFFFF',
                  fontSize: '14px',
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
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
