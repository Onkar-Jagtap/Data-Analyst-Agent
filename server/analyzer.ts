import {
  AnalysisPlan,
  ColumnProfile,
  CorrelationMatrixResult,
  DataHandlingReport,
  DatasetProfile,
  FilterCondition,
  OutlierDrilldownItem,
  OutlierDrilldownResult,
} from './types.js';
import { isNullOrEmpty, parseCleanNumber, parseDateSafe } from './profiler.js';

export interface ExecutionOutput {
  success: boolean;
  operation: string;
  data: any;
  summaryMetrics: { label: string; value: string; context?: string }[];
  methodDescription: string;
  dataHandling: DataHandlingReport;
  warnings: string[];
  suggestedChart?: {
    type: 'bar' | 'line' | 'scatter' | 'histogram' | 'box' | 'heatmap' | 'pie';
    x?: string;
    y?: string;
    title?: string;
  };
  error?: {
    code: string;
    message: string;
    reason?: string;
    suggestion?: string;
  };
}

// Helper to filter rows
function applyFilters(rows: Record<string, any>[], filters?: FilterCondition[]): { filteredRows: Record<string, any>[]; filteredOutCount: number } {
  if (!filters || filters.length === 0) {
    return { filteredRows: rows, filteredOutCount: 0 };
  }

  const initialCount = rows.length;
  const filtered = rows.filter(row => {
    for (const f of filters) {
      const val = row[f.column];
      if (val === undefined) continue;

      const numParsed = parseCleanNumber(val);
      const targetNum = parseCleanNumber(f.value);

      switch (f.operator) {
        case '==':
          if (numParsed.isNum && targetNum.isNum) {
            if (numParsed.value !== targetNum.value) return false;
          } else {
            if (String(val).toLowerCase() !== String(f.value).toLowerCase()) return false;
          }
          break;
        case '!=':
          if (numParsed.isNum && targetNum.isNum) {
            if (numParsed.value === targetNum.value) return false;
          } else {
            if (String(val).toLowerCase() === String(f.value).toLowerCase()) return false;
          }
          break;
        case '>':
          if (!numParsed.isNum || !targetNum.isNum || numParsed.value <= targetNum.value) return false;
          break;
        case '<':
          if (!numParsed.isNum || !targetNum.isNum || numParsed.value >= targetNum.value) return false;
          break;
        case '>=':
          if (!numParsed.isNum || !targetNum.isNum || numParsed.value < targetNum.value) return false;
          break;
        case '<=':
          if (!numParsed.isNum || !targetNum.isNum || numParsed.value > targetNum.value) return false;
          break;
        case 'contains':
          if (!String(val).toLowerCase().includes(String(f.value).toLowerCase())) return false;
          break;
        case 'date_range': {
          const rowDate = parseDateSafe(val);
          const startDate = parseDateSafe(f.value);
          const endDate = f.valueEnd ? parseDateSafe(f.valueEnd) : null;
          if (!rowDate || !startDate) return false;
          if (rowDate < startDate) return false;
          if (endDate && rowDate > endDate) return false;
          break;
        }
        case 'in':
          if (Array.isArray(f.value)) {
            const strVal = String(val).toLowerCase();
            const match = f.value.some((item: any) => String(item).toLowerCase() === strVal);
            if (!match) return false;
          }
          break;
      }
    }
    return true;
  });

  return {
    filteredRows: filtered,
    filteredOutCount: initialCount - filtered.length,
  };
}

// Compute single aggregate
function computeAggregateValue(numbers: number[], aggregation: string): number {
  if (numbers.length === 0) return 0;
  const n = numbers.length;
  switch (aggregation.toLowerCase()) {
    case 'sum':
      return numbers.reduce((acc, v) => acc + v, 0);
    case 'mean':
    case 'average':
    case 'avg':
      return numbers.reduce((acc, v) => acc + v, 0) / n;
    case 'median': {
      const sorted = [...numbers].sort((a, b) => a - b);
      const mid = Math.floor(n / 2);
      return n % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
    }
    case 'min':
      return Math.min(...numbers);
    case 'max':
      return Math.max(...numbers);
    case 'count':
      return n;
    case 'std': {
      const mean = numbers.reduce((acc, v) => acc + v, 0) / n;
      const variance = numbers.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / (n > 1 ? n - 1 : 1);
      return Math.sqrt(variance);
    }
    default:
      return numbers.reduce((acc, v) => acc + v, 0);
  }
}

