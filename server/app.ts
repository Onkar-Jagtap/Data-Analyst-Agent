import express from 'express';
import multer from 'multer';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import path from 'path';
import dotenv from 'dotenv';

import { datasetStore } from './dataset_store.js';
import {
  calculateCorrelationMatrix,
  executeAnalysisPlan,
  getOutlierDrilldown,
} from './analyzer.js';
import { planAnalysisWithGemini, explainResultWithGemini } from './ai_agent.js';
import { generatePlotlyFigure } from './charts.js';
import { performDataCleaning } from './cleaner.js';
import { performTransformation } from './transformer.js';
import { evaluateBusinessAssertions } from './quality.js';
import { isNullOrEmpty, parseCleanNumber, profileDataset } from './profiler.js';
import { computeDashboardData } from './dashboard.js';
import { generateExecutiveReport } from './report.js';
import { AnalysisResult, BusinessAssertion, TransformRequest } from './types.js';

dotenv.config();

const app = express();
const PORT = 3000;

// Increase JSON body limit
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Helper to extract session ID for complete multi-tenant tenant isolation
const getSessionId = (req: express.Request): string => {
  const headerSid = req.headers['x-session-id'];
  if (typeof headerSid === 'string' && headerSid.trim().length > 0) {
    return headerSid.trim();
  }
  const querySid = req.query.sessionId;
  if (typeof querySid === 'string' && querySid.trim().length > 0) {
    return querySid.trim();
  }
  return 'default-session';
};

// Filename sanitizer to prevent path traversal
const sanitizeFilename = (filename: string): string => {
  const base = path.basename(filename).replace(/[^a-zA-Z0-9._-]/g, '_');
  return base || 'uploaded_data.csv';
};

// Multer in-memory storage for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext === '.csv' || ext === '.xlsx' || ext === '.xls') {
      cb(null, true);
    } else {
      cb(new Error('Only CSV, XLSX, and XLS files are supported.'));
    }
  },
});

// ----------------------------------------------------
// API ROUTES FIRST
// ----------------------------------------------------

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    app: 'Data Studio by PJA',
    timestamp: new Date().toISOString(),
    geminiConfigured: !!process.env.GEMINI_API_KEY,
  });
});

// List all datasets for current session
app.get('/api/datasets', (req, res) => {
  const sid = getSessionId(req);
  res.json({
    success: true,
    data: datasetStore.listDatasets(sid),
    activeDatasetId: datasetStore.getActiveDataset(sid)?.id,
  });
});

// Set active dataset for current session
app.post('/api/datasets/active/:id', (req, res) => {
  const sid = getSessionId(req);
  const success = datasetStore.setActiveDataset(sid, req.params.id);
  if (!success) {
    return res.status(404).json({ success: false, error: { message: 'Dataset not found in this session.' } });
  }
  const dataset = datasetStore.getDataset(sid, req.params.id);
  res.json({ success: true, data: dataset?.profile });
});

// Load / Reset Sample Dataset for current session
app.post('/api/sample', (req, res) => {
  const sid = getSessionId(req);
  const sample = datasetStore.initSample(sid);
  datasetStore.setActiveDataset(sid, sample.id);
  res.json({
    success: true,
    data: {
      profile: sample.profile,
      quality: sample.qualityAudit,
      insights: sample.insights,
    },
  });
});

// Upload CSV or Excel file (session-isolated & sanitized)
app.post('/api/upload', upload.single('file'), async (req, res) => {
  const sid = getSessionId(req);
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: { message: 'No file was uploaded.' } });
    }

    const filename = sanitizeFilename(req.file.originalname);
    const ext = path.extname(filename).toLowerCase();
    let rows: Record<string, any>[] = [];

    if (ext === '.csv') {
      const csvContent = req.file.buffer.toString('utf8');
      const parsed = Papa.parse(csvContent, {
        header: true,
        dynamicTyping: false,
        skipEmptyLines: 'greedy',
      });
      if (parsed.errors && parsed.errors.length > 0 && parsed.data.length === 0) {
        return res.status(400).json({
          success: false,
          error: { message: `CSV Parsing error: ${parsed.errors[0].message}` },
        });
      }
      rows = parsed.data as Record<string, any>[];
    } else if (ext === '.xlsx' || ext === '.xls') {
      const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
      const firstSheetName = workbook.SheetNames[0];
      if (!firstSheetName) {
        return res.status(400).json({ success: false, error: { message: 'The Excel workbook has no sheets.' } });
      }
      const worksheet = workbook.Sheets[firstSheetName];
      rows = XLSX.utils.sheet_to_json(worksheet, { defval: null }) as Record<string, any>[];
    }

    if (!rows || rows.length === 0) {
      return res.status(400).json({
        success: false,
        error: { message: 'The uploaded file is empty or could not be parsed into rows.' },
      });
    }

    const stored = datasetStore.addDataset(sid, filename, rows);

    res.json({
      success: true,
      data: {
        datasetId: stored.id,
        profile: stored.profile,
        quality: stored.qualityAudit,
        insights: stored.insights,
      },
    });
  } catch (err: any) {
    console.error('File upload error:', err);
    res.status(500).json({
      success: false,
      error: { message: err.message || 'An error occurred during dataset processing.' },
    });
  }
});

