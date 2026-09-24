import {
  AnalysisResult,
  AssertionEvaluationResult,
  BusinessAssertion,
  Company360Analysis,
  CorrelationMatrixResult,
  DashboardData,
  DataQualityAudit,
  DatasetListItem,
  DatasetProfile,
  ExecutiveReport,
  InsightItem,
  OutlierDrilldownResult,
  TransformRequest,
  TransformResult,
} from './types.js';
import { generateSchemaGroundedSuggestions } from '../server/suggestion_generator.js';

// Get or initialize persistent client session ID to guarantee data isolation
export function getClientSessionId(): string {
  try {
    let sid = sessionStorage.getItem('pja_agent_session_id');
    if (!sid) {
      sid = `sess_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      sessionStorage.setItem('pja_agent_session_id', sid);
    }
    return sid;
  } catch {
    return 'browser-session';
  }
}

function getHeaders(customHeaders?: Record<string, string>): HeadersInit {
  return {
    'x-session-id': getClientSessionId(),
    ...(customHeaders || {}),
  };
}

// Resilient fetch helper that catches HTML 404s (e.g. from Vercel), network issues, and invalid JSON
async function safeJsonFetch<T = any>(
  url: string,
  options?: RequestInit
): Promise<{ ok: boolean; data: T | null; status: number; errorMsg?: string }> {
  try {
    const res = await fetch(url, options);
    const contentType = res.headers.get('content-type') || '';

    // If HTTP status is not ok (e.g. 404, 500)
    if (!res.ok) {
      const text = await res.text();
      try {
        const json = JSON.parse(text);
        const errStr = typeof json.error === 'string' ? json.error : (json.error?.message || json.message);
        return { ok: false, data: json, status: res.status, errorMsg: errStr };
      } catch {
        return { ok: false, data: null, status: res.status, errorMsg: `HTTP ${res.status}` };
      }
    }

    if (contentType.includes('application/json')) {
      const json = await res.json();
      return { ok: true, data: json, status: res.status };
    }

    const text = await res.text();
    try {
      const json = JSON.parse(text);
      return { ok: true, data: json, status: res.status };
    } catch {
      return { ok: false, data: null, status: res.status, errorMsg: 'Response is not valid JSON' };
    }
  } catch (err: any) {
    return { ok: false, data: null, status: 0, errorMsg: err?.message || 'Network error' };
  }
}

export async function fetchDatasets(): Promise<{ datasets: DatasetListItem[]; activeId?: string }> {
  const res = await safeJsonFetch<{ success: boolean; data: DatasetListItem[]; activeDatasetId?: string }>('/api/datasets', {
    headers: getHeaders(),
  });
  if (res.ok && res.data && res.data.success !== false && Array.isArray(res.data.data)) {
    return {
      datasets: res.data.data,
      activeId: res.data.activeDatasetId,
    };
  }
  return {
    datasets: [],
    activeId: undefined,
  };
}

export async function switchActiveDataset(id: string): Promise<DatasetProfile> {
  const res = await safeJsonFetch<{ success: boolean; data: DatasetProfile; error?: any }>(`/api/datasets/active/${id}`, {
    method: 'POST',
    headers: getHeaders(),
  });
  if (res.ok && res.data && res.data.success && res.data.data) {
    return res.data.data;
  }
  throw new Error(res.errorMsg || res.data?.error?.message || `Failed to activate dataset '${id}'`);
}

export async function loadSampleDataset(): Promise<{ profile: DatasetProfile; quality: DataQualityAudit; insights: InsightItem[] }> {
  const res = await safeJsonFetch<{ success: boolean; data: { profile: DatasetProfile; quality: DataQualityAudit; insights: InsightItem[] } }>(
    '/api/sample',
    {
      method: 'POST',
      headers: getHeaders(),
    }
  );
  if (res.ok && res.data && res.data.success && res.data.data) {
    return res.data.data;
  }
  throw new Error(res.errorMsg || 'Failed to load sample dataset from server.');
}

export async function loadEnterpriseCompanySuite(): Promise<{ datasets: DatasetListItem[]; activeId?: string }> {
  const res = await safeJsonFetch<{
    success: boolean;
    data: { datasets: DatasetListItem[]; activeDatasetId?: string };
  }>('/api/sample-company-suite', {
    method: 'POST',
    headers: getHeaders(),
  });
  if (res.ok && res.data && res.data.success && res.data.data) {
    return {
      datasets: res.data.data.datasets,
      activeId: res.data.data.activeDatasetId,
    };
  }
  throw new Error(res.errorMsg || 'Failed to load enterprise company suite from server.');
}

export async function uploadBatchDatasets(files: File[]): Promise<{ uploadedCount: number; datasets: any[]; activeId?: string }> {
  const formData = new FormData();
  files.forEach(f => formData.append('files', f));

  const res = await safeJsonFetch<{
    success: boolean;
    data: { uploadedCount: number; datasets: any[]; activeDatasetId?: string };
  }>('/api/upload-batch', {
    method: 'POST',
    headers: { 'x-session-id': getClientSessionId() },
    body: formData,
  });

  if (res.ok && res.data && res.data.success && res.data.data) {
    return {
      uploadedCount: res.data.data.uploadedCount,
      datasets: res.data.data.datasets,
      activeId: res.data.data.activeDatasetId,
    };
  }
  throw new Error(res.errorMsg || 'Failed to upload batch datasets to server.');
}

export async function fetchCompany360Analysis(directive?: string): Promise<Company360Analysis> {
  const q = directive ? `?directive=${encodeURIComponent(directive)}` : '';
  const res = await safeJsonFetch<{ success: boolean; data: Company360Analysis }>(`/api/company-360${q}`, {
    headers: getHeaders(),
  });
  if (res.ok && res.data && res.data.success && res.data.data) {
    return res.data.data;
  }
  throw new Error(res.errorMsg || 'Failed to fetch Company 360 analysis from server.');
}

export async function refineCompany360Analysis(directive: string): Promise<Company360Analysis> {
  const res = await safeJsonFetch<{ success: boolean; data: Company360Analysis }>('/api/company-360/refine', {
    method: 'POST',
    headers: {
      ...getHeaders(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ directive }),
  });
  if (res.ok && res.data && res.data.success && res.data.data) {
    return res.data.data;
  }
  throw new Error(res.errorMsg || 'Failed to refine Company 360 analysis on server.');
}

export async function uploadDataset(file: File): Promise<{ datasetId: string; profile: DatasetProfile; quality: DataQualityAudit; insights: InsightItem[] }> {
  const formData = new FormData();
  formData.append('file', file);

  const res = await safeJsonFetch<{
    success: boolean;
    data: { datasetId: string; profile: DatasetProfile; quality: DataQualityAudit; insights: InsightItem[] };
  }>('/api/upload', {
    method: 'POST',
    headers: { 'x-session-id': getClientSessionId() },
    body: formData,
  });

  if (res.ok && res.data && res.data.success && res.data.data) {
    return res.data.data;
  }
  throw new Error(res.errorMsg || 'Failed to upload dataset to server.');
}

export async function fetchProfile(datasetId: string): Promise<DatasetProfile> {
  const res = await safeJsonFetch<{ success: boolean; data: DatasetProfile; error?: any }>(`/api/profile/${datasetId}`, {
    headers: getHeaders(),
  });
  if (res.ok && res.data && res.data.success && res.data.data) {
    return res.data.data;
  }
  throw new Error(res.errorMsg || res.data?.error?.message || `Failed to fetch profile for dataset '${datasetId}'`);
}

export async function fetchQuality(datasetId: string): Promise<DataQualityAudit> {
  const res = await safeJsonFetch<{ success: boolean; data: DataQualityAudit; error?: any }>(`/api/quality/${datasetId}`, {
    headers: getHeaders(),
  });
  if (res.ok && res.data && res.data.success && res.data.data) {
    return res.data.data;
  }
  throw new Error(res.errorMsg || res.data?.error?.message || `Failed to fetch quality audit for dataset '${datasetId}'`);
}

export async function fetchInsights(datasetId: string): Promise<InsightItem[]> {
  const res = await safeJsonFetch<{ success: boolean; data: InsightItem[]; error?: any }>(`/api/insights/${datasetId}`, {
    headers: getHeaders(),
  });
  if (res.ok && res.data && res.data.success && res.data.data) {
    return res.data.data;
  }
  throw new Error(res.errorMsg || res.data?.error?.message || `Failed to fetch insights for dataset '${datasetId}'`);
}

export async function fetchCorrelationMatrix(datasetId: string): Promise<CorrelationMatrixResult> {
  const res = await safeJsonFetch<{ success: boolean; data: CorrelationMatrixResult; error?: any }>(`/api/correlation-matrix/${datasetId}`, {
    headers: getHeaders(),
  });
  if (res.ok && res.data && res.data.success && res.data.data) {
    return res.data.data;
  }
  throw new Error(res.errorMsg || res.data?.error?.message || `Failed to fetch correlation matrix for dataset '${datasetId}'`);
}

export async function fetchOutlierDrilldown(datasetId: string, column?: string): Promise<OutlierDrilldownResult> {
  const query = column ? `?column=${encodeURIComponent(column)}` : '';
  const res = await safeJsonFetch<{ success: boolean; data: OutlierDrilldownResult; error?: any }>(`/api/outlier-drilldown/${datasetId}${query}`, {
    headers: getHeaders(),
  });
  if (res.ok && res.data && res.data.success && res.data.data) {
    return res.data.data;
  }
  throw new Error(res.errorMsg || res.data?.error?.message || `Failed to fetch outlier drilldown for dataset '${datasetId}'`);
}

export async function askDataQuery(
  datasetId: string,
  question: string,
  conversationHistory?: { question: string; answerSummary?: string; plan?: any }[]
): Promise<AnalysisResult> {
  const res = await safeJsonFetch<AnalysisResult>(`/api/query/${datasetId}`, {
    method: 'POST',
    headers: getHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ question, conversationHistory }),
  });
  if (res.data && (res.data.success !== undefined || res.data.answer)) {
    return res.data;
  }
  return {
    success: false,
    question,
    datasetId,
    plan: null as any,
    answer: res.errorMsg || 'Failed to communicate with server analysis engine.',
    keyMetrics: [],
    businessInterpretation: [],
    dataHandling: {
      totalRows: 0,
      validRowsAnalyzed: 0,
      excludedRows: 0,
      missingValuesExcluded: 0,
      invalidValuesExcluded: 0,
      filteredOutRows: 0,
      methodDescription: 'Server connection failed.',
      rulesApplied: [],
      warnings: [res.errorMsg || 'Server error'],
      confidenceScore: 0,
      isDeterministic: true,
    },
    error: {
      code: 'SERVER_ERROR',
      message: res.errorMsg || 'Failed to communicate with server analysis engine.',
    },
  };
}

export async function generateCustomChart(
  datasetId: string,
  params: {
    type: string;
    xAxis?: string;
    yAxis?: string;
    secondaryYAxis?: string;
    colorDimension?: string;
    aggregation?: string;
    sortBy?: string;
    sortDirection?: string;
    topN?: number;
  }
): Promise<{ chart: any; dataHandling?: any; summaryMetrics?: any[] }> {
  const res = await safeJsonFetch<any>(
    `/api/chart/${datasetId}`,
    {
      method: 'POST',
      headers: getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(params),
    }
  );

  if (res.ok && res.data && res.data.success !== false) {
    const chart = res.data.chart || res.data.data?.chart;
    if (chart) {
      return {
        chart,
        dataHandling: res.data.dataHandling || res.data.data?.dataHandling,
        summaryMetrics: res.data.summaryMetrics || res.data.data?.summaryMetrics,
      };
    }
  }

  throw new Error(res.errorMsg || res.data?.error?.message || 'Failed to generate visualization');
}

export async function fetchExplorerData(
  datasetId: string,
  params: { page: number; pageSize: number; search?: string; sortCol?: string; sortDir?: string }
) {
  const query = new URLSearchParams({
    page: params.page.toString(),
    pageSize: params.pageSize.toString(),
    search: params.search || '',
    sortCol: params.sortCol || '',
    sortDir: params.sortDir || 'asc',
  });
  const res = await safeJsonFetch<{ success: boolean; data: any }>(`/api/data/${datasetId}?${query.toString()}`, {
    headers: getHeaders(),
  });
  if (res.ok && res.data && res.data.success && res.data.data) {
    return res.data.data;
  }
  throw new Error(res.errorMsg || 'Failed to fetch explorer data from server.');
}

export async function executeCleanAction(
  datasetId: string,
  params: {
    action: string;
    column?: string;
    constantValue?: any;
    saveAsNew?: boolean;
  }
) {
  const res = await safeJsonFetch<{ success: boolean; data: any }>(`/api/clean/${datasetId}`, {
    method: 'POST',
    headers: getHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(params),
  });
  if (res.ok && res.data && res.data.success && res.data.data) {
    return res.data.data;
  }
  throw new Error(res.errorMsg || (res.data as any)?.error?.message || 'Failed to perform cleaning action on server.');
}

export async function undoCleaningAction(datasetId: string) {
  const res = await safeJsonFetch<{ success: boolean; data: any }>(`/api/clean/undo/${datasetId}`, {
    method: 'POST',
    headers: getHeaders(),
  });
  if (res.ok && res.data && res.data.success && res.data.data) {
    return res.data.data;
  }
  throw new Error(res.errorMsg || (res.data as any)?.error?.message || 'Failed to undo cleaning action on server.');
}

export async function checkCanUndo(datasetId: string): Promise<boolean> {
  const res = await safeJsonFetch<{ success: boolean; canUndo: boolean }>(`/api/clean/can-undo/${datasetId}`, {
    headers: getHeaders(),
  });
  if (res.ok && res.data && typeof res.data.canUndo === 'boolean') {
    return res.data.canUndo;
  }
  return false;
}

export async function generateReproducibleCode(params: {
  filename?: string;
  metric?: string;
  xAxis?: string;
  yAxis?: string;
  aggregation?: string;
  sortDirection?: string;
  limit?: number;
}): Promise<{ python: string; sql: string }> {
  const res = await safeJsonFetch<{ success: boolean; data: { python: string; sql: string } }>('/api/generate-code', {
    method: 'POST',
    headers: getHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(params),
  });
  if (res.ok && res.data && res.data.success && res.data.data) {
    return res.data.data;
  }
  const fName = params.filename || 'dataset.csv';
  const xCol = (params.xAxis || 'category').replace(/"/g, '""');
  const yCol = (params.yAxis || 'value').replace(/"/g, '""');
  const pyAgg = params.aggregation === 'mean' || params.aggregation === 'avg' ? 'mean()' : `${params.aggregation || 'sum'}()`;
  const sqlAgg = params.aggregation === 'mean' || params.aggregation === 'avg' ? 'AVG' : (params.aggregation?.toUpperCase() || 'SUM');
  const py = `# Reproducible Python Code for ${fName}\nimport pandas as pd\ndf = pd.read_csv("${fName}")\nprint(df.groupby("${params.xAxis || 'category'}")["${params.yAxis || 'value'}"].${pyAgg})`;
  const sql = `-- Reproducible SQL Query for ${fName}\nSELECT "${xCol}", ${sqlAgg}("${yCol}") AS aggregate_metric\nFROM dataset\nGROUP BY 1\nORDER BY 2 ${params.sortDirection?.toUpperCase() || 'DESC'}\nLIMIT ${params.limit || 20};`;
  return { python: py, sql };
}

export interface SqlExecutionResponse {
  success: boolean;
  columns: string[];
  rows: Record<string, any>[];
  totalCount: number;
  executionTimeMs: number;
  error?: string;
}

export async function executeSql(datasetId: string, query: string): Promise<SqlExecutionResponse> {
  const res = await safeJsonFetch<SqlExecutionResponse>(`/api/sql/${datasetId}`, {
    method: 'POST',
    headers: getHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ query }),
  });
  if (res.ok && res.data) {
    return res.data;
  }
  return {
    success: false,
    columns: [],
    rows: [],
    totalCount: 0,
    executionTimeMs: 0,
    error: res.errorMsg || 'Failed to execute SQL query on dataset.',
  };
}

