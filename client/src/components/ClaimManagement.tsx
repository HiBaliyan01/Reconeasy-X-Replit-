import React, { useState } from 'react';
import ClaimsPage from './claims/ClaimsPage';
import EnhancedClaimDetails from './EnhancedClaimDetails';
import '../styles/claims.css';

const ClaimManagement: React.FC = () => {
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  const handleClaimClick = (orderId: string) => {
    setSelectedOrderId(orderId);
  };

  // If an order is selected, show claim details
  if (selectedOrderId) {
    return (
      <EnhancedClaimDetails 
        orderId={selectedOrderId} 
        onBack={() => setSelectedOrderId(null)} 
      />
    );
  }

  return (
    <ClaimsPage onClaimClick={handleClaimClick} />
  );
};

export default ClaimManagement;