import { createClient } from "https://esm.sh/@supabase/supabase-js@2.43.1";
import normalizeHeaders from "../../../server/src/utils/rateCardHeaders.ts";
import {
  RateCardPayload,
  analyzeRateCard,
  insertRateCardWithRelations,
  loadExistingRateCards,
  humanizeErrorMessage,
  formatLabel,
  formatDateRange,
} from "../_shared/rateCards.ts";

type RowStatus = "valid" | "similar" | "duplicate" | "error";

interface ParsedRow {
  row: number;
  row_id: string;
  status: RowStatus;
  message: string;
  tooltip?: string;
  existing?: {
    id: string;
    label: string;
    date_range: string;
  };
  archivedMatch?: {
    id: string;
    label: string;
    date_range: string;
    type: "exact" | "overlap";
  };
  suggestions?: Array<
    | { type: "shift_from"; new_from: string; reason: string }
    | { type: "clip_to"; new_to: string; reason: string }
    | { type: "skip"; reason: string }
  >;
  platform_id?: string;
  category_id?: string;
  commission_type?: string;
  effective_from?: string;
  effective_to?: string | null;
  payload?: RateCardPayload;
}

interface ParseResponse {
  analysis_id: string;
  file_name?: string;
  uploaded_at: string;
  summary: {
    total: number;
    valid: number;
    similar: number;
    duplicate: number;
    error: number;
  };
  rows: ParsedRow[];
}

interface ParseRowResponse {
  status: RowStatus;
  message: string;
  tooltip?: string;
  normalized?: RateCardPayload;
  overlap?: {
    type: "exact" | "similar";
    reason: string;
  };
  archivedMatch?: {
    id: string;
    label: string;
    date_range: string;
    type: "exact" | "overlap";
  };
}

interface ImportRowRequest {
  row_id: string;
  row: number;
  status: RowStatus;
  payload?: RateCardPayload;
}

interface ImportResponse {
  analysis_id: string;
  file_name?: string;
  uploaded_at: string;
  summary: {
    inserted: number;
    skipped: number;
  };
  results: Array<{
    row_id: string;
    row: number;
    status: "imported" | "skipped";
    id?: string;
    message?: string;
  }>;
}

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
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
  console.warn("rate-cards-import function missing Supabase credentials. Requests will fail.");
}

const EXPECTED_HEADERS = [
  { display: "Marketplace", key: "marketplace" },
  { display: "Category", key: "category" },
  { display: "Commission Type", key: "commission type" },
  { display: "Commission %", key: "commission %" },
  { display: "Tech Fee ₹", key: "tech fee" },
  { display: "Logistics Fee ₹", key: "logistics fee" },
  { display: "Storage Fee ₹", key: "storage fee" },
  { display: "Return Logistics Fee ₹", key: "return logistics fee" },
  { display: "GST %", key: "gst" },
  { display: "TCS %", key: "tcs" },
  { display: "Settlement Cycle (Days)", key: "settlement cycle days" },
];

const EXPECTED_TIERED_HEADERS = [
  { display: "Marketplace", key: "marketplace" },
  { display: "Category", key: "category" },
  { display: "Commission Type", key: "commission type" },
  { display: "Min Price ₹", key: "min price" },
  { display: "Max Price ₹", key: "max price" },
  { display: "Commission % (Tier)", key: "commission % tier" },
];

const HEADER_ALIASES: Record<string, string[]> = {
  commission: ["commission percent"],
  "commission type": ["type"],
  "tech fee": ["technology fee"],
  "logistics fee": ["logistics"],
  "storage fee": ["storage"],
  "return logistics fee": ["return fee", "reverse logistics fee"],
  gst: ["gst tax"],
  tcs: ["tax collected at source"],
  "settlement cycle days": [
    "settlement days",
    "settlement cycle",
    "settlement",
    "t days",
    "t plus days",
    "t+ days",
    "t+days",
  ],
  "min price": ["slab min price", "minimum price"],
  "max price": ["slab max price", "maximum price"],
  "commission % tier": ["commission tier", "commission percent tier", "tier commission"],
};

function splitCsvLine(line: string) {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      cells.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  cells.push(current);
  return cells.map((cell) => cell.trim());
}

