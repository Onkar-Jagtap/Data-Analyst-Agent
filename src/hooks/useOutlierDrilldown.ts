import { useState, useCallback } from 'react';
import { OutlierDrilldownResult } from '../types.js';
import { fetchOutlierDrilldown } from '../api.js';

export function useOutlierDrilldown() {
  const [outlierDrawerOpen, setOutlierDrawerOpen] = useState<boolean>(false);
  const [outlierDrilldownData, setOutlierDrilldownData] = useState<OutlierDrilldownResult | null>(null);
  const [outlierLoading, setOutlierLoading] = useState<boolean>(false);

  const handleInspectOutliers = useCallback(async (datasetId: string, column: string) => {
    if (!datasetId || !column) return;
    setOutlierDrawerOpen(true);
    setOutlierLoading(true);
    try {
      const res = await fetchOutlierDrilldown(datasetId, column);
      setOutlierDrilldownData(res);
    } catch (err) {
      console.error('Failed to fetch outlier drilldown:', err);
    } finally {
      setOutlierLoading(false);
    }
  }, []);

  const handleCloseOutlierDrawer = useCallback(() => {
    setOutlierDrawerOpen(false);
  }, []);

  return {
    outlierDrawerOpen,
    outlierDrilldownData,
    outlierLoading,
    handleInspectOutliers,
    handleCloseOutlierDrawer,
  };
}
