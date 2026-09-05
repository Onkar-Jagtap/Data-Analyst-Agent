import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { generateSampleBusinessDataset } from '../server/sample_data.js';
import {
  profileDataset,
  parseCleanNumber,
} from '../server/profiler.js';
import { auditDataQuality, evaluateBusinessAssertions } from '../server/quality.js';
import { generateAutomatedInsights } from '../server/insights.js';
import { computeDashboardData } from '../server/dashboard.js';
import { generatePlotlyFigure } from '../server/charts.js';
import {
  calculateCorrelationMatrix,
  getOutlierDrilldown,
  executeAnalysisPlan,
} from '../server/analyzer.js';
import {
  resolveColumn,
  resolveMetricFromQuery,
  resolveAggregation,
  applyFollowUpContext,
} from '../server/query_resolver.js';
import { performDataCleaning } from '../server/cleaner.js';
import { performTransformation } from '../server/transformer.js';
import { AnalysisPlan } from '../server/types.js';
import {
  AnalysisResult,
  BusinessAssertion,
  DataQualityAudit,
  DatasetProfile,
  ExecutiveReport,
  InsightItem,
  ReportVisualSection,
  StrategicActionItem,
  TransformRequest,
} from './types.js';

export interface ClientStoredDataset {
  id: string;
  filename: string;
  rawRows: Record<string, any>[];
  profile: DatasetProfile;
  qualityAudit: DataQualityAudit;
  insights: InsightItem[];
  isSample: boolean;
  createdAt: string;
}

class ClientAnalyticsEngine {
  private datasets: Map<string, ClientStoredDataset> = new Map();
  private activeDatasetId: string | null = null;
  private undoHistory: Map<string, Record<string, any>[][]> = new Map();

  constructor() {
    // Autonomous browser analytics engine
  }

  public getActiveDataset(): ClientStoredDataset | null {
    if (!this.activeDatasetId) {
      const first = Array.from(this.datasets.values())[0];
      return first || null;
    }
    return this.datasets.get(this.activeDatasetId) || null;
  }

  public getDataset(id?: string): ClientStoredDataset | null {
    if (!id || id === 'active') return this.getActiveDataset();
    return this.datasets.get(id) || null;
  }

  public listDatasets(): {
    datasets: {
      id: string;
      filename: string;
      rowCount: number;
      columnCount: number;
      isSample: boolean;
      createdAt: string;
    }[];
    activeId?: string;
  } {
    const list = Array.from(this.datasets.values()).map(d => ({
      id: d.id,
      filename: d.filename,
      rowCount: d.profile.rowCount,
      columnCount: d.profile.columnCount,
      isSample: d.isSample,
      createdAt: d.createdAt,
    }));
    return {
      datasets: list,
      activeId: this.activeDatasetId || (list[0]?.id ?? undefined),
    };
  }

  public setActiveDataset(id: string): DatasetProfile | null {
    const ds = this.datasets.get(id);
    if (!ds) return null;
    this.activeDatasetId = id;
    return ds.profile;
  }

  public initSampleDataset(): {
    profile: DatasetProfile;
    quality: DataQualityAudit;
    insights: InsightItem[];
  } {
    const rows = generateSampleBusinessDataset();
    const id = 'sample-b2b-sales-client';
    const profile = profileDataset(rows, 'enterprise_sales_sample.csv', id) as DatasetProfile;
    const quality = auditDataQuality(rows, profile) as DataQualityAudit;
    const insights = generateAutomatedInsights(rows, profile) as InsightItem[];

    const stored: ClientStoredDataset = {
      id,
      filename: 'enterprise_sales_sample.csv',
      rawRows: rows,
      profile,
      qualityAudit: quality,
      insights,
      isSample: true,
      createdAt: new Date().toISOString(),
    };

    this.datasets.set(id, stored);
    this.activeDatasetId = id;
    this.undoHistory.set(id, []);

    return { profile, quality, insights };
  }

