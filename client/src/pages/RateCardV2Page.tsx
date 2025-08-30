import React, { useState } from 'react';
import RateCardFormV2 from '../components/RateCardFormV2';
import PageBrandHeader from '../components/layout/PageBrandHeader';

export default function RateCardV2Page() {
  const [mode, setMode] = useState<'create' | 'edit'>('create');

  const handleSaved = (id: string) => {
    console.log('Rate card saved with ID:', id);
    // Handle successful save (redirect, refresh, etc.)
  };

  return (
    <div className="space-y-6">
      <PageBrandHeader
        title="Rate Card Management V2"
        description="Advanced rate card configuration with tiered pricing and settlement terms"
      />
      
      <div className="bg-card rounded-xl shadow-sm border border-border p-6">
        <RateCardFormV2
          mode={mode}
          onSaved={handleSaved}
        />
      </div>
    </div>
  );
}