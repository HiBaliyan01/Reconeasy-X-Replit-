import React, { useState } from 'react';
import Papa from 'papaparse';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { Upload, FileText, CheckCircle, AlertTriangle, Eye } from 'lucide-react';
import CSVValidationPreview from './CSVValidationPreview';

interface RateCardUploaderProps {
  onUploadSuccess?: (meta?: { filename?: string; uploadedAt?: string }) => void;
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
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dupInfo, setDupInfo] = useState<{ count: number } | null>(null);

  const templateHeaders = [
    'marketplace', 'category', 'price_range_min', 'price_range_max',
    'commission_pct', 'shipping_fee', 'fixed_fee', 'rto_fee',
    'packaging_fee', 'gst_rate', 'effective_from', 'effective_to'
  ];

  const downloadTemplate = async () => {
    try {
      const res = await fetch('/templates/rate-cards-template.csv');
      if (!res.ok) throw new Error('Failed to download template');
      const blob = await res.blob();
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = 'rate-card-template.csv';
      link.click();
    } catch (error) {
      console.error('Error downloading template:', error);
    }
  };

  // ---- Local import fallback (no backend required) ----
  const LS_KEY = 're_rate_cards_v2';
  function upsertManyLocal(records: any[]) {
    const raw = localStorage.getItem(LS_KEY);
    const arr = raw ? (JSON.parse(raw)?.data || []) : [];
    records.forEach((rec) => {
      const idx = arr.findIndex((c: any) => c.id === rec.id);
      if (idx >= 0) arr[idx] = { ...arr[idx], ...rec }; else arr.push(rec);
    });
    localStorage.setItem(LS_KEY, JSON.stringify({ data: arr }));
  }

  const dupKey = (r: any) => [
    String(r.platform_id || '').toLowerCase(),
    String(r.category_id || '').toLowerCase(),
    String(r.commission_type || ''),
    String(r.commission_type === 'flat' ? (r.commission_percent ?? 0) : 'tiered'),
    String(r.effective_from || ''),
    String(r.effective_to || '')
  ].join('|');

  function mapRowToRecord(row: any) {
    if (!row) return null;
    const id = (typeof crypto !== 'undefined' && (crypto as any).randomUUID) ? (crypto as any).randomUUID() : `${Date.now()}-${Math.random()}`;
    const num = (v: any) => (v === undefined || v === '' || v === null ? undefined : Number(v));
    const str = (v: any) => (v === undefined || v === null ? undefined : String(v));
    const fee = (code: string) => {
      const t = (row[`fee_${code}_type`] || 'percent') as 'percent' | 'amount';
      const val = num(row[`fee_${code}_value`]) || 0;
      return { fee_code: code, fee_type: t, fee_value: val };
    };
    const slabs: any[] = [];
    for (let i = 1; i <= 3; i++) {
      const min = num(row[`slab${i}_min_price`]);
      const max = num(row[`slab${i}_max_price`]);
      const pct = num(row[`slab${i}_commission_percent`]);
      if (min !== undefined || max !== undefined || pct !== undefined) {
        slabs.push({ min_price: min || 0, max_price: isNaN(Number(max)) ? null : (max as any), commission_percent: pct || 0 });
      }
    }
    return {
      id,
      platform_id: str(row.platform_id) || '',
      category_id: str(row.category_id) || '',
      commission_type: (row.commission_type || 'flat') as 'flat' | 'tiered',
      commission_percent: num(row.commission_percent) ?? null,
      slabs,
      gst_percent: num(row.gst_percent) ?? 18,
      tcs_percent: num(row.tcs_percent) ?? 1,
      fees: [
        fee('shipping'), fee('rto'), fee('packaging'), fee('fixed'), fee('collection'), fee('tech'), fee('storage')
      ],
      settlement_basis: str(row.settlement_basis) || 't_plus',
      t_plus_days: num(row.t_plus_days) ?? null,
      weekly_weekday: num(row.weekly_weekday) ?? null,
      bi_weekly_weekday: num(row.bi_weekly_weekday) ?? null,
      bi_weekly_which: str(row.bi_weekly_which) ?? null,
      monthly_day: str(row.monthly_day) ?? null,
      effective_from: str(row.effective_from) || format(new Date(), 'yyyy-MM-dd'),
      effective_to: str(row.effective_to) ?? null,
      status: 'active',
      created_at: new Date().toISOString(),
      global_min_price: num(row.global_min_price) ?? undefined,
      global_max_price: num(row.global_max_price) ?? undefined,
      notes: str(row.notes) ?? undefined,
    };
  }

  async function importLocallyFromFile(file: File) {
    return new Promise<{ total: number; ok: number; errs: string[] }>((resolve) => {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (res) => {
          const rows = (res.data as any[]).filter(Boolean);
          const records: any[] = [];
          const dupRecords: any[] = [];
          const errs: string[] = [];
          // Build duplicate set from existing
          const existingRaw = localStorage.getItem(LS_KEY);
          const existing = existingRaw ? (JSON.parse(existingRaw)?.data || []) : [];
          const seen = new Set<string>(existing.map(dupKey));
          rows.forEach((row, idx) => {
            try {
              const rec = mapRowToRecord(row);
              if (!rec?.platform_id || !rec?.category_id) throw new Error('platform_id/category_id required');
              const key = dupKey(rec);
              if (seen.has(key)) dupRecords.push(rec); else { seen.add(key); records.push(rec); }
            } catch (e: any) {
              errs.push(`Row ${idx + 2}: ${e.message || 'Invalid data'}`); // +2 for header/1-index
            }
          });
          if (dupRecords.length) {
            // Proceed by default and surface a gentle banner under the uploader
            records.push(...dupRecords);
            setDupInfo({ count: dupRecords.length });
          }
          if (records.length) upsertManyLocal(records);
          resolve({ total: rows.length, ok: records.length, errs });
        },
        error: () => resolve({ total: 0, ok: 0, errs: ['Parse error'] })
      });
    });
  }

  const handleCSVUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);

    setUploading(true);
    setProgress({ total: 0, processed: 0, errors: [] });

    try {
      // First attempt a local import (works without backend). If you later add a server, you can gate this by env.
      const { total, ok, errs } = await importLocallyFromFile(file);
      setProgress({ total, processed: ok, errors: errs });
      if (onUploadSuccess && errs.length === 0) onUploadSuccess({ filename: file.name, uploadedAt: new Date().toISOString() });
    } finally {
      setUploading(false);
    }
  };

  const handleValidDataConfirmed = async (validRows: any[]) => {
    setUploading(true);
    setShowPreview(false);
    
    try {
      // validRows already normalized; treat as records and persist locally
      const mapped = validRows.map(mapRowToRecord).filter(Boolean) as any[];
      const existingRaw = localStorage.getItem(LS_KEY);
      const existing = existingRaw ? (JSON.parse(existingRaw)?.data || []) : [];
      const seen = new Set<string>(existing.map(dupKey));
      const toInsert: any[] = [];
      const dups: any[] = [];
      const errs: string[] = [];
      mapped.forEach((rec) => { const key = dupKey(rec); if (seen.has(key)) dups.push(rec); else { seen.add(key); toInsert.push(rec); } });
      if (dups.length) {
        toInsert.push(...dups);
        setDupInfo({ count: dups.length });
      }
      if (toInsert.length) upsertManyLocal(toInsert);
      setProgress({ total: mapped.length, processed: toInsert.length, errors: errs });
      if (onUploadSuccess) onUploadSuccess({ filename: 'validated-data.csv', uploadedAt: new Date().toISOString() });
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
        initialFile={selectedFile || undefined}
      />
    );
  }

  return (
    <div className="border border-slate-200 dark:border-slate-700 p-6 rounded-xl bg-white dark:bg-slate-800 shadow-lg">
      <h3 className="text-lg font-semibold mb-4 text-slate-900 dark:text-slate-100">
        Upload Rate Cards (CSV/XLSX)
      </h3>
      
      <div className="space-y-4">
        <div className="flex items-center space-x-3">
          <div className="flex space-x-2">
            <input 
              type="file" 
              accept=".csv,.xlsx" 
              onChange={handleCSVUpload} 
              disabled={uploading}
              className="file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-teal-50 file:text-teal-700 hover:file:bg-teal-100 file:cursor-pointer cursor-pointer"
              data-testid="csv-xlsx-upload-input"
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

        {dupInfo && dupInfo.count > 0 && (
          <div className="mt-2 flex items-start gap-2 rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50/70 dark:bg-emerald-900/20 px-3 py-2 text-xs text-emerald-800 dark:text-emerald-300">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 mt-0.5"><path d="M12 2a10 10 0 1 0 10 10A10.011 10.011 0 0 0 12 2Zm1 15h-2v-2h2Zm0-4h-2V7h2Z"/></svg>
            <span>
              Imported with {dupInfo.count} duplicate rule{dupInfo.count!==1?'s':''}. Multiple rules can exist for same category.
            </span>
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
