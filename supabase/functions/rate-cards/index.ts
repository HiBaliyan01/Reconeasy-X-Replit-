import { serve } from "https://deno.land/std@0.203.0/http/server.ts";
import { parse as parseCsvStrict } from "https://deno.land/std@0.203.0/csv/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.43.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Credentials": "true",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders,
    },
  });
}

type Payload = {
  id?: string;
  platform_id: string;
  category_id: string;
  commission_type: "flat" | "tiered";
  commission_percent?: number | null;
  slabs?: { min_price: number; max_price: number | null; commission_percent: number }[];
  fees?: { fee_code: string; fee_type: "percent" | "amount"; fee_value: number }[];
  effective_from: string;
  effective_to?: string | null;
  gst_percent?: number | string | null;
  tcs_percent?: number | string | null;
  settlement_basis?: string;
  t_plus_days?: number | null;
  weekly_weekday?: number | null;
  bi_weekly_weekday?: number | null;
  bi_weekly_which?: string | null;
  monthly_day?: string | null;
  grace_days?: number | null;
  global_min_price?: number | null;
  global_max_price?: number | null;
  notes?: string | null;
};

type NormalizedFee = {
  fee_code: string;
  fee_type: "percent" | "amount";
  fee_value: number;
};

type NormalizedSlab = {
  min_price: number;
  max_price: number | null;
  commission_percent: number;
};

type NormalizedCard = {
  id: string | null;
  platform_id: string;
  category_id: string;
  commission_type: "flat" | "tiered";
  commission_percent: number | null;
  slabs: NormalizedSlab[];
  fees: NormalizedFee[];
  effective_from: string;
  effective_to: string | null;
};

type OverlapResult = {
  type: "exact" | "similar";
  existing: NormalizedCard;
  reason: string;
};

type RateCardAnalysis = {
  errors: string[];
  overlap: OverlapResult | null;
  normalized: NormalizedCard;
};

type RowStatus = "valid" | "similar" | "duplicate" | "error";

type ParsedUploadRow = {
  rowId: string;
  row: number;
  status: RowStatus;
  message?: string;
  platform_id?: string;
  category_id?: string;
  commission_type?: string;
  effective_from?: string;
  effective_to?: string | null;
  payload?: Payload;
};

type EncodedRow = {
  row: number;
  payload: Payload;
  fileName: string | null;
  uploadedAt: string;
};

type ImportSelection = {
  rowId: string;
  row: number;
  payload: Payload;
};

function dateOnly(value: string) {
  return new Date(new Date(value).toISOString().slice(0, 10));
}

function asDateString(value: string | Date | null | undefined) {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  const str = String(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  return new Date(str).toISOString().slice(0, 10);
}

function toNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const num = Number(value);
  return Number.isNaN(num) ? null : num;
}

function prepareFees(fees: any[]): NormalizedFee[] {
  const normalized: NormalizedFee[] = [];
  for (const fee of fees || []) {
    if (!fee) continue;
    const fee_code = String(fee.fee_code ?? "").trim();
    if (!fee_code) continue;
    const rawType = String(fee.fee_type ?? "percent").trim();
    const fee_type = rawType === "amount" ? "amount" : "percent";
    const fee_value = Number(fee.fee_value ?? 0);
    if (Number.isNaN(fee_value)) continue;
    normalized.push({ fee_code, fee_type, fee_value });
  }
  return normalized.sort(
    (a, b) => a.fee_code.localeCompare(b.fee_code) || a.fee_type.localeCompare(b.fee_type),
  );
}

function prepareSlabs(slabs: any[]): NormalizedSlab[] {
  const normalized: NormalizedSlab[] = [];
  for (const slab of slabs || []) {
    if (!slab) continue;
    const min_price = Number(slab.min_price ?? 0);
    const max_value = slab.max_price ?? slab.maxPrice ?? slab.max_price_value;
    const max_price =
      max_value === null || max_value === undefined || max_value === ""
        ? null
        : Number(max_value);
    const commission_percent = Number(slab.commission_percent ?? slab.commissionPercent ?? 0);
    if (Number.isNaN(min_price) || Number.isNaN(commission_percent)) continue;
    if (Number.isNaN(max_price as number) && max_price !== null) continue;
    normalized.push({
      min_price,
      max_price: max_price === null ? null : Number(max_price),
      commission_percent,
    });
  }
  return normalized.sort((a, b) => a.min_price - b.min_price);
}

