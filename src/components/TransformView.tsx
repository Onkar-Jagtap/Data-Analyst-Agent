import React, { useState } from 'react';
import {
  Calculator,
  CheckCircle2,
  ChevronRight,
  Database,
  Divide,
  Eye,
  FileText,
  Minus,
  Percent,
  Plus,
  RefreshCw,
  Scissors,
  Search,
  Sparkles,
  Type,
  Undo2,
  Wand2,
  X,
} from 'lucide-react';
import { DatasetProfile, TransformRequest, TransformResult } from '../types.js';
import { applyTransformation, undoCleaningAction } from '../api.js';

interface TransformViewProps {
  profile: DatasetProfile;
  canUndo: boolean;
  onRefreshProfile: () => void;
  onUndo: () => void;
}

export const TransformView: React.FC<TransformViewProps> = ({
  profile,
  canUndo,
  onRefreshProfile,
  onUndo,
}) => {
  const [activeTab, setActiveTab] = useState<'calculated' | 'cast' | 'text'>('calculated');

  // Calculated Column State
  const [newColName, setNewColName] = useState<string>('');
  const [expression, setExpression] = useState<string>('');

  // Cast Column State
  const [castCol, setCastCol] = useState<string>(profile.columns[0]?.name || '');
  const [targetType, setTargetType] = useState<'numeric' | 'categorical' | 'datetime' | 'text'>('numeric');

  // Text Transform State
  const [textCol, setTextCol] = useState<string>(
    profile.columns.find(c => c.type === 'categorical' || c.type === 'text')?.name || profile.columns[0]?.name || ''
  );
  const [textSubtype, setTextSubtype] = useState<'split' | 'find_replace' | 'case'>('split');
  const [delimiter, setDelimiter] = useState<string>(' ');
  const [maxSplits, setMaxSplits] = useState<number>(2);
  const [findText, setFindText] = useState<string>('');
  const [replaceText, setReplaceText] = useState<string>('');
  const [caseSensitive, setCaseSensitive] = useState<boolean>(false);
  const [caseType, setCaseType] = useState<'upper' | 'lower' | 'title' | 'trim'>('trim');

  // Execution states
  const [executing, setExecuting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<TransformResult | null>(null);

  const numCols = profile.columns.filter(c => c.type === 'numeric');

  // Add column token to formula expression
  const insertToken = (token: string) => {
    setExpression(prev => `${prev} ${token} `.replace(/\s+/g, ' '));
  };

  // Quick preset formulas
  const applyPreset = (preset: { name: string; expr: string }) => {
    setNewColName(preset.name);
    setExpression(preset.expr);
  };

  const commonPresets = [
    {
      name: 'Profit_Margin_Pct',
      expr: numCols.length >= 2 ? `(${numCols[0].name} / ${numCols[1].name}) * 100` : '([ColumnA] / [ColumnB]) * 100',
    },
    {
      name: 'Net_Revenue',
      expr: numCols.length >= 2 ? `${numCols[0].name} - ${numCols[1].name}` : '[Revenue] - [Discount]',
    },
    {
      name: 'Markup_Multiple',
      expr: numCols.length >= 2 ? `${numCols[0].name} * 1.15` : '[Price] * 1.15',
    },
  ];

  const handleApply = async () => {
    setError(null);
    setExecuting(true);
    try {
      let req: TransformRequest;
      if (activeTab === 'calculated') {
        if (!newColName.trim()) {
          throw new Error('Please specify a valid name for the new calculated column.');
        }
        if (!expression.trim()) {
          throw new Error('Please enter a math expression (e.g. Profit / Revenue * 100).');
        }
        req = {
          action: 'calculated_column',
          newColumnName: newColName.trim(),
          expression: expression.trim(),
        };
      } else if (activeTab === 'cast') {
        req = {
          action: 'cast_type',
          column: castCol,
          targetType,
        };
      } else {
        if (textSubtype === 'split') {
          req = {
            action: 'split_column',
            column: textCol,
            delimiter: delimiter || ' ',
            maxSplits,
          };
        } else if (textSubtype === 'find_replace') {
          if (!findText) throw new Error('Specify search text to find.');
          req = {
            action: 'find_replace',
            column: textCol,
            findText,
            replaceText,
            caseSensitive,
          };
        } else {
          req = {
            action: 'text_case',
            column: textCol,
            caseType,
          };
        }
      }

      const res = await applyTransformation(profile.id, req);
      setLastResult(res);
      onRefreshProfile();
      // Clear inputs if calculated
      if (activeTab === 'calculated') {
        setNewColName('');
        setExpression('');
      }
    } catch (err: any) {
      setError(err.message || 'Transformation failed to apply.');
    } finally {
      setExecuting(false);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Wand2 className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400 font-mono">
              Feature Engineering & Data Wrangling
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-100 tracking-tight font-display">
            Data Transformation Studio
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Build custom calculated formula columns, override data type classifications, split compound fields, and clean strings.
          </p>
        </div>

        {/* Undo Button */}
        {canUndo && (
          <button
            onClick={onUndo}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-semibold text-amber-300 transition-all shadow-sm self-start sm:self-auto"
            title="Undo the last applied transformation"
          >
            <Undo2 className="w-4 h-4 text-amber-400" />
            <span>Undo Transformation</span>
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
        <button
          onClick={() => { setActiveTab('calculated'); setError(null); }}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
            activeTab === 'calculated'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
          }`}
        >
          <Calculator className="w-4 h-4" />
          <span>Calculated Columns</span>
        </button>

        <button
          onClick={() => { setActiveTab('cast'); setError(null); }}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
            activeTab === 'cast'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
          }`}
        >
          <Database className="w-4 h-4" />
          <span>Data Type Casting</span>
        </button>

        <button
          onClick={() => { setActiveTab('text'); setError(null); }}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
            activeTab === 'text'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
          }`}
        >
          <Scissors className="w-4 h-4" />
          <span>Text & Split Transformations</span>
        </button>
      </div>

      {/* Main Form Card */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 p-6 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-5">
          {/* TAB 1: CALCULATED COLUMNS */}
          {activeTab === 'calculated' && (
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  New Column Name
                </label>
                <input
                  type="text"
                  placeholder="e.g., Profit_Margin_Pct, Net_Revenue"
                  value={newColName}
                  onChange={e => setNewColName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-300">
                    Math / Formula Expression
                  </label>
                  <span className="text-[11px] text-slate-500 font-mono">
                    Supports +, -, *, /, %, ()
                  </span>
                </div>
                <input
                  type="text"
                  placeholder="e.g., [Profit] / [Revenue] * 100"
                  value={expression}
                  onChange={e => setExpression(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs font-mono text-emerald-400 placeholder-slate-600 focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* Quick Math Operators */}
              <div>
                <span className="text-[11px] font-semibold text-slate-400 block mb-1.5">
                  Insert Operator:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {['+', '-', '*', '/', '(', ')', '%', '100', '1000'].map(op => (
                    <button
                      key={op}
                      type="button"
                      onClick={() => insertToken(op)}
                      className="px-3 py-1 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-xs font-mono font-bold text-slate-200 transition-colors"
                    >
                      {op}
                    </button>
                  ))}
                </div>
              </div>

              {/* Column Selector Chips */}
              <div>
                <span className="text-[11px] font-semibold text-slate-400 block mb-1.5">
                  Insert Existing Column:
                </span>
                <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto pr-1">
                  {profile.columns.map(c => (
                    <button
                      key={c.name}
                      type="button"
                      onClick={() => insertToken(`[${c.name}]`)}
                      className={`px-2.5 py-1 rounded-lg border text-[11px] font-mono transition-colors flex items-center gap-1 ${
                        c.type === 'numeric'
                          ? 'bg-blue-950/30 border-blue-800/50 text-blue-300 hover:bg-blue-900/40'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <span>{c.name}</span>
                      <span className="text-[9px] opacity-60">({c.type})</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Common Formula Presets */}
              <div className="pt-2 border-t border-slate-800/80">
                <span className="text-[11px] font-semibold text-slate-400 block mb-1.5">
                  Quick Formula Templates:
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {commonPresets.map(p => (
                    <button
                      key={p.name}
                      type="button"
                      onClick={() => applyPreset(p)}
                      className="p-2.5 rounded-xl bg-slate-950 border border-slate-800/80 hover:border-slate-700 text-left transition-all group"
                    >
                      <div className="text-xs font-semibold text-slate-300 group-hover:text-blue-300">
                        {p.name.replace(/_/g, ' ')}
                      </div>
                      <div className="text-[10px] font-mono text-slate-500 truncate mt-0.5">
                        {p.expr}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: DATA TYPE CASTING */}
          {activeTab === 'cast' && (
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Select Column to Reclassify
                </label>
                <select
                  value={castCol}
                  onChange={e => setCastCol(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
                >
                  {profile.columns.map(c => (
                    <option key={c.name} value={c.name}>
                      {c.name} (Current: {c.type}, {c.nullCount} nulls)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                  Target Data Type Override
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { id: 'numeric', label: 'Numeric', desc: 'Parses currency, commas, floats' },
                    { id: 'categorical', label: 'Categorical', desc: 'Factor / Grouping dimension' },
                    { id: 'datetime', label: 'Date / Time', desc: 'ISO 8601, timestamps, dates' },
                    { id: 'text', label: 'String / Text', desc: 'Raw character representation' },
                  ].map(t => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setTargetType(t.id as any)}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        targetType === t.id
                          ? 'bg-blue-600/20 border-blue-500/50 text-white'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <div className="text-xs font-semibold">{t.label}</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">{t.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-400">
                <span className="font-semibold text-slate-300">Safety Guarantee: </span>
                Numeric casting uses regex sanitization to cleanly strip currency symbols ($ € £), percentage signs (%), and comma thousands separators before parsing. Unparseable values safely default to null or 0.
              </div>
            </div>
          )}

          {/* TAB 3: TEXT & SPLIT */}
          {activeTab === 'text' && (
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Target Column
                </label>
                <select
                  value={textCol}
                  onChange={e => setTextCol(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
                >
                  {profile.columns.map(c => (
                    <option key={c.name} value={c.name}>
                      {c.name} ({c.type})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2">
                {[
                  { id: 'split', label: 'Split Column' },
                  { id: 'find_replace', label: 'Find & Replace' },
                  { id: 'case', label: 'Case & Trim' },
                ].map(st => (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => setTextSubtype(st.id as any)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      textSubtype === st.id
                        ? 'bg-slate-800 text-white border border-slate-700'
                        : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
                    }`}
                  >
                    {st.label}
                  </button>
                ))}
              </div>

              {textSubtype === 'split' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-slate-300 block mb-1">
                      Delimiter Character
                    </label>
                    <input
                      type="text"
                      value={delimiter}
                      onChange={e => setDelimiter(e.target.value)}
                      placeholder="Space, comma, hyphen, or @"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-slate-200"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-300 block mb-1">
                      Max Split Parts
                    </label>
                    <select
                      value={maxSplits}
                      onChange={e => setMaxSplits(parseInt(e.target.value))}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200"
                    >
                      <option value="2">2 Columns (e.g. First / Last)</option>
                      <option value="3">3 Columns</option>
                      <option value="4">4 Columns</option>
                    </select>
                  </div>
                </div>
              )}

              {textSubtype === 'find_replace' && (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-semibold text-slate-300 block mb-1">
                        Find Substring
                      </label>
                      <input
                        type="text"
                        value={findText}
                        onChange={e => setFindText(e.target.value)}
                        placeholder="Text to replace..."
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-300 block mb-1">
                        Replace With
                      </label>
                      <input
                        type="text"
                        value={replaceText}
                        onChange={e => setReplaceText(e.target.value)}
                        placeholder="New value (empty to remove)..."
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200"
                      />
                    </div>
                  </div>
                  <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={caseSensitive}
                      onChange={e => setCaseSensitive(e.target.checked)}
                      className="rounded border-slate-700 bg-slate-950"
                    />
                    <span>Case sensitive search</span>
                  </label>
                </div>
              )}

              {textSubtype === 'case' && (
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                    Formatting Operation
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {[
                      { id: 'trim', label: 'Trim Whitespace' },
                      { id: 'upper', label: 'UPPERCASE' },
                      { id: 'lower', label: 'lowercase' },
                      { id: 'title', label: 'Title Case' },
                    ].map(c => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setCaseType(c.id as any)}
                        className={`p-2.5 rounded-xl border text-xs font-semibold text-center transition-all ${
                          caseType === c.id
                            ? 'bg-blue-600 text-white'
                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {c.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {error && (
            <div className="p-3.5 rounded-xl bg-red-950/30 border border-red-900/40 text-xs text-red-300">
              {error}
            </div>
          )}

          <button
            onClick={handleApply}
            disabled={executing}
            className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 text-xs font-bold text-white transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 cursor-pointer"
          >
            {executing ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
            <span>Apply Transformation to Dataset</span>
          </button>
        </div>

        {/* Sidebar / Live Result Diff Card */}
        <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-300 border-b border-slate-800 pb-2 mb-3">
              <Eye className="w-4 h-4 text-amber-400" />
              <span>Transformation Impact</span>
            </div>

            {lastResult ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Success: {lastResult.summary}</span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                    <span className="text-[10px] text-slate-500 block">Rows Processed</span>
                    <span className="text-sm font-bold text-slate-200">{lastResult.rowsAffected.toLocaleString()}</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                    <span className="text-[10px] text-slate-500 block">Active Columns</span>
                    <span className="text-sm font-bold text-slate-200">{profile.columns.length}</span>
                  </div>
                </div>

                {lastResult.previewDifferences && lastResult.previewDifferences.length > 0 && (
                  <div>
                    <span className="text-[11px] font-semibold text-slate-400 block mb-1">
                      Sample Row Changes:
                    </span>
                    <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                      {lastResult.previewDifferences.map(diff => (
                        <div
                          key={diff.rowIndex}
                          className="p-2 rounded-lg bg-slate-950 border border-slate-800/80 text-[11px] font-mono"
                        >
                          <div className="text-[10px] text-slate-500 mb-0.5">Row #{diff.rowIndex + 1}:</div>
                          <div className="text-slate-400 line-through text-[10px] truncate">
                            Prev: {JSON.stringify(diff.original)}
                          </div>
                          <div className="text-emerald-400 text-[10px] truncate font-semibold">
                            New: {JSON.stringify(diff.transformed)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-xs text-slate-500 leading-relaxed space-y-2">
                <p>
                  Every transformation updates the in-memory dataset immediately and creates an instant recovery snapshot.
                </p>
                <p>
                  Calculated columns become directly selectable across the Visual Studio, Query Engine, and BI Dashboard.
                </p>
              </div>
            )}
          </div>

          <div className="pt-3 border-t border-slate-800 text-[11px] text-slate-500">
            Current Dataset: <span className="text-slate-300 font-semibold">{profile.filename}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
