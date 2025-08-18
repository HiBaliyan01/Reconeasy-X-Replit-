import React, { useState } from 'react';
import { ClaimsTable } from './ClaimsTable';
import { ExportButtons } from './ExportButtons';
import { SearchAndFilter } from './SearchAndFilter';
import { ClaimDetails } from './ClaimDetails';
import { mockClaims } from './claimsHelpers';
import ClaimsHead from '../subtabs/ClaimsHead';

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

interface ClaimsPageProps {
  onClaimSelect?: (orderId: string) => void;
}

const ClaimsPage: React.FC<ClaimsPageProps> = ({ onClaimSelect }) => {
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

  const handleClaimSelect = (orderId: string) => {
    if (onClaimSelect) {
      onClaimSelect(orderId);
    } else {
      setSelectedClaim(orderId);
    }
  };

  if (selectedClaim && !onClaimSelect) {
    return (
      <ClaimDetails 
        orderId={selectedClaim} 
        onBack={() => setSelectedClaim(null)} 
      />
    );
  }

  return (
    <div className="space-y-6">
      <ClaimsHead />
      
      <div className="bg-card rounded-xl shadow-sm border border-border p-6">
        {/* Tab Navigation */}
        <div className="flex space-x-1 mb-6">
          {(['Returns', 'Payments'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                activeTab === tab
                  ? 'border-subheader-claims text-subheader-claims bg-subheader-claims/10 border-2'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
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
      </div>

      {/* Claims Table */}
      <div className="bg-card rounded-xl shadow-sm border border-border">
        <ClaimsTable
          claims={filteredClaims}
          onClaimSelect={handleClaimSelect}
          onClaimsUpdate={setClaims}
        />
      </div>
    </div>
  );
};

export default ClaimsPage;