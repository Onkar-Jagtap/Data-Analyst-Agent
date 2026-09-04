import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Copy,
  Download,
  Filter,
  Lock,
  RefreshCw,
  RotateCcw,
  Save,
  ShieldAlert,
  ShieldCheck,
  Undo2,
  Wand2,
} from 'lucide-react';
import { DatasetProfile } from '../types.js';
import { checkCanUndo, executeCleanAction, undoCleaningAction } from '../api.js';

interface CleaningAssistantViewProps {
  profile: DatasetProfile;
  initialAction?: string;
  initialColumn?: string;
  onDatasetUpdated: (newProfileId: string) => void;
}

export const CleaningAssistantView: React.FC<CleaningAssistantViewProps> = ({
  profile,
  initialAction = 'remove_duplicates',
  initialColumn,
  onDatasetUpdated,
}) => {
  const [selectedAction, setSelectedAction] = useState<string>(initialAction);
  const [targetCol, setTargetCol] = useState<string>(
    initialColumn || profile.columns[0]?.name || ''
  );
  const [constantVal, setConstantVal] = useState<string>('0');
  const [previewResult, setPreviewResult] = useState<any | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [undoing, setUndoing] = useState<boolean>(false);
  const [canUndo, setCanUndo] = useState<boolean>(false);
  const [saveAsNew, setSaveAsNew] = useState<boolean>(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    checkCanUndo(profile.id).then(setCanUndo);
  }, [profile.id]);

  const cleanActions = [
    {
      id: 'remove_duplicates',
      label: 'Deduplicate Records',
      desc: 'Remove exact duplicate rows across all columns',
      needsCol: false,
    },
    {
      id: 'mask_pii',
      label: 'Mask & Redact Personal Data (PII)',
      desc: 'Anonymize email, phone, SSN, card, IP and name columns with GDPR-compliant masking',
      needsCol: false,
    },
    {
      id: 'exclude_nulls',
      label: 'Exclude Missing Rows',
      desc: 'Drop rows where target column contains missing / null values',
      needsCol: true,
    },
    {
      id: 'impute_mean',
      label: 'Impute with Mean',
      desc: 'Replace missing numeric values with column average',
      needsCol: true,
      numericOnly: true,
    },
    {
      id: 'impute_median',
      label: 'Impute with Median',
      desc: 'Replace missing numeric values with column median',
      needsCol: true,
      numericOnly: true,
    },
    {
      id: 'impute_mode',
      label: 'Impute with Mode',
      desc: 'Replace missing values with most frequent category',
      needsCol: true,
    },
    {
      id: 'coerce_numeric',
      label: 'Coerce Numeric Strings',
      desc: 'Strip currency symbols/formatting and parse clean numbers',
      needsCol: true,
      numericOnly: true,
    },
    {
      id: 'trim_outliers',
      label: 'Trim Tukey Outliers',
      desc: 'Exclude extreme values outside [Q1 - 1.5×IQR, Q3 + 1.5×IQR]',
      needsCol: true,
      numericOnly: true,
    },
  ];

  const handlePreview = async () => {
    setLoading(true);
    setSuccessMessage(null);
    try {
      const res = await executeCleanAction(profile.id, {
        action: selectedAction,
        column: targetCol,
        constantValue: constantVal,
        saveAsNew: false,
      });
      setPreviewResult(res);
    } catch (err: any) {
      alert(err.message || 'Cleaning preview failed');
    } finally {
      setLoading(false);
    }
  };

  const handleApplyTransformation = async () => {
    setSaving(true);
    try {
      const res = await executeCleanAction(profile.id, {
        action: selectedAction,
        column: targetCol,
        constantValue: constantVal,
        saveAsNew,
      });
      setSuccessMessage(
        saveAsNew
          ? `Transformed dataset branch created: cleaned_${profile.filename} (Original untouched).`
          : `Transformation applied successfully! Previous snapshot saved to undo history.`
      );
      setCanUndo(true);
      if (res.newDatasetId) {
        onDatasetUpdated(res.newDatasetId);
      }
      setPreviewResult(null);
    } catch (err: any) {
      alert(err.message || 'Failed to apply transformation');
    } finally {
      setSaving(false);
    }
  };

  const handleUndo = async () => {
    if (!confirm('Revert the dataset to its previous snapshot?')) return;
    setUndoing(true);
    try {
      const res = await undoCleaningAction(profile.id);
      setSuccessMessage('Successfully reverted dataset to previous snapshot!');
      setCanUndo(res.data?.canUndo ?? false);
      if (res.data?.datasetId) {
        onDatasetUpdated(res.data.datasetId);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to undo transformation');
    } finally {
      setUndoing(false);
    }
  };

  const currentActionMeta = cleanActions.find(a => a.id === selectedAction);

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Wand2 className="w-4 h-4 text-blue-400" />
            <span className="text-xs font-semibold uppercase tracking-wider text-blue-400 font-mono">
              Deterministic Data Hygiene
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-100 tracking-tight font-display">
            Data Cleaning & Privacy Assistant
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-2xl">
            Audit-backed non-destructive transformations with multi-tier rollback undo protection and PII redaction.
          </p>
        </div>

        {/* Undo button */}
        {canUndo && (
          <button
            onClick={handleUndo}
            disabled={undoing}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-semibold text-amber-300 transition-all shadow-sm"
            title="Rollback the last transformation on this dataset"
          >
            <Undo2 className={`w-4 h-4 ${undoing ? 'animate-spin' : ''}`} />
            <span>Undo Last Action</span>
          </button>
        )}
      </div>

      {/* Safety Notice Banner */}
      <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80 flex items-center justify-between text-xs">
        <div className="flex items-center gap-2 text-slate-300">
          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>
            Active target: <strong className="text-slate-100 font-mono">{profile.filename}</strong> ({profile.rowCount.toLocaleString()} rows, {profile.columnCount} columns)
          </span>
        </div>
        <div className="flex items-center gap-2">
          {canUndo && (
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-950/60 text-amber-300 border border-amber-800/40">
              Undo History Available
            </span>
          )}
          <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-blue-950/60 text-blue-400 border border-blue-800/40">
            Isolated Sandbox
          </span>
        </div>
      </div>

      {successMessage && (
        <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-800/60 text-xs text-emerald-300 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Main Grid: Selector on left, Preview on right */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Actions Selector Panel */}
        <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-4">
          <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider border-b border-slate-800 pb-2">
            Select Transformation
          </h3>

          <div className="space-y-1.5">
            {cleanActions.map(action => {
              const isPii = action.id === 'mask_pii';
              return (
                <button
                  key={action.id}
                  onClick={() => {
                    setSelectedAction(action.id);
                    setPreviewResult(null);
                  }}
                  className={`w-full text-left p-3 rounded-xl text-xs transition-all ${
                    selectedAction === action.id
                      ? 'bg-blue-600/15 border border-blue-500/40 text-blue-200'
                      : isPii
                      ? 'bg-blue-950/20 hover:bg-blue-950/40 border border-blue-900/50 text-slate-300'
                      : 'bg-slate-950/70 hover:bg-slate-950 border border-slate-800/70 text-slate-400'
                  }`}
                >
                  <div className="font-semibold text-slate-200 flex items-center justify-between">
                    <span>{action.label}</span>
                    {isPii && <Lock className="w-3.5 h-3.5 text-blue-400" />}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">{action.desc}</div>
                </button>
              );
            })}
          </div>

          {/* Column selector if needed */}
          {currentActionMeta?.needsCol && (
            <div>
              <label className="text-[11px] font-semibold text-slate-400 block mb-1">
                Target Column
              </label>
              <select
                value={targetCol}
                onChange={e => {
                  setTargetCol(e.target.value);
                  setPreviewResult(null);
                }}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
              >
                {profile.columns
                  .filter(c => !currentActionMeta.numericOnly || c.type === 'numeric')
                  .map(c => (
                    <option key={c.name} value={c.name}>
                      {c.name} ({c.type})
                    </option>
                  ))}
              </select>
            </div>
          )}

          <button
            onClick={handlePreview}
            disabled={loading}
            className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 text-xs font-bold text-white transition-colors flex items-center justify-center gap-2 shadow-sm shadow-blue-500/20"
          >
            {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
            <span>Preview Transformation Impact</span>
          </button>
        </div>

        {/* Impact & Preview Details Panel */}
        <div className="lg:col-span-2 space-y-4">
          <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800 min-h-[380px] flex flex-col justify-between shadow-xl">
            {previewResult ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="text-xs font-semibold text-slate-200">
                    Transformation Impact Summary
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-950/60 text-blue-400 border border-blue-800/40">
                    {previewResult.rowsAffected} rows affected
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-3 font-mono">
                  <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800">
                    <div className="text-[10px] text-slate-500">Rows Before</div>
                    <div className="text-base font-bold text-slate-200 mt-0.5">
                      {previewResult.beforeCount.toLocaleString()}
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800">
                    <div className="text-[10px] text-slate-500">Rows After</div>
                    <div className="text-base font-bold text-emerald-400 mt-0.5">
                      {previewResult.afterCount.toLocaleString()}
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800">
                    <div className="text-[10px] text-slate-500">Delta</div>
                    <div className="text-base font-bold text-amber-400 mt-0.5">
                      {previewResult.afterCount - previewResult.beforeCount}
                    </div>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-xs text-slate-300">
                  {previewResult.summary}
                </div>

                {/* Diff table preview */}
                {previewResult.previewDifferences && previewResult.previewDifferences.length > 0 && (
                  <div>
                    <div className="text-[11px] font-semibold text-slate-400 mb-1.5">
                      Sample Modifications Preview (first {previewResult.previewDifferences.length} entries):
                    </div>
                    <div className="overflow-x-auto rounded-lg border border-slate-800 bg-slate-950">
                      <table className="w-full text-left text-[11px] font-mono">
                        <thead className="bg-slate-900 border-b border-slate-800 text-slate-400">
                          <tr>
                            <th className="py-1.5 px-3">Row Index</th>
                            <th className="py-1.5 px-3">Column</th>
                            <th className="py-1.5 px-3">Original Value</th>
                            <th className="py-1.5 px-3">Transformed Value</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60">
                          {previewResult.previewDifferences.map((diff: any, idx: number) => (
                            <tr key={idx} className="hover:bg-slate-900/40">
                              <td className="py-1.5 px-3 text-slate-500">#{diff.index + 1}</td>
                              <td className="py-1.5 px-3 text-blue-400">{diff.column}</td>
                              <td className="py-1.5 px-3 text-red-400">{String(diff.before)}</td>
                              <td className="py-1.5 px-3 text-emerald-400">{String(diff.after)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-64 text-slate-500 text-xs text-center space-y-2">
                <Wand2 className="w-8 h-8 opacity-40" />
                <span>Select a transformation above and click "Preview Transformation Impact"</span>
                <span className="text-[11px] text-slate-600">
                  All actions can be safely reviewed before committing.
                </span>
              </div>
            )}

            {/* Bottom Commit Mode and Action Buttons */}
            {previewResult && (
              <div className="space-y-3 pt-4 mt-4 border-t border-slate-800">
                <div className="flex items-center gap-4 text-xs">
                  <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                    <input
                      type="radio"
                      name="saveMode"
                      checked={!saveAsNew}
                      onChange={() => setSaveAsNew(false)}
                      className="text-blue-600"
                    />
                    <span>Update in-place (with undo history)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                    <input
                      type="radio"
                      name="saveMode"
                      checked={saveAsNew}
                      onChange={() => setSaveAsNew(true)}
                      className="text-blue-600"
                    />
                    <span>Save as new separate branch</span>
                  </label>
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-end gap-2">
                  <button
                    onClick={() => setPreviewResult(null)}
                    className="w-full sm:w-auto px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 transition-colors"
                  >
                    Discard Preview
                  </button>
                  <button
                    onClick={handleApplyTransformation}
                    disabled={saving}
                    className="w-full sm:w-auto px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white transition-colors flex items-center justify-center gap-1.5 shadow-sm shadow-emerald-500/20"
                  >
                    {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    <span>{saveAsNew ? 'Save New Dataset Branch' : 'Apply Transformation'}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
