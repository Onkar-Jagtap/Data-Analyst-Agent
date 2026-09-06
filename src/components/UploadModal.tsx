import React, { useState, useRef } from 'react';
import {
  AlertCircle,
  Building2,
  CheckCircle2,
  FileSpreadsheet,
  Layers,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
  UploadCloud,
  X,
} from 'lucide-react';
import { loadEnterpriseCompanySuite, uploadBatchDatasets, uploadDataset } from '../api.js';
import { DataQualityAudit, DatasetProfile, InsightItem } from '../types.js';

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadSuccess: (data: { datasetId: string; profile: DatasetProfile; quality: DataQualityAudit; insights: InsightItem[] }) => void;
  onBatchUploadSuccess?: (count: number) => void;
  onSwitchToCompany360?: () => void;
}

export const UploadModal: React.FC<UploadModalProps> = ({
  isOpen,
  onClose,
  onUploadSuccess,
  onBatchUploadSuccess,
  onSwitchToCompany360,
}) => {
  const [dragActive, setDragActive] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingSuite, setLoadingSuite] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      validateAndAddFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files.length > 0) {
      validateAndAddFiles(Array.from(e.target.files));
    }
  };

  const validateAndAddFiles = (files: File[]) => {
    setErrorMessage(null);
    const validExtensions = ['.csv', '.xlsx', '.xls'];
    const validFiles: File[] = [];

    for (const f of files) {
      const lower = f.name.toLowerCase();
      const isValid = validExtensions.some(ext => lower.endsWith(ext));
      if (!isValid) {
        setErrorMessage('One or more files have unsupported formats. Only CSV, XLSX, and XLS are supported.');
        return;
      }
      if (f.size > 50 * 1024 * 1024) {
        setErrorMessage(`"${f.name}" exceeds the 50MB limit.`);
        return;
      }
      validFiles.push(f);
    }

    setSelectedFiles(prev => {
      // Avoid duplicate filenames
      const existingNames = new Set(prev.map(p => p.name));
      const newUnique = validFiles.filter(f => !existingNames.has(f.name));
      return [...prev, ...newUnique];
    });
  };

  const removeFile = (idx: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== idx));
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) return;
    setLoading(true);
    setErrorMessage(null);

    try {
      if (selectedFiles.length === 1) {
        const result = await uploadDataset(selectedFiles[0]);
        onUploadSuccess(result);
        onClose();
      } else {
        const batchResult = await uploadBatchDatasets(selectedFiles);
        if (onBatchUploadSuccess) {
          onBatchUploadSuccess(batchResult.uploadedCount);
        }
        if (onSwitchToCompany360) {
          onSwitchToCompany360();
        }
        onClose();
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'File upload failed. Please verify file integrity.');
    } finally {
      setLoading(false);
    }
  };

  const handleLoadEnterpriseSuite = async () => {
    setLoadingSuite(true);
    setErrorMessage(null);
    try {
      const suite = await loadEnterpriseCompanySuite();
      if (onBatchUploadSuccess) {
        onBatchUploadSuccess(suite.datasets.length);
      }
      if (onSwitchToCompany360) {
        onSwitchToCompany360();
      }
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to load enterprise suite.');
    } finally {
      setLoadingSuite(false);
    }
  };

  const getDepartmentTag = (name: string) => {
    const lower = name.toLowerCase();
    if (lower.includes('lead')) return { label: 'Leads', color: 'text-amber-400 bg-amber-950/40 border-amber-800/50' };
    if (lower.includes('market') || lower.includes('spend')) return { label: 'Marketing', color: 'text-purple-400 bg-purple-950/40 border-purple-800/50' };
    if (lower.includes('sale') || lower.includes('order')) return { label: 'Sales', color: 'text-blue-400 bg-blue-950/40 border-blue-800/50' };
    if (lower.includes('operat') || lower.includes('ship') || lower.includes('fulfill')) return { label: 'Operations', color: 'text-cyan-400 bg-cyan-950/40 border-cyan-800/50' };
    if (lower.includes('finan') || lower.includes('cogs') || lower.includes('margin')) return { label: 'Finance', color: 'text-emerald-400 bg-emerald-950/40 border-emerald-800/50' };
    return { label: 'General', color: 'text-slate-400 bg-slate-800/50 border-slate-700' };
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/70">
          <div className="flex items-center gap-2">
            <UploadCloud className="w-4 h-4 text-blue-400" />
            <h3 className="text-sm font-bold text-slate-100">Upload Dataset(s) • Enterprise Multi-File</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-4 overflow-y-auto">
          {/* Quick 1-Click Enterprise Suite Button */}
          <div className="p-3.5 rounded-xl bg-gradient-to-r from-blue-950/40 via-indigo-950/30 to-purple-950/40 border border-blue-800/50 flex items-center justify-between gap-3">
            <div className="space-y-0.5">
              <div className="flex items-center gap-1.5 text-xs font-bold text-blue-200">
                <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                <span>Want to test Cross-Department 360° Analysis?</span>
              </div>
              <p className="text-[11px] text-slate-400">
                Load 5 coordinated sample datasets: Leads, Marketing, Sales, Operations & Finance.
              </p>
            </div>
            <button
              onClick={handleLoadEnterpriseSuite}
              disabled={loadingSuite || loading}
              className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-semibold whitespace-nowrap flex items-center gap-1.5 transition-colors shadow-sm shadow-blue-500/20"
            >
              {loadingSuite ? (
                <>
                  <RefreshCw className="w-3 h-3 animate-spin" />
                  <span>Loading Suite...</span>
                </>
              ) : (
                <>
                  <Building2 className="w-3 h-3" />
                  <span>Load 5-Dept Suite</span>
                </>
              )}
            </button>
          </div>

          {/* Dropzone */}
          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all flex flex-col items-center justify-center ${
              dragActive
                ? 'border-blue-500 bg-blue-950/20'
                : 'border-slate-800 hover:border-slate-700 bg-slate-950/50'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              multiple
              onChange={handleChange}
              className="hidden"
            />

            <div className="w-11 h-11 rounded-full bg-blue-600/10 border border-blue-500/20 flex items-center justify-center text-blue-400 mb-2.5">
              <UploadCloud className="w-5 h-5" />
            </div>

            <div className="text-sm font-semibold text-slate-200">
              Drag and drop files here, or click to browse
            </div>
            <div className="text-xs text-slate-400 mt-1">
              Select one or multiple CSV / Excel files (e.g. Sales, Marketing, Ops, Finance, Leads)
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">
              Up to 50MB per file
            </div>
          </div>

          {/* Selected Files List */}
          {selectedFiles.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-400 font-semibold px-1">
                <span className="flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-blue-400" />
                  Selected Files ({selectedFiles.length})
                </span>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="text-blue-400 hover:text-blue-300 flex items-center gap-1 text-[11px]"
                >
                  <Plus className="w-3 h-3" />
                  Add more
                </button>
              </div>

              <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                {selectedFiles.map((file, idx) => {
                  const tag = getDepartmentTag(file.name);
                  return (
                    <div
                      key={`${file.name}-${idx}`}
                      className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80 flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <FileSpreadsheet className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="font-medium text-slate-200 truncate">{file.name}</span>
                        <span className="text-[10px] text-slate-500 font-mono shrink-0">
                          ({(file.size / 1024).toFixed(1)} KB)
                        </span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${tag.color}`}>
                          {tag.label}
                        </span>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeFile(idx);
                        }}
                        className="text-slate-500 hover:text-red-400 p-1 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {errorMessage && (
            <div className="p-3 rounded-lg bg-red-950/30 border border-red-900/40 text-xs text-red-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800/80 text-[11px] text-slate-400 space-y-1">
            <div className="font-semibold text-slate-300 flex items-center gap-1">
              <Building2 className="w-3 h-3 text-blue-400" />
              <span>Enterprise 360° Automated Linking:</span>
            </div>
            <div>• Auto-detects department roles (Sales, Marketing, Operations, Finance, Leads).</div>
            <div>• Discovers common relational keys (<span className="font-mono text-slate-300">order_id</span>, <span className="font-mono text-slate-300">lead_id</span>, <span className="font-mono text-slate-300">campaign</span>) with join match percentages.</div>
            <div>• Calculates true bottom-line profitability waterfall, blended CAC, and cross-department OKRs.</div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/80 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleUpload}
            disabled={selectedFiles.length === 0 || loading || loadingSuite}
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-600 text-xs font-bold text-white transition-colors flex items-center gap-2 shadow-sm shadow-blue-500/20"
          >
            {loading ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Processing {selectedFiles.length} file{selectedFiles.length > 1 ? 's' : ''}...</span>
              </>
            ) : (
              <>
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>
                  Upload {selectedFiles.length > 0 ? `${selectedFiles.length} File${selectedFiles.length > 1 ? 's' : ''}` : 'Files'}
                </span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

