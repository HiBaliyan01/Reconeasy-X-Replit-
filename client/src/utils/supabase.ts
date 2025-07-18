import { createClient } from '@supabase/supabase-js';

// Initialize the Supabase client
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Use mock mode if credentials are missing
if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase credentials missing. Running in mock mode with local data only.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

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
export async function fetchRateCards() {
  const { data, error } = await supabase
    .from('rate_cards')
    .select('*')
    .order('created_at', { ascending: false });
  
  if (error) {
    console.error('Error fetching rate cards:', error);
    return [];
  }
  
  return data || [];
}

export async function addRateCard(rateCard: Omit<RateCard, 'id' | 'created_at'>) {
  const { data, error } = await supabase
    .from('rate_cards')
    .insert([rateCard]);
  
  if (error) {
    console.error('Error adding rate card:', error);
    return null;
  }
  
  return data;
}

export async function deleteRateCard(id: string) {
  const { error } = await supabase
    .from('rate_cards')
    .delete()
    .eq('id', id);
  
  if (error) {
    console.error('Error deleting rate card:', error);
    return false;
  }
  
  return true;
}

export async function updateRateCard(id: string, updates: Partial<Omit<RateCard, 'id' | 'created_at'>>) {
  const { data, error } = await supabase
    .from('rate_cards')
    .update(updates)
    .eq('id', id);
  
  if (error) {
    console.error('Error updating rate card:', error);
    return null;
  }
  
  return data;
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