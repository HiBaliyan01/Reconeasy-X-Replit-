import { createClient } from "https://esm.sh/@supabase/supabase-js@2.43.1";
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { transformLegacyRateCards, type LegacyRateCardRow } from "../../../shared/rateCards/legacy.ts";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET,OPTIONS",
};

const supabaseUrl =
  Deno.env.get("PROJECT_URL") ??
  Deno.env.get("SUPABASE_URL") ??
  Deno.env.get("VITE_SUPABASE_URL");

const supabaseKey =
  Deno.env.get("SERVICE_ROLE_KEY") ??
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
  Deno.env.get("SUPABASE_SERVICE_KEY");

if (!supabaseUrl || !supabaseKey) {
  console.warn("rate-cards function missing Supabase credentials. Responses will fail.");
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "GET") {
    return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });
  }

  if (!supabaseUrl || !supabaseKey) {
    return new Response(JSON.stringify({ message: "Supabase credentials not configured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const client = createClient(supabaseUrl, supabaseKey);

    const { data, error } = await client
      .from("rate_cards")
      .select(
        [
          "id",
          "platform",
          "category",
          "commission_rate",
          "shipping_fee",
          "gst_rate",
          "rto_fee",
          "packaging_fee",
          "fixed_fee",
          "min_price",
          "max_price",
          "effective_from",
          "effective_to",
          "promo_discount_fee",
          "territory_fee",
          "notes",
          "created_at",
        ].join(",")
      )
      .order("created_at", { ascending: false });

    if (error) {
      console.error("rate-cards fetch error:", error);
      return new Response(JSON.stringify({ message: error.message ?? "Failed to fetch rate cards" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: normalized, metrics } = transformLegacyRateCards((data ?? []) as LegacyRateCardRow[]);

    return new Response(JSON.stringify({ data: normalized, metrics }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("rate-cards unexpected error:", err);
    const message = err instanceof Error ? err.message : "Failed to fetch rate cards";
    return new Response(JSON.stringify({ message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
