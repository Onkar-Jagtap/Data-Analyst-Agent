import React, { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  FileCheck,
  Filter,
  Info,
  ShieldCheck,
} from 'lucide-react';
import { DataHandlingReport } from '../types.js';

interface DataHandlingPanelProps {
  report: DataHandlingReport;
  defaultExpanded?: boolean;
}

export const DataHandlingPanel: React.FC<DataHandlingPanelProps> = ({
  report,
  defaultExpanded = false,
}) => {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <div className="mt-3 rounded-lg bg-slate-950/70 border border-slate-800/90 overflow-hidden transition-all text-xs">
      {/* Header bar */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-3 py-2.5 flex items-center justify-between bg-slate-900/50 hover:bg-slate-900/80 transition-colors text-left"
      >
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span className="font-semibold text-slate-200">Data Handling Disclosure</span>
          <span className="text-[11px] text-slate-400 font-mono">
            ({report.validRowsAnalyzed.toLocaleString()} of {report.totalRows.toLocaleString()} rows used)
          </span>
          {report.excludedRows > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 font-mono">
              {report.excludedRows} excluded
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 text-slate-400 text-[11px]">
          <span>{expanded ? 'Hide Details' : 'View Details'}</span>
          {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </div>
      </button>

      {/* Expanded body */}
      {expanded && (
        <div className="p-3.5 border-t border-slate-800/80 space-y-3">
          {/* Summary grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="p-2 rounded bg-slate-900/60 border border-slate-800">
              <div className="text-[10px] text-slate-400">Total Dataset Rows</div>
              <div className="text-sm font-bold font-mono text-slate-200">
                {report.totalRows.toLocaleString()}
              </div>
            </div>
            <div className="p-2 rounded bg-emerald-950/30 border border-emerald-800/40">
              <div className="text-[10px] text-emerald-400">Valid Analyzed Records</div>
              <div className="text-sm font-bold font-mono text-emerald-300">
                {report.validRowsAnalyzed.toLocaleString()}
              </div>
            </div>
            <div className="p-2 rounded bg-slate-900/60 border border-slate-800">
              <div className="text-[10px] text-slate-400">Missing Values Excluded</div>
              <div className="text-sm font-bold font-mono text-amber-300">
                {report.missingValuesExcluded.toLocaleString()}
              </div>
            </div>
            <div className="p-2 rounded bg-slate-900/60 border border-slate-800">
              <div className="text-[10px] text-slate-400">Invalid Values Excluded</div>
              <div className="text-sm font-bold font-mono text-red-300">
                {report.invalidValuesExcluded.toLocaleString()}
              </div>
            </div>
          </div>

          {/* Mathematical Method Description */}
          <div className="p-2.5 rounded bg-slate-900/80 border border-slate-800/90 flex items-start gap-2">
            <FileCheck className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
            <div>
              <div className="text-[11px] font-semibold text-slate-300">Methodology & Formula</div>
              <div className="text-xs text-slate-400 mt-0.5 font-mono">{report.methodDescription}</div>
            </div>
          </div>

          {/* Applied Rules Checklist */}
          {report.rulesApplied && report.rulesApplied.length > 0 && (
            <div>
              <div className="text-[11px] font-semibold text-slate-400 mb-1.5">Rules & Constraints Applied</div>
              <div className="space-y-1">
                {report.rulesApplied.map((rule, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-[11px] text-slate-300">
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>{rule}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Warnings if any */}
          {report.warnings && report.warnings.length > 0 && (
            <div className="space-y-1 pt-1">
              {report.warnings.map((warn, idx) => (
                <div key={idx} className="flex items-center gap-2 text-[11px] text-amber-300 bg-amber-950/30 p-2 rounded border border-amber-800/40">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span>{warn}</span>
                </div>
              ))}
            </div>
          )}

          <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between text-[10px] text-slate-500">
            <span>Deterministic Engine: Pure Python/TypeScript Math</span>
            <span>Original Dataset: 100% Preserved</span>
          </div>
        </div>
      )}
    </div>
  );
};
