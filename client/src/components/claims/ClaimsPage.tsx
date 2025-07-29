import React, { useState } from 'react';
import { ClaimsTable } from './ClaimsTable';
import { ExportButtons } from './ExportButtons';
import { SearchAndFilter } from './SearchAndFilter';
import { ClaimDetails } from './ClaimDetails';
import { mockClaims } from './claimsHelpers';

export interface Claim {
  id: string;
  orderId: string;
  marketplace: string;
  issueType: string;
  status: string;
  createdAt: string;
  claimValue: number;
  daysOpen: number;
  priority?: string;
  autoFlagged?: boolean;
}

const ClaimsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'Returns' | 'Payments'>('Returns');
  const [selectedClaim, setSelectedClaim] = useState<string | null>(null);
  const [claims, setClaims] = useState<Claim[]>(mockClaims);
  const [filters, setFilters] = useState({
    marketplace: '',
    status: '',
    search: ''
  });

  const filteredClaims = claims.filter(claim => {
    const matchesTab = activeTab === 'Returns' 
      ? claim.issueType.includes('Refund') || claim.issueType.includes('Return')
      : claim.issueType.includes('Settlement') || claim.issueType.includes('Payment');
    
    const matchesMarketplace = !filters.marketplace || claim.marketplace === filters.marketplace;
    const matchesStatus = !filters.status || claim.status === filters.status;
    const matchesSearch = !filters.search || 
      claim.orderId.toLowerCase().includes(filters.search.toLowerCase()) ||
      claim.issueType.toLowerCase().includes(filters.search.toLowerCase());

    return matchesTab && matchesMarketplace && matchesStatus && matchesSearch;
  });

  if (selectedClaim) {
    return (
      <ClaimDetails 
        orderId={selectedClaim} 
        onBack={() => setSelectedClaim(null)} 
      />
    );
  }

  return (
    <div className="claims-container p-6">
      <div className="claims-card">
        <div className="claims-header">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Claims Tracker</h1>
              <p className="text-blue-100 mt-1">Manage marketplace claims and reconciliation issues</p>
            </div>
            <ExportButtons claims={filteredClaims} />
          </div>
        </div>
        
        <div className="p-6">
          {/* Tab Navigation */}
          <div className="flex space-x-1 mb-6">
            {(['Returns', 'Payments'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${
                  activeTab === tab
                    ? 'claim-filter-tab active'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Search and Filters */}
          <SearchAndFilter 
            filters={filters}
            onFiltersChange={setFilters}
            claims={claims}
          />

          {/* Claims Table */}
          <ClaimsTable
            claims={filteredClaims}
            onClaimSelect={setSelectedClaim}
            onClaimsUpdate={setClaims}
          />
        </div>
      </div>
    </div>
  );
};

export default ClaimsPage;