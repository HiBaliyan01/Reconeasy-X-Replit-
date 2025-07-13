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

Deno.serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    // Read new settlements where reco_status is null
    const { data: rows, error } = await supabase
      .from("settlements")
      .select("id, expected_amount, paid_amount, fee_breakdown")
      .is("reco_status", null)
      .limit(500);

    if (error) {
      throw new Error(`Error fetching settlements: ${error.message}`);
    }

    if (!rows || rows.length === 0) {
      return new Response(
        JSON.stringify({ message: "No settlements to process" }),
        {
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        }
      );
    }

    const updates = rows.map((row: any) => {
      const delta = row.expected_amount - row.paid_amount;
      const tolerance = 1; // ₹1 default tolerance
      const status = Math.abs(delta) <= tolerance ? "matched" : "mismatch";
      return { id: row.id, reco_status: status, delta };
    });

    // Bulk update
    const { error: updErr } = await supabase.from("settlements").upsert(updates);
    if (updErr) {
      throw new Error(`Error updating settlements: ${updErr.message}`);
    }

    return new Response(
      JSON.stringify({ 
        processed: updates.length,
        matched: updates.filter(u => u.reco_status === "matched").length,
        mismatched: updates.filter(u => u.reco_status === "mismatch").length
      }),
      {
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
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