import { Router, type Request, type Response } from "express";
import { randomUUID } from "crypto";
import { db } from "../../storage";
import { rateCardsV2, rateCardSlabs, rateCardFees, settlements, rateCardTemplates, reconciliationsV0, reconciliationRuns, orders } from "@shared/schema";
import { and, desc, eq, lte, or, isNull, asc, isNotNull, inArray, ne, sql } from "drizzle-orm";
import multer from "multer";
import { parse } from "csv-parse/sync";
import normalizeHeaders, { canonicalColumnName } from "../utils/rateCardHeaders";
import { transformRateCardV2Rows, type RateCardV2Row } from "@shared/rateCards/v2";
import { transformLegacyRateCards, type LegacyRateCardRow } from "@shared/rateCards/legacy";
import { reconcileOrder } from "../reconciliation";

// time helpers
function dateOnly(d: string) {
  // normalize to yyyy-mm-dd (no time) to avoid tz flickers
  return new Date(new Date(d).toISOString().slice(0, 10));
}

type Payload = {
  id?: string;
  platform_id: string;
  category_id: string;
  commission_type: "flat" | "tiered";
  commission_percent?: number | null;
  slabs?: { min_price: number; max_price: number | null; commission_percent: number }[];
  fees: { fee_code: string; fee_type: "percent" | "amount"; fee_value: number }[];
  effective_from: string; // yyyy-mm-dd
  effective_to?: string | null; // yyyy-mm-dd | null
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
  archived: boolean;
};

type OverlapResult = {
  type: "exact" | "similar";
  existing: NormalizedCard;
  reason: string;
};

type ArchivedMatch = {
  existing: NormalizedCard;
  type: "exact" | "similar";
  reason: string;
};

type RateCardAnalysis = {
  errors: string[];
  overlap: OverlapResult | null;
  archivedMatch?: ArchivedMatch;
  normalized: NormalizedCard;
};

// Rate Card (contractual) fees we accept from CSV/UI. Reconciliation (actuals from settlements) lives elsewhere.
const ALLOWED_FEE_CODES = new Set([
  "tech_fee",
  "collection_fee_percent",
  "promo_contribution_percent",
]);

type TemplateFieldVisibility = "wizard" | "csv" | "both";

type TemplateField = {
  key?: string;
  label?: string;
  mandatory?: boolean;
  visibility?: TemplateFieldVisibility;
  status?: "active" | "deprecated";
  [key: string]: any;
};

type TemplateMetadata = {
  template_type: "flat" | "tiered";
  version: string;
  headers_json: TemplateField[];
  description?: string;
  source?: "db" | "fallback";
};

const normalizeTemplateVisibility = (field?: TemplateField | null): TemplateFieldVisibility => {
  const raw = typeof field?.visibility === "string" ? field?.visibility : typeof field?.meta?.visibility === "string" ? field?.meta?.visibility : undefined;
  if (raw === "wizard" || raw === "csv" || raw === "both") return raw;
  return "both";
};

const buildLocalTemplate = (template_type: "flat" | "tiered"): TemplateMetadata => {
  const sharedHeaders: TemplateField[] = [
    { key: "platform_id", label: "Marketplace", mandatory: true },
    { key: "category_id", label: "Category", mandatory: true },
    { key: "commission_type", label: "Commission Type", mandatory: true },
    { key: "commission_percent", label: "Commission %", mandatory: true },
    { key: "gst_percent", label: "GST %", mandatory: true },
    { key: "tcs_percent", label: "TCS %", mandatory: false },
    { key: "settlement_basis", label: "Settlement Basis", mandatory: true },
    { key: "t_plus_days", label: "T + Days", mandatory: false },
    { key: "weekly_weekday", label: "Weekly Weekday", mandatory: false },
    { key: "bi_weekly_weekday", label: "Bi-weekly Weekday", mandatory: false },
    { key: "bi_weekly_which", label: "Bi-weekly Which", mandatory: false },
    { key: "monthly_day", label: "Monthly Day", mandatory: false },
    { key: "settlement_cycle", label: "Settlement Cycle", mandatory: false },
    { key: "grace_days", label: "Grace Days", mandatory: false },
    { key: "effective_from", label: "Effective From", mandatory: true },
    { key: "effective_to", label: "Effective To", mandatory: false },
    { key: "tech_fee", label: "Tech / Platform Fee", mandatory: false },
    { key: "collection_fee_percent", label: "Collection Fee (%)", mandatory: false },
    { key: "promo_contribution_percent", label: "Discount / Promo Contribution (%)", mandatory: false },
    { key: "notes", label: "Notes", mandatory: false },
  ];

  const tieredExtras: TemplateField[] =
    template_type === "tiered"
      ? [
          { key: "min_price", label: "Min Price", mandatory: true },
          { key: "max_price", label: "Max Price", mandatory: true },
        ]
      : [];

  return {
    template_type,
    version: "v3.3-local",
    headers_json: [...sharedHeaders, ...tieredExtras],
    description: "Local fallback template metadata",
    source: "fallback",
  };
};

const LOCAL_TEMPLATE_FALLBACKS: Record<"flat" | "tiered", TemplateMetadata> = {
  flat: buildLocalTemplate("flat"),
  tiered: buildLocalTemplate("tiered"),
};

const fetchTemplateMetadata = async (type: "flat" | "tiered"): Promise<TemplateMetadata> => {
  try {
    const records = await db
      .select()
      .from(rateCardTemplates)
      .where(eq(rateCardTemplates.templateType, type))
      .orderBy(desc(rateCardTemplates.version), desc(rateCardTemplates.createdAt))
      .limit(1);
    const record = records[0];
    if (record) {
      return {
        template_type: type,
        version: record.version,
        headers_json: Array.isArray(record.headersJson) ? (record.headersJson as TemplateField[]) : [],
        description: record.description ?? undefined,
        source: "db",
      };
    }
  } catch (error: any) {
    console.warn(`Failed to load template metadata for ${type}:`, error?.message || error);
  }
  return LOCAL_TEMPLATE_FALLBACKS[type];
};

// Settlement logic: settlement_basis (anchor) decides when the payout clock starts.
// Settlement cycle values are descriptive grouping only; delayed payout detection uses anchor + expected days + grace.

type ConflictScope = {
  tenant_id: string;
  marketplace: string;
  category: string;
  template_type: string;
};

type ConflictDetectionInput = ConflictScope & {
  effective_from: string;
  effective_to: string | null;
  exclude_rate_card_id?: string | null;
  source?: "wizard" | "csv" | string;
};

type ConflictDetectionResult = {
  conflictScope: ConflictScope;
  conflictKey: string;
  conflictType: "NO_CONFLICT" | "BOUNDARY_CONFLICT" | "PARTIAL_OVERLAP" | "FULL_OVERLAP" | "MULTI_CONFLICT";
  conflicts: Array<{
    id: string;
    effective_from: string;
    effective_to: string | null;
    archived: boolean;
    version_number: number | null;
  }>;
};

type ApplyAction = "REPLACE_AND_AUTO_END_OLD" | "CREATE";

const buildConflictKey = (scope: ConflictScope) =>
  `${scope.tenant_id}|${scope.marketplace}|${scope.category}|${scope.template_type}`;

const parseDateValue = (value: string | null | undefined): number | null => {
  if (!value) return null;
  const ts = new Date(value).getTime();
  return Number.isNaN(ts) ? null : ts;
};

const intervalsOverlap = (aStart: string, aEnd: string | null, bStart: string, bEnd: string | null): boolean => {
  const aStartTs = parseDateValue(aStart);
  const aEndTs = parseDateValue(aEnd) ?? Number.POSITIVE_INFINITY;
  const bStartTs = parseDateValue(bStart);
  const bEndTs = parseDateValue(bEnd) ?? Number.POSITIVE_INFINITY;
  if (aStartTs === null || bStartTs === null) return false;
  return aStartTs <= bEndTs && bStartTs <= aEndTs;
};

const classifyConflict = (candidate: ConflictDetectionInput, existing: ConflictDetectionResult["conflicts"], source: string | undefined): ConflictDetectionResult["conflictType"] => {
  if (!existing.length) return "NO_CONFLICT";
  if (existing.length > 1 && source === "csv") return "MULTI_CONFLICT";

  const newStart = parseDateValue(candidate.effective_from);
  const newEnd = parseDateValue(candidate.effective_to) ?? Number.POSITIVE_INFINITY;
  let boundaryOnly = true;
  let fullOverlap = false;

  for (const card of existing) {
    const oldStart = parseDateValue(card.effective_from);
    const oldEnd = parseDateValue(card.effective_to) ?? Number.POSITIVE_INFINITY;
    if (newStart === null || oldStart === null) continue;

    const overlaps = newStart <= oldEnd && oldStart <= newEnd;
    if (!overlaps) continue;

    const touchesBoundary =
      (candidate.effective_to && card.effective_from && candidate.effective_to === card.effective_from) ||
      (card.effective_to && candidate.effective_from && card.effective_to === candidate.effective_from);

    if (!touchesBoundary) boundaryOnly = false;

    const newContainsOld = newStart <= oldStart && newEnd >= oldEnd;
    const oldContainsNew = oldStart <= newStart && oldEnd >= newEnd;
    if (newContainsOld || oldContainsNew) {
      fullOverlap = true;
    }
  }

  if (boundaryOnly) return "BOUNDARY_CONFLICT";
  if (fullOverlap) return "FULL_OVERLAP";
  return "PARTIAL_OVERLAP";
};

async function detectRateCardConflicts(input: ConflictDetectionInput): Promise<ConflictDetectionResult> {
  const scope: ConflictScope = {
    tenant_id: input.tenant_id,
    marketplace: input.marketplace,
    category: input.category,
    template_type: input.template_type,
  };
  const conflictKey = buildConflictKey(scope);

  const rows = await db
    .select({
      id: rateCardsV2.id,
      effective_from: rateCardsV2.effective_from,
      effective_to: rateCardsV2.effective_to,
      archived: rateCardsV2.archived,
      version_number: rateCardsV2.version_number,
    })
    .from(rateCardsV2)
    .where(
      and(
        eq(rateCardsV2.platform_id, input.marketplace),
        eq(rateCardsV2.category_id, input.category),
        eq(rateCardsV2.template_type, input.template_type),
      ),
    );

  const activeRows = rows.filter((row) => !row.archived && (!input.exclude_rate_card_id || row.id !== input.exclude_rate_card_id));

  const overlaps = activeRows.filter((row) =>
    intervalsOverlap(input.effective_from, input.effective_to, row.effective_from as string, (row.effective_to as string | null) ?? null),
  );

  const conflictType = classifyConflict(input, overlaps, input.source);

  return {
    conflictScope: scope,
    conflictKey,
    conflictType,
    conflicts: overlaps.map((row) => ({
      id: row.id as string,
      effective_from: row.effective_from as string,
      effective_to: (row.effective_to as string | null) ?? null,
      archived: Boolean(row.archived),
      version_number: row.version_number as number | null,
    })),
  };
}

function computeGlobalPriceBounds(slabs: any[] | undefined) {
  if (!slabs || !Array.isArray(slabs) || !slabs.length) {
    return { global_min_price: null, global_max_price: null };
  }
  let min = Number.POSITIVE_INFINITY;
  let max: number | null = Number.NEGATIVE_INFINITY;
  let hasNullMax = false;
  for (const slab of slabs) {
    const slabMin = Number(slab?.min_price);
    const slabMax = slab?.max_price === null || slab?.max_price === undefined || slab?.max_price === ""
      ? null
      : Number(slab.max_price);
    if (!Number.isNaN(slabMin)) {
      min = Math.min(min, slabMin);
    }
    if (slabMax === null) {
      hasNullMax = true;
    } else if (!Number.isNaN(slabMax)) {
      max = Math.max(max as number, slabMax);
    }
  }
  return {
    global_min_price: Number.isFinite(min) ? min : null,
    global_max_price: hasNullMax ? null : Number.isFinite(max as number) ? (max as number) : null,
  };
}

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
};

