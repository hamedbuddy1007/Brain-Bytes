export interface Round1Option {
  key: 'A' | 'B' | 'C' | 'D';
  label: string;
  subtext: string;
}

export interface Round1Question {
  id: number;
  numberStr: string;
  indexRef: string;
  domain: string;
  paradigm: string;
  difficulty: string;
  marksStr: string;
  prompt: string;
  options: Round1Option[];
  correctAnswer: number; // 0 for A, 1 for B, 2 for C, 3 for D
  explanation: string;
}

export const ROUND_1_QUESTIONS: Round1Question[] = [
  {
    id: 1,
    numberStr: '01',
    indexRef: 'DM-2025-STAT-MCQ-001',
    domain: 'DESCRIPTIVE_STATISTICS',
    paradigm: 'RESISTANCE_METRIC',
    difficulty: '0.42 [STANDARD]',
    marksStr: '+1.00 MARK / 0 WRONG',
    prompt:
      'Which of the following measures of central tendency or dispersion is most affected by extreme values (outliers) in a dataset?',
    options: [
      {
        key: 'A',
        label: 'Median',
        subtext: '50th percentile rank metric; resistant to skew',
      },
      {
        key: 'B',
        label: 'Mode',
        subtext: 'Maximum frequency density; immune to tail magnitude',
      },
      {
        key: 'C',
        label: 'Mean',
        subtext: 'Arithmetic average computed directly across all values; directly incorporates outlier magnitudes',
      },
      {
        key: 'D',
        label: 'Interquartile range (IQR)',
        subtext: 'Q3 - Q1 delta span; truncates outer 50% tails completely',
      },
    ],
    correctAnswer: 2,
    explanation:
      'The arithmetic mean incorporates every numeric value directly into the summation numerator, making it non-resistant to extreme outliers. The median and IQR depend on order statistics and remain robust.',
  },
  {
    id: 2,
    numberStr: '02',
    indexRef: 'DM-2025-STAT-MCQ-002',
    domain: 'EVALUATION_METRICS',
    paradigm: 'CLASS_IMBALANCE',
    difficulty: '0.38 [STANDARD]',
    marksStr: '+1.00 MARK / 0 WRONG',
    prompt:
      'In a transaction fraud dataset containing 9,990 legitimate and 10 fraudulent charges, a baseline dummy model classifies every transaction as "Legitimate". What is the model’s Recall on the fraud class?',
    options: [
      {
        key: 'A',
        label: '99.9%',
        subtext: 'Calculated purely from overall raw test accuracy ratio',
      },
      {
        key: 'B',
        label: '0.0%',
        subtext: 'True Positives / (True Positives + False Negatives) = 0 / 10',
      },
      {
        key: 'C',
        label: '50.0%',
        subtext: 'Unweighted macro-averaged baseline assumption',
      },
      {
        key: 'D',
        label: '10.0%',
        subtext: 'Prevalence-adjusted sensitivity rate',
      },
    ],
    correctAnswer: 1,
    explanation:
      'Recall evaluates True Positives / (True Positives + False Negatives). With 0 detected frauds and 10 false negatives, recall is exactly 0.0% despite 99.9% raw accuracy.',
  },
  {
    id: 3,
    numberStr: '03',
    indexRef: 'DM-2025-STAT-MCQ-003',
    domain: 'CAUSAL_INFERENCE',
    paradigm: 'CONFOUNDING_PHENOMENON',
    difficulty: '0.55 [ADVANCED]',
    marksStr: '+1.00 MARK / 0 WRONG',
    prompt:
      'When analyzing drug dosage vs recovery rate, the aggregated cohort trend has a negative slope (-0.42). However, upon partitioning into patient severity subgroups, each group displays a positive slope (+0.68). What phenomenon is demonstrated?',
    options: [
      {
        key: 'A',
        label: 'Berkson’s Fallacy',
        subtext: 'Selection bias occurring when sample selection depends on condition',
      },
      {
        key: 'B',
        label: 'Simpson’s Paradox',
        subtext: 'Trend observed in aggregated data reverses when conditioned on confounding variable',
      },
      {
        key: 'C',
        label: 'Regression to the Mean',
        subtext: 'Natural statistical reversion of extreme outcomes toward average',
      },
      {
        key: 'D',
        label: 'Heteroscedastic Drift',
        subtext: 'Non-constant error distribution expanding over time horizons',
      },
    ],
    correctAnswer: 1,
    explanation:
      'Simpson’s Paradox occurs when a statistical trend in aggregate population data disappears or reverses when partitioned by a confounding covariate (e.g. baseline illness severity).',
  },
  {
    id: 4,
    numberStr: '04',
    indexRef: 'DM-2025-STAT-MCQ-004',
    domain: 'UNSUPERVISED_LEARNING',
    paradigm: 'EUCLIDEAN_METRIC_SCALING',
    difficulty: '0.45 [STANDARD]',
    marksStr: '+1.00 MARK / 0 WRONG',
    prompt:
      'A dataset contains two continuous numeric features: "Annual Salary" (range 20,000–250,000) and "Age" (range 18–65). If K-Means clustering is fitted without feature normalization, what is the primary geometric distortion?',
    options: [
      {
        key: 'A',
        label: 'Isometric Centroid Collapse',
        subtext: 'Clusters compress into singular one-dimensional points',
      },
      {
        key: 'B',
        label: 'Magnitude Axis Domination',
        subtext: 'Salary differences dominate Euclidean distance sums, rendering Age virtually irrelevant',
      },
      {
        key: 'C',
        label: 'Automatic Internal Scaling',
        subtext: 'K-Means internally computes min-max scaling prior to assignment',
      },
      {
        key: 'D',
        label: 'Variance Inflation in Age',
        subtext: 'Smaller numerical ranges distort centroid variance exponentially',
      },
    ],
    correctAnswer: 1,
    explanation:
      'Euclidean distance squares difference terms. A salary difference of $10,000 yields 100,000,000, dwarfing age differences of 10-40 years (100-1600). Standardization is mandatory.',
  },
  {
    id: 5,
    numberStr: '05',
    indexRef: 'DM-2025-STAT-MCQ-005',
    domain: 'SQL_ANALYTICS',
    paradigm: 'LOGICAL_QUERY_PROCESSING',
    difficulty: '0.52 [ADVANCED]',
    marksStr: '+1.00 MARK / 0 WRONG',
    prompt:
      'In standard ANSI SQL execution pipelines, which clause is logically evaluated AFTER window functions such as ROW_NUMBER() or RANK() OVER (PARTITION BY ...)?',
    options: [
      {
        key: 'A',
        label: 'WHERE Clause',
        subtext: 'Row-level filtering evaluated prior to group aggregation',
      },
      {
        key: 'B',
        label: 'GROUP BY Clause',
        subtext: 'Aggregation bucket creation executed before SELECT expressions',
      },
      {
        key: 'C',
        label: 'QUALIFY Clause (or enclosing CTE)',
        subtext: 'Filters window function computations directly after SELECT projection',
      },
      {
        key: 'D',
        label: 'HAVING Clause',
        subtext: 'Predicate filter evaluated on grouped aggregate values',
      },
    ],
    correctAnswer: 2,
    explanation:
      'Window functions run during the SELECT projection phase after FROM, WHERE, GROUP BY, and HAVING. To filter directly on window outputs without subqueries, QUALIFY is utilized in modern SQL.',
  },
  {
    id: 6,
    numberStr: '06',
    indexRef: 'DM-2025-STAT-MCQ-006',
    domain: 'OPTIMIZATION_LOSS',
    paradigm: 'ROBUST_REGRESSION',
    difficulty: '0.48 [STANDARD]',
    marksStr: '+1.00 MARK / 0 WRONG',
    prompt:
      'Which loss function combines the quadratic penalization of MSE for small residuals with the linear penalization of MAE for large residuals, offering robust regression against heavy-tailed outliers?',
    options: [
      {
        key: 'A',
        label: 'Huber Loss',
        subtext: 'Transitions from quadratic to linear error penalization past threshold delta',
      },
      {
        key: 'B',
        label: 'Kullback-Leibler Divergence',
        subtext: 'Relative entropy measuring divergence between two probability distributions',
      },
      {
        key: 'C',
        label: 'Cross-Entropy Loss',
        subtext: 'Logarithmic penalty for probability classification error',
      },
      {
        key: 'D',
        label: 'Hinge Loss',
        subtext: 'Maximum margin classification loss commonly used in SVMs',
      },
    ],
    correctAnswer: 0,
    explanation:
      'Huber Loss behaves quadratically (like L2/MSE) when error is smaller than delta, ensuring smooth derivatives, and linearly (like L1/MAE) for large residuals, mitigating outlier leverage.',
  },
  {
    id: 7,
    numberStr: '07',
    indexRef: 'DM-2025-STAT-MCQ-007',
    domain: 'HYPOTHESIS_TESTING',
    paradigm: 'P_VALUE_INTERPRETATION',
    difficulty: '0.60 [ADVANCED]',
    marksStr: '+1.00 MARK / 0 WRONG',
    prompt:
      'In a two-tailed hypothesis test with significance level alpha = 0.05, a researcher obtains p = 0.03. What is the mathematically strict definition of this p-value?',
    options: [
      {
        key: 'A',
        label: 'Probability Null Hypothesis is True',
        subtext: 'The probability that H0 is correct given observed dataset',
      },
      {
        key: 'B',
        label: 'Probability of Extreme Data under H0',
        subtext: 'Probability of obtaining test statistic at least as extreme as observed, assuming H0 holds',
      },
      {
        key: 'C',
        label: 'Probability Alternative Hypothesis is False',
        subtext: 'Inverse posterior confidence score for experimental treatment',
      },
      {
        key: 'D',
        label: 'Probability of Type II Error Rate',
        subtext: 'Beta risk failure parameter across repeated experimental sampling',
      },
    ],
    correctAnswer: 1,
    explanation:
      'A p-value is strictly P(Data at least as extreme | H0 is true). It is NOT the posterior probability of the null hypothesis P(H0 | Data), which would require Bayesian prior distribution.',
  },
  {
    id: 8,
    numberStr: '08',
    indexRef: 'DM-2025-STAT-MCQ-008',
    domain: 'LINEAR_MODELS',
    paradigm: 'SPARSITY_REGULARIZATION',
    difficulty: '0.40 [STANDARD]',
    marksStr: '+1.00 MARK / 0 WRONG',
    prompt:
      'Why does L1 regularization (Lasso) generate sparse model weights (coefficients exactly equal to 0), whereas L2 regularization (Ridge) merely shrinks weights toward zero?',
    options: [
      {
        key: 'A',
        label: 'Rhombus Polytope Geometry',
        subtext: 'L1 norm constraint creates sharp diamond corners intersecting loss contours at axes',
      },
      {
        key: 'B',
        label: 'Gradient Clipping Mechanism',
        subtext: 'Ridge regularization artificially clips gradient steps below machine epsilon',
      },
      {
        key: 'C',
        label: 'Gaussian Prior Equivalence',
        subtext: 'L2 norm assumes Laplace distribution causing asymptotic decay',
      },
      {
        key: 'D',
        label: 'Inverse Covariance Inversion',
        subtext: 'Lasso inverts feature correlation matrix to eliminate collinears',
      },
    ],
    correctAnswer: 0,
    explanation:
      'The L1 constraint region is a non-differentiable hyper-octahedron (rhombus). Optimization contours typically strike its vertices on coordinate axes, driving corresponding coefficients strictly to zero.',
  },
  {
    id: 9,
    numberStr: '09',
    indexRef: 'DM-2025-STAT-MCQ-009',
    domain: 'EVALUATION_METRICS',
    paradigm: 'HARMONIC_BALANCE',
    difficulty: '0.35 [STANDARD]',
    marksStr: '+1.00 MARK / 0 WRONG',
    prompt:
      'If a binary classification model on a benchmark test set exhibits Precision = 0.80 and Recall = 0.80, what is the resulting F1-Score?',
    options: [
      {
        key: 'A',
        label: '0.64',
        subtext: 'Geometric cross-product of precision and recall',
      },
      {
        key: 'B',
        label: '0.80',
        subtext: '2 * (P * R) / (P + R) = 2 * 0.64 / 1.60 = 0.80',
      },
      {
        key: 'C',
        label: '0.90',
        subtext: 'Harmonic penalization curve enhancement',
      },
      {
        key: 'D',
        label: '0.50',
        subtext: 'Balanced chance baseline normalization',
      },
    ],
    correctAnswer: 1,
    explanation:
      'F1-Score is the harmonic mean: 2 * (P * R) / (P + R). When Precision and Recall are identical (0.80), their harmonic mean equals exactly that common value: 0.80.',
  },
  {
    id: 10,
    numberStr: '10',
    indexRef: 'DM-2025-STAT-MCQ-010',
    domain: 'DIMENSIONALITY_REDUCTION',
    paradigm: 'MANIFOLD_LEARNING',
    difficulty: '0.62 [ADVANCED]',
    marksStr: '+1.00 MARK / 0 WRONG',
    prompt:
      'In t-Distributed Stochastic Neighbor Embedding (t-SNE), which distribution is applied in the low-dimensional map space to alleviate the crowding problem?',
    options: [
      {
        key: 'A',
        label: 'Gaussian Normal Distribution',
        subtext: 'Standard exponential probability curve applied identically in both spaces',
      },
      {
        key: 'B',
        label: 'Student-t Distribution (1 DOF)',
        subtext: 'Heavy-tailed Cauchy distribution allowing moderately distant points to spread out',
      },
      {
        key: 'C',
        label: 'Poisson Count Distribution',
        subtext: 'Discrete integer modeling for pairwise cluster boundaries',
      },
      {
        key: 'D',
        label: 'Laplace Double Exponential',
        subtext: 'Sharply peaked probability density optimizing piecewise distances',
      },
    ],
    correctAnswer: 1,
    explanation:
      'The volume of a sphere in d dimensions grows exponentially with radius. To prevent crowding in 2D, t-SNE uses a heavy-tailed Student-t distribution (1 DOF / Cauchy) in low-dimensional space.',
  },
  {
    id: 11,
    numberStr: '11',
    indexRef: 'DM-2025-STAT-MCQ-011',
    domain: 'ECONOMETRICS_REGRESSION',
    paradigm: 'GAUSS_MARKOV_ASSUMPTIONS',
    difficulty: '0.50 [STANDARD]',
    marksStr: '+1.00 MARK / 0 WRONG',
    prompt:
      'When residual errors in an OLS linear regression exhibit increasing variance as the predictor variable grows (fanning out), which core assumption is violated?',
    options: [
      {
        key: 'A',
        label: 'Multicollinearity',
        subtext: 'High pairwise correlation among predictor variables',
      },
      {
        key: 'B',
        label: 'Homoscedasticity',
        subtext: 'Assumption that residual variance remains constant across all predictor levels',
      },
      {
        key: 'C',
        label: 'Exogeneity of Regressors',
        subtext: 'Zero covariance between independent variables and error term',
      },
      {
        key: 'D',
        label: 'No Autocorrelation',
        subtext: 'Independence among sequential residual error terms',
      },
    ],
    correctAnswer: 1,
    explanation:
      'Homoscedasticity requires constant residual error variance across all values of X. When errors fan out (heteroscedasticity), standard errors are biased, invalidating confidence intervals.',
  },
  {
    id: 12,
    numberStr: '12',
    indexRef: 'DM-2025-STAT-MCQ-012',
    domain: 'PYTHON_DATA_ENG',
    paradigm: 'MEMORY_OPTIMIZATION',
    difficulty: '0.40 [STANDARD]',
    marksStr: '+1.00 MARK / 0 WRONG',
    prompt:
      'In Python Pandas, converting a high-cardinality text column with few distinct values from object dtype to category dtype primarily delivers which computational benefit?',
    options: [
      {
        key: 'A',
        label: 'Automatic Null Imputation',
        subtext: 'Replaces NaN values with mode frequencies without user intervention',
      },
      {
        key: 'B',
        label: 'Memory Reduction & Integer Indexing',
        subtext: 'Stores integer indices pointing to unique string table, drastically reducing RAM and accelerating groupby',
      },
      {
        key: 'C',
        label: 'Vectorized Levenshtein Distance',
        subtext: 'Enables automatic fuzzy matching across textual observations',
      },
      {
        key: 'D',
        label: 'GPU VRAM Acceleration',
        subtext: 'Directly offloads data frames onto Nvidia CUDA kernels',
      },
    ],
    correctAnswer: 1,
    explanation:
      'Pandas categorical data stores unique string levels in an auxiliary index and encodes rows as compact integer arrays (int8/int16), saving up to 80-90% RAM and speeding up hash aggregations.',
  },
  {
    id: 13,
    numberStr: '13',
    indexRef: 'DM-2025-STAT-MCQ-013',
    domain: 'EVALUATION_METRICS',
    paradigm: 'ROC_CURVE_ANALYSIS',
    difficulty: '0.30 [STANDARD]',
    marksStr: '+1.00 MARK / 0 WRONG',
    prompt:
      'What is the theoretical Area Under the Receiver Operating Characteristic Curve (ROC-AUC) for a binary classifier that predicts random coin-flip probabilities?',
    options: [
      {
        key: 'A',
        label: '0.00',
        subtext: 'Indicates completely inverted predictive classifications',
      },
      {
        key: 'B',
        label: '0.50',
        subtext: 'Represents the diagonal line of chance discrimination where TPR equals FPR',
      },
      {
        key: 'C',
        label: '1.00',
        subtext: 'Ideal benchmark score achieved by noise-free predictors',
      },
      {
        key: 'D',
        label: 'Undefined',
        subtext: 'Cannot be computed without setting an explicit decision threshold',
      },
    ],
    correctAnswer: 1,
    explanation:
      'A random classifier generates true positive rates equal to false positive rates at every threshold, plotting along the 45-degree identity diagonal. The area under this diagonal line is exactly 0.50.',
  },
  {
    id: 14,
    numberStr: '14',
    indexRef: 'DM-2025-STAT-MCQ-014',
    domain: 'DECISION_TREES',
    paradigm: 'SPLIT_CRITERION',
    difficulty: '0.44 [STANDARD]',
    marksStr: '+1.00 MARK / 0 WRONG',
    prompt:
      'In classification decision trees, which impurity metric is mathematically expressed as 1 - Σ(p_i²), where p_i is the proportion of samples belonging to class i at a given node?',
    options: [
      {
        key: 'A',
        label: 'Shannon Entropy',
        subtext: 'Calculated using log2 probabilities: -Σ(p_i * log2(p_i))',
      },
      {
        key: 'B',
        label: 'Gini Impurity',
        subtext: 'Probability of a randomly chosen element being incorrectly labeled if labeled randomly',
      },
      {
        key: 'C',
        label: 'Variance Reduction',
        subtext: 'Impurity calculation applied strictly in continuous regression trees',
      },
      {
        key: 'D',
        label: 'Information Gain Ratio',
        subtext: 'Entropy normalized by intrinsic split information',
      },
    ],
    correctAnswer: 1,
    explanation:
      'Gini Impurity is defined as 1 - Σ(p_i²). It reaches 0.0 at pure nodes (where all samples belong to one class) and 0.5 for balanced binary splits. Shannon entropy uses logarithms.',
  },
  {
    id: 15,
    numberStr: '15',
    indexRef: 'DM-2025-STAT-MCQ-015',
    domain: 'MACHINE_LEARNING_PIPELINES',
    paradigm: 'DATA_LEAKAGE',
    difficulty: '0.58 [ADVANCED]',
    marksStr: '+1.00 MARK / 0 WRONG',
    prompt:
      'If a data scientist performs feature selection based on correlation with the target variable on the entire dataset BEFORE splitting into 5-Fold Cross-Validation train/test folds, what flaw occurs?',
    options: [
      {
        key: 'A',
        label: 'Underfitting Bias',
        subtext: 'Fewer features lead to underparameterized decision boundaries',
      },
      {
        key: 'B',
        label: 'Data Leakage',
        subtext: 'Validation fold target information leaks into feature choice, producing overly optimistic CV scores',
      },
      {
        key: 'C',
        label: 'Label Inversion',
        subtext: 'Swaps positive and negative class predictions during matrix multiplication',
      },
      {
        key: 'D',
        label: 'Covariate Shift Elimination',
        subtext: 'Artificially forces test features to match training distribution',
      },
    ],
    correctAnswer: 1,
    explanation:
      'When feature selection uses target labels from the entire dataset, validation fold outcomes leak into the preprocessing pipeline. Validation performance will appear artificially inflated.',
  },
  {
    id: 16,
    numberStr: '16',
    indexRef: 'DM-2025-STAT-MCQ-016',
    domain: 'PROBABILITY_DISTRIBUTIONS',
    paradigm: 'POISSON_PROCESS',
    difficulty: '0.46 [STANDARD]',
    marksStr: '+1.00 MARK / 0 WRONG',
    prompt:
      'Which probability distribution is most appropriate for modeling the number of web server crash incidents occurring within a 24-hour window, given a known constant average rate lambda?',
    options: [
      {
        key: 'A',
        label: 'Exponential Distribution',
        subtext: 'Continuous probability distribution modeling time elapsed between Poisson events',
      },
      {
        key: 'B',
        label: 'Poisson Distribution',
        subtext: 'Discrete distribution expressing probability of given number of independent events occurring in fixed interval',
      },
      {
        key: 'C',
        label: 'Geometric Distribution',
        subtext: 'Number of Bernoulli trials required to achieve first single success',
      },
      {
        key: 'D',
        label: 'Bernoulli Distribution',
        subtext: 'Single binary trial with binary outcome probability p',
      },
    ],
    correctAnswer: 1,
    explanation:
      'The Poisson distribution models discrete count frequencies in a fixed interval of time/space given a known average rate lambda, assuming events occur independently. Exponential models interval time.',
  },
  {
    id: 17,
    numberStr: '17',
    indexRef: 'DM-2025-STAT-MCQ-017',
    domain: 'ALGORITHMS_INDEXING',
    paradigm: 'SPATIAL_COMPLEXITY',
    difficulty: '0.64 [ADVANCED]',
    marksStr: '+1.00 MARK / 0 WRONG',
    prompt:
      'What is the average query time complexity for finding the nearest neighbor in a balanced KD-Tree containing N spatial data points in low dimensions (D << N)?',
    options: [
      {
        key: 'A',
        label: 'O(log N)',
        subtext: 'Hierarchical axis-aligned bounding box traversal dividing space logarithmically',
      },
      {
        key: 'B',
        label: 'O(N²)',
        subtext: 'Exhaustive pairwise distance calculation across all sample coordinates',
      },
      {
        key: 'C',
        label: 'O(1)',
        subtext: 'Constant hash lookup via spatial locality-sensitive hashing',
      },
      {
        key: 'D',
        label: 'O(N · log N)',
        subtext: 'Sorting time required prior to each individual neighbor query',
      },
    ],
    correctAnswer: 0,
    explanation:
      'In low dimensions, querying a balanced KD-Tree takes O(log N) on average by pruning opposite subtrees when the hypersphere around the nearest neighbor candidate does not intersect the splitting plane.',
  },
  {
    id: 18,
    numberStr: '18',
    indexRef: 'DM-2025-STAT-MCQ-018',
    domain: 'SQL_ANALYTICS',
    paradigm: 'SET_OPERATIONS',
    difficulty: '0.36 [STANDARD]',
    marksStr: '+1.00 MARK / 0 WRONG',
    prompt:
      'In SQL query optimization, why is UNION ALL almost always significantly faster and less resource-intensive than UNION?',
    options: [
      {
        key: 'A',
        label: 'Elimination of Deduplication Sort/Hash',
        subtext: 'UNION performs expensive sort or hash pass to eliminate duplicate rows; UNION ALL simply appends result sets',
      },
      {
        key: 'B',
        label: 'Automatic Column Type Casting',
        subtext: 'UNION ALL bypasses schema validation rules during engine compilation',
      },
      {
        key: 'C',
        label: 'Partition Pruning Bypass',
        subtext: 'UNION ALL scans only primary keys while discarding secondary payload indexes',
      },
      {
        key: 'D',
        label: 'Index Cache Invalidation',
        subtext: 'UNION invalidates buffer cache whereas UNION ALL retains warm pages',
      },
    ],
    correctAnswer: 0,
    explanation:
      'UNION enforces set distinctness by executing a distributed sort or hash aggregation pass to strip duplicates. UNION ALL simply concatenates result streams with zero deduplication overhead.',
  },
  {
    id: 19,
    numberStr: '19',
    indexRef: 'DM-2025-STAT-MCQ-019',
    domain: 'CENTRAL_LIMIT_THEOREM',
    paradigm: 'SAMPLING_DISTRIBUTIONS',
    difficulty: '0.45 [STANDARD]',
    marksStr: '+1.00 MARK / 0 WRONG',
    prompt:
      'According to the Central Limit Theorem (CLT), as sample size n grows large (typically n >= 30), what happens to the sampling distribution of the sample mean?',
    options: [
      {
        key: 'A',
        label: 'Becomes Uniformly Distributed',
        subtext: 'Every possible mean value achieves equal probability density',
      },
      {
        key: 'B',
        label: 'Approaches a Normal Distribution',
        subtext: 'Converges to normal distribution regardless of the underlying population distribution shape',
      },
      {
        key: 'C',
        label: 'Standard Error Increases Linearly',
        subtext: 'Variance of sample means expands proportional to sqrt(n)',
      },
      {
        key: 'D',
        label: 'Adopts Parent Population Skewness',
        subtext: 'Mirrors non-normal multimodal distribution characteristics permanently',
      },
    ],
    correctAnswer: 1,
    explanation:
      'The Central Limit Theorem guarantees that the distribution of standardized sample means approaches a standard normal distribution as n -> infinity, irrespective of original population shape.',
  },
  {
    id: 20,
    numberStr: '20',
    indexRef: 'DM-2025-STAT-MCQ-020',
    domain: 'ENSEMBLE_LEARNING',
    paradigm: 'GRADIENT_BOOSTING',
    difficulty: '0.65 [ADVANCED]',
    marksStr: '+1.00 MARK / 0 WRONG',
    prompt:
      'In Gradient Boosted Decision Trees (GBDT), what specific target does each successive weak learner tree train to predict?',
    options: [
      {
        key: 'A',
        label: 'Original Ground-Truth Labels',
        subtext: 'Trains independently on bootstrap subsamples of original target y',
      },
      {
        key: 'B',
        label: 'Pseudo-Residuals (Negative Gradients)',
        subtext: 'Negative gradient of the differentiable loss function evaluated at current ensemble predictions',
      },
      {
        key: 'C',
        label: 'Sample Weight Inverses',
        subtext: 'Directly inverts instance weights like discrete AdaBoost',
      },
      {
        key: 'D',
        label: 'Linear Regression Slopes',
        subtext: 'Fits ordinary least squares hyperplanes along leaf nodes',
      },
    ],
    correctAnswer: 1,
    explanation:
      'Gradient Boosting frames learning as gradient descent in function space. Each new base learner fits the negative gradient (pseudo-residuals) of the loss function with respect to ensemble predictions.',
  },
];
