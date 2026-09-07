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
  topCategories?: { category: string; count: number; percentage: number }[];
  mode?: string | number;
  earliestDate?: string;
  latestDate?: string;
  dateRangeDays?: number;
  suspiciousValuesCount?: number;
  suspiciousReasons?: string[];
}

export interface DatasetProfile {
  id: string;
  filename: string;
  rowCount: number;
  columnCount: number;
  memoryEstimateKb: number;
  duplicateRowCount: number;
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
  score: number;
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
  matrix: (number | null)[][];
  undefinedDetails?: { col1: string; col2: string; reason: string }[];
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
  datasetId?: string;
  plan: any;
  answer: string;
  keyMetrics: { label: string; value: string; context?: string }[];
  businessInterpretation: string[];
  dataHandling: DataHandlingReport;
  rawData?: any;
  chart?: any;
  warnings?: string[];
  error?: {
    code: string;
    message: string;
    reason?: string;
    suggestion?: string;
  };
}

export interface DatasetListItem {
  id: string;
  filename: string;
  rowCount: number;
  columnCount: number;
  isSample: boolean;
  createdAt: string;
}

export interface DashboardKPI {
  id: string;
  title: string;
  value: string;
  rawNumber?: number;
  subtitle: string;
  trend?: 'up' | 'down' | 'neutral';
  trendLabel?: string;
  sparkline?: number[];
  accentColor: 'blue' | 'emerald' | 'violet' | 'amber' | 'cyan' | 'rose';
  icon?: string;
}

export interface DashboardDimensionItem {
  category: string;
  count: number;
  primarySum: number;
  primaryAvg: number;
  secondarySum: number;
  secondaryAvg: number;
  share: number;
  ratio?: number;
}

export interface DashboardTimeSeriesPoint {
  period: string;
  primarySum: number;
  secondarySum: number;
  count: number;
}

