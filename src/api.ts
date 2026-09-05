import { clientEngine } from './clientEngine.js';
import {
  AnalysisResult,
  AssertionEvaluationResult,
  BusinessAssertion,
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
        return { ok: false, data: json, status: res.status, errorMsg: json.error?.message || json.message };
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
  // Seamless client engine fallback
  const fallback = clientEngine.listDatasets();
  return {
    datasets: fallback.datasets.map(d => ({
      id: d.id,
      filename: d.filename,
      rowCount: d.rowCount,
      columnCount: d.columnCount,
      isSample: d.isSample,
      createdAt: d.createdAt,
    })),
    activeId: fallback.activeId,
  };
}

export async function switchActiveDataset(id: string): Promise<DatasetProfile> {
  const res = await safeJsonFetch<{ success: boolean; data: DatasetProfile }>(`/api/datasets/active/${id}`, {
    method: 'POST',
    headers: getHeaders(),
  });
  if (res.ok && res.data && res.data.success && res.data.data) {
    return res.data.data;
  }
  const prof = clientEngine.setActiveDataset(id);
  if (!prof) throw new Error('Dataset not found in storage');
  return prof;
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
  // Autonomous browser engine generation
  return clientEngine.initSampleDataset();
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

  // Client-side parser fallback
  const clientRes = await clientEngine.uploadDataset(file);
  return {
    datasetId: clientRes.profile.id,
    profile: clientRes.profile,
    quality: clientRes.quality,
    insights: clientRes.insights,
  };
}

export async function fetchProfile(datasetId: string): Promise<DatasetProfile> {
  const res = await safeJsonFetch<{ success: boolean; data: DatasetProfile }>(`/api/profile/${datasetId}`, {
    headers: getHeaders(),
  });
  if (res.ok && res.data && res.data.success && res.data.data) {
    return res.data.data;
  }
  const ds = clientEngine.getDataset(datasetId);
  if (ds) return ds.profile;
  throw new Error(res.errorMsg || 'Failed to fetch profile');
}

export async function fetchQuality(datasetId: string): Promise<DataQualityAudit> {
  const res = await safeJsonFetch<{ success: boolean; data: DataQualityAudit }>(`/api/quality/${datasetId}`, {
    headers: getHeaders(),
  });
  if (res.ok && res.data && res.data.success && res.data.data) {
    return res.data.data;
  }
  const ds = clientEngine.getDataset(datasetId);
  if (ds) return ds.qualityAudit;
  throw new Error(res.errorMsg || 'Failed to fetch quality audit');
}

export async function fetchInsights(datasetId: string): Promise<InsightItem[]> {
  const res = await safeJsonFetch<{ success: boolean; data: InsightItem[] }>(`/api/insights/${datasetId}`, {
    headers: getHeaders(),
  });
  if (res.ok && res.data && res.data.success && res.data.data) {
    return res.data.data;
  }
  const ds = clientEngine.getDataset(datasetId);
  if (ds) return ds.insights;
  throw new Error(res.errorMsg || 'Failed to fetch insights');
}

export async function fetchCorrelationMatrix(datasetId: string): Promise<CorrelationMatrixResult> {
  const res = await safeJsonFetch<{ success: boolean; data: CorrelationMatrixResult }>(`/api/correlation-matrix/${datasetId}`, {
    headers: getHeaders(),
  });
  if (res.ok && res.data && res.data.success && res.data.data) {
    return res.data.data;
  }
  return clientEngine.getCorrelationMatrix(datasetId);
}

