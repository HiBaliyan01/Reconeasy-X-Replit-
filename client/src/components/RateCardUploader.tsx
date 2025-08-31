import React, { useState } from 'react';
import Papa from 'papaparse';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { Upload, FileText, CheckCircle, AlertTriangle, Eye } from 'lucide-react';
import CSVValidationPreview from './CSVValidationPreview';

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
  const [showPreview, setShowPreview] = useState(false);

  const templateHeaders = [
    'marketplace', 'category', 'price_range_min', 'price_range_max',
    'commission_pct', 'shipping_fee', 'fixed_fee', 'rto_fee',
    'packaging_fee', 'gst_rate', 'effective_from', 'effective_to'
  ];

  const downloadTemplate = async () => {
    try {
      const response = await fetch('/api/rate-cards/template.csv');
      if (!response.ok) throw new Error('Failed to download template');
      
      const blob = await response.blob();
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = 'rate-card-template.csv';
      link.click();
    } catch (error) {
      console.error('Error downloading template:', error);
    }
  };

  const handleCSVUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setProgress({ total: 0, processed: 0, errors: [] });

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/rate-cards/upload', {
        method: 'POST',
        body: formData
      });

      const result = await response.json();

      if (response.ok) {
        const successfulCount = result.results.filter((r: any) => r.status === 'ok').length;
        const errorResults = result.results.filter((r: any) => r.status === 'error');
        
        setProgress({
          total: result.total,
          processed: successfulCount,
          errors: errorResults.map((r: any) => `Row ${r.row}: ${r.error}`)
        });

        if (onUploadSuccess && errorResults.length === 0) {
          onUploadSuccess();
        }
      } else {
        setProgress({
          total: 0,
          processed: 0,
          errors: [result.message || 'Upload failed']
        });
      }
    } catch (error) {
      console.error('Upload error:', error);
      setProgress({
        total: 0,
        processed: 0,
        errors: ['Network error during upload']
      });
    } finally {
      setUploading(false);
    }
  };

  const handleValidDataConfirmed = async (validRows: any[]) => {
    setUploading(true);
    setShowPreview(false);
    
    try {
      // Convert validated rows back to CSV format for upload
      const headers = Object.keys(validRows[0]);
      const csvContent = [
        headers.join(','),
        ...validRows.map(row => headers.map(h => row[h] || '').join(','))
      ].join('\n');
      
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const formData = new FormData();
      formData.append('file', blob, 'validated-data.csv');

      const response = await fetch('/api/rate-cards/upload', {
        method: 'POST',
        body: formData
      });

      const result = await response.json();

      if (response.ok) {
        const successfulCount = result.results.filter((r: any) => r.status === 'ok').length;
        const errorResults = result.results.filter((r: any) => r.status === 'error');
        
        setProgress({
          total: result.total,
          processed: successfulCount,
          errors: errorResults.map((r: any) => `Row ${r.row}: ${r.error}`)
        });

        if (onUploadSuccess && errorResults.length === 0) {
          onUploadSuccess();
        }
      } else {
        setProgress({
          total: 0,
          processed: 0,
          errors: [result.message || 'Upload failed']
        });
      }
    } catch (error) {
      console.error('Upload error:', error);
      setProgress({
        total: 0,
        processed: 0,
        errors: ['Network error during upload']
      });
    } finally {
      setUploading(false);
    }
  };

  const progressPercentage = progress.total > 0 ? (progress.processed / progress.total) * 100 : 0;

  if (showPreview) {
    return (
      <CSVValidationPreview
        onValidDataConfirmed={handleValidDataConfirmed}
        onCancel={() => setShowPreview(false)}
      />
    );
  }

  return (
    <div className="border border-slate-200 dark:border-slate-700 p-6 rounded-xl bg-white dark:bg-slate-800 shadow-lg">
      <h3 className="text-lg font-semibold mb-4 text-slate-900 dark:text-slate-100">
        Upload Rate Cards (CSV)
      </h3>
      
      <div className="space-y-4">
        <div className="flex items-center space-x-3">
          <div className="flex space-x-2">
            <input 
              type="file" 
              accept=".csv" 
              onChange={handleCSVUpload} 
              disabled={uploading}
              className="file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-teal-50 file:text-teal-700 hover:file:bg-teal-100 file:cursor-pointer cursor-pointer"
              data-testid="csv-upload-input"
            />
            <Button 
              onClick={() => setShowPreview(true)}
              variant="outline"
              disabled={uploading}
              className="text-blue-600 border-blue-200 hover:bg-blue-50"
              data-testid="preview-validation-button"
            >
              <Eye className="h-4 w-4 mr-2" />
              Preview & Validate
            </Button>
          </div>
          <Button 
            onClick={downloadTemplate}
            variant="outline"
            disabled={uploading}
            data-testid="download-template-button"
          >
            <FileText className="h-4 w-4 mr-2" />
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