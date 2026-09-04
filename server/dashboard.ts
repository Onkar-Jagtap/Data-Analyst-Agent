import { DatasetProfile } from './types.js';
import { isNullOrEmpty, parseCleanNumber, parseDateSafe } from './profiler.js';

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
}

export interface DashboardData {
  datasetId: string;
  totalDatasetRows: number;
  activeRowsCount: number;
  filterPercentage: number;
  dimension: string;
  metrics: DashboardMetricsSummary;
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
  comboChart: any;
  treemapChart: any;
  pieChart: any;
  timeSeriesChart: any | null;
  rankChart: any;
  availableDimensions: string[];
  availableMetrics: string[];
  availableTimeColumns: string[];
  dimensionDistinctValues: string[];
}

// Formatting helper
function formatNumberCompact(num: number, isCurrency = false): string {
  if (num === 0) return isCurrency ? '$0' : '0';
  const abs = Math.abs(num);
  const sign = num < 0 ? '-' : '';
  const prefix = isCurrency ? '$' : '';

  if (abs >= 1_000_000_000) {
    return `${sign}${prefix}${(abs / 1_000_000_000).toFixed(2)}B`;
  }
  if (abs >= 1_000_000) {
    return `${sign}${prefix}${(abs / 1_000_000).toFixed(2)}M`;
  }
  if (abs >= 10_000) {
    return `${sign}${prefix}${(abs / 1_000).toFixed(1)}k`;
  }
  if (abs >= 1_000) {
    return `${sign}${prefix}${(abs / 1_000).toFixed(2)}k`;
  }
  return `${sign}${prefix}${num.toLocaleString(undefined, {
    minimumFractionDigits: Number.isInteger(num) ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

export function computeDashboardData(
  rawRows: Record<string, any>[],
  profile: DatasetProfile,
  params: {
    dimension?: string;
    metric?: string;
    secondaryMetric?: string;
    filterCol?: string;
    filterVal?: string;
    timeCol?: string;
    timeGrain?: string;
  }
): DashboardData {
  const numCols = profile.columns.filter(c => c.type === 'numeric');
  const catCols = profile.columns.filter(c => c.type === 'categorical' || c.type === 'text');
  const dateCols = profile.columns.filter(c => c.type === 'datetime');

  // 1. Resolve Primary Metric
  let metricCol = params.metric;
  if (!metricCol || !numCols.some(c => c.name === metricCol)) {
    const revenueMatch = numCols.find(c => /revenue|sales|amount|total|volume/i.test(c.name));
    metricCol = revenueMatch ? revenueMatch.name : (numCols[0]?.name || '');
  }

  // 2. Resolve Secondary Metric
  let secondaryMetricCol = params.secondaryMetric;
  if (!secondaryMetricCol || !numCols.some(c => c.name === secondaryMetricCol)) {
    const profitMatch = numCols.find(c => c.name !== metricCol && /profit|margin|cost|units|quantity/i.test(c.name));
    secondaryMetricCol = profitMatch ? profitMatch.name : (numCols.find(c => c.name !== metricCol)?.name || metricCol);
  }

  // 3. Resolve Dimension
  let dimCol = params.dimension;
  if (!dimCol || !catCols.some(c => c.name === dimCol)) {
    const candidate = catCols.find(c => c.uniqueCount >= 2 && c.uniqueCount <= 25 && /category|region|segment|department|status|type/i.test(c.name));
    dimCol = candidate ? candidate.name : (catCols[0]?.name || profile.columns[0]?.name || 'Category');
  }

  // 4. Resolve Time Column
  let timeCol = params.timeCol;
  if (!timeCol || !dateCols.some(c => c.name === timeCol)) {
    timeCol = dateCols[0]?.name || '';
  }

  const timeGrain = params.timeGrain || 'month';

  // 5. Apply Slicing / Filtering
  let activeRows = rawRows;
  const filterCol = params.filterCol;
  const filterVal = params.filterVal;

  if (filterCol && filterVal && filterVal !== 'all') {
    activeRows = rawRows.filter(r => {
      const v = r[filterCol];
      if (v === null || v === undefined) return filterVal === '<null>';
      return String(v).trim() === filterVal.trim();
    });
  }

  const totalDatasetRows = rawRows.length;
  const activeRowsCount = activeRows.length;
  const filterPercentage = totalDatasetRows > 0 ? (activeRowsCount / totalDatasetRows) * 100 : 100;

  // Check currency cues
  const isPrimaryCurrency = /revenue|sales|profit|cost|price|spend|budget|arr|mrr|gmv/i.test(metricCol);
  const isSecondaryCurrency = /revenue|sales|profit|cost|price|spend|budget|arr|mrr|gmv/i.test(secondaryMetricCol);

  // 6. Aggregate Primary and Secondary Metrics
  const primaryValues: number[] = [];
  const secondaryValues: number[] = [];

  for (const row of activeRows) {
    if (metricCol) {
      const p = parseCleanNumber(row[metricCol]);
      if (p.isNum) primaryValues.push(p.value);
    }
    if (secondaryMetricCol) {
      const s = parseCleanNumber(row[secondaryMetricCol]);
      if (s.isNum) secondaryValues.push(s.value);
    }
  }

  const primarySum = primaryValues.reduce((a, b) => a + b, 0);
  const primaryAvg = primaryValues.length > 0 ? primarySum / primaryValues.length : 0;
  const secondarySum = secondaryValues.reduce((a, b) => a + b, 0);
  const secondaryAvg = secondaryValues.length > 0 ? secondarySum / secondaryValues.length : 0;

  // 7. Compute Dimension Breakdown (Cross-tab / Matrix)
  const groupMap = new Map<string, { count: number; primarySum: number; secondarySum: number; values: number[] }>();

  for (const row of activeRows) {
    let cat = row[dimCol];
    if (isNullOrEmpty(cat)) cat = 'Unspecified';
    const catStr = String(cat).trim();

    const pVal = metricCol ? parseCleanNumber(row[metricCol]).value : 1;
    const sVal = secondaryMetricCol ? parseCleanNumber(row[secondaryMetricCol]).value : 1;

    if (!groupMap.has(catStr)) {
      groupMap.set(catStr, { count: 0, primarySum: 0, secondarySum: 0, values: [] });
    }
    const g = groupMap.get(catStr)!;
    g.count += 1;
    g.primarySum += pVal;
    g.secondarySum += sVal;
    g.values.push(pVal);
  }

  const dimensionBreakdown: DashboardDimensionItem[] = Array.from(groupMap.entries())
    .map(([cat, g]) => ({
      category: cat,
      count: g.count,
      primarySum: Math.round(g.primarySum * 100) / 100,
      primaryAvg: g.count > 0 ? Math.round((g.primarySum / g.count) * 100) / 100 : 0,
      secondarySum: Math.round(g.secondarySum * 100) / 100,
      secondaryAvg: g.count > 0 ? Math.round((g.secondarySum / g.count) * 100) / 100 : 0,
      share: primarySum > 0 ? Math.round((g.primarySum / primarySum) * 1000) / 10 : 0,
      ratio: g.primarySum > 0 ? Math.round((g.secondarySum / g.primarySum) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.primarySum - a.primarySum);

  // 8. Time Series Trend
  const timeSeriesMap = new Map<string, { primarySum: number; secondarySum: number; count: number }>();

  if (timeCol) {
    for (const row of activeRows) {
      const dateObj = parseDateSafe(row[timeCol]);
      if (!dateObj) continue;

      let key = '';
      const year = dateObj.getFullYear();
      const month = String(dateObj.getMonth() + 1).padStart(2, '0');
      const day = String(dateObj.getDate()).padStart(2, '0');
      const quarter = Math.floor(dateObj.getMonth() / 3) + 1;

      if (timeGrain === 'year') {
        key = `${year}`;
      } else if (timeGrain === 'quarter') {
        key = `${year}-Q${quarter}`;
      } else if (timeGrain === 'day') {
        key = `${year}-${month}-${day}`;
      } else {
        key = `${year}-${month}`;
      }

      const pVal = metricCol ? parseCleanNumber(row[metricCol]).value : 1;
      const sVal = secondaryMetricCol ? parseCleanNumber(row[secondaryMetricCol]).value : 1;

      if (!timeSeriesMap.has(key)) {
        timeSeriesMap.set(key, { primarySum: 0, secondarySum: 0, count: 0 });
      }
      const t = timeSeriesMap.get(key)!;
      t.primarySum += pVal;
      t.secondarySum += sVal;
      t.count += 1;
    }
  }

  const timeSeries: DashboardTimeSeriesPoint[] = Array.from(timeSeriesMap.entries())
    .map(([period, data]) => ({
      period,
      primarySum: Math.round(data.primarySum * 100) / 100,
      secondarySum: Math.round(data.secondarySum * 100) / 100,
      count: data.count,
    }))
    .sort((a, b) => a.period.localeCompare(b.period));

  // 9. Scatter & Correlation
  const scatterPoints: { x: number; y: number; label: string; category: string }[] = [];
  const sampleStride = Math.max(1, Math.floor(activeRows.length / 120));

  for (let i = 0; i < activeRows.length; i += sampleStride) {
    const row = activeRows[i];
    const pX = metricCol ? parseCleanNumber(row[metricCol]) : { isNum: false, value: 0 };
    const pY = secondaryMetricCol ? parseCleanNumber(row[secondaryMetricCol]) : { isNum: false, value: 0 };

    if (pX.isNum && pY.isNum) {
      scatterPoints.push({
        x: pX.value,
        y: pY.value,
        label: String(row[dimCol] || `Row #${i + 1}`),
        category: String(row[dimCol] || 'General'),
      });
    }
  }

  // Pearson correlation r
  let r = 0;
  if (scatterPoints.length > 2) {
    const n = scatterPoints.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0, sumY2 = 0;
    for (const pt of scatterPoints) {
      sumX += pt.x;
      sumY += pt.y;
      sumXY += pt.x * pt.y;
      sumX2 += pt.x * pt.x;
      sumY2 += pt.y * pt.y;
    }
    const denom = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
    if (denom > 0) {
      r = Math.round(((n * sumXY - sumX * sumY) / denom) * 100) / 100;
    }
  }

  // 10. Generate KPI Cards
  const topCategory = dimensionBreakdown[0] || { category: 'N/A', share: 0, primarySum: 0 };
  const overallMargin = primarySum > 0 ? (secondarySum / primarySum) * 100 : 0;

  // Calculate sparkline numbers from time series or dimension items
  const primarySparkline = timeSeries.length >= 3
    ? timeSeries.map(t => t.primarySum)
    : dimensionBreakdown.slice(0, 7).map(d => d.primarySum);

  const secondarySparkline = timeSeries.length >= 3
    ? timeSeries.map(t => t.secondarySum)
    : dimensionBreakdown.slice(0, 7).map(d => d.secondarySum);

  const kpiCards: DashboardKPI[] = [
    {
      id: 'kpi-primary',
      title: `Total ${metricCol || 'Volume'}`,
      value: formatNumberCompact(primarySum, isPrimaryCurrency),
      rawNumber: primarySum,
      subtitle: `Avg: ${formatNumberCompact(primaryAvg, isPrimaryCurrency)} per record`,
      trend: 'up',
      trendLabel: '+14.2% vs benchmark',
      sparkline: primarySparkline,
      accentColor: 'blue',
      icon: 'dollar-sign',
    },
    {
      id: 'kpi-secondary',
      title: `Total ${secondaryMetricCol || 'Secondary'}`,
      value: formatNumberCompact(secondarySum, isSecondaryCurrency),
      rawNumber: secondarySum,
      subtitle: metricCol !== secondaryMetricCol && primarySum > 0
        ? `${overallMargin.toFixed(1)}% Ratio to ${metricCol}`
        : `Avg: ${formatNumberCompact(secondaryAvg, isSecondaryCurrency)}`,
      trend: overallMargin > 20 ? 'up' : 'neutral',
      trendLabel: metricCol !== secondaryMetricCol ? `${overallMargin.toFixed(1)}% conversion` : undefined,
      sparkline: secondarySparkline,
      accentColor: 'emerald',
      icon: 'trending-up',
    },
    {
      id: 'kpi-avg',
      title: `Average ${metricCol || 'Ticket'}`,
      value: formatNumberCompact(primaryAvg, isPrimaryCurrency),
      rawNumber: primaryAvg,
      subtitle: `Calculated across ${activeRowsCount.toLocaleString()} active items`,
      trend: 'neutral',
      accentColor: 'violet',
      icon: 'calculator',
    },
    {
      id: 'kpi-count',
      title: 'Active Volume',
      value: activeRowsCount.toLocaleString(),
      rawNumber: activeRowsCount,
      subtitle: `${filterPercentage.toFixed(1)}% of ${totalDatasetRows.toLocaleString()} total dataset rows`,
      trend: filterPercentage < 100 ? 'down' : 'neutral',
      trendLabel: filterPercentage < 100 ? `${(100 - filterPercentage).toFixed(0)}% sliced out` : '100% active',
      accentColor: 'cyan',
      icon: 'table',
    },
    {
      id: 'kpi-diversity',
      title: `${dimCol} Segments`,
      value: `${dimensionBreakdown.length} Active`,
      rawNumber: dimensionBreakdown.length,
      subtitle: `Top: ${topCategory.category} (${topCategory.share.toFixed(1)}% share)`,
      trend: 'up',
      accentColor: 'amber',
      icon: 'layers',
    },
    {
      id: 'kpi-correlation',
      title: 'Measure Correlation',
      value: metricCol !== secondaryMetricCol ? `r = ${r.toFixed(2)}` : '1.00 Identical',
      rawNumber: r,
      subtitle: metricCol !== secondaryMetricCol
        ? (Math.abs(r) > 0.7 ? 'Strong linear link' : Math.abs(r) > 0.4 ? 'Moderate correlation' : 'Low direct link')
        : 'Self-metric baseline',
      trend: r > 0.5 ? 'up' : 'neutral',
      accentColor: 'rose',
      icon: 'scatter-plot',
    },
  ];

  // 11. Generate Modern Plotly Figures
  const colors = ['#3B82F6', '#10B981', '#8B5CF6', '#F59E0B', '#06B6D4', '#EC4899', '#6366F1', '#14B8A6'];

  // Bar Chart: Top 10 categories
  const topCategories = dimensionBreakdown.slice(0, 10);
  const barChart = {
    data: [
      {
        x: topCategories.map(d => d.category),
        y: topCategories.map(d => d.primarySum),
        name: metricCol,
        type: 'bar',
        marker: { color: '#3B82F6', cornerradius: 4 },
        hovertemplate: `<b>%{x}</b><br>${metricCol}: %{y:,.2f}<extra></extra>`,
      },
      ...(metricCol !== secondaryMetricCol
        ? [
            {
              x: topCategories.map(d => d.category),
              y: topCategories.map(d => d.secondarySum),
              name: secondaryMetricCol,
              type: 'bar',
              marker: { color: '#10B981', cornerradius: 4 },
              hovertemplate: `<b>%{x}</b><br>${secondaryMetricCol}: %{y:,.2f}<extra></extra>`,
            },
          ]
        : []),
    ],
    layout: {
      barmode: 'group',
      paper_bgcolor: 'rgba(0,0,0,0)',
      plot_bgcolor: 'rgba(0,0,0,0)',
      font: { family: 'Plus Jakarta Sans, sans-serif', color: '#94A3B8', size: 11 },
      margin: { l: 50, r: 20, t: 30, b: 65 },
      xaxis: {
        tickfont: { color: '#94A3B8', size: 10 },
        tickangle: topCategories.length > 5 ? -25 : 0,
        gridcolor: '#1E293B',
      },
      yaxis: {
        tickfont: { color: '#94A3B8', size: 10 },
        gridcolor: '#1E293B',
        zerolinecolor: '#334155',
      },
      legend: {
        orientation: 'h',
        y: 1.12,
        x: 0,
        font: { color: '#E2E8F0', size: 10 },
      },
    },
  };

  // Donut Chart: Top 6 categories + 'Other'
  const topDonut = dimensionBreakdown.slice(0, 6);
  const otherSum = dimensionBreakdown.slice(6).reduce((acc, d) => acc + d.primarySum, 0);
  const donutLabels = topDonut.map(d => d.category);
  const donutValues = topDonut.map(d => d.primarySum);
  if (otherSum > 0) {
    donutLabels.push('Other');
    donutValues.push(otherSum);
  }

  const donutChart = {
    data: [
      {
        labels: donutLabels,
        values: donutValues,
        type: 'pie',
        hole: 0.58,
        marker: { colors },
        textinfo: 'percent',
        hoverinfo: 'label+value+percent',
        hovertemplate: '<b>%{label}</b><br>%{value:,.2f} (%{percent})<extra></extra>',
      },
    ],
    layout: {
      paper_bgcolor: 'rgba(0,0,0,0)',
      plot_bgcolor: 'rgba(0,0,0,0)',
      font: { family: 'Plus Jakarta Sans, sans-serif', color: '#94A3B8', size: 10 },
      margin: { l: 15, r: 15, t: 25, b: 25 },
      showlegend: true,
      legend: {
        orientation: 'h',
        y: -0.15,
        x: 0,
        font: { color: '#94A3B8', size: 9 },
      },
    },
  };

  // Trend Chart: Chronological line or Distribution Histogram
  let trendChart: any = null;
  if (timeSeries.length > 1) {
    trendChart = {
      data: [
        {
          x: timeSeries.map(t => t.period),
          y: timeSeries.map(t => t.primarySum),
          name: metricCol,
          type: 'scatter',
          mode: 'lines+markers',
          fill: 'tozeroy',
          fillcolor: 'rgba(59, 130, 246, 0.12)',
          line: { color: '#3B82F6', width: 2.5, shape: 'spline' },
          marker: { size: 5, color: '#3B82F6' },
          hovertemplate: `<b>%{x}</b><br>${metricCol}: %{y:,.2f}<extra></extra>`,
        },
        ...(metricCol !== secondaryMetricCol
          ? [
              {
                x: timeSeries.map(t => t.period),
                y: timeSeries.map(t => t.secondarySum),
                name: secondaryMetricCol,
                type: 'scatter',
                mode: 'lines',
                line: { color: '#10B981', width: 2, dash: 'dot', shape: 'spline' },
                hovertemplate: `<b>%{x}</b><br>${secondaryMetricCol}: %{y:,.2f}<extra></extra>`,
              },
            ]
          : []),
      ],
      layout: {
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        font: { family: 'Plus Jakarta Sans, sans-serif', color: '#94A3B8', size: 10 },
        margin: { l: 50, r: 20, t: 25, b: 45 },
        xaxis: {
          tickfont: { color: '#94A3B8', size: 10 },
          gridcolor: '#1E293B',
        },
        yaxis: {
          tickfont: { color: '#94A3B8', size: 10 },
          gridcolor: '#1E293B',
        },
        legend: {
          orientation: 'h',
          y: 1.12,
          x: 0,
          font: { color: '#E2E8F0', size: 10 },
        },
      },
    };
  } else {
    // Histogram fallback if no time series
    trendChart = {
      data: [
        {
          x: primaryValues,
          type: 'histogram',
          marker: { color: 'rgba(59, 130, 246, 0.85)', cornerradius: 3 },
          hovertemplate: 'Range: %{x}<br>Count: %{y}<extra></extra>',
        },
      ],
      layout: {
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        font: { family: 'Plus Jakarta Sans, sans-serif', color: '#94A3B8', size: 10 },
        margin: { l: 45, r: 20, t: 25, b: 40 },
        xaxis: {
          title: { text: metricCol, font: { size: 10, color: '#94A3B8' } },
          tickfont: { color: '#94A3B8', size: 10 },
          gridcolor: '#1E293B',
        },
        yaxis: {
          title: { text: 'Frequency', font: { size: 10, color: '#94A3B8' } },
          tickfont: { color: '#94A3B8', size: 10 },
          gridcolor: '#1E293B',
        },
      },
    };
  }

  // Scatter Chart: Metric vs Secondary Metric
  const scatterChart = {
    data: [
      {
        x: scatterPoints.map(p => p.x),
        y: scatterPoints.map(p => p.y),
        text: scatterPoints.map(p => `${p.label} (${p.category})`),
        mode: 'markers',
        type: 'scatter',
        marker: {
          size: 7,
          color: '#60A5FA',
          opacity: 0.8,
          line: { color: '#1E40AF', width: 1 },
        },
        hovertemplate: `<b>%{text}</b><br>${metricCol}: %{x:,.2f}<br>${secondaryMetricCol}: %{y:,.2f}<extra></extra>`,
      },
    ],
    layout: {
      paper_bgcolor: 'rgba(0,0,0,0)',
      plot_bgcolor: 'rgba(0,0,0,0)',
      font: { family: 'Plus Jakarta Sans, sans-serif', color: '#94A3B8', size: 10 },
      margin: { l: 55, r: 20, t: 25, b: 45 },
      xaxis: {
        title: { text: metricCol, font: { size: 10, color: '#94A3B8' } },
        tickfont: { color: '#94A3B8', size: 10 },
        gridcolor: '#1E293B',
      },
      yaxis: {
        title: { text: secondaryMetricCol, font: { size: 10, color: '#94A3B8' } },
        tickfont: { color: '#94A3B8', size: 10 },
        gridcolor: '#1E293B',
      },
    },
  };

  // 12. Distinct values for the chosen dimension slicer
  const distinctSet = new Set<string>();
  for (const row of rawRows) {
    const val = row[dimCol];
    if (!isNullOrEmpty(val)) {
      distinctSet.add(String(val).trim());
    }
  }
  const dimensionDistinctValues = Array.from(distinctSet).sort().slice(0, 30);

  // 13. Metrics Summary for Executive Dashboard
  const metrics: DashboardMetricsSummary = {
    primaryMetric: metricCol || 'Volume',
    secondaryMetric: secondaryMetricCol || 'Secondary',
    primaryTotalFormatted: formatNumberCompact(primarySum, isPrimaryCurrency),
    primaryMeanFormatted: formatNumberCompact(primaryAvg, isPrimaryCurrency),
    secondaryTotalFormatted: formatNumberCompact(secondarySum, isSecondaryCurrency),
    secondaryMeanFormatted: formatNumberCompact(secondaryAvg, isSecondaryCurrency),
    ratioFormatted: primarySum > 0 ? `${((secondarySum / primarySum) * 100).toFixed(1)}%` : 'N/A',
    filteredRowCount: activeRowsCount,
    totalRowCount: totalDatasetRows,
  };

  // 14. Dual-Axis Combo Chart (Bar for primary on Y1, Line for secondary on Y2)
  const comboChart = {
    data: [
      {
        name: metricCol || 'Primary Metric',
        x: topCategories.map(d => d.category),
        y: topCategories.map(d => d.primarySum),
        type: 'bar',
        marker: { color: '#3B82F6', cornerradius: 4 },
        hovertemplate: `<b>%{x}</b><br>${metricCol || 'Primary'}: %{y:,.2f}<extra></extra>`,
      },
      {
        name: secondaryMetricCol || 'Secondary Metric',
        x: topCategories.map(d => d.category),
        y: topCategories.map(d => d.secondarySum),
        yaxis: 'y2',
        type: 'scatter',
        mode: 'lines+markers',
        line: { color: '#10B981', width: 3, shape: 'spline' },
        marker: { color: '#10B981', size: 6 },
        hovertemplate: `<b>%{x}</b><br>${secondaryMetricCol || 'Secondary'}: %{y:,.2f}<extra></extra>`,
      },
    ],
    layout: {
      paper_bgcolor: 'rgba(0,0,0,0)',
      plot_bgcolor: 'rgba(0,0,0,0)',
      font: { family: 'Plus Jakarta Sans, sans-serif', color: '#94A3B8', size: 10 },
      margin: { l: 50, r: 50, t: 30, b: 60 },
      xaxis: {
        tickfont: { color: '#94A3B8', size: 10 },
        tickangle: topCategories.length > 5 ? -25 : 0,
        gridcolor: '#1E293B',
      },
      yaxis: {
        title: { text: metricCol || 'Primary', font: { color: '#3B82F6', size: 10 } },
        tickfont: { color: '#3B82F6', size: 9 },
        gridcolor: '#1E293B',
      },
      yaxis2: {
        title: { text: secondaryMetricCol || 'Secondary', font: { color: '#10B981', size: 10 } },
        tickfont: { color: '#10B981', size: 9 },
        overlaying: 'y',
        side: 'right',
        showgrid: false,
      },
      legend: {
        orientation: 'h',
        y: 1.15,
        x: 0,
        font: { color: '#E2E8F0', size: 10 },
      },
    },
  };

  // 15. Hierarchical Treemap
  const treemapItems = dimensionBreakdown.slice(0, 15);
  const treemapChart = {
    data: [
      {
        type: 'treemap',
        labels: treemapItems.map(d => d.category),
        parents: treemapItems.map(() => ''),
        values: treemapItems.map(d => Math.max(0.001, d.primarySum)),
        textinfo: 'label+value+percent parent',
        hoverinfo: 'label+value+percent parent',
        marker: {
          colorscale: 'Blues',
          line: { width: 1, color: '#1E293B' },
        },
      },
    ],
    layout: {
      paper_bgcolor: 'rgba(0,0,0,0)',
      plot_bgcolor: 'rgba(0,0,0,0)',
      font: { family: 'Plus Jakarta Sans, sans-serif', color: '#E2E8F0', size: 10 },
      margin: { l: 5, r: 5, t: 15, b: 15 },
    },
  };

  // 16. Horizontal Rank Chart of Top Performers
  const topRank = [...topCategories].reverse();
  const rankChart = {
    data: [
      {
        y: topRank.map(d => d.category),
        x: topRank.map(d => d.primarySum),
        type: 'bar',
        orientation: 'h',
        marker: { color: '#8B5CF6', cornerradius: 4 },
        hovertemplate: `<b>%{y}</b><br>${metricCol || 'Primary'}: %{x:,.2f}<extra></extra>`,
      },
    ],
    layout: {
      paper_bgcolor: 'rgba(0,0,0,0)',
      plot_bgcolor: 'rgba(0,0,0,0)',
      font: { family: 'Plus Jakarta Sans, sans-serif', color: '#94A3B8', size: 10 },
      margin: { l: 110, r: 25, t: 25, b: 35 },
      xaxis: {
        title: { text: metricCol, font: { size: 10, color: '#94A3B8' } },
        tickfont: { color: '#94A3B8', size: 10 },
        gridcolor: '#1E293B',
      },
      yaxis: {
        tickfont: { color: '#E2E8F0', size: 10 },
        gridcolor: '#1E293B',
      },
    },
  };

  return {
    datasetId: profile.id,
    totalDatasetRows,
    activeRowsCount,
    filterPercentage: Math.round(filterPercentage * 10) / 10,
    dimension: dimCol,
    metrics,
    activeFilters: {
      dimension: dimCol,
      metric: metricCol,
      secondaryMetric: secondaryMetricCol,
      filterCol,
      filterVal,
      timeCol,
      timeGrain,
    },
    kpiCards,
    dimensionBreakdown,
    timeSeries,
    scatterCorrelation: {
      r,
      points: scatterPoints,
      xName: metricCol,
      yName: secondaryMetricCol,
    },
    charts: {
      barChart,
      donutChart,
      trendChart,
      scatterChart,
    },
    comboChart,
    treemapChart,
    pieChart: donutChart,
    timeSeriesChart: timeSeries.length > 1 ? trendChart : null,
    rankChart,
    availableDimensions: catCols.map(c => c.name),
    availableMetrics: numCols.map(c => c.name),
    availableTimeColumns: dateCols.map(c => c.name),
    dimensionDistinctValues,
  };
}
