import { DataQualityAudit, DatasetProfile, InsightItem } from './types.js';
import { profileDataset } from './profiler.js';
import { auditDataQuality } from './quality.js';
import { generateAutomatedInsights } from './insights.js';
import { generateSampleBusinessDataset } from './sample_data.js';

export interface StoredDataset {
  id: string;
  filename: string;
  rawRows: Record<string, any>[];
  profile: DatasetProfile;
  qualityAudit: DataQualityAudit;
  insights: InsightItem[];
  isSample: boolean;
  createdAt: string;
}

interface SessionData {
  id: string;
  datasets: Map<string, StoredDataset>;
  activeDatasetId: string | null;
  undoHistory: Map<string, Record<string, any>[][]>;
  lastAccessed: number;
}

const MAX_SESSIONS = 100;
const SESSION_TTL_MS = 4 * 60 * 60 * 1000; // 4 hours
const MAX_DATASETS_PER_SESSION = 10;
const MAX_UNDO_STACK = 5;

class MultiSessionDatasetStore {
  private sessions: Map<string, SessionData> = new Map();
  private masterSampleRows: Record<string, any>[] | null = null;

  constructor() {
    // Pre-cache sample rows template
    this.masterSampleRows = generateSampleBusinessDataset();
  }

  private cleanStaleSessions(): void {
    const now = Date.now();
    for (const [sid, sess] of this.sessions.entries()) {
      if (now - sess.lastAccessed > SESSION_TTL_MS) {
        this.sessions.delete(sid);
      }
    }
    // If still too many sessions, evict oldest
    if (this.sessions.size > MAX_SESSIONS) {
      const sorted = Array.from(this.sessions.entries()).sort((a, b) => a[1].lastAccessed - b[1].lastAccessed);
      const toRemove = sorted.slice(0, this.sessions.size - MAX_SESSIONS);
      for (const [sid] of toRemove) {
        this.sessions.delete(sid);
      }
    }
  }

  public getSession(sessionId?: string): SessionData {
    this.cleanStaleSessions();
    const sid = sessionId && sessionId.trim() !== '' ? sessionId.trim() : 'default-session';
    let session = this.sessions.get(sid);
    if (!session) {
      session = {
        id: sid,
        datasets: new Map(),
        activeDatasetId: null,
        undoHistory: new Map(),
        lastAccessed: Date.now(),
      };
      this.sessions.set(sid, session);
      this.initSample(sid);
    } else {
      session.lastAccessed = Date.now();
    }
    return session;
  }

  public initSample(sessionId: string): StoredDataset {
    const session = this.sessions.get(sessionId) || this.getSession(sessionId);
    const sampleId = `sample-b2b-sales-${sessionId.slice(-4)}`;

    if (session.datasets.has(sampleId)) {
      session.activeDatasetId = sampleId;
      return session.datasets.get(sampleId)!;
    }

    const rows = (this.masterSampleRows || generateSampleBusinessDataset()).map(r => ({ ...r }));
    const profile = profileDataset(rows, 'enterprise_sales_sample.csv', sampleId);
    const qualityAudit = auditDataQuality(rows, profile);
    const insights = generateAutomatedInsights(rows, profile);

    const stored: StoredDataset = {
      id: sampleId,
      filename: 'enterprise_sales_sample.csv',
      rawRows: rows,
      profile,
      qualityAudit,
      insights,
      isSample: true,
      createdAt: new Date().toISOString(),
    };

    session.datasets.set(sampleId, stored);
    session.activeDatasetId = sampleId;
    return stored;
  }