// Format numbers nicely (currency, thousands, decimal)
export function formatMetricNumber(val: number, isCurrency = false, isPercent = false): string {
  if (isNaN(val) || !isFinite(val)) return 'N/A';
  if (isPercent) {
    return `${(val * 100).toFixed(1)}%`;
  }
  const prefix = isCurrency ? '$' : '';
  const abs = Math.abs(val);
  const sign = val < 0 ? '-' : '';

  if (abs >= 1_000_000_000) {
    return `${sign}${prefix}${(abs / 1_000_000_000).toFixed(2)}B`;
  }
  if (abs >= 1_000_000) {
    return `${sign}${prefix}${(abs / 1_000_000).toFixed(2)}M`;
  }
  if (abs >= 1_000) {
    return `${sign}${prefix}${Math.round(abs).toLocaleString()}`;
  }
  return `${sign}${prefix}${val % 1 === 0 ? val.toString() : val.toFixed(2)}`;
}

export function executeAnalysisPlan(
  rawRows: Record<string, any>[],
  profile: DatasetProfile,
  plan: AnalysisPlan
): ExecutionOutput {
  const totalRows = rawRows.length;
  const warnings: string[] = [];
  const rulesApplied: string[] = ['Preserved original dataset records'];

  // Check empty dataset
  if (totalRows === 0) {
    return {
      success: false,
      operation: plan.operation,
      data: null,
      summaryMetrics: [],
      methodDescription: 'No rows available in dataset.',
      dataHandling: {
        totalRows: 0,
        validRowsAnalyzed: 0,
        excludedRows: 0,
        missingValuesExcluded: 0,
        invalidValuesExcluded: 0,
        filteredOutRows: 0,
        methodDescription: 'Empty dataset',
        rulesApplied,
        warnings: ['Dataset contains 0 rows.'],
        confidenceScore: 0,
        isDeterministic: true,
      },
      warnings: ['Dataset contains 0 rows.'],
      error: {
        code: 'EMPTY_DATASET',
        message: 'The dataset has no rows to analyze.',
      },
    };
  }

  // 1. Apply user filters first
  const { filteredRows, filteredOutCount } = applyFilters(rawRows, plan.filters);
  if (filteredOutCount > 0) {
    rulesApplied.push(`Applied filters: excluded ${filteredOutCount} records`);
  }

  if (filteredRows.length === 0) {
    return {
      success: false,
      operation: plan.operation,
      data: null,
      summaryMetrics: [],
      methodDescription: 'Filter returned zero matching records.',
      dataHandling: {
        totalRows,
        validRowsAnalyzed: 0,
        excludedRows: totalRows,
        missingValuesExcluded: 0,
        invalidValuesExcluded: 0,
        filteredOutRows: filteredOutCount,
        methodDescription: 'Filters excluded all records.',
        rulesApplied,
        warnings: ['No records matched the filter criteria.'],
        confidenceScore: 0,
        isDeterministic: true,
      },
      warnings: ['No records match the filter criteria.'],
      error: {
        code: 'EMPTY_FILTERED_RESULT',
        message: 'No records matched the specified filter condition.',
        reason: 'The criteria provided resulted in an empty subset.',
        suggestion: 'Try widening the filter range or checking for exact spelling.',
      },
    };
  }

  // Match columns safely
  const findColumn = (colName?: string): string | null => {
    if (!colName) return null;
    const exact = profile.columns.find(c => c.name.toLowerCase() === colName.toLowerCase());
    if (exact) return exact.name;
    const partial = profile.columns.find(c => c.name.toLowerCase().includes(colName.toLowerCase()) || colName.toLowerCase().includes(c.name.toLowerCase()));
    return partial ? partial.name : null;
  };

  const metricCol = findColumn(plan.metric);
  const isCurrency = metricCol ? ['revenue', 'sales', 'profit', 'cost', 'price', 'amount'].some(w => metricCol.toLowerCase().includes(w)) : false;

  // ----------------------------------------------------
  // OPERATION: GROUP AGGREGATE
  // ----------------------------------------------------
  if (plan.operation === 'group_aggregate') {
    const rawGroupCols = plan.group_by || [];
    const groupCol = findColumn(rawGroupCols[0]) || profile.columns.find(c => c.type === 'categorical')?.name || profile.columns[0].name;
    const targetMetric = metricCol || profile.columns.find(c => c.type === 'numeric')?.name;
    const agg = plan.aggregation || 'sum';

    if (!targetMetric) {
      return {
        success: false,
        operation: 'group_aggregate',
        data: null,
        summaryMetrics: [],
        methodDescription: 'No numeric metric found for aggregation.',
        dataHandling: {
          totalRows,
          validRowsAnalyzed: 0,
          excludedRows: totalRows,
          missingValuesExcluded: 0,
          invalidValuesExcluded: 0,
          filteredOutRows: filteredOutCount,
          methodDescription: 'Missing numeric metric',
          rulesApplied,
          warnings: ['No numeric metric column available in dataset.'],
          confidenceScore: 0,
          isDeterministic: true,
        },
        warnings: ['Cannot group aggregate without a numeric metric.'],
        error: {
          code: 'NO_NUMERIC_COLUMN',
          message: `Could not find a numeric metric to aggregate.`,
          reason: `Requested metric '${plan.metric || 'unknown'}' is not numeric.`,
          suggestion: `Select one of the numeric columns: ${profile.columns.filter(c => c.type === 'numeric').map(c => c.name).join(', ')}.`,
        },
      };
    }

    let missingCount = 0;
    let invalidCount = 0;
    const groupBuckets = new Map<string, number[]>();

    for (const row of filteredRows) {
      const gVal = row[groupCol];
      const mVal = row[targetMetric];

      if (isNullOrEmpty(gVal) || isNullOrEmpty(mVal)) {
        missingCount++;
        continue;
      }

      const parsed = parseCleanNumber(mVal);
      if (!parsed.isNum) {
        invalidCount++;
        continue;
      }

      const groupKey = String(gVal).trim();
      if (!groupBuckets.has(groupKey)) {
        groupBuckets.set(groupKey, []);
      }
      groupBuckets.get(groupKey)!.push(parsed.value);
    }

    const validRowsAnalyzed = filteredRows.length - missingCount - invalidCount;
    if (validRowsAnalyzed === 0) {
      return {
        success: false,
        operation: 'group_aggregate',
        data: null,
        summaryMetrics: [],
        methodDescription: `Zero valid numeric records found in '${targetMetric}'.`,
        dataHandling: {
          totalRows,
          validRowsAnalyzed: 0,
          excludedRows: totalRows,
          missingValuesExcluded: missingCount,
          invalidValuesExcluded: invalidCount,
          filteredOutRows: filteredOutCount,
          methodDescription: 'Zero valid records',
          rulesApplied,
          warnings: ['Zero valid numeric values found for analysis.'],
          confidenceScore: 0,
          isDeterministic: true,
        },
        warnings: ['Zero valid numeric records found.'],
        error: {
          code: 'ZERO_VALID_VALUES',
          message: `The '${targetMetric}' column contains no valid numeric values to calculate ${agg}.`,
        },
      };
    }

    // Compute aggregation per group
    const results: { category: string; value: number; count: number }[] = [];
    let totalAggSum = 0;

    for (const [category, values] of groupBuckets.entries()) {
      const computed = computeAggregateValue(values, agg);
      results.push({ category, value: Math.round(computed * 100) / 100, count: values.length });
      if (agg === 'sum' || agg === 'count') {
        totalAggSum += computed;
      }
    }

    // Sorting
    const sortDir = plan.sort?.direction || 'desc';
    results.sort((a, b) => (sortDir === 'asc' ? a.value - b.value : b.value - a.value));

    // Limit
    const limit = plan.limit || 15;
    const sliced = results.slice(0, limit);

    // Summary metrics
    const topItem = sliced[0];
    const summaryMetrics: { label: string; value: string; context?: string }[] = [];
    if (topItem) {
      summaryMetrics.push({
        label: `Top ${groupCol}`,
        value: topItem.category,
        context: `${agg.toUpperCase()}: ${formatMetricNumber(topItem.value, isCurrency)}`,
      });
      if (totalAggSum > 0 && agg === 'sum') {
        const pctShare = Math.round((topItem.value / totalAggSum) * 1000) / 10;
        summaryMetrics.push({
          label: 'Top Share of Total',
          value: `${pctShare}%`,
          context: `of ${formatMetricNumber(totalAggSum, isCurrency)} total`,
        });
      }
    }
    summaryMetrics.push({
      label: 'Groups Analyzed',
      value: groupBuckets.size.toString(),
      context: `${validRowsAnalyzed.toLocaleString()} records`,
    });

    const methodDescription = `${agg.toUpperCase()} of '${targetMetric}' grouped by '${groupCol}', sorted ${sortDir}ending.`;
    rulesApplied.push(`Cleaned formatted currency/text in '${targetMetric}'`);
    if (missingCount > 0) rulesApplied.push(`Excluded ${missingCount} records with missing values`);
    if (invalidCount > 0) rulesApplied.push(`Excluded ${invalidCount} non-numeric values`);

    return {
      success: true,
      operation: 'group_aggregate',
      data: {
        groupColumn: groupCol,
        metricColumn: targetMetric,
        aggregation: agg,
        items: sliced,
        totalGroups: groupBuckets.size,
        totalMetricSum: totalAggSum,
      },
      summaryMetrics,
      methodDescription,
      dataHandling: {
        totalRows,
        validRowsAnalyzed,
        excludedRows: totalRows - validRowsAnalyzed,
        missingValuesExcluded: missingCount,
        invalidValuesExcluded: invalidCount,
        filteredOutRows: filteredOutCount,
        methodDescription,
        rulesApplied,
        warnings,
        confidenceScore: 100,
        isDeterministic: true,
      },
      warnings,
      suggestedChart: {
        type: sliced.length <= 6 ? 'pie' : 'bar',
        x: groupCol,
        y: targetMetric,
        title: `${agg.toUpperCase()} of ${targetMetric} by ${groupCol}`,
      },
    };
  }

  // ----------------------------------------------------
  // OPERATION: TIME SERIES
  // ----------------------------------------------------
  if (plan.operation === 'time_series') {
    const dateCol = findColumn(plan.group_by?.[0]) || profile.columns.find(c => c.type === 'datetime')?.name;
    const targetMetric = metricCol || profile.columns.find(c => c.type === 'numeric')?.name;
    const agg = plan.aggregation || 'sum';

    if (!dateCol || !targetMetric) {
      return {
        success: false,
        operation: 'time_series',
        data: null,
        summaryMetrics: [],
        methodDescription: 'Missing date or numeric column for time-series analysis.',
        dataHandling: {
          totalRows,
          validRowsAnalyzed: 0,
          excludedRows: totalRows,
          missingValuesExcluded: 0,
          invalidValuesExcluded: 0,
          filteredOutRows: filteredOutCount,
          methodDescription: 'Missing date or metric',
          rulesApplied,
          warnings: ['Time-series requires a datetime column and a numeric metric.'],
          confidenceScore: 0,
          isDeterministic: true,
        },
        warnings: ['Time-series requires a datetime column and a numeric metric.'],
        error: {
          code: 'MISSING_DATE_COLUMN',
          message: 'Could not find a valid date column or numeric metric for time-series.',
        },
      };
    }

    let missingCount = 0;
    let invalidCount = 0;
    const timeBuckets = new Map<string, number[]>();

    for (const row of filteredRows) {
      const dVal = row[dateCol];
      const mVal = row[targetMetric];

      if (isNullOrEmpty(dVal) || isNullOrEmpty(mVal)) {
        missingCount++;
        continue;
      }

      const d = parseDateSafe(dVal);
      const parsedNum = parseCleanNumber(mVal);

      if (!d || !parsedNum.isNum) {
        invalidCount++;
        continue;
      }

      // Group key: default monthly YYYY-MM
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      let bucketKey = `${y}-${m}`;

      if (plan.time_granularity === 'yearly') {
        bucketKey = `${y}`;
      } else if (plan.time_granularity === 'daily') {
        bucketKey = `${y}-${m}-${String(d.getDate()).padStart(2, '0')}`;
      } else if (plan.time_granularity === 'quarterly') {
        const q = Math.floor(d.getMonth() / 3) + 1;
        bucketKey = `${y}-Q${q}`;
      }

      if (!timeBuckets.has(bucketKey)) {
        timeBuckets.set(bucketKey, []);
      }
      timeBuckets.get(bucketKey)!.push(parsedNum.value);
    }

    const validRowsAnalyzed = filteredRows.length - missingCount - invalidCount;
    const sortedBuckets = Array.from(timeBuckets.entries())
      .map(([period, values]) => ({
        period,
        value: Math.round(computeAggregateValue(values, agg) * 100) / 100,
        count: values.length,
      }))
      .sort((a, b) => a.period.localeCompare(b.period));

    // Calculate growth rate from first to last period
    let growthRate = 0;
    if (sortedBuckets.length >= 2 && sortedBuckets[0].value !== 0) {
      growthRate = Math.round(((sortedBuckets[sortedBuckets.length - 1].value - sortedBuckets[0].value) / Math.abs(sortedBuckets[0].value)) * 1000) / 10;
    }

    const summaryMetrics: { label: string; value: string; context?: string }[] = [
      {
        label: 'Periods Tracked',
        value: sortedBuckets.length.toString(),
        context: `${sortedBuckets[0]?.period || ''} to ${sortedBuckets[sortedBuckets.length - 1]?.period || ''}`,
      },
    ];

    if (sortedBuckets.length >= 2) {
      summaryMetrics.push({
        label: 'Overall Period Change',
        value: `${growthRate > 0 ? '+' : ''}${growthRate}%`,
        context: 'First to last recorded period',
      });
    }

    const methodDescription = `${agg.toUpperCase()} of '${targetMetric}' rolled up by '${dateCol}' (${plan.time_granularity || 'monthly'}), sorted chronologically.`;

    return {
      success: true,
      operation: 'time_series',
      data: {
        dateColumn: dateCol,
        metricColumn: targetMetric,
        periods: sortedBuckets,
        granularity: plan.time_granularity || 'monthly',
        growthRate,
      },
      summaryMetrics,
      methodDescription,
      dataHandling: {
        totalRows,
        validRowsAnalyzed,
        excludedRows: totalRows - validRowsAnalyzed,
        missingValuesExcluded: missingCount,
        invalidValuesExcluded: invalidCount,
        filteredOutRows: filteredOutCount,
        methodDescription,
        rulesApplied,
        warnings,
        confidenceScore: 100,
        isDeterministic: true,
      },
      warnings,
      suggestedChart: {
        type: 'line',
        x: dateCol,
        y: targetMetric,
        title: `${targetMetric} Trend Over Time (${plan.time_granularity || 'Monthly'})`,
      },
    };
  }

  // ----------------------------------------------------
  // OPERATION: CORRELATION
  // ----------------------------------------------------
  if (plan.operation === 'correlation') {
    const numCols = profile.columns.filter(c => c.type === 'numeric');
    const col1Name = findColumn(plan.metric) || numCols[0]?.name;
    const col2Name = findColumn(plan.secondary_metric) || numCols.find(c => c.name !== col1Name)?.name || numCols[1]?.name;

    if (!col1Name || !col2Name) {
      return {
        success: false,
        operation: 'correlation',
        data: null,
        summaryMetrics: [],
        methodDescription: 'Correlation requires at least two numeric columns.',
        dataHandling: {
          totalRows,
          validRowsAnalyzed: 0,
          excludedRows: totalRows,
          missingValuesExcluded: 0,
          invalidValuesExcluded: 0,
          filteredOutRows: filteredOutCount,
          methodDescription: 'Insufficient numeric columns',
          rulesApplied,
          warnings: ['Need 2 numeric columns for Pearson correlation.'],
          confidenceScore: 0,
          isDeterministic: true,
        },
        warnings: ['Need 2 numeric columns for Pearson correlation.'],
        error: {
          code: 'INSUFFICIENT_COLUMNS',
          message: 'Correlation analysis requires at least two numeric columns.',
        },
      };
    }

    let missingCount = 0;
    let invalidCount = 0;
    const pairs: [number, number][] = [];

    for (const row of filteredRows) {
      const v1 = row[col1Name];
      const v2 = row[col2Name];

      if (isNullOrEmpty(v1) || isNullOrEmpty(v2)) {
        missingCount++;
        continue;
      }

      const p1 = parseCleanNumber(v1);
      const p2 = parseCleanNumber(v2);

      if (!p1.isNum || !p2.isNum) {
        invalidCount++;
        continue;
      }

      pairs.push([p1.value, p2.value]);
    }

    const n = pairs.length;
    if (n < 3) {
      return {
        success: false,
        operation: 'correlation',
        data: null,
        summaryMetrics: [],
        methodDescription: 'Insufficient paired data points for correlation.',
        dataHandling: {
          totalRows,
          validRowsAnalyzed: n,
          excludedRows: totalRows - n,
          missingValuesExcluded: missingCount,
          invalidValuesExcluded: invalidCount,
          filteredOutRows: filteredOutCount,
          methodDescription: 'Need at least 3 paired values',
          rulesApplied,
          warnings: ['Insufficient data points.'],
          confidenceScore: 0,
          isDeterministic: true,
        },
        warnings: ['Fewer than 3 valid paired records found.'],
        error: {
          code: 'INSUFFICIENT_DATA',
          message: 'At least 3 valid paired rows are needed to compute correlation.',
        },
      };
    }

    // Pearson r
    const mean1 = pairs.reduce((acc, p) => acc + p[0], 0) / n;
    const mean2 = pairs.reduce((acc, p) => acc + p[1], 0) / n;

    let numerator = 0;
    let denom1 = 0;
    let denom2 = 0;

    for (const [x, y] of pairs) {
      const dx = x - mean1;
      const dy = y - mean2;
      numerator += dx * dy;
      denom1 += dx * dx;
      denom2 += dy * dy;
    }

    const r = denom1 > 0 && denom2 > 0 ? numerator / Math.sqrt(denom1 * denom2) : 0;
    const rRounded = Math.round(r * 1000) / 1000;

    let strength = 'negligible';
    const absR = Math.abs(r);
    if (absR >= 0.8) strength = 'very strong';
    else if (absR >= 0.6) strength = 'strong';
    else if (absR >= 0.4) strength = 'moderate';
    else if (absR >= 0.2) strength = 'weak';

    const direction = r > 0 ? 'positive' : r < 0 ? 'negative' : 'neutral';
    const methodDescription = `Pearson correlation coefficient computed on ${n.toLocaleString()} pairwise complete observations.`;
    rulesApplied.push('Pairwise complete observation filter applied (rows with missing values in either column were excluded)');
    rulesApplied.push('Note: Correlation measures linear association and does not establish causation.');

    return {
      success: true,
      operation: 'correlation',
      data: {
        column1: col1Name,
        column2: col2Name,
        pearsonR: rRounded,
        strength,
        direction,
        pairsSample: pairs.slice(0, 150),
      },
      summaryMetrics: [
        {
          label: 'Pearson r',
          value: rRounded.toString(),
          context: `${strength.toUpperCase()} ${direction.toUpperCase()}`,
        },
        {
          label: 'R-Squared (Variance Explained)',
          value: `${Math.round(r * r * 1000) / 10}%`,
          context: 'Variance shared between variables',
        },
        {
          label: 'Sample Size',
          value: n.toLocaleString(),
          context: 'Pairs analyzed',
        },
      ],
      methodDescription,
      dataHandling: {
        totalRows,
        validRowsAnalyzed: n,
        excludedRows: totalRows - n,
        missingValuesExcluded: missingCount,
        invalidValuesExcluded: invalidCount,
        filteredOutRows: filteredOutCount,
        methodDescription,
        rulesApplied,
        warnings,
        confidenceScore: 100,
        isDeterministic: true,
      },
      warnings,
      suggestedChart: {
        type: 'scatter',
        x: col1Name,
        y: col2Name,
        title: `${col1Name} vs ${col2Name} (r = ${rRounded})`,
      },
    };
  }

  // ----------------------------------------------------
  // OPERATION: AGGREGATE / SINGLE METRIC STATS
  // ----------------------------------------------------
  const targetMetric = metricCol || profile.columns.find(c => c.type === 'numeric')?.name || profile.columns[0].name;
  const agg = plan.aggregation || 'mean';

  let missingCount = 0;
  let invalidCount = 0;
  const numbers: number[] = [];

  for (const row of filteredRows) {
    const val = row[targetMetric];
    if (isNullOrEmpty(val)) {
      missingCount++;
      continue;
    }
    const parsed = parseCleanNumber(val);
    if (!parsed.isNum) {
      invalidCount++;
      continue;
    }
    numbers.push(parsed.value);
  }

  const validRowsAnalyzed = numbers.length;
  if (validRowsAnalyzed === 0) {
    return {
      success: false,
      operation: 'aggregate',
      data: null,
      summaryMetrics: [],
      methodDescription: `Zero valid numeric values found in column '${targetMetric}'.`,
      dataHandling: {
        totalRows,
        validRowsAnalyzed: 0,
        excludedRows: totalRows,
        missingValuesExcluded: missingCount,
        invalidValuesExcluded: invalidCount,
        filteredOutRows: filteredOutCount,
        methodDescription: 'No numeric records',
        rulesApplied,
        warnings: ['Zero valid numeric values found.'],
        confidenceScore: 0,
        isDeterministic: true,
      },
      warnings: ['Zero valid numeric values found.'],
      error: {
        code: 'ZERO_VALID_VALUES',
        message: `Column '${targetMetric}' has no valid numeric entries to calculate ${agg}.`,
      },
    };
  }

  const resultValue = computeAggregateValue(numbers, agg);
  const formattedVal = formatMetricNumber(resultValue, isCurrency);
  const methodDescription = `${agg.toUpperCase()} calculated from ${validRowsAnalyzed.toLocaleString()} valid numeric values of '${targetMetric}'.`;

  const summaryMetrics: { label: string; value: string; context?: string }[] = [
    {
      label: `${agg.toUpperCase()} ${targetMetric}`,
      value: formattedVal,
      context: `${validRowsAnalyzed.toLocaleString()} records`,
    },
    {
      label: 'Minimum',
      value: formatMetricNumber(Math.min(...numbers), isCurrency),
    },
    {
      label: 'Maximum',
      value: formatMetricNumber(Math.max(...numbers), isCurrency),
    },
  ];

  return {
    success: true,
    operation: 'aggregate',
    data: {
      metric: targetMetric,
      aggregation: agg,
      resultValue: Math.round(resultValue * 100) / 100,
      min: Math.min(...numbers),
      max: Math.max(...numbers),
      count: validRowsAnalyzed,
    },
    summaryMetrics,
    methodDescription,
    dataHandling: {
      totalRows,
      validRowsAnalyzed,
      excludedRows: totalRows - validRowsAnalyzed,
      missingValuesExcluded: missingCount,
      invalidValuesExcluded: invalidCount,
      filteredOutRows: filteredOutCount,
      methodDescription,
      rulesApplied,
      warnings,
      confidenceScore: 100,
      isDeterministic: true,
    },
    warnings,
    suggestedChart: {
      type: 'histogram',
      x: targetMetric,
      title: `Distribution of ${targetMetric}`,
    },
  };
}

