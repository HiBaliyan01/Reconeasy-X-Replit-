import React, { useState, useMemo } from 'react';
import { 
  Package, AlertTriangle, Shield, Clock, Search, Filter, Download, 
  Eye, TrendingDown, RefreshCw, CheckCircle, XCircle
} from 'lucide-react';
import { format } from 'date-fns';

interface ReturnData {
  id: string;
  order_id: string;
  return_id: string;
  marketplace: string;
  return_type: 'customer' | 'RTO' | 'fraud' | 'damage' | 'not_received';
  reason: string;
  amount: number;
  sku: string;
  status: string;
  sla_days: number;
  pincode: string;
  wms_received: boolean;
  wms_fraudulent: boolean;
  wms_received_at?: string;
  created_at: string;
}

const mockReturnsData: ReturnData[] = [
  {
    id: 'RET001',
    order_id: 'AMZ-ORD-001',
    return_id: 'RET-AMZ-001',
    marketplace: 'Amazon',
    return_type: 'customer',
    reason: 'Size too small',
    amount: 1299,
    sku: 'SHIRT-BL-M',
    status: 'processed',
    sla_days: 7,
    pincode: '400001',
    wms_received: true,
    wms_fraudulent: false,
    wms_received_at: '2024-01-20T10:30:00Z',
    created_at: '2024-01-15T10:30:00Z'
  },
  {
    id: 'RET002',
    order_id: 'FLP-ORD-002',
    return_id: 'RET-FLP-002',
    marketplace: 'Flipkart',
    return_type: 'RTO',
    reason: 'Delivery rejected by customer',
    amount: 2499,
    sku: 'JEANS-BK-L',
    status: 'pending',
    sla_days: 7,
    pincode: '110001',
    wms_received: true,
    wms_fraudulent: false,
    wms_received_at: '2024-01-18T14:20:00Z',
    created_at: '2024-01-16T14:15:00Z'
  },
  {
    id: 'RET003',
    order_id: 'MYN-ORD-003',
    return_id: 'RET-MYN-003',
    marketplace: 'Myntra',
    return_type: 'fraud',
    reason: 'Wrong item returned - fake product',
    amount: 1899,
    sku: 'DRESS-RD-S',
    status: 'flagged',
    sla_days: 7,
    pincode: '560001',
    wms_received: true,
    wms_fraudulent: true,
    wms_received_at: '2024-01-19T09:45:00Z',
    created_at: '2024-01-17T09:45:00Z'
  },
  {
    id: 'RET004',
    order_id: 'AJO-ORD-004',
    return_id: 'RET-AJO-004',
    marketplace: 'Ajio',
    return_type: 'damage',
    reason: 'Product damaged during shipping',
    amount: 899,
    sku: 'TSHIRT-WH-XL',
    status: 'processed',
    sla_days: 7,
    pincode: '600001',
    wms_received: true,
    wms_fraudulent: false,
    wms_received_at: '2024-01-20T16:20:00Z',
    created_at: '2024-01-18T16:20:00Z'
  },
  {
    id: 'RET005',
    order_id: 'NYK-ORD-005',
    return_id: 'RET-NYK-005',
    marketplace: 'Nykaa',
    return_type: 'not_received',
    reason: 'Return not delivered to warehouse',
    amount: 1599,
    sku: 'LIPSTICK-RD-01',
    status: 'pending',
    sla_days: 7,
    pincode: '400002',
    wms_received: false,
    wms_fraudulent: false,
    created_at: '2024-01-19T11:10:00Z'
  }
];