  public addDataset(sessionId: string, filename: string, rows: Record<string, any>[]): StoredDataset {
    const session = this.getSession(sessionId);

    // Evict oldest non-sample dataset if limit reached
    if (session.datasets.size >= MAX_DATASETS_PER_SESSION) {
      const nonSamples = Array.from(session.datasets.entries()).filter(([_, d]) => !d.isSample && d.id !== session.activeDatasetId);
      if (nonSamples.length > 0) {
        session.datasets.delete(nonSamples[0][0]);
        session.undoHistory.delete(nonSamples[0][0]);
      }
    }

    const id = `ds-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    const profile = profileDataset(rows, filename, id);
    const qualityAudit = auditDataQuality(rows, profile);
    const insights = generateAutomatedInsights(rows, profile);

    const stored: StoredDataset = {
      id,
      filename,
      rawRows: rows,
      profile,
      qualityAudit,
      insights,
      isSample: false,
      createdAt: new Date().toISOString(),
    };

    session.datasets.set(id, stored);
    session.activeDatasetId = id;
    session.undoHistory.set(id, []);
    return stored;
  }

  public getDataset(sessionId: string, id?: string): StoredDataset | undefined {
    const session = this.getSession(sessionId);
    if (!id) return this.getActiveDataset(sessionId);
    return session.datasets.get(id);
  }

  public getActiveDataset(sessionId: string): StoredDataset | undefined {
    const session = this.getSession(sessionId);
    if (session.activeDatasetId && session.datasets.has(session.activeDatasetId)) {
      return session.datasets.get(session.activeDatasetId);
    }
    return this.initSample(sessionId);
  }

  public setActiveDataset(sessionId: string, id: string): boolean {
    const session = this.getSession(sessionId);
    if (session.datasets.has(id)) {
      session.activeDatasetId = id;
      return true;
    }
    return false;
  }

  public listDatasets(sessionId: string): { id: string; filename: string; rowCount: number; columnCount: number; isSample: boolean; createdAt: string }[] {
    const session = this.getSession(sessionId);
    return Array.from(session.datasets.values()).map(d => ({
      id: d.id,
      filename: d.filename,
      rowCount: d.profile.rowCount,
      columnCount: d.profile.columnCount,
      isSample: d.isSample,
      createdAt: d.createdAt,
    }));
  }

  public saveSnapshotForUndo(sessionId: string, datasetId: string, currentRows: Record<string, any>[]): void {
    const session = this.getSession(sessionId);
    let stack = session.undoHistory.get(datasetId);
    if (!stack) {
      stack = [];
      session.undoHistory.set(datasetId, stack);
    }
    // Push clone of current state
    stack.push(currentRows.map(r => ({ ...r })));
    if (stack.length > MAX_UNDO_STACK) {
      stack.shift();
    }
  }

  public canUndo(sessionId: string, datasetId: string): boolean {
    const session = this.getSession(sessionId);
    const stack = session.undoHistory.get(datasetId);
    return !!(stack && stack.length > 0);
  }

  public undoLastTransformation(sessionId: string, datasetId: string): { success: boolean; rowsAffected: number; dataset?: StoredDataset; message: string } {
    const session = this.getSession(sessionId);
    const dataset = session.datasets.get(datasetId);
    if (!dataset) {
      return { success: false, rowsAffected: 0, message: 'Dataset not found.' };
    }

    const stack = session.undoHistory.get(datasetId);
    if (!stack || stack.length === 0) {
      return { success: false, rowsAffected: 0, message: 'No previous transformations to undo.' };
    }

    const previousRows = stack.pop()!;
    const rowsAffected = Math.abs(previousRows.length - dataset.rawRows.length);

    // Re-profile and update
    const profile = profileDataset(previousRows, dataset.filename, dataset.id);
    const qualityAudit = auditDataQuality(previousRows, profile);
    const insights = generateAutomatedInsights(previousRows, profile);

    dataset.rawRows = previousRows;
    dataset.profile = profile;
    dataset.qualityAudit = qualityAudit;
    dataset.insights = insights;

    return {
      success: true,
      rowsAffected,
      dataset,
      message: `Reverted to previous snapshot (${previousRows.length} rows).`,
    };
  }

  public updateExistingDataset(sessionId: string, datasetId: string, newRows: Record<string, any>[]): StoredDataset {
    const session = this.getSession(sessionId);
    const dataset = session.datasets.get(datasetId);
    if (!dataset) {
      return this.addDataset(sessionId, 'transformed_dataset.csv', newRows);
    }

    // Save current state for undo
    this.saveSnapshotForUndo(sessionId, datasetId, dataset.rawRows);

    const profile = profileDataset(newRows, dataset.filename, dataset.id);
    const qualityAudit = auditDataQuality(newRows, profile);
    const insights = generateAutomatedInsights(newRows, profile);

    dataset.rawRows = newRows;
    dataset.profile = profile;
    dataset.qualityAudit = qualityAudit;
    dataset.insights = insights;

    return dataset;
  }

  public updateTransformedDataset(sessionId: string, parentDatasetId: string, newFilename: string, newRows: Record<string, any>[]): StoredDataset {
    return this.addDataset(sessionId, newFilename, newRows);
  }

  public reset(sessionId: string): void {
    const session = this.getSession(sessionId);
    session.datasets.clear();
    session.undoHistory.clear();
    this.initSample(sessionId);
  }
}

export const datasetStore = new MultiSessionDatasetStore();
