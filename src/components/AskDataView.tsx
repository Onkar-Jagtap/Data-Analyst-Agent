import React, { useState } from 'react';
import {
  AlertCircle,
  BrainCircuit,
  Calculator,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Code2,
  History,
  Info,
  LineChart,
  MessageSquareCode,
  Pin,
  RotateCcw,
  Send,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { AnalysisResult, DatasetProfile } from '../types.js';
import { PlotlyChart } from './PlotlyChart.js';
import { DataHandlingPanel } from './DataHandlingPanel.js';
import { CodeExportModal } from './CodeExportModal.js';
import { generateReproducibleCode } from '../api.js';

interface AskDataViewProps {
  profile: DatasetProfile;
  activeResult: AnalysisResult | null;
  loading: boolean;
  history: AnalysisResult[];
  onAskQuestion: (question: string) => void;
  onSelectHistoryItem: (item: AnalysisResult) => void;
  onPinChart?: (chart: any, title?: string) => void;
}

export const AskDataView: React.FC<AskDataViewProps> = ({
  profile,
  activeResult,
  loading,
  history,
  onAskQuestion,
  onSelectHistoryItem,
  onPinChart,
}) => {
  const [questionInput, setQuestionInput] = useState('');
  const [showPlanRaw, setShowPlanRaw] = useState(false);

  // Code modal state
  const [codeModalOpen, setCodeModalOpen] = useState(false);
  const [pythonCode, setPythonCode] = useState('');
  const [sqlCode, setSqlCode] = useState('');
  const [codeLoading, setCodeLoading] = useState(false);

  const samplePrompts = [
    'Which region generates the highest revenue?',
    'Show monthly revenue trend over time.',
    'Which product category is most profitable?',
    'Analyze correlation between quantity and revenue.',
    'Compare revenue and profit across customer segments.',
    'What is the overall average profit?',
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (questionInput.trim() && !loading) {
      onAskQuestion(questionInput.trim());
      setQuestionInput('');
    }
  };

  const handleOpenCodeModal = async () => {
    if (!activeResult) return;
    setCodeLoading(true);
    try {
      const plan = activeResult.plan;
      const codeRes = await generateReproducibleCode({
        filename: profile.filename,
        metric: plan.metric,
        xAxis: plan.group_by?.[0] || plan.visualization?.x,
        yAxis: plan.metric || plan.visualization?.y,
        aggregation: plan.aggregation || 'sum',
        sortDirection: plan.sort?.direction || 'desc',
        limit: plan.limit || 10,
      });
      setPythonCode(codeRes.python);
      setSqlCode(codeRes.sql);
      setCodeModalOpen(true);
    } catch (err: any) {
      alert(err.message || 'Failed to generate code');
    } finally {
      setCodeLoading(false);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <MessageSquareCode className="w-4 h-4 text-blue-400" />
          <span className="text-xs font-semibold uppercase tracking-wider text-blue-400 font-mono">
            Autonomous Analytics Engine
          </span>
        </div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-100 tracking-tight font-display">
          Ask Your Data
        </h1>
        <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-2xl leading-relaxed">
          Gemini plans the analysis, deterministic mathematical algorithms compute exact unalterable figures, and interactive Plotly figures render the answers.
        </p>
      </div>

      {/* Query Input Box */}
      <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-md">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            type="text"
            value={questionInput}
            onChange={e => setQuestionInput(e.target.value)}
            disabled={loading}
            placeholder="Ask anything (e.g., Which region generates highest revenue? Or show monthly sales trend...)"
            className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={loading || !questionInput.trim()}
            className="px-5 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-600 text-xs font-bold text-white transition-colors flex items-center gap-2 shadow-sm shadow-blue-500/20"
          >
            {loading ? (
              <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            <span>Analyze</span>
          </button>
        </form>

        {/* Suggestion Chips */}
        <div className="flex flex-wrap items-center gap-1.5 mt-3">
          <span className="text-[11px] text-slate-500 font-medium">Suggestions:</span>
          {samplePrompts.map((prompt, idx) => (
            <button
              key={idx}
              onClick={() => onAskQuestion(prompt)}
              disabled={loading}
              className="text-[11px] px-2.5 py-1 rounded-full bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 text-slate-300 transition-colors hover:text-blue-400 disabled:opacity-50"
            >
              {prompt}
            </button>
          ))}
        </div>
      </div>

      {/* Loading Stage Indicator */}
      {loading && (
        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3 animate-pulse">
          <div className="flex items-center gap-2 text-xs font-semibold text-blue-400 font-mono">
            <span className="w-2 h-2 rounded-full bg-blue-400 animate-ping" />
            <span>Analytical Pipeline Running...</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 text-[11px] text-slate-400 font-mono">
            <div className="p-2 rounded bg-slate-950 border border-slate-800 flex items-center gap-1.5 text-blue-300">
              <BrainCircuit className="w-3.5 h-3.5" />
              <span>1. Gemini Planning</span>
            </div>
            <div className="p-2 rounded bg-slate-950 border border-slate-800 flex items-center gap-1.5 text-blue-300">
              <Calculator className="w-3.5 h-3.5" />
              <span>2. Pure Deterministic Math</span>
            </div>
            <div className="p-2 rounded bg-slate-950 border border-slate-800 flex items-center gap-1.5 text-blue-300">
              <LineChart className="w-3.5 h-3.5" />
              <span>3. Plotly Visualization</span>
            </div>
            <div className="p-2 rounded bg-slate-950 border border-slate-800 flex items-center gap-1.5 text-blue-300">
              <Sparkles className="w-3.5 h-3.5" />
              <span>4. Gemini Explanation</span>
            </div>
          </div>
        </div>
      )}

      {/* Active Result Presentation */}
      {activeResult && !loading && (
        <div className="p-6 rounded-2xl bg-slate-900/70 border border-slate-800 shadow-xl space-y-5">
          {/* Question, Status and Code Export button */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
            <div>
              <span className="text-[10px] uppercase font-mono text-slate-500">Query Evaluated</span>
              <h2 className="text-base font-bold text-slate-100 mt-0.5">
                "{activeResult.question}"
              </h2>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950/60 text-emerald-400 border border-emerald-800/40 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                <span>Deterministic Math Verified</span>
              </span>

              {activeResult.chart && onPinChart && (
                <button
                  onClick={() => onPinChart(activeResult.chart, activeResult.question)}
                  className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 text-xs font-medium text-blue-300 transition-colors shadow-sm"
                  title="Pin this visualization to BI Dashboard"
                >
                  <Pin className="w-3.5 h-3.5" />
                  <span>Pin to Dashboard</span>
                </button>
              )}

              <button
                onClick={handleOpenCodeModal}
                disabled={codeLoading}
                className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-medium text-slate-200 transition-colors shadow-sm"
              >
                <Code2 className="w-3.5 h-3.5 text-blue-400" />
                <span>Export Code</span>
              </button>
            </div>
          </div>

          {/* Executive Answer Callout */}
          <div className="p-4 rounded-xl bg-blue-950/20 border border-blue-800/40 text-slate-100 text-sm sm:text-base font-semibold leading-relaxed">
            {activeResult.answer}
          </div>

          {/* Key Metrics Callout Cards */}
          {activeResult.keyMetrics && activeResult.keyMetrics.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {activeResult.keyMetrics.map((km, idx) => (
                <div key={idx} className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
                  <div className="text-[11px] text-slate-400 truncate">{km.label}</div>
                  <div className="text-lg font-bold font-mono text-slate-100 mt-0.5 truncate">
                    {km.value}
                  </div>
                  {km.context && (
                    <div className="text-[10px] text-slate-500 font-mono truncate mt-0.5">
                      {km.context}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Interactive Plotly Chart */}
          {activeResult.chart && (
            <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800/80">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-300">
                  Interactive Visualization
                </span>
                <span className="text-[10px] text-slate-500 font-mono">
                  Hover to inspect • Drag to zoom • Camera icon to export PNG
                </span>
              </div>
              <PlotlyChart figure={activeResult.chart} className="w-full h-80 sm:h-96" />
            </div>
          )}

          {/* Business Interpretation Bullet Points */}
          {activeResult.businessInterpretation && activeResult.businessInterpretation.length > 0 && (
            <div className="p-4 rounded-xl bg-slate-950/50 border border-slate-800/80 space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-300">
                <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                <span>Executive Context & Takeaways</span>
              </div>
              <ul className="space-y-1.5 text-xs text-slate-300 list-disc list-inside">
                {activeResult.businessInterpretation.map((item, idx) => (
                  <li key={idx} className="leading-relaxed">
                    <span className="text-slate-200">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Transparent Data Handling Disclosure */}
          {activeResult.dataHandling && (
            <DataHandlingPanel report={activeResult.dataHandling} defaultExpanded={false} />
          )}

          {/* Plan Inspection Toggle */}
          <div className="pt-2">
            <button
              onClick={() => setShowPlanRaw(!showPlanRaw)}
              className="text-[11px] text-slate-500 hover:text-slate-300 flex items-center gap-1 font-mono transition-colors"
            >
              <span>{showPlanRaw ? 'Hide Execution Plan JSON' : 'Inspect Execution Plan JSON'}</span>
              {showPlanRaw ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>

            {showPlanRaw && (
              <pre className="mt-2 p-3 rounded-lg bg-slate-950 border border-slate-800 text-[10px] text-slate-400 font-mono overflow-x-auto">
                {JSON.stringify(activeResult.plan, null, 2)}
              </pre>
            )}
          </div>
        </div>
      )}

      {/* Query History */}
      {history.length > 1 && (
        <div className="p-5 rounded-2xl bg-slate-900/40 border border-slate-800/80 space-y-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
            <History className="w-3.5 h-3.5 text-slate-400" />
            <span>Recent Query History</span>
          </div>

          <div className="space-y-1.5">
            {history.map((hist, idx) => (
              <button
                key={idx}
                onClick={() => onSelectHistoryItem(hist)}
                className={`w-full text-left p-2.5 rounded-lg text-xs flex items-center justify-between transition-colors ${
                  activeResult?.question === hist.question
                    ? 'bg-blue-600/15 border border-blue-500/30 text-blue-300'
                    : 'bg-slate-950/60 hover:bg-slate-900 border border-slate-800/60 text-slate-300'
                }`}
              >
                <div className="truncate mr-3 font-medium">"{hist.question}"</div>
                <div className="text-[10px] text-slate-500 font-mono shrink-0">
                  {hist.dataHandling.validRowsAnalyzed.toLocaleString()} rows
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Code Modal */}
      <CodeExportModal
        isOpen={codeModalOpen}
        onClose={() => setCodeModalOpen(false)}
        title={activeResult?.question || 'Analysis Script'}
        pythonCode={pythonCode}
        sqlCode={sqlCode}
      />
    </div>
  );
};
