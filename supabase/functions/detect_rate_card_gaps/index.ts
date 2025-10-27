import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.43.1";

type GapStatus = "missing_period" | "missing_current";

type GapResult = {
  marketplace: string;
  category: string;
  status: GapStatus;
  gap_from?: string;
  gap_to?: string;
  template_type?: string | null;
  template_version?: string | null;
};

type RateCardRow = {
  id: string;
  platform_id: string | null;
  category_id: string | null;
  effective_from: string | null;
  effective_to: string | null;
  template_type: string | null;
  template_version: string | null;
  archived: boolean | null;
};

type DetectPayload = {
  marketplace?: string | null;
  category?: string | null;
};

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
};

const PLATFORM_LABELS: Record<string, string> = {
  amazon: "Amazon",
  flipkart: "Flipkart",
  myntra: "Myntra",
  ajio: "AJIO",
  quick: "Quick Commerce",
};

const CATEGORY_LABELS: Record<string, string> = {
  apparel: "Apparel",
  electronics: "Electronics",
  beauty: "Beauty",
  home: "Home",
  toys: "Toys",
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
  console.warn("detect_rate_card_gaps: Missing Supabase credentials. Requests will fail.");
}

const platformAlias = buildAliasMap(PLATFORM_LABELS);
const categoryAlias = buildAliasMap(CATEGORY_LABELS);

function buildAliasMap(base: Record<string, string>) {
  const map: Record<string, string> = {};
  for (const [key, label] of Object.entries(base)) {
    map[key.toLowerCase()] = key;
    map[label.toLowerCase()] = key;
  }
  return map;
}

function normalizeIdentifier(value?: string | null) {
  if (!value) return null;
  const normalized = value.toString().trim();
  return normalized.length ? normalized : null;
}

function resolvePlatformId(value?: string | null): string | null {
  const normalized = normalizeIdentifier(value)?.toLowerCase();
  if (!normalized) return null;
  return platformAlias[normalized] ?? normalized;
}

function resolveCategoryId(value?: string | null): string | null {
  const normalized = normalizeIdentifier(value)?.toLowerCase();
  if (!normalized) return null;
  return categoryAlias[normalized] ?? normalized;
}

function formatDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function parseDate(value?: string | null): Date | null {
  if (!value) return null;
  const iso = value.length === 10 ? `${value}T00:00:00Z` : value;
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate()));
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

function previousDay(date: Date): Date {
  return addDays(date, -1);
}

function withinRange(target: Date, start: Date | null, end: Date | null) {
  if (!start) return false;
  if (start > target) return false;
  if (!end) return true;
  return end >= target;
}

function displayPlatform(id: string | null | undefined) {
  if (!id) return "Unknown";
  const normalized = id.toLowerCase();
  return PLATFORM_LABELS[normalized] ?? id;
}

function displayCategory(id: string | null | undefined) {
  if (!id) return "Unknown";
  const normalized = id.toLowerCase();
  return CATEGORY_LABELS[normalized] ?? id;
}

function respond(status: number, payload: Record<string, unknown>) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function ensureClient(): SupabaseClient | null {
  if (!supabaseUrl || !supabaseKey) return null;
  return createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false },
  });
}

