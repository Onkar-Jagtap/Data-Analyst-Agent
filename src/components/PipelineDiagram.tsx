import React from 'react';
import {
  BrainCircuit,
  Calculator,
  CheckCircle2,
  FileSpreadsheet,
  LineChart,
  ShieldAlert,
  Sparkles,
  UploadCloud,
} from 'lucide-react';

export const PipelineDiagram: React.FC = () => {
  const steps = [
    { label: 'Upload', icon: <UploadCloud className="w-3.5 h-3.5" />, desc: 'CSV / Excel' },
    { label: 'Profile', icon: <FileSpreadsheet className="w-3.5 h-3.5" />, desc: 'Types & Stats' },
    { label: 'Quality Audit', icon: <ShieldAlert className="w-3.5 h-3.5" />, desc: '0-100 Score' },
    { label: 'AI Plan', icon: <BrainCircuit className="w-3.5 h-3.5 text-purple-400" />, desc: 'Intent Schema' },
    { label: 'Python Math', icon: <Calculator className="w-3.5 h-3.5 text-blue-400" />, desc: 'Deterministic' },
    { label: 'Validation', icon: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />, desc: 'Finite Bounds' },
    { label: 'Plotly Viz', icon: <LineChart className="w-3.5 h-3.5 text-amber-400" />, desc: 'Interactive' },
    { label: 'Insight', icon: <Sparkles className="w-3.5 h-3.5 text-indigo-400" />, desc: 'Executive Takeaway' },
  ];

  return (
    <div className="w-full p-3 rounded-xl bg-slate-900/40 border border-slate-800/80 my-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
          End-to-End Analytical Processing Pipeline
        </span>
        <span className="text-[10px] text-slate-500 font-mono">
          Strict Separation: AI Reasons • Code Computes
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
        {steps.map((step, idx) => (
          <div
            key={step.label}
            className="flex flex-col items-center text-center p-2 rounded-lg bg-slate-950/60 border border-slate-800/60 relative group hover:border-slate-700 transition-colors"
          >
            <div className="w-7 h-7 rounded-md bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-300 mb-1.5 shadow-sm">
              {step.icon}
            </div>
            <div className="text-xs font-semibold text-slate-200 truncate w-full">{step.label}</div>
            <div className="text-[10px] text-slate-400 truncate w-full">{step.desc}</div>

            {idx < steps.length - 1 && (
              <div className="hidden lg:block absolute -right-2 top-1/2 -translate-y-1/2 z-10 text-slate-600 font-mono text-xs">
                →
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
