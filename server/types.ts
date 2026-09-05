export type DataType = 'numeric' | 'categorical' | 'datetime' | 'boolean' | 'text' | 'identifier' | 'unknown';

export interface ColumnProfile {
  name: string;
  type: DataType;
  totalCount: number;
  nullCount: number;
  nullPercentage: number;
  uniqueCount: number;
  uniquePercentage: number;
  sampleValues: (string | number | boolean | null)[];
  isIdentifier: boolean;
  // Numeric-specific stats
  min?: number;
  max?: number;
  mean?: number;
  median?: number;
  std?: number;
  sum?: number;
  variance?: number;
  q1?: number;
  q3?: number;
  iqr?: number;
  outlierCountIqr?: number;
  outlierCountZ?: number;
  distributionShape?: 'normal' | 'right-skewed' | 'left-skewed' | 'uniform' | 'bimodal';
  histogramBins?: { min: number; max: number; count: number; label: string }[];
  // Categorical-specific
  topCategories?: { category: string; count: number; percentage: number }[];
  mode?: string | number;
  // Datetime-specific
  earliestDate?: string;
  latestDate?: string;
  dateRangeDays?: number;
  // Quality & anomaly notes
  suspiciousValuesCount?: number;
  suspiciousReasons?: string[];
  stats?: {
    min?: number;
    max?: number;
    mean?: number;
    median?: number;
    std?: number;
    stdDev?: number;
    variance?: number;
    sum?: number;
    q1?: number;
    q3?: number;
    iqr?: number;
  };
}

export interface DatasetProfile {
  id: string;
  filename: string;
  rowCount: number;
  columnCount: number;
  memoryEstimateKb: number;
  duplicateRowCount: number;
  duplicateRowsCount?: number;
  duplicatePercentage: number;
  totalMissingCells: number;
  missingPercentage: number;
  columns: ColumnProfile[];
  piiSummary?: PiiDetection[];
  createdAt: string;
}

export interface PiiDetection {
  column: string;
  category: 'email' | 'phone' | 'ssn' | 'credit_card' | 'ip_address' | 'identifier' | 'name';
  severity: 'high' | 'medium' | 'low';
  matchedCount: number;
  recommendation: string;
}

export interface ComplianceAudit {
  complianceScore: number;
  gdprReady: boolean;
  hipaaSensitive: boolean;
  detectedPiiCount: number;
  piiFlags: PiiDetection[];
}

export interface QualityIssue {
  type: 'missing' | 'duplicate' | 'outlier' | 'type_mismatch' | 'anomaly' | 'empty_column' | 'constant_column' | 'pii_risk';
  severity: 'critical' | 'warning' | 'info';
  column?: string;
  affectedCount: number;
  percentage: number;
  title: string;
  description: string;
  recommendation: string;
  sampleIndices?: number[];
}

export interface DataQualityAudit {
  datasetId: string;
  score: number; // 0 - 100
  overallScore?: number;
  duplicateRowsCount?: number;
  rating: 'Excellent' | 'Good' | 'Fair' | 'Poor' | 'Critical';
  compliance?: ComplianceAudit;
  scoreBreakdown: {
    missingPenalty: number;
    duplicatePenalty: number;
    typeIssuePenalty: number;
    outlierPenalty: number;
    emptyColumnPenalty: number;
  };
  metrics: {
    healthyColumnCount: number;
    totalColumns: number;
    duplicateRows: number;
    duplicatePercentage: number;
    totalMissingCells: number;
    missingCellsPercentage: number;
    potentialOutliersTotal: number;
    potentialOutliersPercentage: number;
    typeInconsistentColumns: number;
    anomalyCount: number;
  };
  checklist: {
    passed: string[];
    warnings: string[];
    critical: string[];
  };
  issues: QualityIssue[];
  recommendations: string[];
}

export interface CorrelationMatrixResult {
  columns: string[];
  matrix: number[][];
}

export interface OutlierDrilldownItem {
  rowIndex: number;
  value: number;
  zScore: number;
  distanceFromBound: number;
  rowContext: Record<string, any>;
}

export interface OutlierDrilldownResult {
  column: string;
  totalOutliers?: number;
  bounds: {
    q1: number;
    q3: number;
    iqr: number;
    lowerBound: number;
    upperBound: number;
    mean: number;
    std: number;
  };
  outliers: OutlierDrilldownItem[];
}

