import React, { useState, useMemo } from 'react';
import { Transaction } from '../types';
import { format } from 'date-fns';
import { ExternalLink, AlertCircle, CheckCircle, Clock, Filter, Search, Download, Eye, Star } from 'lucide-react';
import { clsx } from 'clsx';
import FilterPanel from './FilterPanel';

interface TransactionTableProps {
  transactions: Transaction[];
  onViewDetails?: (transaction: Transaction) => void;
}

export default function TransactionTable({ transactions, onViewDetails }: TransactionTableProps) {
  const [showFilters, setShowFilters] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'date' | 'amount' | 'status'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [filters, setFilters] = useState({
    dateRange: { start: '', end: '' },
    marketplace: '',
    status: '',
    amountRange: { min: '', max: '' },
    category: ''
  });

  const filterOptions = {
    marketplaces: ['Amazon', 'Flipkart', 'Myntra'],
    statuses: ['reconciled', 'pending', 'discrepancy']
  };

  // Filter and search transactions
  const filteredTransactions = useMemo(() => {
    let filtered = transactions.filter(transaction => {
      // Search filter
      if (searchTerm && !transaction.orderId.toLowerCase().includes(searchTerm.toLowerCase()) &&
          !transaction.productName.toLowerCase().includes(searchTerm.toLowerCase()) &&
          !transaction.utr.toLowerCase().includes(searchTerm.toLowerCase())) {
        return false;
      }

      // Date range filter
      if (filters.dateRange.start && new Date(transaction.date) < new Date(filters.dateRange.start)) {
        return false;
      }
      if (filters.dateRange.end && new Date(transaction.date) > new Date(filters.dateRange.end)) {
        return false;
      }

      // Marketplace filter
      if (filters.marketplace && transaction.marketplace !== filters.marketplace) {
        return false;
      }

      // Status filter
      if (filters.status && transaction.status !== filters.status) {
        return false;
      }

      // Amount range filter
      if (filters.amountRange.min && transaction.amount < parseFloat(filters.amountRange.min)) {
        return false;
      }
      if (filters.amountRange.max && transaction.amount > parseFloat(filters.amountRange.max)) {
        return false;
      }

      return true;
    });

    // Sort transactions
    filtered.sort((a, b) => {
      let aValue, bValue;
      
      switch (sortBy) {
        case 'date':
          aValue = new Date(a.date).getTime();
          bValue = new Date(b.date).getTime();
          break;
        case 'amount':
          aValue = a.amount;
          bValue = b.amount;
          break;
        case 'status':
          aValue = a.status;
          bValue = b.status;
          break;
        default:
          return 0;
      }
      
      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

    return filtered;
  }, [transactions, searchTerm, filters, sortBy, sortOrder]);

  const getStatusIcon = (status: Transaction['status']) => {
    switch (status) {
      case 'reconciled':
        return <CheckCircle className="w-4 h-4 text-emerald-500" />;
      case 'pending':
        return <Clock className="w-4 h-4 text-amber-500" />;
      case 'discrepancy':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
    }
  };

  const getStatusBadge = (status: Transaction['status']) => {
    const baseClasses = 'inline-flex items-center px-3 py-1 rounded-full text-xs font-medium';
    
    switch (status) {
      case 'reconciled':
        return clsx(baseClasses, 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400');
      case 'pending':
        return clsx(baseClasses, 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400');
      case 'discrepancy':
        return clsx(baseClasses, 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400');
    }
  };

  const getMarketplaceBadge = (marketplace: Transaction['marketplace']) => {
    const baseClasses = 'inline-flex items-center px-3 py-1 rounded-full text-xs font-medium';
    
    switch (marketplace) {
      case 'Amazon':
        return clsx(baseClasses, 'bg-orange-50 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400');
      case 'Flipkart':
        return clsx(baseClasses, 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400');
      case 'Myntra':
        return clsx(baseClasses, 'bg-pink-50 text-pink-700 dark:bg-pink-900/20 dark:text-pink-400');
    }
  };

  const exportToCSV = () => {
    const csvData = filteredTransactions.map(transaction => ({
      'Order ID': transaction.orderId,
      'UTR': transaction.utr,
      'Product': transaction.productName,
      'SKU': transaction.sku,
      'Marketplace': transaction.marketplace,
      'Amount': `₹${transaction.amount}`,
      'Status': transaction.status,
      'Date': format(new Date(transaction.date), 'yyyy-MM-dd'),
      'Customer': transaction.customerEmail
    }));

    const csv = [
      Object.keys(csvData[0]).join(','),
      ...csvData.map(row => Object.values(row).join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transactions_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-gradient-to-r from-slate-50 to-white dark:from-slate-800 dark:to-slate-700">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">Smart Transactions</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
              {filteredTransactions.length} of {transactions.length} transactions • AI-powered UTR matching
            </p>
          </div>
          
          <div className="flex items-center space-x-3">
            {/* Search */}
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 dark:text-slate-500" />
              <input
                type="text"
                placeholder="Search transactions..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 border border-slate-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-sm bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-500 dark:placeholder-slate-400 transition-all duration-200"
              />
            </div>
            
            {/* Sort */}
            <select
              value={`${sortBy}-${sortOrder}`}
              onChange={(e) => {
                const [field, order] = e.target.value.split('-');
                setSortBy(field as 'date' | 'amount' | 'status');
                setSortOrder(order as 'asc' | 'desc');
              }}
              className="px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-sm bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
            >
              <option value="date-desc">Latest First</option>
              <option value="date-asc">Oldest First</option>
              <option value="amount-desc">Highest Amount</option>
              <option value="amount-asc">Lowest Amount</option>
              <option value="status-asc">Status A-Z</option>
            </select>
            
            {/* Export */}
            <button
              onClick={exportToCSV}
              className="flex items-center space-x-2 px-4 py-2 bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 transition-all duration-200 shadow-lg hover:shadow-xl"
            >
              <Download className="w-4 h-4" />
              <span>Export</span>
            </button>
            
            {/* Filter Button */}
            <button
              onClick={() => setShowFilters(true)}
              className="flex items-center space-x-2 px-4 py-2 bg-teal-50 dark:bg-teal-900/20 text-teal-600 dark:text-teal-400 rounded-xl hover:bg-teal-100 dark:hover:bg-teal-900/40 transition-all duration-200"
            >
              <Filter className="w-4 h-4" />
              <span>Filter</span>
            </button>
          </div>
        </div>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-slate-50 dark:bg-slate-700">
            <tr>
              <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Transaction Details
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Product Information
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Marketplace
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Amount
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Date & Time
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-200 dark:divide-slate-700">
            {filteredTransactions.map((transaction) => (
              <tr key={transaction.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-all duration-200 group">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-gradient-to-r from-teal-500 to-emerald-500 rounded-xl flex items-center justify-center text-white font-bold text-sm">
                      {transaction.orderId.slice(-2)}
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">{transaction.orderId}</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 font-mono">UTR: {transaction.utr}</div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div>
                    <div className="text-sm font-medium text-slate-900 dark:text-slate-100 mb-1">{transaction.productName}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      SKU: <span className="font-mono">{transaction.sku}</span>
                      {transaction.variant && (
                        <span className="ml-2 inline-flex items-center space-x-1">
                          <span className="w-3 h-3 rounded-full bg-slate-300 dark:bg-slate-600"></span>
                          <span>{transaction.variant.color} • {transaction.variant.size}</span>
                        </span>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={getMarketplaceBadge(transaction.marketplace)}>
                    {transaction.marketplace}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-lg font-bold text-slate-900 dark:text-slate-100">₹{transaction.amount.toLocaleString()}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center space-x-2">
                    {getStatusIcon(transaction.status)}
                    <span className={getStatusBadge(transaction.status)}>
                      {transaction.status}
                    </span>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                    {format(new Date(transaction.date), 'MMM dd, yyyy')}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    {format(new Date(transaction.date), 'hh:mm a')}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => onViewDetails?.(transaction)}
                      className="flex items-center space-x-1 text-teal-600 dark:text-teal-400 hover:text-teal-900 dark:hover:text-teal-300 text-sm font-medium hover:bg-teal-50 dark:hover:bg-teal-900/20 px-3 py-2 rounded-lg transition-all duration-200 group-hover:scale-105"
                    >
                      <Eye className="w-4 h-4" />
                      <span>View</span>
                    </button>
                    {transaction.status === 'reconciled' && (
                      <Star className="w-4 h-4 text-amber-400" />
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Empty State */}
      {filteredTransactions.length === 0 && (
        <div className="text-center py-12">
          <div className="w-16 h-16 bg-slate-100 dark:bg-slate-700 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Search className="w-8 h-8 text-slate-400 dark:text-slate-500" />
          </div>
          <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100 mb-2">No transactions found</h3>
          <p className="text-slate-600 dark:text-slate-400">Try adjusting your search or filter criteria</p>
        </div>
      )}

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