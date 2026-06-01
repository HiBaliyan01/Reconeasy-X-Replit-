import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Calendar,
  CheckCircle,
  ChevronDown,
  Download,
  Eye,
  Info,
  MoreVertical,
  Package,
  Pencil,
  Save,
  Search,
  Tag,
  Trash2,
  Upload,
  UploadCloud,
  Weight,
} from 'lucide-react';
import Papa from 'papaparse';
import { DEFAULT_TENANT_ID } from '../config/tenant';

const MP_TINT = {
  amazon: { bg: '#F4EFE6', fg: '#8A5A12', dot: '#E08A18' },
  flipkart: { bg: '#EAF1FB', fg: '#1F5BB8', dot: '#2874F0' },
  meesho: { bg: '#F7EAF3', fg: '#A22C84', dot: '#C7308F' },
  myntra: { bg: '#FBECEC', fg: '#B23A4A', dot: '#E04A5F' },
};

const STATUS_STYLE = {
  DELIVERED: { bg: '#e9f7f0', fg: '#0a7d56' },
  SHIPPED: { bg: '#edf2ff', fg: '#1f54d6' },
  CANCELLED: { bg: '#fceaed', fg: '#d23f57' },
  RTO: { bg: '#fbf2e2', fg: '#b9760a' },
};

interface OrderData {
  orderId: string;
  sku: string;
  quantity: number;
  sellingPrice: number;
  dispatchDate: string;
  deliveryDate?: string | null;
  weightGrams?: number | null;
  categoryId?: string | null;
  operationalStatus?: string | null;
  fulfillmentType?: string | null;
}

