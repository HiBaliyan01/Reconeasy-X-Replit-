import React, { useState } from 'react';
import Papa from 'papaparse';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';

interface SettlementUploaderProps {
  onUploadComplete: () => void;
}

interface UploadProgress {
  total: number;
  processed: number;
  errors: string[];
}

export function SettlementUploader({ onUploadComplete }: SettlementUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<UploadProgress>({ total: 0, processed: 0, errors: [] });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setProgress({ total: 0, processed: 0, errors: [] });

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const totalRows = results.data.length;
        setProgress(prev => ({ ...prev, total: totalRows }));

        const validRows = [];
        const errors: string[] = [];

        for (const [i, row] of results.data.entries()) {
          try {
            // Auto-fill today's date if missing
            const payload = {
              order_id: (row as any).order_id,
              marketplace: (row as any).marketplace,
              category: (row as any).category,
              mrp: Number((row as any).mrp),
              actual_settlement_amount: Number((row as any).actual_settlement_amount),
              date: (row as any).date || format(new Date(), 'yyyy-MM-dd')
            };

            // Validate required fields
            if (!payload.order_id || !payload.marketplace || !payload.category || 
                isNaN(payload.mrp) || isNaN(payload.actual_settlement_amount)) {
              errors.push(`Row ${i + 2}: Missing or invalid required fields`);
              setProgress(prev => ({ ...prev, processed: prev.processed + 1, errors: [...prev.errors, `Row ${i + 2}: Missing or invalid required fields`] }));
              continue;
            }

            // Call prediction API
            const predictionRes = await fetch('/api/predict-reco', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload)
            });

            if (!predictionRes.ok) {
              const errorText = await predictionRes.text();
              errors.push(`Row ${i + 2}: Prediction failed - ${errorText}`);
              setProgress(prev => ({ ...prev, processed: prev.processed + 1, errors: [...prev.errors, `Row ${i + 2}: Prediction failed`] }));
              continue;
            }

            const predictionData = await predictionRes.json();
            validRows.push({ 
              ...payload, 
              predicted_settlement_amount: predictionData.expected_payout || payload.actual_settlement_amount,
              variance: predictionData.delta || 0,
              variance_percentage: predictionData.delta ? ((predictionData.delta / payload.actual_settlement_amount) * 100) : 0
            });

            setProgress(prev => ({ ...prev, processed: prev.processed + 1 }));
          } catch (err) {
            const errorMsg = `Row ${i + 2}: Processing failed - ${err instanceof Error ? err.message : 'Unknown error'}`;
            errors.push(errorMsg);
            setProgress(prev => ({ ...prev, processed: prev.processed + 1, errors: [...prev.errors, errorMsg] }));
          }
        }

        // Upload valid settlements to backend
        if (validRows.length > 0) {
          try {
            const uploadRes = await fetch('/api/settlements', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ settlements: validRows })
            });

            if (!uploadRes.ok) {
              errors.push('Failed to save settlements to database');
            }
          } catch (err) {
            errors.push('Failed to save settlements to database');
          }
        }

        setProgress(prev => ({ ...prev, errors }));
        setUploading(false);
        onUploadComplete();
      }
    });
  };

  const downloadTemplate = () => {
    const headers = [
      'order_id', 'marketplace', 'category', 'mrp', 'actual_settlement_amount', 'date'
    ];
    const sampleRow = [
      'ORDER001', 'Amazon', 'Electronics', '1000', '850', '2025-07-18'
    ];
    const csvContent = headers.join(',') + '\n' + sampleRow.join(',') + '\n';
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'settlement_template.csv';
    link.click();
  };

  const progressPercentage = progress.total > 0 ? (progress.processed / progress.total) * 100 : 0;

  return (
    <div className="border border-slate-200 dark:border-slate-700 p-6 rounded-xl bg-white dark:bg-slate-800 shadow-lg">
      <h3 className="text-lg font-semibold mb-4 text-slate-900 dark:text-slate-100">
        Upload Settlement Report (CSV)
      </h3>
      
      <div className="space-y-4">
        <div className="flex items-center space-x-3">
          <input 
            type="file" 
            accept=".csv" 
            onChange={handleFileUpload} 
            disabled={uploading}
            className="file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-teal-50 file:text-teal-700 hover:file:bg-teal-100 file:cursor-pointer cursor-pointer"
          />
          <Button 
            onClick={downloadTemplate}
            variant="outline"
            disabled={uploading}
          >
            Download Template
          </Button>
        </div>

        {uploading && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm text-slate-600 dark:text-slate-400">
              <span>Processing settlements...</span>
              <span>{progress.processed} / {progress.total}</span>
            </div>
            <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
              <div 
                className="bg-gradient-to-r from-teal-500 to-emerald-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progressPercentage}%` }}
              />
            </div>
            <p className="text-sm text-blue-600 dark:text-blue-400">
              {progressPercentage.toFixed(1)}% complete
            </p>
          </div>
        )}

        {progress.errors.length > 0 && (
          <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <h4 className="font-semibold text-red-800 dark:text-red-200 mb-2">
              Processing Errors ({progress.errors.length}):
            </h4>
            <div className="max-h-32 overflow-y-auto space-y-1">
              {progress.errors.map((err, idx) => (
                <div key={idx} className="text-sm text-red-600 dark:text-red-300">
                  {err}
                </div>
              ))}
            </div>
          </div>
        )}

        {!uploading && progress.total > 0 && (
          <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
            <p className="text-sm text-green-800 dark:text-green-200">
              Upload completed! Processed {progress.processed} out of {progress.total} rows.
              {progress.errors.length === 0 ? ' All rows processed successfully.' : ` ${progress.errors.length} rows had errors.`}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}