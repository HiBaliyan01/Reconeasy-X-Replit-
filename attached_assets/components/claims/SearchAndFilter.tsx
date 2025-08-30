import React from 'react';
import { Search, Filter } from 'lucide-react';
import { Claim } from './ClaimsPage';
import { getMarketplaces, getStatuses } from './claimsHelpers';

interface SearchAndFilterProps {
  filters: {
    marketplace: string;
    status: string;
    search: string;
  };
  onFiltersChange: (filters: { marketplace: string; status: string; search: string }) => void;
  claims: Claim[];
}

export const SearchAndFilter: React.FC<SearchAndFilterProps> = ({
  filters,
  onFiltersChange,
  claims
}) => {
  const marketplaces = getMarketplaces(claims);
  const statuses = getStatuses(claims);

  const handleFilterChange = (key: string, value: string) => {
    onFiltersChange({
      ...filters,
      [key]: value
    });
  };

  return (
    <div className="flex flex-col sm:flex-row gap-4 mb-6">
      {/* Search */}
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
        <input
          type="text"
          placeholder="Search Order ID or Issue"
          value={filters.search}
          onChange={(e) => handleFilterChange('search', e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {/* Marketplace Filter */}
      <div className="relative">
        <select
          value={filters.marketplace}
          onChange={(e) => handleFilterChange('marketplace', e.target.value)}
          className="appearance-none bg-white border border-gray-300 rounded-lg px-4 py-2 pr-8 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="">All Marketplaces</option>
          {marketplaces.map(marketplace => (
            <option key={marketplace} value={marketplace}>
              {marketplace}
            </option>
          ))}
        </select>
      </div>

      {/* Status Filter */}
      <div className="relative">
        <select
          value={filters.status}
          onChange={(e) => handleFilterChange('status', e.target.value)}
          className="appearance-none bg-white border border-gray-300 rounded-lg px-4 py-2 pr-8 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="">All Statuses</option>
          {statuses.map(status => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
      </div>

      {/* Clear Filters */}
      {(filters.search || filters.marketplace || filters.status) && (
        <button
          onClick={() => onFiltersChange({ search: '', marketplace: '', status: '' })}
          className="px-4 py-2 text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        >
          Clear
        </button>
      )}
    </div>
  );
};