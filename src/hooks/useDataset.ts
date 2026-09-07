import { useState, useEffect, useCallback } from 'react';
import {
  DatasetListItem,
  DatasetProfile,
  DataQualityAudit,
  InsightItem,
} from '../types.js';
import {
  fetchDatasets,
  fetchInsights,
  fetchProfile,
  fetchQuality,
  loadSampleDataset,
  switchActiveDataset,
  undoCleaningAction,
} from '../api.js';

export function useDataset(onDatasetSwitch?: () => void) {
  const [datasets, setDatasets] = useState<DatasetListItem[]>([]);
  const [profile, setProfile] = useState<DatasetProfile | null>(null);
  const [quality, setQuality] = useState<DataQualityAudit | null>(null);
  const [insights, setInsights] = useState<InsightItem[]>([]);
  const [loadingInitial, setLoadingInitial] = useState<boolean>(true);

  const [notification, setNotification] = useState<{
    message: string;
    type: 'info' | 'error' | 'success';
  } | null>(null);

  // Auto-dismiss notification after 5s
  useEffect(() => {
    if (notification) {
      const t = setTimeout(() => setNotification(null), 5000);
      return () => clearTimeout(t);
    }
  }, [notification]);

  const notify = useCallback((message: string, type: 'info' | 'error' | 'success' = 'info') => {
    setNotification({ message, type });
  }, []);

  // Initialize datasets and load active or default sample
  useEffect(() => {
    let isMounted = true;

    async function initApp() {
      setLoadingInitial(true);
      try {
        const { datasets: dsList, activeId } = await fetchDatasets();
        if (!isMounted) return;
        setDatasets(dsList);

        if (activeId) {
          const [prof, qual, ins] = await Promise.all([
            fetchProfile(activeId),
            fetchQuality(activeId),
            fetchInsights(activeId),
          ]);
          if (!isMounted) return;
          setProfile(prof);
          setQuality(qual);
          setInsights(ins);
        } else {
          const sample = await loadSampleDataset();
          if (!isMounted) return;
          setProfile(sample.profile);
          setQuality(sample.quality);
          setInsights(sample.insights);
          const updated = await fetchDatasets();
          if (!isMounted) return;
          setDatasets(updated.datasets);
        }
      } catch (err) {
        console.error('Initial load error:', err);
      } finally {
        if (isMounted) setLoadingInitial(false);
      }
    }

    initApp();
    return () => {
      isMounted = false;
    };
  }, []);

  // Switch Active Dataset
  const handleSelectDataset = useCallback(
    async (datasetId: string) => {
      setLoadingInitial(true);
      try {
        const prof = await switchActiveDataset(datasetId);
        const [qual, ins] = await Promise.all([
          fetchQuality(datasetId),
          fetchInsights(datasetId),
        ]);
        setProfile(prof);
        setQuality(qual);
        setInsights(ins);
        onDatasetSwitch?.();
      } catch (err) {
        console.error('Failed to switch dataset:', err);
        notify('Failed to switch dataset.', 'error');
      } finally {
        setLoadingInitial(false);
      }
    },
    [onDatasetSwitch, notify]
  );

  // Reload Sample Dataset
  const handleReloadSample = useCallback(async () => {
    setLoadingInitial(true);
    try {
      const sample = await loadSampleDataset();
      setProfile(sample.profile);
      setQuality(sample.quality);
      setInsights(sample.insights);
      const ds = await fetchDatasets();
      setDatasets(ds.datasets);
      onDatasetSwitch?.();
      notify('Loaded sample B2B transactions dataset.', 'success');
    } catch (err) {
      console.error('Failed to load sample:', err);
      notify('Failed to reload sample dataset. Please try again.', 'error');
    } finally {
      setLoadingInitial(false);
    }
  }, [onDatasetSwitch, notify]);

  // Handle successful file upload
  const handleUploadSuccess = useCallback(
    (data: {
      datasetId: string;
      profile: DatasetProfile;
      quality: DataQualityAudit;
      insights: InsightItem[];
    }) => {
      setProfile(data.profile);
      setQuality(data.quality);
      setInsights(data.insights);
      onDatasetSwitch?.();
      notify(
        `Dataset "${data.profile.filename}" loaded successfully (${data.profile.rowCount.toLocaleString()} rows).`,
        'success'
      );
      fetchDatasets().then(res => setDatasets(res.datasets));
    },
    [onDatasetSwitch, notify]
  );

  // Handle batch multi-file upload success
  const handleBatchUploadSuccess = useCallback(
    async (count: number) => {
      try {
        const updated = await fetchDatasets();
        setDatasets(updated.datasets);
        if (updated.activeId) {
          const [prof, qual, ins] = await Promise.all([
            fetchProfile(updated.activeId),
            fetchQuality(updated.activeId),
            fetchInsights(updated.activeId),
          ]);
          setProfile(prof);
          setQuality(qual);
          setInsights(ins);
        }
        notify(
          `Successfully synchronized ${count} department datasets in Enterprise 360° model!`,
          'success'
        );
      } catch (err) {
        console.error('Failed to sync datasets after batch upload:', err);
        notify('Failed to sync datasets after batch upload.', 'error');
      }
    },
    [notify]
  );

  // Handle dataset modification / cleaning update
  const handleDatasetUpdated = useCallback(
    async (newDatasetId: string) => {
      await handleSelectDataset(newDatasetId);
      const ds = await fetchDatasets();
      setDatasets(ds.datasets);
    },
    [handleSelectDataset]
  );

  // Handle undo cleaning or transformation
  const handleUndoCleaning = useCallback(async () => {
    if (!profile) return;
    try {
      const res = await undoCleaningAction(profile.id);
      notify(res.message || 'Restored previous dataset version.', 'info');
      await handleDatasetUpdated(profile.id);
    } catch (err: any) {
      notify(err.message || 'Unable to undo operation.', 'error');
    }
  }, [profile, notify, handleDatasetUpdated]);

  return {
    datasets,
    profile,
    quality,
    insights,
    loadingInitial,
    notification,
    setNotification,
    notify,
    handleSelectDataset,
    handleReloadSample,
    handleUploadSuccess,
    handleBatchUploadSuccess,
    handleDatasetUpdated,
    handleUndoCleaning,
  };
}