// Get Dataset Profile
app.get('/api/profile/:id', (req, res) => {
  const sid = getSessionId(req);
  const dataset = datasetStore.getDataset(sid, req.params.id) || datasetStore.getActiveDataset(sid);
  if (!dataset) {
    return res.status(404).json({ success: false, error: { message: 'Dataset not found.' } });
  }
  res.json({ success: true, data: dataset.profile });
});

// Get Data Quality Audit
app.get('/api/quality/:id', (req, res) => {
  const sid = getSessionId(req);
  const dataset = datasetStore.getDataset(sid, req.params.id) || datasetStore.getActiveDataset(sid);
  if (!dataset) {
    return res.status(404).json({ success: false, error: { message: 'Dataset not found.' } });
  }
  res.json({ success: true, data: dataset.qualityAudit });
});

// Get Automated Executive Insights
app.get('/api/insights/:id', (req, res) => {
  const sid = getSessionId(req);
  const dataset = datasetStore.getDataset(sid, req.params.id) || datasetStore.getActiveDataset(sid);
  if (!dataset) {
    return res.status(404).json({ success: false, error: { message: 'Dataset not found.' } });
  }
  res.json({ success: true, data: dataset.insights });
});

// Get Columns List
app.get('/api/columns/:id', (req, res) => {
  const sid = getSessionId(req);
  const dataset = datasetStore.getDataset(sid, req.params.id) || datasetStore.getActiveDataset(sid);
  if (!dataset) {
    return res.status(404).json({ success: false, error: { message: 'Dataset not found.' } });
  }
  res.json({ success: true, data: dataset.profile.columns });
});

// Correlation Matrix Endpoint
app.get('/api/correlation-matrix/:id', (req, res) => {
  const sid = getSessionId(req);
  const dataset = datasetStore.getDataset(sid, req.params.id) || datasetStore.getActiveDataset(sid);
  if (!dataset) {
    return res.status(404).json({ success: false, error: { message: 'Dataset not found.' } });
  }
  const result = calculateCorrelationMatrix(dataset.rawRows, dataset.profile);
  res.json({ success: true, data: result });
});

// Outlier Root-Cause Drill-Down Endpoint
app.get('/api/outlier-drilldown/:id', (req, res) => {
  const sid = getSessionId(req);
  const dataset = datasetStore.getDataset(sid, req.params.id) || datasetStore.getActiveDataset(sid);
  if (!dataset) {
    return res.status(404).json({ success: false, error: { message: 'Dataset not found.' } });
  }
  const colName = req.query.column as string | undefined;
  const drilldown = getOutlierDrilldown(dataset.rawRows, dataset.profile, colName);
  if (!drilldown) {
    return res.status(400).json({ success: false, error: { message: 'Could not calculate outlier drilldown for column.' } });
  }
  res.json({ success: true, data: drilldown });
});

// Executive Power BI Style Dashboard Analytics Endpoint
app.get('/api/dashboard/:id', (req, res) => {
  const sid = getSessionId(req);
  const dataset = datasetStore.getDataset(sid, req.params.id) || datasetStore.getActiveDataset(sid);
  if (!dataset) {
    return res.status(404).json({ success: false, error: { message: 'Dataset not found.' } });
  }

  const dimension = req.query.dimension as string | undefined;
  const metric = req.query.metric as string | undefined;
  const secondaryMetric = req.query.secondaryMetric as string | undefined;
  const filterCol = req.query.filterCol as string | undefined;
  const filterVal = req.query.filterVal as string | undefined;
  const timeCol = req.query.timeCol as string | undefined;
  const timeGrain = req.query.timeGrain as string | undefined;

  try {
    const data = computeDashboardData(dataset.rawRows, dataset.profile, {
      dimension,
      metric,
      secondaryMetric,
      filterCol,
      filterVal,
      timeCol,
      timeGrain,
    });
    res.json({ success: true, data });
  } catch (err: any) {
    console.error('Error computing dashboard data:', err);
    res.status(500).json({ success: false, error: { message: err.message || 'Failed to compute dashboard analytics.' } });
  }
});

