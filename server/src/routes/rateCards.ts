import { Router } from "express";
import { randomUUID } from "crypto";
import { z } from "zod";
import { db } from "../../storage";
import { rateCardsV2, rateCardSlabs, rateCardFees } from "@shared/schema";
import { eq } from "drizzle-orm";
import multer from "multer";
import { parse } from "csv-parse/sync";

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

function asDateString(value: string | Date | null | undefined) {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  const str = String(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  return new Date(str).toISOString().slice(0, 10);
}

function toNumber(value: any) {
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

function detectOverlap(
  card: NormalizedCard,
  others: NormalizedCard[]
): OverlapResult | null {
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
  }
): Promise<RateCardAnalysis> {
  const errors: string[] = [];

  const normalized: NormalizedCard = {
    id: body.id ?? options?.tempId ?? null,
    platform_id: body.platform_id,
    category_id: body.category_id,
    commission_type: body.commission_type,
    commission_percent:
      body.commission_type === "flat"
        ? toNumber(body.commission_percent) ?? 0
        : null,
    slabs: body.commission_type === "tiered" ? prepareSlabs(body.slabs ?? []) : [],
    fees: prepareFees(body.fees ?? []),
    effective_from: body.effective_from,
    effective_to: body.effective_to ?? null,
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

  const referenceCards = [
    ...((options?.existingCards ?? (await loadExistingRateCards(dbInstance))))
  ];
  if (options?.additionalCards?.length) {
    referenceCards.push(...options.additionalCards);
  }

  const overlap = detectOverlap(normalized, referenceCards);

  return {
    errors,
    overlap,
    normalized,
  };
}

export async function validateRateCard(dbInstance: any, body: Payload) {
  const analysis = await analyzeRateCard(dbInstance, body);
  const errs = [...analysis.errors];

  if (analysis.overlap) {
    errs.push(analysis.overlap.reason);
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

  if (Array.isArray(payload.fees) && payload.fees.length > 0) {
    await db.insert(rateCardFees).values(
      payload.fees.map((f: any) => ({
        rate_card_id: rc.id,
        fee_code: f.fee_code,
        fee_type: f.fee_type,
        fee_value: Number(f.fee_value ?? 0),
      })) as any[]
    );
  }

  return rc.id;
}

const upload = multer(); // in-memory storage

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

// CSV template (download) - MUST be before /:id route to avoid conflicts
router.get("/rate-cards/template.csv", async (_req, res) => {
  // Columns:
  // - slabs_json, fees_json are JSON arrays as strings (see example row)
  const header = [
    "platform_id","category_id","commission_type","commission_percent",
    "slabs_json","fees_json",
    "gst_percent","tcs_percent",
    "settlement_basis","t_plus_days","weekly_weekday","bi_weekly_weekday","bi_weekly_which","monthly_day","grace_days",
    "effective_from","effective_to","global_min_price","global_max_price","notes"
  ].join(",");

  const example = [
    "amazon","apparel","flat","12",
    '[]',
    '[{"fee_code":"shipping","fee_type":"percent","fee_value":3},{"fee_code":"rto","fee_type":"percent","fee_value":1}]',
    "18","1",
    "t_plus","7","","","","","2",
    "2025-08-01","","0","","Example flat commission"
  ].join(",");

  const exampleTiered = [
    "flipkart","electronics","tiered","",
    '[{"min_price":0,"max_price":500,"commission_percent":5},{"min_price":500,"max_price":null,"commission_percent":7}]',
    '[{"fee_code":"shipping","fee_type":"amount","fee_value":30},{"fee_code":"tech","fee_type":"percent","fee_value":1}]',
    "18","1",
    "weekly","","5","","","","1",
    "2025-09-01","2025-12-31","","","Tiered example"
  ].join(",");

  const csv = [header, example, exampleTiered].join("\n");
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", "attachment; filename=rate-card-template.csv");
  res.send(csv);
});

// CSV parse (dry run) route
router.post("/rate-cards/parse", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const csvData = req.file.buffer.toString("utf-8");
    const records = parseCsvData(csvData);

    const existingCards = await loadExistingRateCards(db);
    const stagedCards: NormalizedCard[] = [];

    const results: ParsedUploadRow[] = [];

    let validCount = 0;
    let similarCount = 0;
    let duplicateCount = 0;
    let errorCount = 0;

    for (let i = 0; i < records.length; i++) {
      const row = records[i] as Record<string, any>;
      const rowNum = i + 2; // header + 1-indexed rows

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
          commission_type: commissionType,
          commission_percent:
            commissionType === "flat" && commissionPercentValue !== null
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
        if (!payload.platform_id) issues.push("platform_id is required");
        if (!payload.category_id) issues.push("category_id is required");
        if (!payload.commission_type) issues.push("commission_type is required");
        if (
          payload.commission_type &&
          !["flat", "tiered"].includes(payload.commission_type)
        ) {
          issues.push("commission_type must be 'flat' or 'tiered'");
        }
        if (!payload.settlement_basis) issues.push("settlement_basis is required");
        if (!payload.effective_from) issues.push("effective_from is required");

        const analysis = await analyzeRateCard(db, payload, {
          existingCards,
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

        results.push({
          rowId: "", // placeholder, filled after loop
          row: rowNum,
          status,
          message,
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
          message: error.message || "Unknown error",
          platform_id: platformId,
          category_id: categoryId,
          commission_type: commissionType,
          effective_from: effectiveFrom,
          effective_to: effectiveTo,
        });
      }
    }

    const totalRows = records.length;
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
        platform_id: row.platform_id,
        category_id: row.category_id,
        commission_type: row.commission_type,
        effective_from: row.effective_from,
        effective_to: row.effective_to,
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

router.post("/rate-cards/import", async (req, res) => {
  try {
    const { analysis_id: analysisId, row_ids: rowIds, include_similar: includeSimilar } = req.body ?? {};

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

      if (!entry.payload) {
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

      const payload = entry.payload;
      try {
        const analysis = await analyzeRateCard(db, payload, {
          existingCards,
          additionalCards: staged,
          tempId: `confirm-${i}`,
        });

        const issues = [...analysis.errors];

        if (analysis.overlap) {
          if (analysis.overlap.type === "exact") {
            issues.push(analysis.overlap.reason);
          } else if (!allowSimilar) {
            issues.push(analysis.overlap.reason);
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
    const today = new Date();

    const PLATFORM_LABELS = { amazon: "Amazon", flipkart: "Flipkart", myntra: "Myntra", ajio: "AJIO", quick: "Quick Commerce" };
    const CATEGORY_LABELS = { apparel: "Apparel", electronics: "Electronics", beauty: "Beauty", home: "Home" };

    const enriched = cards.map((c: any) => {
      const from = new Date(c.effective_from);
      const to = c.effective_to ? new Date(c.effective_to) : null;
      let status = "active";
      if (from > today) status = "upcoming";
      else if (to && to < today) status = "expired";

      return {
        ...c,
        status,
        platform_name:
          PLATFORM_LABELS[c.platform_id as keyof typeof PLATFORM_LABELS] ?? c.platform_id,
        category_name:
          CATEGORY_LABELS[c.category_id as keyof typeof CATEGORY_LABELS] ?? c.category_id,
      };
    });

    // counts
    const total = enriched.length;
    const active = enriched.filter((c) => c.status === "active").length;
    const expired = enriched.filter((c) => c.status === "expired").length;
    const upcoming = enriched.filter((c) => c.status === "upcoming").length;

    // average commission for FLAT cards only
    const flatCards = enriched.filter(
      (c) => c.commission_type === "flat" && typeof c.commission_percent === "number"
    );
    const flatSum = flatCards.reduce((sum, c) => sum + Number(c.commission_percent || 0), 0);
    const flatCount = flatCards.length;
    const avgFlat = flatCount ? flatSum / flatCount : 0;

    res.json({
      data: enriched,
      metrics: {
        total, active, expired, upcoming,
        avg_flat_commission: Number(avgFlat.toFixed(2)),
        flat_count: flatCount
      }
    });
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

// Create new rate card
router.post("/rate-cards", async (req, res) => {
  try {
    const body = req.body;

    // 🔒 validate before writing
    await validateRateCard(db, body);

    const [rc] = await db.insert(rateCardsV2).values({
      platform_id: body.platform_id,
      category_id: body.category_id,
      commission_type: body.commission_type,
      commission_percent: body.commission_percent,
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
      global_min_price: body.global_min_price,
      global_max_price: body.global_max_price,
      notes: body.notes,
    }).returning({ id: rateCardsV2.id });

    if (body.slabs?.length) {
      await db.insert(rateCardSlabs).values(
        body.slabs.map((s: any) => ({
          rate_card_id: rc.id, 
          min_price: s.min_price, 
          max_price: s.max_price, 
          commission_percent: s.commission_percent,
        }))
      );
    }
    if (body.fees?.length) {
      await db.insert(rateCardFees).values(
        body.fees.map((f: any) => ({
          rate_card_id: rc.id, 
          fee_code: f.fee_code, 
          fee_type: f.fee_type, 
          fee_value: f.fee_value,
        }))
      );
    }
    res.status(201).json({ id: rc.id });
  } catch (e: any) {
    console.error(e);
    res.status(e.statusCode || 500).json({ message: e.message || "Failed to create rate card" });
  }
});

// Update rate card
router.put("/rate-cards", async (req, res) => {
  try {
    const body = req.body;
    const id = body.id;
    if (!id) return res.status(400).json({ message: "id required" });

    // 🔒 validate before writing (pass id to skip self in overlap check)
    await validateRateCard(db, { ...body, id });

    await db.update(rateCardsV2).set({
      platform_id: body.platform_id,
      category_id: body.category_id,
      commission_type: body.commission_type,
      commission_percent: body.commission_percent,
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
      global_min_price: body.global_min_price,
      global_max_price: body.global_max_price,
      notes: body.notes,
    }).where(eq(rateCardsV2.id, id));

    await db.delete(rateCardSlabs).where(eq(rateCardSlabs.rate_card_id, id));
    await db.delete(rateCardFees).where(eq(rateCardFees.rate_card_id, id));

    if (body.slabs?.length) {
      await db.insert(rateCardSlabs).values(
        body.slabs.map((s: any) => ({
          rate_card_id: id, 
          min_price: s.min_price, 
          max_price: s.max_price, 
          commission_percent: s.commission_percent,
        }))
      );
    }
    if (body.fees?.length) {
      await db.insert(rateCardFees).values(
        body.fees.map((f: any) => ({
          rate_card_id: id, 
          fee_code: f.fee_code, 
          fee_type: f.fee_type, 
          fee_value: f.fee_value,
        }))
      );
    }
    res.json({ id });
  } catch (e: any) {
    console.error(e);
    res.status(e.statusCode || 500).json({ message: e.message || "Failed to update rate card" });
  }
});

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
router.get("/rate-cards-v2", async (req, res) => {
  try {
    // For now, fallback to in-memory storage to avoid database connection issues
    const { storage } = await import("../../storage");
    const cards = await storage.getRateCards();
    const today = new Date();

    const enriched = cards.map((c: any) => {
      let status = "active";
      const from = new Date(c.effective_from);
      const to = c.effective_to ? new Date(c.effective_to) : null;

      if (from > today) status = "upcoming";
      else if (to && to < today) status = "expired";

      return { ...c, status };
    });

    // counts
    const total = enriched.length;
    const active = enriched.filter((c: any) => c.status === "active").length;
    const expired = enriched.filter((c: any) => c.status === "expired").length;
    const upcoming = enriched.filter((c: any) => c.status === "upcoming").length;

    // average commission for cards with commission_rate (treating all as flat-style)
    const flatCards = enriched.filter(
      (c: any) => c.commission_rate !== null && c.commission_rate !== undefined && Number(c.commission_rate) > 0
    );
    const flatSum = flatCards.reduce((sum: number, c: any) => sum + Number(c.commission_rate), 0);
    const flatCount = flatCards.length;
    const avgFlat = flatCount > 0 ? flatSum / flatCount : 0;

    res.json({
      data: enriched,
      metrics: {
        total,
        active,
        expired,
        upcoming,
        avg_flat_commission: Number(avgFlat.toFixed(2)),
        flat_count: flatCount
      }
    });
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

router.post("/rate-cards-v2", async (req, res) => {
  try {
    const body = req.body;
    
    const [rc] = await db.insert(rateCardsV2).values({
      platform_id: body.platform_id,
      category_id: body.category_id,
      commission_type: body.commission_type,
      commission_percent: body.commission_percent,
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
    
    if (body.fees?.length) {
      await db.insert(rateCardFees).values(
        body.fees.map((f: any) => ({
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

export default router;