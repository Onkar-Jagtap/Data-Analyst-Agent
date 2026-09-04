import React, { useState, useEffect } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  Download,
  Filter,
  Search,
  Table as TableIcon,
  X,
} from 'lucide-react';
import { DatasetProfile } from '../types.js';
import { fetchExplorerData } from '../api.js';

interface ExplorerViewProps {
  profile: DatasetProfile;
}

export const ExplorerView: React.FC<ExplorerViewProps> = ({ profile }) => {
  const [rows, setRows] = useState<any[]>([]);
  const [columns, setColumns] = useState<{ name: string; type: string }[]>([]);
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(25);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [totalRows, setTotalRows] = useState<number>(0);
  const [search, setSearch] = useState<string>('');
  const [sortCol, setSortCol] = useState<string>('');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [loading, setLoading] = useState<boolean>(false);
  const [cellPopover, setCellPopover] = useState<{ message: string; value: any; col: string } | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await fetchExplorerData(profile.id, {
        page,
        pageSize,
        search,
        sortCol,
        sortDir,
      });
      setRows(data.rows || []);
      setColumns(data.columns || []);
      setTotalPages(data.totalPages || 1);
      setTotalRows(data.totalRows || 0);
    } catch (err) {
      console.error('Failed to load explorer data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [profile.id, page, pageSize, sortCol, sortDir]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    loadData();
  };

  const handleSort = (colName: string) => {
    if (sortCol === colName) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortCol(colName);
      setSortDir('asc');
    }
    setPage(1);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <TableIcon className="w-4 h-4 text-blue-400" />
            <span className="text-xs font-semibold uppercase tracking-wider text-blue-400 font-mono">
              Raw Record Level Inspector
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-100 tracking-tight font-display">
            Data Explorer & Cell Audit
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Browse rows with inline cell-level quality flags (missing nulls, non-numeric strings, and Tukey outliers).
          </p>
        </div>

        <div className="flex items-center gap-2">
          <a
            href={`/api/export/${profile.id}`}
            download
            className="px-3.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-medium text-slate-300 flex items-center gap-1.5 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </a>
        </div>
      </div>

      {/* Search and Table Controls */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 rounded-xl bg-slate-900/60 border border-slate-800/80">
        <form onSubmit={handleSearchSubmit} className="relative w-full sm:w-80">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search records across all fields..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
          />
        </form>

        <div className="flex items-center gap-3 text-xs text-slate-400 w-full sm:w-auto justify-between sm:justify-end">
          <span className="font-mono text-[11px]">
            Showing {Math.min(totalRows, (page - 1) * pageSize + 1)}–{Math.min(totalRows, page * pageSize)} of {totalRows.toLocaleString()}
          </span>

          <select
            value={pageSize}
            onChange={e => {
              setPageSize(parseInt(e.target.value));
              setPage(1);
            }}
            className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-slate-200"
          >
            <option value="15">15 rows</option>
            <option value="25">25 rows</option>
            <option value="50">50 rows</option>
            <option value="100">100 rows</option>
          </select>
        </div>
      </div>

      {/* Table Container */}
      <div className="rounded-2xl bg-slate-900/70 border border-slate-800 shadow-xl overflow-hidden relative">
        {loading && (
          <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-[1px] flex items-center justify-center z-10">
            <div className="animate-spin w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full" />
          </div>
        )}

        <div className="overflow-x-auto max-h-[600px]">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="sticky top-0 bg-slate-950 z-10 border-b border-slate-800">
              <tr className="text-slate-400 text-[11px] font-semibold uppercase tracking-wider">
                <th className="py-2.5 px-3 w-12 text-slate-600 font-mono">#</th>
                {columns.map(c => (
                  <th
                    key={c.name}
                    onClick={() => handleSort(c.name)}
                    className="py-2.5 px-3 cursor-pointer hover:text-slate-200 transition-colors whitespace-nowrap"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>{c.name}</span>
                      <span className="text-[9px] lowercase font-mono opacity-50">({c.type})</span>
                      {sortCol === c.name && (
                        sortDir === 'asc' ? <ArrowUp className="w-3 h-3 text-blue-400" /> : <ArrowDown className="w-3 h-3 text-blue-400" />
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {rows.length === 0 && !loading && (
                <tr>
                  <td colSpan={Math.max(columns.length + 1, 1)} className="py-12 text-center text-slate-500 font-sans text-xs">
                    No records found matching current query or filters.
                  </td>
                </tr>
              )}
              {rows.map((rowItem, idx) => {
                const rowNum = (page - 1) * pageSize + idx + 1;
                const rowData = (rowItem?.data || rowItem?._data || (rowItem && !rowItem.cellStatus && !rowItem._status ? rowItem : {})) || {};
                const cellStatus = (rowItem?.cellStatus || rowItem?._status) || {};

                return (
                  <tr key={idx} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-2 px-3 text-slate-600 text-[10px] select-none">{rowNum}</td>
                    {columns.map(c => {
                      const val = rowData && typeof rowData === 'object' ? rowData[c.name] : undefined;
                      const status = cellStatus && typeof cellStatus === 'object' ? cellStatus[c.name] : undefined;
                      const isMissing = status?.status === 'missing' || val === null || val === undefined || val === '';
                      const isInvalid = status?.status === 'invalid';
                      const isAnomaly = status?.status === 'anomaly';

                      return (
                        <td key={c.name} className="py-2 px-3 whitespace-nowrap">
                          {isMissing ? (
                            <button
                              onClick={() => setCellPopover({ message: status?.message || 'Missing value', value: '<null>', col: c.name })}
                              className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/30 text-[10px] font-mono flex items-center gap-1"
                            >
                              <AlertTriangle className="w-2.5 h-2.5" />
                              <span>null</span>
                            </button>
                          ) : isInvalid ? (
                            <button
                              onClick={() => setCellPopover({ message: status?.message || 'Non-numeric string', value: val !== undefined ? val : '', col: c.name })}
                              className="px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/30 text-[10px] font-mono flex items-center gap-1"
                            >
                              <AlertCircle className="w-2.5 h-2.5" />
                              <span>{String(val)}</span>
                            </button>
                          ) : isAnomaly ? (
                            <button
                              onClick={() => setCellPopover({ message: status?.message || 'Distribution anomaly', value: val !== undefined ? val : '', col: c.name })}
                              className="px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-300 border border-purple-500/30 text-[10px] font-mono flex items-center gap-1"
                            >
                              <span>{String(val)}</span>
                            </button>
                          ) : (
                            <span className="text-slate-300">
                              {val === null || val === undefined ? '' : String(val)}
                            </span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="p-3 border-t border-slate-800 bg-slate-950 flex items-center justify-between text-xs">
          <div className="text-slate-500 font-mono text-[11px]">
            Page {page} of {totalPages}
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page <= 1}
              className="px-2.5 py-1 rounded bg-slate-900 hover:bg-slate-800 disabled:opacity-40 border border-slate-800 text-slate-300 flex items-center gap-1"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Prev</span>
            </button>

            <button
              onClick={() => setPage(Math.min(totalPages, page + 1))}
              disabled={page >= totalPages}
              className="px-2.5 py-1 rounded bg-slate-900 hover:bg-slate-800 disabled:opacity-40 border border-slate-800 text-slate-300 flex items-center gap-1"
            >
              <span>Next</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Cell Popover Modal */}
      {cellPopover && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 max-w-sm w-full shadow-2xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-300">Cell Quality Detail</span>
              <button
                onClick={() => setCellPopover(null)}
                className="text-slate-500 hover:text-slate-300"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="text-xs text-slate-400 space-y-1">
              <div>
                <span className="text-slate-500">Column: </span>
                <span className="text-blue-400 font-mono font-medium">{cellPopover.col}</span>
              </div>
              <div>
                <span className="text-slate-500">Value: </span>
                <span className="text-slate-200 font-mono">{String(cellPopover.value)}</span>
              </div>
              <div className="p-2.5 rounded bg-slate-950 border border-slate-800 text-amber-300 text-[11px] mt-2">
                {cellPopover.message}
              </div>
            </div>

            <button
              onClick={() => setCellPopover(null)}
              className="w-full py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