// Executive Business Intelligence & Strategy Report Endpoint
app.get('/api/report/:id', async (req, res) => {
  const sid = getSessionId(req);
  const dataset = datasetStore.getDataset(sid, req.params.id) || datasetStore.getActiveDataset(sid);
  if (!dataset) {
    return res.status(404).json({ success: false, error: { message: 'Dataset not found.' } });
  }

  try {
    const report = await generateExecutiveReport(dataset.profile, dataset.rawRows, { useAi: true });
    res.json({ success: true, data: report });
  } catch (err: any) {
    console.error('Error generating executive report:', err);
    res.status(500).json({ success: false, error: { message: err.message || 'Failed to generate executive report.' } });
  }
});

app.post('/api/report/:id', async (req, res) => {
  const sid = getSessionId(req);
  const dataset = datasetStore.getDataset(sid, req.params.id) || datasetStore.getActiveDataset(sid);
  if (!dataset) {
    return res.status(404).json({ success: false, error: { message: 'Dataset not found.' } });
  }

  const { useAi } = req.body || {};
  try {
    const report = await generateExecutiveReport(dataset.profile, dataset.rawRows, { useAi: useAi !== false });
    res.json({ success: true, data: report });
  } catch (err: any) {
    console.error('Error generating executive report:', err);
    res.status(500).json({ success: false, error: { message: err.message || 'Failed to generate executive report.' } });
  }
});

// Data Explorer Raw Rows Endpoint with Cell Status Annotations & Pagination
app.get('/api/data/:id', (req, res) => {
  const sid = getSessionId(req);
  const dataset = datasetStore.getDataset(sid, req.params.id) || datasetStore.getActiveDataset(sid);
  if (!dataset) {
    return res.status(404).json({ success: false, error: { message: 'Dataset not found.' } });
  }

  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const pageSize = Math.min(100, Math.max(10, parseInt(req.query.pageSize as string) || 25));
  const search = (req.query.search as string || '').toLowerCase().trim();
  const sortCol = req.query.sortCol as string;
  const sortDir = (req.query.sortDir as string || 'asc').toLowerCase();

  let rows = [...dataset.rawRows];

  // Search across all text fields
  if (search) {
    rows = rows.filter(r =>
      Object.values(r).some(v => v !== null && v !== undefined && String(v).toLowerCase().includes(search))
    );
  }

  // Sorting
  if (sortCol) {
    rows.sort((a, b) => {
      const vA = a[sortCol];
      const vB = b[sortCol];
      const pA = parseCleanNumber(vA);
      const pB = parseCleanNumber(vB);

      if (pA.isNum && pB.isNum) {
        return sortDir === 'desc' ? pB.value - pA.value : pA.value - pB.value;
      }
      const sA = String(vA || '');
      const sB = String(vB || '');
      return sortDir === 'desc' ? sB.localeCompare(sA) : sA.localeCompare(sB);
    });
  }

  const totalMatching = rows.length;
  const totalPages = Math.ceil(totalMatching / pageSize);
  const startIndex = (page - 1) * pageSize;
  const pageRows = rows.slice(startIndex, startIndex + pageSize);

  // Annotate cell quality status for each cell (valid, missing, invalid, anomaly)
  const columnsMeta = dataset.profile.columns;
  const annotatedRows = pageRows.map(row => {
    const cellStatus: Record<string, { status: 'valid' | 'missing' | 'invalid' | 'anomaly'; message?: string }> = {};

    for (const col of columnsMeta) {
      const val = row[col.name];
      if (isNullOrEmpty(val)) {
        cellStatus[col.name] = { status: 'missing', message: 'Missing / null value' };
      } else if (col.type === 'numeric') {
        const parsed = parseCleanNumber(val);
        if (!parsed.isNum) {
          cellStatus[col.name] = { status: 'invalid', message: `Non-numeric text '${val}' in numeric column` };
        } else if (parsed.value < 0 && (col.name.toLowerCase().includes('rev') || col.name.toLowerCase().includes('sale') || col.name.toLowerCase().includes('price'))) {
          cellStatus[col.name] = { status: 'anomaly', message: `Potential anomaly: Negative revenue (${parsed.value})` };
        } else if (col.q1 !== undefined && col.iqr !== undefined) {
          const lower = col.q1 - 1.5 * col.iqr;
          const upper = col.q3! + 1.5 * col.iqr;
          if (parsed.value < lower || parsed.value > upper) {
            cellStatus[col.name] = { status: 'anomaly', message: `Tukey Outlier (${parsed.value}) outside [${Math.round(lower)}, ${Math.round(upper)}]` };
          } else {
            cellStatus[col.name] = { status: 'valid' };
          }
        } else {
          cellStatus[col.name] = { status: 'valid' };
        }
      } else {
        cellStatus[col.name] = { status: 'valid' };
      }
    }

    return {
      data: row,
      cellStatus,
      _data: row,
      _status: cellStatus,
    };
  });

  res.json({
    success: true,
    data: {
      rows: annotatedRows,
      page,
      pageSize,
      totalRows: totalMatching,
      totalPages,
      columns: columnsMeta.map(c => ({ name: c.name, type: c.type, isIdentifier: c.isIdentifier })),
    },
  });
});

