import React, { useState } from 'react';
import { Clock, AlertTriangle } from 'lucide-react';
import { Claim } from './ClaimsPage';
import { BulkActions } from './BulkActions';
import { ClaimStatusBadge } from './ClaimStatusBadge';
import { getAgingIndicator, formatCurrency } from './claimsHelpers';

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
      console.log(`Status updated with comment: ${comment}`);
    }
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

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left py-3 px-2 w-8">
                <input
                  type="checkbox"
                  checked={selectedClaims.length === claims.length && claims.length > 0}
                  onChange={toggleSelectAll}
                  className="rounded border-gray-300"
                />
              </th>
              <th className="text-left py-3 px-4 font-medium text-gray-900">Order ID</th>
              <th className="text-left py-3 px-4 font-medium text-gray-900">Marketplace</th>
              <th className="text-left py-3 px-4 font-medium text-gray-900">Issue Type</th>
              <th className="text-left py-3 px-4 font-medium text-gray-900">Status</th>
              <th className="text-left py-3 px-4 font-medium text-gray-900">Claim Value</th>
              <th className="text-left py-3 px-4 font-medium text-gray-900">Days Open</th>
              <th className="text-left py-3 px-4 font-medium text-gray-900">Actions</th>
            </tr>
          </thead>
          <tbody>
            {claims.map((claim) => {
              const aging = getAgingIndicator(claim.daysOpen);
              const isSelected = selectedClaims.includes(claim.id);
              
              return (
                <tr
                  key={claim.id}
                  className={`claim-table-row border-b border-gray-100 ${
                    isSelected ? 'selected' : ''
                  }`}
                >
                  <td className="py-3 px-2">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelection(claim.id)}
                      className="rounded border-gray-300"
                    />
                  </td>
                  <td className="py-3 px-4">
                    <button
                      onClick={() => onClaimSelect(claim.orderId)}
                      className="text-blue-600 hover:text-blue-800 font-medium"
                    >
                      {claim.orderId}
                    </button>
                    <div className="flex space-x-1 mt-1">
                      {claim.priority === 'High' && (
                        <span className="claim-priority-high text-xs px-2 py-1 rounded-full">
                          High Priority
                        </span>
                      )}
                      {claim.autoFlagged && (
                        <span className="claim-auto-flagged text-xs px-2 py-1 rounded-full">
                          Auto Flagged
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-3 px-4 text-gray-900">{claim.marketplace}</td>
                  <td className="py-3 px-4 text-gray-900">{claim.issueType}</td>
                  <td className="py-3 px-4">
                    <ClaimStatusBadge 
                      status={claim.status}
                      onStatusChange={(newStatus) => {
                        const updatedClaims = claims.map(c =>
                          c.id === claim.id ? { ...c, status: newStatus } : c
                        );
                        onClaimsUpdate(updatedClaims);
                      }}
                    />
                  </td>
                  <td className="py-3 px-4 font-medium text-gray-900">
                    {formatCurrency(claim.claimValue)}
                  </td>
                  <td className="py-3 px-4">
                    <div className={`flex items-center space-x-1 ${aging.color}`}>
                      <Clock className="w-4 h-4" />
                      <span>{claim.daysOpen} days</span>
                      {aging.tooltip && (
                        <div className="relative group">
                          <AlertTriangle className="w-4 h-4 cursor-help" />
                          <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                            {aging.tooltip}
                          </div>
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <button
                      onClick={() => onClaimSelect(claim.orderId)}
                      className="text-blue-600 hover:text-blue-800 text-sm"
                    >
                      View Details
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {claims.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          No claims found matching the current filters.
        </div>
      )}
    </div>
  );
};