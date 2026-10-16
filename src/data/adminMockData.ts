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

export const ADMIN_PROJECTOR_LEADERBOARD: AdminLeaderboardEntry[] = [
  {
    rank: 1,
    rankStr: '01',
    name: 'A. Sharma',
    systemId: 'BB-2025-0104',
    institution: 'IIT BOMBAY',
    score: 20.0,
    scoreStr: '20.00 PTS',
    accuracy: 100,
    accuracyStr: '100%',
    latency: '07m 14s',
    tier: 'champion',
  },
  {
    rank: 2,
    rankStr: '02',
    name: 'R. Iyer',
    systemId: 'BB-2025-0218',
    institution: 'MIT TECH',
    score: 19.0,
    scoreStr: '19.00 PTS',
    accuracy: 95.0,
    accuracyStr: '95.0%',
    latency: '07m 48s',
    tier: 'silver',
  },
  {
    rank: 3,
    rankStr: '03',
    name: 'K. Patel',
    systemId: 'BB-2025-0045',
    institution: 'BITS PILANI',
    score: 19.0,
    scoreStr: '19.00 PTS',
    accuracy: 95.0,
    accuracyStr: '95.0%',
    latency: '08m 10s',
    tier: 'bronze',
  },
  {
    rank: 4,
    rankStr: '04',
    name: 'V. Raghavan',
    systemId: 'BB-2025-0312',
    institution: 'DELHI TECHNOLOGICAL UNIVERSITY',
    score: 18.0,
    scoreStr: '18.00 PTS',
    accuracy: 90.0,
    accuracyStr: '90.0%',
    latency: '08m 22s',
    tier: 'qualifier',
  },
  {
    rank: 5,
    rankStr: '05',
    name: 'S. Mukherjee',
    systemId: 'BB-2025-0144',
    institution: 'JADAVPUR UNIVERSITY',
    score: 18.0,
    scoreStr: '18.00 PTS',
    accuracy: 90.0,
    accuracyStr: '90.0%',
    latency: '08m 45s',
    tier: 'qualifier',
  },
  {
    rank: 6,
    rankStr: '06',
    name: 'T. Sen',
    systemId: 'BB-2025-0409',
    institution: 'NATIONAL INSTITUTE OF TECH TRICHY',
    score: 18.0,
    scoreStr: '18.00 PTS',
    accuracy: 90.0,
    accuracyStr: '90.0%',
    latency: '08m 52s',
    tier: 'qualifier',
  },
  {
    rank: 7,
    rankStr: '07',
    name: 'P. Deshmukh',
    systemId: 'BB-2025-0087',
    institution: 'COLLEGE OF ENGINEERING PUNE',
    score: 17.0,
    scoreStr: '17.00 PTS',
    accuracy: 85.0,
    accuracyStr: '85.0%',
    latency: '09m 04s',
    tier: 'qualifier',
  },
  {
    rank: 8,
    rankStr: '08',
    name: 'M. Nair',
    systemId: 'BB-2025-0189',
    institution: 'IIIT HYDERABAD',
    score: 17.0,
    scoreStr: '17.00 PTS',
    accuracy: 85.0,
    accuracyStr: '85.0%',
    latency: '09m 11s',
    tier: 'qualifier',
  },
  {
    rank: 9,
    rankStr: '09',
    name: 'A. Banerjee',
    systemId: 'BB-2025-0523',
    institution: 'IIT KHARAGPUR',
    score: 17.0,
    scoreStr: '17.00 PTS',
    accuracy: 85.0,
    accuracyStr: '85.0%',
    latency: '09m 18s',
    tier: 'qualifier',
  },
  {
    rank: 10,
    rankStr: '10',
    name: 'N. Verma',
    systemId: 'BB-2025-0271',
    institution: 'SRM INSTITUTE CHENNAI',
    score: 16.0,
    scoreStr: '16.00 PTS',
    accuracy: 80.0,
    accuracyStr: '80.0%',
    latency: '09m 30s',
    tier: 'qualifier',
  },
];

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
  webcamFps: number;
  tabFocusPct: number;
  pingMs: number;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  eyeGaze: string;
  facesDetected: number;
  questionGrid: ('answered' | 'review' | 'pending')[];
}

