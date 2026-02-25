import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
};

type RestoreRequest = {
  upload_id?: string;
};

type RestoreSnapshot = {
  created_at?: string | null;
  expires_at?: string | null;
  used_at?: string | null;
  new_card_ids?: string[];
  previous_cards?: Record<string, unknown>[];
  previous_fees?: Record<string, unknown>[];
  previous_slabs?: Record<string, unknown>[];
};

const jsonClone = <T>(value: T): T => JSON.parse(JSON.stringify(value ?? null));

const respond = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return respond(405, { status: "error", message: "Method not allowed" });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return respond(500, { status: "error", message: "Supabase credentials not configured" });
  }

  let payload: RestoreRequest;
  try {
    payload = (await req.json()) as RestoreRequest;
  } catch {
    return respond(400, { status: "error", message: "Invalid JSON payload" });
  }

  const uploadId = typeof payload?.upload_id === "string" ? payload.upload_id.trim() : "";
  if (!uploadId) {
    return respond(400, { status: "error", message: "upload_id is required" });
  }

  try {
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data: uploadRecord, error: fetchError } = await supabase
      .from("rate_card_data")
      .select("id, issues, status, uploaded_at")
      .eq("id", uploadId)
      .maybeSingle<{ id: string; issues: unknown; status?: string | null; uploaded_at?: string | null }>();

    if (fetchError) {
      console.error("restore_rate_card_data fetch error", fetchError);
      return respond(500, { status: "error", message: fetchError.message });
    }

    if (!uploadRecord) {
      return respond(404, { status: "error", message: "Upload not found" });
    }

    const rawIssues = uploadRecord.issues;
    const issuesObject =
      rawIssues && typeof rawIssues === "object" && !Array.isArray(rawIssues)
        ? (rawIssues as Record<string, unknown>)
        : null;
    const restoreMeta = issuesObject && typeof issuesObject.restore === "object"
      ? (issuesObject.restore as RestoreSnapshot)
      : null;

    if (!restoreMeta) {
      return respond(400, { status: "error", message: "Restore information not found for this upload" });
    }

    if (restoreMeta.used_at) {
      return respond(400, { status: "error", message: "Restore already used for this upload" });
    }

    if (restoreMeta.expires_at) {
      const expiresAt = Date.parse(restoreMeta.expires_at);
      if (!Number.isNaN(expiresAt) && expiresAt < Date.now()) {
        return respond(400, { status: "error", message: "Restore window has expired" });
      }
    }

    const newCardIds = Array.isArray(restoreMeta.new_card_ids)
      ? restoreMeta.new_card_ids.filter((id): id is string => typeof id === "string" && id.length > 0)
      : [];
    const previousCards = Array.isArray(restoreMeta.previous_cards) ? restoreMeta.previous_cards : [];
    const previousFees = Array.isArray(restoreMeta.previous_fees) ? restoreMeta.previous_fees : [];
    const previousSlabs = Array.isArray(restoreMeta.previous_slabs) ? restoreMeta.previous_slabs : [];

    if (!newCardIds.length && !previousCards.length) {
      return respond(400, { status: "error", message: "No restore data available for this upload" });
    }

    if (newCardIds.length) {
      const { error: deleteFeesError } = await supabase
        .from("rate_card_fees")
        .delete()
        .in("rate_card_id", newCardIds);
      if (deleteFeesError && deleteFeesError.code !== "PGRST116") {
        console.error("restore_rate_card_data delete fees error", deleteFeesError);
        return respond(500, { status: "error", message: deleteFeesError.message });
      }

      const { error: deleteSlabsError } = await supabase
        .from("rate_card_slabs")
        .delete()
        .in("rate_card_id", newCardIds);
      if (deleteSlabsError && deleteSlabsError.code !== "PGRST116") {
        console.error("restore_rate_card_data delete slabs error", deleteSlabsError);
        return respond(500, { status: "error", message: deleteSlabsError.message });
      }

      const { error: deleteCardsError } = await supabase
        .from("rate_cards_v2")
        .delete()
        .in("id", newCardIds);
      if (deleteCardsError) {
        console.error("restore_rate_card_data delete cards error", deleteCardsError);
        return respond(500, { status: "error", message: deleteCardsError.message });
      }
    }

    let restoredCount = 0;
    if (previousCards.length) {
      const sanitizedCards = jsonClone(previousCards).map((card: Record<string, unknown>) => {
        const copy = { ...card };
        return copy;
      });

      const { error: insertCardsError } = await supabase.from("rate_cards_v2").insert(sanitizedCards);
      if (insertCardsError) {
        console.error("restore_rate_card_data insert cards error", insertCardsError);
        return respond(500, { status: "error", message: insertCardsError.message });
      }
      restoredCount += sanitizedCards.length;
    }

    if (previousFees.length) {
      const sanitizedFees = jsonClone(previousFees).map((fee: Record<string, unknown>) => ({ ...fee }));
      const { error: insertFeesError } = await supabase.from("rate_card_fees").insert(sanitizedFees);
      if (insertFeesError) {
        console.error("restore_rate_card_data insert fees error", insertFeesError);
        return respond(500, { status: "error", message: insertFeesError.message });
      }
    }

    if (previousSlabs.length) {
      const sanitizedSlabs = jsonClone(previousSlabs).map((slab: Record<string, unknown>) => ({ ...slab }));
      const { error: insertSlabsError } = await supabase.from("rate_card_slabs").insert(sanitizedSlabs);
      if (insertSlabsError) {
        console.error("restore_rate_card_data insert slabs error", insertSlabsError);
        return respond(500, { status: "error", message: insertSlabsError.message });
      }
    }

    const updatedRestore = jsonClone(restoreMeta);
    updatedRestore.used_at = new Date().toISOString();

    const updatedIssues = issuesObject ? jsonClone(issuesObject) : {};
    updatedIssues.restore = updatedRestore;

    const { error: updateRecordError } = await supabase
      .from("rate_card_data")
      .update({ issues: updatedIssues })
      .eq("id", uploadId);

    if (updateRecordError) {
      console.error("restore_rate_card_data update record error", updateRecordError);
      return respond(500, { status: "error", message: updateRecordError.message });
    }

    return respond(200, {
      status: "success",
      message: "Previous rate cards restored",
      restored_count: restoredCount,
      removed_count: newCardIds.length,
    });
  } catch (error) {
    console.error("restore_rate_card_data unexpected error", error);
    const message = error instanceof Error ? error.message : "Unexpected error";
    return respond(500, { status: "error", message });
  }
});
