export interface Round3Option {
  key: 'A' | 'B' | 'C' | 'D';
  label: string;
  subtext?: string;
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
  heading: 'BRAIN BYTES   ROUND 3: RAPID FIRE',
  roundTitle: 'ROUND 3   RAPID FIRE',
  durationSeconds: 3 * 60, // 3 minutes (180 seconds)
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
    domain: 'Data Science Fundamentals',
    paradigm: 'DATA_QUALITY',
    difficulty: '0.20 [RAPID]',
    marksStr: '+5.00 CORRECT / -2.00 WRONG / 0 UNANSWERED',
    category: 'Data Science Fundamentals',
    prompt: 'Data leakage occurs when:',
    options: [
      { key: 'A', label: 'A database server crashes' },
      { key: 'B', label: 'Data is deleted by mistake' },
      { key: 'C', label: 'A dataset is too small' },
      { key: 'D', label: 'Information from outside the training data influences model training' },
    ],
    correctAnswer: 3, // D. Information from outside the training data influences model training
    explanation:
      'Data leakage happens when information from outside the training dataset (such as test or future data) influences model training, leading to unrealistically optimistic performance.',
  },
  {
    id: 2,
    numberStr: '02',
    indexRef: 'DM-2026-RAPID-002',
    domain: 'Statistics and Probability',
    paradigm: 'HYPOTHESIS_TESTING',
    difficulty: '0.25 [RAPID]',
    marksStr: '+5.00 CORRECT / -2.00 WRONG / 0 UNANSWERED',
    category: 'Statistics and Probability',
    prompt: 'A Type I error means:',
    options: [
      { key: 'A', label: 'Rejecting a true null hypothesis' },
      { key: 'B', label: 'Accepting a true null hypothesis' },
      { key: 'C', label: 'Accepting a false null hypothesis' },
      { key: 'D', label: 'Rejecting a false null hypothesis' },
    ],
    correctAnswer: 0, // A. Rejecting a true null hypothesis
    explanation:
      'A Type I error (false positive) occurs when the null hypothesis is true, but is rejected.',
  },
  {
    id: 3,
    numberStr: '03',
    indexRef: 'DM-2026-RAPID-003',
    domain: 'Statistics and Probability',
    paradigm: 'BAYESIAN_INFERENCE',
    difficulty: '0.25 [RAPID]',
    marksStr: '+5.00 CORRECT / -2.00 WRONG / 0 UNANSWERED',
    category: 'Statistics and Probability',
    prompt: "Bayes' theorem is used to:",
    options: [
      { key: 'A', label: 'Remove outliers' },
      { key: 'B', label: 'Update the probability of an event based on new evidence' },
      { key: 'C', label: 'Calculate the mean of a sample' },
      { key: 'D', label: 'Draw a histogram' },
    ],
    correctAnswer: 1, // B. Update the probability of an event based on new evidence
    explanation:
      "Bayes' theorem calculates the conditional probability of an event by updating prior knowledge with newly observed evidence.",
  },
  {
    id: 4,
    numberStr: '04',
    indexRef: 'DM-2026-RAPID-004',
    domain: 'Statistics and Probability',
    paradigm: 'DISTRIBUTION_SHAPE',
    difficulty: '0.20 [RAPID]',
    marksStr: '+5.00 CORRECT / -2.00 WRONG / 0 UNANSWERED',
    category: 'Statistics and Probability',
    prompt: 'Skewness measures:',
    options: [
      { key: 'A', label: 'The peak height only' },
      { key: 'B', label: 'The spread of a distribution' },
      { key: 'C', label: 'The asymmetry of a distribution' },
      { key: 'D', label: 'The number of modes' },
    ],
    correctAnswer: 2, // C. The asymmetry of a distribution
    explanation:
      'Skewness is a statistical measure of the asymmetry of a probability distribution around its mean.',
  },
  {
    id: 5,
    numberStr: '05',
    indexRef: 'DM-2026-RAPID-005',
    domain: 'Statistics and Probability',
    paradigm: 'PROBABILITY_RULES',
    difficulty: '0.30 [RAPID]',
    marksStr: '+5.00 CORRECT / -2.00 WRONG / 0 UNANSWERED',
    category: 'Statistics and Probability',
    prompt: 'If events A and B are independent with P(A) = 0.3 and P(B) = 0.5, what is P(A and B)?',
    options: [
      { key: 'A', label: '0.5' },
      { key: 'B', label: '0.15' },
      { key: 'C', label: '0.2' },
      { key: 'D', label: '0.8' },
    ],
    correctAnswer: 1, // B. 0.15
    explanation:
      'For independent events, the joint probability is the product of their individual probabilities: P(A and B) = P(A) * P(B) = 0.3 * 0.5 = 0.15.',
  },
  {
    id: 6,
    numberStr: '06',
    indexRef: 'DM-2026-RAPID-006',
    domain: 'Statistics and Probability',
    paradigm: 'INFERENTIAL_STATISTICS',
    difficulty: '0.35 [RAPID]',
    marksStr: '+5.00 CORRECT / -2.00 WRONG / 0 UNANSWERED',
    category: 'Statistics and Probability',
    prompt: 'A 95% confidence interval is best interpreted as:',
    options: [
      { key: 'A', label: 'A range containing 95% of the sample values' },
      { key: 'B', label: 'A guarantee that the result is true' },
      { key: 'C', label: 'A procedure that captures the true parameter in about 95% of repeated samples' },
      { key: 'D', label: 'A 95% chance the sample mean is correct' },
    ],
    correctAnswer: 2, // C. A procedure that captures the true parameter in about 95% of repeated samples
    explanation:
      'A 95% confidence level means that 95% of the intervals generated across repeated random samplings from the population will contain the true population parameter.',
  },
  {
    id: 7,
    numberStr: '07',
    indexRef: 'DM-2026-RAPID-007',
    domain: 'Machine Learning',
    paradigm: 'DECISION_TREES',
    difficulty: '0.25 [RAPID]',
    marksStr: '+5.00 CORRECT / -2.00 WRONG / 0 UNANSWERED',
    category: 'Machine Learning',
    prompt: 'Decision trees commonly choose splits using a measure such as:',
    options: [
      { key: 'A', label: 'Euclidean norm of the labels' },
      { key: 'B', label: 'Gini impurity or entropy' },
      { key: 'C', label: 'Mean squared residual' },
      { key: 'D', label: "Pearson's chi-bar" },
    ],
    correctAnswer: 1, // B. Gini impurity or entropy
    explanation:
      'Decision trees choose split points that maximize node purity, commonly measured using Gini impurity or entropy (Information Gain).',
  },
  {
    id: 8,
    numberStr: '08',
    indexRef: 'DM-2026-RAPID-008',
    domain: 'Machine Learning',
    paradigm: 'BIAS_VARIANCE',
    difficulty: '0.25 [RAPID]',
    marksStr: '+5.00 CORRECT / -2.00 WRONG / 0 UNANSWERED',
    category: 'Machine Learning',
    prompt: 'A model with high bias typically:',
    options: [
      { key: 'A', label: 'Memorizes the training set' },
      { key: 'B', label: 'Underfits the data' },
      { key: 'C', label: 'Has zero error' },
      { key: 'D', label: 'Overfits the data' },
    ],
    correctAnswer: 1, // B. Underfits the data
    explanation:
      'High bias results from simplistic assumptions in the learning algorithm, preventing the model from capturing the underlying trend and resulting in underfitting.',
  },
  {
    id: 9,
    numberStr: '09',
    indexRef: 'DM-2026-RAPID-009',
    domain: 'Machine Learning',
    paradigm: 'DIMENSIONALITY_REDUCTION',
    difficulty: '0.20 [RAPID]',
    marksStr: '+5.00 CORRECT / -2.00 WRONG / 0 UNANSWERED',
    category: 'Machine Learning',
    prompt: 'Which of the following is a dimensionality reduction technique?',
    options: [
      { key: 'A', label: 'PCA' },
      { key: 'B', label: 'Logistic Regression' },
      { key: 'C', label: 'KNN' },
      { key: 'D', label: 'Naive Bayes' },
    ],
    correctAnswer: 0, // A. PCA
    explanation:
      'Principal Component Analysis (PCA) is a dimensionality reduction algorithm that projects high-dimensional data onto lower-dimensional orthogonal principal components.',
  },
  {
    id: 10,
    numberStr: '10',
    indexRef: 'DM-2026-RAPID-010',
    domain: 'Machine Learning',
    paradigm: 'MODEL_VALIDATION',
    difficulty: '0.25 [RAPID]',
    marksStr: '+5.00 CORRECT / -2.00 WRONG / 0 UNANSWERED',
    category: 'Machine Learning',
    prompt: 'In k-fold cross-validation, the data is:',
    options: [
      { key: 'A', label: 'Split into k parts, with each part used once for validation' },
      { key: 'B', label: 'Duplicated k times' },
      { key: 'C', label: 'Split into exactly two parts' },
      { key: 'D', label: 'Sorted k times' },
    ],
    correctAnswer: 0, // A. Split into k parts, with each part used once for validation
    explanation:
      'In k-fold cross-validation, the dataset is partitioned into k equal subsets; each subset is used as a validation set once while the remaining k-1 subsets are used for training.',
  },
  {
    id: 11,
    numberStr: '11',
    indexRef: 'DM-2026-RAPID-011',
    domain: 'Machine Learning',
    paradigm: 'CLASSIFICATION_METRICS',
    difficulty: '0.30 [RAPID]',
    marksStr: '+5.00 CORRECT / -2.00 WRONG / 0 UNANSWERED',
    category: 'Machine Learning',
    prompt: 'Recall is calculated as:',
    options: [
      { key: 'A', label: 'FP / (FP + TN)' },
      { key: 'B', label: 'TP / (TP + FN)' },
      { key: 'C', label: 'TP / (TP + FP)' },
      { key: 'D', label: 'TN / (TN + FP)' },
    ],
    correctAnswer: 1, // B. TP / (TP + FN)
    explanation:
      'Recall (Sensitivity) is calculated as TP / (TP + FN), measuring the ratio of correctly predicted positive observations to all actual positive observations.',
  },
  {
    id: 12,
    numberStr: '12',
    indexRef: 'DM-2026-RAPID-012',
    domain: 'Machine Learning',
    paradigm: 'CLASSIFICATION_METRICS',
    difficulty: '0.30 [RAPID]',
    marksStr: '+5.00 CORRECT / -2.00 WRONG / 0 UNANSWERED',
    category: 'Machine Learning',
    prompt: 'The F1 score is:',
    options: [
      { key: 'A', label: 'The product of TP and TN' },
      { key: 'B', label: 'The ratio of FP to FN' },
      { key: 'C', label: 'The arithmetic mean of accuracy and recall' },
      { key: 'D', label: 'The harmonic mean of precision and recall' },
    ],
    correctAnswer: 3, // D. The harmonic mean of precision and recall
    explanation:
      'The F1 score is the harmonic mean of precision and recall: 2 * (Precision * Recall) / (Precision + Recall).',
  },
  {
    id: 13,
    numberStr: '13',
    indexRef: 'DM-2026-RAPID-013',
    domain: 'Python for Data Science',
    paradigm: 'PANDAS_CORE',
    difficulty: '0.20 [RAPID]',
    marksStr: '+5.00 CORRECT / -2.00 WRONG / 0 UNANSWERED',
    category: 'Python for Data Science',
    prompt: 'Which Pandas method gives summary statistics of numeric columns?',
    options: [
      { key: 'A', label: 'df.describe()' },
      { key: 'B', label: 'df.summary_stats()' },
      { key: 'C', label: 'df.info_all()' },
      { key: 'D', label: 'df.stats()' },
    ],
    correctAnswer: 0, // A. df.describe()
    explanation:
      'In Pandas, df.describe() computes summary statistics of numeric columns including count, mean, standard deviation, percentiles, min, and max.',
  },
  {
    id: 14,
    numberStr: '14',
    indexRef: 'DM-2026-RAPID-014',
    domain: 'Python for Data Science',
    paradigm: 'NUMPY_VECTORIZATION',
    difficulty: '0.20 [RAPID]',
    marksStr: '+5.00 CORRECT / -2.00 WRONG / 0 UNANSWERED',
    category: 'Python for Data Science',
    prompt: 'What is the result of np.array([1, 2, 3]) * 2?',
    options: [
      { key: 'A', label: 'An error' },
      { key: 'B', label: 'array([1, 2, 3, 1, 2, 3])' },
      { key: 'C', label: 'array([2, 4, 6])' },
      { key: 'D', label: 'array([3, 4, 5])' },
    ],
    correctAnswer: 2, // C. array([2, 4, 6])
    explanation:
      'NumPy performs element-wise scalar multiplication across the array, producing array([2, 4, 6]).',
  },
  {
    id: 15,
    numberStr: '15',
    indexRef: 'DM-2026-RAPID-015',
    domain: 'Python for Data Science',
    paradigm: 'PANDAS_AGGREGATION',
    difficulty: '0.20 [RAPID]',
    marksStr: '+5.00 CORRECT / -2.00 WRONG / 0 UNANSWERED',
    category: 'Python for Data Science',
    prompt: 'Which Pandas method is used to group data by a column and aggregate?',
    options: [
      { key: 'A', label: 'bundle()' },
      { key: 'B', label: 'groupby()' },
      { key: 'C', label: 'partition()' },
      { key: 'D', label: 'collect()' },
    ],
    correctAnswer: 1, // B. groupby()
    explanation:
      'In Pandas, groupby() groups DataFrame rows based on values in specified columns for subsequent aggregation.',
  },
  {
    id: 16,
    numberStr: '16',
    indexRef: 'DM-2026-RAPID-016',
    domain: 'Python for Data Science',
    paradigm: 'PYTHON_DATA_TYPES',
    difficulty: '0.20 [RAPID]',
    marksStr: '+5.00 CORRECT / -2.00 WRONG / 0 UNANSWERED',
    category: 'Python for Data Science',
    prompt: 'Which Python data type is immutable?',
    options: [
      { key: 'A', label: 'dict' },
      { key: 'B', label: 'set' },
      { key: 'C', label: 'list' },
      { key: 'D', label: 'tuple' },
    ],
    correctAnswer: 3, // D. tuple
    explanation:
      'Tuples in Python are immutable sequences; once created, elements cannot be modified, reordered, added, or removed.',
  },
  {
    id: 17,
    numberStr: '17',
    indexRef: 'DM-2026-RAPID-017',
    domain: 'Python for Data Science',
    paradigm: 'PANDAS_JOINS',
    difficulty: '0.20 [RAPID]',
    marksStr: '+5.00 CORRECT / -2.00 WRONG / 0 UNANSWERED',
    category: 'Python for Data Science',
    prompt: 'Which function joins two DataFrames on a common key column?',
    options: [
      { key: 'A', label: 'pd.link_keys()' },
      { key: 'B', label: 'pd.merge()' },
      { key: 'C', label: 'pd.attach()' },
      { key: 'D', label: 'pd.stitch()' },
    ],
    correctAnswer: 1, // B. pd.merge()
    explanation:
      'pd.merge() combines two DataFrames along common key columns using database join semantics (inner, left, right, outer).',
  },
  {
    id: 18,
    numberStr: '18',
    indexRef: 'DM-2026-RAPID-018',
    domain: 'Data Visualization',
    paradigm: 'STATISTICAL_DISTRIBUTIONS',
    difficulty: '0.25 [RAPID]',
    marksStr: '+5.00 CORRECT / -2.00 WRONG / 0 UNANSWERED',
    category: 'Data Visualization',
    prompt: 'A violin plot combines a box plot with:',
    options: [
      { key: 'A', label: 'A kernel density estimate' },
      { key: 'B', label: 'A scatter matrix' },
      { key: 'C', label: 'A pie chart' },
      { key: 'D', label: 'A timeline' },
    ],
    correctAnswer: 0, // A. A kernel density estimate
    explanation:
      'A violin plot combines a summary box plot with a rotated kernel density estimate on each side to show the probability density of data at different values.',
  },
  {
    id: 19,
    numberStr: '19',
    indexRef: 'DM-2026-RAPID-019',
    domain: 'Data Visualization',
    paradigm: 'DATA_PRESENTATION_ETHICS',
    difficulty: '0.25 [RAPID]',
    marksStr: '+5.00 CORRECT / -2.00 WRONG / 0 UNANSWERED',
    category: 'Data Visualization',
    prompt: 'Truncating the y-axis of a bar chart can:',
    options: [
      { key: 'A', label: 'Make data more accurate' },
      { key: 'B', label: 'Remove outliers' },
      { key: 'C', label: 'Improve statistical power' },
      { key: 'D', label: 'Exaggerate differences between bars' },
    ],
    correctAnswer: 3, // D. Exaggerate differences between bars
    explanation:
      'Starting a bar chart y-axis above zero truncates the visual length of bars, visually exaggerating relatively small differences.',
  },
  {
    id: 20,
    numberStr: '20',
    indexRef: 'DM-2026-RAPID-020',
    domain: 'Data Visualization',
    paradigm: 'MULTIVARIATE_ENCODING',
    difficulty: '0.20 [RAPID]',
    marksStr: '+5.00 CORRECT / -2.00 WRONG / 0 UNANSWERED',
    category: 'Data Visualization',
    prompt: 'A bubble chart adds a third variable by using:',
    options: [
      { key: 'A', label: 'A second y-axis only' },
      { key: 'B', label: 'The size of the markers' },
      { key: 'C', label: 'Pie slices' },
      { key: 'D', label: 'Text labels only' },
    ],
    correctAnswer: 1, // B. The size of the markers
    explanation:
      'In a bubble chart, points are plotted at (x, y) coordinates while a third numeric variable is encoded by the size (area) of the circular marker.',
  },
  {
    id: 21,
    numberStr: '21',
    indexRef: 'DM-2026-RAPID-021',
    domain: 'Data Visualization',
    paradigm: 'SEABORN_API',
    difficulty: '0.20 [RAPID]',
    marksStr: '+5.00 CORRECT / -2.00 WRONG / 0 UNANSWERED',
    category: 'Data Visualization',
    prompt: 'Which Seaborn function is used to draw a heatmap?',
    options: [
      { key: 'A', label: 'sns.hotmap()' },
      { key: 'B', label: 'sns.matrixplot_all()' },
      { key: 'C', label: 'sns.colorgrid()' },
      { key: 'D', label: 'sns.heatmap()' },
    ],
    correctAnswer: 3, // D. sns.heatmap()
    explanation:
      'Seaborn provides sns.heatmap() to plot 2D rectangular data as a color-encoded matrix.',
  },
  {
    id: 22,
    numberStr: '22',
    indexRef: 'DM-2026-RAPID-022',
    domain: 'Artificial Intelligence',
    paradigm: 'NEURAL_REGULARIZATION',
    difficulty: '0.25 [RAPID]',
    marksStr: '+5.00 CORRECT / -2.00 WRONG / 0 UNANSWERED',
    category: 'Artificial Intelligence',
    prompt: 'Which technique randomly turns off neurons during training to reduce overfitting?',
    options: [
      { key: 'A', label: 'Pooling' },
      { key: 'B', label: 'Backpropagation' },
      { key: 'C', label: 'Dropout' },
      { key: 'D', label: 'Batching' },
    ],
    correctAnswer: 2, // C. Dropout
    explanation:
      'Dropout is a neural network regularization technique that randomly turns off (drops out) a percentage of neurons during training to prevent co-adaptation.',
  },
  {
    id: 23,
    numberStr: '23',
    indexRef: 'DM-2026-RAPID-023',
    domain: 'Artificial Intelligence',
    paradigm: 'NEURAL_OPTIMIZATION',
    difficulty: '0.25 [RAPID]',
    marksStr: '+5.00 CORRECT / -2.00 WRONG / 0 UNANSWERED',
    category: 'Artificial Intelligence',
    prompt: 'Backpropagation is used in neural networks to:',
    options: [
      { key: 'A', label: 'Collect data from sensors' },
      { key: 'B', label: 'Compute gradients so that weights can be updated' },
      { key: 'C', label: 'Split data into folds' },
      { key: 'D', label: 'Visualize the network' },
    ],
    correctAnswer: 1, // B. Compute gradients so that weights can be updated
    explanation:
      'Backpropagation calculates the gradient of the loss function with respect to weights using the chain rule, enabling optimizers to update the network weights.',
  },
  {
    id: 24,
    numberStr: '24',
    indexRef: 'DM-2026-RAPID-024',
    domain: 'Artificial Intelligence',
    paradigm: 'KNOWLEDGE_ENGINEERING',
    difficulty: '0.25 [RAPID]',
    marksStr: '+5.00 CORRECT / -2.00 WRONG / 0 UNANSWERED',
    category: 'Artificial Intelligence',
    prompt: 'Classic expert systems rely mainly on:',
    options: [
      { key: 'A', label: 'Reinforcement rewards' },
      { key: 'B', label: 'Image convolutions' },
      { key: 'C', label: 'A knowledge base and inference rules' },
      { key: 'D', label: 'Random sampling' },
    ],
    correctAnswer: 2, // C. A knowledge base and inference rules
    explanation:
      'Classic expert systems rely on an explicit structured knowledge base (facts) paired with an inference engine containing logical IF-THEN rules.',
  },
  {
    id: 25,
    numberStr: '25',
    indexRef: 'DM-2026-RAPID-025',
    domain: 'Artificial Intelligence',
    paradigm: 'AI_ETHICS',
    difficulty: '0.20 [RAPID]',
    marksStr: '+5.00 CORRECT / -2.00 WRONG / 0 UNANSWERED',
    category: 'Artificial Intelligence',
    prompt: 'Bias in an AI system can arise from:',
    options: [
      { key: 'A', label: 'Using a bigger monitor' },
      { key: 'B', label: 'Writing code in Python' },
      { key: 'C', label: 'Using too many GPUs' },
      { key: 'D', label: 'Skewed or unrepresentative training data' },
    ],
    correctAnswer: 3, // D. Skewed or unrepresentative training data
    explanation:
      'AI systems learn patterns directly from training data; unrepresentative or skewed training data leads to algorithmic bias.',
  },
  {
    id: 26,
    numberStr: '26',
    indexRef: 'DM-2026-RAPID-026',
    domain: 'Big Data and Analytics',
    paradigm: 'BIG_DATA_VS',
    difficulty: '0.20 [RAPID]',
    marksStr: '+5.00 CORRECT / -2.00 WRONG / 0 UNANSWERED',
    category: 'Big Data and Analytics',
    prompt: "Which 'V' of Big Data refers to the quality and trustworthiness of data?",
    options: [
      { key: 'A', label: 'Veracity' },
      { key: 'B', label: 'Variety' },
      { key: 'C', label: 'Velocity' },
      { key: 'D', label: 'Volume' },
    ],
    correctAnswer: 0, // A. Veracity
    explanation:
      'Veracity in Big Data refers to data quality, cleanliness, accuracy, and trustworthiness.',
  },
  {
    id: 27,
    numberStr: '27',
    indexRef: 'DM-2026-RAPID-027',
    domain: 'Big Data and Analytics',
    paradigm: 'DATA_PIPELINES',
    difficulty: '0.25 [RAPID]',
    marksStr: '+5.00 CORRECT / -2.00 WRONG / 0 UNANSWERED',
    category: 'Big Data and Analytics',
    prompt: 'Stream processing differs from batch processing because it:',
    options: [
      { key: 'A', label: 'Works only on images' },
      { key: 'B', label: 'Processes data continuously as it is generated' },
      { key: 'C', label: 'Cannot handle large data' },
      { key: 'D', label: 'Processes data only once a month' },
    ],
    correctAnswer: 1, // B. Processes data continuously as it is generated
    explanation:
      'Stream processing operates on continuous, real-time data streams as events occur, whereas batch processing computes large stored datasets in discrete intervals.',
  },
  {
    id: 28,
    numberStr: '28',
    indexRef: 'DM-2026-RAPID-028',
    domain: 'Big Data and Analytics',
    paradigm: 'DISTRIBUTED_SYSTEMS',
    difficulty: '0.20 [RAPID]',
    marksStr: '+5.00 CORRECT / -2.00 WRONG / 0 UNANSWERED',
    category: 'Big Data and Analytics',
    prompt: "In the CAP theorem, the letter 'C' stands for:",
    options: [
      { key: 'A', label: 'Consistency' },
      { key: 'B', label: 'Capacity' },
      { key: 'C', label: 'Cost' },
      { key: 'D', label: 'Compression' },
    ],
    correctAnswer: 0, // A. Consistency
    explanation:
      'In the CAP theorem for distributed data systems, C stands for Consistency, ensuring every read receives the most recent write or an error.',
  },
  {
    id: 29,
    numberStr: '29',
    indexRef: 'DM-2026-RAPID-029',
    domain: 'Big Data and Analytics',
    paradigm: 'DATABASE_SCALING',
    difficulty: '0.25 [RAPID]',
    marksStr: '+5.00 CORRECT / -2.00 WRONG / 0 UNANSWERED',
    category: 'Big Data and Analytics',
    prompt: 'Sharding in databases means:',
    options: [
      { key: 'A', label: 'Deleting duplicate rows' },
      { key: 'B', label: 'Backing up data to tape' },
      { key: 'C', label: 'Splitting data horizontally across multiple servers' },
      { key: 'D', label: 'Encrypting data' },
    ],
    correctAnswer: 2, // C. Splitting data horizontally across multiple servers
    explanation:
      'Database sharding partitions data horizontally across multiple independent physical database servers to scale performance and storage capacity.',
  },
  {
    id: 30,
    numberStr: '30',
    indexRef: 'DM-2026-RAPID-030',
    domain: 'Big Data and Analytics',
    paradigm: 'ANALYTICS_TAXONOMY',
    difficulty: '0.25 [RAPID]',
    marksStr: '+5.00 CORRECT / -2.00 WRONG / 0 UNANSWERED',
    category: 'Big Data and Analytics',
    prompt: 'Prescriptive analytics focuses on:',
    options: [
      { key: 'A', label: 'Cleaning raw data' },
      { key: 'B', label: 'Recommending actions to achieve desired outcomes' },
      { key: 'C', label: 'Describing past events' },
      { key: 'D', label: 'Storing data in lakes' },
    ],
    correctAnswer: 1, // B. Recommending actions to achieve desired outcomes
    explanation:
      'Prescriptive analytics suggests optimal decisions and actions based on optimization models, simulation, and predictive forecasts.',
  },
];