export const ADMIN_REGISTRY_PARTICIPANTS: RegistryParticipant[] = [
  {
    id: 'p-1',
    initials: 'AK',
    name: 'AARAV KRISHNAN',
    campus: 'BITS PILANI // DEPT. CS',
    rollNumber: 'BB-2025-0842',
    node: 'NODE_04',
    round: 'R-01 // MCQ',
    statusType: 'in-progress',
    statusLabel: 'IN-PROGRESS [18/20]',
    solvedCount: 18,
    totalQuestions: 20,
    accuracy: 94.5,
    activeItem: 'Q-19 (BAYESIAN REGRESSION)',
    itemDwellSec: 42,
    webcamFps: 30,
    tabFocusPct: 100,
    pingMs: 12,
    confidence: 'HIGH',
    eyeGaze: 'CENTER (90.4%)',
    facesDetected: 1,
    questionGrid: [
      'answered', 'answered', 'answered', 'answered', 'answered',
      'answered', 'answered', 'answered', 'answered', 'answered',
      'answered', 'answered', 'answered', 'answered', 'answered',
      'answered', 'review', 'review', 'pending', 'pending',
    ],
  },
  {
    id: 'p-2',
    initials: 'DS',
    name: 'DEVVRAT SHARMA',
    campus: 'IIT BOMBAY // DATA ENG',
    rollNumber: 'BB-2025-0319',
    node: 'NODE_12',
    round: 'R-01 // MCQ',
    statusType: 'flagged-focus',
    statusLabel: 'FLAGGED: FOCUS LOSS',
    solvedCount: 12,
    totalQuestions: 20,
    accuracy: 88.0,
    activeItem: 'Q-13 (K-MEANS DISTORTION)',
    itemDwellSec: 78,
    webcamFps: 28,
    tabFocusPct: 82,
    pingMs: 18,
    confidence: 'MEDIUM',
    eyeGaze: 'OFF-SCREEN (64.2%)',
    facesDetected: 1,
    questionGrid: [
      'answered', 'answered', 'answered', 'answered', 'answered',
      'answered', 'answered', 'answered', 'answered', 'answered',
      'answered', 'answered', 'pending', 'pending', 'pending',
      'pending', 'review', 'pending', 'pending', 'pending',
    ],
  },
  {
    id: 'p-3',
    initials: 'SL',
    name: 'SNEHA LAKSHMI',
    campus: 'NIT TRICHY // AI LABS',
    rollNumber: 'BB-2025-1104',
    node: 'NODE_08',
    round: 'R-01 // MCQ',
    statusType: 'completed',
    statusLabel: 'COMPLETED',
    solvedCount: 20,
    totalQuestions: 20,
    accuracy: 96.0,
    activeItem: 'ALL COMPLETED',
    itemDwellSec: 0,
    webcamFps: 30,
    tabFocusPct: 100,
    pingMs: 10,
    confidence: 'HIGH',
    eyeGaze: 'CENTER (98.0%)',
    facesDetected: 1,
    questionGrid: Array(20).fill('answered'),
  },
  {
    id: 'p-4',
    initials: 'RP',
    name: 'ROHAN PATEL',
    campus: 'IIIT HYDERABAD // STATS',
    rollNumber: 'BB-2025-0551',
    node: 'NODE_19',
    round: 'R-01 // MCQ',
    statusType: 'in-progress',
    statusLabel: 'IN-PROGRESS [14/20]',
    solvedCount: 14,
    totalQuestions: 20,
    accuracy: 91.2,
    activeItem: 'Q-15 (PCA EIGENVECTORS)',
    itemDwellSec: 31,
    webcamFps: 30,
    tabFocusPct: 98,
    pingMs: 14,
    confidence: 'HIGH',
    eyeGaze: 'CENTER (92.1%)',
    facesDetected: 1,
    questionGrid: [
      'answered', 'answered', 'answered', 'answered', 'answered',
      'answered', 'answered', 'answered', 'answered', 'answered',
      'answered', 'answered', 'answered', 'answered', 'pending',
      'pending', 'pending', 'review', 'pending', 'pending',
    ],
  },
  {
    id: 'p-5',
    initials: 'TC',
    name: 'TANVI CHATTERJEE',
    campus: 'JADAVPUR UNIV // MATH',
    rollNumber: 'BB-2025-0720',
    node: 'NODE_41',
    round: 'R-01 // MCQ',
    statusType: 'flagged-audio',
    statusLabel: 'FLAGGED: AUDIO SPIKE',
    solvedCount: 16,
    totalQuestions: 20,
    accuracy: 90.0,
    activeItem: 'Q-17 (MAXIMUM LIKELIHOOD)',
    itemDwellSec: 54,
    webcamFps: 30,
    tabFocusPct: 99,
    pingMs: 16,
    confidence: 'HIGH',
    eyeGaze: 'CENTER (89.5%)',
    facesDetected: 1,
    questionGrid: [
      'answered', 'answered', 'answered', 'answered', 'answered',
      'answered', 'answered', 'answered', 'answered', 'answered',
      'answered', 'answered', 'answered', 'answered', 'answered',
      'answered', 'review', 'pending', 'pending', 'pending',
    ],
  },
  {
    id: 'p-6',
    initials: 'VM',
    name: 'VIKRAMADITYA MEHTA',
    campus: 'DTU // SOFTWARE ENG',
    rollNumber: 'BB-2025-0199',
    node: 'NODE_55',
    round: 'R-01 // MCQ',
    statusType: 'in-progress',
    statusLabel: 'IN-PROGRESS [20/20]',
    solvedCount: 20,
    totalQuestions: 20,
    accuracy: 92.5,
    activeItem: 'REVIEWING ANSWERS',
    itemDwellSec: 19,
    webcamFps: 30,
    tabFocusPct: 100,
    pingMs: 11,
    confidence: 'HIGH',
    eyeGaze: 'CENTER (94.0%)',
    facesDetected: 1,
    questionGrid: [
      'answered', 'answered', 'answered', 'answered', 'answered',
      'answered', 'answered', 'answered', 'answered', 'answered',
      'answered', 'answered', 'answered', 'answered', 'answered',
      'answered', 'review', 'review', 'answered', 'answered',
    ],
  },
];

