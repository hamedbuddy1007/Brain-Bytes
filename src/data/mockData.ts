import type {
  CompetitionRound,
  TimelineEvent,
  FAQItem,
  PrizeItem,
  LeaderboardEntry,
  AdminSettings,
  RoundChallengeQuestion,
} from '../types/competition';

export const COMPETITION_ROUNDS: CompetitionRound[] = [
  {
    id: 1,
    numberStr: '01',
    title: 'Data MCQ',
    slug: 'data-mcq',
    isElimination: true,
    stageBadge: 'Elimination Round',
    shortDesc:
      'High-velocity screening testing statistical intuition, probability distributions, SQL queries, and core machine learning fundamentals.',
    fullDesc:
      'The opening screening phase of Brain Bytes under Data Mania. Participants tackle 30 curated multiple-choice challenges spanning exploratory data analysis, Pandas manipulation, probability distributions, matrix operations, and foundational ML assumptions. Accuracy and swift execution determine who crosses the elimination line.',
    duration: '45 Minutes',
    questionsCount: '30 Questions',
    qualificationCriteria: 'Top 40% scorers qualify for Round 2',
    topics: [
      'Probability & Bayes Theorem',
      'Descriptive & Inferential Stats',
      'SQL Joins & Window Functions',
      'NumPy & Pandas Vectorization',
      'Hypothesis Testing & p-values',
      'Bias-Variance Tradeoff',
    ],
    accentColor: '#8E233B', // Rich Maroon
    samplePreview: {
      questionTitle: 'Feature Scaling Impact on Distance Metrics',
      description:
        'A dataset has two numeric features: Salary (range 20,000–250,000) and Age (range 18–65). If K-Means clustering is fitted without normalization, what is the primary geometric distortion?',
      sampleDataHint:
        'Insight: Euclidean distance computation is overwhelmingly dominated by the high-variance magnitude axis, rendering age nearly irrelevant in cluster centroid calculations.',
    },
  },
  {
    id: 2,
    numberStr: '02',
    title: 'Graph Challenge',
    slug: 'graph-challenge',
    isElimination: true,
    stageBadge: 'Elimination Round',
    shortDesc:
      'Visual analytical problem-solving. Decode hidden patterns, anomalies, confounding variables, and statistical shifts concealed inside complex data plots.',
    fullDesc:
      'Real-world data science demands visual forensic mastery. In Round 2, participants analyze 5 multi-layered visual graph scenarios—ranging from confounding correlation matrices and ROC curve traps to high-dimensional manifold projections and non-stationary time series drift. Identify the root phenomenon before time expires.',
    duration: '60 Minutes',
    questionsCount: '5 Visual Case Studies',
    qualificationCriteria: 'Top 8 Teams advance to Grand Finale',
    topics: [
      'Correlation Matrix & Multicollinearity',
      'Residual Heteroscedasticity Plots',
      'ROC-AUC & Precision-Recall Curves',
      't-SNE / UMAP Clustered Manifolds',
      'Time-Series Seasonality & Drift',
      'Simpson’s Paradox Visualizations',
    ],
    accentColor: '#B94B68', // Secondary Maroon Highlight
    samplePreview: {
      questionTitle: 'Deciphering Simpson’s Paradox in Bivariate Scatter',
      description:
        'When plotting Treatment dosage vs Recovery rate across an aggregated cohort, the trend slope is -0.42. However, upon conditioning on Patient Severity Subgroups (A, B, C), each group displays a +0.68 positive correlation.',
      sampleDataHint:
        'Insight: A classic confounding effect where severe patients received higher dosages. Conditioning on the confounder reverses the apparent relationship.',
    },
  },
  {
    id: 3,
    numberStr: '03',
    title: 'Rapid Fire',
    slug: 'rapid-fire',
    isElimination: false,
    stageBadge: 'Championship Grand Finale',
    shortDesc:
      'High-pressure, real-time stage buzzer round. The top 8 finalist teams duel on live data puzzles to crown the ultimate champions.',
    fullDesc:
      'The crown of Brain Bytes under Data Mania. Streamed live on the grand auditorium projector, the top 8 finalist squads face rapid-fire analytical prompts. Fast buzzer reflexes, instant mathematical intuition, and spot-the-bug diagnostics under ticking seconds determine the podium winners. Marking rules: +5 for correct, −2 for incorrect, and 0 for unanswered.',
    duration: '3 Minutes',
    questionsCount: '5 Live Buzzer Prompts',
    qualificationCriteria: 'Direct Points Podium: +5 for correct, −2 for incorrect, 0 for unanswered',
    topics: [
      'Instant Metric Calculation',
      'Paradox & Edge Case Identification',
      'Python Data Bug Spotting',
      'Algorithmic Time Complexity',
      'Loss Function Mechanics',
      'Real-Time Strategy & Reflexes',
    ],
    accentColor: '#8E233B', // Rich Maroon
    samplePreview: {
      questionTitle: 'Instant Metric Diagnosis under Class Imbalance',
      description:
        'A binary fraud classifier has 99.8% raw accuracy on a test set of 10,000 transactions where 20 are fraudulent. If the model predicted "Not Fraud" for every single transaction, what is its Recall score?',
      sampleDataHint:
        'Instant Answer: 0.00 (0%). Accuracy is deceptive under extreme class imbalance because True Positives = 0.',
    },
  },
];

