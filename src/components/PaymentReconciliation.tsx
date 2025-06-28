import React, { useState, useMemo } from 'react';
import { 
  CheckCircle, Clock, AlertTriangle, IndianRupee, Filter, Search, 
  Download, Eye, Calendar, TrendingDown, CreditCard, FileText
} from 'lucide-react';
import { format } from 'date-fns';

interface PaymentData {
  id: string;
  utr: string;
  order_id: string;
  marketplace: 'Amazon' | 'Flipkart' | 'Myntra';
  expected_amount: number;
  received_amount: number;
  discrepancy: number;
  status: 'reconciled' | 'overdue' | 'discrepancy';
  settlement_date: string;
  commission: number;
  tds: number;
  net_amount: number;
  days_overdue?: number;
  created_at: string;
}

const mockPaymentData: PaymentData[] = [
  {
    id: 'PAY001',
    utr: 'UTR202401001',
    order_id: 'MYN-ORD-001',
    marketplace: 'Myntra',
    expected_amount: 1500,
    received_amount: 1500,
    discrepancy: 0,
    status: 'reconciled',
    settlement_date: '2024-01-20T00:00:00Z',
    commission: 225,
    tds: 15,
    net_amount: 1260,
    created_at: '2024-01-15T10:30:00Z'
  },
  {
    id: 'PAY002',
    utr: 'UTR202401002',
    order_id: 'AMZ-ORD-002',
    marketplace: 'Amazon',
    expected_amount: 2500,
    received_amount: 0,
    discrepancy: 2500,
    status: 'overdue',
    settlement_date: '2024-01-18T00:00:00Z',
    commission: 375,
    tds: 25,
    net_amount: 0,
    days_overdue: 5,
    created_at: '2024-01-16T14:20:00Z'
  },
  {
    id: 'PAY003',
    utr: 'UTR202401003',
    order_id: 'FLP-ORD-003',
    marketplace: 'Flipkart',
    expected_amount: 1800,
    received_amount: 1750,
    discrepancy: 50,
    status: 'discrepancy',
    settlement_date: '2024-01-19T00:00:00Z',
    commission: 270,
    tds: 18,
    net_amount: 1462,
    created_at: '2024-01-17T09:15:00Z'
  }
];

