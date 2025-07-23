import React, { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Upload, 
  Download, 
  FileText, 
  CheckCircle, 
  AlertCircle, 
  Trash2, 
  Package,
  Calendar,
  Filter,
  Eye,
  Save
} from 'lucide-react';
import Papa from 'papaparse';

interface OrderData {
  brandId: string;
  orderId: string;
  sku: string;
  quantity: number;
  sellingPrice: number;
  dispatchDate: string;
  orderStatus: string;
  marketplace: string;
}

interface UploadedFile {
  name: string;
  size: number;
  uploadedAt: string;
  marketplace: string;
  rowCount: number;
}

export default function OrdersUpload() {
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<OrderData[]>([]);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'parsing' | 'preview' | 'uploading' | 'success' | 'error'>('idle');
  const [selectedMarketplace, setSelectedMarketplace] = useState<string>('');
  const [uploadHistory, setUploadHistory] = useState<UploadedFile[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  // Fetch existing orders
  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['/api/orders'],
    queryFn: async () => {
      const response = await fetch('/api/orders');
      return response.json();
    }
  });

  // Upload mutation
  const uploadMutation = useMutation({
    mutationFn: async (data: { orders: OrderData[]; marketplace: string }) => {
      const response = await fetch('/api/orders/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!response.ok) throw new Error('Upload failed');
      return response.json();
    },
    onSuccess: (data) => {
      setUploadStatus('success');
      queryClient.invalidateQueries({ queryKey: ['/api/orders'] });
      
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

  const validateOrderData = (data: any[]): { isValid: boolean; errors: string[] } => {
    const errors: string[] = [];
    const requiredFields = ['brandId', 'orderId', 'sku', 'quantity'];
    
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
      if (!row.brandId?.trim()) {
        errors.push(`Row ${index + 2}: Brand ID is required`);
      }
      if (!row.orderId?.trim()) {
        errors.push(`Row ${index + 2}: Order ID is required`);
      }
      if (!row.sku?.trim()) {
        errors.push(`Row ${index + 2}: SKU is required`);
      }
      if (!row.quantity || isNaN(Number(row.quantity)) || Number(row.quantity) <= 0) {
        errors.push(`Row ${index + 2}: Quantity must be a positive number`);
      }
      if (row.sellingPrice && isNaN(Number(row.sellingPrice))) {
        errors.push(`Row ${index + 2}: Selling price must be a number`);
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

        const { isValid, errors } = validateOrderData(cleanData);
        
        if (!isValid) {
          setValidationErrors(errors);
          setUploadStatus('error');
          return;
        }

        // Transform and set data
        const transformedData: OrderData[] = cleanData.map(row => ({
          brandId: String(row.brandId || '').trim(),
          orderId: String(row.orderId || '').trim(),
          sku: String(row.sku || '').trim(),
          quantity: Number(row.quantity || 0),
          sellingPrice: Number(row.sellingPrice || 0),
          dispatchDate: row.dispatchDate || new Date().toISOString().split('T')[0],
          orderStatus: String(row.orderStatus || 'Pending').trim(),
          marketplace: selectedMarketplace || 'Unknown'
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
        brandId: 'BRAND001',
        orderId: 'ORD-12345',
        sku: 'SKU-ABC123',
        quantity: 2,
        sellingPrice: 1299.99,
        dispatchDate: '2025-01-23',
        orderStatus: 'Shipped',
        marketplace: 'Amazon'
      }
    ];

    const csv = Papa.unparse(template);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'orders_template.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleSave = () => {
    if (!selectedMarketplace) {
      setValidationErrors(['Please select a marketplace']);
      return;
    }
    
    setUploadStatus('uploading');
    uploadMutation.mutate({
      orders: parsedData,
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
      <div className="bg-gradient-to-r from-emerald-600 to-teal-600 dark:from-emerald-700 dark:to-teal-700 rounded-xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold flex items-center space-x-2">
              <Package className="w-6 h-6" />
              <span>Orders Management</span>
            </h2>
            <p className="text-emerald-100 mt-1">Upload and manage order data from marketplaces</p>
          </div>
          <div className="flex items-center space-x-4">
            <div className="text-right">
              <p className="text-emerald-200 text-sm">Total Orders</p>
              <p className="text-2xl font-bold">{orders.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Upload Section */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Upload Orders</h3>
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
              : 'border-slate-300 dark:border-slate-600 hover:border-emerald-400 dark:hover:border-emerald-500'
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
                Successfully uploaded {parsedData.length} orders!
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
                  Supports CSV files with order data
                </p>
              </div>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors"
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
                <span>Data Preview ({parsedData.length} orders)</span>
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
                  disabled={uploadStatus === 'uploading' || !selectedMarketplace}
                  className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
                    uploadStatus === 'uploading' || !selectedMarketplace
                      ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                      : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  }`}
                >
                  <Save className="w-4 h-4" />
                  <span>{uploadStatus === 'uploading' ? 'Saving...' : 'Save Orders'}</span>
                </button>
              </div>
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 dark:bg-slate-700">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 dark:text-slate-400 uppercase tracking-wider">Brand ID</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 dark:text-slate-400 uppercase tracking-wider">Order ID</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 dark:text-slate-400 uppercase tracking-wider">SKU</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 dark:text-slate-400 uppercase tracking-wider">Quantity</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 dark:text-slate-400 uppercase tracking-wider">Price</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 dark:text-slate-400 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 dark:text-slate-400 uppercase tracking-wider">Dispatch Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                {parsedData.slice(0, 10).map((order, index) => (
                  <tr key={index} className="hover:bg-slate-50 dark:hover:bg-slate-700">
                    <td className="px-4 py-3 text-sm text-slate-900 dark:text-slate-100">{order.brandId}</td>
                    <td className="px-4 py-3 text-sm text-slate-900 dark:text-slate-100">{order.orderId}</td>
                    <td className="px-4 py-3 text-sm text-slate-900 dark:text-slate-100">{order.sku}</td>
                    <td className="px-4 py-3 text-sm text-slate-900 dark:text-slate-100">{order.quantity}</td>
                    <td className="px-4 py-3 text-sm text-slate-900 dark:text-slate-100">
                      {order.sellingPrice ? `₹${order.sellingPrice.toLocaleString()}` : '-'}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                        order.orderStatus === 'Shipped' 
                          ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                          : order.orderStatus === 'Delivered'
                          ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400'
                          : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400'
                      }`}>
                        {order.orderStatus}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">{order.dispatchDate}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {parsedData.length > 10 && (
              <div className="p-4 text-center text-sm text-slate-600 dark:text-slate-400">
                Showing first 10 rows of {parsedData.length} total orders
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
                      {file.marketplace} • {file.rowCount} orders • {new Date(file.uploadedAt).toLocaleDateString()}
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