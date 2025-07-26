import React, { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Upload, 
  Download, 
  FileText, 
  CheckCircle, 
  AlertCircle, 
  Trash2, 
  RotateCcw,
  Calendar,
  Eye,
  Save,
  Info
} from 'lucide-react';
import Badge from './Badge';
import Papa from 'papaparse';

interface ReturnData {
  marketplace: string;
  orderId: string;
  returnId: string;
  sku: string;
  qtyReturned: number;
  returnType?: string;
  returnReasonCode?: string;
  returnReasonDesc?: string;
  returnDate?: string;
  refundAmount?: number;
  returnStatus?: string;
  receivedDateWh?: string;
  qcResult?: string;
  disposition?: string;
  commissionReversal?: number;
  logisticsReversal?: number;
  otherFeeReversal?: number;
  settlementRefId?: string;
  utrNumber?: string;
  refundMode?: string;
  pickupDate?: string;
  pickupPartner?: string;
  customerPin?: string;
  warehouseCode?: string;
  brandSku?: string;
  asinStyleCode?: string;
  evidenceUrl?: string;
  claimDeadline?: string;
  claimStatus?: string;
  claimAmountRequested?: number;
  claimAmountApproved?: number;
}

interface UploadedFile {
  name: string;
  size: number;
  uploadedAt: string;
  marketplace: string;
  rowCount: number;
}

