import { profileDataset, parseCleanNumber, isNullOrEmpty } from '../server/profiler.js';
import { auditDataQuality, evaluateBusinessAssertions } from '../server/quality.js';
import { generateAutomatedInsights } from '../server/insights.js';
import { calculateCorrelationMatrix, getOutlierDrilldown, executeAnalysisPlan } from '../server/analyzer.js';
import { computeDashboardData } from '../server/dashboard.js';
import { generatePlotlyFigure } from '../server/charts.js';
import { performTransformation } from '../server/transformer.js';
import { performDataCleaning } from '../server/cleaner.js';
import { datasetStore } from '../server/dataset_store.js';
import {
  resolveColumn,
  resolveMetricFromQuery,
  resolveDimensionFromQuery,
  resolveAggregation,
  validateAndRepairPlan,
  applyFollowUpContext,
} from '../server/query_resolver.js';
import { parseIntentDeterministic } from '../server/ai_agent.js';
import {
  detectDatasetDomain,
  validateSuggestedQuestion,
  generateSchemaGroundedSuggestions,
  generateSuggestionsForDataset,
} from '../server/suggestion_generator.js';
import { executeSqlQuery } from '../server/sql_engine.js';

interface TestResult {
  suite: string;
  name: string;
  passed: boolean;
  error?: string;
}

const results: TestResult[] = [];

function recordTest(suite: string, nameOrFn: string | (() => void | Promise<void>), fn?: () => void | Promise<void>) {
  let name = '';
  let testFn: () => void | Promise<void>;

  if (typeof nameOrFn === 'function') {
    testFn = nameOrFn;
    name = suite;
  } else {
    name = nameOrFn;
    testFn = fn!;
  }

  try {
    const res = testFn();
    if (res instanceof Promise) {
      return res
        .then(() => {
          results.push({ suite, name, passed: true });
          console.log(`  ✓ [PASS] ${suite} > ${name}`);
        })
        .catch((err: any) => {
          results.push({ suite, name, passed: false, error: err.message });
          console.error(`  ✗ [FAIL] ${suite} > ${name}: ${err.message}`);
        });
    }
    results.push({ suite, name, passed: true });
    console.log(`  ✓ [PASS] ${suite} > ${name}`);
  } catch (err: any) {
    results.push({ suite, name, passed: false, error: err.message });
    console.error(`  ✗ [FAIL] ${suite} > ${name}: ${err.message}`);
  }
}