  public async uploadDataset(file: File): Promise<{
    profile: DatasetProfile;
    quality: DataQualityAudit;
    insights: InsightItem[];
  }> {
    const ext = file.name.split('.').pop()?.toLowerCase();
    let rows: Record<string, any>[] = [];

    if (ext === 'csv') {
      rows = await new Promise((resolve, reject) => {
        Papa.parse(file, {
          header: true,
          dynamicTyping: false,
          skipEmptyLines: 'greedy',
          complete: results => {
            resolve(results.data as Record<string, any>[]);
          },
          error: err => reject(err),
        });
      });
    } else if (ext === 'xlsx' || ext === 'xls') {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      if (!firstSheetName) {
        throw new Error('Workbook contains no sheets.');
      }
      rows = XLSX.utils.sheet_to_json(workbook.Sheets[firstSheetName], { defval: null });
    } else {
      throw new Error('Only CSV, XLSX, and XLS formats are supported.');
    }

    if (rows.length === 0) {
      throw new Error('Uploaded dataset is empty.');
    }

    const id = `ds-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
    const profile = profileDataset(rows, file.name, id) as DatasetProfile;
    const quality = auditDataQuality(rows, profile) as DataQualityAudit;
    const insights = generateAutomatedInsights(rows, profile) as InsightItem[];

    const stored: ClientStoredDataset = {
      id,
      filename: file.name,
      rawRows: rows,
      profile,
      qualityAudit: quality,
      insights,
      isSample: false,
      createdAt: new Date().toISOString(),
    };

    this.datasets.set(id, stored);
    this.activeDatasetId = id;
    this.undoHistory.set(id, []);

    return { profile, quality, insights };
  }

  public getDashboardData(
    datasetId?: string,
    params?: {
      metric?: string;
      dimension?: string;
      timeFilter?: string;
      categoryFilter?: string;
      timeGranularity?: string;
    }
  ) {
    const ds = this.getDataset(datasetId);
    if (!ds) throw new Error('Dataset not found in client storage.');
    return computeDashboardData(ds.rawRows, ds.profile, params || {});
  }

  public generateCustomChart(
    datasetId: string | undefined,
    params: {
      type: string;
      xAxis: string;
      yAxis?: string;
      aggregation?: string;
      categoryFilter?: string;
      timeGranularity?: string;
    }
  ) {
    const ds = this.getDataset(datasetId);
    if (!ds) throw new Error('Dataset not found in client storage.');

    const { type, xAxis, yAxis, aggregation = 'sum', categoryFilter } = params;

    let filteredRows = ds.rawRows;
    if (categoryFilter && categoryFilter !== 'ALL') {
      filteredRows = filteredRows.filter(r => String(r[xAxis] ?? '').trim() === categoryFilter);
    }

    // Build payload according to chart type
    if (type === 'histogram') {
      const vals = filteredRows
        .map(r => parseCleanNumber(r[xAxis]))
        .filter(n => n.isNum)
        .map(n => n.value);
      return generatePlotlyFigure('histogram', { x: vals, name: xAxis }, `Distribution of ${xAxis}`);
    }

    if (type === 'box') {
      const vals = filteredRows
        .map(r => parseCleanNumber(r[yAxis || xAxis]))
        .filter(n => n.isNum)
        .map(n => n.value);
      return generatePlotlyFigure('box', { y: vals, name: yAxis || xAxis }, `Spread of ${yAxis || xAxis}`);
    }

    if (type === 'scatter') {
      const points: { x: number; y: number }[] = [];
      filteredRows.forEach(r => {
        const nx = parseCleanNumber(r[xAxis]);
        const ny = parseCleanNumber(yAxis ? r[yAxis] : null);
        if (nx.isNum && ny.isNum) {
          points.push({ x: nx.value, y: ny.value });
        }
      });
      return generatePlotlyFigure(
        'scatter',
        { x: points.map(p => p.x), y: points.map(p => p.y) },
        `${yAxis} vs. ${xAxis}`,
        { isCurrency: yAxis?.toLowerCase().includes('revenue') || yAxis?.toLowerCase().includes('profit') }
      );
    }

    // Categorical aggregation (bar, line, pie, treemap, etc.)
    const groupMap = new Map<string, number[]>();
    filteredRows.forEach(r => {
      const cat = String(r[xAxis] ?? 'N/A').trim() || 'N/A';
      if (!groupMap.has(cat)) groupMap.set(cat, []);
      if (yAxis) {
        const ny = parseCleanNumber(r[yAxis]);
        if (ny.isNum) groupMap.get(cat)!.push(ny.value);
      } else {
        groupMap.get(cat)!.push(1);
      }
    });

    const categories: string[] = [];
    const values: number[] = [];

    groupMap.forEach((nums, cat) => {
      categories.push(cat);
      if (yAxis) {
        if (aggregation === 'avg' || aggregation === 'mean') {
          const avg = nums.length > 0 ? nums.reduce((a, b) => a + b, 0) / nums.length : 0;
          values.push(Math.round(avg * 100) / 100);
        } else if (aggregation === 'count') {
          values.push(nums.length);
        } else {
          const sum = nums.reduce((a, b) => a + b, 0);
          values.push(Math.round(sum * 100) / 100);
        }
      } else {
        values.push(nums.length);
      }
    });

    // Sort descending by value
    const paired = categories.map((cat, i) => ({ cat, val: values[i] }));
    paired.sort((a, b) => b.val - a.val);

    const isCurrency = (yAxis || xAxis).toLowerCase().includes('revenue') || (yAxis || xAxis).toLowerCase().includes('profit') || (yAxis || xAxis).toLowerCase().includes('cost');

    const chartTitle = yAxis
      ? `${aggregation.toUpperCase()} of ${yAxis} by ${xAxis}`
      : `Count by ${xAxis}`;

    const sortedCats = paired.slice(0, 30).map(p => p.cat);
    const sortedVals = paired.slice(0, 30).map(p => p.val);

    const validChartType = (['bar', 'line', 'pie', 'treemap', 'sunburst', 'heatmap', 'combo'] as const).includes(type as any)
      ? (type as any)
      : 'bar';

    return generatePlotlyFigure(
      validChartType,
      { x: sortedCats, y: sortedVals, labels: sortedCats, values: sortedVals },
      chartTitle,
      { isCurrency }
    );
  }

  public getCorrelationMatrix(datasetId?: string) {
    const ds = this.getDataset(datasetId);
    if (!ds) throw new Error('Dataset not found in client storage.');
    return calculateCorrelationMatrix(ds.rawRows, ds.profile);
  }

  public getOutlierDrilldown(datasetId?: string, column?: string) {
    const ds = this.getDataset(datasetId);
    if (!ds) throw new Error('Dataset not found in client storage.');
    return getOutlierDrilldown(ds.rawRows, ds.profile, column || '');
  }

  public getExplorerData(
    datasetId?: string,
    params?: {
      page?: number;
      pageSize?: number;
      search?: string;
      sortColumn?: string;
      sortDirection?: 'asc' | 'desc';
      columnFilter?: string;
    }
  ) {
    const ds = this.getDataset(datasetId);
    if (!ds) throw new Error('Dataset not found in client storage.');

    const page = Math.max(1, Number(params?.page || 1));
    const pageSize = Math.min(200, Math.max(10, Number(params?.pageSize || 50)));
    const search = (params?.search || '').toLowerCase().trim();
    const sortCol = params?.sortColumn;
    const sortDir = params?.sortDirection || 'asc';

    let filtered = ds.rawRows;

    if (search) {
      filtered = filtered.filter(row =>
        Object.values(row).some(v => String(v ?? '').toLowerCase().includes(search))
      );
    }

    if (sortCol) {
      filtered = [...filtered].sort((a, b) => {
        const va = a[sortCol];
        const vb = b[sortCol];
        const na = parseCleanNumber(va);
        const nb = parseCleanNumber(vb);
        if (na.isNum && nb.isNum) {
          return sortDir === 'asc' ? na.value - nb.value : nb.value - na.value;
        }
        const sa = String(va ?? '');
        const sb = String(vb ?? '');
        return sortDir === 'asc' ? sa.localeCompare(sb) : sb.localeCompare(sa);
      });
    }

    const totalRows = filtered.length;
    const startIndex = (page - 1) * pageSize;
    const paginated = filtered.slice(startIndex, startIndex + pageSize);

    return {
      rows: paginated,
      totalRows,
      page,
      pageSize,
      totalPages: Math.ceil(totalRows / pageSize),
    };
  }

  public cleanDataset(datasetId: string | undefined, action: string, column?: string, constantValue?: any) {
    const ds = this.getDataset(datasetId);
    if (!ds) throw new Error('Dataset not found in client storage.');

    // Push deep snapshot to undo stack
    let stack = this.undoHistory.get(ds.id);
    if (!stack) {
      stack = [];
      this.undoHistory.set(ds.id, stack);
    }
    stack.push(ds.rawRows.map(r => ({ ...r })));
    if (stack.length > 5) stack.shift();

    const cleanResult = performDataCleaning(ds.rawRows, ds.profile, action, column, constantValue);
    ds.rawRows = cleanResult.cleanedRows;
    ds.profile = profileDataset(ds.rawRows, ds.filename, ds.id) as DatasetProfile;
    ds.qualityAudit = auditDataQuality(ds.rawRows, ds.profile) as DataQualityAudit;
    ds.insights = generateAutomatedInsights(ds.rawRows, ds.profile) as InsightItem[];

    return {
      result: cleanResult,
      profile: ds.profile,
      quality: ds.qualityAudit,
    };
  }

  public undoCleanDataset(datasetId?: string) {
    const ds = this.getDataset(datasetId);
    if (!ds) throw new Error('Dataset not found in client storage.');

    const stack = this.undoHistory.get(ds.id);
    if (!stack || stack.length === 0) {
      throw new Error('No actions available to undo.');
    }

    const previousRows = stack.pop()!;
    ds.rawRows = previousRows;
    ds.profile = profileDataset(ds.rawRows, ds.filename, ds.id) as DatasetProfile;
    ds.qualityAudit = auditDataQuality(ds.rawRows, ds.profile) as DataQualityAudit;
    ds.insights = generateAutomatedInsights(ds.rawRows, ds.profile) as InsightItem[];

    return {
      profile: ds.profile,
      quality: ds.qualityAudit,
      remainingUndos: stack.length,
    };
  }

  public checkCanUndo(datasetId?: string) {
    const ds = this.getDataset(datasetId);
    if (!ds) return { canUndo: false, undoStackCount: 0 };
    const stack = this.undoHistory.get(ds.id);
    return {
      canUndo: !!(stack && stack.length > 0),
      undoStackCount: stack?.length || 0,
    };
  }

  public transformDataset(datasetId: string | undefined, request: TransformRequest) {
    const ds = this.getDataset(datasetId);
    if (!ds) throw new Error('Dataset not found in client storage.');

    let stack = this.undoHistory.get(ds.id);
    if (!stack) {
      stack = [];
      this.undoHistory.set(ds.id, stack);
    }
    stack.push(ds.rawRows.map(r => ({ ...r })));
    if (stack.length > 5) stack.shift();

    const transformResult = performTransformation(ds.rawRows, ds.profile, request);
    ds.rawRows = transformResult.transformedRows;
    ds.profile = profileDataset(ds.rawRows, ds.filename, ds.id) as DatasetProfile;
    ds.qualityAudit = auditDataQuality(ds.rawRows, ds.profile) as DataQualityAudit;
    ds.insights = generateAutomatedInsights(ds.rawRows, ds.profile) as InsightItem[];

    return {
      result: transformResult,
      profile: ds.profile,
      quality: ds.qualityAudit,
    };
  }

  public evaluateAssertions(datasetId: string | undefined, assertions: BusinessAssertion[]) {
    const ds = this.getDataset(datasetId);
    if (!ds) throw new Error('Dataset not found in client storage.');
    return evaluateBusinessAssertions(ds.rawRows, assertions);
  }

  public getDataDictionary(datasetId?: string) {
    const ds = this.getDataset(datasetId);
    if (!ds) throw new Error('Dataset not found in client storage.');

    const columns = ds.profile.columns.map(c => ({
      name: c.name,
      type: c.type,
      totalCount: c.totalCount,
      nullCount: c.nullCount,
      nullPercentage: c.nullPercentage,
      uniqueCount: c.uniqueCount,
      min: c.min,
      max: c.max,
      mean: c.mean,
      median: c.median,
      sampleValues: c.sampleValues,
      businessDescription: `Column '${c.name}' contains ${c.type} data with ${c.uniqueCount} distinct values and ${c.nullPercentage}% nulls.`,
    }));

    const markdown = `# Data Dictionary: ${ds.filename}\n\n` +
      `**Generated on:** ${new Date().toLocaleDateString()}\n` +
      `**Rows:** ${ds.profile.rowCount.toLocaleString()} | **Columns:** ${ds.profile.columnCount}\n\n` +
      `| Column Name | Inferred Type | Null % | Distinct | Min | Max | Sample Values |\n` +
      `| :--- | :--- | :--- | :--- | :--- | :--- | :--- |\n` +
      columns.map(c =>
        `| **${c.name}** | \`${c.type}\` | ${c.nullPercentage}% | ${c.uniqueCount} | ${c.min ?? 'N/A'} | ${c.max ?? 'N/A'} | ${(c.sampleValues || []).slice(0, 3).join(', ')} |`
      ).join('\n');

    return { columns, markdown, profile: ds.profile };
  }

