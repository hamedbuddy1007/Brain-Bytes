export interface Round3Option {
  key: 'A' | 'B' | 'C' | 'D';
  label: string;
  subtext: string;
}

export interface Round3Question {
  id: number;
  numberStr: string;
  indexRef: string;
  domain: string;
  paradigm: string;
  difficulty: string;
  marksStr: string;
  category: string;
  prompt: string;
  options: Round3Option[];
  correctAnswer: number; // 0 for A, 1 for B, 2 for C, 3 for D
  explanation: string;
}

export const ROUND_3_CONFIG = {
  roundId: 3,
  heading: 'BRAIN BYTES — ROUND 3: RAPID FIRE',
  roundTitle: 'ROUND 3 — RAPID FIRE',
  durationSeconds: 3 * 60, // Configurable: 3 minutes (180 seconds)
  markingRules: {
    correct: 5,
    incorrect: -2,
    unanswered: 0,
    description: '+5 for correct, −2 for incorrect, and 0 for unanswered',
  },
};

export const ROUND_3_QUESTIONS: Round3Question[] = [
  {
    id: 1,
    numberStr: '01',
    indexRef: 'DM-2026-RAPID-001',
    domain: 'EVALUATION_METRICS',
    paradigm: 'IMBALANCE_DIAGNOSIS',
    difficulty: '0.30 [RAPID]',
    marksStr: '+5.00 CORRECT / -2.00 WRONG / 0 UNANSWERED',
    category: 'Evaluation Metrics',
    prompt: 'Which metric is best suited to evaluate a classifier on a highly imbalanced dataset with rare fraud cases?',
    options: [
      {
        key: 'A',
        label: 'Accuracy',
        subtext: 'Trivially inflated by predicting the majority class exclusively',
      },
      {
        key: 'B',
        label: 'PR-AUC (Precision-Recall Curve)',
        subtext: 'Evaluates positive minority predictions without True Negative distortion',
      },
      {
        key: 'C',
        label: 'Mean Absolute Error',
        subtext: 'Continuous regression evaluation metric',
      },
      {
        key: 'D',
        label: 'R-Squared',
        subtext: 'Variance proportion metric for linear regression',
      },
    ],
    correctAnswer: 1, // B. PR-AUC
    explanation:
      'Under severe class skew, high True Negatives artificially boost Accuracy and ROC-AUC. PR-AUC evaluates true minority precision and recall directly without being skewed by large negative cohorts.',
  },
  {
    id: 2,
    numberStr: '02',
    indexRef: 'DM-2026-RAPID-002',
    domain: 'DATA_WRANGLING',
    paradigm: 'PANDAS_CORE',
    difficulty: '0.22 [RAPID]',
    marksStr: '+5.00 CORRECT / -2.00 WRONG / 0 UNANSWERED',
    category: 'Python & Pandas',
    prompt: 'In Python Pandas, which method is used to remove redundant duplicate rows from a DataFrame?',
    options: [
      {
        key: 'A',
        label: 'df.unique()',
        subtext: 'Returns unique series values; invalid on 2D DataFrames',
      },
      {
        key: 'B',
        label: 'df.drop_duplicates()',
        subtext: 'Drops duplicate rows across specified subset or all columns',
      },
      {
        key: 'C',
        label: 'df.filter_unique()',
        subtext: 'Not a recognized Pandas DataFrame method',
      },
      {
        key: 'D',
        label: 'df.distinct()',
        subtext: 'PySpark / SQL syntax; not supported on Pandas DataFrames',
      },
    ],
    correctAnswer: 1, // B. df.drop_duplicates()
    explanation:
      '`df.drop_duplicates()` is the native Pandas method used to filter out identical rows based on specific columns or all features.',
  },
  {
    id: 3,
    numberStr: '03',
    indexRef: 'DM-2026-RAPID-003',
    domain: 'MODEL_REGULARIZATION',
    paradigm: 'FEATURE_SPARSITY',
    difficulty: '0.35 [RAPID]',
    marksStr: '+5.00 CORRECT / -2.00 WRONG / 0 UNANSWERED',
    category: 'Machine Learning',
    prompt: 'What is the primary characteristic and effect of L1 Regularization (Lasso) compared to L2 (Ridge)?',
    options: [
      {
        key: 'A',
        label: 'Drives non-informative feature weights strictly to zero',
        subtext: 'Produces sparse feature solutions and performs automated feature selection',
      },
      {
        key: 'B',
        label: 'Shrinks coefficients uniformly without setting any to zero',
        subtext: 'Standard characteristic of L2 Ridge weight decay',
      },
      {
        key: 'C',
        label: 'Completely eliminates model bias',
        subtext: 'Regularization intentionally introduces slight bias to minimize variance',
      },
      {
        key: 'D',
        label: 'Doubles the gradient descent learning rate',
        subtext: 'Unrelated to penalty formulation',
      },
    ],
    correctAnswer: 0, // A. Drives non-informative feature weights strictly to zero
    explanation:
      'L1 regularization adds the sum of absolute weight values as a penalty. Geometrically, this causes coefficients of less useful predictors to drop to zero, acting as automatic feature selection.',
  },
  {
    id: 4,
    numberStr: '04',
    indexRef: 'DM-2026-RAPID-004',
    domain: 'SQL_QUERYING',
    paradigm: 'AGGREGATION_FILTER',
    difficulty: '0.25 [RAPID]',
    marksStr: '+5.00 CORRECT / -2.00 WRONG / 0 UNANSWERED',
    category: 'SQL & Database',
    prompt: 'Which SQL clause is specifically used to filter grouped records resulting from a `GROUP BY` operation?',
    options: [
      {
        key: 'A',
        label: 'WHERE',
        subtext: 'Filters individual table rows BEFORE aggregation is computed',
      },
      {
        key: 'B',
        label: 'HAVING',
        subtext: 'Filters aggregated groups AFTER the GROUP BY aggregation is applied',
      },
      {
        key: 'C',
        label: 'ORDER BY',
        subtext: 'Specifies sort ordering of final record tuples',
      },
      {
        key: 'D',
        label: 'LIMIT',
        subtext: 'Caps total number of returned rows',
      },
    ],
    correctAnswer: 1, // B. HAVING
    explanation:
      '`HAVING` filters aggregated values created by `GROUP BY`. `WHERE` cannot be used with aggregate functions such as `COUNT()`, `SUM()`, or `AVG()`.',
  },
  {
    id: 5,
    numberStr: '05',
    indexRef: 'DM-2026-RAPID-005',
    domain: 'STATISTICAL_INFERENCE',
    paradigm: 'HYPOTHESIS_TESTING',
    difficulty: '0.28 [RAPID]',
    marksStr: '+5.00 CORRECT / -2.00 WRONG / 0 UNANSWERED',
    category: 'Statistics',
    prompt: 'In statistical hypothesis testing, what does a p-value less than the standard significance threshold (p < 0.05) indicate?',
    options: [
      {
        key: 'A',
        label: 'The null hypothesis is proven 100% true',
        subtext: 'Incorrect conclusion regarding p-values',
      },
      {
        key: 'B',
        label: 'Statistically significant evidence to reject the null hypothesis',
        subtext: 'The observed data is highly unlikely to have occurred under the null assumption',
      },
      {
        key: 'C',
        label: 'The dataset has zero variance',
        subtext: 'Zero variance is not an implication of p-values',
      },
      {
        key: 'D',
        label: 'The test had insufficient sample size',
        subtext: 'Sample size affects power, but p-value calculates likelihood under H0',
      },
    ],
    correctAnswer: 1, // B. Statistically significant evidence to reject the null hypothesis
    explanation:
      'A p-value below alpha (0.05) means that assuming the null hypothesis were true, the probability of obtaining a result as extreme as the observed data is under 5%, providing sufficient evidence to reject the null hypothesis.',
  },
];