function slabsEqual(a: NormalizedSlab[], b: NormalizedSlab[]) {
  if (a.length !== b.length) return false;
  return a.every((slab, idx) => {
    const other = b[idx];
    return (
      Math.abs(slab.min_price - other.min_price) < 1e-6 &&
      (slab.max_price === other.max_price ||
        (slab.max_price === null && other.max_price === null) ||
        (slab.max_price !== null &&
          other.max_price !== null &&
          Math.abs(slab.max_price - other.max_price) < 1e-6)) &&
      Math.abs(slab.commission_percent - other.commission_percent) < 1e-6
    );
  });
}

function feesEqual(a: NormalizedFee[], b: NormalizedFee[]) {
  if (a.length !== b.length) return false;
  return a.every((fee, idx) => {
    const other = b[idx];
    return (
      fee.fee_code === other.fee_code &&
      fee.fee_type === other.fee_type &&
      Math.abs(fee.fee_value - other.fee_value) < 1e-6
    );
  });
}

function buildOverlapReason(card: NormalizedCard, existing: NormalizedCard, type: "exact" | "similar") {
  const range = `${existing.effective_from} → ${existing.effective_to ?? "open"}`;
  const label = type === "exact" ? "exact duplicate" : "overlap";
  return `${label} with ${existing.platform_id}/${existing.category_id} (${range}) [id=${existing.id ?? "existing"}]`;
}

function detectOverlap(card: NormalizedCard, others: NormalizedCard[]): OverlapResult | null {
  const from = dateOnly(card.effective_from);
  const to = card.effective_to ? dateOnly(card.effective_to) : null;

  for (const other of others) {
    if (!other) continue;
    if (card.id && other.id && card.id === other.id) continue;
    if (card.platform_id !== other.platform_id) continue;
    if (card.category_id !== other.category_id) continue;

    const otherFrom = dateOnly(other.effective_from);
    const otherTo = other.effective_to ? dateOnly(other.effective_to) : null;

    const overlaps = (!to || otherFrom <= to) && (!otherTo || from <= otherTo);
    if (!overlaps) continue;

    const sameRange =
      card.effective_from === other.effective_from &&
      ((card.effective_to === null && other.effective_to === null) || card.effective_to === other.effective_to);

    const sameCommission =
      card.commission_type === other.commission_type &&
      (card.commission_type === "flat"
        ? Math.abs((card.commission_percent ?? 0) - (other.commission_percent ?? 0)) < 1e-6
        : slabsEqual(card.slabs, other.slabs));

    const sameFees = feesEqual(card.fees, other.fees);

    if (sameRange && sameCommission && sameFees) {
      return { type: "exact", existing: other, reason: buildOverlapReason(card, other, "exact") };
    }

    return { type: "similar", existing: other, reason: buildOverlapReason(card, other, "similar") };
  }

  return null;
}