export async function exportFilteredSubset(
  datasetId: string,
  params: { format: 'csv' | 'json'; search?: string; sortCol?: string; sortDir?: string }
): Promise<Blob> {
  const res = await fetch(`/api/export-subset/${datasetId}`, {
    method: 'POST',
    headers: getHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(params),
  });
  if (res.ok) {
    return await res.blob();
  }
  throw new Error('Failed to export subset from server.');
}

export async function fetchDashboardData(
  datasetId: string,
  params?: {
    dimension?: string;
    metric?: string;
    secondaryMetric?: string;
    filterCol?: string;
    filterVal?: string;
    timeCol?: string;
    timeGrain?: string;
  }
): Promise<DashboardData> {
  const query = new URLSearchParams();
  if (params?.dimension) query.set('dimension', params.dimension);
  if (params?.metric) query.set('metric', params.metric);
  if (params?.secondaryMetric) query.set('secondaryMetric', params.secondaryMetric);
  if (params?.filterCol) query.set('filterCol', params.filterCol);
  if (params?.filterVal) query.set('filterVal', params.filterVal);
  if (params?.timeCol) query.set('timeCol', params.timeCol);
  if (params?.timeGrain) query.set('timeGrain', params.timeGrain);

  const url = `/api/dashboard/${datasetId}?${query.toString()}`;
  const res = await safeJsonFetch<{ success: boolean; data: DashboardData }>(url, { headers: getHeaders() });
  if (res.ok && res.data && res.data.success && res.data.data) {
    return res.data.data;
  }
  throw new Error(res.errorMsg || 'Failed to fetch dashboard data from server.');
}

