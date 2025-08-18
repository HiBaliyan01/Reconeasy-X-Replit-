import React, { useState } from 'react';
import { RotateCcw, AlertTriangle, CheckCircle, Clock, TrendingUp, TrendingDown, Download } from 'lucide-react';
import Badge from './Badge';

interface ReconciliationResult {
  return_id: string;
  order_id: string;
  return_reason: string;
  status: string;
  expected_refund: number | null;
  actual_refund: number | null;
  discrepancy: number | null;
  marketplace: string;
  sku: string;
}

const ReconcileReturns: React.FC = () => {
  const [data, setData] = useState<ReconciliationResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastReconciled, setLastReconciled] = useState<Date | null>(null);

  const handleReconcile = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/returns/reconcile');
      const json = await res.json();
      setData(json);
      setLastReconciled(new Date());
    } catch (error) {
      console.error('Reconciliation failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const getDiscrepancyStatus = (discrepancy: number | null) => {
    if (discrepancy === null) return 'unknown';
    if (discrepancy === 0) return 'matched';
    return Math.abs(discrepancy) > 100 ? 'high' : 'low';
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status.toLowerCase()) {
      case 'refunded':
      case 'completed':
        return 'positive';
      case 'processing':
      case 'pending':
        return 'purple';
      case 'failed':
      case 'rejected':
        return 'negative';
      default:
        return 'neutral';
    }
  };

  const totalDiscrepancy = data.reduce((sum, item) => sum + (item.discrepancy || 0), 0);
  const matchedCount = data.filter(item => item.discrepancy === 0).length;
  const discrepancyCount = data.filter(item => item.discrepancy !== 0 && item.discrepancy !== null).length;

  const exportDiscrepancies = () => {
    // Filter data to only include rows with non-zero discrepancies
    const discrepancyData = data.filter(item => item.discrepancy !== 0 && item.discrepancy !== null);
    
    if (discrepancyData.length === 0) {
      alert('No discrepancies found to export');
      return;
    }

    // Prepare CSV data with specified headers
    const csvData = discrepancyData.map(item => ({
      return_id: item.return_id,
      order_id: item.order_id,
      return_reason: item.return_reason,
      qc_status: item.status,
      expected_refund: item.expected_refund || 0,
      actual_refund: item.actual_refund || 0,
      discrepancy: item.discrepancy || 0
    }));

    // Convert to CSV format
    const headers = ['return_id', 'order_id', 'return_reason', 'qc_status', 'expected_refund', 'actual_refund', 'discrepancy'];
    const csvContent = [
      headers.join(','),
      ...csvData.map(row => headers.map(header => `"${row[header as keyof typeof row]}"`).join(','))
    ].join('\n');

    // Create and download file
    const today = new Date().toISOString().split('T')[0]; // yyyy-mm-dd format
    const filename = `returns-discrepancies-${today}.csv`;
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="reconeasy-primary-gradient rounded-xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold mb-2">Return Reconciliation</h2>
            <p className="text-blue-100">Automated matching of expected vs actual refund amounts</p>
          </div>
          <button 
            onClick={handleReconcile} 
            disabled={loading}
            className="bg-white/20 hover:bg-white/30 text-white px-6 py-3 rounded-lg font-medium transition-colors flex items-center space-x-2 disabled:opacity-50"
          >
            <RotateCcw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            <span>{loading ? 'Reconciling...' : 'Reconcile Returns'}</span>
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      {data.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
                <TrendingUp className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-sm text-slate-600 dark:text-slate-400">Total Returns</p>
                <p className="text-xl font-bold text-slate-900 dark:text-slate-100">{data.length}</p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-green-100 dark:bg-green-900/20 rounded-lg">
                <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-sm text-slate-600 dark:text-slate-400">Matched</p>
                <p className="text-xl font-bold positive-value">{matchedCount}</p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-red-100 dark:bg-red-900/20 rounded-lg">
                <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <p className="text-sm text-slate-600 dark:text-slate-400">Discrepancies</p>
                <p className="text-xl font-bold negative-value">{discrepancyCount}</p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-yellow-100 dark:bg-yellow-900/20 rounded-lg">
                <TrendingDown className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
              </div>
              <div>
                <p className="text-sm text-slate-600 dark:text-slate-400">Total Discrepancy</p>
                <p className={`text-xl font-bold ${totalDiscrepancy >= 0 ? 'positive-value' : 'negative-value'}`}>
                  ₹{Math.abs(totalDiscrepancy).toLocaleString()}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Last Reconciled Info */}
      {lastReconciled && (
        <div className="flex items-center space-x-2 text-sm text-slate-600 dark:text-slate-400">
          <Clock className="w-4 h-4" />
          <span>Last reconciled: {lastReconciled.toLocaleString()}</span>
        </div>
      )}

      {/* Export Button and Results Table */}
      {data.length > 0 && (
        <div className="space-y-4">
          {/* Export Button - Only show if there are discrepancies */}
          {discrepancyCount > 0 && (
            <div className="flex justify-end">
              <button
                onClick={exportDiscrepancies}
                className="bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded-lg font-medium transition-colors flex items-center space-x-2"
              >
                <Download className="w-4 h-4" />
                <span>📤 Export Discrepancies</span>
              </button>
            </div>
          )}

          {/* Results Table */}
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-accent dark:bg-slate-700">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 dark:text-slate-400 uppercase tracking-wider">Return ID</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 dark:text-slate-400 uppercase tracking-wider">Order ID</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 dark:text-slate-400 uppercase tracking-wider">Marketplace</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 dark:text-slate-400 uppercase tracking-wider">SKU</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 dark:text-slate-400 uppercase tracking-wider">Reason</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 dark:text-slate-400 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 dark:text-slate-400 uppercase tracking-wider">Expected</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 dark:text-slate-400 uppercase tracking-wider">Actual</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 dark:text-slate-400 uppercase tracking-wider">Discrepancy</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                {data.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-700">
                    <td className="px-4 py-3 text-sm font-medium text-slate-900 dark:text-slate-100">{row.return_id}</td>
                    <td className="px-4 py-3 text-sm text-slate-900 dark:text-slate-100">{row.order_id}</td>
                    <td className="px-4 py-3 text-sm text-slate-900 dark:text-slate-100">{row.marketplace}</td>
                    <td className="px-4 py-3 text-sm text-slate-900 dark:text-slate-100">{row.sku}</td>
                    <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">{row.return_reason}</td>
                    <td className="px-4 py-3 text-sm">
                      <Badge 
                        label={row.status} 
                        variant={getStatusBadgeVariant(row.status)}
                      />
                    </td>
                    <td className="px-4 py-3 text-sm positive-value">
                      {row.expected_refund ? `₹${row.expected_refund.toLocaleString()}` : '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-blue-600 dark:text-blue-400">
                      {row.actual_refund ? `₹${row.actual_refund.toLocaleString()}` : '-'}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {row.discrepancy !== null ? (
                        <span className={`font-medium ${
                          row.discrepancy === 0 ? 'positive-value' : 
                          row.discrepancy > 0 ? 'text-orange-600 dark:text-orange-400' : 'negative-value'
                        }`}>
                          {row.discrepancy === 0 ? 'Matched' : `₹${row.discrepancy.toLocaleString()}`}
                        </span>
                      ) : (
                        <span className="neutral-value">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!loading && data.length === 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-12 text-center">
          <RotateCcw className="w-12 h-12 text-slate-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100 mb-2">No Reconciliation Data</h3>
          <p className="text-slate-600 dark:text-slate-400 mb-6">
            Click "Reconcile Returns" to start matching expected vs actual refund amounts.
          </p>
          <button 
            onClick={handleReconcile}
            className="bg-primary hover:bg-primary/90 text-primary-foreground px-6 py-3 rounded-lg font-medium transition-colors flex items-center space-x-2 mx-auto"
          >
            <RotateCcw className="w-5 h-5" />
            <span>Start Reconciliation</span>
          </button>
        </div>
      )}
    </div>
  );
};

export default ReconcileReturns;