async function loadExistingRateCards(client: ReturnType<typeof createClient>): Promise<NormalizedCard[]> {
  try {
    const { data: baseRows, error: baseError } = await client
      .from("rate_cards_v2")
      .select(
        "id, platform_id, category_id, commission_type, commission_percent, effective_from, effective_to",
      );

    if (baseError || !baseRows) {
      console.error("Failed to load base rate cards", baseError);
      return [];
    }

    const { data: feeRows, error: feeError } = await client
      .from("rate_card_fees")
      .select("rate_card_id, fee_code, fee_type, fee_value");

    if (feeError || !feeRows) {
      console.error("Failed to load rate card fees", feeError);
      return baseRows.map((card: any) => ({
        id: card.id,
        platform_id: card.platform_id,
        category_id: card.category_id,
        commission_type: (card.commission_type as "flat" | "tiered") ?? "flat",
        commission_percent:
          card.commission_percent === null || card.commission_percent === undefined
            ? null
            : Number(card.commission_percent),
        slabs: [],
        fees: [],
        effective_from: asDateString(card.effective_from)!,
        effective_to: asDateString(card.effective_to),
      }));
    }

    const { data: slabRows, error: slabError } = await client
      .from("rate_card_slabs")
      .select("rate_card_id, min_price, max_price, commission_percent");

    if (slabError || !slabRows) {
      console.error("Failed to load rate card slabs", slabError);
      return baseRows.map((card: any) => ({
        id: card.id,
        platform_id: card.platform_id,
        category_id: card.category_id,
        commission_type: (card.commission_type as "flat" | "tiered") ?? "flat",
        commission_percent:
          card.commission_percent === null || card.commission_percent === undefined
            ? null
            : Number(card.commission_percent),
        slabs: [],
        fees: prepareFees(
          feeRows
            .filter((row: any) => row.rate_card_id === card.id)
            .map((row: any) => ({
              fee_code: String(row.fee_code ?? ""),
              fee_type: row.fee_type === "amount" ? "amount" : "percent",
              fee_value: Number(row.fee_value ?? 0),
            })),
        ),
        effective_from: asDateString(card.effective_from)!,
        effective_to: asDateString(card.effective_to),
      }));
    }

    const feeMap = new Map<string, NormalizedFee[]>();
    for (const row of feeRows as any[]) {
      const list = feeMap.get(row.rate_card_id) ?? [];
      list.push({
        fee_code: String(row.fee_code ?? ""),
        fee_type: row.fee_type === "amount" ? "amount" : "percent",
        fee_value: Number(row.fee_value ?? 0),
      });
      feeMap.set(row.rate_card_id, list);
    }

    const slabMap = new Map<string, NormalizedSlab[]>();
    for (const row of slabRows as any[]) {
      const list = slabMap.get(row.rate_card_id) ?? [];
      list.push({
        min_price: Number(row.min_price ?? 0),
        max_price: row.max_price === null || row.max_price === undefined ? null : Number(row.max_price),
        commission_percent: Number(row.commission_percent ?? 0),
      });
      slabMap.set(row.rate_card_id, list);
    }

    return (baseRows as any[]).map((card) => ({
      id: card.id,
      platform_id: card.platform_id,
      category_id: card.category_id,
      commission_type: (card.commission_type as "flat" | "tiered") ?? "flat",
      commission_percent:
        card.commission_percent === null || card.commission_percent === undefined
          ? null
          : Number(card.commission_percent),
      slabs: prepareSlabs(slabMap.get(card.id) ?? []),
      fees: prepareFees(feeMap.get(card.id) ?? []),
      effective_from: asDateString(card.effective_from)!,
      effective_to: asDateString(card.effective_to),
    }));
  } catch (error) {
    console.error("Failed to load existing rate cards for validation", error);
    return [];
  }
}

async function analyzeRateCard(
  existingCards: NormalizedCard[],
  body: Payload,
  options?: { additionalCards?: NormalizedCard[]; tempId?: string },
): Promise<RateCardAnalysis> {
  const errors: string[] = [];

  const normalized: NormalizedCard = {
    id: body.id ?? options?.tempId ?? null,
    platform_id: body.platform_id,
    category_id: body.category_id,
    commission_type: body.commission_type,
    commission_percent: body.commission_type === "flat" ? toNumber(body.commission_percent) ?? 0 : null,
    slabs: body.commission_type === "tiered" ? prepareSlabs(body.slabs ?? []) : [],
    fees: prepareFees(body.fees ?? []),
    effective_from: body.effective_from,
    effective_to: body.effective_to ?? null,
  };

  const feeCodes = normalized.fees.map((f) => f.fee_code);
  const dupFee = feeCodes.find((code, idx) => feeCodes.indexOf(code) !== idx);
  if (dupFee) {
    errors.push(`Duplicate fee code "${dupFee}" not allowed.`);
  }

  if (normalized.commission_type === "tiered") {
    if (!normalized.slabs.length) {
      errors.push("Tiered commission requires at least one slab.");
    } else {
      for (let i = 0; i < normalized.slabs.length; i++) {
        const current = normalized.slabs[i];
        if (current.max_price !== null && current.max_price <= current.min_price) {
          errors.push(`Slab ${i + 1}: max_price must be greater than min_price or null for open-ended.`);
        }
        if (i < normalized.slabs.length - 1) {
          const currentMax = current.max_price ?? Number.POSITIVE_INFINITY;
          if (currentMax > normalized.slabs[i + 1].min_price) {
            errors.push(`Slabs overlap between rows ${i + 1} and ${i + 2}.`);
            break;
          }
        }
      }
    }
  }

  const referenceCards = [...existingCards];
  if (options?.additionalCards?.length) {
    referenceCards.push(...options.additionalCards);
  }

  const overlap = detectOverlap(normalized, referenceCards);

  return { errors, overlap, normalized };
}