interface SavedOrder {
  id?: string;
  order_id: string;
  sku: string;
  marketplace: string | null;
  quantity: number;
  selling_price: number | string | null;
  weight_grams: number | string | null;
  category_id: string | null;
  dispatch_date: string | null;
  delivery_date: string | null;
  operational_status: string | null;
  fulfillment_type: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

interface OrdersSummary {
  total_orders: string | number;
  unique_skus: string | number;
  orders_with_weight: string | number;
  weight_coverage: string | number | null;
  category_coverage: string | number | null;
  earliest_date: string | null;
  latest_date: string | null;
}

type UploadStatus = 'idle' | 'parsing' | 'preview' | 'uploading' | 'success' | 'error';

const formatShortDate = (dateStr: string | null | undefined) => {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

const formatMarketplace = (marketplace: string | null | undefined) => {
  if (!marketplace) return 'Unknown';
  return marketplace.charAt(0).toUpperCase() + marketplace.slice(1);
};

const formatStatus = (status: string | null | undefined) => {
  if (!status) return 'Unknown';
  return status.charAt(0) + status.slice(1).toLowerCase();
};

const buildSummaryFromOrders = (orders: SavedOrder[]): OrdersSummary => {
  const total = orders.length;
  const uniqueSkus = new Set(orders.map((order) => order.sku).filter(Boolean)).size;
  const ordersWithWeight = orders.filter((order) => Number(order.weight_grams || 0) > 0).length;
  const ordersWithCategory = orders.filter((order) => Boolean(order.category_id)).length;
  const dates = orders
    .map((order) => order.dispatch_date)
    .filter((date): date is string => Boolean(date))
    .sort((a, b) => new Date(a).getTime() - new Date(b).getTime());

  return {
    total_orders: total,
    unique_skus: uniqueSkus,
    orders_with_weight: ordersWithWeight,
    weight_coverage: total > 0 ? Math.round((ordersWithWeight / total) * 100) : 0,
    category_coverage: total > 0 ? Math.round((ordersWithCategory / total) * 100) : 0,
    earliest_date: dates[0] || null,
    latest_date: dates[dates.length - 1] || null,
  };
};

export default function OrdersUpload() {
  const [importOpen, setImportOpen] = useState(false);
  const [updateExisting, setUpdateExisting] = useState(true);
  const [selectedMarketplace, setSelectedMarketplace] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [orders, setOrders] = useState<SavedOrder[]>([]);
  const [summary, setSummary] = useState<OrdersSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<OrderData[]>([]);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>('idle');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const ordersRes = await fetch(`/api/orders?tenant_id=${DEFAULT_TENANT_ID}&marketplace=`);
      if (!ordersRes.ok) {
        throw new Error('Failed to fetch orders');
      }

      const ordersData = await ordersRes.json();
      const nextOrders = ordersData.orders || ordersData || [];
      setOrders(nextOrders);
      setSummary(ordersData.summary || buildSummaryFromOrders(nextOrders));
    } catch (err) {
      console.error('Failed to fetch orders:', err);
      setOrders([]);
      setSummary(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      const matchesStatus =
        statusFilter === 'all'
          ? true
          : statusFilter === 'issues'
            ? ['CANCELLED', 'RTO'].includes(order.operational_status || '')
            : order.operational_status === statusFilter;

      const matchesSearch =
        !searchQuery ||
        `${order.order_id} ${order.sku} ${order.marketplace}`
          .toLowerCase()
          .includes(searchQuery.toLowerCase());

      return matchesStatus && matchesSearch;
    });
  }, [orders, searchQuery, statusFilter]);

  const validateOrderData = (data: Record<string, unknown>[]) => {
    const errors: string[] = [];
    const requiredFields = ['orderId', 'sku', 'quantity'];

    if (data.length === 0) {
      return { isValid: false, errors: ['CSV file is empty'] };
    }

    const headers = Object.keys(data[0]);
    requiredFields.forEach((field) => {
      if (!headers.includes(field)) {
        errors.push(`Missing required column: ${field}`);
      }
    });

    data.forEach((row, index) => {
      if (!String(row.orderId || '').trim()) {
        errors.push(`Row ${index + 2}: Order ID is required`);
      }
      if (!String(row.sku || '').trim()) {
        errors.push(`Row ${index + 2}: SKU is required`);
      }

      const quantity = Number(row.quantity);
      if (!Number.isFinite(quantity) || quantity <= 0) {
        errors.push(`Row ${index + 2}: Quantity must be a positive number`);
      }

      if (row.sellingPrice !== undefined && row.sellingPrice !== null && row.sellingPrice !== '') {
        const sellingPrice = Number(row.sellingPrice);
        if (!Number.isFinite(sellingPrice) || sellingPrice < 0) {
          errors.push(`Row ${index + 2}: Selling price must be a valid number`);
        }
      }
    });

    return { isValid: errors.length === 0, errors };
  };

  const parseFile = (file: File) => {
    if (file.size > 10 * 1024 * 1024) {
      setValidationErrors(['File must be 10 MB or smaller']);
      setUploadStatus('error');
      return;
    }

    setUploadedFile(file);
    setUploadStatus('parsing');
    setValidationErrors([]);
    setSuccessMessage(null);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const rawData = results.data as Record<string, unknown>[];
        const validation = validateOrderData(rawData);

        if (!validation.isValid) {
          setValidationErrors(validation.errors.slice(0, 10));
          setUploadStatus('error');
          return;
        }

        const parsed = rawData.map((row) => ({
          orderId: String(row.orderId || '').trim(),
          sku: String(row.sku || '').trim(),
          quantity: Number(row.quantity),
          sellingPrice: Number(row.sellingPrice || 0),
          dispatchDate: String(row.dispatchDate || '').trim(),
          deliveryDate: row.deliveryDate ? String(row.deliveryDate).trim() : null,
          weightGrams: row.weightGrams ? Number(row.weightGrams) : null,
          categoryId: row.categoryId ? String(row.categoryId).trim() : null,
          operationalStatus: row.operationalStatus ? String(row.operationalStatus).trim() : null,
          fulfillmentType: row.fulfillmentType ? String(row.fulfillmentType).trim() : null,
        }));

        setParsedData(parsed);
        setUploadStatus('preview');
      },
      error: (error) => {
        setValidationErrors([error.message || 'Failed to parse CSV file']);
        setUploadStatus('error');
      },
    });
  };

  const handleFileInput = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      parseFile(file);
    }
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragActive(false);
    const file = event.dataTransfer.files?.[0];
    if (file) {
      parseFile(file);
    }
  };

  const handleSaveOrders = async () => {
    if (!selectedMarketplace) {
      setValidationErrors(['Select a marketplace before saving orders']);
      setUploadStatus('error');
      return;
    }

    if (parsedData.length === 0) {
      setValidationErrors(['Upload a valid CSV before saving orders']);
      setUploadStatus('error');
      return;
    }

    setUploadStatus('uploading');
    setValidationErrors([]);

    try {
      const response = await fetch('/api/orders/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: DEFAULT_TENANT_ID,
          marketplace: selectedMarketplace,
          orders: parsedData,
          updateExisting,
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || 'Failed to save orders');
      }

      const result = await response.json();
      setSuccessMessage(result.message || `${parsedData.length} orders imported`);
      setUploadStatus('success');
      setUploadedFile(null);
      setParsedData([]);
      await fetchOrders();
    } catch (err) {
      setValidationErrors([err instanceof Error ? err.message : 'Failed to save orders']);
      setUploadStatus('error');
    }
  };

  const clearUpload = () => {
    setUploadedFile(null);
    setParsedData([]);
    setValidationErrors([]);
    setUploadStatus('idle');
    setSuccessMessage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleExport = () => {
    const csv = Papa.unparse(filteredOrders.length > 0 ? filteredOrders : orders);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `orders-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const totalOrders = Number(summary?.total_orders || orders.length || 0);
  const ordersWithWeight = Number(summary?.orders_with_weight || 0);
  const weightCoverage = Number(summary?.weight_coverage || 0);
  const categoryCoverage = Number(summary?.category_coverage || 0);

  const kpis: Array<{
    icon: JSX.Element;
    label: string;
    value: string | number;
    sub: string;
    good?: boolean;
    warn?: boolean;
    pill?: string;
    isDate?: boolean;
  }> = summary
    ? [
        {
          icon: <Package className="w-3.5 h-3.5" />,
          label: 'Total orders',
          value: summary.total_orders,
          sub: 'across all marketplaces',
        },
        {
          icon: <Tag className="w-3.5 h-3.5" />,
          label: 'Unique SKUs',
          value: summary.unique_skus,
          sub: 'mapped to catalog',
        },
        {
          icon: <Weight className="w-3.5 h-3.5" />,
          label: 'Weight coverage',
          value: `${weightCoverage}%`,
          sub:
            weightCoverage === 100
              ? 'Required for logistics recon'
              : `${Math.max(totalOrders - ordersWithWeight, 0)} orders missing weight`,
          good: weightCoverage === 100,
          warn: weightCoverage < 100,
          pill: weightCoverage === 100 ? 'Ready' : 'Action needed',
        },
        {
          icon: <Tag className="w-3.5 h-3.5" />,
          label: 'Category coverage',
          value: `${categoryCoverage}%`,
          sub: 'Required for commission tiers',
          good: categoryCoverage === 100,
          warn: categoryCoverage < 100,
          pill: categoryCoverage === 100 ? 'Ready' : 'Action needed',
        },
        {
          icon: <Calendar className="w-3.5 h-3.5" />,
          label: 'Date range',
          value:
            summary.earliest_date && summary.latest_date
              ? `${formatShortDate(summary.earliest_date)} – ${formatShortDate(summary.latest_date)}`
              : '—',
          sub: `${summary.total_orders} orders loaded`,
          isDate: true,
        },
      ]
    : [];

  return (
    <div className="space-y-5">
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv"
        onChange={handleFileInput}
        className="hidden"
      />

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[30px] font-semibold tracking-tight text-slate-950">Orders</h1>
          <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-slate-500">
            Upload order data from your marketplaces and keep weight & category metadata complete for accurate
            reconciliation.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleExport}
            className="inline-flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-800 shadow-sm transition-colors hover:bg-slate-50"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
          <button
            onClick={() => setImportOpen(true)}
            className="inline-flex h-11 items-center gap-2 rounded-xl bg-teal-600 px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-teal-700"
          >
            <Upload className="w-4 h-4" />
            Import orders
          </button>
        </div>
      </div>

      <div className="mb-4 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div
          onClick={() => setImportOpen(!importOpen)}
          className="flex cursor-pointer items-center gap-3 px-4 py-3.5 transition-colors hover:bg-slate-50"
        >
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl border border-teal-100 bg-teal-50 text-teal-700">
            <UploadCloud className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <div className="text-sm font-semibold text-slate-800">Import orders</div>
            <div className="text-xs text-slate-400">
              Drag a marketplace CSV here, or click to open the uploader
            </div>
          </div>
          <a
            href="/templates/orders-template.csv"
            onClick={(event) => event.stopPropagation()}
            className="flex items-center gap-1.5 text-xs font-semibold text-teal-700 hover:underline"
          >
            <Download className="w-3.5 h-3.5" />
            Download template
          </a>
          <ChevronDown
            className={`w-4 h-4 text-slate-400 transition-transform ${importOpen ? 'rotate-180' : ''}`}
          />
        </div>

        {importOpen && (
          <div className="border-t border-slate-100 px-4 pb-5 pt-4">
            <div className="mb-4">
              <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Marketplace
              </label>
              <select
                value={selectedMarketplace}
                onChange={(event) => setSelectedMarketplace(event.target.value)}
                className="h-9 min-w-[180px] rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700"
              >
                <option value="" disabled>
                  Select marketplace…
                </option>
                <option value="amazon">Amazon</option>
                <option value="flipkart">Flipkart</option>
                <option value="meesho">Meesho</option>
                <option value="myntra">Myntra</option>
              </select>
            </div>

            <div
              onClick={() => fileInputRef.current?.click()}
              onDragEnter={(event) => {
                event.preventDefault();
                setDragActive(true);
              }}
              onDragOver={(event) => event.preventDefault()}
              onDragLeave={(event) => {
                event.preventDefault();
                setDragActive(false);
              }}
              onDrop={handleDrop}
              className={`mb-4 cursor-pointer rounded-xl border-2 border-dashed p-8 text-center transition-colors ${
                dragActive
                  ? 'border-teal-400 bg-teal-50'
                  : 'border-slate-300 bg-slate-50 hover:border-teal-400 hover:bg-teal-50'
              }`}
            >
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl border border-slate-200 bg-white text-teal-700">
                <UploadCloud className="w-6 h-6" />
              </div>
              <h4 className="mb-1 text-base font-semibold text-slate-800">Drop your CSV file here</h4>
              <p className="mb-4 text-sm text-slate-400">
                Supports order data with weight & category columns · max 10 MB
              </p>
              <button
                onClick={(event) => {
                  event.stopPropagation();
                  fileInputRef.current?.click();
                }}
                className="mx-auto flex h-9 items-center gap-2 rounded-lg bg-teal-600 px-4 text-sm font-medium text-white hover:bg-teal-700"
              >
                <Upload className="w-4 h-4" />
                Choose file
              </button>
            </div>

            <div className="mb-3 flex items-center gap-3">
              <button
                onClick={() => setUpdateExisting(!updateExisting)}
                className={`relative h-6 w-10 flex-shrink-0 rounded-full transition-colors ${
                  updateExisting ? 'bg-teal-500' : 'bg-slate-300'
                }`}
              >
                <span
                  className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                    updateExisting ? 'translate-x-4' : 'translate-x-0.5'
                  }`}
                />
              </button>
              <span className="text-sm text-slate-600">
                Update existing orders{' '}
                <span className="text-slate-400">— weight, category & status only · price never changes</span>
              </span>
            </div>

            <div className="flex items-center gap-2 text-xs text-slate-400">
              <Info className="w-3.5 h-3.5 flex-shrink-0" />
              Including <strong className="text-slate-500">delivery date</strong> improves payout accuracy for
              settlement-delay detection.
            </div>

            {(uploadedFile || uploadStatus === 'success' || validationErrors.length > 0) && (
              <div className="mt-4 rounded-xl border border-slate-200 bg-white p-3">
                {uploadedFile && uploadStatus !== 'success' && (
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-slate-800">{uploadedFile.name}</div>
                      <div className="text-xs text-slate-400">
                        {uploadStatus === 'parsing'
                          ? 'Parsing CSV…'
                          : `${parsedData.length} rows ready to import`}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {parsedData.length > 0 && (
                        <button
                          onClick={handleSaveOrders}
                          disabled={uploadStatus === 'uploading'}
                          className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-teal-600 px-3 text-xs font-semibold text-white hover:bg-teal-700 disabled:opacity-60"
                        >
                          <Save className="w-3.5 h-3.5" />
                          {uploadStatus === 'uploading' ? 'Saving…' : 'Save orders'}
                        </button>
                      )}
                      <button
                        onClick={clearUpload}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-400 hover:text-slate-700"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}

                {successMessage && (
                  <div className="flex items-center gap-2 text-sm font-medium text-teal-700">
                    <CheckCircle className="w-4 h-4" />
                    {successMessage}
                  </div>
                )}

                {validationErrors.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {validationErrors.map((error) => (
                      <div key={error} className="flex items-center gap-2 text-xs font-medium text-red-600">
                        <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                        {error}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {summary && (
        <div className="mb-5 grid grid-cols-5 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          {kpis.map((kpi, index) => (
            <div
              key={kpi.label}
              className={`relative border-r border-slate-100 px-4 py-4 last:border-r-0 ${
                kpi.warn ? 'bg-amber-50' : ''
              }`}
            >
              <div
                className={`mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide ${
                  kpi.warn ? 'text-amber-700' : 'text-slate-400'
                }`}
              >
                {kpi.icon}
                {kpi.label}
                {kpi.pill && (
                  <span
                    className={`ml-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      kpi.good ? 'bg-teal-50 text-teal-700' : 'bg-amber-100 text-amber-700'
                    }`}
                  >
                    {kpi.pill}
                  </span>
                )}
              </div>
              <div
                className={`mb-1.5 text-[26px] font-semibold leading-none ${
                  kpi.isDate ? 'mt-2.5 text-[15px]' : ''
                } ${kpi.good ? 'text-teal-700' : kpi.warn ? 'text-amber-600' : 'text-slate-900'}`}
              >
                {kpi.value}
              </div>
              <div className={`text-[11.5px] ${kpi.warn ? 'font-semibold text-amber-600' : 'text-slate-400'}`}>
                {kpi.sub}
              </div>
            </div>
          ))}
        </div>
      )}

      {orders.length === 0 && !loading && (
        <div className="rounded-xl border border-slate-200 bg-white p-11 shadow-sm">
          <div className="grid grid-cols-2 items-center gap-11">
            <div>
              <h2 className="mb-2 text-2xl font-semibold text-slate-900">Bring in your first orders</h2>
              <p className="mb-7 max-w-md text-[14.5px] text-slate-500">
                ReconEasy reconciles every marketplace payout against your real order data. Start by importing a CSV -
                it takes about a minute.
              </p>
              <div className="flex flex-col gap-5">
                {[
                  {
                    n: 1,
                    title: 'Download the template',
                    desc: 'Pre-formatted columns for order ID, SKU, weight & category.',
                  },
                  {
                    n: 2,
                    title: 'Upload your CSV',
                    desc: 'Drag & drop or browse - we auto-map columns from Amazon, Flipkart, Meesho & Myntra.',
                  },
                  {
                    n: 3,
                    title: 'Run reconciliation',
                    desc: 'We flag overcharges, missing payouts & settlement delays instantly.',
                  },
                ].map((step) => (
                  <div key={step.n} className="flex items-start gap-3.5">
                    <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border border-teal-100 bg-teal-50 text-sm font-bold text-teal-700">
                      {step.n}
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-slate-800">{step.title}</div>
                      <div className="mt-0.5 text-[13px] text-slate-400">{step.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div
              className="cursor-pointer rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 p-10 text-center transition-colors hover:border-teal-400 hover:bg-teal-50"
              onClick={() => setImportOpen(true)}
            >
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl border border-slate-200 bg-white text-teal-700">
                <UploadCloud className="w-7 h-7" />
              </div>
              <h4 className="mb-1 text-[17px] font-semibold text-slate-800">Drop your CSV here</h4>
              <p className="mb-5 text-[13px] text-slate-400">or click to browse · max 10 MB</p>
              <button className="mx-auto flex h-9 items-center gap-2 rounded-lg bg-teal-600 px-4 text-sm font-medium text-white">
                <Upload className="w-4 h-4" />
                Choose file
              </button>
              <a
                href="/templates/orders-template.csv"
                onClick={(event) => event.stopPropagation()}
                className="mt-4 flex items-center justify-center gap-1.5 text-[13px] font-semibold text-teal-700 hover:underline"
              >
                <Download className="w-3.5 h-3.5" />
                Download template
              </a>
            </div>
          </div>
        </div>
      )}

      {orders.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 px-5 py-4">
            <div>
              <div className="text-[15.5px] font-semibold text-slate-800">Saved orders</div>
              <div className="mt-0.5 text-[12.5px] text-slate-400">
                {filteredOrders.length} of {orders.length} orders
              </div>
            </div>
            <div className="ml-auto flex flex-wrap items-center gap-2.5">
              <div className="flex h-9 min-w-[220px] items-center gap-2 rounded-lg border border-slate-300 bg-white px-3">
                <Search className="w-4 h-4 flex-shrink-0 text-slate-400" />
                <input
                  placeholder="Search ID, SKU, marketplace…"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  className="w-full border-none bg-transparent text-sm text-slate-800 outline-none"
                />
              </div>
              <div className="flex gap-1.5">
                {[
                  { key: 'all', label: 'All', count: orders.length },
                  {
                    key: 'DELIVERED',
                    label: 'Delivered',
                    count: orders.filter((order) => order.operational_status === 'DELIVERED').length,
                    dot: '#0e9f6e',
                  },
                  {
                    key: 'SHIPPED',
                    label: 'In transit',
                    count: orders.filter((order) => order.operational_status === 'SHIPPED').length,
                    dot: '#2f6bff',
                  },
                  {
                    key: 'issues',
                    label: 'Issues',
                    count: orders.filter((order) => ['CANCELLED', 'RTO'].includes(order.operational_status || ''))
                      .length,
                    dot: '#d23f57',
                  },
                ].map((chip) => (
                  <button
                    key={chip.key}
                    onClick={() => setStatusFilter(chip.key)}
                    className={`flex h-8 items-center gap-1.5 rounded-full border px-3 text-[12.5px] font-semibold transition-colors ${
                      statusFilter === chip.key
                        ? 'border-slate-900 bg-slate-900 text-white'
                        : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {chip.dot && <span className="w-1.5 h-1.5 rounded-full" style={{ background: chip.dot }} />}
                    {chip.label}
                    <span className="text-[11px] opacity-70">{chip.count}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {loading ? (
            <div className="flex h-44 items-center justify-center text-sm text-slate-400">Loading orders…</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px]">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    {['Order', 'SKU', 'Marketplace', 'Qty', 'Selling price', 'Weight', 'Dispatch', 'Delivery', 'Status', ''].map(
                      (heading) => (
                        <th
                          key={heading}
                          className={`whitespace-nowrap px-4 py-3 text-left text-[11.5px] font-bold uppercase tracking-wide text-slate-400 ${
                            ['Qty', 'Selling price', 'Weight'].includes(heading) ? 'text-right' : ''
                          }`}
                        >
                          {heading}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {filteredOrders.map((order) => {
                    const marketplace = order.marketplace?.toLowerCase() || '';
                    const tint =
                      MP_TINT[marketplace as keyof typeof MP_TINT] || {
                        bg: '#f3f4f6',
                        fg: '#5a626d',
                        dot: '#8b929c',
                      };
                    const statusStyle =
                      STATUS_STYLE[order.operational_status as keyof typeof STATUS_STYLE] || {
                        bg: '#f3f4f6',
                        fg: '#5a626d',
                      };

                    return (
                      <tr
                        key={order.order_id}
                        className="group h-[52px] border-b border-slate-100 transition-colors last:border-b-0 hover:bg-slate-50"
                      >
                        <td className="px-4 py-0">
                          <div className="font-mono text-[12.5px] text-slate-800">{order.order_id}</div>
                          <div className="text-[11.5px] text-slate-400">
                            Updated {formatShortDate(order.updated_at || order.created_at)}
                          </div>
                        </td>
                        <td className="px-4 font-mono text-[12.5px] text-slate-800">{order.sku}</td>
                        <td className="px-4">
                          <span
                            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12.5px] font-semibold"
                            style={{ background: tint.bg, color: tint.fg }}
                          >
                            <span className="w-1.5 h-1.5 rounded-full" style={{ background: tint.dot }} />
                            {formatMarketplace(order.marketplace)}
                          </span>
                        </td>
                        <td className="px-4 text-right text-[13.5px] tabular-nums">{order.quantity}</td>
                        <td className="px-4 text-right text-[13.5px] font-semibold">
                          ₹{Number(order.selling_price || 0).toLocaleString('en-IN')}
                        </td>
                        <td className="px-4 text-right">
                          {order.weight_grams ? (
                            <span className="text-[13px] font-semibold text-teal-700">{order.weight_grams}g</span>
                          ) : (
                            <span className="text-[12px] font-semibold text-amber-600">Add</span>
                          )}
                        </td>
                        <td className="px-4 text-[13px] text-slate-600">{formatShortDate(order.dispatch_date)}</td>
                        <td className="px-4 text-[13px]">
                          {order.delivery_date ? (
                            <span className="text-slate-600">{formatShortDate(order.delivery_date)}</span>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>
                        <td className="px-4">
                          <span
                            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-semibold"
                            style={{ background: statusStyle.bg, color: statusStyle.fg }}
                          >
                            <span className="w-1.5 h-1.5 rounded-full" style={{ background: statusStyle.fg }} />
                            {formatStatus(order.operational_status)}
                          </span>
                        </td>
                        <td className="px-4">
                          <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                            <button className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-400 hover:text-slate-700">
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            <button className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-400 hover:text-slate-700">
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-400 hover:text-slate-700">
                              <MoreVertical className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3.5 text-[12.5px] text-slate-400">
            <span>
              Showing <strong className="text-slate-700">{filteredOrders.length}</strong> orders · {orders.length}{' '}
              total
            </span>
            <div className="flex gap-1.5">
              {['‹', '1', '2', '›'].map((page) => (
                <button
                  key={page}
                  disabled={page === '‹'}
                  className={`h-8 min-w-[32px] rounded-lg border px-2.5 text-[12.5px] font-semibold ${
                    page === '1'
                      ? 'border-slate-900 bg-slate-900 text-white'
                      : 'border-slate-300 bg-white text-slate-600 disabled:opacity-40'
                  }`}
                >
                  {page}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
