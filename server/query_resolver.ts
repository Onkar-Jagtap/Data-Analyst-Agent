import {
  AnalysisPlan,
  ColumnProfile,
  DatasetProfile,
  FilterCondition,
} from './types.js';

export interface ColumnMatchResult {
  status: 'exact' | 'case_insensitive' | 'normalized' | 'synonym' | 'strong_fuzzy' | 'ambiguous' | 'not_found';
  column?: ColumnProfile;
  candidates?: ColumnProfile[];
  confidence: 'high' | 'medium' | 'low' | 'none';
  matchTier?: string;
  reason?: string;
}

export interface MetricResolutionResult {
  status: 'resolved' | 'ambiguous' | 'unknown' | 'none';
  metric?: string;
  column?: ColumnProfile;
  candidates?: ColumnProfile[];
  confidence: 'high' | 'medium' | 'low' | 'none';
  reason?: string;
  clarificationMessage?: string;
}

export interface AggregationResolutionResult {
  aggregation: 'sum' | 'mean' | 'median' | 'count' | 'min' | 'max' | 'std';
  sortDirection: 'asc' | 'desc';
  confidence: 'high' | 'medium';
  isRatioOrPercentage: boolean;
  reason: string;
}

export interface PlanValidationResult {
  valid: boolean;
  repairedPlan: AnalysisPlan;
  clarificationNeeded?: boolean;
  error?: {
    code: string;
    message: string;
    reason?: string;
    suggestion?: string;
  };
}

// ----------------------------------------------------
// NORMALIZATION & STRING UTILITIES
// ----------------------------------------------------

