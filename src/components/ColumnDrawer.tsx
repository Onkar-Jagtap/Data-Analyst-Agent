import React from 'react';
import {
  AlertCircle,
  Calendar,
  CheckCircle,
  Hash,
  Layers,
  Sparkles,
  TrendingUp,
  X,
} from 'lucide-react';
import { ColumnProfile } from '../types.js';

interface ColumnDrawerProps {
  column: ColumnProfile | null;
  onClose: () => void;
  onAskColumn?: (columnName: string) => void;
}

export const ColumnDrawer: React.FC<ColumnDrawerProps> = ({
  column,
  onClose,
  onAskColumn,
}) => {
  if (!column) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <Hash className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-100">{column.name}</h3>
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-blue-950/60 text-blue-400 border border-blue-800/40">
                  {column.type}
                </span>
                {column.isIdentifier && (
                  <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-purple-950/60 text-purple-400 border border-purple-800/40">
                    ID Column
                  </span>
                )}
              </div>
              <div className="text-xs text-slate-400">
                {column.totalCount.toLocaleString()} values • {column.uniqueCount.toLocaleString()} unique ({column.uniquePercentage}%)
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto space-y-5 text-xs text-slate-300">
          {/* Completeness & Cardinality */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
              <div className="text-[10px] text-slate-400">Null Count</div>
              <div className="text-base font-bold font-mono text-slate-100 mt-0.5">
                {column.nullCount.toLocaleString()}
              </div>
              <div className="text-[10px] text-slate-500">{column.nullPercentage}% missing</div>
            </div>

            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
              <div className="text-[10px] text-slate-400">Unique Values</div>
              <div className="text-base font-bold font-mono text-slate-100 mt-0.5">
                {column.uniqueCount.toLocaleString()}
              </div>
              <div className="text-[10px] text-slate-500">{column.uniquePercentage}% cardinality</div>
            </div>

            {column.type === 'numeric' && (
              <>
                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
                  <div className="text-[10px] text-slate-400">Mean / Average</div>
                  <div className="text-base font-bold font-mono text-blue-400 mt-0.5">
                    {column.mean !== undefined ? column.mean.toLocaleString() : '--'}
                  </div>
                  <div className="text-[10px] text-slate-500">Std: {column.std !== undefined ? column.std.toLocaleString() : '--'}</div>
                </div>

                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
                  <div className="text-[10px] text-slate-400">Median</div>
                  <div className="text-base font-bold font-mono text-emerald-400 mt-0.5">
                    {column.median !== undefined ? column.median.toLocaleString() : '--'}
                  </div>
                  <div className="text-[10px] text-slate-500">IQR: {column.iqr !== undefined ? column.iqr.toLocaleString() : '--'}</div>
                </div>
              </>
            )}

            {column.type === 'datetime' && (
              <>
                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
                  <div className="text-[10px] text-slate-400">Earliest Date</div>
                  <div className="text-sm font-bold font-mono text-purple-400 mt-0.5">
                    {column.earliestDate || '--'}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
                  <div className="text-[10px] text-slate-400">Date Span</div>
                  <div className="text-sm font-bold font-mono text-purple-400 mt-0.5">
                    {column.dateRangeDays} days
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Numeric Distribution Details */}
          {column.type === 'numeric' && (
            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-200">Statistical Dispersion & Quartiles</span>
                {column.distributionShape && (
                  <span className="text-[10px] px-2 py-0.5 rounded bg-blue-950 text-blue-400 border border-blue-800 font-mono">
                    Shape: {column.distributionShape}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-slate-300 font-mono text-xs">
                <div className="p-2 rounded bg-slate-900 border border-slate-800">
                  <div className="text-[10px] text-slate-500">Minimum</div>
                  <div className="font-semibold">{column.min?.toLocaleString()}</div>
                </div>
                <div className="p-2 rounded bg-slate-900 border border-slate-800">
                  <div className="text-[10px] text-slate-500">Q1 (25th %)</div>
                  <div className="font-semibold">{column.q1?.toLocaleString()}</div>
                </div>
                <div className="p-2 rounded bg-slate-900 border border-slate-800">
                  <div className="text-[10px] text-slate-500">Q3 (75th %)</div>
                  <div className="font-semibold">{column.q3?.toLocaleString()}</div>
                </div>
                <div className="p-2 rounded bg-slate-900 border border-slate-800">
                  <div className="text-[10px] text-slate-500">Maximum</div>
                  <div className="font-semibold">{column.max?.toLocaleString()}</div>
                </div>
              </div>

              {/* Tukey Outlier Bounds */}
              {column.q1 !== undefined && column.iqr !== undefined && (
                <div className="p-2.5 rounded-lg bg-amber-950/20 border border-amber-900/30 text-[11px] text-amber-300 space-y-1">
                  <div className="font-semibold flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
                    Tukey 1.5×IQR Outlier Bounds: [
                    {Math.round((column.q1 - 1.5 * column.iqr) * 10) / 10}, {' '}
                    {Math.round((column.q3! + 1.5 * column.iqr) * 10) / 10}]
                  </div>
                  <div className="text-slate-400 text-[10px]">
                    Detected {column.outlierCountIqr || 0} potential distribution outliers ({Math.round(((column.outlierCountIqr || 0) / column.totalCount) * 1000) / 10}%).
                  </div>
                </div>
              )}

              {/* Mini Histogram visualization */}
              {column.histogramBins && column.histogramBins.length > 0 && (
                <div className="space-y-1 pt-2">
                  <div className="text-[11px] text-slate-400 font-semibold">Distribution Histogram</div>
                  <div className="flex items-end gap-1 h-24 pt-2 border-b border-slate-800">
                    {column.histogramBins.map((bin, i) => {
                      const maxCount = Math.max(...column.histogramBins!.map(b => b.count), 1);
                      const heightPct = Math.round((bin.count / maxCount) * 100);
                      return (
                        <div key={i} className="flex-1 flex flex-col items-center h-full justify-end group relative">
                          <div
                            style={{ height: `${heightPct}%` }}
                            className="w-full bg-blue-500/60 hover:bg-blue-400 rounded-t transition-all"
                          />
                          <div className="hidden group-hover:block absolute -top-8 bg-slate-800 text-[9px] px-1.5 py-0.5 rounded shadow z-10 whitespace-nowrap">
                            {bin.count} rows ({bin.label})
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex justify-between text-[9px] text-slate-500 font-mono">
                    <span>{column.min?.toLocaleString()}</span>
                    <span>{column.max?.toLocaleString()}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Categorical Top Frequency Breakdown */}
          {column.topCategories && column.topCategories.length > 0 && (
            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-2.5">
              <span className="font-semibold text-slate-200">Top Categories & Frequencies</span>
              <div className="space-y-2">
                {column.topCategories.map((cat, i) => (
                  <div key={i} className="space-y-0.5">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-slate-200 font-medium truncate">{cat.category}</span>
                      <span className="text-slate-400 font-mono">
                        {cat.count.toLocaleString()} ({cat.percentage}%)
                      </span>
                    </div>
                    <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="bg-blue-500 h-full rounded-full transition-all"
                        style={{ width: `${cat.percentage}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Sample Preview Chips */}
          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-2">
            <span className="font-semibold text-slate-200">Sample Row Values</span>
            <div className="flex flex-wrap gap-1.5">
              {column.sampleValues.map((sample, idx) => (
                <span
                  key={idx}
                  className="px-2 py-1 rounded bg-slate-900 border border-slate-800 text-[11px] font-mono text-slate-300"
                >
                  {sample === null ? '<null>' : String(sample)}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-slate-800 flex justify-between items-center bg-slate-950/80">
          {onAskColumn && (
            <button
              onClick={() => {
                onClose();
                onAskColumn(column.name);
              }}
              className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 font-medium px-3 py-1.5 rounded-lg hover:bg-blue-950/30 transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Ask questions about '{column.name}'</span>
            </button>
          )}
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 ml-auto transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