function canonicalizeHeader(value: string) {
  return value
    .replace(/\ufeff/g, "")
    .toLowerCase()
    .replace(/\+/g, " plus ")
    .replace(/[₹%()\/+.,_-]/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function findMissingHeaders(
  expected: Array<{ display: string; key: string }>,
  accepted: Map<string, string>,
  uploaded: string[]
) {
  const missing: string[] = [];
  for (const header of expected) {
    const canonical = accepted.get(header.key);
    if (!canonical) {
      missing.push(header.display);
      continue;
    }
    if (!uploaded.includes(canonical)) {
      missing.push(header.display);
    }
  }
  return missing;
}

function parseCsvRows(text: string) {
  const rows: string[][] = [];
  const sanitized = text.replace(/\r/g, "");
  let cell = "";
  let row: string[] = [];
  let inQuotes = false;

  for (let i = 0; i < sanitized.length; i += 1) {
    const char = sanitized[i];
    if (char === '"') {
      if (inQuotes && sanitized[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      row.push(cell);
      cell = "";
    } else if (char === "\n" && !inQuotes) {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  return rows
    .map((cols) => cols.map((col) => col.replace(/^\ufeff/, "")))
    .filter((cols) => cols.some((col) => col && col.trim().length > 0));
}

function parseCsvText(text: string) {
  const rows = parseCsvRows(text);
  if (!rows.length) return [] as Record<string, string>[];
  const [headerRow, ...dataRows] = rows;
  const headers = headerRow.map((header, idx) => header || `column_${idx}`);
  return dataRows.map((row) => {
    const record: Record<string, string> = {};
    headers.forEach((header, idx) => {
      record[header] = row[idx] ?? "";
    });
    return record;
  });
}

function cleanNumber(value: any): number {
  if (value === null || value === undefined) return Number.NaN;
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : Number.NaN;
  }
  const cleaned = String(value).replace(/[%₹$€£,\s]/g, "");
  if (!cleaned.length) return Number.NaN;
  if (!/^[-+]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(cleaned)) return Number.NaN;
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : Number.NaN;
}

function parsePercent(value: any): number {
  if (value === null || value === undefined || String(value).trim() === "") {
    return Number.NaN;
  }
  return cleanNumber(value);
}

function parseAmount(value: any): number {
  if (value === null || value === undefined || String(value).trim() === "") {
    return Number.NaN;
  }
  return cleanNumber(value);
}

function excelSerialToISO(n: number): string | null {
  if (!Number.isFinite(n)) return null;
  const epoch = new Date(Date.UTC(1899, 11, 30));
  const millis = epoch.getTime() + n * 86400000;
  const d = new Date(millis);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function parseDateToISO(value: any): string | null {
  if (value === null || value === undefined || value === "") return null;
  const raw = String(value).trim();
  if (!raw) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;

  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(raw)) {
    const [partA, partB, partC] = raw.split("/");
    const year = Number(partC);
    const tryFormat = (month: string, day: string, yearStr: string) => {
      const date = new Date(`${yearStr.padStart(4, "0")}-${month.padStart(2, "0")}-${day.padStart(2, "0")}T00:00:00Z`);
      if (!Number.isNaN(date.getTime())) {
        return date.toISOString().slice(0, 10);
      }
      return null;
    };
    return tryFormat(partB, partA, partC) ?? tryFormat(partA, partB, partC);
  }

  const numeric = Number(raw);
  if (Number.isFinite(numeric)) {
    const excel = excelSerialToISO(numeric);
    if (excel) return excel;
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}

function asTrimmedString(value: unknown) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function formatNumber(value: number | null | undefined) {
  if (value === null || value === undefined) return "0";
  if (!Number.isFinite(value)) return String(value);
  const trimmed = Number(value.toFixed(6));
  return trimmed % 1 === 0 ? `${trimmed.toFixed(0)}` : `${trimmed}`;
}

function describeFees(fees: { fee_code: string; fee_type: string; fee_value: number }[]) {
  if (!fees.length) return "";
  return fees
    .map((fee) => {
      const suffix = fee.fee_type === "percent" ? "%" : "";
      return `${fee.fee_code} ${formatNumber(fee.fee_value)}${suffix}`;
    })
    .join(", ");
}

function commissionDesc(card: any) {
  const feesText = describeFees(card.fees ?? []);
  if (card.commission_type === "tiered") {
    const snippets = (card.slabs ?? []).slice(0, 3).map((slab: any) => {
      const toLabel = slab.max_price === null ? "open" : formatNumber(slab.max_price);
      return `${formatNumber(slab.min_price)}-${toLabel}: ${formatNumber(slab.commission_percent)}%`;
    });
    const extra = (card.slabs ?? []).length > 3 ? ", …" : "";
    const summary = snippets.length ? `; ${snippets.join(", ")}${extra}` : "";
    const feeSummary = feesText ? `; Fees: ${feesText}` : "";
    return `Tiered commission (${(card.slabs ?? []).length} slab${(card.slabs ?? []).length === 1 ? "" : "s"})${summary}${feeSummary}`;
  }

  const pct = formatNumber(card.commission_percent ?? 0);
  const feeSummary = feesText ? `; Fees: ${feesText}` : "";
  return `Flat ${pct}% commission${feeSummary}`;
}

function buildSimilarSummary(newCard: any, existing: any) {
  const identicalRange =
    newCard.effective_from === existing.effective_from &&
    ((newCard.effective_to ?? null) === (existing.effective_to ?? null));
  const sameCommission =
    newCard.commission_type === existing.commission_type &&
    (newCard.commission_type === "flat"
      ? Math.abs((newCard.commission_percent ?? 0) - (existing.commission_percent ?? 0)) < 1e-6
      : JSON.stringify(newCard.slabs) === JSON.stringify(existing.slabs));
  const sameFees = JSON.stringify(newCard.fees) === JSON.stringify(existing.fees);

  const differences: string[] = [];
  if (!sameCommission) differences.push("different commission");
  if (!sameFees) differences.push("different fees");

  if (identicalRange && !differences.length) {
    return "Date overlap";
  }

  if (!differences.length) {
    return "Date overlap";
  }

  if (differences.length === 1) {
    return `Date overlap with ${differences[0]}`;
  }

  return `Date overlap with ${differences.join(" and ")}`;
}

function buildSimilarSuggestions(newCard: any, existing: any) {
  if (!existing.effective_to) return undefined;
  const existingEnd = parseDateToISO(existing.effective_to);
  const newStart = parseDateToISO(newCard.effective_from);
  if (!existingEnd || !newStart) return undefined;
  if (newStart > existingEnd) return undefined;
  const shiftTo = new Date(existingEnd);
  shiftTo.setUTCDate(shiftTo.getUTCDate() + 1);
  const newFrom = shiftTo.toISOString().slice(0, 10);
  const dateLabel = formatDisplayDate(newFrom) ?? newFrom;
  return [
    {
      type: "shift_from",
      new_from: newFrom,
      reason: `Shift start date to ${dateLabel} to avoid overlap.`,
    } as const,
  ];
}

function asNumber(value: unknown, fallback: number | null = null) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function getRowValue(row: Record<string, any>, key: string) {
  if (row[key] !== undefined) return row[key];
  if (row[key.toLowerCase()] !== undefined) return row[key.toLowerCase()];
  return undefined;
}

function parseJsonArrayField(value: unknown, label: string, issues: string[]) {
  if (Array.isArray(value)) return value;
  if (value && typeof value === "object") {
    return [value];
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      issues.push(`${label}: expected JSON array`);
    }
  }
  return [];
}

function extractSlabs(row: Record<string, any>) {
  const candidates: any[] = [];
  const possibleKeys = ["slabs", "slabsJson", "slabs_json", "payload", "payload.slabs"];

  for (const key of possibleKeys) {
    if (key === "payload") {
      const payload = row.payload;
      if (payload && typeof payload === "object" && Array.isArray((payload as any).slabs)) {
        candidates.push(...((payload as any).slabs as any[]));
      }
      continue;
    }
    if (key === "payload.slabs") {
      const payload = row.payload;
      if (payload && typeof payload === "object" && Array.isArray((payload as any).slabs)) {
        candidates.push(...((payload as any).slabs as any[]));
      }
      continue;
    }
    const value = row[key];
    if (!value) continue;
    if (Array.isArray(value)) {
      candidates.push(...value);
    } else if (typeof value === "string") {
      try {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed)) candidates.push(...parsed);
      } catch {
        // ignore parse error
      }
    }
  }

  return candidates
    .map((slab) => {
      if (!slab || typeof slab !== "object") return null;
      const minRaw = (slab as any).min_price ?? (slab as any).minPrice ?? (slab as any)["min price"];
      const maxRaw = (slab as any).max_price ?? (slab as any).maxPrice ?? (slab as any)["max price"];
      const commissionRaw =
        (slab as any).commission_percent ??
        (slab as any).commissionPercent ??
        (slab as any)["commission %"];

      const min = parseAmount(minRaw);
      const max = parseAmount(maxRaw);
      const pct = parsePercent(commissionRaw);

      return {
        min_price: Number.isFinite(min) ? Number(min) : null,
        max_price: Number.isFinite(max) ? Number(max) : null,
        commission_percent: Number.isFinite(pct) ? Number(pct) : null,
      };
    })
    .filter(Boolean) as Array<{
    min_price: number | null;
    max_price: number | null;
    commission_percent: number | null;
  }>;
}

function buildTemplateCsv(type: "flat" | "tiered") {
  if (type === "tiered") {
    const headers = [
      "Marketplace",
      "Category",
      "Commission Type",
      "Min Price",
      "Max Price",
      "Commission %",
      "Effective From",
      "Effective To",
      "GST %",
      "TCS %",
      "Settlement Basis",
      "T+ Days",
      "Settlement Cycle (Days)",
      "Grace Days",
      "Storage Fee",
      "Logistics Fee",
      "Tech Fee",
      "Return Fee",
      "Dispute Term (Days)",
      "Notes",
    ];
    const rows = [
      [
        "Flipkart",
        "Electronics",
        "Tiered",
        "0",
        "1000",
        "10",
        "2025-01-01",
        "2025-03-31",
        "18",
        "1",
        "T+Days",
        "7",
        "7",
        "2",
        "0",
        "25",
        "2",
        "3",
        "15",
        "Sample tiered card",
      ],
      [
        "Flipkart",
        "Electronics",
        "Tiered",
        "1001",
        "5000",
        "8",
        "2025-01-01",
        "2025-03-31",
        "18",
        "1",
        "T+Days",
        "7",
        "7",
        "2",
        "0",
        "25",
        "2",
        "3",
        "15",
        "Sample tiered card",
      ],
    ];
    const body = [headers, ...rows]
      .map((row) => row.map((cell) => (/[",\r\n]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell)).join(","))
      .join("\r\n")
      .concat("\r\n");
    return { filename: "rate-card-template-tiered.csv", csv: body };
  }

  const headers = [
    "Marketplace",
    "Category",
    "Commission Type",
    "Effective From",
    "Effective To",
    "GST %",
    "TCS %",
    "Settlement Basis",
    "T+ Days",
    "Settlement Cycle (Days)",
    "Grace Days",
    "Notes",
    "Commission %",
    "Storage Fee",
    "Logistics Fee",
    "Tech Fee",
    "Return Fee",
    "Dispute Term (Days)",
  ];
  const rows = [
    [
      "Amazon",
      "Apparel",
      "Flat",
      "2025-01-01",
      "2025-03-31",
      "18",
      "1",
      "T+Days",
      "7",
      "7",
      "2",
      "Seasonal offer",
      "10",
      "0",
      "0",
      "2",
      "3",
      "15",
    ],
  ];
  const body = [headers, ...rows]
    .map((row) => row.map((cell) => (/[",\r\n]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell)).join(","))
    .join("\r\n")
    .concat("\r\n");

  return { filename: "rate-card-template-flat.csv", csv: body };
}

function templateResponse(typeParam: string | null) {
  const type = typeParam === "tiered" ? "tiered" : "flat";
  const { filename, csv } = buildTemplateCsv(type);
  return new Response(csv, {
    headers: {
      ...corsHeaders,
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

function validateUploadRows(rows: any[]): { summary: ParseResponse["summary"]; results: ParsedRow[] } {
  const acceptedFlatCanon = new Map(EXPECTED_HEADERS.map((item) => [item.key, canonicalizeHeader(item.key)]));
  const acceptedTieredCanon = new Map(EXPECTED_TIERED_HEADERS.map((item) => [item.key, canonicalizeHeader(item.key)]));

  const results = rows.map((rawRow: any, index: number) => {
    const normalized = normalizeHeaders(rawRow ?? {});
    if (rawRow && typeof rawRow === "object" && rawRow.payload) {
      Object.assign(normalized, normalizeHeaders(rawRow.payload));
    }

    const errors: string[] = [];

    const platform = asTrimmedString(
      normalized.platform ??
        normalized.marketplace ??
        normalized.platform_id ??
        normalized["platform id"]
    );
    if (!platform) errors.push("Missing marketplace/platform");

    const category = asTrimmedString(
      normalized.category ?? normalized.category_id ?? normalized["category id"]
    );
    if (!category) errors.push("Missing category");

    const validFrom =
      normalized.validFrom ?? normalized.valid_from ?? normalized.effective_from ?? normalized.date_from;
    if (!validFrom) errors.push("Missing 'Valid From' date");

    const validTo =
      normalized.validTo ?? normalized.valid_to ?? normalized.effective_to ?? normalized.date_to;
    if (!validTo) errors.push("Missing 'Valid To' date");

    const typeRaw =
      normalized.type ??
      normalized.commission_type ??
      normalized["commission type"] ??
      normalized["commission_type"];
    const type = (typeRaw || "").toLowerCase();

    if (type === "tiered") {
      const slabs = extractSlabs({ ...normalized, payload: rawRow?.payload });
      const hasValidSlab = slabs.some(
        (slab) =>
          slab &&
          (Number.isFinite(slab.min_price) || Number.isFinite(slab.max_price)) &&
          Number.isFinite(slab.commission_percent)
      );
      if (!hasValidSlab) {
        errors.push("Tiered commission requires at least one slab (Min/Max/Commission %)");
      }
    }

    const commissionValue =
      normalized.commission ??
      normalized.commission_percent ??
      normalized["commission percent"] ??
      normalized["commission %"];
    if (type !== "tiered" && !commissionValue) {
      errors.push("Commission percentage missing");
    }

    return {
      row: Number(rawRow?.row ?? index + 1),
      row_id: `${crypto.randomUUID()}:${index + 1}`,
      status: errors.length ? ("error" as RowStatus) : ("valid" as RowStatus),
      message: errors.length ? errors.map(humanizeErrorMessage).join("; ") : "Valid row",
      platform_id: platform,
      category_id: category,
      commission_type: typeRaw,
      effective_from: validFrom,
      effective_to: validTo,
      payload: rawRow?.payload,
      tooltip: errors.length ? errors.join("; ") : undefined,
    };
  });

  const summary = {
    total: results.length,
    valid: results.filter((row) => row.status === "valid").length,
    similar: 0,
    duplicate: 0,
    error: results.filter((row) => row.status === "error").length,
  };

  return { summary, results };
}

async function parseCsvUpload(client: ReturnType<typeof createClient>, csvText: string, filename: string) {
  const records = parseCsvText(csvText);
  const normalizedRecords = records.map((record) => normalizeHeaders(record ?? {}));

  const aggregatedRecords: Array<{ row: Record<string, any>; index: number }> = normalizedRecords.map(
    (row, idx) => ({ row, index: idx })
  );

  const existingCards = await loadExistingRateCards(client);
  const stagedCards: NormalizedCard[] = [];
  const results: ParsedRow[] = [];

  let validCount = 0;
  let similarCount = 0;
  let duplicateCount = 0;
  let errorCount = 0;

  for (let i = 0; i < aggregatedRecords.length; i++) {
    const row = aggregatedRecords[i].row;
    const rowNum = aggregatedRecords[i].index + 2;

    const issues: { message: string; tooltip?: string }[] = [];
    let platformId = "";
    let categoryId = "";
    let commissionType = "";
    let effectiveFrom = "";
    let effectiveTo = "";

    try {
      const slabs = extractSlabs(row);
      const fees = parseJsonArrayField(row.fees ?? row.fees_json, "fees", []);

      platformId = asTrimmedString(row.platform ?? row.marketplace ?? row.platform_id ?? row.platformid);
      categoryId = asTrimmedString(row.category ?? row.category_id ?? row.categoryid);
      const commissionTypeRaw = row.commission_type ?? row["commission type"] ?? row.type;
      commissionType = asTrimmedString(commissionTypeRaw);
      const settlementBasis = asTrimmedString(row.settlement_basis ?? row["settlement basis"]);

      const effectiveFromISO = parseDateToISO(row.effective_from ?? row.valid_from ?? row.date_from);
      if (!effectiveFromISO) {
        issues.push({
          message: "invalid date",
          tooltip: `Column: Effective From (value: '${row.effective_from ?? row.valid_from ?? ""}'). Use YYYY-MM-DD.`,
        });
      }

      const effectiveToISO = parseDateToISO(row.effective_to ?? row.valid_to ?? row.date_to);
      if (row.effective_to && !effectiveToISO) {
        issues.push({
          message: "invalid date",
          tooltip: `Column: Effective To (value: '${row.effective_to}'). Use YYYY-MM-DD.`,
        });
      }

      const commissionPercentRaw = asTrimmedString(row.commission_percent ?? row.commission);
      const gstPercentRaw = asTrimmedString(row.gst_percent ?? row.gst);
      const tcsPercentRaw = asTrimmedString(row.tcs_percent ?? row.tcs);

      const logisticsFeeRaw = asTrimmedString(row.logistics_fee);
      const storageFeeRaw = asTrimmedString(row.storage_fee);
      const returnLogisticsFeeRaw = asTrimmedString(row.return_logistics_fee);
      const techFeeRaw = asTrimmedString(row.tech_fee);

      const settlementCycleRaw = asTrimmedString(row.settlement_cycle_days);
      const tPlusRaw = asTrimmedString(row.t_plus_days);
      const weeklyWeekdayRaw = asTrimmedString(row.weekly_weekday);
      const biWeeklyWeekdayRaw = asTrimmedString(row.bi_weekly_weekday);
      const biWeeklyWhich = asTrimmedString(row.bi_weekly_which) || null;
      const monthlyDay = asTrimmedString(row.monthly_day) || null;
      const graceDaysRaw = asTrimmedString(row.grace_days);
      const globalMinRaw = asTrimmedString(row.global_min_price ?? row.min_price);
      const globalMaxRaw = asTrimmedString(row.global_max_price ?? row.max_price);
      const notesValue = asTrimmedString(row.notes) || null;

      const normalizedCommissionTypeRaw = commissionType.toLowerCase();
      const allowedTypes: Array<"flat" | "tiered"> = ["flat", "tiered"];
      const normalizedType = allowedTypes.find((type) => type === normalizedCommissionTypeRaw) ?? null;

      if (!normalizedType) {
        issues.push({
          message: normalizedCommissionTypeRaw ? `Unknown type: '${commissionType}' (use flat or tiered).` : "commission_type is required",
        });
      }

      const commissionPercentValue = parsePercent(commissionPercentRaw);
      if (normalizedType === "flat" && !Number.isFinite(commissionPercentValue)) {
        issues.push({ message: "invalid number", tooltip: `Column: Commission % (value: '${commissionPercentRaw}'). Use numbers only.` });
      }

      const gstPercentValue = parsePercent(gstPercentRaw || "18");
      if (gstPercentRaw && !Number.isFinite(gstPercentValue)) {
        issues.push({ message: "invalid number", tooltip: `Column: GST % (value: '${gstPercentRaw}'). Use numbers only.` });
      }

      const tcsPercentValue = parsePercent(tcsPercentRaw || "1");
      if (tcsPercentRaw && !Number.isFinite(tcsPercentValue)) {
        issues.push({ message: "invalid number", tooltip: `Column: TCS % (value: '${tcsPercentRaw}'). Use numbers only.` });
      }

      const settlementCycleValue = parseAmount(settlementCycleRaw);
      if (settlementCycleRaw && !Number.isFinite(settlementCycleValue)) {
        issues.push({ message: "invalid number", tooltip: `Column: Settlement Cycle (Days) (value: '${settlementCycleRaw}'). Use numbers only.` });
      }

      const tPlusDaysValue = toNumber(tPlusRaw);
      const weeklyWeekdayValue = toNumber(weeklyWeekdayRaw);
      const biWeeklyWeekdayValue = toNumber(biWeeklyWeekdayRaw);
      const graceDaysValue = toNumber(graceDaysRaw);
      const globalMinValue = toNumber(globalMinRaw);
      const globalMaxValue = toNumber(globalMaxRaw);

      if (!platformId) issues.push({ message: "platform_id is required" });
      if (!categoryId) issues.push({ message: "category_id is required" });
      if (!settlementBasis) issues.push({ message: "settlement_basis is required" });
      if (!effectiveFromISO) issues.push({ message: "effective_from is required" });

      if (issues.length) {
        errorCount++;
        results.push({
          row: rowNum,
          row_id: `${crypto.randomUUID()}:${i}`,
          status: "error",
          message: issues.map((issue) => humanizeErrorMessage(issue.message)).join("; "),
          tooltip: issues.map((issue) => issue.tooltip).filter(Boolean).join(" | ") || undefined,
          platform_id: platformId,
          category_id: categoryId,
          commission_type: normalizedType ?? commissionType,
          effective_from: effectiveFromISO ?? "",
          effective_to: effectiveToISO ?? (row.effective_to ? String(row.effective_to) : null),
        });
        continue;
      }

      const payload: RateCardPayload = {
        platform_id: platformId,
        category_id: categoryId,
        commission_type: (normalizedType ?? "flat") as "flat" | "tiered",
        commission_percent:
          normalizedType === "flat" && Number.isFinite(commissionPercentValue)
            ? Number(commissionPercentValue)
            : null,
        slabs: normalizedType === "tiered"
          ? slabs
              .filter((slab) => Number.isFinite(slab.min_price) || Number.isFinite(slab.max_price))
              .map((slab) => ({
                min_price: Number.isFinite(slab.min_price) ? Number(slab.min_price) : 0,
                max_price: Number.isFinite(slab.max_price) ? Number(slab.max_price) : null,
                commission_percent: Number.isFinite(slab.commission_percent)
                  ? Number(slab.commission_percent)
                  : 0,
              }))
          : [],
        fees: fees
          .filter((fee) => fee && typeof fee === "object")
          .map((fee: any) => ({
            fee_code: asTrimmedString(fee.fee_code ?? fee.code ?? ""),
            fee_type: (fee.fee_type ?? fee.type ?? "percent") === "amount" ? "amount" : "percent",
            fee_value: Number(fee.fee_value ?? fee.value ?? 0),
          }))
          .filter((fee: any) => fee.fee_code),
        effective_from: effectiveFromISO!,
        effective_to: effectiveToISO ?? null,
        gst_percent: Number.isFinite(gstPercentValue) ? Number(gstPercentValue) : 18,
        tcs_percent: Number.isFinite(tcsPercentValue) ? Number(tcsPercentValue) : 1,
        settlement_basis: settlementBasis.toLowerCase(),
        t_plus_days: Number.isFinite(tPlusDaysValue) ? Number(tPlusDaysValue) : null,
        weekly_weekday: Number.isFinite(weeklyWeekdayValue) ? Number(weeklyWeekdayValue) : null,
        bi_weekly_weekday: Number.isFinite(biWeeklyWeekdayValue) ? Number(biWeeklyWeekdayValue) : null,
        bi_weekly_which: biWeeklyWhich,
        monthly_day: monthlyDay,
        grace_days: Number.isFinite(graceDaysValue) ? Number(graceDaysValue) : 0,
        global_min_price: Number.isFinite(globalMinValue) ? Number(globalMinValue) : null,
        global_max_price: Number.isFinite(globalMaxValue) ? Number(globalMaxValue) : null,
        notes: notesValue,
      };

      const analysis = await analyzeRateCard(client, payload, {
        existingCards,
        additionalCards: stagedCards,
        tempId: `pending-${i}`,
      });

      let status: RowStatus = "valid";
      let message = "Ready to import.";
      let tooltip: string | undefined;
      let existingMeta:
        | {
            id: string;
            label: string;
            date_range: string;
          }
        | undefined;
      let suggestions: ParsedRow["suggestions"];
      let archivedMatchMeta: ParsedRow["archivedMatch"];

      if (analysis.errors.length) {
        errorCount++;
        results.push({
          row: rowNum,
          row_id: `${crypto.randomUUID()}:${i}`,
          status: "error",
          message: analysis.errors.map(humanizeErrorMessage).join("; "),
          tooltip,
          platform_id: platformId,
          category_id: categoryId,
          commission_type: payload.commission_type,
          effective_from: payload.effective_from,
          effective_to: payload.effective_to ?? null,
        });
        continue;
      }

      if (analysis.archivedMatch) {
        const existingCard = analysis.archivedMatch.existing;
        archivedMatchMeta = {
          id: existingCard.id ?? "",
          label: formatLabel(existingCard.platform_id, existingCard.category_id),
          date_range: formatDateRange(existingCard.effective_from, existingCard.effective_to),
          type: analysis.archivedMatch.type === "exact" ? "exact" : "overlap",
        };
        tooltip = `Archived match (${archivedMatchMeta.type}): ${archivedMatchMeta.label} (${archivedMatchMeta.date_range}). Archived cards don't affect reconciliation.`;
        validCount++;
      } else if (analysis.overlap) {
        const existing = analysis.overlap.existing;
        existingMeta = {
          id: existing.id ?? "",
          label: formatLabel(existing.platform_id, existing.category_id),
          date_range: formatDateRange(existing.effective_from, existing.effective_to),
        };

        if (analysis.overlap.type === "exact") {
          status = "duplicate";
          message = `Exact duplicate of ${existingMeta.label} (${existingMeta.date_range}). Remove or edit this row.`;
          tooltip = "Same date range, commission and fees.";
          duplicateCount++;
        } else {
          status = "similar";
          message = `Overlaps existing ${existingMeta.label} (${existingMeta.date_range}). Adjust dates or confirm import.`;
          tooltip = `${buildSimilarSummary(analysis.normalized, existing)}. Your row: ${commissionDesc(analysis.normalized)}. Existing: ${commissionDesc(existing)}.`;
          suggestions = buildSimilarSuggestions(analysis.normalized, existing);
          similarCount++;
        }
      } else {
        validCount++;
      }

      const rowId = `${crypto.randomUUID()}:${i + 1}`;

      results.push({
        row: rowNum,
        row_id: rowId,
        status,
        message,
        tooltip,
        existing: existingMeta,
        archivedMatch: archivedMatchMeta,
        suggestions,
        platform_id: payload.platform_id,
        category_id: payload.category_id,
        commission_type: payload.commission_type,
        effective_from: payload.effective_from,
        effective_to: payload.effective_to ?? null,
        payload,
      });

      if (status === "valid" || status === "similar") {
        stagedCards.push({ ...analysis.normalized, id: rowId });
        existingCards.push({ ...analysis.normalized, id: rowId });
      }
    } catch (error) {
      errorCount++;
      results.push({
        row: rowNum,
        row_id: `${crypto.randomUUID()}:${i}`,
        status: "error",
        message: humanizeErrorMessage((error as Error)?.message ?? "Unknown error"),
        platform_id: platformId,
        category_id: categoryId,
        commission_type: commissionType,
        effective_from: effectiveFrom,
        effective_to: effectiveTo,
      });
    }
  }

  const analysisId = crypto.randomUUID();
  const uploadedAt = new Date().toISOString();

  return {
    analysis_id: analysisId,
    file_name: filename,
    uploaded_at: uploadedAt,
    summary: {
      total: results.length,
      valid: validCount,
      similar: similarCount,
      duplicate: duplicateCount,
      error: errorCount,
    },
    rows: results,
  } satisfies ParseResponse;
}

async function revalidateRow(
  client: ReturnType<typeof createClient>,
  payload: RateCardPayload,
  options: { includeSimilar?: boolean } = {}
): Promise<ParseRowResponse> {
  const analysis = await analyzeRateCard(client, payload);
  const issues = [...analysis.errors];

  if (analysis.overlap) {
    if (analysis.overlap.type === "exact") {
      issues.push(analysis.overlap.reason);
    } else if (!options.includeSimilar) {
      issues.push(analysis.overlap.reason);
    }
  }

  if (issues.length) {
    return {
      status: "error",
      message: issues.map(humanizeErrorMessage).join("; "),
    };
  }

  let overlapInfo: ParseRowResponse["overlap"];
  if (analysis.overlap) {
    overlapInfo = {
      type: analysis.overlap.type,
      reason: analysis.overlap.reason,
    };
  }

  let archivedMatch: ParseRowResponse["archivedMatch"];
  if (analysis.archivedMatch) {
    archivedMatch = {
      id: analysis.archivedMatch.existing.id ?? "",
      label: formatLabel(
        analysis.archivedMatch.existing.platform_id,
        analysis.archivedMatch.existing.category_id
      ),
      date_range: formatDateRange(
        analysis.archivedMatch.existing.effective_from,
        analysis.archivedMatch.existing.effective_to
      ),
      type: analysis.archivedMatch.type === "exact" ? "exact" : "overlap",
    };
  }

  const status: RowStatus = analysis.overlap && analysis.overlap.type === "similar" ? "similar" : "valid";
  const message =
    status === "similar"
      ? "Overlaps existing rate card. Confirm before importing."
      : "Ready to import.";

  return {
    status,
    message,
    normalized: payload,
    overlap: overlapInfo,
    archivedMatch,
  };
}

async function importRows(
  client: ReturnType<typeof createClient>,
  rows: ImportRowRequest[],
  includeSimilar: boolean
): Promise<ImportResponse> {
  const existingCards = await loadExistingRateCards(client);
  const staged: NormalizedCard[] = [];

  const results: ImportResponse["results"] = [];

  for (let i = 0; i < rows.length; i++) {
    const entry = rows[i];
    const payload = entry.payload;

    if (!payload) {
      results.push({
        row_id: entry.row_id,
        row: entry.row,
        status: "skipped",
        message: "Missing payload for row",
      });
      continue;
    }

    if (entry.status !== "valid" && entry.status !== "similar") {
      results.push({
        row_id: entry.row_id,
        row: entry.row,
        status: "skipped",
        message: "Row is not eligible for import",
      });
      continue;
    }

    if (entry.status === "similar" && !includeSimilar) {
      results.push({
        row_id: entry.row_id,
        row: entry.row,
        status: "skipped",
        message: "Similar rows require confirmation",
      });
      continue;
    }

    try {
      const analysis = await analyzeRateCard(client, payload, {
        existingCards,
        additionalCards: staged,
        tempId: `confirm-${i}`,
      });

      const issues = [...analysis.errors];

      if (analysis.overlap) {
        if (analysis.overlap.type === "exact") {
          issues.push(analysis.overlap.reason);
        } else if (!includeSimilar) {
          issues.push(analysis.overlap.reason);
        }
      }

      if (issues.length) {
        results.push({
          row_id: entry.row_id,
          row: entry.row,
          status: "skipped",
          message: issues.join("; "),
        });
        continue;
      }

      const newId = await insertRateCardWithRelations(client, payload);
      results.push({ row_id: entry.row_id, row: entry.row, status: "imported", id: newId });

      const normalized = { ...analysis.normalized, id: newId };
      staged.push(normalized);
      existingCards.push(normalized);
    } catch (error) {
      results.push({
        row_id: entry.row_id,
        row: entry.row,
        status: "skipped",
        message: (error as Error)?.message || "Failed to import row",
      });
    }
  }

  const inserted = results.filter((r) => r.status === "imported").length;
  const skipped = results.length - inserted;

  return {
    analysis_id: crypto.randomUUID(),
    uploaded_at: new Date().toISOString(),
    summary: {
      inserted,
      skipped,
    },
    results,
  };
}

async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (!supabaseUrl || !supabaseKey) {
    return new Response(JSON.stringify({ message: "Supabase credentials not configured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const url = new URL(req.url);
  const action = url.searchParams.get("action") ?? (req.method === "GET" ? "template" : null);

  try {
    switch (action) {
      case "template": {
        return templateResponse(url.searchParams.get("type"));
      }
      case "validate": {
        const body = await req.json();
        const rows = Array.isArray(body?.rows) ? body.rows : [];
        const { summary, results } = validateUploadRows(rows);
        return new Response(JSON.stringify({ summary, results }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      case "parse": {
        const form = await req.formData();
        const file = form.get("file");
        if (!(file instanceof File)) {
          return new Response(JSON.stringify({ message: "No file uploaded" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const buffer = await file.arrayBuffer();
        const csvText = new TextDecoder().decode(buffer);
        const client = createClient(supabaseUrl, supabaseKey);
        const parsed = await parseCsvUpload(client, csvText, file.name ?? "upload.csv");
        return new Response(JSON.stringify(parsed), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      case "parse-row": {
        const body = await req.json();
        if (!body || typeof body !== "object") {
          return new Response(JSON.stringify({ message: "Invalid request body" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const payload = body as RateCardPayload;
        const client = createClient(supabaseUrl, supabaseKey);
        const result = await revalidateRow(client, payload, { includeSimilar: true });
        return new Response(JSON.stringify(result), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      case "import": {
        const body = await req.json();
        const rows: ImportRowRequest[] = Array.isArray(body?.rows) ? body.rows : [];
        if (!rows.length) {
          return new Response(JSON.stringify({ message: "No rows provided for import" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const includeSimilar = Boolean(body?.include_similar);
        const client = createClient(supabaseUrl, supabaseKey);
        const result = await importRows(client, rows, includeSimilar);
        return new Response(JSON.stringify(result), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      default: {
        return new Response(JSON.stringify({ message: "Unsupported action" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }
  } catch (error) {
    console.error("rate-cards-import error:", error);
    const status = (error as any)?.statusCode ?? 500;
    const message = (error as Error)?.message ?? "Unexpected error";
    return new Response(JSON.stringify({ message }), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}

Deno.serve(handler);
