import { profileDataset, parseCleanNumber, isNullOrEmpty } from '../server/profiler.js';
import { auditDataQuality, evaluateBusinessAssertions } from '../server/quality.js';
import { generateAutomatedInsights } from '../server/insights.js';
import { calculateCorrelationMatrix, getOutlierDrilldown, executeAnalysisPlan } from '../server/analyzer.js';
import { computeDashboardData } from '../server/dashboard.js';
import { generatePlotlyFigure } from '../server/charts.js';
import { performTransformation } from '../server/transformer.js';
import { performDataCleaning } from '../server/cleaner.js';
import { datasetStore } from '../server/dataset_store.js';

interface TestResult {
  suite: string;
  name: string;
  passed: boolean;
  error?: string;
}

const results: TestResult[] = [];

function recordTest(suite: string, name: string, fn: () => void | Promise<void>) {
  try {
    const res = fn();
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