// Natural Language Query Endpoint
// Workflow: Gemini Plan -> Deterministic Python/TS Math -> Validation -> Plotly Chart -> Gemini Explainer -> Transparent Data Handling
app.post('/api/query/:id', async (req, res) => {
  const sid = getSessionId(req);
  try {
    const dataset = datasetStore.getDataset(sid, req.params.id) || datasetStore.getActiveDataset(sid);
    if (!dataset) {
      return res.status(404).json({ success: false, error: { message: 'Dataset not found.' } });
    }

    const { question, conversationHistory } = req.body;
    if (!question || typeof question !== 'string' || question.trim() === '') {
      return res.status(400).json({ success: false, error: { message: 'A query question is required.' } });
    }

    // 1. AI Plan: Map natural language to strict execution plan with multi-turn conversation context
    const plan = await planAnalysisWithGemini(question, dataset.profile, conversationHistory);

    // 2. Deterministic Execution: pure math / statistics
    const execution = executeAnalysisPlan(dataset.rawRows, dataset.profile, plan);

    if (!execution.success) {
      return res.json({
        success: false,
        question,
        plan,
        answer: execution.error?.message || 'Analysis could not be computed.',
        keyMetrics: [],
        businessInterpretation: [],
        dataHandling: execution.dataHandling,
        error: execution.error,
      });
    }

    // 3. Gemini Explanation: explains computed numbers without modifying them
    const explanation = await explainResultWithGemini(
      question,
      execution.methodDescription,
      execution.data,
      execution.summaryMetrics,
      execution.dataHandling
    );

    // 4. Plotly Visualization
    const rawType = plan.visualization?.type;
    const chartType: 'bar' | 'line' | 'scatter' | 'histogram' | 'box' | 'pie' | 'heatmap' | 'combo' | 'treemap' | 'sunburst' =
      (rawType && rawType !== 'table' ? (rawType as any) : execution.suggestedChart?.type || 'bar');
    const chartTitle = plan.visualization?.title || execution.suggestedChart?.title || `${plan.operation.toUpperCase()} Visualization`;
    const plotlyFigure = generatePlotlyFigure(chartType, execution.data, chartTitle);

    const result: AnalysisResult = {
      success: true,
      question,
      plan,
      answer: explanation.answer,
      keyMetrics: execution.summaryMetrics,
      businessInterpretation: explanation.businessInterpretation,
      dataHandling: execution.dataHandling,
      rawData: execution.data,
      chart: plotlyFigure,
      warnings: execution.warnings,
    };

    res.json(result);
  } catch (err: any) {
    console.error('Query processing error:', err);
    res.status(500).json({
      success: false,
      error: { message: err.message || 'An error occurred during query execution.' },
    });
  }
});

