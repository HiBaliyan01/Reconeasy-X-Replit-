import { createClient } from "npm:@supabase/supabase-js@2";

// Initialize Supabase client with environment variables
const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

interface RateCard {
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
}

interface PredictRecoInput {
  mrp: number;
  order_id: string;
  marketplace: string;
  category: string;
  date: string;
  actual_settlement_amount: number;
}

interface PredictRecoOutput {
  order_id: string;
  marketplace: string;
  category: string;
  mrp: number;
  actual_settlement_amount: number;
  expected_payout: number;
  delta: number;
  mismatch_flag: boolean;
  calculation_breakdown: {
    commission: number;
    shipping_fee: number;
    gst: number;
    rto_fee: number;
    packaging_fee: number;
    fixed_fee: number;
    total_deductions: number;
  };
  rate_card_found: boolean;
  rate_card_id?: string;
}

// Dummy rate card lookup logic
function getDummyRateCard(marketplace: string, category: string, date: string): RateCard | null {
  const dummyRateCards: RateCard[] = [
    {
      id: "RC001",
      platform: "Amazon",
      category: "Apparel",
      commission_rate: 15.0,
      shipping_fee: 50,
      gst_rate: 18.0,
      rto_fee: 100,
      packaging_fee: 20,
      fixed_fee: 10,
      min_price: 100,
      max_price: 10000,
      effective_from: "2024-01-01",
      effective_to: "2024-12-31"
    },
    {
      id: "RC002",
      platform: "Flipkart",
      category: "Apparel",
      commission_rate: 18.0,
      shipping_fee: 60,
      gst_rate: 18.0,
      rto_fee: 120,
      packaging_fee: 25,
      fixed_fee: 15,
      min_price: 100,
      max_price: 15000,
      effective_from: "2024-01-01",
      effective_to: "2024-12-31"
    },
    {
      id: "RC003",
      platform: "Myntra",
      category: "Apparel",
      commission_rate: 20.0,
      shipping_fee: 70,
      gst_rate: 18.0,
      rto_fee: 150,
      packaging_fee: 30,
      fixed_fee: 20,
      min_price: 200,
      max_price: 20000,
      effective_from: "2024-01-01",
      effective_to: "2024-12-31"
    },
    {
      id: "RC004",
      platform: "Amazon",
      category: "Electronics",
      commission_rate: 12.0,
      shipping_fee: 80,
      gst_rate: 18.0,
      rto_fee: 200,
      packaging_fee: 40,
      fixed_fee: 25,
      min_price: 500,
      max_price: 50000,
      effective_from: "2024-01-01",
      effective_to: "2024-12-31"
    },
    {
      id: "RC005",
      platform: "Flipkart",
      category: "Electronics",
      commission_rate: 14.0,
      shipping_fee: 90,
      gst_rate: 18.0,
      rto_fee: 180,
      packaging_fee: 35,
      fixed_fee: 20,
      min_price: 500,
      max_price: 40000,
      effective_from: "2024-01-01",
      effective_to: "2024-12-31"
    }
  ];

  // Find matching rate card
  const matchingCard = dummyRateCards.find(card => {
    const isMarketplaceMatch = card.platform.toLowerCase() === marketplace.toLowerCase();
    const isCategoryMatch = card.category.toLowerCase() === category.toLowerCase();
    
    // Check date range
    const inputDate = new Date(date);
    const effectiveFrom = card.effective_from ? new Date(card.effective_from) : new Date("2024-01-01");
    const effectiveTo = card.effective_to ? new Date(card.effective_to) : new Date("2024-12-31");
    
    const isDateInRange = inputDate >= effectiveFrom && inputDate <= effectiveTo;
    
    return isMarketplaceMatch && isCategoryMatch && isDateInRange;
  });

  return matchingCard || null;
}