export function normalizeIdentifier(str: string): string {
  if (!str) return '';
  return str.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function escapeRegex(text: string): string {
  return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
}

// ----------------------------------------------------
// SYNONYM TAXONOMY
// ----------------------------------------------------

interface SynonymDefinition {
  canonicalKey: string;
  type: 'numeric' | 'categorical' | 'datetime';
  synonyms: string[];
}

const SYNONYM_DICTIONARY: SynonymDefinition[] = [
  {
    canonicalKey: 'revenue',
    type: 'numeric',
    synonyms: [
      'revenue',
      'sales',
      'turnover',
      'gross revenue',
      'gross sales',
      'billing',
      'billings',
      'topline',
      'total sales',
      'total revenue',
      'sales amount',
      'revenue amount',
    ],
  },
  {
    canonicalKey: 'profit',
    type: 'numeric',
    synonyms: [
      'profit',
      'net profit',
      'earnings',
      'net income',
      'gain',
      'bottomline',
      'operating profit',
      'gross profit',
      'total profit',
      'margin',
      'margins',
      'profit margin',
      'average margin',
    ],
  },
  {
    canonicalKey: 'margin',
    type: 'numeric',
    synonyms: [
      'profit margin',
      'margin',
      'net margin',
      'operating margin',
      'margin percentage',
      'margin pct',
      'margin rate',
    ],
  },
  {
    canonicalKey: 'quantity',
    type: 'numeric',
    synonyms: [
      'quantity',
      'qty',
      'units',
      'unit count',
      'units sold',
      'volume',
      'order volume',
      'items sold',
      'count of items',
    ],
  },
  {
    canonicalKey: 'cost',
    type: 'numeric',
    synonyms: [
      'cost',
      'costs',
      'cogs',
      'expense',
      'expenses',
      'spend',
      'spending',
      'expenditure',
      'total cost',
    ],
  },
  {
    canonicalKey: 'price',
    type: 'numeric',
    synonyms: ['price', 'unit price', 'selling price', 'retail price', 'fee', 'charge'],
  },
  {
    canonicalKey: 'discount',
    type: 'numeric',
    synonyms: ['discount', 'discount amount', 'discount rate', 'rebate', 'markdown'],
  },
  {
    canonicalKey: 'order_value',
    type: 'numeric',
    synonyms: [
      'order value',
      'average order value',
      'aov',
      'deal size',
      'transaction value',
      'basket size',
      'avg order value',
    ],
  },
  {
    canonicalKey: 'region',
    type: 'categorical',
    synonyms: ['region', 'territory', 'geography', 'geo', 'area', 'zone', 'market', 'location'],
  },
  {
    canonicalKey: 'country',
    type: 'categorical',
    synonyms: ['country', 'nation', 'state', 'province'],
  },
  {
    canonicalKey: 'product',
    type: 'categorical',
    synonyms: ['product', 'item', 'sku', 'product name', 'offering', 'good', 'merchandise'],
  },
  {
    canonicalKey: 'category',
    type: 'categorical',
    synonyms: ['category', 'product category', 'department', 'line', 'class', 'classification'],
  },
  {
    canonicalKey: 'segment',
    type: 'categorical',
    synonyms: ['segment', 'customer segment', 'tier', 'cohort', 'audience', 'group'],
  },
  {
    canonicalKey: 'customer',
    type: 'categorical',
    synonyms: ['customer', 'client', 'account', 'buyer', 'consumer', 'patron', 'customer name'],
  },
  {
    canonicalKey: 'date',
    type: 'datetime',
    synonyms: [
      'date',
      'order date',
      'transaction date',
      'timestamp',
      'created at',
      'time',
      'day',
      'month',
      'year',
    ],
  },
];

// Generic / ambiguous metric tokens that do not point to a specific column
export const GENERIC_METRIC_TERMS = [
  'total',
  'the total',
  'show total',
  'show the total',
  'what is the total',
  'calculate total',
  'performance',
  'show performance',
  'overall performance',
  'value',
  'show value',
  'the value',
  'data',
  'numbers',
  'summary',
  'metrics',
  'results',
  'stats',
  'statistics',
  'figures',
];

// ----------------------------------------------------
// 1. DETERMINISTIC COLUMN RESOLUTION HIERARCHY
// ----------------------------------------------------

/**
 * Resolves a requested column identifier against available dataset columns using
 * the deterministic 6-tier hierarchy:
 * 1. Exact column-name match
 * 2. Case-insensitive exact match
 * 3. Normalized exact match (ignoring spaces, underscores, symbols)
 * 4. Known semantic synonym match
 * 5. Strong fuzzy match (word boundary token match)
 * 6. Ambiguous / Not Found
 */
export function resolveColumn(
  target: string,
  columns: ColumnProfile[],
  options?: {
    typeFilter?: 'numeric' | 'categorical' | 'datetime' | 'any';
  }
): ColumnMatchResult {
  const trimmed = target ? target.trim() : '';
  if (!trimmed) {
    return { status: 'not_found', confidence: 'none', reason: 'Empty column target provided' };
  }

  const pool = options?.typeFilter && options.typeFilter !== 'any'
    ? columns.filter(c => {
        if (options.typeFilter === 'numeric') return c.type === 'numeric';
        if (options.typeFilter === 'datetime') return c.type === 'datetime';
        if (options.typeFilter === 'categorical') return c.type === 'categorical' || c.type === 'text';
        return true;
      })
    : columns;

  if (pool.length === 0) {
    return { status: 'not_found', confidence: 'none', reason: 'No columns available matching type filter' };
  }

  // TIER 1: Exact column-name match
  const exact = pool.find(c => c.name === trimmed);
  if (exact) {
    return {
      status: 'exact',
      column: exact,
      confidence: 'high',
      matchTier: '1-exact',
    };
  }

  // TIER 2: Case-insensitive exact match
  const trimmedLower = trimmed.toLowerCase();
  const caseInsensitiveMatches = pool.filter(c => c.name.toLowerCase() === trimmedLower);
  if (caseInsensitiveMatches.length === 1) {
    return {
      status: 'case_insensitive',
      column: caseInsensitiveMatches[0],
      confidence: 'high',
      matchTier: '2-case_insensitive',
    };
  } else if (caseInsensitiveMatches.length > 1) {
    return {
      status: 'ambiguous',
      candidates: caseInsensitiveMatches,
      confidence: 'medium',
      matchTier: '2-case_insensitive_ambiguous',
      reason: `Multiple columns match case-insensitively: ${caseInsensitiveMatches.map(c => c.name).join(', ')}`,
    };
  }

  // TIER 3: Normalized exact match (strip non-alphanumeric)
  const normTarget = normalizeIdentifier(trimmed);
  if (normTarget) {
    const normMatches = pool.filter(c => normalizeIdentifier(c.name) === normTarget);
    if (normMatches.length === 1) {
      return {
        status: 'normalized',
        column: normMatches[0],
        confidence: 'high',
        matchTier: '3-normalized',
      };
    } else if (normMatches.length > 1) {
      return {
        status: 'ambiguous',
        candidates: normMatches,
        confidence: 'medium',
        matchTier: '3-normalized_ambiguous',
        reason: `Multiple columns match normalized name '${normTarget}': ${normMatches.map(c => c.name).join(', ')}`,
      };
    }
  }

  // TIER 4: Known semantic synonym match
  // Find which synonym definition matches the target
  const matchingSynGroups = SYNONYM_DICTIONARY.filter(group => {
    return group.synonyms.some(s => {
      return s.toLowerCase() === trimmedLower || normalizeIdentifier(s) === normTarget;
    });
  });

  if (matchingSynGroups.length > 0) {
    const synonymCandidateColumns: ColumnProfile[] = [];
    for (const group of matchingSynGroups) {
      for (const col of pool) {
        const colNorm = normalizeIdentifier(col.name);
        const colLower = col.name.toLowerCase();
        // Check if column matches canonicalKey or any synonym in that group
        const matchesCol =
          colLower === group.canonicalKey ||
          colNorm === normalizeIdentifier(group.canonicalKey) ||
          group.synonyms.some(s => colLower === s.toLowerCase() || colNorm === normalizeIdentifier(s));

        if (matchesCol && !synonymCandidateColumns.some(c => c.name === col.name)) {
          synonymCandidateColumns.push(col);
        }
      }
    }

    if (synonymCandidateColumns.length === 1) {
      return {
        status: 'synonym',
        column: synonymCandidateColumns[0],
        confidence: 'high',
        matchTier: '4-synonym',
      };
    } else if (synonymCandidateColumns.length > 1) {
      // If one candidate is an exact match for target, it would have been caught in Tier 1/2/3.
      // Multiple synonym candidates -> Ambiguous! Never blindly pick the first!
      return {
        status: 'ambiguous',
        candidates: synonymCandidateColumns,
        confidence: 'medium',
        matchTier: '4-synonym_ambiguous',
        reason: `Synonym '${trimmed}' ambiguously maps to multiple columns: ${synonymCandidateColumns.map(c => c.name).join(', ')}`,
      };
    }
  }

  // TIER 5: Strong fuzzy match (Word boundary token match)
  // Must match as a distinct whole token in the column name (e.g. \bRevenue\b or \bSales\b)
  const escapedTarget = escapeRegex(trimmedLower);
  const wordBoundaryRegex = new RegExp(`\\b${escapedTarget}\\b`, 'i');

  const wordBoundaryMatches = pool.filter(c => {
    return wordBoundaryRegex.test(c.name);
  });

  if (wordBoundaryMatches.length === 1) {
    return {
      status: 'strong_fuzzy',
      column: wordBoundaryMatches[0],
      confidence: 'medium',
      matchTier: '5-strong_fuzzy',
    };
  } else if (wordBoundaryMatches.length > 1) {
    // E.g., target 'Sales' matches 'Sales Growth' and 'Sales Target'
    return {
      status: 'ambiguous',
      candidates: wordBoundaryMatches,
      confidence: 'medium',
      matchTier: '5-strong_fuzzy_ambiguous',
      reason: `Target '${trimmed}' matches multiple columns: ${wordBoundaryMatches.map(c => c.name).join(', ')}`,
    };
  }

  // TIER 6: Not found
  return {
    status: 'not_found',
    confidence: 'none',
    reason: `No matching column found for '${trimmed}'`,
  };
}

// ----------------------------------------------------
// 2. SAFE METRIC RESOLUTION FROM QUERY
// ----------------------------------------------------

/**
 * Safely resolves the intended numeric metric from a natural language question.
 *
 * Rules:
 * - High confidence: user wording clearly resolves to exactly one column.
 * - Medium confidence: multiple columns plausible -> do NOT automatically choose first. Return clarification.
 * - Low confidence / generic query ("Show the total", "Show performance", "Show value"):
 *   do NOT silently default to first numeric column. Return structured clarification.
 */
export function resolveMetricFromQuery(
  question: string,
  columns: ColumnProfile[],
  previousPlan?: AnalysisPlan
): MetricResolutionResult {
  const q = question.toLowerCase().trim();
  const numCols = columns.filter(c => c.type === 'numeric');

  if (numCols.length === 0) {
    return {
      status: 'none',
      confidence: 'none',
      reason: 'Dataset contains no numeric columns.',
      clarificationMessage: 'Your dataset does not contain any numeric metric columns to analyze.',
    };
  }

  // Check if query is completely generic without specifying a metric
  const isGenericMetricQuery = GENERIC_METRIC_TERMS.some(term => {
    // Exact or phrase match
    return q === term || q === `${term}?` || q.startsWith(`${term} `) || q.endsWith(` ${term}`);
  });

  // Check if this is a follow-up that refers back to previous metric ("this", "that", "it", "the total")
  const isReferentialFollowUp =
    previousPlan?.metric &&
    (q.includes('this') ||
      q.includes('that') ||
      q.includes('it') ||
      q === 'what is the total' ||
      q === 'what is the total?' ||
      q === 'show total' ||
      q === 'the total');

  if (isReferentialFollowUp && previousPlan?.metric) {
    const prevCol = numCols.find(c => c.name === previousPlan.metric);
    if (prevCol) {
      return {
        status: 'resolved',
        metric: prevCol.name,
        column: prevCol,
        confidence: 'high',
        reason: `Inherited metric '${prevCol.name}' from previous query.`,
      };
    }
  }

  // Check direct column matches against the query
  // Sort columns by name length descending so multi-word columns ("Order Value", "Sales Growth")
  // are tested before single-word columns ("Value", "Sales")
  const sortedNumCols = [...numCols].sort((a, b) => b.name.length - a.name.length);

  const matchedDirectColumns: ColumnProfile[] = [];
  for (const col of sortedNumCols) {
    const colNameLower = col.name.toLowerCase();
    const colRegex = new RegExp(`\\b${escapeRegex(colNameLower)}\\b`, 'i');
    if (colRegex.test(q)) {
      matchedDirectColumns.push(col);
    }
  }

  if (matchedDirectColumns.length === 1) {
    return {
      status: 'resolved',
      metric: matchedDirectColumns[0].name,
      column: matchedDirectColumns[0],
      confidence: 'high',
      reason: `Direct mention of column '${matchedDirectColumns[0].name}'.`,
    };
  } else if (matchedDirectColumns.length > 1) {
    // Multiple numeric columns mentioned (e.g. "sales and quantity", "revenue vs profit")
    // Check if correlation or comparison or combo
    return {
      status: 'resolved',
      metric: matchedDirectColumns[0].name,
      column: matchedDirectColumns[0],
      candidates: matchedDirectColumns,
      confidence: 'high',
      reason: `Primary metric '${matchedDirectColumns[0].name}' resolved among mentioned columns.`,
    };
  }

  // Check synonym matching against question tokens
  const synonymMatches: ColumnProfile[] = [];
  for (const group of SYNONYM_DICTIONARY.filter(g => g.type === 'numeric')) {
    for (const syn of group.synonyms) {
      const synRegex = new RegExp(`\\b${escapeRegex(syn.toLowerCase())}\\b`, 'i');
      if (synRegex.test(q)) {
        // Find which column in dataset matches this synonym group
        for (const col of numCols) {
          const colLower = col.name.toLowerCase();
          const colNorm = normalizeIdentifier(col.name);
          const groupNorm = normalizeIdentifier(group.canonicalKey);
          if (
            colLower === group.canonicalKey ||
            colNorm === groupNorm ||
            group.synonyms.some(s => colLower === s.toLowerCase() || colNorm === normalizeIdentifier(s))
          ) {
            if (!synonymMatches.some(c => c.name === col.name)) {
              synonymMatches.push(col);
            }
          }
        }
      }
    }
  }

  if (synonymMatches.length === 1) {
    return {
      status: 'resolved',
      metric: synonymMatches[0].name,
      column: synonymMatches[0],
      confidence: 'high',
      reason: `Mapped query term to column '${synonymMatches[0].name}' via synonym taxonomy.`,
    };
  } else if (synonymMatches.length > 1) {
    // Multiple synonym matches (e.g. "sales" when dataset has Sales Growth and Sales Target)
    return {
      status: 'ambiguous',
      candidates: synonymMatches,
      confidence: 'medium',
      reason: `Query matched multiple candidate metrics: ${synonymMatches.map(c => c.name).join(', ')}`,
      clarificationMessage: `Which metric would you like me to analyze: ${synonymMatches.map(c => c.name).join(', ')}?`,
    };
  }

  // If query specifically asks for a metric not found in the dataset
  // (e.g. "Show Customer Lifetime Value", "What is churn rate?")
  const potentialMetricQuestions = ['what is', 'show', 'calculate', 'analyze', 'get', 'highest', 'lowest', 'total'];
  const hasQuestionStructure = potentialMetricQuestions.some(p => q.startsWith(p));
  if (hasQuestionStructure && !isGenericMetricQuery) {
    // Extract likely noun phrase after question word
    const cleaned = q.replace(/^(what is|show|calculate|analyze|get|what's)\s+(the\s+)?/i, '').trim();
    if (cleaned.length > 2 && !['data', 'everything', 'dataset', 'overview'].includes(cleaned)) {
      // User named a specific entity that is not in the dataset!
      return {
        status: 'unknown',
        confidence: 'low',
        reason: `Could not find requested metric '${cleaned}' in dataset.`,
        clarificationMessage: `I couldn't find a metric matching '${cleaned}' in your dataset. Available numeric metrics are: ${numCols.map(c => c.name).join(', ')}.`,
      };
    }
  }

  // Generic query handling: "Show the total", "Show performance", "Show value"
  if (isGenericMetricQuery || q.includes('total') || q.includes('performance') || q.includes('value')) {
    if (numCols.length === 1) {
      // Only 1 numeric column exists, so there is no ambiguity
      return {
        status: 'resolved',
        metric: numCols[0].name,
        column: numCols[0],
        confidence: 'medium',
        reason: `Dataset contains exactly one numeric column: '${numCols[0].name}'.`,
      };
    }

    // MULTIPLE numeric columns exist: DO NOT SILENTLY USE numCols[0]!
    return {
      status: 'ambiguous',
      candidates: numCols,
      confidence: 'none',
      reason: 'Generic metric query without specified column.',
      clarificationMessage: `Which metric would you like me to analyze: ${numCols.map(c => c.name).join(', ')}?`,
    };
  }

  // Fallback: If no metric could be determined and multiple exist -> Clarification
  if (numCols.length > 1) {
    return {
      status: 'ambiguous',
      candidates: numCols,
      confidence: 'none',
      reason: 'No distinct numeric metric could be determined.',
      clarificationMessage: `I couldn't determine which metric you mean. Your dataset contains ${numCols.map(c => c.name).join(', ')}. Which one should I analyze?`,
    };
  } else {
    // Only 1 numeric column exists
    return {
      status: 'resolved',
      metric: numCols[0].name,
      column: numCols[0],
      confidence: 'medium',
      reason: `Dataset contains only single numeric metric: '${numCols[0].name}'.`,
    };
  }
}

// ----------------------------------------------------
// 3. SEMANTIC AGGREGATION RESOLUTION
// ----------------------------------------------------

/**
 * Checks if a metric column is a percentage, ratio, margin, or rate where SUM is mathematically invalid.
 */
export function isRatioOrPercentage(colName: string): boolean {
  const lower = colName.toLowerCase();
  return (
    lower.includes('margin') ||
    lower.includes('percent') ||
    lower.includes('pct') ||
    lower.includes('ratio') ||
    lower.includes('rate') ||
    lower.includes('share') ||
    lower.includes('proportion')
  );
}

/**
 * Determines the correct mathematical aggregation for the query and metric.
 *
 * Rules:
 * - "highest average order value" -> AVG (mean), NOT SUM!
 * - "highest profit" -> SUM (unless average is explicitly mentioned).
 * - "highest profit margin" -> AVG (mean), because percentages/margins must never be summed!
 * - "lowest" -> sort direction 'asc'.
 * - "highest" -> sort direction 'desc'.
 */
export function resolveAggregation(
  question: string,
  metricCol?: ColumnProfile | string,
  explicitAgg?: string
): AggregationResolutionResult {
  const q = question.toLowerCase().trim();
  const colName = typeof metricCol === 'string' ? metricCol : metricCol?.name || '';
  const isRatio = isRatioOrPercentage(colName) || isRatioOrPercentage(q);

  const isAscending =
    q.includes('lowest') ||
    q.includes('minimum') ||
    q.includes('min') ||
    q.includes('least') ||
    q.includes('bottom') ||
    q.includes('worst');

  const sortDirection: 'asc' | 'desc' = isAscending ? 'asc' : 'desc';

  // 1. Explicit average / mean / aov
  if (
    q.includes('average') ||
    q.includes('avg') ||
    q.includes('mean') ||
    q.includes('aov') ||
    explicitAgg === 'mean' ||
    explicitAgg === 'average'
  ) {
    return {
      aggregation: 'mean',
      sortDirection,
      confidence: 'high',
      isRatioOrPercentage: isRatio,
      reason: 'Explicit average requested in query.',
    };
  }

  // 2. Explicit median
  if (q.includes('median') || explicitAgg === 'median') {
    return {
      aggregation: 'median',
      sortDirection,
      confidence: 'high',
      isRatioOrPercentage: isRatio,
      reason: 'Explicit median requested.',
    };
  }

  // 3. Explicit count / frequency
  if (
    q.includes('how many') ||
    q.includes('count') ||
    q.includes('frequency') ||
    q.includes('number of orders') ||
    q.includes('number of transactions') ||
    explicitAgg === 'count'
  ) {
    return {
      aggregation: 'count',
      sortDirection,
      confidence: 'high',
      isRatioOrPercentage: false,
      reason: 'Count / frequency operation requested.',
    };
  }

  // 4. Mathematical guardrail: Ratios, percentages, and margins must NEVER be summed!
  if (isRatio) {
    return {
      aggregation: 'mean',
      sortDirection,
      confidence: 'high',
      isRatioOrPercentage: true,
      reason: `Metric '${colName}' is a percentage/margin/ratio; automatically enforced MEAN instead of SUM.`,
    };
  }

  // 5. Min / Max explicit operations
  if (q.includes('minimum of') || q.includes('min of')) {
    return {
      aggregation: 'min',
      sortDirection: 'asc',
      confidence: 'high',
      isRatioOrPercentage: false,
      reason: 'Explicit minimum aggregation requested.',
    };
  }
  if (q.includes('maximum of') || q.includes('max of')) {
    return {
      aggregation: 'max',
      sortDirection: 'desc',
      confidence: 'high',
      isRatioOrPercentage: false,
      reason: 'Explicit maximum aggregation requested.',
    };
  }

  // 6. Explicit total / sum
  if (q.includes('total') || q.includes('sum') || explicitAgg === 'sum') {
    return {
      aggregation: 'sum',
      sortDirection,
      confidence: 'high',
      isRatioOrPercentage: false,
      reason: 'Total / sum requested.',
    };
  }

  // Default for standard metrics in ranking/breakdown queries is SUM
  return {
    aggregation: 'sum',
    sortDirection,
    confidence: 'high',
    isRatioOrPercentage: false,
    reason: 'Standard additive metric default.',
  };
}

// ----------------------------------------------------
// 4. PLAN VALIDATION & REPAIR (Gemini & Deterministic)
// ----------------------------------------------------

/**
 * Validates and repairs an AnalysisPlan returned by Gemini or deterministic parser.
 * Enforces schema fidelity:
 * - Replaces hallucinated or inexact columns with exact dataset column names.
 * - Rejects non-existent columns without fabricating.
 * - Enforces that metrics for sum/mean are numeric.
 * - Corrects improper aggregations (e.g. sum of percentages).
 */
export function validateAndRepairPlan(
  rawPlan: any,
  profile: DatasetProfile,
  question?: string
): PlanValidationResult {
  const q = typeof question === 'string' ? question.toLowerCase().trim() : '';
  const numCols = profile.columns.filter(c => c.type === 'numeric');
  const catCols = profile.columns.filter(c => c.type === 'categorical' || c.type === 'text');
  const dateCols = profile.columns.filter(c => c.type === 'datetime');

  if (!rawPlan || typeof rawPlan !== 'object') {
    return {
      valid: false,
      repairedPlan: {
        operation: 'clarification' as any,
        user_intent_summary: 'Could not construct a valid analytical plan.',
      },
      error: {
        code: 'INVALID_PLAN',
        message: 'Unable to parse analysis plan.',
        suggestion: 'Please rephrase your analytical question.',
      },
    };
  }

  const plan: AnalysisPlan = { ...rawPlan };

  // 1. Validate Metric
  if (plan.metric) {
    const metricRes = resolveColumn(plan.metric, profile.columns);
    if (metricRes.status === 'not_found') {
      // Column does NOT exist in dataset! Do NOT fabricate!
      return {
        valid: false,
        repairedPlan: {
          operation: 'clarification' as any,
          user_intent_summary: `Column '${plan.metric}' was not found in dataset.`,
        },
        error: {
          code: 'UNKNOWN_COLUMN',
          message: `The metric '${plan.metric}' was not found in dataset '${profile.filename}'.`,
          reason: `No column matches '${plan.metric}'.`,
          suggestion: `Available numeric metrics are: ${numCols.map(c => c.name).join(', ')}.`,
        },
      };
    } else if (metricRes.status === 'ambiguous') {
      const candidates = metricRes.candidates?.map(c => c.name) || [];
      return {
        valid: false,
        repairedPlan: {
          operation: 'clarification' as any,
          user_intent_summary: `Ambiguous metric '${plan.metric}'.`,
        },
        error: {
          code: 'AMBIGUOUS_METRIC',
          message: `Multiple columns match '${plan.metric}': ${candidates.join(', ')}.`,
          reason: 'Ambiguous column match.',
          suggestion: `Please specify one of: ${candidates.join(', ')}.`,
        },
      };
    } else if (metricRes.column) {
      // Repair to exact column name
      plan.metric = metricRes.column.name;

      // Check if metric is numeric for additive operations
      if (metricRes.column.type !== 'numeric' && (plan.aggregation === 'sum' || plan.aggregation === 'mean')) {
        if (q.includes('count') || q.includes('how many')) {
          plan.aggregation = 'count';
        } else {
          return {
            valid: false,
            repairedPlan: {
              operation: 'clarification' as any,
              user_intent_summary: `Column '${plan.metric}' is not numeric.`,
            },
            error: {
              code: 'NON_NUMERIC_METRIC',
              message: `Column '${plan.metric}' is categorical and cannot be summed or averaged.`,
              reason: 'Mathematical aggregation requires numeric column.',
              suggestion: `Select a numeric metric like ${numCols.map(c => c.name).join(', ')}, or count entries instead.`,
            },
          };
        }
      }
    }
  } else if (plan.operation !== 'clarification' && plan.operation !== 'filter') {
    // If no metric was specified by Gemini, attempt safe metric resolution
    const safeMetricRes = resolveMetricFromQuery(question, profile.columns);
    if (safeMetricRes.status === 'resolved' && safeMetricRes.column) {
      plan.metric = safeMetricRes.column.name;
    } else if (safeMetricRes.status === 'ambiguous' || safeMetricRes.status === 'unknown') {
      return {
        valid: false,
        repairedPlan: {
          operation: 'clarification' as any,
          user_intent_summary: safeMetricRes.clarificationMessage,
        },
        error: {
          code: safeMetricRes.status === 'ambiguous' ? 'AMBIGUOUS_METRIC' : 'UNKNOWN_METRIC',
          message: safeMetricRes.clarificationMessage || 'Please clarify which metric you would like to analyze.',
          suggestion: `Available numeric metrics: ${numCols.map(c => c.name).join(', ')}.`,
        },
      };
    }
  }

  // 2. Validate & Repair Group By
  if (plan.group_by && Array.isArray(plan.group_by)) {
    const repairedGroups: string[] = [];
    for (const g of plan.group_by) {
      const gRes = resolveColumn(g, profile.columns);
      if (gRes.column) {
        repairedGroups.push(gRes.column.name);
      } else {
        // If Gemini hallucinated a group column, do not keep it
        console.warn(`Unresolved group_by column '${g}' omitted from plan.`);
      }
    }
    plan.group_by = repairedGroups;
  }

  // 3. Semantic Aggregation Repair (e.g. Highest Average Order Value, Margin sum)
  if (plan.metric) {
    const aggResult = resolveAggregation(question, plan.metric, plan.aggregation);
    plan.aggregation = aggResult.aggregation;
    if (!plan.sort) {
      plan.sort = {
        column: plan.metric,
        direction: aggResult.sortDirection,
      };
    }
  }

  // 4. Validate Time Series Operation
  if (plan.operation === 'time_series') {
    const timeCol = plan.group_by?.[0]
      ? profile.columns.find(c => c.name === plan.group_by?.[0] && c.type === 'datetime')
      : dateCols[0];

    if (!timeCol) {
      // Dataset has no datetime columns!
      return {
        valid: false,
        repairedPlan: {
          operation: 'clarification' as any,
          user_intent_summary: 'Dataset does not contain a datetime column for time series trend analysis.',
        },
        error: {
          code: 'NO_DATETIME_COLUMN',
          message: `Cannot compute time series trend because dataset '${profile.filename}' contains no date or timestamp columns.`,
          suggestion: 'Try grouping by a categorical dimension like Region or Product instead.',
        },
      };
    }
    plan.group_by = [timeCol.name];
  }

  // 5. Validate Correlation Operation
  if (plan.operation === 'correlation') {
    if (numCols.length < 2) {
      return {
        valid: false,
        repairedPlan: {
          operation: 'clarification' as any,
          user_intent_summary: 'Correlation requires at least two numeric columns.',
        },
        error: {
          code: 'INSUFFICIENT_NUMERIC_COLUMNS',
          message: 'Correlation analysis requires at least two numeric columns in the dataset.',
          suggestion: 'Upload a dataset with multiple numeric variables.',
        },
      };
    }

    if (!plan.secondary_metric) {
      const other = numCols.find(c => c.name !== plan.metric);
      plan.secondary_metric = other?.name || numCols[1].name;
    } else {
      const secRes = resolveColumn(plan.secondary_metric, numCols);
      if (secRes.column) {
        plan.secondary_metric = secRes.column.name;
      }
    }
  }

  // Ensure default limit
  if (!plan.limit && (plan.operation === 'group_aggregate' || plan.operation === 'ranking')) {
    plan.limit = 10;
  }

  return {
    valid: true,
    repairedPlan: plan,
  };
}

// ----------------------------------------------------
// 5. FOLLOW-UP CONTEXT PRECEDENCE ENGINE
// ----------------------------------------------------

/**
 * Implements context precedence for multi-turn conversational queries:
 * 1. Explicit current user instruction (overrides previous context)
 * 2. Previous analytical context (inherited if not overridden)
 * 3. Dataset schema
 * 4. Deterministic defaults
 */
export function applyFollowUpContext(
  question: string,
  currentPlan: AnalysisPlan,
  previousPlan: AnalysisPlan,
  profile: DatasetProfile
): AnalysisPlan {
  const q = question.toLowerCase().trim();
  const numCols = profile.columns.filter(c => c.type === 'numeric');
  const catCols = profile.columns.filter(c => c.type === 'categorical' || c.type === 'text');
  const dateCols = profile.columns.filter(c => c.type === 'datetime');

  // Clone previous plan as base
  const merged: AnalysisPlan = JSON.parse(JSON.stringify(previousPlan));

  // Case 1: Explicit current limit / top N instruction
  // e.g. "Only the top 5", "top 3", "limit to 5"
  const topMatch = q.match(/\b(?:top|first|limit\s+to|only\s+the\s+top)\s+(\d+)\b/i);
  if (topMatch) {
    const num = parseInt(topMatch[1], 10);
    if (!isNaN(num) && num > 0) {
      merged.limit = num;
      merged.user_intent_summary = `Refined previous analysis limited to top ${num} records.`;
      return merged;
    }
  }

  // Case 2: Explicit new metric requested
  // e.g. "Now do profit", "Now show profit", "Switch to profit", "What about profit?"
  let explicitNewMetric: ColumnProfile | undefined;
  for (const c of numCols) {
    const colRegex = new RegExp(`\\b${escapeRegex(c.name.toLowerCase())}\\b`, 'i');
    if (colRegex.test(q)) {
      explicitNewMetric = c;
      break;
    }
  }

  // Also check synonyms for metric if no direct match
  if (!explicitNewMetric) {
    for (const group of SYNONYM_DICTIONARY.filter(g => g.type === 'numeric')) {
      for (const syn of group.synonyms) {
        const synRegex = new RegExp(`\\b${escapeRegex(syn.toLowerCase())}\\b`, 'i');
        if (synRegex.test(q)) {
          const match = numCols.find(c => c.name.toLowerCase() === group.canonicalKey || c.name.toLowerCase().includes(syn));
          if (match) {
            explicitNewMetric = match;
            break;
          }
        }
      }
      if (explicitNewMetric) break;
    }
  }

  if (explicitNewMetric) {
    // Current user explicitly instructed a new metric!
    // Precedence rule 1: Explicit instruction overrides previous metric!
    // Inherits previous group_by, filters, and limit!
    merged.metric = explicitNewMetric.name;
    const aggResult = resolveAggregation(question, explicitNewMetric);
    merged.aggregation = aggResult.aggregation;
    if (merged.sort) {
      merged.sort.column = explicitNewMetric.name;
    }
    if (merged.visualization) {
      merged.visualization.y = explicitNewMetric.name;
      merged.visualization.title = `${merged.aggregation.toUpperCase()} of ${explicitNewMetric.name} by ${merged.group_by?.[0] || 'Category'}`;
    }
    merged.user_intent_summary = `Switched metric to '${explicitNewMetric.name}' while preserving breakdown dimension '${merged.group_by?.[0] || 'dimension'}'.`;
    return merged;
  }

  // Case 3: Explicit new breakdown dimension requested
  // e.g. "What about product?", "Break down by segment instead", "Now by category"
  let explicitNewDim: ColumnProfile | undefined;
  for (const c of [...catCols, ...dateCols]) {
    const colRegex = new RegExp(`\\b${escapeRegex(c.name.toLowerCase())}\\b`, 'i');
    if (colRegex.test(q)) {
      explicitNewDim = c;
      break;
    }
  }

  if (!explicitNewDim) {
    for (const group of SYNONYM_DICTIONARY.filter(g => g.type === 'categorical' || g.type === 'datetime')) {
      for (const syn of group.synonyms) {
        const synRegex = new RegExp(`\\b${escapeRegex(syn.toLowerCase())}\\b`, 'i');
        if (synRegex.test(q)) {
          const match = [...catCols, ...dateCols].find(c => c.name.toLowerCase().includes(syn) || c.name.toLowerCase() === group.canonicalKey);
          if (match) {
            explicitNewDim = match;
            break;
          }
        }
      }
      if (explicitNewDim) break;
    }
  }

  if (explicitNewDim) {
    // Current user explicitly instructed a new grouping dimension!
    // Precedence rule 1: Explicit dimension overrides previous group_by!
    // Inherits previous metric, aggregation, and limit!
    merged.group_by = [explicitNewDim.name];
    if (merged.visualization) {
      merged.visualization.x = explicitNewDim.name;
      merged.visualization.title = `${merged.aggregation?.toUpperCase() || 'SUM'} of ${merged.metric || 'Metric'} by ${explicitNewDim.name}`;
    }
    merged.user_intent_summary = `Switched grouping dimension to '${explicitNewDim.name}' while retaining metric '${merged.metric || 'Metric'}'.`;
    return merged;
  }

  // Case 4: Explicit new filter requested
  // e.g. "Filter to North America", "Only for Technology"
  for (const catCol of catCols) {
    if (catCol.topCategories) {
      for (const topCat of catCol.topCategories) {
        const valLower = topCat.category.toLowerCase();
        if (q.includes(valLower)) {
          if (!merged.filters) merged.filters = [];
          merged.filters.push({
            column: catCol.name,
            operator: '==',
            value: topCat.category,
          });
          merged.user_intent_summary = `Refined previous analysis filtered to ${catCol.name} = '${topCat.category}'.`;
          return merged;
        }
      }
    }
  }

  // Case 5: Temporal trend follow-up (e.g. "now monthly", "trend over time")
  if (
    (q.includes('trend') || q.includes('over time') || q.includes('monthly') || q.includes('quarterly') || q.includes('yearly') || q.includes('daily') || q.includes('time series')) &&
    dateCols.length > 0
  ) {
    const gran = q.includes('daily') ? 'daily' : q.includes('weekly') ? 'weekly' : q.includes('quarterly') ? 'quarterly' : q.includes('yearly') ? 'yearly' : 'monthly';
    merged.operation = 'time_series';
    merged.group_by = [dateCols[0].name];
    merged.time_granularity = gran as any;
    if (merged.visualization) {
      merged.visualization.type = 'line';
      merged.visualization.x = dateCols[0].name;
      merged.visualization.y = merged.metric;
      merged.visualization.title = `${merged.metric || 'Metric'} Trend Over Time (${gran})`;
    }
    merged.user_intent_summary = `Refined previous analysis to temporal trend rolled up by ${dateCols[0].name} (${gran}).`;
    return merged;
  }

  return currentPlan;
}
