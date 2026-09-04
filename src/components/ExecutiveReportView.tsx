import React, { useState, useEffect } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  Building2,
  Calendar,
  CheckCircle2,
  CheckSquare,
  ChevronDown,
  Clock,
  Copy,
  Download,
  FileCheck,
  FileSpreadsheet,
  FileText,
  HelpCircle,
  Info,
  Layers,
  Lightbulb,
  Maximize2,
  Printer,
  RefreshCw,
  Share2,
  Shield,
  ShieldCheck,
  Sparkles,
  TrendingDown,
  TrendingUp,
  UserCheck,
} from 'lucide-react';
import { DatasetProfile, ExecutiveReport, StrategicActionItem } from '../types.js';
import { fetchExecutiveReport } from '../api.js';
import { PlotlyChart } from './PlotlyChart.js';

interface ExecutiveReportViewProps {
  profile: DatasetProfile | null;
  onNavigateTab?: (tab: string) => void;
}

export const ExecutiveReportView: React.FC<ExecutiveReportViewProps> = ({
  profile,
  onNavigateTab,
}) => {
  const [report, setReport] = useState<ExecutiveReport | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);
  const [actionCategoryFilter, setActionCategoryFilter] = useState<string>('all');
  const [showCodeScripts, setShowCodeScripts] = useState<boolean>(false);
  const [presentationMode, setPresentationMode] = useState<boolean>(false);

  useEffect(() => {
    if (!profile) return;
    loadReport(false);
  }, [profile?.id]);

  const loadReport = async (forceAi = false) => {
    if (!profile) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchExecutiveReport(profile.id, forceAi);
      setReport(data);
    } catch (err: any) {
      setError(err.message || 'Failed to generate executive report.');
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleCopyToClipboard = () => {
    if (!report) return;
    const text = generateMarkdownSummary(report);
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleDownloadMarkdown = () => {
    if (!report) return;
    const text = generateMarkdownSummary(report);
    const blob = new Blob([text], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${report.datasetName.replace(/[^a-z0-9]/gi, '_')}_Executive_Report.md`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const generateMarkdownSummary = (rep: ExecutiveReport): string => {
    return `# ${rep.datasetName} — Executive Business Intelligence & Strategy Report
Generated on: ${new Date(rep.generatedAt).toLocaleString()}
Domain: ${rep.datasetScale.primaryDomain}
Scale: ${rep.datasetScale.rows.toLocaleString()} Rows | ${rep.datasetScale.columns} Columns | Quality Score: ${rep.dataQualityHealth.overallScore}/100

---

## Executive Summary
**${rep.executiveBrief.headline}**

${rep.executiveBrief.overview}

*Macro Context:*
${rep.executiveBrief.macroContext}

### Core Strengths & Commercial Drivers:
${rep.executiveBrief.strengths.map(s => `- ${s}`).join('\n')}

### Risks & Sensitivity Warnings:
${rep.executiveBrief.risks.map(r => `- ${r}`).join('\n')}

---

## Executive Financial Economics & KPIs
- Gross Revenue / Total Volume: ${rep.businessEconomics.totalRevenueFormatted}
- Net Profit: ${rep.businessEconomics.totalProfitFormatted} (Margin: ${rep.businessEconomics.profitMarginFormatted})
- Average Order Value (AOV): ${rep.businessEconomics.averageOrderValueFormatted}
- Top Contributor: ${rep.businessEconomics.topSegmentName} (${rep.businessEconomics.topSegmentShareFormatted} of volume)
- Pareto 80/20 Concentration: Top 20% accounts for ${rep.businessEconomics.paretoTop20ShareFormatted} of volume
- Period-over-Period Growth: ${rep.businessEconomics.periodGrowthFormatted}
- Refunds & Negative Adjustments: ${rep.businessEconomics.refundAdjustmentCount} records (${rep.businessEconomics.refundAdjustmentFormatted})

---

## Strategic Action Plan ("What Needs To Be Done")
${rep.actionPlan.map(act => `### [${act.category}] ${act.title} (Priority: ${act.priority})
- **Action**: ${act.action}
- **Expected Impact**: ${act.expectedImpact}
- **Responsible**: ${act.responsibleRole}
`).join('\n')}

---

## Data Governance & Privacy Verification
- Completeness: ${100 - rep.dataQualityHealth.nullRate}%
- Duplicate Rows: ${rep.dataQualityHealth.duplicateRows}
- Outliers Detected: ${rep.dataQualityHealth.outlierCount}
- Compliance: ${rep.dataQualityHealth.complianceNote}

*Data Studio by PJA — Autonomous Deterministic Business Intelligence*
`;
  };

  if (!profile) {
    return (
      <div className="p-8 text-center text-slate-400">
        <FileText className="w-12 h-12 mx-auto mb-3 opacity-30 text-slate-500" />
        <h3 className="text-base font-semibold text-slate-300">No Dataset Selected</h3>
        <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
          Please upload or select an active dataset to generate the whole strategic executive report.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-16 flex flex-col items-center justify-center text-center space-y-4">
        <div className="relative">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600/20 to-indigo-600/20 border border-blue-500/30 flex items-center justify-center animate-pulse">
            <RefreshCw className="w-6 h-6 text-blue-400 animate-spin" />
          </div>
        </div>
        <div>
          <h3 className="text-base font-semibold text-slate-200">
            Synthesizing Full Executive Report...
          </h3>
          <p className="text-xs text-slate-400 mt-1 max-w-md">
            Auditing mathematical totals, constructing multi-dimensional Plotly charts, assessing Pareto distributions, and building actionable strategic recommendations.
          </p>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-emerald-400 font-mono bg-emerald-950/40 border border-emerald-800/40 px-3 py-1 rounded-full">
          <ShieldCheck className="w-3.5 h-3.5" /> Zero Hallucination • Privacy Shield Verified
        </div>
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="p-8 max-w-2xl mx-auto text-center space-y-4">
        <div className="w-12 h-12 rounded-xl bg-red-950/50 border border-red-800/60 flex items-center justify-center mx-auto text-red-400">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <div>
          <h3 className="text-base font-semibold text-slate-200">Failed to Generate Report</h3>
          <p className="text-xs text-red-400 mt-1">{error}</p>
        </div>
        <button
          onClick={() => loadReport(false)}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-medium transition-colors"
        >
          Retry Report Generation
        </button>
      </div>
    );
  }

  const filteredActions = report.actionPlan.filter(act => {
    if (actionCategoryFilter === 'all') return true;
    if (actionCategoryFilter === 'immediate') return act.category === 'Immediate 30-Day';
    if (actionCategoryFilter === 'optimization') return act.category === '60-90 Day Optimization';
    if (actionCategoryFilter === 'governance') return act.category === 'Governance & Data Quality';
    if (actionCategoryFilter === 'risk') return act.category === 'Risk & Sensitivity';
    return true;
  });

  return (
    <div className={`space-y-8 pb-20 ${presentationMode ? 'max-w-6xl mx-auto' : ''}`}>
      {/* ------------------------------------------------------------ */}
      {/* Top Action Bar & Executive Controls (Hidden on Print) */}
      {/* ------------------------------------------------------------ */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-xl bg-slate-900/80 border border-slate-800 print:hidden shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                Data Studio by PJA
              </span>
              <span className="text-slate-600">•</span>
              <span className="text-xs text-slate-400 font-mono">
                Executive Intelligence Dossier
              </span>
            </div>
            <h1 className="text-sm font-semibold text-slate-200">
              Whole Strategic & Visual Analysis Report
            </h1>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-stretch sm:self-auto justify-end">
          <button
            onClick={() => loadReport(true)}
            className="px-3 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-200 border border-slate-700/80 text-xs font-medium flex items-center gap-1.5 transition-colors"
            title="Re-run AI strategy engine"
          >
            <Sparkles className="w-3.5 h-3.5 text-blue-400" />
            <span>Regenerate (AI)</span>
          </button>

          <button
            onClick={handleCopyToClipboard}
            className="px-3 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-200 border border-slate-700/80 text-xs font-medium flex items-center gap-1.5 transition-colors"
            title="Copy formatted markdown report to clipboard"
          >
            {copied ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-slate-400" />
                <span>Copy Summary</span>
              </>
            )}
          </button>

          <button
            onClick={handleDownloadMarkdown}
            className="px-3 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-200 border border-slate-700/80 text-xs font-medium flex items-center gap-1.5 transition-colors"
            title="Download report as .md"
          >
            <Download className="w-3.5 h-3.5 text-slate-400" />
            <span>Download .MD</span>
          </button>

          <button
            onClick={handlePrint}
            className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium flex items-center gap-1.5 shadow-sm shadow-blue-500/20 transition-all"
            title="Print or save as PDF"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print / PDF</span>
          </button>
        </div>
      </div>

      {/* ------------------------------------------------------------ */}
      {/* Report Header Card (Print Optimized) */}
      {/* ------------------------------------------------------------ */}
      <div className="p-6 md:p-8 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900/90 to-slate-950 border border-slate-800/90 shadow-xl relative overflow-hidden print:bg-white print:text-black print:border-slate-300">
        <div className="absolute -right-20 -top-20 w-80 h-80 bg-blue-500/5 rounded-full blur-3xl pointer-events-none print:hidden" />
        
        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-slate-800/80 print:border-slate-200">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="px-2.5 py-0.5 rounded-md bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[11px] font-semibold print:text-blue-700 print:border-blue-300">
                {report.datasetScale.primaryDomain}
              </span>
              <span className="px-2.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[11px] font-medium print:text-emerald-700">
                Quality: {report.dataQualityHealth.overallScore}/100
              </span>
              <span className="px-2.5 py-0.5 rounded-md bg-slate-800 text-slate-300 border border-slate-700 text-[11px] font-mono print:bg-slate-100 print:text-slate-700">
                {report.datasetScale.rows.toLocaleString()} Records
              </span>
            </div>
            <h2 className="text-2xl md:text-3xl font-bold text-white tracking-tight print:text-black">
              {report.datasetName}
            </h2>
            <p className="text-xs text-slate-400 mt-1 print:text-slate-600">
              Generated on {new Date(report.generatedAt).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} at {new Date(report.generatedAt).toLocaleTimeString()}
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-right print:border-slate-200 print:bg-slate-50">
              <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
                Governance Status
              </div>
              <div className="text-xs font-semibold text-emerald-400 mt-0.5 flex items-center justify-end gap-1">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Deterministic Zero-Hallucination</span>
              </div>
            </div>
          </div>
        </div>

        {/* ------------------------------------------------------------ */}
        {/* Executive Strategic Narrative Brief */}
        {/* ------------------------------------------------------------ */}
        <div className="pt-6 space-y-5">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-blue-400 mb-1.5">
              C-Suite Executive Brief
            </div>
            <h3 className="text-lg md:text-xl font-semibold text-white tracking-tight print:text-black">
              {report.executiveBrief.headline}
            </h3>
            <p className="text-sm text-slate-300 leading-relaxed mt-2 print:text-slate-800">
              {report.executiveBrief.overview}
            </p>
            <div className="p-3.5 rounded-xl bg-slate-950/50 border border-slate-800/80 mt-3 text-xs text-slate-400 italic print:bg-slate-50 print:text-slate-700 print:border-slate-200">
              <span className="font-semibold text-slate-300 not-italic">Macro Context: </span>
              {report.executiveBrief.macroContext}
            </div>
          </div>

          {/* Strengths & Risks Side-by-Side */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            {/* Strengths */}
            <div className="p-4 rounded-xl bg-emerald-950/20 border border-emerald-800/30 print:bg-emerald-50 print:border-emerald-200">
              <div className="flex items-center gap-2 text-xs font-bold text-emerald-400 mb-2.5">
                <CheckCircle2 className="w-4 h-4" />
                <span>Commercial Strengths & Value Drivers</span>
              </div>
              <ul className="space-y-2">
                {report.executiveBrief.strengths.map((str, idx) => (
                  <li key={idx} className="text-xs text-slate-300 flex items-start gap-2 leading-relaxed print:text-slate-800">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5 shrink-0" />
                    <span>{str}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Risks & Sensitivities */}
            <div className="p-4 rounded-xl bg-amber-950/20 border border-amber-800/30 print:bg-amber-50 print:border-amber-200">
              <div className="flex items-center gap-2 text-xs font-bold text-amber-400 mb-2.5">
                <AlertTriangle className="w-4 h-4" />
                <span>Key Vulnerabilities & Operational Sensitivities</span>
              </div>
              <ul className="space-y-2">
                {report.executiveBrief.risks.map((rsk, idx) => (
                  <li key={idx} className="text-xs text-slate-300 flex items-start gap-2 leading-relaxed print:text-slate-800">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1.5 shrink-0" />
                    <span>{rsk}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------ */}
      {/* Key Financial KPIs & Business Economics Scorecard */}
      {/* ------------------------------------------------------------ */}
      <div>
        <div className="flex items-center justify-between mb-3 px-1">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Executive Financial Economics & Benchmark Scorecard
          </h3>
          <span className="text-[11px] text-slate-500 font-mono">
            {profile.rowCount.toLocaleString()} Audited Transactions
          </span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {report.kpis.map((kpi, idx) => (
            <div
              key={idx}
              className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800/80 shadow-sm flex flex-col justify-between print:bg-white print:border-slate-200"
            >
              <div>
                <span className="text-[11px] font-medium text-slate-400 line-clamp-1">
                  {kpi.title}
                </span>
                <div className="text-lg font-bold text-white tracking-tight mt-1 print:text-black">
                  {kpi.value}
                </div>
              </div>
              {kpi.subValue && (
                <div className="text-[10px] text-slate-500 mt-2 font-mono line-clamp-2 print:text-slate-600">
                  {kpi.subValue}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ------------------------------------------------------------ */}
      {/* Embedded Visual Analytics Suite with In-Depth Interpretations */}
      {/* ------------------------------------------------------------ */}
      <div className="space-y-6">
        <div className="flex items-center justify-between px-1">
          <div>
            <h3 className="text-base font-bold text-white tracking-tight">
              Interactive Visual Analytics & Performance Models
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Each visual includes a deterministic Plotly model paired with an executive interpretation explaining business mechanics.
            </p>
          </div>
        </div>

        <div className="space-y-6">
          {report.visualSections.map((sec, idx) => (
            <div
              key={sec.id || idx}
              className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800/80 shadow-lg space-y-4 print:bg-white print:border-slate-300 print:shadow-none"
            >
              {/* Visual Section Header */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 border-b border-slate-800/60 pb-3 print:border-slate-200">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-400 text-[10px] font-bold flex items-center justify-center">
                      0{idx + 1}
                    </span>
                    <h4 className="text-sm font-bold text-white tracking-tight print:text-black">
                      {sec.title}
                    </h4>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5 ml-7 print:text-slate-600">
                    {sec.subtitle}
                  </p>
                </div>
                <div className="text-[11px] font-mono text-slate-400 px-2.5 py-1 rounded bg-slate-950/60 border border-slate-800 self-start md:self-auto print:bg-slate-100">
                  Type: {sec.chartType.toUpperCase()}
                </div>
              </div>

              {/* Rendered Chart */}
              <div className="w-full h-80 bg-slate-950/40 rounded-xl border border-slate-800/50 p-2 overflow-hidden print:bg-transparent print:border-slate-200">
                <PlotlyChart figure={sec.chart} className="w-full h-full" />
              </div>

              {/* Dual Interpretation Block */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
                <div className="md:col-span-2 p-3.5 rounded-xl bg-slate-950/50 border border-slate-800/60 print:bg-slate-50 print:border-slate-200">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 flex items-center gap-1.5">
                    <Info className="w-3 h-3 text-blue-400" />
                    <span>Business Interpretation & Mechanics</span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed print:text-slate-800">
                    {sec.businessInterpretation}
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-gradient-to-br from-blue-950/30 to-indigo-950/20 border border-blue-800/30 flex flex-col justify-between print:bg-blue-50 print:border-blue-200">
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-blue-400 mb-1 flex items-center gap-1.5">
                      <Lightbulb className="w-3 h-3 text-amber-400" />
                      <span>Key Takeaway</span>
                    </div>
                    <p className="text-xs font-medium text-slate-200 leading-relaxed print:text-slate-900">
                      {sec.keyTakeaway}
                    </p>
                  </div>
                  <div className="text-[10px] text-blue-400 font-mono mt-2 text-right">
                    Verified Computation
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ------------------------------------------------------------ */}
      {/* "What Need To Do" — Strategic Action Plan & Playbook */}
      {/* ------------------------------------------------------------ */}
      <div className="p-6 md:p-8 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900/90 to-slate-950 border border-slate-800 shadow-xl space-y-6 print:bg-white print:border-slate-300">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5 print:border-slate-200">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <CheckSquare className="w-4 h-4" />
              </div>
              <h3 className="text-lg font-bold text-white tracking-tight print:text-black">
                Strategic Action Plan: What Needs To Be Done
              </h3>
            </div>
            <p className="text-xs text-slate-400 mt-1 max-w-2xl">
              Concrete operational playbooks, margin expansion levers, risk hedges, and data governance directives derived directly from audited dataset findings.
            </p>
          </div>

          {/* Action Filter Pills */}
          <div className="flex flex-wrap items-center gap-1.5 bg-slate-950/80 p-1 rounded-xl border border-slate-800 print:hidden">
            {[
              { id: 'all', label: 'All Actions' },
              { id: 'immediate', label: 'Immediate 30-Day' },
              { id: 'optimization', label: '60-90 Day Optimization' },
              { id: 'governance', label: 'Data Governance' },
              { id: 'risk', label: 'Risk & Hedging' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActionCategoryFilter(tab.id)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                  actionCategoryFilter === tab.id
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Action Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredActions.map(act => (
            <div
              key={act.id}
              className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 hover:border-slate-700 transition-colors flex flex-col justify-between space-y-3 print:bg-slate-50 print:border-slate-200"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                    {act.category}
                  </span>
                  <span
                    className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                      act.priority === 'Critical'
                        ? 'bg-red-500/10 text-red-400 border border-red-500/30'
                        : act.priority === 'High'
                        ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                        : 'bg-slate-800 text-slate-300 border border-slate-700'
                    }`}
                  >
                    {act.priority} Priority
                  </span>
                </div>

                <h4 className="text-sm font-bold text-white tracking-tight print:text-black">
                  {act.title}
                </h4>

                <p className="text-xs text-slate-300 leading-relaxed print:text-slate-800">
                  {act.action}
                </p>
              </div>

              <div className="pt-3 border-t border-slate-800/60 space-y-1.5 print:border-slate-200">
                <div className="text-[11px] text-emerald-400 font-medium flex items-start gap-1.5">
                  <ArrowRight className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  <span>
                    <strong className="text-emerald-300">Expected Impact:</strong> {act.expectedImpact}
                  </span>
                </div>
                <div className="text-[10px] text-slate-400 flex items-center gap-1.5">
                  <UserCheck className="w-3 h-3 text-slate-400" />
                  <span>
                    <strong>Owner / Role:</strong> {act.responsibleRole}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ------------------------------------------------------------ */}
      {/* Data Governance & Privacy Verification Statement */}
      {/* ------------------------------------------------------------ */}
      <div className="p-6 rounded-2xl bg-slate-900/70 border border-slate-800/80 space-y-4 print:bg-white print:border-slate-200">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/60 pb-3">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-emerald-400" />
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
              Data Governance, Privacy Shield & Quality Health
            </h4>
          </div>
          <div className="text-xs text-emerald-400 font-mono">
            {report.dataQualityHealth.status} Quality ({report.dataQualityHealth.overallScore}/100)
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
          <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/60">
            <div className="text-xs text-slate-400 font-medium">Total Rows</div>
            <div className="text-base font-bold text-white mt-0.5 font-mono">
              {report.dataQualityHealth.totalRows.toLocaleString()}
            </div>
          </div>
          <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/60">
            <div className="text-xs text-slate-400 font-medium">Duplicate Rows</div>
            <div className={`text-base font-bold mt-0.5 font-mono ${report.dataQualityHealth.duplicateRows > 0 ? 'text-amber-400' : 'text-slate-200'}`}>
              {report.dataQualityHealth.duplicateRows.toLocaleString()}
            </div>
          </div>
          <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/60">
            <div className="text-xs text-slate-400 font-medium">Statistical Outliers</div>
            <div className="text-base font-bold text-white mt-0.5 font-mono">
              {report.dataQualityHealth.outlierCount.toLocaleString()}
            </div>
          </div>
          <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/60">
            <div className="text-xs text-slate-400 font-medium">Null / Blank Rate</div>
            <div className="text-base font-bold text-white mt-0.5 font-mono">
              {report.dataQualityHealth.nullRate}%
            </div>
          </div>
        </div>

        <p className="text-xs text-slate-400 italic text-center max-w-2xl mx-auto">
          {report.dataQualityHealth.complianceNote}
        </p>
      </div>

      {/* ------------------------------------------------------------ */}
      {/* Reproducible Code Verification Drawer (Optional) */}
      {/* ------------------------------------------------------------ */}
      <div className="rounded-xl border border-slate-800 bg-slate-950/50 overflow-hidden print:hidden">
        <button
          onClick={() => setShowCodeScripts(!showCodeScripts)}
          className="w-full px-4 py-3 flex items-center justify-between text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-900/40 transition-colors"
        >
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4 text-blue-400" />
            <span>View Reproducible Verification Scripts (Python Pandas & SQL)</span>
          </div>
          <ChevronDown className={`w-4 h-4 transition-transform ${showCodeScripts ? 'rotate-180' : ''}`} />
        </button>

        {showCodeScripts && (
          <div className="p-4 border-t border-slate-800 space-y-4">
            <div>
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                Python (Pandas) Audit Script
              </div>
              <pre className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-[11px] font-mono text-blue-300 overflow-x-auto">
                {report.reproducibleScript.python}
              </pre>
            </div>
            <div>
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                SQL Audit & Aggregation Script
              </div>
              <pre className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-[11px] font-mono text-emerald-300 overflow-x-auto">
                {report.reproducibleScript.sql}
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
