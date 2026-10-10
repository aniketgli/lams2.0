import React, { useState, useRef } from 'react';
import { UploadCloud, File, FileText, CheckCircle2, AlertCircle, X, Trash2 } from 'lucide-react';
import { Button } from './Button';

export interface UploadedFileItem {
  id: string;
  file: globalThis.File;
  name: string;
  size: number;
  type: string;
  progress?: number;
  error?: string;
  url?: string;
}

export interface FileUploadProps {
  label?: string;
  helperText?: string;
  accept?: string;
  maxSizeMB?: number;
  multiple?: boolean;
  value?: UploadedFileItem[];
  onChange?: (files: UploadedFileItem[]) => void;
  disabled?: boolean;
  required?: boolean;
  className?: string;
}

export const FileUpload: React.FC<FileUploadProps> = ({
  label,
  helperText,
  accept = '.pdf,.doc,.docx,.jpg,.jpeg,.png',
  maxSizeMB = 10,
  multiple = false,
  value = [],
  onChange,
  disabled = false,
  required = false,
  className = ''
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [internalError, setInternalError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  const handleFiles = (incomingFiles: FileList | null) => {
    if (!incomingFiles || incomingFiles.length === 0) return;
    setInternalError(null);

    const maxBytes = maxSizeMB * 1024 * 1024;
    const validItems: UploadedFileItem[] = [];

    for (let i = 0; i < incomingFiles.length; i++) {
      const file = incomingFiles[i];

      if (file.size > maxBytes) {
        setInternalError(`File "${file.name}" exceeds the maximum size of ${maxSizeMB}MB.`);
        continue;
      }

      validItems.push({
        id: `${file.name}-${Date.now()}-${Math.random()}`,
        file,
        name: file.name,
        size: file.size,
        type: file.type,
        progress: 100
      });

      if (!multiple) break;
    }

    if (validItems.length > 0 && onChange) {
      const updated = multiple ? [...value, ...validItems] : validItems;
      onChange(updated);
    }
  };

  const handleRemove = (id: string) => {
    if (onChange) {
      onChange(value.filter((item) => item.id !== id));
    }
  };

  return (
    <div className={`space-y-2 ${className}`}>
      {label && (
        <label className="block text-xs font-semibold text-slate-700 select-none">
          {label}
          {required && <span className="text-rose-500 ml-0.5">*</span>}
        </label>
      )}

      {/* Drag & Drop Zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragOver(false);
          if (!disabled) handleFiles(e.dataTransfer.files);
        }}
        onClick={() => {
          if (!disabled && inputRef.current) inputRef.current.click();
        }}
        className={`border-2 border-dashed rounded-xl p-5 text-center transition-all cursor-pointer select-none flex flex-col items-center justify-center ${
          disabled
            ? 'bg-slate-50 border-slate-200 cursor-not-allowed opacity-60'
            : isDragOver
            ? 'bg-[#eff6ff] border-[#2563eb] ring-2 ring-[#2563eb]/10'
            : 'bg-white hover:bg-slate-50 border-slate-300 hover:border-slate-400'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          disabled={disabled}
          onChange={(e) => handleFiles(e.target.files)}
          className="hidden"
        />

        <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 text-slate-600 flex items-center justify-center mb-2 shadow-2xs">
          <UploadCloud className="w-5 h-5 text-slate-600" />
        </div>

        <p className="text-xs font-bold text-slate-800">
          <span className="text-[#2563eb] hover:underline">Click to browse</span> or drag and drop files here
        </p>
        <p className="text-[11px] text-slate-400 mt-0.5">
          Supported files: {accept.replace(/\./g, '').toUpperCase()} (Max {maxSizeMB}MB)
        </p>
      </div>

      {internalError && (
        <p className="text-[11px] font-semibold text-rose-600 flex items-center gap-1">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>{internalError}</span>
        </p>
      )}

      {helperText && !internalError && (
        <p className="text-[11px] font-normal text-slate-500 leading-tight">
          {helperText}
        </p>
      )}

      {/* Selected File List */}
      {value.length > 0 && (
        <div className="space-y-1.5 pt-1">
          {value.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-200/90 rounded-lg text-xs"
            >
              <div className="flex items-center space-x-2.5 min-w-0 pr-2">
                <div className="w-7 h-7 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-600 shrink-0">
                  {item.name.endsWith('.pdf') ? (
                    <FileText className="w-4 h-4 text-rose-600" />
                  ) : (
                    <File className="w-4 h-4 text-slate-600" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-slate-800 truncate">{item.name}</p>
                  <p className="text-[10px] text-slate-400 font-mono">{formatFileSize(item.size)}</p>
                </div>
              </div>

              {!disabled && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemove(item.id);
                  }}
                  className="p-1 text-slate-400 hover:text-rose-600 hover:bg-white rounded transition-colors cursor-pointer"
                  title="Remove file"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
