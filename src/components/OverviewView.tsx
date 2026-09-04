import React, { useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Database,
  FileSpreadsheet,
  FileText,
  HelpCircle,
  LayoutGrid,
  LineChart,
  MessageSquareCode,
  ShieldCheck,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import { ActiveTab, DataQualityAudit, DatasetProfile, InsightItem } from '../types.js';
import { PipelineDiagram } from './PipelineDiagram.js';

interface OverviewViewProps {
  profile: DatasetProfile;
  quality: DataQualityAudit | null;
  insights: InsightItem[];
  onNavigateTab: (tab: ActiveTab) => void;
  onAskQuestion: (question: string) => void;
}

export const OverviewView: React.FC<OverviewViewProps> = ({
  profile,
  quality,
  insights,
  onNavigateTab,
  onAskQuestion,
}) => {
  const [askInput, setAskInput] = useState('');

  const sampleQuestions = [
    'Which region generates the highest revenue?',
    'Show monthly revenue trend over time.',
    'Which product category is most profitable?',
    'Analyze correlation between quantity and revenue.',
    'What is the overall average profit?',
  ];

  const handleAskSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (askInput.trim()) {
      onAskQuestion(askInput.trim());
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 85) return 'text-emerald-400 bg-emerald-950/40 border-emerald-800/50';
    if (score >= 70) return 'text-blue-400 bg-blue-950/40 border-blue-800/50';
    if (score >= 50) return 'text-amber-400 bg-amber-950/40 border-amber-800/50';
    return 'text-red-400 bg-red-950/40 border-red-800/50';
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900/90 to-blue-950/30 border border-slate-800/90 shadow-lg">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-blue-400 font-mono">
              Dataset Loaded
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span className="text-xs text-slate-400">Ready for Analysis</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-100 tracking-tight font-display">
            {profile.filename}
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-2xl">
            Deterministic data profiling, Tukey outlier auditing, Pearson correlation matrix, and executive Gemini insights.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => onNavigateTab('report')}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white transition-colors shadow-sm shadow-emerald-500/20"
          >
            <FileText className="w-4 h-4" />
            <span>Generate Full Report</span>
          </button>
          <button
            onClick={() => onNavigateTab('dashboard')}
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white transition-colors shadow-sm shadow-indigo-500/20"
          >
            <LayoutGrid className="w-4 h-4" />
            <span>BI Dashboard</span>
          </button>
          <button
            onClick={() => onNavigateTab('ask')}
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white transition-colors shadow-sm shadow-blue-500/20"
          >
            <MessageSquareCode className="w-4 h-4" />
            <span>Ask Data</span>
          </button>
          <button
            onClick={() => onNavigateTab('studio')}
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-slate-200 transition-colors"
          >
            <BarChart3 className="w-4 h-4" />
            <span>Visual Studio</span>
          </button>
        </div>
      </div>

      {/* Dataset KPI Metrics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Total Rows */}
        <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80">
          <div className="text-[11px] font-medium text-slate-400">Total Records</div>
          <div className="text-xl font-bold font-mono text-slate-100 mt-1">
            {profile.rowCount.toLocaleString()}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">Rows analyzed</div>
        </div>

        {/* Total Columns */}
        <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80">
          <div className="text-[11px] font-medium text-slate-400">Columns</div>
          <div className="text-xl font-bold font-mono text-slate-100 mt-1">
            {profile.columnCount}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">
            {profile.columns.filter(c => c.type === 'numeric').length} num •{' '}
            {profile.columns.filter(c => c.type === 'categorical').length} cat
          </div>
        </div>

        {/* Quality Score */}
        <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80">
          <div className="text-[11px] font-medium text-slate-400">Data Quality</div>
          <div className="flex items-baseline gap-1.5 mt-1">
            <span className="text-xl font-bold font-mono text-slate-100">
              {quality ? quality.score : '--'}
            </span>
            <span className="text-xs text-slate-400">/ 100</span>
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">
            {quality?.rating || 'Calculating...'}
          </div>
        </div>

        {/* Missing Cells */}
        <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80">
          <div className="text-[11px] font-medium text-slate-400">Missing Data</div>
          <div className="text-xl font-bold font-mono text-slate-100 mt-1">
            {profile.missingPercentage}%
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">
            {profile.totalMissingCells} null cells
          </div>
        </div>

        {/* Duplicate Rows */}
        <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80">
          <div className="text-[11px] font-medium text-slate-400">Duplicates</div>
          <div className="text-xl font-bold font-mono text-slate-100 mt-1">
            {profile.duplicateRowCount}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">
            {profile.duplicatePercentage}% of dataset
          </div>
        </div>

        {/* Memory */}
        <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80">
          <div className="text-[11px] font-medium text-slate-400">Memory Footprint</div>
          <div className="text-xl font-bold font-mono text-slate-100 mt-1">
            {profile.memoryEstimateKb} KB
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">In-memory buffer</div>
        </div>
      </div>

      {/* Analytical Pipeline Flow Diagram */}
      <PipelineDiagram />

      {/* Interactive Natural Language Search / Query Box */}
      <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-md">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="w-4 h-4 text-purple-400" />
          <h2 className="text-sm font-semibold text-slate-200">
            Ask Your Data in Natural Language
          </h2>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-950/50 text-purple-400 border border-purple-800/40">
            Gemini Planner + Pure Math Engine
          </span>
        </div>
        <p className="text-xs text-slate-400 mb-3">
          Gemini plans the analytical operation and translates business context, while deterministic calculations compute exact, unalterable metrics.
        </p>

        <form onSubmit={handleAskSubmit} className="flex gap-2">
          <input
            type="text"
            value={askInput}
            onChange={e => setAskInput(e.target.value)}
            placeholder="e.g. Which region generates the highest revenue? Or show monthly revenue trend..."
            className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
          />
          <button
            type="submit"
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white transition-colors"
          >
            Ask AI
          </button>
        </form>

        {/* Suggestion Chips */}
        <div className="flex flex-wrap items-center gap-1.5 mt-3">
          <span className="text-[11px] text-slate-500 font-medium">Try asking:</span>
          {sampleQuestions.map((sq, idx) => (
            <button
              key={idx}
              onClick={() => onAskQuestion(sq)}
              className="text-[11px] px-2.5 py-1 rounded-full bg-slate-800/70 hover:bg-slate-800 border border-slate-700/60 text-slate-300 transition-colors hover:text-blue-400"
            >
              {sq}
            </button>
          ))}
        </div>
      </div>

      {/* Two Column Grid: Executive Insights + Data Quality Audit */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Executive Insights Preview */}
        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-blue-400" />
                <h3 className="text-sm font-semibold text-slate-200">
                  Automated Executive Insights
                </h3>
              </div>
              <button
                onClick={() => onNavigateTab('insights')}
                className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 font-medium"
              >
                <span>View All ({insights.length})</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-3">
              {insights.slice(0, 3).map(item => (
                <div
                  key={item.id}
                  className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/70 hover:border-slate-700 transition-colors"
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-blue-950/60 text-blue-400 border border-blue-800/40">
                      {item.category}
                    </span>
                    <span className="text-xs font-bold font-mono text-emerald-400">
                      {item.metric}
                    </span>
                  </div>
                  <div className="text-xs font-semibold text-slate-200">{item.title}</div>
                  <div className="text-xs text-slate-400 mt-1 line-clamp-2">{item.finding}</div>
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={() => onNavigateTab('insights')}
            className="w-full mt-4 py-2 rounded-lg bg-slate-800/80 hover:bg-slate-800 text-xs font-medium text-slate-300 flex items-center justify-center gap-1.5 border border-slate-700/60"
          >
            <span>Explore All Statistical Insights</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Data Quality Snapshot */}
        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-semibold text-slate-200">Data Quality Audit</h3>
              </div>
              <button
                onClick={() => onNavigateTab('quality')}
                className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 font-medium"
              >
                <span>Full Audit Report</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {quality ? (
              <div className="space-y-3">
                {/* Score Banner */}
                <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/80 flex items-center justify-between">
                  <div>
                    <div className="text-xs text-slate-400">Audited Reliability Index</div>
                    <div className="flex items-baseline gap-2 mt-0.5">
                      <span className="text-2xl font-bold font-mono text-slate-100">
                        {quality.score}
                      </span>
                      <span className="text-xs text-slate-500">/ 100</span>
                      <span
                        className={`text-[11px] font-semibold px-2 py-0.5 rounded border ml-2 ${getScoreColor(
                          quality.score
                        )}`}
                      >
                        {quality.rating}
                      </span>
                    </div>
                  </div>
                  <div className="text-right text-[11px] text-slate-400 font-mono">
                    <div>{quality.metrics.healthyColumnCount} / {quality.metrics.totalColumns} Healthy Cols</div>
                    <div>{quality.issues.length} Audit Notices</div>
                  </div>
                </div>

                {/* Audit Checklist Items */}
                <div className="space-y-1.5">
                  {quality.checklist.passed.slice(0, 2).map((pass, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs text-emerald-300 bg-emerald-950/20 p-2 rounded-lg border border-emerald-900/30">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span className="truncate">{pass}</span>
                    </div>
                  ))}
                  {quality.checklist.warnings.slice(0, 2).map((warn, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs text-amber-300 bg-amber-950/20 p-2 rounded-lg border border-amber-900/30">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span className="truncate">{warn}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-xs text-slate-500 py-6 text-center">Loading audit data...</div>
            )}
          </div>

          <button
            onClick={() => onNavigateTab('quality')}
            className="w-full mt-4 py-2 rounded-lg bg-slate-800/80 hover:bg-slate-800 text-xs font-medium text-slate-300 flex items-center justify-center gap-1.5 border border-slate-700/60"
          >
            <span>Review Quality Audit & Deduplication</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Columns Quick Roster */}
      <div className="p-5 rounded-2xl bg-slate-900/40 border border-slate-800/80">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4 text-blue-400" />
            <h3 className="text-sm font-semibold text-slate-200">Column Schema & Types</h3>
          </div>
          <button
            onClick={() => onNavigateTab('profile')}
            className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 font-medium"
          >
            <span>View Deep Column Profiles</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5">
          {profile.columns.map(col => (
            <div
              key={col.name}
              className="p-2.5 rounded-lg bg-slate-950/50 border border-slate-800/70 hover:border-slate-700 transition-colors"
            >
              <div className="text-xs font-semibold text-slate-200 truncate">{col.name}</div>
              <div className="flex items-center justify-between mt-1">
                <span
                  className={`text-[10px] uppercase font-mono px-1.5 py-0.5 rounded border ${
                    col.type === 'numeric'
                      ? 'bg-blue-950/60 text-blue-400 border-blue-800/40'
                      : col.type === 'datetime'
                      ? 'bg-purple-950/60 text-purple-400 border-purple-800/40'
                      : 'bg-emerald-950/60 text-emerald-400 border-emerald-800/40'
                  }`}
                >
                  {col.type}
                </span>
                <span className="text-[10px] text-slate-500 font-mono">
                  {col.uniqueCount} uniq
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
