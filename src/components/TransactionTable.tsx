import React, { useState, useMemo } from 'react';
import { Transaction } from '../types';
import { format } from 'date-fns';
import { ExternalLink, AlertCircle, CheckCircle, Clock, Filter, Search } from 'lucide-react';
import { clsx } from 'clsx';
import FilterPanel from './FilterPanel';

interface TransactionTableProps {
  transactions: Transaction[];
  onViewDetails?: (transaction: Transaction) => void;
}

export default function TransactionTable({ transactions, onViewDetails }: TransactionTableProps) {
  const [showFilters, setShowFilters] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
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
    return transactions.filter(transaction => {
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
  }, [transactions, searchTerm, filters]);

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
    const baseClasses = 'inline-flex items-center px-2 py-1 rounded-full text-xs font-medium';
    
    switch (status) {
      case 'reconciled':
        return clsx(baseClasses, 'bg-emerald-50 text-emerald-700');
      case 'pending':
        return clsx(baseClasses, 'bg-amber-50 text-amber-700');
      case 'discrepancy':
        return clsx(baseClasses, 'bg-red-50 text-red-700');
    }
  };

  const getMarketplaceBadge = (marketplace: Transaction['marketplace']) => {
    const baseClasses = 'inline-flex items-center px-2 py-1 rounded-full text-xs font-medium';
    
    switch (marketplace) {
      case 'Amazon':
        return clsx(baseClasses, 'bg-orange-50 text-orange-700');
      case 'Flipkart':
        return clsx(baseClasses, 'bg-blue-50 text-blue-700');
      case 'Myntra':
        return clsx(baseClasses, 'bg-pink-50 text-pink-700');
    }
  };

  return (
    <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-200">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Transactions</h3>
            <p className="text-sm text-slate-600 mt-1">
              {filteredTransactions.length} of {transactions.length} transactions
            </p>
          </div>
          
          <div className="flex items-center space-x-3">
            {/* Search */}
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search transactions..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-sm"
              />
            </div>
            
            {/* Filter Button */}
            <button
              onClick={() => setShowFilters(true)}
              className="flex items-center space-x-2 px-4 py-2 bg-teal-50 text-teal-600 rounded-lg hover:bg-teal-100 transition-colors"
            >
              <Filter className="w-4 h-4" />
              <span>Filter</span>
            </button>
          </div>
        </div>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                Transaction
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                Product
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                Marketplace
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                Amount
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                Date
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-slate-200">
            {filteredTransactions.map((transaction) => (
              <tr key={transaction.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div>
                    <div className="text-sm font-medium text-slate-900">{transaction.orderId}</div>
                    <div className="text-sm text-slate-500">UTR: {transaction.utr}</div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div>
                    <div className="text-sm font-medium text-slate-900">{transaction.productName}</div>
                    <div className="text-sm text-slate-500">
                      SKU: {transaction.sku}
                      {transaction.variant && (
                        <span className="ml-2">
                          {transaction.variant.color} • {transaction.variant.size}
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
                  <div className="text-sm font-medium text-slate-900">₹{transaction.amount.toLocaleString()}</div>
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
                  <div className="text-sm text-slate-900">
                    {format(new Date(transaction.date), 'MMM dd, yyyy')}
                  </div>
                  <div className="text-sm text-slate-500">
                    {format(new Date(transaction.date), 'hh:mm a')}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <button
                    onClick={() => onViewDetails?.(transaction)}
                    className="text-teal-600 hover:text-teal-900 text-sm font-medium flex items-center space-x-1 hover:bg-teal-50 px-2 py-1 rounded transition-colors"
                  >
                    <span>View</span>
                    <ExternalLink className="w-3 h-3" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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