// Search bar and basic filter modal logic

import React, { useState } from 'react';
import { Search, Filter, ChevronDown, X } from 'lucide-react';

interface SearchAndFilterProps {
  searchTerm: string;
  onSearchChange: (term: string) => void;
  statusFilter: string;
  onStatusFilterChange: (status: string) => void;
  marketplaceFilter: string;
  onMarketplaceFilterChange: (marketplace: string) => void;
  statusOptions: string[];
  marketplaceOptions: string[];
  activeTab: 'Returns' | 'Payments';
}

const SearchAndFilter: React.FC<SearchAndFilterProps> = ({
  searchTerm,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  marketplaceFilter,
  onMarketplaceFilterChange,
  statusOptions,
  marketplaceOptions,
  activeTab
}) => {
  const [showFilters, setShowFilters] = useState(false);

  const clearFilters = () => {
    onStatusFilterChange('all');
    onMarketplaceFilterChange('all');
    onSearchChange('');
  };

  const hasActiveFilters = statusFilter !== 'all' || marketplaceFilter !== 'all' || searchTerm.length > 0;

  const themeColors = {
    Returns: {
      ring: 'focus:ring-teal-500',
      border: 'focus:border-teal-500',
      button: 'bg-teal-600 hover:bg-teal-700',
      text: 'text-teal-600'
    },
    Payments: {
      ring: 'focus:ring-red-500',
      border: 'focus:border-red-500', 
      button: 'bg-red-500 hover:bg-red-600',
      text: 'text-red-500'
    }
  };

  const theme = themeColors[activeTab];

  return (
    <div className="space-y-4">
      {/* Search and Filter Toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4 flex-1">
          {/* Search Input */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search Order ID or Issue..."
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              className={`pl-10 pr-4 py-2 w-full border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:border-transparent transition-colors ${theme.ring}`}
            />
            {searchTerm && (
              <button
                onClick={() => onSearchChange('')}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Date Range Selector */}
          <div className="relative">
            <select
              className={`px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:border-transparent text-sm transition-colors ${theme.ring}`}
              onChange={(e) => {
                console.log('Date range selected:', e.target.value);
                // Future implementation for date filtering
              }}
            >
              <option value="all">All Time</option>
              <option value="7days">Last 7 days</option>
              <option value="30days">Last 30 days</option>
              <option value="90days">Last 90 days</option>
            </select>
          </div>

          {/* Filter Toggle Button */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg border transition-colors ${
              showFilters || hasActiveFilters
                ? `${theme.button} text-white border-transparent`
                : 'border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
            }`}
          >
            <Filter className="w-4 h-4" />
            <span>Filters</span>
            {hasActiveFilters && (
              <span className="bg-white/20 text-xs px-1.5 py-0.5 rounded-full">
                {[statusFilter !== 'all', marketplaceFilter !== 'all'].filter(Boolean).length}
              </span>
            )}
            <ChevronDown className={`w-4 h-4 transform transition-transform ${showFilters ? 'rotate-180' : ''}`} />
          </button>

          {/* Clear Filters */}
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 underline"
            >
              Clear all
            </button>
          )}
        </div>
      </div>

      {/* Filter Panel */}
      {showFilters && (
        <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4 border border-slate-200 dark:border-slate-700 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-slate-900 dark:text-slate-100">
              Filter {activeTab} Claims
            </h3>
            <button
              onClick={() => setShowFilters(false)}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Status Filter */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Status
              </label>
              <select
                value={statusFilter}
                onChange={(e) => onStatusFilterChange(e.target.value)}
                className={`w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:border-transparent transition-colors ${theme.ring}`}
              >
                <option value="all">All Statuses</option>
                {statusOptions.map(status => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
            </div>

            {/* Marketplace Filter */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Marketplace
              </label>
              <select
                value={marketplaceFilter}
                onChange={(e) => onMarketplaceFilterChange(e.target.value)}
                className={`w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:border-transparent transition-colors ${theme.ring}`}
              >
                <option value="all">All Marketplaces</option>
                {marketplaceOptions.map(marketplace => (
                  <option key={marketplace} value={marketplace}>{marketplace}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Filter Summary */}
          {hasActiveFilters && (
            <div className="pt-3 border-t border-slate-200 dark:border-slate-700">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-600 dark:text-slate-400">
                  Active filters: {[statusFilter !== 'all' ? statusFilter : null, marketplaceFilter !== 'all' ? marketplaceFilter : null].filter(Boolean).join(', ')}
                </span>
                <button
                  onClick={clearFilters}
                  className={`text-xs ${theme.text} hover:underline`}
                >
                  Clear all
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SearchAndFilter;