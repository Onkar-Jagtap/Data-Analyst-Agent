import React, { useState, useEffect } from 'react';
import {
  AlertCircle,
  Check,
  Clock,
  Code2,
  Copy,
  Download,
  Play,
  RotateCcw,
  Sparkles,
  Table as TableIcon,
  Terminal,
} from 'lucide-react';
import { DatasetProfile } from '../types.js';
import { executeSql, SqlExecutionResponse } from '../api.js';
import { clientEngine } from '../clientEngine.js';
import { executeSqlQuery } from '../utils/sql_engine.js';

interface SqlConsoleProps {
  profile: DatasetProfile;
  initialQuery?: string;
}

export const SqlConsole: React.FC<SqlConsoleProps> = ({ profile, initialQuery }) => {
  const catCol = profile.columns.find(c => c.type === 'categorical')?.name || profile.columns[0]?.name || 'category';
  const numCol = profile.columns.find(c => c.type === 'numeric')?.name || profile.columns[1]?.name || 'value';
  const safeCat = catCol.replace(/"/g, '""');
  const safeNum = numCol.replace(/"/g, '""');

  const defaultQuery = initialQuery || `-- Interactive SQL Engine for ${profile.filename}
SELECT 
  "${safeCat}",
  COUNT(*) AS record_count,
  ROUND(SUM("${safeNum}"), 2) AS total_volume,
  ROUND(AVG("${safeNum}"), 2) AS avg_volume
FROM dataset
GROUP BY 1
ORDER BY 3 DESC
LIMIT 15;`;

  const [query, setQuery] = useState<string>(defaultQuery);
  const [running, setRunning] = useState<boolean>(false);
  const [result, setResult] = useState<SqlExecutionResponse | null>(null);
  const [copied, setCopied] = useState<boolean>(false);
  const [filterText, setFilterText] = useState<string>('');
  const [sortCol, setSortCol] = useState<string>('');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const templates = [
    {
      label: 'Pareto 80/20 Aggregation',
      desc: 'Group by primary dimension and aggregate volume',
      sql: `SELECT \n  "${safeCat}",\n  COUNT(*) AS records,\n  ROUND(SUM("${safeNum}"), 2) AS total_volume,\n  ROUND(AVG("${safeNum}"), 2) AS avg_volume\nFROM dataset\nGROUP BY 1\nORDER BY 3 DESC\nLIMIT 15;`,
    },
    {
      label: 'Top Outliers / Peak Records',
      desc: 'Rank rows descending by highest metric values',
      sql: `SELECT * FROM dataset\nORDER BY "${safeNum}" DESC\nLIMIT 20;`,
    },
    {
      label: 'Data Quality / Null Audit',
      desc: 'Filter rows with missing values in key columns',
      sql: `SELECT * FROM dataset\nWHERE "${safeNum}" IS NULL OR "${safeCat}" IS NULL\nLIMIT 25;`,
    },
    {
      label: 'Summary Distribution Stats',
      desc: 'Compute Min, Max, and Average across dataset',
      sql: `SELECT \n  COUNT(*) AS total_rows,\n  ROUND(MIN("${safeNum}"), 2) AS min_val,\n  ROUND(AVG("${safeNum}"), 2) AS avg_val,\n  ROUND(MAX("${safeNum}"), 2) AS max_val\nFROM dataset;`,
    },
  ];

  const handleExecute = async () => {
    if (!query.trim()) return;
    setRunning(true);
    try {
      // 1. Try server execution
      let res = await executeSql(profile.id, query);
      // 2. If server not reachable or offline, fallback to in-browser engine
      if (!res.success && res.error?.includes('Failed to execute')) {
        const ds = clientEngine.getDataset(profile.id);
        if (ds && ds.rawRows && ds.rawRows.length > 0) {
          const clientRes = executeSqlQuery(ds.rawRows, query);
          res = {
            success: clientRes.success,
            columns: clientRes.columns,
            rows: clientRes.rows,
            totalCount: clientRes.totalCount,
            executionTimeMs: clientRes.executionTimeMs,
            error: clientRes.error,
          };
        }
      }
      setResult(res);
      setSortCol('');
    } catch (err: any) {
      setResult({
        success: false,
        columns: [],
        rows: [],
        totalCount: 0,
        executionTimeMs: 0,
        error: err.message || 'Execution failed',
      });
    } finally {
      setRunning(false);
    }
  };

  useEffect(() => {
    handleExecute();
  }, [profile.id]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      handleExecute();
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(query);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExportCsv = () => {
    if (!result || !result.rows || result.rows.length === 0) return;
    const cols = result.columns;
    const header = cols.map(c => `"${c.replace(/"/g, '""')}"`).join(',');
    const rowsText = result.rows
      .map(r =>
        cols
          .map(c => {
            const val = r[c];
            if (val === null || val === undefined) return '""';
            return `"${String(val).replace(/"/g, '""')}"`;
          })
          .join(',')
      )
      .join('\n');

    const csv = `${header}\n${rowsText}`;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sql_query_result_${profile.filename.replace(/\.[^/.]+$/, '')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Sort and filter results
  let displayedRows = result?.rows || [];
  if (filterText.trim()) {
    const q = filterText.toLowerCase();
    displayedRows = displayedRows.filter(r =>
      Object.values(r).some(v => v !== null && v !== undefined && String(v).toLowerCase().includes(q))
    );
  }

  if (sortCol) {
    displayedRows = [...displayedRows].sort((a, b) => {
      const valA = a[sortCol];
      const valB = b[sortCol];
      const numA = Number(valA);
      const numB = Number(valB);
      let cmp = 0;
      if (!isNaN(numA) && !isNaN(numB)) {
        cmp = numA - numB;
      } else {
        cmp = String(valA ?? '').localeCompare(String(valB ?? ''));
      }
      return sortDir === 'desc' ? -cmp : cmp;
    });
  }

  return (
    <div className="space-y-6">
      {/* Top Templates bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {templates.map((tpl, i) => (
          <button
            key={i}
            onClick={() => {
              setQuery(tpl.sql);
            }}
            className="text-left p-3 rounded-xl bg-slate-900/60 border border-slate-800 hover:border-blue-500/50 hover:bg-slate-800/60 transition-all group shadow-sm"
          >
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-200 group-hover:text-blue-400">
              <Sparkles className="w-3.5 h-3.5 text-blue-400" />
              <span>{tpl.label}</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1 line-clamp-1">{tpl.desc}</p>
          </button>
        ))}
      </div>

      {/* SQL Editor Card */}
      <div className="rounded-2xl bg-slate-900/70 border border-slate-800 shadow-xl overflow-hidden">
        <div className="px-4 py-2.5 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-mono font-semibold text-slate-200">Interactive SQL Studio</span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400">
              In-Memory Engine
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs flex items-center gap-1 transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>
            <button
              onClick={() => setQuery(defaultQuery)}
              className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs flex items-center gap-1 transition-colors"
              title="Reset to default query"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>
            <button
              onClick={handleExecute}
              disabled={running}
              className="px-4 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-medium text-xs flex items-center gap-1.5 transition-all shadow-md shadow-emerald-900/20"
            >
              {running ? (
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Play className="w-3.5 h-3.5 fill-current" />
              )}
              <span>Run Query</span>
              <span className="text-[10px] opacity-70 hidden sm:inline">(Ctrl+Enter)</span>
            </button>
          </div>
        </div>

        <div className="p-3 bg-slate-950 font-mono text-xs">
          <textarea
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={7}
            spellCheck={false}
            className="w-full bg-slate-950 text-emerald-300 border-0 focus:ring-0 focus:outline-none resize-y leading-relaxed selection:bg-emerald-900/50"
            placeholder="SELECT * FROM dataset LIMIT 10;"
          />
        </div>
      </div>

      {/* Query Results or Error */}
      {result && (
        <div className="rounded-2xl bg-slate-900/70 border border-slate-800 shadow-xl overflow-hidden">
          {/* Result Header */}
          <div className="px-4 py-3 bg-slate-950 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <TableIcon className="w-4 h-4 text-blue-400" />
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-200">Query Output</span>
                {result.success && (
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    {result.totalCount} {result.totalCount === 1 ? 'row' : 'rows'}
                  </span>
                )}
                <span className="text-[11px] font-mono text-slate-500 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {result.executionTimeMs}ms
                </span>
              </div>
            </div>

            {result.success && result.rows.length > 0 && (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Filter query results..."
                  value={filterText}
                  onChange={e => setFilterText(e.target.value)}
                  className="bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 w-44"
                />
                <button
                  onClick={handleExportCsv}
                  className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs flex items-center gap-1.5 transition-colors border border-slate-700"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export CSV</span>
                </button>
              </div>
            )}
          </div>

          {/* Error Message */}
          {!result.success && (
            <div className="p-4 bg-red-950/20 border-b border-red-900/30 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-semibold text-red-300">Query Execution Error</h4>
                <p className="text-xs text-red-400 font-mono mt-1">{result.error}</p>
                <p className="text-[11px] text-slate-400 mt-2">
                  Tip: Use <code className="text-emerald-400">dataset</code> as the table name, quote multi-word columns with double quotes (e.g. <code className="text-emerald-400">"Column Name"</code>), and use standard SQL keywords.
                </p>
              </div>
            </div>
          )}

          {/* Result Table */}
          {result.success && (
            <div className="overflow-x-auto max-h-[500px]">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="sticky top-0 bg-slate-950 z-10 border-b border-slate-800">
                  <tr className="text-slate-400 text-[11px] font-semibold uppercase tracking-wider">
                    <th className="py-2.5 px-3 w-12 text-slate-600 font-mono">#</th>
                    {result.columns.map(col => (
                      <th
                        key={col}
                        onClick={() => {
                          if (sortCol === col) {
                            setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
                          } else {
                            setSortCol(col);
                            setSortDir('asc');
                          }
                        }}
                        className="py-2.5 px-3 cursor-pointer hover:text-slate-200 transition-colors whitespace-nowrap"
                      >
                        <div className="flex items-center gap-1.5">
                          <span>{col}</span>
                          {sortCol === col && (
                            <span className="text-blue-400 text-[10px]">{sortDir === 'asc' ? '▲' : '▼'}</span>
                          )}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {displayedRows.length === 0 ? (
                    <tr>
                      <td colSpan={result.columns.length + 1} className="py-8 text-center text-slate-500 text-xs">
                        Query returned 0 rows.
                      </td>
                    </tr>
                  ) : (
                    displayedRows.map((row, idx) => (
                      <tr key={idx} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-2 px-3 text-slate-600 text-[10px] select-none">{idx + 1}</td>
                        {result.columns.map(col => {
                          const val = row[col];
                          const isNull = val === null || val === undefined;
                          return (
                            <td key={col} className="py-2 px-3 whitespace-nowrap text-slate-300">
                              {isNull ? (
                                <span className="text-amber-500/70 italic text-[11px]">NULL</span>
                              ) : typeof val === 'number' ? (
                                <span className="text-blue-300 font-semibold">{val.toLocaleString()}</span>
                              ) : (
                                String(val)
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
