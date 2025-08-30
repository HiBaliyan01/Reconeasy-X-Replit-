import React, { useState, useEffect, useMemo } from 'react';
import { 
  AlertTriangle, CheckCircle, Clock, Filter, Search, Download, 
  RefreshCw, Package, TrendingDown, Calendar, FileText, Eye
} from 'lucide-react';
import { format } from 'date-fns';
import FilterPanel from './FilterPanel';

interface ReturnReconciliationData {
  undelivered: Array<{
    return_id: string;
    order_id: string;
    marketplace: string;
    amount: number;
    sku: string;
    created_at: string;
  }>;
  fraudulent: Array<{
    return_id: string;
    order_id: string;
    marketplace: string;
    amount: number;
    sku: string;
    fraud_reason: string;
    created_at: string;
  }>;
  sla_violations: Array<{
    return_id: string;
    order_id: string;
    marketplace: string;
    amount: number;
    sku: string;
    received_at: string;
    sla_days: number;
    created_at: string;
  }>;
}

const mockReconciliationData: ReturnReconciliationData = {
  undelivered: [
    {
      return_id: 'RET001',
      order_id: 'MYN-ORD-001',
      marketplace: 'Myntra',
      amount: 2499,
      sku: 'KURTA-XL-RED',
      created_at: '2024-01-15T10:30:00Z'
    },
    {
      return_id: 'RET002',
      order_id: 'AMZ-ORD-002',
      marketplace: 'Amazon',
      amount: 1899,
      sku: 'DRESS-M-BLUE',
      created_at: '2024-01-16T14:20:00Z'
    }
  ],
  fraudulent: [
    {
      return_id: 'RET003',
      order_id: 'FLP-ORD-003',
      marketplace: 'Flipkart',
      amount: 3299,
      sku: 'JEANS-L-BLACK',
      fraud_reason: 'Wrong item returned - received damaged product instead',
      created_at: '2024-01-17T09:15:00Z'
    }
  ],
  sla_violations: [
    {
      return_id: 'RET004',
      order_id: 'MYN-ORD-004',
      marketplace: 'Myntra',
      amount: 1599,
      sku: 'TSHIRT-S-WHITE',
      received_at: '2024-01-25T16:45:00Z',
      sla_days: 7,
      created_at: '2024-01-15T12:00:00Z'
    }
  ]
};