export default function PaymentReconciliation() {
  const [payments] = useState<PaymentData[]>(mockPaymentData);
  const [activeSubTab, setActiveSubTab] = useState<'reconciled' | 'overdue' | 'discrepancy'>('reconciled');
  const [selectedPayment, setSelectedPayment] = useState<PaymentData | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [marketplaceFilter, setMarketplaceFilter] = useState('all');

  const marketplaceLogos = {
    Amazon: '/logos/amazon.png',
    Flipkart: '/logos/flipkart.png',
    Myntra: '/logos/myntra.png'
  };

  // Filter payments by sub-tab
  const filteredPayments = useMemo(() => {
    let filtered = payments.filter(payment => payment.status === activeSubTab);
    
    if (searchTerm) {
      filtered = filtered.filter(payment => 
        payment.utr.toLowerCase().includes(searchTerm.toLowerCase()) ||
        payment.order_id.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    if (marketplaceFilter !== 'all') {
      filtered = filtered.filter(payment => payment.marketplace === marketplaceFilter);
    }
    
    return filtered;
  }, [payments, activeSubTab, searchTerm, marketplaceFilter]);

  // Calculate metrics
  const metrics = useMemo(() => {
    const reconciled = payments.filter(p => p.status === 'reconciled');
    const overdue = payments.filter(p => p.status === 'overdue');
    const discrepancy = payments.filter(p => p.status === 'discrepancy');
    
    return {
      reconciledCount: reconciled.length,
      reconciledAmount: reconciled.reduce((sum, p) => sum + p.received_amount, 0),
      overdueCount: overdue.length,
      overdueAmount: overdue.reduce((sum, p) => sum + p.expected_amount, 0),
      discrepancyCount: discrepancy.length,
      discrepancyAmount: discrepancy.reduce((sum, p) => sum + Math.abs(p.discrepancy), 0)
    };
  }, [payments]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'reconciled':
        return <CheckCircle className="w-4 h-4 text-emerald-500" />;
      case 'overdue':
        return <Clock className="w-4 h-4 text-red-500" />;
      case 'discrepancy':
        return <AlertTriangle className="w-4 h-4 text-amber-500" />;
      default:
        return <Clock className="w-4 h-4 text-slate-500" />;
    }
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

  const renderCostBreakdown = (payment: PaymentData) => {
    return (
      <div className="bg-slate-50 dark:bg-slate-700 rounded-lg p-4 mt-4">
        <h4 className="text-sm font-medium text-slate-900 dark:text-slate-100 mb-3">Cost Breakdown</h4>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-600 dark:text-slate-400">Expected Amount:</span>
            <span className="font-medium text-slate-900 dark:text-slate-100">₹{payment.expected_amount.toLocaleString()}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-600 dark:text-slate-400">Commission ({((payment.commission / payment.expected_amount) * 100).toFixed(1)}%):</span>
            <span className="font-medium text-red-600 dark:text-red-400">-₹{payment.commission.toLocaleString()}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-600 dark:text-slate-400">TDS ({((payment.tds / payment.expected_amount) * 100).toFixed(1)}%):</span>
            <span className="font-medium text-red-600 dark:text-red-400">-₹{payment.tds.toLocaleString()}</span>
          </div>
          {payment.discrepancy !== 0 && (
            <div className="flex justify-between">
              <span className="text-slate-600 dark:text-slate-400">Discrepancy:</span>
              <span className={`font-medium ${payment.discrepancy > 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                {payment.discrepancy > 0 ? '-' : '+'}₹{Math.abs(payment.discrepancy).toLocaleString()}
              </span>
            </div>
          )}
          <div className="flex justify-between pt-2 border-t border-slate-200 dark:border-slate-600">
            <span className="text-slate-900 dark:text-slate-100 font-medium">Net Received:</span>
            <span className="font-bold text-emerald-600 dark:text-emerald-400">₹{payment.received_amount.toLocaleString()}</span>
          </div>
        </div>
      </div>
    );
  };

  const renderTable = () => {
    if (filteredPayments.length === 0) {
      return (
        <div className="text-center py-12">
          <CreditCard className="w-12 h-12 text-slate-400 dark:text-slate-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100 mb-2">No Payments Found</h3>
          <p className="text-slate-600 dark:text-slate-400">
            {activeSubTab === 'reconciled' && 'No reconciled payments in this period.'}
            {activeSubTab === 'overdue' && 'No overdue payments found.'}
            {activeSubTab === 'discrepancy' && 'No payment discrepancies detected.'}
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
                Payment Details
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Marketplace
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Expected
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Received
              </th>
              {activeSubTab === 'discrepancy' && (
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Discrepancy
                </th>
              )}
              {activeSubTab === 'overdue' && (
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Days Overdue
                </th>
              )}
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Settlement Date
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-200 dark:divide-slate-700">
            {filteredPayments.map((payment) => (
              <tr key={payment.id} className={`hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors ${
                activeSubTab === 'overdue' ? 'bg-red-50 dark:bg-red-900/10' :
                activeSubTab === 'discrepancy' ? 'bg-amber-50 dark:bg-amber-900/10' : ''
              }`}>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div>
                    <div className="text-sm font-medium text-slate-900 dark:text-slate-100">{payment.utr}</div>
                    <div className="text-sm text-slate-500 dark:text-slate-400">{payment.order_id}</div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center space-x-2">
                    <img 
                      src={marketplaceLogos[payment.marketplace]} 
                      alt={payment.marketplace} 
                      className="w-5 h-5"
                    />
                    <span className={getMarketplaceBadge(payment.marketplace)}>
                      {payment.marketplace}
                    </span>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900 dark:text-slate-100">
                  ₹{payment.expected_amount.toLocaleString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900 dark:text-slate-100">
                  ₹{payment.received_amount.toLocaleString()}
                </td>
                {activeSubTab === 'discrepancy' && (
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-red-600 dark:text-red-400">
                    ₹{Math.abs(payment.discrepancy).toLocaleString()}
                  </td>
                )}
                {activeSubTab === 'overdue' && (
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400">
                      {payment.days_overdue} days
                    </span>
                  </td>
                )}
                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900 dark:text-slate-100">
                  {format(new Date(payment.settlement_date), 'MMM dd, yyyy')}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <button
                    onClick={() => setSelectedPayment(payment)}
                    className="text-teal-600 dark:text-teal-400 hover:text-teal-900 dark:hover:text-teal-300 text-sm font-medium flex items-center space-x-1 hover:bg-teal-50 dark:hover:bg-teal-900/20 px-2 py-1 rounded transition-colors"
                  >
                    <Eye className="w-3 h-3" />
                    <span>Details</span>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  if (selectedPayment) {
    return (
      <div className="space-y-6">
        {/* Payment Detail Header */}
        <div className="bg-gradient-to-r from-teal-600 to-emerald-600 dark:from-teal-700 dark:to-emerald-700 rounded-xl p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <button
                onClick={() => setSelectedPayment(null)}
                className="text-teal-100 hover:text-white mb-2 text-sm"
              >
                ← Back to Payment Reconciliation
              </button>
              <h2 className="text-2xl font-bold">Payment Details</h2>
              <p className="text-teal-100 mt-1">{selectedPayment.utr}</p>
            </div>
            <div className="flex items-center space-x-2">
              {getStatusIcon(selectedPayment.status)}
              <span className="text-lg font-medium">{selectedPayment.status}</span>
            </div>
          </div>
        </div>

        {/* Payment Information */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">Payment Information</h3>
            
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">UTR Number</label>
                <p className="text-slate-900 dark:text-slate-100 mt-1 font-mono">{selectedPayment.utr}</p>
              </div>
              
              <div>
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Order ID</label>
                <p className="text-slate-900 dark:text-slate-100 mt-1">{selectedPayment.order_id}</p>
              </div>
              
              <div>
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Marketplace</label>
                <div className="flex items-center space-x-2 mt-1">
                  <img 
                    src={marketplaceLogos[selectedPayment.marketplace]} 
                    alt={selectedPayment.marketplace} 
                    className="w-5 h-5"
                  />
                  <span className={getMarketplaceBadge(selectedPayment.marketplace)}>
                    {selectedPayment.marketplace}
                  </span>
                </div>
              </div>
              
              <div>
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Settlement Date</label>
                <p className="text-slate-900 dark:text-slate-100 mt-1">
                  {format(new Date(selectedPayment.settlement_date), 'PPP')}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">Financial Summary</h3>
            
            <div className="space-y-4">
              <div className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-700 rounded-lg">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Expected Amount</span>
                <span className="text-lg font-bold text-slate-900 dark:text-slate-100">₹{selectedPayment.expected_amount.toLocaleString()}</span>
              </div>
              
              <div className="flex justify-between items-center p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">
                <span className="text-sm font-medium text-emerald-700 dark:text-emerald-300">Received Amount</span>
                <span className="text-lg font-bold text-emerald-900 dark:text-emerald-100">₹{selectedPayment.received_amount.toLocaleString()}</span>
              </div>
              
              {selectedPayment.discrepancy !== 0 && (
                <div className={`flex justify-between items-center p-3 rounded-lg ${
                  selectedPayment.discrepancy > 0 
                    ? 'bg-red-50 dark:bg-red-900/20' 
                    : 'bg-emerald-50 dark:bg-emerald-900/20'
                }`}>
                  <span className={`text-sm font-medium ${
                    selectedPayment.discrepancy > 0 
                      ? 'text-red-700 dark:text-red-300' 
                      : 'text-emerald-700 dark:text-emerald-300'
                  }`}>
                    Discrepancy
                  </span>
                  <span className={`text-lg font-bold ${
                    selectedPayment.discrepancy > 0 
                      ? 'text-red-900 dark:text-red-100' 
                      : 'text-emerald-900 dark:text-emerald-100'
                  }`}>
                    {selectedPayment.discrepancy > 0 ? '-' : '+'}₹{Math.abs(selectedPayment.discrepancy).toLocaleString()}
                  </span>
                </div>
              )}
            </div>

            {renderCostBreakdown(selectedPayment)}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-teal-600 to-emerald-600 dark:from-teal-700 dark:to-emerald-700 rounded-xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">Payment Reconciliation</h2>
            <p className="text-teal-100 mt-1">Track payment settlements, discrepancies, and overdue amounts</p>
          </div>
          <div className="flex items-center space-x-3">
            <button className="flex items-center space-x-2 bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg transition-colors">
              <Download className="w-4 h-4" />
              <span>Export Report</span>
            </button>
            <button className="flex items-center space-x-2 bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg transition-colors">
              <Filter className="w-4 h-4" />
              <span>Advanced Filters</span>
            </button>
          </div>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Reconciled Payments</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{metrics.reconciledCount}</p>
              <p className="text-sm text-emerald-600 dark:text-emerald-400 mt-1">₹{metrics.reconciledAmount.toLocaleString()}</p>
            </div>
            <CheckCircle className="w-8 h-8 text-emerald-500" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Overdue Payments</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{metrics.overdueCount}</p>
              <p className="text-sm text-red-600 dark:text-red-400 mt-1">₹{metrics.overdueAmount.toLocaleString()}</p>
            </div>
            <Clock className="w-8 h-8 text-red-500" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Discrepancies</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{metrics.discrepancyCount}</p>
              <p className="text-sm text-amber-600 dark:text-amber-400 mt-1">₹{metrics.discrepancyAmount.toLocaleString()}</p>
            </div>
            <AlertTriangle className="w-8 h-8 text-amber-500" />
          </div>
        </div>
      </div>

      {/* Search and Filter Controls */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Payment Records</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {filteredPayments.length} payments in {activeSubTab} status
            </p>
          </div>
          
          <div className="flex items-center space-x-3">
            {/* Search */}
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 dark:text-slate-500" />
              <input
                type="text"
                placeholder="Search UTR or Order ID..."
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
            </select>
          </div>
        </div>
      </div>

      {/* Sub-tabs and Table */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="border-b border-slate-200 dark:border-slate-700">
          <nav className="flex space-x-8 px-6">
            <button
              onClick={() => setActiveSubTab('reconciled')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeSubTab === 'reconciled'
                  ? 'border-teal-500 text-teal-600 dark:text-teal-400'
                  : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600'
              }`}
            >
              <div className="flex items-center space-x-2">
                <CheckCircle className="w-4 h-4" />
                <span>Reconciled</span>
                <span className="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300 text-xs px-2 py-1 rounded-full">
                  {metrics.reconciledCount}
                </span>
              </div>
            </button>

            <button
              onClick={() => setActiveSubTab('overdue')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeSubTab === 'overdue'
                  ? 'border-teal-500 text-teal-600 dark:text-teal-400'
                  : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600'
              }`}
            >
              <div className="flex items-center space-x-2">
                <Clock className="w-4 h-4" />
                <span>Payment Overdue</span>
                <span className="bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 text-xs px-2 py-1 rounded-full">
                  {metrics.overdueCount}
                </span>
              </div>
            </button>

            <button
              onClick={() => setActiveSubTab('discrepancy')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeSubTab === 'discrepancy'
                  ? 'border-teal-500 text-teal-600 dark:text-teal-400'
                  : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600'
              }`}
            >
              <div className="flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4" />
                <span>Payment Discrepancy</span>
                <span className="bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 text-xs px-2 py-1 rounded-full">
                  {metrics.discrepancyCount}
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
    </div>
  );
}