function csvEscape(v: unknown): string {
  const s = String(v ?? "");
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

async function buildTemplateCsv(type: "flat" | "tiered"): Promise<{ filename: string; csv: string }> {
  const template = await fetchTemplateMetadata(type);
  const fields = (template.headers_json ?? []).filter((field) => normalizeTemplateVisibility(field) !== "wizard");
  const headers = fields.map((field) => {
    const label = field?.label || field?.key || "Column";
    const suffixes: string[] = [];
    if (field?.status === "deprecated") suffixes.push("(deprecated)");
    if (field?.mandatory === false) suffixes.push("(optional)");
    return `${label}${suffixes.length ? ` ${suffixes.join(" ")}` : ""}`.trim();
  });

  const sampleRow = headers.map(() => "");
  const body = [headers, sampleRow]
    .map((row) => row.map(csvEscape).join(","))
    .join("\r\n")
    .concat("\r\n");

  return { filename: `rate-card-template-${type}.csv`, csv: body };
}

function canonId(v: any) {
  return (v ?? "").toString().trim().toLowerCase();
}

const displayDateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

function formatDisplayDate(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return value;
  return displayDateFormatter.format(date);
}

function formatDateRange(from?: string | null, to?: string | null) {
  const start = formatDisplayDate(from) ?? from ?? "-";
  const end = to ? formatDisplayDate(to) ?? to : "open";
  return `${start} → ${end}`;
}

function formatLabel(platformId?: string | null, categoryId?: string | null) {
  const platform = platformId ? PLATFORM_LABELS[platformId] ?? platformId : "Unknown";
  const category = categoryId ? CATEGORY_LABELS[categoryId] ?? categoryId : "Unknown";
  return `${platform} • ${category}`;
}

function formatNumber(value: number | null | undefined) {
  if (value === null || value === undefined) return "0";
  if (!Number.isFinite(value)) return String(value);
  const trimmed = Number(value.toFixed(6));
  return trimmed % 1 === 0 ? `${trimmed.toFixed(0)}` : `${trimmed}`;
}

function describeFees(fees: NormalizedFee[]) {
  if (!fees.length) return "";
  return fees
    .map((fee) => {
      const suffix = fee.fee_type === "percent" ? "%" : "";
      return `${fee.fee_code} ${formatNumber(fee.fee_value)}${suffix}`;
    })
    .join(", ");
}

function describeCommission(card: NormalizedCard) {
  const feesText = describeFees(card.fees);
  if (card.commission_type === "tiered") {
    const snippets = card.slabs.slice(0, 3).map((slab) => {
      const toLabel = slab.max_price === null ? "open" : formatNumber(slab.max_price);
      return `${formatNumber(slab.min_price)}-${toLabel}: ${formatNumber(slab.commission_percent)}%`;
    });
    const extra = card.slabs.length > 3 ? ", …" : "";
    const summary = snippets.length ? `; ${snippets.join(", ")}${extra}` : "";
    const feeSummary = feesText ? `; Fees: ${feesText}` : "";
    return `Tiered commission (${card.slabs.length} slab${card.slabs.length === 1 ? "" : "s"})${summary}${feeSummary}`;
  }

  const pct = formatNumber(card.commission_percent ?? 0);
  const feeSummary = feesText ? `; Fees: ${feesText}` : "";
  return `Flat ${pct}% commission${feeSummary}`;
}

function humanizeErrorMessage(raw: string) {
  const normalized = raw.replace(/_/g, " ").trim();
  if (!normalized) return normalized;
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function parseUtcDate(value?: string | null) {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function addDaysUtc(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function buildSimilarSummary(newCard: NormalizedCard, existing: NormalizedCard) {
  const identicalRange =
    newCard.effective_from === existing.effective_from &&
    ((newCard.effective_to ?? null) === (existing.effective_to ?? null));
  const sameCommission =
    newCard.commission_type === existing.commission_type &&
    (newCard.commission_type === "flat"
      ? Math.abs((newCard.commission_percent ?? 0) - (existing.commission_percent ?? 0)) < 1e-6
      : slabsEqual(newCard.slabs, existing.slabs));
  const sameFees = feesEqual(newCard.fees, existing.fees);

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

type SimilarSuggestion = { type: "shift_from"; new_from: string; reason: string };

function buildSimilarSuggestions(newCard: NormalizedCard, existing: NormalizedCard): SimilarSuggestion[] | undefined {
  if (!existing.effective_to) return undefined;
  const existingEnd = parseUtcDate(existing.effective_to);
  const newStart = parseUtcDate(newCard.effective_from);
  if (!existingEnd || !newStart) return undefined;
  if (newStart > existingEnd) return undefined;

  const shiftTo = addDaysUtc(existingEnd, 1).toISOString().slice(0, 10);
  const dateLabel = formatDisplayDate(shiftTo) ?? shiftTo;
  return [
    {
      type: "shift_from",
      new_from: shiftTo,
      reason: `Shift start date to ${dateLabel} to avoid overlap.`,
    },
  ];
}

function asDateString(value: string | Date | null | undefined) {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  const str = String(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  return new Date(str).toISOString().slice(0, 10);
}

function cleanNumber(value: any): number {
  if (value === null || value === undefined) return Number.NaN;
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : Number.NaN;
  }
  const cleaned = String(value).replace(/[%₹$€£,\s]/g, "");
  if (!cleaned.length) return Number.NaN;
  if (!/^[-+]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(cleaned)) {
    return Number.NaN;
  }
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : Number.NaN;
}

const parsePercent = (value: any): number => {
  if (value === null || value === undefined || String(value).trim() === "") {
    return Number.NaN;
  }
  return cleanNumber(value);
};

const parseAmount = (value: any): number => {
  if (value === null || value === undefined || String(value).trim() === "") {
    return Number.NaN;
  }
  return cleanNumber(value);
};

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

  if (/^\d{3,5}$/.test(raw)) {
    const iso = excelSerialToISO(Number(raw));
    if (iso) return iso;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return raw;
  }

  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(raw)) {
    const [partA, partB, year] = raw.split("/").map(Number);
    const tryFormat = (yyyy: number, mm: number, dd: number) => {
      const date = new Date(Date.UTC(yyyy, mm - 1, dd));
      if (
        !Number.isNaN(date.getTime()) &&
        date.getUTCFullYear() === yyyy &&
        date.getUTCMonth() === mm - 1 &&
        date.getUTCDate() === dd
      ) {
        return date.toISOString().slice(0, 10);
      }
      return null;
    };

    return tryFormat(year, partB, partA) ?? tryFormat(year, partA, partB);
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}

function toNumber(value: any) {
  if (value === null || value === undefined || value === "") return null;
  const num = cleanNumber(value);
  return Number.isNaN(num) ? null : num;
}

const formatCellTooltip = (column: string, value: any, guidance: string) =>
  `Column: ${column} (value: '${value ?? ""}'). ${guidance}`;

function prepareFees(fees: any[]): NormalizedFee[] {
  const normalized: NormalizedFee[] = [];
  for (const fee of fees || []) {
    if (!fee) continue;
    const fee_code = String(fee.fee_code ?? "").trim();
    if (!fee_code || !ALLOWED_FEE_CODES.has(fee_code)) continue;
    const rawType = String(fee.fee_type ?? "percent").trim();
    const fee_type = rawType === "amount" ? "amount" : "percent";
    const fee_value = Number(fee.fee_value ?? 0);
    if (Number.isNaN(fee_value)) continue;
    normalized.push({ fee_code, fee_type, fee_value });
  }
  return normalized.sort((a, b) =>
    a.fee_code.localeCompare(b.fee_code) || a.fee_type.localeCompare(b.fee_type)
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

function isSameRateCardScope(a: { platform_id?: string | null; category_id?: string | null; template_type?: string | null }, b: { platform_id?: string | null; category_id?: string | null; template_type?: string | null }) {
  return (
    canonId(a.platform_id ?? "") === canonId(b.platform_id ?? "") &&
    canonId(a.category_id ?? "") === canonId(b.category_id ?? "") &&
    canonId(a.template_type ?? "") === canonId(b.template_type ?? "")
  );
}

function detectOverlap(
  card: NormalizedCard,
  others: NormalizedCard[]
): OverlapResult | null {
  const from = dateOnly(card.effective_from);
  const to = card.effective_to ? dateOnly(card.effective_to) : null;

  for (const other of others) {
    if (!other) continue;
    if (card.id && other.id && card.id === other.id) continue;
    if (!isSameRateCardScope(card, other)) continue;

    if (process.env.NODE_ENV !== "production") {
      (global as any).__rc_dbg = ((global as any).__rc_dbg ?? 0) + 1;
      if ((global as any).__rc_dbg <= 5) {
        console.debug("[overlap-check]", {
          new: {
            p: card.platform_id,
            c: card.category_id,
            from: card.effective_from,
            to: card.effective_to,
          },
          existing: {
            p: other.platform_id,
            c: other.category_id,
            from: other.effective_from,
            to: other.effective_to,
          },
        });
      }
    }

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

async function loadExistingRateCards(dbInstance: any): Promise<NormalizedCard[]> {
  try {
    const base = await dbInstance
      .select({
        id: rateCardsV2.id,
        platform_id: rateCardsV2.platform_id,
        category_id: rateCardsV2.category_id,
        commission_type: rateCardsV2.commission_type,
        commission_percent: rateCardsV2.commission_percent,
        effective_from: rateCardsV2.effective_from,
        effective_to: rateCardsV2.effective_to,
        archived: rateCardsV2.archived,
      })
      .from(rateCardsV2);

    const feeRows = await dbInstance
      .select({
        rate_card_id: rateCardFees.rate_card_id,
        fee_code: rateCardFees.fee_code,
        fee_type: rateCardFees.fee_type,
        fee_value: rateCardFees.fee_value,
      })
      .from(rateCardFees);

    const slabRows = await dbInstance
      .select({
        rate_card_id: rateCardSlabs.rate_card_id,
        min_price: rateCardSlabs.min_price,
        max_price: rateCardSlabs.max_price,
        commission_percent: rateCardSlabs.commission_percent,
      })
      .from(rateCardSlabs);

    const feeMap = new Map<string, NormalizedFee[]>();
    for (const row of feeRows) {
      const list = feeMap.get(row.rate_card_id) ?? [];
      list.push({
        fee_code: String(row.fee_code ?? ""),
        fee_type: row.fee_type === "amount" ? "amount" : "percent",
        fee_value: Number(row.fee_value ?? 0),
      });
      feeMap.set(row.rate_card_id, list);
    }

    const slabMap = new Map<string, NormalizedSlab[]>();
    for (const row of slabRows) {
      const list = slabMap.get(row.rate_card_id) ?? [];
      list.push({
        min_price: Number(row.min_price ?? 0),
        max_price:
          row.max_price === null || row.max_price === undefined
            ? null
            : Number(row.max_price),
        commission_percent: Number(row.commission_percent ?? 0),
      });
      slabMap.set(row.rate_card_id, list);
    }

    return base.map((card: any) => ({
      id: card.id,
      platform_id: canonId(card.platform_id),
      category_id: canonId(card.category_id),
      commission_type: (card.commission_type as "flat" | "tiered") ?? "flat",
      commission_percent:
        card.commission_percent === null || card.commission_percent === undefined
          ? null
          : Number(card.commission_percent),
      slabs: prepareSlabs(slabMap.get(card.id) ?? []),
      fees: prepareFees(feeMap.get(card.id) ?? []),
      effective_from: asDateString(card.effective_from)!,
      effective_to: asDateString(card.effective_to),
      archived: Boolean(card.archived ?? false),
    }));
  } catch (error) {
    console.error("Failed to load existing rate cards for validation:", error);
    return [];
  }
}

export async function analyzeRateCard(
  dbInstance: any,
  body: Payload,
  options?: {
    existingCards?: NormalizedCard[];
    additionalCards?: NormalizedCard[];
    tempId?: string;
    includeArchivedForBlocking?: boolean;
  }
): Promise<RateCardAnalysis> {
  const errors: string[] = [];

  const normalized: NormalizedCard = {
    id: body.id ?? options?.tempId ?? null,
    platform_id: canonId(body.platform_id),
    category_id: canonId(body.category_id),
    commission_type: body.commission_type,
    commission_percent:
      body.commission_type === "flat"
        ? toNumber(body.commission_percent) ?? 0
        : null,
    slabs: body.commission_type === "tiered" ? prepareSlabs(body.slabs ?? []) : [],
    fees: prepareFees(body.fees ?? []),
    effective_from: body.effective_from,
    effective_to: body.effective_to ?? null,
    archived: false,
  };

  // duplicate fee code validation
  const feeCodes = normalized.fees.map((f) => f.fee_code);
  const dupFee = feeCodes.find((code, idx) => feeCodes.indexOf(code) !== idx);
  if (dupFee) {
    errors.push(`Duplicate fee code "${dupFee}" not allowed.`);
  }

  if (normalized.commission_type === "tiered") {
    if (!normalized.slabs.length) {
      errors.push("Tiered commission requires at least one slab.");
    } else {
      const unlimitedIndexes = normalized.slabs
        .map((s, idx) => (s.max_price === null ? idx : -1))
        .filter((idx) => idx >= 0);
      if (unlimitedIndexes.length > 1) {
        errors.push("Only one slab can be open-ended (no upper limit).");
      }
      for (let i = 0; i < normalized.slabs.length; i++) {
        const current = normalized.slabs[i];
        if (current.max_price !== null && current.max_price <= current.min_price) {
          errors.push(`Slab ${i + 1}: max_price must be greater than min_price or null for open-ended.`);
        }
        if (current.max_price === null && i !== normalized.slabs.length - 1) {
          errors.push("Open-ended (no upper limit) slab must be the final slab.");
        }
        if (i < normalized.slabs.length - 1) {
          const currentMax = current.max_price ?? Number.POSITIVE_INFINITY;
          if (currentMax > normalized.slabs[i + 1].min_price) {
            errors.push(
              "Two commission ranges are overlapping. Each slab must cover a unique price range without overlaps — please adjust the min and max values."
            );
            break;
          }
        }
      }
    }
  }

  const referenceCards = [
    ...((options?.existingCards ?? (await loadExistingRateCards(dbInstance))))
  ];
  if (options?.additionalCards?.length) {
    referenceCards.push(...options.additionalCards);
  }

  const includeArchived = options?.includeArchivedForBlocking ?? false;
const overlap = detectOverlap(normalized, referenceCards);

  let archivedMatch: ArchivedMatch | undefined;
  let effectiveOverlap = overlap;

  if (overlap && overlap.existing.archived && !includeArchived) {
    archivedMatch = {
      existing: overlap.existing,
      type: overlap.type,
      reason: overlap.reason,
    };
    effectiveOverlap = null;
  }

  return {
    errors,
    overlap: effectiveOverlap,
    ...(archivedMatch ? { archivedMatch } : {}),
    normalized,
  };
}

export async function validateRateCard(
  dbInstance: any,
  body: Payload,
  options?: { versionedEdit?: boolean; allowOverlapReplace?: boolean }
) {
  const analysis = await analyzeRateCard(dbInstance, body);
  const errs = [...analysis.errors];

  if (analysis.overlap) {
    const allowFlag = options?.allowOverlapReplace;
    // default (undefined): block overlaps; false: allow coexistence; true: allow and defer to replacement flow
    if (allowFlag === undefined) {
      const overlap = analysis.overlap;
      const err: any = new Error("Overlapping rate card detected.");
      err.statusCode = 409;
      err.code = "RATE_CARD_OVERLAP";
      err.payload = {
        code: "RATE_CARD_OVERLAP",
        message:
          "Rate card overlaps with existing card for platform/category (start → end). Confirm replace or keep both.",
        details: {
          marketplace: overlap.existing.platform_id,
          category: overlap.existing.category_id,
          overlap_range: `${overlap.existing.effective_from} → ${overlap.existing.effective_to ?? "open"}`,
        },
      };
      throw err;
    }
    if (allowFlag === false) {
      // Allow coexistence; no error added
    } else if (allowFlag === true) {
      // Allow overlap but capture info for downstream replacement handling
    } else {
      errs.push(analysis.overlap.reason);
    }
  }

  // Versioned edits must begin today or later
  if (options?.versionedEdit) {
    const todayIso = new Date().toISOString().slice(0, 10);
    if (body.effective_from && body.effective_from < todayIso) {
      errs.push("New version cannot start before today.");
    }
  }

  // Ensure validity window is not reversed
  if (body.effective_from && body.effective_to) {
    const from = new Date(body.effective_from);
    const to = new Date(body.effective_to);
    if (to < from) {
      errs.push("effective_to cannot be earlier than effective_from.");
    }
  }

  if (errs.length) {
    const e: any = new Error(errs.join(" "));
    e.statusCode = 400;
    throw e;
  }
}

async function insertRateCardWithRelations(payload: any) {
  const commissionPercentValue =
    payload.commission_type === "flat" && payload.commission_percent !== undefined && payload.commission_percent !== null
      ? Number(payload.commission_percent)
      : null;
  const sanitizedFees = prepareFees(payload.fees ?? []);

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

  const [rc] = await db
    .insert(rateCardsV2)
    .values({
      platform_id: payload.platform_id,
      category_id: payload.category_id,
      commission_type: payload.commission_type,
      commission_percent: commissionPercentValue,
      gst_percent: gstPercentValue,
      tcs_percent: tcsPercentValue,
      template_type: payload.template_type,
      template_version: payload.template_version,
      version_number: payload.version_number ?? 1,
      archived: payload.archived ?? false,
      uploaded_by: payload.uploaded_by ?? "manual-ui",
      source_upload_id: payload.source_upload_id ?? null,
      raw_payload: payload.raw_payload ?? null,
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
    } as any)
    .returning({ id: rateCardsV2.id });

  if (Array.isArray(payload.slabs) && payload.slabs.length > 0) {
    await db.insert(rateCardSlabs).values(
      payload.slabs.map((s: any) => ({
        rate_card_id: rc.id,
        min_price: Number(s.min_price ?? 0),
        max_price:
          s.max_price === undefined || s.max_price === null || s.max_price === ""
            ? null
            : Number(s.max_price),
        commission_percent: Number(s.commission_percent ?? 0),
      })) as any[]
    );
  }

  if (sanitizedFees.length > 0) {
    await db.insert(rateCardFees).values(
      sanitizedFees.map((f: any) => ({
        rate_card_id: rc.id,
        fee_code: f.fee_code,
        fee_type: f.fee_type,
        fee_value: Number(f.fee_value ?? 0),
      })) as any[]
    );
  }

  return rc.id;
}

// ---- Conflict detection + validation/apply (unified flow) ----

const ALLOWED_ACTIONS: ApplyAction[] = ["REPLACE_AND_AUTO_END_OLD"];

const idempotencyStore = new Map<string, any>();

const parseConflictScope = (body: any): ConflictScope => ({
  tenant_id: String(body.tenant_id ?? "").trim(),
  marketplace: String(body.marketplace ?? "").trim(),
  category: String(body.category ?? "").trim(),
  template_type: String(body.template_type ?? "").trim(),
});

const validateConflictInput = (body: any) => {
  const requiredFields = ["tenant_id", "marketplace", "category", "template_type", "effective_from"];
  const missing = requiredFields.filter((f) => !String(body?.[f] ?? "").trim());
  if (missing.length) {
    const err: any = new Error(`Missing required fields: ${missing.join(", ")}`);
    err.statusCode = 400;
    throw err;
  }
};

const checkReconciledGuard = async (scope: ConflictScope, effectiveFrom: string) => {
  // Best-effort: guard against effective_from earlier than reconciled payouts for the same marketplace.
  // Category isn’t available in settlements; we scope by marketplace only.
  const earliest = await db
    .select({ payout_date: settlements.payout_date })
    .from(settlements)
    .where(eq(settlements.marketplace, scope.marketplace))
    .orderBy(settlements.payout_date)
    .limit(1);
  const earliestDate = earliest?.[0]?.payout_date as string | null;
  if (!earliestDate) return null;
  const fromTs = parseDateValue(effectiveFrom);
  const earliestTs = parseDateValue(earliestDate);
  if (fromTs !== null && earliestTs !== null && fromTs < earliestTs) {
    const err: any = new Error("effective_from precedes existing reconciled orders for this scope.");
    err.statusCode = 409;
    err.error_code = "EFFECTIVE_FROM_BEFORE_RECONCILED";
    throw err;
  }
  return null;
};

const upload = multer(); // in-memory storage

// ----- CSV parsing helpers (lenient fallback) -----
function splitCsvRows(csvData: string): string[] {
  const rows: string[] = [];
  let current = "";
  let inQuotes = false;
  let structureDepth = 0;

  for (let i = 0; i < csvData.length; i++) {
    const char = csvData[i];

    if (char === '"') {
      if (!inQuotes) {
        inQuotes = true;
      } else if (csvData[i + 1] === '"') {
        current += "\"\"";
        i++;
        continue;
      } else {
        inQuotes = false;
      }
      current += char;
      continue;
    }

    if (!inQuotes) {
      if (char === '[' || char === '{') {
        structureDepth++;
      } else if (char === ']' || char === '}') {
        if (structureDepth > 0) {
          structureDepth--;
        }
      }

      if (char === '\n' || char === '\r') {
        if (structureDepth === 0) {
          if (current.length > 0) {
            rows.push(current);
            current = "";
          }
          if (char === '\r' && csvData[i + 1] === '\n') {
            i++;
          }
          inQuotes = false;
          structureDepth = 0;
          continue;
        }
        current += char;
        continue;
      }
    } else if (char === '\n' || char === '\r') {
      current += char;
      continue;
    }

    current += char;
  }

  if (current.trim().length > 0 || current.length > 0) {
    rows.push(current);
  }

  return rows.filter((row) => row.trim().length > 0);
}

function splitCsvLine(line: string, expectedColumns?: number): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;
  let structureDepth = 0;

  const cleanLine = line.replace(/\r$/, "");

  for (let i = 0; i < cleanLine.length; i++) {
    const char = cleanLine[i];

    if (char === "\"" && structureDepth === 0) {
      if (inQuotes && cleanLine[i + 1] === "\"") {
        current += "\"";
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
  const lines = splitCsvRows(csvData);
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
    return parse(csvData, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    }) as Record<string, string>[];
  } catch (error: any) {
    console.warn(
      "Strict CSV parse failed, attempting lenient parsing:",
      error?.message || error
    );
    return parseCsvLoosely(csvData);
  }
}

function parseJsonArrayField(
  raw: any,
  label: string,
  issues: string[]
): any[] {
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
    issues.push(
      `Failed to parse json for '${label}': ${error?.message || "Invalid JSON"}`
    );
    return [];
  }
}

function getRowValue(row: Record<string, any>, key: string): any {
  if (row[key] !== undefined) {
    return row[key];
  }

  const target = canonicalColumnName(key);
  for (const candidate of Object.keys(row)) {
    if (canonicalColumnName(candidate) === target) {
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

// ----- Upload session state -----
type RowStatus = "valid" | "similar" | "duplicate" | "error";

type ParsedUploadRow = {
  rowId: string;
  row: number;
  status: RowStatus;
  message?: string;
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
  suggestions?: SimilarSuggestion[];
  platform_id?: string;
  category_id?: string;
  commission_type?: string;
  effective_from?: string;
  effective_to?: string | null;
  payload?: Payload;
};

type ParsedUploadSession = {
  id: string;
  filename: string;
  uploadedAt: string;
  createdAt: number;
  rows: ParsedUploadRow[];
};

const parsedUploads = new Map<string, ParsedUploadSession>();
const PARSED_UPLOAD_TTL_MS = 1000 * 60 * 30; // 30 minutes
const MAX_PARSED_UPLOADS = 25;

function pruneParsedUploads() {
  const now = Date.now();
  for (const [id, session] of parsedUploads.entries()) {
    if (now - session.createdAt > PARSED_UPLOAD_TTL_MS) {
      parsedUploads.delete(id);
    }
  }

  if (parsedUploads.size <= MAX_PARSED_UPLOADS) return;

  const oldest = Array.from(parsedUploads.values()).sort((a, b) => a.createdAt - b.createdAt);
  while (parsedUploads.size > MAX_PARSED_UPLOADS && oldest.length) {
    const session = oldest.shift();
    if (!session) break;
    parsedUploads.delete(session.id);
  }
}

const router = Router();

router.get("/rate-cards/template", async (req, res) => {
  const typeParam = req.query.type;
  const type = typeParam === "tiered" ? "tiered" : typeParam === "flat" ? "flat" : null;
  if (!type) {
    return res.status(400).send("Invalid template type");
  }

  const { filename, csv } = await buildTemplateCsv(type);
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  return res.status(200).send(csv);
});

// CSV template (download) - MUST be before /:id route to avoid conflicts
router.get("/rate-cards/template.csv", async (_req, res) => {
  const { csv } = await buildTemplateCsv("flat");
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", "attachment; filename=rate-card-template.csv");
  res.send(csv);
});

const resolveFirst = (row: Record<string, any>, keys: string[]): string => {
  for (const key of keys) {
    const value = row[key];
    if (value !== undefined && value !== null && String(value).trim().length > 0) {
      return String(value).trim();
    }
  }
  return "";
};

const extractSlabs = (row: Record<string, any>): Array<{ min_price: number | null; max_price: number | null; commission_percent: number | null }> => {
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
};

router.post("/rate-cards/validate-upload", async (req, res) => {
  try {
    const rows = req.body?.rows;
    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ error: "No rows provided for validation." });
    }

    const results = rows.map((rawRow: any, index: number) => {
      const normalized = normalizeHeaders(rawRow ?? {});
      if (rawRow && typeof rawRow === "object" && rawRow.payload) {
        Object.assign(normalized, normalizeHeaders(rawRow.payload));
      }

      const errors: string[] = [];

      const platform = resolveFirst(normalized, ["platform", "marketplace", "platform_id", "platformid"]);
      if (!platform) errors.push("Missing marketplace/platform");

      const category = resolveFirst(normalized, ["category", "category_id", "categoryid"]);
      if (!category) errors.push("Missing category");

      const validFrom = resolveFirst(normalized, ["validFrom", "valid_from", "effective_from", "date_from"]);
      if (!validFrom) errors.push("Missing 'Valid From' date");

      const validTo = resolveFirst(normalized, ["validTo", "valid_to", "effective_to", "date_to"]);
      if (!validTo) errors.push("Missing 'Valid To' date");

      const typeRaw = resolveFirst(normalized, ["type", "commission_type"]);
      const type = typeRaw.toLowerCase();

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

      const commissionValue = resolveFirst(normalized, ["commission", "commission_percent", "commission%"]);
      if (type !== "tiered" && !commissionValue) {
        errors.push("Commission percentage missing");
      }

      return {
        row: Number(rawRow?.row ?? index + 1),
        platform,
        category,
        type: typeRaw,
        validFrom,
        validTo,
        valid: errors.length === 0,
        errors,
      };
    });

    const summary = {
      total: results.length,
      valid: results.filter((row) => row.valid).length,
      invalid: results.filter((row) => !row.valid).length,
    };

    return res.json({ summary, results });
  } catch (error) {
    console.error("[validate-upload] Error:", error);
    return res.status(500).json({ error: "Validation failed due to server error." });
  }
});

// CSV parse (dry run) route
router.post("/rate-cards/parse", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const csvData = req.file.buffer.toString("utf-8");
    const parsedRecords = parseCsvData(csvData);

    const normalizedRecords = parsedRecords.map((row, index) => ({
      row: normalizeHeaders(row),
      index,
    }));

    type TieredGroup = {
      baseRow: Record<string, any>;
      slabs: Array<{ min_price: number | null; max_price: number | null; commission_percent: number | null }>;
      sourceIndexes: number[];
    };

    const tieredGroups = new Map<string, TieredGroup>();
    const processedRecords: Array<{ row: Record<string, any>; sourceIndexes: number[] }> = [];

    for (const { row, index } of normalizedRecords) {
      const typeRaw = asTrimmedString(row.type ?? row.commission_type);
      const normalizedTypeValue = typeRaw.toLowerCase();

      if (normalizedTypeValue === "tiered") {
        const platformValue = asTrimmedString(row.platform ?? row.platform_id);
        const categoryValue = asTrimmedString(row.category ?? row.category_id);
        const validFromValue = asTrimmedString(row.validFrom ?? row.effective_from);
        const validToValue = asTrimmedString(row.validTo ?? row.effective_to);
        const groupKey = [
          platformValue.toLowerCase(),
          categoryValue.toLowerCase(),
          validFromValue,
          validToValue,
        ]
          .map((value) => value ?? "")
          .join("|");

        if (!tieredGroups.has(groupKey)) {
          const baseRow = { ...row };
          tieredGroups.set(groupKey, {
            baseRow,
            slabs: [],
            sourceIndexes: [],
          });
        }

        const group = tieredGroups.get(groupKey)!;

        const minPriceValue = parseAmount(row.minPrice ?? row.min_price ?? row["min price"] ?? "");
        const maxPriceValue = parseAmount(row.maxPrice ?? row.max_price ?? row["max price"] ?? "");
        const commissionValue = parsePercent(
          row.commission ?? row["commission"] ?? row["commission %"] ?? ""
        );

        group.slabs.push({
          min_price: Number.isFinite(minPriceValue) ? Number(minPriceValue) : null,
          max_price: Number.isFinite(maxPriceValue) ? Number(maxPriceValue) : null,
          commission_percent: Number.isFinite(commissionValue) ? Number(commissionValue) : null,
        });
        group.sourceIndexes.push(index);
      } else {
        processedRecords.push({ row, sourceIndexes: [index] });
      }
    }

    tieredGroups.forEach(({ baseRow, slabs, sourceIndexes }) => {
      const aggregatedRow = { ...baseRow };
      aggregatedRow.slabs_json = JSON.stringify(slabs);
      aggregatedRow.type = asTrimmedString(baseRow.type ?? baseRow.commission_type) || "Tiered";
      aggregatedRow.commission_type = "tiered";
      aggregatedRow.commission = "";
      delete aggregatedRow.minPrice;
      delete aggregatedRow.maxPrice;
      delete aggregatedRow.min_price;
      delete aggregatedRow.max_price;

      processedRecords.push({ row: aggregatedRow, sourceIndexes });
    });

    processedRecords.sort((a, b) => Math.min(...a.sourceIndexes) - Math.min(...b.sourceIndexes));

    const existingCards = await loadExistingRateCards(db);
    const stagedCards: NormalizedCard[] = [];

    const results: ParsedUploadRow[] = [];

    let validCount = 0;
    let similarCount = 0;
    let duplicateCount = 0;
    let errorCount = 0;

    for (let i = 0; i < processedRecords.length; i++) {
      const rawRow = processedRecords[i].row;
      const row = rawRow;
      const firstSourceIndex = Math.min(...processedRecords[i].sourceIndexes);
      const rowNum = (Number.isFinite(firstSourceIndex) ? firstSourceIndex : i) + 2; // header + 1-indexed rows

      const issues: { message: string; tooltip?: string }[] = [];
      let platformId = "";
      let categoryId = "";
      let commissionType = "";
      let effectiveFrom = "";
      let effectiveTo = "";

      try {
        const slabsKey = getRowValue(row, "slabs_json") !== undefined ? "slabs_json" : "slabs";
        const feesKey = getRowValue(row, "fees_json") !== undefined ? "fees_json" : "fees";

        const slabParseIssues: string[] = [];
        const feeParseIssues: string[] = [];

        const slabs = parseJsonArrayField(
          getRowValue(row, slabsKey),
          slabsKey,
          slabParseIssues
        );
        const fees = parseJsonArrayField(getRowValue(row, feesKey), feesKey, feeParseIssues);

        slabParseIssues.forEach((msg) => {
          issues.push({ message: msg });
        });
        feeParseIssues.forEach((msg) => {
          issues.push({ message: msg });
        });

        platformId = asTrimmedString(getRowValue(row, "platform_id"));
        categoryId = asTrimmedString(getRowValue(row, "category_id"));
        const commissionTypeRaw = getRowValue(row, "commission_type");
        commissionType = asTrimmedString(commissionTypeRaw);
        const settlementBasis = asTrimmedString(getRowValue(row, "settlement_basis"));

        const effectiveFromRaw = getRowValue(row, "effective_from");
        const effectiveToRaw = getRowValue(row, "effective_to");
        const commissionPercentRaw = asTrimmedString(getRowValue(row, "commission_percent"));
        const gstPercentRaw = asTrimmedString(getRowValue(row, "gst_percent"));
        const tcsPercentRaw = asTrimmedString(getRowValue(row, "tcs_percent"));
        const techFeeTypeRaw =
          asTrimmedString(getRowValue(row, "tech_fee_type")) ||
          asTrimmedString(getRowValue(row, "tech fee type"));
        const techFeeValueRaw =
          asTrimmedString(getRowValue(row, "tech_fee_value")) ||
          asTrimmedString(getRowValue(row, "tech_fee")) ||
          asTrimmedString(getRowValue(row, "tech fee"));
        const collectionFeePercentRaw = asTrimmedString(getRowValue(row, "collection_fee_percent"));
        const promoContributionPercentRaw =
          asTrimmedString(getRowValue(row, "promo_contribution_percent")) ||
          asTrimmedString(getRowValue(row, "discount_promo_percent"));
        const settlementCycleRaw = asTrimmedString(getRowValue(row, "settlement_cycle_days"));
        const tPlusRaw = asTrimmedString(getRowValue(row, "t_plus_days"));
        const weeklyWeekdayRaw = asTrimmedString(getRowValue(row, "weekly_weekday"));
        const biWeeklyWeekdayRaw = asTrimmedString(getRowValue(row, "bi_weekly_weekday"));
        const biWeeklyWhich = asTrimmedString(getRowValue(row, "bi_weekly_which")) || null;
        const monthlyDay = asTrimmedString(getRowValue(row, "monthly_day")) || null;
        const graceDaysRaw = asTrimmedString(getRowValue(row, "grace_days"));
        const globalMinRaw = asTrimmedString(getRowValue(row, "global_min_price"));
        const globalMaxRaw = asTrimmedString(getRowValue(row, "global_max_price"));
        const notesValue = asTrimmedString(getRowValue(row, "notes")) || null;

        const normalizedCommissionTypeRaw = commissionType.toLowerCase();
        if (!normalizedCommissionTypeRaw) {
          issues.push({
            message: "commission_type is required",
            tooltip: formatCellTooltip("Commission Type", commissionTypeRaw, "Provide flat or tiered."),
          });
        }

        const allowedTypes: Array<"flat" | "tiered"> = ["flat", "tiered"];
        const normalizedType = allowedTypes.find((type) => type === normalizedCommissionTypeRaw) ?? null;

        if (!normalizedType && normalizedCommissionTypeRaw) {
          issues.push({
            message: `Unknown type: '${commissionType}' (use flat or tiered).`,
            tooltip: formatCellTooltip(
              "Commission Type",
              commissionTypeRaw,
              "Use flat or tiered."
            ),
          });
        }

        const effectiveFromISO = parseDateToISO(effectiveFromRaw);
        if (!effectiveFromISO) {
          issues.push({
            message: "invalid date",
            tooltip: formatCellTooltip(
              "Effective From",
              effectiveFromRaw,
              "Use YYYY-MM-DD, e.g., 2025-09-01."
            ),
          });
        }

        const effectiveToISO = parseDateToISO(effectiveToRaw);
        if (effectiveToRaw && !effectiveToISO) {
          issues.push({
            message: "invalid date",
            tooltip: formatCellTooltip(
              "Effective To",
              effectiveToRaw,
              "Use YYYY-MM-DD, e.g., 2025-09-01."
            ),
          });
        }

        const commissionPercentValue = parsePercent(commissionPercentRaw);
        if (normalizedType === "flat" && !Number.isFinite(commissionPercentValue)) {
          issues.push({
            message: "invalid number",
            tooltip: formatCellTooltip(
              "Commission %",
              commissionPercentRaw,
              "Use numbers only."
            ),
          });
        }

        const gstPercentValue = parsePercent(gstPercentRaw || "18");
        if (gstPercentRaw && !Number.isFinite(gstPercentValue)) {
          issues.push({
            message: "invalid number",
            tooltip: formatCellTooltip("GST %", gstPercentRaw, "Use numbers only."),
          });
        }

        const tcsPercentValue = parsePercent(tcsPercentRaw || "1");
        if (tcsPercentRaw && !Number.isFinite(tcsPercentValue)) {
          issues.push({
            message: "invalid number",
            tooltip: formatCellTooltip("TCS %", tcsPercentRaw, "Use numbers only."),
          });
        }

        const techFeeValue = parseAmount(techFeeValueRaw);
        if (techFeeValueRaw && !Number.isFinite(techFeeValue)) {
          issues.push({
            message: "invalid number",
            tooltip: formatCellTooltip("Tech Fee Value", techFeeValueRaw, "Use numbers only."),
          });
        }

        const collectionFeePercentValue = parsePercent(collectionFeePercentRaw);
        if (collectionFeePercentRaw && !Number.isFinite(collectionFeePercentValue)) {
          issues.push({
            message: "invalid number",
            tooltip: formatCellTooltip("Collection Fee %", collectionFeePercentRaw, "Use numbers only."),
          });
        }

        const promoContributionPercentValue = parsePercent(promoContributionPercentRaw);
        if (promoContributionPercentRaw && !Number.isFinite(promoContributionPercentValue)) {
          issues.push({
            message: "invalid number",
            tooltip: formatCellTooltip(
              "Discount / Promo Contribution %",
              promoContributionPercentRaw,
              "Use numbers only."
            ),
          });
        }

        const settlementCycleValue = parseAmount(settlementCycleRaw);
        if (settlementCycleRaw && !Number.isFinite(settlementCycleValue)) {
          issues.push({
            message: "invalid number",
            tooltip: formatCellTooltip(
              "Settlement Cycle (Days)",
              settlementCycleRaw,
              "Use numbers only."
            ),
          });
        }

        const tPlusDaysValue = toNumber(tPlusRaw);
        const weeklyWeekdayValue = toNumber(weeklyWeekdayRaw);
        const biWeeklyWeekdayValue = toNumber(biWeeklyWeekdayRaw);
        const graceDaysValue = toNumber(graceDaysRaw);
        const globalMinValue = toNumber(globalMinRaw);
        const globalMaxValue = toNumber(globalMaxRaw);

        const emitIssueRow = () => {
          const errorMessages = issues.map((issue) => humanizeErrorMessage(issue.message));
          const errorTooltip = issues
            .map((issue) => issue.tooltip)
            .filter(Boolean)
            .join(" | ") || undefined;

          errorCount++;
          results.push({
            rowId: "",
            row: rowNum,
            status: "error",
            message: errorMessages.join("; "),
            tooltip: errorTooltip,
            platform_id: platformId,
            category_id: categoryId,
            commission_type:
              normalizedType ?? (normalizedCommissionTypeRaw || commissionType || ""),
            effective_from: effectiveFromISO ?? "",
            effective_to: effectiveToISO ?? (effectiveToRaw ? String(effectiveToRaw) : null),
          });
        };

        if (issues.length) {
          emitIssueRow();
          continue;
        }

        const normalizedCommissionType: "flat" | "tiered" = normalizedType ?? "flat";
        effectiveFrom = effectiveFromISO ?? "";
        effectiveTo = effectiveToISO ?? "";

        const mergedFees: any[] = Array.isArray(fees) ? [...fees] : [];
        if (Number.isFinite(techFeeValue)) {
          const normalizedType = techFeeTypeRaw.toLowerCase() === "percent" ? "percent" : "amount";
          mergedFees.push({
            fee_code: "tech_fee",
            fee_type: normalizedType,
            fee_value: Number(techFeeValue),
          });
        }
        if (Number.isFinite(collectionFeePercentValue)) {
          mergedFees.push({
            fee_code: "collection_fee_percent",
            fee_type: "percent",
            fee_value: Number(collectionFeePercentValue),
          });
        }
        if (Number.isFinite(promoContributionPercentValue)) {
          mergedFees.push({
            fee_code: "promo_contribution_percent",
            fee_type: "percent",
            fee_value: Number(promoContributionPercentValue),
          });
        }

        const payload: Payload & {
          gst_percent?: any;
          tcs_percent?: any;
          settlement_basis?: string;
          t_plus_days?: number | null;
          weekly_weekday?: number | null;
          bi_weekly_weekday?: number | null;
          bi_weekly_which?: string | null;
          monthly_day?: string | null;
          grace_days?: number;
          global_min_price?: number | null;
          global_max_price?: number | null;
          notes?: string | null;
        } = {
          platform_id: platformId,
          category_id: categoryId,
          commission_type: normalizedCommissionType,
          commission_percent:
            normalizedCommissionType === "flat" && Number.isFinite(commissionPercentValue)
              ? Number(commissionPercentValue)
              : null,
          slabs,
          fees: mergedFees,
          effective_from: effectiveFrom,
          effective_to: effectiveToISO || null,
          gst_percent: Number.isFinite(gstPercentValue) ? gstPercentValue : 18,
          tcs_percent: Number.isFinite(tcsPercentValue) ? tcsPercentValue : 1,
          settlement_basis: settlementBasis.toLowerCase(),
          t_plus_days:
            tPlusDaysValue === null || Number.isNaN(tPlusDaysValue)
              ? null
              : Math.trunc(tPlusDaysValue),
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
            graceDaysValue === null || Number.isNaN(graceDaysValue)
              ? 0
              : Math.trunc(graceDaysValue),
          global_min_price:
            globalMinValue === null || Number.isNaN(globalMinValue)
              ? null
              : Number(globalMinValue),
          global_max_price:
            globalMaxValue === null || Number.isNaN(globalMaxValue)
              ? null
              : Number(globalMaxValue),
          notes: notesValue,
        };

        // basic validations mirroring front-end quick checks
  if (!payload.platform_id) issues.push({ message: "platform_id is required" });
  if (!payload.category_id) issues.push({ message: "category_id is required" });
  if (!payload.commission_type) issues.push({ message: "commission_type is required" });
        if (
          payload.commission_type &&
          !["flat", "tiered"].includes(payload.commission_type)
        ) {
          issues.push({ message: "commission_type must be 'flat' or 'tiered'" });
        }
  if (
    !payload.settlement_basis ||
    payload.settlement_basis === "" ||
    payload.settlement_basis === "Select Settlement Basis"
  ) {
    issues.push({ message: "Settlement basis is required." });
  }
        if (!payload.effective_from) issues.push({ message: "effective_from is required" });

        if (issues.length) {
          emitIssueRow();
          continue;
        }

        const analysis = await analyzeRateCard(db, payload, {
          existingCards,
          additionalCards: stagedCards,
          tempId: `pending-${i}`,
        });

        const issueMessages = issues.map((issue) => issue.message);
        const validationMessages = [...issueMessages, ...analysis.errors]
          .map(humanizeErrorMessage)
          .filter(Boolean);
        const overlapInfo = analysis.overlap;
        const archivedMatchInfo = analysis.archivedMatch;

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
        let suggestions: SimilarSuggestion[] | undefined;
        let archivedMatchMeta:
          | {
              id: string;
              label: string;
              date_range: string;
              type: "exact" | "overlap";
            }
          | undefined;

        if (validationMessages.length) {
          status = "error";
          message = validationMessages.join("; ");
          errorCount++;
        } else if (archivedMatchInfo) {
          const existingCard = archivedMatchInfo.existing;
          archivedMatchMeta = {
            id: existingCard.id ?? "",
            label: formatLabel(existingCard.platform_id, existingCard.category_id),
            date_range: formatDateRange(existingCard.effective_from, existingCard.effective_to),
            type: archivedMatchInfo.type === "exact" ? "exact" : "overlap",
          };
          tooltip = `Archived match (${archivedMatchMeta.type}): ${archivedMatchMeta.label} (${archivedMatchMeta.date_range}). Archived cards don't affect reconciliation.`;
          validCount++;
        } else if (overlapInfo) {
          const existingCard = overlapInfo.existing;
          existingMeta = {
            id: existingCard.id ?? "",
            label: formatLabel(existingCard.platform_id, existingCard.category_id),
            date_range: formatDateRange(existingCard.effective_from, existingCard.effective_to),
          };

          if (overlapInfo.type === "exact") {
            status = "duplicate";
            message = `Exact duplicate of ${existingMeta.label} (${existingMeta.date_range}). Remove or edit this row.`;
            tooltip = "Same date range, commission and fees.";
            duplicateCount++;
          } else {
            status = "similar";
            message = `Overlaps existing ${existingMeta.label} (${existingMeta.date_range}). Adjust dates or confirm import.`;
            tooltip = `${buildSimilarSummary(analysis.normalized, existingCard)}. Your row: ${describeCommission(analysis.normalized)}. Existing: ${describeCommission(existingCard)}.`;
            suggestions = buildSimilarSuggestions(analysis.normalized, existingCard);
            similarCount++;
          }
        } else {
          validCount++;
        }

        results.push({
          rowId: "", // placeholder, filled after loop
          row: rowNum,
          status,
          message,
          tooltip,
          ...(archivedMatchMeta ? { archivedMatch: archivedMatchMeta } : {}),
          existing: existingMeta,
          suggestions,
          platform_id: payload.platform_id,
          category_id: payload.category_id,
          commission_type: payload.commission_type,
          effective_from: payload.effective_from,
          effective_to: payload.effective_to,
          payload,
        });

        if (status === "valid" || status === "similar") {
          stagedCards.push({ ...analysis.normalized, id: analysis.normalized.id ?? `pending-${i}` });
        }
      } catch (error: any) {
        errorCount++;
        results.push({
          rowId: "",
          row: rowNum,
          status: "error",
          message: humanizeErrorMessage(error.message || "Unknown error"),
          platform_id: platformId,
          category_id: categoryId,
          commission_type: commissionType,
          effective_from: effectiveFrom,
          effective_to: effectiveTo,
        });
      }
    }

    const totalRows = processedRecords.length;
    const analysisId = randomUUID();
    const uploadedAt = new Date().toISOString();
    const filename = req.file.originalname || "upload.csv";

    const rowsWithId = results.map((row, index) => ({
      ...row,
      rowId: `${analysisId}:${index + 1}`,
    }));

    parsedUploads.set(analysisId, {
      id: analysisId,
      filename,
      uploadedAt,
      createdAt: Date.now(),
      rows: rowsWithId,
    });

    pruneParsedUploads();

    res.json({
      analysis_id: analysisId,
      file_name: filename,
      uploaded_at: uploadedAt,
      summary: {
        total: totalRows,
        valid: validCount,
        similar: similarCount,
        duplicate: duplicateCount,
        error: errorCount,
      },
      rows: rowsWithId.map((row) => ({
        row: row.row,
        row_id: row.rowId,
        status: row.status,
        message: row.message,
        ...(row.tooltip ? { tooltip: row.tooltip } : {}),
        ...(row.archivedMatch ? { archivedMatch: row.archivedMatch } : {}),
        ...(row.existing ? { existing: row.existing } : {}),
        ...(row.suggestions && row.suggestions.length ? { suggestions: row.suggestions } : {}),
        platform_id: row.platform_id,
        category_id: row.category_id,
        commission_type: row.commission_type,
        effective_from: row.effective_from,
        effective_to: row.effective_to,
        ...(row.payload ? { payload: row.payload } : {}),
      })),
    });
  } catch (error: any) {
    console.error("CSV parse error:", error);
    res.status(500).json({
      message: "Failed to process CSV file",
      error: error.message,
    });
  }
});

router.post("/rate-cards/parse-row", async (req, res) => {
  try {
    const payload = req.body as Payload | undefined;
    if (!payload) {
      return res.status(400).json({ message: "Missing payload" });
    }

    const analysis = await analyzeRateCard(db, payload, {
      tempId: `parse-row-${Date.now()}`,
    });

    const errors = analysis.errors.map(humanizeErrorMessage).filter(Boolean);
    let status: RowStatus = "valid";
    let message = "Ready to import.";
    let tooltip: string | undefined;
    let archivedMatchMeta:
      | {
          id: string;
          label: string;
          date_range: string;
          type: "exact" | "overlap";
        }
      | undefined;

    if (errors.length) {
      status = "error";
      message = errors.join("; ");
    } else if (analysis.archivedMatch) {
      const existing = analysis.archivedMatch.existing;
      archivedMatchMeta = {
        id: existing.id ?? "",
        label: formatLabel(existing.platform_id, existing.category_id),
        date_range: formatDateRange(existing.effective_from, existing.effective_to),
        type: analysis.archivedMatch.type === "exact" ? "exact" : "overlap",
      };
      tooltip = `Archived match (${archivedMatchMeta.type}): ${archivedMatchMeta.label} (${archivedMatchMeta.date_range}). Archived cards don't affect reconciliation.`;
    } else if (analysis.overlap) {
      if (analysis.overlap.type === "exact") {
        status = "duplicate";
        message = analysis.overlap.reason;
        tooltip = "Same date range, commission and fees.";
      } else {
        status = "similar";
        message = analysis.overlap.reason;
        const existing = analysis.overlap.existing;
        if (existing) {
          tooltip = `${buildSimilarSummary(analysis.normalized, existing)}. Your row: ${describeCommission(analysis.normalized)}. Existing: ${describeCommission(existing)}.`;
        }
      }
    }

    res.json({
      status,
      message,
      ...(tooltip ? { tooltip } : {}),
      ...(archivedMatchMeta ? { archivedMatch: archivedMatchMeta } : {}),
      normalized: analysis.normalized,
      errors,
      ...(analysis.overlap
        ? {
            overlap: {
              type: analysis.overlap.type,
              reason: analysis.overlap.reason,
            },
          }
        : {}),
    });
  } catch (error: any) {
    console.error("parse-row error", error);
    res.status(500).json({ message: error?.message || "Failed to analyze row" });
  }
});

router.post("/rate-cards/import", async (req, res) => {
  try {
    const {
      analysis_id: analysisId,
      row_ids: rowIds,
      include_similar: includeSimilar,
      overrides: overridesInput,
    } = req.body ?? {};

    if (!analysisId || typeof analysisId !== "string") {
      return res.status(400).json({ message: "Missing analysis_id. Upload the CSV again." });
    }

    if (!Array.isArray(rowIds) || rowIds.length === 0) {
      return res.status(400).json({ message: "No rows provided for import" });
    }

    pruneParsedUploads();
    const session = parsedUploads.get(analysisId);

    if (!session) {
      return res.status(410).json({ message: "Upload session expired. Please upload the file again." });
    }

    const selectedRows: ParsedUploadRow[] = [];
    const seen = new Set<string>();
    for (const id of rowIds) {
      if (typeof id !== "string" || seen.has(id)) continue;
      seen.add(id);
      const row = session.rows.find((r) => r.rowId === id);
      if (row) {
        selectedRows.push(row);
      }
    }

    const overrideMap = new Map<string, Payload>();
    if (
      overridesInput &&
      typeof overridesInput === "object" &&
      overridesInput !== null &&
      !Array.isArray(overridesInput)
    ) {
      for (const [rowId, value] of Object.entries(overridesInput as Record<string, unknown>)) {
        if (typeof rowId !== "string") continue;
        if (!value || typeof value !== "object") continue;
        overrideMap.set(rowId, value as Payload);
      }
    }

    if (!selectedRows.length) {
      return res.status(400).json({ message: "Selected rows were not found. Upload the CSV again." });
    }

    const existingCards = await loadExistingRateCards(db);
    const staged: NormalizedCard[] = [];

    const results: Array<{
      rowId: string;
      row: number;
      status: "imported" | "skipped";
      id?: string;
      message?: string;
    }> = [];

    for (let i = 0; i < selectedRows.length; i++) {
      const entry = selectedRows[i];
      const allowSimilar = includeSimilar === true;

      const overridePayload = overrideMap.get(entry.rowId);
      const payload: Payload | undefined = overridePayload
        ? entry.payload
          ? { ...entry.payload, ...overridePayload }
          : (overridePayload as Payload)
        : entry.payload;

      if (!payload) {
        results.push({
          rowId: entry.rowId,
          row: entry.row,
          status: "skipped",
          message: "Missing payload for row",
        });
        continue;
      }

      if (entry.status !== "valid" && entry.status !== "similar") {
        results.push({
          rowId: entry.rowId,
          row: entry.row,
          status: "skipped",
          message: "Row is not eligible for import",
        });
        continue;
      }

      if (entry.status === "similar" && !allowSimilar) {
        results.push({
          rowId: entry.rowId,
          row: entry.row,
          status: "skipped",
          message: "Similar rows require confirmation",
        });
        continue;
      }

      if (overridePayload) {
        entry.payload = payload;
        entry.effective_from = payload.effective_from;
        entry.effective_to = payload.effective_to ?? null;
      }

      try {
        const analysis = await analyzeRateCard(db, payload, {
          existingCards,
          additionalCards: staged,
          tempId: `confirm-${i}`,
        });

        const issues = [...analysis.errors];

        if (analysis.overlap) {
          if (analysis.overlap.type === "exact") {
            issues.push({ message: analysis.overlap.reason });
          } else if (!allowSimilar) {
            issues.push({ message: analysis.overlap.reason });
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

        const newId = await insertRateCardWithRelations(payload);
        results.push({ rowId: entry.rowId, row: entry.row, status: "imported", id: newId });

        const normalized = { ...analysis.normalized, id: newId };
        staged.push(normalized);
        existingCards.push(normalized);
      } catch (error: any) {
        results.push({
          rowId: entry.rowId,
          row: entry.row,
          status: "skipped",
          message: error.message || "Failed to import row",
        });
      }
    }

    const inserted = results.filter((r) => r.status === "imported").length;
    const skipped = results.length - inserted;

    res.json({
      analysis_id: analysisId,
      file_name: session.filename,
      uploaded_at: session.uploadedAt,
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
    console.error("CSV import error:", error);
    res.status(500).json({
      message: "Failed to import rate cards",
      error: error.message,
    });
  }
});

// List all rate cards + summary metrics (incl. avg commission)
router.get("/rate-cards", async (req, res) => {
  try {
    // Use in-memory storage to avoid database connection issues
    const { storage } = await import("../../storage");
    const cards = await storage.getRateCards();
    const { data, metrics } = transformLegacyRateCards(cards as LegacyRateCardRow[]);

    res.json({ data, metrics });
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ message: e.message || "Failed to fetch rate cards" });
  }
});

// Get a single rate card with status (only UUID format)
router.get("/rate-cards/:id([0-9a-f-]{36})", async (req, res) => {
  try {
    const id = req.params.id;
    const [card] = await db.select().from(rateCardsV2).where(eq(rateCardsV2.id, id));

    if (!card) return res.status(404).json({ message: "Rate card not found" });

    const from = new Date(card.effective_from);
    const to = card.effective_to ? new Date(card.effective_to) : null;
    const today = new Date();

    let status = "active";
    if (from > today) status = "upcoming";
    else if (to && to < today) status = "expired";

    // also fetch slabs + fees
    const slabs = await db.select().from(rateCardSlabs).where(eq(rateCardSlabs.rate_card_id, id));
    const fees = await db.select().from(rateCardFees).where(eq(rateCardFees.rate_card_id, id));

    res.json({ ...card, slabs, fees, status });
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ message: e.message || "Failed to fetch rate card" });
  }
});

// Validate-only endpoint (no writes)
router.post("/rate-cards/validate", async (req: Request, res: Response) => {
  try {
    validateConflictInput(req.body);
    const scope = parseConflictScope(req.body);
    const result = await detectRateCardConflicts({
      ...scope,
      effective_from: req.body.effective_from,
      effective_to: req.body.effective_to ?? null,
      exclude_rate_card_id: req.body.exclude_rate_card_id ?? null,
      source: req.body.source ?? "wizard",
    });

    // Enforce NO MULTI_CONFLICT for wizard
    let conflictType = result.conflictType;
    if (req.body.source === "wizard" && conflictType === "MULTI_CONFLICT") {
      conflictType = "PARTIAL_OVERLAP";
    }

    const recommendedAction = conflictType === "NO_CONFLICT" ? "CREATE" : "REPLACE_AND_AUTO_END_OLD";

    res.json({
      conflictScope: scope,
      conflictKey: result.conflictKey,
      conflictType,
      conflicts: result.conflicts,
      recommendedAction,
      server_time_utc: new Date().toISOString(),
    });
  } catch (e: any) {
    const status = e.statusCode || 500;
    res.status(status).json({ message: e.message || "Validation failed" });
  }
});

router.post("/rate-cards/apply", async (req: Request, res: Response) => {
  const idempotencyKey = req.header("Idempotency-Key");
  if (!idempotencyKey) {
    return res.status(400).json({ message: "Idempotency-Key header is required" });
  }
  if (idempotencyStore.has(idempotencyKey)) {
    return res.json(idempotencyStore.get(idempotencyKey));
  }

  const action: ApplyAction = req.body?.action;
  if (!ALLOWED_ACTIONS.includes(action)) {
    return res.status(400).json({ message: "Invalid action", allowed: ALLOWED_ACTIONS });
  }

  try {
    validateConflictInput(req.body);
    const scope = parseConflictScope(req.body);
    const effective_from = req.body.effective_from;
    const effective_to = req.body.effective_to ?? null;
    const expectedConflicts = req.body.expected_conflicts;

    // Guard against too-early effective_from
    await checkReconciledGuard(scope, effective_from);

    const detected = await detectRateCardConflicts({
      ...scope,
      effective_from,
      effective_to,
      exclude_rate_card_id: req.body.exclude_rate_card_id ?? null,
      source: req.body.source ?? "wizard",
    });

    const latestConflictIds = detected.conflicts.map((c) => c.id).sort();
    const expectedIds = Array.isArray(expectedConflicts?.conflictIds)
      ? [...expectedConflicts.conflictIds].sort()
      : [];
    const expectedType = expectedConflicts?.conflictType;
    const conflictsChanged =
      (detected.conflicts.length > 0 && !expectedConflicts) ||
      latestConflictIds.length !== expectedIds.length ||
      latestConflictIds.some((id, idx) => id !== expectedIds[idx]) ||
      (expectedType && expectedType !== detected.conflictType);

    if (conflictsChanged) {
      const body = {
        applied: false,
        reason: "CONFLICTS_CHANGED",
        error_code: "CONFLICTS_CHANGED",
        current: {
          conflictScope: scope,
          conflictKey: detected.conflictKey,
          conflictType: detected.conflictType,
          conflicts: detected.conflicts,
        },
        server_time_utc: new Date().toISOString(),
      };
      idempotencyStore.set(idempotencyKey, body);
      return res.status(409).json(body);
    }

    // Apply replace logic
    const newEffectiveFromDate = new Date(effective_from);
    const newEffectiveToDate = effective_to ? new Date(effective_to) : null;
    const replacedIds: string[] = [];

    for (const conflict of detected.conflicts) {
      const endDate = new Date(newEffectiveFromDate.getTime());
      endDate.setDate(endDate.getDate() - 1);
      await db
        .update(rateCardsV2)
        .set({
          archived: true,
          effective_to: endDate.toISOString().slice(0, 10),
        } as any)
        .where(eq(rateCardsV2.id, conflict.id));
      replacedIds.push(conflict.id);
    }

    // Determine next version number
    const versions = await db
      .select({ version_number: rateCardsV2.version_number })
      .from(rateCardsV2)
      .where(
        and(
          eq(rateCardsV2.platform_id, scope.marketplace),
          eq(rateCardsV2.category_id, scope.category),
          eq(rateCardsV2.template_type, scope.template_type),
        ),
      );
    const maxVersion = versions.reduce((max, row) => Math.max(max, Number(row.version_number ?? 0)), 0);
    const nextVersion = maxVersion + 1;

    const payload = {
      ...req.body.payload,
      platform_id: scope.marketplace,
      category_id: scope.category,
      template_type: scope.template_type,
      version_number: nextVersion,
      commission_type: req.body.payload?.commission_type,
      commission_percent: req.body.payload?.commission_percent,
      effective_from,
      effective_to,
      archived: false,
    };

    const newId = await insertRateCardWithRelations(payload);

    const responseBody = {
      conflictScope: scope,
      conflictKey: detected.conflictKey,
      conflictType: detected.conflictType,
      applied: true,
      replaced_ids: replacedIds,
      new_rate_card_id: newId,
      version_number: nextVersion,
      server_time_utc: new Date().toISOString(),
    };

    idempotencyStore.set(idempotencyKey, responseBody);
    res.json(responseBody);
  } catch (e: any) {
    const status = e.statusCode || 500;
    const body: any = {
      applied: false,
      message: e.message || "Apply failed",
      server_time_utc: new Date().toISOString(),
    };
    if (e.error_code) body.error_code = e.error_code;
    idempotencyStore.set(req.header("Idempotency-Key") as string, body);
    res.status(status).json(body);
  }
});

// Create new rate card
router.post("/rate-cards", async (req, res) => {
  try {
    const body = req.body;
    // Tax rates captured here are reference values for reporting/visibility only.
    // Tax amounts remain derived from marketplace settlements (no recalculation or disputes in UI).
    // Tax rates captured here are reference values for reporting/visibility only.
    // Tax amounts remain derived from marketplace settlements (no recalculation or disputes in UI).
    const sanitizedFees = prepareFees(body.fees ?? []);

    // 🔒 validate before writing
    await validateRateCard(db, body as Payload, {
      allowOverlapReplace: (body as any).allow_overlap_replace,
    });

    const { global_min_price, global_max_price } = computeGlobalPriceBounds(body.slabs);

    const derivedTemplateType = body.commission_type === "tiered" ? "tiered" : "flat";
    const providedTemplateVersion = (body as any).template_version;
    const templateVersionToSave =
      typeof providedTemplateVersion === "string" && providedTemplateVersion.trim().length > 0
        ? providedTemplateVersion
        : "v3.3";
    const uploadedByToSave = (body as any).uploaded_by || "manual-ui";
    const rawPayloadToSave = (body as any).raw_payload ?? body;
    const allowReplace = Boolean((body as any).allow_overlap_replace);

    const newId = await db.transaction(async (tx) => {
      // If allowed, expire overlapping cards (same marketplace/category/template_type, overlapping window)
      if (allowReplace) {
        const newFrom = new Date(body.effective_from);
        const newFromMinusOne = new Date(newFrom);
        newFromMinusOne.setDate(newFromMinusOne.getDate() - 1);
        const newFromMinusIso = newFromMinusOne.toISOString().slice(0, 10);

        const overlapping = await tx
          .select({
            id: rateCardsV2.id,
            platform_id: rateCardsV2.platform_id,
            category_id: rateCardsV2.category_id,
            template_type: rateCardsV2.template_type,
            effective_from: rateCardsV2.effective_from,
            effective_to: rateCardsV2.effective_to,
          })
          .from(rateCardsV2)
          .where(
            and(
              eq(rateCardsV2.platform_id, body.platform_id),
              eq(rateCardsV2.category_id, body.category_id),
              eq(rateCardsV2.template_type, derivedTemplateType),
              // overlap: existing.from <= new.to AND new.from <= existing.to (null -> open)
              lte(rateCardsV2.effective_from, (body.effective_to ?? "9999-12-31") as any),
              or(isNull(rateCardsV2.effective_to), lte(body.effective_from as any, rateCardsV2.effective_to)),
              eq(rateCardsV2.archived, false),
            ),
          );

        for (const card of overlapping) {
          if (!isSameRateCardScope(card, { platform_id: body.platform_id, category_id: body.category_id, template_type: derivedTemplateType })) {
            continue;
          }
          await tx
            .update(rateCardsV2)
            .set({ effective_to: newFromMinusIso })
            .where(eq(rateCardsV2.id, card.id));
        }
      }

      const [rc] = await tx
        .insert(rateCardsV2)
        .values({
          platform_id: body.platform_id,
          category_id: body.category_id,
          commission_type: body.commission_type,
          commission_percent: body.commission_percent,
          version_number: 1,
          gst_percent: body.gst_percent,
          tcs_percent: body.tcs_percent,
          settlement_basis: body.settlement_basis,
          t_plus_days: body.t_plus_days,
          weekly_weekday: body.weekly_weekday,
          bi_weekly_weekday: body.bi_weekly_weekday,
          bi_weekly_which: body.bi_weekly_which,
          monthly_day: body.monthly_day,
          grace_days: body.grace_days ?? 0,
          effective_from: body.effective_from,
          effective_to: body.effective_to,
          global_min_price,
          global_max_price,
          notes: body.notes,
          template_type: derivedTemplateType,
          template_version: templateVersionToSave,
          uploaded_by: uploadedByToSave,
          source_upload_id: null,
          raw_payload: rawPayloadToSave,
        })
        .returning({ id: rateCardsV2.id });

      if (body.slabs?.length) {
        await tx.insert(rateCardSlabs).values(
          body.slabs.map((s: any) => ({
            rate_card_id: rc.id,
            min_price: s.min_price,
            max_price: s.max_price,
            commission_percent: s.commission_percent,
          })),
        );
      }
      if (sanitizedFees.length) {
        await tx.insert(rateCardFees).values(
          sanitizedFees.map((f: any) => ({
            rate_card_id: rc.id,
            fee_code: f.fee_code,
            fee_type: f.fee_type,
            fee_value: f.fee_value,
          })),
        );
      }
      return rc.id;
    });

    res.status(201).json({ id: newId });
  } catch (e: any) {
    console.error(e);
    const status = e.statusCode || 500;
    if (e.payload && e.code === "RATE_CARD_OVERLAP") {
      return res.status(status).json(e.payload);
    }
    res.status(status).json({ message: e.message || "Failed to create rate card" });
  }
});

const updateRateCardHandler = async (req: Request, res: Response) => {
  try {
    const body = req.body as Payload & { id?: string };
    const id = (req.params?.id as string | undefined) ?? body.id;
    if (!id) return res.status(400).json({ message: "id required" });

    // 🔒 validate before writing (pass id to skip self in overlap check)
    await validateRateCard(db, { ...body, id }, { allowOverlapReplace: (body as any).allow_overlap_replace });
    // Tax rates captured here are reference values for reporting/visibility only.
    // Tax amounts remain derived from marketplace settlements (no recalculation or disputes in UI).
    const sanitizedFees = prepareFees(body.fees ?? []);

    const updateCommissionType: "flat" | "tiered" =
      body.commission_type === "tiered" ? "tiered" : "flat";

    await db
      .update(rateCardsV2)
      .set({
        platform_id: body.platform_id,
        category_id: body.category_id,
        commission_type: updateCommissionType,
        commission_percent:
          body.commission_percent !== null && body.commission_percent !== undefined
            ? String(body.commission_percent)
            : null,
        gst_percent: (body as any).gst_percent,
        tcs_percent: (body as any).tcs_percent,
        settlement_basis: (body as any).settlement_basis,
        t_plus_days: (body as any).t_plus_days,
        weekly_weekday: (body as any).weekly_weekday,
        bi_weekly_weekday: (body as any).bi_weekly_weekday,
        bi_weekly_which: (body as any).bi_weekly_which,
        monthly_day: (body as any).monthly_day,
        grace_days: (body as any).grace_days ?? 0,
        effective_from: body.effective_from,
        effective_to: body.effective_to ?? null,
        global_min_price: (body as any).global_min_price,
        global_max_price: (body as any).global_max_price,
        notes: (body as any).notes,
      } as any)
      .where(eq(rateCardsV2.id, id));

    await db.delete(rateCardSlabs).where(eq(rateCardSlabs.rate_card_id, id));
    await db.delete(rateCardFees).where(eq(rateCardFees.rate_card_id, id));

    if ((body as any).slabs?.length) {
      await db.insert(rateCardSlabs).values(
        ((body as any).slabs as any[]).map((s: any) => ({
          rate_card_id: id,
          min_price: Number(s.min_price ?? 0),
          max_price:
            s.max_price === undefined || s.max_price === null || s.max_price === ""
              ? null
              : Number(s.max_price),
          commission_percent: Number(s.commission_percent ?? 0),
        })) as any[]
      );
    }
    if (sanitizedFees.length) {
      await db.insert(rateCardFees).values(
        sanitizedFees.map((f: any) => ({
          rate_card_id: id,
          fee_code: f.fee_code,
          fee_type: f.fee_type,
          fee_value: Number(f.fee_value ?? 0),
        })) as any[]
      );
    }
    res.json({ id });
  } catch (e: any) {
    console.error(e);
    res.status(e.statusCode || 500).json({ message: e.message || "Failed to update rate card" });
  }
};

// Maintain legacy route that relied on body.id
router.put("/rate-cards", updateRateCardHandler);
router.put("/rate-cards/:id", async (req, res) => {
  try {
    const body = req.body as Payload & { id?: string };
    const id = req.params?.id;
    if (!id) return res.status(400).json({ message: "id required" });

    const todayIso = new Date().toISOString().slice(0, 10);
    const yesterdayIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    if (body.effective_from && body.effective_from < todayIso) {
      return res.status(400).json({ message: "effective_from cannot be earlier than today for versioned edit" });
    }

    // fetch old card
    const [oldCard] = await db.select().from(rateCardsV2).where(eq(rateCardsV2.id, id));
    if (!oldCard) return res.status(404).json({ message: "Rate card not found" });
    if (oldCard.effective_to && oldCard.effective_from && oldCard.effective_to < oldCard.effective_from) {
      return res.status(400).json({ message: "Existing card has invalid validity window" });
    }

    // 🔒 validate before writing (pass id to skip self in overlap check)
    const validateEffectiveFrom = todayIso;
    const validateEffectiveTo = body.effective_to ?? oldCard.effective_to ?? null;
    await validateRateCard(
      db,
      { ...body, id, effective_from: validateEffectiveFrom, effective_to: validateEffectiveTo },
      { versionedEdit: true }
    );

    const { global_min_price, global_max_price } = computeGlobalPriceBounds((body as any).slabs);
    const sanitizedFees = prepareFees(body.fees ?? []);

    const nextVersion = Number(oldCard.version_number ?? 1) + 1;

    // Insert new version (versioned replace: new row, old archived)
    const [newCard] = await db
      .insert(rateCardsV2)
      .values({
        id: randomUUID(),
        platform_id: body.platform_id ?? oldCard.platform_id,
        category_id: body.category_id ?? oldCard.category_id,
        commission_type: body.commission_type ?? oldCard.commission_type,
        commission_percent:
          body.commission_percent !== undefined ? body.commission_percent : oldCard.commission_percent,
        version_number: nextVersion,
        archived: false,
        gst_percent: body.gst_percent ?? oldCard.gst_percent,
        tcs_percent: body.tcs_percent ?? oldCard.tcs_percent,
        settlement_basis: body.settlement_basis ?? oldCard.settlement_basis,
        t_plus_days: body.t_plus_days ?? oldCard.t_plus_days,
        weekly_weekday: body.weekly_weekday ?? oldCard.weekly_weekday,
        bi_weekly_weekday: body.bi_weekly_weekday ?? oldCard.bi_weekly_weekday,
        bi_weekly_which: body.bi_weekly_which ?? oldCard.bi_weekly_which,
        monthly_day: body.monthly_day ?? oldCard.monthly_day,
        grace_days: body.grace_days ?? oldCard.grace_days ?? 0,
        effective_from: todayIso,
        effective_to: body.effective_to ?? oldCard.effective_to ?? null,
        global_min_price: global_min_price === undefined ? oldCard.global_min_price : global_min_price,
        global_max_price: global_max_price === undefined ? oldCard.global_max_price : global_max_price,
        notes: body.notes ?? oldCard.notes,
        template_type: oldCard.template_type,
        template_version: oldCard.template_version,
        uploaded_by: oldCard.uploaded_by,
        source_upload_id: oldCard.source_upload_id,
        raw_payload: oldCard.raw_payload,
      })
      .returning({ id: rateCardsV2.id, version_number: rateCardsV2.version_number });

    // Archive old row
    await db
      .update(rateCardsV2)
      .set({ archived: true, effective_to: yesterdayIso })
      .where(eq(rateCardsV2.id, id));

    // Insert slabs/fees for new version; leave old data intact
    if ((body as any).slabs?.length) {
      await db.insert(rateCardSlabs).values(
        ((body as any).slabs as any[]).map((s: any) => ({
          rate_card_id: newCard.id,
          min_price: Number(s.min_price ?? 0),
          max_price:
            s.max_price === undefined || s.max_price === null || s.max_price === ""
              ? null
              : Number(s.max_price),
          commission_percent: Number(s.commission_percent ?? 0),
        })) as any[],
      );
    }
    if (sanitizedFees.length) {
      await db.insert(rateCardFees).values(
        sanitizedFees.map((f: any) => ({
          rate_card_id: newCard.id,
          fee_code: f.fee_code,
          fee_type: f.fee_type,
          fee_value: Number(f.fee_value ?? 0),
        })) as any[],
      );
    }

    // versioned replace: return new id/version
    res.json({ id: newCard.id, version_number: newCard.version_number });
  } catch (e: any) {
    console.error(e);
    res.status(e.statusCode || 500).json({ message: e.message || "Failed to update rate card" });
  }
});

router.post("/reconcile-order", async (req, res) => {
  try {
    const { marketplace, category, orderDate, deliveryDate, actualPayoutDate, run_id } = req.body || {};
    if (!run_id) {
      return res.status(400).json({ message: "run_id required" });
    }

    const run = await db.select().from(reconciliationRuns).where(eq(reconciliationRuns.id, run_id)).limit(1);
    if (!run.length) {
      return res.status(400).json({ message: "Invalid run_id" });
    }
    if (run[0].status !== "RUNNING") {
      return res.status(409).json({ message: "run is not active" });
    }

    const missing = ["marketplace", "category", "orderDate", "deliveryDate"].filter(
      (f) => !String(req.body?.[f] ?? "").trim(),
    );
    if (missing.length) {
      return res.status(400).json({ message: `Missing required fields: ${missing.join(", ")}` });
    }

    const result = await reconcileOrder(db, {
      marketplace,
      category,
      orderDate,
      deliveryDate,
      actualPayoutDate: actualPayoutDate ?? null,
    });

    try {
      const orderId = result.orderId ?? "";
      const existing = await db
        .select()
        .from(reconciliationsV0)
        .where(eq(reconciliationsV0.order_id, orderId));

      const payload = {
        order_id: orderId,
        marketplace: result.marketplace,
        category: result.category,
        order_date: result.orderActivityDate,
        delivery_date: deliveryDate,
        actual_payout_date: actualPayoutDate ?? null,
        rate_card_id: result.rateCardId ?? randomUUID(),
        settlement_anchor: "delivery_date",
        settlement_cycle: "", // not provided in v0 yet
        expected_payout_after_days: 0, // placeholder until full logic wires fields
        grace_days: 0,
        expected_payout_date: result.expectedPayoutDate ?? result.orderActivityDate,
        delay_threshold_date: result.delayThresholdDate ?? result.orderActivityDate,
        reco_status: result.status,
        run_id,
      } as const;

      if (existing.length) {
        const [updated] = await db.update(reconciliationsV0).set(payload as any).where(eq(reconciliationsV0.order_id, orderId)).returning();
        res.json(updated);
      } else {
        const [inserted] = await db.insert(reconciliationsV0).values(payload as any).returning();
        res.json(inserted);
      }
    } catch (err) {
      console.error("failed to insert reconciliation", err);
      res.status(500).json({ message: "Failed to persist reconciliation" });
    }
  } catch (error: any) {
    console.error("reconcile-order error", error);
    res.status(500).json({ message: "Failed to reconcile order" });
  }
});

// Fetch recent reconciliations (for UI/testing)
router.get("/reconciliations", async (req, res) => {
  try {
    const {
      reconciliation_state,
      operational_status,
      marketplace,
      date_from,
      date_to,
      run_id,
      limit: limitRaw,
      offset: offsetRaw,
      sort_by,
      sort_order,
    } = req.query as Record<string, string>;

    const allowedRecon = ["RECONCILED", "OVERDUE", "DISCREPANCY"];
    const allowedOperational = ["PENDING", "DELAYED", "SETTLED"];

    if (reconciliation_state && !allowedRecon.includes(reconciliation_state)) {
      return res.status(400).json({ message: "Invalid reconciliation_state" });
    }
    if (operational_status && !allowedOperational.includes(operational_status)) {
      return res.status(400).json({ message: "Invalid operational_status" });
    }

    const whereClauses: any[] = [];

    if (reconciliation_state) whereClauses.push(eq(reconciliationsV0.reconciliation_state, reconciliation_state));
    if (operational_status) whereClauses.push(eq(reconciliationsV0.operational_status, operational_status));
    if (marketplace) whereClauses.push(eq(reconciliationsV0.marketplace, marketplace));

    const parseDate = (val?: string) => {
      if (!val) return null;
      const d = new Date(val);
      return Number.isNaN(d.valueOf()) ? null : d.toISOString().slice(0, 10);
    };
    const fromDate = parseDate(date_from);
    const toDate = parseDate(date_to);
    if (date_from && !fromDate) return res.status(400).json({ message: "Invalid date_from" });
    if (date_to && !toDate) return res.status(400).json({ message: "Invalid date_to" });
    if (fromDate) whereClauses.push(gte(reconciliationsV0.order_date, fromDate as any));
    if (toDate) whereClauses.push(lte(reconciliationsV0.order_date, toDate as any));

    // Determine run scoping: prefer explicit run_id, else latest completed run
    if (run_id) {
      const run = await db
        .select({ id: reconciliationRuns.id, status: reconciliationRuns.status })
        .from(reconciliationRuns)
        .where(eq(reconciliationRuns.id, run_id))
        .limit(1);
      if (!run.length) {
        return res.status(400).json({ message: "Invalid run_id" });
      }
      whereClauses.push(eq(reconciliationsV0.run_id, run_id));
    } else {
      const latestCompleted = await db
        .select({ id: reconciliationRuns.id })
        .from(reconciliationRuns)
        .where(and(eq(reconciliationRuns.is_latest, true), eq(reconciliationRuns.status, "COMPLETED")))
        .limit(1);
      if (latestCompleted.length) {
        whereClauses.push(eq(reconciliationsV0.run_id, latestCompleted[0].id));
      }
    }

    const limit = Math.min(Number(limitRaw) || 100, 500);
    const offset = Number(offsetRaw) || 0;

    const sortCol = sort_by && (reconciliationsV0 as any)[sort_by] ? (reconciliationsV0 as any)[sort_by] : reconciliationsV0.created_at;
    const sortDir = sort_order === "asc" ? "asc" : "desc";

    const baseQuery = db.select().from(reconciliationsV0);
    const filteredQuery = whereClauses.length ? baseQuery.where(and(...whereClauses)) : baseQuery;

    const rows = await filteredQuery.orderBy(sortDir === "asc" ? asc(sortCol) : desc(sortCol)).limit(limit).offset(offset);
    const [{ count }] = await (whereClauses.length
      ? db.select({ count: db.fn.count(reconciliationsV0.id) }).from(reconciliationsV0).where(and(...whereClauses))
      : db.select({ count: db.fn.count(reconciliationsV0.id) }).from(reconciliationsV0));

    res.json({ rows, count: Number(count), limit, offset });
  } catch (error: any) {
    console.error("fetch reconciliations error", error);
    res.status(500).json({ message: "Failed to fetch reconciliations" });
  }
});

// Summary for latest run
router.get("/reconciliations/summary", async (_req, res) => {
  try {
    const latestRun = await db
      .select({ id: reconciliationRuns.id })
      .from(reconciliationRuns)
      .where(and(eq(reconciliationRuns.is_latest, true), eq(reconciliationRuns.status, "COMPLETED")))
      .limit(1);

    if (!latestRun.length) {
      return res.json({
        total_expected_payout: 0,
        total_at_risk: 0,
        delayed_count: 0,
        pending_count: 0,
      });
    }

    const runId = latestRun[0].id;

    const expectedPayoutRows = await db
      .select({
        total_expected_payout: sql<number>`coalesce(sum(${reconciliationsV0.expected_net_payout}), 0)`,
      })
      .from(reconciliationsV0)
      .where(eq(reconciliationsV0.run_id, runId));
    const total_expected_payout = Number(expectedPayoutRows?.[0]?.total_expected_payout ?? 0);

    const atRiskRows = await db
      .select({
        total_at_risk: sql<number>`coalesce(sum(${reconciliationsV0.expected_net_payout}), 0)`,
      })
      .from(reconciliationsV0)
      .where(
        and(
          eq(reconciliationsV0.run_id, runId),
          or(eq(reconciliationsV0.operational_status, "PENDING"), eq(reconciliationsV0.operational_status, "DELAYED")),
        ),
      );
    const total_at_risk = Number(atRiskRows?.[0]?.total_at_risk ?? 0);

    const delayedCountRows = await db
      .select({ delayed_count: sql<number>`count(${reconciliationsV0.id})` })
      .from(reconciliationsV0)
      .where(and(eq(reconciliationsV0.run_id, runId), eq(reconciliationsV0.operational_status, "DELAYED")));
    const delayed_count = Number(delayedCountRows?.[0]?.delayed_count ?? 0);

    const pendingCountRows = await db
      .select({ pending_count: sql<number>`count(${reconciliationsV0.id})` })
      .from(reconciliationsV0)
      .where(and(eq(reconciliationsV0.run_id, runId), eq(reconciliationsV0.operational_status, "PENDING")));
    const pending_count = Number(pendingCountRows?.[0]?.pending_count ?? 0);

    res.json({
      total_expected_payout,
      total_at_risk,
      delayed_count,
      pending_count,
    });
  } catch (error) {
    console.error("reconciliation summary error", error);
    res.status(500).json({ message: "Failed to fetch reconciliation summary" });
  }
});
router.put("/rate-cards-v2/:id", updateRateCardHandler);

const updateArchiveHandler = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { archived } = req.body ?? {};

    if (typeof archived !== "boolean") {
      return res.status(400).json({ message: "archived must be a boolean" });
    }

    const [card] = await db
      .select({
        id: rateCardsV2.id,
        platform_id: rateCardsV2.platform_id,
        category_id: rateCardsV2.category_id,
        commission_type: rateCardsV2.commission_type,
        commission_percent: rateCardsV2.commission_percent,
        effective_from: rateCardsV2.effective_from,
        effective_to: rateCardsV2.effective_to,
        archived: rateCardsV2.archived,
      })
      .from(rateCardsV2)
      .where(eq(rateCardsV2.id, id));

    if (!card) {
      return res.status(404).json({ message: "Rate card not found" });
    }

    if (!archived) {
      const [feesRows, slabRows] = await Promise.all([
        db
          .select({
            fee_code: rateCardFees.fee_code,
            fee_type: rateCardFees.fee_type,
            fee_value: rateCardFees.fee_value,
          })
          .from(rateCardFees)
          .where(eq(rateCardFees.rate_card_id, id)),
        db
          .select({
            min_price: rateCardSlabs.min_price,
            max_price: rateCardSlabs.max_price,
            commission_percent: rateCardSlabs.commission_percent,
          })
          .from(rateCardSlabs)
          .where(eq(rateCardSlabs.rate_card_id, id)),
      ]);

      const payload: Payload = {
        id,
        platform_id: card.platform_id,
        category_id: card.category_id,
        commission_type: card.commission_type === "tiered" ? "tiered" : "flat",
        commission_percent:
          card.commission_type === "flat"
            ? card.commission_percent === null || card.commission_percent === undefined
              ? null
              : Number(card.commission_percent)
            : null,
        slabs:
          card.commission_type === "tiered"
            ? slabRows.map((s) => ({
                min_price: Number(s.min_price ?? 0),
                max_price:
                  s.max_price === null || s.max_price === undefined ? null : Number(s.max_price),
                commission_percent: Number(s.commission_percent ?? 0),
              }))
            : [],
        fees: feesRows.map((f) => ({
          fee_code: f.fee_code,
          fee_type: f.fee_type === "amount" ? "amount" : "percent",
          fee_value: Number(f.fee_value ?? 0),
        })),
        effective_from: asDateString(card.effective_from)!,
        effective_to: asDateString(card.effective_to),
      };

      const existingCards = await loadExistingRateCards(db);
      const analysis = await analyzeRateCard(db, payload, {
        existingCards,
        includeArchivedForBlocking: true,
        tempId: id,
      });

      const validationMessages = analysis.errors.map(humanizeErrorMessage).filter(Boolean);
      let conflictMessage: string | undefined;

      if (analysis.overlap) {
        const existing = analysis.overlap.existing;
        const label = formatLabel(existing.platform_id, existing.category_id);
        const range = formatDateRange(existing.effective_from, existing.effective_to);
        conflictMessage =
          analysis.overlap.type === "exact"
            ? `Cannot restore: exact duplicate exists for ${label} (${range}).`
            : `Cannot restore: date range overlaps existing ${label} (${range}). Adjust dates first.`;
      }

      if (validationMessages.length || conflictMessage) {
        const message = conflictMessage ?? validationMessages.join("; ");
        return res.status(400).json({ message });
      }
    }

    await db
      .update(rateCardsV2)
      .set({ archived, updated_at: new Date() })
      .where(eq(rateCardsV2.id, id));

    res.json({ id, archived });
  } catch (error: any) {
    console.error("Archive update failed", error);
    res.status(500).json({ message: error?.message || "Failed to update rate card" });
  }
};

router.patch("/rate-cards/:id", updateArchiveHandler);
router.patch("/rate-cards-v2/:id", updateArchiveHandler);

// Delete a rate card (and its slabs/fees cascade)
router.delete("/rate-cards/:id", async (req, res) => {
  try {
    const { id } = req.params;

    // Delete cascades will remove related slabs/fees
    await db.delete(rateCardsV2).where(eq(rateCardsV2.id, id));

    res.json({ success: true, id });
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ message: e.message || "Failed to delete rate card" });
  }
});

// Add DELETE endpoint for rate-cards-v2 as well
router.delete("/rate-cards-v2/:id", async (req, res) => {
  try {
    const { id } = req.params;

    // Delete cascades will remove related slabs/fees
    await db.delete(rateCardsV2).where(eq(rateCardsV2.id, id));

    res.json({ success: true, id });
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ message: e.message || "Failed to delete rate card" });
  }
});

