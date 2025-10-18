// Removed Supabase client - using internal API instead

import { invokeSupabaseFunction } from "./supabaseFunctions";

export type RateCard = {
  id: string;
  platform: string;
  category: string;
  commission_rate: number | null;
  commission_percent?: number | null;
  commission_type?: "flat" | "tiered";
  shipping_fee: number | null;
  gst_rate: number | null;
  rto_fee?: number | null;
  packaging_fee?: number | null;
  fixed_fee?: number | null;
  min_price?: number | null;
  max_price?: number | null;
  effective_from?: string;
  effective_to?: string;
  promo_discount_fee?: number | null;
  territory_fee?: number | null;
  notes?: string | null;
  created_at: string;
  status?: "active" | "upcoming" | "expired";
  platform_name?: string;
  category_name?: string;
};

// Rate card functions
export async function fetchRateCards(): Promise<RateCard[]> {
  const supabasePayload = await invokeSupabaseFunction<{ data?: RateCard[] }>("rate-cards");
  if (supabasePayload?.data && Array.isArray(supabasePayload.data)) {
    return supabasePayload.data as RateCard[];
  }
  return [];
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