function calculateExpectedPayout(mrp: number, rateCard: RateCard | null): {
  expected_payout: number;
  breakdown: {
    commission: number;
    shipping_fee: number;
    gst: number;
    rto_fee: number;
    packaging_fee: number;
    fixed_fee: number;
    total_deductions: number;
  };
} {
  if (!rateCard) {
    // If no rate card found, return MRP as expected payout with zero deductions
    return {
      expected_payout: mrp,
      breakdown: {
        commission: 0,
        shipping_fee: 0,
        gst: 0,
        rto_fee: 0,
        packaging_fee: 0,
        fixed_fee: 0,
        total_deductions: 0
      }
    };
  }

  // Check if MRP is within the rate card's price range
  if (rateCard.min_price && mrp < rateCard.min_price) {
    throw new Error(`MRP ₹${mrp} is below minimum price ₹${rateCard.min_price} for this rate card`);
  }
  if (rateCard.max_price && mrp > rateCard.max_price) {
    throw new Error(`MRP ₹${mrp} is above maximum price ₹${rateCard.max_price} for this rate card`);
  }

  // Calculate individual fees
  const commission = (rateCard.commission_rate / 100) * mrp;
  const shipping_fee = rateCard.shipping_fee || 0;
  const rto_fee = rateCard.rto_fee || 0;
  const packaging_fee = rateCard.packaging_fee || 0;
  const fixed_fee = rateCard.fixed_fee || 0;

  // Calculate total fees before GST
  const totalFeesBeforeGST = commission + shipping_fee + rto_fee + packaging_fee + fixed_fee;

  // Calculate GST on total fees
  const gst = (totalFeesBeforeGST * (rateCard.gst_rate || 0)) / 100;

  // Calculate total deductions
  const total_deductions = totalFeesBeforeGST + gst;

  // Calculate expected payout
  const expected_payout = mrp - total_deductions;

  return {
    expected_payout,
    breakdown: {
      commission,
      shipping_fee,
      gst,
      rto_fee,
      packaging_fee,
      fixed_fee,
      total_deductions
    }
  };
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ error: "Method not allowed. Use POST." }),
        {
          status: 405,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        }
      );
    }

    // Parse request body
    const input: PredictRecoInput = await req.json();

    // Validate input
    if (!input.mrp || !input.order_id || !input.marketplace || !input.category || !input.date || input.actual_settlement_amount === undefined) {
      return new Response(
        JSON.stringify({ 
          error: "Missing required fields: mrp, order_id, marketplace, category, date, actual_settlement_amount" 
        }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        }
      );
    }

    // Validate MRP and actual settlement amount
    if (input.mrp <= 0 || input.actual_settlement_amount < 0) {
      return new Response(
        JSON.stringify({ 
          error: "MRP must be positive and actual settlement amount must be non-negative" 
        }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        }
      );
    }

    // Look up rate card (using dummy logic for now)
    const rateCard = getDummyRateCard(input.marketplace, input.category, input.date);

    // Calculate expected payout
    const { expected_payout, breakdown } = calculateExpectedPayout(input.mrp, rateCard);

    // Calculate delta and mismatch flag
    const delta = expected_payout - input.actual_settlement_amount;
    const mismatch_flag = Math.abs(delta) > 10; // ₹10 threshold

    // Prepare response
    const result: PredictRecoOutput = {
      order_id: input.order_id,
      marketplace: input.marketplace,
      category: input.category,
      mrp: input.mrp,
      actual_settlement_amount: input.actual_settlement_amount,
      expected_payout: Math.round(expected_payout * 100) / 100, // Round to 2 decimal places
      delta: Math.round(delta * 100) / 100,
      mismatch_flag,
      calculation_breakdown: {
        commission: Math.round(breakdown.commission * 100) / 100,
        shipping_fee: breakdown.shipping_fee,
        gst: Math.round(breakdown.gst * 100) / 100,
        rto_fee: breakdown.rto_fee,
        packaging_fee: breakdown.packaging_fee,
        fixed_fee: breakdown.fixed_fee,
        total_deductions: Math.round(breakdown.total_deductions * 100) / 100
      },
      rate_card_found: rateCard !== null,
      rate_card_id: rateCard?.id
    };

    // Log the calculation for debugging (optional)
    console.log(`Processed reconciliation for order ${input.order_id}: Expected ₹${expected_payout}, Actual ₹${input.actual_settlement_amount}, Delta ₹${delta}, Mismatch: ${mismatch_flag}`);

    // Store result in settlements table (optional)
    try {
      const { error: insertError } = await supabase
        .from("settlements")
        .insert({
          expected_amount: expected_payout,
          paid_amount: input.actual_settlement_amount,
          fee_breakdown: breakdown,
          reco_status: mismatch_flag ? "mismatch" : "matched",
          delta: delta
        });

      if (insertError) {
        console.warn("Failed to store settlement record:", insertError.message);
      }
    } catch (storageError) {
      console.warn("Error storing settlement record:", storageError);
    }

    return new Response(
      JSON.stringify(result),
      {
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    );

  } catch (error) {
    console.error("Error in predict_reco function:", error);
    
    return new Response(
      JSON.stringify({ 
        error: "Internal server error", 
        details: error instanceof Error ? error.message : "Unknown error" 
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    );
  }
});