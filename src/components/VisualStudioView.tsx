import React, { useState, useEffect } from 'react';
import {
  Activity,
  BarChart3,
  Box,
  Check,
  Code2,
  Download,
  Filter,
  Grid,
  Layers,
  LayoutGrid,
  LineChart,
  Palette,
  PieChart,
  Pin,
  RefreshCw,
  Sliders,
  Sun,
} from 'lucide-react';
import { DatasetProfile, PinnedChart } from '../types.js';
import { generateCustomChart, generateReproducibleCode } from '../api.js';
import { PlotlyChart } from './PlotlyChart.js';
import { DataHandlingPanel } from './DataHandlingPanel.js';
import { CodeExportModal } from './CodeExportModal.js';

interface VisualStudioViewProps {
  profile: DatasetProfile;
  initialSuggestion?: any;
  onPinChart?: (chart: PinnedChart) => void;
}

export const VisualStudioView: React.FC<VisualStudioViewProps> = ({
  profile,
  initialSuggestion,
  onPinChart,
}) => {
  const numCols = profile.columns.filter(c => c.type === 'numeric');
  const catCols = profile.columns.filter(c => c.type === 'categorical' || c.type === 'text');

  const [chartType, setChartType] = useState<string>(initialSuggestion?.type || 'bar');
  const [xAxis, setXAxis] = useState<string>(
    initialSuggestion?.x || (catCols[0]?.name || profile.columns[0]?.name || '')
  );
  const [yAxis, setYAxis] = useState<string>(
    initialSuggestion?.y || (numCols[0]?.name || profile.columns[1]?.name || '')
  );
  const [secondaryYAxis, setSecondaryYAxis] = useState<string>(
    numCols[1]?.name || numCols[0]?.name || ''
  );
  const [colorDimension, setColorDimension] = useState<string>('');
  const [aggregation, setAggregation] = useState<string>('sum');
  const [sortDir, setSortDir] = useState<string>('desc');
  const [topN, setTopN] = useState<number>(15);

  const [figure, setFigure] = useState<any | null>(null);
  const [dataHandling, setDataHandling] = useState<any | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [pinnedSuccess, setPinnedSuccess] = useState<boolean>(false);

  // Code modal state
  const [codeModalOpen, setCodeModalOpen] = useState<boolean>(false);
  const [pythonCode, setPythonCode] = useState<string>('');
  const [sqlCode, setSqlCode] = useState<string>('');
  const [codeLoading, setCodeLoading] = useState<boolean>(false);

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await generateCustomChart(profile.id, {
        type: chartType,
        xAxis,
        yAxis,
        secondaryYAxis: chartType === 'combo' ? secondaryYAxis : undefined,
        colorDimension: colorDimension || undefined,
        aggregation,
        sortBy: yAxis,
        sortDirection: sortDir,
        topN,
      });
      setFigure(res.chart);
      setDataHandling(res.dataHandling);
    } catch (err: any) {
      setError(err.message || 'Failed to generate visualization');
    } finally {
      setLoading(false);
    }
  };

  const handlePin = () => {
    if (!figure || !onPinChart) return;
    const title = chartType === 'combo'
      ? `${yAxis} & ${secondaryYAxis} by ${xAxis}`
      : `${aggregation.toUpperCase()} of ${yAxis} by ${xAxis}`;

    onPinChart({
      id: `pin_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      title,
      chart: figure,
      datasetId: profile.id,
      timestamp: Date.now(),
      type: chartType,
      xAxis,
      yAxis,
    });
    setPinnedSuccess(true);
    setTimeout(() => setPinnedSuccess(false), 2500);
  };

  const handleOpenCodeModal = async () => {
    setCodeLoading(true);
    try {
      const codeRes = await generateReproducibleCode({
        filename: profile.filename,
        metric: yAxis,
        xAxis,
        yAxis,
        aggregation,
        sortDirection: sortDir,
        limit: topN,
      });
      setPythonCode(codeRes.python);
      setSqlCode(codeRes.sql);
      setCodeModalOpen(true);
    } catch (err: any) {
      alert(err.message || 'Failed to generate reproducible code');
    } finally {
      setCodeLoading(false);
    }
  };

  useEffect(() => {
    handleGenerate();
  }, [profile.id]);

  const chartTypes = [
    { id: 'bar', label: 'Bar Chart', icon: <BarChart3 className="w-4 h-4" /> },
    { id: 'line', label: 'Line Chart', icon: <LineChart className="w-4 h-4" /> },
    { id: 'combo', label: 'Dual-Axis Combo', icon: <Layers className="w-4 h-4 text-emerald-400" /> },
    { id: 'treemap', label: 'Treemap', icon: <LayoutGrid className="w-4 h-4 text-amber-400" /> },
    { id: 'sunburst', label: 'Sunburst', icon: <Sun className="w-4 h-4 text-purple-400" /> },
    { id: 'scatter', label: 'Scatter Plot', icon: <Activity className="w-4 h-4 text-cyan-400" /> },
    { id: 'box', label: 'Box & Whisker', icon: <Box className="w-4 h-4 text-pink-400" /> },
    { id: 'heatmap', label: 'Correlation', icon: <Grid className="w-4 h-4" /> },
    { id: 'histogram', label: 'Histogram', icon: <Layers className="w-4 h-4" /> },
    { id: 'pie', label: 'Pie Chart', icon: <PieChart className="w-4 h-4" /> },
  ];

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <BarChart3 className="w-4 h-4 text-amber-400" />
            <span className="text-xs font-semibold uppercase tracking-wider text-amber-400 font-mono">
              Plotly Canvas Engine & Advanced Charts
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-100 tracking-tight font-display">
            Visual Analytics Studio
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Build dual-axis combo charts, treemaps, sunbursts, multi-color groupings, and pin directly to your BI Dashboard.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {onPinChart && figure && (
            <button
              onClick={handlePin}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl border text-xs font-semibold transition-all shadow-sm ${
                pinnedSuccess
                  ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-300'
                  : 'bg-slate-900 hover:bg-slate-800 border-slate-700 text-slate-300 hover:text-white'
              }`}
            >
              {pinnedSuccess ? <Check className="w-4 h-4 text-emerald-400" /> : <Pin className="w-4 h-4 text-amber-400" />}
              <span>{pinnedSuccess ? 'Pinned to Dashboard!' : 'Pin to Dashboard'}</span>
            </button>
          )}

          {/* Code View Action Button */}
          <button
            onClick={handleOpenCodeModal}
            disabled={codeLoading}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-semibold text-blue-300 transition-all shadow-sm"
            title="View reproducible Python Pandas & SQL CTE code for this visualization"
          >
            <Code2 className={`w-4 h-4 ${codeLoading ? 'animate-spin' : ''}`} />
            <span>Export Python & SQL</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Controls Column */}
        <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-4">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-300 border-b border-slate-800 pb-2">
            <Sliders className="w-4 h-4 text-blue-400" />
            <span>Chart Configuration</span>
          </div>

          {/* Chart Type Selector */}
          <div>
            <label className="text-[11px] font-semibold text-slate-400 block mb-1.5">
              Visualization Archetype
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              {chartTypes.map(ct => (
                <button
                  key={ct.id}
                  onClick={() => setChartType(ct.id)}
                  className={`p-2 rounded-xl text-xs font-medium flex items-center gap-2 transition-all ${
                    chartType === ct.id
                      ? 'bg-blue-600 text-white shadow-sm font-semibold'
                      : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800/80'
                  }`}
                >
                  {ct.icon}
                  <span className="text-[11px] truncate">{ct.label}</span>
                </button>
              ))}
            </div>
          </div>

          {chartType !== 'heatmap' && (
            <>
              {/* X Axis Dimension */}
              <div>
                <label className="text-[11px] font-semibold text-slate-400 block mb-1">
                  X-Axis / Category Dimension
                </label>
                <select
                  value={xAxis}
                  onChange={e => setXAxis(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                >
                  {profile.columns.map(c => (
                    <option key={c.name} value={c.name}>
                      {c.name} ({c.type})
                    </option>
                  ))}
                </select>
              </div>

              {/* Y Axis Metric */}
              <div>
                <label className="text-[11px] font-semibold text-slate-400 block mb-1">
                  {chartType === 'combo' ? 'Primary Y-Axis Metric (Bar Chart)' : 'Y-Axis Metric'}
                </label>
                <select
                  value={yAxis}
                  onChange={e => setYAxis(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                >
                  {numCols.map(c => (
                    <option key={c.name} value={c.name}>
                      {c.name} (Numeric)
                    </option>
                  ))}
                </select>
              </div>

              {/* Combo Secondary Y-Axis */}
              {chartType === 'combo' && (
                <div className="p-3 rounded-xl bg-emerald-950/20 border border-emerald-800/40">
                  <label className="text-[11px] font-semibold text-emerald-300 block mb-1 flex items-center gap-1.5">
                    <LineChart className="w-3.5 h-3.5" />
                    <span>Secondary Y-Axis Metric (Line Chart Overlay)</span>
                  </label>
                  <select
                    value={secondaryYAxis}
                    onChange={e => setSecondaryYAxis(e.target.value)}
                    className="w-full bg-slate-950 border border-emerald-800/50 rounded-lg px-3 py-2 text-xs text-emerald-200 focus:outline-none focus:border-emerald-500"
                  >
                    {numCols.map(c => (
                      <option key={c.name} value={c.name}>
                        {c.name} (Numeric)
                      </option>
                    ))}
                  </select>
                  <p className="text-[10px] text-slate-400 mt-1">
                    Rendered as an independent right-hand Y-axis line chart over the primary bar chart.
                  </p>
                </div>
              )}

              {/* Color Grouping Dimension */}
              {chartType !== 'treemap' && chartType !== 'sunburst' && chartType !== 'pie' && chartType !== 'combo' && (
                <div>
                  <label className="text-[11px] font-semibold text-slate-400 block mb-1 flex items-center gap-1.5">
                    <Palette className="w-3.5 h-3.5 text-blue-400" />
                    <span>Color Group Dimension (Optional)</span>
                  </label>
                  <select
                    value={colorDimension}
                    onChange={e => setColorDimension(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                  >
                    <option value="">-- None (Single Series) --</option>
                    {catCols.map(c => (
                      <option key={c.name} value={c.name}>
                        Group by {c.name} ({c.type})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Aggregation */}
              <div>
                <label className="text-[11px] font-semibold text-slate-400 block mb-1">
                  Aggregation Method
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {['sum', 'mean', 'median', 'count', 'min', 'max'].map(agg => (
                    <button
                      key={agg}
                      onClick={() => setAggregation(agg)}
                      className={`px-2 py-1.5 rounded-md text-xs uppercase font-mono transition-colors ${
                        aggregation === agg
                          ? 'bg-blue-600/20 text-blue-300 border border-blue-500/40 font-bold'
                          : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
                      }`}
                    >
                      {agg}
                    </button>
                  ))}
                </div>
              </div>

              {/* Sorting and Limit */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-semibold text-slate-400 block mb-1">Sort</label>
                  <select
                    value={sortDir}
                    onChange={e => setSortDir(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200"
                  >
                    <option value="desc">Descending (High to Low)</option>
                    <option value="asc">Ascending (Low to High)</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-400 block mb-1">Limit</label>
                  <select
                    value={topN}
                    onChange={e => setTopN(parseInt(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200"
                  >
                    <option value="5">Top 5</option>
                    <option value="10">Top 10</option>
                    <option value="15">Top 15</option>
                    <option value="25">Top 25</option>
                    <option value="50">Top 50</option>
                  </select>
                </div>
              </div>
            </>
          )}

          {chartType === 'heatmap' && (
            <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 text-xs text-slate-400">
              <p className="leading-relaxed">
                Computes pairwise Pearson correlation coefficients ($-1.0$ to $+1.0$) across all numeric columns with zero-variance protection.
              </p>
            </div>
          )}

          {chartType === 'treemap' && (
            <div className="p-3 rounded-xl bg-amber-950/20 border border-amber-800/40 text-[11px] text-amber-300">
              Treemaps nest relative proportional area by category, ideal for hierarchical budget or revenue splits.
            </div>
          )}

          {chartType === 'sunburst' && (
            <div className="p-3 rounded-xl bg-purple-950/20 border border-purple-800/40 text-[11px] text-purple-300">
              Sunburst charts project concentric radial rings showing hierarchical category contribution to totals.
            </div>
          )}

          <button
            onClick={handleGenerate}
            disabled={loading}
            className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 text-xs font-bold text-white transition-colors flex items-center justify-center gap-2 shadow-sm shadow-blue-500/20"
          >
            {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <BarChart3 className="w-4 h-4" />}
            <span>Render Visualization</span>
          </button>
        </div>

        {/* Live Canvas Area */}
        <div className="lg:col-span-2 space-y-4">
          <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800 shadow-xl min-h-[440px] flex flex-col justify-between">
            {error ? (
              <div className="p-4 rounded-xl bg-red-950/20 border border-red-900/30 text-xs text-red-300">
                {error}
              </div>
            ) : figure ? (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="text-xs font-semibold text-slate-200">
                    {chartType === 'heatmap'
                      ? 'Multi-Variable Correlation Matrix'
                      : chartType === 'combo'
                      ? `Dual-Axis: ${yAxis} (Bar) & ${secondaryYAxis} (Line) by ${xAxis}`
                      : `${aggregation.toUpperCase()} of ${yAxis} by ${xAxis}`}
                  </div>
                  <div className="flex items-center gap-3 text-[10px] text-slate-400 font-mono">
                    {colorDimension && <span className="text-cyan-400">Color: {colorDimension}</span>}
                    <span>Plotly.js Interactive</span>
                  </div>
                </div>
                <PlotlyChart figure={figure} className="w-full h-96" />
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-80 text-slate-500 text-xs">
                <BarChart3 className="w-8 h-8 mb-2 opacity-50" />
                <span>Configure axes and click Render Visualization</span>
              </div>
            )}

            {dataHandling && (
              <div className="mt-4 pt-3 border-t border-slate-800/80">
                <DataHandlingPanel report={dataHandling} defaultExpanded={false} />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Code Export Modal */}
      <CodeExportModal
        isOpen={codeModalOpen}
        onClose={() => setCodeModalOpen(false)}
        title={`${aggregation.toUpperCase()} of ${yAxis} grouped by ${xAxis}`}
        pythonCode={pythonCode}
        sqlCode={sqlCode}
      />
    </div>
  );
};