// Visual Studio Custom Chart Builder Endpoint
app.post('/api/chart/:id', (req, res) => {
  const sid = getSessionId(req);
  try {
    const dataset = datasetStore.getDataset(sid, req.params.id) || datasetStore.getActiveDataset(sid);
    if (!dataset) {
      return res.status(404).json({ success: false, error: { message: 'Dataset not found.' } });
    }

    const { type, xAxis, yAxis, secondaryYAxis, colorDimension, aggregation, sortBy, sortDirection, topN } = req.body;

    // Special handling for correlation heatmap
    if (type === 'heatmap') {
      const corr = calculateCorrelationMatrix(dataset.rawRows, dataset.profile);
      const chart = generatePlotlyFigure('heatmap', corr, 'Multi-Variable Correlation Matrix');
      return res.json({
        success: true,
        chart,
        summaryMetrics: [
          { label: 'Numeric Dimensions', value: `${corr.columns.length}` },
          { label: 'Pairwise Comparisons', value: `${corr.columns.length * corr.columns.length}` },
        ],
      });
    }

    // 1. Dual-Axis Combo Chart (Bar on Y1 + Line on Y2)
    if (type === 'combo') {
      const primaryMetric = yAxis || dataset.profile.columns.find(c => c.type === 'numeric')?.name || 'Value';
      const secondaryMetric = secondaryYAxis || dataset.profile.columns.filter(c => c.type === 'numeric')[1]?.name || primaryMetric;
      const groupCol = xAxis || dataset.profile.columns.find(c => c.type === 'categorical')?.name || 'Category';

      const plan1 = {
        operation: 'group_aggregate',
        metric: primaryMetric,
        group_by: [groupCol],
        aggregation: aggregation || 'sum',
        limit: topN || 15,
        sort: { column: primaryMetric, direction: sortDirection || 'desc' },
      };
      const plan2 = {
        operation: 'group_aggregate',
        metric: secondaryMetric,
        group_by: [groupCol],
        aggregation: aggregation || 'sum',
        limit: topN || 15,
      };

      const exec1 = executeAnalysisPlan(dataset.rawRows, dataset.profile, plan1 as any);
      const exec2 = executeAnalysisPlan(dataset.rawRows, dataset.profile, plan2 as any);

      const items1 = exec1.success && exec1.data ? exec1.data.items || [] : [];
      const items2 = exec2.success && exec2.data ? exec2.data.items || [] : [];
      const val2Map = new Map<string, number>();
      for (const it of items2) val2Map.set(String(it.category), it.value);

      const combinedItems = items1.map((it: any) => ({
        category: it.category,
        primaryValue: it.value,
        secondaryValue: val2Map.get(String(it.category)) || 0,
      }));

      const chart = generatePlotlyFigure('combo', {
        groupColumn: groupCol,
        primaryMetric,
        secondaryMetric,
        items: combinedItems,
      }, `${primaryMetric} & ${secondaryMetric} by ${groupCol}`);

      return res.json({
        success: true,
        chart,
        dataHandling: exec1.dataHandling,
        summaryMetrics: [
          { label: 'Dimension', value: groupCol },
          { label: 'Primary (Bar)', value: primaryMetric },
          { label: 'Secondary (Line)', value: secondaryMetric },
        ],
      });
    }

    // 2. Treemap & Sunburst Hierarchical Visualizations
    if (type === 'treemap' || type === 'sunburst') {
      const metric = yAxis || dataset.profile.columns.find(c => c.type === 'numeric')?.name || 'Value';
      const groupCol = xAxis || dataset.profile.columns.find(c => c.type === 'categorical')?.name || 'Category';

      const plan = {
        operation: 'group_aggregate',
        metric,
        group_by: [groupCol],
        aggregation: aggregation || 'sum',
        limit: topN || 25,
        sort: { column: metric, direction: sortDirection || 'desc' },
      };
      const exec = executeAnalysisPlan(dataset.rawRows, dataset.profile, plan as any);
      const chart = generatePlotlyFigure(type, exec.data, `${type === 'treemap' ? 'Treemap' : 'Sunburst'} of ${metric} by ${groupCol}`);
      return res.json({
        success: true,
        chart,
        dataHandling: exec.dataHandling,
        summaryMetrics: exec.summaryMetrics,
      });
    }

    // 3. Color Dimension Grouping
    if (colorDimension && xAxis && yAxis) {
      const metric = yAxis;
      const xCol = xAxis;
      const cCol = colorDimension;

      const pairMap = new Map<string, number>();
      for (const row of dataset.rawRows) {
        const xVal = String(row[xCol] ?? 'Other');
        const cVal = String(row[cCol] ?? 'Other');
        const mVal = parseCleanNumber(row[metric]).value;
        const key = `${cVal}:::${xVal}`;
        pairMap.set(key, (pairMap.get(key) || 0) + mVal);
      }

      const distinctC = Array.from(new Set(dataset.rawRows.map(r => String(r[cCol] ?? 'Other')))).slice(0, 8);
      const distinctX = Array.from(new Set(dataset.rawRows.map(r => String(r[xCol] ?? 'Other')))).slice(0, 15);

      const groupedTraces = distinctC.map(cVal => {
        const xArr = distinctX;
        const yArr = distinctX.map(xVal => pairMap.get(`${cVal}:::${xVal}`) || 0);
        return { name: cVal, x: xArr, y: yArr };
      });

      const chart = generatePlotlyFigure(type || 'bar', {
        groupedTraces,
        xAxis: xCol,
        yAxis: metric,
      }, `${yAxis} by ${xAxis} grouped by ${colorDimension}`);

      return res.json({
        success: true,
        chart,
        summaryMetrics: [
          { label: 'Category X', value: xCol },
          { label: 'Color Group', value: cCol },
          { label: 'Group Count', value: `${groupedTraces.length}` },
        ],
      });
    }

    // Standard single-variable plan
    const op = type === 'line' ? 'time_series' : type === 'scatter' ? 'correlation' : 'group_aggregate';
    const plan = {
      operation: op as any,
      metric: yAxis,
      group_by: xAxis ? [xAxis] : [],
      aggregation: aggregation || 'sum',
      sort: sortBy ? { column: sortBy, direction: sortDirection || 'desc' } : undefined,
      limit: topN || 15,
      visualization: {
        type: type || 'bar',
        x: xAxis,
        y: yAxis,
        title: `${aggregation ? aggregation.toUpperCase() : ''} of ${yAxis || 'Count'} by ${xAxis || 'Category'}`,
      },
    };

    const execution = executeAnalysisPlan(dataset.rawRows, dataset.profile, plan as any);
    if (!execution.success) {
      return res.status(400).json({ success: false, error: execution.error });
    }

    const chart = generatePlotlyFigure(type || 'bar', execution.data, plan.visualization.title);

    res.json({
      success: true,
      chart,
      dataHandling: execution.dataHandling,
      summaryMetrics: execution.summaryMetrics,
    });
  } catch (err: any) {
    console.error('Visual studio error:', err);
    res.status(500).json({ success: false, error: { message: err.message } });
  }
});

