// Main page containing tab layout and table rendering

import React, { useState, useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';
import { 
  mockClaims, 
  filterClaims, 
  sortClaims, 
  getUniqueValues, 
  calculateStats,
  formatCurrency,
  Claim 
} from './claimsHelpers';
import SearchAndFilter from './SearchAndFilter';
import ClaimsTable from './ClaimsTable';
import BulkActions from './BulkActions';
import ExportButtons from './ExportButtons';

interface ClaimsPageProps {
  onClaimClick?: (orderId: string) => void;
}

const ClaimsPage: React.FC<ClaimsPageProps> = ({ onClaimClick }) => {
  // State management
  const [claims, setClaims] = useState<Claim[]>(mockClaims);
  const [activeTab, setActiveTab] = useState<'Returns' | 'Payments'>('Returns');
  const [selectedClaims, setSelectedClaims] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [marketplaceFilter, setMarketplaceFilter] = useState('all');
  const [sortField, setSortField] = useState<keyof Claim>('age');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Filter and sort claims
  const filteredClaims = filterClaims(claims, activeTab, searchTerm, statusFilter, marketplaceFilter);
  const sortedClaims = sortClaims(filteredClaims, sortField, sortDirection);

  // Get unique values for filters
  const tabSpecificClaims = claims.filter(claim => claim.claimType === activeTab);
  const statusOptions = getUniqueValues(tabSpecificClaims, 'status');
  const marketplaceOptions = getUniqueValues(tabSpecificClaims, 'marketplace');

  // Calculate statistics
  const stats = calculateStats(sortedClaims);

  // Clear selections when tab changes
  useEffect(() => {
    setSelectedClaims([]);
    setSearchTerm('');
    setStatusFilter('all');
    setMarketplaceFilter('all');
  }, [activeTab]);

  // Event handlers
  const handleSort = (field: keyof Claim) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedClaims(sortedClaims.map(claim => claim.claimId));
    } else {
      setSelectedClaims([]);
    }
  };

  const handleSelectClaim = (claimId: string, checked: boolean) => {
    if (checked) {
      setSelectedClaims([...selectedClaims, claimId]);
    } else {
      setSelectedClaims(selectedClaims.filter(id => id !== claimId));
    }
  };

  const handleBulkUpdateStatus = (status: string) => {
    // Update claims with new status
    setClaims(prevClaims => 
      prevClaims.map(claim => 
        selectedClaims.includes(claim.claimId) 
          ? { ...claim, status, lastUpdated: new Date().toISOString().split('T')[0] }
          : claim
      )
    );
    setSelectedClaims([]);
    console.log(`Updated ${selectedClaims.length} claims to status: ${status}`);
  };

  const handleBulkSendReminder = () => {
    // Send reminder for selected claims
    console.log(`Sending reminders for ${selectedClaims.length} claims:`, selectedClaims);
    setSelectedClaims([]);
    // In a real app, this would trigger API calls to send actual reminders
  };

  const getTabButtonClass = (tab: 'Returns' | 'Payments', isActive: boolean) => {
    const baseClass = "px-6 py-3 text-sm font-medium rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2";
    
    if (tab === 'Returns') {
      return isActive 
        ? `${baseClass} bg-teal-600 text-white shadow-md focus:ring-teal-500`
        : `${baseClass} text-teal-600 hover:bg-teal-50 dark:text-teal-400 dark:hover:bg-teal-900/20 focus:ring-teal-500`;
    } else {
      return isActive 
        ? `${baseClass} bg-red-500 text-white shadow-md focus:ring-red-500`
        : `${baseClass} text-red-500 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20 focus:ring-red-500`;
    }
  };

  const getGradientClass = (tab: 'Returns' | 'Payments') => {
    return tab === 'Returns' 
      ? 'bg-gradient-to-r from-teal-600 to-cyan-600 dark:from-teal-700 dark:to-cyan-700'
      : 'bg-gradient-to-r from-red-500 to-orange-500 dark:from-red-600 dark:to-orange-600';
  };

  return (
    <div className="space-y-6 p-6">
      {/* Tab Navigation */}
      <div className="flex items-center justify-between">
        <div className="flex space-x-2 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
          <button
            onClick={() => setActiveTab('Returns')}
            className={getTabButtonClass('Returns', activeTab === 'Returns')}
          >
            Returns Claims
          </button>
          <button
            onClick={() => setActiveTab('Payments')}
            className={getTabButtonClass('Payments', activeTab === 'Payments')}
          >
            Payment Claims
          </button>
        </div>

        {/* Export Buttons */}
        <ExportButtons
          claims={sortedClaims}
          selectedClaims={selectedClaims}
          activeTab={activeTab}
          disabled={sortedClaims.length === 0}
        />
      </div>

      {/* Header with Statistics */}
      <div className={`rounded-xl p-6 text-white ${getGradientClass(activeTab)}`}>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">{activeTab} Claims Tracker</h2>
            <p className="opacity-90 mt-1">Monitor and manage marketplace {activeTab.toLowerCase()} disputes</p>
          </div>
          <div className="flex items-center space-x-8">
            <div className="text-center">
              <p className="text-lg font-semibold">{formatCurrency(stats.totalValue)}</p>
              <p className="opacity-90 text-sm">Total Value</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-semibold">{stats.activeCount}</p>
              <p className="opacity-90 text-sm">Active</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-semibold">{stats.criticalCount}</p>
              <p className="opacity-90 text-sm">Critical</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-semibold">{stats.resolvedCount}</p>
              <p className="opacity-90 text-sm">Resolved</p>
            </div>
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <SearchAndFilter
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            statusFilter={statusFilter}
            onStatusFilterChange={setStatusFilter}
            marketplaceFilter={marketplaceFilter}
            onMarketplaceFilterChange={setMarketplaceFilter}
            statusOptions={statusOptions}
            marketplaceOptions={marketplaceOptions}
            activeTab={activeTab}
          />
        </div>

        {/* Bulk Actions */}
        <BulkActions
          selectedCount={selectedClaims.length}
          onUpdateStatus={handleBulkUpdateStatus}
          onSendReminder={handleBulkSendReminder}
          onClose={() => setSelectedClaims([])}
          activeTab={activeTab}
        />
      </div>

      {/* Claims Table */}
      <ClaimsTable
        claims={sortedClaims}
        selectedClaims={selectedClaims}
        onSelectClaim={handleSelectClaim}
        onSelectAll={handleSelectAll}
        onClaimClick={onClaimClick}
        sortField={sortField}
        sortDirection={sortDirection}
        onSort={handleSort}
        activeTab={activeTab}
      />

      {/* Critical Claims Alert */}
      {stats.criticalCount > 0 && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex items-start space-x-3">
            <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-red-800 dark:text-red-200">
              <p className="font-medium mb-1">Critical Claims Alert</p>
              <p className="text-red-700 dark:text-red-300">
                {stats.criticalCount} {activeTab.toLowerCase()} claim(s) are over 15 days old and require immediate attention for resolution.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Reconciliation Snapshot Placeholder */}
      <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-medium text-slate-900 dark:text-slate-100 mb-1">
              Reconciliation Snapshot
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Detailed reconciliation view will be available in claim detail modal
            </p>
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400">
            Coming Soon: Individual claim PDF download, comments, status updates
          </div>
        </div>
      </div>
    </div>
  );
};

export default ClaimsPage;