export interface ProctorFlagItem {
  id: string;
  node: string;
  code: string;
  severity: 'critical' | 'warning';
  participantName: string;
  participantId: string;
  detail: string;
  secondaryInfo: string;
}

export const ADMIN_PROCTOR_FLAGS: ProctorFlagItem[] = [
  {
    id: 'fl-1',
    node: 'TERMINAL-NODE #042',
    code: 'MULTI_WINDOW_FOCUS_LOST',
    severity: 'critical',
    participantName: 'S. Rahman',
    participantId: 'DM-2041',
    detail: 'Tab-switched 4 times within 45s.',
    secondaryInfo: 'LAST BLUR DURATION: 3.2s // AUTO-SNAPSHOT RECORDED',
  },
  {
    id: 'fl-2',
    node: 'TERMINAL-NODE #109',
    code: 'BURST_LATENCY_SPIKE',
    severity: 'warning',
    participantName: 'E. Vance',
    participantId: 'DM-1892',
    detail: 'WebSocket ping delayed by 1,420ms.',
    secondaryInfo: 'STATUS: BUFFERING LOCALLY // RESYNCING SUBMISSIONS',
  },
];

export interface AuditTrailLog {
  time: string;
  node: string;
  message: string;
}

export const ADMIN_AUDIT_LOGS: AuditTrailLog[] = [
  {
    time: '14:20:11 UTC',
    node: 'BB-ADMIN-01',
    message: 'R-01 Entry Gate manually opened for batch. 342 invitations activated.',
  },
  {
    time: '14:15:30 UTC',
    node: 'BB-SYS-CRON',
    message: 'Automated dataset parity check completed. Round 2 graph caches populated (12/12 valid).',
  },
  {
    time: '14:02:44 UTC',
    node: 'BB-ADMIN-02',
    message: 'Question Bank R-01 verified. 40 items locked with CRC32: 9F40EA12.',
  },
  {
    time: '13:50:18 UTC',
    node: 'BB-ROOT-AUTH',
    message: 'Master security session initialized from Auditorium Core Desk #01.',
  },
];
