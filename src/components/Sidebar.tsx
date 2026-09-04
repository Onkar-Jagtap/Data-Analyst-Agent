import React from 'react';
import {
  BarChart3,
  Calculator,
  ChevronLeft,
  ChevronRight,
  Database,
  FileSpreadsheet,
  FileText,
  LayoutDashboard,
  LayoutGrid,
  MessageSquareCode,
  ShieldCheck,
  Sparkles,
  Table,
  Wand2,
} from 'lucide-react';
import { ActiveTab, DatasetProfile } from '../types.js';

interface SidebarProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  profile: DatasetProfile | null;
  qualityScore?: number;
  insightsCount?: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  collapsed,
  onToggleCollapse,
  profile,
  qualityScore,
  insightsCount = 0,
}) => {
  const navItems: { id: ActiveTab; label: string; icon: React.ReactNode; badge?: string | number }[] = [
    {
      id: 'overview',
      label: 'Overview',
      icon: <LayoutDashboard className="w-4 h-4" />,
    },
    {
      id: 'dashboard',
      label: 'BI Dashboard',
      icon: <LayoutGrid className="w-4 h-4" />,
      badge: 'KPIs',
    },
    {
      id: 'report',
      label: 'Full Report',
      icon: <FileText className="w-4 h-4 text-emerald-400" />,
      badge: 'Strategy',
    },
    {
      id: 'profile',
      label: 'Data Profile',
      icon: <FileSpreadsheet className="w-4 h-4" />,
      badge: profile ? profile.columnCount : undefined,
    },
    {
      id: 'quality',
      label: 'Data Quality',
      icon: <ShieldCheck className="w-4 h-4" />,
      badge: qualityScore !== undefined ? `${qualityScore}` : undefined,
    },
    {
      id: 'insights',
      label: 'Executive Insights',
      icon: <Sparkles className="w-4 h-4" />,
      badge: insightsCount > 0 ? insightsCount : undefined,
    },
    {
      id: 'ask',
      label: 'Ask Data (AI)',
      icon: <MessageSquareCode className="w-4 h-4" />,
    },
    {
      id: 'studio',
      label: 'Visual Studio',
      icon: <BarChart3 className="w-4 h-4" />,
    },
    {
      id: 'transform',
      label: 'Transform Studio',
      icon: <Calculator className="w-4 h-4" />,
      badge: 'Formulas',
    },
    {
      id: 'explorer',
      label: 'Data Explorer',
      icon: <Table className="w-4 h-4" />,
    },
    {
      id: 'cleaner',
      label: 'Cleaning Assistant',
      icon: <Wand2 className="w-4 h-4" />,
    },
  ];

  return (
    <aside
      className={`border-r border-slate-800/80 bg-slate-950/60 flex flex-col justify-between transition-all duration-200 z-20 shrink-0 ${
        collapsed ? 'w-16' : 'w-60'
      }`}
    >
      <div className="p-3 space-y-1">
        <div className="flex items-center justify-between px-2 py-1.5 mb-2">
          {!collapsed && (
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Navigation
            </span>
          )}
          <button
            onClick={onToggleCollapse}
            className="p-1 rounded-md text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition-colors ml-auto"
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
          </button>
        </div>

        {navItems.map(item => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                isActive
                  ? 'bg-blue-600/15 text-blue-400 border border-blue-500/20 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/70 border border-transparent'
              }`}
              title={collapsed ? item.label : undefined}
            >
              <div className={isActive ? 'text-blue-400' : 'text-slate-400'}>{item.icon}</div>
              {!collapsed && (
                <div className="flex items-center justify-between flex-1">
                  <span className="truncate">{item.label}</span>
                  {item.badge !== undefined && (
                    <span
                      className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                        isActive
                          ? 'bg-blue-500/20 text-blue-300'
                          : 'bg-slate-800/80 text-slate-400'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Dataset Footprint Summary */}
      {!collapsed && profile && (
        <div className="p-3 m-3 rounded-lg bg-slate-900/60 border border-slate-800/80 text-[11px] text-slate-400 space-y-1.5">
          <div className="flex items-center gap-1.5 text-slate-300 font-medium">
            <Database className="w-3 h-3 text-blue-400" />
            <span className="truncate">{profile.filename}</span>
          </div>
          <div className="grid grid-cols-2 gap-1 text-[10px] text-slate-400 font-mono pt-1 border-t border-slate-800">
            <div>
              <span className="text-slate-500">Rows: </span>
              {profile.rowCount.toLocaleString()}
            </div>
            <div>
              <span className="text-slate-500">Cols: </span>
              {profile.columnCount}
            </div>
            <div>
              <span className="text-slate-500">Missing: </span>
              {profile.missingPercentage}%
            </div>
            <div>
              <span className="text-slate-500">Memory: </span>
              {profile.memoryEstimateKb} KB
            </div>
          </div>
        </div>
      )}
      {/* Brand Footer */}
      <div className="p-3 border-t border-slate-900/80 bg-slate-950/40">
        {!collapsed ? (
          <div className="flex items-center justify-between text-[11px]">
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="font-semibold text-slate-300 tracking-tight">Data Studio</span>
            </div>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-300 border border-blue-500/20">
              by PJA
            </span>
          </div>
        ) : (
          <div className="text-center font-bold text-[9px] text-blue-400 py-0.5">
            PJA
          </div>
        )}
      </div>
    </aside>
  );
};