// Add the same endpoints for rate-cards-v2 path as well
router.get("/rate-cards-v2", async (_req, res) => {
  try {
    const rows = await db
      .select({
        id: rateCardsV2.id,
        platform_id: rateCardsV2.platform_id,
        category_id: rateCardsV2.category_id,
        commission_type: rateCardsV2.commission_type,
        commission_percent: rateCardsV2.commission_percent,
        archived: rateCardsV2.archived,
        gst_percent: rateCardsV2.gst_percent,
        tcs_percent: rateCardsV2.tcs_percent,
        settlement_basis: rateCardsV2.settlement_basis,
        t_plus_days: rateCardsV2.t_plus_days,
        weekly_weekday: rateCardsV2.weekly_weekday,
        bi_weekly_weekday: rateCardsV2.bi_weekly_weekday,
        bi_weekly_which: rateCardsV2.bi_weekly_which,
        monthly_day: rateCardsV2.monthly_day,
        grace_days: rateCardsV2.grace_days,
        effective_from: rateCardsV2.effective_from,
        effective_to: rateCardsV2.effective_to,
        global_min_price: rateCardsV2.global_min_price,
        global_max_price: rateCardsV2.global_max_price,
        notes: rateCardsV2.notes,
        created_at: rateCardsV2.created_at,
        updated_at: rateCardsV2.updated_at,
      })
      .from(rateCardsV2)
      .orderBy(desc(rateCardsV2.created_at));

    const { data, metrics } = transformRateCardV2Rows(rows as RateCardV2Row[]);

    res.json({ data, metrics });
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ message: e.message || "Failed to fetch rate cards" });
  }
});