export async function applyTransformation(
  datasetId: string,
  params: TransformRequest
): Promise<TransformResult> {
  const res = await safeJsonFetch<{ success: boolean; data: TransformResult }>(`/api/transform/${datasetId}`, {
    method: 'POST',
    headers: getHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(params),
  });
  if (res.ok && res.data && res.data.success && res.data.data) {
    return res.data.data;
  }
  throw new Error(res.errorMsg || (res.data as any)?.error?.message || 'Failed to apply transformation on server.');
}

export async function evaluateBusinessAssertions(
  datasetId: string,
  assertions: BusinessAssertion[]
): Promise<AssertionEvaluationResult[]> {
  const res = await safeJsonFetch<{ success: boolean; data: AssertionEvaluationResult[] }>(`/api/quality/assertions/${datasetId}`, {
    method: 'POST',
    headers: getHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ assertions }),
  });
  if (res.ok && res.data && res.data.success && res.data.data) {
    return res.data.data;
  }
  throw new Error(res.errorMsg || (res.data as any)?.error?.message || 'Failed to evaluate assertions on server.');
}

export async function fetchDataDictionary(
  datasetId: string
): Promise<{ filename: string; rowCount: number; columnCount: number; columns: any[]; markdown: string }> {
  const res = await safeJsonFetch<{ success: boolean; data: any }>(`/api/data-dictionary/${datasetId}`, {
    headers: getHeaders(),
  });
  if (res.ok && res.data && res.data.success && res.data.data) {
    return res.data.data;
  }
  throw new Error(res.errorMsg || (res.data as any)?.error?.message || 'Failed to fetch data dictionary from server.');
}