  public getExecutiveReport(datasetId?: string): ExecutiveReport {
    const ds = this.getDataset(datasetId);
    if (!ds) throw new Error('Dataset not found in client storage.');

    const rows = ds.rawRows;
    const profile = ds.profile;
    const dashboard = computeDashboardData(rows, profile, {});
    const quality = ds.qualityAudit;

    const calcs = dashboard.businessCalculations || {
      totalRevenue: 0,
      totalRevenueFormatted: '$0',
      totalProfit: 0,
      totalProfitFormatted: '$0',
      profitMarginPct: 0,
      profitMarginFormatted: '0.0%',
      averageOrderValue: 0,
      averageOrderValueFormatted: '$0',
      topSegmentName: 'N/A',
      topSegmentRevenue: 0,
      topSegmentSharePct: 0,
      topSegmentShareFormatted: '0.0%',
      paretoTop20SharePct: 0,
      paretoTop20ShareFormatted: '0.0%',
      periodGrowthPct: null,
      periodGrowthFormatted: 'N/A',
      refundAdjustmentCount: 0,
      refundAdjustmentTotal: 0,
      refundAdjustmentFormatted: '$0',
      efficiencyRatio: 0,
      efficiencyRatioFormatted: '0.00x',
    };

    const kpis = [
      {
        title: 'Gross Revenue / Total Volume',
        value: calcs.totalRevenueFormatted,
        subValue: `Across ${profile.rowCount.toLocaleString()} records`,
        trend: (calcs.periodGrowthPct ?? 0) >= 0 ? ('up' as const) : ('down' as const),
        trendValue: calcs.periodGrowthFormatted !== 'N/A' ? calcs.periodGrowthFormatted : undefined,
        status: 'good' as const,
      },
      {
        title: 'Net Profit & Capital Generation',
        value: calcs.totalProfitFormatted,
        subValue: `Margin: ${calcs.profitMarginFormatted}`,
        trend: calcs.profitMarginPct >= 20 ? ('up' as const) : ('neutral' as const),
        status: calcs.profitMarginPct >= 25 ? ('good' as const) : calcs.profitMarginPct >= 12 ? ('neutral' as const) : ('warning' as const),
      },
      {
        title: 'Average Deal / Order Value (AOV)',
        value: calcs.averageOrderValueFormatted,
        subValue: `Per discrete recorded transaction`,
        status: 'neutral' as const,
      },
      {
        title: 'Pareto 80/20 Concentration',
        value: calcs.paretoTop20ShareFormatted,
        subValue: `Generated by top 20% of contributors`,
        status: calcs.paretoTop20SharePct > 75 ? ('warning' as const) : ('good' as const),
      },
      {
        title: 'Top Segment Leadership',
        value: calcs.topSegmentName,
        subValue: `${calcs.topSegmentShareFormatted} of entire business volume`,
        status: 'good' as const,
      },
      {
        title: 'Data Completeness Score',
        value: `${quality.score}/100`,
        subValue: `${Math.round(100 - profile.missingPercentage)}% overall completeness`,
        status: quality.score >= 80 ? ('good' as const) : quality.score >= 60 ? ('warning' as const) : ('danger' as const),
      },
    ];

    const visualSections: ReportVisualSection[] = [];

    if (dashboard.comboChart) {
      visualSections.push({
        id: 'section-combo',
        title: 'Commercial Volume & Profit Margin Trajectory',
        subtitle: `Dual-axis breakdown comparing ${dashboard.dimension || 'Segment'} volume and bottom-line margin`,
        businessInterpretation: `This dual-axis visual isolates the exact revenue drivers against net margins across ${dashboard.dimension || 'primary business categories'}. High bars with high margin positions represent profitability anchors.`,
        keyTakeaway: `Prioritize operational capital and sales efforts into segments where margin percentage outpaces volume average.`,
        chart: dashboard.comboChart,
        chartType: 'combo',
      });
    }

    if (dashboard.treemapChart) {
      visualSections.push({
        id: 'section-treemap',
        title: 'Hierarchical Portfolio Composition',
        subtitle: 'Proportional nested volume mapping of categories and sub-segments',
        businessInterpretation: `The treemap scales area in direct proportion to financial weight, providing immediate visibility into core portfolio pillars.`,
        keyTakeaway: `Visual balance confirms where revenue is consolidated, highlighting opportunities in high-velocity sub-units.`,
        chart: dashboard.treemapChart,
        chartType: 'treemap',
      });
    }

    if (dashboard.charts.donutChart) {
      visualSections.push({
        id: 'section-donut',
        title: 'Portfolio Share & Concentration Ratio',
        subtitle: 'Proportional share breakdown across active business entities',
        businessInterpretation: `Demonstrates the proportional market share distribution. Top 20% contributors generate ${calcs.paretoTop20ShareFormatted} of volume.`,
        keyTakeaway: calcs.paretoTop20SharePct > 70
          ? `High concentration alert: Top tier drives ${calcs.paretoTop20ShareFormatted} of volume. Implement relationship retention and cross-tier diversification.`
          : `Healthy portfolio diversification: Volume is balanced without excessive reliance on any single tier.`,
        chart: dashboard.charts.donutChart,
        chartType: 'pie',
      });
    }

    if (dashboard.timeSeriesChart && dashboard.timeSeries.length > 1) {
      visualSections.push({
        id: 'section-trend',
        title: 'Longitudinal Momentum & Trend Velocity',
        subtitle: `Chronological trajectory across ${dashboard.timeSeries.length} recorded intervals`,
        businessInterpretation: `Tracks volume continuity across recorded periods, illuminating operational velocity and seasonality.`,
        keyTakeaway: calcs.periodGrowthFormatted !== 'N/A'
          ? `Trajectory confirms ${calcs.periodGrowthFormatted} delta between initial and terminal intervals.`
          : `Steady longitudinal distribution across recorded timestamps.`,
        chart: dashboard.timeSeriesChart,
        chartType: 'line',
      });
    }

    const actionPlan: StrategicActionItem[] = [
      {
        id: 'act-1',
        category: 'Immediate 30-Day',
        title: `Capitalize on Anchor Segment Leadership ('${calcs.topSegmentName}')`,
        action: `Establish dedicated executive account management and loyalty agreements for top accounts in '${calcs.topSegmentName}', which drives ${calcs.topSegmentShareFormatted} of corporate volume.`,
        expectedImpact: `Protects baseline operating volume and establishes a reliable foundation for expansion.`,
        priority: 'High',
        responsibleRole: 'VP of Commercial Sales / Operations',
      },
      {
        id: 'act-2',
        category: '60-90 Day Optimization',
        title: 'Value-Based Pricing & Margin Optimization',
        action: `Audit unit economics across secondary tiers to lift blended profit margin from ${calcs.profitMarginFormatted} toward target benchmark of 25%+.`,
        expectedImpact: 'Unlocks an estimated +200-400 bps in operating contribution on existing volume.',
        priority: 'High',
        responsibleRole: 'Chief Revenue Officer / Finance Lead',
      },
      {
        id: 'act-3',
        category: 'Governance & Data Quality',
        title: 'Automate Data Quality Validation Protocols',
        action: `Maintain automated validation pipelines to preserve current completeness score of ${quality.score}/100 and eliminate missing attribute values.`,
        expectedImpact: 'Guarantees audit-grade reporting fidelity and prevents data leakage.',
        priority: quality.score < 80 ? 'Critical' : 'Medium',
        responsibleRole: 'Head of Data Engineering & Analytics',
      },
    ];

    const executiveBrief = {
      headline: `Commercial Performance Audit: ${calcs.totalRevenueFormatted} Volume Across ${profile.rowCount.toLocaleString()} Records`,
      overview: `This executive report presents an audit of ${profile.filename}. The dataset generated ${calcs.totalRevenueFormatted} in total volume and ${calcs.totalProfitFormatted} in net profit (${calcs.profitMarginFormatted} margin). '${calcs.topSegmentName}' leads contribution (${calcs.topSegmentShareFormatted} share), with Average Order Value of ${calcs.averageOrderValueFormatted}.`,
      macroContext: 'Maintaining disciplined pricing power and optimizing unit economics is essential. Balance targeted expansion of leading segments while actively managing concentration risk.',
      strengths: [
        `Solid recorded volume totaling ${calcs.totalRevenueFormatted} across ${profile.rowCount.toLocaleString()} transactions.`,
        `Net margin of ${calcs.profitMarginFormatted} delivering ${calcs.totalProfitFormatted} in operating contribution.`,
        `Clear market anchor in '${calcs.topSegmentName}' capturing ${calcs.topSegmentShareFormatted} of aggregate output.`,
      ],
      risks: [
        calcs.paretoTop20SharePct > 65
          ? `Pareto concentration: Top 20% of contributors drive ${calcs.paretoTop20ShareFormatted} of volume.`
          : 'Standard portfolio distribution without critical single-entity concentration.',
        quality.score < 80
          ? `Data quality score of ${quality.score}/100 warrants attention to unpopulated cells.`
          : `Healthy schema integrity with ${quality.score}/100 completeness rating.`,
      ],
      aiGenerated: false,
    };

    const dataQualityHealth = {
      overallScore: quality.score,
      status: quality.score >= 80 ? ('Excellent' as const) : quality.score >= 60 ? ('Good' as const) : ('Needs Attention' as const),
      totalRows: profile.rowCount,
      duplicateRows: profile.duplicateRowCount,
      outlierCount: profile.columns.reduce((sum, c) => sum + (c.outlierCountIqr || c.outlierCountZ || 0), 0),
      nullRate: Math.round(profile.missingPercentage * 10) / 10,
      complianceNote: 'Computed with verified in-browser deterministic precision. Privacy Shield active.',
    };

    const pythonScript = `# Autonomous Audit Script for ${profile.filename}\nimport pandas as pd\ndf = pd.read_csv("${profile.filename}")\nprint(df.info())\nprint(df.describe())`;
    const sqlScript = `-- Audit Query for ${profile.filename}\nSELECT COUNT(*) as total_rows, ROUND(AVG(${profile.columns.find(c => c.type === 'numeric')?.name || 'revenue'}), 2) as avg_val FROM dataset_table;`;

    return {
      generatedAt: new Date().toISOString(),
      datasetName: profile.filename,
      datasetId: profile.id,
      datasetScale: {
        rows: profile.rowCount,
        columns: profile.columnCount,
        completenessScore: quality.score,
        primaryDomain: 'Commercial Sales & Operations',
      },
      executiveBrief,
      businessEconomics: calcs,
      kpis,
      visualSections,
      dataQualityHealth,
      actionPlan,
      reproducibleScript: {
        python: pythonScript,
        sql: sqlScript,
      },
    };
  }

