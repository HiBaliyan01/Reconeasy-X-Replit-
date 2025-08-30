import React, { useState, useRef } from 'react';
import { Upload, Download, CheckCircle, AlertCircle, Loader2, FileText, X } from 'lucide-react';
import Papa from 'papaparse';

interface SettlementUploaderProps {
  onUploadComplete: () => void;
  marketplace?: string;
}

interface UploadResult {
  success: boolean;
  message: string;
  processed?: number;
  errors?: number;
  errorRows?: Array<{ row: any; error: string }>;
}

export function SettlementUploader({ onUploadComplete, marketplace }: SettlementUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [showErrors, setShowErrors] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setUploadResult(null);
      setProgress(0);
    }
  };

  const clearFile = () => {
    setSelectedFile(null);
    setUploadResult(null);
    setProgress(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setUploading(true);
    setProgress(10);

    try {
      // Parse CSV
      const parseResult = await new Promise<Papa.ParseResult<any>>((resolve, reject) => {
        Papa.parse(selectedFile, {
          header: true,
          skipEmptyLines: true,
          complete: resolve,
          error: reject
        });
      });

      setProgress(30);

      if (parseResult.errors.length > 0) {
        throw new Error(`CSV parsing error: ${parseResult.errors[0].message}`);
      }

      const rows = parseResult.data;
      if (rows.length === 0) {
        throw new Error('CSV file is empty or contains no valid data');
      }

      setProgress(50);

      // Upload to server
      const response = await fetch('/api/settlements/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ rows, marketplace }),
      });

      const result = await response.json();
      setProgress(90);

      if (!response.ok) {
        throw new Error(result.error || 'Upload failed');
      }

      setProgress(100);
      setUploadResult({
        success: true,
        message: result.message,
        processed: result.processed,
        errors: result.errors,
        errorRows: result.errorRows
      });

      onUploadComplete();

    } catch (error) {
      console.error('Upload error:', error);
      setUploadResult({
        success: false,
        message: error instanceof Error ? error.message : 'Upload failed',
      });

      console.error('Upload failed:', error);
    } finally {
      setUploading(false);
      setTimeout(() => setProgress(0), 1000);
    }
  };

  const downloadTemplate = () => {
    const link = document.createElement('a');
    link.href = '/template/settlement_template.csv';
    link.download = 'settlement_template.csv';
    link.click();
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <Upload className="w-5 h-5" />
          {marketplace ? `${marketplace.charAt(0).toUpperCase() + marketplace.slice(1)} Settlement Upload` : 'Settlement CSV Upload'}
        </h3>
        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
          {marketplace 
            ? `Upload ${marketplace.charAt(0).toUpperCase() + marketplace.slice(1)} settlement data from CSV files. Missing dates will be auto-filled with today's date.`
            : 'Upload settlement data from CSV files. Missing dates will be auto-filled with today\'s date.'
          }
        </p>
      </div>
      <div className="space-y-6">
        {/* Template Download */}
        <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
          <div className="flex items-center gap-3">
            <FileText className="w-5 h-5 text-slate-600 dark:text-slate-400" />
            <div>
              <p className="text-sm font-medium text-slate-900 dark:text-slate-100">CSV Template</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Download template with required columns
              </p>
            </div>
          </div>
          <button
            onClick={downloadTemplate}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-600 transition-colors"
          >
            <Download className="w-4 h-4" />
            Download Template
          </button>
        </div>

        {/* File Upload */}
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileSelect}
                className="hidden"
                id="csv-upload"
              />
              <label
                htmlFor="csv-upload"
                className="flex items-center justify-center w-full h-32 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg cursor-pointer hover:border-slate-400 dark:hover:border-slate-500 transition-colors"
              >
                <div className="text-center">
                  <Upload className="w-8 h-8 mx-auto mb-2 text-slate-400" />
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    Click to select CSV file
                  </p>
                </div>
              </label>
            </div>
          </div>

          {selectedFile && (
            <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <div className="flex items-center gap-3">
                <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                <div>
                  <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                    {selectedFile.name}
                  </p>
                  <p className="text-xs text-blue-600 dark:text-blue-400">
                    {(selectedFile.size / 1024).toFixed(2)} KB
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleUpload}
                  disabled={uploading}
                  className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center gap-2"
                >
                  {uploading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4" />
                      Upload
                    </>
                  )}
                </button>
                <button
                  onClick={clearFile}
                  disabled={uploading}
                  className="px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Progress Bar */}
          {uploading && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-slate-600 dark:text-slate-400">Processing...</span>
                <span className="text-slate-600 dark:text-slate-400">{progress}%</span>
              </div>
              <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                <div 
                  className="bg-gradient-to-r from-blue-600 to-purple-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {/* Results */}
          {uploadResult && (
            <div className="space-y-4">
              <div className={`p-4 rounded-lg border ${uploadResult.success ? "border-green-200 bg-green-50 dark:bg-green-900/20" : "border-red-200 bg-red-50 dark:bg-red-900/20"}`}>
                <div className="flex items-center gap-2">
                  {uploadResult.success ? (
                    <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
                  )}
                  <p className={`text-sm font-medium ${uploadResult.success ? "text-green-800 dark:text-green-200" : "text-red-800 dark:text-red-200"}`}>
                    {uploadResult.message}
                  </p>
                </div>
              </div>

              {uploadResult.success && uploadResult.processed && (
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-lg">
                    <p className="font-medium text-green-800 dark:text-green-200">Processed</p>
                    <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                      {uploadResult.processed}
                    </p>
                  </div>
                  {uploadResult.errors && uploadResult.errors > 0 && (
                    <div className="p-3 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
                      <p className="font-medium text-amber-800 dark:text-amber-200">Errors</p>
                      <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                        {uploadResult.errors}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {uploadResult.errorRows && uploadResult.errorRows.length > 0 && (
                <div className="space-y-2">
                  <button
                    onClick={() => setShowErrors(!showErrors)}
                    className="w-full px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-600 transition-colors"
                  >
                    {showErrors ? 'Hide' : 'Show'} Error Details ({uploadResult.errorRows.length})
                  </button>
                  
                  {showErrors && (
                    <div className="max-h-40 overflow-y-auto space-y-2">
                      {uploadResult.errorRows.map((errorRow, index) => (
                        <div key={index} className="p-2 bg-red-50 dark:bg-red-900/20 rounded text-sm">
                          <p className="font-medium text-red-800 dark:text-red-200">
                            Row {index + 1}: {errorRow.error}
                          </p>
                          <p className="text-red-600 dark:text-red-400 truncate">
                            {JSON.stringify(errorRow.row)}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}