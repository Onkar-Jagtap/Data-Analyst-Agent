import React, { useState, useEffect } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Boxes,
  Building2,
  CheckCircle2,
  ChevronRight,
  DollarSign,
  Download,
  Flame,
  HelpCircle,
  Info,
  Layers,
  Link2,
  Network,
  PieChart,
  RefreshCw,
  Send,
  ShieldAlert,
  ShieldCheck,
  Sliders,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
  Truck,
  Zap,
} from 'lucide-react';
import { fetchCompany360Analysis, refineCompany360Analysis } from '../api.js';
import {
  Company360Analysis,
  CrossDepartmentRisk,
  CrossFunctionalKpi,
  DatasetRelationshipLink,
  DepartmentDatasetSummary,
  DepartmentType,
  LeakageStep,
  StrategicImprovementAction,
} from '../types.js';

interface Company360ViewProps {
  onSelectDataset?: (id: string) => void;
  onOpenUploadModal?: () => void;
}

type TabMode = 'roadmap' | 'waterfall' | 'marketing' | 'skus' | 'fulfillment' | 'fabric';

export const Company360View: React.FC<Company360ViewProps> = ({
  onSelectDataset,
  onOpenUploadModal,
}) => {
  const [analysis, setAnalysis] = useState<Company360Analysis | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refining, setRefining] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [activeDirective, setActiveDirective] = useState<string>('');
  const [selectedAction, setSelectedAction] = useState<StrategicImprovementAction | null>(null);
  const [simulatedActions, setSimulatedActions] = useState<Record<string, boolean>>({});
  const [activeSubTab, setActiveSubTab] = useState<TabMode>('roadmap');

  const loadAnalysis = async (directive?: string) => {
    if (directive) {
      setRefining(true);
    } else {
      setLoading(true);
    }
    setError(null);
    try {
      const res = await fetchCompany360Analysis(directive);
      setAnalysis(res);
      if (res.strategicActions?.length > 0 && !selectedAction) {
        setSelectedAction(res.strategicActions[0]);
      }
    } catch (err: any) {
      console.error('Failed to load Company 360 analysis:', err);
      setError(err.message || 'Failed to synthesize multi-department analysis.');
    } finally {
      setLoading(false);
      setRefining(false);
    }
  };

  useEffect(() => {
    loadAnalysis();
  }, []);

  const handleApplyDirective = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeDirective.trim()) return;
    setRefining(true);
    try {
      const res = await refineCompany360Analysis(activeDirective);
      setAnalysis(res);
      if (res.strategicActions?.length > 0) {
        setSelectedAction(res.strategicActions[0]);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to apply strategic directive.');
    } finally {
      setRefining(false);
    }
  };

  const toggleSimulateAction = (actionId: string) => {
    setSimulatedActions(prev => ({
      ...prev,
      [actionId]: !prev[actionId],
    }));
  };

  const parseDollarString = (str?: string): number => {
    if (!str) return 0;
    const clean = str.replace(/[^0-9.]/g, '');
    return parseFloat(clean) || 0;
  };

  const simulatedEbitdaLift = Object.entries(simulatedActions)
    .filter(([_, active]) => active)
    .reduce((acc, [id]) => {
      const act = analysis?.strategicActions.find(a => a.id === id);
      return acc + parseDollarString(act?.expectedFinancialImpact);
    }, 0);

  const getDepartmentColor = (dept: DepartmentType | string) => {
    switch (String(dept).toLowerCase()) {
      case 'leads':
        return 'text-amber-300 bg-amber-950/40 border-amber-800/60';
      case 'marketing':
        return 'text-purple-300 bg-purple-950/40 border-purple-800/60';
      case 'sales':
        return 'text-blue-300 bg-blue-950/40 border-blue-800/60';
      case 'operations':
        return 'text-cyan-300 bg-cyan-950/40 border-cyan-800/60';
      case 'finance':
        return 'text-emerald-300 bg-emerald-950/40 border-emerald-800/60';
      default:
        return 'text-slate-300 bg-slate-800/60 border-slate-700';
    }
  };

  const formatCurrency = (val: number) => {
    if (Math.abs(val) >= 1_000_000) return `$${(val / 1_000_000).toFixed(2)}M`;
    if (Math.abs(val) >= 1_000) return `$${(val / 1_000).toFixed(1)}k`;
    return `$${val.toLocaleString()}`;
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-28 text-center space-y-4">
        <div className="relative">
          <div className="w-16 h-16 rounded-2xl bg-blue-600/10 border border-blue-500/30 flex items-center justify-center text-blue-400 animate-pulse">
            <Building2 className="w-8 h-8" />
          </div>
          <RefreshCw className="w-5 h-5 text-blue-400 animate-spin absolute -top-1 -right-1" />
        </div>
        <div className="space-y-1.5">
          <h3 className="text-base font-bold text-slate-100">
            Synthesizing Enterprise 360° Cross-Dataset Fabric
          </h3>
          <p className="text-xs text-slate-400 max-w-md">
            Auto-discovering joins across Leads, Marketing, Sales, Operations, and Finance to quantify cross-functional leakages...
          </p>
        </div>
      </div>
    );
  }

  if (error || !analysis) {
    return (
      <div className="p-8 rounded-2xl bg-slate-900 border border-slate-800 text-center space-y-4 max-w-lg mx-auto my-12 shadow-xl">
        <div className="w-12 h-12 rounded-full bg-red-950/50 border border-red-800/60 text-red-400 flex items-center justify-center mx-auto">
          <AlertCircle className="w-6 h-6" />
        </div>
        <div>
          <h3 className="text-base font-bold text-slate-200">Unable to Run 360° Synthesis</h3>
          <p className="text-xs text-slate-400 mt-1">{error || 'No departmental datasets discovered in this workspace.'}</p>
        </div>
        <div className="flex items-center justify-center gap-2 pt-2">
          <button
            onClick={() => loadAnalysis()}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 transition-colors"
          >
            Retry Analysis
          </button>
          {onOpenUploadModal && (
            <button
              onClick={onOpenUploadModal}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-bold text-white transition-colors"
            >
              Upload Department Datasets
            </button>
          )}
        </div>
      </div>
    );
  }

  const grossStep = analysis.leakageWaterfall.find(s => s.type === 'revenue') || analysis.leakageWaterfall[0];
  const netStep = analysis.leakageWaterfall.find(s => s.type === 'net') || analysis.leakageWaterfall[analysis.leakageWaterfall.length - 1];

  return (
    <div className="space-y-6 animate-in fade-in duration-300 pb-16">
      {/* 1. Executive Master Banner */}
      <div className="p-6 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900 to-blue-950/40 border border-slate-800 shadow-xl relative overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6">
          <div className="space-y-2 max-w-3xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center gap-1.5">
                <Sparkles className="w-3 h-3 text-blue-400" />
                Enterprise 360° Cross-Functional Model
              </span>
              <span className="text-xs text-slate-500">•</span>
              <span className="text-xs text-slate-400">
                {analysis.datasets.length} Connected Department Streams
              </span>
              <span className="text-xs text-slate-500">•</span>
              <span className="text-xs text-slate-400">
                {analysis.relationships.length} Auto-Discovered Entity Joins
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-black text-slate-100 tracking-tight leading-snug">
              {analysis.executiveHeadline}
            </h1>

            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed pt-1">
              {analysis.synthesisSummary}
            </p>

            <div className="pt-2 text-xs text-slate-400 italic">
              "{analysis.macroContext}"
            </div>
          </div>

          {/* Health Score Gauge & Action Controls */}
          <div className="flex flex-col items-end gap-3 shrink-0">
            <div className="flex items-center gap-3 p-3 rounded-2xl bg-slate-950/80 border border-slate-800/90 shadow-inner">
              <div className="text-right">
                <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
                  Enterprise Health
                </div>
                <div className="text-2xl font-black font-mono text-slate-100">
                  {analysis.overallHealthScore}<span className="text-xs text-slate-500 font-normal">/100</span>
                </div>
              </div>
              <div className={`w-12 h-12 rounded-xl border flex items-center justify-center font-bold font-mono text-lg shadow-sm ${
                analysis.overallHealthScore >= 75
                  ? 'bg-emerald-950/60 border-emerald-700/60 text-emerald-400'
                  : analysis.overallHealthScore >= 60
                  ? 'bg-amber-950/60 border-amber-700/60 text-amber-400'
                  : 'bg-red-950/60 border-red-700/60 text-red-400'
              }`}>
                {analysis.overallHealthScore >= 75 ? 'A-' : analysis.overallHealthScore >= 60 ? 'B' : 'C-'}
              </div>
            </div>

            <div className="flex items-center gap-2">
              {onOpenUploadModal && (
                <button
                  onClick={onOpenUploadModal}
                  className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-slate-200 transition-colors flex items-center gap-1.5"
                >
                  <Layers className="w-3.5 h-3.5 text-blue-400" />
                  <span>Upload More Files</span>
                </button>
              )}
              <button
                onClick={() => loadAnalysis()}
                disabled={loading || refining}
                className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-xs font-bold text-white transition-colors flex items-center gap-1.5 shadow-sm shadow-blue-500/20"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${refining ? 'animate-spin' : ''}`} />
                <span>{refining ? 'Simulating...' : 'Recalculate'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Department Data Fabric Pill Roster */}
        <div className="mt-6 pt-4 border-t border-slate-800/80 flex flex-wrap items-center gap-2.5">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mr-1 flex items-center gap-1">
            <Network className="w-3.5 h-3.5 text-slate-400" />
            Connected Departments:
          </span>
          {analysis.datasets.map(dept => {
            const color = getDepartmentColor(dept.department);
            return (
              <div
                key={dept.id}
                onClick={() => onSelectDataset && onSelectDataset(dept.id)}
                className={`px-3 py-1.5 rounded-xl border flex items-center gap-2 cursor-pointer hover:scale-[1.02] transition-transform ${color}`}
                title={`Click to view single-file analytics for ${dept.filename}`}
              >
                <span className="font-bold text-xs capitalize">{dept.department}</span>
                <span className="text-[10px] opacity-75 font-mono">({dept.filename})</span>
                <span className="text-[10px] px-1 rounded bg-black/30 font-medium font-mono">
                  {dept.rowCount.toLocaleString()} rows
                </span>
                <ChevronRight className="w-3 h-3 opacity-60" />
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. AI Scenario Directive & Hypothesis Bar */}
      <form
        onSubmit={handleApplyDirective}
        className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 flex flex-col sm:flex-row items-center gap-3 shadow-lg"
      >
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="w-8 h-8 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
            <Sliders className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-bold text-slate-200">AI Strategic Scenario Simulator</div>
            <div className="text-[10px] text-slate-400">Direct Gemini to re-evaluate cross-functional impact</div>
          </div>
        </div>

        <div className="flex-1 w-full relative">
          <input
            type="text"
            value={activeDirective}
            onChange={(e) => setActiveDirective(e.target.value)}
            placeholder="e.g. Cut Meta ad spend by 30%, eliminate UPS Freight Server Blade shipping damages, and cap discounts at 10%..."
            className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors pr-8"
          />
        </div>

        <button
          type="submit"
          disabled={!activeDirective.trim() || refining}
          className="w-full sm:w-auto px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-600 text-xs font-bold text-white transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap shadow-sm shadow-indigo-500/20"
        >
          {refining ? (
            <>
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              <span>Simulating...</span>
            </>
          ) : (
            <>
              <Zap className="w-3.5 h-3.5" />
              <span>Run Scenario</span>
            </>
          )}
        </button>
      </form>

      {/* 3. Cross-Functional Macro KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {analysis.crossFunctionalKpis.map(kpi => {
          const isPositive = kpi.trend === 'positive';
          return (
            <div
              key={kpi.id}
              className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800/80 shadow-md space-y-2 hover:border-slate-700 transition-colors"
            >
              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <span className="font-semibold truncate" title={kpi.title}>
                  {kpi.title}
                </span>
                {isPositive ? (
                  <TrendingUp className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                ) : (
                  <TrendingDown className="w-3.5 h-3.5 text-red-400 shrink-0" />
                )}
              </div>

              <div className="flex items-baseline gap-1.5">
                <span className="text-xl font-extrabold text-slate-100 tracking-tight font-mono">
                  {kpi.value}
                </span>
              </div>

              <div className="pt-1.5 border-t border-slate-800/80 space-y-1">
                {kpi.benchmarkOrTarget && (
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-slate-500">Benchmark:</span>
                    <span className="text-slate-300 font-mono">{kpi.benchmarkOrTarget}</span>
                  </div>
                )}
                <div className="text-[10px] text-slate-400 line-clamp-2 leading-tight" title={kpi.description}>
                  {kpi.description}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* 4. Sub-Navigation Tabs for Deep Dives */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
        <div className="flex items-center gap-2 overflow-x-auto">
          <button
            onClick={() => setActiveSubTab('roadmap')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap ${
              activeSubTab === 'roadmap'
                ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <Target className="w-3.5 h-3.5" />
            <span>Strategic Action Roadmap</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-black/30 font-mono">
              {analysis.strategicActions.length}
            </span>
          </button>

          <button
            onClick={() => setActiveSubTab('waterfall')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap ${
              activeSubTab === 'waterfall'
                ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>Profit & Leakage Waterfall</span>
          </button>

          <button
            onClick={() => setActiveSubTab('marketing')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap ${
              activeSubTab === 'marketing'
                ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <PieChart className="w-3.5 h-3.5" />
            <span>Marketing Efficiency Matrix</span>
          </button>

          <button
            onClick={() => setActiveSubTab('skus')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap ${
              activeSubTab === 'skus'
                ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <Boxes className="w-3.5 h-3.5" />
            <span>Unprofitable SKUs / Segments</span>
          </button>

          <button
            onClick={() => setActiveSubTab('fulfillment')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap ${
              activeSubTab === 'fulfillment'
                ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <Truck className="w-3.5 h-3.5" />
            <span>Carrier & Fulfillment SLAs</span>
          </button>

          <button
            onClick={() => setActiveSubTab('fabric')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap ${
              activeSubTab === 'fabric'
                ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <Link2 className="w-3.5 h-3.5" />
            <span>Relational Joins Fabric</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-black/30 font-mono">
              {analysis.relationships.length}
            </span>
          </button>
        </div>

        {/* Cumulative Simulated Impact Indicator */}
        {simulatedEbitdaLift > 0 && (
          <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-xl bg-emerald-950/60 border border-emerald-800/60 text-xs text-emerald-300 font-semibold">
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
            <span>Projected Annualized EBITDA Lift:</span>
            <span className="font-mono font-bold text-emerald-200">
              +{formatCurrency(simulatedEbitdaLift)}
            </span>
          </div>
        )}
      </div>

      {/* 5. Tab Content Panes */}

      {/* PANE 1: STRATEGIC ACTION ROADMAP & RISKS */}
      {activeSubTab === 'roadmap' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left: Prioritized Strategic Action Cards */}
          <div className="lg:col-span-7 space-y-4">
            <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <Target className="w-4 h-4 text-blue-400" />
                    <h3 className="text-sm font-bold text-slate-100">
                      Cross-Functional Action Roadmap
                    </h3>
                  </div>
                  <p className="text-xs text-slate-400">
                    High-impact interventions addressing root causes across organizational silos.
                  </p>
                </div>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-950/50 border border-blue-800/60 text-blue-300">
                  {analysis.strategicActions.length} Initiatives
                </span>
              </div>

              <div className="space-y-3">
                {analysis.strategicActions.map((action, idx) => {
                  const isSelected = selectedAction?.id === action.id;
                  const isSimulated = simulatedActions[action.id];

                  return (
                    <div
                      key={action.id}
                      onClick={() => setSelectedAction(action)}
                      className={`p-4 rounded-xl border transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-slate-800/80 border-blue-500/80 shadow-md shadow-blue-500/10 ring-1 ring-blue-500/30'
                          : 'bg-slate-950/50 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-xs font-bold text-slate-200">
                              #{idx + 1} {action.title}
                            </span>
                            <span className={`text-[10px] px-1.5 py-0.2 rounded font-bold uppercase ${
                              action.priority === 'Critical'
                                ? 'bg-red-950 text-red-300 border border-red-800/60'
                                : action.priority === 'High'
                                ? 'bg-amber-950 text-amber-300 border border-amber-800/60'
                                : 'bg-blue-950 text-blue-300 border border-blue-800/60'
                            }`}>
                              {action.priority}
                            </span>
                            <span className="text-[10px] text-slate-500 font-mono">
                              • {action.timeframe}
                            </span>
                          </div>
                          <p className="text-xs text-slate-400 leading-relaxed">
                            {action.finding}
                          </p>
                        </div>

                        {/* Estimated Annual Impact Badge */}
                        <div className="text-right shrink-0">
                          <div className="text-xs font-bold text-emerald-400 font-mono">
                            +{action.expectedFinancialImpact}
                          </div>
                          <div className="text-[10px] text-slate-500">Expected Lift</div>
                        </div>
                      </div>

                      {/* Department & Simulate Toggle */}
                      <div className="mt-3 pt-2.5 border-t border-slate-800/70 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          <span className={`text-[9px] font-semibold px-2 py-0.5 rounded border capitalize ${getDepartmentColor(action.department)}`}>
                            Owner: {action.department} ({action.responsibleRole})
                          </span>
                        </div>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleSimulateAction(action.id);
                          }}
                          className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold border transition-colors flex items-center gap-1 ${
                            isSimulated
                              ? 'bg-emerald-600 text-white border-emerald-500 shadow-sm shadow-emerald-500/20'
                              : 'bg-slate-900 text-slate-400 hover:text-slate-200 border-slate-800'
                          }`}
                        >
                          <Zap className="w-3 h-3" />
                          <span>{isSimulated ? 'Simulated Active' : 'Simulate Impact'}</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Selected Action Deep-Dive Plan */}
            {selectedAction && (
              <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-3 animate-in fade-in">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <h4 className="text-xs font-bold text-slate-100 uppercase tracking-wider">
                      Execution Blueprint: {selectedAction.title}
                    </h4>
                  </div>
                  <span className="text-[11px] font-mono text-slate-400">
                    Lead Role: <strong>{selectedAction.responsibleRole}</strong>
                  </span>
                </div>

                <div className="space-y-2 pt-1 text-xs">
                  <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/80 space-y-1">
                    <div className="text-[11px] font-semibold text-amber-300">Root Cause Identified:</div>
                    <div className="text-slate-300 leading-relaxed">{selectedAction.rootCause}</div>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/80 space-y-1">
                    <div className="text-[11px] font-semibold text-emerald-300">Concrete Executive Action:</div>
                    <div className="text-slate-300 leading-relaxed">{selectedAction.concreteAction}</div>
                  </div>

                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-emerald-950/20 border border-emerald-800/40 text-emerald-200">
                    <span>Projected Bottom-Line Benefit:</span>
                    <span className="font-mono font-bold">{selectedAction.expectedFinancialImpact}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right: Cross-Department Risk Radar */}
          <div className="lg:col-span-5 space-y-4">
            <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-amber-400" />
                  <h3 className="text-sm font-bold text-slate-100">
                    Cross-Department Risk Radar
                  </h3>
                </div>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-950/40 border border-amber-800/60 text-amber-300">
                  {analysis.crossDepartmentRisks.length} Detected
                </span>
              </div>

              <div className="space-y-3">
                {analysis.crossDepartmentRisks.map((risk) => (
                  <div
                    key={risk.id}
                    className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full ${
                          risk.severity === 'Critical'
                            ? 'bg-red-500 shadow-sm shadow-red-500'
                            : risk.severity === 'Warning'
                            ? 'bg-amber-500'
                            : 'bg-blue-500'
                        }`} />
                        <span className="text-xs font-bold text-slate-200">
                          {risk.title}
                        </span>
                      </div>
                      <span className="text-[10px] font-mono font-bold text-red-400">
                        {risk.metricImpact}
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      {risk.evidence}
                    </p>

                    <div className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-[10px] space-y-1">
                      <div className="text-slate-500">Intervention:</div>
                      <div className="text-slate-300 font-medium">{risk.recommendedIntervention}</div>
                    </div>

                    <div className="flex items-center justify-between text-[10px] pt-1 text-slate-500">
                      <span>Departments Involved:</span>
                      <span className="font-semibold text-slate-300">
                        {risk.departments.join(' ↔ ')}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PANE 2: PROFIT & LEAKAGE WATERFALL */}
      {activeSubTab === 'waterfall' && (
        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-blue-400" />
                <h3 className="text-sm font-bold text-slate-100">
                  Cross-Department Profit & Margin Leakage Waterfall
                </h3>
              </div>
              <p className="text-xs text-slate-400">
                Mathematical accounting of cash progression from billed Sales down to true Net Contribution Margin.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">True Contribution Margin:</span>
              <span className={`text-sm font-bold font-mono px-3 py-1 rounded-xl border ${
                netStep.amount >= 0
                  ? 'text-emerald-300 bg-emerald-950/60 border-emerald-700/60'
                  : 'text-red-300 bg-red-950/60 border-red-700/60'
              }`}>
                {formatCurrency(netStep.amount)} ({netStep.percentageOfGross}%)
              </span>
            </div>
          </div>

          {/* Waterfall Steps Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-3">
            {analysis.leakageWaterfall.map((step, idx) => {
              const isRev = step.type === 'revenue';
              const isNet = step.type === 'net';
              const isReduction = step.type === 'reduction';

              return (
                <div
                  key={idx}
                  className={`p-3.5 rounded-xl border space-y-2 flex flex-col justify-between ${
                    isRev
                      ? 'bg-blue-950/20 border-blue-800/60'
                      : isNet
                      ? 'bg-emerald-950/20 border-emerald-700/60 shadow-lg shadow-emerald-950/20'
                      : 'bg-slate-950/60 border-red-900/30'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border capitalize ${getDepartmentColor(step.department)}`}>
                        {step.department}
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono">
                        {step.percentageOfGross}% of gross
                      </span>
                    </div>

                    <div className="text-xs font-semibold text-slate-200 line-clamp-2" title={step.label}>
                      {step.label}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className={`text-lg font-black font-mono tracking-tight ${
                      isRev
                        ? 'text-blue-200'
                        : isNet
                        ? 'text-emerald-300'
                        : 'text-red-300'
                    }`}>
                      {isReduction ? `-${formatCurrency(step.amount)}` : formatCurrency(step.amount)}
                    </div>
                    <div className="text-[10px] text-slate-400 line-clamp-2 leading-tight">
                      {step.description}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Waterfall Visual Progress Bar */}
          <div className="space-y-2 pt-2">
            <div className="text-xs font-semibold text-slate-300">Revenue Drain Proportions (% of Top-Line):</div>
            <div className="h-6 w-full rounded-xl bg-slate-950 overflow-hidden flex border border-slate-800">
              {analysis.leakageWaterfall.filter(s => s.type === 'reduction').map((red, idx) => {
                const colors = ['bg-amber-500/80', 'bg-red-500/80', 'bg-purple-500/80', 'bg-cyan-500/80', 'bg-pink-500/80'];
                return (
                  <div
                    key={idx}
                    className={`${colors[idx % colors.length]} h-full transition-all relative group cursor-pointer`}
                    style={{ width: `${Math.max(3, red.percentageOfGross)}%` }}
                    title={`${red.label}: ${red.percentageOfGross}% (-${formatCurrency(red.amount)})`}
                  />
                );
              })}
              <div
                className="bg-emerald-500 h-full transition-all relative group cursor-pointer"
                style={{ width: `${Math.max(5, netStep.percentageOfGross)}%` }}
                title={`Retained Net Margin: ${netStep.percentageOfGross}% (${formatCurrency(netStep.amount)})`}
              />
            </div>
            <div className="flex flex-wrap items-center gap-4 text-[10px] text-slate-400 pt-1">
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-sm bg-amber-500" />
                <span>Sales Discounts</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-sm bg-red-500" />
                <span>COGS</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-sm bg-purple-500" />
                <span>Freight & Logistics</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-sm bg-cyan-500" />
                <span>Returns & Defects</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-sm bg-emerald-500" />
                <span className="font-bold text-emerald-400">Retained Net Profit ({netStep.percentageOfGross}%)</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PANE 3: MARKETING EFFICIENCY MATRIX */}
      {activeSubTab === 'marketing' && (
        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <PieChart className="w-4 h-4 text-purple-400" />
                <h3 className="text-sm font-bold text-slate-100">
                  Channel Marketing Efficiency Ratio (MER) & Closed-Loop Attribution
                </h3>
              </div>
              <p className="text-xs text-slate-400">
                Correlating upfront ad spend with downstream Sales closed revenue and blended CAC.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-800">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 font-mono text-[11px]">
                <tr>
                  <th className="py-3 px-4">Channel</th>
                  <th className="py-3 px-4 text-right">Ad Spend</th>
                  <th className="py-3 px-4 text-right">Leads</th>
                  <th className="py-3 px-4 text-right">Closed Orders</th>
                  <th className="py-3 px-4 text-right">Attributed Revenue</th>
                  <th className="py-3 px-4 text-right">MER (Return)</th>
                  <th className="py-3 px-4 text-right">Blended CAC</th>
                  <th className="py-3 px-4">AI Optimization Verdict</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-slate-200">
                {analysis.marketingEfficiencyMatrix?.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-4 font-semibold text-slate-100">{row.channel}</td>
                    <td className="py-3 px-4 text-right font-mono">${row.spend.toLocaleString()}</td>
                    <td className="py-3 px-4 text-right font-mono">{row.leads.toLocaleString()}</td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-blue-300">{row.closedDeals}</td>
                    <td className="py-3 px-4 text-right font-mono font-bold">${row.revenue.toLocaleString()}</td>
                    <td className="py-3 px-4 text-right font-mono font-black text-purple-300">{row.mer}x</td>
                    <td className="py-3 px-4 text-right font-mono text-slate-300">${row.cac}</td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                        row.mer >= 5.0
                          ? 'text-emerald-300 bg-emerald-950/50 border-emerald-800/60'
                          : row.mer >= 3.0
                          ? 'text-blue-300 bg-blue-950/50 border-blue-800/60'
                          : 'text-red-300 bg-red-950/50 border-red-800/60'
                      }`}>
                        {row.verdict}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* PANE 4: UNPROFITABLE SKUS / CUSTOMER LEAKS */}
      {activeSubTab === 'skus' && (
        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <Boxes className="w-4 h-4 text-red-400" />
                <h3 className="text-sm font-bold text-slate-100">
                  Unprofitable SKUs & Segment Margin Erosion
                </h3>
              </div>
              <p className="text-xs text-slate-400">
                Products and categories where high returns, freight surcharges, or excessive discounting destroy profit margins.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-800">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 font-mono text-[11px]">
                <tr>
                  <th className="py-3 px-4">Product / SKU</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4 text-right">Gross Sales</th>
                  <th className="py-3 px-4 text-right">Fulfillment & Returns</th>
                  <th className="py-3 px-4 text-right">Net Margin %</th>
                  <th className="py-3 px-4 text-right">Return Rate</th>
                  <th className="py-3 px-4">Profitability Verdict</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-slate-200">
                {analysis.unprofitableSegmentsOrSkus?.map((sku, idx) => (
                  <tr key={idx} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-4 font-semibold text-slate-100">{sku.name}</td>
                    <td className="py-3 px-4 text-slate-400">{sku.category}</td>
                    <td className="py-3 px-4 text-right font-mono">${sku.grossSales.toLocaleString()}</td>
                    <td className="py-3 px-4 text-right font-mono text-red-400">-${sku.fulfillmentAndReturnCosts.toLocaleString()}</td>
                    <td className={`py-3 px-4 text-right font-mono font-bold ${
                      sku.netMarginPct < 0 ? 'text-red-400' : 'text-emerald-400'
                    }`}>
                      {sku.netMarginPct.toFixed(1)}%
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-amber-400">{sku.returnRate}%</td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                        sku.netMarginPct < 0
                          ? 'text-red-300 bg-red-950/60 border-red-800/60'
                          : 'text-amber-300 bg-amber-950/60 border-amber-800/60'
                      }`}>
                        {sku.verdict}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* PANE 5: CARRIER & FULFILLMENT SLAS */}
      {activeSubTab === 'fulfillment' && (
        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <Truck className="w-4 h-4 text-cyan-400" />
                <h3 className="text-sm font-bold text-slate-100">
                  Carrier Performance, SLA Breaches & Reverse Logistics
                </h3>
              </div>
              <p className="text-xs text-slate-400">
                Linking logistics transit times and freight damage directly to customer refund rates.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-800">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 font-mono text-[11px]">
                <tr>
                  <th className="py-3 px-4">Carrier / Service</th>
                  <th className="py-3 px-4 text-right">Shipments</th>
                  <th className="py-3 px-4 text-right">SLA Breach %</th>
                  <th className="py-3 px-4 text-right">Return Rate %</th>
                  <th className="py-3 px-4 text-right">Avg Transit Days</th>
                  <th className="py-3 px-4">Status Verdict</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-slate-200">
                {analysis.fulfillmentSlaOverview?.map((c, idx) => (
                  <tr key={idx} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-4 font-semibold text-slate-100">{c.carrier}</td>
                    <td className="py-3 px-4 text-right font-mono">{c.shipmentCount}</td>
                    <td className={`py-3 px-4 text-right font-mono font-bold ${
                      c.slaBreachRate > 15 ? 'text-red-400' : 'text-slate-300'
                    }`}>
                      {c.slaBreachRate.toFixed(1)}%
                    </td>
                    <td className={`py-3 px-4 text-right font-mono font-bold ${
                      c.returnRate > 15 ? 'text-red-400' : 'text-slate-300'
                    }`}>
                      {c.returnRate.toFixed(1)}%
                    </td>
                    <td className="py-3 px-4 text-right font-mono">{c.avgDeliveryDays.toFixed(1)} days</td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                        c.status === 'Healthy'
                          ? 'text-emerald-300 bg-emerald-950/60 border-emerald-800/60'
                          : c.status === 'Needs Attention'
                          ? 'text-amber-300 bg-amber-950/60 border-amber-800/60'
                          : 'text-red-300 bg-red-950/60 border-red-800/60'
                      }`}>
                        {c.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* PANE 6: RELATIONAL JOINS FABRIC */}
      {activeSubTab === 'fabric' && (
        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <Link2 className="w-4 h-4 text-blue-400" />
                <h3 className="text-sm font-bold text-slate-100">
                  Data Fabric & Relational Join Discovery
                </h3>
              </div>
              <p className="text-xs text-slate-400">
                Discovered key overlaps bridging disparate tabular datasets across departments.
              </p>
            </div>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-950/50 border border-blue-800/60 text-blue-300 font-mono">
              {analysis.relationships.length} Discovered Joins
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {analysis.relationships.map((rel, idx) => (
              <div
                key={idx}
                className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-2.5 hover:border-slate-700 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border capitalize ${getDepartmentColor(rel.sourceDepartment)}`}>
                      {rel.sourceDepartment}
                    </span>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border capitalize ${getDepartmentColor(rel.targetDepartment)}`}>
                      {rel.targetDepartment}
                    </span>
                  </div>
                  <span className={`text-[10px] font-bold font-mono px-2 py-0.5 rounded-full border ${
                    rel.joinStatus === 'healthy'
                      ? 'text-emerald-300 bg-emerald-950/60 border-emerald-800/60'
                      : 'text-amber-300 bg-amber-950/60 border-amber-800/60'
                  }`}>
                    {rel.matchPercentage}% overlap
                  </span>
                </div>

                <div className="text-xs text-slate-300 flex items-center justify-between font-mono bg-slate-900 p-2 rounded-lg border border-slate-800">
                  <span className="truncate max-w-[140px] text-blue-300">
                    {rel.sourceDatasetName}.{rel.sourceKey}
                  </span>
                  <span className="text-slate-500 font-sans text-[11px] font-semibold">
                    {rel.matchType}
                  </span>
                  <span className="truncate max-w-[140px] text-blue-300 text-right">
                    {rel.targetDatasetName}.{rel.targetKey}
                  </span>
                </div>

                <div className="text-[10px] text-slate-400 flex items-center justify-between">
                  <span>Join Integrity: <strong>{rel.joinStatus.replace('_', ' ')}</strong></span>
                  <span className="font-mono">Cardinality: {rel.matchType}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
