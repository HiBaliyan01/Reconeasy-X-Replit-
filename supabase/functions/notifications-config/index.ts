import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { DEFAULT_NOTIFICATION_CONFIG } from "../../../shared/notifications/config.ts";

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
  console.warn("notifications-config: Supabase credentials not fully provided; using static defaults only.");
}

// The current handler is static, but instantiate the client so future logic
// can query without reworking environment detection.
serve((req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "GET") {
    return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });
  }

  return new Response(JSON.stringify(DEFAULT_NOTIFICATION_CONFIG), {
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
});
