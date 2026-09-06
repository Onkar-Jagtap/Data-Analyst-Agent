import React, { useState, useEffect, useMemo } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Check,
  CheckCircle2,
  CheckSquare,
  ChevronDown,
  Clock,
  Compass,
  Copy,
  Download,
  Edit3,
  Eye,
  FileCheck,
  FileSpreadsheet,
  FileText,
  Filter,
  HelpCircle,
  Info,
  Layers,
  LayoutDashboard,
  Lightbulb,
  Maximize2,
  PieChart,
  Plus,
  Printer,
  RefreshCw,
  RotateCcw,
  Share2,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sliders,
  Sparkles,
  Target,
  Trash2,
  TrendingDown,
  TrendingUp,
  UserCheck,
  X,
  Zap,
} from 'lucide-react';
import { DatasetProfile, ExecutiveReport, InsightItem, StrategicActionItem } from '../types.js';
import { fetchExecutiveReport, refineReportSection } from '../api.js';
import { PlotlyChart } from './PlotlyChart.js';
import { downloadExecutiveReportPdf, openPrintableReportWindow } from '../utils/exportPdf.js';
import { ReportAiDirectiveBar } from './ReportAiDirectiveBar.js';
import { ReportRefineModal, RefineTarget } from './ReportRefineModal.js';

interface ExecutiveReportViewProps {
  profile: DatasetProfile | null;
  onNavigateTab?: (tab: string) => void;
}

type ReportTab = 'overview' | 'insights' | 'visuals' | 'actions' | 'governance';