function splitCsvLine(line: string, expectedColumns?: number): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;
  let structureDepth = 0;

  const cleanLine = line.replace(/\r$/, "");

  for (let i = 0; i < cleanLine.length; i++) {
    const char = cleanLine[i];

    if (char === '"' && structureDepth === 0) {
      if (inQuotes && cleanLine[i + 1] === '"') {
        current += '"';
        i++;
        continue;
      }
      inQuotes = !inQuotes;
      continue;
    }

    if (!inQuotes) {
      if (char === "[" || char === "{") {
        structureDepth++;
      } else if (char === "]" || char === "}") {
        if (structureDepth > 0) {
          structureDepth--;
        }
      } else if (char === "," && structureDepth === 0) {
        cells.push(current.trim());
        current = "";
        continue;
      }
    }

    current += char;
  }

  cells.push(current.trim());

  if (typeof expectedColumns === "number" && expectedColumns > 0) {
    if (cells.length > expectedColumns) {
      const extras = cells.splice(expectedColumns - 1);
      cells[expectedColumns - 1] = [cells[expectedColumns - 1], ...extras].join(",");
    }

    while (cells.length < expectedColumns) {
      cells.push("");
    }
  }

  return cells;
}

function parseCsvLoosely(csvData: string): Record<string, string>[] {
  const lines = csvData.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (!lines.length) {
    return [];
  }

  const headerCells = splitCsvLine(lines[0]);
  if (!headerCells.length) {
    return [];
  }

  headerCells[0] = headerCells[0]?.replace(/^\ufeff/, "");

  const expected = headerCells.length;
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = splitCsvLine(lines[i], expected);
    if (!values.length || values.every((value) => value === "")) {
      continue;
    }

    const row: Record<string, string> = {};
    for (let j = 0; j < expected; j++) {
      const key = headerCells[j] ?? `column_${j}`;
      row[key] = values[j] ?? "";
    }

    rows.push(row);
  }

  return rows;
}

function parseCsvData(csvData: string): Record<string, string>[] {
  try {
    const parsed = parseCsvStrict(csvData, {
      skipFirstRow: false,
      columns: true,
      trimLeadingSpace: true,
    });

    if (Array.isArray(parsed)) {
      return parsed as Record<string, string>[];
    }

    if (parsed && typeof parsed === "object") {
      return Object.values(parsed as Record<string, Record<string, string>>);
    }
  } catch (error) {
    console.warn("Strict CSV parse failed, falling back to lenient parser", error);
  }

  return parseCsvLoosely(csvData);
}

function parseJsonArrayField(raw: unknown, label: string, issues: string[]): any[] {
  if (raw === undefined || raw === null) {
    return [];
  }

  const text = String(raw).trim();
  if (!text.length) {
    return [];
  }

  try {
    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed)) {
      issues.push(`${label} must be a JSON array`);
      return [];
    }
    return parsed;
  } catch (error: any) {
    issues.push(`Failed to parse json for '${label}': ${error?.message ?? "Invalid JSON"}`);
    return [];
  }
}

function getRowValue(row: Record<string, any>, key: string): any {
  if (row[key] !== undefined) {
    return row[key];
  }

  const target = key.toLowerCase();
  for (const candidate of Object.keys(row)) {
    if (candidate.toLowerCase() === target) {
      return row[candidate];
    }
  }

  return undefined;
}

function asTrimmedString(value: any): string {
  if (value === undefined || value === null) {
    return "";
  }
  return String(value).trim();
}

function encodeRowToken(analysisId: string, data: EncodedRow): string {
  const json = JSON.stringify(data);
  const bytes = new TextEncoder().encode(json);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  const base64 = btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return `${analysisId}:${base64}`;
}