export interface InsightItem {
  id: string;
  category: 'concentration' | 'trend' | 'correlation' | 'outlier' | 'data_quality' | 'profitability';
  title: string;
  finding: string;
  metric: string;
  secondaryMetric?: string;
  interpretation: string;
  dataContext: string;
  confidence: 'high' | 'medium';
  chartSuggestion?: {
    type: 'bar' | 'line' | 'scatter' | 'box' | 'pie';
    x?: string;
    y?: string;
  };
}

export type AllowedOperation =
  | 'aggregate'
  | 'group_aggregate'
  | 'filter'
  | 'ranking'
  | 'correlation'
  | 'distribution'
  | 'time_series'
  | 'comparison'
  | 'percentage_share'
  | 'outliers'
  | 'missing_values'
  | 'clarification';

export interface FilterCondition {
  column: string;
  operator: '==' | '!=' | '>' | '<' | '>=' | '<=' | 'contains' | 'date_range' | 'in';
  value: any;
  valueEnd?: any; // For date_range or range
}

export interface AnalysisPlan {
  operation: AllowedOperation;
  metric?: string;
  group_by?: string[];
  aggregation?: 'sum' | 'mean' | 'median' | 'count' | 'min' | 'max' | 'std';
  filters?: FilterCondition[];
  sort?: {
    column: string;
    direction: 'asc' | 'desc';
  };
  limit?: number;
  time_granularity?: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  secondary_metric?: string;
  visualization?: {
    type: 'bar' | 'line' | 'scatter' | 'histogram' | 'box' | 'heatmap' | 'pie' | 'table';
    x?: string;
    y?: string;
    title?: string;
  };
  mapped_columns?: Record<string, string>;
  user_intent_summary?: string;
}

export interface DataHandlingReport {
  totalRows: number;
  validRowsAnalyzed: number;
  excludedRows: number;
  missingValuesExcluded: number;
  invalidValuesExcluded: number;
  filteredOutRows: number;
  methodDescription: string;
  rulesApplied: string[];
  warnings: string[];
  confidenceScore: number;
  isDeterministic: boolean;
}

export interface AnalysisResult {
  success: boolean;
  question: string;
  plan: AnalysisPlan;
  answer: string;
  keyMetrics: { label: string; value: string; context?: string }[];
  businessInterpretation: string[];
  dataHandling: DataHandlingReport;
  rawData?: any;
  chart?: any; // Plotly figure { data: any[], layout: any, config?: any }
  warnings?: string[];
  error?: {
    code: string;
    message: string;
    reason?: string;
    suggestion?: string;
  };
}

export interface ChartConfig {
  type: 'bar' | 'line' | 'scatter' | 'histogram' | 'box' | 'pie' | 'heatmap' | 'combo' | 'treemap' | 'sunburst';
  xAxis?: string;
  yAxis?: string;
  secondaryYAxis?: string;
  colorDimension?: string;
  aggregation?: 'sum' | 'mean' | 'median' | 'count' | 'min' | 'max';
  groupBy?: string;
  filterColumn?: string;
  filterOperator?: string;
  filterValue?: string;
  sortBy?: string;
  sortDirection?: 'asc' | 'desc';
  topN?: number;
  title?: string;
}

export interface CleanActionRequest {
  datasetId: string;
  action: 'exclude_nulls' | 'impute_mean' | 'impute_median' | 'impute_mode' | 'impute_constant' | 'remove_duplicates' | 'trim_outliers' | 'coerce_numeric' | 'mask_pii';
  column?: string;
  constantValue?: any;
}

export type TransformAction =
  | 'calculated_column'
  | 'cast_type'
  | 'split_column'
  | 'find_replace'
  | 'text_case';

export interface TransformRequest {
  action?: TransformAction;
  type?: string;
  targetColumn?: string;
  sourceColumn?: string;
  formula?: string;
  findValue?: string;
  replaceValue?: string;
  datePart?: string;
  // For calculated column
  newColumnName?: string;
  calcMode?: 'binary_op' | 'expression' | 'condition';
  operand1?: string;
  operator?: '+' | '-' | '*' | '/' | '%' | 'concat';
  operand2?: string;
  isOperand2Constant?: boolean;
  expression?: string;
  conditionCol?: string;
  conditionOp?: '>' | '>=' | '<' | '<=' | '==' | '!=' | 'contains';
  conditionVal?: any;
  trueVal?: any;
  falseVal?: any;

