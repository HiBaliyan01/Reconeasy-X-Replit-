import React, { useState } from 'react';
import Papa from 'papaparse';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';

interface RateCardUploaderProps {
  onUploadSuccess?: () => void;
}

interface UploadProgress {
  total: number;
  processed: number;
  errors: string[];
}

const RateCardUploader = ({ onUploadSuccess }: RateCardUploaderProps) => {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<UploadProgress>({ total: 0, processed: 0, errors: [] });

  const templateHeaders = [
    'marketplace', 'category', 'price_range_min', 'price_range_max',
    'commission_pct', 'shipping_fee', 'fixed_fee', 'rto_fee',
    'packaging_fee', 'gst_rate', 'effective_from', 'effective_to'
  ];

  const downloadTemplate = () => {
    const sampleRow = [
      'Amazon', 'Electronics', '100', '50000', '15', '40', '25', '100',
      '20', '18', '2025-01-01', '2025-12-31'
    ];
    const csvContent = templateHeaders.join(',') + '\n' + sampleRow.join(',') + '\n';
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'rate_card_template.csv';
    link.click();
  };

  const handleCSVUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
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
            // Validate required fields
            const payload = {
              marketplace: (row as any).marketplace || (row as any).platform,
              category: (row as any).category,
              commission_pct: (row as any).commission_pct,
              shipping_fee: (row as any).shipping_fee,
              gst_rate: (row as any).gst_rate,
              rto_fee: (row as any).rto_fee,
              packaging_fee: (row as any).packaging_fee,
              fixed_fee: (row as any).fixed_fee,
              price_range_min: (row as any).price_range_min,
              price_range_max: (row as any).price_range_max,
              effective_from: (row as any).effective_from || format(new Date(), 'yyyy-MM-dd'),
              effective_to: (row as any).effective_to || ''
            };

            if (!payload.marketplace || !payload.category) {
              errors.push(`Row ${i + 2}: Missing required fields (marketplace, category)`);
              setProgress(prev => ({ 
                ...prev, 
                processed: prev.processed + 1, 
                errors: [...prev.errors, `Row ${i + 2}: Missing required fields`] 
              }));
              continue;
            }

            validRows.push(payload);
            setProgress(prev => ({ ...prev, processed: prev.processed + 1 }));
          } catch (err) {
            const errorMsg = `Row ${i + 2}: Processing failed - ${err instanceof Error ? err.message : 'Unknown error'}`;
            errors.push(errorMsg);
            setProgress(prev => ({ 
              ...prev, 
              processed: prev.processed + 1, 
              errors: [...prev.errors, errorMsg] 
            }));
          }
        }

        // Upload valid rate cards to backend
        if (validRows.length > 0) {
          try {
            const res = await fetch('/api/rate-cards/upload', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ rows: validRows })
            });

            if (!res.ok) {
              const errorData = await res.json();
              errors.push(`Upload failed: ${errorData.message || 'Server error'}`);
            } else {
              if (onUploadSuccess) {
                onUploadSuccess();
              }
            }
          } catch (err) {
            errors.push('Failed to upload rate cards to server');
          }
        }

        setProgress(prev => ({ ...prev, errors }));
        setUploading(false);
      }
    });
  };

  const progressPercentage = progress.total > 0 ? (progress.processed / progress.total) * 100 : 0;

  return (
    <div className="border border-slate-200 dark:border-slate-700 p-6 rounded-xl bg-white dark:bg-slate-800 shadow-lg">
      <h3 className="text-lg font-semibold mb-4 text-slate-900 dark:text-slate-100">
        Upload Rate Cards (CSV)
      </h3>
      
      <div className="space-y-4">
        <div className="flex items-center space-x-3">
          <input 
            type="file" 
            accept=".csv" 
            onChange={handleCSVUpload} 
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
              <span>Processing rate cards...</span>
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
};

export default RateCardUploader;