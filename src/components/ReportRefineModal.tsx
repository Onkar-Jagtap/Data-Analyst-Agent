import React, { useState, useEffect } from 'react';
import { Sparkles, X, RefreshCw, AlertCircle, ArrowRight, Lightbulb } from 'lucide-react';

export interface RefineTarget {
  section: 'headline' | 'overview' | 'macroContext' | 'strengths' | 'risks' | 'actionPlan' | 'singleAction';
  title: string;
  currentContent: any;
  actionId?: string;
}

export interface ReportRefineModalProps {
  target: RefineTarget | null;
  onClose: () => void;
  onApplyRefine: (target: RefineTarget, instruction: string) => Promise<void>;
  isRefining: boolean;
  refineError: string | null;
}

export const ReportRefineModal: React.FC<ReportRefineModalProps> = ({
  target,
  onClose,
  onApplyRefine,
  isRefining,
  refineError,
}) => {
  const [instruction, setInstruction] = useState<string>('');

  useEffect(() => {
    setInstruction('');
  }, [target]);

  if (!target) return null;

  const getQuickSuggestions = () => {
    switch (target.section) {
      case 'headline':
        return [
          'Make it more punchy & urgent for CEO',
          'Emphasize the primary margin rate and profit sum',
          'Highlight top growth segment expansion',
        ];
      case 'overview':
        return [
          'Summarize in 2 concise sentences for senior board',
          'Highlight bottom-line margin decay & discount risk',
          'Emphasize operational scale and transaction velocity',
        ];
      case 'macroContext':
        return [
          'Frame around enterprise inflation and pricing pressure',
          'Focus on competitive positioning and market share defense',
          'Add guidance on capital preservation and cost discipline',
        ];
      case 'strengths':
        return [
          'Add emphasis on transaction velocity and AOV',
          'Highlight high-margin product tier dominance',
          'Frame around customer account stability',
        ];
      case 'risks':
        return [
          'Focus on Pareto 80/20 customer concentration hazard',
          'Address refund rates and negative transaction discrepancies',
          'Highlight data quality gaps and unpopulated records',
        ];
      case 'actionPlan':
        return [
          'Add 2 aggressive pricing & discount tier initiatives',
          'Focus on 30-day quick wins with high operating leverage',
          'Include a data governance and automated validation sprint',
        ];
      case 'singleAction':
        return [
          'Make execution steps more specific with quantified targets',
          'Shorten to a crisp 30-day milestone checklist',
          'Reassign responsibility to VP of Operations with target +15% lift',
        ];
      default:
        return [
          'Make more executive-ready',
          'Quantify targets with specific dates and benchmarks',
        ];
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!instruction.trim() || isRefining) return;
    onApplyRefine(target, instruction.trim());
  };

  const renderContentPreview = () => {
    if (typeof target.currentContent === 'string') {
      return (
        <div className="p-3 rounded-lg bg-slate-950/80 border border-slate-800 text-xs text-slate-300 font-mono max-h-32 overflow-y-auto leading-relaxed">
          {target.currentContent}
        </div>
      );
    }
    if (Array.isArray(target.currentContent)) {
      return (
        <ul className="p-3 rounded-lg bg-slate-950/80 border border-slate-800 text-xs text-slate-300 space-y-1.5 max-h-32 overflow-y-auto">
          {target.currentContent.map((item, i) => (
            <li key={i} className="flex items-start gap-2">
              <span className="text-blue-400 mt-0.5">•</span>
              <span className="line-clamp-2">{typeof item === 'string' ? item : item.title || JSON.stringify(item)}</span>
            </li>
          ))}
        </ul>
      );
    }
    if (typeof target.currentContent === 'object' && target.currentContent !== null) {
      return (
        <div className="p-3 rounded-lg bg-slate-950/80 border border-slate-800 text-xs text-slate-300 max-h-32 overflow-y-auto space-y-1">
          <div className="font-semibold text-white">{target.currentContent.title || 'Action Item'}</div>
          <div className="text-slate-400">{target.currentContent.action || ''}</div>
          {target.currentContent.expectedImpact && (
            <div className="text-emerald-400 text-[11px]">Impact: {target.currentContent.expectedImpact}</div>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-xl rounded-2xl bg-slate-900 border border-slate-700/80 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 sm:px-6 bg-gradient-to-r from-blue-950/60 to-slate-900 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span>AI Refine: {target.title}</span>
              </h3>
              <p className="text-[11px] text-slate-400">
                Specify exactly how you want this section rewritten or customized
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isRefining}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body Form */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4 overflow-y-auto">
          {/* Current Content Preview */}
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5 flex items-center justify-between">
              <span>Current Section Content:</span>
              <span className="text-slate-500 font-normal">Deterministic baseline</span>
            </div>
            {renderContentPreview()}
          </div>

          {/* Quick suggestions */}
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5 flex items-center gap-1">
              <Lightbulb className="w-3 h-3 text-amber-400" />
              <span>Suggested Directives:</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {getQuickSuggestions().map((sug, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setInstruction(sug)}
                  className={`text-[11px] px-2.5 py-1 rounded-md border text-left transition-all cursor-pointer ${
                    instruction === sug
                      ? 'bg-blue-600/30 text-blue-200 border-blue-500'
                      : 'bg-slate-950/60 hover:bg-slate-800 text-slate-300 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  {sug}
                </button>
              ))}
            </div>
          </div>

          {/* User directive input */}
          <div>
            <label className="text-xs font-semibold text-slate-200 mb-1.5 block">
              Your Custom Instruction:
            </label>
            <textarea
              rows={3}
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              placeholder="e.g. 'I want this here: focus on Q3 customer churn, add target percentage of +12% growth, and make the tone assertive for an executive audit.'"
              className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all leading-relaxed"
              autoFocus
            />
          </div>

          {refineError && (
            <div className="p-3 rounded-lg bg-red-950/40 border border-red-800/60 text-xs text-red-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{refineError}</span>
            </div>
          )}

          {/* Footer controls */}
          <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isRefining}
              className="px-3.5 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isRefining || !instruction.trim()}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-500 text-white text-xs font-semibold flex items-center gap-2 shadow-md shadow-blue-500/20 transition-all cursor-pointer"
            >
              {isRefining ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Refining with AI...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Apply AI Refinement</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