export async function fetchOutlierDrilldown(datasetId: string, column?: string): Promise<OutlierDrilldownResult> {
  const query = column ? `?column=${encodeURIComponent(column)}` : '';
  const res = await safeJsonFetch<{ success: boolean; data: OutlierDrilldownResult }>(`/api/outlier-drilldown/${datasetId}${query}`, {
    headers: getHeaders(),
  });
  if (res.ok && res.data && res.data.success && res.data.data) {
    return res.data.data;
  }
  return clientEngine.getOutlierDrilldown(datasetId, column);
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
  if (res.ok && res.data && (res.data.success !== false || res.data.answer)) {
    return res.data;
  }
  const lastPlan = conversationHistory && conversationHistory.length > 0 ? conversationHistory[0].plan : undefined;
  return clientEngine.askData(datasetId, question, lastPlan);
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
  const res = await safeJsonFetch<{ success: boolean; data: { chart: any; dataHandling?: any; summaryMetrics?: any[] } }>(
    `/api/chart/${datasetId}`,
    {
      method: 'POST',
      headers: getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(params),
    }
  );
  if (res.ok && res.data && res.data.success && res.data.data) {
    return res.data.data;
  }
  const chart = clientEngine.generateCustomChart(datasetId, {
    type: params.type,
    xAxis: params.xAxis || 'Category',
    yAxis: params.yAxis,
    aggregation: params.aggregation,
  });
  return { chart };
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
  return clientEngine.getExplorerData(datasetId, {
    page: params.page,
    pageSize: params.pageSize,
    search: params.search,
    sortColumn: params.sortCol,
    sortDirection: params.sortDir as any,
  });
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
  return clientEngine.cleanDataset(datasetId, params.action, params.column, params.constantValue);
}

export async function undoCleaningAction(datasetId: string) {
  const res = await safeJsonFetch<{ success: boolean; data: any }>(`/api/clean/undo/${datasetId}`, {
    method: 'POST',
    headers: getHeaders(),
  });
  if (res.ok && res.data && res.data.success && res.data.data) {
    return res.data.data;
  }
  return clientEngine.undoCleanDataset(datasetId);
}

export async function checkCanUndo(datasetId: string): Promise<boolean> {
  const res = await safeJsonFetch<{ success: boolean; canUndo: boolean }>(`/api/clean/can-undo/${datasetId}`, {
    headers: getHeaders(),
  });
  if (res.ok && res.data && typeof res.data.canUndo === 'boolean') {
    return res.data.canUndo;
  }
  return clientEngine.checkCanUndo(datasetId).canUndo;
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
  const py = `# Reproducible Python Code for ${fName}\nimport pandas as pd\ndf = pd.read_csv("${fName}")\nprint(df.groupby("${params.xAxis || 'category'}")["${params.yAxis || 'value'}"].${params.aggregation || 'sum'}())`;
  const sql = `-- Reproducible SQL Query for ${fName}\nSELECT ${params.xAxis || 'category'}, ${params.aggregation?.toUpperCase() || 'SUM'}(${params.yAxis || 'value'}) AS aggregate_metric\nFROM dataset\nGROUP BY 1\nORDER BY 2 ${params.sortDirection?.toUpperCase() || 'DESC'}\nLIMIT ${params.limit || 20};`;
  return { python: py, sql };
}

export async function exportFilteredSubset(
  datasetId: string,
  params: { format: 'csv' | 'json'; search?: string; sortCol?: string; sortDir?: string }
): Promise<Blob> {
  try {
    const res = await fetch(`/api/export-subset/${datasetId}`, {
      method: 'POST',
      headers: getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(params),
    });
    if (res.ok) {
      return await res.blob();
    }
  } catch {
    // Fall back to browser engine
  }
  const csvContent = clientEngine.exportSubset(datasetId, {
    search: params.search,
    sortColumn: params.sortCol,
    sortDirection: params.sortDir as any,
  });
  return new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
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
  return clientEngine.getDashboardData(datasetId, {
    dimension: params?.dimension,
    metric: params?.metric,
    timeFilter: params?.filterVal,
    categoryFilter: params?.filterVal,
    timeGranularity: params?.timeGrain,
  }) as unknown as DashboardData;
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
  const tRes = clientEngine.transformDataset(datasetId, params);
  return {
    ...tRes.result,
    canUndo: true,
  };
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
  return clientEngine.evaluateAssertions(datasetId, assertions);
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
  const dict = clientEngine.getDataDictionary(datasetId);
  return {
    filename: dict.profile.filename,
    rowCount: dict.profile.rowCount,
    columnCount: dict.profile.columnCount,
    columns: dict.columns,
    markdown: dict.markdown,
  };
}

export async function fetchExecutiveReport(datasetId: string, useAi = true): Promise<ExecutiveReport> {
  const res = await safeJsonFetch<{ success: boolean; data: ExecutiveReport }>(`/api/report/${datasetId}`, {
    method: 'POST',
    headers: getHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ useAi }),
  });
  if (res.ok && res.data && res.data.success && res.data.data) {
    return res.data.data;
  }
  return clientEngine.getExecutiveReport(datasetId);
}
