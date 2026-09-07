import React, { useState, useCallback } from 'react';
import { ActiveTab } from './types.js';

import { Header } from './components/Header.js';
import { Sidebar } from './components/Sidebar.js';
import { OverviewView } from './components/OverviewView.js';
import { DashboardView } from './components/DashboardView.js';
import { ExecutiveReportView } from './components/ExecutiveReportView.js';
import { ProfileView } from './components/ProfileView.js';
import { QualityView } from './components/QualityView.js';
import { InsightsView } from './components/InsightsView.js';
import { AskDataView } from './components/AskDataView.js';
import { VisualStudioView } from './components/VisualStudioView.js';
import { TransformView } from './components/TransformView.js';
import { ExplorerView } from './components/ExplorerView.js';
import { CleaningAssistantView } from './components/CleaningAssistantView.js';
import { Company360View } from './components/Company360View.js';
import { UploadModal } from './components/UploadModal.js';
import { OutlierDrilldownDrawer } from './components/OutlierDrilldownDrawer.js';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';

import { useDataset } from './hooks/useDataset.js';
import { useAnalysis } from './hooks/useAnalysis.js';
import { usePinnedCharts } from './hooks/usePinnedCharts.js';
import { useOutlierDrilldown } from './hooks/useOutlierDrilldown.js';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('overview');
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);
  const [uploadModalOpen, setUploadModalOpen] = useState<boolean>(false);

  const [preselectedClean, setPreselectedClean] = useState<{ action: string; column?: string }>({
    action: 'remove_duplicates',
  });
  const [preselectedChart, setPreselectedChart] = useState<any | null>(null);

  // Hook 1: Analysis & Query Execution
  const {
    activeQueryResult,
    setActiveQueryResult,
    queryHistory,
    queryLoading,
    handleAskQuestion: askQuestion,
    resetActiveQuery,
  } = useAnalysis((msg, type) => notify(msg, type));

  // Hook 2: Dataset State & Persistence
  const {
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
  } = useDataset(resetActiveQuery);

  // Hook 3: Pinned Charts
  const { pinnedCharts, handlePinChart, handleRemovePinnedChart } = usePinnedCharts(notify);

  // Hook 4: Outlier Statistical Drill-Down
  const {
    outlierDrawerOpen,
    outlierDrilldownData,
    outlierLoading,
    handleInspectOutliers: inspectOutliers,
    handleCloseOutlierDrawer,
  } = useOutlierDrilldown();

  // Execute Natural Language Query
  const handleAskQuestion = useCallback(
    async (question: string) => {
      if (!profile) return;
      setActiveTab('ask');
      await askQuestion(profile.id, question);
    },
    [profile, askQuestion]
  );

  // Pre-fill Cleaning action
  const handleSelectCleaningAction = useCallback((action: string, column?: string) => {
    setPreselectedClean({ action, column });
    setActiveTab('cleaner');
  }, []);

  // Pre-fill Visual Studio chart
  const handlePlotInStudio = useCallback((suggestion: any) => {
    setPreselectedChart(suggestion);
    setActiveTab('studio');
  }, []);

  // Handle outlier drilldown inspection
  const handleInspectOutliers = useCallback(
    async (column: string) => {
      if (!profile) return;
      await inspectOutliers(profile.id, column);
    },
    [profile, inspectOutliers]
  );

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
        onOpenCompany360={() => setActiveTab('company360')}
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

                {activeTab === 'report' && (
                  <ExecutiveReportView
                    profile={profile}
                    onNavigateTab={setActiveTab}
                  />
                )}

                {activeTab === 'company360' && (
                  <Company360View
                    onSelectDataset={(id) => {
                      handleSelectDataset(id);
                      setActiveTab('overview');
                    }}
                    onOpenUploadModal={() => setUploadModalOpen(true)}
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
                    onPinChart={handlePinChart}
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
        onBatchUploadSuccess={handleBatchUploadSuccess}
        onSwitchToCompany360={() => {
          setUploadModalOpen(false);
          setActiveTab('company360');
        }}
      />

      {/* Statistical Outlier Drill-Down Drawer */}
      <OutlierDrilldownDrawer
        isOpen={outlierDrawerOpen}
        onClose={handleCloseOutlierDrawer}
        data={outlierDrilldownData}
        loading={outlierLoading}
        onCleanOutliers={(col) => {
          handleCloseOutlierDrawer();
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
