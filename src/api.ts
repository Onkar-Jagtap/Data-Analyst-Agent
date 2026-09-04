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

export async function fetchDatasets(): Promise<{ datasets: DatasetListItem[]; activeId?: string }> {
  const res = await fetch('/api/datasets', { headers: getHeaders() });
  const json = await res.json();
  return {
    datasets: json.data || [],
    activeId: json.activeDatasetId,
  };
}

export async function switchActiveDataset(id: string): Promise<DatasetProfile> {
  const res = await fetch(`/api/datasets/active/${id}`, {
    method: 'POST',
    headers: getHeaders(),
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error?.message || 'Failed to switch dataset');
  return json.data;
}

export async function loadSampleDataset(): Promise<{ profile: DatasetProfile; quality: DataQualityAudit; insights: InsightItem[] }> {
  const res = await fetch('/api/sample', {
    method: 'POST',
    headers: getHeaders(),
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error?.message || 'Failed to load sample dataset');
  return json.data;
}

export async function uploadDataset(file: File): Promise<{ datasetId: string; profile: DatasetProfile; quality: DataQualityAudit; insights: InsightItem[] }> {
  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch('/api/upload', {
    method: 'POST',
    headers: { 'x-session-id': getClientSessionId() },
    body: formData,
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error?.message || 'Upload failed');
  return json.data;
}

export async function fetchProfile(datasetId: string): Promise<DatasetProfile> {
  const res = await fetch(`/api/profile/${datasetId}`, { headers: getHeaders() });
  const json = await res.json();
  if (!json.success) throw new Error(json.error?.message || 'Failed to fetch profile');
  return json.data;
}

export async function fetchQuality(datasetId: string): Promise<DataQualityAudit> {
  const res = await fetch(`/api/quality/${datasetId}`, { headers: getHeaders() });
  const json = await res.json();
  if (!json.success) throw new Error(json.error?.message || 'Failed to fetch quality audit');
  return json.data;
}

export async function fetchInsights(datasetId: string): Promise<InsightItem[]> {
  const res = await fetch(`/api/insights/${datasetId}`, { headers: getHeaders() });
  const json = await res.json();
  if (!json.success) throw new Error(json.error?.message || 'Failed to fetch insights');
  return json.data;
}

export async function fetchCorrelationMatrix(datasetId: string): Promise<CorrelationMatrixResult> {
  const res = await fetch(`/api/correlation-matrix/${datasetId}`, { headers: getHeaders() });
  const json = await res.json();
  if (!json.success) throw new Error(json.error?.message || 'Failed to fetch correlation matrix');
  return json.data;
}

export async function fetchOutlierDrilldown(datasetId: string, column?: string): Promise<OutlierDrilldownResult> {
  const query = column ? `?column=${encodeURIComponent(column)}` : '';
  const res = await fetch(`/api/outlier-drilldown/${datasetId}${query}`, { headers: getHeaders() });
  const json = await res.json();
  if (!json.success) throw new Error(json.error?.message || 'Failed to fetch outlier drilldown');
  return json.data;
}

export async function askDataQuery(
  datasetId: string,
  question: string,
  conversationHistory?: { question: string; answerSummary?: string; plan?: any }[]
): Promise<AnalysisResult> {
  const res = await fetch(`/api/query/${datasetId}`, {
    method: 'POST',
    headers: getHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ question, conversationHistory }),
  });
  const json = await res.json();
  return json;
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
  const res = await fetch(`/api/chart/${datasetId}`, {
    method: 'POST',
    headers: getHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(params),
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error?.message || 'Failed to generate chart');
  return json;
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
  const res = await fetch(`/api/data/${datasetId}?${query.toString()}`, { headers: getHeaders() });
  const json = await res.json();
  if (!json.success) throw new Error(json.error?.message || 'Failed to fetch rows');
  return json.data;
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
  const res = await fetch(`/api/clean/${datasetId}`, {
    method: 'POST',
    headers: getHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(params),
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error?.message || 'Cleaning action failed');
  return json.data;
}

export async function undoCleaningAction(datasetId: string) {
  const res = await fetch(`/api/clean/undo/${datasetId}`, {
    method: 'POST',
    headers: getHeaders(),
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error?.message || 'Undo action failed');
  return json;
}

export async function checkCanUndo(datasetId: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/clean/can-undo/${datasetId}`, { headers: getHeaders() });
    const json = await res.json();
    return !!json.canUndo;
  } catch {
    return false;
  }
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
  const res = await fetch('/api/generate-code', {
    method: 'POST',
    headers: getHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(params),
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error?.message || 'Failed to generate code');
  return json.data;
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
  if (!res.ok) throw new Error('Export subset failed');
  return await res.blob();
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
  const res = await fetch(url, { headers: getHeaders() });
  const json = await res.json();
  if (!json.success) throw new Error(json.error?.message || 'Failed to load dashboard data');
  return json.data;
}

export async function applyTransformation(
  datasetId: string,
  params: TransformRequest
): Promise<TransformResult> {
  const res = await fetch(`/api/transform/${datasetId}`, {
    method: 'POST',
    headers: getHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(params),
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error?.message || 'Transformation failed');
  return json.data;
}

export async function evaluateBusinessAssertions(
  datasetId: string,
  assertions: BusinessAssertion[]
): Promise<AssertionEvaluationResult[]> {
  const res = await fetch(`/api/quality/assertions/${datasetId}`, {
    method: 'POST',
    headers: getHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ assertions }),
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error?.message || 'Assertion evaluation failed');
  return json.data;
}

export async function fetchDataDictionary(
  datasetId: string
): Promise<{ filename: string; rowCount: number; columnCount: number; columns: any[]; markdown: string }> {
  const res = await fetch(`/api/data-dictionary/${datasetId}`, { headers: getHeaders() });
  const json = await res.json();
  if (!json.success) throw new Error(json.error?.message || 'Failed to generate data dictionary');
  return json.data;
}

export async function fetchExecutiveReport(datasetId: string, useAi = true): Promise<ExecutiveReport> {
  const res = await fetch(`/api/report/${datasetId}`, {
    method: 'POST',
    headers: getHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ useAi }),
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error?.message || 'Failed to generate executive report');
  return json.data;
}


