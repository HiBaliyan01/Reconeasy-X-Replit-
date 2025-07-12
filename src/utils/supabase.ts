import { createClient } from '@supabase/supabase-js';

// Initialize the Supabase client
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase credentials missing. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY environment variables.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type RateCard = {
  id: string;
  platform: string;
  category: string;
  commission_rate: number;
  shipping_fee: number;
  gst_rate: number;
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
  gst: number;
  rateCardFound: boolean;
} {
  // Find matching rate card
  const rateCard = rateCards.find(
    card => card.platform.toLowerCase() === platform.toLowerCase() && 
            card.category.toLowerCase() === category.toLowerCase()
  );
  
  if (!rateCard) {
    return { 
      expected: mrp, 
      commission: 0, 
      shipping: 0, 
      gst: 0,
      rateCardFound: false 
    };
  }
  
  // Calculate fees
  const commission = (rateCard.commission_rate / 100) * mrp;
  const shipping = rateCard.shipping_fee || 0;
  const gst = ((commission + shipping) * (rateCard.gst_rate || 0)) / 100;
  
  // Calculate expected amount
  const expected = mrp - (commission + shipping + gst);
  
  return {
    expected,
    commission,
    shipping,
    gst,
    rateCardFound: true
  };
}