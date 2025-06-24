import React from 'react';
import { Filter, Calendar, DollarSign, Tag, X } from 'lucide-react';

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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <div className="flex items-center space-x-2">
            <Filter className="w-5 h-5 text-teal-600" />
            <h3 className="text-lg font-semibold text-slate-900">Advanced Filters</h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filter Content */}
        <div className="p-6 space-y-6">
          {/* Date Range */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              <Calendar className="w-4 h-4 inline mr-1" />
              Date Range
            </label>
            <div className="grid grid-cols-2 gap-3">
              <input
                type="date"
                value={filters.dateRange.start}
                onChange={(e) => handleFilterUpdate('dateRange', { ...filters.dateRange, start: e.target.value })}
                className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
              />
              <input
                type="date"
                value={filters.dateRange.end}
                onChange={(e) => handleFilterUpdate('dateRange', { ...filters.dateRange, end: e.target.value })}
                className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
              />
            </div>
          </div>

          {/* Marketplace */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              <Tag className="w-4 h-4 inline mr-1" />
              Marketplace
            </label>
            <select
              value={filters.marketplace}
              onChange={(e) => handleFilterUpdate('marketplace', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
            >
              <option value="">All Marketplaces</option>
              {filterOptions.marketplaces.map(marketplace => (
                <option key={marketplace} value={marketplace}>{marketplace}</option>
              ))}
            </select>
          </div>

          {/* Status */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Status</label>
            <select
              value={filters.status}
              onChange={(e) => handleFilterUpdate('status', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
            >
              <option value="">All Statuses</option>
              {filterOptions.statuses.map(status => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
          </div>

          {/* Amount Range */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              <DollarSign className="w-4 h-4 inline mr-1" />
              Amount Range (₹)
            </label>
            <div className="grid grid-cols-2 gap-3">
              <input
                type="number"
                placeholder="Min amount"
                value={filters.amountRange.min}
                onChange={(e) => handleFilterUpdate('amountRange', { ...filters.amountRange, min: e.target.value })}
                className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
              />
              <input
                type="number"
                placeholder="Max amount"
                value={filters.amountRange.max}
                onChange={(e) => handleFilterUpdate('amountRange', { ...filters.amountRange, max: e.target.value })}
                className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
              />
            </div>
          </div>

          {/* Category (for returns) */}
          {filterOptions.categories && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Return Category</label>
              <select
                value={filters.category}
                onChange={(e) => handleFilterUpdate('category', e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
              >
                <option value="">All Categories</option>
                {filterOptions.categories.map(category => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-slate-200">
          <button
            onClick={clearAllFilters}
            className="text-slate-600 hover:text-slate-800 font-medium transition-colors"
          >
            Clear All Filters
          </button>
          <div className="flex space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-slate-600 hover:text-slate-800 font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-teal-500 text-white rounded-lg hover:bg-teal-600 transition-colors font-medium"
            >
              Apply Filters
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}