router.get("/rate-cards-v2/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const [card] = await db.select().from(rateCardsV2).where(eq(rateCardsV2.id, id));

    if (!card) return res.status(404).json({ message: "Not found" });

    const from = card.effective_from ? new Date(card.effective_from) : new Date();
    const to = card.effective_to ? new Date(card.effective_to) : null;
    const today = new Date();

    let status = "active";
    if (from > today) status = "upcoming";
    else if (to && to < today) status = "expired";

    const slabsRaw = await db.select().from(rateCardSlabs).where(eq(rateCardSlabs.rate_card_id, id));
    const feesRaw = await db.select().from(rateCardFees).where(eq(rateCardFees.rate_card_id, id));

    const normalizedSlabs = slabsRaw.map((slab) => ({
      ...slab,
      min_price: slab.min_price === null ? null : Number(slab.min_price),
      max_price: slab.max_price === null ? null : Number(slab.max_price),
      commission_percent: slab.commission_percent === null ? null : Number(slab.commission_percent),
    }));

    const normalizedFees = feesRaw.map((fee) => ({
      ...fee,
      fee_value: fee.fee_value === null ? null : Number(fee.fee_value),
    }));

    res.json({
      ...card,
      commission_percent: card.commission_percent === null ? null : Number(card.commission_percent),
      gst_percent: card.gst_percent === null ? null : Number(card.gst_percent),
      tcs_percent: card.tcs_percent === null ? null : Number(card.tcs_percent),
      grace_days: card.grace_days === null ? 0 : Number(card.grace_days),
      global_min_price: card.global_min_price === null ? null : Number(card.global_min_price),
      global_max_price: card.global_max_price === null ? null : Number(card.global_max_price),
      archived: card.archived ?? false,
      status,
      slabs: normalizedSlabs,
      fees: normalizedFees,
    });
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ message: e.message || "Failed to fetch rate card" });
  }
});

