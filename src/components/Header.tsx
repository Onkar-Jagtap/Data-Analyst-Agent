import React, { useState } from 'react';
import {
  BarChart2,
  ChevronDown,
  Download,
  FileSpreadsheet,
  Lock,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { DatasetListItem, DatasetProfile } from '../types.js';

interface HeaderProps {
  currentProfile: DatasetProfile | null;
  datasets: DatasetListItem[];
  onSelectDataset: (id: string) => void;
  onOpenUpload: () => void;
  onLoadSample: () => void;
  onQuickAsk: (question: string) => void;
  qualityScore?: number;
  loading?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  currentProfile,
  datasets,
  onSelectDataset,
  onOpenUpload,
  onLoadSample,
  onQuickAsk,
  qualityScore,
  loading = false,
}) => {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [quickInput, setQuickInput] = useState('');

  const handleQuickSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (quickInput.trim()) {
      onQuickAsk(quickInput.trim());
      setQuickInput('');
    }
  };

  const handleExport = () => {
    if (!currentProfile) return;
    window.location.href = `/api/export/${currentProfile.id}`;
  };

  return (
    <header className="h-16 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md px-4 sm:px-6 flex items-center justify-between sticky top-0 z-30">
      {/* Brand & Dataset Switcher */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-500/25">
            <BarChart2 className="w-4 h-4" />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-sm tracking-tight text-slate-100 font-display">Data Analyst Agent</span>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-gradient-to-r from-blue-500/20 to-indigo-500/20 text-blue-300 border border-blue-500/30">
                by PJA
              </span>
              <span className="hidden xl:inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded bg-slate-900 text-emerald-400 border border-emerald-900/40">
                <Lock className="w-2.5 h-2.5" /> Isolated Session
              </span>
            </div>
            <span className="text-[11px] text-slate-400">Autonomous Data Science & Deterministic Analytics</span>
          </div>
        </div>

        <div className="h-5 w-px bg-slate-800 hidden sm:block" />

        {/* Dataset selector dropdown */}
        <div className="relative hidden md:block">
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900/90 border border-slate-800 hover:border-slate-700 text-xs text-slate-200 transition-all shadow-sm"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-blue-400" />
            <span className="font-medium max-w-[150px] truncate">
              {currentProfile ? currentProfile.filename : 'No Dataset Selected'}
            </span>
            <ChevronDown className="w-3 h-3 text-slate-400" />
          </button>

          {dropdownOpen && (
            <div className="absolute left-0 mt-1.5 w-72 rounded-xl bg-slate-900 border border-slate-800 shadow-2xl p-1.5 z-50 animate-in fade-in zoom-in-95 duration-100">
              <div className="text-[11px] font-semibold text-slate-400 px-2 py-1 uppercase tracking-wider flex items-center justify-between">
                <span>Session Datasets</span>
                <span className="text-[10px] text-slate-500 font-mono">{datasets.length} loaded</span>
              </div>
              <div className="max-h-56 overflow-y-auto space-y-0.5 mt-1">
                {datasets.map(ds => (
                  <button
                    key={ds.id}
                    onClick={() => {
                      onSelectDataset(ds.id);
                      setDropdownOpen(false);
                    }}
                    className={`w-full text-left px-2.5 py-2 rounded-lg text-xs flex items-center justify-between transition-colors ${
                      currentProfile?.id === ds.id
                        ? 'bg-blue-600/15 text-blue-300 font-medium border border-blue-500/20'
                        : 'text-slate-300 hover:bg-slate-800/60'
                    }`}
                  >
                    <div className="truncate mr-2">
                      <div className="truncate font-medium">{ds.filename}</div>
                      <div className="text-[10px] text-slate-500">
                        {ds.rowCount.toLocaleString()} rows • {ds.columnCount} cols
                      </div>
                    </div>
                    {ds.isSample && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                        Sample
                      </span>
                    )}
                  </button>
                ))}
              </div>
              <div className="pt-1.5 mt-1 border-t border-slate-800">
                <button
                  onClick={() => {
                    setDropdownOpen(false);
                    onOpenUpload();
                  }}
                  className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs text-blue-400 hover:bg-blue-950/40 flex items-center gap-1.5 font-medium"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Upload new file...
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Global Natural Language Input */}
      <div className="hidden lg:flex flex-1 max-w-md mx-6">
        <form onSubmit={handleQuickSubmit} className="w-full relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Ask anything about your data... (e.g., top regions by profit margin)"
            value={quickInput}
            onChange={e => setQuickInput(e.target.value)}
            className="w-full bg-slate-900/80 border border-slate-800/90 rounded-full pl-9 pr-24 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors shadow-inner"
          />
          <button
            type="submit"
            className="absolute right-1.5 top-1/2 -translate-y-1/2 px-2.5 py-0.5 rounded-full bg-blue-600 hover:bg-blue-500 text-[11px] font-medium text-white transition-colors shadow-sm"
          >
            Ask AI
          </button>
        </form>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-2">
        {qualityScore !== undefined && (
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-900 border border-slate-800 text-xs">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-slate-400">Quality:</span>
            <span className="font-semibold text-slate-200 font-mono">{qualityScore}/100</span>
          </div>
        )}

        <button
          onClick={onLoadSample}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs text-slate-300 transition-colors"
          title="Reload realistic B2B sales sample dataset"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-slate-400 ${loading ? 'animate-spin' : ''}`} />
          <span className="hidden sm:inline">Try Sample</span>
        </button>

        <button
          onClick={onOpenUpload}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-medium text-white transition-colors shadow-sm shadow-blue-500/20"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Upload Dataset</span>
        </button>

        {currentProfile && (
          <button
            onClick={handleExport}
            className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
            title="Download CSV"
          >
            <Download className="w-4 h-4" />
          </button>
        )}
      </div>
    </header>
  );
};