// Data Cleaning Assistant Endpoint
app.post('/api/clean/:id', (req, res) => {
  const sid = getSessionId(req);
  try {
    const dataset = datasetStore.getDataset(sid, req.params.id) || datasetStore.getActiveDataset(sid);
    if (!dataset) {
      return res.status(404).json({ success: false, error: { message: 'Dataset not found.' } });
    }

    const { action, column, constantValue, saveAsNew } = req.body;
    const cleaningResult = performDataCleaning(dataset.rawRows, dataset.profile, action, column, constantValue);

    if (!cleaningResult.success) {
      return res.status(400).json({ success: false, error: { message: cleaningResult.summary } });
    }

    let updatedProfile = dataset.profile;
    let targetDatasetId = dataset.id;

    if (saveAsNew) {
      const newDataset = datasetStore.updateTransformedDataset(
        sid,
        dataset.id,
        `cleaned_${dataset.filename}`,
        cleaningResult.cleanedData
      );
      updatedProfile = newDataset.profile;
      targetDatasetId = newDataset.id;
    } else {
      // In-place update: preserves datasetId, records undo snapshot
      const updated = datasetStore.updateExistingDataset(sid, dataset.id, cleaningResult.cleanedData);
      updatedProfile = updated.profile;
    }

    res.json({
      success: true,
      data: {
        action: cleaningResult.action,
        column: cleaningResult.column,
        beforeCount: cleaningResult.beforeCount,
        afterCount: cleaningResult.afterCount,
        rowsAffected: cleaningResult.rowsAffected,
        summary: cleaningResult.summary,
        previewDifferences: cleaningResult.previewDifferences,
        newDatasetId: targetDatasetId,
        canUndo: datasetStore.canUndo(sid, targetDatasetId),
      },
    });
  } catch (err: any) {
    console.error('Data cleaning error:', err);
    res.status(500).json({ success: false, error: { message: err.message } });
  }
});

