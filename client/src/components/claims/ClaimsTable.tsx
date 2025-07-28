// Replit-ready Claims Table component with filters, bulk actions, and reminders

import React, { useState } from 'react';
import { Clock, HelpCircle, ChevronUp, ChevronDown } from 'lucide-react';
import { Claim, getAgeColorClass, getReminderTooltip } from './claimsHelpers';
import ClaimStatusBadge from './ClaimStatusBadge';

interface ClaimsTableProps {
  claims: Claim[];
  selectedClaims: string[];
  onSelectClaim: (claimId: string, checked: boolean) => void;
  onSelectAll: (checked: boolean) => void;
  onClaimClick?: (orderId: string) => void;
  sortField: keyof Claim;
  sortDirection: 'asc' | 'desc';
  onSort: (field: keyof Claim) => void;
  activeTab: 'Returns' | 'Payments';
}

const ClaimsTable: React.FC<ClaimsTableProps> = ({
  claims,
  selectedClaims,
  onSelectClaim,
  onSelectAll,
  onClaimClick,
  sortField,
  sortDirection,
  onSort,
  activeTab
}) => {
  const [hoveredTooltip, setHoveredTooltip] = useState<string | null>(null);

  const getSortIcon = (field: keyof Claim) => {
    if (sortField !== field) return null;
    return sortDirection === 'asc' ? 
      <ChevronUp className="w-3 h-3" /> : 
      <ChevronDown className="w-3 h-3" />;
  };

  const getOrderIdStyle = (activeTab: string) => {
    return activeTab === 'Returns' 
      ? 'text-teal-600 hover:text-teal-800 dark:text-teal-400 dark:hover:text-teal-300'
      : 'text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300';
  };

  const getAgeDisplay = (age: number, status: string) => {
    const colorClass = getAgeColorClass(age, status);
    const tooltip = getReminderTooltip(age, status);
    
    return (
      <div 
        className="relative inline-flex items-center"
        onMouseEnter={() => setHoveredTooltip(`age-${age}-${status}`)}
        onMouseLeave={() => setHoveredTooltip(null)}
      >
        <span className={`inline-flex items-center space-x-1 px-2 py-1 rounded text-xs font-medium ${colorClass}`}>
          <Clock className="w-3 h-3" />
          <span>{age}d</span>
        </span>
        
        {hoveredTooltip === `age-${age}-${status}` && (
          <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-black text-white text-xs rounded opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-10">
            {tooltip}
            <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-black"></div>
          </div>
        )}
      </div>
    );
  };

  if (claims.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-12">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center">
            <Clock className="w-8 h-8 text-slate-400" />
          </div>
          <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100 mb-2">
            No {activeTab} Claims Found
          </h3>
          <p className="text-slate-600 dark:text-slate-400 max-w-sm mx-auto">
            No {activeTab.toLowerCase()} claims match your current search and filter criteria. 
            Try adjusting your filters or search terms.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-slate-50 dark:bg-slate-700 border-b border-slate-200 dark:border-slate-600">
            <tr>
              {/* Compact Checkbox Column */}
              <th className="w-12 px-4 py-3 text-left">
                <input
                  type="checkbox"
                  checked={selectedClaims.length === claims.length && claims.length > 0}
                  onChange={(e) => onSelectAll(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 focus:ring-offset-0"
                />
              </th>

              {/* Order ID */}
              <th 
                className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-600 transition-colors"
                onClick={() => onSort('orderId')}
              >
                <div className="flex items-center space-x-1">
                  <span>Order ID</span>
                  {getSortIcon('orderId')}
                  <div className="relative">
                    <HelpCircle 
                      className="w-3 h-3 text-slate-400 hover:text-slate-600 cursor-help"
                      onMouseEnter={() => setHoveredTooltip('orderId-help')}
                      onMouseLeave={() => setHoveredTooltip(null)}
                    />
                    {hoveredTooltip === 'orderId-help' && (
                      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-black text-white text-xs rounded opacity-100 whitespace-nowrap z-10">
                        Click to view claim details and reconciliation snapshot
                        <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-black"></div>
                      </div>
                    )}
                  </div>
                </div>
              </th>

              {/* Marketplace */}
              <th 
                className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-600 transition-colors"
                onClick={() => onSort('marketplace')}
              >
                <div className="flex items-center space-x-1">
                  <span>Marketplace</span>
                  {getSortIcon('marketplace')}
                </div>
              </th>

              {/* Claim Type */}
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Claim Type
              </th>

              {/* Status */}
              <th 
                className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-600 transition-colors"
                onClick={() => onSort('status')}
              >
                <div className="flex items-center space-x-1">
                  <span>Status</span>
                  {getSortIcon('status')}
                </div>
              </th>

              {/* Raised On */}
              <th 
                className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-600 transition-colors"
                onClick={() => onSort('lastUpdated')}
              >
                <div className="flex items-center space-x-1">
                  <span>Raised On</span>
                  {getSortIcon('lastUpdated')}
                </div>
              </th>

              {/* Aging */}
              <th 
                className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-600 transition-colors"
                onClick={() => onSort('age')}
              >
                <div className="flex items-center space-x-1">
                  <span>Aging</span>
                  {getSortIcon('age')}
                  <div className="relative">
                    <HelpCircle 
                      className="w-3 h-3 text-slate-400 hover:text-slate-600 cursor-help"
                      onMouseEnter={() => setHoveredTooltip('aging-help')}
                      onMouseLeave={() => setHoveredTooltip(null)}
                    />
                    {hoveredTooltip === 'aging-help' && (
                      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-black text-white text-xs rounded opacity-100 whitespace-nowrap z-10">
                        Gray: &lt;7 days, Orange: 7+ days, Red: 15+ days (critical)
                        <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-black"></div>
                      </div>
                    )}
                  </div>
                </div>
              </th>
            </tr>
          </thead>

          <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-200 dark:divide-slate-700">
            {claims.map((claim) => (
              <tr 
                key={claim.claimId}
                className={`hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors cursor-pointer ${
                  selectedClaims.includes(claim.claimId) 
                    ? 'bg-blue-50 dark:bg-blue-900/20 ring-1 ring-blue-200 dark:ring-blue-800' 
                    : ''
                }`}
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onClaimClick?.(claim.orderId);
                  }
                }}
              >
                {/* Checkbox */}
                <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={selectedClaims.includes(claim.claimId)}
                    onChange={(e) => onSelectClaim(claim.claimId, e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 focus:ring-offset-0"
                  />
                </td>

                {/* Order ID */}
                <td className="px-4 py-3">
                  <button
                    onClick={() => onClaimClick?.(claim.orderId)}
                    className={`font-medium hover:underline focus:outline-none focus:underline ${getOrderIdStyle(activeTab)}`}
                  >
                    {claim.orderId}
                  </button>
                </td>

                {/* Marketplace */}
                <td className="px-4 py-3 text-sm text-slate-900 dark:text-slate-100">
                  {claim.marketplace}
                </td>

                {/* Claim Type/Issue */}
                <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400 max-w-xs truncate" title={claim.issue}>
                  {claim.issue}
                </td>

                {/* Status */}
                <td className="px-4 py-3">
                  <ClaimStatusBadge status={claim.status} age={claim.age} showTooltip />
                </td>

                {/* Raised On */}
                <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">
                  {new Date(claim.lastUpdated).toLocaleDateString('en-IN')}
                </td>

                {/* Aging */}
                <td className="px-4 py-3">
                  {getAgeDisplay(claim.age, claim.status)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ClaimsTable;