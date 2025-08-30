import React, { useState } from 'react';
import { Clock, AlertTriangle, Eye, Filter, ChevronDown } from 'lucide-react';
import { Claim } from './ClaimsPage';
import { BulkActions } from './BulkActions';
import { ClaimStatusBadge } from './ClaimStatusBadge';
import { getAgingIndicator, formatCurrency } from './claimsHelpers';
// GPT-4o tuned ClaimsTable.tsx with status badge, filters, export, select

interface ClaimsTableProps {
  claims: Claim[];
  onClaimSelect: (orderId: string) => void;
  onClaimsUpdate: (claims: Claim[]) => void;
}

export const ClaimsTable: React.FC<ClaimsTableProps> = ({
  claims,
  onClaimSelect,
  onClaimsUpdate
}) => {
  const [selectedClaims, setSelectedClaims] = useState<string[]>([]);

  const toggleSelection = (claimId: string) => {
    setSelectedClaims(prev =>
      prev.includes(claimId) 
        ? prev.filter(id => id !== claimId)
        : [...prev, claimId]
    );
  };

  const toggleSelectAll = () => {
    setSelectedClaims(
      selectedClaims.length === claims.length 
        ? [] 
        : claims.map(claim => claim.id)
    );
  };

  const handleStatusUpdate = (newStatus: string, comment?: string) => {
    const updatedClaims = claims.map(claim =>
      selectedClaims.includes(claim.id)
        ? { ...claim, status: newStatus }
        : claim
    );
    onClaimsUpdate(updatedClaims);
    setSelectedClaims([]);
    
    if (comment) {
      console.log(`✅ Status updated to "${newStatus}" for ${selectedClaims.length} claim(s) with comment: ${comment}`);
    } else {
      console.log(`✅ Status updated to "${newStatus}" for ${selectedClaims.length} claim(s)`);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Resolved':
        return 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/20 dark:text-green-300 dark:border-green-700';
      case 'Rejected':
        return 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-700';
      case 'In Review':
        return 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-700';
      case 'Awaiting Marketplace':
        return 'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/20 dark:text-purple-300 dark:border-purple-700';
      default:
        return 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-300 dark:border-yellow-700';
    }
  };

  const getAgeIndicator = (daysOpen: number) => {
    if (daysOpen > 15) {
      return { color: 'text-red-600', bg: 'bg-red-50', icon: AlertTriangle, label: 'Critical' };
    } else if (daysOpen > 7) {
      return { color: 'text-orange-500', bg: 'bg-orange-50', icon: Clock, label: 'Overdue' };
    }
    return { color: 'text-muted-foreground', bg: 'bg-muted/50', icon: Clock, label: 'Active' };
  };

  return (
    <div className="space-y-4">
      {/* Bulk Actions */}
      {selectedClaims.length > 0 && (
        <div className="flex items-center justify-between bg-blue-50 p-3 rounded-lg">
          <span className="text-sm text-blue-700">
            {selectedClaims.length} claim(s) selected
          </span>
          <BulkActions
            selectedCount={selectedClaims.length}
            onStatusUpdate={handleStatusUpdate}
          />
        </div>
      )}

      {/* Enhanced Table */}
      <div className="bg-card rounded-xl shadow-lg border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted/50">
              <tr className="border-b border-border">
                <th className="text-left py-4 px-4 w-12">
                  <input
                    type="checkbox"
                    checked={selectedClaims.length === claims.length && claims.length > 0}
                    onChange={toggleSelectAll}
                    className="rounded border-input text-primary focus:ring-primary focus:ring-offset-0 h-4 w-4"
                  />
                </th>
                <th className="text-left py-4 px-4 font-semibold text-foreground">
                  Order ID
                </th>
                <th className="text-left py-4 px-4 font-semibold text-foreground">
                  Marketplace
                </th>
                <th className="text-left py-4 px-4 font-semibold text-foreground">
                  Issue Type
                </th>
                <th className="text-left py-4 px-4 font-semibold text-foreground">
                  Status
                </th>
                <th className="text-left py-4 px-4 font-semibold text-foreground">
                  Claim Value
                </th>
                <th className="text-left py-4 px-4 font-semibold text-foreground">
                  Age
                </th>
                <th className="text-left py-4 px-4 font-semibold text-foreground">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {claims.map((claim) => {
                const aging = getAgeIndicator(claim.daysOpen);
                const isSelected = selectedClaims.includes(claim.id);
              
                return (
                  <tr
                    key={claim.id}
                    className={`hover:bg-muted/50 transition-colors ${
                      isSelected ? 'bg-primary/5 border-primary/20' : ''
                    }`}
                  >
                    <td className="py-4 px-4">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelection(claim.id)}
                        className="rounded border-input text-primary focus:ring-primary focus:ring-offset-0 h-4 w-4"
                      />
                    </td>
                    <td className="py-4 px-4">
                      <button
                        onClick={() => onClaimSelect(claim.orderId)}
                        className="text-primary hover:text-primary/80 font-semibold transition-colors"
                      >
                        {claim.orderId}
                      </button>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {claim.priority === 'High' && (
                          <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-red-100 text-red-800 rounded-full border border-red-200">
                            High Priority
                          </span>
                        )}
                        {claim.autoFlagged && (
                          <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-orange-100 text-orange-800 rounded-full border border-orange-200">
                            Auto Flagged
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <span className="inline-flex items-center px-2 py-1 text-sm font-medium bg-muted text-muted-foreground rounded-lg">
                        {claim.marketplace}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-foreground">{claim.issueType}</td>
                    <td className="py-4 px-4">
                      <span className={`inline-flex items-center px-3 py-1 text-sm font-medium rounded-full border ${getStatusColor(claim.status)}`}>
                        {claim.status}
                      </span>
                    </td>
                    <td className="py-4 px-4 font-semibold text-foreground">
                      {formatCurrency(claim.claimValue)}
                    </td>
                    <td className="py-4 px-4">
                      <div className={`flex items-center space-x-2 ${aging.color}`}>
                        <aging.icon className="w-4 h-4" />
                        <div className="flex flex-col">
                          <span className="text-sm font-medium">{claim.daysOpen} days</span>
                          <span className="text-xs opacity-75">{aging.label}</span>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <button
                        onClick={() => onClaimSelect(claim.orderId)}
                        className="inline-flex items-center space-x-1 px-3 py-1 text-sm text-primary hover:bg-primary/10 rounded-lg transition-colors"
                      >
                        <Eye className="w-4 h-4" />
                        <span>View</span>
                      </button>
                    </td>
                  </tr>
                );
            })}
          </tbody>
          </table>
        </div>
        
        {claims.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <div className="max-w-sm mx-auto">
              <div className="bg-muted rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                <Filter className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">No Claims Found</h3>
              <p className="text-sm">No claims match the current filters. Try adjusting your search criteria.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};