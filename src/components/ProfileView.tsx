import React, { useState } from 'react';
import {
  AlertCircle,
  Calendar,
  ChevronRight,
  Filter,
  Hash,
  Layers,
  Search,
  SlidersHorizontal,
  Sparkles,
} from 'lucide-react';
import { ColumnProfile, DatasetProfile } from '../types.js';
import { ColumnDrawer } from './ColumnDrawer.js';

interface ProfileViewProps {
  profile: DatasetProfile;
  onAskQuestion?: (question: string) => void;
}

export const ProfileView: React.FC<ProfileViewProps> = ({ profile, onAskQuestion }) => {
  const [selectedColumn, setSelectedColumn] = useState<ColumnProfile | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  const filteredColumns = profile.columns.filter(col => {
    const matchesSearch = col.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = typeFilter === 'all' || col.type === typeFilter;
    return matchesSearch && matchesType;
  });

  const numericCols = profile.columns.filter(c => c.type === 'numeric');
  const catCols = profile.columns.filter(c => c.type === 'categorical');
  const dateCols = profile.columns.filter(c => c.type === 'datetime');

  return (
    <div className="space-y-6 pb-12">
      {/* Header & High-level Column Breakdown */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-100 tracking-tight font-display">
            Dataset Profiling & Column Catalog
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Automated schema inference, distributions, cardinality, and Tukey outlier boundaries for all {profile.columnCount} columns.
          </p>
        </div>

        {/* Quick Type Counts Pills */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="px-3 py-1.5 rounded-lg bg-blue-950/40 border border-blue-800/40 text-xs text-blue-300 font-mono">
            {numericCols.length} Numeric
          </div>
          <div className="px-3 py-1.5 rounded-lg bg-emerald-950/40 border border-emerald-800/40 text-xs text-emerald-300 font-mono">
            {catCols.length} Categorical
          </div>
          <div className="px-3 py-1.5 rounded-lg bg-purple-950/40 border border-purple-800/40 text-xs text-purple-300 font-mono">
            {dateCols.length} Datetime
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 p-3 rounded-xl bg-slate-900/60 border border-slate-800/80">
        <div className="relative flex-1">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search column names..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto">
          {['all', 'numeric', 'categorical', 'datetime', 'identifier'].map(type => (
            <button
              key={type}
              onClick={() => setTypeFilter(type)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${
                typeFilter === type
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      {/* Columns Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filteredColumns.map(col => (
          <div
            key={col.name}
            onClick={() => setSelectedColumn(col)}
            className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 hover:border-blue-500/50 hover:bg-slate-900/90 transition-all cursor-pointer flex flex-col justify-between group shadow-sm"
          >
            <div>
              {/* Top Row: Name + Type Badge */}
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="truncate">
                  <div className="text-sm font-bold text-slate-200 group-hover:text-blue-400 transition-colors truncate">
                    {col.name}
                  </div>
                  <div className="text-[11px] text-slate-500 font-mono">
                    {col.totalCount.toLocaleString()} values
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <span
                    className={`text-[10px] uppercase font-mono px-2 py-0.5 rounded border ${
                      col.type === 'numeric'
                        ? 'bg-blue-950/60 text-blue-400 border-blue-800/40'
                        : col.type === 'datetime'
                        ? 'bg-purple-950/60 text-purple-400 border-purple-800/40'
                        : col.type === 'identifier'
                        ? 'bg-indigo-950/60 text-indigo-400 border-indigo-800/40'
                        : 'bg-emerald-950/60 text-emerald-400 border-emerald-800/40'
                    }`}
                  >
                    {col.type}
                  </span>
                </div>
              </div>

              {/* Completeness & Cardinality progress */}
              <div className="space-y-1.5 my-3 p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/60 text-[11px]">
                <div className="flex justify-between items-center text-slate-400">
                  <span>Completeness</span>
                  <span className="font-mono text-slate-200">
                    {100 - col.nullPercentage}% ({col.nullCount} nulls)
                  </span>
                </div>
                <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      col.nullPercentage > 0 ? 'bg-amber-500' : 'bg-emerald-500'
                    }`}
                    style={{ width: `${Math.max(5, 100 - col.nullPercentage)}%` }}
                  />
                </div>

                <div className="flex justify-between items-center text-slate-400 pt-1">
                  <span>Distinct Cardinality</span>
                  <span className="font-mono text-slate-200">
                    {col.uniqueCount} ({col.uniquePercentage}%)
                  </span>
                </div>
              </div>

              {/* Numeric Specific Metrics */}
              {col.type === 'numeric' && (
                <div className="space-y-2 mb-3">
                  <div className="grid grid-cols-3 gap-1 text-[11px] font-mono text-slate-300">
                    <div className="p-1.5 rounded bg-slate-950/80 border border-slate-800/60">
                      <div className="text-[9px] text-slate-500">Min</div>
                      <div className="truncate">{col.min?.toLocaleString()}</div>
                    </div>
                    <div className="p-1.5 rounded bg-slate-950/80 border border-slate-800/60">
                      <div className="text-[9px] text-slate-500">Mean</div>
                      <div className="truncate text-blue-400">{col.mean?.toLocaleString()}</div>
                    </div>
                    <div className="p-1.5 rounded bg-slate-950/80 border border-slate-800/60">
                      <div className="text-[9px] text-slate-500">Max</div>
                      <div className="truncate">{col.max?.toLocaleString()}</div>
                    </div>
                  </div>

                  {/* Sparkline mini distribution */}
                  {col.histogramBins && col.histogramBins.length > 0 && (
                    <div className="flex items-end gap-1 h-8 pt-1">
                      {col.histogramBins.map((b, i) => {
                        const maxCount = Math.max(...col.histogramBins!.map(x => x.count), 1);
                        const pct = Math.round((b.count / maxCount) * 100);
                        return (
                          <div
                            key={i}
                            className="flex-1 bg-blue-500/40 group-hover:bg-blue-500/70 rounded-t transition-colors"
                            style={{ height: `${Math.max(10, pct)}%` }}
                          />
                        );
                      })}
                    </div>
                  )}

                  {/* Outlier Alert Tag */}
                  {col.outlierCountIqr && col.outlierCountIqr > 0 ? (
                    <div className="flex items-center gap-1.5 text-[10px] text-amber-400 bg-amber-950/20 px-2 py-0.5 rounded border border-amber-900/30">
                      <AlertCircle className="w-3 h-3 shrink-0" />
                      <span>{col.outlierCountIqr} outliers detected (Tukey IQR)</span>
                    </div>
                  ) : null}
                </div>
              )}

              {/* Categorical Top Frequencies */}
              {col.type === 'categorical' && col.topCategories && (
                <div className="space-y-1 mb-3">
                  {col.topCategories.slice(0, 3).map((cat, i) => (
                    <div key={i} className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-300 truncate max-w-[140px]">{cat.category}</span>
                      <span className="text-slate-500 font-mono">{cat.percentage}%</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Datetime range */}
              {col.type === 'datetime' && (
                <div className="space-y-1 mb-3 text-[11px] font-mono text-slate-300">
                  <div className="text-slate-500 text-[10px]">Date Range:</div>
                  <div className="truncate">{col.earliestDate} → {col.latestDate}</div>
                  <div className="text-[10px] text-purple-400">{col.dateRangeDays} total days span</div>
                </div>
              )}
            </div>

            {/* Bottom Card Action */}
            <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between text-[11px] text-slate-400 group-hover:text-blue-400 transition-colors">
              <span>View full distribution & quartiles</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </div>
          </div>
        ))}

        {filteredColumns.length === 0 && (
          <div className="col-span-full py-16 text-center rounded-2xl bg-slate-900/30 border border-slate-800/80">
            <Search className="w-8 h-8 text-slate-500 mx-auto mb-2 opacity-60" />
            <p className="text-sm font-semibold text-slate-200">No columns match filter</p>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              No dataset attributes matched your search query "{searchQuery}" under the "{typeFilter}" category.
            </p>
            <button
              onClick={() => {
                setSearchQuery('');
                setTypeFilter('all');
              }}
              className="mt-4 px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-blue-400 font-medium transition-colors"
            >
              Reset Filters
            </button>
          </div>
        )}
      </div>

      {/* Deep-dive drawer */}
      {selectedColumn && (
        <ColumnDrawer
          column={selectedColumn}
          onClose={() => setSelectedColumn(null)}
          onAskColumn={colName => {
            setSelectedColumn(null);
            if (onAskQuestion) {
              onAskQuestion(`Show summary metrics and distribution for ${colName}`);
            }
          }}
        />
      )}
    </div>
  );
};
