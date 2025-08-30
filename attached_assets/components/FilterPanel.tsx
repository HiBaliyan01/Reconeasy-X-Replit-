import React from 'react';
import { Filter, Calendar, DollarSign, Tag, X, RotateCcw } from 'lucide-react';

interface FilterPanelProps {
  isOpen: boolean;
  onClose: () => void;
  filters: {
    dateRange: { start: string; end: string };
    marketplace: string;
    status: string;
    amountRange: { min: string; max: string };
    category: string;
  };
  onFilterChange: (filters: any) => void;
  filterOptions: {
    marketplaces: string[];
    statuses: string[];
    categories?: string[];
  };
}

export default function FilterPanel({ 
  isOpen, 
  onClose, 
  filters, 
  onFilterChange, 
  filterOptions 
}: FilterPanelProps) {
  const handleFilterUpdate = (key: string, value: any) => {
    onFilterChange({
      ...filters,
      [key]: value
    });
  };

  const clearAllFilters = () => {
    onFilterChange({
      dateRange: { start: '', end: '' },
      marketplace: '',
      status: '',
      amountRange: { min: '', max: '' },
      category: ''
    });
  };

  const hasActiveFilters = () => {
    return filters.dateRange.start || filters.dateRange.end || 
           filters.marketplace || filters.status || 
           filters.amountRange.min || filters.amountRange.max || 
           filters.category;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-700 bg-gradient-to-r from-teal-50 to-emerald-50 dark:from-teal-900/20 dark:to-emerald-900/20 rounded-t-2xl">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-r from-teal-500 to-emerald-500 rounded-xl flex items-center justify-center">
              <Filter className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">Advanced Filters</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400">Refine your search with precision</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filter Content */}
        <div className="p-6 space-y-6">
          {/* Date Range */}
          <div className="space-y-3">
            <label className="flex items-center space-x-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
              <Calendar className="w-4 h-4 text-teal-500" />
              <span>Date Range</span>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">From</label>
                <input
                  type="date"
                  value={filters.dateRange.start}
                  onChange={(e) => handleFilterUpdate('dateRange', { ...filters.dateRange, start: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 transition-all duration-200"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">To</label>
                <input
                  type="date"
                  value={filters.dateRange.end}
                  onChange={(e) => handleFilterUpdate('dateRange', { ...filters.dateRange, end: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 transition-all duration-200"
                />
              </div>
            </div>
          </div>

          {/* Marketplace */}
          <div className="space-y-3">
            <label className="flex items-center space-x-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
              <Tag className="w-4 h-4 text-teal-500" />
              <span>Marketplace</span>
            </label>
            <select
              value={filters.marketplace}
              onChange={(e) => handleFilterUpdate('marketplace', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 transition-all duration-200"
            >
              <option value="">All Marketplaces</option>
              {filterOptions.marketplaces.map(marketplace => (
                <option key={marketplace} value={marketplace}>{marketplace}</option>
              ))}
            </select>
          </div>

          {/* Status */}
          <div className="space-y-3">
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">Status</label>
            <div className="grid grid-cols-3 gap-2">
              {filterOptions.statuses.map(status => (
                <button
                  key={status}
                  onClick={() => handleFilterUpdate('status', filters.status === status ? '' : status)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                    filters.status === status
                      ? 'bg-teal-500 text-white shadow-lg'
                      : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>
          </div>

          {/* Amount Range */}
          <div className="space-y-3">
            <label className="flex items-center space-x-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
              <DollarSign className="w-4 h-4 text-teal-500" />
              <span>Amount Range (₹)</span>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">Minimum</label>
                <input
                  type="number"
                  placeholder="0"
                  value={filters.amountRange.min}
                  onChange={(e) => handleFilterUpdate('amountRange', { ...filters.amountRange, min: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 transition-all duration-200"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">Maximum</label>
                <input
                  type="number"
                  placeholder="No limit"
                  value={filters.amountRange.max}
                  onChange={(e) => handleFilterUpdate('amountRange', { ...filters.amountRange, max: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 transition-all duration-200"
                />
              </div>
            </div>
          </div>

          {/* Category (for returns) */}
          {filterOptions.categories && (
            <div className="space-y-3">
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">Return Category</label>
              <select
                value={filters.category}
                onChange={(e) => handleFilterUpdate('category', e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 transition-all duration-200"
              >
                <option value="">All Categories</option>
                {filterOptions.categories.map(category => (
                  <option key={category} value={category}>
                    {category.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Quick Filters */}
          <div className="space-y-3">
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">Quick Filters</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => {
                  const today = new Date().toISOString().split('T')[0];
                  handleFilterUpdate('dateRange', { start: today, end: today });
                }}
                className="px-3 py-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition-all duration-200 text-sm"
              >
                Today
              </button>
              <button
                onClick={() => {
                  const today = new Date();
                  const lastWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
                  handleFilterUpdate('dateRange', { 
                    start: lastWeek.toISOString().split('T')[0], 
                    end: today.toISOString().split('T')[0] 
                  });
                }}
                className="px-3 py-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition-all duration-200 text-sm"
              >
                Last 7 Days
              </button>
              <button
                onClick={() => handleFilterUpdate('amountRange', { min: '1000', max: '' })}
                className="px-3 py-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition-all duration-200 text-sm"
              >
                Above ₹1,000
              </button>
              <button
                onClick={() => handleFilterUpdate('status', 'discrepancy')}
                className="px-3 py-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition-all duration-200 text-sm"
              >
                Discrepancies
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/50 rounded-b-2xl">
          <button
            onClick={clearAllFilters}
            disabled={!hasActiveFilters()}
            className="flex items-center space-x-2 text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Clear All Filters</span>
          </button>
          <div className="flex space-x-3">
            <button
              onClick={onClose}
              className="px-6 py-2 text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={onClose}
              className="px-6 py-2 bg-gradient-to-r from-teal-500 to-emerald-500 text-white rounded-lg hover:from-teal-600 hover:to-emerald-600 transition-all duration-200 font-medium shadow-lg hover:shadow-xl"
            >
              Apply Filters
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}