export default function EnhancedReturnsPage() {
  const [returns] = useState<ReturnData[]>(mockReturnsData);
  const [activeCategory, setActiveCategory] = useState<'all' | 'customer_rto' | 'fraud_damage' | 'not_received'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [marketplaceFilter, setMarketplaceFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  // Filter returns based on category and other filters
  const filteredReturns = useMemo(() => {
    let filtered = returns;

    // Category filter
    if (activeCategory === 'customer_rto') {
      filtered = filtered.filter(r => ['customer', 'RTO'].includes(r.return_type));
    } else if (activeCategory === 'fraud_damage') {
      filtered = filtered.filter(r => ['fraud', 'damage'].includes(r.return_type));
    } else if (activeCategory === 'not_received') {
      filtered = filtered.filter(r => r.return_type === 'not_received');
    }

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(r => 
        r.order_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.return_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.reason.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Marketplace filter
    if (marketplaceFilter !== 'all') {
      filtered = filtered.filter(r => r.marketplace === marketplaceFilter);
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(r => r.status === statusFilter);
    }

    return filtered;
  }, [returns, activeCategory, searchTerm, marketplaceFilter, statusFilter]);

  // Calculate metrics
  const metrics = useMemo(() => {
    const customerRtoCount = returns.filter(r => ['customer', 'RTO'].includes(r.return_type)).length;
    const fraudDamageCount = returns.filter(r => ['fraud', 'damage'].includes(r.return_type)).length;
    const notReceivedCount = returns.filter(r => r.return_type === 'not_received').length;
    const totalAmount = returns.reduce((sum, r) => sum + r.amount, 0);
    const fraudAmount = returns.filter(r => r.return_type === 'fraud').reduce((sum, r) => sum + r.amount, 0);
    
    return {
      customerRtoCount,
      fraudDamageCount,
      notReceivedCount,
      totalAmount,
      fraudAmount
    };
  }, [returns]);

  const getReturnTypeBadge = (returnType: string) => {
    const baseClasses = 'inline-flex items-center px-2 py-1 rounded-full text-xs font-medium';
    
    switch (returnType) {
      case 'customer':
        return `${baseClasses} bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400`;
      case 'RTO':
        return `${baseClasses} bg-purple-50 text-purple-700 dark:bg-purple-900/20 dark:text-purple-400`;
      case 'fraud':
        return `${baseClasses} bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400`;
      case 'damage':
        return `${baseClasses} bg-orange-50 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400`;
      case 'not_received':
        return `${baseClasses} bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400`;
      default:
        return `${baseClasses} bg-slate-50 text-slate-700 dark:bg-slate-700 dark:text-slate-300`;
    }
  };

  const getStatusBadge = (status: string) => {
    const baseClasses = 'inline-flex items-center px-2 py-1 rounded-full text-xs font-medium';
    
    switch (status) {
      case 'processed':
        return `${baseClasses} bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400`;
      case 'pending':
        return `${baseClasses} bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400`;
      case 'flagged':
        return `${baseClasses} bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400`;
      default:
        return `${baseClasses} bg-slate-50 text-slate-700 dark:bg-slate-700 dark:text-slate-300`;
    }
  };

  const exportToCSV = (category: string) => {
    let dataToExport = filteredReturns;
    
    if (category === 'customer_rto') {
      dataToExport = returns.filter(r => ['customer', 'RTO'].includes(r.return_type));
    } else if (category === 'fraud_damage') {
      dataToExport = returns.filter(r => ['fraud', 'damage'].includes(r.return_type));
    } else if (category === 'not_received') {
      dataToExport = returns.filter(r => r.return_type === 'not_received');
    }

    const csvData = dataToExport.map(r => ({
      'Order ID': r.order_id,
      'Return ID': r.return_id,
      'Marketplace': r.marketplace,
      'Return Type': r.return_type,
      'Reason': r.reason,
      'Amount': r.amount,
      'SKU': r.sku,
      'Status': r.status,
      'SLA Days': r.sla_days,
      'Pincode': r.pincode,
      'WMS Received': r.wms_received ? 'Yes' : 'No',
      'Fraudulent': r.wms_fraudulent ? 'Yes' : 'No',
      'Created Date': format(new Date(r.created_at), 'yyyy-MM-dd')
    }));

    const csv = [
      Object.keys(csvData[0]).join(','),
      ...csvData.map(row => Object.values(row).join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `returns_${category}_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const renderTable = () => {
    if (filteredReturns.length === 0) {
      return (
        <div className="text-center py-12">
          <Package className="w-12 h-12 text-slate-400 dark:text-slate-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100 mb-2">No Returns Found</h3>
          <p className="text-slate-600 dark:text-slate-400">
            No returns match your current filters.
          </p>
        </div>
      );
    }

    return (
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-slate-50 dark:bg-slate-700">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Order Details
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Marketplace
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Return Type
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Reason
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Amount
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                WMS Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Created
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-200 dark:divide-slate-700">
            {filteredReturns.map((returnItem) => (
              <tr key={returnItem.id} className="hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div>
                    <div className="text-sm font-medium text-slate-900 dark:text-slate-100">{returnItem.order_id}</div>
                    <div className="text-sm text-slate-500 dark:text-slate-400">Return: {returnItem.return_id}</div>
                    <div className="text-sm text-slate-500 dark:text-slate-400">SKU: {returnItem.sku}</div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-slate-900 dark:text-slate-100">{returnItem.marketplace}</div>
                  <div className="text-sm text-slate-500 dark:text-slate-400">{returnItem.pincode}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={getReturnTypeBadge(returnItem.return_type)}>
                    {returnItem.return_type.toUpperCase()}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <div className="text-sm text-slate-900 dark:text-slate-100 max-w-xs truncate" title={returnItem.reason}>
                    {returnItem.reason}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-slate-900 dark:text-slate-100">₹{returnItem.amount.toLocaleString()}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={getStatusBadge(returnItem.status)}>
                    {returnItem.status}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center space-x-2">
                    {returnItem.wms_received ? (
                      <CheckCircle className="w-4 h-4 text-emerald-500" />
                    ) : (
                      <XCircle className="w-4 h-4 text-red-500" />
                    )}
                    <span className="text-sm text-slate-900 dark:text-slate-100">
                      {returnItem.wms_received ? 'Received' : 'Not Received'}
                    </span>
                    {returnItem.wms_fraudulent && (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400">
                        Fraud
                      </span>
                    )}
                  </div>
                  {returnItem.wms_received_at && (
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      {format(new Date(returnItem.wms_received_at), 'MMM dd, yyyy')}
                    </div>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-slate-900 dark:text-slate-100">
                    {format(new Date(returnItem.created_at), 'MMM dd, yyyy')}
                  </div>
                  <div className="text-sm text-slate-500 dark:text-slate-400">
                    {format(new Date(returnItem.created_at), 'hh:mm a')}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-teal-600 to-emerald-600 dark:from-teal-700 dark:to-emerald-700 rounded-xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">Enhanced Returns Management</h2>
            <p className="text-teal-100 mt-1">Categorized return tracking with WMS integration and fraud detection</p>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={() => exportToCSV(activeCategory)}
              className="flex items-center space-x-2 bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg transition-colors"
            >
              <Download className="w-4 h-4" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Customer & RTO</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{metrics.customerRtoCount}</p>
            </div>
            <RefreshCw className="w-8 h-8 text-blue-500" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Fraud & Damage</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{metrics.fraudDamageCount}</p>
            </div>
            <AlertTriangle className="w-8 h-8 text-red-500" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Not Received</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{metrics.notReceivedCount}</p>
            </div>
            <Package className="w-8 h-8 text-amber-500" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Total Amount</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">₹{metrics.totalAmount.toLocaleString()}</p>
            </div>
            <TrendingDown className="w-8 h-8 text-purple-500" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Fraud Loss</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">₹{metrics.fraudAmount.toLocaleString()}</p>
            </div>
            <Shield className="w-8 h-8 text-red-500" />
          </div>
        </div>
      </div>

      {/* Category Filters */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Return Categories</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {filteredReturns.length} of {returns.length} returns
            </p>
          </div>
          
          <div className="flex items-center space-x-3">
            {/* Search */}
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 dark:text-slate-500" />
              <input
                type="text"
                placeholder="Search returns..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-sm bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-500 dark:placeholder-slate-400"
              />
            </div>
            
            {/* Marketplace Filter */}
            <select
              value={marketplaceFilter}
              onChange={(e) => setMarketplaceFilter(e.target.value)}
              className="px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-sm bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
            >
              <option value="all">All Marketplaces</option>
              <option value="Amazon">Amazon</option>
              <option value="Flipkart">Flipkart</option>
              <option value="Myntra">Myntra</option>
              <option value="Ajio">Ajio</option>
              <option value="Nykaa">Nykaa</option>
            </select>
            
            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-sm bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
            >
              <option value="all">All Statuses</option>
              <option value="processed">Processed</option>
              <option value="pending">Pending</option>
              <option value="flagged">Flagged</option>
            </select>
          </div>
        </div>

        {/* Category Buttons */}
        <div className="flex space-x-2">
          <button
            onClick={() => setActiveCategory('all')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeCategory === 'all'
                ? 'bg-teal-500 text-white'
                : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
            }`}
          >
            All Returns ({returns.length})
          </button>
          <button
            onClick={() => setActiveCategory('customer_rto')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeCategory === 'customer_rto'
                ? 'bg-teal-500 text-white'
                : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
            }`}
          >
            Customer & RTO ({metrics.customerRtoCount})
          </button>
          <button
            onClick={() => setActiveCategory('fraud_damage')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeCategory === 'fraud_damage'
                ? 'bg-teal-500 text-white'
                : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
            }`}
          >
            Fraud & Damage ({metrics.fraudDamageCount})
          </button>
          <button
            onClick={() => setActiveCategory('not_received')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeCategory === 'not_received'
                ? 'bg-teal-500 text-white'
                : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
            }`}
          >
            Not Received ({metrics.notReceivedCount})
          </button>
        </div>
      </div>

      {/* Returns Table */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
        {renderTable()}
      </div>
    </div>
  );
}