router.post("/rate-cards-v2", async (req, res) => {
  try {
    const body = req.body;
    const sanitizedFees = prepareFees(body.fees ?? []);
    
    const [rc] = await db.insert(rateCardsV2).values({
      platform_id: body.platform_id,
      category_id: body.category_id,
      commission_type: body.commission_type,
      commission_percent: body.commission_percent,
      version_number: 1,
      gst_percent: body.gst_percent || "18",
      tcs_percent: body.tcs_percent || "1",
      settlement_basis: body.settlement_basis,
      t_plus_days: body.t_plus_days,
      weekly_weekday: body.weekly_weekday,
      bi_weekly_weekday: body.bi_weekly_weekday,
      bi_weekly_which: body.bi_weekly_which,
      monthly_day: body.monthly_day,
      grace_days: body.grace_days ?? 0,
      effective_from: body.effective_from,
      effective_to: body.effective_to,
      global_min_price: body.global_min_price,
      global_max_price: body.global_max_price,
      notes: body.notes,
    }).returning({ id: rateCardsV2.id });

    if (body.slabs?.length) {
      await db.insert(rateCardSlabs).values(
        body.slabs.map((s: any) => ({
          rate_card_id: rc.id,
          min_price: s.min_price.toString(),
          max_price: s.max_price ? s.max_price.toString() : null,
          commission_percent: s.commission_percent.toString(),
        }))
      );
    }
    
    if (sanitizedFees.length) {
      await db.insert(rateCardFees).values(
        sanitizedFees.map((f: any) => ({
          rate_card_id: rc.id,
          fee_code: f.fee_code,
          fee_type: f.fee_type,
          fee_value: f.fee_value.toString(),
        }))
      );
    }
    
    res.status(201).json({ id: rc.id });
  } catch (e: any) {
    console.error("Error creating rate card:", e);
    res.status(500).json({ message: e.message || "Failed to create rate card" });
  }
});