export default function ReturnsUpload() {
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<ReturnData[]>([]);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'parsing' | 'preview' | 'uploading' | 'success' | 'error'>('idle');
  const [selectedMarketplace, setSelectedMarketplace] = useState<string>('');
  const [uploadHistory, setUploadHistory] = useState<UploadedFile[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  // Fetch existing returns
  const { data: returns = [], isLoading } = useQuery({
    queryKey: ['/api/returns'],
    queryFn: async () => {
      const response = await fetch('/api/returns');
      return response.json();
    }
  });

  // Upload mutation
  const uploadMutation = useMutation({
    mutationFn: async (data: { returns: ReturnData[]; marketplace: string }) => {
      const response = await fetch('/api/returns/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!response.ok) throw new Error('Upload failed');
      return response.json();
    },
    onSuccess: (data) => {
      setUploadStatus('success');
      queryClient.invalidateQueries({ queryKey: ['/api/returns'] });
      
      // Add to upload history
      if (uploadedFile) {
        const newFile: UploadedFile = {
          name: uploadedFile.name,
          size: uploadedFile.size,
          uploadedAt: new Date().toISOString(),
          marketplace: selectedMarketplace,
          rowCount: parsedData.length
        };
        setUploadHistory(prev => [newFile, ...prev.slice(0, 4)]);
      }
      
      // Reset state
      setTimeout(() => {
        setUploadStatus('idle');
        setUploadedFile(null);
        setParsedData([]);
        setSelectedMarketplace('');
        setShowPreview(false);
      }, 3000);
    },
    onError: () => {
      setUploadStatus('error');
    }
  });

  const validateReturnData = (data: any[]): { isValid: boolean; errors: string[] } => {
    const errors: string[] = [];
    const requiredFields = ['marketplace', 'orderId', 'returnId', 'sku', 'qtyReturned'];
    
    if (data.length === 0) {
      errors.push('CSV file is empty');
      return { isValid: false, errors };
    }

    // Check required columns
    const headers = Object.keys(data[0]);
    requiredFields.forEach(field => {
      if (!headers.includes(field)) {
        errors.push(`Missing required column: ${field}`);
      }
    });

    // Validate data types and values
    data.forEach((row, index) => {
      if (!row.marketplace?.trim()) {
        errors.push(`Row ${index + 2}: Marketplace is required`);
      }
      if (!row.orderId?.trim()) {
        errors.push(`Row ${index + 2}: Order ID is required`);
      }
      if (!row.returnId?.trim()) {
        errors.push(`Row ${index + 2}: Return ID is required`);
      }
      if (!row.sku?.trim()) {
        errors.push(`Row ${index + 2}: SKU is required`);
      }
      if (!row.qtyReturned || isNaN(Number(row.qtyReturned)) || Number(row.qtyReturned) <= 0) {
        errors.push(`Row ${index + 2}: Quantity returned must be a positive number`);
      }
      if (row.refundAmount && isNaN(Number(row.refundAmount))) {
        errors.push(`Row ${index + 2}: Refund amount must be a number`);
      }
    });

    return { isValid: errors.length === 0, errors };
  };

  const handleFileSelect = (file: File) => {
    setUploadedFile(file);
    setUploadStatus('parsing');
    setValidationErrors([]);

    Papa.parse(file, {
      complete: (results) => {
        const data = results.data as any[];
        
        // Remove empty rows
        const cleanData = data.filter(row => 
          Object.values(row).some(value => value && String(value).trim())
        );

        const { isValid, errors } = validateReturnData(cleanData);
        
        if (!isValid) {
          setValidationErrors(errors);
          setUploadStatus('error');
          return;
        }

        // Transform and set data
        const transformedData: ReturnData[] = cleanData.map(row => ({
          marketplace: String(row.marketplace || selectedMarketplace || '').trim(),
          orderId: String(row.orderId || '').trim(),
          returnId: String(row.returnId || '').trim(),
          sku: String(row.sku || '').trim(),
          qtyReturned: Number(row.qtyReturned || 0),
          returnType: row.returnType || null,
          returnReasonCode: row.returnReasonCode || null,
          returnReasonDesc: row.returnReasonDesc || null,
          returnDate: row.returnDate || new Date().toISOString().split('T')[0],
          refundAmount: row.refundAmount ? Number(row.refundAmount) : null,
          returnStatus: row.returnStatus || 'pending',
          receivedDateWh: row.receivedDateWh || null,
          qcResult: row.qcResult || null,
          disposition: row.disposition || null,
          commissionReversal: row.commissionReversal ? Number(row.commissionReversal) : null,
          logisticsReversal: row.logisticsReversal ? Number(row.logisticsReversal) : null,
          otherFeeReversal: row.otherFeeReversal ? Number(row.otherFeeReversal) : null,
          settlementRefId: row.settlementRefId || null,
          utrNumber: row.utrNumber || null,
          refundMode: row.refundMode || null,
          pickupDate: row.pickupDate || null,
          pickupPartner: row.pickupPartner || null,
          customerPin: row.customerPin || null,
          warehouseCode: row.warehouseCode || null,
          brandSku: row.brandSku || null,
          asinStyleCode: row.asinStyleCode || null,
          evidenceUrl: row.evidenceUrl || null,
          claimDeadline: row.claimDeadline || null,
          claimStatus: row.claimStatus || null,
          claimAmountRequested: row.claimAmountRequested ? Number(row.claimAmountRequested) : null,
          claimAmountApproved: row.claimAmountApproved ? Number(row.claimAmountApproved) : null
        }));

        setParsedData(transformedData);
        setUploadStatus('preview');
        setShowPreview(true);
      },
      header: true,
      error: (error) => {
        setValidationErrors([`Failed to parse CSV: ${error.message}`]);
        setUploadStatus('error');
      }
    });
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files);
    const csvFile = files.find(file => file.type === 'text/csv' || file.name.endsWith('.csv'));
    
    if (csvFile) {
      handleFileSelect(csvFile);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const downloadTemplate = () => {
    const template = [
      {
        marketplace: 'Myntra',
        orderId: 'ORD123',
        returnId: 'RET789',
        sku: 'SKU001',
        qtyReturned: 2,
        returnType: 'customer_return',
        returnReasonCode: 'SIZE_ISSUE',
        returnReasonDesc: 'Size too small',
        returnDate: '2025-07-15',
        refundAmount: 499.99,
        returnStatus: 'refunded',
        receivedDateWh: '2025-07-18',
        qcResult: 'pass',
        disposition: 'resellable',
        commissionReversal: 50,
        logisticsReversal: 30,
        otherFeeReversal: 10,
        settlementRefId: 'SETT567',
        utrNumber: '2309UTR7788',
        refundMode: 'invoice_adjustment',
        pickupDate: '2025-07-16',
        pickupPartner: 'EcomExpress',
        customerPin: '560001',
        warehouseCode: 'BLR_FC2',
        brandSku: 'SHOE-BLK-42',
        asinStyleCode: 'STYLE9988',
        evidenceUrl: 'https://example.com/img1.jpg',
        claimDeadline: '2025-07-28',
        claimStatus: 'raised',
        claimAmountRequested: 499,
        claimAmountApproved: 300
      }
    ];

    const csv = Papa.unparse(template);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'returns_template.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleSave = () => {
    if (!selectedMarketplace && !parsedData.some(item => item.marketplace)) {
      setValidationErrors(['Please select a marketplace or ensure marketplace is included in CSV data']);
      return;
    }
    
    setUploadStatus('uploading');
    uploadMutation.mutate({
      returns: parsedData,
      marketplace: selectedMarketplace
    });
  };

  const resetUpload = () => {
    setUploadedFile(null);
    setParsedData([]);
    setValidationErrors([]);
    setUploadStatus('idle');
    setShowPreview(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <div className="bg-gradient-to-r from-pink-600 to-rose-600 dark:from-pink-700 dark:to-rose-700 rounded-xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold flex items-center space-x-2">
              <RotateCcw className="w-6 h-6" />
              <span>Returns Management</span>
            </h2>
            <p className="text-pink-100 mt-1">Upload and manage return data from marketplaces</p>
          </div>
          <div className="flex items-center space-x-4">
            <div className="text-right">
              <p className="text-pink-200 text-sm">Total Returns</p>
              <p className="text-2xl font-bold">{returns.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Info Banner */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <div className="flex items-start space-x-3">
          <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-blue-800 dark:text-blue-200">
            <p className="font-medium mb-1">Optional fields include:</p>
            <p className="text-blue-700 dark:text-blue-300">
              pickup_partner, customer_pin, warehouse_code, brand_sku, evidence_url, claim details, and financial tie-back fields. 
              Required: marketplace, order_id, return_id, sku, qty_returned.
            </p>
          </div>
        </div>
      </div>

      {/* Upload Section */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Upload Returns</h3>
          <div className="flex items-center space-x-3">
            <select
              value={selectedMarketplace}
              onChange={(e) => setSelectedMarketplace(e.target.value)}
              className="px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
            >
              <option value="">Select Marketplace</option>
              <option value="Amazon">Amazon</option>
              <option value="Flipkart">Flipkart</option>
              <option value="Myntra">Myntra</option>
              <option value="Ajio">Ajio</option>
              <option value="Nykaa">Nykaa</option>
            </select>
            <button
              onClick={downloadTemplate}
              className="flex items-center space-x-2 px-4 py-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
            >
              <Download className="w-4 h-4" />
              <span>Template</span>
            </button>
          </div>
        </div>

        {/* File Upload Area */}
        <div
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
            uploadStatus === 'parsing' 
              ? 'border-blue-300 bg-blue-50 dark:border-blue-600 dark:bg-blue-900/20'
              : uploadStatus === 'success'
              ? 'border-green-300 bg-green-50 dark:border-green-600 dark:bg-green-900/20'
              : uploadStatus === 'error'
              ? 'border-red-300 bg-red-50 dark:border-red-600 dark:bg-red-900/20'
              : 'border-slate-300 dark:border-slate-600 hover:border-pink-400 dark:hover:border-pink-500'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleFileInput}
            className="hidden"
          />
          
          {uploadStatus === 'parsing' ? (
            <div className="flex flex-col items-center space-y-3">
              <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-blue-700 dark:text-blue-300">Parsing CSV file...</p>
            </div>
          ) : uploadStatus === 'success' ? (
            <div className="flex flex-col items-center space-y-3">
              <CheckCircle className="w-12 h-12 text-green-600" />
              <p className="text-green-700 dark:text-green-300 font-medium">
                Successfully uploaded {parsedData.length} returns!
              </p>
            </div>
          ) : uploadStatus === 'error' ? (
            <div className="flex flex-col items-center space-y-3">
              <AlertCircle className="w-12 h-12 text-red-600" />
              <p className="text-red-700 dark:text-red-300 font-medium">Upload failed</p>
              <button
                onClick={resetUpload}
                className="text-red-600 hover:text-red-700 underline"
              >
                Try again
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center space-y-4">
              <Upload className="w-12 h-12 text-slate-400" />
              <div>
                <p className="text-lg font-medium text-slate-900 dark:text-slate-100 mb-2">
                  Drop your CSV file here or click to browse
                </p>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Supports CSV files with return data
                </p>
              </div>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-6 py-2 bg-pink-600 hover:bg-pink-700 text-white rounded-lg transition-colors"
              >
                Choose File
              </button>
            </div>
          )}
        </div>

        {/* Validation Errors */}
        {validationErrors.length > 0 && (
          <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <h4 className="font-medium text-red-800 dark:text-red-200 mb-2">Validation Errors:</h4>
            <ul className="text-sm text-red-700 dark:text-red-300 space-y-1">
              {validationErrors.map((error, index) => (
                <li key={index} className="flex items-start space-x-2">
                  <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>{error}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* File Info */}
        {uploadedFile && uploadStatus !== 'error' && (
          <div className="mt-4 p-4 bg-slate-50 dark:bg-slate-700 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <FileText className="w-5 h-5 text-slate-600 dark:text-slate-400" />
                <div>
                  <p className="font-medium text-slate-900 dark:text-slate-100">{uploadedFile.name}</p>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    {(uploadedFile.size / 1024).toFixed(1)} KB • {parsedData.length} rows
                  </p>
                </div>
              </div>
              <button
                onClick={resetUpload}
                className="p-2 text-slate-500 hover:text-red-600 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Data Preview */}
      {showPreview && parsedData.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
          <div className="p-6 border-b border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 flex items-center space-x-2">
                <Eye className="w-5 h-5" />
                <span>Data Preview ({parsedData.length} returns)</span>
              </h3>
              <div className="flex items-center space-x-3">
                <button
                  onClick={() => setShowPreview(false)}
                  className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                >
                  Hide Preview
                </button>
                <button
                  onClick={handleSave}
                  disabled={uploadStatus === 'uploading'}
                  className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
                    uploadStatus === 'uploading'
                      ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                      : 'bg-pink-600 hover:bg-pink-700 text-white'
                  }`}
                >
                  <Save className="w-4 h-4" />
                  <span>{uploadStatus === 'uploading' ? 'Saving...' : 'Save Returns'}</span>
                </button>
              </div>
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 dark:bg-slate-700">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 dark:text-slate-400 uppercase tracking-wider">Marketplace</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 dark:text-slate-400 uppercase tracking-wider">Order ID</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 dark:text-slate-400 uppercase tracking-wider">Return ID</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 dark:text-slate-400 uppercase tracking-wider">SKU</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 dark:text-slate-400 uppercase tracking-wider">Qty</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 dark:text-slate-400 uppercase tracking-wider">Refund</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 dark:text-slate-400 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 dark:text-slate-400 uppercase tracking-wider">Return Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                {parsedData.slice(0, 10).map((returnItem, index) => (
                  <tr key={index} className="hover:bg-slate-50 dark:hover:bg-slate-700">
                    <td className="px-4 py-3 text-sm text-slate-900 dark:text-slate-100">{returnItem.marketplace}</td>
                    <td className="px-4 py-3 text-sm text-slate-900 dark:text-slate-100">{returnItem.orderId}</td>
                    <td className="px-4 py-3 text-sm text-slate-900 dark:text-slate-100">{returnItem.returnId}</td>
                    <td className="px-4 py-3 text-sm text-slate-900 dark:text-slate-100">{returnItem.sku}</td>
                    <td className="px-4 py-3 text-sm text-slate-900 dark:text-slate-100">{returnItem.qtyReturned}</td>
                    <td className="px-4 py-3 text-sm text-slate-900 dark:text-slate-100">
                      {returnItem.refundAmount ? `₹${returnItem.refundAmount.toLocaleString()}` : '-'}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <Badge 
                        label={returnItem.returnStatus || 'pending'}
                        variant={
                          returnItem.returnStatus === 'refunded' ? 'positive' :
                          returnItem.returnStatus === 'processing' ? 'purple' :
                          'neutral'
                        }
                      />
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">{returnItem.returnDate}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {parsedData.length > 10 && (
              <div className="p-4 text-center text-sm text-slate-600 dark:text-slate-400">
                Showing first 10 rows of {parsedData.length} total returns
              </div>
            )}
          </div>
        </div>
      )}

      {/* Upload History */}
      {uploadHistory.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">Recent Uploads</h3>
          <div className="space-y-3">
            {uploadHistory.map((file, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-700 rounded-lg">
                <div className="flex items-center space-x-3">
                  <FileText className="w-5 h-5 text-slate-600 dark:text-slate-400" />
                  <div>
                    <p className="font-medium text-slate-900 dark:text-slate-100">{file.name}</p>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      {file.marketplace} • {file.rowCount} returns • {new Date(file.uploadedAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="text-sm text-slate-500 dark:text-slate-400">
                  {(file.size / 1024).toFixed(1)} KB
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}