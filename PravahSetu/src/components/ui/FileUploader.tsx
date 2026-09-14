import React, { useState, useRef, ChangeEvent, DragEvent } from 'react';
import { UploadCloud, FileText, Image as ImageIcon, Trash2, CheckCircle2, AlertCircle, Eye } from 'lucide-react';
import { EvidenceFile } from '../../types';
import { cn } from '../../utils/cn';

interface FileUploaderProps {
  files: EvidenceFile[];
  onFilesChange: (files: EvidenceFile[]) => void;
  maxFiles?: number;
  maxSizeBytes?: number;
}

export const FileUploader: React.FC<FileUploaderProps> = ({
  files,
  onFilesChange,
  maxFiles = 5,
  maxSizeBytes = 10 * 1024 * 1024, // 10MB
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadingFiles, setUploadingFiles] = useState<{ [id: string]: number }>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFiles = (fileList: FileList) => {
    setUploadError(null);

    if (files.length + fileList.length > maxFiles) {
      setUploadError(`You can upload a maximum of ${maxFiles} evidence files.`);
      return;
    }

    const newEvidenceItems: EvidenceFile[] = [];

    Array.from(fileList).forEach((file) => {
      if (file.size > maxSizeBytes) {
        setUploadError(`File "${file.name}" exceeds the 10MB limit.`);
        return;
      }

      const tempId = `ev-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const objectUrl = file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined;

      // Simulate upload progress
      setUploadingFiles((prev) => ({ ...prev, [tempId]: 15 }));
      const interval = setInterval(() => {
        setUploadingFiles((prev) => {
          const current = prev[tempId] || 0;
          if (current >= 100) {
            clearInterval(interval);
            return prev;
          }
          return { ...prev, [tempId]: current + 25 };
        });
      }, 100);

      newEvidenceItems.push({
        id: tempId,
        name: file.name,
        size: file.size,
        type: file.type || 'application/octet-stream',
        url: objectUrl,
        uploadedAt: new Date().toISOString(),
      });
    });

    if (newEvidenceItems.length > 0) {
      onFilesChange([...files, ...newEvidenceItems]);
    }
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files);
    }
  };

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(e.target.files);
    }
  };

  const handleRemove = (id: string) => {
    onFilesChange(files.filter((f) => f.id !== id));
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="w-full text-left space-y-4">
      {/* Drop Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={cn(
          'border-2 border-dashed rounded-2xl p-6 sm:p-8 text-center cursor-pointer transition-all duration-200',
          isDragging
            ? 'border-cyber-500 bg-cyber-50/60 ring-4 ring-cyber-100'
            : 'border-slate-300 hover:border-cyber-400 bg-slate-50/50 hover:bg-slate-50'
        )}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*,.pdf,.doc,.docx,.txt"
          onChange={handleInputChange}
          className="hidden"
          aria-label="Upload evidence files"
        />

        <div className="flex flex-col items-center justify-center">
          <div className="w-14 h-14 rounded-2xl bg-cyber-100 text-cyber-600 flex items-center justify-center mb-3 shadow-sm">
            <UploadCloud className="w-7 h-7" />
          </div>
          <h4 className="text-sm sm:text-base font-bold text-slate-800 tracking-tight">
            Click to upload evidence or drag and drop
          </h4>
          <p className="text-xs text-slate-500 mt-1 max-w-sm">
            Upload transaction receipts, bank messages, fake SMS screenshots, chat exports, or fraudulent links (PNG, JPG, PDF up to 10MB each)
          </p>
          <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white border border-slate-200 text-slate-600 text-xs font-medium shadow-2xs">
            <span>Maximum {maxFiles} files</span>
            <span>•</span>
            <span>Up to 10MB per file</span>
          </div>
        </div>
      </div>

      {uploadError && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{uploadError}</span>
        </div>
      )}

      {/* File List */}
      {files.length > 0 && (
        <div className="space-y-2.5">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Attached Evidence ({files.length}/{maxFiles})
          </p>
          <div className="grid grid-cols-1 gap-2.5">
            {files.map((file) => {
              const isImage = file.type.startsWith('image/');
              const progress = uploadingFiles[file.id] || 100;
              const isFinished = progress >= 100;

              return (
                <div
                  key={file.id}
                  className="flex items-center justify-between p-3.5 bg-white rounded-xl border border-slate-200 shadow-2xs hover:shadow-subtle transition-all"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600 shrink-0 overflow-hidden">
                      {isImage && file.url ? (
                        <img src={file.url} alt={file.name} className="w-full h-full object-cover" />
                      ) : isImage ? (
                        <ImageIcon className="w-5 h-5 text-cyber-600" />
                      ) : (
                        <FileText className="w-5 h-5 text-amber-600" />
                      )}
                    </div>
                    <div className="min-w-0 pr-2">
                      <p className="text-xs sm:text-sm font-semibold text-slate-800 truncate">
                        {file.name}
                      </p>
                      <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5">
                        <span>{formatFileSize(file.size)}</span>
                        <span>•</span>
                        {isFinished ? (
                          <span className="text-emerald-600 flex items-center gap-1 font-medium">
                            <CheckCircle2 className="w-3 h-3" /> Ready
                          </span>
                        ) : (
                          <span className="text-cyber-600 font-medium">
                            Uploading {progress}%
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {file.url && (
                      <a
                        href={file.url}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition"
                        title="Preview"
                      >
                        <Eye className="w-4 h-4" />
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={() => handleRemove(file.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition"
                      title="Remove file"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