function decodeRowToken(rowId: string): { analysisId: string; data: EncodedRow } | null {
  const idx = rowId.indexOf(":");
  if (idx === -1) return null;
  const analysisId = rowId.slice(0, idx);
  let token = rowId.slice(idx + 1);
  if (!token) return null;
  token = token.replace(/-/g, "+").replace(/_/g, "/");
  const pad = token.length % 4;
  if (pad) {
    token += "=".repeat(4 - pad);
  }
  try {
    const binary = atob(token);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const json = new TextDecoder().decode(bytes);
    const data = JSON.parse(json) as EncodedRow;
    if (!data || typeof data !== "object" || typeof data.row !== "number" || !data.payload) {
      return null;
    }
    return { analysisId, data };
  } catch (error) {
    console.error("Failed to decode row token", error);
    return null;
  }
}

async function insertRateCardWithRelations(client: ReturnType<typeof createClient>, payload: Payload) {
  const commissionPercentValue =
    payload.commission_type === "flat" && payload.commission_percent !== undefined && payload.commission_percent !== null
      ? Number(payload.commission_percent)
      : null;

  const gstPercentValue =
    payload.gst_percent === undefined || payload.gst_percent === null
      ? 18
      : Number(payload.gst_percent);

  const tcsPercentValue =
    payload.tcs_percent === undefined || payload.tcs_percent === null
      ? 1
      : Number(payload.tcs_percent);

  const globalMinPriceValue =
    payload.global_min_price === undefined || payload.global_min_price === null
      ? null
      : Number(payload.global_min_price);

  const globalMaxPriceValue =
    payload.global_max_price === undefined || payload.global_max_price === null
      ? null
      : Number(payload.global_max_price);

  const { data, error } = await client
    .from("rate_cards_v2")
    .insert({
      platform_id: payload.platform_id,
      category_id: payload.category_id,
      commission_type: payload.commission_type,
      commission_percent: commissionPercentValue,
      gst_percent: gstPercentValue,
      tcs_percent: tcsPercentValue,
      settlement_basis: payload.settlement_basis,
      t_plus_days: payload.t_plus_days ?? null,
      weekly_weekday: payload.weekly_weekday ?? null,
      bi_weekly_weekday: payload.bi_weekly_weekday ?? null,
      bi_weekly_which: payload.bi_weekly_which ?? null,
      monthly_day: payload.monthly_day ?? null,
      grace_days: payload.grace_days ?? 0,
      effective_from: payload.effective_from,
      effective_to: payload.effective_to ?? null,
      global_min_price: globalMinPriceValue,
      global_max_price: globalMaxPriceValue,
      notes: payload.notes ?? null,
    })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Failed to create rate card");
  }

  const rateCardId = data.id as string;

  if (Array.isArray(payload.slabs) && payload.slabs.length > 0) {
    const slabPayload = payload.slabs.map((s: any) => ({
      rate_card_id: rateCardId,
      min_price: Number(s.min_price ?? 0),
      max_price:
        s.max_price === undefined || s.max_price === null || s.max_price === ""
          ? null
          : Number(s.max_price),
      commission_percent: Number(s.commission_percent ?? 0),
    }));

    const { error: slabError } = await client.from("rate_card_slabs").insert(slabPayload);
    if (slabError) {
      throw new Error(slabError.message ?? "Failed to insert rate card slabs");
    }
  }

  if (Array.isArray(payload.fees) && payload.fees.length > 0) {
    const feePayload = payload.fees.map((f: any) => ({
      rate_card_id: rateCardId,
      fee_code: f.fee_code,
      fee_type: f.fee_type,
      fee_value: Number(f.fee_value ?? 0),
    }));

    const { error: feeError } = await client.from("rate_card_fees").insert(feePayload);
    if (feeError) {
      throw new Error(feeError.message ?? "Failed to insert rate card fees");
    }
  }

  return rateCardId;
}