// Full Pearson Correlation Matrix Calculation
export function calculateCorrelationMatrix(
  rows: Record<string, any>[],
  profile: DatasetProfile
): CorrelationMatrixResult {
  const numericCols = profile.columns
    .filter(c => c.type === 'numeric' && c.nullPercentage < 90)
    .map(c => c.name)
    .slice(0, 12);

  if (numericCols.length < 2) {
    return { columns: numericCols, matrix: [] };
  }

  const colData: Record<string, number[]> = {};
  for (const col of numericCols) {
    colData[col] = [];
  }

  for (const row of rows) {
    for (const col of numericCols) {
      const parsed = parseCleanNumber(row[col]);
      colData[col].push(parsed.isNum ? parsed.value : NaN);
    }
  }

  const matrix: number[][] = [];
  for (let i = 0; i < numericCols.length; i++) {
    const rowCorr: number[] = [];
    const colA = numericCols[i];
    const valsA = colData[colA];

    for (let j = 0; j < numericCols.length; j++) {
      if (i === j) {
        rowCorr.push(1.0);
        continue;
      }
      const colB = numericCols[j];
      const valsB = colData[colB];

      const validPairs: [number, number][] = [];
      for (let k = 0; k < valsA.length; k++) {
        if (!isNaN(valsA[k]) && !isNaN(valsB[k])) {
          validPairs.push([valsA[k], valsB[k]]);
        }
      }

      if (validPairs.length < 3) {
        rowCorr.push(0);
        continue;
      }

      const meanA = validPairs.reduce((s, p) => s + p[0], 0) / validPairs.length;
      const meanB = validPairs.reduce((s, p) => s + p[1], 0) / validPairs.length;

      let num = 0;
      let denomA = 0;
      let denomB = 0;

      for (const [a, b] of validPairs) {
        const diffA = a - meanA;
        const diffB = b - meanB;
        num += diffA * diffB;
        denomA += diffA * diffA;
        denomB += diffB * diffB;
      }

      const denom = Math.sqrt(denomA * denomB);
      if (denom === 0 || isNaN(denom)) {
        rowCorr.push(0);
      } else {
        const r = Math.max(-1, Math.min(1, num / denom));
        rowCorr.push(Math.round(r * 100) / 100);
      }
    }
    matrix.push(rowCorr);
  }

  return { columns: numericCols, matrix };
}

