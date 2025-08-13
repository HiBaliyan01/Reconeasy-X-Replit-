import React, { useState, useMemo } from 'react';
import {
  AlertTriangle, CheckCircle, Clock, Filter, Search, Download,
  Package, TrendingDown, Calendar, FileText
} from 'lucide-react';
import { format } from 'date-fns';
import FilterPanel from './FilterPanel';
import ReturnsHead from './subtabs/ReturnsHead';

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
    { return_id: 'RET001', order_id: 'MYN-ORD-001', marketplace: 'Myntra', amount: 2499, sku: 'KURTA-XL-RED', created_at: '2024-01-15T10:30:00Z' },
    { return_id: 'RET002', order_id: 'AMZ-ORD-002', marketplace: 'Amazon', amount: 1899, sku: 'DRESS-M-BLUE', created_at: '2024-01-16T14:20:00Z' }
  ],
  fraudulent: [
    { return_id: 'RET003', order_id: 'FLP-ORD-003', marketplace: 'Flipkart', amount: 3299, sku: 'JEANS-L-BLACK', fraud_reason: 'Wrong item returned - received damaged product instead', created_at: '2024-01-17T09:15:00Z' }
  ],
  sla_violations: [
    { return_id: 'RET004', order_id: 'MYN-ORD-004', marketplace: 'Myntra', amount: 1599, sku: 'TSHIRT-S-WHITE', received_at: '2024-01-25T16:45:00Z', sla_days: 7, created_at: '2024-01-15T12:00:00Z' }
  ]
};

