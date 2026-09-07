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
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Clock,
  DollarSign,
  Download,
  Filter,
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
  const [departmentFilter, setDepartmentFilter] = useState<string>('All');
  const [expandedActionIds, setExpandedActionIds] = useState<Record<string, boolean>>({});

  const toggleExpandAction = (id: string) => {
    setExpandedActionIds(prev => ({
      ...prev,
      [id]: !(prev[id] ?? true), // default is true (expanded)
    }));
  };

  const toggleAllExpanded = () => {
    if (!analysis?.strategicActions) return;
    const allExpanded = analysis.strategicActions.every(a => expandedActionIds[a.id] ?? true);
    const nextState: Record<string, boolean> = {};
    analysis.strategicActions.forEach(a => {
      nextState[a.id] = !allExpanded;
    });
    setExpandedActionIds(nextState);
  };

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
      if (act?.annualEbitdaImpact) {
        return acc + act.annualEbitdaImpact;
      }
      return acc + parseDollarString(act?.impactMetric || act?.expectedFinancialImpact);
    }, 0);

  const getDepartmentColor = (dept: DepartmentType | string) => {
    switch (String(dept).toLowerCase()) {
      case 'executive':
        return 'text-indigo-300 bg-indigo-950/70 border-indigo-700/80';
      case 'leads':
        return 'text-amber-300 bg-amber-950/70 border-amber-700/80';
      case 'marketing':
        return 'text-purple-300 bg-purple-950/70 border-purple-700/80';
      case 'sales':
        return 'text-blue-300 bg-blue-950/70 border-blue-700/80';
      case 'operations':
        return 'text-cyan-300 bg-cyan-950/70 border-cyan-700/80';
      case 'finance':
        return 'text-emerald-300 bg-emerald-950/70 border-emerald-700/80';
      default:
        return 'text-slate-300 bg-slate-800/80 border-slate-700';
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
              <span className="px-3 py-1 rounded-full text-xs font-bold tracking-wider uppercase bg-blue-500/15 text-blue-300 border border-blue-500/30 flex items-center gap-1.5 shadow-sm">
                <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                Enterprise 360° Cross-Functional Model
              </span>
              <span className="text-xs text-slate-500">•</span>
              <span className="text-xs font-medium text-slate-300">
                {analysis.datasets.length} Connected Department Streams
              </span>
              <span className="text-xs text-slate-500">•</span>
              <span className="text-xs font-medium text-slate-300">
                {analysis.relationships.length} Auto-Discovered Entity Joins
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-black text-slate-100 tracking-tight leading-snug">
              {analysis.executiveHeadline}
            </h1>

            <p className="text-sm sm:text-base text-slate-200 leading-relaxed pt-1 font-normal">
              {analysis.synthesisSummary}
            </p>

            <div className="pt-2 text-xs sm:text-sm text-slate-300 italic">
              "{analysis.macroContext}"
            </div>
          </div>

          {/* Health Score Gauge & Action Controls */}
          <div className="flex flex-col items-end gap-3 shrink-0">
            <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-slate-950/90 border border-slate-800 shadow-inner">
              <div className="text-right">
                <div className="text-xs uppercase tracking-wider text-slate-300 font-semibold">
                  Enterprise Health
                </div>
                <div className="text-2xl sm:text-3xl font-black font-mono text-slate-100">
                  {analysis.overallHealthScore}<span className="text-xs text-slate-400 font-normal">/100</span>
                </div>
              </div>
              <div className={`w-12 h-12 rounded-xl border flex items-center justify-center font-bold font-mono text-lg shadow-sm ${
                analysis.overallHealthScore >= 75
                  ? 'bg-emerald-950/70 border-emerald-600/80 text-emerald-300'
                  : analysis.overallHealthScore >= 60
                  ? 'bg-amber-950/70 border-amber-600/80 text-amber-300'
                  : 'bg-red-950/70 border-red-600/80 text-red-300'
              }`}>
                {analysis.overallHealthScore >= 75 ? 'A-' : analysis.overallHealthScore >= 60 ? 'B' : 'C-'}
              </div>
            </div>

            <div className="flex items-center gap-2">
              {onOpenUploadModal && (
                <button
                  onClick={onOpenUploadModal}
                  className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-slate-200 transition-colors flex items-center gap-1.5"
                >
                  <Layers className="w-3.5 h-3.5 text-blue-400" />
                  <span>Upload More Files</span>
                </button>
              )}
              <button
                onClick={() => loadAnalysis()}
                disabled={loading || refining}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-xs font-bold text-white transition-colors flex items-center gap-1.5 shadow-sm shadow-blue-500/20"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${refining ? 'animate-spin' : ''}`} />
                <span>{refining ? 'Simulating...' : 'Recalculate'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Department Data Fabric Pill Roster */}
        <div className="mt-6 pt-4 border-t border-slate-800/80 flex flex-wrap items-center gap-2.5">
          <span className="text-xs font-bold text-slate-300 uppercase tracking-wider mr-1 flex items-center gap-1.5">
            <Network className="w-3.5 h-3.5 text-blue-400" />
            Connected Departments:
          </span>
          {analysis.datasets.map(dept => {
            const color = getDepartmentColor(dept.department);
            return (
              <div
                key={dept.id}
                onClick={() => onSelectDataset && onSelectDataset(dept.id)}
                className={`px-3.5 py-1.5 rounded-xl border flex items-center gap-2 cursor-pointer hover:scale-[1.02] transition-transform ${color}`}
                title={`Click to view single-file analytics for ${dept.filename}`}
              >
                <span className="font-bold text-xs capitalize">{dept.department}</span>
                <span className="text-xs text-slate-300 font-mono">({dept.filename})</span>
                <span className="text-xs px-2 py-0.5 rounded-lg bg-black/40 font-semibold font-mono text-slate-200">
                  {dept.rowCount.toLocaleString()} rows
                </span>
                <ChevronRight className="w-3.5 h-3.5 opacity-70" />
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
          <div className="w-9 h-9 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
            <Sliders className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs sm:text-sm font-bold text-slate-100">AI Strategic Scenario Simulator</div>
            <div className="text-xs text-slate-300">Direct Gemini to re-evaluate cross-functional impact</div>
          </div>
        </div>

        <div className="flex-1 w-full relative">
          <input
            type="text"
            value={activeDirective}
            onChange={(e) => setActiveDirective(e.target.value)}
            placeholder="e.g. Cut Meta ad spend by 30%, eliminate UPS Freight Server Blade shipping damages, and cap discounts at 10%..."
            className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-slate-100 placeholder-slate-400 focus:outline-none focus:border-indigo-500 transition-colors pr-8"
          />
        </div>

        <button
          type="submit"
          disabled={!activeDirective.trim() || refining}
          className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-500 text-xs sm:text-sm font-bold text-white transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap shadow-sm shadow-indigo-500/20"
        >
          {refining ? (
            <>
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              <span>Simulating...</span>
            </>
          ) : (
            <>
              <Zap className="w-3.5 h-3.5 text-amber-300" />
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
              className="p-4 rounded-2xl bg-slate-900 border border-slate-800/80 shadow-md space-y-2 hover:border-slate-700 transition-colors"
            >
              <div className="flex items-center justify-between text-xs text-slate-300">
                <span className="font-bold truncate" title={kpi.title}>
                  {kpi.title}
                </span>
                {isPositive ? (
                  <TrendingUp className="w-4 h-4 text-emerald-400 shrink-0" />
                ) : (
                  <TrendingDown className="w-4 h-4 text-red-400 shrink-0" />
                )}
              </div>

              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-black text-slate-100 tracking-tight font-mono">
                  {kpi.value}
                </span>
              </div>

              <div className="pt-2 border-t border-slate-800/80 space-y-1">
                {kpi.benchmarkOrTarget && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400 font-medium">Benchmark:</span>
                    <span className="text-slate-200 font-mono font-semibold">{kpi.benchmarkOrTarget}</span>
                  </div>
                )}
                <div className="text-xs text-slate-300 leading-normal" title={kpi.description}>
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
            className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-2 transition-colors whitespace-nowrap ${
              activeSubTab === 'roadmap'
                ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/20'
                : 'text-slate-300 hover:text-slate-100 hover:bg-slate-800'
            }`}
          >
            <Target className="w-4 h-4" />
            <span>Strategic Action Roadmap</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-black/40 font-mono font-bold">
              {analysis.strategicActions.length}
            </span>
          </button>

          <button
            onClick={() => setActiveSubTab('waterfall')}
            className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-2 transition-colors whitespace-nowrap ${
              activeSubTab === 'waterfall'
                ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/20'
                : 'text-slate-300 hover:text-slate-100 hover:bg-slate-800'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>Profit & Leakage Waterfall</span>
          </button>

          <button
            onClick={() => setActiveSubTab('marketing')}
            className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-2 transition-colors whitespace-nowrap ${
              activeSubTab === 'marketing'
                ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/20'
                : 'text-slate-300 hover:text-slate-100 hover:bg-slate-800'
            }`}
          >
            <PieChart className="w-4 h-4" />
            <span>Marketing Efficiency Matrix</span>
          </button>

          <button
            onClick={() => setActiveSubTab('skus')}
            className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-2 transition-colors whitespace-nowrap ${
              activeSubTab === 'skus'
                ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/20'
                : 'text-slate-300 hover:text-slate-100 hover:bg-slate-800'
            }`}
          >
            <Boxes className="w-4 h-4" />
            <span>Unprofitable SKUs / Segments</span>
          </button>

          <button
            onClick={() => setActiveSubTab('fulfillment')}
            className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-2 transition-colors whitespace-nowrap ${
              activeSubTab === 'fulfillment'
                ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/20'
                : 'text-slate-300 hover:text-slate-100 hover:bg-slate-800'
            }`}
          >
            <Truck className="w-4 h-4" />
            <span>Carrier & Fulfillment SLAs</span>
          </button>

          <button
            onClick={() => setActiveSubTab('fabric')}
            className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-2 transition-colors whitespace-nowrap ${
              activeSubTab === 'fabric'
                ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/20'
                : 'text-slate-300 hover:text-slate-100 hover:bg-slate-800'
            }`}
          >
            <Link2 className="w-4 h-4" />
            <span>Relational Joins Fabric</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-black/40 font-mono font-bold">
              {analysis.relationships.length}
            </span>
          </button>
        </div>

        {/* Cumulative Simulated Impact Indicator */}
        {simulatedEbitdaLift > 0 && (
          <div className="hidden sm:flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-emerald-950/70 border border-emerald-700/70 text-xs text-emerald-300 font-semibold shadow-sm">
            <Sparkles className="w-4 h-4 text-emerald-400" />
            <span>Projected Annual EBITDA Lift:</span>
            <span className="font-mono font-black text-emerald-200">
              +{formatCurrency(simulatedEbitdaLift)}
            </span>
          </div>
        )}
      </div>

      {/* 5. Tab Content Panes */}

      {/* PANE 1: STRATEGIC ACTION ROADMAP & RISKS */}
      {activeSubTab === 'roadmap' && (
        <div className="space-y-6">
          {/* A. Interactive Strategic Impact Simulation Cockpit */}
          <div className="p-5 sm:p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900 to-emerald-950/40 border border-slate-800 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-5">
            <div className="space-y-1.5 max-w-xl">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                  Strategic Financial Simulation Cockpit
                </span>
              </div>
              <p className="text-sm sm:text-[15px] text-slate-200 leading-relaxed font-normal">
                Model compound bottom-line EBITDA lift from executing cross-department initiatives. Toggle individual actions or simulate full roadmap execution.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="px-4 py-2.5 rounded-xl bg-slate-950/90 border border-emerald-800/60 shadow-inner flex items-center gap-3.5">
                <div className="text-right">
                  <div className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                    Simulated EBITDA Lift
                  </div>
                  <div className="text-xl sm:text-2xl font-black font-mono text-emerald-300 tracking-tight">
                    +{formatCurrency(simulatedEbitdaLift)}{' '}
                    <span className="text-xs text-emerald-400/90 font-medium">/ yr</span>
                  </div>
                </div>
                <div className="h-9 w-px bg-slate-800" />
                <div className="text-center">
                  <div className="text-xs font-bold text-slate-300 uppercase tracking-wider">Active</div>
                  <div className="text-xs font-bold px-2 py-0.5 rounded-lg bg-emerald-950 border border-emerald-700/80 text-emerald-300 font-mono mt-0.5">
                    {Object.values(simulatedActions).filter(Boolean).length} / {analysis.strategicActions.length}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  const anyActive = Object.values(simulatedActions).some(Boolean);
                  if (anyActive) {
                    setSimulatedActions({});
                  } else {
                    const all: Record<string, boolean> = {};
                    analysis.strategicActions.forEach(a => { all[a.id] = true; });
                    setSimulatedActions(all);
                  }
                }}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs sm:text-sm font-bold text-slate-100 hover:text-white border border-slate-700 transition-colors shadow-sm flex items-center gap-1.5"
              >
                <Zap className="w-3.5 h-3.5 text-amber-400" />
                <span>{Object.values(simulatedActions).some(Boolean) ? 'Reset Simulation' : 'Simulate All (+$449k)'}</span>
              </button>
            </div>
          </div>

          {/* B. Main Grid: Action Cards (Left) & Risk Radar (Right) */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
            {/* Left Column (xl:col-span-7): Action Roadmap Cards */}
            <div className="xl:col-span-7 space-y-4">
              {/* Header & Filter Controls */}
              <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Target className="w-5 h-5 text-blue-400" />
                      <h2 className="text-xl sm:text-2xl font-bold text-white font-display tracking-tight">
                        Cross-Functional Action Roadmap
                      </h2>
                    </div>
                    <p className="text-xs sm:text-sm text-slate-300">
                      High-impact executive interventions addressing cross-silo root causes.
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={toggleAllExpanded}
                      className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs sm:text-sm font-semibold text-slate-200 hover:text-white border border-slate-700 transition-colors flex items-center gap-1.5"
                    >
                      {analysis.strategicActions.every(a => expandedActionIds[a.id] ?? true) ? (
                        <>
                          <ChevronUp className="w-3.5 h-3.5 text-slate-300" />
                          <span>Collapse Blueprints</span>
                        </>
                      ) : (
                        <>
                          <ChevronDown className="w-3.5 h-3.5 text-slate-300" />
                          <span>Expand Blueprints</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Department Filter Bar */}
                <div className="pt-2 border-t border-slate-800/80 flex flex-wrap items-center gap-2">
                  <span className="text-xs font-bold text-slate-300 uppercase tracking-wider mr-1 flex items-center gap-1">
                    <Filter className="w-3.5 h-3.5 text-slate-400" />
                    Department:
                  </span>
                  {['All', 'Executive', 'Marketing', 'Sales', 'Operations', 'Finance'].map(dept => {
                    const isDeptActive = departmentFilter === dept;
                    const count = dept === 'All'
                      ? analysis.strategicActions.length
                      : analysis.strategicActions.filter(a => a.department.toLowerCase() === dept.toLowerCase()).length;

                    return (
                      <button
                        type="button"
                        key={dept}
                        onClick={() => setDepartmentFilter(dept)}
                        className={`px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center gap-1.5 border ${
                          isDeptActive
                            ? 'bg-blue-600 text-white border-blue-500 shadow-sm shadow-blue-500/20'
                            : 'bg-slate-950/70 text-slate-300 hover:text-slate-100 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <span>{dept}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-mono ${
                          isDeptActive ? 'bg-black/30 text-white' : 'bg-slate-800 text-slate-300'
                        }`}>
                          {count}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Action Cards List */}
              <div className="space-y-4">
                {analysis.strategicActions
                  .filter(action => departmentFilter === 'All' || action.department.toLowerCase() === departmentFilter.toLowerCase())
                  .map((action, idx) => {
                    const isSelected = selectedAction?.id === action.id;
                    const isSimulated = simulatedActions[action.id];
                    const isExpanded = expandedActionIds[action.id] ?? true;
                    const deptColor = getDepartmentColor(action.department);

                    return (
                      <div
                        key={action.id}
                        onClick={() => setSelectedAction(action)}
                        className={`p-5 sm:p-6 rounded-2xl border transition-all duration-200 shadow-xl space-y-4 cursor-pointer ${
                          isSimulated
                            ? 'bg-slate-900 border-emerald-500/80 shadow-emerald-950/30 ring-1 ring-emerald-500/30'
                            : isSelected
                            ? 'bg-slate-900 border-blue-500/80 shadow-blue-950/30 ring-1 ring-blue-500/30'
                            : 'bg-slate-900/90 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        {/* 1. Card Header Row */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="px-2.5 py-1 rounded-lg bg-blue-950/80 border border-blue-800/80 text-blue-300 font-mono font-bold text-xs">
                              INITIATIVE #{idx + 1}
                            </span>
                            <span className={`text-xs px-2.5 py-1 rounded-lg font-bold uppercase tracking-wider border ${
                              action.priority === 'Critical'
                                ? 'bg-rose-950/80 text-rose-300 border-rose-800/80'
                                : action.priority === 'High'
                                ? 'bg-amber-950/80 text-amber-300 border-amber-800/80'
                                : 'bg-blue-950/80 text-blue-300 border-blue-800/80'
                            }`}>
                              {action.priority} Priority
                            </span>
                            <span className={`text-xs px-2.5 py-1 rounded-lg font-bold uppercase tracking-wider border ${deptColor}`}>
                              {action.department}
                            </span>
                            <span className="text-xs text-slate-300 bg-slate-950/80 px-2.5 py-1 rounded-lg border border-slate-800/80 flex items-center gap-1.5 font-medium">
                              <Clock className="w-3.5 h-3.5 text-slate-400" />
                              {action.timeframe}
                            </span>
                          </div>

                          {/* Interactive Simulate Impact Button */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleSimulateAction(action.id);
                            }}
                            className={`px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-bold border transition-all flex items-center gap-1.5 shrink-0 ${
                              isSimulated
                                ? 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-500 shadow-md shadow-emerald-600/30'
                                : 'bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border-slate-700'
                            }`}
                          >
                            {isSimulated ? (
                              <>
                                <CheckCircle2 className="w-4 h-4" />
                                <span>Simulated Active ({action.impactMetric || formatCurrency(action.annualEbitdaImpact || 0)})</span>
                              </>
                            ) : (
                              <>
                                <Zap className="w-3.5 h-3.5 text-amber-400" />
                                <span>Simulate Impact</span>
                              </>
                            )}
                          </button>
                        </div>

                        {/* 2. Card Title */}
                        <h3 className="text-lg sm:text-xl font-bold text-white font-display tracking-tight leading-snug">
                          {action.title}
                        </h3>

                        {/* 3. Operational Diagnostic Finding */}
                        <div className="p-4 sm:p-5 rounded-xl bg-slate-950/80 border border-slate-800/90 space-y-2">
                          <div className="text-xs font-bold uppercase tracking-wider text-blue-400 flex items-center gap-1.5">
                            <Info className="w-4 h-4 text-blue-400 shrink-0" />
                            <span>Executive Finding & Synthesis:</span>
                          </div>
                          <p className="text-sm sm:text-[15px] text-slate-100 leading-relaxed font-normal">
                            {action.finding}
                          </p>
                        </div>

                        {/* 4. Projected Bottom-Line Financial Impact Box */}
                        <div className="p-4 sm:p-5 rounded-xl bg-emerald-950/30 border border-emerald-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-inner">
                          <div className="space-y-1.5">
                            <div className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                              <TrendingUp className="w-4 h-4 text-emerald-400 shrink-0" />
                              <span>Projected Financial & Operational Benefit:</span>
                            </div>
                            <div className="text-sm sm:text-[15px] text-emerald-100 font-medium leading-relaxed">
                              {action.expectedFinancialImpact}
                            </div>
                          </div>
                          <div className="text-left sm:text-right shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-emerald-800/40">
                            <div className="text-2xl sm:text-3xl font-black font-mono text-emerald-300 tracking-tight">
                              {action.impactMetric || (action.annualEbitdaImpact ? `+$${action.annualEbitdaImpact.toLocaleString()} / yr` : 'High Value')}
                            </div>
                            <div className="text-xs text-emerald-400/90 font-semibold uppercase tracking-wider">
                              EBITDA Improvement
                            </div>
                          </div>
                        </div>

                        {/* 5. In-Card Expandable Execution Blueprint */}
                        <div className="space-y-2">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleExpandAction(action.id);
                            }}
                            className="w-full py-3 px-4 rounded-xl bg-slate-950/70 hover:bg-slate-950 border border-slate-800 text-xs sm:text-sm font-bold text-slate-200 hover:text-white transition-colors flex items-center justify-between"
                          >
                            <span className="flex items-center gap-2">
                              <CheckCircle2 className="w-4 h-4 text-blue-400" />
                              <span>Execution Blueprint & Root Cause Remediation</span>
                            </span>
                            {isExpanded ? (
                              <ChevronUp className="w-4 h-4 text-slate-300" />
                            ) : (
                              <ChevronDown className="w-4 h-4 text-slate-300" />
                            )}
                          </button>

                          {isExpanded && (
                            <div className="space-y-3 pt-1 animate-in fade-in duration-200">
                              {/* Root Cause Container */}
                              <div className="p-4 sm:p-5 rounded-xl bg-amber-950/20 border border-amber-800/50 space-y-1.5">
                                <div className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                                  <span>Identified Cross-Silo Root Cause:</span>
                                </div>
                                <p className="text-sm sm:text-[15px] text-slate-100 leading-relaxed font-normal">
                                  {action.rootCause}
                                </p>
                              </div>

                              {/* Concrete Implementation Container */}
                              <div className="p-4 sm:p-5 rounded-xl bg-blue-950/20 border border-blue-800/50 space-y-1.5">
                                <div className="text-xs font-bold uppercase tracking-wider text-blue-400 flex items-center gap-1.5">
                                  <Target className="w-4 h-4 text-blue-400 shrink-0" />
                                  <span>Concrete Executive Implementation Mandate:</span>
                                </div>
                                <p className="text-sm sm:text-[15px] text-slate-100 leading-relaxed font-medium">
                                  {action.concreteAction}
                                </p>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* 6. Card Footer: Leadership Governance */}
                        <div className="flex flex-wrap items-center justify-between gap-3 pt-3.5 border-t border-slate-800/80 text-xs sm:text-sm text-slate-300">
                          <div className="flex items-center gap-2">
                            <span className="text-slate-400 font-medium">Accountable Leadership:</span>
                            <span className="font-semibold text-white">
                              {action.responsibleRole}
                            </span>
                          </div>
                          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-slate-950 border border-slate-800 text-slate-200 capitalize flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                            <span>Status: {action.status.replace('_', ' ')}</span>
                          </span>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>

            {/* Right Column (xl:col-span-5): Cross-Department Risk Radar */}
            <div className="xl:col-span-5 space-y-4">
              <div className="p-5 sm:p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <ShieldAlert className="w-5 h-5 text-amber-400" />
                    <h3 className="text-lg sm:text-xl font-bold text-white font-display">
                      Cross-Department Risk Radar
                    </h3>
                  </div>
                  <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-amber-950/60 border border-amber-800/80 text-amber-300 font-mono">
                    {analysis.crossDepartmentRisks.length} Detected
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                  Active friction points across department seams threatening margins, delivery SLAs, and customer retention.
                </p>

                <div className="space-y-4 pt-1">
                  {analysis.crossDepartmentRisks.map((risk) => (
                    <div
                      key={risk.id}
                      className="p-4 sm:p-5 rounded-xl bg-slate-950/85 border border-slate-800/90 space-y-3 hover:border-slate-700 transition-colors shadow-md"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className={`text-xs px-2.5 py-0.5 rounded-md font-bold uppercase tracking-wider border ${
                              risk.severity === 'Critical'
                                ? 'bg-rose-950/80 text-rose-300 border-rose-800/80'
                                : 'bg-amber-950/80 text-amber-300 border-amber-800/80'
                            }`}>
                              {risk.severity} Risk
                            </span>
                          </div>
                          <h4 className="text-sm sm:text-base font-bold text-white pt-1">
                            {risk.title}
                          </h4>
                        </div>
                        <span className="text-xs font-mono font-bold text-rose-300 bg-rose-950/80 border border-rose-800/80 px-2.5 py-1 rounded-lg shrink-0">
                          {risk.metricImpact}
                        </span>
                      </div>

                      <p className="text-sm text-slate-200 leading-relaxed font-normal">
                        {risk.evidence}
                      </p>

                      <div className="p-3.5 rounded-xl bg-slate-900/95 border border-slate-800 space-y-1.5">
                        <div className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                          <Zap className="w-3.5 h-3.5 text-amber-400" />
                          <span>Recommended Executive Intervention:</span>
                        </div>
                        <p className="text-sm text-slate-100 leading-relaxed font-medium">
                          {risk.recommendedIntervention}
                        </p>
                      </div>

                      <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-800/80 text-slate-300">
                        <span className="font-medium">Departments Involved:</span>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {risk.departments.map((dept, i) => (
                            <React.Fragment key={dept}>
                              <span className={`px-2 py-0.5 rounded-md border text-xs font-bold capitalize ${getDepartmentColor(dept)}`}>
                                {dept}
                              </span>
                              {i < risk.departments.length - 1 && (
                                <span className="text-slate-400 font-bold">↔</span>
                              )}
                            </React.Fragment>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PANE 2: PROFIT & LEAKAGE WATERFALL */}
      {activeSubTab === 'waterfall' && (
        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2.5">
                <BarChart3 className="w-5 h-5 text-blue-400" />
                <h3 className="text-base sm:text-lg font-black text-slate-100 font-display">
                  Cross-Department Profit & Margin Leakage Waterfall
                </h3>
              </div>
              <p className="text-xs sm:text-sm text-slate-300">
                Mathematical accounting of cash progression from billed Sales down to true Net Contribution Margin.
              </p>
            </div>

            <div className="flex items-center gap-2.5 shrink-0">
              <span className="text-xs font-semibold text-slate-300">True Contribution Margin:</span>
              <span className={`text-sm sm:text-base font-bold font-mono px-3.5 py-1.5 rounded-xl border ${
                netStep.amount >= 0
                  ? 'text-emerald-300 bg-emerald-950/80 border-emerald-700/80'
                  : 'text-red-300 bg-red-950/80 border-red-700/80'
              }`}>
                {formatCurrency(netStep.amount)} ({netStep.percentageOfGross}%)
              </span>
            </div>
          </div>

          {/* Waterfall Steps Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-3.5">
            {analysis.leakageWaterfall.map((step, idx) => {
              const isRev = step.type === 'revenue';
              const isNet = step.type === 'net';
              const isReduction = step.type === 'reduction';

              return (
                <div
                  key={idx}
                  className={`p-4 rounded-xl border space-y-3 flex flex-col justify-between shadow-sm ${
                    isRev
                      ? 'bg-blue-950/30 border-blue-800/80'
                      : isNet
                      ? 'bg-emerald-950/40 border-emerald-600/80 shadow-lg shadow-emerald-950/30 ring-1 ring-emerald-500/30'
                      : 'bg-slate-950/70 border-slate-800/90'
                  }`}
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-1">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-md border capitalize ${getDepartmentColor(step.department)}`}>
                        {step.department}
                      </span>
                      <span className="text-xs text-slate-400 font-mono font-medium">
                        {step.percentageOfGross}%
                      </span>
                    </div>

                    <div className="text-xs sm:text-sm font-bold text-slate-100 line-clamp-2 pt-0.5" title={step.label}>
                      {step.label}
                    </div>
                  </div>

                  <div className="space-y-1.5 pt-2 border-t border-slate-800/60">
                    <div className={`text-base sm:text-lg font-black font-mono tracking-tight ${
                      isRev
                        ? 'text-blue-300'
                        : isNet
                        ? 'text-emerald-300'
                        : 'text-rose-300'
                    }`}>
                      {isReduction ? `-${formatCurrency(step.amount)}` : formatCurrency(step.amount)}
                    </div>
                    <div className="text-xs text-slate-300 line-clamp-2 leading-relaxed font-normal">
                      {step.description}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Waterfall Visual Progress Bar */}
          <div className="space-y-2.5 pt-2">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-300">Revenue Drain Proportions (% of Top-Line):</div>
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
            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-300 pt-1 font-medium">
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
            <div className="space-y-1">
              <div className="flex items-center gap-2.5">
                <PieChart className="w-5 h-5 text-purple-400" />
                <h3 className="text-base sm:text-lg font-black text-slate-100 font-display">
                  Channel Marketing Efficiency Ratio (MER) & Closed-Loop Attribution
                </h3>
              </div>
              <p className="text-xs sm:text-sm text-slate-300">
                Correlating upfront ad spend with downstream Sales closed revenue and blended CAC.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-800">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-slate-950 text-slate-300 border-b border-slate-800 font-mono text-xs uppercase tracking-wider font-bold">
                <tr>
                  <th className="py-3.5 px-4">Channel</th>
                  <th className="py-3.5 px-4 text-right">Ad Spend</th>
                  <th className="py-3.5 px-4 text-right">Leads</th>
                  <th className="py-3.5 px-4 text-right">Closed Orders</th>
                  <th className="py-3.5 px-4 text-right">Attributed Revenue</th>
                  <th className="py-3.5 px-4 text-right">MER (Return)</th>
                  <th className="py-3.5 px-4 text-right">Blended CAC</th>
                  <th className="py-3.5 px-4">AI Optimization Verdict</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-slate-200">
                {analysis.marketingEfficiencyMatrix?.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3.5 px-4 font-bold text-slate-100">{row.channel}</td>
                    <td className="py-3.5 px-4 text-right font-mono font-medium">${row.spend.toLocaleString()}</td>
                    <td className="py-3.5 px-4 text-right font-mono font-medium">{row.leads.toLocaleString()}</td>
                    <td className="py-3.5 px-4 text-right font-mono font-bold text-blue-300">{row.closedDeals}</td>
                    <td className="py-3.5 px-4 text-right font-mono font-bold">${row.revenue.toLocaleString()}</td>
                    <td className="py-3.5 px-4 text-right font-mono font-black text-purple-300">{row.mer}x</td>
                    <td className="py-3.5 px-4 text-right font-mono text-slate-300 font-medium">${row.cac}</td>
                    <td className="py-3.5 px-4">
                      <span className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${
                        row.mer >= 5.0
                          ? 'text-emerald-300 bg-emerald-950/80 border-emerald-700/80'
                          : row.mer >= 3.0
                          ? 'text-blue-300 bg-blue-950/80 border-blue-700/80'
                          : 'text-red-300 bg-red-950/80 border-red-700/80'
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
            <div className="space-y-1">
              <div className="flex items-center gap-2.5">
                <Boxes className="w-5 h-5 text-red-400" />
                <h3 className="text-base sm:text-lg font-black text-slate-100 font-display">
                  Unprofitable SKUs & Segment Margin Erosion
                </h3>
              </div>
              <p className="text-xs sm:text-sm text-slate-300">
                Products and categories where high returns, freight surcharges, or excessive discounting destroy profit margins.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-800">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-slate-950 text-slate-300 border-b border-slate-800 font-mono text-xs uppercase tracking-wider font-bold">
                <tr>
                  <th className="py-3.5 px-4">Product / SKU</th>
                  <th className="py-3.5 px-4">Category</th>
                  <th className="py-3.5 px-4 text-right">Gross Sales</th>
                  <th className="py-3.5 px-4 text-right">Fulfillment & Returns</th>
                  <th className="py-3.5 px-4 text-right">Net Margin %</th>
                  <th className="py-3.5 px-4 text-right">Return Rate</th>
                  <th className="py-3.5 px-4">Profitability Verdict</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-slate-200">
                {analysis.unprofitableSegmentsOrSkus?.map((sku, idx) => (
                  <tr key={idx} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3.5 px-4 font-bold text-slate-100">{sku.name}</td>
                    <td className="py-3.5 px-4 text-slate-300 font-medium">{sku.category}</td>
                    <td className="py-3.5 px-4 text-right font-mono font-medium">${sku.grossSales.toLocaleString()}</td>
                    <td className="py-3.5 px-4 text-right font-mono font-semibold text-rose-300">-${sku.fulfillmentAndReturnCosts.toLocaleString()}</td>
                    <td className={`py-3.5 px-4 text-right font-mono font-bold ${
                      sku.netMarginPct < 0 ? 'text-rose-400' : 'text-emerald-400'
                    }`}>
                      {sku.netMarginPct.toFixed(1)}%
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-bold text-amber-400">{sku.returnRate}%</td>
                    <td className="py-3.5 px-4">
                      <span className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${
                        sku.netMarginPct < 0
                          ? 'text-rose-300 bg-rose-950/80 border-rose-800/80'
                          : 'text-amber-300 bg-amber-950/80 border-amber-800/80'
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
            <div className="space-y-1">
              <div className="flex items-center gap-2.5">
                <Truck className="w-5 h-5 text-cyan-400" />
                <h3 className="text-base sm:text-lg font-black text-slate-100 font-display">
                  Carrier Performance, SLA Breaches & Reverse Logistics
                </h3>
              </div>
              <p className="text-xs sm:text-sm text-slate-300">
                Linking logistics transit times and freight damage directly to customer refund rates.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-800">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-slate-950 text-slate-300 border-b border-slate-800 font-mono text-xs uppercase tracking-wider font-bold">
                <tr>
                  <th className="py-3.5 px-4">Carrier / Service</th>
                  <th className="py-3.5 px-4 text-right">Shipments</th>
                  <th className="py-3.5 px-4 text-right">SLA Breach %</th>
                  <th className="py-3.5 px-4 text-right">Return Rate %</th>
                  <th className="py-3.5 px-4 text-right">Avg Transit Days</th>
                  <th className="py-3.5 px-4">Status Verdict</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-slate-200">
                {analysis.fulfillmentSlaOverview?.map((c, idx) => (
                  <tr key={idx} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3.5 px-4 font-bold text-slate-100">{c.carrier}</td>
                    <td className="py-3.5 px-4 text-right font-mono font-medium">{c.shipmentCount}</td>
                    <td className={`py-3.5 px-4 text-right font-mono font-bold ${
                      c.slaBreachRate > 15 ? 'text-rose-400' : 'text-slate-300'
                    }`}>
                      {c.slaBreachRate.toFixed(1)}%
                    </td>
                    <td className={`py-3.5 px-4 text-right font-mono font-bold ${
                      c.returnRate > 15 ? 'text-rose-400' : 'text-slate-300'
                    }`}>
                      {c.returnRate.toFixed(1)}%
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-medium">{c.avgDeliveryDays.toFixed(1)} days</td>
                    <td className="py-3.5 px-4">
                      <span className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${
                        c.status === 'Healthy'
                          ? 'text-emerald-300 bg-emerald-950/80 border-emerald-800/80'
                          : c.status === 'Needs Attention'
                          ? 'text-amber-300 bg-amber-950/80 border-amber-800/80'
                          : 'text-rose-300 bg-rose-950/80 border-rose-800/80'
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
            <div className="space-y-1">
              <div className="flex items-center gap-2.5">
                <Link2 className="w-5 h-5 text-blue-400" />
                <h3 className="text-base sm:text-lg font-black text-slate-100 font-display">
                  Data Fabric & Relational Join Discovery
                </h3>
              </div>
              <p className="text-xs sm:text-sm text-slate-300">
                Discovered key overlaps bridging disparate tabular datasets across departments.
              </p>
            </div>
            <span className="text-xs font-bold px-3 py-1 rounded-full bg-blue-950/80 border border-blue-800/80 text-blue-300 font-mono">
              {analysis.relationships.length} Discovered Joins
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {analysis.relationships.map((rel, idx) => (
              <div
                key={idx}
                className="p-5 rounded-xl bg-slate-950/80 border border-slate-800/90 space-y-3 hover:border-slate-700/80 transition-colors shadow-md"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-bold px-2.5 py-0.5 rounded-md border capitalize ${getDepartmentColor(rel.sourceDepartment)}`}>
                      {rel.sourceDepartment}
                    </span>
                    <ArrowRight className="w-4 h-4 text-slate-500" />
                    <span className={`text-xs font-bold px-2.5 py-0.5 rounded-md border capitalize ${getDepartmentColor(rel.targetDepartment)}`}>
                      {rel.targetDepartment}
                    </span>
                  </div>
                  <span className={`text-xs font-bold font-mono px-2.5 py-1 rounded-lg border ${
                    rel.joinStatus === 'healthy'
                      ? 'text-emerald-300 bg-emerald-950/80 border-emerald-700/80'
                      : 'text-amber-300 bg-amber-950/80 border-amber-700/80'
                  }`}>
                    {rel.matchPercentage}% overlap
                  </span>
                </div>

                <div className="text-xs sm:text-sm text-slate-200 flex items-center justify-between font-mono bg-slate-900 p-3 rounded-xl border border-slate-800/80">
                  <span className="truncate max-w-[140px] text-blue-300 font-semibold">
                    {rel.sourceDatasetName}.{rel.sourceKey}
                  </span>
                  <span className="text-slate-400 font-sans text-xs font-bold uppercase tracking-wider">
                    {rel.matchType}
                  </span>
                  <span className="truncate max-w-[140px] text-blue-300 font-semibold text-right">
                    {rel.targetDatasetName}.{rel.targetKey}
                  </span>
                </div>

                <div className="text-xs text-slate-300 flex items-center justify-between pt-1">
                  <span>Join Integrity: <strong className="text-slate-100 capitalize">{rel.joinStatus.replace('_', ' ')}</strong></span>
                  <span className="font-mono text-slate-400">Cardinality: {rel.matchType}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
