import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { Icon } from '../Icon';
import type { Participant } from '../../types/competition';
import {
  ROUND_2_CONFIG,
  ROUND_2_QUESTIONS,
  type Round2Question,
} from '../../data/round2Questions';
import { GraphVisualizer } from './GraphVisualizer';
import { useExamTimer } from '../../hooks/useExamTimer';
import { recordSubmission, getParticipantSubmission } from '../../services/competitionStateService';
import { apiRequest, ApiError } from '../../services/apiClient';
import { shuffleForParticipant } from '../../utils/shuffle';
import { useProctorGuard } from '../../hooks/useProctorGuard';
import './Round1MCQ.css';



interface QuestionReview {
  id: number;
  sort_order: number;
  correct_answer: number;
  explanation: string;
}

interface Round2GraphChallengeProps {
  participant: Participant | null;
  onExit: () => void;
  onRecordScore?: (score: number) => void;
  onProceedToNextRound?: () => void;
}

export const Round2GraphChallenge: React.FC<Round2GraphChallengeProps> = ({
  participant,
  onExit,
  onRecordScore,
  onProceedToNextRound,
}) => {
  const participantKey = participant?.rollNumber ?? null;

  // Deterministically shuffle questions per participant so adjacent stations get different question order
  const roundQuestions = useMemo(() => {
    return shuffleForParticipant(ROUND_2_QUESTIONS, participantKey || 'default');
  }, [participantKey]);

  // Current active question index (0-based)
  const [currentIndex, setCurrentIndex] = useState(0);

  // In-progress answers persisted to localStorage so candidate never loses answers on reload
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number>>(() => {
    if (!participantKey) return {};
    try {
      const savedAttemptId = localStorage.getItem(`bb_attempt_id_r2_${participantKey}`);
      if (!savedAttemptId) return {};
      const saved = localStorage.getItem(`bb_answers_r2_${participantKey}`);
      if (!saved) return {};
      const parsed = JSON.parse(saved);
      const clean: Record<number, number> = {};
      if (parsed && typeof parsed === 'object') {
        for (const [k, v] of Object.entries(parsed)) {
          const numK = Number(k);
          const numV = Number(v);
          if (Number.isInteger(numK) && numK >= 1 && numK <= 30 && typeof v === 'number' && Number.isInteger(numV) && numV >= 0 && numV <= 3) {
            clean[numK] = numV;
          }
        }
      }
      return clean;
    } catch {
      return {};
    }
  });

  // Questions marked for review persisted to localStorage
  const [markedForReview, setMarkedForReview] = useState<Set<number>>(() => {
    if (!participantKey) return new Set<number>();
    try {
      const savedAttemptId = localStorage.getItem(`bb_attempt_id_r2_${participantKey}`);
      if (!savedAttemptId) return new Set<number>();
      const saved = localStorage.getItem(`bb_marked_r2_${participantKey}`);
      return saved ? new Set<number>(JSON.parse(saved)) : new Set<number>();
    } catch {
      return new Set<number>();
    }
  });

  // Visited tracking persisted to localStorage per active attempt
  const [visitedQuestions, setVisitedQuestions] = useState<Set<number>>(() => {
    const firstQId = roundQuestions[0]?.id || 1;
    if (!participantKey) return new Set([firstQId]);
    try {
      const savedAttemptId = localStorage.getItem(`bb_attempt_id_r2_${participantKey}`);
      if (!savedAttemptId) return new Set([firstQId]);
      const saved = localStorage.getItem(`bb_visited_r2_${participantKey}`);
      if (saved) {
        const arr = JSON.parse(saved);
        if (Array.isArray(arr)) return new Set<number>([...arr.map(Number), firstQId]);
      }
    } catch {
      // ignore
    }
    return new Set([firstQId]);
  });

  // Submission state - initialized synchronously to true if candidate already submitted
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState<boolean>(() => {
    if (!participantKey) return false;
    if (localStorage.getItem(`bb_submitted_r2_${participantKey}`) === 'true') return true;
    return Boolean(getParticipantSubmission(2, participantKey));
  });
  const isSubmittingRef = useRef(isSubmitted);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [finalScore, setFinalScore] = useState<number | null>(() => {
    if (!participantKey) return null;
    const sub = getParticipantSubmission(2, participantKey);
    if (sub) return sub.score;
    const saved = localStorage.getItem(`bb_score_r2_${participantKey}`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return parsed.rawMarks ?? parsed.score ?? null;
      } catch {
        // ignore
      }
    }
    return null;
  });
  const [scoreDetails, setScoreDetails] = useState<{
    correctCount: number;
    incorrectCount: number;
    unansweredCount: number;
    rawMarks: number;
  }>(() => {
    if (!participantKey) return { correctCount: 0, incorrectCount: 0, unansweredCount: 0, rawMarks: 0 };
    const sub = getParticipantSubmission(2, participantKey);
    if (sub) {
      return {
        correctCount: sub.correctCount,
        incorrectCount: sub.incorrectCount,
        unansweredCount: sub.unansweredCount,
        rawMarks: sub.score,
      };
    }
    const saved = localStorage.getItem(`bb_score_r2_${participantKey}`);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        // ignore
      }
    }
    return { correctCount: 0, incorrectCount: 0, unansweredCount: 0, rawMarks: 0 };
  });

  // Post-submit diagnostic review data received from server
  const [reviewData, setReviewData] = useState<Record<number, QuestionReview>>(() => {
    if (!participantKey) return {};
    const saved = localStorage.getItem(`bb_review_r2_${participantKey}`);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        // ignore
      }
    }
    return {};
  });

  // Helper calculations
  const totalQuestions = roundQuestions.length;
  const currentQuestion: Round2Question = roundQuestions[currentIndex] || roundQuestions[0];

  const [attemptId, setAttemptId] = useState<number | null>(null);
  // Authoritative countdown inputs from the server attempt
  const [deadlineMs, setDeadlineMs] = useState<number | null>(null);
  const [clockOffsetMs, setClockOffsetMs] = useState(0);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [reauthCode, setReauthCode] = useState('');
  const [isCompetitionPaused, setIsCompetitionPaused] = useState<boolean>(() => {
    try {
      return localStorage.getItem('bb_tournament_global_state') === 'PAUSED';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    const handleSync = () => {
      try {
        const state = localStorage.getItem('bb_tournament_global_state');
        if (state === 'PAUSED') setIsCompetitionPaused(true);
        else if (state === 'LIVE') setIsCompetitionPaused(false);
      } catch {}
    };
    window.addEventListener('storage', handleSync);
    window.addEventListener('bb_storage_sync', handleSync);
    return () => {
      window.removeEventListener('storage', handleSync);
      window.removeEventListener('bb_storage_sync', handleSync);
    };
  }, []);




  // Keep the latest callbacks in refs so the attempt-start effect does not re-run (and re-POST) on every parent render
  const onRecordScoreRef = useRef(onRecordScore);
  useEffect(() => {
    onRecordScoreRef.current = onRecordScore;
  }, [onRecordScore]);

  const onExitRef = useRef(onExit);
  useEffect(() => {
    onExitRef.current = onExit;
  }, [onExit]);

  // Sync answers, review marks & visited state to localStorage across changes
  useEffect(() => {
    if (!participantKey || isSubmitted) return;
    try {
      localStorage.setItem(`bb_answers_r2_${participantKey}`, JSON.stringify(selectedAnswers));
    } catch (err) {
      console.warn('Failed to save answers to localStorage:', err);
    }
  }, [selectedAnswers, participantKey, isSubmitted]);

  useEffect(() => {
    if (!participantKey || isSubmitted) return;
    try {
      localStorage.setItem(
        `bb_marked_r2_${participantKey}`,
        JSON.stringify(Array.from(markedForReview))
      );
    } catch (err) {
      console.warn('Failed to save marked questions to localStorage:', err);
    }
  }, [markedForReview, participantKey, isSubmitted]);

  useEffect(() => {
    if (!participantKey || isSubmitted) return;
    try {
      localStorage.setItem(
        `bb_visited_r2_${participantKey}`,
        JSON.stringify(Array.from(visitedQuestions))
      );
    } catch {
      // ignore
    }
  }, [visitedQuestions, participantKey, isSubmitted]);

  // Accidental tab close / reload protection while attempt is active
  useEffect(() => {
    if (isSubmitted || !deadlineMs) return;
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isSubmitted, deadlineMs]);

  // Helper to ingest review payload returned by backend (strictly keyed by sort_order / canonical question ID)
  const applyReviewPayload = useCallback(
    (
      review?: QuestionReview[],
      answers?: Record<string | number, number | null> | Array<{ question_id?: number; questionId?: number; sort_order?: number; sortOrder?: number; selected_option?: number | null; selectedOption?: number | null }>
    ) => {
      const qIdToSortOrder: Record<number, number> = {};

      if (review && Array.isArray(review)) {
        const rMap: Record<number, QuestionReview> = {};
        for (const r of review) {
          const canonicalKey = r.sort_order !== undefined && r.sort_order !== null ? Number(r.sort_order) : Number(r.id);
          rMap[canonicalKey] = r;
          if (r.id !== undefined && r.sort_order !== undefined) {
            qIdToSortOrder[Number(r.id)] = Number(r.sort_order);
          }
        }
        setReviewData(rMap);
        if (participantKey) {
          try {
            localStorage.setItem(`bb_review_r2_${participantKey}`, JSON.stringify(rMap));
          } catch {
            // ignore
          }
        }
      }
      if (answers) {
        const aMap: Record<number, number> = {};
        if (Array.isArray(answers)) {
          for (const a of answers) {
            const rawSort = a.sort_order ?? a.sortOrder;
            const rawQId = a.question_id ?? a.questionId;
            const opt = a.selected_option ?? a.selectedOption;
            if (opt !== null && opt !== undefined && Number.isInteger(Number(opt)) && Number(opt) >= 0 && Number(opt) <= 3) {
              const canonicalKey = rawSort !== undefined
                ? Number(rawSort)
                : rawQId !== undefined && qIdToSortOrder[Number(rawQId)] !== undefined
                  ? qIdToSortOrder[Number(rawQId)]
                  : Number(rawQId);
              if (Number.isInteger(canonicalKey) && canonicalKey >= 1) {
                aMap[canonicalKey] = Number(opt);
              }
            }
          }
        } else if (typeof answers === 'object') {
          for (const [rawKey, opt] of Object.entries(answers)) {
            if (opt !== null && opt !== undefined && Number.isInteger(Number(opt)) && Number(opt) >= 0 && Number(opt) <= 3) {
              const numKey = Number(rawKey);
              if (Number.isInteger(numKey) && numKey >= 1 && numKey <= 30) {
                aMap[numKey] = Number(opt);
              } else if (qIdToSortOrder[numKey] !== undefined) {
                aMap[qIdToSortOrder[numKey]] = Number(opt);
              }
            }
          }
        }
        setSelectedAnswers(aMap);
        if (participantKey) {
          try {
            localStorage.setItem(`bb_answers_r2_${participantKey}`, JSON.stringify(aMap));
          } catch {
            // ignore
          }
        }
      }
    },
    [participantKey]
  );

  // Restore previous submission or start attempt with Neon PostgreSQL
  useEffect(() => {
    let isMounted = true;

    apiRequest<{
      id: number;
      round_id: number;
      submitted_at: string | null;
      alreadySubmitted?: boolean;
      deadline_at: string;
      server_now: string;
      score: number | null;
      correct_count: number | null;
      correctCount?: number | null;
      incorrect_count: number | null;
      incorrectCount?: number | null;
      unanswered_count: number | null;
      unansweredCount?: number | null;
      review?: QuestionReview[];
      answers?: Array<{ question_id: number; selected_option: number | null }>;
    }>('/rounds/2/attempts/start', { method: 'POST' })
      .then((attempt) => {
        if (!isMounted) return;
        setAttemptId(attempt.id);
        if (attempt.deadline_at) {
          setDeadlineMs(new Date(attempt.deadline_at).getTime());
        }
        if (attempt.server_now) {
          setClockOffsetMs(new Date(attempt.server_now).getTime() - Date.now());
        }
        if (attempt.submitted_at || attempt.alreadySubmitted) {
          const score = attempt.score ?? 0;
          const correct = attempt.correct_count ?? attempt.correctCount ?? 0;
          const incorrect = attempt.incorrect_count ?? attempt.incorrectCount ?? 0;
          const unanswered = attempt.unanswered_count ?? attempt.unansweredCount ?? 0;

          setFinalScore(score);
          setScoreDetails({
            correctCount: correct,
            incorrectCount: incorrect,
            unansweredCount: unanswered,
            rawMarks: score,
          });
          setIsSubmitted(true);
          isSubmittingRef.current = true;
          if (participantKey) {
            try {
              localStorage.setItem(`bb_submitted_r2_${participantKey}`, 'true');
              localStorage.setItem(
                `bb_score_r2_${participantKey}`,
                JSON.stringify({
                  correctCount: correct,
                  incorrectCount: incorrect,
                  unansweredCount: unanswered,
                  rawMarks: score,
                })
              );
            } catch {
              // ignore
            }
          }
          applyReviewPayload(attempt.review, attempt.answers);
          if (attempt.score !== null) onRecordScoreRef.current?.(attempt.score);
        } else {
          // Server indicates active attempt (fresh or reset)
          const savedAttemptId = participantKey
            ? localStorage.getItem(`bb_attempt_id_r2_${participantKey}`)
            : null;

          // Only discard local answers if a DIFFERENT attempt ID was previously stored (e.g. admin reset the round)
          if (savedAttemptId && savedAttemptId !== String(attempt.id)) {
            const firstQId = roundQuestions[0]?.id || 1;
            setSelectedAnswers({});
            setMarkedForReview(new Set());
            setVisitedQuestions(new Set([firstQId]));
            if (participantKey) {
              try {
                localStorage.removeItem(`bb_answers_r2_${participantKey}`);
                localStorage.removeItem(`bb_marked_r2_${participantKey}`);
                localStorage.removeItem(`bb_visited_r2_${participantKey}`);
              } catch {
                // ignore
              }
            }
          }

          if (participantKey) {
            try {
              localStorage.setItem(`bb_attempt_id_r2_${participantKey}`, String(attempt.id));
              localStorage.removeItem(`bb_submitted_r2_${participantKey}`);
              localStorage.removeItem(`bb_score_r2_${participantKey}`);
              localStorage.removeItem(`bb_review_r2_${participantKey}`);
            } catch {
              // ignore
            }
          }

          setIsSubmitted(false);
          isSubmittingRef.current = false;
          setFinalScore(null);
          setReviewData({});
        }
      })
      .catch((err: unknown) => {
        console.warn('Attempt initialization notice for Round 2:', err);
        const isAuthErr = err instanceof ApiError && (err.status === 401 || err.status === 403 || err.status === 423);
        const errMsg = err instanceof Error ? err.message : '';
        if (isAuthErr || errMsg.toLowerCase().includes('qualif') || errMsg.toLowerCase().includes('submit round 1') || errMsg.toLowerCase().includes('not currently open')) {
          if (typeof window !== 'undefined') {
            window.location.hash = '#/';
          }
          if (onExitRef.current) onExitRef.current();
        }
      });
    return () => {
      isMounted = false;
    };
  }, [participantKey, applyReviewPayload, roundQuestions]);

  // Synchronize on authoritative round reset
  useEffect(() => {
    const handleReset = (e?: Event) => {
      const ce = e as CustomEvent<{ roundId?: number }> | undefined;
      const targetRound = ce?.detail?.roundId;
      if (targetRound === 2) {
        if (participantKey) {
          try {
            localStorage.removeItem(`bb_answers_r2_${participantKey}`);
            localStorage.removeItem(`bb_marked_r2_${participantKey}`);
            localStorage.removeItem(`bb_submitted_r2_${participantKey}`);
            localStorage.removeItem(`bb_score_r2_${participantKey}`);
            localStorage.removeItem(`bb_review_r2_${participantKey}`);
            localStorage.removeItem(`bb_attempt_id_r2_${participantKey}`);
          } catch {
            // ignore
          }
        }
        setSelectedAnswers({});
        setMarkedForReview(new Set());
        setVisitedQuestions(new Set(roundQuestions[0] ? [roundQuestions[0].id] : [1]));
        setCurrentIndex(0);
        setIsSubmitted(false);
        setFinalScore(null);
        isSubmittingRef.current = false;
        setIsSubmitting(false);
        setSubmitError(null);
        setReviewData({});
        if (typeof window !== 'undefined') {
          window.location.hash = '#/';
        }
        if (onExit) onExit();
      }
    };
    window.addEventListener('bb_round_reset', handleReset);
    return () => {
      window.removeEventListener('bb_round_reset', handleReset);
    };
  }, [participantKey, roundQuestions, onExit]);

  const tryReauth = useCallback(async (manualCode?: string): Promise<boolean> => {
    if (manualCode && manualCode.trim()) {
      try {
        const res = await apiRequest<{ token?: string; rollNumber?: string }>('/participants/login-access-code', {
          method: 'POST',
          body: JSON.stringify({ accessCode: manualCode.trim().toUpperCase() }),
        });
        if (res?.token) {
          localStorage.setItem('bb_participant_token', res.token);
          return true;
        }
      } catch (err) {
        console.warn('Reauth via access code failed:', err);
      }
    }

    const roll = participant?.rollNumber || participantKey;
    if (!roll) return false;
    try {
      const res = await apiRequest<{ token?: string }>('/participants/reauth', {
        method: 'POST',
        body: JSON.stringify({ rollNumber: roll }),
      });
      if (res?.token) {
        localStorage.setItem('bb_participant_token', res.token);
      }
      return true;
    } catch (e) {
      console.warn('Reauth attempt failed:', e);
      return false;
    }
  }, [participant, participantKey]);

  // Submit Handler - Requires Authoritative Backend Persistence
  const handleConfirmSubmit = useCallback(async (overrideCode?: string) => {
    if (isSubmittingRef.current || isSubmitted) return;

    if (overrideCode && typeof overrideCode === 'string') {
      await tryReauth(overrideCode);
    }

    let currentAttemptId = attemptId;
    if (!currentAttemptId) {
      try {
        const started = await apiRequest<{
          id: number;
          submitted_at: string | null;
          deadline_at: string;
          server_now: string;
          score: number | null;
          correct_count: number | null;
          incorrect_count: number | null;
          unanswered_count: number | null;
        }>('/rounds/2/attempts/start', { method: 'POST' });
        currentAttemptId = started.id;
        setAttemptId(started.id);
        setDeadlineMs(new Date(started.deadline_at).getTime());
        setClockOffsetMs(new Date(started.server_now).getTime() - Date.now());
        if (started.submitted_at) {
          setFinalScore(started.score ?? 0);
          setScoreDetails({
            correctCount: started.correct_count ?? 0,
            incorrectCount: started.incorrect_count ?? 0,
            unansweredCount: started.unanswered_count ?? 0,
            rawMarks: started.score ?? 0,
          });
          setIsSubmitted(true);
          setIsSubmitModalOpen(false);
          isSubmittingRef.current = false;
          return;
        }
      } catch (err: unknown) {
        const isAuthErr =
          (err instanceof ApiError && err.status === 401) ||
          (err instanceof Error && err.message.toLowerCase().includes('authentication'));
        if (isAuthErr) {
          const reauthOk = await tryReauth(overrideCode);
          if (reauthOk) {
            try {
              const started = await apiRequest<{
                id: number;
                submitted_at: string | null;
                deadline_at: string;
                server_now: string;
                score: number | null;
                correct_count: number | null;
                incorrect_count: number | null;
                unanswered_count: number | null;
              }>('/rounds/2/attempts/start', { method: 'POST' });
              currentAttemptId = started.id;
              setAttemptId(started.id);
              setDeadlineMs(new Date(started.deadline_at).getTime());
              setClockOffsetMs(new Date(started.server_now).getTime() - Date.now());
            } catch (retryErr) {
              isSubmittingRef.current = false;
              const msg = retryErr instanceof Error ? retryErr.message : 'Authentication required';
              setSubmitError(`Submission failed: ${msg}. Enter your Access Code below to reconnect.`);
              setIsSubmitModalOpen(true);
              return;
            }
          } else {
            isSubmittingRef.current = false;
            setSubmitError('Submission failed: Authentication required. Enter your Access Code below to reconnect.');
            setIsSubmitModalOpen(true);
            return;
          }
        } else {
          isSubmittingRef.current = false;
          const msg = err instanceof Error ? err.message : 'Unable to initialize round attempt.';
          setSubmitError(`Submission failed: ${msg}. Please try again.`);
          setIsSubmitModalOpen(true);
          return;
        }
      }
    }

    isSubmittingRef.current = true;
    setIsSubmitting(true);
    setSubmitError(null);

    const formattedAnswers = roundQuestions.map((q) => {
      const rawAns = selectedAnswers[q.id];
      const isValidSelection =
        visitedQuestions.has(q.id) &&
        typeof rawAns === 'number' &&
        Number.isInteger(rawAns) &&
        rawAns >= 0 &&
        rawAns <= 3;
      return {
        questionId: q.id,
        sortOrder: q.id,
        selectedOption: isValidSelection ? rawAns : null,
      };
    });

    try {
      const result = await apiRequest<{
        score: number;
        correct_count?: number;
        correctCount?: number;
        incorrect_count?: number;
        incorrectCount?: number;
        unanswered_count?: number;
        unansweredCount?: number;
        review?: QuestionReview[];
        answers?: Array<{ question_id: number; selected_option: number | null }>;
      }>(`/attempts/${currentAttemptId}/submit`, {
        method: 'POST',
        body: JSON.stringify({ answers: formattedAnswers }),
      });

      const correct = result.correct_count ?? result.correctCount ?? 0;
      const incorrect = result.incorrect_count ?? result.incorrectCount ?? 0;
      const unanswered = result.unanswered_count ?? result.unansweredCount ?? 0;

      setScoreDetails({
        correctCount: correct,
        incorrectCount: incorrect,
        unansweredCount: unanswered,
        rawMarks: result.score,
      });
      setFinalScore(result.score);
      setIsSubmitted(true);
      isSubmittingRef.current = true;
      setIsSubmitting(false);
      setIsSubmitModalOpen(false);
      if (participantKey) {
        try {
          localStorage.setItem(`bb_submitted_r2_${participantKey}`, 'true');
          localStorage.setItem(
            `bb_score_r2_${participantKey}`,
            JSON.stringify({
              correctCount: correct,
              incorrectCount: incorrect,
              unansweredCount: unanswered,
              rawMarks: result.score,
            })
          );
        } catch {
          // ignore
        }
      }
      applyReviewPayload(result.review, result.answers);

      if (participant) {
        recordSubmission(2, participant, selectedAnswers, {
          score: result.score,
          correctCount: correct,
          incorrectCount: incorrect,
          unansweredCount: unanswered,
        });
      }
      if (onRecordScore) {
        onRecordScore(result.score);
      }
    } catch (err: unknown) {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
      const isAuthErr =
        (err instanceof ApiError && err.status === 401) ||
        (err instanceof Error && err.message.toLowerCase().includes('authentication'));
      if (isAuthErr) {
        setSubmitError('Submission failed: Authentication required. Enter your Access Code below to reconnect.');
      } else {
        const msg = err instanceof Error ? err.message : 'Backend submission failed.';
        setSubmitError(`Submission failed: ${msg}. Your response was not saved. Please try submitting again.`);
      }
      setIsSubmitModalOpen(true);
    }
  }, [isSubmitted, attemptId, roundQuestions, selectedAnswers, visitedQuestions, applyReviewPayload, participant, onRecordScore, participantKey, tryReauth]);

  const handleAutoSubmit = useCallback(() => {
    handleConfirmSubmit();
  }, [handleConfirmSubmit]);

  // Anti-cheat proctoring: monitors tab switching, window minimization, and illegal shortcuts.
  // Enforces 2 warnings; on 3rd infraction automatically submits response immediately.
  const { warningCount, showWarningModal, lastWarningMsg, isTerminated, dismissWarning } = useProctorGuard({
    enabled: !isSubmitted && Boolean(deadlineMs),
    participantRoll: participant?.rollNumber,
    roundId: 2,
    onAutoSubmit: handleAutoSubmit,
  });

  // Read dynamic configured duration or fallback to default
  const configuredDurationSeconds = useMemo(() => {
    try {
      const raw = localStorage.getItem('bb_admin_durations');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.['2']) return Number(parsed['2']) * 60;
      }
    } catch {
      // fallback
    }
    return ROUND_2_CONFIG.durationSeconds;
  }, []);

  // Periodic polling for active deadline extensions
  useEffect(() => {
    if (isSubmitted || !attemptId) return;

    const pollInterval = setInterval(async () => {
      try {
        const res = await apiRequest<{
          active: boolean;
          deadline_at?: string;
          server_now?: string;
          is_paused?: boolean;
          competition_status?: string;
        }>('/rounds/2/attempts/active-deadline');

        if (res?.is_paused !== undefined) {
          setIsCompetitionPaused(Boolean(res.is_paused));
        }
        if (res?.active && res.deadline_at) {
          const newDeadline = new Date(res.deadline_at).getTime();
          setDeadlineMs((prev) => {
            if (prev && Math.abs(newDeadline - prev) > 1000) {
              return newDeadline;
            }
            return prev || newDeadline;
          });
          if (res.server_now) {
            setClockOffsetMs(new Date(res.server_now).getTime() - Date.now());
          }
        }
      } catch {
        // network jitter, continue
      }
    }, 2500);

    return () => clearInterval(pollInterval);
  }, [isSubmitted, attemptId]);

  // Timer: dynamic duration + active deadline
  const { formattedTime } = useExamTimer({
    durationSeconds: configuredDurationSeconds,
    isRunning: !isSubmitted && !isCompetitionPaused,
    deadlineMs,
    clockOffsetMs,
    onExpire: handleAutoSubmit,
  });

  // Helper calculations
  const answeredCount = useMemo(() => {
    return Object.keys(selectedAnswers).length;
  }, [selectedAnswers]);

  const reviewCount = useMemo(() => {
    return markedForReview.size;
  }, [markedForReview]);

  const unvisitedCount = useMemo(() => {
    return roundQuestions.filter(
      (q) =>
        !visitedQuestions.has(q.id) &&
        selectedAnswers[q.id] === undefined &&
        !markedForReview.has(q.id)
    ).length;
  }, [roundQuestions, visitedQuestions, selectedAnswers, markedForReview]);

    // Auto-scroll active question button into view within the scrolling palette grid
  useEffect(() => {
    const activeBtn = document.getElementById(`palette-node-${roundQuestions[currentIndex]?.id}`);
    if (activeBtn) {
      activeBtn.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [currentIndex, roundQuestions]);

  // Navigate to Question
  const handleSelectQuestion = (index: number) => {
    setCurrentIndex(index);
    setVisitedQuestions((prev) => new Set(prev).add(roundQuestions[index].id));
  };

  // Option selection
  const handleOptionClick = (optionIdx: number) => {
    if (isSubmitted || isCompetitionPaused) return;
    const qId = currentQuestion.id;

    setVisitedQuestions((prev) => new Set(prev).add(qId));
    setSelectedAnswers((prev) => ({
      ...prev,
      [qId]: optionIdx,
    }));
  };

  // Clear current response
  const handleClearResponse = () => {
    if (isSubmitted) return;
    const qId = currentQuestion.id;
    setSelectedAnswers((prev) => {
      const next = { ...prev };
      delete next[qId];
      return next;
    });
  };

  // Toggle Mark for Review
  const handleToggleReview = () => {
    if (isSubmitted) return;
    const qId = currentQuestion.id;
    setMarkedForReview((prev) => {
      const next = new Set(prev);
      if (next.has(qId)) {
        next.delete(qId);
      } else {
        next.add(qId);
      }
      return next;
    });
  };

  // Navigation
  const handlePrev = () => {
    if (currentIndex > 0) {
      handleSelectQuestion(currentIndex - 1);
    }
  };

  const handleNext = () => {
    if (currentIndex < totalQuestions - 1) {
      handleSelectQuestion(currentIndex + 1);
    }
  };

  const handleSaveAndNext = () => {
    if (currentIndex < totalQuestions - 1) {
      handleSelectQuestion(currentIndex + 1);
    }
  };

  // Participant details
  const participantId =
    participant?.ticketId || participant?.rollNumber || 'BB-2026-0842';
  const participantName = participant?.fullName || 'Candidate Demo';

  // Active question status
  const isCurrentAnswered = selectedAnswers[currentQuestion.id] !== undefined;
  const isCurrentMarked = markedForReview.has(currentQuestion.id);

  let statusLabel = 'NOT ATTEMPTED';
  let statusDotClass = 'dot-orange';

  if (isCurrentAnswered && isCurrentMarked) {
    statusLabel = 'ANSWERED & MARKED FOR REVIEW';
    statusDotClass = 'dot-purple';
  } else if (isCurrentAnswered) {
    statusLabel = 'ANSWERED & ACTIVE';
    statusDotClass = 'dot-orange';
  } else if (isCurrentMarked) {
    statusLabel = 'MARKED FOR REVIEW';
    statusDotClass = 'dot-purple';
  }

  // Render Completed Summary
  if (isSubmitted) {
    return (
      <div className="stitch-exam-root" id="round2-result-view">
        <header className="stitch-header-bar">
          <div className="stitch-header-left">
            <button
              type="button"
              className="stitch-brand-header-btn"
              onClick={() => {
                window.location.hash = '#/';
                window.dispatchEvent(new HashChangeEvent('hashchange'));
              }}
              title="Brain Bytes - Return to Landing Page"
            >
              <img
                src="/brand-logo.png"
                alt="Brain Bytes Logo"
                className="stitch-brand-logo-img"
              />
              <span className="stitch-brand-logo">BRAIN BYTES</span>
              <span className="stitch-brand-sub">// DATA MANIA</span>
            </button>
            <span className="sys-tag-badge">[SYS_02]</span>
            <div className="stitch-round-pill">
              <span className="pill-dot" />
              <span className="pill-text">ROUND 2   COMPLETED</span>
            </div>
          </div>
          <div className="stitch-header-right">
            <button
              type="button"
              className="header-btn-exit"
              onClick={onExit}
              title="Return to Landing Page"
            >
              ← Return to Arena
            </button>
          </div>
        </header>

        <main className="stitch-main-layout" style={{ justifyContent: 'center' }}>
          <div className="stitch-result-view">
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '6px 14px', borderRadius: '20px', background: 'rgba(0, 230, 153, 0.12)', border: '1px solid rgba(0, 230, 153, 0.3)', color: '#00E699', fontWeight: 600, fontSize: '0.85rem', marginBottom: '12px' }}>
              <Icon name="check-circle" size={16} />
              <span>Response Already Submitted</span>
            </div>
            <div className="result-hero-box">
              <span className="result-badge-top">AUDIT COMPLETE • TELEMETRY COMMITTED</span>
              <h1 className="result-main-heading">Round 2 Graph Challenge Submission Successful</h1>
              <p className="result-candidate-info">
                Candidate <strong>{participantName}</strong> ({participantId}) •
                Session recording and analytical graph responses committed.
              </p>

              <div className="result-score-callout">
                <div className="score-big-number">{finalScore} PTS</div>
                <div className="score-sub-label">
                  SCORE RATIO: {scoreDetails.correctCount}/{totalQuestions} CORRECT • TOTAL SCORE: {scoreDetails.rawMarks} PTS
                </div>
              </div>
            </div>

            <div className="stitch-modal-stats-grid" style={{ margin: '0' }}>
              <div className="modal-stat-box">
                <span className="modal-stat-val" style={{ color: '#00E699' }}>
                  {scoreDetails.correctCount}
                </span>
                <span className="modal-stat-label">CORRECT (+1.00)</span>
              </div>
              <div className="modal-stat-box">
                <span className="modal-stat-val" style={{ color: '#FF6B6B' }}>
                  {scoreDetails.incorrectCount}
                </span>
                <span className="modal-stat-label">INCORRECT (0.00)</span>
              </div>
              <div className="modal-stat-box">
                <span className="modal-stat-val" style={{ color: '#777777' }}>
                  {scoreDetails.unansweredCount}
                </span>
                <span className="modal-stat-label">SKIPPED / UNANSWERED (0.00)</span>
              </div>
            </div>

            {/* Live Round 3 Qualification Status Banner */}
            {(() => {
              const r3Qual = participant?.qualifications?.round3;
              if (r3Qual?.status === 'QUALIFIED') {
                return (
                  <div
                    style={{
                      margin: '16px 0',
                      padding: '16px 20px',
                      borderRadius: '14px',
                      background: 'rgba(16, 185, 129, 0.14)',
                      border: '1px solid rgba(16, 185, 129, 0.45)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '14px',
                      flexWrap: 'wrap',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ color: '#10B981', display: 'flex' }}>
                        <Icon name="trophy" size={24} />
                      </div>
                      <div style={{ textAlign: 'left' }}>
                        <div style={{ color: '#34D399', fontWeight: 800, fontSize: '0.95rem' }}>
                          CONGRATULATIONS! YOU HAVE QUALIFIED FOR THE ROUND 3 GRAND FINALE!
                        </div>
                        <div style={{ color: '#A7F3D0', fontSize: '0.82rem', marginTop: '2px' }}>
                          You have been officially selected to advance to Round 3 (Rapid Fire Showdown).
                        </div>
                      </div>
                    </div>
                  </div>
                );
              }
              if (r3Qual?.status === 'NOT_QUALIFIED') {
                return (
                  <div
                    style={{
                      margin: '16px 0',
                      padding: '16px 20px',
                      borderRadius: '14px',
                      background: 'rgba(239, 68, 68, 0.14)',
                      border: '1px solid rgba(239, 68, 68, 0.45)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '14px',
                      flexWrap: 'wrap',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ color: '#F87171', display: 'flex' }}>
                        <Icon name="x-circle" size={24} />
                      </div>
                      <div style={{ textAlign: 'left' }}>
                        <div style={{ color: '#FCA5A5', fontWeight: 800, fontSize: '0.95rem' }}>
                          OFFICIAL RESULT: NOT SELECTED FOR ROUND 3
                        </div>
                        <div style={{ color: '#FECACA', fontSize: '0.82rem', marginTop: '2px' }}>
                          You were not selected to advance from Round 2 to the Round 3 Grand Finale. Thank you for competing!
                        </div>
                      </div>
                    </div>
                  </div>
                );
              }
              return (
                <div
                  style={{
                    margin: '16px 0',
                    padding: '15px 20px',
                    borderRadius: '14px',
                    background: 'rgba(245, 158, 11, 0.12)',
                    border: '1px solid rgba(245, 158, 11, 0.4)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    textAlign: 'left',
                  }}
                >
                  <div style={{ color: '#FBBF24', display: 'flex', flexShrink: 0 }}>
                    <Icon name="clock" size={22} />
                  </div>
                  <div>
                    <div style={{ color: '#FDE68A', fontWeight: 800, fontSize: '0.9rem' }}>
                      AWAITING ROUND 3 QUALIFICATION RESULTS
                    </div>
                    <div style={{ color: '#FCD34D', fontSize: '0.8rem', marginTop: '2px' }}>
                      Your Round 2 submission is locked in. You will automatically receive a pop-up notification on this screen as soon as the administrator publishes the Grand Finale qualifiers.
                    </div>
                  </div>
                </div>
              );
            })()}

            <h3 style={{ margin: '12px 0 4px', fontSize: '1rem', color: '#E0E0E0' }}>
              Performance Diagnostic Log:
            </h3>

            <div className="result-breakdown-list">
              {roundQuestions.map((q, idx) => {
                const rev =
                  reviewData[q.id] ??
                  Object.values(reviewData).find((r) => r.sort_order === q.id);
                const userAns = selectedAnswers[q.id];
                const correctAnswer =
                  rev?.correct_answer !== undefined && rev?.correct_answer !== -1
                    ? rev.correct_answer
                    : (q.correctAnswer !== undefined && q.correctAnswer !== -1 ? q.correctAnswer : undefined);
                const isSkipped = userAns === undefined || userAns === null;
                const isCorrect = !isSkipped && correctAnswer !== undefined && userAns === correctAnswer;

                return (
                  <div
                    key={q.id}
                    className={`result-q-item ${
                      isSkipped ? 'skipped' : isCorrect ? 'correct' : 'incorrect'
                    }`}
                  >
                    <div className="result-q-head">
                      <span style={{ color: '#FFFFFF' }}>
                        Q{idx + 1}. {q.prompt}
                      </span>
                      <span
                        style={{
                          fontFamily: 'monospace',
                          color: isSkipped ? '#777777' : isCorrect ? '#00E699' : '#FF6B6B',
                        }}
                      >
                        {isSkipped
                          ? 'SKIPPED (0.0)'
                          : isCorrect
                            ? '✓ CORRECT (+1.0)'
                            : '✗ INCORRECT (0.0)'}
                      </span>
                    </div>
                    <div style={{ marginTop: '6px', fontSize: '0.85rem', color: '#B0B0B0' }}>
                      <span>Your answer: <strong>{userAns !== undefined && q.options[userAns] ? `${q.options[userAns].key}: ${q.options[userAns].label}` : 'None'}</strong></span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{ display: 'flex', justifyContent: 'center', gap: '14px', marginTop: '20px', flexWrap: 'wrap' }}>
              {onProceedToNextRound && (
                <button
                  type="button"
                  className="btn-save-next-prominent"
                  onClick={onProceedToNextRound}
                  id="btn-proceed-round-3"
                  style={
                    participant?.qualifications?.round3?.status === 'QUALIFIED'
                      ? { background: '#059669', borderColor: '#10B981' }
                      : participant?.qualifications?.round3?.status === 'NOT_QUALIFIED'
                        ? { background: '#7F1D1D', borderColor: '#EF4444' }
                        : { background: '#8E233B', borderColor: '#8E233B' }
                  }
                >
                  <span>
                    {participant?.qualifications?.round3?.status === 'QUALIFIED'
                      ? 'Proceed to Round 3 (Rapid Fire)'
                      : participant?.qualifications?.round3?.status === 'NOT_QUALIFIED'
                        ? 'View Round 3 Qualification Result'
                        : 'Check Round 3 Qualification Status'}
                  </span>
                  <Icon name="arrow-right" size={18} />
                </button>
              )}
              <button
                type="button"
                className="btn-save-next-prominent"
                onClick={onExit}
                id="btn-return-landing"
                style={{ background: '#292A2E', borderColor: '#414047' }}
              >
                <span>Return to Competition Arena</span>
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="stitch-exam-root" id="round2-exam-cockpit">
      {/* TOURNAMENT MASTER STATE: PAUSED OVERLAY */}
      {isCompetitionPaused && !isSubmitted && (
        <div className="modal-backdrop" style={{ zIndex: 999998, backdropFilter: 'blur(20px)', background: 'rgba(11, 14, 23, 0.88)' }}>
          <div className="credential-modal-card animate-fadeIn" style={{ maxWidth: '500px', textAlign: 'center', borderColor: '#F59E0B', boxShadow: '0 0 50px rgba(245, 158, 11, 0.3)' }}>
            <div style={{ color: '#F59E0B', marginBottom: '14px' }}>
              <Icon name="clock" size={44} />
            </div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '4px 14px', borderRadius: '20px', background: 'rgba(245, 158, 11, 0.15)', border: '1px solid rgba(245, 158, 11, 0.4)', color: '#F59E0B', fontSize: '0.75rem', fontWeight: 800, letterSpacing: '0.1em', marginBottom: '14px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#F59E0B', display: 'inline-block' }} />
              <span>TOURNAMENT MASTER STATE // PAUSED</span>
            </div>
            <h3 style={{ color: '#FFFFFF', fontSize: '1.35rem', fontWeight: 900, marginBottom: '10px' }}>
              Competition Temporarily Paused
            </h3>
            <p style={{ color: '#CBD5E1', fontSize: '0.9rem', lineHeight: 1.6, marginBottom: '20px' }}>
              The event administrator has paused the tournament. All question inputs and countdown timers across all candidate terminals are temporarily frozen.
            </p>
            <div style={{ padding: '16px 20px', background: 'rgba(245, 158, 11, 0.08)', borderRadius: '12px', border: '1px solid rgba(245, 158, 11, 0.25)', marginBottom: '18px' }}>
              <div style={{ fontSize: '0.72rem', letterSpacing: '0.12em', color: '#94A3B8', fontWeight: 800, textTransform: 'uppercase' }}>
                Your Clock is Frozen At
              </div>
              <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#F59E0B', fontFamily: 'monospace', marginTop: '4px' }}>
                {formattedTime}
              </div>
              <div style={{ fontSize: '0.78rem', color: '#CBD5E1', marginTop: '6px' }}>
                🔒 All selected answers are safely saved on the server. No time will be lost.
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', color: '#94A3B8', fontSize: '0.82rem' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#F59E0B', display: 'inline-block' }} />
              <span>Testing will resume automatically once the proctor sets status to Live.</span>
            </div>
          </div>
        </div>
      )}

      {/* Anti-cheat Proctor Warning Modal (Warning 1/2, Warning 2/2, or Auto-Submit on 3rd violation) */}
      {showWarningModal && (
        <div className="modal-backdrop" style={{ zIndex: 999999 }}>
          <div className="credential-modal-card" style={{ maxWidth: '460px', textAlign: 'center', borderColor: '#EF4444' }}>
            <div style={{ color: '#EF4444', marginBottom: '12px' }}>
              <Icon name="shield" size={36} />
            </div>
            <h3 style={{ color: '#EF4444', fontSize: '1.15rem', fontWeight: 800, marginBottom: '8px', letterSpacing: '0.05em' }}>
              {warningCount >= 3
                ? 'EXAM TERMINATED - AUTO-SUBMITTING'
                : warningCount === 2
                ? 'FINAL WARNING: 2 OF 2'
                : 'PROCTOR WARNING: 1 OF 2'}
            </h3>
            <p style={{ color: '#E5E7EB', fontSize: '0.88rem', lineHeight: 1.5, marginBottom: '16px' }}>
              {lastWarningMsg}
            </p>
            <div style={{ fontSize: '0.78rem', color: '#9CA3AF', marginBottom: '18px', padding: '8px 12px', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '6px', border: '1px solid rgba(239, 68, 68, 0.25)' }}>
              Infractions: <strong style={{ color: '#EF4444' }}>{warningCount} / 2</strong>.{' '}
              {warningCount >= 3
                ? 'Maximum warnings exceeded. Your answers are being submitted automatically now.'
                : 'Crucial: After 2 warnings, a 3rd infraction triggers immediate automatic submission.'}
            </div>
            {warningCount < 3 && !isTerminated ? (
              <button
                type="button"
                className="btn-modal-submit"
                style={{ background: '#EF4444' }}
                onClick={dismissWarning}
              >
                Acknowledge & Return to Exam
              </button>
            ) : (
              <div style={{ color: '#F87171', fontSize: '0.88rem', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '10px' }}>
                <Icon name="clock" size={18} />
                <span>Submitting responses to server... please wait</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ----------------------------------------------------------------------

          1. HEADER BAR
         ---------------------------------------------------------------------- */}
      <header className="stitch-header-bar">
        <div className="stitch-header-left">
          <button
            type="button"
            className="stitch-brand-header-btn"
            onClick={() => {
              if (window.confirm("Return to the Brain Bytes landing page? Your submitted answers and timer are saved on the server.")) {
                window.location.hash = '#/';
                window.dispatchEvent(new HashChangeEvent('hashchange'));
              }
            }}
            title="Brain Bytes - Return to Landing Page"
          >
            <img
              src="/brand-logo.png"
              alt="Brain Bytes Logo"
              className="stitch-brand-logo-img"
            />
            <span className="stitch-brand-logo">BRAIN BYTES</span>
            <span className="stitch-brand-sub">// DATA MANIA</span>
          </button>
          <span className="sys-tag-badge">[SYS_02]</span>

          <div className="stitch-round-pill">
            <span className="pill-dot" />
            <span className="pill-text">{ROUND_2_CONFIG.roundTitle}</span>
          </div>
        </div>

        <div className="stitch-header-right">
          {/* Participant ID */}
          <div className="header-meta-group">
            <span className="meta-group-label">PARTICIPANT ID</span>
            <span className="meta-group-val">{participantId}</span>
          </div>

          <div className="meta-divider" />

          {/* Assessment Matrix */}
          <div className="header-meta-group">
            <span className="meta-group-label">ASSESSMENT MATRIX</span>
            <span className="meta-group-val val-matrix">
              QUESTION <strong>{currentIndex + 1}</strong> OF {totalQuestions}
            </span>
          </div>

          <div className="meta-divider" />

          {/* Remaining Timer */}
          <div className="header-meta-group">
            <span className="meta-group-label">REMAINING</span>
            <span className="meta-group-val val-timer" title="Time remaining in Round 2">
              {formattedTime}
              <Icon name="clock" size={16} />
            </span>
          </div>

          {/* User Profile Avatar */}
          <div className="header-user-avatar" title={`Active: ${participantName}`}>
            <Icon name="users" size={18} />
          </div>

          {/* Exit / Return option */}
          <button
            type="button"
            className="header-btn-exit"
            onClick={onExit}
            title="Return to Landing Page"
          >
            Arena
          </button>
        </div>
      </header>

      {/* ----------------------------------------------------------------------
          2. MAIN COCKPIT: TWO COLUMNS
         ---------------------------------------------------------------------- */}
      <main className="stitch-main-layout">
        {/* ====================================================================
            LEFT COLUMN: QUESTION PALETTE
           ==================================================================== */}
        <aside className="stitch-palette-card" aria-label="Question Navigation Palette">
          {/* Palette Title Row */}
          <div className="palette-title-row">
            <div className="palette-heading-group">
              <span className="palette-pip" />
              <h2 className="palette-main-title">QUESTION PALETTE</h2>
            </div>
            <span className="palette-sec-badge">SEC: GRAPH_VIS</span>
          </div>

          {/* Counter Stats Row */}
          <div className="palette-stats-row">
            {/* Answered */}
            <div className="palette-stat-item">
              <span className="stat-header">ANSWERED</span>
              <div className="stat-numeric color-answered">
                {String(answeredCount).padStart(2, '0')}
                <span className="stat-suffix">/{totalQuestions}</span>
              </div>
            </div>

            {/* Review */}
            <div className="palette-stat-item">
              <span className="stat-header">REVIEW</span>
              <div className="stat-numeric color-review">
                {String(reviewCount).padStart(2, '0')}
                <span className="stat-suffix color-review"> flagged</span>
              </div>
            </div>

            {/* Unvisited */}
            <div className="palette-stat-item">
              <span className="stat-header">UNVISITED</span>
              <div className="stat-numeric color-unvisited">
                {String(unvisitedCount).padStart(2, '0')}
                <span className="stat-suffix color-unvisited"> left</span>
              </div>
            </div>
          </div>

          {/* Node Grid Meta Row */}
          <div className="palette-grid-meta-row">
            <span className="grid-sub-title">// NODE NAVIGATION GRID</span>
            <span className="grid-block-tag">BLOCK: 01-30</span>
          </div>

          {/* Question Nodes Grid */}
          <div className="palette-nodes-grid" role="group" aria-label="Question grid">
            {roundQuestions.map((q, idx) => {
              const isCurrent = idx === currentIndex;
              const hasAnswer = selectedAnswers[q.id] !== undefined;
              const isMarked = markedForReview.has(q.id);

              let stateClass = 'state-unvisited';
              if (hasAnswer && isMarked) {
                stateClass = 'state-ans-marked';
              } else if (hasAnswer) {
                stateClass = 'state-answered';
              } else if (isMarked) {
                stateClass = 'state-marked';
              }

              return (
                <button
                  key={q.id}
                  type="button"
                  id={`palette-node-r2-${q.id}`}
                  className={`palette-node-btn ${stateClass} ${isCurrent ? 'is-active' : ''}`}
                  onClick={() => handleSelectQuestion(idx)}
                  aria-label={`Question ${String(idx + 1).padStart(2, '0')}: ${hasAnswer ? 'Answered' : 'Unanswered'
                    } ${isMarked ? ', Marked for review' : ''}`}
                >
                  <span>{String(idx + 1).padStart(2, '0')}</span>

                  {isCurrent && !hasAnswer && !isMarked && (
                    <span className="node-corner-pip pip-orange" />
                  )}

                  {hasAnswer && !isMarked && (
                    <span className="node-corner-pip pip-green" />
                  )}

                  {!hasAnswer && isMarked && (
                    <span className="node-corner-pip pip-purple" />
                  )}

                  {hasAnswer && isMarked && (
                    <span className="node-dual-pips">
                      <span className="pip-dot-purple" />
                      <span className="pip-sq-green" />
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* State Legend */}
          <div className="palette-legend-section">
            <div className="legend-header-row">
              <span className="legend-title">STATE LEGEND</span>
              <span className="legend-version">[v2.4]</span>
            </div>

            <div className="legend-items-grid">
              <div className="legend-item">
                <span className="legend-box box-active" />
                <span>Current Active</span>
              </div>
              <div className="legend-item">
                <span className="legend-box box-answered" />
                <span>Answered</span>
              </div>
              <div className="legend-item">
                <span className="legend-box box-review" />
                <span>Marked Review</span>
              </div>
              <div className="legend-item">
                <span className="legend-box box-ans-marked" />
                <span>Ans + Marked</span>
              </div>
              <div className="legend-item full-width">
                <span className="legend-box box-unvisited" />
                <span>Unvisited / Not Attempted</span>
              </div>
            </div>
          </div>

          {/* Palette Bottom Status */}
          <div className="palette-heartbeat-bar">
            <span className="heartbeat-text">HEARTBEAT_ACK</span>
            <span className="heartbeat-status">
              <span className="pulse-dot-green" />
              ONLINE
            </span>
          </div>
        </aside>

        {/* ====================================================================
            RIGHT COLUMN: QUESTION PANEL
           ==================================================================== */}
        <section className="stitch-question-card" aria-label="Current Question Details">
          {/* Top Meta Row */}
          <div className="question-meta-top-row">
            <div className="meta-top-left">
              <span className="q-badge-orange">QUESTION {String(currentIndex + 1).padStart(2, '0')}</span>
              <span className="q-diamond-icon">◆</span>
              <span className="q-type-text">GRAPH INTERPRETATION CHALLENGE</span>
            </div>

            <div className="meta-top-right">
              <span className="q-marks-pill">
                <span className="marks-pos">+1.00 MARK</span>
                <span className="marks-slash">/</span>
                <span className="marks-neg">0.00 WRONG</span>
              </span>

              <span className="q-status-chip status-active">
                <span className={`status-dot ${statusDotClass}`} />
                <span>STATUS: {statusLabel}</span>
              </span>
            </div>
          </div>

          {/* Sub-meta Row */}
          <div className="question-sub-meta-row">
            <span>INDEX REF: {currentQuestion.indexRef}</span>
            <span>DIFFICULTY COEFFICIENT: {currentQuestion.difficulty}</span>
          </div>

          {/* Question Framing Box */}
          <div className="question-framing-box">
            <span className="tech-corner-cross cross-tl">+</span>
            <span className="tech-corner-cross cross-tr">+</span>

            <h3 className="question-prompt-text">{currentQuestion.prompt}</h3>

            {/* Embedded Graph Chart */}
            <GraphVisualizer chartData={currentQuestion.chartData} />

            <div className="question-domain-line">
              <span>🗂 DATASET_DOMAIN: {currentQuestion.domain}</span>
              <span className="domain-bullet">•</span>
              <span>⚙ PARADIGM: {currentQuestion.paradigm}</span>
            </div>
          </div>

          {/* Options List */}
          <div className="question-options-list" role="radiogroup" aria-label="Answer options">
            {currentQuestion.options.map((opt, optIdx) => {
              const isSelected = selectedAnswers[currentQuestion.id] === optIdx;

              return (
                <div
                  key={opt.key}
                  role="radio"
                  tabIndex={0}
                  aria-checked={isSelected}
                  id={`opt-r2-${currentQuestion.id}-${opt.key}`}
                  className={`stitch-option-row ${isSelected ? 'is-selected' : ''}`}
                  onClick={() => handleOptionClick(optIdx)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleOptionClick(optIdx);
                    }
                  }}
                >
                  <div className="option-left-cluster">
                    <div className="option-key-box">{opt.key}</div>
                    <div className="option-text-cluster">
                      <span className="option-main-label">{opt.label}</span>
                    </div>
                  </div>

                  <div className="option-right-cluster">
                    {isSelected ? (
                      <>
                        <span className="option-selected-tag">[SELECTED]</span>
                        <button
                          type="button"
                          className="option-clear-x-btn"
                          title="Deselect this answer"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleClearResponse();
                          }}
                        >
                          ✕
                        </button>
                      </>
                    ) : (
                      <span className="option-unselected-box" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Proctoring & Autosave Sensor Bar */}
          <div className="proctor-sensors-bar">
            <div className="sensor-state-left">
              <Icon name="shield" size={14} />
              <span>PROCTORING SENSORS: VIDEO_AUDIO_TAB_FOCUS = STABLE</span>
            </div>
            <div className="sensor-state-right">
              <span>AUTOSAVE STATE: BUFFER_COMMITTED_LOCAL</span>
            </div>
          </div>

          {/* Exam Action Buttons Bar */}
          <div className="exam-actions-bar">
            {/* Left: Mark For Review */}
            <div className="actions-left-group">
              <button
                type="button"
                id="btn-mark-review-r2"
                className={`btn-terminal-action btn-review-toggle ${isCurrentMarked ? 'is-marked' : ''
                  }`}
                onClick={handleToggleReview}
              >
                <Icon name="ticket" size={14} />
                <span>{isCurrentMarked ? 'MARKED FOR REVIEW ✓' : 'MARK FOR REVIEW'}</span>
              </button>
            </div>

            {/* Middle: Clear & Prev / Next */}
            <div className="actions-mid-group">
              <button
                type="button"
                id="btn-clear-response-r2"
                className="btn-terminal-action btn-clear-choice"
                onClick={handleClearResponse}
                disabled={!isCurrentAnswered}
              >
                <Icon name="close" size={14} />
                <span>CLEAR RESPONSE</span>
              </button>

              <button
                type="button"
                id="btn-nav-prev-r2"
                className="btn-terminal-action"
                onClick={handlePrev}
                disabled={currentIndex === 0}
              >
                <span>← PREVIOUS</span>
              </button>

              <button
                type="button"
                id="btn-nav-next-r2"
                className="btn-terminal-action"
                onClick={handleNext}
                disabled={currentIndex === totalQuestions - 1}
              >
                <span>NEXT →</span>
              </button>
            </div>

            {/* Right: Save & Next and Submit Test Buttons */}
            <div className="actions-right-group">
              <button
                type="button"
                id="btn-save-next-r2"
                className="btn-terminal-action btn-save-action"
                onClick={handleSaveAndNext}
                disabled={currentIndex === totalQuestions - 1}
              >
                <span>SAVE & MOVE TO NEXT</span>
                <Icon name="arrow-right" size={14} />
              </button>

              <button
                type="button"
                id="btn-submit-test-r2"
                className="btn-save-next-prominent"
                onClick={() => setIsSubmitModalOpen(true)}
              >
                <span>SUBMIT TEST</span>
                <Icon name="check-circle" size={16} />
              </button>
            </div>
          </div>
        </section>
      </main>

      {/* ----------------------------------------------------------------------
          3. BOTTOM TERMINAL FOOTER
         ---------------------------------------------------------------------- */}
      <footer className="stitch-exam-footer">
        <div>
          TERMINAL: EXEC_NODE_05 &nbsp;&nbsp; ENCRYPTION: AES-256 &nbsp;&nbsp; STATE: SESSION_RECORDING
        </div>
        <div>DATA MANIA © 2025 // STRICT TELEMETRY ENFORCED</div>
      </footer>

      {/* Auto-submit / submission in-flight overlay */}
      {isSubmitting && !isSubmitted && (
        <div className="stitch-modal-overlay" style={{ zIndex: 9999 }} role="dialog" aria-modal="true">
          <div className="stitch-modal-card" style={{ textAlign: 'center', padding: '32px 24px' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '48px', height: '48px', borderRadius: '50%', background: 'rgba(255, 107, 0, 0.15)', color: '#FF6B00', marginBottom: '16px' }}>
              <Icon name="clock" size={28} />
            </div>
            <h3 className="stitch-modal-title" style={{ margin: '0 0 8px' }}>Submitting Responses...</h3>
            <p className="stitch-modal-desc" style={{ margin: 0 }}>
              Exam telemetry and responses are being committed to the server. Please wait...
            </p>
          </div>
        </div>
      )}

      {/* ----------------------------------------------------------------------
          4. CONFIRM SUBMISSION MODAL
         ---------------------------------------------------------------------- */}
      {isSubmitModalOpen && (
        <div className="stitch-modal-overlay" role="dialog" aria-modal="true">
          <div className="stitch-modal-card">
            <div className="stitch-modal-header">
              <Icon name="alert-circle" size={24} className="text-molten" />
              <h3 className="stitch-modal-title">Confirm Final Submission</h3>
            </div>

            <p className="stitch-modal-desc">
              Are you sure you want to submit your test? You may have unanswered questions.
            </p>

            {submitError && (
              <div>
                <div style={{ background: 'rgba(255, 77, 77, 0.15)', border: '1px solid rgba(255, 77, 77, 0.4)', color: '#FF6B6B', padding: '10px 14px', borderRadius: '8px', marginBottom: (submitError.includes('Access Code') || submitError.includes('Authentication')) ? '10px' : '16px', fontSize: '0.88rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Icon name="alert-circle" size={18} />
                  <span>{submitError}</span>
                </div>
                {(submitError.includes('Access Code') || submitError.includes('Authentication')) && (
                  <div style={{ background: 'rgba(255, 107, 0, 0.1)', border: '1px solid rgba(255, 107, 0, 0.3)', borderRadius: '8px', padding: '10px 12px', marginBottom: '16px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <input
                      type="text"
                      placeholder="Enter Access Code"
                      value={reauthCode}
                      onChange={(e) => setReauthCode(e.target.value.toUpperCase())}
                      style={{ flex: 1, background: '#1c1b1f', border: '1px solid #414047', color: '#fff', borderRadius: '6px', padding: '8px 12px', fontSize: '0.88rem' }}
                    />
                    <button
                      type="button"
                      onClick={() => handleConfirmSubmit(reauthCode)}
                      style={{ background: '#8E233B', color: '#fff', border: 'none', borderRadius: '6px', padding: '8px 14px', fontWeight: 600, fontSize: '0.82rem', cursor: 'pointer', whiteSpace: 'nowrap' }}
                    >
                      Reconnect & Submit
                    </button>
                  </div>
                )}
              </div>
            )}

            <div className="stitch-modal-stats-grid">
              <div className="modal-stat-box">
                <span className="modal-stat-val" style={{ color: '#00E699' }}>
                  {answeredCount}
                </span>
                <span className="modal-stat-label">ANSWERED</span>
              </div>
              <div className="modal-stat-box">
                <span className="modal-stat-val" style={{ color: '#A855F7' }}>
                  {reviewCount}
                </span>
                <span className="modal-stat-label">FOR REVIEW</span>
              </div>
              <div className="modal-stat-box">
                <span className="modal-stat-val" style={{ color: '#F5F5F5' }}>
                  {totalQuestions - answeredCount}
                </span>
                <span className="modal-stat-label">UNANSWERED</span>
              </div>
            </div>

            <div className="stitch-modal-actions">
              <button
                type="button"
                className="btn-terminal-action"
                onClick={() => setIsSubmitModalOpen(false)}
              >
                Return to Test
              </button>

              <button
                type="button"
                className="btn-save-next-prominent"
                onClick={() => handleConfirmSubmit(reauthCode)}
                id="btn-confirm-final-submit-r2"
              >
                <span>Commit & Finalize</span>
                <Icon name="check-circle" size={16} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