export interface DashboardMetricsSummary {
  primaryMetric: string;
  secondaryMetric: string;
  primaryTotalFormatted: string;
  primaryMeanFormatted: string;
  secondaryTotalFormatted: string;
  secondaryMeanFormatted: string;
  ratioFormatted: string;
  filteredRowCount: number;
  totalRowCount: number;
  profitMarginFormatted?: string;
  averageOrderValueFormatted?: string;
  topSegmentName?: string;
  topSegmentShareFormatted?: string;
  paretoTop20ShareFormatted?: string;
  periodGrowthFormatted?: string;
  refundAdjustmentTotalFormatted?: string;
  refundAdjustmentCount?: number;
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

export interface DashboardData {
  datasetId: string;
  totalDatasetRows: number;
  activeRowsCount: number;
  filterPercentage: number;
  dimension?: string;
  metrics?: DashboardMetricsSummary;
  businessCalculations?: BusinessCalculations;
  activeFilters: {
    dimension: string;
    metric: string;
    secondaryMetric: string;
    filterCol?: string;
    filterVal?: string;
    timeCol?: string;
    timeGrain?: string;
  };
  kpiCards: DashboardKPI[];
  dimensionBreakdown: DashboardDimensionItem[];
  timeSeries: DashboardTimeSeriesPoint[];
  scatterCorrelation: {
    r: number;
    points: { x: number; y: number; label: string; category: string }[];
    xName: string;
    yName: string;
  };
  charts: {
    barChart: any;
    donutChart: any;
    trendChart: any;
    scatterChart: any;
  };
  comboChart?: any;
  treemapChart?: any;
  pieChart?: any;
  timeSeriesChart?: any;
  rankChart?: any;
  availableDimensions: string[];
  availableMetrics: string[];
  availableTimeColumns: string[];
  dimensionDistinctValues: string[];
}

export type ActiveTab =
  | 'overview'
  | 'dashboard'
  | 'report'
  | 'company360'
  | 'profile'
  | 'quality'
  | 'insights'
  | 'ask'
  | 'studio'
  | 'transform'
  | 'explorer'
  | 'cleaner';

export type TransformAction =
  | 'calculated_column'
  | 'cast_type'
  | 'split_column'
  | 'find_replace'
  | 'text_case';

export interface TransformRequest {
  action: TransformAction;
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

export interface TransformResult {
  action: string;
  summary: string;
  rowsAffected: number;
  newColumnNames?: string[];
  previewDifferences: { index: number; column: string; before: any; after: any }[];
  profile?: DatasetProfile;
  canUndo: boolean;
}

export interface BusinessAssertion {
  id: string;
  name: string;
  description?: string;
  column: string;
  ruleType:
    | 'range'
    | 'positive'
    | 'non_negative'
    | 'not_null'
    | 'unique'
    | 'allowed_values'
    | 'regex'
    | 'date_comparison'
    | 'column_comparison';
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

export interface PinnedChart {
  id: string;
  title: string;
  subtitle?: string;
  sourceQuestion?: string;
  chart: any;
  pinnedAt: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  result?: AnalysisResult;
}

export interface StrategicActionItem {
  id: string;
  category: 'Immediate 30-Day' | '60-90 Day Optimization' | 'Governance & Data Quality' | 'Risk & Sensitivity';
  title: string;
  action: string;
  expectedImpact: string;
  priority: 'Critical' | 'High' | 'Medium';
  responsibleRole: string;
  status?: 'planned' | 'in_progress' | 'completed';
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
  insights?: InsightItem[];
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

export type DepartmentType = 'Leads' | 'Marketing' | 'Sales' | 'Operations' | 'Finance' | 'Executive' | 'General';

export interface DepartmentDatasetSummary {
  id: string;
  filename: string;
  department: DepartmentType;
  rowCount: number;
  columnCount: number;
  keyColumns: string[];
  healthScore: number;
  detectedMetrics: {
    name: string;
    value: string | number;
    description: string;
  }[];
}

export interface DatasetRelationshipLink {
  sourceDatasetId: string;
  sourceDatasetName: string;
  sourceDepartment: DepartmentType;
  sourceKey: string;
  targetDatasetId: string;
  targetDatasetName: string;
  targetDepartment: DepartmentType;
  targetKey: string;
  matchPercentage: number;
  matchType: 'one-to-many' | 'one-to-one' | 'many-to-one';
  joinStatus: 'healthy' | 'moderate_overlap' | 'low_overlap';
}

export interface CrossFunctionalKpi {
  id: string;
  title: string;
  value: string | number;
  benchmarkOrTarget?: string;
  trend: 'positive' | 'negative' | 'neutral';
  trendValue: string;
  departmentsInvolved: DepartmentType[];
  description: string;
  formula: string;
}

export interface LeakageStep {
  label: string;
  amount: number;
  percentageOfGross: number;
  type: 'revenue' | 'reduction' | 'net';
  department: DepartmentType;
  description: string;
}

export interface StrategicImprovementAction {
  id: string;
  department: 'Executive' | 'Marketing' | 'Sales' | 'Operations' | 'Finance';
  priority: 'Critical' | 'High' | 'Medium';
  timeframe: 'Immediate 30-Day' | '60-90 Day' | 'Long-Term Strategic';
  title: string;
  finding: string;
  rootCause: string;
  concreteAction: string;
  expectedFinancialImpact: string;
  impactMetric?: string;
  annualEbitdaImpact?: number;
  responsibleRole: string;
  status: 'planned' | 'in_progress' | 'completed';
}

export interface CrossDepartmentRisk {
  id: string;
  title: string;
  severity: 'Critical' | 'Warning' | 'Moderate';
  departments: DepartmentType[];
  metricImpact: string;
  evidence: string;
  recommendedIntervention: string;
}

export interface Company360Analysis {
  generatedAt: string;
  executiveHeadline: string;
  overallHealthScore: number;
  synthesisSummary: string;
  macroContext: string;
  datasets: DepartmentDatasetSummary[];
  relationships: DatasetRelationshipLink[];
  crossFunctionalKpis: CrossFunctionalKpi[];
  leakageWaterfall: LeakageStep[];
  strategicActions: StrategicImprovementAction[];
  crossDepartmentRisks: CrossDepartmentRisk[];
  unprofitableSegmentsOrSkus?: {
    name: string;
    category: string;
    grossSales: number;
    fulfillmentAndReturnCosts: number;
    netMarginPct: number;
    returnRate: number;
    verdict: string;
  }[];
  marketingEfficiencyMatrix?: {
    channel: string;
    spend: number;
    leads: number;
    closedDeals: number;
    revenue: number;
    mer: number;
    cac: number;
    verdict: string;
  }[];
  fulfillmentSlaOverview?: {
    carrier: string;
    shipmentCount: number;
    slaBreachRate: number;
    returnRate: number;
    avgDeliveryDays: number;
    status: 'Healthy' | 'Needs Attention' | 'Severe Bottleneck';
  }[];
}



