import { useState, useEffect, useRef } from 'react';

interface UseExamTimerOptions {
  /** Full round length in seconds */
  durationSeconds: number;
  isRunning?: boolean;
  /** Authoritative deadline (epoch ms) from the server attempt's deadline_at */
  deadlineMs?: number | null;
  /** serverNow - clientNow (ms), so countdown is synchronized */
  clockOffsetMs?: number;
  onExpire: () => void;
}

/**
 * High-precision countdown timer formatted as MM:SS.mmm
 * Seamlessly transitions between client-side fallback and server-authoritative deadline.
 * Ensures Round 1, 2, and 3 timers never freeze, and updates with millisecond precision.
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

  // Local fallback deadline so timer starts ticking immediately upon mount
  const fallbackDeadlineRef = useRef<number>(Date.now() + durationSeconds * 1000);

  useEffect(() => {
    onExpireRef.current = onExpire;
  }, [onExpire]);

  // If durationSeconds changes or a fresh round starts without a deadline yet, update fallback
  useEffect(() => {
    if (!deadlineMs) {
      fallbackDeadlineRef.current = Date.now() + durationSeconds * 1000;
    }
  }, [durationSeconds, deadlineMs]);

  // High-frequency tick (~33ms, approx 30fps) for smooth millisecond updates
  useEffect(() => {
    if (!isRunning) return;
    const intervalId = setInterval(() => {
      setNow(Date.now());
    }, 33);
    return () => clearInterval(intervalId);
  }, [isRunning]);

  // Determine active deadline: Authoritative server deadline if valid number, else local fallback
  const isServerDeadlineValid = typeof deadlineMs === 'number' && !isNaN(deadlineMs) && deadlineMs > 0;
  const targetDeadline = isServerDeadlineValid ? deadlineMs : fallbackDeadlineRef.current;
  const effectiveNow = now + (isServerDeadlineValid ? clockOffsetMs : 0);
  const remainingMs = Math.max(0, targetDeadline - effectiveNow);
  const secondsRemaining = Math.max(0, Math.ceil(remainingMs / 1000));

  useEffect(() => {
    if (!isRunning) return;
    if (remainingMs <= 0 && !hasExpiredRef.current) {
      hasExpiredRef.current = true;
      onExpireRef.current();
    } else if (remainingMs > 0) {
      hasExpiredRef.current = false;
    }
  }, [isRunning, remainingMs]);

  // Format as MM:SS.mmm (Minutes : Seconds . Milliseconds)
  const formatTime = (valMsOrSec?: number) => {
    let safeMs: number;
    if (valMsOrSec === undefined) {
      safeMs = remainingMs;
    } else if (valMsOrSec > 36000) {
      safeMs = Math.max(0, valMsOrSec);
    } else {
      safeMs = Math.max(0, Math.round(valMsOrSec * 1000));
    }
    const minutes = Math.floor(safeMs / 60000);
    const seconds = Math.floor((safeMs % 60000) / 1000);
    const millis = safeMs % 1000;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(millis).padStart(3, '0')}`;
  };

  return {
    remainingMs,
    secondsRemaining,
    formattedTime: formatTime(remainingMs),
    formatTime,
  };
}