async function runAudit() {
  console.log('================================================================');
  console.log('  STARTING COMPREHENSIVE MULTI-DATASET AUDIT TEST SUITE');
  console.log('================================================================\n');

  // ============================================================================
  // DATASET 1: Standard B2B Sales (mixed dates, numerics, categories, missing values)
  // ============================================================================
  const session = 'audit-session-' + Date.now();
  const sample = datasetStore.initSample(session);
  const sampleProfile = sample.profile;
  const sampleRows = sample.rawRows;

  console.log(`[Dataset 1] Sample B2B Sales: ${sampleRows.length} rows, ${sampleProfile.columns.length} columns`);

  recordTest('Dataset 1 - Profiler', 'All columns profiled with statistics', () => {
    if (!sampleProfile.columns || sampleProfile.columns.length === 0) throw new Error('No columns profiled');
    const revenueCol = sampleProfile.columns.find(c => c.name === 'Revenue');
    if (!revenueCol || revenueCol.type !== 'numeric') throw new Error('Revenue column missing or not numeric');
    if (revenueCol.stats?.mean == null || isNaN(revenueCol.stats.mean)) throw new Error('Mean is null or NaN');
    if (revenueCol.stats?.min == null || revenueCol.stats?.max == null) throw new Error('Min or Max is null');
  });

  recordTest('Dataset 1 - Quality Audit', 'Calculates completeness, quality score, and audit issues', () => {
    const q = auditDataQuality(sampleRows, sampleProfile);
    if (q.overallScore == null || isNaN(q.overallScore) || q.overallScore < 0 || q.overallScore > 100) {
      throw new Error('Overall score invalid: ' + q.overallScore);
    }
    if (!Array.isArray(q.issues)) throw new Error('Quality issues array missing');
  });

  recordTest('Dataset 1 - Insights', 'Generates automated insights without NaN', () => {
    const ins = generateAutomatedInsights(sampleRows, sampleProfile);
    if (!Array.isArray(ins) || ins.length === 0) throw new Error('No insights generated');
  });

  recordTest('Dataset 1 - Correlations', 'Calculates correlation matrix', () => {
    const corr = calculateCorrelationMatrix(sampleRows, sampleProfile);
    if (!corr.columns || corr.columns.length === 0) throw new Error('Correlation columns missing');
    if (!corr.matrix || corr.matrix.length !== corr.columns.length) throw new Error('Correlation matrix dimension mismatch');
    for (let i = 0; i < corr.matrix.length; i++) {
      if (Math.abs(corr.matrix[i][i] - 1.0) > 0.001) throw new Error(`Self-correlation not 1.0 at index ${i}`);
    }
  });

  recordTest('Dataset 1 - Outliers', 'Outlier drilldown on Revenue', () => {
    const drill = getOutlierDrilldown(sampleRows, sampleProfile, 'Revenue');
    if (!drill || drill.totalOutliers == null || isNaN(drill.totalOutliers)) throw new Error('Outlier count invalid');
  });

  recordTest('Dataset 1 - Dashboard Engine', 'Returns executive metrics, comboChart, treemap, pie, and rank charts', () => {
    const dash = computeDashboardData(sampleRows, sampleProfile, {
      dimension: 'Region',
      metric: 'Revenue',
      secondaryMetric: 'Profit',
      timeCol: 'Date',
      timeGrain: 'monthly',
    });
    if (!dash.metrics) throw new Error('Dashboard metrics summary missing');
    if (!dash.metrics.primaryMetric || !dash.metrics.primaryTotalFormatted) throw new Error('Primary metric summary missing');
    if (!dash.comboChart || !dash.comboChart.data) throw new Error('Combo chart missing');
    if (!dash.treemapChart || !dash.treemapChart.data) throw new Error('Treemap chart missing');
    if (!dash.pieChart || !dash.pieChart.data) throw new Error('Pie chart missing');
    if (!dash.rankChart || !dash.rankChart.data) throw new Error('Rank chart missing');
  });

  // ============================================================================
  // DATASET 2: All-Numeric Dataset (No categorical, no text, no dates)
  // ============================================================================
  console.log('\n[Dataset 2] All-Numeric Edge Case (5 numeric columns, 100 rows, 0 text, 0 date)');
  const allNumericRows: Record<string, any>[] = [];
  for (let i = 0; i < 100; i++) {
    allNumericRows.push({
      metricA: Math.sin(i / 10) * 100 + 150,
      metricB: Math.cos(i / 10) * 50 + 75,
      metricC: i * 2.5,
      metricD: 42, // Constant column: variance = 0!
      metricE: i % 10 === 0 ? null : i * i, // Null values included
    });
  }
  const numericProfile = profileDataset(allNumericRows, 'all-numeric-test', 'all_numeric.csv', 5000);

  recordTest('Dataset 2 - Profiler', 'Zero-variance and null numeric handling', () => {
    const constCol = numericProfile.columns.find(c => c.name === 'metricD');
    if (!constCol || constCol.stats?.stdDev !== 0) throw new Error('Constant column stdDev should be 0');
    const nullCol = numericProfile.columns.find(c => c.name === 'metricE');
    if (!nullCol || nullCol.nullCount !== 10) throw new Error(`Null count mismatch: expected 10, got ${nullCol?.nullCount}`);
  });

  recordTest('Dataset 2 - Correlations', 'Handles zero-variance column without NaN', () => {
    const corr = calculateCorrelationMatrix(allNumericRows, numericProfile);
    for (let r = 0; r < corr.matrix.length; r++) {
      for (let c = 0; c < corr.matrix[r].length; c++) {
        if (isNaN(corr.matrix[r][c])) {
          throw new Error(`Correlation matrix contains NaN at [${corr.columns[r]}, ${corr.columns[c]}]`);
        }
      }
    }
  });

  recordTest('Dataset 2 - Dashboard', 'Dashboard gracefully handles 0 categorical columns', () => {
    const dash = computeDashboardData(allNumericRows, numericProfile, {
      dimension: 'metricA',
      metric: 'metricB',
      secondaryMetric: 'metricC',
    });
    if (!dash.metrics) throw new Error('Metrics missing');
    if (!dash.comboChart) throw new Error('Combo chart missing');
  });

  // ============================================================================
  // DATASET 3: All-Text Dataset (No numeric, no date)
  // ============================================================================
  console.log('\n[Dataset 3] All-Text Edge Case (4 categorical columns, 80 rows, 0 numeric)');
  const allTextRows: Record<string, any>[] = [];
  const categories = ['Finance', 'Healthcare', 'Retail', 'Tech', 'Energy'];
  const tiers = ['Tier 1', 'Tier 2', 'Tier 3'];
  const statuses = ['Active', 'Pending', 'Closed'];
  for (let i = 0; i < 80; i++) {
    allTextRows.push({
      Industry: categories[i % categories.length],
      Tier: tiers[i % tiers.length],
      Status: statuses[i % statuses.length],
      Country: i % 2 === 0 ? 'USA' : 'Germany',
    });
  }
  const textProfile = profileDataset(allTextRows, 'all-text-test', 'all_text.csv', 3000);

  recordTest('Dataset 3 - Profiler', 'Categorical frequency and cardinality', () => {
    const indCol = textProfile.columns.find(c => c.name === 'Industry');
    if (!indCol || indCol.type !== 'categorical') throw new Error('Industry should be categorical');
    if (!indCol.topCategories || indCol.topCategories.length !== 5) throw new Error('Expected 5 top categories');
  });

  recordTest('Dataset 3 - Correlations', 'Returns empty matrix gracefully when no numeric columns exist', () => {
    const corr = calculateCorrelationMatrix(allTextRows, textProfile);
    if (!corr || !Array.isArray(corr.columns)) throw new Error('Correlation response invalid');
  });

  recordTest('Dataset 3 - Dashboard', 'Dashboard gracefully handles 0 numeric columns without crashing', () => {
    const dash = computeDashboardData(allTextRows, textProfile, {
      dimension: 'Industry',
    });
    if (!dash.metrics) throw new Error('Metrics missing');
    if (dash.activeRowsCount !== 80) throw new Error('Active rows count mismatch');
  });

  // ============================================================================
  // DATASET 4: Messy Data (String numbers, currencies, percentages, extreme outliers, duplicates)
  // ============================================================================
  console.log('\n[Dataset 4] Messy / Dirty Data Edge Case (50 rows with messy formatting)');
  const messyRows: Record<string, any>[] = [
    { Id: '1', Amount: '$1,250.00', Rate: '15.5%', Category: '  Hardware  ', Status: 'OK', RawDate: '2024-01-15' },
    { Id: '2', Amount: '($500.00)', Rate: '10.0%', Category: 'Hardware', Status: 'OK', RawDate: '2024-01-16' },
    { Id: '3', Amount: '2,500', Rate: '0.25', Category: 'Software', Status: 'N/A', RawDate: 'bad-date' },
    { Id: '4', Amount: '  3400.50  ', Rate: '5%', Category: 'Software', Status: '', RawDate: '2024-02-01' },
    { Id: '5', Amount: null, Rate: null, Category: null, Status: null, RawDate: null },
    { Id: '6', Amount: '1e6', Rate: '50%', Category: 'Cloud', Status: 'PENDING', RawDate: '2024-02-10' },
    { Id: '7', Amount: 'INVALID', Rate: 'N/A', Category: 'Cloud', Status: 'ERROR', RawDate: '2024-02-15' },
    { Id: '1', Amount: '$1,250.00', Rate: '15.5%', Category: '  Hardware  ', Status: 'OK', RawDate: '2024-01-15' }, // Duplicate row!
  ];
  for (let i = 8; i <= 50; i++) {
    messyRows.push({
      Id: String(i),
      Amount: `$${(i * 100).toLocaleString()}`,
      Rate: `${(i * 0.5).toFixed(1)}%`,
      Category: i % 2 === 0 ? 'Hardware' : 'Software',
      Status: 'OK',
      RawDate: `2024-03-${String((i % 28) + 1).padStart(2, '0')}`,
    });
  }
  const messyProfile = profileDataset(messyRows, 'messy-test', 'messy.csv', 4000);

  recordTest('Dataset 4 - Profiler & Number Parsing', 'Parses messy currencies, percentages, negative brackets', () => {
    const val1 = parseCleanNumber('$1,250.00');
    if (!val1.isNum || val1.value !== 1250) throw new Error('Expected 1250, got ' + JSON.stringify(val1));
    const val2 = parseCleanNumber('($500.00)');
    if (!val2.isNum || val2.value !== -500) throw new Error('Expected -500 for bracketed, got ' + JSON.stringify(val2));
    const val3 = parseCleanNumber('15.5%');
    if (!val3.isNum || val3.value !== 15.5) throw new Error('Expected 15.5 for percent, got ' + JSON.stringify(val3));
    const val4 = parseCleanNumber('INVALID');
    if (val4.isNum) throw new Error('Expected not a number for INVALID, got ' + JSON.stringify(val4));
  });

  recordTest('Dataset 4 - Quality Audit', 'Detects duplicate rows, nulls, and formatting issues', () => {
    const q = auditDataQuality(messyRows, messyProfile);
    if (q.duplicateRowsCount < 1) throw new Error('Failed to detect duplicate row');
    if (!q.issues.some(iss => iss.type === 'missing')) throw new Error('Failed to identify missing values');
  });

  recordTest('Dataset 4 - Cleaner', 'Trims strings and removes duplicates', () => {
    const deduped = performDataCleaning(messyRows, messyProfile.columns, {
      action: 'deduplicate',
    });
    if (deduped.cleanedRows.length !== messyRows.length - 1) {
      throw new Error(`Expected ${messyRows.length - 1} rows after dedup, got ${deduped.cleanedRows.length}`);
    }

    const trimmed = performDataCleaning(messyRows, messyProfile.columns, {
      action: 'trim_strings',
      column: 'Category',
    });
    const firstRowCat = trimmed.cleanedRows[0]['Category'];
    if (firstRowCat !== 'Hardware') {
      throw new Error(`Expected trimmed 'Hardware', got '${firstRowCat}'`);
    }
  });

  // ============================================================================
  // DATASET 5: Tiny Minimal (2 rows, 2 columns)
  // ============================================================================
  console.log('\n[Dataset 5] Minimal Boundary (2 rows, 2 columns)');
  const tinyRows = [
    { A: 10, B: 'Alpha' },
    { A: 20, B: 'Beta' },
  ];
  const tinyProfile = profileDataset(tinyRows, 'tiny-test', 'tiny.csv', 100);

  recordTest('Dataset 5 - Profiler & Stats', 'Calculates stats without division by zero on tiny datasets', () => {
    const colA = tinyProfile.columns.find(c => c.name === 'A');
    if (!colA || colA.stats?.mean !== 15) throw new Error('Expected mean 15');
    if (colA.stats?.min !== 10 || colA.stats?.max !== 20) throw new Error('Expected min 10, max 20');
  });

  recordTest('Dataset 5 - Dashboard & Charts', 'Generates charts on 2-row dataset without crash', () => {
    const dash = computeDashboardData(tinyRows, tinyProfile, {
      dimension: 'B',
      metric: 'A',
    });
    if (!dash.kpiCards || dash.kpiCards.length === 0) throw new Error('KPI cards missing');
  });

  // ============================================================================
  // DATASET 6: Hierarchical Multi-Level Visualizations
  // ============================================================================
  console.log('\n[Dataset 6] Hierarchical Multi-Level Visualizations');
  const hierRows: Record<string, any>[] = [
    { Region: 'North America', Country: 'USA', City: 'New York', Revenue: 50000 },
    { Region: 'North America', Country: 'USA', City: 'San Francisco', Revenue: 65000 },
    { Region: 'North America', Country: 'Canada', City: 'Toronto', Revenue: 30000 },
    { Region: 'Europe', Country: 'UK', City: 'London', Revenue: 45000 },
    { Region: 'Europe', Country: 'Germany', City: 'Berlin', Revenue: 40000 },
    { Region: 'Europe', Country: 'France', City: 'Paris', Revenue: 38000 },
    { Region: 'Asia', Country: 'Japan', City: 'Tokyo', Revenue: 70000 },
    { Region: 'Asia', Country: 'Singapore', City: 'Singapore', Revenue: 55000 },
  ];
  const hierProfile = profileDataset(hierRows, 'hier-test', 'hier.csv', 1000);

  recordTest('Dataset 6 - Treemap Execution & Chart', () => {
    const plan = {
      operation: 'group_aggregate' as const,
      metric: 'Revenue',
      group_by: ['Region', 'Country'],
      aggregation: 'sum' as const,
    };
    const exec = executeAnalysisPlan(hierRows, hierProfile, plan);
    if (!exec.success) throw new Error('Hierarchical plan execution failed: ' + exec.error?.message);
    const fig = generatePlotlyFigure('treemap', exec.data, 'Treemap of Revenue');
    if (!fig || !fig.data || fig.data.length === 0) throw new Error('Treemap figure invalid');
    if (fig.data[0].type !== 'treemap') throw new Error('Treemap trace type is not treemap');
  });

  recordTest('Dataset 6 - Sunburst Execution & Chart', () => {
    const plan = {
      operation: 'group_aggregate' as const,
      metric: 'Revenue',
      group_by: ['Region', 'Country'],
      aggregation: 'sum' as const,
    };
    const exec = executeAnalysisPlan(hierRows, hierProfile, plan);
    if (!exec.success) throw new Error('Hierarchical plan execution failed: ' + exec.error?.message);
    const fig = generatePlotlyFigure('sunburst', exec.data, 'Sunburst of Revenue');
    if (!fig || !fig.data || fig.data.length === 0) throw new Error('Sunburst figure invalid');
    if (fig.data[0].type !== 'sunburst') throw new Error('Sunburst trace type is not sunburst');
  });

  // ============================================================================
  // AUDIT: ALL VISUAL STUDIO CHART TYPES
  // ============================================================================
  console.log('\n[Visual Studio Charts Audit] Testing all 10 chart generator types with execution plans');
  const chartTypes: any[] = [
    'bar',
    'line',
    'scatter',
    'histogram',
    'box',
    'pie',
    'heatmap',
    'combo',
    'treemap',
    'sunburst',
  ];

  for (const cType of chartTypes) {
    recordTest('Charts Engine', `Chart type '${cType}' generates without error`, () => {
      let dataPayload: any;
      if (cType === 'heatmap') {
        dataPayload = calculateCorrelationMatrix(sampleRows, sampleProfile);
      } else if (cType === 'combo') {
        dataPayload = {
          groupColumn: 'Region',
          primaryMetric: 'Revenue',
          secondaryMetric: 'Profit',
          items: [
            { category: 'North America', primaryValue: 1000, secondaryValue: 200 },
            { category: 'Europe', primaryValue: 800, secondaryValue: 150 },
          ],
        };
      } else if (cType === 'scatter') {
        const plan = {
          operation: 'correlation' as const,
          metric: 'Revenue',
          secondary_metric: 'Profit',
        };
        const exec = executeAnalysisPlan(sampleRows, sampleProfile, plan);
        dataPayload = exec.data;
      } else if (cType === 'histogram' || cType === 'box') {
        const plan = {
          operation: 'distribution' as const,
          metric: 'Revenue',
        };
        const exec = executeAnalysisPlan(sampleRows, sampleProfile, plan);
        dataPayload = exec.data;
      } else {
        const plan = {
          operation: 'group_aggregate' as const,
          metric: 'Revenue',
          group_by: ['Region'],
          aggregation: 'sum' as const,
        };
        const exec = executeAnalysisPlan(sampleRows, sampleProfile, plan);
        dataPayload = exec.data;
      }

      const fig = generatePlotlyFigure(cType, dataPayload, `Test Chart ${cType}`);
      if (!fig || !fig.data || !Array.isArray(fig.data) || fig.data.length === 0) {
        throw new Error(`Chart type ${cType} produced empty or invalid figure`);
      }
    });
  }

  // ============================================================================
  // AUDIT: FEATURE ENGINEERING / TRANSFORMATIONS
  // ============================================================================
  console.log('\n[Transformations Audit] Testing math formulas, type casting, text transforms, date extractions');

  recordTest('Transform - Formula', 'Calculated column Profit_Margin = Profit / Revenue * 100', () => {
    const res = performTransformation(sampleRows, sampleProfile.columns, {
      type: 'formula',
      targetColumn: 'Profit_Margin',
      formula: 'Profit / Revenue * 100',
    });
    if (!res.transformedRows || res.transformedRows.length !== sampleRows.length) {
      throw new Error('Transformed rows count mismatch');
    }
    const sampleVal = res.transformedRows[0]['Profit_Margin'];
    if (sampleVal == null || isNaN(sampleVal)) throw new Error('Formula produced null or NaN: ' + sampleVal);
  });

  recordTest('Transform - Safe Math & Division by Zero', 'Formula handles division by zero safely', () => {
    const testRows = [{ A: 10, B: 0 }, { A: 20, B: 5 }];
    const testCols = profileDataset(testRows, 'div0-test', 'div0.csv', 100).columns;
    const res = performTransformation(testRows, testCols, {
      type: 'formula',
      targetColumn: 'Result',
      formula: 'A / B',
    });
    const val0 = res.transformedRows[0]['Result'];
    if (val0 === Infinity || isNaN(val0)) {
      throw new Error('Division by zero should be handled cleanly, got: ' + val0);
    }
  });

  recordTest('Transform - Split Column', 'Splits email or full name by delimiter', () => {
    const nameRows = [{ FullName: 'Alice Johnson' }, { FullName: 'Bob Smith' }];
    const nameCols = profileDataset(nameRows, 'name-test', 'name.csv', 100).columns;
    const res = performTransformation(nameRows, nameCols, {
      type: 'split_column',
      sourceColumn: 'FullName',
      targetColumn: 'FirstName',
      delimiter: ' ',
    });
    const created = res.transformedRows[0]['FirstName_1'] || res.transformedRows[0]['FirstName'];
    if (created !== 'Alice') throw new Error('Split did not extract Alice, got: ' + created);
  });

  recordTest('Transform - Find and Replace', 'Replaces substrings across rows', () => {
    const res = performTransformation(sampleRows, sampleProfile.columns, {
      type: 'find_replace',
      sourceColumn: 'Region',
      targetColumn: 'Region',
      findValue: 'North America',
      replaceValue: 'NA',
    });
    const hasReplaced = res.transformedRows.some(r => r['Region'] === 'NA');
    if (!hasReplaced) throw new Error('Failed to find and replace North America with NA');
  });

  recordTest('Transform - Date Extraction', 'Extracts year and month from datetime column', () => {
    const res = performTransformation(sampleRows, sampleProfile.columns, {
      type: 'date_extract',
      sourceColumn: 'Date',
      targetColumn: 'Order_Year',
      datePart: 'year',
    });
    const yearVal = res.transformedRows[0]['Order_Year'];
    if (!yearVal || isNaN(Number(yearVal))) throw new Error('Invalid extracted year: ' + yearVal);
  });

  // ============================================================================
  // AUDIT: BUSINESS ASSERTIONS ENGINE
  // ============================================================================
  console.log('\n[Business Assertions Audit] Testing custom quality validation rules');

  recordTest('Assertions - Range & Null Check', 'Evaluates min/max and not-null constraints', () => {
    const assertions = [
      {
        id: 'rule-1',
        column: 'Revenue',
        rule: 'min' as const,
        threshold: 0,
        severity: 'critical' as const,
        description: 'Revenue must be non-negative',
      },
      {
        id: 'rule-2',
        column: 'Customer_Segment',
        rule: 'not_null' as const,
        severity: 'warning' as const,
        description: 'Customer segment must not be null',
      },
    ];
    const report = evaluateBusinessAssertions(sampleRows, assertions);
    if (!report || !Array.isArray(report.results) || report.results.length !== 2) {
      throw new Error('Assertions evaluation report incomplete');
    }
    if (report.overallStatus !== 'pass' && report.overallStatus !== 'warn' && report.overallStatus !== 'fail') {
      throw new Error('Invalid overall status: ' + report.overallStatus);
    }
  });

  // ============================================================================
  // AUDIT: HTTP API ENDPOINTS AGAINST LIVE DEV SERVER (PORT 3000)
  // ============================================================================
  console.log('\n[HTTP Endpoints Audit] Testing live REST endpoints against running server');

  await recordTest('API - GET /api/health', 'Health check returns ok', async () => {
    const res = await fetch('http://localhost:3000/api/health');
    const json = await res.json();
    if (json.status !== 'ok') throw new Error('Health check status not ok: ' + JSON.stringify(json));
  });

  await recordTest('API - POST /api/sample', 'Initializes sample dataset', async () => {
    const res = await fetch('http://localhost:3000/api/sample', { method: 'POST' });
    const json = await res.json();
    if (!json.success || !json.data?.profile?.id) throw new Error('Failed to init sample: ' + JSON.stringify(json));
  });

  await recordTest('API - GET /api/datasets', 'Lists available datasets for session', async () => {
    const res = await fetch('http://localhost:3000/api/datasets');
    const json = await res.json();
    if (!json.success || !Array.isArray(json.data)) throw new Error('Datasets list invalid: ' + JSON.stringify(json));
  });

  await recordTest('API - GET /api/dashboard/:id', 'Computes dashboard metrics & charts', async () => {
    const sampleId = 'sample-b2b-sales-sion';
    const res = await fetch(`http://localhost:3000/api/dashboard/${sampleId}`);
    const json = await res.json();
    if (!json.success || !json.data?.metrics?.primaryTotalFormatted) {
      throw new Error('Dashboard API response missing metrics: ' + JSON.stringify(json));
    }
    if (!json.data?.comboChart || !json.data?.treemapChart) {
      throw new Error('Dashboard API missing combo or treemap charts');
    }
  });

  await recordTest('API - POST /api/chart/:id (combo)', 'Generates dual-axis combo chart via API', async () => {
    const sampleId = 'sample-b2b-sales-sion';
    const res = await fetch(`http://localhost:3000/api/chart/${sampleId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'combo',
        xAxis: 'Region',
        yAxis: 'Revenue',
        secondaryYAxis: 'Profit',
      }),
    });
    const json = await res.json();
    if (!json.success || !json.chart || !json.chart.data || json.chart.data.length !== 2) {
      throw new Error('Combo chart API failed: ' + JSON.stringify(json));
    }
  });

  await recordTest('API - POST /api/chart/:id (treemap)', 'Generates hierarchical treemap via API', async () => {
    const sampleId = 'sample-b2b-sales-sion';
    const res = await fetch(`http://localhost:3000/api/chart/${sampleId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'treemap',
        xAxis: 'Region',
        yAxis: 'Revenue',
      }),
    });
    const json = await res.json();
    if (!json.success || !json.chart || !json.chart.data || json.chart.data[0].type !== 'treemap') {
      throw new Error('Treemap chart API failed: ' + JSON.stringify(json));
    }
  });

  await recordTest('API - POST /api/transform/:id', 'Calculates formula column via API', async () => {
    const sampleId = 'sample-b2b-sales-sion';
    const res = await fetch(`http://localhost:3000/api/transform/${sampleId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'formula',
        targetColumn: 'Rev_Per_Unit',
        formula: 'Revenue / Quantity',
      }),
    });
    const json = await res.json();
    if (!json.success || !json.data?.profile) {
      throw new Error('Transform API failed: ' + JSON.stringify(json));
    }
  });

  await recordTest('API - GET /api/data-dictionary/:id', 'Generates and downloads data dictionary', async () => {
    const sampleId = 'sample-b2b-sales-sion';
    const res = await fetch(`http://localhost:3000/api/data-dictionary/${sampleId}`);
    const json = await res.json();
    if (!json.success || !json.data?.markdown || !Array.isArray(json.data?.columns)) {
      throw new Error('Data dictionary API failed: ' + JSON.stringify(json));
    }
  });

  await recordTest('API - POST /api/generate-code', 'Generates reproducible Python & SQL pipeline code', async () => {
    const res = await fetch('http://localhost:3000/api/generate-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filename: 'sales_test.csv',
        metric: 'Revenue',
        xAxis: 'Region',
        aggregation: 'sum',
        limit: 10,
      }),
    });
    const json = await res.json();
    if (!json.success || !json.data?.python || !json.data?.sql) {
      throw new Error('Generate code failed: ' + JSON.stringify(json));
    }
    if (!json.data.python.includes('import pandas as pd')) {
      throw new Error('Python code does not import pandas');
    }
    if (!json.data.sql.includes('SELECT')) {
      throw new Error('SQL code does not include SELECT');
    }
  });

  await recordTest('API - POST /api/sql/:id', 'Executes arbitrary SQL query against active dataset', async () => {
    const sampleId = 'sample-b2b-sales-sion';
    const query = `SELECT "Region", COUNT(*) as total_count, ROUND(SUM("Revenue"), 2) as total_rev FROM dataset GROUP BY 1 ORDER BY 3 DESC LIMIT 5;`;
    const res = await fetch(`http://localhost:3000/api/sql/${sampleId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    });
    const json = await res.json();
    if (!json.success || !Array.isArray(json.rows) || json.rows.length === 0) {
      throw new Error('SQL execution API failed: ' + JSON.stringify(json));
    }
    if (!json.columns.includes('Region') || !json.columns.includes('total_rev')) {
      throw new Error('SQL columns missing in output: ' + JSON.stringify(json.columns));
    }
    if (typeof json.executionTimeMs !== 'number') {
      throw new Error('Missing executionTimeMs in SQL output');
    }
  });

  // ============================================================================
  // SQL IN-MEMORY EXECUTION ENGINE AUDIT
  // ============================================================================
  console.log('\n[SQL Engine Audit] Testing in-memory SQL execution, parsing, filtering, aggregation, and sorting');

  recordTest('SQL Engine - Basic SELECT & WHERE Filter', 'Filters rows with comparison operators and returns correct columns', () => {
    const sql = `SELECT "Region", "Revenue" FROM dataset WHERE "Revenue" > 5000 LIMIT 10;`;
    const res = executeSqlQuery(sampleRows, sql);
    if (!res.success) throw new Error('Query failed: ' + res.error);
    if (res.columns.length !== 2 || res.columns[0] !== 'Region' || res.columns[1] !== 'Revenue') {
      throw new Error('Columns mismatch: ' + JSON.stringify(res.columns));
    }
    for (const r of res.rows) {
      if (Number(r.Revenue) <= 5000) {
        throw new Error('Row violated WHERE condition: ' + JSON.stringify(r));
      }
    }
  });

  recordTest('SQL Engine - Aggregation with GROUP BY', 'Calculates SUM, AVG, and COUNT grouped by dimension', () => {
    const sql = `SELECT "Region", COUNT(*) as cnt, SUM("Revenue") as total_rev, AVG("Profit") as avg_prof FROM dataset GROUP BY 1 ORDER BY total_rev DESC;`;
    const res = executeSqlQuery(sampleRows, sql);
    if (!res.success) throw new Error('Query failed: ' + res.error);
    if (res.rows.length === 0) throw new Error('Expected grouped rows, got 0');
    if (!res.columns.includes('total_rev') || !res.columns.includes('cnt')) {
      throw new Error('Missing expected aggregated columns: ' + JSON.stringify(res.columns));
    }
    // Verify descending order
    for (let i = 0; i < res.rows.length - 1; i++) {
      if (res.rows[i].total_rev < res.rows[i + 1].total_rev) {
        throw new Error('Rows not sorted in DESC order');
      }
    }
  });

  recordTest('SQL Engine - Dirty Currency & Nulls Tolerance', 'Parses currency strings and handles IS NULL gracefully in SQL', () => {
    const dirtyData = [
      { Category: 'Hardware', Cost: '$1,250.00', Notes: 'Complete' },
      { Category: 'Software', Cost: '$4,500.50', Notes: null },
      { Category: 'Cloud', Cost: '€800', Notes: 'Active' },
      { Category: 'Support', Cost: null, Notes: 'Pending' },
    ];
    const sql = `SELECT "Category", SUM("Cost") as sum_cost FROM dataset WHERE "Cost" IS NOT NULL GROUP BY 1 ORDER BY sum_cost DESC;`;
    const res = executeSqlQuery(dirtyData, sql);
    if (!res.success) throw new Error('Query failed: ' + res.error);
    if (res.rows.length !== 3) throw new Error(`Expected 3 rows after IS NOT NULL filter, got ${res.rows.length}`);
    const softRow = res.rows.find(r => r.Category === 'Software');
    if (!softRow || Math.abs(softRow.sum_cost - 4500.50) > 0.01) {
      throw new Error(`Expected Software sum_cost to be 4500.50, got ${softRow?.sum_cost}`);
    }
  });

  // ============================================================================
  // SYNTHETIC MULTI-DOMAIN PROFILES FOR RESOLUTION & SUGGESTION AUDITS
  // ============================================================================
  const votingProfile: any = {
    id: 'voting-dataset-test',
    filename: 'election_sentiment_2024.csv',
    rowCount: 2400,
    columnCount: 6,
    columns: [
      {
        name: 'State',
        type: 'categorical',
        totalCount: 2400,
        nullCount: 0,
        nullPercentage: 0,
        uniqueCount: 50,
        uniquePercentage: 2.08,
        sampleValues: ['California', 'Texas', 'Florida', 'Pennsylvania'],
        isIdentifier: false,
        topCategories: [
          { category: 'California', count: 200, percentage: 8.3 },
          { category: 'Texas', count: 180, percentage: 7.5 },
        ],
      },
      {
        name: 'Candidate',
        type: 'categorical',
        totalCount: 2400,
        nullCount: 0,
        nullPercentage: 0,
        uniqueCount: 4,
        uniquePercentage: 0.16,
        sampleValues: ['Candidate A', 'Candidate B', 'Candidate C'],
        isIdentifier: false,
      },
      {
        name: 'Sentiment',
        type: 'categorical',
        totalCount: 2400,
        nullCount: 0,
        nullPercentage: 0,
        uniqueCount: 3,
        uniquePercentage: 0.12,
        sampleValues: ['Positive', 'Negative', 'Neutral'],
        isIdentifier: false,
        topCategories: [
          { category: 'Positive', count: 1100, percentage: 45.8 },
          { category: 'Negative', count: 800, percentage: 33.3 },
          { category: 'Neutral', count: 500, percentage: 20.8 },
        ],
      },
      {
        name: 'Sentiment Score',
        type: 'numeric',
        totalCount: 2400,
        nullCount: 0,
        nullPercentage: 0,
        uniqueCount: 180,
        uniquePercentage: 7.5,
        sampleValues: [0.75, -0.42, 0.12, 0.88],
        isIdentifier: false,
        min: -1,
        max: 1,
        mean: 0.22,
      },
      {
        name: 'Date',
        type: 'datetime',
        totalCount: 2400,
        nullCount: 0,
        nullPercentage: 0,
        uniqueCount: 90,
        uniquePercentage: 3.75,
        sampleValues: ['2024-01-15', '2024-02-20'],
        isIdentifier: false,
      },
      {
        name: 'Response Count',
        type: 'numeric',
        totalCount: 2400,
        nullCount: 0,
        nullPercentage: 0,
        uniqueCount: 400,
        uniquePercentage: 16.6,
        sampleValues: [150, 420, 85],
        isIdentifier: false,
        min: 10,
        max: 1000,
        mean: 260,
      },
    ],
  };

  const hrProfile: any = {
    id: 'hr-workforce-test',
    filename: 'workforce_attrition.csv',
    rowCount: 1200,
    columnCount: 4,
    columns: [
      {
        name: 'Department',
        type: 'categorical',
        totalCount: 1200,
        nullCount: 0,
        nullPercentage: 0,
        uniqueCount: 8,
        uniquePercentage: 0.6,
        sampleValues: ['Engineering', 'Sales', 'Marketing', 'Product'],
        isIdentifier: false,
      },
      {
        name: 'Salary',
        type: 'numeric',
        totalCount: 1200,
        nullCount: 0,
        nullPercentage: 0,
        uniqueCount: 850,
        uniquePercentage: 70.8,
        sampleValues: [85000, 120000, 95000],
        isIdentifier: false,
        min: 45000,
        max: 220000,
        mean: 105000,
      },
      {
        name: 'Attrition',
        type: 'categorical',
        totalCount: 1200,
        nullCount: 0,
        nullPercentage: 0,
        uniqueCount: 2,
        uniquePercentage: 0.16,
        sampleValues: ['Yes', 'No'],
        isIdentifier: false,
      },
      {
        name: 'Tenure',
        type: 'numeric',
        totalCount: 1200,
        nullCount: 0,
        nullPercentage: 0,
        uniqueCount: 15,
        uniquePercentage: 1.25,
        sampleValues: [2.5, 5, 1, 8.2],
        isIdentifier: false,
        min: 0.5,
        max: 20,
        mean: 4.8,
      },
    ],
  };

  const minimalProfile: any = {
    id: 'minimal-test',
    filename: 'simple_counts.csv',
    rowCount: 50,
    columnCount: 2,
    columns: [
      {
        name: 'Category',
        type: 'categorical',
        totalCount: 50,
        nullCount: 0,
        nullPercentage: 0,
        uniqueCount: 5,
        uniquePercentage: 10,
        sampleValues: ['Alpha', 'Beta', 'Gamma'],
        isIdentifier: false,
      },
      {
        name: 'Value',
        type: 'numeric',
        totalCount: 50,
        nullCount: 0,
        nullPercentage: 0,
        uniqueCount: 45,
        uniquePercentage: 90,
        sampleValues: [10, 25, 40],
        isIdentifier: false,
        min: 5,
        max: 100,
        mean: 52,
      },
    ],
  };

  // ============================================================================
  // AI QUERY ENGINE REGRESSION TEST SUITE (Priority 6)
  // ============================================================================
  console.log('\n[AI Query Engine Audit] Testing deterministic query resolution, ambiguity prevention, follow-ups, and safe execution');

  recordTest('AI Query - Metric Synonyms', 'Maps semantic terms like sales, margin, volume to dataset columns', () => {
    const resSales = resolveMetricFromQuery('total sales', sampleProfile.columns);
    if (!resSales.column || resSales.column.name !== 'Revenue') {
      throw new Error(`Expected 'total sales' to map to 'Revenue', got '${resSales.column?.name}'`);
    }

    const resMargin = resolveMetricFromQuery('average margin', sampleProfile.columns);
    if (!resMargin.column || resMargin.column.name !== 'Profit') {
      throw new Error(`Expected 'average margin' to map to 'Profit', got '${resMargin.column?.name}'`);
    }

    const resQty = resolveMetricFromQuery('units sold count', sampleProfile.columns);
    if (!resQty.column || resQty.column.name !== 'Quantity') {
      throw new Error(`Expected 'units sold' to map to 'Quantity', got '${resQty.column?.name}'`);
    }

    const resCost = resolveMetricFromQuery('total expenses', sampleProfile.columns);
    if (!resCost.column || resCost.column.name !== 'Cost') {
      throw new Error(`Expected 'total expenses' to map to 'Cost', got '${resCost.column?.name}'`);
    }
  });

  recordTest('AI Query - Deterministic Intent Planning', 'Correctly plans group_aggregate, ranking, time_series, and correlation', () => {
    // 1. Group Aggregate
    const p1 = parseIntentDeterministic('What is total sales by region?', sampleProfile);
    if (p1.operation !== 'group_aggregate') throw new Error(`Expected group_aggregate, got ${p1.operation}`);
    if (p1.metric !== 'Revenue') throw new Error(`Expected Revenue metric, got ${p1.metric}`);
    if (!p1.group_by || !p1.group_by.includes('Region')) throw new Error(`Expected Region group, got ${p1.group_by}`);
    if (p1.aggregation !== 'sum') throw new Error(`Expected sum aggregation, got ${p1.aggregation}`);

    // 2. Ranking
    const p2 = parseIntentDeterministic('Top 5 products by profit', sampleProfile);
    if (p2.operation !== 'ranking') throw new Error(`Expected ranking, got ${p2.operation}`);
    if (p2.metric !== 'Profit') throw new Error(`Expected Profit metric, got ${p2.metric}`);
    if (p2.limit !== 5) throw new Error(`Expected limit 5, got ${p2.limit}`);

    // 3. Time Series
    const p3 = parseIntentDeterministic('Monthly sales trend', sampleProfile);
    if (p3.operation !== 'time_series') throw new Error(`Expected time_series, got ${p3.operation}`);
    if (p3.metric !== 'Revenue') throw new Error(`Expected Revenue metric, got ${p3.metric}`);
    if (p3.time_granularity !== 'monthly') throw new Error(`Expected monthly granularity, got ${p3.time_granularity}`);

    // 4. Correlation
    const p4 = parseIntentDeterministic('Correlation between revenue and cost', sampleProfile);
    if (p4.operation !== 'correlation') throw new Error(`Expected correlation, got ${p4.operation}`);
    if (p4.metric !== 'Revenue') throw new Error(`Expected Revenue primary metric, got ${p4.metric}`);
    if (p4.secondary_metric !== 'Cost') throw new Error(`Expected Cost secondary metric, got ${p4.secondary_metric}`);
  });

  recordTest('AI Query - Ambiguity Prevention', 'Never guesses arbitrary columns when metric is ambiguous or missing', () => {
    // Generic query without metric
    const pAmbiguous = parseIntentDeterministic('What is the total?', sampleProfile);
    if (pAmbiguous.operation !== 'clarification') {
      throw new Error(`Expected clarification for ambiguous query, but system guessed: ${pAmbiguous.operation} of ${pAmbiguous.metric}`);
    }

    // Breakdown without metric
    const pNoMetric = parseIntentDeterministic('Breakdown by region', sampleProfile);
    if (pNoMetric.operation !== 'clarification') {
      throw new Error(`Expected clarification for missing metric, but system guessed: ${pNoMetric.operation} of ${pNoMetric.metric}`);
    }

    // Completely nonexistent column
    const pUnknown = parseIntentDeterministic('Show total for nonexistent_metric_xyz', sampleProfile);
    if (pUnknown.operation !== 'clarification') {
      throw new Error(`Expected clarification for unknown metric, but system guessed: ${pUnknown.operation}`);
    }
  });

  recordTest('AI Query - Safe Failure Execution', 'Clarification and ambiguous plans halt safely with actionable error', () => {
    const clarificationPlan = {
      operation: 'clarification' as any,
      user_intent_summary: 'Which metric would you like to analyze: Revenue, Profit, Discount, Quantity?',
    };

    const res = executeAnalysisPlan(sampleRows, sampleProfile, clarificationPlan);
    if (res.success !== false) throw new Error('Clarification plan should return success: false');
    if (res.error?.code !== 'CLARIFICATION_REQUIRED') throw new Error(`Expected CLARIFICATION_REQUIRED code, got ${res.error?.code}`);
    if (!res.error?.suggestion) throw new Error('Expected actionable suggestion for clarification');
    if (res.dataHandling.validRowsAnalyzed !== 0) throw new Error('Clarification plan must analyze 0 rows');
  });

  recordTest('AI Query - Multi-Turn Context & Refinements', 'Applies follow-up context overrides correctly', () => {
    const initialPlan = {
      operation: 'group_aggregate' as const,
      metric: 'Revenue',
      group_by: ['Region'],
      aggregation: 'sum' as const,
      limit: 10,
    };

    // 1. Refine limit ("only the top 3")
    const dummy1 = { ...initialPlan };
    const refinedLimit = applyFollowUpContext('only the top 3', dummy1, initialPlan, sampleProfile);
    if (refinedLimit.limit !== 3) throw new Error(`Expected limit 3, got ${refinedLimit.limit}`);
    if (refinedLimit.metric !== 'Revenue') throw new Error(`Expected Revenue metric retained, got ${refinedLimit.metric}`);
    if (refinedLimit.group_by?.[0] !== 'Region') throw new Error(`Expected Region retained, got ${refinedLimit.group_by?.[0]}`);

    // 2. Switch metric ("now do profit")
    const dummy2 = { ...initialPlan };
    const refinedMetric = applyFollowUpContext('now do profit', dummy2, initialPlan, sampleProfile);
    if (refinedMetric.metric !== 'Profit') throw new Error(`Expected Profit metric, got ${refinedMetric.metric}`);
    if (refinedMetric.group_by?.[0] !== 'Region') throw new Error(`Expected Region retained, got ${refinedMetric.group_by?.[0]}`);

    // 3. Switch to time trend ("now monthly over time")
    const dummy3 = { ...initialPlan };
    const refinedTrend = applyFollowUpContext('now monthly trend over time', dummy3, initialPlan, sampleProfile);
    if (refinedTrend.operation !== 'time_series') throw new Error(`Expected time_series operation, got ${refinedTrend.operation}`);
    if (refinedTrend.time_granularity !== 'monthly') throw new Error(`Expected monthly granularity, got ${refinedTrend.time_granularity}`);
    if (refinedTrend.metric !== 'Revenue') throw new Error(`Expected Revenue retained, got ${refinedTrend.metric}`);
  });

  recordTest('AI Query - Plan Validation & Repair', 'Validates plan schema and prevents non-numeric aggregation', () => {
    // Lowercase metric repaired to exact casing
    const rawPlan1 = {
      operation: 'aggregate' as const,
      metric: 'revenue',
      aggregation: 'sum' as const,
    };
    const val1 = validateAndRepairPlan(rawPlan1, sampleProfile, 'what is revenue');
    if (!val1.valid) throw new Error('Expected valid repair for lowercase revenue');
    if (val1.repairedPlan.metric !== 'Revenue') throw new Error(`Expected exact casing 'Revenue', got '${val1.repairedPlan.metric}'`);

    // Non-numeric column sum rejected safely
    const rawPlan2 = {
      operation: 'aggregate' as const,
      metric: 'Region',
      aggregation: 'sum' as const,
    };
    const val2 = validateAndRepairPlan(rawPlan2, sampleProfile, 'sum of region');
    if (val2.valid) throw new Error('Expected invalid validation when summing categorical Region');
    if (val2.error?.code !== 'NON_NUMERIC_METRIC') throw new Error(`Expected NON_NUMERIC_METRIC, got ${val2.error?.code}`);
  });

  recordTest('AI Query - Deterministic Math Execution', 'Pure TypeScript deterministic calculation produces exact results', () => {
    const plan = {
      operation: 'group_aggregate' as const,
      metric: 'Revenue',
      group_by: ['Region'],
      aggregation: 'sum' as const,
      limit: 10,
    };

    const res = executeAnalysisPlan(sampleRows, sampleProfile, plan);
    if (!res.success) throw new Error('Analysis failed: ' + res.error?.message);
    if (!res.data || !Array.isArray(res.data.items) || res.data.items.length === 0) {
      throw new Error('Analysis produced empty items array');
    }
    if (!res.dataHandling.isDeterministic) throw new Error('Execution was not marked deterministic');
    if (res.dataHandling.validRowsAnalyzed <= 0) throw new Error('Valid rows analyzed must be > 0');

    // Verify every value is a real finite number
    for (const item of res.data.items) {
      if (typeof item.value !== 'number' || isNaN(item.value) || !isFinite(item.value)) {
        throw new Error(`Invalid non-finite number calculated for ${item.category}: ${item.value}`);
      }
    }
  });

  recordTest('AI Query - Domain-Aware Semantic Resolution', 'Respects dataset domain for ambiguous synonyms and dimensions', () => {
    // 1. In Sales domain, 'turnover' maps to Revenue
    const salesTurnover = resolveMetricFromQuery('total turnover', sampleProfile.columns, undefined, { domain: 'ecommerce_sales' });
    if (salesTurnover.metric !== 'Revenue') {
      throw new Error(`Expected 'turnover' in sales domain to resolve to 'Revenue', got '${salesTurnover.metric}'`);
    }

    // 2. In HR domain, 'turnover' does NOT resolve to Revenue
    const hrTurnover = resolveMetricFromQuery('turnover rate', hrProfile.columns, undefined, { domain: 'hr_workforce' });
    if (hrTurnover.metric === 'Revenue') {
      throw new Error(`'turnover' in HR workforce domain must not resolve to 'Revenue'`);
    }

    // 3. Dimension resolution using domain synonyms
    const dimSales = resolveDimensionFromQuery('breakdown by territory', sampleProfile.columns, { domain: 'ecommerce_sales' });
    if (!dimSales.column || dimSales.column.name !== 'Region') {
      throw new Error(`Expected 'by territory' to resolve to Region, got '${dimSales.column?.name}'`);
    }

    const dimHr = resolveDimensionFromQuery('analyze across department', hrProfile.columns, { domain: 'hr_workforce' });
    if (!dimHr.column || dimHr.column.name !== 'Department') {
      throw new Error(`Expected 'across department' to resolve to Department, got '${dimHr.column?.name}'`);
    }
  });

  recordTest('AI Query - Filter Schema Validation & Execution', 'Rejects non-existent filter columns and performs safe whitespace/casing normalization', () => {
    // 1. Non-existent filter column rejected safely
    const invalidFilterPlan = {
      operation: 'group_aggregate' as const,
      metric: 'Revenue',
      group_by: ['Region'],
      aggregation: 'sum' as const,
      filters: [
        { column: 'NonExistentColumnXYZ', operator: '==' as const, value: 'test' },
      ],
    };

    const resInvalid = executeAnalysisPlan(sampleRows, sampleProfile, invalidFilterPlan);
    if (resInvalid.success !== false) {
      throw new Error('Expected execution to fail on non-existent filter column');
    }
    if (resInvalid.error?.code !== 'INVALID_FILTER_COLUMN') {
      throw new Error(`Expected error code INVALID_FILTER_COLUMN, got ${resInvalid.error?.code}`);
    }

    // 2. Filter with whitespace trimming and case insensitivity
    const whitespaceFilterPlan = {
      operation: 'group_aggregate' as const,
      metric: 'Revenue',
      group_by: ['Region'],
      aggregation: 'sum' as const,
      filters: [
        { column: 'Region', operator: '==' as const, value: '  north america  ' },
      ],
    };

    const resFilter = executeAnalysisPlan(sampleRows, sampleProfile, whitespaceFilterPlan);
    if (!resFilter.success) {
      throw new Error('Filter with whitespace should succeed: ' + resFilter.error?.message);
    }
    if (!resFilter.data?.items || resFilter.data.items.length === 0) {
      throw new Error('Filter matching "  north america  " should have found North America records');
    }
    for (const item of resFilter.data.items) {
      if (item.category.toLowerCase() !== 'north america') {
        throw new Error(`Filtered aggregate returned non-North America category: ${item.category}`);
      }
    }

    // 3. Plan validation and repair for filter columns
    const rawFilterPlan = {
      operation: 'group_aggregate' as const,
      metric: 'Revenue',
      group_by: ['Region'],
      aggregation: 'sum' as const,
      filters: [
        { column: 'region', operator: '==' as const, value: 'Europe' }, // lowercase 'region'
      ],
    };
    const valFilter = validateAndRepairPlan(rawFilterPlan, sampleProfile, 'revenue in europe');
    if (!valFilter.valid) {
      throw new Error('Expected valid repair for lowercase filter column');
    }
    if (valFilter.repairedPlan.filters?.[0].column !== 'Region') {
      throw new Error(`Expected repaired filter column 'Region', got '${valFilter.repairedPlan.filters?.[0].column}'`);
    }
  });

  // ============================================================================
  // AUDIT: AI-GENERATED SUGGESTED QUESTIONS (REGRESSION & VALIDATION SUITE)
  // ============================================================================
  console.log('\n[Suggested Questions Audit] Testing dataset-grounded suggestions, domain inference, validation layer, and regression cases');

  recordTest('Suggestions - Voting Sentiment Regression', 'Must NOT generate Revenue/Profit/Sales/Product and MUST ground in State/Candidate/Sentiment', () => {
    const mapping = detectDatasetDomain(votingProfile);
    if (mapping.domain !== 'sentiment') {
      throw new Error(`Expected sentiment domain for voting sentiment dataset, got: ${mapping.domain}`);
    }

    const suggestions = generateSchemaGroundedSuggestions(votingProfile, { count: 5 });
    if (suggestions.length === 0) {
      throw new Error('Suggestions engine returned 0 suggestions');
    }

    for (const q of suggestions) {
      const qLower = q.toLowerCase();

      // Regression checks: MUST NOT contain business terms ungrounded in dataset
      if (/\brevenue\b/i.test(qLower)) throw new Error(`Ungrounded 'revenue' found in voting question: "${q}"`);
      if (/\bprofit\b/i.test(qLower)) throw new Error(`Ungrounded 'profit' found in voting question: "${q}"`);
      if (/\bmargin\b/i.test(qLower)) throw new Error(`Ungrounded 'margin' found in voting question: "${q}"`);
      if (/\bsales\b/i.test(qLower)) throw new Error(`Ungrounded 'sales' found in voting question: "${q}"`);
      if (/\bproduct\b/i.test(qLower)) throw new Error(`Ungrounded 'product' found in voting question: "${q}"`);
      if (/\bcustomer\b/i.test(qLower)) throw new Error(`Ungrounded 'customer' found in voting question: "${q}"`);

      // Must pass validation layer
      const val = validateSuggestedQuestion(q, votingProfile);
      if (!val.valid) {
        throw new Error(`Question "${q}" failed validation layer: ${val.reason}`);
      }
    }

    // Must reference actual columns
    const allText = suggestions.join(' ').toLowerCase();
    const referencesActualColumns =
      allText.includes('state') ||
      allText.includes('candidate') ||
      allText.includes('sentiment') ||
      allText.includes('sentiment score') ||
      allText.includes('response count');

    if (!referencesActualColumns) {
      throw new Error('Suggestions did not reference any actual columns from voting dataset');
    }
  });

  recordTest('Suggestions - E-commerce Sales Dataset', 'Revenue and Profit questions are valid and correctly generated', () => {
    const mapping = detectDatasetDomain(sampleProfile);
    if (mapping.domain !== 'ecommerce_sales') {
      throw new Error(`Expected ecommerce_sales domain for B2B dataset, got: ${mapping.domain}`);
    }

    const suggestions = generateSchemaGroundedSuggestions(sampleProfile, { count: 5 });
    if (suggestions.length === 0) throw new Error('Returned 0 suggestions');

    for (const q of suggestions) {
      const val = validateSuggestedQuestion(q, sampleProfile);
      if (!val.valid) {
        throw new Error(`Question "${q}" failed validation layer for sampleProfile: ${val.reason}`);
      }
    }
  });

  recordTest('Suggestions - HR Workforce Dataset', 'Revenue questions must NOT appear; Salary/Department/Attrition used', () => {
    const mapping = detectDatasetDomain(hrProfile);
    if (mapping.domain !== 'hr_workforce') {
      throw new Error(`Expected hr_workforce domain, got: ${mapping.domain}`);
    }

    const suggestions = generateSchemaGroundedSuggestions(hrProfile, { count: 5 });
    for (const q of suggestions) {
      const qLower = q.toLowerCase();
      if (/\brevenue\b/i.test(qLower)) throw new Error(`Ungrounded 'revenue' found in HR question: "${q}"`);
      if (/\bprofit\b/i.test(qLower)) throw new Error(`Ungrounded 'profit' found in HR question: "${q}"`);
      if (/\bsales\b/i.test(qLower)) throw new Error(`Ungrounded 'sales' found in HR question: "${q}"`);
      if (/\bproduct\b/i.test(qLower)) throw new Error(`Ungrounded 'product' found in HR question: "${q}"`);

      const val = validateSuggestedQuestion(q, hrProfile);
      if (!val.valid) throw new Error(`Question "${q}" failed validation: ${val.reason}`);
    }
  });

  recordTest('Suggestions - Minimal Boundary Dataset (Category, Value)', 'Only references Category and Value; no hallucinated concepts', () => {
    const suggestions = generateSchemaGroundedSuggestions(minimalProfile, { count: 5 });
    if (suggestions.length === 0) throw new Error('Returned 0 suggestions for minimal dataset');

    for (const q of suggestions) {
      const qLower = q.toLowerCase();
      if (/\brevenue\b/i.test(qLower)) throw new Error(`Ungrounded 'revenue' in minimal question: "${q}"`);
      if (/\bprofit\b/i.test(qLower)) throw new Error(`Ungrounded 'profit' in minimal question: "${q}"`);
      if (/\bdepartment\b/i.test(qLower)) throw new Error(`Ungrounded 'department' in minimal question: "${q}"`);
      if (/\bcandidate\b/i.test(qLower)) throw new Error(`Ungrounded 'candidate' in minimal question: "${q}"`);

      const val = validateSuggestedQuestion(q, minimalProfile);
      if (!val.valid) throw new Error(`Question "${q}" failed validation: ${val.reason}`);
    }
  });

  recordTest('Suggestions - Contextual Follow-Up Suggestions', 'Follow-up suggestions adapt to previous analysis and remain grounded', () => {
    const lastResult: any = {
      plan: {
        metric: 'Sentiment Score',
        group_by: ['State'],
        operation: 'group_aggregate',
      },
    };

    const followUps = generateSchemaGroundedSuggestions(votingProfile, {
      lastResult,
      count: 4,
    });

    if (followUps.length === 0) throw new Error('No follow-up suggestions generated');

    for (const q of followUps) {
      const val = validateSuggestedQuestion(q, votingProfile);
      if (!val.valid) throw new Error(`Follow-up "${q}" failed validation: ${val.reason}`);
      if (/\brevenue\b/i.test(q)) throw new Error(`Ungrounded 'revenue' in follow-up: "${q}"`);
    }

    const followUpText = followUps.join(' ');
    // Should suggest analyzing across Candidate or over time or opposite ranking
    const hasContextualPivot =
      followUpText.includes('Candidate') ||
      followUpText.includes('time') ||
      followUpText.includes('lowest') ||
      followUpText.includes('distribution');

    if (!hasContextualPivot) {
      throw new Error(`Follow-ups did not contain contextual pivot: ${followUpText}`);
    }
  });

  recordTest('Suggestions - Strict Validation Layer Rejection', 'Rejects ungrounded business concepts and unsupported operations', () => {
    // 1. Revenue on voting dataset
    const r1 = validateSuggestedQuestion('Which state generates the highest revenue?', votingProfile);
    if (r1.valid) throw new Error('Expected validation failure for revenue on voting dataset');

    // 2. Profit on HR dataset
    const r2 = validateSuggestedQuestion('What is the profit by department?', hrProfile);
    if (r2.valid) throw new Error('Expected validation failure for profit on HR dataset');

    // 3. Time series question when no date column exists
    const r3 = validateSuggestedQuestion('Show monthly trend over time', minimalProfile);
    if (r3.valid) throw new Error('Expected validation failure for time trend on dataset with no date column');

    // 4. Correlation question when only 1 numeric column exists
    const r4 = validateSuggestedQuestion('Analyze correlation between Value and Price', minimalProfile);
    if (r4.valid) throw new Error('Expected validation failure for correlation on dataset with 1 numeric column');
  });

  await recordTest('API - Suggestions Endpoints (GET & POST)', 'Returns validated suggestions via live HTTP API', async () => {
    const sampleId = 'sample-b2b-sales-sion';
    // GET
    const resGet = await fetch(`http://localhost:3000/api/suggestions/${sampleId}`);
    const jsonGet = await resGet.json();
    if (!jsonGet.success || !Array.isArray(jsonGet.data) || jsonGet.data.length === 0) {
      throw new Error('GET /api/suggestions/:id failed: ' + JSON.stringify(jsonGet));
    }

    // POST with context
    const resPost = await fetch(`http://localhost:3000/api/suggestions/${sampleId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lastQuestion: 'What is total revenue by region?',
        count: 4,
      }),
    });
    const jsonPost = await resPost.json();
    if (!jsonPost.success || !Array.isArray(jsonPost.data) || jsonPost.data.length !== 4) {
      throw new Error('POST /api/suggestions/:id failed: ' + JSON.stringify(jsonPost));
    }
  });

  // ============================================================================
  // DATASET 7: Healthcare & Clinical Trial (Age, Blood_Pressure, Treatment, Dosage, Date, Boolean)
  // ============================================================================
  console.log('\n[Dataset 7] Healthcare & Clinical Trial: Multi-type clinical records');
  const clinicalRows = [
    { Patient_ID: 'P001', Age: 45, Treatment_Group: 'Drug_A', Blood_Pressure: 130, Dosage_mg: 50, Improved: 'Yes', Trial_Date: '2024-01-10' },
    { Patient_ID: 'P002', Age: 52, Treatment_Group: 'Drug_B', Blood_Pressure: 142, Dosage_mg: 100, Improved: 'Yes', Trial_Date: '2024-01-12' },
    { Patient_ID: 'P003', Age: 39, Treatment_Group: 'Placebo', Blood_Pressure: 138, Dosage_mg: 0, Improved: 'No', Trial_Date: '2024-01-15' },
    { Patient_ID: 'P004', Age: 61, Treatment_Group: 'Drug_A', Blood_Pressure: 128, Dosage_mg: 50, Improved: 'Yes', Trial_Date: '2024-01-18' },
    { Patient_ID: 'P005', Age: 48, Treatment_Group: 'Drug_B', Blood_Pressure: 135, Dosage_mg: 100, Improved: 'Yes', Trial_Date: '2024-01-20' },
    { Patient_ID: 'P006', Age: 34, Treatment_Group: 'Placebo', Blood_Pressure: 145, Dosage_mg: 0, Improved: 'No', Trial_Date: '2024-01-22' },
    { Patient_ID: 'P007', Age: 58, Treatment_Group: 'Drug_A', Blood_Pressure: 126, Dosage_mg: 75, Improved: 'Yes', Trial_Date: '2024-01-25' },
    { Patient_ID: 'P008', Age: 67, Treatment_Group: 'Drug_B', Blood_Pressure: 139, Dosage_mg: 100, Improved: 'Yes', Trial_Date: '2024-01-28' },
    { Patient_ID: 'P009', Age: 42, Treatment_Group: 'Placebo', Blood_Pressure: 148, Dosage_mg: 0, Improved: 'No', Trial_Date: '2024-01-30' },
    { Patient_ID: 'P010', Age: 55, Treatment_Group: 'Drug_A', Blood_Pressure: 122, Dosage_mg: 75, Improved: 'Yes', Trial_Date: '2024-02-02' },
    { Patient_ID: 'P011', Age: 49, Treatment_Group: 'Drug_B', Blood_Pressure: 132, Dosage_mg: 100, Improved: 'Yes', Trial_Date: '2024-02-05' },
    { Patient_ID: 'P012', Age: 63, Treatment_Group: 'Placebo', Blood_Pressure: 152, Dosage_mg: 0, Improved: 'No', Trial_Date: '2024-02-08' },
  ];
  const clinicalProfile = profileDataset(clinicalRows, 'clinical_trial_results.csv', 'ds-clinical-001');

  recordTest('Dataset 7 - Clinical Profiler & Types', 'Correctly profiles numeric, categorical, date, and text columns', () => {
    const ageCol = clinicalProfile.columns.find(c => c.name === 'Age');
    const bpCol = clinicalProfile.columns.find(c => c.name === 'Blood_Pressure');
    const treatCol = clinicalProfile.columns.find(c => c.name === 'Treatment_Group');
    const dateCol = clinicalProfile.columns.find(c => c.name === 'Trial_Date');

    if (!ageCol || ageCol.type !== 'numeric') throw new Error('Age column not detected as numeric');
    if (!bpCol || bpCol.type !== 'numeric') throw new Error('Blood_Pressure column not detected as numeric');
    if (!treatCol || treatCol.type !== 'categorical') throw new Error('Treatment_Group column not detected as categorical');
    if (!dateCol || dateCol.type !== 'datetime') throw new Error('Trial_Date column not detected as datetime');
  });

  recordTest('Dataset 7 - Pearson Correlation Matrix', 'Computes valid, symmetric correlation matrix with 0 NaNs', () => {
    const corr = calculateCorrelationMatrix(clinicalRows, clinicalProfile);
    if (corr.columns.length < 3) throw new Error('Expected at least 3 numeric columns in clinical correlation matrix');
    if (corr.matrix.length !== corr.columns.length) throw new Error('Correlation matrix dimension mismatch');

    // Mathematical checks: symmetry, diagonal = 1.0, values in [-1, 1]
    for (let i = 0; i < corr.matrix.length; i++) {
      if (corr.matrix[i][i] !== 1.0) throw new Error(`Diagonal element at [${i}][${i}] must be 1.0, got ${corr.matrix[i][i]}`);
      for (let j = 0; j < corr.matrix[i].length; j++) {
        const val = corr.matrix[i][j];
        if (isNaN(val)) throw new Error(`NaN found in correlation matrix at [${i}][${j}]`);
        if (val < -1.0 || val > 1.0) throw new Error(`Correlation value ${val} outside [-1.0, 1.0]`);
        if (Math.abs(corr.matrix[i][j] - corr.matrix[j][i]) > 0.0001) {
          throw new Error(`Asymmetric correlation: M[${i}][${j}]=${corr.matrix[i][j]} vs M[${j}][${i}]=${corr.matrix[j][i]}`);
        }
      }
    }
  });

  recordTest('Dataset 7 - AI Suggestions Field Reading & Grounding', 'Dynamically reads clinical fields without hallucinating business concepts', () => {
    const suggestions = generateSchemaGroundedSuggestions(clinicalProfile, { count: 5 });
    if (suggestions.length === 0) throw new Error('Returned 0 suggestions');

    for (const q of suggestions) {
      const qLower = q.toLowerCase();
      // Zero ungrounded business concepts
      if (/\brevenue\b/i.test(qLower)) throw new Error(`Ungrounded 'revenue' in clinical question: "${q}"`);
      if (/\bprofit\b/i.test(qLower)) throw new Error(`Ungrounded 'profit' in clinical question: "${q}"`);
      if (/\bsales\b/i.test(qLower)) throw new Error(`Ungrounded 'sales' in clinical question: "${q}"`);
      if (/\bproduct\b/i.test(qLower)) throw new Error(`Ungrounded 'product' in clinical question: "${q}"`);

      // Validation layer confirmation
      const val = validateSuggestedQuestion(q, clinicalProfile);
      if (!val.valid) throw new Error(`Question "${q}" failed validation: ${val.reason}`);
    }

    // Must reference actual clinical columns
    const allText = suggestions.join(' ');
    const readsActualFields =
      allText.includes('Age') ||
      allText.includes('Blood_Pressure') ||
      allText.includes('Treatment_Group') ||
      allText.includes('Dosage_mg') ||
      allText.includes('Trial_Date');

    if (!readsActualFields) {
      throw new Error('Suggestions failed to read and use actual clinical fields from schema');
    }
  });

  // ============================================================================
  // DATASET 8: Academic / Education Dataset (GPA, Percentage strings, Booleans)
  // ============================================================================
  console.log('\n[Dataset 8] Academic Performance: GPA, attendance percentages, and degrees');
  const studentRows = [
    { Student_ID: 'S101', Major: 'Computer Science', GPA: 3.85, Attendance_Rate: '96.5%', Scholarship: true, Graduation_Year: 2025 },
    { Student_ID: 'S102', Major: 'Mechanical Eng', GPA: 3.42, Attendance_Rate: '88.0%', Scholarship: false, Graduation_Year: 2024 },
    { Student_ID: 'S103', Major: 'Computer Science', GPA: 3.91, Attendance_Rate: '98.2%', Scholarship: true, Graduation_Year: 2025 },
    { Student_ID: 'S104', Major: 'Biology', GPA: 3.15, Attendance_Rate: '82.4%', Scholarship: false, Graduation_Year: 2026 },
    { Student_ID: 'S105', Major: 'Economics', GPA: 3.60, Attendance_Rate: '91.0%', Scholarship: true, Graduation_Year: 2024 },
    { Student_ID: 'S106', Major: 'Economics', GPA: 2.89, Attendance_Rate: '75.5%', Scholarship: false, Graduation_Year: 2025 },
    { Student_ID: 'S107', Major: 'Mechanical Eng', GPA: 3.75, Attendance_Rate: '94.0%', Scholarship: true, Graduation_Year: 2024 },
    { Student_ID: 'S108', Major: 'Biology', GPA: 3.55, Attendance_Rate: '89.5%', Scholarship: false, Graduation_Year: 2026 },
  ];
  const studentProfile = profileDataset(studentRows, 'student_records.csv', 'ds-student-001');

  recordTest('Dataset 8 - Percentage String Number Cleaner', 'Parses percentages like "96.5%" into numeric floats', () => {
    const parsed = parseCleanNumber('96.5%');
    if (!parsed.isNum || parsed.value !== 96.5) {
      throw new Error(`Failed to parse percentage "96.5%", got: ${JSON.stringify(parsed)}`);
    }
    const attCol = studentProfile.columns.find(c => c.name === 'Attendance_Rate');
    if (!attCol || attCol.type !== 'numeric') {
      throw new Error('Attendance_Rate with percentages should be recognized as numeric');
    }
  });

  recordTest('Dataset 8 - AI Deterministic Execution', 'Plans and computes Average GPA by Major accurately', () => {
    const plan = {
      operation: 'group_aggregate' as const,
      metric: 'GPA',
      group_by: ['Major'],
      aggregation: 'mean' as const,
      visualization: { type: 'bar' as const, x: 'Major', y: 'GPA', title: 'Average GPA by Major' },
    };
    const exec = executeAnalysisPlan(studentRows, studentProfile, plan);
    if (!exec.success || !exec.data || !exec.data.items) {
      throw new Error('Failed to execute GPA by Major plan: ' + JSON.stringify(exec));
    }
    const csItem = exec.data.items.find((it: any) => it.category === 'Computer Science');
    if (!csItem) throw new Error('Computer Science major missing from aggregation');
    // CS GPAs: 3.85 + 3.91 = 7.76 / 2 = 3.88
    if (Math.abs(csItem.value - 3.88) > 0.05) {
      throw new Error(`Expected CS average GPA ~3.88, got ${csItem.value}`);
    }
  });

  recordTest('Dataset 8 - AI Suggestions Field Reading', 'Questions read GPA and Major without hallucinating non-existent concepts', () => {
    const suggestions = generateSchemaGroundedSuggestions(studentProfile, { count: 4 });
    for (const q of suggestions) {
      const val = validateSuggestedQuestion(q, studentProfile);
      if (!val.valid) throw new Error(`Question "${q}" failed validation: ${val.reason}`);
      if (/\brevenue\b/i.test(q)) throw new Error(`Ungrounded 'revenue' in student question: "${q}"`);
      if (/\bsalary\b/i.test(q)) throw new Error(`Ungrounded 'salary' in student question: "${q}"`);
    }
    const allText = suggestions.join(' ');
    if (!allText.includes('GPA') && !allText.includes('Major') && !allText.includes('Attendance_Rate')) {
      throw new Error('Suggestions failed to ground in academic columns');
    }
  });

  // ============================================================================
  // DATASET 9: Novel IoT Telemetry (Novel, Unseen Domain Column Names)
  // ============================================================================
  console.log('\n[Dataset 9] Novel IoT Sensor Telemetry: Testing dynamic field reading on unseen schema');
  const iotRows = [
    { Device_UUID: 'D-101', Vibration_Amplitude_mm: 0.12, Bearing_Temp_C: 62.4, Rotational_Speed_RPM: 1780, Constant_Voltage_V: 24.0 },
    { Device_UUID: 'D-102', Vibration_Amplitude_mm: 0.15, Bearing_Temp_C: 65.1, Rotational_Speed_RPM: 1795, Constant_Voltage_V: 24.0 },
    { Device_UUID: 'D-103', Vibration_Amplitude_mm: 0.28, Bearing_Temp_C: 78.9, Rotational_Speed_RPM: 1820, Constant_Voltage_V: 24.0 },
    { Device_UUID: 'D-104', Vibration_Amplitude_mm: 0.11, Bearing_Temp_C: 61.8, Rotational_Speed_RPM: 1775, Constant_Voltage_V: 24.0 },
    { Device_UUID: 'D-105', Vibration_Amplitude_mm: 0.35, Bearing_Temp_C: 84.2, Rotational_Speed_RPM: 1850, Constant_Voltage_V: 24.0 },
    { Device_UUID: 'D-106', Vibration_Amplitude_mm: 0.14, Bearing_Temp_C: 63.7, Rotational_Speed_RPM: 1790, Constant_Voltage_V: 24.0 },
  ];
  const iotProfile = profileDataset(iotRows, 'turbine_sensors.csv', 'ds-iot-001');

  recordTest('Dataset 9 - Dynamic Field Extraction', 'Dynamically reads novel sensor column names into suggestion questions', () => {
    const suggestions = generateSchemaGroundedSuggestions(iotProfile, { count: 5 });
    if (suggestions.length === 0) throw new Error('No suggestions generated for IoT dataset');

    for (const q of suggestions) {
      const val = validateSuggestedQuestion(q, iotProfile);
      if (!val.valid) throw new Error(`IoT suggestion "${q}" failed validation: ${val.reason}`);
    }

    const allText = suggestions.join(' ');
    // Must directly use the actual novel column names
    const usesNovelFields =
      allText.includes('Vibration_Amplitude_mm') ||
      allText.includes('Bearing_Temp_C') ||
      allText.includes('Rotational_Speed_RPM') ||
      allText.includes('Device_UUID');

    if (!usesNovelFields) {
      throw new Error(`Suggestions did not incorporate novel sensor fields. Got: ${allText}`);
    }
  });

  recordTest('Dataset 9 - Zero-Variance Correlation Safety', 'Handles zero-variance column Constant_Voltage_V with 0 instead of NaN', () => {
    const corr = calculateCorrelationMatrix(iotRows, iotProfile);
    const voltIdx = corr.columns.indexOf('Constant_Voltage_V');
    if (voltIdx !== -1) {
      for (let j = 0; j < corr.columns.length; j++) {
        if (voltIdx !== j) {
          const val = corr.matrix[voltIdx][j];
          if (isNaN(val)) throw new Error('NaN found for zero-variance voltage column');
          if (val !== 0) throw new Error(`Expected correlation 0 for constant column, got ${val}`);
        }
      }
    }
  });

  // ============================================================================
  // SUMMARY REPORT
  // ============================================================================
  console.log('\n================================================================');
  console.log('  AUDIT SUMMARY REPORT');
  console.log('================================================================');
  const total = results.length;
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  console.log(`Total Tests Run: ${total}`);
  console.log(`Passed:          ${passed}`);
  console.log(`Failed:          ${failed}`);

  if (failed > 0) {
    console.log('\nFailed Tests:');
    for (const f of results.filter(r => !r.passed)) {
      console.log(`- ${f.suite} > ${f.name}: ${f.error}`);
    }
    process.exit(1);
  } else {
    console.log('\nALL TESTS PASSED WITH 100% SUCCESS RATE! Zero errors across all datasets and features.');
  }
}

runAudit().catch((e) => {
  console.error(e);
  process.exit(1);
});
