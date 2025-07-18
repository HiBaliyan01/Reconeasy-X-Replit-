// Removed Supabase client - using internal API instead

export type RateCard = {
  id: string;
  platform: string;
  category: string;
  commission_rate: number;
  shipping_fee: number;
  gst_rate: number;
  rto_fee?: number;
  packaging_fee?: number;
  fixed_fee?: number;
  min_price?: number;
  max_price?: number;
  effective_from?: string;
  effective_to?: string;
  promo_discount_fee?: number;
  territory_fee?: number;
  notes?: string;
  created_at: string;
};

// Rate card functions
export async function fetchRateCards(): Promise<RateCard[]> {
  try {
    const response = await fetch('/api/rate-cards');
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    return data || [];
  } catch (error) {
    console.error('Error fetching rate cards:', error);
    return [];
  }
}

export async function addRateCard(rateCard: Omit<RateCard, 'id' | 'created_at'>) {
  try {
    const response = await fetch('/api/rate-cards', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(rateCard),
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error adding rate card:', error);
    return null;
  }
}

export async function deleteRateCard(id: string) {
  try {
    const response = await fetch(`/api/rate-cards/${id}`, {
      method: 'DELETE',
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return true;
  } catch (error) {
    console.error('Error deleting rate card:', error);
    return false;
  }
}

export async function updateRateCard(id: string, updates: Partial<Omit<RateCard, 'id' | 'created_at'>>) {
  try {
    const response = await fetch(`/api/rate-cards/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updates),
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error updating rate card:', error);
    return null;
  }
}

// Calculate expected amount based on rate card
export function calculateExpectedAmount(
  mrp: number,
  platform: string,
  category: string,
  rateCards: RateCard[]
): { 
  expected: number;
  commission: number;
  shipping: number;
  rto: number;
  packaging: number;
  fixed: number;
  gst: number;
  rateCardFound: boolean;
} {
  // Find matching rate card
  const rateCard = rateCards.find(
    card => card.platform.toLowerCase() === platform.toLowerCase() && 
            card.category.toLowerCase() === category.toLowerCase() &&
            (!card.min_price || mrp >= card.min_price) &&
            (!card.max_price || mrp <= card.max_price)
  );
  
  if (!rateCard) {
    return { 
      expected: mrp, 
      commission: 0, 
      shipping: 0, 
      rto: 0,
      packaging: 0,
      fixed: 0,
      gst: 0,
      rateCardFound: false 
    };
  }
  
  // Calculate fees
  const commission = (rateCard.commission_rate / 100) * mrp;
  const shipping = rateCard.shipping_fee || 0;
  const rto = rateCard.rto_fee || 0;
  const packaging = rateCard.packaging_fee || 0;
  const fixed = rateCard.fixed_fee || 0;
  
  // Calculate total fees before GST
  const totalFees = commission + shipping + rto + packaging + fixed;
  
  // Calculate GST on total fees
  const gst = (totalFees * (rateCard.gst_rate || 0)) / 100;
  
  // Calculate expected amount
  const expected = mrp - (totalFees + gst);
  
  return {
    expected,
    commission,
    shipping,
    rto,
    packaging,
    fixed,
    gst,
    rateCardFound: true
  };
}