// Outlier Root-Cause Drill-Down
export function getOutlierDrilldown(
  rows: Record<string, any>[],
  profile: DatasetProfile,
  columnName?: string
): OutlierDrilldownResult | null {
  const targetCol = columnName || profile.columns.find(c => c.type === 'numeric' && (c.outlierCountIqr || 0) > 0)?.name;
  if (!targetCol) return null;

  const colProfile = profile.columns.find(c => c.name === targetCol);
  if (!colProfile || colProfile.type !== 'numeric' || colProfile.q1 === undefined || colProfile.q3 === undefined) {
    return null;
  }

  const q1 = colProfile.q1;
  const q3 = colProfile.q3;
  const iqr = colProfile.iqr || (q3 - q1);
  const lowerBound = q1 - 1.5 * iqr;
  const upperBound = q3 + 1.5 * iqr;
  const mean = colProfile.mean || 0;
  const std = colProfile.std || 1;

  const outliers: OutlierDrilldownItem[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const parsed = parseCleanNumber(row[targetCol]);
    if (parsed.isNum) {
      const val = parsed.value;
      if (val < lowerBound || val > upperBound) {
        const zScore = std > 0 ? (val - mean) / std : 0;
        const distanceFromBound = val < lowerBound ? lowerBound - val : val - upperBound;

        const rowContext: Record<string, any> = {};
        for (const [k, v] of Object.entries(row)) {
          if (Object.keys(rowContext).length < 6) {
            rowContext[k] = v;
          }
        }

        outliers.push({
          rowIndex: i + 1,
          value: val,
          zScore: Math.round(zScore * 100) / 100,
          distanceFromBound: Math.round(distanceFromBound * 100) / 100,
          rowContext,
        });
      }
    }
  }

  outliers.sort((a, b) => Math.abs(b.zScore) - Math.abs(a.zScore));

  return {
    column: targetCol,
    bounds: {
      q1: Math.round(q1 * 100) / 100,
      q3: Math.round(q3 * 100) / 100,
      iqr: Math.round(iqr * 100) / 100,
      lowerBound: Math.round(lowerBound * 100) / 100,
      upperBound: Math.round(upperBound * 100) / 100,
      mean: Math.round(mean * 100) / 100,
      std: Math.round(std * 100) / 100,
    },
    outliers: outliers.slice(0, 50),
  };
}