export default function ReturnReconciliation() {
  const [activeSubTab, setActiveSubTab] = useState<'undelivered' | 'fraudulent' | 'sla_violations'>('undelivered');
  const [reconciliationData, setReconciliationData] = useState<ReturnReconciliationData>(mockReconciliationData);
  const [showFilters, setShowFilters] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateRange, setDateRange] = useState('last_30_days');
  const [isLoading, setIsLoading] = useState(false);
  const [filters, setFilters] = useState({
    dateRange: { start: '', end: '' },
    marketplace: '',
    status: '',
    amountRange: { min: '', max: '' },
    category: ''
  });

  const filterOptions = {
    marketplaces: ['Amazon', 'Flipkart', 'Myntra'],
    statuses: ['pending', 'processed', 'rejected'],
    categories: ['undelivered', 'fraudulent', 'sla_violation']
  };

  // Calculate metrics
  const metrics = useMemo(() => {
    return {
      totalUndelivered: reconciliationData.undelivered.length,
      totalFraudulent: reconciliationData.fraudulent.length,
      totalSLAViolations: reconciliationData.sla_violations.length,
      totalAmount: [
        ...reconciliationData.undelivered,
        ...reconciliationData.fraudulent,
        ...reconciliationData.sla_violations
      ].reduce((sum, item) => sum + item.amount, 0)
    };
  }, [reconciliationData]);

  const generateTicket = async (item: any, ticketType: string) => {
    setIsLoading(true);
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const ticketId = `TKT${Date.now()}`;
      alert(`Ticket ${ticketId} created successfully for ${item.return_id}`);
    } catch (error) {
      alert('Failed to create ticket. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const exportToCSV = (data: any[], filename: string) => {
    const headers = Object.keys(data[0] || {});
    const csvContent = [
      headers.join(','),
      ...data.map(row => headers.map(header => row[header]).join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const getMarketplaceBadge = (marketplace: string) => {
    const baseClasses = 'inline-flex items-center px-2 py-1 rounded-full text-xs font-medium';
    
    switch (marketplace) {
      case 'Amazon':
        return `${baseClasses} bg-orange-50 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400`;
      case 'Flipkart':
        return `${baseClasses} bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400`;
      case 'Myntra':
        return `${baseClasses} bg-pink-50 text-pink-700 dark:bg-pink-900/20 dark:text-pink-400`;
      default:
        return `${baseClasses} bg-slate-50 text-slate-700 dark:bg-slate-700 dark:text-slate-300`;
    }
  };

  const renderTable = () => {
    let data: any[] = [];
    let columns: string[] = [];
    
    switch (activeSubTab) {
      case 'undelivered':
        data = reconciliationData.undelivered;
        columns = ['Return ID', 'Order ID', 'Marketplace', 'Amount (₹)', 'SKU', 'Created', 'Action'];
        break;
      case 'fraudulent':
        data = reconciliationData.fraudulent;
        columns = ['Return ID', 'Order ID', 'Marketplace', 'Amount (₹)', 'SKU', 'Fraud Reason', 'Created', 'Action'];
        break;
      case 'sla_violations':
        data = reconciliationData.sla_violations;
        columns = ['Return ID', 'Order ID', 'Marketplace', 'Amount (₹)', 'SKU', 'Received At', 'SLA Days', 'Created', 'Action'];
        break;
    }

    if (data.length === 0) {
      return (
        <div className="text-center py-12">
          <Package className="w-12 h-12 text-slate-400 dark:text-slate-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100 mb-2">No Issues Found</h3>
          <p className="text-slate-600 dark:text-slate-400">
            {activeSubTab === 'undelivered' && 'All returns have been delivered to the warehouse.'}
            {activeSubTab === 'fraudulent' && 'No fraudulent returns detected.'}
            {activeSubTab === 'sla_violations' && 'All returns are within SLA compliance.'}
          </p>
        </div>
      );
    }

    return (
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-slate-50 dark:bg-slate-700">
            <tr>
              {columns.map((column, index) => (
                <th key={index} className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-200 dark:divide-slate-700">
            {data.map((item, index) => (
              <tr key={index} className={`hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors ${
                activeSubTab === 'fraudulent' ? 'bg-red-50 dark:bg-red-900/10' : ''
              }`}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900 dark:text-slate-100">
                  {item.return_id}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900 dark:text-slate-100">
                  {item.order_id}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={getMarketplaceBadge(item.marketplace)}>
                    {item.marketplace}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900 dark:text-slate-100">
                  ₹{item.amount.toLocaleString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900 dark:text-slate-100">
                  {item.sku}
                </td>
                {activeSubTab === 'fraudulent' && (
                  <td className="px-6 py-4 text-sm text-slate-900 dark:text-slate-100 max-w-xs">
                    <div className="truncate" title={item.fraud_reason}>
                      {item.fraud_reason}
                    </div>
                  </td>
                )}
                {activeSubTab === 'sla_violations' && (
                  <>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900 dark:text-slate-100">
                      {format(new Date(item.received_at), 'MMM dd, yyyy')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900 dark:text-slate-100">
                      {item.sla_days} days
                    </td>
                  </>
                )}
                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900 dark:text-slate-100">
                  {format(new Date(item.created_at), 'MMM dd, yyyy')}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <button
                    onClick={() => generateTicket(item, activeSubTab)}
                    disabled={isLoading}
                    className="text-teal-600 dark:text-teal-400 hover:text-teal-900 dark:hover:text-teal-300 text-sm font-medium flex items-center space-x-1 hover:bg-teal-50 dark:hover:bg-teal-900/20 px-2 py-1 rounded transition-colors disabled:opacity-50"
                  >
                    <FileText className="w-3 h-3" />
                    <span>{isLoading ? 'Creating...' : 'Generate Ticket'}</span>
                  </button>
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
            <h2 className="text-2xl font-bold">Return Reconciliation</h2>
            <p className="text-teal-100 mt-1">WMS-powered return tracking with automated discrepancy detection</p>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setShowFilters(true)}
              className="flex items-center space-x-2 bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg transition-colors"
            >
              <Filter className="w-4 h-4" />
              <span>Advanced Filters</span>
            </button>
            <button
              onClick={() => exportToCSV(
                activeSubTab === 'undelivered' ? reconciliationData.undelivered :
                activeSubTab === 'fraudulent' ? reconciliationData.fraudulent :
                reconciliationData.sla_violations,
                `${activeSubTab}_returns.csv`
              )}
              className="flex items-center space-x-2 bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg transition-colors"
            >
              <Download className="w-4 h-4" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Undelivered Returns</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{metrics.totalUndelivered}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Returns marked delivered but not received in warehouse</p>
            </div>
            <Package className="w-8 h-8 text-amber-500" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Fraudulent Returns</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{metrics.totalFraudulent}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Returns with fraudulent items detected by WMS</p>
            </div>
            <AlertTriangle className="w-8 h-8 text-red-500" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400">SLA Violations</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{metrics.totalSLAViolations}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Returns received after marketplace SLA</p>
            </div>
            <Clock className="w-8 h-8 text-orange-500" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Total Impact</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">₹{metrics.totalAmount.toLocaleString()}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Total value of problematic returns</p>
            </div>
            <TrendingDown className="w-8 h-8 text-purple-500" />
          </div>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Return Issues</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              WMS-integrated return reconciliation and discrepancy management
            </p>
          </div>
          
          <div className="flex items-center space-x-3">
            {/* Date Range Filter */}
            <div className="flex items-center space-x-2">
              <Calendar className="w-4 h-4 text-slate-400 dark:text-slate-500" />
              <select
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value)}
                className="px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-sm bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
              >
                <option value="last_7_days">Last 7 Days</option>
                <option value="last_30_days">Last 30 Days</option>
                <option value="this_month">This Month</option>
                <option value="custom">Custom Range</option>
              </select>
            </div>

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
          </div>
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="border-b border-slate-200 dark:border-slate-700">
          <nav className="flex space-x-8 px-6">
            <button
              onClick={() => setActiveSubTab('undelivered')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeSubTab === 'undelivered'
                  ? 'border-teal-500 text-teal-600 dark:text-teal-400'
                  : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600'
              }`}
            >
              <div className="flex items-center space-x-2">
                <Package className="w-4 h-4" />
                <span>Undelivered Returns</span>
                <span className="bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 text-xs px-2 py-1 rounded-full">
                  {metrics.totalUndelivered}
                </span>
              </div>
            </button>

            <button
              onClick={() => setActiveSubTab('fraudulent')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeSubTab === 'fraudulent'
                  ? 'border-teal-500 text-teal-600 dark:text-teal-400'
                  : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600'
              }`}
            >
              <div className="flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4" />
                <span>Fraudulent Returns</span>
                <span className="bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 text-xs px-2 py-1 rounded-full">
                  {metrics.totalFraudulent}
                </span>
              </div>
            </button>

            <button
              onClick={() => setActiveSubTab('sla_violations')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeSubTab === 'sla_violations'
                  ? 'border-teal-500 text-teal-600 dark:text-teal-400'
                  : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600'
              }`}
            >
              <div className="flex items-center space-x-2">
                <Clock className="w-4 h-4" />
                <span>SLA Violations</span>
                <span className="bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300 text-xs px-2 py-1 rounded-full">
                  {metrics.totalSLAViolations}
                </span>
              </div>
            </button>
          </nav>
        </div>

        {/* Table Content */}
        <div className="p-6">
          {renderTable()}
        </div>
      </div>

      {/* Filter Panel */}
      <FilterPanel
        isOpen={showFilters}
        onClose={() => setShowFilters(false)}
        filters={filters}
        onFilterChange={setFilters}
        filterOptions={filterOptions}
      />
    </div>
  );
}