// Undo Cleaning Transformation Endpoint
app.post('/api/clean/undo/:id', (req, res) => {
  const sid = getSessionId(req);
  try {
    const result = datasetStore.undoLastTransformation(sid, req.params.id);
    if (!result.success) {
      return res.status(400).json({ success: false, error: { message: result.message } });
    }
    res.json({
      success: true,
      message: result.message,
      data: {
        datasetId: result.dataset?.id,
        rowCount: result.dataset?.profile.rowCount,
        canUndo: datasetStore.canUndo(sid, req.params.id),
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { message: err.message } });
  }
});

// Can Undo Check
app.get('/api/clean/can-undo/:id', (req, res) => {
  const sid = getSessionId(req);
  res.json({
    success: true,
    canUndo: datasetStore.canUndo(sid, req.params.id),
  });
});

// Reproducible Code Generation Endpoint (Python Pandas & SQL CTE)
app.post('/api/generate-code', (req, res) => {
  const { filename, metric, xAxis, yAxis, aggregation, sortDirection, limit } = req.body;
  const file = sanitizeFilename(filename || 'dataset.csv');
  const agg = (aggregation || 'sum').toLowerCase();
  const met = yAxis || metric || 'Revenue';
  const group = xAxis || 'Region';
  const sortDir = (sortDirection || 'desc').toUpperCase();
  const lim = limit || 10;

  const pandasAgg = agg === 'count' ? 'count()' : `${agg}()`;
  const sqlAgg = agg.toUpperCase();

  const python = `import pandas as pd
import matplotlib.pyplot as plt

# 1. Load dataset
df = pd.read_csv('${file}')

# 2. Numeric normalization & regex cleaning
df['${met}'] = pd.to_numeric(
    df['${met}'].astype(str).str.replace(r'[$€£,%]', '', regex=True),
    errors='coerce'
)

# 3. Aggregation & Grouping
result = (
    df.dropna(subset=['${met}'])
      .groupby('${group}')['${met}']
      .${pandasAgg}
      .reset_index()
      .sort_values(by='${met}', ascending=${sortDir === 'ASC' ? 'True' : 'False'})
      .head(${lim})
)

print(result)

# 4. Optional Plotly / Matplotlib Chart
# plt.figure(figsize=(10, 5))
# plt.bar(result['${group}'], result['${met}'], color='#3b82f6')
# plt.title('${agg.toUpperCase()} of ${met} by ${group}')
# plt.show()`;

  const sql = `-- 1. Common Table Expression (CTE) for Data Cleansing
WITH cleaned_data AS (
  SELECT
    "${group}",
    TRY_CAST(REGEXP_REPLACE(CAST("${met}" AS VARCHAR), '[$€£,%]', '') AS DOUBLE) AS "${met}_clean"
  FROM read_csv_auto('${file}')
  WHERE "${met}" IS NOT NULL
)
-- 2. Aggregated Query with Ranking
SELECT
  "${group}",
  ${sqlAgg}("${met}_clean") AS "${agg}_${met.toLowerCase()}"
FROM cleaned_data
GROUP BY "${group}"
ORDER BY "${agg}_${met.toLowerCase()}" ${sortDir}
LIMIT ${lim};`;

  res.json({
    success: true,
    data: { python, sql },
  });
});

// Export Filtered Subset (CSV or JSON)
app.post('/api/export-subset/:id', (req, res) => {
  const sid = getSessionId(req);
  const dataset = datasetStore.getDataset(sid, req.params.id) || datasetStore.getActiveDataset(sid);
  if (!dataset) {
    return res.status(404).send('Dataset not found.');
  }

  const { format, search, sortCol, sortDir } = req.body;
  let rows = [...dataset.rawRows];

  if (search) {
    const q = String(search).toLowerCase().trim();
    rows = rows.filter(r =>
      Object.values(r).some(v => v !== null && v !== undefined && String(v).toLowerCase().includes(q))
    );
  }

  if (sortCol) {
    rows.sort((a, b) => {
      const vA = a[sortCol];
      const vB = b[sortCol];
      const pA = parseCleanNumber(vA);
      const pB = parseCleanNumber(vB);

      if (pA.isNum && pB.isNum) {
        return sortDir === 'desc' ? pB.value - pA.value : pA.value - pB.value;
      }
      return sortDir === 'desc' ? String(vB || '').localeCompare(String(vA || '')) : String(vA || '').localeCompare(String(vB || ''));
    });
  }

  if (format === 'json') {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="filtered_${dataset.filename}.json"`);
    return res.send(JSON.stringify(rows, null, 2));
  }

  const csv = Papa.unparse(rows);
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="filtered_${dataset.filename}"`);
  res.send(csv);
});

// Export Entire Dataset as CSV
app.get('/api/export/:id', (req, res) => {
  const sid = getSessionId(req);
  const dataset = datasetStore.getDataset(sid, req.params.id) || datasetStore.getActiveDataset(sid);
  if (!dataset) {
    return res.status(404).send('Dataset not found.');
  }

  const csv = Papa.unparse(dataset.rawRows);
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="${dataset.filename}"`);
  res.send(csv);
});

// Data Transformation & Feature Engineering Endpoint (Calculated Columns, Type Casting, Splitting, Find/Replace)
app.post('/api/transform/:id', (req, res) => {
  const sid = getSessionId(req);
  try {
    const dataset = datasetStore.getDataset(sid, req.params.id) || datasetStore.getActiveDataset(sid);
    if (!dataset) {
      return res.status(404).json({ success: false, error: { message: 'Dataset not found.' } });
    }

    const body = req.body || {};
    let action = body.action || body.type;
    if (action === 'formula') action = 'calculated_column';

    const transformReq: TransformRequest = {
      ...body,
      action: action as any,
      calcMode: body.calcMode || (body.expression || body.formula ? 'expression' : body.calcMode),
      newColumnName: body.newColumnName || body.targetColumn,
      expression: body.expression || body.formula,
      column: body.column || body.sourceColumn || body.targetColumn,
      splitCol: body.splitCol || body.column || body.sourceColumn,
      findText: body.findText || body.findValue,
      replaceText: body.replaceText || body.replaceValue,
    };
    const result = performTransformation(dataset.rawRows, dataset.profile, transformReq);

    // Update dataset and record undo snapshot
    const updated = datasetStore.updateExistingDataset(sid, dataset.id, result.transformedData);
    const updatedProfile = updated?.profile || profileDataset(result.transformedData, dataset.filename, dataset.id);

    res.json({
      success: true,
      data: {
        action: result.action,
        summary: result.summary,
        rowsAffected: result.rowsAffected,
        newColumnNames: result.newColumnNames,
        previewDifferences: result.previewDifferences,
        profile: updatedProfile,
        canUndo: datasetStore.canUndo(sid, dataset.id),
      },
    });
  } catch (err: any) {
    console.error('Data transformation error:', err);
    res.status(500).json({ success: false, error: { message: err.message } });
  }
});

// Business Assertion Rule Engine Evaluation Endpoint
app.post('/api/quality/assertions/:id', (req, res) => {
  const sid = getSessionId(req);
  try {
    const dataset = datasetStore.getDataset(sid, req.params.id) || datasetStore.getActiveDataset(sid);
    if (!dataset) {
      return res.status(404).json({ success: false, error: { message: 'Dataset not found.' } });
    }

    const { assertions } = req.body;
    if (!Array.isArray(assertions)) {
      return res.status(400).json({ success: false, error: { message: 'assertions array is required.' } });
    }

    const results = evaluateBusinessAssertions(dataset.rawRows, dataset.profile, assertions);
    res.json({ success: true, data: results });
  } catch (err: any) {
    console.error('Assertion evaluation error:', err);
    res.status(500).json({ success: false, error: { message: err.message } });
  }
});

// Data Dictionary Generation & Export Endpoint
app.get('/api/data-dictionary/:id', (req, res) => {
  const sid = getSessionId(req);
  try {
    const dataset = datasetStore.getDataset(sid, req.params.id) || datasetStore.getActiveDataset(sid);
    if (!dataset) {
      return res.status(404).json({ success: false, error: { message: 'Dataset not found.' } });
    }

    const prof = dataset.profile;
    const columns = prof.columns.map(c => {
      let statsDesc = '-';
      if (c.type === 'numeric') {
        statsDesc = `Min: ${c.min ?? 'N/A'}, Max: ${c.max ?? 'N/A'}, Mean: ${c.mean ?? 'N/A'}, Median: ${c.median ?? 'N/A'}`;
      } else if (c.type === 'categorical' && c.topCategories) {
        statsDesc = `Top: ${c.topCategories.slice(0, 3).map(t => `${t.category} (${t.count})`).join(', ')}`;
      } else if (c.type === 'datetime') {
        statsDesc = `Range: ${c.earliestDate || 'N/A'} to ${c.latestDate || 'N/A'} (${c.dateRangeDays || 0} days)`;
      }

      return {
        name: c.name,
        type: c.type,
        role: c.isIdentifier ? 'Primary Identifier' : c.type === 'numeric' ? 'Quantitative Metric' : c.type === 'datetime' ? 'Temporal Dimension' : 'Categorical Dimension',
        nullCount: c.nullCount,
        nullPercentage: `${c.nullPercentage}%`,
        uniqueCount: c.uniqueCount,
        uniquePercentage: `${c.uniquePercentage}%`,
        sampleValues: c.sampleValues.slice(0, 3).join(', '),
        summaryStatistics: statsDesc,
      };
    });

    // Generate clean markdown documentation
    const mdLines = [
      `# Data Dictionary: ${dataset.filename}`,
      `*Generated on ${new Date().toLocaleDateString()} | Total Rows: ${prof.rowCount.toLocaleString()} | Total Columns: ${prof.columnCount}*`,
      '',
      '| Column Name | Inferred Type | Analytical Role | Null Count (%) | Unique Values | Summary / Distribution | Sample Values |',
      '| :--- | :--- | :--- | :--- | :--- | :--- | :--- |',
      ...columns.map(c => `| **${c.name}** | \`${c.type}\` | ${c.role} | ${c.nullCount} (${c.nullPercentage}) | ${c.uniqueCount} | ${c.summaryStatistics} | ${c.sampleValues} |`),
      '',
      '### Data Quality Overview',
      `- **Duplicate Rows:** ${prof.duplicateRowCount} (${prof.duplicatePercentage}%)`,
      `- **Total Missing Cells:** ${prof.totalMissingCells} (${prof.missingPercentage}%)`,
      `- **Estimated In-Memory Footprint:** ~${prof.memoryEstimateKb} KB`,
    ];

    res.json({
      success: true,
      data: {
        filename: dataset.filename,
        rowCount: prof.rowCount,
        columnCount: prof.columnCount,
        columns,
        markdown: mdLines.join('\n'),
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { message: err.message } });
  }
});

// Reset session application datasets
app.post('/api/reset', (req, res) => {
  const sid = getSessionId(req);
  datasetStore.reset(sid);
  res.json({ success: true, message: 'All datasets reset for current session.' });
});
export default app; export { app };