export const DEFAULT_ADMIN_SETTINGS: AdminSettings = {
  isRegistrationOpen: true,
  activeJoinCodes: ['BYTE2026', 'DATAMANIA26', 'SOLAR26'],
  arenaNotice: 'DATA MANIA Arena is live. Round 1, Round 2, and Round 3 are accessible to registered participants.',
  roundStates: {
    1: 'active',   // Round 1 is enabled by default
    2: 'active',   // Round 2 enabled by default
    3: 'active',   // Round 3 enabled by default
  },
};

export const INITIAL_LEADERBOARD: LeaderboardEntry[] = [
  {
    id: 'ld-1',
    rank: 1,
    name: 'Aarav Sharma & Team Synapse',
    rollNumber: 'CS23-B1042',
    collegeName: 'School of Computing',
    round1Score: 96,
    round2Score: 92,
    round3Score: 25,
    totalScore: 213,
    stage: 'Top 8 Finalist',
    lastActive: 'Just now',
  },
  {
    id: 'ld-2',
    rank: 2,
    name: 'Priya Iyer',
    rollNumber: 'DS24-A089',
    collegeName: 'Data Analytics Division',
    round1Score: 94,
    round2Score: 89,
    round3Score: 18,
    totalScore: 201,
    stage: 'Top 8 Finalist',
    lastActive: '2m ago',
  },
  {
    id: 'ld-3',
    rank: 3,
    name: 'Rohan Verma & Ananya Roy',
    rollNumber: 'AI23-1104',
    collegeName: 'AI & Robotics Lab',
    round1Score: 91,
    round2Score: 86,
    round3Score: 20,
    totalScore: 197,
    stage: 'Top 8 Finalist',
    lastActive: '5m ago',
  },
  {
    id: 'ld-4',
    rank: 4,
    name: 'Vikramaditya Rao',
    rollNumber: 'EC22-4412',
    collegeName: 'Signal Processing Dept',
    round1Score: 88,
    round2Score: 84,
    round3Score: 13,
    totalScore: 185,
    stage: 'Top 8 Finalist',
    lastActive: '8m ago',
  },
  {
    id: 'ld-5',
    rank: 5,
    name: 'Tanvi Sen',
    rollNumber: 'CS23-B0912',
    collegeName: 'School of Computing',
    round1Score: 86,
    round2Score: 81,
    round3Score: 15,
    totalScore: 182,
    stage: 'Top 8 Finalist',
    lastActive: '12m ago',
  },
  {
    id: 'ld-6',
    rank: 6,
    name: 'Karthik Menon & Dev Patel',
    rollNumber: 'IT23-0309',
    collegeName: 'Information Systems',
    round1Score: 84,
    round2Score: 79,
    round3Score: 8,
    totalScore: 171,
    stage: 'Top 8 Finalist',
    lastActive: '15m ago',
  },
  {
    id: 'ld-7',
    rank: 7,
    name: 'Sneha Kulkarni',
    rollNumber: 'DS24-B114',
    collegeName: 'Statistical Sciences',
    round1Score: 82,
    round2Score: 76,
    round3Score: 10,
    totalScore: 168,
    stage: 'Top 8 Finalist',
    lastActive: '18m ago',
  },
  {
    id: 'ld-8',
    rank: 8,
    name: 'Aditya Nair',
    rollNumber: 'CS23-A045',
    collegeName: 'School of Computing',
    round1Score: 80,
    round2Score: 74,
    round3Score: 1,
    totalScore: 155,
    stage: 'Top 8 Finalist',
    lastActive: '20m ago',
  },
  {
    id: 'ld-9',
    rank: 9,
    name: 'Meera Nambiar',
    rollNumber: 'AI24-0012',
    collegeName: 'Computational Intelligence',
    round1Score: 76,
    round2Score: 0,
    round3Score: 0,
    totalScore: 76,
    stage: 'Qualified R1',
    lastActive: '25m ago',
  },
  {
    id: 'ld-10',
    rank: 10,
    name: 'Siddharth Jain',
    rollNumber: 'EE22-0941',
    collegeName: 'Electrical Sciences',
    round1Score: 72,
    round2Score: 0,
    round3Score: 0,
    totalScore: 72,
    stage: 'Qualified R1',
    lastActive: '30m ago',
  },
];

