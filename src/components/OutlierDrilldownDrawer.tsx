import React from 'react';
import { AlertCircle, ArrowRight, CheckCircle2, ShieldAlert, Sparkles, X } from 'lucide-react';
import { OutlierDrilldownResult } from '../types.js';

interface OutlierDrilldownDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  data: OutlierDrilldownResult | null;
  loading: boolean;
  onCleanOutliers?: (column: string) => void;
}

export const OutlierDrilldownDrawer: React.FC<OutlierDrilldownDrawerProps> = ({
  isOpen,
  onClose,
  data,
  loading,
  onCleanOutliers,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-950/70 backdrop-blur-sm flex justify-end animate-in fade-in duration-200">
      <div className="w-full max-w-2xl bg-slate-900 border-l border-slate-800 shadow-2xl flex flex-col h-full overflow-hidden animate-in slide-in-from-right duration-300">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-100 flex items-center gap-2">
                <span>Statistical Outlier Drill-Down</span>
                {data && (
                  <span className="text-xs font-mono px-2 py-0.5 rounded-md bg-slate-800 text-amber-300 border border-slate-700">
                    {data.column}
                  </span>
                )}
              </h2>
              <p className="text-xs text-slate-400">Tukey 1.5×IQR Interquartile Range & Z-Score Analysis</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loading && (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400 space-y-3">
              <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-sm">Calculating distribution metrics & z-scores...</p>
            </div>
          )}

          {!loading && !data && (
            <div className="text-center py-16 text-slate-400">
              <AlertCircle className="w-10 h-10 mx-auto text-slate-600 mb-2" />
              <p className="text-sm">No outlier data available for this column.</p>
            </div>
          )}

          {!loading && data && (
            <>
              {/* Statistical Boundary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/90">
                  <span className="text-[11px] text-slate-400 font-medium">Lower Bound (Q1 - 1.5 IQR)</span>
                  <div className="text-base font-bold text-slate-200 font-mono mt-1">
                    {data.bounds.lowerBound.toLocaleString()}
                  </div>
                  <span className="text-[10px] text-slate-500">Q1: {data.bounds.q1.toLocaleString()}</span>
                </div>

                <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/90">
                  <span className="text-[11px] text-slate-400 font-medium">Upper Bound (Q3 + 1.5 IQR)</span>
                  <div className="text-base font-bold text-slate-200 font-mono mt-1">
                    {data.bounds.upperBound.toLocaleString()}
                  </div>
                  <span className="text-[10px] text-slate-500">Q3: {data.bounds.q3.toLocaleString()}</span>
                </div>

                <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/90">
                  <span className="text-[11px] text-slate-400 font-medium">IQR Spread</span>
                  <div className="text-base font-bold text-slate-200 font-mono mt-1">
                    {data.bounds.iqr.toLocaleString()}
                  </div>
                  <span className="text-[10px] text-slate-500">Std Dev: {data.bounds.std.toLocaleString()}</span>
                </div>

                <div className="p-3 rounded-xl bg-amber-950/20 border border-amber-500/30">
                  <span className="text-[11px] text-amber-400 font-medium">Total Outliers</span>
                  <div className="text-base font-bold text-amber-300 font-mono mt-1">
                    {data.outliers.length} rows
                  </div>
                  <span className="text-[10px] text-amber-400/70">Beyond boundaries</span>
                </div>
              </div>

              {/* Action Banner */}
              {onCleanOutliers && (
                <div className="p-4 rounded-xl bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/20 flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-semibold text-amber-300">Automated Remediation Available</h4>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Clean or cap these {data.outliers.length} statistical anomalies in the Cleaning Assistant.
                    </p>
                  </div>
                  <button
                    onClick={() => onCleanOutliers(data.column)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs transition-colors shadow-sm"
                  >
                    <span>Clean in Assistant</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* Outliers Table */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold text-slate-200 uppercase tracking-wider">
                    Extreme Deviations (Ranked by Z-Score)
                  </h3>
                  <span className="text-[11px] text-slate-500">Showing top {data.outliers.length} rows</span>
                </div>

                <div className="rounded-xl border border-slate-800 bg-slate-950/80 overflow-hidden">
                  <div className="max-h-96 overflow-y-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="sticky top-0 bg-slate-900/95 backdrop-blur-sm border-b border-slate-800 text-slate-400 text-[11px]">
                        <tr>
                          <th className="py-2.5 px-3 font-medium">Row</th>
                          <th className="py-2.5 px-3 font-medium">Value</th>
                          <th className="py-2.5 px-3 font-medium">Z-Score</th>
                          <th className="py-2.5 px-3 font-medium">Deviation</th>
                          <th className="py-2.5 px-3 font-medium">Context (Attributes)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                        {data.outliers.map((item, idx) => {
                          const isHigh = item.value > data.bounds.upperBound;
                          return (
                            <tr key={idx} className="hover:bg-slate-900/50 transition-colors">
                              <td className="py-2 px-3 text-slate-400">#{item.rowIndex}</td>
                              <td className="py-2 px-3 font-bold text-amber-300">
                                {item.value.toLocaleString()}
                              </td>
                              <td className="py-2 px-3 text-slate-300">
                                <span
                                  className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                                    Math.abs(item.zScore) > 3
                                      ? 'bg-red-950/60 text-red-300 border border-red-800/50'
                                      : 'bg-amber-950/60 text-amber-300 border border-amber-800/50'
                                  }`}
                                >
                                  {item.zScore > 0 ? `+${item.zScore}` : item.zScore}σ
                                </span>
                              </td>
                              <td className="py-2 px-3 text-slate-400">
                                {isHigh ? `+${item.distanceFromBound.toLocaleString()} above upper` : `-${item.distanceFromBound.toLocaleString()} below lower`}
                              </td>
                              <td className="py-2 px-3 font-sans text-slate-300">
                                <div className="flex flex-wrap gap-1 max-w-xs">
                                  {Object.entries(item.rowContext).slice(0, 3).map(([k, v]) => (
                                    <span key={k} className="text-[10px] px-1.5 py-0.5 rounded bg-slate-900 text-slate-400 border border-slate-800">
                                      {k}: <strong className="text-slate-300">{String(v)}</strong>
                                    </span>
                                  ))}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>Robust IQR standard avoids skew from extreme values</span>
          </div>
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
