import React, { useState, useEffect, useMemo } from 'react';
import { 
  Package, AlertTriangle, Shield, Clock, Search, Filter, Download, 
  Eye, TrendingDown, RefreshCw, CheckCircle, XCircle, FileText,
  IndianRupee, Users, BarChart3, Target
} from 'lucide-react';
import { format } from 'date-fns';
import { ReturnOrder, ReturnCategories, ReturnMetrics } from '../types/returns';
import { returnProcessor } from '../utils/returnProcessor';
import { mockReturnOrders } from '../data/mockReturnData';

export default function EnhancedReturnsManagement() {
  const [returnOrders] = useState<ReturnOrder[]>(mockReturnOrders);
  const [categories, setCategories] = useState<ReturnCategories | null>(null);
  const [metrics, setMetrics] = useState<ReturnMetrics | null>(null);
  const [activeCategory, setActiveCategory] = useState<keyof ReturnCategories>('customer_returns');
  const [selectedReturn, setSelectedReturn] = useState<ReturnOrder | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [marketplaceFilter, setMarketplaceFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    const handleUpdate = (newCategories: ReturnCategories, newMetrics: ReturnMetrics) => {
      setCategories(newCategories);
      setMetrics(newMetrics);
    };

    returnProcessor.processReturnsAsync(returnOrders, handleUpdate);

    return () => {
      returnProcessor.stopProcessing();
    };
  }, [returnOrders]);

  // Filter returns based on current category and filters
  const filteredReturns = useMemo(() => {
    if (!categories) return [];
    
    let returns = categories[activeCategory];
    
    if (searchTerm) {
      returns = returns.filter(returnOrder => 
        returnOrder.order_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        returnOrder.return_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        returnOrder.product_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        returnOrder.sku.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    if (marketplaceFilter !== 'all') {
      returns = returns.filter(returnOrder => returnOrder.marketplace === marketplaceFilter);
    }
    
    if (statusFilter !== 'all') {
      returns = returns.filter(returnOrder => returnOrder.claim_status === statusFilter);
    }
    
    return returns;
  }, [categories, activeCategory, searchTerm, marketplaceFilter, statusFilter]);

  const getStatusBadge = (status: ReturnOrder['claim_status']) => {
    const baseClasses = 'inline-flex items-center px-2 py-1 rounded-full text-xs font-medium';
    
    switch (status) {
      case 'not_filed':
        return `${baseClasses} bg-slate-50 text-slate-700 dark:bg-slate-700 dark:text-slate-300`;
      case 'filed':
        return `${baseClasses} bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400`;
      case 'approved':
        return `${baseClasses} bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400`;
      case 'rejected':
        return `${baseClasses} bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400`;
      case 'pending':
        return `${baseClasses} bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400`;
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
      case 'Ajio':
        return `${baseClasses} bg-purple-50 text-purple-700 dark:bg-purple-900/20 dark:text-purple-400`;
      case 'Nykaa':
        return `${baseClasses} bg-rose-50 text-rose-700 dark:bg-rose-900/20 dark:text-rose-400`;
      default:
        return `${baseClasses} bg-slate-50 text-slate-700 dark:bg-slate-700 dark:text-slate-300`;
    }
  };

  const handleFileClaim = (returnOrder: ReturnOrder) => {
    const updatedOrder = returnProcessor.fileClaimForReturn(returnOrder, returnOrder.loss_amount);
    console.log('Filing claim for:', updatedOrder);
    // In real implementation, this would update the backend
  };

  const exportToCSV = () => {
    const csvData = filteredReturns.map(returnOrder => ({
      'Order ID': returnOrder.order_id,
      'Return ID': returnOrder.return_id,
      'Marketplace': returnOrder.marketplace,
      'Product': returnOrder.product_name,
      'SKU': returnOrder.sku,
      'Return Reason': returnOrder.return_reason,
      'Loss Amount': `₹${returnOrder.loss_amount}`,
      'Claim Status': returnOrder.claim_status,
      'Claim Amount': `₹${returnOrder.claim_amount}`,
      'Seller Paid': returnOrder.seller_paid ? 'Yes' : 'No',
      'Return Date': format(new Date(returnOrder.return_date), 'yyyy-MM-dd')
    }));

    const csv = [
      Object.keys(csvData[0]).join(','),
      ...csvData.map(row => Object.values(row).join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `returns_${activeCategory}_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  if (!categories || !metrics) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-500"></div>
        <span className="ml-2">Processing returns...</span>
      </div>
    );
  }

  if (selectedReturn) {
    return (
      <div className="space-y-6">
        {/* Return Detail Header */}
        <div className="bg-gradient-to-r from-teal-600 to-emerald-600 dark:from-teal-700 dark:to-emerald-700 rounded-xl p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <button
                onClick={() => setSelectedReturn(null)}
                className="text-teal-100 hover:text-white mb-2 text-sm"
              >
                ← Back to Returns Management
              </button>
              <h2 className="text-2xl font-bold">Return Details</h2>
              <p className="text-teal-100 mt-1">{selectedReturn.return_id}</p>
            </div>
            <div className="flex items-center space-x-3">
              <span className={getMarketplaceBadge(selectedReturn.marketplace)}>
                {selectedReturn.marketplace}
              </span>
              <span className={getStatusBadge(selectedReturn.claim_status)}>
                {selectedReturn.claim_status.replace('_', ' ')}
              </span>
            </div>
          </div>
        </div>

        {/* Return Information */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">Return Information</h3>
            
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Product</label>
                <p className="text-slate-900 dark:text-slate-100 mt-1">{selectedReturn.product_name}</p>
                <p className="text-sm text-slate-500 dark:text-slate-400">SKU: {selectedReturn.sku}</p>
              </div>
              
              <div>
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Return Reason</label>
                <p className="text-slate-900 dark:text-slate-100 mt-1">{selectedReturn.return_reason}</p>
              </div>
              
              <div>
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Return Date</label>
                <p className="text-slate-900 dark:text-slate-100 mt-1">
                  {format(new Date(selectedReturn.return_date), 'PPP')}
                </p>
              </div>
              
              <div>
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Customer</label>
                <p className="text-slate-900 dark:text-slate-100 mt-1">{selectedReturn.customer_email}</p>
                <p className="text-sm text-slate-500 dark:text-slate-400">Pincode: {selectedReturn.pincode}</p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">Financial Impact</h3>
            
            <div className="space-y-4">
              <div className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-700 rounded-lg">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Refund Amount</span>
                <span className="text-lg font-bold text-slate-900 dark:text-slate-100">₹{selectedReturn.refund_amount.toLocaleString()}</span>
              </div>
              
              <div className="flex justify-between items-center p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                <span className="text-sm font-medium text-red-700 dark:text-red-300">Loss Amount</span>
                <span className="text-lg font-bold text-red-900 dark:text-red-100">₹{selectedReturn.loss_amount.toLocaleString()}</span>
              </div>
              
              <div className="flex justify-between items-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <span className="text-sm font-medium text-blue-700 dark:text-blue-300">Claim Amount</span>
                <span className="text-lg font-bold text-blue-900 dark:text-blue-100">₹{selectedReturn.claim_amount.toLocaleString()}</span>
              </div>
              
              <div className="flex justify-between items-center p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">
                <span className="text-sm font-medium text-emerald-700 dark:text-emerald-300">Seller Paid</span>
                <span className={`text-lg font-bold ${selectedReturn.seller_paid ? 'text-emerald-900 dark:text-emerald-100' : 'text-red-900 dark:text-red-100'}`}>
                  {selectedReturn.seller_paid ? 'Yes' : 'No'}
                </span>
              </div>
            </div>

            {!selectedReturn.seller_paid && selectedReturn.claim_status === 'not_filed' && (
              <button
                onClick={() => handleFileClaim(selectedReturn)}
                className="w-full mt-4 flex items-center justify-center space-x-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
              >
                <FileText className="w-4 h-4" />
                <span>File Claim</span>
              </button>
            )}
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
            <h2 className="text-2xl font-bold">Enhanced Returns Management</h2>
            <p className="text-teal-100 mt-1">Comprehensive return categorization with automated claim processing</p>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={exportToCSV}
              className="flex items-center space-x-2 bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg transition-colors"
            >
              <Download className="w-4 h-4" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-6 gap-6">
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Total Returns</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{metrics.total_returns}</p>
            </div>
            <Package className="w-8 h-8 text-blue-500" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Total Loss</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">₹{metrics.total_loss_amount.toLocaleString()}</p>
            </div>
            <TrendingDown className="w-8 h-8 text-red-500" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Claims Filed</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{metrics.total_claims_filed}</p>
            </div>
            <FileText className="w-8 h-8 text-amber-500" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Claims Approved</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{metrics.total_claims_approved}</p>
            </div>
            <CheckCircle className="w-8 h-8 text-emerald-500" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Pending Reimbursements</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{metrics.pending_reimbursements}</p>
            </div>
            <Clock className="w-8 h-8 text-purple-500" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Recovery Rate</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{metrics.recovery_rate.toFixed(1)}%</p>
            </div>
            <Target className="w-8 h-8 text-emerald-500" />
          </div>
        </div>
      </div>

      {/* Category Navigation */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Return Categories</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {filteredReturns.length} returns in {activeCategory.replace('_', ' ')}
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
              <option value="not_filed">Not Filed</option>
              <option value="filed">Filed</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="pending">Pending</option>
            </select>
          </div>
        </div>

        {/* Category Buttons */}
        <div className="flex flex-wrap gap-2">
          {Object.entries(categories).map(([key, returns]) => (
            <button
              key={key}
              onClick={() => setActiveCategory(key as keyof ReturnCategories)}
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeCategory === key
                  ? 'bg-teal-500 text-white'
                  : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
              }`}
            >
              <span>{key.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}</span>
              <span className="bg-white/20 text-xs px-2 py-1 rounded-full">
                {returns.length}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Returns Table */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 dark:bg-slate-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Return Details
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Product
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Marketplace
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Loss Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Claim Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Seller Paid
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-200 dark:divide-slate-700">
              {filteredReturns.map((returnOrder) => (
                <tr key={returnOrder.return_id} className="hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-slate-900 dark:text-slate-100">{returnOrder.return_id}</div>
                      <div className="text-sm text-slate-500 dark:text-slate-400">{returnOrder.order_id}</div>
                      <div className="text-sm text-slate-500 dark:text-slate-400">
                        {format(new Date(returnOrder.return_date), 'MMM dd, yyyy')}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div>
                      <div className="text-sm font-medium text-slate-900 dark:text-slate-100">{returnOrder.product_name}</div>
                      <div className="text-sm text-slate-500 dark:text-slate-400">SKU: {returnOrder.sku}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={getMarketplaceBadge(returnOrder.marketplace)}>
                      {returnOrder.marketplace}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-red-600 dark:text-red-400">₹{returnOrder.loss_amount.toLocaleString()}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={getStatusBadge(returnOrder.claim_status)}>
                      {returnOrder.claim_status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      {returnOrder.seller_paid ? (
                        <CheckCircle className="w-4 h-4 text-emerald-500 mr-2" />
                      ) : (
                        <XCircle className="w-4 h-4 text-red-500 mr-2" />
                      )}
                      <span className={`text-sm ${returnOrder.seller_paid ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                        {returnOrder.seller_paid ? 'Yes' : 'No'}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <button
                      onClick={() => setSelectedReturn(returnOrder)}
                      className="text-teal-600 dark:text-teal-400 hover:text-teal-900 dark:hover:text-teal-300 text-sm font-medium flex items-center space-x-1 hover:bg-teal-50 dark:hover:bg-teal-900/20 px-2 py-1 rounded transition-colors"
                    >
                      <Eye className="w-3 h-3" />
                      <span>View</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}