export const TIMELINE_EVENTS: TimelineEvent[] = [
  {
    id: 't1',
    time: '09:00 AM – 10:00 AM',
    phase: 'Check-In & Onboarding',
    title: 'Participant Check-In & Workstation Allocation',
    description:
      'Arrive at Auditorium Hall B. Check in with your roll number and receive your verified admit credentials for Data Mania.',
    status: 'completed',
  },
  {
    id: 't2',
    time: '10:00 AM – 10:25 AM',
    phase: 'Opening Keynote',
    title: 'Event Inauguration & Integrity Briefing',
    description:
      'Welcome address, overview of tournament mechanics, scoring guidelines, and live demonstration of the participant arena.',
    status: 'completed',
  },
  {
    id: 't3',
    time: '10:30 AM – 11:15 AM',
    phase: 'Round 1 (Elimination)',
    title: 'Data MCQ: Fast-Paced Analytical Screening',
    description:
      '30 questions in 45 minutes on the participant interface. Tests statistical reasoning, data wrangling, and core ML foundations.',
    isCurrent: true,
  },
  {
    id: 't4',
    time: '11:30 AM – 12:00 PM',
    phase: 'Cutoff Announcement',
    title: 'Round 1 Cutoff & Score Compilation',
    description:
      'Live projector score compilation. Announcement of qualifying participants advancing to Round 2: Graph Challenge.',
  },
  {
    id: 't5',
    time: '12:00 PM – 01:00 PM',
    phase: 'Round 2 (Elimination)',
    title: 'Graph Challenge: Visual Data Forensics',
    description:
      '5 rigorous graph mystery cases. Teams analyze multi-dimensional plots, correlation anomalies, and distribution shifts. Top 8 advance.',
  },
  {
    id: 't6',
    time: '01:00 PM – 02:15 PM',
    phase: 'Midday Recharge',
    title: 'Lunch Break & Finalist Briefing',
    description:
      'Networking and preparation briefing for the top 8 finalist squads taking the stage for the live buzzer battle.',
  },
  {
    id: 't7',
    time: '02:30 PM – 03:30 PM',
    phase: 'Round 3 (Grand Finale)',
    title: 'Rapid Fire: Grand Stage Buzzer Showdown',
    description:
      'Live buzzer faceoff for the top 8 squads. 15 questions, instant countdown clocks, and live audience cheering in the Main Auditorium.',
  },
  {
    id: 't8',
    time: '03:45 PM – 04:30 PM',
    phase: 'Valedictory Ceremony',
    title: 'Podium Honors & Felicitation',
    description:
      'Announcement of 1st, 2nd, and 3rd place winners, trophy handover, and certificate distribution.',
  },
];

