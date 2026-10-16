export interface Round2Option {
  key: 'A' | 'B' | 'C' | 'D';
  label: string;
  subtext: string;
}

export interface Round2ChartData {
  type: 'bar' | 'line' | 'pie';
  title: string;
  labels: string[];
  values: number[];
  unit: string;
  colors?: string[];
}

export interface Round2Question {
  id: number;
  numberStr: string;
  indexRef: string;
  domain: string;
  paradigm: string;
  difficulty: string;
  marksStr: string;
  chartType: 'bar' | 'line' | 'pie';
  prompt: string;
  options: Round2Option[];
  correctAnswer: number; // 0 for A, 1 for B, 2 for C, 3 for D
  explanation: string;
  chartData: Round2ChartData;
}

export const ROUND_2_CONFIG = {
  roundId: 2,
  heading: 'BRAIN BYTES — ROUND 2: GRAPH CHALLENGE',
  roundTitle: 'ROUND 2 — GRAPH CHALLENGE',
  durationSeconds: 10 * 60, // Exactly 10 minutes (600 seconds)
};

export const ROUND_2_QUESTIONS: Round2Question[] = [
  {
    id: 1,
    numberStr: '01',
    indexRef: 'DM-2026-GRAPH-001',
    domain: 'SALES_ANALYTICS',
    paradigm: 'BAR_CHART_EXTREMA',
    difficulty: '0.25 [STANDARD]',
    marksStr: '+1.00 MARK / 0 WRONG',
    chartType: 'bar',
    prompt: 'In which month were sales highest?',
    options: [
      {
        key: 'A',
        label: 'January',
        subtext: 'Sales volume: 20 units',
      },
      {
        key: 'B',
        label: 'February',
        subtext: 'Sales volume: 35 units',
      },
      {
        key: 'C',
        label: 'March',
        subtext: 'Sales volume: 25 units',
      },
      {
        key: 'D',
        label: 'April',
        subtext: 'Sales volume: 40 units',
      },
    ],
    correctAnswer: 3, // D. April
    explanation:
      'According to the monthly sales bar chart, April achieved the highest sales volume at 40 units, surpassing January (20), February (35), and March (25).',
    chartData: {
      type: 'bar',
      title: 'Monthly Sales Volume (Q1-Q2 Telemetry)',
      labels: ['January', 'February', 'March', 'April'],
      values: [20, 35, 25, 40],
      unit: 'Units',
      colors: ['#8E233B', '#B94B68', '#F59E0B', '#22C55E'],
    },
  },
  {
    id: 2,
    numberStr: '02',
    indexRef: 'DM-2026-GRAPH-002',
    domain: 'WEB_TRAFFIC',
    paradigm: 'LINE_GRAPH_DELTA',
    difficulty: '0.35 [STANDARD]',
    marksStr: '+1.00 MARK / 0 WRONG',
    chartType: 'line',
    prompt: 'Between which consecutive days did visitors increase the most?',
    options: [
      {
        key: 'A',
        label: 'Monday to Tuesday',
        subtext: 'Delta: 15 - 10 = +5 visitors',
      },
      {
        key: 'B',
        label: 'Tuesday to Wednesday',
        subtext: 'Delta: 12 - 15 = -3 visitors (net decrease)',
      },
      {
        key: 'C',
        label: 'Wednesday to Thursday',
        subtext: 'Delta: 20 - 12 = +8 visitors',
      },
      {
        key: 'D',
        label: 'The increase was the same throughout',
        subtext: 'Uniform linear traffic progression',
      },
    ],
    correctAnswer: 2, // C. Wednesday to Thursday
    explanation:
      'The visitor count increased from 12 on Wednesday to 20 on Thursday, giving an increase of +8 visitors. The increase from Monday to Tuesday was +5 (10 to 15), and Tuesday to Wednesday was a decline of -3 (15 to 12). Therefore, Wednesday to Thursday showed the largest increase.',
    chartData: {
      type: 'line',
      title: 'Daily Unique Visitor Count (Monday – Thursday)',
      labels: ['Monday', 'Tuesday', 'Wednesday', 'Thursday'],
      values: [10, 15, 12, 20],
      unit: 'Visitors',
    },
  },
  {
    id: 3,
    numberStr: '03',
    indexRef: 'DM-2026-GRAPH-003',
    domain: 'SKILLS_DISTRIBUTION',
    paradigm: 'PROPORTIONAL_BREAKDOWN',
    difficulty: '0.30 [STANDARD]',
    marksStr: '+1.00 MARK / 0 WRONG',
    chartType: 'pie',
    prompt: 'Which category accounts for one-quarter of the total?',
    options: [
      {
        key: 'A',
        label: 'Python',
        subtext: 'Represents 40% of overall skillset distribution',
      },
      {
        key: 'B',
        label: 'SQL',
        subtext: 'Represents 25% of overall skillset distribution',
      },
      {
        key: 'C',
        label: 'Excel',
        subtext: 'Represents 20% of overall skillset distribution',
      },
      {
        key: 'D',
        label: 'Other',
        subtext: 'Represents 15% of overall skillset distribution',
      },
    ],
    correctAnswer: 1, // B. SQL
    explanation:
      'One-quarter of the total corresponds to exactly 25% (1/4 = 0.25). Looking at the pie chart distribution, SQL is allocated exactly 25% of the total.',
    chartData: {
      type: 'pie',
      title: 'Data Science Technical Stack Usage',
      labels: ['Python', 'SQL', 'Excel', 'Other'],
      values: [40, 25, 20, 15],
      unit: '%',
      colors: ['#8E233B', '#B94B68', '#F59E0B', '#22C55E'],
    },
  },
  {
    id: 4,
    numberStr: '04',
    indexRef: 'DM-2026-GRAPH-004',
    domain: 'TEAM_BENCHMARK',
    paradigm: 'DISPERSION_RANGE',
    difficulty: '0.32 [STANDARD]',
    marksStr: '+1.00 MARK / 0 WRONG',
    chartType: 'bar',
    prompt: 'What is the difference between the highest and lowest values?',
    options: [
      {
        key: 'A',
        label: '6',
        subtext: 'Team B (18) - Team A (12)',
      },
      {
        key: 'B',
        label: '9',
        subtext: 'Team B (18) - Team C (9)',
      },
      {
        key: 'C',
        label: '12',
        subtext: 'Team D (15) - Team C (9)',
      },
      {
        key: 'D',
        label: '27',
        subtext: 'Team B (18) + Team C (9) [sum instead of difference]',
      },
    ],
    correctAnswer: 1, // B. 9
    explanation:
      'The highest value in the team performance chart is Team B (18), and the lowest value is Team C (9). The difference between highest and lowest is 18 - 9 = 9.',
    chartData: {
      type: 'bar',
      title: 'Cross-Squad Delivery Output (Velocity Units)',
      labels: ['Team A', 'Team B', 'Team C', 'Team D'],
      values: [12, 18, 9, 15],
      unit: 'Points',
      colors: ['#B94B68', '#8E233B', '#F59E0B', '#22C55E'],
    },
  },
  {
    id: 5,
    numberStr: '05',
    indexRef: 'DM-2026-GRAPH-005',
    domain: 'TIME_SERIES',
    paradigm: 'TREND_DETECTION',
    difficulty: '0.28 [STANDARD]',
    marksStr: '+1.00 MARK / 0 WRONG',
    chartType: 'line',
    prompt: 'What is the overall trend shown in the graph?',
    options: [
      {
        key: 'A',
        label: 'Steady increase',
        subtext: 'Consistent monotonic growth rate of +5 units per consecutive week',
      },
      {
        key: 'B',
        label: 'Steady decrease',
        subtext: 'Negative slope over time',
      },
      {
        key: 'C',
        label: 'No change',
        subtext: 'Zero slope baseline',
      },
      {
        key: 'D',
        label: 'Irregular fluctuations',
        subtext: 'High variance volatility without directional drift',
      },
    ],
    correctAnswer: 0, // A. Steady increase
    explanation:
      'The graph records Week 1 = 5, Week 2 = 10, Week 3 = 15, and Week 4 = 20. Each successive week exhibits a consistent addition of +5 units, illustrating a clear and steady increase.',
    chartData: {
      type: 'line',
      title: 'Weekly Metric Progression Trajectory',
      labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4'],
      values: [5, 10, 15, 20],
      unit: 'Score',
    },
  },
];
