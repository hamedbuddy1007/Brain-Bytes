export type RoundStatus = 'locked' | 'active' | 'completed';

export type RoundStateMap = Record<number, RoundStatus>;

export interface Participant {
  fullName: string;
  rollNumber: string;
  joinCode: string;
  registeredAt: string;
  ticketId: string;
  assignedSeat: string;
  collegeName?: string;
  status: 'verified' | 'checked-in' | 'lobby-waiting';
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

export interface RoundChallengeQuestion {
  id: number;
  title: string;
  prompt: string;
  options: string[];
  correctAnswer: number;
  hint: string;
  codeSnippet?: string;
}
