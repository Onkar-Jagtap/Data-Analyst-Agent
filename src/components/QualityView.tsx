import React, { useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Download,
  ExternalLink,
  Eye,
  FileCode,
  FileText,
  HelpCircle,
  ListChecks,
  Lock,
  Play,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Trash2,
  Wand2,
  XCircle,
} from 'lucide-react';
import { ActiveTab, AssertionEvaluationResult, BusinessAssertion, DataQualityAudit, DatasetProfile, QualityIssue } from '../types.js';
import { evaluateBusinessAssertions, fetchDataDictionary } from '../api.js';

interface QualityViewProps {
  audit: DataQualityAudit;
  profile?: DatasetProfile;
  onNavigateTab: (tab: ActiveTab) => void;
  onSelectCleaningAction?: (action: string, column?: string) => void;
  onInspectOutliers?: (column: string) => void;
}

export const QualityView: React.FC<QualityViewProps> = ({
  audit,
  profile,
  onNavigateTab,
  onSelectCleaningAction,
  onInspectOutliers,
}) => {
  const [severityFilter, setSeverityFilter] = useState<string>('all');

  // Business Assertions State
  const [assertions, setAssertions] = useState<BusinessAssertion[]>([
    {
      id: 'rule-1',
      name: 'Non-Negative Primary Metric',
      column: profile?.columns.find(c => c.type === 'numeric')?.name || '',
      ruleType: 'positive',
      description: 'Values in primary numeric column must be strictly greater than 0.',
    },
    {
      id: 'rule-2',
      name: 'Mandatory Non-Null Identity',
      column: profile?.columns.find(c => c.isIdentifier || c.uniquePercentage > 90)?.name || profile?.columns[0]?.name || '',
      ruleType: 'not_null',
      description: 'Identity / Key columns must not contain missing or null values.',
    },
  ]);

  const [assertionResults, setAssertionResults] = useState<AssertionEvaluationResult[] | null>(null);
  const [runningAssertions, setRunningAssertions] = useState<boolean>(false);

  // New Assertion Form State
  const [newRuleName, setNewRuleName] = useState<string>('');
  const [newRuleCol, setNewRuleCol] = useState<string>(profile?.columns[0]?.name || '');
  const [newRuleType, setNewRuleType] = useState<BusinessAssertion['ruleType']>('positive');
  const [newRuleMin, setNewRuleMin] = useState<string>('0');
  const [newRuleMax, setNewRuleMax] = useState<string>('100');
  const [newRuleCol2, setNewRuleCol2] = useState<string>(profile?.columns[1]?.name || '');
  const [newRuleOp, setNewRuleOp] = useState<'>=' | '<=' | '==' | '!='>('>=');
  const [showAddAssertion, setShowAddAssertion] = useState<boolean>(false);

  // Data Dictionary State
  const [exportingDictionary, setExportingDictionary] = useState<boolean>(false);
  const [showDictionaryTable, setShowDictionaryTable] = useState<boolean>(false);

  const handleAddAssertion = () => {
    if (!newRuleName.trim() || !newRuleCol) return;
    const newRule: BusinessAssertion = {
      id: `rule-${Date.now()}`,
      name: newRuleName.trim(),
      column: newRuleCol,
      ruleType: newRuleType,
      minValue: newRuleType === 'range' ? parseFloat(newRuleMin) : undefined,
      maxValue: newRuleType === 'range' ? parseFloat(newRuleMax) : undefined,
      secondColumn: newRuleType === 'column_comparison' ? newRuleCol2 : undefined,
      operator: newRuleType === 'column_comparison' ? newRuleOp : undefined,
    };
    setAssertions(prev => [...prev, newRule]);
    setNewRuleName('');
    setShowAddAssertion(false);
  };

  const handleRunAssertions = async () => {
    if (!profile) return;
    setRunningAssertions(true);
    try {
      const res = await evaluateBusinessAssertions(profile.id, assertions);
      setAssertionResults(res);
    } catch (err) {
      console.error('Assertion evaluation failed:', err);
    } finally {
      setRunningAssertions(false);
    }
  };

  const handleExportDataDictionary = async () => {
    if (!profile) return;
    setExportingDictionary(true);
    try {
      const data = await fetchDataDictionary(profile.id);
      const blob = new Blob([data.markdown], { type: 'text/markdown;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${profile.filename.replace(/\.[^/.]+$/, '')}_DATA_DICTIONARY.md`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to export data dictionary:', err);
    } finally {
      setExportingDictionary(false);
    }
  };

  const filteredIssues = audit.issues.filter(issue => {
    if (severityFilter === 'all') return true;
    return issue.severity === severityFilter;
  });

  const getRatingBadge = (rating: string) => {
    switch (rating) {
      case 'Excellent':
        return 'bg-emerald-950/60 text-emerald-400 border-emerald-800/40';
      case 'Good':
        return 'bg-blue-950/60 text-blue-400 border-blue-800/40';
      case 'Fair':
        return 'bg-amber-950/60 text-amber-400 border-amber-800/40';
      default:
        return 'bg-red-950/60 text-red-400 border-red-800/40';
    }
  };

  const handleFixIssue = (issue: QualityIssue) => {
    let action = 'exclude_nulls';
    if (issue.type === 'duplicate') action = 'remove_duplicates';
    else if (issue.type === 'outlier') action = 'trim_outliers';
    else if (issue.type === 'type_mismatch') action = 'coerce_numeric';
    else if (issue.type === 'missing') action = 'impute_mean';
    else if (issue.type === 'pii_risk') action = 'mask_pii';

    if (onSelectCleaningAction) {
      onSelectCleaningAction(action, issue.column);
    }
    onNavigateTab('cleaner');
  };

  const handleMaskAllPii = () => {
    if (onSelectCleaningAction) {
      onSelectCleaningAction('mask_pii');
    }
    onNavigateTab('cleaner');
  };

  const compliance = audit.complianceAudit;

  return (
    <div className="space-y-6 pb-12">
      {/* Header Banner with Explainable Score */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900/95 to-indigo-950/40 border border-slate-800 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-blue-400 font-mono flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" /> PJA Reliability Engine
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-100 tracking-tight font-display">
              Data Quality Audit & Compliance Shield
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-2xl leading-relaxed">
              Deterministic verification assessing completeness, distribution anomalies (Tukey IQR), and GDPR/CCPA privacy leak vulnerabilities.
            </p>
          </div>

          {/* Large Quality Score Box */}
          <div className="flex items-center gap-4 p-4 rounded-xl bg-slate-950/80 border border-slate-800 shrink-0 shadow-inner">
            <div className="text-center">
              <div className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider">
                Audited Score
              </div>
              <div className="text-3xl font-extrabold font-mono text-slate-100 mt-0.5">
                {audit.score}
                <span className="text-sm font-normal text-slate-500"> /100</span>
              </div>
              <span
                className={`inline-block mt-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-md border ${getRatingBadge(
                  audit.rating
                )}`}
              >
                {audit.rating} Health
              </span>
            </div>

            <div className="h-12 w-px bg-slate-800 hidden sm:block" />

            {/* Penalties breakdown */}
            <div className="text-[11px] text-slate-400 space-y-0.5 font-mono hidden sm:block">
              <div>Base score: 100</div>
              {audit.scoreBreakdown.missingPenalty > 0 && (
                <div className="text-amber-400">Missing penalty: -{audit.scoreBreakdown.missingPenalty}</div>
              )}
              {audit.scoreBreakdown.duplicatePenalty > 0 && (
                <div className="text-amber-400">Duplicate penalty: -{audit.scoreBreakdown.duplicatePenalty}</div>
              )}
              {audit.scoreBreakdown.typeIssuePenalty > 0 && (
                <div className="text-red-400">Type penalty: -{audit.scoreBreakdown.typeIssuePenalty}</div>
              )}
              {audit.scoreBreakdown.outlierPenalty > 0 && (
                <div className="text-amber-400">Outlier penalty: -{audit.scoreBreakdown.outlierPenalty}</div>
              )}
              {audit.scoreBreakdown.piiPenalty ? (
                <div className="text-rose-400">PII risk penalty: -{audit.scoreBreakdown.piiPenalty}</div>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {/* Privacy & Compliance Shield Banner */}
      {compliance && (
        <div className="p-5 rounded-2xl bg-gradient-to-r from-blue-950/30 via-slate-900 to-slate-900/90 border border-blue-900/40 shadow-md">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-slate-100 font-display">
                    Privacy & Compliance Shield (GDPR, CCPA & HIPAA)
                  </h3>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                      compliance.status === 'compliant'
                        ? 'bg-emerald-950/60 text-emerald-400 border-emerald-800/40'
                        : 'bg-amber-950/60 text-amber-300 border-amber-800/40'
                    }`}
                  >
                    {compliance.status === 'compliant' ? 'Safe / Compliant' : 'Action Recommended'}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-1 max-w-3xl">
                  {compliance.totalPiiCount === 0 ? (
                    'No sensitive personal identifiers (PII) detected. Dataset is safe for exploratory analysis and visualization.'
                  ) : (
                    <span>
                      Detected <strong className="text-amber-300 font-mono">{compliance.totalPiiCount} PII fields</strong> in columns [{compliance.flaggedColumns.join(', ')}]. Use automated masking to safeguard identity before sharing.
                    </span>
                  )}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <div className="text-right hidden sm:block">
                <div className="text-[10px] uppercase font-semibold text-slate-400">Privacy Rating</div>
                <div className="text-base font-bold font-mono text-blue-300">
                  {compliance.complianceScore}/100
                </div>
              </div>
              {compliance.totalPiiCount > 0 && (
                <button
                  onClick={handleMaskAllPii}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md shadow-blue-500/20 transition-colors"
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>Redact & Anonymize PII</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80">
          <div className="text-[11px] font-medium text-slate-400">Clean Columns</div>
          <div className="text-lg font-bold font-mono text-emerald-400 mt-1">
            {audit.metrics.healthyColumnCount} / {audit.metrics.totalColumns}
          </div>
          <div className="text-[10px] text-slate-500">Zero issues</div>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80">
          <div className="text-[11px] font-medium text-slate-400">Duplicate Rows</div>
          <div className="text-lg font-bold font-mono text-amber-400 mt-1">
            {audit.metrics.duplicateRows}
          </div>
          <div className="text-[10px] text-slate-500">{audit.metrics.duplicatePercentage}% of dataset</div>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80">
          <div className="text-[11px] font-medium text-slate-400">Missing Cells</div>
          <div className="text-lg font-bold font-mono text-amber-400 mt-1">
            {audit.metrics.totalMissingCells}
          </div>
          <div className="text-[10px] text-slate-500">{audit.metrics.missingCellsPercentage}% missing rate</div>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80">
          <div className="text-[11px] font-medium text-slate-400">Tukey Outliers</div>
          <div className="text-lg font-bold font-mono text-blue-400 mt-1">
            {audit.metrics.potentialOutliersTotal}
          </div>
          <div className="text-[10px] text-slate-500">IQR [Q1-1.5, Q3+1.5]</div>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80">
          <div className="text-[11px] font-medium text-slate-400">Type Mismatches</div>
          <div className="text-lg font-bold font-mono text-red-400 mt-1">
            {audit.metrics.typeInconsistentColumns}
          </div>
          <div className="text-[10px] text-slate-500">Columns affected</div>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80">
          <div className="text-[11px] font-medium text-slate-400">Value Anomalies</div>
          <div className="text-lg font-bold font-mono text-purple-400 mt-1">
            {audit.metrics.anomalyCount}
          </div>
          <div className="text-[10px] text-slate-500">Negative / Out-of-bounds</div>
        </div>
      </div>

      {/* Verification Checklist */}
      <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80">
        <h3 className="text-sm font-semibold text-slate-200 mb-3">Verification Checklist</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-2">
            {audit.checklist.passed.map((pass, i) => (
              <div key={i} className="flex items-start gap-2 text-xs text-emerald-300 bg-emerald-950/20 p-2.5 rounded-lg border border-emerald-900/30">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>{pass}</span>
              </div>
            ))}
          </div>
          <div className="space-y-2">
            {audit.checklist.warnings.map((warn, i) => (
              <div key={i} className="flex items-start gap-2 text-xs text-amber-300 bg-amber-950/20 p-2.5 rounded-lg border border-amber-900/30">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <span>{warn}</span>
              </div>
            ))}
            {audit.checklist.critical.map((crit, i) => (
              <div key={i} className="flex items-start gap-2 text-xs text-red-300 bg-red-950/20 p-2.5 rounded-lg border border-red-900/30">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <span>{crit}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Quality Issues Table */}
      <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-200">
              Detailed Quality Issues & Audit Findings
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Row-level transparency with 1-click drilldown and non-destructive transformations.
            </p>
          </div>

          <div className="flex items-center gap-1.5">
            {['all', 'critical', 'warning', 'info'].map(sev => (
              <button
                key={sev}
                onClick={() => setSeverityFilter(sev)}
                className={`px-3 py-1 rounded-lg text-xs font-medium capitalize transition-colors ${
                  severityFilter === sev
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
                }`}
              >
                {sev}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 text-[11px] font-semibold uppercase tracking-wider">
                <th className="py-2.5 px-3">Severity</th>
                <th className="py-2.5 px-3">Issue Category</th>
                <th className="py-2.5 px-3">Target Column</th>
                <th className="py-2.5 px-3">Affected Rows</th>
                <th className="py-2.5 px-3">Audit Details</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredIssues.map((issue, idx) => {
                const isOutlier = issue.type === 'outlier';
                return (
                  <tr key={idx} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-3 px-3">
                      <span
                        className={`text-[10px] uppercase font-mono px-2 py-0.5 rounded border ${
                          issue.severity === 'critical'
                            ? 'bg-red-950/60 text-red-400 border-red-800/40'
                            : issue.severity === 'warning'
                            ? 'bg-amber-950/60 text-amber-400 border-amber-800/40'
                            : 'bg-blue-950/60 text-blue-400 border-blue-800/40'
                        }`}
                      >
                        {issue.severity}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-medium text-slate-200 capitalize">
                      {issue.type.replace('_', ' ')}
                    </td>
                    <td className="py-3 px-3 font-mono text-blue-400">
                      {issue.column || 'Whole Dataset'}
                    </td>
                    <td className="py-3 px-3 font-mono text-slate-300">
                      {issue.affectedCount.toLocaleString()} ({issue.percentage}%)
                    </td>
                    <td className="py-3 px-3 text-slate-400 max-w-xs">
                      <div className="text-slate-200 font-medium">{issue.title}</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">{issue.description}</div>
                    </td>
                    <td className="py-3 px-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {isOutlier && onInspectOutliers && issue.column && (
                          <button
                            onClick={() => onInspectOutliers(issue.column!)}
                            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 text-[11px] font-medium border border-amber-500/30 transition-colors whitespace-nowrap"
                            title="Open statistical outlier drill-down drawer"
                          >
                            <Eye className="w-3 h-3" />
                            <span>Drill Down</span>
                          </button>
                        )}
                        <button
                          onClick={() => handleFixIssue(issue)}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-medium border border-slate-700 transition-colors whitespace-nowrap"
                        >
                          <Wand2 className="w-3 h-3 text-blue-400" />
                          <span>Remediate</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredIssues.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2 opacity-80" />
                    <div className="text-sm font-semibold text-slate-200">No {severityFilter !== 'all' ? severityFilter : ''} issues detected</div>
                    <div className="text-xs text-slate-500 mt-1">All dataset records satisfy this quality audit category.</div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Business Logic Assertions Section */}
      <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800/80 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <ListChecks className="w-4 h-4 text-emerald-400" />
              <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400 font-mono">
                Domain Rule Engine
              </span>
            </div>
            <h3 className="text-base font-bold text-slate-100">
              Business Logic Assertions & Invariants
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Define domain rules (e.g., Revenue &gt; 0, Margin &le; 100%, Primary Keys unique) and verify adherence across all rows.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAddAssertion(!showAddAssertion)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-950 hover:bg-slate-850 border border-slate-700 text-xs font-semibold text-slate-300 transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{showAddAssertion ? 'Cancel' : 'Add Assertion'}</span>
            </button>

            <button
              onClick={handleRunAssertions}
              disabled={runningAssertions || !profile}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 text-xs font-bold text-white transition-all shadow-md shadow-emerald-600/20"
            >
              {runningAssertions ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Play className="w-3.5 h-3.5" />
              )}
              <span>Run Assertion Check</span>
            </button>
          </div>
        </div>

        {/* Add Assertion Panel */}
        {showAddAssertion && (
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3 animate-in fade-in duration-200">
            <div className="text-xs font-bold text-slate-200">Create New Business Assertion</div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-[11px] font-semibold text-slate-400 block mb-1">Rule Name</label>
                <input
                  type="text"
                  placeholder="e.g. Valid Discount Range"
                  value={newRuleName}
                  onChange={e => setNewRuleName(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-400 block mb-1">Target Column</label>
                <select
                  value={newRuleCol}
                  onChange={e => setNewRuleCol(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200"
                >
                  {profile?.columns.map(c => (
                    <option key={c.name} value={c.name}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-400 block mb-1">Rule Constraint</label>
                <select
                  value={newRuleType}
                  onChange={e => setNewRuleType(e.target.value as any)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200"
                >
                  <option value="positive">Must be &gt; 0 (Positive)</option>
                  <option value="non_null">Must not be Null (Required)</option>
                  <option value="unique">Must be Unique (Key)</option>
                  <option value="range">Range (Min to Max)</option>
                  <option value="column_comparison">Compare with Column</option>
                </select>
              </div>
            </div>

            {newRuleType === 'range' && (
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="text-[11px] font-semibold text-slate-400 block mb-1">Minimum Value</label>
                  <input
                    type="number"
                    value={newRuleMin}
                    onChange={e => setNewRuleMin(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-400 block mb-1">Maximum Value</label>
                  <input
                    type="number"
                    value={newRuleMax}
                    onChange={e => setNewRuleMax(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200"
                  />
                </div>
              </div>
            )}

            {newRuleType === 'column_comparison' && (
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="text-[11px] font-semibold text-slate-400 block mb-1">Operator</label>
                  <select
                    value={newRuleOp}
                    onChange={e => setNewRuleOp(e.target.value as any)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200"
                  >
                    <option value=">=">&gt;=</option>
                    <option value="<=">&le;=</option>
                    <option value="==">==</option>
                    <option value="!=">!=</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-400 block mb-1">Second Column</label>
                  <select
                    value={newRuleCol2}
                    onChange={e => setNewRuleCol2(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200"
                  >
                    {profile?.columns.map(c => (
                      <option key={c.name} value={c.name}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            <button
              onClick={handleAddAssertion}
              className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white transition-colors"
            >
              Save Rule
            </button>
          </div>
        )}

        {/* Assertions List */}
        <div className="space-y-2">
          {assertions.map(rule => {
            const result = assertionResults?.find(r => r.ruleId === rule.id);
            return (
              <div
                key={rule.id}
                className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="flex items-center gap-2.5">
                  {result ? (
                    result.status === 'passed' ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    ) : (
                      <XCircle className="w-4 h-4 text-red-400 shrink-0" />
                    )
                  ) : (
                    <div className="w-4 h-4 rounded-full border border-slate-700 shrink-0" />
                  )}
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-slate-200">{rule.name}</span>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-400">
                        {rule.column} &bull; {rule.ruleType}
                      </span>
                    </div>
                    {rule.description && (
                      <div className="text-[11px] text-slate-500 mt-0.5">{rule.description}</div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {result && (
                    <div className="text-right">
                      {result.status === 'passed' ? (
                        <span className="text-[11px] font-semibold text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-900/50">
                          100% Passed ({result.passedCount.toLocaleString()}/{result.totalEvaluated.toLocaleString()})
                        </span>
                      ) : (
                        <span className="text-[11px] font-semibold text-red-400 bg-red-950/40 px-2 py-0.5 rounded border border-red-900/50">
                          {result.failedCount.toLocaleString()} Violations ({(100 - result.passRate).toFixed(1)}%)
                        </span>
                      )}
                    </div>
                  )}

                  <button
                    onClick={() => setAssertions(prev => prev.filter(a => a.id !== rule.id))}
                    className="p-1 rounded hover:bg-slate-900 text-slate-600 hover:text-red-400 transition-colors"
                    title="Remove rule"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Data Dictionary & Documentation Section */}
      <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800/80 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <BookOpen className="w-4 h-4 text-blue-400" />
              <span className="text-xs font-semibold uppercase tracking-wider text-blue-400 font-mono">
                Data Catalog & Dictionary
              </span>
            </div>
            <h3 className="text-base font-bold text-slate-100">
              Autonomous Data Dictionary & Schema Documentation
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Comprehensive field-level schema reference documenting semantic roles, missing rates, and value distributions.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowDictionaryTable(!showDictionaryTable)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-950 hover:bg-slate-850 border border-slate-700 text-xs font-semibold text-slate-300 transition-all"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>{showDictionaryTable ? 'Hide Catalog' : 'View Catalog'}</span>
            </button>

            <button
              onClick={handleExportDataDictionary}
              disabled={exportingDictionary || !profile}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 text-xs font-bold text-white transition-all shadow-md shadow-blue-600/20"
            >
              {exportingDictionary ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Download className="w-3.5 h-3.5" />
              )}
              <span>Export DATA_DICTIONARY.md</span>
            </button>
          </div>
        </div>

        {showDictionaryTable && profile && (
          <div className="overflow-x-auto rounded-xl border border-slate-800 animate-in fade-in duration-200">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-950 border-b border-slate-800 text-slate-400 text-[11px] font-semibold uppercase tracking-wider">
                  <th className="py-2.5 px-3">Field Name</th>
                  <th className="py-2.5 px-3">Semantic Role</th>
                  <th className="py-2.5 px-3">Data Type</th>
                  <th className="py-2.5 px-3">Missing Rate</th>
                  <th className="py-2.5 px-3">Distinct Values</th>
                  <th className="py-2.5 px-3">Range / Samples</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 bg-slate-950/40">
                {profile.columns.map(c => {
                  let role = 'Dimension';
                  if (c.isIdentifier) role = 'Primary Key';
                  else if (c.type === 'numeric') role = 'Measure / Metric';
                  else if (c.type === 'datetime') role = 'Temporal Axis';

                  return (
                    <tr key={c.name} className="hover:bg-slate-850/40">
                      <td className="py-2.5 px-3 font-mono font-semibold text-blue-300">
                        {c.name}
                      </td>
                      <td className="py-2.5 px-3 text-slate-300">
                        <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-[10px] font-semibold">
                          {role}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-mono text-slate-400 capitalize">
                        {c.type}
                      </td>
                      <td className="py-2.5 px-3 text-slate-300">
                        {c.nullPercentage > 0 ? (
                          <span className="text-amber-400 font-semibold">{c.nullPercentage}%</span>
                        ) : (
                          <span className="text-emerald-400">0% (Complete)</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-slate-300">
                        {c.uniqueCount.toLocaleString()} ({c.uniquePercentage}%)
                      </td>
                      <td className="py-2.5 px-3 font-mono text-[11px] text-slate-400 max-w-xs truncate">
                        {c.type === 'numeric'
                          ? `[${c.min?.toLocaleString()} to ${c.max?.toLocaleString()}]`
                          : c.sampleValues.slice(0, 3).map(v => String(v)).join(', ')}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
