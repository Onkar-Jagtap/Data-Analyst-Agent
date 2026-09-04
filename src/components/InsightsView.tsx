import React from 'react';
import {
  ArrowUpRight,
  BarChart3,
  CheckCircle2,
  LineChart,
  MessageSquareCode,
  Percent,
  PieChart,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import { ActiveTab, InsightItem } from '../types.js';

interface InsightsViewProps {
  insights: InsightItem[];
  onNavigateTab: (tab: ActiveTab) => void;
  onAskQuestion: (question: string) => void;
  onPlotInStudio?: (chartSuggestion: any) => void;
}

export const InsightsView: React.FC<InsightsViewProps> = ({
  insights,
  onNavigateTab,
  onAskQuestion,
  onPlotInStudio,
}) => {
  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'concentration':
        return <PieChart className="w-4 h-4 text-blue-400" />;
      case 'trend':
        return <TrendingUp className="w-4 h-4 text-emerald-400" />;
      case 'correlation':
        return <LineChart className="w-4 h-4 text-purple-400" />;
      default:
        return <Sparkles className="w-4 h-4 text-amber-400" />;
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header Banner */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900/90 to-purple-950/20 border border-slate-800/90 shadow-lg">
        <div className="flex items-center gap-2 mb-1">
          <Sparkles className="w-4 h-4 text-purple-400" />
          <span className="text-xs font-semibold uppercase tracking-wider text-purple-400 font-mono">
            Automated Analytical Findings
          </span>
        </div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-100 tracking-tight font-display">
          Executive Insights & Statistical Patterns
        </h1>
        <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-2xl">
          Discovered via Pareto concentration analysis, Pearson correlation coefficients, Tukey distribution checks, and temporal growth rates.
        </p>
      </div>

      {/* Insights Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {insights.map(item => (
          <div
            key={item.id}
            className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 hover:border-slate-700 transition-all flex flex-col justify-between shadow-sm"
          >
            <div>
              {/* Category and Confidence */}
              <div className="flex items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-slate-800 flex items-center justify-center">
                    {getCategoryIcon(item.category)}
                  </div>
                  <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                    {item.category}
                  </span>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950/50 text-emerald-400 border border-emerald-800/40">
                  {item.confidence.toUpperCase()} CONFIDENCE
                </span>
              </div>

              {/* Title & Metric Row */}
              <div className="flex items-baseline justify-between gap-3 mb-2">
                <h3 className="text-base font-bold text-slate-100">{item.title}</h3>
                <div className="text-right shrink-0">
                  <div className="text-xl font-bold font-mono text-emerald-400">{item.metric}</div>
                  {item.secondaryMetric && (
                    <div className="text-[10px] text-slate-500 font-mono">{item.secondaryMetric}</div>
                  )}
                </div>
              </div>

              {/* Finding Statement */}
              <div className="text-xs font-medium text-slate-200 p-3 rounded-xl bg-slate-950/70 border border-slate-800/70 mb-3">
                {item.finding}
              </div>

              {/* Business Interpretation */}
              <div className="text-xs text-slate-400 space-y-1 mb-3">
                <div className="text-[11px] font-semibold text-slate-300">Strategic Takeaway:</div>
                <p className="leading-relaxed">{item.interpretation}</p>
              </div>

              {/* Data Context Footnote */}
              <div className="text-[10px] text-slate-500 font-mono mb-4 pt-2 border-t border-slate-800/60">
                {item.dataContext}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 pt-2 border-t border-slate-800/80">
              <button
                onClick={() => onAskQuestion(`Explain more about: ${item.title}. ${item.finding}`)}
                className="flex-1 py-1.5 px-3 rounded-lg bg-blue-600/15 hover:bg-blue-600/25 text-blue-300 text-xs font-medium flex items-center justify-center gap-1.5 border border-blue-500/20 transition-colors"
              >
                <MessageSquareCode className="w-3.5 h-3.5" />
                <span>Ask AI to Dig Deeper</span>
              </button>

              {item.chartSuggestion && (
                <button
                  onClick={() => {
                    if (onPlotInStudio) {
                      onPlotInStudio(item.chartSuggestion);
                    }
                    onNavigateTab('studio');
                  }}
                  className="py-1.5 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium flex items-center gap-1.5 border border-slate-700 transition-colors"
                >
                  <BarChart3 className="w-3.5 h-3.5 text-amber-400" />
                  <span>Plot</span>
                </button>
              )}
            </div>
          </div>
        ))}

        {insights.length === 0 && (
          <div className="col-span-full py-16 text-center rounded-2xl bg-slate-900/30 border border-slate-800/80">
            <Sparkles className="w-8 h-8 text-indigo-400 mx-auto mb-2 opacity-60" />
            <p className="text-sm font-semibold text-slate-200">No Automated Insights Yet</p>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              Run a natural language query or build a chart in Visual Studio to generate fresh business patterns.
            </p>
            <button
              onClick={() => onNavigateTab('ask')}
              className="mt-4 px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs text-white font-medium transition-colors"
            >
              Ask Data Query
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
