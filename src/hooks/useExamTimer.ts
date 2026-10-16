import { useState, useEffect, useRef } from 'react';
import { getOrInitRoundTimer } from '../services/competitionStateService';

interface UseExamTimerOptions {
  durationSeconds: number;
  isRunning?: boolean;
  roundId?: number;
  rollNumber?: string;
  onExpire: () => void;
}

export function useExamTimer({
  durationSeconds,
  isRunning = true,
  roundId,
  rollNumber,
  onExpire,
}: UseExamTimerOptions) {
  // Initialize from persistent timer if roundId & rollNumber are provided
  const [secondsRemaining, setSecondsRemaining] = useState<number>(() => {
    if (roundId && rollNumber) {
      const status = getOrInitRoundTimer(roundId, rollNumber, durationSeconds);
      return status.remainingSeconds;
    }
    return durationSeconds;
  });

  const onExpireRef = useRef(onExpire);
  const hasExpiredRef = useRef(false);
  const deadlineRef = useRef<number | null>(null);

  useEffect(() => {
    onExpireRef.current = onExpire;
  }, [onExpire]);

  // Establish or read deadline
  useEffect(() => {
    if (roundId && rollNumber) {
      const status = getOrInitRoundTimer(roundId, rollNumber, durationSeconds);
      deadlineRef.current = status.deadlineTime;
      setSecondsRemaining(status.remainingSeconds);
      if (status.isExpired && !hasExpiredRef.current) {
        hasExpiredRef.current = true;
        onExpireRef.current();
      }
    } else {
      deadlineRef.current = Date.now() + durationSeconds * 1000;
    }
  }, [roundId, rollNumber, durationSeconds]);

  useEffect(() => {
    if (!isRunning || hasExpiredRef.current) return;

    const intervalId = setInterval(() => {
      let remaining: number;

      if (deadlineRef.current) {
        // Compute from authoritative deadline to avoid drift or throttling
        const diff = Math.round((deadlineRef.current - Date.now()) / 1000);
        remaining = Math.max(0, diff);
      } else {
        remaining = Math.max(0, secondsRemaining - 1);
      }

      setSecondsRemaining(remaining);

      if (remaining <= 0) {
        clearInterval(intervalId);
        if (!hasExpiredRef.current) {
          hasExpiredRef.current = true;
          onExpireRef.current();
        }
      }
    }, 1000);

    return () => clearInterval(intervalId);
  }, [isRunning, secondsRemaining]);

  const formatTime = (totalSec: number = secondsRemaining) => {
    const safeSec = Math.max(0, totalSec);
    const minutes = Math.floor(safeSec / 60);
    const seconds = safeSec % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  };

  return {
    secondsRemaining,
    formattedTime: formatTime(secondsRemaining),
    formatTime,
  };
}
