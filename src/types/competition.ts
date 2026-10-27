export type RoundStatus = 'locked' | 'active' | 'completed';

export type RoundStateMap = Record<number, RoundStatus>;

export interface Participant {
  id?: number;
  fullName: string;
  rollNumber: string;
  joinCode?: string;
  registeredAt: string;
  ticketId: string;
  assignedSeat: string;
  collegeName?: string;
  status: 'verified' | 'checked-in' | 'lobby-waiting';
  attempts?: Array<{
    id: number;
    roundId: number;
    startedAt: string;
    deadlineAt: string;
    submittedAt: string | null;
    score: number | null;
    correctCount: number | null;
    incorrectCount: number | null;
    unansweredCount: number | null;
    timeTakenSeconds: number | null;
  }>;
}

export interface CompetitionRound {
  id: number;
  numberStr: string;
  title: string;
  slug: string;
  isElimination: boolean;
  stageBadge: string;
  shortDesc: string;
  fullDesc: string;
  duration: string;
  questionsCount: string;
  qualificationCriteria: string;
  topics: string[];
  accentColor: string;
  samplePreview: {
    questionTitle: string;
    description: string;
    sampleDataHint: string;
  };
}

export interface TimelineEvent {
  id: string;
  time: string;
  title: string;
  phase: string;
  description: string;
  status?: 'completed' | 'active' | 'upcoming';
  isCurrent?: boolean;
}

export interface FAQItem {
  id: string;
  question: string;
  answer: string;
  tag: string;
}

export interface PrizeItem {
  rank: string;
  title: string;
  reward: string;
  perks: string[];
  isGrand?: boolean;
}

export interface LeaderboardEntry {
  id: string;
  rank: number;
  name: string;
  rollNumber: string;
  collegeName: string;
  round1Score: number;
  round2Score: number;
  round3Score: number;
  totalScore: number;
  stage: 'Qualified R1' | 'Top 8 Finalist' | 'Podium Winner' | 'Participant';
  lastActive: string;
  timeTakenSeconds?: number;
}

export interface AdminSettings {
  isRegistrationOpen: boolean;
  activeJoinCodes: string[];
  arenaNotice: string;
  roundStates: RoundStateMap;
  adminCustomized?: boolean;
}

export const DEFAULT_ADMIN_SETTINGS: AdminSettings = {
  isRegistrationOpen: true,
  activeJoinCodes: ['BYTE2026', 'DATAMANIA26', 'SOLAR26'],
  arenaNotice: 'Welcome to Data Mania: Brain Bytes 2026.',
  roundStates: {
    1: 'active',
    2: 'locked',
    3: 'locked',
  },
};

export interface AdminLeaderboardEntry {
  rank: number;
  rankStr: string;
  name: string;
  systemId: string;
  institution: string;
  score: number;
  scoreStr: string;
  accuracy: number;
  accuracyStr: string;
  latency: string;
  tier: 'champion' | 'silver' | 'bronze' | 'qualifier';
}

export interface ParticipantRoundDetail {
  roundId: number;
  status: 'COMPLETED' | 'IN_PROGRESS' | 'ELIGIBLE' | 'READY' | 'LOCKED';
  submitted: boolean;
  started: boolean;
  eligible?: boolean;
  score: number | null;
  solvedCount: number;
  totalQuestions: number;
  timeTakenSeconds: number;
  submittedAt: string | null;
}

export interface RegistryParticipant {
  id: string;
  initials: string;
  name: string;
  campus: string;
  rollNumber: string;
  node: string;
  round: string;
  statusType: 'in-progress' | 'flagged-focus' | 'flagged-audio' | 'completed';
  statusLabel: string;
  solvedCount: number;
  totalQuestions: number;
  accuracy: number;
  activeItem: string;
  itemDwellSec: number;
  webcamFps?: number;
  tabFocusPct?: number;
  pingMs?: number;
  confidence?: 'HIGH' | 'MEDIUM' | 'LOW';
  eyeGaze?: string;
  facesDetected?: number;
  questionGrid?: ('answered' | 'review' | 'pending')[];
  totalScore?: number;
  score?: number;
  participatingRounds?: string[];
  rounds?: Record<number, ParticipantRoundDetail>;
}

export interface RoundChallengeQuestion {
  id: number;
  title: string;
  prompt: string;
  options: string[];
  correctAnswer: number;
  hint: string;
  codeSnippet?: string;
}