async function handleParseRequest(req: Request, client: ReturnType<typeof createClient>) {
  try {
    const formData = await req.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return jsonResponse({ message: "No file uploaded" }, 400);
    }

    const csvData = await file.text();
    const records = parseCsvData(csvData);

    const existingCards = await loadExistingRateCards(client);
    const stagedCards: NormalizedCard[] = [];

    const results: ParsedUploadRow[] = [];

    let validCount = 0;
    let similarCount = 0;
    let duplicateCount = 0;
    let errorCount = 0;

    const analysisId = crypto.randomUUID();
    const uploadedAt = new Date().toISOString();
    const fileName = file.name ?? "upload.csv";

    for (let i = 0; i < records.length; i++) {
      const row = records[i] as Record<string, any>;
      const rowNum = i + 2;

      const issues: string[] = [];
      let platformId = "";
      let categoryId = "";
      let commissionType = "";
      let effectiveFrom = "";
      let effectiveTo = "";

      try {
        const slabsKey = getRowValue(row, "slabs_json") !== undefined ? "slabs_json" : "slabs";
        const feesKey = getRowValue(row, "fees_json") !== undefined ? "fees_json" : "fees";

        const slabs = parseJsonArrayField(getRowValue(row, slabsKey), slabsKey, issues);
        const fees = parseJsonArrayField(getRowValue(row, feesKey), feesKey, issues);

        platformId = asTrimmedString(getRowValue(row, "platform_id"));
        categoryId = asTrimmedString(getRowValue(row, "category_id"));
        commissionType = asTrimmedString(getRowValue(row, "commission_type")).toLowerCase();
        const settlementBasis = asTrimmedString(getRowValue(row, "settlement_basis")).toLowerCase();
        effectiveFrom = asTrimmedString(getRowValue(row, "effective_from"));
        effectiveTo = asTrimmedString(getRowValue(row, "effective_to"));
        const commissionPercentRaw = asTrimmedString(getRowValue(row, "commission_percent"));
        const gstPercentRaw = asTrimmedString(getRowValue(row, "gst_percent"));
        const tcsPercentRaw = asTrimmedString(getRowValue(row, "tcs_percent"));
        const tPlusRaw = asTrimmedString(getRowValue(row, "t_plus_days"));
        const weeklyWeekdayRaw = asTrimmedString(getRowValue(row, "weekly_weekday"));
        const biWeeklyWeekdayRaw = asTrimmedString(getRowValue(row, "bi_weekly_weekday"));
        const biWeeklyWhich = asTrimmedString(getRowValue(row, "bi_weekly_which")) || null;
        const monthlyDay = asTrimmedString(getRowValue(row, "monthly_day")) || null;
        const graceDaysRaw = asTrimmedString(getRowValue(row, "grace_days"));
        const globalMinRaw = asTrimmedString(getRowValue(row, "global_min_price"));
        const globalMaxRaw = asTrimmedString(getRowValue(row, "global_max_price"));
        const notesValue = asTrimmedString(getRowValue(row, "notes")) || null;

        const commissionPercentValue = toNumber(commissionPercentRaw);
        const tPlusDaysValue = toNumber(tPlusRaw);
        const weeklyWeekdayValue = toNumber(weeklyWeekdayRaw);
        const biWeeklyWeekdayValue = toNumber(biWeeklyWeekdayRaw);
        const graceDaysValue = toNumber(graceDaysRaw);
        const globalMinValue = toNumber(globalMinRaw);
        const globalMaxValue = toNumber(globalMaxRaw);

        const normalizedCommissionType = commissionType === "tiered" ? "tiered" : "flat";

        const payload: Payload = {
          platform_id: platformId,
          category_id: categoryId,
          commission_type: normalizedCommissionType,
          commission_percent:
            normalizedCommissionType === "flat" && commissionPercentValue !== null
              ? commissionPercentValue
              : null,
          slabs,
          fees,
          effective_from: effectiveFrom,
          effective_to: effectiveTo || null,
          gst_percent: gstPercentRaw || "18",
          tcs_percent: tcsPercentRaw || "1",
          settlement_basis: settlementBasis,
          t_plus_days:
            tPlusDaysValue === null || Number.isNaN(tPlusDaysValue) ? null : Math.trunc(tPlusDaysValue),
          weekly_weekday:
            weeklyWeekdayValue === null || Number.isNaN(weeklyWeekdayValue)
              ? null
              : Math.trunc(weeklyWeekdayValue),
          bi_weekly_weekday:
            biWeeklyWeekdayValue === null || Number.isNaN(biWeeklyWeekdayValue)
              ? null
              : Math.trunc(biWeeklyWeekdayValue),
          bi_weekly_which: biWeeklyWhich,
          monthly_day: monthlyDay,
          grace_days:
            graceDaysValue === null || Number.isNaN(graceDaysValue) ? 0 : Math.trunc(graceDaysValue),
          global_min_price:
            globalMinValue === null || Number.isNaN(globalMinValue) ? null : Number(globalMinValue),
          global_max_price:
            globalMaxValue === null || Number.isNaN(globalMaxValue) ? null : Number(globalMaxValue),
          notes: notesValue,
        };

        if (!payload.platform_id) issues.push("platform_id is required");
        if (!payload.category_id) issues.push("category_id is required");
        if (!commissionType) issues.push("commission_type is required");
        if (commissionType && !["flat", "tiered"].includes(commissionType)) {
          issues.push("commission_type must be 'flat' or 'tiered'");
        }
        if (!payload.settlement_basis) issues.push("settlement_basis is required");
        if (!payload.effective_from) issues.push("effective_from is required");

        const analysis = await analyzeRateCard(existingCards, payload, {
          additionalCards: stagedCards,
          tempId: `pending-${i}`,
        });

        issues.push(...analysis.errors);

        const overlapInfo = analysis.overlap;
        if (overlapInfo && issues.length && !issues.includes(overlapInfo.reason)) {
          issues.push(overlapInfo.reason);
        }

        let status: RowStatus = "valid";
        let message = "Ready to import";

        if (issues.length) {
          status = "error";
          message = issues.join("; ");
          errorCount++;
        } else if (overlapInfo) {
          if (overlapInfo.type === "exact") {
            status = "duplicate";
            message = overlapInfo.reason;
            duplicateCount++;
          } else {
            status = "similar";
            message = overlapInfo.reason;
            similarCount++;
          }
        } else {
          validCount++;
        }

        const rowId = encodeRowToken(analysisId, {
          row: rowNum,
          payload,
          fileName,
          uploadedAt,
        });

        results.push({
          rowId,
          row: rowNum,
          status,
          message,
          platform_id: payload.platform_id,
          category_id: payload.category_id,
          commission_type: payload.commission_type,
          effective_from: payload.effective_from,
          effective_to: payload.effective_to ?? null,
          payload,
        });

        if (status === "valid" || status === "similar") {
          stagedCards.push({ ...analysis.normalized, id: analysis.normalized.id ?? `pending-${i}` });
        }
      } catch (error: any) {
        errorCount++;
        results.push({
          rowId: encodeRowToken(analysisId, {
            row: rowNum,
            payload: {
              platform_id: platformId,
              category_id: categoryId,
              commission_type: (commissionType === "tiered" ? "tiered" : "flat") as "flat" | "tiered",
              commission_percent: null,
              slabs: [],
              fees: [],
              effective_from: effectiveFrom,
              effective_to: effectiveTo || null,
            },
            fileName,
            uploadedAt,
          }),
          row: rowNum,
          status: "error",
          message: error?.message ?? "Unknown error",
          platform_id: platformId,
          category_id: categoryId,
          commission_type: commissionType,
          effective_from: effectiveFrom,
          effective_to: effectiveTo,
        });
      }
    }

    const totalRows = records.length;

    return jsonResponse({
      analysis_id: analysisId,
      file_name: fileName,
      uploaded_at: uploadedAt,
      summary: {
        total: totalRows,
        valid: validCount,
        similar: similarCount,
        duplicate: duplicateCount,
        error: errorCount,
      },
      rows: results.map((row) => ({
        row: row.row,
        row_id: row.rowId,
        status: row.status,
        message: row.message,
        platform_id: row.platform_id,
        category_id: row.category_id,
        commission_type: row.commission_type,
        effective_from: row.effective_from,
        effective_to: row.effective_to,
      })),
    });
  } catch (error: any) {
    console.error("CSV parse error", error);
    return jsonResponse(
      {
        message: "Failed to process CSV file",
        error: error?.message ?? "Unknown error",
      },
      500,
    );
  }
}

