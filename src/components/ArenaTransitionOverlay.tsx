import React, { useEffect, useState } from 'react';
import { Icon } from './Icon';

interface ArenaTransitionOverlayProps {
  participantName: string;
  roundId: number;
  onComplete: () => void;
}

export const ArenaTransitionOverlay: React.FC<ArenaTransitionOverlayProps> = ({
  participantName,
  roundId,
  onComplete,
}) => {
  const [progress, setProgress] = useState(0);
  const [stepIndex, setStepIndex] = useState(0);

  const steps = [
    'ACCESS CODE VERIFIED // CREDENTIAL MATCHED',
    `AUTHENTICATING CANDIDATE: ${participantName.toUpperCase()}`,
    'INITIALIZING SECURE BROWSER ENVIRONMENT',
    `LOADING ROUND ${roundId} QUESTION REPOSITORY...`,
    'ARENA READY // ENTERING NOW',
  ];

  useEffect(() => {
    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(progressInterval);
          return 100;
        }
        return prev + 5;
      });
    }, 70);

    const stepInterval = setInterval(() => {
      setStepIndex((prev) => {
        if (prev < steps.length - 1) return prev + 1;
        return prev;
      });
    }, 320);

    const finishTimeout = setTimeout(() => {
      onComplete();
    }, 1750);

    return () => {
      clearInterval(progressInterval);
      clearInterval(stepInterval);
      clearTimeout(finishTimeout);
    };
  }, [onComplete, steps.length]);

  return (
    <div className="arena-transition-overlay" id="arena-transition-overlay" role="status" aria-live="polite">
      {/* Background Matrix Cyber Grid */}
      <div className="transition-cyber-grid" aria-hidden="true" />
      <div className="transition-ambient-pulse" aria-hidden="true" />

      <div className="transition-dialog-box animate-scaleUp">
        <div className="transition-icon-wrap">
          <div className="transition-radar-ring" />
          <Icon name="terminal" size={32} className="transition-icon" />
        </div>

        <div className="transition-tag-badge">
          <span className="active-pulse-dot" />
          <span>ARENA GATEWAY // ROUND {roundId}</span>
        </div>

        <h2 className="transition-headline">INITIALIZING COMPETITION ARENA</h2>

        {/* Dynamic Log Steps */}
        <div className="transition-log-terminal">
          {steps.slice(0, stepIndex + 1).map((msg, i) => (
            <div key={i} className="terminal-line animate-fadeIn">
              <span className="terminal-prefix">[OK]</span>
              <span className="terminal-text">{msg}</span>
            </div>
          ))}
        </div>

        {/* High-tech Cyber Progress Bar */}
        <div className="transition-bar-wrapper">
          <div className="transition-bar-track">
            <div
              className="transition-bar-fill"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="transition-bar-info">
            <span className="bar-info-text">SYSTEM SYNCHRONIZATION</span>
            <span className="bar-info-pct">{progress}%</span>
          </div>
        </div>
      </div>
    </div>
  );
};
