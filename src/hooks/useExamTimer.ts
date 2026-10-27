import { useState, useEffect, useRef } from 'react';

interface UseExamTimerOptions {
  /** Full round length, shown until the server attempt (and its deadline) is known */
  durationSeconds: number;
  isRunning?: boolean;
  /** Authoritative deadline (epoch ms) from the server attempt's deadline_at */
  deadlineMs?: number | null;
  /** serverNow - clientNow (ms), so the countdown does not depend on the participant's own clock */
  clockOffsetMs?: number;
  onExpire: () => void;
}

/**
 * Countdown driven by the server-issued deadline.
 * Before the deadline is known the full duration is shown and nothing runs.
 */
export function useExamTimer({
  durationSeconds,
  isRunning = true,
  deadlineMs = null,
  clockOffsetMs = 0,
  onExpire,
}: UseExamTimerOptions) {
  const [now, setNow] = useState<number>(() => Date.now());
  const onExpireRef = useRef(onExpire);
  const hasExpiredRef = useRef(false);

  useEffect(() => {
    onExpireRef.current = onExpire;
  }, [onExpire]);

  useEffect(() => {
    if (!isRunning || deadlineMs === null) return;
    const intervalId = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(intervalId);
  }, [isRunning, deadlineMs]);

  const secondsRemaining =
    deadlineMs === null
      ? durationSeconds
      : Math.max(0, Math.ceil((deadlineMs - (now + clockOffsetMs)) / 1000));

  useEffect(() => {
    if (deadlineMs === null || !isRunning) return;
    if (secondsRemaining <= 0 && !hasExpiredRef.current) {
      hasExpiredRef.current = true;
      onExpireRef.current();
    } else if (secondsRemaining > 0) {
      hasExpiredRef.current = false;
    }
  }, [deadlineMs, isRunning, secondsRemaining]);

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
