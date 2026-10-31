/**
 * Brain Bytes — Master Load Testing & Performance Audit Configuration
 *
 * Centralizes target URLs, competition workload parameters discovered from source,
 * Phase 8 performance benchmark targets, k6 thresholds, and test identity prefixes.
 */

export const BASE_URL =
  typeof __ENV !== 'undefined' && __ENV.BASE_URL
    ? __ENV.BASE_URL
    : typeof process !== 'undefined' && process.env?.BASE_URL
      ? process.env.BASE_URL
      : 'http://127.0.0.1:4000';

export const BENCHMARK_TARGETS = {
  concurrentParticipants: 200,
  latency: {
    p95MaxMs: 500,
    p99MaxMs: 1000,
  },
  reliability: {
    maxHttpErrorRate: 0.01, // < 1%
    submissionDataLoss: 0,
    unexplainedDuplicates: 0,
    crossParticipantCorruption: 0,
    dbConnectionLeaks: 0,
  },
  sustainedDurationMinutes: 15,
};

export const K6_THRESHOLDS = {
  http_req_duration: ['p(95)<500', 'p(99)<1000'],
  http_req_failed: ['rate<0.01'],
};

export const LOAD_TEST_CONFIG = {
  baseUrl: BASE_URL,
  userPrefix: 'LOADTEST_USER_',
  maxConcurrency: 200,
  rounds: {
    1: {
      id: 1,
      name: 'Round 1: Data MCQ',
      durationSeconds: 600,
      questionCount: 50,
      pointsCorrect: 1,
      pointsWrong: 0,
      pointsUnanswered: 0,
    },
    2: {
      id: 2,
      name: 'Round 2: Graph Challenge',
      durationSeconds: 600,
      questionCount: 30,
      pointsCorrect: 1,
      pointsWrong: 0,
      pointsUnanswered: 0,
    },
    3: {
      id: 3,
      name: 'Round 3: Rapid Fire',
      durationSeconds: 180,
      questionCount: 30,
      pointsCorrect: 5,
      pointsWrong: -2,
      pointsUnanswered: 0,
    },
  },
  pollingIntervalsMs: {
    competitionStateApp: 3000,
    competitionStateBroadcast: 3000,
    participantMe: 3500,
    activeDeadline: 2500,
    adminDashboard: 2500,
  },
  benchmarks: BENCHMARK_TARGETS,
};

/**
 * Generates a deterministic, traceable test identity for virtual participant index (1..200).
 * Matches actual `participants` schema (`name`, `email`, `access_code`).
 * Never shares credentials or sessions across virtual users.
 */
export function getLoadTestIdentity(index) {
  const padded = String(index).padStart(3, '0');
  const idLabel = `LOADTEST_USER_${padded}`;
  return {
    index,
    idLabel,
    name: idLabel,
    email: `loadtest_user_${padded}@loadtest.brainbytes.local`,
    accessCode: `BB-LOADTEST-${padded}`,
  };
}
