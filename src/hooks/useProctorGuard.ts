import { useState, useEffect, useRef } from 'react';
import { apiRequest } from '../services/apiClient';

interface UseProctorGuardOptions {
  enabled: boolean;
  participantRoll?: string;
  roundId: number;
  onAutoSubmit?: () => void;
}

export function useProctorGuard({
  enabled,
  participantRoll,
  roundId,
  onAutoSubmit,
}: UseProctorGuardOptions) {
  const [warningCount, setWarningCount] = useState(0);
  const [showWarningModal, setShowWarningModal] = useState(false);
  const [lastWarningMsg, setLastWarningMsg] = useState('');
  const [isTerminated, setIsTerminated] = useState(false);
  const lastEventTimeRef = useRef(0);
  const onAutoSubmitRef = useRef(onAutoSubmit);
  const hasTriggeredSubmitRef = useRef(false);

  useEffect(() => {
    onAutoSubmitRef.current = onAutoSubmit;
  }, [onAutoSubmit]);

  // 1. Intercept Shortcuts, DevTools, and Right-Click
  useEffect(() => {
    if (!enabled || isTerminated) return;

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    const handleCopyCut = (e: ClipboardEvent) => {
      e.preventDefault();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      const isCtrlOrCmd = e.ctrlKey || e.metaKey;

      if (e.key === 'F12') {
        e.preventDefault();
        return;
      }

      if (isCtrlOrCmd) {
        const key = e.key.toLowerCase();
        if (
          key === 'c' ||
          key === 'v' ||
          key === 'u' ||
          (e.shiftKey && (key === 'i' || key === 'j' || key === 'c'))
        ) {
          e.preventDefault();
        }
      }
    };

    window.addEventListener('contextmenu', handleContextMenu);
    window.addEventListener('copy', handleCopyCut);
    window.addEventListener('cut', handleCopyCut);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('contextmenu', handleContextMenu);
      window.removeEventListener('copy', handleCopyCut);
      window.removeEventListener('cut', handleCopyCut);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [enabled, isTerminated]);

  // 2. Tab Switch & Window Blur Detection (Max 2 warnings, 3rd triggers auto-submit)
  useEffect(() => {
    if (!enabled || !participantRoll || isTerminated) return;

    const recordViolation = (reason: string) => {
      const now = Date.now();
      // Debounce events within 2.5 seconds
      if (now - lastEventTimeRef.current < 2500) return;
      lastEventTimeRef.current = now;

      setWarningCount((prev) => {
        const nextCount = prev + 1;

        if (nextCount === 1) {
          setLastWarningMsg(
            `Security Notice: Focus loss detected (${reason}). This is Warning 1 of 2. Leaving the exam window is strictly monitored.`
          );
          setShowWarningModal(true);

          apiRequest('/participants/proctor-event', {
            method: 'POST',
            body: JSON.stringify({
              eventType: 'proctor.tab_switch',
              details: {
                roundId,
                rollNumber: participantRoll,
                reason,
                warningCount: 1,
                timestamp: new Date().toISOString(),
              },
            }),
          }).catch(() => {});
        } else if (nextCount === 2) {
          setLastWarningMsg(
            `FINAL WARNING: Tab switch or focus loss detected (${reason}). This is Warning 2 of 2. A 3rd infraction will immediately terminate and automatically submit your exam!`
          );
          setShowWarningModal(true);

          apiRequest('/participants/proctor-event', {
            method: 'POST',
            body: JSON.stringify({
              eventType: 'proctor.tab_switch',
              details: {
                roundId,
                rollNumber: participantRoll,
                reason,
                warningCount: 2,
                timestamp: new Date().toISOString(),
              },
            }),
          }).catch(() => {});
        } else if (nextCount >= 3) {
          setIsTerminated(true);
          setLastWarningMsg(
            `EXAM TERMINATED: 3rd proctor violation detected (${reason}). Maximum allowed warnings exceeded (3/3). Your answers are being submitted automatically now.`
          );
          setShowWarningModal(true);

          apiRequest('/participants/proctor-event', {
            method: 'POST',
            body: JSON.stringify({
              eventType: 'proctor.autosubmit_violation',
              details: {
                roundId,
                rollNumber: participantRoll,
                reason: 'exceeded_max_proctor_warnings',
                warningCount: 3,
                timestamp: new Date().toISOString(),
              },
            }),
          }).catch(() => {});

          // Trigger automatic submission immediately
          if (!hasTriggeredSubmitRef.current) {
            hasTriggeredSubmitRef.current = true;
            setTimeout(() => {
              onAutoSubmitRef.current?.();
            }, 600);
          }
        }

        return nextCount;
      });
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        recordViolation('tab_hidden');
      }
    };

    const handleBlur = () => {
      recordViolation('window_blurred');
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleBlur);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleBlur);
    };
  }, [enabled, participantRoll, roundId, isTerminated]);

  return {
    warningCount,
    showWarningModal,
    lastWarningMsg,
    isTerminated,
    dismissWarning: () => {
      if (warningCount < 3) {
        setShowWarningModal(false);
      }
    },
  };
}