export default function ReturnReconciliation() {
  const [activeSubTab, setActiveSubTab] = useState<'undelivered' | 'fraudulent' | 'sla_violations'>('undelivered');
  const [reconciliationData] = useState<ReturnReconciliationData>(mockReconciliationData);
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

  const metrics = useMemo(() => ({
    totalUndelivered: reconciliationData.undelivered.length,
    totalFraudulent: reconciliationData.fraudulent.length,
    totalSLAViolations: reconciliationData.sla_violations.length,
    totalAmount: [
      ...reconciliationData.undelivered,
      ...reconciliationData.fraudulent,
      ...reconciliationData.sla_violations
    ].reduce((sum, item) => sum + item.amount, 0)
  }), [reconciliationData]);

  const exportToCSV = (data: any[], filename: string) => {
    const headers = Object.keys(data[0] || {});
    const csvContent = [
      headers.join(','),
      ...data.map(row => headers.map(header => row[header]).join(',')),
    ].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
    window.URL.revokeObjectURL(url);
  };

  const generateTicket = async (item: any, ticketType: string) => {
    setIsLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      const ticketId = `TKT${Date.now()}`;
      alert(`Ticket ${ticketId} created successfully for ${item.return_id}`);
    } finally {
      setIsLoading(false);
    }
  };

  const getMarketplaceBadge = (marketplace: string) => {
    const base = 'inline-flex items-center px-2 py-1 rounded-full text-xs font-medium';
    switch (marketplace) {
      case 'Amazon': return `${base} bg-orange-50 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400`;
      case 'Flipkart': return `${base} bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400`;
      case 'Myntra': return `${base} bg-pink-50 text-pink-700 dark:bg-pink-900/20 dark:text-pink-400`;
      default: return `${base} bg-slate-50 text-slate-700 dark:bg-slate-700 dark:text-slate-300`;
    }
  };

  const dataForTab = () => {
    switch (activeSubTab) {
      case 'undelivered': return {
        rows: reconciliationData.undelivered,
        columns: ['Return ID', 'Order ID', 'Marketplace', 'Amount (₹)', 'SKU', 'Created', 'Action'] as const,
      };
      case 'fraudulent': return {
        rows: reconciliationData.fraudulent,
        columns: ['Return ID', 'Order ID', 'Marketplace', 'Amount (₹)', 'SKU', 'Fraud Reason', 'Created', 'Action'] as const,
      };
      case 'sla_violations': return {
        rows: reconciliationData.sla_violations,
        columns: ['Return ID', 'Order ID', 'Marketplace', 'Amount (₹)', 'SKU', 'Received At', 'SLA Days', 'Created', 'Action'] as const,
      };
    }
  };

  const renderTable = () => {
    const tab = dataForTab();
    const rows = tab?.rows ?? [];
    const columns = tab?.columns ?? [];

    if (rows.length === 0) {
      return (
        <div className="text-center py-12">
          <Package className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-2">No Issues Found</h3>
          <p className="text-muted-foreground">
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
          <thead className="bg-muted">
            <tr>
              {columns.map((c) => (
                <th key={c} className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-card divide-y divide-border">
            {rows.map((item: any, index: number) => (
              <tr key={index} className="hover:bg-muted/50 transition-colors">
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-foreground">{item.return_id}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">{item.order_id}</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={getMarketplaceBadge(item.marketplace)}>{item.marketplace}</span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-foreground">
                  ₹{item.amount.toLocaleString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">{item.sku}</td>

                {activeSubTab === 'fraudulent' && (
                  <td className="px-6 py-4 text-sm text-foreground max-w-xs">
                    <div className="truncate" title={item.fraud_reason}>{item.fraud_reason}</div>
                  </td>
                )}

                {activeSubTab === 'sla_violations' && (
                  <>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                      {format(new Date(item.received_at), 'MMM dd, yyyy')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                      {item.sla_days} days
                    </td>
                  </>
                )}

                <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                  {format(new Date(item.created_at), 'MMM dd, yyyy')}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <button
                    onClick={() => generateTicket(item, activeSubTab)}
                    disabled={isLoading}
                    className="text-subheader-returns hover:bg-subheader-returns/10 text-sm font-medium flex items-center gap-1 px-2 py-1 rounded transition-colors disabled:opacity-50"
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
      {/* ✅ Standardized header (same size/shape as Payments) */}
      <ReturnsHead />

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-card rounded-xl shadow-sm border border-border p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Undelivered Returns</p>
              <p className="text-2xl font-bold text-foreground">{metrics.totalUndelivered}</p>
              <p className="text-xs text-muted-foreground mt-1">Returns marked delivered but not received in warehouse</p>
            </div>
            <Package className="w-8 h-8 text-amber-500" />
          </div>
        </div>

        <div className="bg-card rounded-xl shadow-sm border border-border p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Fraudulent Returns</p>
              <p className="text-2xl font-bold text-foreground">{metrics.totalFraudulent}</p>
              <p className="text-xs text-muted-foreground mt-1">Returns with fraudulent items detected by WMS</p>
            </div>
            <AlertTriangle className="w-8 h-8 text-red-500" />
          </div>
        </div>

        <div className="bg-card rounded-xl shadow-sm border border-border p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">SLA Violations</p>
              <p className="text-2xl font-bold text-foreground">{metrics.totalSLAViolations}</p>
              <p className="text-xs text-muted-foreground mt-1">Returns received after marketplace SLA</p>
            </div>
            <Clock className="w-8 h-8 text-orange-500" />
          </div>
        </div>

        <div className="bg-card rounded-xl shadow-sm border border-border p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Total Impact</p>
              <p className="text-2xl font-bold text-foreground">₹{metrics.totalAmount.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground mt-1">Total value of problematic returns</p>
            </div>
            <TrendingDown className="w-8 h-8 text-purple-500" />
          </div>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="bg-card rounded-xl shadow-sm border border-border p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-foreground">Return Issues</h3>
            <p className="text-sm text-muted-foreground">WMS-integrated return reconciliation and discrepancy management</p>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <select
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value)}
                className="px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-subheader-returns focus:border-subheader-returns text-sm bg-card text-foreground"
              >
                <option value="last_7_days">Last 7 Days</option>
                <option value="last_30_days">Last 30 Days</option>
                <option value="this_month">This Month</option>
                <option value="custom">Custom Range</option>
              </select>
            </div>

            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search returns..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-subheader-returns focus:border-subheader-returns text-sm bg-card text-foreground placeholder-muted-foreground"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="bg-card rounded-xl shadow-sm border border-border overflow-hidden">
        <div className="border-b border-border">
          <nav className="flex space-x-8 px-6">
            {[
              { key: 'undelivered', label: 'Undelivered Returns', Icon: Package, badgeClass: 'bg-amber-100 text-amber-800' },
              { key: 'fraudulent', label: 'Fraudulent Returns', Icon: AlertTriangle, badgeClass: 'bg-red-100 text-red-800' },
              { key: 'sla_violations', label: 'SLA Violations', Icon: Clock, badgeClass: 'bg-orange-100 text-orange-800' },
            ].map(({ key, label, Icon, badgeClass }) => (
              <button
                key={key}
                onClick={() => setActiveSubTab(key as any)}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeSubTab === key
                    ? 'border-subheader-returns text-subheader-returns'
                    : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
                }`}
              >
                <span className="flex items-center gap-2">
                  <Icon className="w-4 h-4" />
                  <span>{label}</span>
                </span>
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6">{renderTable()}</div>
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