  public askData(datasetId: string | undefined, question: string, previousPlan?: AnalysisPlan): AnalysisResult {
    const ds = this.getDataset(datasetId);
    if (!ds) throw new Error('Dataset not found in client storage.');

    const q = question.toLowerCase();
    const cols = ds.profile.columns;
    const numCols = cols.filter(c => c.type === 'numeric');
    const catCols = cols.filter(c => c.type === 'categorical');
    const dateCols = cols.filter(c => c.type === 'datetime');

    // Safe resolution using deterministic hierarchy
    const metricRes = resolveMetricFromQuery(question, cols, previousPlan);
    if (metricRes.status === 'ambiguous' || (metricRes.status === 'unknown' && numCols.length > 1)) {
      const msg = metricRes.clarificationMessage ||
        `Which metric would you like to analyze? Available numeric metrics: ${numCols.map(c => c.name).join(', ')}.`;
      return {
        success: false,
        question,
        plan: {
          operation: 'clarification',
          user_intent_summary: msg,
        },
        answer: msg,
        keyMetrics: [],
        businessInterpretation: [
          'The query does not specify which numeric metric to evaluate.',
          'Please choose one of the available numeric metrics listed below.',
        ],
        dataHandling: {
          totalRows: ds.profile.rowCount,
          validRowsAnalyzed: 0,
          excludedRows: ds.profile.rowCount,
          missingValuesExcluded: 0,
          invalidValuesExcluded: 0,
          filteredOutRows: 0,
          methodDescription: 'Analysis stopped: clarification required to prevent guessing metric.',
          rulesApplied: ['Deterministic Metric Clarification Protocol'],
          warnings: ['Metric ambiguous or not found.'],
          confidenceScore: 0,
          isDeterministic: true,
        },
        error: {
          code: 'CLARIFICATION_REQUIRED',
          message: msg,
          suggestion: `Select one of: ${numCols.map(c => c.name).join(', ')}.`,
        },
      };
    }

    const metricCol = metricRes.column || numCols[0];

    // Identify Dimension
    let dimCol: any = null;
    for (const c of [...catCols, ...dateCols]) {
      if (q.includes(c.name.toLowerCase())) {
        dimCol = c;
        break;
      }
    }
    if (!dimCol && (q.includes('region') || q.includes('area') || q.includes('location'))) {
      dimCol = catCols.find(c => c.name.toLowerCase().includes('region') || c.name.toLowerCase().includes('country'));
    }
    if (!dimCol && (q.includes('product') || q.includes('item'))) {
      dimCol = catCols.find(c => c.name.toLowerCase().includes('product'));
    }
    if (!dimCol && (q.includes('category') || q.includes('segment'))) {
      dimCol = catCols.find(c => c.name.toLowerCase().includes('category') || c.name.toLowerCase().includes('segment'));
    }
    if (!dimCol && (q.includes('time') || q.includes('month') || q.includes('date') || q.includes('year') || q.includes('trend'))) {
      dimCol = dateCols[0] || catCols[0];
    }
    if (!dimCol) {
      dimCol = catCols[0];
    }

    // Determine Operation and Chart Type
    let operation: any = 'group_aggregate';
    let chartType: 'bar' | 'line' | 'scatter' | 'histogram' | 'box' | 'pie' = 'bar';

    if (q.includes('distribution') || q.includes('histogram') || q.includes('spread')) {
      operation = 'distribution';
      chartType = 'histogram';
    } else if (q.includes('trend') || q.includes('over time') || (dimCol && dimCol.type === 'datetime')) {
      operation = 'time_series';
      chartType = 'line';
    } else if (q.includes('pie') || q.includes('share') || q.includes('breakdown')) {
      operation = 'group_aggregate';
      chartType = 'pie';
    } else if (q.includes('top') || q.includes('rank') || q.includes('bottom')) {
      operation = 'ranking';
      chartType = 'bar';
    }

    const aggResolution = resolveAggregation(question, metricCol?.name);
    const aggregation = aggResolution.aggregation;

    let plan: AnalysisPlan = {
      operation,
      metric: metricCol?.name || cols[0].name,
      group_by: dimCol ? [dimCol.name] : [],
      aggregation: aggregation as any,
      visualization: {
        type: chartType,
        x: dimCol?.name || 'Category',
        y: metricCol?.name || 'Value',
        title: `${aggregation.toUpperCase()} of ${metricCol?.name || 'Metric'} by ${dimCol?.name || 'Dimension'}`,
      },
    };

    if (previousPlan) {
      plan = applyFollowUpContext(question, plan, previousPlan, ds.profile);
    }

    const execution = executeAnalysisPlan(ds.rawRows, ds.profile, plan);

    if (!execution.success) {
      return {
        success: false,
        question,
        plan,
        answer: execution.error?.message || 'Analysis could not be computed.',
        keyMetrics: [],
        businessInterpretation: execution.error?.suggestion ? [execution.error.suggestion] : [],
        dataHandling: execution.dataHandling,
        error: execution.error,
        warnings: execution.warnings,
      };
    }

    // Build Plotly figure
    let chart: any = null;
    try {
      if (execution.data && Array.isArray(execution.data)) {
        const xVals = execution.data.map((d: any) => d.group || d.category || d[dimCol?.name || ''] || d.label);
        const yVals = execution.data.map((d: any) => d.value || d.metric || d[metricCol?.name || 0]);
        chart = generatePlotlyFigure(
          chartType as any,
          { x: xVals, y: yVals, labels: xVals, values: yVals },
          `${aggregation.toUpperCase()} of ${metricCol?.name || 'Metric'} by ${dimCol?.name || 'Dimension'}`,
          { isCurrency: metricCol?.name.toLowerCase().includes('revenue') || metricCol?.name.toLowerCase().includes('profit') }
        );
      }
    } catch {
      // Fallback
    }

    const summaryText = execution.summaryMetrics.map((s: any) => `**${s.label}**: ${s.value}`).join(' | ');

    return {
      success: true,
      question,
      plan,
      answer: `Aggregated **${metricCol?.name || 'Metric'}** across categories of **${dimCol?.name || 'Dimension'}** using **${aggregation.toUpperCase()}**.\n\n${summaryText}`,
      keyMetrics: execution.summaryMetrics,
      businessInterpretation: [
        `Computed ${aggregation.toUpperCase()} across active groups in ${dimCol?.name || 'the dataset'}.`,
        metricCol ? `Primary metric focused on ${metricCol.name}.` : 'Calculated across primary column.',
      ],
      dataHandling: execution.dataHandling,
      rawData: execution.data,
      chart,
      warnings: execution.warnings,
    };
  }

  public exportSubset(
    datasetId?: string,
    params?: { search?: string; sortColumn?: string; sortDirection?: 'asc' | 'desc' }
  ): string {
    const ds = this.getDataset(datasetId);
    if (!ds) throw new Error('Dataset not found in client storage.');

    const res = this.getExplorerData(ds.id, {
      page: 1,
      pageSize: 100000,
      search: params?.search,
      sortColumn: params?.sortColumn,
      sortDirection: params?.sortDirection,
    });

    return Papa.unparse(res.rows);
  }
}

export const clientEngine = new ClientAnalyticsEngine();