async function detectGaps(
  client: SupabaseClient,
  filters: { platformId?: string | null; categoryId?: string | null }
) {
  const query = client
    .from<RateCardRow>("rate_cards_v2")
    .select(
      "id, platform_id, category_id, effective_from, effective_to, template_type, template_version, archived"
    )
    .eq("archived", false);

  if (filters.platformId) {
    query.eq("platform_id", filters.platformId);
  }
  if (filters.categoryId) {
    query.eq("category_id", filters.categoryId);
  }

  const { data, error } = await query;
  if (error) {
    console.error("detect_rate_card_gaps: query error", error);
    throw new Error(error.message ?? "Failed to fetch rate cards");
  }

  const rows = Array.isArray(data) ? data : [];

  const groups = new Map<string, RateCardRow[]>();
  for (const row of rows) {
    if (!row || row.archived) continue;
    const platformId = row.platform_id;
    const categoryId = row.category_id;
    if (!platformId || !categoryId) continue;
    const key = `${platformId}::${categoryId}`;
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(row);
  }

  const today = new Date();
  const todayUtc = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));

  const results: GapResult[] = [];

  for (const [key, list] of groups) {
    if (!list.length) continue;
    list.sort((a, b) => {
      const left = parseDate(a.effective_from)?.getTime() ?? Number.POSITIVE_INFINITY;
      const right = parseDate(b.effective_from)?.getTime() ?? Number.POSITIVE_INFINITY;
      return left - right;
    });

    const [platformId, categoryId] = key.split("::");
    const marketplace = displayPlatform(platformId);
    const category = displayCategory(categoryId);

    for (let index = 0; index < list.length - 1; index += 1) {
      const current = list[index];
      const next = list[index + 1];
      const currentEnd = parseDate(current.effective_to);
      const nextStart = parseDate(next.effective_from);

      if (!currentEnd || !nextStart) {
        continue;
      }

      const dayAfterCurrent = addDays(currentEnd, 1);
      if (dayAfterCurrent < nextStart) {
        const gapFrom = dayAfterCurrent;
        const gapTo = previousDay(nextStart);
        results.push({
          marketplace,
          category,
          status: "missing_period",
          gap_from: formatDate(gapFrom),
          gap_to: formatDate(gapTo),
          template_type: next.template_type ?? current.template_type ?? null,
          template_version: next.template_version ?? current.template_version ?? null,
        });
      }
    }

    const hasCurrentCoverage = list.some((row) => {
      const from = parseDate(row.effective_from);
      const to = parseDate(row.effective_to);
      return withinRange(todayUtc, from, to);
    });

    if (!hasCurrentCoverage) {
      results.push({
        marketplace,
        category,
        status: "missing_current",
      });
    }
  }

  return {
    checked: groups.size,
    gaps: results,
  };
}

serve(async (request: Request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method === "GET") {
    return respond(200, { status: "ready" });
  }

  if (request.method !== "POST") {
    return respond(405, { status: "error", message: "Method not allowed" });
  }

  let payload: DetectPayload | null = null;
  if (request.headers.get("content-length") !== "0") {
    const rawBody = await request.text();
    if (rawBody) {
      try {
        payload = JSON.parse(rawBody);
      } catch (_error) {
        return respond(400, { status: "error", message: "Invalid JSON payload" });
      }
    }
  }

  if (payload && (typeof payload !== "object" || Array.isArray(payload))) {
    return respond(400, { status: "error", message: "Payload must be an object" });
  }

  if (payload?.marketplace != null && typeof payload.marketplace !== "string") {
    return respond(400, { status: "error", message: "marketplace must be a string" });
  }
  if (payload?.category != null && typeof payload.category !== "string") {
    return respond(400, { status: "error", message: "category must be a string" });
  }

  const marketplaceId = resolvePlatformId(payload?.marketplace);
  const categoryId = resolveCategoryId(payload?.category);

  const client = ensureClient();
  if (!client) {
    return respond(500, { status: "error", message: "Supabase client not configured" });
  }

  try {
    const { checked, gaps } = await detectGaps(client, {
      platformId: marketplaceId ?? undefined,
      categoryId: categoryId ?? undefined,
    });

    if (!gaps.length) {
      return respond(200, {
        status: "ok",
        checked,
        gaps: [],
        message: "No gaps detected",
      });
    }

    return respond(200, {
      status: "success",
      checked,
      gaps,
    });
  } catch (error) {
    console.error("detect_rate_card_gaps: execution error", error);
    const message = error instanceof Error ? error.message : "Unexpected error";
    return respond(500, { status: "error", message });
  }
});
