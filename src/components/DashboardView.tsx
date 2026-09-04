import React, { useState, useEffect } from 'react';
import {
  Activity,
  AlertCircle,
  ArrowUpRight,
  BarChart3,
  Calendar,
  ChevronDown,
  DollarSign,
  Download,
  FileText,
  Filter,
  Grid,
  Layers,
  LayoutDashboard,
  LineChart,
  Maximize2,
  Percent,
  PieChart,
  Pin,
  RefreshCw,
  Sparkles,
  Sun,
  Trash2,
  TrendingUp,
  X,
} from 'lucide-react';
import { DashboardData, DatasetProfile, PinnedChart } from '../types.js';
import { fetchDashboardData } from '../api.js';
import { PlotlyChart } from './PlotlyChart.js';

interface DashboardViewProps {
  profile: DatasetProfile;
  pinnedCharts: PinnedChart[];
  onRemovePinnedChart: (id: string) => void;
  onNavigateTab: (tab: any) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  profile,
  pinnedCharts,
  onRemovePinnedChart,
  onNavigateTab,
}) => {
  const catCols = profile.columns.filter(c => c.type === 'categorical' || c.type === 'text');
  const numCols = profile.columns.filter(c => c.type === 'numeric');
  const dateCols = profile.columns.filter(c => c.type === 'datetime');

  // Slicer States
  const [selectedDimension, setSelectedDimension] = useState<string>(
    catCols[0]?.name || profile.columns[0]?.name || ''
  );
  const [selectedSecondaryDimension, setSelectedSecondaryDimension] = useState<string>(
    catCols[1]?.name || ''
  );
  const [filterCol, setFilterCol] = useState<string>('');
  const [filterVal, setFilterVal] = useState<string>('');

  const [selectedMetric, setSelectedMetric] = useState<string>(
    numCols[0]?.name || ''
  );
  const [selectedSecondaryMetric, setSelectedSecondaryMetric] = useState<string>(
    numCols[1]?.name || numCols[0]?.name || ''
  );
  const [timeGrain, setTimeGrain] = useState<string>('monthly');

  // Data state
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchDashboardData(profile.id, {
        dimension: selectedDimension,
        metric: selectedMetric,
        secondaryMetric: selectedSecondaryMetric,
        filterCol: filterCol || undefined,
        filterVal: filterVal || undefined,
        timeCol: dateCols[0]?.name || undefined,
        timeGrain,
      });
      setData(res);
    } catch (err: any) {
      setError(err.message || 'Failed to assemble dashboard.');
    } finally {
      setLoading(false);
    }
  };

  // Reset slicers when active dataset changes
  useEffect(() => {
    const cats = profile.columns.filter(c => c.type === 'categorical' || c.type === 'text');
    const nums = profile.columns.filter(c => c.type === 'numeric');
    if (!profile.columns.some(c => c.name === selectedDimension)) {
      setSelectedDimension(cats[0]?.name || profile.columns[0]?.name || '');
    }
    if (!profile.columns.some(c => c.name === selectedMetric)) {
      setSelectedMetric(nums[0]?.name || '');
    }
    if (!profile.columns.some(c => c.name === selectedSecondaryMetric)) {
      setSelectedSecondaryMetric(nums[1]?.name || nums[0]?.name || '');
    }
    setFilterCol('');
    setFilterVal('');
  }, [profile.id]);

  useEffect(() => {
    loadDashboard();
  }, [
    profile.id,
    selectedDimension,
    selectedMetric,
    selectedSecondaryMetric,
    filterCol,
    filterVal,
    timeGrain,
  ]);

  // Distinct filter values for selected filter column
  const activeFilterColInfo = profile.columns.find(c => c.name === filterCol);
  const filterOptions = activeFilterColInfo?.topCategories?.map(t => t.category) || [];

  return (
    <div className="space-y-6 pb-16">
      {/* Top Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <LayoutDashboard className="w-4 h-4 text-blue-400" />
            <span className="text-xs font-semibold uppercase tracking-wider text-blue-400 font-mono">
              PowerBI Style Executive Canvas
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-100 tracking-tight font-display">
            Executive Analytics Dashboard
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
            Real-time compound KPI slicers, dual-axis trends, hierarchical visualizers, and pinned studio graphs.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => onNavigateTab('report')}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white transition-all shadow-sm shadow-emerald-500/20"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Generate Full Report</span>
          </button>
          <button
            onClick={loadDashboard}
            disabled={loading}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-semibold text-slate-200 transition-all shadow-sm"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-blue-400' : ''}`} />
            <span>Refresh Canvas</span>
          </button>
        </div>
      </div>

      {/* Multi-Dimension Slicers Control Bar */}
      <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-md space-y-3">
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-200">
            <Filter className="w-3.5 h-3.5 text-amber-400" />
            <span>Compound Dimension Slicers</span>
          </div>
          {(filterCol || filterVal) && (
            <button
              onClick={() => { setFilterCol(''); setFilterVal(''); }}
              className="flex items-center gap-1 text-[11px] text-amber-400 hover:text-amber-300 font-semibold"
            >
              <X className="w-3 h-3" />
              <span>Reset Active Slicers</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          {/* Slicer 1: Primary Dimension */}
          <div>
            <label className="text-[11px] font-semibold text-slate-400 block mb-1">
              Primary Dimension
            </label>
            <select
              value={selectedDimension}
              onChange={e => setSelectedDimension(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
            >
              {profile.columns.map(c => (
                <option key={c.name} value={c.name}>
                  {c.name} ({c.type})
                </option>
              ))}
            </select>
          </div>

          {/* Slicer 2: Primary Metric */}
          <div>
            <label className="text-[11px] font-semibold text-slate-400 block mb-1">
              Primary Metric (Y1)
            </label>
            <select
              value={selectedMetric}
              onChange={e => setSelectedMetric(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
            >
              {numCols.map(c => (
                <option key={c.name} value={c.name}>
                  {c.name} (Numeric)
                </option>
              ))}
            </select>
          </div>

          {/* Slicer 3: Secondary Metric (Y2 for Combo) */}
          <div>
            <label className="text-[11px] font-semibold text-slate-400 block mb-1">
              Secondary Metric (Y2 Overlay)
            </label>
            <select
              value={selectedSecondaryMetric}
              onChange={e => setSelectedSecondaryMetric(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
            >
              {numCols.map(c => (
                <option key={c.name} value={c.name}>
                  {c.name} (Numeric)
                </option>
              ))}
            </select>
          </div>

          {/* Slicer 4: Compound Cross-Filter */}
          <div>
            <label className="text-[11px] font-semibold text-slate-400 block mb-1">
              Cross-Filter Slicer
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              <select
                value={filterCol}
                onChange={e => { setFilterCol(e.target.value); setFilterVal(''); }}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2 py-2 text-[11px] text-slate-200 focus:outline-none"
              >
                <option value="">Filter Dimension</option>
                {catCols.map(c => (
                  <option key={c.name} value={c.name}>{c.name}</option>
                ))}
              </select>

              <select
                value={filterVal}
                onChange={e => setFilterVal(e.target.value)}
                disabled={!filterCol}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2 py-2 text-[11px] text-slate-200 focus:outline-none disabled:opacity-50"
              >
                <option value="">All Values</option>
                {filterOptions.map(opt => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="p-4 rounded-xl bg-red-950/40 border border-red-800/60 flex items-center justify-between gap-3 text-red-200 text-xs">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            onClick={loadDashboard}
            className="px-3 py-1 rounded-lg bg-red-900/60 hover:bg-red-800 border border-red-700 font-semibold text-red-100 transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {/* Loading Skeleton */}
      {loading && !data && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-28 rounded-2xl bg-slate-900/60 border border-slate-800/80 animate-pulse p-4 space-y-3">
                <div className="h-3 w-20 bg-slate-800 rounded"></div>
                <div className="h-6 w-28 bg-slate-800 rounded"></div>
                <div className="h-2 w-16 bg-slate-800 rounded"></div>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-96 rounded-2xl bg-slate-900/60 border border-slate-800/80 animate-pulse p-5 space-y-4">
                <div className="h-4 w-40 bg-slate-800 rounded"></div>
                <div className="h-72 bg-slate-800/40 rounded-xl"></div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* KPI Cards Row */}
      {data && (
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1 */}
          <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800/80 shadow-md">
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider truncate">
                Total {data.metrics?.primaryMetric || data.activeFilters?.metric || selectedMetric || 'Primary Metric'}
              </span>
              <Activity className="w-4 h-4 text-blue-400 shrink-0" />
            </div>
            <div className="text-xl sm:text-2xl font-bold text-slate-100 font-display">
              {data.metrics?.primaryTotalFormatted ?? '0'}
            </div>
            <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
              <span>Avg:</span>
              <span className="text-slate-300 font-mono font-semibold">{data.metrics?.primaryMeanFormatted ?? '0'}</span>
              <span className="text-slate-600">/ record</span>
            </div>
          </div>

          {/* Card 2 */}
          <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800/80 shadow-md">
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider truncate">
                Total {data.metrics?.secondaryMetric || data.activeFilters?.secondaryMetric || selectedSecondaryMetric || 'Secondary Metric'}
              </span>
              <TrendingUp className="w-4 h-4 text-emerald-400 shrink-0" />
            </div>
            <div className="text-xl sm:text-2xl font-bold text-slate-100 font-display">
              {data.metrics?.secondaryTotalFormatted ?? '0'}
            </div>
            <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
              <span>Avg:</span>
              <span className="text-slate-300 font-mono font-semibold">{data.metrics?.secondaryMeanFormatted ?? '0'}</span>
              <span className="text-slate-600">/ record</span>
            </div>
          </div>

          {/* Card 3 */}
          <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800/80 shadow-md">
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider">Metric Ratio / Efficiency</span>
              <Sparkles className="w-4 h-4 text-purple-400 shrink-0" />
            </div>
            <div className="text-xl sm:text-2xl font-bold text-purple-300 font-display">
              {data.metrics?.ratioFormatted ?? 'N/A'}
            </div>
            <div className="text-[11px] text-slate-500 mt-1 truncate">
              {data.metrics?.secondaryMetric || selectedSecondaryMetric || 'Secondary'} / {data.metrics?.primaryMetric || selectedMetric || 'Primary'}
            </div>
          </div>

          {/* Card 4 */}
          <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800/80 shadow-md">
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider">Active Slice Count</span>
              <Filter className="w-4 h-4 text-amber-400 shrink-0" />
            </div>
            <div className="text-xl sm:text-2xl font-bold text-slate-100 font-display">
              {(data.metrics?.filteredRowCount ?? data.activeRowsCount ?? 0).toLocaleString()}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              {(data.metrics?.filteredRowCount ?? data.activeRowsCount) === (data.metrics?.totalRowCount ?? data.totalDatasetRows)
                ? '100% of entire dataset'
                : `${(((data.metrics?.filteredRowCount ?? data.activeRowsCount) / ((data.metrics?.totalRowCount ?? data.totalDatasetRows) || 1)) * 100).toFixed(1)}% filtered`}
            </div>
          </div>
        </div>
      )}

      {/* Executive Business Calculations Bar */}
      {data && (
        <div className="p-4 rounded-2xl bg-gradient-to-r from-slate-900/90 via-slate-900/80 to-blue-950/20 border border-slate-800 shadow-md">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                Executive Business Metrics & Economics
              </span>
            </div>
            <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/60 border border-emerald-800/40 px-2 py-0.5 rounded-md">
              Deterministic Calculations Active
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {/* 1. Profit Margin */}
            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
              <span className="text-[10px] font-semibold text-slate-400 block uppercase tracking-wider">Profit Margin</span>
              <div className="text-sm sm:text-base font-bold text-emerald-400 font-mono mt-0.5">
                {data.businessCalculations?.profitMarginFormatted || data.metrics?.profitMarginFormatted || 'N/A'}
              </div>
              <span className="text-[10px] text-slate-500 truncate block mt-0.5">Net Profit / Revenue</span>
            </div>

            {/* 2. Average Order Value / ATV */}
            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
              <span className="text-[10px] font-semibold text-slate-400 block uppercase tracking-wider">Avg Deal / AOV</span>
              <div className="text-sm sm:text-base font-bold text-blue-300 font-mono mt-0.5">
                {data.businessCalculations?.averageOrderValueFormatted || data.metrics?.averageOrderValueFormatted || '0'}
              </div>
              <span className="text-[10px] text-slate-500 truncate block mt-0.5">Revenue / Order</span>
            </div>

            {/* 3. Top Contributor */}
            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
              <span className="text-[10px] font-semibold text-slate-400 block uppercase tracking-wider">Top Segment</span>
              <div className="text-sm sm:text-base font-bold text-amber-300 truncate mt-0.5" title={data.businessCalculations?.topSegmentName || data.metrics?.topSegmentName}>
                {data.businessCalculations?.topSegmentName || data.metrics?.topSegmentName || 'N/A'}
              </div>
              <span className="text-[10px] text-slate-500 truncate block mt-0.5">
                {data.businessCalculations?.topSegmentShareFormatted || data.metrics?.topSegmentShareFormatted || '0%'} total share
              </span>
            </div>

            {/* 4. Pareto 80/20 Concentration */}
            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
              <span className="text-[10px] font-semibold text-slate-400 block uppercase tracking-wider">Pareto Top 20%</span>
              <div className="text-sm sm:text-base font-bold text-purple-300 font-mono mt-0.5">
                {data.businessCalculations?.paretoTop20ShareFormatted || data.metrics?.paretoTop20ShareFormatted || '0%'}
              </div>
              <span className="text-[10px] text-slate-500 truncate block mt-0.5">Share from top 20%</span>
            </div>

            {/* 5. Period Growth */}
            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
              <span className="text-[10px] font-semibold text-slate-400 block uppercase tracking-wider">Period Trend</span>
              <div className="text-sm sm:text-base font-bold text-cyan-300 font-mono mt-0.5">
                {data.businessCalculations?.periodGrowthFormatted || data.metrics?.periodGrowthFormatted || 'Steady'}
              </div>
              <span className="text-[10px] text-slate-500 truncate block mt-0.5">Latest vs prior cycle</span>
            </div>

            {/* 6. Returns / Adjustments */}
            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
              <span className="text-[10px] font-semibold text-slate-400 block uppercase tracking-wider">Adjustments</span>
              <div className="text-sm sm:text-base font-bold text-slate-200 font-mono mt-0.5">
                {data.businessCalculations?.refundAdjustmentFormatted || data.metrics?.refundAdjustmentTotalFormatted || '$0'}
              </div>
              <span className="text-[10px] text-slate-500 truncate block mt-0.5">
                {(data.businessCalculations?.refundAdjustmentCount || data.metrics?.refundAdjustmentCount || 0)} return rows
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Main Multi-Graph Grid */}
      {data && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Chart 1: Dual-Axis Combo Trend */}
          <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800 shadow-xl flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h3 className="text-xs font-bold text-slate-200">
                  Dual-Axis Breakdown: {data.metrics?.primaryMetric || selectedMetric || 'Primary'} (Bar) & {data.metrics?.secondaryMetric || selectedSecondaryMetric || 'Secondary'} (Line)
                </h3>
                <span className="text-[10px] text-slate-400 font-mono">
                  Grouped by {data.dimension || selectedDimension}
                </span>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded-md bg-blue-950/60 border border-blue-800/50 text-blue-300 font-mono">
                Combo Visual
              </span>
            </div>
            <div className="w-full h-80">
              <PlotlyChart figure={data.comboChart || data.charts?.barChart} className="w-full h-full" />
            </div>
          </div>

          {/* Chart 2: Hierarchical Category Treemap */}
          <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800 shadow-xl flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h3 className="text-xs font-bold text-slate-200">
                  Hierarchical Treemap: {data.metrics?.primaryMetric || selectedMetric || 'Primary'}
                </h3>
                <span className="text-[10px] text-slate-400 font-mono">
                  Nested category distribution
                </span>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded-md bg-amber-950/60 border border-amber-800/50 text-amber-300 font-mono">
                Treemap
              </span>
            </div>
            <div className="w-full h-80">
              <PlotlyChart figure={data.treemapChart || data.charts?.donutChart} className="w-full h-full" />
            </div>
          </div>

          {/* Chart 3: Category Share Pie / Donut */}
          <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800 shadow-xl flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h3 className="text-xs font-bold text-slate-200">
                  Proportional Category Share ({data.dimension || selectedDimension})
                </h3>
                <span className="text-[10px] text-slate-400 font-mono">
                  Percentage breakdown of {data.metrics?.primaryMetric || selectedMetric || 'Primary'}
                </span>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded-md bg-emerald-950/60 border border-emerald-800/50 text-emerald-300 font-mono">
                Share of Total
              </span>
            </div>
            <div className="w-full h-80">
              <PlotlyChart figure={data.pieChart || data.charts?.donutChart} className="w-full h-full" />
            </div>
          </div>

          {/* Chart 4: Time Series Trend or Top Performers */}
          <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800 shadow-xl flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h3 className="text-xs font-bold text-slate-200">
                  {data.timeSeriesChart ? 'Temporal Performance Trend' : 'Top Performers Ranking'}
                </h3>
                <span className="text-[10px] text-slate-400 font-mono">
                  {data.timeSeriesChart ? 'Chronological progression' : `Highest ${data.metrics?.primaryMetric || selectedMetric || 'Primary'}`}
                </span>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded-md bg-purple-950/60 border border-purple-800/50 text-purple-300 font-mono">
                {data.timeSeriesChart ? 'Timeline' : 'Rankings'}
              </span>
            </div>
            <div className="w-full h-80">
              {data.timeSeriesChart ? (
                <PlotlyChart figure={data.timeSeriesChart} className="w-full h-full" />
              ) : (
                <PlotlyChart figure={data.rankChart || data.charts?.barChart} className="w-full h-full" />
              )}
            </div>
          </div>
        </div>
      )}

      {/* Pinned Visualizations Section */}
      <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Pin className="w-4 h-4 text-amber-400" />
            <h2 className="text-sm font-bold text-slate-100">
              Pinned Custom Visualizations ({pinnedCharts.length})
            </h2>
          </div>
          <button
            onClick={() => onNavigateTab('visual_studio')}
            className="text-xs text-blue-400 hover:text-blue-300 font-semibold"
          >
            + Create New in Studio
          </button>
        </div>

        {pinnedCharts.length === 0 ? (
          <div className="p-8 rounded-xl bg-slate-950/60 border border-dashed border-slate-800 text-center text-xs text-slate-500">
            <p>No charts pinned yet. You can pin custom visualizations directly from the Visual Studio or AI Query tab.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {pinnedCharts.map(pinned => (
              <div
                key={pinned.id}
                className="p-4 rounded-2xl bg-slate-950 border border-slate-800 shadow-md relative group flex flex-col justify-between"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="text-xs font-semibold text-slate-200 truncate pr-6">
                    {pinned.title}
                  </div>
                  <button
                    onClick={() => onRemovePinnedChart(pinned.id)}
                    className="p-1 rounded-lg hover:bg-red-950/40 text-slate-500 hover:text-red-400 transition-colors"
                    title="Unpin chart"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="w-full h-72">
                  <PlotlyChart figure={pinned.chart} className="w-full h-full" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