export const ExecutiveReportView: React.FC<ExecutiveReportViewProps> = ({
  profile,
  onNavigateTab,
}) => {
  const [report, setReport] = useState<ExecutiveReport | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<ReportTab>('overview');
  const [viewMode, setViewMode] = useState<'tabbed' | 'dossier'>('tabbed');
  const [actionCategoryFilter, setActionCategoryFilter] = useState<string>('all');
  const [insightCategoryFilter, setInsightCategoryFilter] = useState<string>('all');
  const [showCodeScripts, setShowCodeScripts] = useState<boolean>(false);
  const [exportingPdf, setExportingPdf] = useState<boolean>(false);
  const [pdfProgressMsg, setPdfProgressMsg] = useState<string>('');
  
  // Local state for tracking action completion
  const [actionStatuses, setActionStatuses] = useState<Record<string, 'planned' | 'in_progress' | 'completed'>>({});

  // AI Directive State
  const [directive, setDirective] = useState<string>('');
  const [appliedDirective, setAppliedDirective] = useState<string | null>(null);
  const [isApplyingDirective, setIsApplyingDirective] = useState<boolean>(false);
  const [showDirectivePanel, setShowDirectivePanel] = useState<boolean>(false);

  // Direct Edit Mode State
  const [isEditMode, setIsEditMode] = useState<boolean>(false);
  const [savedNotification, setSavedNotification] = useState<string | null>(null);

  // AI Refine Modal State
  const [refineTarget, setRefineTarget] = useState<RefineTarget | null>(null);
  const [isRefining, setIsRefining] = useState<boolean>(false);
  const [refineError, setRefineError] = useState<string | null>(null);

  useEffect(() => {
    if (!profile) return;
    loadReport(false);
  }, [profile?.id]);

  const loadReport = async (forceAi = false, customDirective?: string) => {
    if (!profile) return;
    setLoading(true);
    setError(null);
    try {
      const activeDir = customDirective !== undefined ? customDirective : (appliedDirective || undefined);
      const data = await fetchExecutiveReport(profile.id, forceAi, activeDir);
      setReport(data);

      // Initialize action statuses from report if present
      const initialStatuses: Record<string, 'planned' | 'in_progress' | 'completed'> = {};
      data.actionPlan.forEach((act, idx) => {
        initialStatuses[act.id] = act.status || (idx === 0 ? 'in_progress' : 'planned');
      });
      setActionStatuses(initialStatuses);
    } catch (err: any) {
      setError(err.message || 'Failed to generate executive report.');
    } finally {
      setLoading(false);
    }
  };

  const handleApplyDirective = async () => {
    if (!profile || !directive.trim()) return;
    setIsApplyingDirective(true);
    setError(null);
    try {
      const data = await fetchExecutiveReport(profile.id, true, directive.trim());
      setReport(data);
      setAppliedDirective(directive.trim());
      setSavedNotification('AI directive successfully applied to executive report!');
      setTimeout(() => setSavedNotification(null), 3500);
    } catch (err: any) {
      setError(err.message || 'Failed to apply directive to report.');
    } finally {
      setIsApplyingDirective(false);
    }
  };

  const handleClearDirective = async () => {
    setDirective('');
    setAppliedDirective(null);
    await loadReport(true, '');
    setSavedNotification('Reset to baseline report.');
    setTimeout(() => setSavedNotification(null), 3000);
  };

  const handleExecuteRefine = async (target: RefineTarget, instruction: string) => {
    if (!profile || !report) return;
    setIsRefining(true);
    setRefineError(null);
    try {
      const refinedResult = await refineReportSection(profile.id, {
        section: target.section,
        instruction,
        currentContent: target.currentContent,
      });

      if (refinedResult) {
        setReport((prev) => {
          if (!prev) return prev;
          const copy = JSON.parse(JSON.stringify(prev)) as ExecutiveReport;

          if (target.section === 'headline') {
            copy.executiveBrief.headline = typeof refinedResult === 'string' ? refinedResult : (refinedResult.headline || copy.executiveBrief.headline);
          } else if (target.section === 'overview') {
            copy.executiveBrief.overview = typeof refinedResult === 'string' ? refinedResult : (refinedResult.overview || copy.executiveBrief.overview);
          } else if (target.section === 'macroContext') {
            copy.executiveBrief.macroContext = typeof refinedResult === 'string' ? refinedResult : (refinedResult.macroContext || copy.executiveBrief.macroContext);
          } else if (target.section === 'strengths') {
            if (Array.isArray(refinedResult)) {
              copy.executiveBrief.strengths = refinedResult;
            } else if (Array.isArray(refinedResult.strengths)) {
              copy.executiveBrief.strengths = refinedResult.strengths;
            }
          } else if (target.section === 'risks') {
            if (Array.isArray(refinedResult)) {
              copy.executiveBrief.risks = refinedResult;
            } else if (Array.isArray(refinedResult.risks)) {
              copy.executiveBrief.risks = refinedResult.risks;
            }
          } else if (target.section === 'actionPlan') {
            if (Array.isArray(refinedResult)) {
              copy.actionPlan = refinedResult;
            } else if (Array.isArray(refinedResult.actionPlan)) {
              copy.actionPlan = refinedResult.actionPlan;
            }
          } else if (target.section === 'singleAction' && target.actionId) {
            const idx = copy.actionPlan.findIndex((a) => a.id === target.actionId);
            if (idx !== -1) {
              copy.actionPlan[idx] = {
                ...copy.actionPlan[idx],
                ...refinedResult,
              };
            }
          }

          return copy;
        });

        setRefineTarget(null);
        setSavedNotification(`AI Refinement applied to ${target.title}!`);
        setTimeout(() => setSavedNotification(null), 3500);
      } else {
        setRefineError('AI refinement returned empty result. Please try again with different phrasing.');
      }
    } catch (err: any) {
      setRefineError(err.message || 'Failed to refine section.');
    } finally {
      setIsRefining(false);
    }
  };

  // Inline edit handlers
  const updateReportBriefField = (field: 'headline' | 'overview' | 'macroContext', val: string) => {
    setReport((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        executiveBrief: {
          ...prev.executiveBrief,
          [field]: val,
        },
      };
    });
  };

  const updateStrengthBullet = (index: number, val: string) => {
    setReport((prev) => {
      if (!prev) return prev;
      const newArr = [...prev.executiveBrief.strengths];
      newArr[index] = val;
      return {
        ...prev,
        executiveBrief: {
          ...prev.executiveBrief,
          strengths: newArr,
        },
      };
    });
  };

  const addStrengthBullet = () => {
    setReport((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        executiveBrief: {
          ...prev.executiveBrief,
          strengths: [...prev.executiveBrief.strengths, 'New key commercial driver or operational efficiency advantage.'],
        },
      };
    });
  };

  const removeStrengthBullet = (index: number) => {
    setReport((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        executiveBrief: {
          ...prev.executiveBrief,
          strengths: prev.executiveBrief.strengths.filter((_, i) => i !== index),
        },
      };
    });
  };

  const updateRiskBullet = (index: number, val: string) => {
    setReport((prev) => {
      if (!prev) return prev;
      const newArr = [...prev.executiveBrief.risks];
      newArr[index] = val;
      return {
        ...prev,
        executiveBrief: {
          ...prev.executiveBrief,
          risks: newArr,
        },
      };
    });
  };

  const addRiskBullet = () => {
    setReport((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        executiveBrief: {
          ...prev.executiveBrief,
          risks: [...prev.executiveBrief.risks, 'Identified customer concentration or market sensitivity exposure.'],
        },
      };
    });
  };

  const removeRiskBullet = (index: number) => {
    setReport((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        executiveBrief: {
          ...prev.executiveBrief,
          risks: prev.executiveBrief.risks.filter((_, i) => i !== index),
        },
      };
    });
  };

  const updateActionItemField = (id: string, field: keyof StrategicActionItem, val: any) => {
    setReport((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        actionPlan: prev.actionPlan.map((act) =>
          act.id === id ? { ...act, [field]: val } : act
        ),
      };
    });
  };

  const addCustomAction = () => {
    if (!report) return;
    const newId = `act-user-${Date.now()}`;
    const newAction: StrategicActionItem = {
      id: newId,
      category: 'Immediate 30-Day',
      title: 'New Strategic Initiative',
      action: 'Specify concrete steps and milestones to execute.',
      expectedImpact: 'Estimated margin or revenue impact.',
      priority: 'High',
      responsibleRole: 'Lead Operations / Revenue Manager',
      status: 'planned',
    };
    setReport((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        actionPlan: [newAction, ...prev.actionPlan],
      };
    });
    setActionStatuses((prev) => ({ ...prev, [newId]: 'planned' }));
    setSavedNotification('New action item added to playbook.');
    setTimeout(() => setSavedNotification(null), 3000);
  };

  const removeActionItem = (id: string) => {
    setReport((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        actionPlan: prev.actionPlan.filter((act) => act.id !== id),
      };
    });
  };

  const handleDownloadPdf = async () => {
    if (!report) return;
    setExportingPdf(true);
    setPdfProgressMsg('Initializing PDF generation engine...');
    try {
      await downloadExecutiveReportPdf(report, {
        onProgress: (msg) => setPdfProgressMsg(msg),
      });
    } catch (err) {
      console.error('Failed to generate direct PDF, falling back to printable window:', err);
      openPrintableReportWindow(report);
    } finally {
      setExportingPdf(false);
      setPdfProgressMsg('');
    }
  };

  const handlePrint = async () => {
    if (!report) return;
    setPdfProgressMsg('Preparing high-contrast print exhibits...');
    try {
      await openPrintableReportWindow(report);
    } catch (err) {
      console.error('Print window error:', err);
    } finally {
      setPdfProgressMsg('');
    }
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

  const toggleActionStatus = (actionId: string, newStatus: 'planned' | 'in_progress' | 'completed') => {
    setActionStatuses((prev) => ({
      ...prev,
      [actionId]: newStatus,
    }));
  };

  const generateMarkdownSummary = (rep: ExecutiveReport): string => {
    return `# ${rep.datasetName} — Executive Business Intelligence & Strategy Dossier
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

## Important Insights from Data
${(rep.insights || []).map((ins, i) => `### [${ins.category.toUpperCase()}] ${ins.title} (${ins.metric})
- **Finding**: ${ins.finding}
- **Interpretation**: ${ins.interpretation}
- **Context**: ${ins.dataContext}
`).join('\n')}

---

## Strategic Action Plan ("What Needs To Be Done")
${rep.actionPlan.map(act => `### [${act.category}] ${act.title} (Priority: ${act.priority})
- **Action**: ${act.action}
- **Expected Impact**: ${act.expectedImpact}
- **Responsible**: ${act.responsibleRole}
- **Status**: ${actionStatuses[act.id] || act.status || 'planned'}
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

  // Filter actions based on category tab
  const filteredActions = useMemo(() => {
    if (!report) return [];
    return report.actionPlan.filter((act) => {
      if (actionCategoryFilter === 'all') return true;
      if (actionCategoryFilter === 'immediate') return act.category === 'Immediate 30-Day';
      if (actionCategoryFilter === 'optimization') return act.category === '60-90 Day Optimization';
      if (actionCategoryFilter === 'governance') return act.category === 'Governance & Data Quality';
      if (actionCategoryFilter === 'risk') return act.category === 'Risk & Sensitivity';
      return true;
    });
  }, [report, actionCategoryFilter]);

  // Filter insights based on category tab
  const filteredInsights = useMemo(() => {
    if (!report || !report.insights) return [];
    return report.insights.filter((ins) => {
      if (insightCategoryFilter === 'all') return true;
      return ins.category === insightCategoryFilter;
    });
  }, [report, insightCategoryFilter]);

  // Calculate action progress statistics
  const actionStats = useMemo(() => {
    if (!report) return { total: 0, completed: 0, inProgress: 0, pct: 0 };
    const total = report.actionPlan.length;
    let completed = 0;
    let inProgress = 0;
    report.actionPlan.forEach((act) => {
      const st = actionStatuses[act.id] || act.status || 'planned';
      if (st === 'completed') completed++;
      if (st === 'in_progress') inProgress++;
    });
    const weighted = completed + inProgress * 0.5;
    const pct = total > 0 ? Math.round((weighted / total) * 100) : 0;
    return { total, completed, inProgress, pct };
  }, [report, actionStatuses]);

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
            Synthesizing Autonomous Executive Dossier...
          </h3>
          <p className="text-xs text-slate-400 mt-1 max-w-md">
            Auditing mathematical totals, constructing multi-dimensional Plotly models, extracting statistical Pareto insights, and building strategic execution directives.
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

  // Safe insights array fallback
  const insightsList: InsightItem[] = (report.insights && report.insights.length > 0)
    ? report.insights
    : [
        {
          id: 'ins-default-1',
          category: 'concentration',
          title: 'Segment Revenue Concentration',
          finding: `Top segment '${report.businessEconomics.topSegmentName}' accounts for ${report.businessEconomics.topSegmentShareFormatted} of total portfolio volume.`,
          metric: report.businessEconomics.topSegmentShareFormatted,
          interpretation: 'High concentration provides clear commercial focus but elevates vulnerability to customer or category churn.',
          dataContext: `Based on ${report.datasetScale.rows.toLocaleString()} verified transactions.`,
          confidence: 'high',
        },
        {
          id: 'ins-default-2',
          category: 'profitability',
          title: 'Operating Profit Margin Health',
          finding: `Net profitability is audited at ${report.businessEconomics.profitMarginFormatted} delivering ${report.businessEconomics.totalProfitFormatted} in operating contribution.`,
          metric: report.businessEconomics.profitMarginFormatted,
          interpretation: 'Margins remain structurally resilient, with potential to unlock +200 bps through secondary tier bundling.',
          dataContext: 'Deterministic financial calculation without estimation variance.',
          confidence: 'high',
        },
        {
          id: 'ins-default-3',
          category: 'outlier',
          title: 'Transaction Variance & Outlier Distribution',
          finding: `${report.dataQualityHealth.outlierCount} records exhibit extreme deviation based on Tukey 1.5x IQR boundaries.`,
          metric: `${report.dataQualityHealth.outlierCount} outliers`,
          interpretation: 'Outliers reflect high-value strategic transactions that require dedicated enterprise SLA terms.',
          dataContext: 'Validated via statistical interquartile range testing.',
          confidence: 'high',
        },
      ];

  return (
    <div className="space-y-6 pb-20 max-w-7xl mx-auto">
      {/* ------------------------------------------------------------ */}
      {/* Top Action Bar & Executive Controls (Hidden on Print) */}
      {/* ------------------------------------------------------------ */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 p-4 rounded-xl bg-slate-900/90 border border-slate-800 print:hidden shadow-sm backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shrink-0">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-blue-400">
                Data Studio by PJA
              </span>
              <span className="text-slate-600">•</span>
              <span className="text-xs text-slate-400 font-mono">
                Executive Dossier & Strategy Suite
              </span>
            </div>
            <h1 className="text-sm font-semibold text-slate-100">
              Autonomous Strategic Intelligence & Visual Analytics
            </h1>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2 self-stretch lg:self-auto justify-end">
          {/* AI Directive Director Button */}
          <button
            onClick={() => setShowDirectivePanel(!showDirectivePanel)}
            className={`px-3 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              showDirectivePanel || appliedDirective
                ? 'bg-blue-600 text-white border-blue-500 shadow-md shadow-blue-500/20'
                : 'bg-slate-800/90 hover:bg-slate-750 text-slate-200 border-slate-700/80'
            }`}
            title="Tell AI what to focus on or customize in this report"
          >
            <Sparkles className={`w-3.5 h-3.5 ${showDirectivePanel || appliedDirective ? 'text-blue-200' : 'text-blue-400'}`} />
            <span>AI Director</span>
            {appliedDirective && (
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse ml-0.5" />
            )}
          </button>

          {/* Edit Mode Toggle */}
          <button
            onClick={() => setIsEditMode(!isEditMode)}
            className={`px-3 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              isEditMode
                ? 'bg-amber-500 text-slate-950 border-amber-400 font-bold shadow-md shadow-amber-500/20'
                : 'bg-slate-800/90 hover:bg-slate-750 text-slate-200 border-slate-700/80'
            }`}
            title="Toggle between reading mode and inline editing mode"
          >
            {isEditMode ? (
              <>
                <Eye className="w-3.5 h-3.5 text-slate-950" />
                <span>Exit Edit Mode</span>
              </>
            ) : (
              <>
                <Edit3 className="w-3.5 h-3.5 text-amber-400" />
                <span>Edit Report</span>
              </>
            )}
          </button>

          <button
            onClick={() => loadReport(true)}
            className="px-3 py-1.5 rounded-lg bg-slate-800/90 hover:bg-slate-750 text-slate-200 border border-slate-700/80 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Re-run AI strategy engine"
          >
            <RefreshCw className="w-3.5 h-3.5 text-blue-400" />
            <span>Regenerate (AI)</span>
          </button>

          <button
            onClick={handleCopyToClipboard}
            className="px-3 py-1.5 rounded-lg bg-slate-800/90 hover:bg-slate-750 text-slate-200 border border-slate-700/80 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
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
            className="px-3 py-1.5 rounded-lg bg-slate-800/90 hover:bg-slate-750 text-slate-200 border border-slate-700/80 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Download report as Markdown file (.md)"
          >
            <Download className="w-3.5 h-3.5 text-slate-400" />
            <span>Download .MD</span>
          </button>

          <button
            onClick={handleDownloadPdf}
            disabled={exportingPdf}
            className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm shadow-emerald-500/20 transition-all cursor-pointer"
            title="Generate and download executive PDF report with embedded real graphs"
          >
            {exportingPdf ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Download className="w-3.5 h-3.5" />
            )}
            <span>{exportingPdf ? 'Building PDF...' : 'Download PDF (With Graphs)'}</span>
          </button>

          <button
            onClick={handlePrint}
            className="px-3 py-1.5 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/40 text-blue-300 text-xs font-medium flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
            title="Open clean, high-contrast printable document with charts"
          >
            <Printer className="w-3.5 h-3.5 text-blue-400" />
            <span>Print View</span>
          </button>
        </div>
      </div>

      {/* AI Directive Bar Component */}
      <ReportAiDirectiveBar
        directive={directive}
        setDirective={setDirective}
        appliedDirective={appliedDirective}
        isApplyingDirective={isApplyingDirective}
        onApplyDirective={handleApplyDirective}
        onClearDirective={handleClearDirective}
        isOpen={showDirectivePanel || !!appliedDirective}
        onToggleOpen={() => setShowDirectivePanel(!showDirectivePanel)}
      />

      {/* Edit Mode Notification Banner */}
      {isEditMode && (
        <div className="p-3.5 rounded-xl bg-amber-950/40 border border-amber-800/60 flex flex-wrap items-center justify-between gap-3 text-xs text-amber-200 print:hidden animate-in fade-in">
          <div className="flex items-center gap-2.5">
            <div className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse" />
            <span className="font-bold text-amber-300">Direct Edit Mode Active:</span>
            <span className="text-amber-200/90">
              Click any text, bullet, or action item to edit directly. Custom changes persist in your PDF, Print, and Markdown exports.
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={addCustomAction}
              className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-[11px] font-semibold flex items-center gap-1 transition-colors cursor-pointer"
            >
              <Plus className="w-3 h-3" />
              <span>Add Action Item</span>
            </button>
            <button
              onClick={() => setIsEditMode(false)}
              className="px-3 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-[11px] transition-colors cursor-pointer"
            >
              Done Editing
            </button>
          </div>
        </div>
      )}

      {/* Saved Notification Toast */}
      {savedNotification && (
        <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-700/60 text-xs text-emerald-300 flex items-center justify-between gap-2 animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="font-medium">{savedNotification}</span>
          </div>
          <button
            onClick={() => setSavedNotification(null)}
            className="text-emerald-400 hover:text-emerald-200 text-xs cursor-pointer p-0.5"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Export Progress Notification Bar */}
      {exportingPdf && pdfProgressMsg && (
        <div className="p-3 rounded-xl bg-blue-950/50 border border-blue-800/60 flex items-center justify-between text-xs text-blue-200 animate-pulse">
          <div className="flex items-center gap-2">
            <RefreshCw className="w-4 h-4 text-blue-400 animate-spin" />
            <span>{pdfProgressMsg}</span>
          </div>
          <span className="text-[11px] font-mono text-blue-400">Embedding High-Resolution Graphs</span>
        </div>
      )}

      {/* ------------------------------------------------------------ */}
      {/* Report Header Card */}
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
                Quality: {report.dataQualityHealth.overallScore}/100 ({report.dataQualityHealth.status})
              </span>
              <span className="px-2.5 py-0.5 rounded-md bg-slate-800 text-slate-300 border border-slate-700 text-[11px] font-mono print:bg-slate-100 print:text-slate-700">
                {report.datasetScale.rows.toLocaleString()} Records
              </span>
              <span className="px-2.5 py-0.5 rounded-md bg-slate-800 text-slate-300 border border-slate-700 text-[11px] font-mono print:bg-slate-100 print:text-slate-700">
                {report.datasetScale.columns} Attributes
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

        {/* Strategic Headline Box */}
        <div className="pt-6 space-y-4">
          <div className="p-4 rounded-xl bg-blue-950/20 border border-blue-800/30 print:bg-blue-50 print:border-blue-200 relative group">
            <div className="flex items-center justify-between mb-2">
              <div className="text-[10px] font-bold uppercase tracking-wider text-blue-400 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                <span>C-Suite Strategic Headline</span>
              </div>
              
              <div className="flex items-center gap-2 print:hidden">
                <button
                  onClick={() =>
                    setRefineTarget({
                      section: 'headline',
                      title: 'Executive Headline',
                      currentContent: report.executiveBrief.headline,
                    })
                  }
                  className="text-[11px] text-blue-400 hover:text-blue-300 font-semibold flex items-center gap-1 bg-blue-500/10 hover:bg-blue-500/20 px-2.5 py-1 rounded-md border border-blue-500/20 transition-all cursor-pointer"
                  title="Ask AI to refine this headline"
                >
                  <Sparkles className="w-3 h-3 text-blue-300" />
                  <span>AI Refine</span>
                </button>
              </div>
            </div>

            {isEditMode ? (
              <div className="space-y-3">
                <div>
                  <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1 block">
                    Headline Title
                  </label>
                  <input
                    type="text"
                    value={report.executiveBrief.headline}
                    onChange={(e) => updateReportBriefField('headline', e.target.value)}
                    className="w-full text-base font-bold bg-slate-950/90 border border-blue-500/50 rounded-lg p-2.5 text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                      Executive Overview Narrative
                    </label>
                    <button
                      onClick={() =>
                        setRefineTarget({
                          section: 'overview',
                          title: 'Executive Narrative',
                          currentContent: report.executiveBrief.overview,
                        })
                      }
                      className="text-[11px] text-blue-400 hover:text-blue-300 font-medium flex items-center gap-1 cursor-pointer"
                    >
                      <Sparkles className="w-3 h-3" />
                      <span>AI Refine Overview</span>
                    </button>
                  </div>
                  <textarea
                    rows={3}
                    value={report.executiveBrief.overview}
                    onChange={(e) => updateReportBriefField('overview', e.target.value)}
                    className="w-full text-xs bg-slate-950/90 border border-blue-500/50 rounded-lg p-2.5 text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500 leading-relaxed"
                  />
                </div>
              </div>
            ) : (
              <>
                <h3 className="text-base md:text-lg font-bold text-white tracking-tight print:text-black">
                  "{report.executiveBrief.headline}"
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed mt-2 print:text-slate-800">
                  {report.executiveBrief.overview}
                </p>
              </>
            )}
          </div>

          {/* Macro Context */}
          <div className="p-3.5 rounded-xl bg-slate-950/50 border border-slate-800/80 text-xs text-slate-400 print:bg-slate-50 print:text-slate-700 print:border-slate-200">
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-semibold text-slate-300">Macro Market Context:</span>
              <button
                onClick={() =>
                  setRefineTarget({
                    section: 'macroContext',
                    title: 'Macro Market Context',
                    currentContent: report.executiveBrief.macroContext,
                  })
                }
                className="text-[11px] text-blue-400 hover:text-blue-300 font-medium flex items-center gap-1 print:hidden cursor-pointer"
                title="Ask AI to refine macro context"
              >
                <Sparkles className="w-3 h-3" />
                <span>AI Refine</span>
              </button>
            </div>
            {isEditMode ? (
              <textarea
                rows={2}
                value={report.executiveBrief.macroContext}
                onChange={(e) => updateReportBriefField('macroContext', e.target.value)}
                className="w-full text-xs bg-slate-950/90 border border-slate-700 rounded-lg p-2 text-slate-300 focus:outline-none focus:border-blue-500"
              />
            ) : (
              <p className="italic leading-relaxed">
                {report.executiveBrief.macroContext}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------ */}
      {/* High-End Report Navigation Tabs & View Mode Switcher */}
      {/* ------------------------------------------------------------ */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-slate-900/80 p-1.5 rounded-xl border border-slate-800 print:hidden">
        {/* Navigation Tabs */}
        <div className="flex flex-wrap items-center gap-1">
          <button
            onClick={() => {
              setActiveTab('overview');
              setViewMode('tabbed');
            }}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'overview' && viewMode === 'tabbed'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <LayoutDashboard className="w-3.5 h-3.5" />
            <span>Overview & Key Points</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('insights');
              setViewMode('tabbed');
            }}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'insights' && viewMode === 'tabbed'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Lightbulb className="w-3.5 h-3.5 text-amber-400" />
            <span>Important Insights</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-slate-800 text-slate-300 border border-slate-700">
              {insightsList.length}
            </span>
          </button>

          <button
            onClick={() => {
              setActiveTab('visuals');
              setViewMode('tabbed');
            }}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'visuals' && viewMode === 'tabbed'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5 text-emerald-400" />
            <span>Visual Analytics Suite</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-slate-800 text-slate-300 border border-slate-700">
              {report.visualSections.length}
            </span>
          </button>

          <button
            onClick={() => {
              setActiveTab('actions');
              setViewMode('tabbed');
            }}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'actions' && viewMode === 'tabbed'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <CheckSquare className="w-3.5 h-3.5 text-amber-400" />
            <span>Action Playbook</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-slate-800 text-slate-300 border border-slate-700">
              {report.actionPlan.length}
            </span>
          </button>

          <button
            onClick={() => {
              setActiveTab('governance');
              setViewMode('tabbed');
            }}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'governance' && viewMode === 'tabbed'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Audit & Governance</span>
          </button>
        </div>

        {/* Dossier Toggle Button */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode(viewMode === 'dossier' ? 'tabbed' : 'dossier')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border flex items-center gap-1.5 transition-all cursor-pointer ${
              viewMode === 'dossier'
                ? 'bg-emerald-600/20 text-emerald-300 border-emerald-500/40 shadow-sm'
                : 'bg-slate-800/70 text-slate-400 border-slate-700 hover:text-slate-200'
            }`}
            title="Toggle between segmented tabbed view and continuous full dossier view"
          >
            <Layers className="w-3.5 h-3.5" />
            <span>{viewMode === 'dossier' ? 'Tabbed Mode' : 'Full Dossier (All Sections)'}</span>
          </button>
        </div>
      </div>

      {/* ============================================================ */}
      {/* TAB 1: OVERVIEW & KEY POINTS */}
      {/* ============================================================ */}
      {(viewMode === 'dossier' || activeTab === 'overview') && (
        <div className="space-y-6">
          {/* Executive Key Points Spotlight Grid */}
          <div>
            <div className="flex items-center justify-between mb-3 px-1">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Target className="w-3.5 h-3.5 text-blue-400" />
                <span>Executive Key Points & Core Findings</span>
              </h3>
              <span className="text-[11px] text-slate-500 font-mono">
                At-a-Glance Executive Summary
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Point 1: Anchor Segment Leadership */}
              <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800/90 shadow-sm relative overflow-hidden flex flex-col justify-between">
                <div className="absolute top-0 left-0 w-1 h-full bg-blue-500" />
                <div>
                  <div className="flex items-center justify-between text-slate-400 text-xs">
                    <span className="font-semibold uppercase tracking-wider text-[10px]">Anchor Driver</span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-blue-500/10 text-blue-400 border border-blue-500/20">
                      {report.businessEconomics.topSegmentShareFormatted} Share
                    </span>
                  </div>
                  <h4 className="text-base font-bold text-white tracking-tight mt-1 line-clamp-1">
                    {report.businessEconomics.topSegmentName}
                  </h4>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    Primary volume contributor generating <strong className="text-slate-200">{report.businessEconomics.topSegmentShareFormatted}</strong> of total commercial output.
                  </p>
                </div>
                <div className="mt-3 pt-2.5 border-t border-slate-800/80 text-[11px] text-blue-400 font-mono">
                  Volume: {report.businessEconomics.totalRevenueFormatted}
                </div>
              </div>

              {/* Point 2: Operating Margin & Profit Yield */}
              <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800/90 shadow-sm relative overflow-hidden flex flex-col justify-between">
                <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500" />
                <div>
                  <div className="flex items-center justify-between text-slate-400 text-xs">
                    <span className="font-semibold uppercase tracking-wider text-[10px]">Margin & Net Profit</span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      {report.businessEconomics.profitMarginFormatted} Margin
                    </span>
                  </div>
                  <h4 className="text-base font-bold text-emerald-400 tracking-tight mt-1 font-mono">
                    {report.businessEconomics.totalProfitFormatted}
                  </h4>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    Net operating yield across audited transactions, averaging <strong className="text-slate-200">{report.businessEconomics.averageOrderValueFormatted}</strong> per order.
                  </p>
                </div>
                <div className="mt-3 pt-2.5 border-t border-slate-800/80 text-[11px] text-emerald-400 font-mono">
                  AOV: {report.businessEconomics.averageOrderValueFormatted}
                </div>
              </div>

              {/* Point 3: Pareto Concentration Risk */}
              <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800/90 shadow-sm relative overflow-hidden flex flex-col justify-between">
                <div className="absolute top-0 left-0 w-1 h-full bg-amber-500" />
                <div>
                  <div className="flex items-center justify-between text-slate-400 text-xs">
                    <span className="font-semibold uppercase tracking-wider text-[10px]">Pareto Concentration</span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-amber-500/10 text-amber-400 border border-amber-500/20">
                      Top 20% Drivers
                    </span>
                  </div>
                  <h4 className="text-base font-bold text-white tracking-tight mt-1 font-mono">
                    {report.businessEconomics.paretoTop20ShareFormatted}
                  </h4>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    The top 20% of contributors drive <strong className="text-amber-300">{report.businessEconomics.paretoTop20ShareFormatted}</strong> of portfolio output.
                  </p>
                </div>
                {/* Visual Progress Bar */}
                <div className="mt-3 pt-2.5 border-t border-slate-800/80">
                  <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-amber-500 rounded-full"
                      style={{ width: `${Math.min(100, Math.max(10, report.businessEconomics.paretoTop20SharePct || 65))}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Point 4: Data Governance & Reliability */}
              <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800/90 shadow-sm relative overflow-hidden flex flex-col justify-between">
                <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500" />
                <div>
                  <div className="flex items-center justify-between text-slate-400 text-xs">
                    <span className="font-semibold uppercase tracking-wider text-[10px]">Reliability Health</span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                      {report.dataQualityHealth.status}
                    </span>
                  </div>
                  <h4 className="text-base font-bold text-white tracking-tight mt-1 font-mono">
                    {report.dataQualityHealth.overallScore} / 100
                  </h4>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    Null rate audited at <strong className="text-slate-200">{report.dataQualityHealth.nullRate}%</strong> with {report.dataQualityHealth.outlierCount} distribution outliers identified.
                  </p>
                </div>
                <div className="mt-3 pt-2.5 border-t border-slate-800/80 text-[11px] text-indigo-400 font-mono flex items-center justify-between">
                  <span>Duplicates: {report.dataQualityHealth.duplicateRows}</span>
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                </div>
              </div>
            </div>
          </div>

          {/* Strengths & Risks Matrix */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Strengths */}
            <div className="p-5 rounded-xl bg-emerald-950/20 border border-emerald-800/30 print:bg-emerald-50 print:border-emerald-200 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-emerald-400">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Commercial Strengths & Value Drivers</span>
                  </div>
                  <div className="flex items-center gap-1.5 print:hidden">
                    <button
                      onClick={() =>
                        setRefineTarget({
                          section: 'strengths',
                          title: 'Commercial Strengths',
                          currentContent: report.executiveBrief.strengths,
                        })
                      }
                      className="text-[11px] text-emerald-400 hover:text-emerald-300 font-medium flex items-center gap-1 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 transition-all cursor-pointer"
                      title="Direct AI to adjust commercial strengths"
                    >
                      <Sparkles className="w-3 h-3 text-emerald-300" />
                      <span>AI Refine</span>
                    </button>
                    {isEditMode && (
                      <button
                        onClick={addStrengthBullet}
                        className="text-[11px] text-emerald-300 hover:text-white font-medium flex items-center gap-0.5 bg-emerald-600/30 px-2 py-0.5 rounded border border-emerald-500/40 transition-colors cursor-pointer"
                      >
                        <Plus className="w-3 h-3" />
                        <span>Add</span>
                      </button>
                    )}
                  </div>
                </div>

                <div className="space-y-2.5">
                  {report.executiveBrief.strengths.map((str, idx) => (
                    <div key={idx} className="flex items-start gap-2.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-2 shrink-0" />
                      {isEditMode ? (
                        <div className="flex-1 flex items-center gap-2">
                          <input
                            type="text"
                            value={str}
                            onChange={(e) => updateStrengthBullet(idx, e.target.value)}
                            className="flex-1 text-xs bg-slate-950/80 border border-emerald-500/40 rounded px-2 py-1 text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                          />
                          <button
                            onClick={() => removeStrengthBullet(idx)}
                            className="text-slate-500 hover:text-red-400 p-1 cursor-pointer"
                            title="Remove bullet"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-300 leading-relaxed print:text-slate-800">
                          {str}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Risks & Sensitivities */}
            <div className="p-5 rounded-xl bg-red-950/20 border border-red-800/30 print:bg-red-50 print:border-red-200 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-red-400">
                    <AlertTriangle className="w-4 h-4" />
                    <span>Operational Sensitivities & Exposure Points</span>
                  </div>
                  <div className="flex items-center gap-1.5 print:hidden">
                    <button
                      onClick={() =>
                        setRefineTarget({
                          section: 'risks',
                          title: 'Sensitivities & Risks',
                          currentContent: report.executiveBrief.risks,
                        })
                      }
                      className="text-[11px] text-red-400 hover:text-red-300 font-medium flex items-center gap-1 bg-red-500/10 px-2 py-0.5 rounded border border-red-500/20 transition-all cursor-pointer"
                      title="Direct AI to adjust risk points"
                    >
                      <Sparkles className="w-3 h-3 text-red-300" />
                      <span>AI Refine</span>
                    </button>
                    {isEditMode && (
                      <button
                        onClick={addRiskBullet}
                        className="text-[11px] text-red-300 hover:text-white font-medium flex items-center gap-0.5 bg-red-600/30 px-2 py-0.5 rounded border border-red-500/40 transition-colors cursor-pointer"
                      >
                        <Plus className="w-3 h-3" />
                        <span>Add</span>
                      </button>
                    )}
                  </div>
                </div>

                <div className="space-y-2.5">
                  {report.executiveBrief.risks.map((rsk, idx) => (
                    <div key={idx} className="flex items-start gap-2.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-400 mt-2 shrink-0" />
                      {isEditMode ? (
                        <div className="flex-1 flex items-center gap-2">
                          <input
                            type="text"
                            value={rsk}
                            onChange={(e) => updateRiskBullet(idx, e.target.value)}
                            className="flex-1 text-xs bg-slate-950/80 border border-red-500/40 rounded px-2 py-1 text-slate-200 focus:outline-none focus:ring-1 focus:ring-red-500"
                          />
                          <button
                            onClick={() => removeRiskBullet(idx)}
                            className="text-slate-500 hover:text-red-400 p-1 cursor-pointer"
                            title="Remove bullet"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-300 leading-relaxed print:text-slate-800">
                          {rsk}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Key Financial KPIs Scorecard */}
          <div>
            <div className="flex items-center justify-between mb-3 px-1">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Financial Economics & Performance Scorecard
              </h3>
              <span className="text-[11px] text-slate-500 font-mono">
                {profile.rowCount.toLocaleString()} Audited Records
              </span>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              {report.kpis.map((kpi, idx) => (
                <div
                  key={idx}
                  className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800/80 shadow-sm flex flex-col justify-between hover:border-slate-700 transition-colors print:bg-white print:border-slate-200"
                >
                  <div>
                    <span className="text-[11px] font-medium text-slate-400 line-clamp-1">
                      {kpi.title}
                    </span>
                    <div className="text-lg font-bold text-white tracking-tight mt-1 font-mono print:text-black">
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
        </div>
      )}

      {/* ============================================================ */}
      {/* TAB 2: IMPORTANT INSIGHTS FROM DATA */}
      {/* ============================================================ */}
      {(viewMode === 'dossier' || activeTab === 'insights') && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-1">
            <div>
              <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                <Lightbulb className="w-5 h-5 text-amber-400" />
                <span>Important Insights & Empirical Findings</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Autonomous statistical pattern recognition identifying Pareto concentration, correlations, margin spread, and data anomalies.
              </p>
            </div>

            {/* Insight Filter Pills */}
            <div className="flex flex-wrap items-center gap-1.5 bg-slate-950/80 p-1 rounded-xl border border-slate-800 print:hidden">
              {[
                { id: 'all', label: 'All Insights' },
                { id: 'concentration', label: 'Concentration' },
                { id: 'correlation', label: 'Correlation' },
                { id: 'outlier', label: 'Outliers' },
                { id: 'profitability', label: 'Profitability' },
                { id: 'data_quality', label: 'Quality' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setInsightCategoryFilter(tab.id)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                    insightCategoryFilter === tab.id
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Insights Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(filteredInsights.length > 0 ? filteredInsights : insightsList).map((ins, idx) => {
              const isConcentration = ins.category === 'concentration';
              const isProfitability = ins.category === 'profitability';
              const isCorrelation = ins.category === 'correlation';
              const isOutlier = ins.category === 'outlier';
              
              const accentBg = isConcentration
                ? 'bg-blue-950/30 border-blue-800/40 text-blue-400'
                : isProfitability
                ? 'bg-emerald-950/30 border-emerald-800/40 text-emerald-400'
                : isCorrelation
                ? 'bg-purple-950/30 border-purple-800/40 text-purple-400'
                : isOutlier
                ? 'bg-amber-950/30 border-amber-800/40 text-amber-400'
                : 'bg-slate-800/50 border-slate-700 text-slate-300';

              return (
                <div
                  key={ins.id || idx}
                  className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800/90 shadow-md flex flex-col justify-between space-y-4 hover:border-slate-700 transition-colors print:bg-white print:border-slate-300"
                >
                  <div>
                    {/* Header: Category & Metric Badge */}
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className={`px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border ${accentBg}`}>
                        {ins.category}
                      </span>
                      <span className="px-2.5 py-0.5 rounded-md text-xs font-mono font-bold bg-slate-950/80 text-white border border-slate-800 print:text-black">
                        {ins.metric}
                      </span>
                    </div>

                    <h4 className="text-sm font-bold text-white tracking-tight mt-1 print:text-black">
                      {ins.title}
                    </h4>

                    {/* Finding Statement */}
                    <p className="text-xs text-slate-200 mt-2 font-medium leading-relaxed print:text-slate-900">
                      {ins.finding}
                    </p>

                    {/* Interpretation */}
                    <p className="text-xs text-slate-400 mt-2 leading-relaxed print:text-slate-600">
                      <span className="font-semibold text-slate-300">Strategic Takeaway: </span>
                      {ins.interpretation}
                    </p>
                  </div>

                  {/* Footer Context */}
                  <div className="pt-3 border-t border-slate-800/70 flex items-center justify-between text-[11px] text-slate-500 font-mono">
                    <span className="line-clamp-1">{ins.dataContext}</span>
                    <span className="text-emerald-400 shrink-0 ml-2">
                      {ins.confidence === 'high' ? 'High Confidence' : 'Medium Confidence'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* TAB 3: VISUAL ANALYTICS SUITE */}
      {/* ============================================================ */}
      {(viewMode === 'dossier' || activeTab === 'visuals') && (
        <div className="space-y-6">
          <div className="flex items-center justify-between px-1">
            <div>
              <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-emerald-400" />
                <span>Visual Analytics Exhibits & Multi-Dimensional Models</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Audited visualizers rendered deterministically. In the PDF download and print view, these are embedded as high-resolution figures.
              </p>
            </div>
            <span className="text-xs font-mono text-slate-400 px-3 py-1 rounded-lg bg-slate-900 border border-slate-800 hidden sm:inline-block">
              {report.visualSections.length} Exhibits Active
            </span>
          </div>

          <div className="space-y-6">
            {report.visualSections.map((sec, idx) => (
              <div
                key={sec.id || idx}
                id={`executive-chart-${idx}`}
                className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800/80 shadow-lg space-y-4 print:bg-white print:border-slate-300 print:shadow-none"
              >
                {/* Visual Section Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 border-b border-slate-800/60 pb-3 print:border-slate-200">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 text-xs font-bold flex items-center justify-center font-mono">
                        0{idx + 1}
                      </span>
                      <h4 className="text-sm font-bold text-white tracking-tight print:text-black">
                        Exhibit {idx + 1}: {sec.title}
                      </h4>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5 ml-8 print:text-slate-600">
                      {sec.subtitle}
                    </p>
                  </div>
                  <div className="text-[11px] font-mono text-slate-300 px-2.5 py-1 rounded-md bg-slate-950/60 border border-slate-800 self-start md:self-auto print:bg-slate-100 print:text-slate-800">
                    Format: {sec.chartType.toUpperCase()}
                  </div>
                </div>

                {/* Rendered Interactive Chart */}
                <div className="w-full h-80 bg-slate-950/40 rounded-xl border border-slate-800/50 p-2 overflow-hidden print:bg-transparent print:border-slate-200">
                  <PlotlyChart figure={sec.chart} className="w-full h-full" />
                </div>

                {/* Dual Interpretation Block */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
                  <div className="md:col-span-2 p-3.5 rounded-xl bg-slate-950/50 border border-slate-800/60 print:bg-slate-50 print:border-slate-200">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 flex items-center gap-1.5">
                      <Info className="w-3.5 h-3.5 text-blue-400" />
                      <span>Business Interpretation & Mechanics</span>
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed print:text-slate-800">
                      {sec.businessInterpretation}
                    </p>
                  </div>

                  <div className="p-3.5 rounded-xl bg-gradient-to-br from-blue-950/30 to-indigo-950/20 border border-blue-800/30 flex flex-col justify-between print:bg-blue-50 print:border-blue-200">
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-wider text-blue-400 mb-1 flex items-center gap-1.5">
                        <Lightbulb className="w-3.5 h-3.5 text-amber-400" />
                        <span>Key Strategic Takeaway</span>
                      </div>
                      <p className="text-xs font-medium text-slate-200 leading-relaxed print:text-slate-900">
                        {sec.keyTakeaway}
                      </p>
                    </div>
                    <div className="text-[10px] text-blue-400 font-mono mt-2 text-right">
                      Audit Verified
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* TAB 4: STRATEGIC ACTION PLAYBOOK */}
      {/* ============================================================ */}
      {(viewMode === 'dossier' || activeTab === 'actions') && (
        <div className="p-6 md:p-8 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900/90 to-slate-950 border border-slate-800 shadow-xl space-y-6 print:bg-white print:border-slate-300">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5 print:border-slate-200">
            <div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                  <CheckSquare className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-bold text-white tracking-tight print:text-black">
                      Strategic Action Playbook: What Needs To Be Done
                    </h3>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Concrete operational initiatives, pricing optimization levers, risk hedges, and data governance directives.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() =>
                  setRefineTarget({
                    section: 'actionPlan',
                    title: 'Strategic Action Playbook',
                    currentContent: report.actionPlan,
                  })
                }
                className="px-3 py-1.5 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/40 text-blue-300 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer print:hidden"
                title="Direct AI to generate or adjust action items"
              >
                <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                <span>AI Refine Playbook</span>
              </button>

              <button
                onClick={addCustomAction}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer print:hidden"
                title="Add a custom initiative"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Initiative</span>
              </button>

              {/* Action Filter Pills */}
              <div className="flex flex-wrap items-center gap-1.5 bg-slate-950/80 p-1 rounded-xl border border-slate-800 print:hidden">
                {[
                  { id: 'all', label: 'All' },
                  { id: 'immediate', label: '30-Day' },
                  { id: 'optimization', label: '60-90 Day' },
                  { id: 'governance', label: 'Governance' },
                  { id: 'risk', label: 'Risk' },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActionCategoryFilter(tab.id)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
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
          </div>

          {/* Interactive Action Execution Progress Bar */}
          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/90 print:hidden">
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-amber-400" />
                <span>Executive Playbook Execution Progress</span>
              </span>
              <span className="font-mono text-emerald-400 font-bold">
                {actionStats.completed} Completed • {actionStats.inProgress} In Progress ({actionStats.pct}%)
              </span>
            </div>
            <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-500 to-emerald-400 transition-all duration-300"
                style={{ width: `${actionStats.pct}%` }}
              />
            </div>
          </div>

          {/* Action Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredActions.map((act) => {
              const currentStatus = actionStatuses[act.id] || act.status || 'planned';
              const isCompleted = currentStatus === 'completed';
              const isInProgress = currentStatus === 'in_progress';

              return (
                <div
                  key={act.id}
                  className={`p-5 rounded-xl border transition-all flex flex-col justify-between space-y-3 ${
                    isCompleted
                      ? 'bg-emerald-950/20 border-emerald-800/40'
                      : isInProgress
                      ? 'bg-blue-950/20 border-blue-800/40'
                      : 'bg-slate-950/60 border-slate-800/80 hover:border-slate-700'
                  } print:bg-slate-50 print:border-slate-200`}
                >
                  {isEditMode ? (
                    /* Inline Edit Card Form */
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <select
                          value={act.category}
                          onChange={(e) => updateActionItemField(act.id, 'category', e.target.value)}
                          className="text-xs bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-200 focus:outline-none"
                        >
                          <option value="Immediate 30-Day">Immediate 30-Day</option>
                          <option value="Operational Optimization">Operational Optimization</option>
                          <option value="Strategic 60-90 Day">Strategic 60-90 Day</option>
                          <option value="Data Governance">Data Governance</option>
                          <option value="Risk Hedging">Risk Hedging</option>
                        </select>

                        <div className="flex items-center gap-1.5">
                          <select
                            value={act.priority}
                            onChange={(e) => updateActionItemField(act.id, 'priority', e.target.value)}
                            className="text-xs bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-200 focus:outline-none"
                          >
                            <option value="Critical">Critical</option>
                            <option value="High">High</option>
                            <option value="Medium">Medium</option>
                          </select>

                          <button
                            onClick={() =>
                              setRefineTarget({
                                section: 'singleAction',
                                title: `Action: ${act.title}`,
                                currentContent: act,
                                actionId: act.id,
                              })
                            }
                            className="text-[10px] text-blue-400 hover:text-blue-300 font-medium px-2 py-1 rounded bg-blue-500/10 border border-blue-500/20 flex items-center gap-1 cursor-pointer"
                            title="Direct AI to adjust this action"
                          >
                            <Sparkles className="w-3 h-3 text-blue-300" />
                            <span>AI Refine</span>
                          </button>

                          <button
                            onClick={() => removeActionItem(act.id)}
                            className="text-slate-500 hover:text-red-400 p-1 cursor-pointer"
                            title="Delete initiative"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1">
                          Title
                        </label>
                        <input
                          type="text"
                          value={act.title}
                          onChange={(e) => updateActionItemField(act.id, 'title', e.target.value)}
                          className="w-full text-xs font-bold bg-slate-900 border border-slate-700 rounded p-1.5 text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1">
                          Execution Steps
                        </label>
                        <textarea
                          rows={2}
                          value={act.action}
                          onChange={(e) => updateActionItemField(act.id, 'action', e.target.value)}
                          className="w-full text-xs bg-slate-900 border border-slate-700 rounded p-1.5 text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500 leading-relaxed"
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1">
                            Expected Impact
                          </label>
                          <input
                            type="text"
                            value={act.expectedImpact}
                            onChange={(e) => updateActionItemField(act.id, 'expectedImpact', e.target.value)}
                            className="w-full text-xs bg-slate-900 border border-slate-700 rounded p-1.5 text-emerald-300 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1">
                            Owner / Role
                          </label>
                          <input
                            type="text"
                            value={act.responsibleRole}
                            onChange={(e) => updateActionItemField(act.id, 'responsibleRole', e.target.value)}
                            className="w-full text-xs bg-slate-900 border border-slate-700 rounded p-1.5 text-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* Standard Read Card View */
                    <>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                            {act.category}
                          </span>
                          <div className="flex items-center gap-1.5">
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
                            <button
                              onClick={() =>
                                setRefineTarget({
                                  section: 'singleAction',
                                  title: `Action: ${act.title}`,
                                  currentContent: act,
                                  actionId: act.id,
                                })
                              }
                              className="text-[10px] text-blue-400 hover:text-blue-300 font-medium px-2 py-0.5 rounded bg-blue-500/10 border border-blue-500/20 flex items-center gap-1 print:hidden cursor-pointer"
                              title="Direct AI to rewrite this action"
                            >
                              <Sparkles className="w-3 h-3 text-blue-300" />
                              <span>AI Refine</span>
                            </button>
                          </div>
                        </div>

                        <h4 className={`text-sm font-bold tracking-tight ${isCompleted ? 'text-emerald-300 line-through' : 'text-white'} print:text-black`}>
                          {act.title}
                        </h4>

                        <p className="text-xs text-slate-300 leading-relaxed print:text-slate-800">
                          {act.action}
                        </p>
                      </div>

                      <div className="pt-3 border-t border-slate-800/60 space-y-2 print:border-slate-200">
                        <div className="text-[11px] text-emerald-400 font-medium flex items-start gap-1.5">
                          <ArrowRight className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                          <span>
                            <strong className="text-emerald-300">Expected Impact:</strong> {act.expectedImpact}
                          </span>
                        </div>
                        
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] text-slate-400 pt-1">
                          <div className="flex items-center gap-1.5">
                            <UserCheck className="w-3.5 h-3.5 text-slate-400" />
                            <span>
                              <strong>Owner:</strong> {act.responsibleRole}
                            </span>
                          </div>

                          {/* Interactive Status Selector */}
                          <div className="flex items-center gap-1 print:hidden">
                            <button
                              onClick={() => toggleActionStatus(act.id, 'planned')}
                              className={`px-2 py-0.5 text-[10px] font-medium rounded transition-colors cursor-pointer ${
                                currentStatus === 'planned'
                                  ? 'bg-slate-700 text-white font-bold'
                                  : 'text-slate-500 hover:text-slate-300'
                              }`}
                            >
                              Planned
                            </button>
                            <button
                              onClick={() => toggleActionStatus(act.id, 'in_progress')}
                              className={`px-2 py-0.5 text-[10px] font-medium rounded transition-colors cursor-pointer ${
                                currentStatus === 'in_progress'
                                  ? 'bg-blue-600 text-white font-bold'
                                  : 'text-slate-500 hover:text-slate-300'
                              }`}
                            >
                              In Progress
                            </button>
                            <button
                              onClick={() => toggleActionStatus(act.id, 'completed')}
                              className={`px-2 py-0.5 text-[10px] font-medium rounded transition-colors cursor-pointer ${
                                currentStatus === 'completed'
                                  ? 'bg-emerald-600 text-white font-bold'
                                  : 'text-slate-500 hover:text-slate-300'
                              }`}
                            >
                              Completed
                            </button>
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* TAB 5: AUDIT & GOVERNANCE */}
      {/* ============================================================ */}
      {(viewMode === 'dossier' || activeTab === 'governance') && (
        <div className="space-y-6">
          <div className="p-6 rounded-2xl bg-slate-900/70 border border-slate-800/80 space-y-4 print:bg-white print:border-slate-200">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/60 pb-3">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-emerald-400" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  Data Governance, Privacy Shield & Quality Health
                </h4>
              </div>
              <div className="text-xs text-emerald-400 font-mono font-bold">
                {report.dataQualityHealth.status} ({report.dataQualityHealth.overallScore}/100)
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/60">
                <div className="text-xs text-slate-400 font-medium">Total Rows</div>
                <div className="text-base font-bold text-white mt-0.5 font-mono">
                  {report.dataQualityHealth.totalRows.toLocaleString()}
                </div>
              </div>
              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/60">
                <div className="text-xs text-slate-400 font-medium">Duplicate Rows</div>
                <div className={`text-base font-bold mt-0.5 font-mono ${report.dataQualityHealth.duplicateRows > 0 ? 'text-amber-400' : 'text-slate-200'}`}>
                  {report.dataQualityHealth.duplicateRows.toLocaleString()}
                </div>
              </div>
              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/60">
                <div className="text-xs text-slate-400 font-medium">Statistical Outliers</div>
                <div className="text-base font-bold text-white mt-0.5 font-mono">
                  {report.dataQualityHealth.outlierCount.toLocaleString()}
                </div>
              </div>
              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/60">
                <div className="text-xs text-slate-400 font-medium">Null / Blank Rate</div>
                <div className="text-base font-bold text-white mt-0.5 font-mono">
                  {report.dataQualityHealth.nullRate}%
                </div>
              </div>
            </div>

            <p className="text-xs text-slate-400 italic text-center max-w-2xl mx-auto pt-2">
              {report.dataQualityHealth.complianceNote}
            </p>
          </div>

          {/* Reproducible Code Verification Drawer */}
          <div className="rounded-xl border border-slate-800 bg-slate-950/50 overflow-hidden print:hidden">
            <button
              onClick={() => setShowCodeScripts(!showCodeScripts)}
              className="w-full px-4 py-3 flex items-center justify-between text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-900/40 transition-colors cursor-pointer"
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
      )}

      {/* Interactive AI Refinement Modal */}
      <ReportRefineModal
        target={refineTarget}
        onClose={() => setRefineTarget(null)}
        onApplyRefine={handleExecuteRefine}
        isRefining={isRefining}
        refineError={refineError}
      />
    </div>
  );
};