  // For cast_type
  column?: string;
  targetType?: DataType;

  // For split_column
  delimiter?: string;
  splitCol?: string;
  maxSplits?: number;
  partNames?: string[];

  // For find_replace
  findText?: string;
  replaceText?: string;
  caseSensitive?: boolean;
  isRegex?: boolean;

  // For text_case
  caseMode?: 'upper' | 'lower' | 'title' | 'trim';
  caseType?: 'upper' | 'lower' | 'title' | 'trim';
}

export interface BusinessAssertion {
  id: string;
  name?: string;
  description?: string;
  column: string;
  ruleType?:
    | 'range'
    | 'positive'
    | 'non_negative'
    | 'not_null'
    | 'unique'
    | 'allowed_values'
    | 'regex'
    | 'date_comparison'
    | 'column_comparison'
    | 'min'
    | 'max';
  rule?: 'min' | 'max' | 'range' | 'not_null' | 'unique' | 'positive' | 'non_negative' | string;
  threshold?: number;
  severity?: 'critical' | 'warning' | 'info';
  operator?: '>' | '>=' | '<' | '<=' | '==' | '!=' | 'between' | 'in';
  expectedValue?: any;
  minValue?: number;
  maxValue?: number;
  allowedList?: string[];
  secondColumn?: string;
}

export interface AssertionEvaluationResult {
  ruleId: string;
  name: string;
  column: string;
  passedCount: number;
  failedCount: number;
  totalEvaluated: number;
  passRate: number;
  status: 'passed' | 'warning' | 'failed';
  sampleViolations: { rowIndex: number; value: any; rowSummary: Record<string, any> }[];
}

export interface BusinessCalculations {
  totalRevenue: number;
  totalRevenueFormatted: string;
  totalProfit: number;
  totalProfitFormatted: string;
  profitMarginPct: number;
  profitMarginFormatted: string;
  averageOrderValue: number;
  averageOrderValueFormatted: string;
  topSegmentName: string;
  topSegmentRevenue: number;
  topSegmentSharePct: number;
  topSegmentShareFormatted: string;
  paretoTop20SharePct: number;
  paretoTop20ShareFormatted: string;
  periodGrowthPct: number | null;
  periodGrowthFormatted: string;
  refundAdjustmentCount: number;
  refundAdjustmentTotal: number;
  refundAdjustmentFormatted: string;
  efficiencyRatio: number;
  efficiencyRatioFormatted: string;
}

export interface StrategicActionItem {
  id: string;
  category: 'Immediate 30-Day' | '60-90 Day Optimization' | 'Governance & Data Quality' | 'Risk & Sensitivity';
  title: string;
  action: string;
  expectedImpact: string;
  priority: 'Critical' | 'High' | 'Medium';
  responsibleRole: string;
}

export interface ReportVisualSection {
  id: string;
  title: string;
  subtitle: string;
  businessInterpretation: string;
  keyTakeaway: string;
  chart: any;
  chartType: string;
}

export interface ExecutiveReport {
  generatedAt: string;
  datasetName: string;
  datasetId: string;
  datasetScale: {
    rows: number;
    columns: number;
    completenessScore: number;
    primaryDomain: string;
  };
  executiveBrief: {
    headline: string;
    overview: string;
    macroContext: string;
    strengths: string[];
    risks: string[];
    aiGenerated?: boolean;
  };
  businessEconomics: BusinessCalculations;
  kpis: {
    title: string;
    value: string;
    subValue?: string;
    trend?: 'up' | 'down' | 'neutral';
    trendValue?: string;
    status: 'good' | 'warning' | 'neutral' | 'danger';
  }[];
  visualSections: ReportVisualSection[];
  dataQualityHealth: {
    overallScore: number;
    status: 'Excellent' | 'Good' | 'Needs Attention';
    totalRows: number;
    duplicateRows: number;
    outlierCount: number;
    nullRate: number;
    complianceNote: string;
  };
  actionPlan: StrategicActionItem[];
  reproducibleScript: {
    python: string;
    sql: string;
  };
}


