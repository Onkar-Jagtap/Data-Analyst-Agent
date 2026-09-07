import { useState, useCallback } from 'react';
import { AnalysisResult } from '../types.js';
import { askDataQuery } from '../api.js';

export function useAnalysis(onNotify?: (msg: string, type: 'info' | 'error' | 'success') => void) {
  const [activeQueryResult, setActiveQueryResult] = useState<AnalysisResult | null>(null);
  const [queryHistory, setQueryHistory] = useState<AnalysisResult[]>([]);
  const [queryLoading, setQueryLoading] = useState<boolean>(false);

  const handleAskQuestion = useCallback(
    async (datasetId: string, question: string) => {
      if (!datasetId || !question.trim()) return null;
      setQueryLoading(true);
      try {
        const historyContext = queryHistory.slice(0, 5).map(h => ({
          question: h.question,
          answerSummary: h.answer,
          plan: h.plan,
        }));
        const result = await askDataQuery(datasetId, question.trim(), historyContext);
        setActiveQueryResult(result);
        setQueryHistory(prev => [result, ...prev.filter(h => h.question !== question.trim())].slice(0, 15));

        if (!result.success && result.error) {
          if (result.error.code === 'CLARIFICATION_REQUIRED' || result.error.code === 'AMBIGUOUS_METRIC') {
            onNotify?.('Clarification needed: please select a specific metric.', 'info');
          } else {
            onNotify?.(result.error.message || 'Analytical query could not be computed.', 'error');
          }
        }
        return result;
      } catch (err: any) {
        console.error('Query execution error:', err);
        onNotify?.(err.message || 'Error processing query with AI agent.', 'error');
        return null;
      } finally {
        setQueryLoading(false);
      }
    },
    [queryHistory, onNotify]
  );

  const resetActiveQuery = useCallback(() => {
    setActiveQueryResult(null);
  }, []);

  const clearHistory = useCallback(() => {
    setQueryHistory([]);
  }, []);

  return {
    activeQueryResult,
    setActiveQueryResult,
    queryHistory,
    queryLoading,
    handleAskQuestion,
    resetActiveQuery,
    clearHistory,
  };
}
