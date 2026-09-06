import Papa from 'papaparse';
import { clientEngine } from '../clientEngine.js';

/**
 * Universal safe CSV exporter that works inside sandboxed iframes.
 * Avoids window.location.href navigation bugs.
 */
export async function downloadDatasetCsv(datasetId: string, filename: string): Promise<void> {
  const safeFilename = filename.toLowerCase().endsWith('.csv') ? filename : `${filename}.csv`;

  // 1. Check if client storage has the dataset
  const clientData = clientEngine.getDataset(datasetId);
  if (clientData && clientData.rawRows && clientData.rawRows.length > 0) {
    const csvContent = Papa.unparse(clientData.rawRows);
    triggerBlobDownload(csvContent, safeFilename, 'text/csv;charset=utf-8;');
    return;
  }

  // 2. Otherwise fetch from backend API using fetch + blob download
  try {
    const response = await fetch(`/api/export/${datasetId}`);
    if (!response.ok) {
      throw new Error(`Export failed with HTTP ${response.status}`);
    }
    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = safeFilename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(blobUrl);
  } catch (err) {
    console.error('API export failed, checking fallback:', err);
    throw new Error('Unable to export CSV: Dataset content not reachable.');
  }
}

function triggerBlobDownload(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const blobUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(blobUrl);
}
