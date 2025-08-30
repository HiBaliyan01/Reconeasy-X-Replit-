import React, { useState } from 'react';
import ClaimsPage from './claims/ClaimsPage';
import ClaimDetails from './ClaimDetails';

const ClaimManagementNew: React.FC = () => {
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  const handleClaimClick = (orderId: string) => {
    setSelectedOrderId(orderId);
  };

  // If an order is selected, show claim details
  if (selectedOrderId) {
    return (
      <ClaimDetails 
        orderId={selectedOrderId} 
        onBack={() => setSelectedOrderId(null)} 
      />
    );
  }

  return (
    <ClaimsPage onClaimClick={handleClaimClick} />
  );
};

export default ClaimManagementNew;