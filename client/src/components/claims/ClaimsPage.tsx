import React, { useState } from 'react';
import { ClaimsTable } from './ClaimsTable';
import { ExportButtons } from './ExportButtons';
import { SearchAndFilter } from './SearchAndFilter';
import { ClaimDetails } from './ClaimDetails';
import { mockClaims } from './claimsHelpers';
import ClaimsHead from '../subtabs/ClaimsHead';
import StaggeredContent from '../transitions/StaggeredContent';
import TabTransition from '../transitions/TabTransition';
import PageBrandHeader from '../layout/PageBrandHeader';
import { motion } from 'framer-motion';

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
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -20 }}
        transition={{ duration: 0.3 }}
      >
        <ClaimDetails 
          orderId={selectedClaim} 
          onBack={() => setSelectedClaim(null)} 
        />
      </motion.div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Brand banner (teal) */}
      <PageBrandHeader
        title="Claims"
        description="Marketplace claims and dispute resolution"
      />

      {/* Section header (blue) */}
      <ClaimsHead />

      {/* Filters and tab navigation */}
      <div className="bg-card rounded-xl shadow-sm border border-border p-6">
        {/* Tab Navigation */}
        <div className="flex space-x-1 mb-6">
          {(['Returns', 'Payments'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
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