import React, { useState, useEffect } from 'react';
import {
  ActiveTab,
  AnalysisResult,
  DataQualityAudit,
  DatasetListItem,
  DatasetProfile,
  InsightItem,
  OutlierDrilldownResult,
  PinnedChart,
} from './types.js';
import {
  askDataQuery,
  fetchDatasets,
  fetchInsights,
  fetchOutlierDrilldown,
  fetchProfile,
  fetchQuality,
  loadSampleDataset,
  switchActiveDataset,
  undoCleaningAction,
} from './api.js';

import { Header } from './components/Header.js';
import { Sidebar } from './components/Sidebar.js';
import { OverviewView } from './components/OverviewView.js';
import { DashboardView } from './components/DashboardView.js';
import { ProfileView } from './components/ProfileView.js';
import { QualityView } from './components/QualityView.js';
import { InsightsView } from './components/InsightsView.js';
import { AskDataView } from './components/AskDataView.js';
import { VisualStudioView } from './components/VisualStudioView.js';
import { TransformView } from './components/TransformView.js';
import { ExplorerView } from './components/ExplorerView.js';
import { CleaningAssistantView } from './components/CleaningAssistantView.js';
import { UploadModal } from './components/UploadModal.js';
import { OutlierDrilldownDrawer } from './components/OutlierDrilldownDrawer.js';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('overview');
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);
  const [uploadModalOpen, setUploadModalOpen] = useState<boolean>(false);

  const [datasets, setDatasets] = useState<DatasetListItem[]>([]);
  const [profile, setProfile] = useState<DatasetProfile | null>(null);
  const [quality, setQuality] = useState<DataQualityAudit | null>(null);
  const [insights, setInsights] = useState<InsightItem[]>([]);

  const [notification, setNotification] = useState<{
    message: string;
    type: 'info' | 'error' | 'success';
  } | null>(null);

  const [activeQueryResult, setActiveQueryResult] = useState<AnalysisResult | null>(null);
  const [queryHistory, setQueryHistory] = useState<AnalysisResult[]>([]);
  const [queryLoading, setQueryLoading] = useState<boolean>(false);

  const [preselectedClean, setPreselectedClean] = useState<{ action: string; column?: string }>({
    action: 'remove_duplicates',
  });
  const [preselectedChart, setPreselectedChart] = useState<any | null>(null);
  const [loadingInitial, setLoadingInitial] = useState<boolean>(true);

  // Pinned Charts State (persisted in localStorage)
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
    } catch (e) {}
  }, [pinnedCharts]);

  const handlePinChart = (chart: any, title: string) => {
    const newPin: PinnedChart = {
      id: `pin-${Date.now()}`,
      title,
      chart,
      pinnedAt: new Date().toISOString(),
    };
    setPinnedCharts(prev => [newPin, ...prev]);
    setNotification({
      type: 'success',
      message: `Pinned "${title}" to Executive BI Dashboard!`,
    });
  };

  const handleRemovePinnedChart = (id: string) => {
    setPinnedCharts(prev => prev.filter(c => c.id !== id));
  };

  // Auto-dismiss notification after 5s
  useEffect(() => {
    if (notification) {
      const t = setTimeout(() => setNotification(null), 5000);
      return () => clearTimeout(t);
    }
  }, [notification]);

  // Outlier drilldown state
  const [outlierDrawerOpen, setOutlierDrawerOpen] = useState<boolean>(false);
  const [outlierDrilldownData, setOutlierDrilldownData] = useState<OutlierDrilldownResult | null>(null);
  const [outlierLoading, setOutlierLoading] = useState<boolean>(false);

  // Load initial datasets and default sample dataset on mount
  useEffect(() => {
    async function initApp() {
      setLoadingInitial(true);
      try {
        const { datasets: dsList, activeId } = await fetchDatasets();
        setDatasets(dsList);

        if (activeId) {
          const [prof, qual, ins] = await Promise.all([
            fetchProfile(activeId),
            fetchQuality(activeId),
            fetchInsights(activeId),
          ]);
          setProfile(prof);
          setQuality(qual);
          setInsights(ins);
        } else {
          const sample = await loadSampleDataset();
          setProfile(sample.profile);
          setQuality(sample.quality);
          setInsights(sample.insights);
          const updated = await fetchDatasets();
          setDatasets(updated.datasets);
        }
      } catch (err) {
        console.error('Initial load error:', err);
      } finally {
        setLoadingInitial(false);
      }
    }

    initApp();
  }, []);

  // Switch Dataset
  const handleSelectDataset = async (datasetId: string) => {
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
      setActiveQueryResult(null);
    } catch (err) {
      console.error('Failed to switch dataset:', err);
    } finally {
      setLoadingInitial(false);
    }
  };

  // Reload Sample Dataset
  const handleReloadSample = async () => {
    setLoadingInitial(true);
    try {
      const sample = await loadSampleDataset();
      setProfile(sample.profile);
      setQuality(sample.quality);
      setInsights(sample.insights);
      const ds = await fetchDatasets();
      setDatasets(ds.datasets);
      setActiveQueryResult(null);
      setActiveTab('overview');
      setNotification({ message: 'Loaded sample B2B transactions dataset.', type: 'success' });
    } catch (err) {
      console.error('Failed to load sample:', err);
      setNotification({ message: 'Failed to reload sample dataset. Please try again.', type: 'error' });
    } finally {
      setLoadingInitial(false);
    }
  };

  // Handle successful file upload
  const handleUploadSuccess = (data: {
    datasetId: string;
    profile: DatasetProfile;
    quality: DataQualityAudit;
    insights: InsightItem[];
  }) => {
    setProfile(data.profile);
    setQuality(data.quality);
    setInsights(data.insights);
    setActiveQueryResult(null);
    setActiveTab('overview');
    setNotification({
      message: `Dataset "${data.profile.filename}" loaded successfully (${data.profile.rowCount.toLocaleString()} rows).`,
      type: 'success',
    });
    fetchDatasets().then(res => setDatasets(res.datasets));
  };

  // Execute Natural Language Query
  const handleAskQuestion = async (question: string) => {
    if (!profile) return;
    setActiveTab('ask');
    setQueryLoading(true);
    try {
      const result = await askDataQuery(profile.id, question);
      setActiveQueryResult(result);
      setQueryHistory(prev => [result, ...prev.filter(h => h.question !== question)].slice(0, 15));
      if (!result.success && result.error) {
        setNotification({
          message: result.error.message || 'Analytical query failed.',
          type: 'error',
        });
      }
    } catch (err: any) {
      console.error('Query execution error:', err);
      setNotification({
        message: err.message || 'Error processing query with AI agent.',
        type: 'error',
      });
    } finally {
      setQueryLoading(false);
    }
  };

  // Pre-fill Cleaning action
  const handleSelectCleaningAction = (action: string, column?: string) => {
    setPreselectedClean({ action, column });
    setActiveTab('cleaner');
  };

  // Pre-fill Visual Studio chart
  const handlePlotInStudio = (suggestion: any) => {
    setPreselectedChart(suggestion);
    setActiveTab('studio');
  };

  // Handle outlier drilldown inspection
  const handleInspectOutliers = async (column: string) => {
    if (!profile) return;
    setOutlierDrawerOpen(true);
    setOutlierLoading(true);
    try {
      const res = await fetchOutlierDrilldown(profile.id, column);
      setOutlierDrilldownData(res);
    } catch (err) {
      console.error('Failed to fetch outlier drilldown:', err);
    } finally {
      setOutlierLoading(false);
    }
  };

  // Handle cleaning completed and saved
  const handleDatasetUpdated = async (newDatasetId: string) => {
    await handleSelectDataset(newDatasetId);
    const ds = await fetchDatasets();
    setDatasets(ds.datasets);
  };

  // Handle undo cleaning or transformation
  const handleUndoCleaning = async () => {
    if (!profile) return;
    try {
      const res = await undoCleaningAction(profile.id);
      setNotification({
        type: 'info',
        message: res.message || 'Restored previous dataset version.',
      });
      await handleDatasetUpdated(profile.id);
    } catch (err: any) {
      setNotification({
        type: 'error',
        message: err.message || 'Unable to undo operation.',
      });
    }
  };

  return (
    <div className="min-h-screen bg-[#0B0F17] text-slate-100 flex flex-col font-sans selection:bg-blue-600/30 selection:text-blue-200">
      {/* Top Application Header */}
      <Header
        currentProfile={profile}
        datasets={datasets}
        onSelectDataset={handleSelectDataset}
        onOpenUpload={() => setUploadModalOpen(true)}
        onLoadSample={handleReloadSample}
        onQuickAsk={handleAskQuestion}
        qualityScore={quality?.score}
        loading={loadingInitial}
      />

      {/* Main Workspace Body: Sidebar + Active View */}
      <div className="flex-1 flex overflow-hidden">
        {/* Navigation Sidebar */}
        <Sidebar
          activeTab={activeTab}
          onSelectTab={setActiveTab}
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
          profile={profile}
          qualityScore={quality?.score}
          insightsCount={insights.length}
        />

        {/* Content View Area */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 bg-[#0B0F17]">
          <div className="max-w-7xl mx-auto">
            {loadingInitial && !profile ? (
              <div className="flex flex-col items-center justify-center h-96 space-y-3">
                <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                <div className="text-xs text-slate-400 font-mono">
                  Loading dataset and computing statistical profile...
                </div>
              </div>
            ) : profile ? (
              <>
                {activeTab === 'overview' && (
                  <OverviewView
                    profile={profile}
                    quality={quality}
                    insights={insights}
                    onNavigateTab={setActiveTab}
                    onAskQuestion={handleAskQuestion}
                  />
                )}

                {activeTab === 'dashboard' && (
                  <DashboardView
                    profile={profile}
                    pinnedCharts={pinnedCharts}
                    onRemovePinnedChart={handleRemovePinnedChart}
                    onNavigateTab={setActiveTab}
                  />
                )}

                {activeTab === 'profile' && (
                  <ProfileView
                    profile={profile}
                    onAskQuestion={handleAskQuestion}
                  />
                )}

                {activeTab === 'quality' && (
                  quality ? (
                    <QualityView
                      audit={quality}
                      profile={profile}
                      onNavigateTab={setActiveTab}
                      onSelectCleaningAction={handleSelectCleaningAction}
                      onInspectOutliers={handleInspectOutliers}
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center py-24 space-y-3">
                      <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                      <p className="text-xs text-slate-400 font-mono">Running statistical quality audit & anomaly detection...</p>
                    </div>
                  )
                )}

                {activeTab === 'insights' && (
                  <InsightsView
                    insights={insights}
                    onNavigateTab={setActiveTab}
                    onAskQuestion={handleAskQuestion}
                    onPlotInStudio={handlePlotInStudio}
                  />
                )}

                {activeTab === 'ask' && (
                  <AskDataView
                    profile={profile}
                    activeResult={activeQueryResult}
                    loading={queryLoading}
                    history={queryHistory}
                    onAskQuestion={handleAskQuestion}
                    onSelectHistoryItem={setActiveQueryResult}
                  />
                )}

                {activeTab === 'studio' && (
                  <VisualStudioView
                    profile={profile}
                    initialSuggestion={preselectedChart}
                    onPinChart={handlePinChart}
                  />
                )}

                {activeTab === 'transform' && (
                  <TransformView
                    profile={profile}
                    canUndo={datasets.find(d => d.id === profile.id)?.canUndo || false}
                    onRefreshProfile={() => handleDatasetUpdated(profile.id)}
                    onUndo={handleUndoCleaning}
                  />
                )}

                {activeTab === 'explorer' && (
                  <ExplorerView profile={profile} />
                )}

                {activeTab === 'cleaner' && (
                  <CleaningAssistantView
                    profile={profile}
                    initialAction={preselectedClean.action}
                    initialColumn={preselectedClean.column}
                    onDatasetUpdated={handleDatasetUpdated}
                  />
                )}
              </>
            ) : (
              <div className="text-center py-20 text-slate-500 text-sm">
                No dataset loaded. Please click "Try Sample" or "Upload Dataset".
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Dataset Upload Modal */}
      <UploadModal
        isOpen={uploadModalOpen}
        onClose={() => setUploadModalOpen(false)}
        onUploadSuccess={handleUploadSuccess}
      />

      {/* Statistical Outlier Drill-Down Drawer */}
      <OutlierDrilldownDrawer
        isOpen={outlierDrawerOpen}
        onClose={() => setOutlierDrawerOpen(false)}
        data={outlierDrilldownData}
        loading={outlierLoading}
        onCleanOutliers={(col) => {
          setOutlierDrawerOpen(false);
          handleSelectCleaningAction('trim_outliers', col);
        }}
      />

      {/* Floating SaaS Toast Notification */}
      {notification && (
        <div className="fixed bottom-5 right-5 z-50 max-w-sm w-full animate-in slide-in-from-bottom-5 duration-200">
          <div
            className={`p-3.5 rounded-xl border shadow-xl flex items-start gap-3 backdrop-blur-md ${
              notification.type === 'error'
                ? 'bg-red-950/90 border-red-800 text-red-200'
                : notification.type === 'success'
                ? 'bg-emerald-950/90 border-emerald-800 text-emerald-200'
                : 'bg-slate-900/95 border-slate-800 text-slate-200'
            }`}
          >
            {notification.type === 'error' ? (
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            ) : notification.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            ) : (
              <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
            )}
            <div className="flex-1 text-xs font-medium leading-relaxed">
              {notification.message}
            </div>
            <button
              onClick={() => setNotification(null)}
              className="text-slate-400 hover:text-slate-200 p-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