async function handleImportRequest(req: Request, client: ReturnType<typeof createClient>) {
  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return jsonResponse({ message: "Invalid request body" }, 400);
    }

    const analysisId = typeof body.analysis_id === "string" ? body.analysis_id : "";
    const includeSimilar = body.include_similar === true;
    const rowIds = Array.isArray(body.row_ids) ? (body.row_ids as string[]) : [];

    if (!analysisId) {
      return jsonResponse({ message: "Missing analysis_id. Upload the CSV again." }, 400);
    }

    if (!rowIds.length) {
      return jsonResponse({ message: "No rows provided for import" }, 400);
    }

    const decoded: ImportSelection[] = [];
    let fileName: string | null = null;
    let uploadedAt: string | null = null;

    const seen = new Set<string>();
    for (const rowId of rowIds) {
      if (typeof rowId !== "string" || seen.has(rowId)) continue;
      const decodedToken = decodeRowToken(rowId);
      if (!decodedToken || decodedToken.analysisId !== analysisId) {
        continue;
      }
      seen.add(rowId);
      if (!fileName && decodedToken.data.fileName) {
        fileName = decodedToken.data.fileName;
      }
      if (!uploadedAt && decodedToken.data.uploadedAt) {
        uploadedAt = decodedToken.data.uploadedAt;
      }
      decoded.push({ rowId, row: decodedToken.data.row, payload: decodedToken.data.payload });
    }

    if (!decoded.length) {
      return jsonResponse({ message: "Selected rows were not found. Upload the CSV again." }, 400);
    }

    const existingCards = await loadExistingRateCards(client);
    const staged: NormalizedCard[] = [];

    const results: Array<{ rowId: string; row: number; status: "imported" | "skipped"; id?: string; message?: string }>
      = [];

    for (let i = 0; i < decoded.length; i++) {
      const entry = decoded[i];
      const payload = entry.payload;

      if (!payload || !payload.platform_id || !payload.category_id) {
        results.push({
          rowId: entry.rowId,
          row: entry.row,
          status: "skipped",
          message: "Missing payload for row",
        });
        continue;
      }

      try {
        const analysis = await analyzeRateCard(existingCards, payload, {
          additionalCards: staged,
          tempId: `confirm-${i}`,
        });

        const issues = [...analysis.errors];
        const overlap = analysis.overlap;
        let isSimilar = false;

        if (overlap) {
          if (overlap.type === "exact") {
            issues.push(overlap.reason);
          } else {
            isSimilar = true;
            if (!includeSimilar) {
              issues.push(overlap.reason);
            }
          }
        }

        if (issues.length) {
          results.push({
            rowId: entry.rowId,
            row: entry.row,
            status: "skipped",
            message: issues.join("; "),
          });
          continue;
        }

        if (isSimilar && !includeSimilar) {
          results.push({
            rowId: entry.rowId,
            row: entry.row,
            status: "skipped",
            message: "Similar rows require confirmation",
          });
          continue;
        }

        const newId = await insertRateCardWithRelations(client, payload);
        results.push({ rowId: entry.rowId, row: entry.row, status: "imported", id: newId });

        const normalized = { ...analysis.normalized, id: newId };
        staged.push(normalized);
        existingCards.push(normalized);
      } catch (error: any) {
        results.push({
          rowId: entry.rowId,
          row: entry.row,
          status: "skipped",
          message: error?.message ?? "Failed to import row",
        });
      }
    }

    const inserted = results.filter((r) => r.status === "imported").length;
    const skipped = results.length - inserted;

    return jsonResponse({
      analysis_id: analysisId,
      file_name: fileName ?? undefined,
      uploaded_at: uploadedAt ?? new Date().toISOString(),
      summary: {
        inserted,
        skipped,
      },
      results: results.map((r) => ({
        row_id: r.rowId,
        row: r.row,
        status: r.status,
        id: r.id,
        message: r.message,
      })),
    });
  } catch (error: any) {
    console.error("CSV import error", error);
    return jsonResponse(
      {
        message: "Failed to import rate cards",
        error: error?.message ?? "Unknown error",
      },
      500,
    );
  }
}

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Supabase environment variables are not configured");
}

const client = supabaseUrl && supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  : null;

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (!client) {
    return jsonResponse({ message: "Supabase client not configured" }, 500);
  }

  const url = new URL(req.url);
  const pathname = url.pathname.replace(/\/+$/, "");

  if (req.method === "POST" && pathname.endsWith("/parse")) {
    return await handleParseRequest(req, client);
  }

  if (req.method === "POST" && pathname.endsWith("/import")) {
    return await handleImportRequest(req, client);
  }

  return jsonResponse({ message: "Not found" }, 404);
});