function toDateOnly(input: any): string {
  if (!input) return "";
  if (typeof input === "string" && /^\d{4}-\d{2}-\d{2}$/.test(input)) return input;
  if (typeof input === "string" && input.includes("T")) return input.slice(0, 10);
  if (input instanceof Date) return input.toISOString().slice(0, 10);
  return String(input).slice(0, 10);
}

// --- Batch reconciliation run (skeleton) ---
router.post("/reconciliation-runs", async (_req, res) => {
  let runId: string | null = null;
  let totalProcessed = 0;
  let affected = 0;
  let errorsCount = 0;
  let firstErrorMsg: string | null = null;
  try {
    const running = await db
      .select({ id: reconciliationRuns.id })
      .from(reconciliationRuns)
      .where(inArray(reconciliationRuns.status, ["RUNNING", "IN_PROGRESS"]))
      .limit(1);
    if (running.length) {
      return res.status(409).json({ message: "Reconciliation already in progress" });
    }

    // Capture current input fingerprint
    const ordersSnapshotResult = await db.execute(sql`
      SELECT COUNT(*)::int AS count, MAX(updated_at) AS last_updated
      FROM orders
    `);
    const [ordersSnapshot] = ((ordersSnapshotResult as any)?.rows ?? ordersSnapshotResult ?? []) as any[];

    const settlementsSnapshotResult = await db.execute(sql`
      SELECT COUNT(*)::int AS count, MAX(updated_at) AS last_updated
      FROM settlements
    `);
    const [settlementsSnapshot] = ((settlementsSnapshotResult as any)?.rows ?? settlementsSnapshotResult ?? []) as any[];

    const rateCardsSnapshotResult = await db.execute(sql`
      SELECT COUNT(*)::int AS count, MAX(updated_at) AS last_updated
      FROM rate_cards_v2
      WHERE archived = false
    `);
    const [rateCardsSnapshot] = ((rateCardsSnapshotResult as any)?.rows ?? rateCardsSnapshotResult ?? []) as any[];

    const currentFingerprint = {
      orders_count: ordersSnapshot?.count ?? 0,
      orders_last_updated: ordersSnapshot?.last_updated ?? null,
      settlements_count: settlementsSnapshot?.count ?? 0,
      settlements_last_updated: settlementsSnapshot?.last_updated ?? null,
      rate_cards_count: rateCardsSnapshot?.count ?? 0,
      rate_cards_last_updated: rateCardsSnapshot?.last_updated ?? null,
    };
    void currentFingerprint;
    const [lastRun] = await db
      .select()
      .from(reconciliationRuns)
      .where(eq(reconciliationRuns.status, "COMPLETED"))
      .orderBy(desc(reconciliationRuns.completed_at))
      .limit(1);
    const isSameFingerprint =
      lastRun &&
      (lastRun as any).input_orders_count === currentFingerprint.orders_count &&
      new Date((lastRun as any).input_orders_last_updated ?? 0).getTime() ===
        new Date(currentFingerprint.orders_last_updated ?? 0).getTime() &&
      (lastRun as any).input_settlements_count === currentFingerprint.settlements_count &&
      new Date((lastRun as any).input_settlements_last_updated ?? 0).getTime() ===
        new Date(currentFingerprint.settlements_last_updated ?? 0).getTime() &&
      (lastRun as any).input_rate_cards_count === currentFingerprint.rate_cards_count &&
      new Date((lastRun as any).input_rate_cards_last_updated ?? 0).getTime() ===
        new Date(currentFingerprint.rate_cards_last_updated ?? 0).getTime();
    void lastRun;

    if (isSameFingerprint) {
      const [skippedRun] = await db
        .insert(reconciliationRuns)
        .values({
          status: "SKIPPED",
          trigger_type: "MANUAL",
          created_at: new Date(),
          completed_at: new Date(),
          input_orders_count: currentFingerprint.orders_count,
          input_orders_last_updated: currentFingerprint.orders_last_updated,
          input_settlements_count: currentFingerprint.settlements_count,
          input_settlements_last_updated: currentFingerprint.settlements_last_updated,
          input_rate_cards_count: currentFingerprint.rate_cards_count,
          input_rate_cards_last_updated: currentFingerprint.rate_cards_last_updated,
        } as any)
        .returning({ id: reconciliationRuns.id });

      return res.json({
        run_id: skippedRun.id,
        status: "SKIPPED",
        message: "No input changes since last completed run",
      });
    }

    const [run] = await db
      .insert(reconciliationRuns)
      .values({
        trigger_type: "MANUAL",
        status: "IN_PROGRESS",
        is_latest: false,
        parent_run_id: null,
        created_at: new Date(),
        input_orders_count: currentFingerprint.orders_count,
        input_orders_last_updated: currentFingerprint.orders_last_updated,
        input_settlements_count: currentFingerprint.settlements_count,
        input_settlements_last_updated: currentFingerprint.settlements_last_updated,
        input_rate_cards_count: currentFingerprint.rate_cards_count,
        input_rate_cards_last_updated: currentFingerprint.rate_cards_last_updated,
      })
      .returning({ id: reconciliationRuns.id });
    runId = run.id;

    // Fetch orders with delivery_date present
    let recentOrders: any[] = [];
    try {
      recentOrders = await db
        .select()
        .from(orders)
        .where(isNotNull(orders.deliveryDate))
        .orderBy(desc(orders.createdAt));
    } catch (err) {
      console.warn("Orders table fetch not available, skipping reconciliation body", err);
      recentOrders = [];
    }

    totalProcessed = recentOrders.length;
    affected = 0;

    for (const order of recentOrders) {
      try {
        const order_id = ((order as any).orderId ?? (order as any).order_id ?? "").toString().trim();
        const marketplace = ((order as any).marketplace ?? "").toString().trim();
        const categoryRaw = ((order as any).category ?? "default").toString().trim();
        const category = categoryRaw || "default";
        if (!order_id) {
          throw new Error("Missing required order_id for batch reconciliation");
        }
        if (!marketplace) {
          throw new Error(`Missing required marketplace for order ${order_id}`);
        }
        if (!category) {
          throw new Error(`Missing required category for order ${order_id}`);
        }
        const orderDate =
          (order as any).dispatchDate ??
          (order as any).deliveryDate ??
          (order as any).createdAt ??
          new Date().toISOString().slice(0, 10);
        const deliveryDate =
          (order as any).deliveryDate ??
          (order as any).dispatchDate ??
          new Date().toISOString().slice(0, 10);

        const result = await reconcileOrder(db, {
          orderId: (order as any).orderId,
          marketplace: (order as any).marketplace,
          category: "default",
          selling_price: (order as any).sellingPrice,
          quantity: (order as any).quantity,
          orderDate: (order as any).dispatchDate,
          deliveryDate: (order as any).deliveryDate,
          actualPayoutDate: null,
        });

        const status = result.status;
        let operational_status: string = "PENDING";
        let reconciliation_state: string = "OVERDUE";
        if (status === "SETTLED") {
          operational_status = "SETTLED";
          reconciliation_state = "RECONCILED";
        } else if (status === "DELAYED") {
          operational_status = "DELAYED";
          reconciliation_state = "OVERDUE";
        } else if (status === "PENDING") {
          operational_status = "PENDING";
          reconciliation_state = "OVERDUE";
        }

        // Actual payout aggregation
        const actualAgg = await db
          .select({
            total: sql<number>`coalesce(sum(${settlements.actual_settlement_amount}), 0)`,
            count: sql<number>`count(${settlements.id})`,
            lastDate: sql<Date>`max(${settlements.payout_date})`,
          })
          .from(settlements)
          .where(
            and(
              eq(settlements.order_id, order_id),
              eq(settlements.marketplace, marketplace),
              eq(settlements.is_superseded, false),
              isNotNull(settlements.actual_settlement_amount),
            ),
          );

        const aggregateRow = actualAgg?.[0] ?? {};
        const total = (aggregateRow as any)?.total ?? 0;
        const count = (aggregateRow as any)?.count ?? 0;
        const lastDate = (aggregateRow as any)?.lastDate ?? null;

        const actual_payout_amount = Number(total) || 0;
        const settlement_rows_count = Number(count) || 0;
        const last_payout_date = lastDate;

        const expectedNet = Number(result.expected_net_payout ?? 0) || 0;
        const discrepancy_amount = expectedNet - actual_payout_amount;

        // Reconciliation state refinement
        if (settlement_rows_count > 0 && Math.abs(discrepancy_amount) >= 1) {
          reconciliation_state = "DISCREPANCY";
        } else if (operational_status === "PENDING" || operational_status === "DELAYED") {
          reconciliation_state = "OVERDUE";
        } else {
          reconciliation_state = "RECONCILED";
        }

        const normalizedOrderDate = toDateOnly(result.orderActivityDate);
        const normalizedDeliveryDate = toDateOnly(deliveryDate);
        const normalizedExpectedPayoutDate = toDateOnly(
          result.expectedPayoutDate ?? result.orderActivityDate,
        );
        const normalizedDelayThresholdDate = toDateOnly(
          result.delayThresholdDate ?? result.orderActivityDate,
        );
        const normalizedActualPayoutDate = null;

        const payload = {
          order_id,
          marketplace: result.marketplace,
          category: result.category,
          order_date: normalizedOrderDate,
          delivery_date: normalizedDeliveryDate,
          actual_payout_date: normalizedActualPayoutDate ? toDateOnly(normalizedActualPayoutDate) : null,
          rate_card_id: result.rateCardId ?? randomUUID(),
          settlement_anchor: "delivery_date",
          settlement_cycle: "",
          expected_payout_after_days: 0,
          grace_days: 0,
          expected_payout_date: normalizedExpectedPayoutDate,
          delay_threshold_date: normalizedDelayThresholdDate,
          reco_status: result.status,
          operational_status,
          reconciliation_state,
          run_id: runId,
          gross_order_value: result.gross_order_value ?? 0,
          expected_commission_amount: result.expected_commission_amount ?? 0,
          expected_platform_fee_amount: result.expected_platform_fee_amount ?? 0,
          expected_collection_fee_amount: result.expected_collection_fee_amount ?? 0,
          expected_total_deductions: result.expected_total_deductions ?? 0,
          expected_net_payout: result.expected_net_payout ?? 0,
          actual_payout_amount,
          discrepancy_amount,
          settlement_rows_count,
          last_payout_date,
        } as const;

        // Upsert by unique constraint (order_id, marketplace, run_id)
        await db
          .insert(reconciliationsV0)
          .values(payload as any)
          .onConflictDoUpdate({
            target: [reconciliationsV0.order_id, reconciliationsV0.marketplace, reconciliationsV0.run_id],
            set: payload as any,
          });
        affected += 1;
      } catch (err) {
        errorsCount += 1;
        if (!firstErrorMsg) {
          firstErrorMsg = (err as any)?.message ?? "unknown error";
        }
        console.error("Batch reconcile error", {
          order_id: (order as any).orderId ?? (order as any).order_id,
          marketplace: (order as any).marketplace,
          category: (order as any).category,
          deliveryDate: (order as any).deliveryDate ?? (order as any).delivery_date,
          err: err instanceof Error ? { message: err.message, stack: err.stack } : err,
        });
        // continue to next order
      }
    }

    if (errorsCount > 0 && affected === 0) {
      await db
        .update(reconciliationRuns)
        .set({
          status: "FAILED",
          failure_reason: firstErrorMsg ?? "unknown error",
          completed_at: new Date(),
          total_orders_processed: totalProcessed,
          affected_orders_count: affected,
        })
        .where(eq(reconciliationRuns.id, runId));

      return res.status(500).json({
        run_id: runId,
        status: "FAILED",
        total_orders_processed: totalProcessed,
        affected_orders_count: affected,
        failure_reason: firstErrorMsg ?? "unknown error",
      });
    }

    await db
      .update(reconciliationRuns)
      .set({
        status: "COMPLETED",
        completed_at: new Date(),
        total_orders_processed: totalProcessed,
        affected_orders_count: affected,
      })
      .where(eq(reconciliationRuns.id, runId));

    await db.update(reconciliationRuns).set({ is_latest: false }).where(eq(reconciliationRuns.is_latest, true));
    await db.update(reconciliationRuns).set({ is_latest: true }).where(eq(reconciliationRuns.id, runId));

    res.json({
      run_id: runId,
      status: "COMPLETED",
      total_orders_processed: totalProcessed,
      affected_orders_count: affected,
    });
  } catch (error: any) {
    console.error("reconciliation-runs error", error);
    if (runId) {
      await db
        .update(reconciliationRuns)
        .set({
          status: "FAILED",
          failure_reason: error?.message ?? "Failed reconciliation run",
          completed_at: new Date(),
        })
        .where(eq(reconciliationRuns.id, runId));
    }
    res.status(500).json({ message: "Failed to start reconciliation run" });
  }
});