export async function fetchExecutiveReport(datasetId: string, useAi = true, directive?: string): Promise<ExecutiveReport> {
  const res = await safeJsonFetch<{ success: boolean; data: ExecutiveReport }>(`/api/report/${datasetId}`, {
    method: 'POST',
    headers: getHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ useAi, directive }),
  });
  if (res.ok && res.data && res.data.success && res.data.data) {
    return res.data.data;
  }
  throw new Error(res.errorMsg || 'Failed to generate executive report from server.');
}

export async function refineReportSection(
  datasetId: string,
  params: {
    section: 'headline' | 'overview' | 'macroContext' | 'strengths' | 'risks' | 'actionPlan' | 'singleAction';
    instruction: string;
    currentContent: any;
  }
): Promise<any> {
  const res = await safeJsonFetch<{ success: boolean; data: any }>(`/api/report/${datasetId}/refine-section`, {
    method: 'POST',
    headers: getHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(params),
  });
  if (res.ok && res.data && res.data.success && res.data.data !== undefined) {
    return res.data.data;
  }
  return null;
}

export {
  generateSchemaGroundedSuggestions,
  validateSuggestedQuestion,
  detectDatasetDomain,
} from '../server/suggestion_generator.js';

export async function fetchSuggestedQuestions(
  datasetId: string,
  profile: DatasetProfile,
  options?: { lastQuestion?: string; lastResult?: any; count?: number }
): Promise<string[]> {
  const res = await safeJsonFetch<{ success: boolean; data: string[] }>(`/api/suggestions/${datasetId}`, {
    method: 'POST',
    headers: getHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(options || {}),
  });
  if (res.ok && res.data && res.data.success && Array.isArray(res.data.data) && res.data.data.length > 0) {
    return res.data.data;
  }
  return generateSchemaGroundedSuggestions(profile);
}
