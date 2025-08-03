import React, { useState } from 'react';
import ClaimsPage from './claims/ClaimsPage';
import { ClaimDetails } from './claims/ClaimDetails';
// Routing logic to switch between ClaimsTable and ClaimDetails

interface ClaimManagementState {
  currentView: 'list' | 'details';
  selectedClaimId?: string;
}

const ClaimManagement: React.FC = () => {
  const [state, setState] = useState<ClaimManagementState>({
    currentView: 'list',
    selectedClaimId: undefined
  });

  const handleClaimSelect = (orderId: string) => {
    setState({
      currentView: 'details',
      selectedClaimId: orderId
    });
  };

  const handleBackToList = () => {
    setState({
      currentView: 'list',
      selectedClaimId: undefined
    });
  };

  const renderCurrentView = () => {
    switch (state.currentView) {
      case 'details':
        return (
          <ClaimDetails
            orderId={state.selectedClaimId || ''}
            onBack={handleBackToList}
          />
        );
      case 'list':
      default:
        return (
          <ClaimsPage onClaimSelect={handleClaimSelect} />
        );
    }
  };

  return (
    <div className="h-full">
      {renderCurrentView()}
    </div>
  );
};

export default ClaimManagement;