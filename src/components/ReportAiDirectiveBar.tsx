import React from 'react';
import { Sparkles, RefreshCw, X, ChevronDown, ChevronUp, Lightbulb, Check } from 'lucide-react';

export interface ReportAiDirectiveBarProps {
  directive: string;
  setDirective: (val: string) => void;
  appliedDirective: string | null;
  isApplyingDirective: boolean;
  onApplyDirective: () => void;
  onClearDirective: () => void;
  isOpen: boolean;
  onToggleOpen: () => void;
}

export const ReportAiDirectiveBar: React.FC<ReportAiDirectiveBarProps> = ({
  directive,
  setDirective,
  appliedDirective,
  isApplyingDirective,
  onApplyDirective,
  onClearDirective,
  isOpen,
  onToggleOpen,
}) => {
  const presets = [
    { label: 'CFO / Margin Focus', text: 'Emphasize margin decay, unit economics, and discount reduction strategies' },
    { label: 'Board Growth Brief', text: 'Tailor for Board briefing with top growth priorities and high-velocity segments' },
    { label: 'Customer Retention & Churn', text: 'Focus on customer concentration risk, retention initiatives, and churn mitigation' },
    { label: 'Supply Chain & Operations', text: 'Highlight operational delivery bottlenecks, fulfillment variance, and logistics risks' },
    { label: 'Upsell & AOV Expansion', text: 'Focus on Average Order Value expansion and cross-selling secondary product tiers' },
  ];

  return (
    <div className="rounded-xl bg-gradient-to-r from-blue-950/50 via-slate-900 to-indigo-950/40 border border-blue-800/40 shadow-md print:hidden overflow-hidden transition-all">
      {/* Header bar that can be clicked to expand/collapse */}
      <div className="p-3 sm:px-4 flex items-center justify-between gap-3 border-b border-blue-900/30">
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="w-7 h-7 rounded-lg bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
            <Sparkles className="w-3.5 h-3.5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                AI Strategic Report Director
              </span>
              <span className="text-[10px] px-2 py-0.2 rounded-full bg-blue-500/20 text-blue-300 font-medium border border-blue-500/30">
                Natural Language Customizer
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {appliedDirective && (
            <div className="flex items-center gap-1.5 text-[11px] bg-blue-900/40 border border-blue-600/40 text-blue-200 px-2.5 py-1 rounded-md">
              <span className="font-semibold text-blue-300 truncate max-w-[180px] sm:max-w-[260px]">
                Active: "{appliedDirective}"
              </span>
              <button
                onClick={onClearDirective}
                className="text-blue-300 hover:text-white p-0.5 rounded cursor-pointer"
                title="Reset to default baseline report"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}

          <button
            onClick={onToggleOpen}
            className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1 px-2.5 py-1 rounded-md hover:bg-slate-800/80 transition-colors cursor-pointer"
          >
            <span>{isOpen ? 'Collapse' : 'Customize Report with AI'}</span>
            {isOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Expanded Content */}
      {isOpen && (
        <div className="p-4 space-y-3.5 bg-slate-950/40 animate-in fade-in duration-150">
          <div className="text-xs text-slate-300 flex items-start sm:items-center justify-between gap-2">
            <p className="leading-relaxed text-slate-400">
              Direct the AI how you want the executive report tailored, what themes or angles to emphasize, or what specific actions to include. The underlying figures remain 100% mathematically audited.
            </p>
          </div>

          {/* Quick Directive Presets */}
          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider flex items-center gap-1 mr-1">
              <Lightbulb className="w-3 h-3 text-amber-400" />
              <span>Presets:</span>
            </span>
            {presets.map((p, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setDirective(p.text)}
                className={`text-[11px] px-2.5 py-1 rounded-lg border transition-all cursor-pointer text-left ${
                  directive === p.text
                    ? 'bg-blue-600/30 text-blue-200 border-blue-500'
                    : 'bg-slate-900/80 hover:bg-slate-800 text-slate-300 border-slate-800 hover:border-slate-700'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Input & Action */}
          <div className="flex flex-col sm:flex-row items-stretch gap-2 pt-1">
            <div className="relative flex-1">
              <input
                type="text"
                value={directive}
                onChange={(e) => setDirective(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !isApplyingDirective && directive.trim()) {
                    onApplyDirective();
                  }
                }}
                placeholder="e.g., 'Rewrite headline & overview for executive committee, highlight top segment concentration, and recommend 3 pricing actions'"
                className="w-full bg-slate-950/90 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all shadow-inner"
              />
              {directive && (
                <button
                  type="button"
                  onClick={() => setDirective('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 text-xs cursor-pointer"
                  title="Clear text"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={onApplyDirective}
              disabled={isApplyingDirective || !directive.trim()}
              className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-500 text-white text-xs font-semibold flex items-center justify-center gap-2 shadow-md shadow-blue-500/20 transition-all shrink-0 cursor-pointer"
            >
              {isApplyingDirective ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Directing AI...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5 text-blue-200" />
                  <span>Apply AI Directive</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