// Settlement CSV upload (simple ingestion)
router.post("/settlements/upload", async (req, res) => {
  try {
    const { rows, marketplace } = req.body ?? {};
    if (!Array.isArray(rows) || !rows.length) {
      return res.status(400).json({ error: "No rows provided" });
    }
    const uploadBatchId = randomUUID();
    const sanitizeNumber = (val: any) => {
      const n = Number(val);
      return Number.isFinite(n) ? n : null;
    };
    const sanitizeDate = (val: any) => {
      if (!val) return null;
      const d = new Date(val);
      return Number.isNaN(d.valueOf()) ? null : d.toISOString().slice(0, 10);
    };

    const toInsert = rows.map((row: any) => ({
      order_id: row.order_id ?? row.orderId ?? null,
      utr_number: row.utr_number ?? row.utrNumber ?? null,
      payout_date: sanitizeDate(row.payout_date ?? row.payoutDate),
      actual_settlement_amount: sanitizeNumber(row.actual_settlement_amount ?? row.paid_amount ?? row.paidAmount),
      expected_amount: sanitizeNumber(row.expected_amount),
      paid_amount: sanitizeNumber(row.paid_amount),
      commission: sanitizeNumber(row.commission),
      shipping_fee: sanitizeNumber(row.shipping_fee),
      rto_fee: sanitizeNumber(row.rto_fee),
      packaging_fee: sanitizeNumber(row.packaging_fee),
      fixed_fee: sanitizeNumber(row.fixed_fee),
      gst: sanitizeNumber(row.gst),
      order_status: row.order_status ?? null,
      marketplace: (row.marketplace ?? marketplace) || null,
      upload_batch_id: uploadBatchId,
      is_superseded: false,
    }));

    const inserted = await db.insert(settlements).values(toInsert).returning({ id: settlements.id });

    // Supersede older rows for same marketplace + order_ids
    const orderIds = Array.from(new Set(toInsert.map((r) => r.order_id).filter(Boolean)));
    const marketplaceForSupersede = marketplace || null;
    if (orderIds.length && marketplaceForSupersede) {
      await db
        .update(settlements)
        .set({ is_superseded: true })
        .where(
          and(
            eq(settlements.marketplace, marketplaceForSupersede),
            inArray(settlements.order_id, orderIds),
            ne(settlements.upload_batch_id, uploadBatchId),
          ),
        );
    }

    res.json({
      message: "Settlements uploaded",
      processed: inserted.length,
      upload_batch_id: uploadBatchId,
    });
  } catch (error: any) {
    console.error("settlements upload error", error);
    res.status(500).json({ error: error?.message || "Failed to upload settlements" });
  }
});

// Fetch settlement rows (limited) for a given order/marketplace
router.get("/settlements", async (req, res) => {
  try {
    const { order_id, marketplace, limit: limitRaw } = req.query as Record<string, string>;
    if (!order_id) {
      return res.status(400).json({ message: "order_id required" });
    }
    const limit = Math.min(Number(limitRaw) || 3, 50);
    const whereClauses: any[] = [eq(settlements.order_id, order_id), eq(settlements.is_superseded, false)];
    if (marketplace) whereClauses.push(eq(settlements.marketplace, marketplace));

    const rows = await db
      .select({
        id: settlements.id,
        order_id: settlements.order_id,
        marketplace: settlements.marketplace,
        utr_number: settlements.utr_number,
        payout_date: settlements.payout_date,
        actual_settlement_amount: settlements.actual_settlement_amount,
      })
      .from(settlements)
      .where(and(...whereClauses))
      .orderBy(desc(settlements.payout_date))
      .limit(limit);

    res.json({ rows });
  } catch (error: any) {
    console.error("fetch settlements error", error);
    res.status(500).json({ message: "Failed to fetch settlements" });
  }
});

export default router;
