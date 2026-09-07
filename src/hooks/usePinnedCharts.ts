import { useState, useEffect, useCallback } from 'react';
import { PinnedChart } from '../types.js';

export function usePinnedCharts(onNotify?: (msg: string, type: 'info' | 'error' | 'success') => void) {
  const [pinnedCharts, setPinnedCharts] = useState<PinnedChart[]>(() => {
    try {
      const saved = localStorage.getItem('pja_pinned_charts');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('pja_pinned_charts', JSON.stringify(pinnedCharts));
    } catch (e) {
      console.error('Failed to persist pinned charts to localStorage:', e);
    }
  }, [pinnedCharts]);

  const handlePinChart = useCallback((chartOrObject: any, titleOrSubtitle?: string) => {
    let pinTitle = 'Pinned Visualization';
    let chartPayload = chartOrObject;

    if (chartOrObject && typeof chartOrObject === 'object' && chartOrObject.chart) {
      chartPayload = chartOrObject.chart;
      pinTitle = chartOrObject.title || titleOrSubtitle || 'Pinned Visualization';
    } else if (typeof titleOrSubtitle === 'string' && titleOrSubtitle.trim()) {
      pinTitle = titleOrSubtitle.trim();
    }

    const newPin: PinnedChart = {
      id: (chartOrObject && chartOrObject.id) || `pin-${Date.now()}`,
      title: pinTitle,
      chart: chartPayload,
      pinnedAt: new Date().toISOString(),
    };

    setPinnedCharts(prev => [newPin, ...prev.filter(p => p.id !== newPin.id)]);
    if (onNotify) {
      onNotify(`Pinned "${pinTitle}" to Executive BI Dashboard!`, 'success');
    }
  }, [onNotify]);

  const handleRemovePinnedChart = useCallback((id: string) => {
    setPinnedCharts(prev => prev.filter(c => c.id !== id));
  }, []);

  return {
    pinnedCharts,
    handlePinChart,
    handleRemovePinnedChart,
  };
}