export const PRIZES: PrizeItem[] = [
  {
    rank: '1st',
    title: 'Grand Champions',
    reward: 'Podium Gold Trophy',
    isGrand: true,
    perks: [
      'Official Brain Bytes Gold Champion Trophy & Medals',
      'Certificate of Academic Distinction & First Honor',
      'Direct Fast-Track Recommendation for Research Labs',
      'Champion Data Science Arena Memento',
    ],
  },
  {
    rank: '2nd',
    title: 'First Runners-Up',
    reward: 'Podium Silver Trophy',
    perks: [
      'Official Brain Bytes Silver Trophy & Medals',
      'Certificate of High Commendation',
      'Advanced Compute Lab Fast-Pass Credentials',
      'Runner-Up Arena Commemorative Pack',
    ],
  },
  {
    rank: '3rd',
    title: 'Second Runners-Up',
    reward: 'Podium Bronze Trophy',
    perks: [
      'Official Brain Bytes Bronze Trophy & Medals',
      'Certificate of Merit',
      'Faculty Mentorship Allocation',
      'Honorary Competition Badge',
    ],
  },
];

export const FAQS: FAQItem[] = [
  {
    id: 'faq-1',
    question: 'What is the relationship between DATA MANIA and BRAIN BYTES?',
    answer:
      'DATA MANIA is the primary college tech event, and BRAIN BYTES is the flagship Data Science competition conducted under it. All participants register under Data Mania to compete in the 3 rounds of Brain Bytes.',
    tag: 'Event Structure',
  },
  {
    id: 'faq-2',
    question: 'Why does a round say "Locked by Admin"?',
    answer:
      'Each round in Brain Bytes is administered synchronously. Rounds remain locked and inaccessible to participants until the event hosts officially unlock them from the Admin Console.',
    tag: 'Round Access',
  },
  {
    id: 'faq-3',
    question: 'What is the Join Code and where do I get it?',
    answer:
      'The Join Code is the official event access key broadcasted on the auditorium screen and managed in the Admin Console. Active demo codes include BYTE2026, DATAMANIA26, and SOLAR26.',
    tag: 'Participant Interface',
  },
  {
    id: 'faq-4',
    question: 'Can I participate individually or with a teammate?',
    answer:
      'Both individual competitors and duos (teams of up to 2 students) are permitted. When registering, enter your primary student roll number.',
    tag: 'Teams',
  },
  {
    id: 'faq-5',
    question: 'How do the elimination rounds progress?',
    answer:
      'Round 1 filters the field to the top 40% based on accuracy and completion speed. Round 2 narrows the cohort down to the top 8 finalist teams who advance to the live stage Rapid Fire buzzer round.',
    tag: 'Progression',
  },
];

export const ROUND_1_SAMPLE_QUESTIONS: RoundChallengeQuestion[] = [
  {
    id: 1,
    title: 'Distance Metric Distortion',
    prompt:
      'A dataset contains Salary (20k–200k) and Age (18–60). If K-Means clustering is fitted using Euclidean distance WITHOUT feature scaling, what is the geometric consequence?',
    options: [
      'Age and Salary contribute proportionally to distance',
      'Salary differences completely dominate cluster centroid assignments',
      'The model converges faster due to higher variance',
      'The clusters become spherical across both dimensions',
    ],
    correctAnswer: 1,
    hint: 'Euclidean distance is sensitive to feature variance and magnitude scale.',
  },
  {
    id: 2,
    title: 'Simpson’s Paradox Identification',
    prompt:
      'A model shows an aggregate negative correlation between treatment and outcome across all patients, but a strong positive correlation within every severity stratum. What is this phenomenon called?',
    options: [
      'Berkson’s Fallacy',
      'Simpson’s Paradox',
      'The Base Rate Fallacy',
      'Heteroscedasticity',
    ],
    correctAnswer: 1,
    hint: 'Occurs when a trend appears in groups of data but disappears or reverses when these groups are combined.',
  },
  {
    id: 3,
    title: 'Binary Metric under Severe Class Imbalance',
    prompt:
      'In a fraud detection dataset with 9,990 benign and 10 fraud transactions, a dummy model predicts "Benign" for every transaction. What is the model’s Recall on fraud?',
    options: ['99.9%', '0.0%', '50.0%', '10.0%'],
    correctAnswer: 1,
    hint: 'Recall = TP / (TP + FN). Since 0 fraud cases are detected, TP = 0.',
  },
];

export const MOCK_TEST_SAMPLE_DATA = {
  validCodes: ['BYTE2026', 'DATAMANIA26', 'SOLAR26'],
  defaultDemo: {
    fullName: 'Aarav Sharma',
    rollNumber: 'CS23-B1042',
    joinCode: 'BYTE2026',
    collegeName: 'Department of Computing & Data Sciences',
  },
};
