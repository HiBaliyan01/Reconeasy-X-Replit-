import { Router, type Request, type Response } from "express";
import multer from "multer";
import { createHash, randomUUID } from "crypto";
import { db, pool } from "../db";
import { reconcileOrder } from "../src/reconciliation/reconcileOrder";
import { buildCalculationBreakdown } from "../src/reconciliation/buildCalculationBreakdown";

type CursorShape = {
  dispatchDate: string;
  orderId: string;
};

type MissingPaymentRule = {
  t_plus_days: number;
  grace_days: number;
};

type MissingPaymentRules = Record<string, MissingPaymentRule>;

type LeakageSensitivity = {
  minimum_discrepancy_amount: number;
  ignore_rounding_differences: boolean;
  rounding_tolerance_amount: number;
};

type ReconciliationSettings = {
  id: string;
  tenant_id: string;
  missing_payment_rules: MissingPaymentRules;
  leakage_sensitivity: LeakageSensitivity;
  rate_card_conflict_behavior: "warn_only" | "require_approval";
  created_at?: string;
  updated_at?: string;
};

type AuditLogModule =
  | "rate_cards"
  | "reconciliation_settings"
  | "claims"
  | "uploads"
  | "users";

type AuditLogStatus = "success" | "failed";

type PaymentStatus =
  | "SETTLED"
  | "DATA_INCOMPLETE"
  | "NOT_DUE_YET"
  | "MISSING_PAYMENT"
  | "SETTLEMENT_NOT_UPLOADED";

type MissingPaymentRateCard = {
  id?: string | null;
  platform_id: string;
  category_id: string | null;
  t_plus_days: number | null;
  grace_days: number | null;
  effective_from: string | Date | null;
  effective_to: string | Date | null;
  created_at?: string | Date | null;
};

type MissingPaymentUploadedFile = {
  marketplace: string;
  settlement_start_date: string | Date;
  settlement_end_date: string | Date;
  file_name: string | null;
  status?: string | null;
};

type MissingPaymentCandidateOrder = {
  order_id: string;
  marketplace: string;
  category_id: string | null;
  delivery_date: string | Date | null;
  has_settlement: boolean;
  selling_price?: number | string | null;
  sku?: string | null;
  dispatch_date?: string | Date | null;
};

type MissingPaymentEvaluation = {
  payment_status: PaymentStatus;
  expected_payout_date: Date | null;
  expected_payout_with_grace: Date | null;
  t_plus_days: number | null;
  grace_days: number | null;
  days_overdue: number | null;
  rate_card_configured: boolean;
  rate_card_id: string | null;
  settlement_file_name: string | null;
  settlement_file_start_date: Date | null;
  settlement_file_end_date: Date | null;
  settlement_reference_type: "COVERING_UPLOAD" | "NONE";
  effective_delivery_date: Date | null;
};

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

const DEFAULT_MISSING_PAYMENT_RULES: MissingPaymentRules = {
  amazon: { t_plus_days: 7, grace_days: 0 },
  flipkart: { t_plus_days: 7, grace_days: 2 },
  myntra: { t_plus_days: 15, grace_days: 2 },
  meesho: { t_plus_days: 7, grace_days: 0 },
  nykaa: { t_plus_days: 7, grace_days: 0 },
};

const DEFAULT_LEAKAGE_SENSITIVITY: LeakageSensitivity = {
  minimum_discrepancy_amount: 10,
  ignore_rounding_differences: true,
  rounding_tolerance_amount: 1,
};

function asNumber(value: unknown): number {
  const num = Number(value ?? 0);
  return Number.isFinite(num) ? num : 0;
}

function nullableNumeric(value: unknown): number | null {
  if (value === undefined || value === null || value === "") return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function parseLimit(input: unknown): number {
  const parsed = Number(input ?? 100);
  if (!Number.isFinite(parsed) || parsed <= 0) return 100;
  return Math.min(parsed, 200);
}

function parseCursor(input: unknown): CursorShape | null {
  if (typeof input !== "string" || !input.trim()) return null;

  const raw = input.trim();
  const parseCandidate = (candidate: string): CursorShape | null => {
    try {
      const parsed = JSON.parse(candidate);
      if (
        parsed &&
        typeof parsed.dispatchDate === "string" &&
        typeof parsed.orderId === "string"
      ) {
        return { dispatchDate: parsed.dispatchDate, orderId: parsed.orderId };
      }
    } catch {
      return null;
    }
    return null;
  };

  const direct = parseCandidate(raw);
  if (direct) return direct;

  try {
    const decoded = Buffer.from(raw, "base64").toString("utf8");
    return parseCandidate(decoded);
  } catch {
    return null;
  }
}

function normalizeMissingPaymentRules(value: unknown): MissingPaymentRules {
  const raw = value && typeof value === "object" ? (value as Record<string, any>) : {};
  const normalized: MissingPaymentRules = { ...DEFAULT_MISSING_PAYMENT_RULES };

  for (const [marketplace, defaults] of Object.entries(DEFAULT_MISSING_PAYMENT_RULES)) {
    const candidate = raw?.[marketplace];
    normalized[marketplace] = {
      t_plus_days: Math.max(1, Math.min(60, asNumber(candidate?.t_plus_days || defaults.t_plus_days))),
      grace_days: Math.max(0, Math.min(14, asNumber(candidate?.grace_days ?? defaults.grace_days))),
    };
  }

  return normalized;
}

function normalizeLeakageSensitivity(value: unknown): LeakageSensitivity {
  const raw = value && typeof value === "object" ? (value as Record<string, any>) : {};
  return {
    minimum_discrepancy_amount: asNumber(
      raw.minimum_discrepancy_amount ?? DEFAULT_LEAKAGE_SENSITIVITY.minimum_discrepancy_amount,
    ),
    ignore_rounding_differences:
      typeof raw.ignore_rounding_differences === "boolean"
        ? raw.ignore_rounding_differences
        : DEFAULT_LEAKAGE_SENSITIVITY.ignore_rounding_differences,
    rounding_tolerance_amount: asNumber(
      raw.rounding_tolerance_amount ?? DEFAULT_LEAKAGE_SENSITIVITY.rounding_tolerance_amount,
    ),
  };
}

function normalizeMarketplaceKey(value: string | null | undefined): string {
  return String(value ?? "").trim().toLowerCase();
}

function coerceDate(value: unknown): Date | null {
  if (!value) return null;
  const parsed = new Date(String(value));
  if (Number.isNaN(parsed.getTime())) return null;
  parsed.setHours(0, 0, 0, 0);
  return parsed;
}

function addDays(date: Date, days: number): Date {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function diffDays(later: Date, earlier: Date): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.floor((later.getTime() - earlier.getTime()) / msPerDay);
}

function buildRateCardLookup(
  rows: Record<string, any>[],
): Map<string, MissingPaymentRateCard[]> {
  const lookup = new Map<string, MissingPaymentRateCard[]>();

  for (const row of rows) {
    const platform = normalizeMarketplaceKey(row.platform_id);
    const category = String(row.category_id ?? "").trim().toLowerCase();
    const key = `${platform}:${category}`;
    const bucket = lookup.get(key) ?? [];
    bucket.push({
      id: row.id ?? null,
      platform_id: platform,
      category_id: row.category_id ?? null,
      t_plus_days: nullableNumeric(row.t_plus_days),
      grace_days: nullableNumeric(row.grace_days),
      effective_from: row.effective_from ?? null,
      effective_to: row.effective_to ?? null,
      created_at: row.created_at ?? null,
    });
    lookup.set(key, bucket);
  }

  Array.from(lookup.values()).forEach((bucket) => {
    bucket.sort((a: MissingPaymentRateCard, b: MissingPaymentRateCard) => {
      const aEffectiveFrom = coerceDate(a.effective_from)?.getTime() ?? 0;
      const bEffectiveFrom = coerceDate(b.effective_from)?.getTime() ?? 0;
      if (aEffectiveFrom !== bEffectiveFrom) return bEffectiveFrom - aEffectiveFrom;
      const aCreatedAt = coerceDate(a.created_at)?.getTime() ?? 0;
      const bCreatedAt = coerceDate(b.created_at)?.getTime() ?? 0;
      return bCreatedAt - aCreatedAt;
    });
  });

  return lookup;
}

function selectApplicableRateCard(
  order: MissingPaymentCandidateOrder,
  rateCardLookup: Map<string, MissingPaymentRateCard[]>,
): MissingPaymentRateCard | null {
  const deliveryDate = coerceDate(order.delivery_date);
  if (!deliveryDate) return null;

  const marketplace = normalizeMarketplaceKey(order.marketplace);
  const category = String(order.category_id ?? "").trim().toLowerCase();
  const candidateKeys = [`${marketplace}:${category}`, `${marketplace}:default`, `${marketplace}:`];

  for (const key of candidateKeys) {
    const cards = rateCardLookup.get(key) ?? [];
    const match = cards.find((card) => {
      const effectiveFrom = coerceDate(card.effective_from);
      const effectiveTo = coerceDate(card.effective_to);
      if (effectiveFrom && effectiveFrom.getTime() > deliveryDate.getTime()) return false;
      if (effectiveTo && effectiveTo.getTime() < deliveryDate.getTime()) return false;
      return true;
    });

    if (match) {
      return match;
    }
  }

  return null;
}

function calculateExpectedPayoutDate(
  order: MissingPaymentCandidateOrder,
  rateCardLookup: Map<string, MissingPaymentRateCard[]>,
  missingPaymentRules: MissingPaymentRules,
): {
  expectedPayoutDate: Date | null;
  tPlusDays: number | null;
  graceDays: number | null;
  rateCardConfigured: boolean;
  rateCardId: string | null;
} {
  const deliveryDate = coerceDate(order.delivery_date);
  if (!deliveryDate) {
    return {
      expectedPayoutDate: null,
      tPlusDays: null,
      graceDays: null,
      rateCardConfigured: false,
      rateCardId: null,
    };
  }

  const rateCard = selectApplicableRateCard(order, rateCardLookup);
  if (rateCard?.t_plus_days !== null && rateCard?.t_plus_days !== undefined) {
    const tPlusDays = Number(rateCard.t_plus_days);
    const graceDays = Number(rateCard.grace_days ?? 0);
    return {
      expectedPayoutDate: addDays(deliveryDate, tPlusDays + graceDays),
      tPlusDays,
      graceDays,
      rateCardConfigured: true,
      rateCardId: rateCard.id ?? null,
    };
  }

  const marketplaceRule = missingPaymentRules[normalizeMarketplaceKey(order.marketplace)];
  if (marketplaceRule && marketplaceRule.t_plus_days !== null && marketplaceRule.t_plus_days !== undefined) {
    const tPlusDays = Number(marketplaceRule.t_plus_days);
    const graceDays = Number(marketplaceRule.grace_days ?? 0);
    return {
      expectedPayoutDate: addDays(deliveryDate, tPlusDays + graceDays),
      tPlusDays,
      graceDays,
      rateCardConfigured: false,
      rateCardId: null,
    };
  }

  return {
    expectedPayoutDate: null,
    tPlusDays: null,
    graceDays: null,
    rateCardConfigured: false,
    rateCardId: null,
  };
}

function getSettlementCoverage(
  marketplace: string,
  expectedPayoutDate: Date | null,
  uploadedFiles: MissingPaymentUploadedFile[],
): MissingPaymentUploadedFile | null {
  if (!expectedPayoutDate) return null;

  const normalizedMarketplace = normalizeMarketplaceKey(marketplace);
  return (
    uploadedFiles.find((file) => {
      if (normalizeMarketplaceKey(file.marketplace) !== normalizedMarketplace) return false;
      const start = coerceDate(file.settlement_start_date);
      const end = coerceDate(file.settlement_end_date);
      if (!start || !end) return false;
      return start.getTime() <= expectedPayoutDate.getTime() && end.getTime() >= expectedPayoutDate.getTime();
    }) ?? null
  );
}

function evaluateMissingPayment(
  order: MissingPaymentCandidateOrder,
  rateCardLookup: Map<string, MissingPaymentRateCard[]>,
  missingPaymentRules: MissingPaymentRules,
  uploadedFiles: MissingPaymentUploadedFile[],
): MissingPaymentEvaluation {
  const deliveryDate = coerceDate(order.delivery_date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (!deliveryDate) {
    return {
      payment_status: "DATA_INCOMPLETE",
      expected_payout_date: null,
      expected_payout_with_grace: null,
      t_plus_days: null,
      grace_days: null,
      days_overdue: null,
      rate_card_configured: false,
      rate_card_id: null,
      settlement_file_name: null,
      settlement_file_start_date: null,
      settlement_file_end_date: null,
      settlement_reference_type: "NONE",
      effective_delivery_date: null,
    };
  }

  if (order.has_settlement) {
    const timing = calculateExpectedPayoutDate(order, rateCardLookup, missingPaymentRules);
    const settlementCoverage = getSettlementCoverage(order.marketplace, timing.expectedPayoutDate, uploadedFiles);
    return {
      payment_status: "SETTLED",
      expected_payout_date: timing.expectedPayoutDate,
      expected_payout_with_grace: timing.expectedPayoutDate,
      t_plus_days: timing.tPlusDays,
      grace_days: timing.graceDays,
      days_overdue:
        timing.expectedPayoutDate && today.getTime() > timing.expectedPayoutDate.getTime()
          ? diffDays(today, timing.expectedPayoutDate)
          : 0,
      rate_card_configured: timing.rateCardConfigured,
      rate_card_id: timing.rateCardId,
      settlement_file_name: settlementCoverage?.file_name ?? null,
      settlement_file_start_date: coerceDate(settlementCoverage?.settlement_start_date),
      settlement_file_end_date: coerceDate(settlementCoverage?.settlement_end_date),
      settlement_reference_type: settlementCoverage ? "COVERING_UPLOAD" : "NONE",
      effective_delivery_date: deliveryDate,
    };
  }

  const timing = calculateExpectedPayoutDate(order, rateCardLookup, missingPaymentRules);
  if (!timing.expectedPayoutDate || timing.tPlusDays === null) {
    return {
      payment_status: "DATA_INCOMPLETE",
      expected_payout_date: null,
      expected_payout_with_grace: null,
      t_plus_days: timing.tPlusDays,
      grace_days: timing.graceDays,
      days_overdue: null,
      rate_card_configured: timing.rateCardConfigured,
      rate_card_id: timing.rateCardId,
      settlement_file_name: null,
      settlement_file_start_date: null,
      settlement_file_end_date: null,
      settlement_reference_type: "NONE",
      effective_delivery_date: deliveryDate,
    };
  }

  if (today.getTime() <= timing.expectedPayoutDate.getTime()) {
    return {
      payment_status: "NOT_DUE_YET",
      expected_payout_date: timing.expectedPayoutDate,
      expected_payout_with_grace: timing.expectedPayoutDate,
      t_plus_days: timing.tPlusDays,
      grace_days: timing.graceDays,
      days_overdue: 0,
      rate_card_configured: timing.rateCardConfigured,
      rate_card_id: timing.rateCardId,
      settlement_file_name: null,
      settlement_file_start_date: null,
      settlement_file_end_date: null,
      settlement_reference_type: "NONE",
      effective_delivery_date: deliveryDate,
    };
  }

  const settlementCoverage = getSettlementCoverage(order.marketplace, timing.expectedPayoutDate, uploadedFiles);
  return {
    payment_status: settlementCoverage ? "MISSING_PAYMENT" : "SETTLEMENT_NOT_UPLOADED",
    expected_payout_date: timing.expectedPayoutDate,
    expected_payout_with_grace: timing.expectedPayoutDate,
    t_plus_days: timing.tPlusDays,
    grace_days: timing.graceDays,
    days_overdue: diffDays(today, timing.expectedPayoutDate),
    rate_card_configured: timing.rateCardConfigured,
    rate_card_id: timing.rateCardId,
    settlement_file_name: settlementCoverage?.file_name ?? null,
    settlement_file_start_date: coerceDate(settlementCoverage?.settlement_start_date),
    settlement_file_end_date: coerceDate(settlementCoverage?.settlement_end_date),
    settlement_reference_type: settlementCoverage ? "COVERING_UPLOAD" : "NONE",
    effective_delivery_date: deliveryDate,
  };
}

function normalizeReconciliationSettingsRow(row: Record<string, any>): ReconciliationSettings {
  return {
    ...row,
    missing_payment_rules: normalizeMissingPaymentRules(row.missing_payment_rules),
    leakage_sensitivity: normalizeLeakageSensitivity(row.leakage_sensitivity),
    rate_card_conflict_behavior:
      row.rate_card_conflict_behavior === "require_approval" ? "require_approval" : "warn_only",
  } as ReconciliationSettings;
}

async function getOrCreateReconciliationSettings(tenantId: string): Promise<ReconciliationSettings> {
  const existing = await pool.query(
    `SELECT * FROM reconciliation_settings WHERE tenant_id = $1`,
    [tenantId],
  );

  if (existing.rows[0]) {
    return normalizeReconciliationSettingsRow(existing.rows[0]);
  }

  const inserted = await pool.query(
    `INSERT INTO reconciliation_settings (tenant_id)
     VALUES ($1)
     RETURNING *`,
    [tenantId],
  );

  return normalizeReconciliationSettingsRow(inserted.rows[0]);
}

export async function logAuditEvent(params: {
  tenantId: string;
  userProfileId?: string | null;
  userName?: string | null;
  action: string;
  module: AuditLogModule;
  entityType?: string;
  entityId?: string;
  description: string;
  metadata?: Record<string, any>;
  status?: AuditLogStatus;
}) {
  try {
    await pool.query(
      `INSERT INTO audit_log (
        tenant_id, user_profile_id, user_name, action, module,
        entity_type, entity_id, description, metadata, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        params.tenantId,
        params.userProfileId || null,
        params.userName || null,
        params.action,
        params.module,
        params.entityType || null,
        params.entityId || null,
        params.description,
        params.metadata ? JSON.stringify(params.metadata) : null,
        params.status || "success",
      ],
    );
  } catch (err) {
    console.error("Audit log error:", err);
  }
}

async function getClaimAuditReference(params: {
  tenantId: string;
  claimId?: string | null;
  batchId?: string | null;
  groupKey?: string | null;
}): Promise<string> {
  const { tenantId, claimId, batchId, groupKey } = params;

  try {
    const result = await pool.query(
      `
        WITH claim_refs AS (
          SELECT
            c.id,
            c.batch_id,
            c.group_key,
            CASE
              WHEN c.batch_id IS NOT NULL THEN CONCAT(
                'CLM-',
                UPPER(SUBSTRING(MD5(c.batch_id::text), 1, 4)),
                '-',
                LPAD(
                  ROW_NUMBER() OVER (
                    PARTITION BY c.batch_id
                    ORDER BY c.created_at
                  )::text,
                  2,
                  '0'
                )
              )
              ELSE CONCAT(
                'CLM-',
                UPPER(SUBSTRING(MD5(c.id::text), 1, 4)),
                '-01'
              )
            END AS display_id
          FROM claims c
          WHERE c.tenant_id = $1
        )
        SELECT display_id
        FROM claim_refs
        WHERE ($2::uuid IS NOT NULL AND id = $2::uuid)
           OR ($3::uuid IS NOT NULL AND batch_id = $3::uuid AND group_key = $4)
        ORDER BY display_id ASC
        LIMIT 1
      `,
      [tenantId, claimId || null, batchId || null, groupKey || null],
    );

    if (result.rows[0]?.display_id) {
      return String(result.rows[0].display_id);
    }
  } catch (error) {
    console.error("Failed to resolve claim audit reference:", error);
  }

  if (claimId) return claimId.slice(0, 8);
  if (batchId) return batchId.slice(0, 8);
  return "Unknown";
}

async function getActiveRateCard(
  tenantId: string,
  platformId: string,
  categoryId: string,
): Promise<{ rateCard: any; hasConflict: boolean }> {
  const result = await pool.query(
    `
      SELECT *
      FROM rate_cards_v2
      WHERE tenant_id = $1
        AND platform_id = $2
        AND (category_id = $3 OR category_id = 'default')
        AND archived = false
        AND effective_from <= CURRENT_DATE
        AND (effective_to IS NULL OR effective_to >= CURRENT_DATE)
      ORDER BY
        CASE WHEN category_id = $3 THEN 0 ELSE 1 END,
        effective_from DESC,
        created_at DESC
    `,
    [tenantId, platformId, categoryId],
  );

  return {
    rateCard: result.rows[0] ?? null,
    hasConflict: result.rows.length > 1,
  };
}

router.post("/integrations/vote", async (req: Request, res: Response) => {
  const { tenant_id: tenantId, integration_id: integrationId, vote_type: voteType, willing_to_pay: willingToPay } =
    req.body ?? {};

  if (!tenantId || !integrationId || !voteType) {
    return res.status(400).json({ error: "tenant_id, integration_id, and vote_type are required" });
  }

  if (!["vote", "super_vote"].includes(voteType)) {
    return res.status(400).json({ error: "vote_type must be 'vote' or 'super_vote'" });
  }

  try {
    await pool.query(
      `INSERT INTO integration_votes (tenant_id, integration_id, vote_type, willing_to_pay)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (tenant_id, integration_id)
       DO UPDATE SET
         vote_type = EXCLUDED.vote_type,
         willing_to_pay = EXCLUDED.willing_to_pay,
         created_at = now()`,
      [tenantId, integrationId, voteType, willingToPay ?? null],
    );

    return res.json({ success: true });
  } catch (err) {
    console.error("vote error:", err);
    return res.status(500).json({ error: "Failed to record vote" });
  }
});

router.delete("/integrations/vote", async (req: Request, res: Response) => {
  const { tenant_id: tenantId, integration_id: integrationId } = req.body ?? {};

  if (!tenantId || !integrationId) {
    return res.status(400).json({ error: "tenant_id and integration_id required" });
  }

  try {
    await pool.query(
      `DELETE FROM integration_votes WHERE tenant_id = $1 AND integration_id = $2`,
      [tenantId, integrationId],
    );
    return res.json({ success: true });
  } catch (err) {
    console.error("delete vote error:", err);
    return res.status(500).json({ error: "Failed to remove vote" });
  }
});

router.get("/integrations/votes", async (req: Request, res: Response) => {
  const { tenant_id: tenantId } = req.query as Record<string, string>;

  if (!tenantId) {
    return res.status(400).json({ error: "tenant_id required" });
  }

  try {
    const result = await pool.query(
      `SELECT integration_id, vote_type, willing_to_pay, created_at
       FROM integration_votes
       WHERE tenant_id = $1`,
      [tenantId],
    );

    return res.json({ votes: result.rows });
  } catch (err) {
    console.error("fetch votes error:", err);
    return res.status(500).json({ error: "Failed to fetch votes" });
  }
});

router.get("/search", async (req: Request, res: Response) => {
  const { tenant_id: tenantId, q } = req.query as Record<string, string>;

  if (!tenantId || !q || q.trim().length < 2) {
    return res.json({ orders: [], claims: [], returns: [] });
  }

  const search = `%${q.trim()}%`;

  try {
    const [ordersResult, claimsResult, returnsResult] = await Promise.all([
      pool.query(
        `SELECT order_id, sku, marketplace, selling_price, operational_status
         FROM orders
         WHERE tenant_id = $1
           AND (order_id ILIKE $2 OR sku ILIKE $2)
         LIMIT 5`,
        [tenantId, search],
      ),
      pool.query(
        `WITH claim_refs AS (
           SELECT
             c.id,
             c.batch_id,
             c.order_id,
             c.marketplace,
             c.claim_status,
             c.claim_amount,
             CASE
               WHEN c.batch_id IS NOT NULL THEN CONCAT(
                 'CLM-',
                 UPPER(SUBSTRING(MD5(c.batch_id::text), 1, 4)),
                 '-',
                 LPAD(
                   ROW_NUMBER() OVER (
                     PARTITION BY c.batch_id
                     ORDER BY c.created_at
                   )::text,
                   2,
                   '0'
                 )
               )
               ELSE CONCAT(
                 'CLM-',
                 UPPER(SUBSTRING(MD5(c.id::text), 1, 4)),
                 '-01'
               )
             END AS display_id
           FROM claims c
           WHERE c.tenant_id = $1
         )
         SELECT DISTINCT display_id AS batch_id, marketplace, order_id, claim_status, claim_amount
         FROM claim_refs
         WHERE display_id ILIKE $2
            OR batch_id::text ILIKE $2
            OR order_id ILIKE $2
         LIMIT 5`,
        [tenantId, search],
      ),
      pool.query(
        `SELECT return_id, order_id, marketplace, sku, refund_amount, return_status
         FROM returns
         WHERE tenant_id = $1
           AND (return_id ILIKE $2 OR order_id ILIKE $2 OR sku ILIKE $2)
         LIMIT 5`,
        [tenantId, search],
      ),
    ]);

    return res.json({
      orders: ordersResult.rows,
      claims: claimsResult.rows,
      returns: returnsResult.rows,
    });
  } catch (err) {
    console.error("search error:", err);
    return res.status(500).json({ error: "Search failed" });
  }
});

router.get("/dashboard", async (req: Request, res: Response) => {
  const { tenant_id: tenantId, marketplace, days = "30" } = req.query as Record<string, string>;
  if (!tenantId) return res.status(400).json({ error: "tenant_id required" });

  const daysNum = Number.parseInt(days, 10) || 30;
  const since = new Date();
  since.setDate(since.getDate() - daysNum);
  const sinceISO = since.toISOString();
  const marketplaceFilter = marketplace && marketplace !== "all" ? marketplace : null;

  try {
    const [
      revenueResult,
      leakageResult,
      engineLeakageResult,
      claimsResult,
      rateCardsResult,
      rateCardsByMarketplaceResult,
      trendResult,
      leakageByMarketplace,
      claimsStatusResult,
      healthResult,
      marketplaceHealthResult,
      returnLeakageResult,
      feeOverchargeResult,
      runsResult,
      lastRunResult,
      settingsResult,
      missingPaymentRateCardsResult,
      uploadedFilesResult,
      missingPaymentOrdersResult,
    ] = await Promise.all([
      pool.query(
        `SELECT
           COALESCE(SUM(selling_price::numeric * quantity::numeric), 0) AS total_revenue,
           COUNT(*) AS order_count
         FROM orders
         WHERE tenant_id = $1
           AND ($2::text IS NULL OR marketplace = $2)`,
        [tenantId, marketplaceFilter],
      ),
      pool.query(
        `SELECT COALESCE(SUM(leakage_amount), 0) AS total_leakage
         FROM returns
         WHERE tenant_id = $1
           AND ($2::text IS NULL OR marketplace = $2)`,
        [tenantId, marketplaceFilter],
      ),
      pool.query(
        `SELECT
           COALESCE(SUM(CASE WHEN ros.status = 'OVERCHARGED' THEN ABS(ros.commission_discrepancy) ELSE 0 END), 0) AS fee_leakage,
           COUNT(CASE WHEN ros.status = 'OVERCHARGED' THEN 1 END) AS overcharged_count
         FROM reconciliation_order_summary ros
         JOIN reconciliation_runs rr ON rr.id = ros.run_id
         WHERE ros.tenant_id = $1
           AND ($2::text IS NULL OR ros.marketplace = $2)
           AND rr.status = 'COMPLETED'
           AND rr.engine_version = 'v2_typescript'
           AND rr.id = (
             SELECT id
             FROM reconciliation_runs
             WHERE tenant_id = $1
               AND engine_version = 'v2_typescript'
               AND status = 'COMPLETED'
             ORDER BY completed_at DESC
             LIMIT 1
           )`,
        [tenantId, marketplaceFilter],
      ),
      pool.query(
        `SELECT COUNT(*) AS count, COALESCE(SUM(claim_amount), 0) AS amount
         FROM claims
         WHERE tenant_id = $1
           AND ($2::text IS NULL OR marketplace = $2)
           AND COALESCE(claim_status, '') != 'CLOSED'`,
        [tenantId, marketplaceFilter],
      ),
      pool.query(
        `SELECT
           COUNT(*) AS active_count,
           COUNT(CASE WHEN effective_to IS NOT NULL AND effective_to <= CURRENT_DATE + INTERVAL '30 days' THEN 1 END) AS expiring_soon
         FROM rate_cards_v2
         WHERE tenant_id = $1
           AND archived = false
           AND effective_from <= CURRENT_DATE
           AND (effective_to IS NULL OR effective_to >= CURRENT_DATE)`,
        [tenantId],
      ),
      pool.query(
        `SELECT
           platform_id AS marketplace,
           COUNT(*) FILTER (
             WHERE archived = false
               AND effective_from <= CURRENT_DATE
               AND (effective_to IS NULL OR effective_to >= CURRENT_DATE)
           ) AS active,
           COUNT(*) FILTER (
             WHERE archived = false
               AND effective_to IS NOT NULL
               AND effective_to <= CURRENT_DATE + INTERVAL '30 days'
               AND effective_to >= CURRENT_DATE
           ) AS expiring_soon,
           COUNT(*) FILTER (
             WHERE archived = false
               AND effective_to IS NOT NULL
               AND effective_to < CURRENT_DATE
           ) AS expired
         FROM rate_cards_v2
         WHERE tenant_id = $1
         GROUP BY platform_id
         ORDER BY platform_id ASC`,
        [tenantId],
      ),
      pool.query(
        `SELECT
           DATE(dispatch_date) AS date,
           COALESCE(SUM(selling_price), 0) AS revenue,
           COUNT(*) AS orders
         FROM orders
         WHERE tenant_id = $1
           AND ($2::text IS NULL OR marketplace = $2)
           AND dispatch_date >= $3
           AND dispatch_date IS NOT NULL
         GROUP BY DATE(dispatch_date)
         ORDER BY date ASC`,
        [tenantId, marketplaceFilter, sinceISO],
      ),
      pool.query(
        `SELECT marketplace, COALESCE(SUM(leakage_amount), 0) AS leakage
         FROM returns
         WHERE tenant_id = $1
         GROUP BY marketplace
         ORDER BY leakage DESC`,
        [tenantId],
      ),
      pool.query(
        `SELECT claim_status, COUNT(*) AS count
         FROM claims
         WHERE tenant_id = $1
           AND ($2::text IS NULL OR marketplace = $2)
         GROUP BY claim_status`,
        [tenantId, marketplaceFilter],
      ),
      pool.query(
        `SELECT
           COUNT(*) AS total,
           COUNT(CASE WHEN ros.status = 'MATCHED' THEN 1 END) AS matched,
           COUNT(CASE WHEN ros.status = 'OVERCHARGED' OR ros.status = 'UNDERCHARGED' THEN 1 END) AS mismatch,
           COUNT(CASE WHEN ros.status = 'MISSING' THEN 1 END) AS missing_payment,
           COUNT(CASE WHEN ros.claim_readiness = 'CLAIM_READY' THEN 1 END) AS claimable
         FROM reconciliation_order_summary ros
         JOIN reconciliation_runs rr ON rr.id = ros.run_id
         WHERE ros.tenant_id = $1
           AND ($2::text IS NULL OR ros.marketplace = $2)
           AND rr.status = 'COMPLETED'
           AND rr.engine_version = 'v2_typescript'
           AND rr.id = (
             SELECT id
             FROM reconciliation_runs
             WHERE tenant_id = $1
               AND engine_version = 'v2_typescript'
               AND status = 'COMPLETED'
             ORDER BY completed_at DESC
             LIMIT 1
           )`,
        [tenantId, marketplaceFilter],
      ),
      pool.query(
        `SELECT
           o.marketplace,
           COUNT(DISTINCT o.order_id) AS order_count,
           COALESCE(SUM(r.leakage_amount), 0) AS return_leakage,
           COALESCE(MAX(eng.fee_leakage), 0) AS fee_leakage,
           COALESCE(MAX(eng.overcharge_count), 0) AS overcharges
         FROM orders o
         LEFT JOIN returns r ON r.order_id = o.order_id AND r.tenant_id = o.tenant_id
         LEFT JOIN (
           SELECT
             ros.marketplace,
             SUM(CASE WHEN ros.status = 'OVERCHARGED' THEN ABS(ros.commission_discrepancy) ELSE 0 END) AS fee_leakage,
             COUNT(CASE WHEN ros.status = 'OVERCHARGED' THEN 1 END) AS overcharge_count
           FROM reconciliation_order_summary ros
           JOIN reconciliation_runs rr ON rr.id = ros.run_id
           WHERE ros.tenant_id = $1
             AND rr.engine_version = 'v2_typescript'
             AND rr.status = 'COMPLETED'
             AND rr.id = (
               SELECT id
               FROM reconciliation_runs
               WHERE tenant_id = $1
                 AND engine_version = 'v2_typescript'
                 AND status = 'COMPLETED'
               ORDER BY completed_at DESC
               LIMIT 1
             )
           GROUP BY ros.marketplace
         ) eng ON eng.marketplace = o.marketplace
         WHERE o.tenant_id = $1
         GROUP BY o.marketplace`,
        [tenantId],
      ),
      pool.query(
        `SELECT
           r.order_id,
           r.marketplace,
           'RETURN_LEAKAGE' AS leakage_type,
           r.leakage_amount AS leakage_amount
         FROM returns r
         WHERE r.tenant_id = $1
           AND ($2::text IS NULL OR r.marketplace = $2)
           AND r.leakage_amount > 0
         ORDER BY r.leakage_amount DESC
         LIMIT 5`,
        [tenantId, marketplaceFilter],
      ),
      pool.query(
        `SELECT
	           ros.order_id,
	           ros.marketplace,
	           'FEE_OVERCHARGE' AS leakage_type,
	           ros.expected_net_payout,
	           ros.actual_net_payout,
	           ABS(ros.commission_discrepancy) AS leakage_amount
         FROM reconciliation_order_summary ros
         JOIN reconciliation_runs rr ON rr.id = ros.run_id
         WHERE ros.tenant_id = $1
           AND ($2::text IS NULL OR ros.marketplace = $2)
           AND ros.status = 'OVERCHARGED'
           AND rr.engine_version = 'v2_typescript'
           AND rr.status = 'COMPLETED'
           AND rr.id = (
             SELECT id
             FROM reconciliation_runs
             WHERE tenant_id = $1
               AND engine_version = 'v2_typescript'
               AND status = 'COMPLETED'
             ORDER BY completed_at DESC
             LIMIT 1
           )
         ORDER BY ABS(ros.commission_discrepancy) DESC
         LIMIT 5`,
        [tenantId, marketplaceFilter],
      ),
      pool.query(
        `SELECT
           id,
           run_number,
           trigger_type,
           status,
           completed_at,
           created_at,
           marketplace,
           orders_processed,
           orders_matched,
           orders_overcharged,
           orders_missing,
           exact_leakage,
           engine_version
         FROM reconciliation_runs
         WHERE tenant_id = $1
           AND status = 'COMPLETED'
           AND engine_version = 'v2_typescript'
         ORDER BY completed_at DESC
         LIMIT 5`,
        [tenantId],
      ),
      pool.query(
        `SELECT completed_at
         FROM reconciliation_runs
         WHERE tenant_id = $1 AND status = 'COMPLETED'
         ORDER BY completed_at DESC
         LIMIT 1`,
        [tenantId],
      ),
      pool.query(
        `SELECT missing_payment_rules
         FROM reconciliation_settings
         WHERE tenant_id = $1`,
        [tenantId],
      ),
      pool.query(
        `SELECT
           id,
           platform_id,
           category_id,
           t_plus_days,
           grace_days,
           effective_from,
           effective_to,
           created_at
         FROM rate_cards_v2
         WHERE tenant_id = $1
           AND archived = false`,
        [tenantId],
      ),
      pool.query(
        `SELECT marketplace, settlement_start_date, settlement_end_date, file_name, status
         FROM uploaded_files
         WHERE tenant_id = $1
           AND status IN ('PROCESSED', 'UPLOADED')
           AND settlement_start_date IS NOT NULL
           AND settlement_end_date IS NOT NULL`,
        [tenantId],
      ),
      pool.query(
        `SELECT
           o.order_id,
           o.marketplace,
           o.category_id,
           o.delivery_date,
           o.dispatch_date,
           o.selling_price,
           o.sku,
           EXISTS (
             SELECT 1
             FROM settlement_fee_lines sfl
             WHERE sfl.order_id = o.order_id
               AND sfl.tenant_id = o.tenant_id
               AND sfl.transaction_type != 'Refund'
           ) AS has_settlement
         FROM orders o
         WHERE o.tenant_id = $1
           AND ($2::text IS NULL OR o.marketplace = $2)
           AND o.operational_status = 'DELIVERED'
           AND o.delivery_date IS NOT NULL`,
        [tenantId, marketplaceFilter],
      ),
    ]);

    const missingPaymentRules = normalizeMissingPaymentRules(
      settingsResult.rows[0]?.missing_payment_rules,
    );
    const rateCardLookup = buildRateCardLookup(missingPaymentRateCardsResult.rows);
    const uploadedFiles = uploadedFilesResult.rows as MissingPaymentUploadedFile[];

    const missingPaymentEvaluations = missingPaymentOrdersResult.rows.map((row) => {
      const evaluation = evaluateMissingPayment(
        {
          order_id: row.order_id,
          marketplace: row.marketplace,
          category_id: row.category_id ?? null,
          delivery_date: row.delivery_date,
          has_settlement: Boolean(row.has_settlement),
          selling_price: row.selling_price,
          sku: row.sku ?? null,
          dispatch_date: row.dispatch_date ?? null,
        },
        rateCardLookup,
        missingPaymentRules,
        uploadedFiles,
      );

      return {
        ...row,
        ...evaluation,
        selling_price: asNumber(row.selling_price),
      };
    });

    const actionableMissingPayments = missingPaymentEvaluations.filter((row) =>
      ["MISSING_PAYMENT", "SETTLEMENT_NOT_UPLOADED"].includes(row.payment_status),
    );

    const missingConfirmed = actionableMissingPayments.filter(
      (row) => row.payment_status === "MISSING_PAYMENT",
    );
    const settlementNotUploaded = actionableMissingPayments.filter(
      (row) => row.payment_status === "SETTLEMENT_NOT_UPLOADED",
    );

    const missingPaymentsAmount = actionableMissingPayments.reduce(
      (sum, row) => sum + asNumber(row.selling_price),
      0,
    );

    const missingPaymentsAgeing = actionableMissingPayments.reduce(
      (acc, row) => {
        const overdueDays = Number(row.days_overdue ?? 0);
        if (overdueDays <= 7) acc.days_0_7 += 1;
        else if (overdueDays <= 15) acc.days_8_15 += 1;
        else if (overdueDays <= 30) acc.days_16_30 += 1;
        else acc.days_30_plus += 1;
        acc.total_pending += asNumber(row.selling_price);
        return acc;
      },
      {
        days_0_7: 0,
        days_8_15: 0,
        days_16_30: 0,
        days_30_plus: 0,
        total_pending: 0,
      },
    );

    const missingPaymentOrders = actionableMissingPayments
      .slice()
      .sort((a, b) => {
        const daysDiff = asNumber(b.days_overdue) - asNumber(a.days_overdue);
        if (daysDiff !== 0) return daysDiff;
        return String(a.order_id).localeCompare(String(b.order_id));
      })
      .slice(0, 5)
      .map((row) => ({
        order_id: row.order_id,
        marketplace: row.marketplace,
        dispatch_date: row.dispatch_date,
        selling_price: row.selling_price,
        days_pending: asNumber(row.days_overdue),
        payment_status: row.payment_status,
        expected_payout_date: row.expected_payout_date,
      }));

    const feeLeakage = asNumber(engineLeakageResult.rows[0]?.fee_leakage);
    const returnLeakage = asNumber(leakageResult.rows[0]?.total_leakage);
    const totalLeakage = Math.round((feeLeakage + returnLeakage) * 100) / 100;

    const combinedLeakage = [
      ...returnLeakageResult.rows,
      ...feeOverchargeResult.rows,
    ]
      .sort((a, b) => asNumber(b.leakage_amount) - asNumber(a.leakage_amount))
      .slice(0, 5);

    return res.json({
      kpis: {
        total_revenue: asNumber(revenueResult.rows[0]?.total_revenue),
        order_count: asNumber(revenueResult.rows[0]?.order_count),
        total_leakage: totalLeakage,
        fee_overcharge_leakage: feeLeakage,
        return_leakage: returnLeakage,
        overcharged_orders: asNumber(engineLeakageResult.rows[0]?.overcharged_count),
        missing_payments_count: actionableMissingPayments.length,
        missing_payments_amount: missingPaymentsAmount,
        claims_count: asNumber(claimsResult.rows[0]?.count),
        claims_amount: asNumber(claimsResult.rows[0]?.amount),
        active_rate_cards: asNumber(rateCardsResult.rows[0]?.active_count),
        expiring_rate_cards: asNumber(rateCardsResult.rows[0]?.expiring_soon),
      },
      missing_payments: {
        total: actionableMissingPayments.length,
        confirmed_missing: missingConfirmed.length,
        settlement_not_uploaded: settlementNotUploaded.length,
        amount: missingPaymentsAmount,
      },
      revenue_trend: trendResult.rows,
      leakage_by_marketplace: leakageByMarketplace.rows,
      claims_status: claimsStatusResult.rows,
      missing_payments_ageing: missingPaymentsAgeing,
      reconciliation_health: healthResult.rows[0] ?? {},
      marketplace_health: marketplaceHealthResult.rows.map((row) => {
        const marketplaceReturnLeakage = asNumber(row.return_leakage);
        const marketplaceFeeLeakage = asNumber(row.fee_leakage);
        return {
          ...row,
          return_leakage: marketplaceReturnLeakage,
          fee_leakage: marketplaceFeeLeakage,
          leakage: Math.round((marketplaceReturnLeakage + marketplaceFeeLeakage) * 100) / 100,
          overcharges: asNumber(row.overcharges),
        };
      }),
      top_leakage_orders: combinedLeakage,
      missing_payment_orders: missingPaymentOrders,
      recent_runs: runsResult.rows.map((row) => ({
        id: row.id,
        run_number: row.run_number,
        trigger_type: row.trigger_type,
        status: row.status,
        completed_at: row.completed_at,
        marketplace: row.marketplace,
        orders_processed: row.orders_processed || 0,
        orders_matched: row.orders_matched || 0,
        orders_overcharged: row.orders_overcharged || 0,
        orders_missing: row.orders_missing || 0,
        exact_leakage: row.exact_leakage || 0,
        engine_version: row.engine_version,
      })),
      rate_cards: {
        active: asNumber(rateCardsResult.rows[0]?.active_count),
        expiring_soon: asNumber(rateCardsResult.rows[0]?.expiring_soon),
        by_marketplace: rateCardsByMarketplaceResult.rows,
      },
      last_reconciliation: lastRunResult.rows[0]?.completed_at ?? null,
    });
  } catch (err) {
    console.error("dashboard error:", err);
    return res.status(500).json({ error: "Failed to fetch dashboard data" });
  }
});

router.get("/settings/reconciliation", async (req: Request, res: Response) => {
  const { tenant_id: tenantId } = req.query as Record<string, string>;
  if (!tenantId) return res.status(400).json({ error: "tenant_id required" });

  try {
    const settings = await getOrCreateReconciliationSettings(tenantId);
    return res.json({ settings });
  } catch (err) {
    console.error("fetch reconciliation settings error:", err);
    return res.status(500).json({ error: "Failed to fetch settings" });
  }
});

router.patch("/settings/reconciliation", async (req: Request, res: Response) => {
  const {
    tenant_id: tenantId,
    user_profile_id: userProfileId,
    user_name: userName,
    missing_payment_rules: missingPaymentRules,
    leakage_sensitivity: leakageSensitivity,
    rate_card_conflict_behavior: rateCardConflictBehavior,
  } = req.body ?? {};

  if (!tenantId) return res.status(400).json({ error: "tenant_id required" });

  try {
    const result = await pool.query(
      `UPDATE reconciliation_settings
       SET
         missing_payment_rules = COALESCE($1::jsonb, missing_payment_rules),
         leakage_sensitivity = COALESCE($2::jsonb, leakage_sensitivity),
         rate_card_conflict_behavior = COALESCE($3, rate_card_conflict_behavior),
         updated_at = now()
       WHERE tenant_id = $4
       RETURNING *`,
      [
        missingPaymentRules ? JSON.stringify(normalizeMissingPaymentRules(missingPaymentRules)) : null,
        leakageSensitivity ? JSON.stringify(normalizeLeakageSensitivity(leakageSensitivity)) : null,
        rateCardConflictBehavior || null,
        tenantId,
      ],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Settings not found" });
    }

    await logAuditEvent({
      tenantId,
      userProfileId: userProfileId || null,
      userName: userName || null,
      action: "RECONCILIATION_SETTINGS_CHANGED",
      module: "reconciliation_settings",
      entityType: "reconciliation_settings",
      entityId: tenantId,
      description: "Reconciliation settings updated",
      metadata: {
        updated_fields: Object.keys(req.body ?? {}).filter(
          (key) => !["tenant_id", "user_profile_id", "user_name"].includes(key),
        ),
      },
    });

    return res.json({ settings: normalizeReconciliationSettingsRow(result.rows[0]) });
  } catch (err) {
    console.error("update reconciliation settings error:", err);
    return res.status(500).json({ error: "Failed to update settings" });
  }
});

router.get("/reconciliation/orders", async (req: Request, res: Response) => {
  try {
    const tenantId = String(req.query.tenant_id ?? "").trim();
    const requestedMarketplace = String(req.query.marketplace ?? "").trim();
    const marketplace =
      requestedMarketplace && requestedMarketplace !== "all" ? requestedMarketplace : null;
    const status = String(req.query.status ?? "").trim();
    const statusList = status
      ? status
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : [];
    const limit = parseLimit(req.query.limit);
    const cursor = parseCursor(req.query.cursor);
    if (!tenantId) {
      return res.status(400).json({ error: "tenant_id is required" });
    }

    const reconciliationSettings = await getOrCreateReconciliationSettings(tenantId);
    const sensitivity = reconciliationSettings.leakage_sensitivity;
    const minAmount = asNumber(sensitivity.minimum_discrepancy_amount ?? 0);
    const ignoreRounding = Boolean(sensitivity.ignore_rounding_differences ?? false);
    const roundingTolerance = asNumber(sensitivity.rounding_tolerance_amount ?? 1);

    const latestCombinedCte = `
      WITH latest_run AS (
        SELECT id AS run_id
        FROM reconciliation_runs
        WHERE tenant_id = $1
          AND ($2::text IS NULL OR marketplace = $2)
          AND status = 'COMPLETED'
          AND engine_version = 'v2_typescript'
        ORDER BY completed_at DESC NULLS LAST, created_at DESC
        LIMIT 1
      ),
      combined AS (
        SELECT
          s.order_id,
          s.marketplace,
          s.created_at::date AS dispatch_date,
          COALESCE(s.expected_commission, 0) AS expected_commission,
          COALESCE(s.actual_commission, 0) AS actual_commission,
          COALESCE(s.commission_discrepancy, 0) AS commission_discrepancy,
          COALESCE(s.expected_logistics, 0) AS expected_logistics,
          COALESCE(s.actual_logistics, 0) AS actual_logistics,
          COALESCE(s.logistics_discrepancy, 0) AS logistics_discrepancy,
          s.expected_net_payout,
          s.actual_net_payout,
          COALESCE(s.commission_discrepancy, 0) + COALESCE(s.logistics_discrepancy, 0) AS total_discrepancy,
          CASE
            WHEN s.status = 'MISSING' THEN 'MISSING'
            WHEN COALESCE(s.commission_discrepancy, 0) < -0.01
              OR COALESCE(s.logistics_discrepancy, 0) < -0.01
              THEN 'OVERCHARGED'
            WHEN COALESCE(s.commission_discrepancy, 0) > 0.01
              OR COALESCE(s.logistics_discrepancy, 0) > 0.01
              THEN 'UNDERCHARGED'
            ELSE 'MATCHED'
          END AS status,
          s.run_id,
          s.engine_version
        FROM reconciliation_order_summary s
        JOIN latest_run lr
          ON s.run_id = lr.run_id
        WHERE s.tenant_id = $1
          AND ($2::text IS NULL OR s.marketplace = $2)
      )
    `;

    const params: Array<string | number | string[] | null> = [tenantId, marketplace];
    let whereClause = "1=1";

    if (statusList.length > 0) {
      params.push(statusList);
      whereClause += ` AND c.status = ANY($${params.length}::text[])`;

      params.push(minAmount);
      whereClause += ` AND ABS(c.total_discrepancy) >= $${params.length}`;
      if (ignoreRounding) {
        params.push(roundingTolerance);
        whereClause += ` AND ABS(c.total_discrepancy) > $${params.length}`;
      }
    } else {
      whereClause += " AND c.status != 'MISSING'";

      params.push(minAmount);
      whereClause += ` AND (c.status = 'MATCHED' OR ABS(c.total_discrepancy) >= $${params.length})`;
      if (ignoreRounding) {
        params.push(roundingTolerance);
        whereClause += ` AND (c.status = 'MATCHED' OR ABS(c.total_discrepancy) > $${params.length})`;
      }
    }

    if (cursor) {
      params.push(cursor.dispatchDate, cursor.orderId);
      whereClause += ` AND (c.dispatch_date, c.order_id) > ($${params.length - 1}, $${params.length})`;
    }

    params.push(limit);

    const rowsQuery = `
      ${latestCombinedCte}
      SELECT
        c.order_id,
        c.marketplace,
        o.sku,
        c.dispatch_date,
        c.expected_commission,
        c.actual_commission,
        c.commission_discrepancy,
        c.expected_logistics,
        c.actual_logistics,
        c.logistics_discrepancy,
        c.expected_net_payout,
        c.actual_net_payout,
        c.total_discrepancy,
        c.status,
        c.run_id,
        c.engine_version
      FROM combined c
      LEFT JOIN orders o
        ON o.order_id = c.order_id
       AND o.tenant_id = $1
      WHERE ${whereClause}
      ORDER BY c.dispatch_date ASC, c.order_id ASC
      LIMIT $${params.length}
    `;

    const rowsResult = await pool.query(rowsQuery, params);

    const countParams: Array<string | number | string[] | null> = [tenantId, marketplace];
    let countWhere = "1=1";
    if (statusList.length > 0) {
      countParams.push(statusList);
      countWhere += ` AND c.status = ANY($${countParams.length}::text[])`;

      countParams.push(minAmount);
      countWhere += ` AND ABS(c.total_discrepancy) >= $${countParams.length}`;
      if (ignoreRounding) {
        countParams.push(roundingTolerance);
        countWhere += ` AND ABS(c.total_discrepancy) > $${countParams.length}`;
      }
    } else {
      countWhere += " AND c.status != 'MISSING'";

      countParams.push(minAmount);
      countWhere += ` AND (c.status = 'MATCHED' OR ABS(c.total_discrepancy) >= $${countParams.length})`;
      if (ignoreRounding) {
        countParams.push(roundingTolerance);
        countWhere += ` AND (c.status = 'MATCHED' OR ABS(c.total_discrepancy) > $${countParams.length})`;
      }
    }

    const countQuery = `
      ${latestCombinedCte}
      SELECT COUNT(*) AS total_count
      FROM combined c
      WHERE ${countWhere}
    `;
    const countResult = await pool.query(countQuery, countParams);
    const totalCount = asNumber(countResult.rows[0]?.total_count);

    const rows = rowsResult.rows.map((row) => ({
      orderId: row.order_id,
      marketplace: row.marketplace,
      sku: row.sku ?? null,
      dispatchDate: row.dispatch_date,
      expectedCommission: asNumber(row.expected_commission),
      actualCommission: asNumber(row.actual_commission),
      commissionDiscrepancy: asNumber(row.commission_discrepancy),
      expectedLogistics: asNumber(row.expected_logistics),
      actualLogistics: asNumber(row.actual_logistics),
      logisticsDiscrepancy: asNumber(row.logistics_discrepancy),
      expectedNetPayout: row.expected_net_payout,
      actualNetPayout: row.actual_net_payout,
      totalDiscrepancy: asNumber(row.total_discrepancy),
      discrepancy: asNumber(row.total_discrepancy),
      status: row.status,
      runId: row.run_id ?? null,
      engineVersion: row.engine_version ?? null,
      claimState: row.status === "OVERCHARGED" ? "Not Raised" : "—",
    }));

    const lastRow = rowsResult.rows[rowsResult.rows.length - 1];
    const nextCursor =
      rowsResult.rows.length === limit && lastRow
        ? {
            dispatchDate: lastRow.dispatch_date,
            orderId: lastRow.order_id,
          }
        : null;

    return res.json({ rows, nextCursor, totalCount });
  } catch (error) {
    console.error("Error fetching reconciliation orders:", error);
    return res.status(500).json({ error: "Failed to fetch reconciliation orders" });
  }
});

router.get("/orders", async (req: Request, res: Response) => {
  const tenantId = String(req.query.tenant_id ?? "").trim();
  const marketplace = String(req.query.marketplace ?? "").trim();

  if (!tenantId) {
    return res.status(400).json({ error: "tenant_id is required" });
  }

  try {
    const result = await pool.query(
      `
        SELECT
          id,
          order_id,
          sku,
          quantity,
          selling_price,
          dispatch_date,
          delivery_date,
          operational_status,
          marketplace,
          weight_grams,
          category_id,
          fulfillment_type,
          updated_at,
          created_at
        FROM orders
        WHERE tenant_id = $1
          AND ($2 = '' OR marketplace = $2)
        ORDER BY dispatch_date DESC NULLS LAST, created_at DESC
        LIMIT 100
      `,
      [tenantId, marketplace],
    );

    const summary = await pool.query(
      `
        SELECT
          COUNT(*) AS total_orders,
          COUNT(DISTINCT sku) AS unique_skus,
          COUNT(CASE WHEN weight_grams IS NOT NULL AND weight_grams > 0 THEN 1 END) AS orders_with_weight,
          ROUND(
            COUNT(CASE WHEN weight_grams IS NOT NULL AND weight_grams > 0 THEN 1 END) * 100.0 /
            NULLIF(COUNT(*), 0)
          ) AS weight_coverage,
          ROUND(
            COUNT(CASE WHEN category_id IS NOT NULL AND category_id != '' THEN 1 END) * 100.0 /
            NULLIF(COUNT(*), 0)
          ) AS category_coverage,
          MIN(dispatch_date) AS earliest_date,
          MAX(dispatch_date) AS latest_date
        FROM orders
        WHERE tenant_id = $1
          AND ($2 = '' OR marketplace = $2)
      `,
      [tenantId, marketplace],
    );

    const normalizedSummary = summary.rows[0]
      ? {
          ...summary.rows[0],
          earliest_date: summary.rows[0].earliest_date
            ? new Date(summary.rows[0].earliest_date).toISOString().split("T")[0]
            : null,
          latest_date: summary.rows[0].latest_date
            ? new Date(summary.rows[0].latest_date).toISOString().split("T")[0]
            : null,
        }
      : null;

    return res.json({
      orders: result.rows.map((row) => ({
        ...row,
        dispatch_date: row.dispatch_date
          ? new Date(row.dispatch_date).toISOString().split("T")[0]
          : null,
        delivery_date: row.delivery_date
          ? new Date(row.delivery_date).toISOString().split("T")[0]
          : null,
      })),
      summary: normalizedSummary,
    });
  } catch (err) {
    console.error("Orders fetch error:", err);
    return res.status(500).json({ error: "Failed to fetch orders" });
  }
});

router.get("/claims/payment-alerts", async (req: Request, res: Response) => {
  const tenantId = String(req.query.tenant_id ?? "").trim();
  const marketplace = String(req.query.marketplace ?? "").trim();

  if (!tenantId) {
    return res.status(400).json({ error: "tenant_id is required" });
  }

  try {
    const marketplaceFilter = marketplace || null;
    const [settingsResult, rateCardsResult, uploadedFilesResult, ordersResult] = await Promise.all([
      pool.query(
        `SELECT missing_payment_rules
         FROM reconciliation_settings
         WHERE tenant_id = $1`,
        [tenantId],
      ),
      pool.query(
        `SELECT
           id,
           platform_id,
           category_id,
           t_plus_days,
           grace_days,
           effective_from,
           effective_to,
           created_at
         FROM rate_cards_v2
         WHERE tenant_id = $1
           AND archived = false`,
        [tenantId],
      ),
      pool.query(
        `SELECT marketplace, settlement_start_date, settlement_end_date, file_name, status
         FROM uploaded_files
         WHERE tenant_id = $1
           AND status IN ('PROCESSED', 'UPLOADED')
           AND settlement_start_date IS NOT NULL
           AND settlement_end_date IS NOT NULL`,
        [tenantId],
      ),
      pool.query(
        `SELECT
           o.order_id,
           o.sku,
           o.dispatch_date,
           o.delivery_date,
           o.category_id,
           o.operational_status,
           o.selling_price,
           o.marketplace,
           EXISTS (
             SELECT 1
             FROM settlement_fee_lines sfl
             WHERE sfl.order_id = o.order_id
               AND sfl.tenant_id = o.tenant_id
               AND sfl.transaction_type != 'Refund'
           ) AS has_settlement
         FROM orders o
         WHERE o.tenant_id = $1
           AND ($2::text IS NULL OR o.marketplace = $2)
           AND o.operational_status = 'DELIVERED'
           AND o.delivery_date IS NOT NULL
         ORDER BY o.delivery_date ASC, o.order_id ASC`,
        [tenantId, marketplaceFilter],
      ),
    ]);

    const missingPaymentRules = normalizeMissingPaymentRules(
      settingsResult.rows[0]?.missing_payment_rules,
    );
    const rateCardLookup = buildRateCardLookup(rateCardsResult.rows);
    const uploadedFiles = uploadedFilesResult.rows as MissingPaymentUploadedFile[];

    const normalizedAlerts = ordersResult.rows
      .map((row) => {
        const evaluation = evaluateMissingPayment(
          {
            order_id: row.order_id,
            marketplace: row.marketplace,
            category_id: row.category_id ?? null,
            delivery_date: row.delivery_date,
            has_settlement: Boolean(row.has_settlement),
            selling_price: row.selling_price,
            sku: row.sku ?? null,
            dispatch_date: row.dispatch_date ?? null,
          },
          rateCardLookup,
          missingPaymentRules,
          uploadedFiles,
        );

        return {
          ...row,
          ...evaluation,
        };
      })
      .filter((row) =>
        ["MISSING_PAYMENT", "SETTLEMENT_NOT_UPLOADED"].includes(row.payment_status),
      )
      .map((row) => ({
      ...row,
      dispatch_date: row.dispatch_date
        ? new Date(row.dispatch_date).toISOString().split("T")[0]
        : null,
      delivery_date: row.delivery_date
        ? new Date(row.delivery_date).toISOString().split("T")[0]
        : null,
      category_id: row.category_id ?? null,
      effective_delivery_date: row.effective_delivery_date
        ? new Date(row.effective_delivery_date).toISOString().split("T")[0]
        : null,
      expected_payout_date: row.expected_payout_date
        ? new Date(row.expected_payout_date).toISOString().split("T")[0]
        : null,
      expected_payout_with_grace: row.expected_payout_with_grace
        ? new Date(row.expected_payout_with_grace).toISOString().split("T")[0]
        : null,
      settlement_file_start_date: row.settlement_file_start_date
        ? new Date(row.settlement_file_start_date).toISOString().split("T")[0]
        : null,
      settlement_file_end_date: row.settlement_file_end_date
        ? new Date(row.settlement_file_end_date).toISOString().split("T")[0]
        : null,
      is_estimated_delivery: Boolean(row.is_estimated_delivery),
      rate_card_configured: Boolean(row.rate_card_configured),
      rate_card_id: row.rate_card_id ?? null,
      t_plus_days:
        row.t_plus_days === null || row.t_plus_days === undefined
          ? null
          : Number(row.t_plus_days),
      grace_days:
        row.grace_days === null || row.grace_days === undefined
          ? null
          : Number(row.grace_days),
      selling_price: asNumber(row.selling_price),
      days_overdue:
        row.days_overdue === null || row.days_overdue === undefined
          ? null
          : Number(row.days_overdue),
    }));

    const missing = normalizedAlerts.filter((row) => row.payment_status === "MISSING_PAYMENT");
    const settlementPending = normalizedAlerts.filter(
      (row) => row.payment_status === "SETTLEMENT_NOT_UPLOADED",
    );
    return res.json({
      alerts: normalizedAlerts,
      summary: {
        total_alerts: normalizedAlerts.length,
        missing_count: missing.length,
        delayed_count: settlementPending.length,
        unknown_count: 0,
        t_plus_days: null,
        grace_days: null,
      },
    });
  } catch (err) {
    console.error("Payment alerts error:", err);
    return res.status(500).json({ error: "Failed to fetch payment alerts" });
  }
});

router.patch("/orders/:id", async (req: Request, res: Response) => {
  const { id } = req.params;
  const { weight_grams, category_id, tenant_id } = req.body;

  if (!tenant_id) {
    return res.status(400).json({ error: "Missing tenant_id" });
  }

  try {
    await pool.query(
      `
        UPDATE orders
        SET
          weight_grams = COALESCE($1, weight_grams),
          category_id = COALESCE(NULLIF($2, ''), category_id),
          updated_at = NOW()
        WHERE order_id = $3
          AND tenant_id = $4
      `,
      [weight_grams || null, category_id || "", id, tenant_id],
    );

    return res.json({ status: "success" });
  } catch (err) {
    console.error("Order patch error:", err);
    return res.status(500).json({ error: "Failed to update order" });
  }
});

router.get("/returns", async (req: Request, res: Response) => {
  const { tenant_id: tenantId, marketplace } = req.query as Record<string, string>;

  if (!tenantId) {
    return res.status(400).json({ error: "tenant_id is required" });
  }

  try {
    const result = await pool.query(
      `
        SELECT
          r.*,
          r.return_date::text AS return_date,
          o.selling_price,
          o.category_id,
          o.fulfillment_type AS order_fulfillment_type
        FROM returns r
        LEFT JOIN orders o
          ON r.order_id = o.order_id
         AND r.tenant_id = o.tenant_id
        WHERE r.tenant_id = $1
          AND ($2 = '' OR r.marketplace = $2)
        ORDER BY r.return_date DESC NULLS LAST
      `,
      [tenantId, marketplace || ""],
    );

    const summary = await pool.query(
      `
        SELECT
          COUNT(*) AS total_returns,
          COALESCE(SUM(leakage_amount), 0) AS total_leakage,
          COALESCE(SUM(refund_leakage), 0) AS refund_leakage,
          COALESCE(SUM(commission_leakage), 0) AS commission_leakage,
          COALESCE(SUM(logistics_leakage), 0) AS logistics_leakage
        FROM returns
        WHERE tenant_id = $1
          AND ($2 = '' OR marketplace = $2)
      `,
      [tenantId, marketplace || ""],
    );

    return res.json({
      returns: result.rows,
      summary: summary.rows[0],
    });
  } catch (error) {
    console.error("fetch returns error:", error);
    return res.status(500).json({ error: "Failed to fetch returns" });
  }
});

router.post("/returns/upload", async (req: Request, res: Response) => {
  const {
    tenant_id: tenantId,
    user_profile_id: userProfileId,
    user_name: userName,
    marketplace,
    returns: returnRows,
  } = req.body ?? {};

  if (!tenantId || !Array.isArray(returnRows) || returnRows.length === 0) {
    return res.status(400).json({ error: "tenant_id and returns array required" });
  }

  try {
    const normalizedRows = returnRows
      .map((row: any) => ({
        ...row,
        marketplace: String(marketplace || row.marketplace || "").trim().toLowerCase(),
        order_id: String(row.order_id || "").trim(),
        return_id: String(row.return_id || "").trim(),
        sku: String(row.sku || "").trim(),
      }))
      .filter((row: any) => row.marketplace && row.order_id && row.return_id && row.sku);

    if (normalizedRows.length === 0) {
      return res.status(400).json({ error: "No valid return rows to upload" });
    }

    const orderIds = Array.from(new Set(normalizedRows.map((row: any) => row.order_id)));
    const marketplaces = Array.from(new Set(normalizedRows.map((row: any) => row.marketplace)));

    const ordersResult = await pool.query(
      `
        SELECT order_id, selling_price, category_id, fulfillment_type, weight_grams
        FROM orders
        WHERE tenant_id = $1
          AND order_id = ANY($2::text[])
      `,
      [tenantId, orderIds],
    );
    const ordersMap = new Map<string, any>(
      ordersResult.rows.map((order: any) => [order.order_id, order]),
    );

    const categories = Array.from(
      new Set([
        ...ordersResult.rows.map((order: any) => order.category_id).filter(Boolean),
        "default",
      ]),
    );

    const rateCardsResult = await pool.query(
      `
        SELECT *
        FROM rate_cards_v2
        WHERE tenant_id = $1
          AND platform_id = ANY($2::text[])
          AND (category_id = ANY($3::text[]) OR category_id = 'default')
          AND archived = false
          AND effective_from <= CURRENT_DATE
          AND (effective_to IS NULL OR effective_to >= CURRENT_DATE)
        ORDER BY
          platform_id,
          category_id,
          effective_from DESC,
          created_at DESC
      `,
      [tenantId, marketplaces, categories],
    );

    const rateCardsMap = new Map<string, any>();
    const rateCardGroups = new Map<string, any[]>();
    for (const rateCard of rateCardsResult.rows) {
      const key = `${rateCard.platform_id}:${rateCard.category_id}`;
      if (!rateCardsMap.has(key)) {
        rateCardsMap.set(key, rateCard);
      }
      if (!rateCardGroups.has(key)) {
        rateCardGroups.set(key, []);
      }
      rateCardGroups.get(key)!.push(rateCard);
    }

    const rateCardIds = rateCardsResult.rows.map((rateCard: any) => rateCard.id);
    const slabsResult = rateCardIds.length
      ? await pool.query(
          `
            SELECT *
            FROM rate_card_logistics_slabs
            WHERE rate_card_id = ANY($1::uuid[])
              AND effective_from <= CURRENT_DATE
              AND (effective_to IS NULL OR effective_to >= CURRENT_DATE)
            ORDER BY rate_card_id, weight_min_grams ASC
          `,
          [rateCardIds],
        )
      : { rows: [], rowCount: 0 };

    const slabsMap = new Map<string, any[]>();
    for (const slab of slabsResult.rows) {
      if (!slabsMap.has(slab.rate_card_id)) {
        slabsMap.set(slab.rate_card_id, []);
      }
      slabsMap.get(slab.rate_card_id)!.push(slab);
    }

    console.info("Returns upload preload", {
      rows: normalizedRows.length,
      orders: ordersResult.rowCount,
      rateCards: rateCardsResult.rowCount,
      slabs: slabsResult.rows.length,
    });

    const conflicts: string[] = [];
    const upsertValues: any[][] = [];

    for (const row of normalizedRows) {
      const effectiveMarketplace = row.marketplace;
      const orderId = row.order_id;
      const returnId = row.return_id;
      const sku = row.sku;
      const order = ordersMap.get(orderId);

      const categoryId = String(order?.category_id || "default").trim().toLowerCase();
      const exactKey = `${effectiveMarketplace}:${categoryId}`;
      const defaultKey = `${effectiveMarketplace}:default`;
      const rateCard = rateCardsMap.get(exactKey) || rateCardsMap.get(defaultKey);
      const conflictKey = rateCardsMap.has(exactKey) ? exactKey : defaultKey;
      const sameScopeCards = rateCardGroups.get(conflictKey) || [];

      if (sameScopeCards.length > 1) {
        conflicts.push(`${orderId}: multiple active rate cards for ${effectiveMarketplace}/${categoryId}`);
      }

      const sellingPrice = asNumber(order?.selling_price);
      const commissionPercent = asNumber(rateCard?.commission_percent);
      const fulfillmentType = row.fulfillment_type || order?.fulfillment_type || null;
      const expectedRefund = sellingPrice;
      const expectedCommissionReversal = sellingPrice * (commissionPercent / 100);

      let expectedLogisticsReversal: number | null = null;
      if (fulfillmentType === "EASY_SHIP" && rateCard?.id) {
        const slabs = slabsMap.get(rateCard.id) || [];
        const weightGrams = asNumber(order?.weight_grams);
        const matchingSlab = [...slabs]
          .reverse()
          .find(
            (slab) =>
              asNumber(slab.weight_min_grams) <= weightGrams &&
              asNumber(slab.weight_max_grams) >= weightGrams,
          );
        expectedLogisticsReversal =
          matchingSlab?.reverse_fee === null || matchingSlab?.reverse_fee === undefined
            ? null
            : Number(matchingSlab.reverse_fee);
      }

      const actualRefund = asNumber(row.refund_amount);
      const actualCommission = asNumber(row.commission_reversal);
      const actualLogistics = asNumber(row.logistics_reversal);
      const refundLeakage = Math.max(0, expectedRefund - actualRefund);
      const commissionLeakage = Math.max(0, expectedCommissionReversal - actualCommission);
      const logisticsLeakage =
        expectedLogisticsReversal !== null
          ? Math.max(0, expectedLogisticsReversal - actualLogistics)
          : 0;
      const totalLeakage = refundLeakage + commissionLeakage + logisticsLeakage;

      const reconciliationStatus =
        totalLeakage > 0 ? "mismatch" : !row.refund_amount ? "no_data" : "matched";

      upsertValues.push([
        tenantId,
        effectiveMarketplace,
        orderId,
        returnId,
        sku,
        row.return_date || null,
        Number(row.qty_returned || 1),
        row.return_reason || null,
        row.return_status || "REQUESTED",
        nullableNumeric(row.refund_amount),
        nullableNumeric(row.commission_reversal),
        nullableNumeric(row.logistics_reversal),
        fulfillmentType,
        expectedRefund,
        expectedCommissionReversal,
        expectedLogisticsReversal,
        reconciliationStatus,
        refundLeakage,
        commissionLeakage,
        logisticsLeakage,
        totalLeakage,
      ]);
    }

    const placeholders = upsertValues
      .map((_, rowIndex) => {
        const offset = rowIndex * 21;
        return `(${Array.from({ length: 21 }, (_unused, colIndex) => `$${offset + colIndex + 1}`).join(", ")})`;
      })
      .join(", ");

    const upsertResult = await pool.query(
      `
        INSERT INTO returns (
          tenant_id,
          marketplace,
          order_id,
          return_id,
          sku,
          return_date,
          qty_returned,
          return_reason_desc,
          return_status,
          refund_amount,
          commission_reversal,
          logistics_reversal,
          fulfillment_type,
          expected_refund_amount,
          expected_commission_reversal,
          expected_logistics_reversal,
          reconciliation_status,
          refund_leakage,
          commission_leakage,
          logistics_leakage,
          leakage_amount
        ) VALUES ${placeholders}
        ON CONFLICT (tenant_id, order_id, return_id)
        DO UPDATE SET
          marketplace = EXCLUDED.marketplace,
          sku = EXCLUDED.sku,
          return_date = EXCLUDED.return_date,
          qty_returned = EXCLUDED.qty_returned,
          return_reason_desc = EXCLUDED.return_reason_desc,
          return_status = EXCLUDED.return_status,
          refund_amount = EXCLUDED.refund_amount,
          commission_reversal = EXCLUDED.commission_reversal,
          logistics_reversal = EXCLUDED.logistics_reversal,
          fulfillment_type = EXCLUDED.fulfillment_type,
          expected_refund_amount = EXCLUDED.expected_refund_amount,
          expected_commission_reversal = EXCLUDED.expected_commission_reversal,
          expected_logistics_reversal = EXCLUDED.expected_logistics_reversal,
          reconciliation_status = EXCLUDED.reconciliation_status,
          refund_leakage = EXCLUDED.refund_leakage,
          commission_leakage = EXCLUDED.commission_leakage,
          logistics_leakage = EXCLUDED.logistics_leakage,
          leakage_amount = EXCLUDED.leakage_amount
        RETURNING *
      `,
      upsertValues.flat(),
    );

    await logAuditEvent({
      tenantId,
      userProfileId: userProfileId || null,
      userName: userName || null,
      action: "FILE_UPLOADED",
      module: "uploads",
      entityType: "upload",
      description: `Returns file uploaded (${upsertResult.rows.length} rows)`,
      metadata: {
        upload_type: "returns",
        row_count: upsertResult.rows.length,
        marketplace,
      },
    });

    return res.json({
      success: true,
      processed: upsertResult.rows.length,
      conflicts: conflicts.length > 0 ? conflicts : undefined,
      conflict_warning:
        conflicts.length > 0
          ? `${conflicts.length} orders linked to conflicting rate cards. Expected values may be inaccurate. Review your rate cards.`
          : undefined,
    });
  } catch (error) {
    console.error("returns upload error:", error);
    return res.status(500).json({ error: "Failed to upload returns" });
  }
});

router.get("/returns/count", async (req: Request, res: Response) => {
  const { tenant_id: tenantId } = req.query as Record<string, string>;
  if (!tenantId) {
    return res.status(400).json({ error: "tenant_id is required" });
  }

  try {
    const result = await pool.query(
      `SELECT COUNT(*) AS count FROM returns WHERE tenant_id = $1`,
      [tenantId],
    );
    return res.json({ count: Number.parseInt(result.rows[0].count, 10) });
  } catch (error) {
    console.error("fetch returns count error:", error);
    return res.status(500).json({ error: "Failed to fetch returns count" });
  }
});

router.get("/reconciliation/order/:orderId", async (req: Request, res: Response) => {
  const { tenant_id: tenantId } = req.query as Record<string, string>;
  const { orderId } = req.params;

  if (!tenantId) {
    return res.status(400).json({ error: "tenant_id is required" });
  }

  try {
    // Order details
    const orderResult = await pool.query(
      `SELECT o.order_id, o.sku, o.selling_price, o.quantity, o.category_id,
              o.marketplace, o.created_at, o.dispatch_date, o.delivery_date, o.fulfillment_type,
              o.operational_status, o.weight_grams
       FROM orders o
       WHERE o.order_id = $1 AND o.tenant_id = $2`,
      [orderId, tenantId],
    );
    const order = orderResult.rows[0];

    // Latest Engine B reconciliation summary for this order
    const summaryResult = await pool.query(
      `SELECT ros.expected_commission, ros.actual_commission, ros.commission_discrepancy,
              ros.expected_gst, ros.expected_tcs,
              ros.expected_closing_fee, ros.actual_closing_fee,
              ros.expected_logistics, ros.actual_logistics,
              ros.expected_net_payout, ros.actual_net_payout,
              COALESCE(ros.commission_discrepancy, 0) + COALESCE(ros.logistics_discrepancy, 0) AS total_discrepancy,
              ros.status, ros.confidence,
              ros.claim_readiness, ros.missing_rule_codes,
              ros.calculation_breakdown, ros.calculation_hash,
              ros.engine_version, ros.rate_card_id, ros.rate_card_version,
              ros.fulfillment_type, ros.run_id,
              rr.run_number
       FROM reconciliation_order_summary ros
       JOIN reconciliation_runs rr ON rr.id = ros.run_id
       WHERE ros.order_id = $1
         AND ros.tenant_id = $2
         AND rr.status = 'COMPLETED'
         AND rr.engine_version = 'v2_typescript'
       ORDER BY rr.completed_at DESC
       LIMIT 1`,
      [orderId, tenantId],
    );
    const summary = summaryResult.rows[0];

    // Rate card details
    let rateCard = null;
    if (order) {
      const rateCardDate = order.dispatch_date ?? order.delivery_date ?? new Date();
      const rcResult = await pool.query(
        `SELECT platform_id, category_id, commission_percent, commission_type,
                t_plus_days, grace_days, gst_percent, tcs_percent,
                effective_from, effective_to, version_number
         FROM rate_cards_v2
         WHERE tenant_id = $1
           AND platform_id = $2
           AND category_id = $3
           AND archived = false
           AND effective_from <= $4
           AND (effective_to IS NULL OR effective_to >= $4)
         ORDER BY effective_from DESC LIMIT 1`,
        [tenantId, order.marketplace, order.category_id, rateCardDate],
      );
      rateCard = rcResult.rows[0] || null;
    }

    // Raw settlement lines
    const settlementResult = await pool.query(
      `SELECT raw_amount_type, raw_amount_description, amount, bucket,
              transaction_type, posted_date
       FROM settlement_fee_lines
       WHERE order_id = $1 AND tenant_id = $2
       ORDER BY posted_date ASC`,
      [orderId, tenantId],
    );

    return res.json({
      orderId,
      sku: order?.sku,
      marketplace: order?.marketplace,
      sellingPrice: asNumber(order?.selling_price),
      quantity: Number.parseInt(String(order?.quantity ?? 1), 10) || 1,
      categoryId: order?.category_id,
      fulfillmentType: order?.fulfillment_type || summary?.fulfillment_type,
      orderDate: order?.created_at,
      dispatchDate: order?.dispatch_date,
      deliveryDate: order?.delivery_date,
      weightGrams: order?.weight_grams,

      // Reconciliation results
      status: summary?.status || "UNKNOWN",
      confidence: summary?.confidence || null,
      claimReadiness: summary?.claim_readiness || null,
      missingRuleCodes: summary?.missing_rule_codes || [],
      runId: summary?.run_id || null,
      runNumber: summary?.run_number || null,
      engineVersion: summary?.engine_version || null,

      // Commission
      expectedCommission: asNumber(summary?.expected_commission),
      actualCommission: asNumber(summary?.actual_commission),
      discrepancy: asNumber(summary?.commission_discrepancy),

      // Full fee breakdown
      expectedGst: asNumber(summary?.expected_gst),
      expectedTcs: asNumber(summary?.expected_tcs),
      expectedClosingFee: asNumber(summary?.expected_closing_fee),
      actualClosingFee: asNumber(summary?.actual_closing_fee),
      expectedNetPayout: asNumber(summary?.expected_net_payout),
      actualNetPayout: asNumber(summary?.actual_net_payout),

      // Engine B calculation breakdown — the full JSON
      calculation_breakdown: summary?.calculation_breakdown || null,
      calculationHash: summary?.calculation_hash || null,

      // Rate card context
      rateCard: rateCard
        ? {
            commissionPercent: asNumber(rateCard.commission_percent),
            commissionType: rateCard.commission_type,
            tPlusDays: rateCard.t_plus_days,
            graceDays: rateCard.grace_days,
            gstPercent: asNumber(rateCard.gst_percent),
            tcsPercent: asNumber(rateCard.tcs_percent),
            effectiveFrom: rateCard.effective_from,
            version: rateCard.version_number,
          }
        : null,

      // Raw settlement lines
      rawSettlementLines: settlementResult.rows.map((row) => ({
        type: row.raw_amount_type,
        description: row.raw_amount_description,
        amount: asNumber(row.amount),
        bucket: row.bucket,
      })),

      // Legacy fee breakdown for backwards compatibility
      feeBreakdown: [
        {
          type: "Commission",
          expected: asNumber(summary?.expected_commission),
          actual: asNumber(summary?.actual_commission),
          difference: asNumber(summary?.commission_discrepancy),
        },
        {
          type: "Logistics",
          expected: asNumber(summary?.expected_logistics),
          actual: asNumber(summary?.actual_logistics),
          difference: asNumber(summary?.expected_logistics) - asNumber(summary?.actual_logistics),
        },
      ],
    });
  } catch (err) {
    console.error("order detail error:", err);
    return res.status(500).json({ error: "Failed to fetch order detail" });
  }
});

router.get("/reconciliation/summary", async (req: Request, res: Response) => {
  try {
    const tenantId = String(req.query.tenant_id ?? "").trim();
    const requestedMarketplace = String(req.query.marketplace ?? "").trim();
    const marketplace =
      requestedMarketplace && requestedMarketplace !== "all" ? requestedMarketplace : null;

    if (!tenantId) {
      return res.status(400).json({ error: "tenant_id is required" });
    }

    const summaryQuery = `
      WITH latest_run AS (
        SELECT id AS run_id
        FROM reconciliation_runs
        WHERE tenant_id = $1
          AND ($2::text IS NULL OR marketplace = $2)
          AND status = 'COMPLETED'
          AND engine_version = 'v2_typescript'
        ORDER BY completed_at DESC NULLS LAST, created_at DESC
        LIMIT 1
      )
      SELECT
        COUNT(*) AS orders_analyzed,
        COALESCE(SUM(ABS(LEAST(COALESCE(s.commission_discrepancy, 0), 0))), 0) AS commission_leakage,
        COALESCE(SUM(ABS(LEAST(COALESCE(s.logistics_discrepancy, 0), 0))), 0) AS logistics_leakage,
        COALESCE(
          SUM(
            ABS(
              LEAST(
                COALESCE(s.commission_discrepancy, 0) + COALESCE(s.logistics_discrepancy, 0),
                0
              )
            )
          ),
          0
        ) AS total_leakage,
        COUNT(
          CASE
            WHEN (COALESCE(s.commission_discrepancy, 0) + COALESCE(s.logistics_discrepancy, 0)) < -0.01
              THEN 1
          END
        ) AS overcharged_orders,
        COALESCE(
          SUM(
            ABS(
              LEAST(
                COALESCE(s.commission_discrepancy, 0) + COALESCE(s.logistics_discrepancy, 0),
                0
              )
            )
          ),
          0
        ) AS recovery_potential
      FROM reconciliation_order_summary s
      JOIN latest_run lr
        ON s.run_id = lr.run_id
      WHERE s.tenant_id = $1
        AND ($2::text IS NULL OR s.marketplace = $2)
    `;

    const result = await pool.query(summaryQuery, [tenantId, marketplace]);
    const summary = result.rows[0] ?? {};

    return res.json({
      ordersAnalyzed: asNumber(summary.orders_analyzed),
      commissionLeakage: asNumber(summary.commission_leakage),
      logisticsLeakage: asNumber(summary.logistics_leakage),
      leakageDetected: asNumber(summary.total_leakage),
      overchargedOrders: asNumber(summary.overcharged_orders),
      recoveryPotential: asNumber(summary.recovery_potential ?? summary.total_leakage),
    });
  } catch (error) {
    console.error("Error fetching reconciliation summary:", error);
    return res.status(500).json({ error: "Failed to fetch reconciliation summary" });
  }
});

router.get("/reconciliation/last-run", async (req: Request, res: Response) => {
  const tenantId = String(req.query.tenant_id ?? "").trim();
  const marketplace = String(req.query.marketplace ?? "").trim() || null;

  if (!tenantId) {
    return res.status(400).json({ error: "tenant_id is required" });
  }

  try {
    const result = await pool.query(
      `
      SELECT
        id,
        trigger_type,
        status,
        completed_at,
        created_at
      FROM reconciliation_runs
      WHERE tenant_id = $1
        AND ($2::text IS NULL OR marketplace = $2)
        AND status = 'COMPLETED'
      ORDER BY completed_at DESC NULLS LAST
      LIMIT 1
      `,
      [tenantId, marketplace],
    );

    if (!result.rows[0]) {
      return res.json({ last_run: null });
    }

    return res.json({ last_run: result.rows[0] });
  } catch (err) {
    console.error("last run error:", err);
    return res.status(500).json({ error: "Failed to fetch last run" });
  }
});

router.post("/reconciliation/run", async (req: Request, res: Response) => {
  const {
    tenant_id: tenantId,
    marketplace,
    settlement_id: settlementIdFromBody,
  } = req.body ?? {};

  if (!tenantId || !marketplace) {
    return res.status(400).json({ error: "tenant_id and marketplace are required" });
  }

  let settlementId = String(settlementIdFromBody ?? "").trim() || null;
  let runId: string | null = null;

  try {
    if (!settlementId) {
      const latestSettlement = await pool.query(
        `
          SELECT
            settlement_id,
            id AS uploaded_file_id,
            settlement_start_date,
            settlement_end_date
          FROM uploaded_files
          WHERE tenant_id = $1
            AND marketplace = $2
            AND status IN ('PROCESSED', 'UPLOADED')
            AND settlement_id IS NOT NULL
          ORDER BY created_at DESC
          LIMIT 1
        `,
        [tenantId, marketplace],
      );
      settlementId = latestSettlement.rows[0]?.settlement_id || null;
    }

    if (!settlementId) {
      return res.status(400).json({
        error: "No settlement file found for this marketplace. Upload a settlement file first.",
      });
    }

    const fileResult = await pool.query(
      `
        SELECT id, settlement_start_date, settlement_end_date
        FROM uploaded_files
        WHERE tenant_id = $1
          AND settlement_id = $2
          AND marketplace = $3
        LIMIT 1
      `,
      [tenantId, settlementId, marketplace],
    );
    const uploadedFile = fileResult.rows[0];

    const triggeredBy = (req as any).user?.id ?? "system";

    const runNumberResult = await pool.query(
      `
        SELECT COALESCE(MAX(run_number), 0) + 1 AS next_run_number
        FROM reconciliation_runs
        WHERE tenant_id = $1
      `,
      [tenantId],
    );
    const runNumber = Number(runNumberResult.rows[0]?.next_run_number ?? 1);

    const runResult = await pool.query(
      `
        INSERT INTO reconciliation_runs (
          tenant_id,
          marketplace,
          settlement_id,
          run_number,
          run_scope,
          trigger_type,
          triggered_by,
          status,
          engine_version,
          settlement_period_from,
          settlement_period_to,
          started_at,
          orders_processed,
          metadata
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,'STARTED','v2_typescript',$8,$9,NOW(),0,$10)
        RETURNING id
      `,
      [
        tenantId,
        marketplace,
        settlementId,
        runNumber,
        "SETTLEMENT_FILE",
        "FULL_MANUAL",
        triggeredBy,
        uploadedFile?.settlement_start_date ?? null,
        uploadedFile?.settlement_end_date ?? null,
        JSON.stringify({ uploaded_file_id: uploadedFile?.id ?? null }),
      ],
    );

    runId = runResult.rows[0]?.id ?? null;
    if (!runId) {
      throw new Error("Failed to create reconciliation run");
    }

    /*
     * Engine A fallback, retained until Engine B output is confirmed:
     *
     * const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
     * const serviceRoleKey =
     *   process.env.SUPABASE_SERVICE_ROLE_KEY ??
     *   process.env.SUPABASE_SERVICE_KEY ??
     *   process.env.SERVICE_ROLE_KEY;
     *
     * await fetch(`${supabaseUrl}/functions/v1/run-reconciliation`, {
     *   method: "POST",
     *   headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceRoleKey}` },
     *   body: JSON.stringify({ tenant_id: tenantId, marketplace, settlement_id: settlementId, run_id: runId }),
     * });
     *
     * await fetch(`${supabaseUrl}/functions/v1/run-logistics-reconciliation`, {
     *   method: "POST",
     *   headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceRoleKey}` },
     *   body: JSON.stringify({ tenant_id: tenantId, marketplace, settlement_id: settlementId, run_id: runId }),
     * });
     */

    const ordersResult = await pool.query(
      `
        SELECT
          order_id,
          sku,
          selling_price,
          quantity,
          category_id,
          marketplace,
          dispatch_date,
          delivery_date,
          fulfillment_type,
          operational_status,
          weight_grams
        FROM orders
        WHERE tenant_id = $1
          AND marketplace = $2
          AND operational_status = 'DELIVERED'
          AND delivery_date IS NOT NULL
      `,
      [tenantId, marketplace],
    );
    const orders = ordersResult.rows;

    const settlementResult = await pool.query(
      `
        SELECT
          id,
          order_id,
          bucket,
          amount,
          raw_amount_type,
          raw_amount_description,
          transaction_type
        FROM settlement_fee_lines
        WHERE tenant_id = $1
          AND marketplace = $2
          AND settlement_id = $3
      `,
      [tenantId, marketplace, settlementId],
    );
    const settlementLines = settlementResult.rows;

    const settlementByOrder = new Map<string, typeof settlementLines>();
    for (const line of settlementLines) {
      if (!line.order_id) continue;
      if (!settlementByOrder.has(line.order_id)) {
        settlementByOrder.set(line.order_id, []);
      }
      settlementByOrder.get(line.order_id)!.push(line);
    }

    const settledOrderIds = new Set(
      settlementLines
        .filter((line) => line.transaction_type === "Order" && line.order_id)
        .map((line) => String(line.order_id)),
    );

    const rateCardResult = await pool.query(
      `
        SELECT *
        FROM rate_cards_v2
        WHERE tenant_id = $1
          AND (platform_id = $2 OR platform_id IS NULL)
          AND archived = false
      `,
      [tenantId, marketplace],
    );

    const rateCardSnapshot = { rate_cards: rateCardResult.rows };
    const rateCardSnapshotJson = JSON.stringify(rateCardSnapshot);
    await pool.query(
      `
        UPDATE reconciliation_runs
        SET rate_card_snapshot = $1,
            rate_card_snapshot_hash = $2,
            orders_processed = $3,
            total_orders_processed = $3
        WHERE id = $4
      `,
      [
        rateCardSnapshotJson,
        createHash("sha256").update(rateCardSnapshotJson).digest("hex"),
        orders.length,
        runId,
      ],
    );

    const rateCardById = new Map<string, any>();
    for (const card of rateCardResult.rows) {
      rateCardById.set(String(card.id), card);
    }

    let matchedCount = 0;
    let overchargedCount = 0;
    let underchargedCount = 0;
    let missingCount = 0;
    let errorCount = 0;
    let exactLeakage = 0;

    for (const order of orders) {
      try {
        const orderLines = settlementByOrder.get(order.order_id) || [];
        const isInSettlement = settledOrderIds.has(order.order_id);

        const actualCommission = orderLines
          .filter((line) => line.bucket === "COMMISSION" && line.transaction_type === "Order")
          .reduce((sum, line) => sum + Math.abs(asNumber(line.amount)), 0);

        const actualClosingFee = orderLines
          .filter((line) => line.bucket === "PLATFORM_FEE" && line.transaction_type === "Order")
          .reduce((sum, line) => sum + Math.abs(asNumber(line.amount)), 0);

        const actualLogistics = orderLines
          .filter((line) => line.bucket === "LOGISTICS" && line.transaction_type === "Order")
          .reduce((sum, line) => sum + Math.abs(asNumber(line.amount)), 0);

        const actualSalePrice = orderLines
          .filter((line) => line.bucket === "SALE_PRICE")
          .reduce((sum, line) => sum + asNumber(line.amount), 0);

        const actualNetPayout =
          actualSalePrice - actualCommission - actualClosingFee - actualLogistics;

        const recon = await reconcileOrder(db, {
          orderId: order.order_id,
          tenantId,
          marketplace: order.marketplace,
          category: order.category_id ?? "",
          fulfillment_type: order.fulfillment_type,
          orderDate: String(order.dispatch_date ?? order.delivery_date ?? ""),
          deliveryDate: String(order.delivery_date ?? order.dispatch_date ?? ""),
          actualPayoutDate: isInSettlement ? String(order.delivery_date ?? "") : null,
          selling_price: order.selling_price,
          quantity: order.quantity,
        });

        const expectedLogistics = 0;
        const commissionDiscrepancy = recon.expected_commission_amount - actualCommission;

        let status: string;
        if (!isInSettlement) {
          status = "MISSING";
          missingCount++;
        } else if (Math.abs(commissionDiscrepancy) <= 0.01) {
          status = "MATCHED";
          matchedCount++;
        } else if (commissionDiscrepancy > 0.01) {
          status = "UNDERCHARGED";
          underchargedCount++;
        } else {
          status = "OVERCHARGED";
          overchargedCount++;
          exactLeakage += Math.abs(commissionDiscrepancy);
        }

        let claimReadiness = "NEEDS_REVIEW";
        if (status === "OVERCHARGED" && recon.confidence !== "LOW") {
          claimReadiness = "CLAIM_READY";
        } else if (status === "MISSING") {
          claimReadiness = "CLAIM_READY";
        } else if (status === "MATCHED") {
          claimReadiness = "NOT_CLAIMABLE";
        }

        const rateCardRow = recon.rateCardId ? rateCardById.get(recon.rateCardId) : null;
        const rateCardVersion = rateCardRow?.version_number
          ? Number(rateCardRow.version_number)
          : null;
        const gstPercent = asNumber(rateCardRow?.gst_percent);
        const tcsPercent = asNumber(rateCardRow?.tcs_percent);

        const { breakdown, hash } = buildCalculationBreakdown({
          engineVersion: "v2_typescript",
          runId,
          rateCardId: recon.rateCardId,
          rateCardVersion,
          fulfillmentType: order.fulfillment_type,
          sellingPrice: asNumber(order.selling_price),
          quantity: Number(order.quantity ?? 1) || 1,
          grossOrderValue: recon.gross_order_value,
          commission: {
            type: recon.commission_slab_applied?.startsWith("tiered") ? "tiered" : "flat",
            slabApplied: recon.commission_slab_applied,
            ratePercent: recon.commission_rate_applied,
            expected: recon.expected_commission_amount,
            actual: actualCommission,
          },
          closingFee: {
            fulfillmentType: order.fulfillment_type,
            expected: recon.expected_closing_fee_amount,
            actual: actualClosingFee,
            source: recon.closing_fee_source,
          },
          gst: {
            ratePercent: gstPercent,
            appliedOn: "commission + platform_fee + closing_fee",
            expected: recon.expected_gst_amount,
            actual: 0,
          },
          tcs: {
            ratePercent: tcsPercent,
            expected: recon.expected_tcs_amount,
            actual: 0,
          },
          logistics: {
            weightGrams: order.weight_grams ?? null,
            zone: null,
            expected: expectedLogistics,
            actual: actualLogistics,
            note: "Delivery zone not captured — logistics fee excluded from expected calculation",
          },
          summary: {
            expectedNetPayout: recon.expected_net_payout,
            actualNetPayout,
            totalDiscrepancy: commissionDiscrepancy,
            status,
            confidence: recon.confidence,
            missingRuleCodes: recon.missing_rule_codes,
          },
        });

        const summaryInsert = await pool.query(
          `
            INSERT INTO reconciliation_order_summary (
              tenant_id,
              run_id,
              order_id,
              marketplace,
              rate_card_id,
              rate_card_version,
              fulfillment_type,
              expected_payout_date,
              gross_order_value,
              expected_commission,
              actual_commission,
              expected_gst,
              actual_gst,
              gst_discrepancy,
              expected_tcs,
              actual_tcs,
              tcs_discrepancy,
              expected_closing_fee,
              actual_closing_fee,
              closing_fee_discrepancy,
              expected_logistics,
              actual_logistics,
              logistics_discrepancy,
              expected_net_payout,
              actual_net_payout,
              status,
              claim_readiness,
              confidence,
              missing_rule_codes,
              calculation_breakdown,
              calculation_hash,
              engine_version
            )
            VALUES (
              $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,
              $12,$13,$14,$15,$16,$17,$18,$19,$20,$21,
              $22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32
            )
            ON CONFLICT (run_id, order_id)
            DO UPDATE SET
              rate_card_id = EXCLUDED.rate_card_id,
              rate_card_version = EXCLUDED.rate_card_version,
              fulfillment_type = EXCLUDED.fulfillment_type,
              expected_payout_date = EXCLUDED.expected_payout_date,
              gross_order_value = EXCLUDED.gross_order_value,
              expected_commission = EXCLUDED.expected_commission,
              actual_commission = EXCLUDED.actual_commission,
              expected_gst = EXCLUDED.expected_gst,
              actual_gst = EXCLUDED.actual_gst,
              gst_discrepancy = EXCLUDED.gst_discrepancy,
              expected_tcs = EXCLUDED.expected_tcs,
              actual_tcs = EXCLUDED.actual_tcs,
              tcs_discrepancy = EXCLUDED.tcs_discrepancy,
              expected_closing_fee = EXCLUDED.expected_closing_fee,
              actual_closing_fee = EXCLUDED.actual_closing_fee,
              closing_fee_discrepancy = EXCLUDED.closing_fee_discrepancy,
              expected_logistics = EXCLUDED.expected_logistics,
              actual_logistics = EXCLUDED.actual_logistics,
              logistics_discrepancy = EXCLUDED.logistics_discrepancy,
              expected_net_payout = EXCLUDED.expected_net_payout,
              actual_net_payout = EXCLUDED.actual_net_payout,
              status = EXCLUDED.status,
              claim_readiness = EXCLUDED.claim_readiness,
              confidence = EXCLUDED.confidence,
              missing_rule_codes = EXCLUDED.missing_rule_codes,
              calculation_breakdown = EXCLUDED.calculation_breakdown,
              calculation_hash = EXCLUDED.calculation_hash,
              engine_version = EXCLUDED.engine_version
            RETURNING id
          `,
          [
            tenantId,
            runId,
            order.order_id,
            marketplace,
            recon.rateCardId,
            rateCardVersion,
            order.fulfillment_type,
            recon.expectedPayoutDate,
            recon.gross_order_value,
            recon.expected_commission_amount,
            actualCommission,
            recon.expected_gst_amount,
            0,
            recon.expected_gst_amount,
            recon.expected_tcs_amount,
            0,
            recon.expected_tcs_amount,
            recon.expected_closing_fee_amount,
            actualClosingFee,
            recon.expected_closing_fee_amount - actualClosingFee,
            expectedLogistics,
            actualLogistics,
            expectedLogistics - actualLogistics,
            recon.expected_net_payout,
            actualNetPayout,
            status,
            claimReadiness,
            recon.confidence,
            recon.missing_rule_codes,
            JSON.stringify(breakdown),
            hash,
            "v2_typescript",
          ],
        );

        const summaryId = summaryInsert.rows[0]?.id;

        if (summaryId) {
          const components = [
            {
              bucket: "COMMISSION",
              code: "commission",
              label: "Referral/Commission Fee",
              expected: recon.expected_commission_amount,
              actual: actualCommission,
              method: recon.commission_slab_applied?.startsWith("tiered")
                ? "tiered_slab"
                : "flat_rate",
              confidence: recon.missing_rule_codes.includes("commission_slab") ? "LOW" : "HIGH",
            },
            {
              bucket: "TAX",
              code: "gst",
              label: "GST on Fees",
              expected: recon.expected_gst_amount,
              actual: 0,
              method: "percent_of_fees",
              confidence: "HIGH",
            },
            {
              bucket: "OTHER",
              code: "tcs",
              label: "TCS",
              expected: recon.expected_tcs_amount,
              actual: 0,
              method: "percent_of_gross",
              confidence: "HIGH",
            },
            {
              bucket: "PLATFORM_FEES",
              code: "closing_fee",
              label: "Fixed Closing Fee",
              expected: recon.expected_closing_fee_amount,
              actual: actualClosingFee,
              method: recon.closing_fee_source ? "rate_card_fee" : "not_configured",
              confidence: recon.missing_rule_codes.includes("closing_fee") ? "LOW" : "HIGH",
            },
            {
              bucket: "LOGISTICS",
              code: "logistics",
              label: "Weight Handling Fee",
              expected: expectedLogistics,
              actual: actualLogistics,
              method: "logistics_slab",
              confidence: "LOW",
            },
          ];

          for (const comp of components) {
            await pool.query(
              `
                INSERT INTO reconciliation_fee_components (
                  tenant_id,
                  marketplace,
                  order_id,
                  run_id,
                  bucket,
                  expected_amount,
                  actual_amount,
                  reconciliation_order_summary_id,
                  component_code,
                  component_label,
                  calculation_method,
                  confidence
                )
                VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
                ON CONFLICT (tenant_id, marketplace, run_id, order_id, bucket)
                DO UPDATE SET
                  expected_amount = EXCLUDED.expected_amount,
                  actual_amount = EXCLUDED.actual_amount,
                  reconciliation_order_summary_id = EXCLUDED.reconciliation_order_summary_id,
                  component_code = EXCLUDED.component_code,
                  component_label = EXCLUDED.component_label,
                  calculation_method = EXCLUDED.calculation_method,
                  confidence = EXCLUDED.confidence
              `,
              [
                tenantId,
                marketplace,
                order.order_id,
                runId,
                comp.bucket,
                comp.expected,
                comp.actual,
                summaryId,
                comp.code,
                comp.label,
                comp.method,
                comp.confidence,
              ],
            );
          }
        }
      } catch (orderError) {
        console.error(`Error processing order ${order.order_id}:`, orderError);
        errorCount++;
      }
    }

    exactLeakage = Math.round(exactLeakage * 100) / 100;

    await pool.query(
      `
        UPDATE reconciliation_runs
        SET status = 'COMPLETED',
            completed_at = NOW(),
            orders_matched = $1,
            orders_overcharged = $2,
            orders_undercharged = $3,
            orders_missing = $4,
            orders_not_in_settlement = $4,
            orders_error = $5,
            exact_leakage = $6,
            claimable_order_count = $7,
            affected_orders_count = $7
        WHERE id = $8
      `,
      [
        matchedCount,
        overchargedCount,
        underchargedCount,
        missingCount,
        errorCount,
        exactLeakage,
        overchargedCount + missingCount,
        runId,
      ],
    );

    return res.json({
      status: "success",
      run_id: runId,
      run_number: runNumber,
      message: `Reconciliation complete — Run #${runNumber}`,
      summary: {
        orders_processed: orders.length,
        matched: matchedCount,
        overcharged: overchargedCount,
        undercharged: underchargedCount,
        missing: missingCount,
        errors: errorCount,
        exact_leakage: exactLeakage,
      },
    });
  } catch (error: any) {
    if (runId) {
      await pool.query(
        `
          UPDATE reconciliation_runs
          SET status = 'FAILED',
              completed_at = NOW(),
              failure_reason = $1
          WHERE id = $2
        `,
        [error.message, runId],
      );
    }
    console.error("Reconciliation run error:", error);
    return res.status(500).json({
      error: "Reconciliation run failed",
      details: error.message,
      run_id: runId,
    });
  }
});

router.post("/reconciliation/run-logistics", async (req: Request, res: Response) => {
  const {
    tenant_id: tenantId,
    marketplace,
    settlement_id: settlementId,
  } = req.body ?? {};

  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.SUPABASE_SERVICE_KEY ??
    process.env.SERVICE_ROLE_KEY;

  if (!tenantId || !marketplace) {
    return res.status(400).json({
      error: "tenant_id and marketplace are required",
    });
  }

  if (!supabaseUrl || !serviceRoleKey) {
    return res.status(500).json({
      error: "Supabase environment variables are not configured",
    });
  }

  try {
    const response = await fetch(
      `${supabaseUrl}/functions/v1/run-logistics-reconciliation`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${serviceRoleKey}`,
        },
        body: JSON.stringify({
          tenant_id: tenantId,
          marketplace,
          settlement_id: settlementId || "SETTLE123",
        }),
      },
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Edge function failed: ${error}`);
    }

    const result = await response.json();
    return res.json({
      status: "success",
      engine: "logistics",
      run_result: result,
    });
  } catch (error) {
    console.error("Run logistics reconciliation error:", error);
    return res.status(500).json({
      error: "Failed to trigger logistics reconciliation",
    });
  }
});

router.get("/claims/batch/preview", async (req: Request, res: Response) => {
  const { tenant_id: tenantId, marketplace, reconciliation_run_id: reconciliationRunId } =
    req.query as Record<string, string>;

  if (!tenantId || !marketplace || !reconciliationRunId) {
    return res.status(400).json({
      error: "tenant_id, marketplace and reconciliation_run_id are required",
    });
  }

  try {
    const ordersResult = await pool.query(
      `
        SELECT
          s.order_id,
          s.commission_discrepancy,
          s.logistics_discrepancy,
          'national' AS logistics_zone
        FROM reconciliation_order_summary s
        WHERE s.tenant_id = $1
          AND s.marketplace = $2
          AND s.run_id = $3
          AND s.status = 'OVERCHARGED'
      `,
      [tenantId, marketplace, reconciliationRunId],
    );

    const groups: Record<
      string,
      { count: number; total: number; bucket: string; zone: string | null }
    > = {};

    for (const order of ordersResult.rows) {
      if (asNumber(order.commission_discrepancy) < -0.01) {
        const key = `${marketplace}|commission`;
        if (!groups[key]) {
          groups[key] = { count: 0, total: 0, bucket: "COMMISSION", zone: null };
        }
        groups[key].count += 1;
        groups[key].total += Math.abs(asNumber(order.commission_discrepancy));
      }

      if (asNumber(order.logistics_discrepancy) < -0.01) {
        const zone = String(order.logistics_zone ?? "national");
        const key = `${marketplace}|logistics|${zone}`;
        if (!groups[key]) {
          groups[key] = { count: 0, total: 0, bucket: "LOGISTICS", zone };
        }
        groups[key].count += 1;
        groups[key].total += Math.abs(asNumber(order.logistics_discrepancy));
      }
    }

    return res.json({
      total_orders: ordersResult.rows.length,
      total_discrepancy: Object.values(groups).reduce((sum, group) => sum + group.total, 0),
      groups: Object.entries(groups).map(([key, value]) => ({
        group_key: key,
        bucket: value.bucket,
        zone: value.zone,
        order_count: value.count,
        total_discrepancy: value.total,
      })),
    });
  } catch (error) {
    console.error("Preview error:", error);
    return res.status(500).json({ error: "Failed to generate preview" });
  }
});

router.post("/claims/batch", async (req: Request, res: Response) => {
  const {
    tenant_id: tenantId,
    marketplace,
    reconciliation_run_id: reconciliationRunId,
  } = req.body ?? {};

  if (!tenantId || !marketplace || !reconciliationRunId) {
    return res.status(400).json({
      error: "tenant_id, marketplace, reconciliation_run_id are required",
    });
  }

  try {
    const ordersResult = await pool.query(
      `
        SELECT
          s.order_id,
          s.commission_discrepancy,
          s.logistics_discrepancy,
          s.logistics_status,
          s.expected_commission,
          s.actual_commission,
          s.expected_logistics,
          s.actual_logistics,
          s.run_id,
          'national' AS logistics_zone
        FROM reconciliation_order_summary s
        WHERE s.tenant_id = $1
          AND s.marketplace = $2
          AND s.run_id = $3
          AND s.status = 'OVERCHARGED'
      `,
      [tenantId, marketplace, reconciliationRunId],
    );

    const orders = ordersResult.rows;
    if (orders.length === 0) {
      return res.status(400).json({
        error: "No overcharged orders found for this run",
      });
    }

    const existingClaimsResult = await pool.query(
      `
        SELECT order_id, bucket
        FROM claims
        WHERE tenant_id = $1
          AND marketplace = $2
          AND reconciliation_run_id = $3
      `,
      [tenantId, marketplace, reconciliationRunId],
    );

    const existingClaimKeys = new Set(
      existingClaimsResult.rows.map((row) => `${row.order_id}|${row.bucket}`),
    );

    const claimRows: Array<{
      order_id: string;
      bucket: "COMMISSION" | "LOGISTICS";
      group_key: string;
      zone: string | null;
      expected_amount: number;
      actual_amount: number;
      discrepancy_amount: number;
      claim_amount: number;
    }> = [];

    for (const order of orders) {
      if (
        asNumber(order.commission_discrepancy) < -0.01 &&
        !existingClaimKeys.has(`${order.order_id}|COMMISSION`)
      ) {
        claimRows.push({
          order_id: String(order.order_id),
          bucket: "COMMISSION",
          group_key: `${marketplace}|commission`,
          zone: null,
          expected_amount: asNumber(order.expected_commission),
          actual_amount: asNumber(order.actual_commission),
          discrepancy_amount: asNumber(order.commission_discrepancy),
          claim_amount: Math.abs(asNumber(order.commission_discrepancy)),
        });
      }

      if (
        asNumber(order.logistics_discrepancy) < -0.01 &&
        !existingClaimKeys.has(`${order.order_id}|LOGISTICS`)
      ) {
        const zone = String(order.logistics_zone ?? "national");
        claimRows.push({
          order_id: String(order.order_id),
          bucket: "LOGISTICS",
          group_key: `${marketplace}|logistics|${zone}`,
          zone,
          expected_amount: asNumber(order.expected_logistics),
          actual_amount: asNumber(order.actual_logistics),
          discrepancy_amount: asNumber(order.logistics_discrepancy),
          claim_amount: Math.abs(asNumber(order.logistics_discrepancy)),
        });
      }
    }

    if (claimRows.length === 0) {
      return res.status(400).json({
        error: "All overcharged orders already have claims",
      });
    }

    const totalDiscrepancy = claimRows.reduce((sum, row) => sum + Number(row.claim_amount), 0);
    const batchName = `${
      String(marketplace).charAt(0).toUpperCase() + String(marketplace).slice(1)
    } Claims – ${new Date().toLocaleDateString("en-IN", {
      month: "short",
      year: "numeric",
    })}`;

    const batchResult = await pool.query(
      `
        INSERT INTO claim_batches
          (
            tenant_id,
            marketplace,
            reconciliation_run_id,
            batch_name,
            total_orders,
            total_discrepancy,
            status
          )
        VALUES ($1, $2, $3, $4, $5, $6, 'DRAFT')
        RETURNING id
      `,
      [
        tenantId,
        marketplace,
        reconciliationRunId,
        batchName,
        claimRows.length,
        totalDiscrepancy,
      ],
    );

    const batchId = batchResult.rows[0]?.id;

    for (const row of claimRows) {
      await pool.query(
        `
          INSERT INTO claims (
            tenant_id,
            marketplace,
            order_id,
            bucket,
            group_key,
            zone,
            batch_id,
            expected_amount,
            actual_amount,
            discrepancy_amount,
            claim_amount,
            claim_status,
            reconciliation_run_id,
            evidence_snapshot
          )
          VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'DRAFT', $12, $13::jsonb
          )
          ON CONFLICT (tenant_id, order_id, bucket, reconciliation_run_id)
          DO NOTHING
        `,
        [
          tenantId,
          marketplace,
          row.order_id,
          row.bucket,
          row.group_key,
          row.zone,
          batchId,
          row.expected_amount,
          row.actual_amount,
          row.discrepancy_amount,
          row.claim_amount,
          reconciliationRunId,
          JSON.stringify({
            group_key: row.group_key,
            expected: row.expected_amount,
            actual: row.actual_amount,
            discrepancy: row.discrepancy_amount,
          }),
        ],
      );
    }

    const groups: Record<
      string,
      { count: number; total: number; bucket: string; zone: string | null }
    > = {};
    for (const row of claimRows) {
      if (!groups[row.group_key]) {
        groups[row.group_key] = {
          count: 0,
          total: 0,
          bucket: row.bucket,
          zone: row.zone,
        };
      }
      groups[row.group_key].count += 1;
      groups[row.group_key].total += Number(row.claim_amount);
    }

    return res.json({
      status: "success",
      batch_id: batchId,
      batch_name: batchName,
      total_orders: claimRows.length,
      total_discrepancy: totalDiscrepancy,
      groups: Object.entries(groups).map(([key, value]) => ({
        group_key: key,
        bucket: value.bucket,
        zone: value.zone,
        order_count: value.count,
        total_discrepancy: value.total,
      })),
    });
  } catch (error) {
    console.error("Bulk claim creation error:", error);
    return res.status(500).json({ error: "Failed to create claim batch" });
  }
});

router.get("/claims", async (req: Request, res: Response) => {
  try {
    const tenantId = String(req.query.tenant_id ?? "").trim();
    const marketplace = String(req.query.marketplace ?? "").trim() || null;
    const status = String(req.query.status ?? "").trim() || null;

    if (!tenantId) {
      return res.status(400).json({ error: "tenant_id is required" });
    }

    const listQuery = `
      SELECT
        id,
        order_id,
        marketplace,
        bucket,
        claim_amount,
        claim_status,
        expected_amount,
        actual_amount,
        discrepancy_amount,
        created_at,
        reconciliation_run_id
      FROM claims
      WHERE tenant_id = $1
        AND ($2::text IS NULL OR marketplace = $2)
        AND ($3::text IS NULL OR claim_status = $3)
      ORDER BY created_at DESC
      LIMIT 100
    `;

    const result = await pool.query(listQuery, [tenantId, marketplace, status]);
    return res.json({ claims: result.rows });
  } catch (error) {
    console.error("Error fetching claims list:", error);
    return res.status(500).json({ error: "Failed to fetch claims list" });
  }
});

router.get("/claims/by-order", async (req: Request, res: Response) => {
  const { tenant_id: tenantId, order_ids: orderIds } = req.query as Record<string, string>;

  if (!tenantId || !orderIds) {
    return res.status(400).json({ error: "tenant_id and order_ids required" });
  }

  const orderIdsArray = orderIds
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);

  if (orderIdsArray.length === 0) {
    return res.json({ claims_by_order: {} });
  }

  try {
    const result = await pool.query(
      `
        SELECT
          id,
          order_id,
          bucket,
          claim_status,
          resolution_status,
          created_at
        FROM claims
        WHERE tenant_id = $1
          AND order_id = ANY($2::text[])
        ORDER BY created_at DESC
      `,
      [tenantId, orderIdsArray],
    );

    const grouped: Record<string, typeof result.rows> = {};
    for (const row of result.rows) {
      if (!grouped[row.order_id]) {
        grouped[row.order_id] = [];
      }
      grouped[row.order_id].push(row);
    }

    return res.json({ claims_by_order: grouped });
  } catch (error) {
    console.error("claims by order error:", error);
    return res.status(500).json({ error: "Failed to fetch claims by order" });
  }
});

router.get("/claims/grouped", async (req: Request, res: Response) => {
  const { tenant_id: tenantId, marketplace = "" } = req.query as Record<string, string>;

  if (!tenantId) {
    return res.status(400).json({ error: "tenant_id is required" });
  }

  try {
    const result = await pool.query(
      `
        WITH grouped_claims AS (
          SELECT
            COALESCE(c.batch_id::text, c.id::text) AS batch_id,
            COALESCE(c.group_key, c.order_id) AS group_key,
            c.bucket,
            c.marketplace,
            SPLIT_PART(COALESCE(c.group_key, c.order_id), '|', 3) AS zone,
            COUNT(c.id) AS order_count,
            SUM(c.claim_amount) AS total_claimed,
            SUM(CASE WHEN c.resolution_status = 'APPROVED' THEN c.claim_amount ELSE 0 END) AS total_approved,
            SUM(CASE WHEN c.resolution_status = 'REJECTED' THEN c.claim_amount ELSE 0 END) AS total_rejected,
            SUM(CASE WHEN c.recovered_at IS NOT NULL THEN c.claim_amount ELSE 0 END) AS total_recovered,
            MIN(c.created_at) AS created_at,
            MAX(c.updated_at) AS updated_at,
            CASE
              WHEN COUNT(*) FILTER (WHERE c.recovered_at IS NOT NULL) = COUNT(*) THEN 'RECOVERED'
              WHEN COUNT(*) FILTER (WHERE c.resolution_status = 'REJECTED') = COUNT(*) THEN 'REJECTED'
              WHEN COUNT(*) FILTER (WHERE c.resolution_status = 'APPROVED') = COUNT(*) THEN 'APPROVED'
              WHEN COUNT(*) FILTER (WHERE c.resolution_status IN ('APPROVED','REJECTED')) > 0 THEN 'PARTIAL'
              ELSE 'IN_REVIEW'
            END AS resolution_status,
            CASE
              WHEN COUNT(*) FILTER (WHERE c.claim_status = 'CLOSED') > 0 THEN 'CLOSED'
              WHEN COUNT(*) FILTER (WHERE c.claim_status = 'FOLLOW_UP') > 0 THEN 'FOLLOW_UP'
              WHEN COUNT(*) FILTER (WHERE c.claim_status = 'IN_REVIEW') > 0 THEN 'IN_REVIEW'
              WHEN COUNT(*) FILTER (WHERE c.claim_status = 'SUBMITTED') > 0 THEN 'SUBMITTED'
              ELSE 'DRAFT'
            END AS workflow_status
          FROM claims c
          WHERE c.tenant_id = $1
            AND ($2 = '' OR c.marketplace = $2)
          GROUP BY
            COALESCE(c.batch_id::text, c.id::text),
            COALESCE(c.group_key, c.order_id),
            c.bucket,
            c.marketplace
        )
        SELECT
          gc.*,
          cb.batch_name,
          CONCAT(
            'CLM-',
            UPPER(SUBSTRING(MD5(gc.batch_id::text), 1, 4)),
            '-',
            LPAD(
              ROW_NUMBER() OVER (PARTITION BY gc.batch_id ORDER BY gc.created_at)::text,
              2,
              '0'
            )
          ) AS display_id
        FROM grouped_claims gc
        LEFT JOIN claim_batches cb ON cb.id::text = gc.batch_id
        ORDER BY
          gc.resolution_status = 'REJECTED' DESC,
          gc.workflow_status = 'FOLLOW_UP' DESC,
          gc.total_claimed DESC
      `,
      [tenantId, marketplace || ""],
    );

    const summaryResult = await pool.query(
      `
        WITH grouped_claims AS (
          SELECT
            COALESCE(c.batch_id::text, c.id::text) AS batch_id,
            COALESCE(c.group_key, c.order_id) AS group_key,
            c.bucket,
            c.marketplace,
            SUM(c.claim_amount) AS total_claimed,
            SUM(CASE WHEN c.resolution_status = 'APPROVED' THEN c.claim_amount ELSE 0 END) AS total_approved,
            SUM(CASE WHEN c.recovered_at IS NOT NULL THEN c.claim_amount ELSE 0 END) AS total_recovered
          FROM claims c
          WHERE c.tenant_id = $1
            AND ($2 = '' OR c.marketplace = $2)
          GROUP BY
            COALESCE(c.batch_id::text, c.id::text),
            COALESCE(c.group_key, c.order_id),
            c.bucket,
            c.marketplace
        )
        SELECT
          COUNT(*) AS total_claims,
          SUM(total_claimed) AS total_claimed,
          SUM(total_approved) AS total_approved,
          SUM(total_recovered) AS total_recovered
        FROM grouped_claims
      `,
      [tenantId, marketplace || ""],
    );

    return res.json({
      claims: result.rows,
      summary: summaryResult.rows[0],
    });
  } catch (error) {
    console.error("Grouped claims error:", error);
    return res.status(500).json({ error: "Failed to fetch grouped claims" });
  }
});

router.get("/settlements/files", async (req: Request, res: Response) => {
  const {
    tenant_id: tenantId,
    marketplace = "",
    show_all: showAll = "false",
  } = req.query as Record<string, string>;

  if (!tenantId) {
    return res.status(400).json({ error: "tenant_id is required" });
  }

  try {
    const result = await pool.query(
      `
        WITH sfl_totals AS (
          SELECT
            uploaded_file_id,
            COUNT(id) AS total_records,
            COALESCE(SUM(ABS(amount)) FILTER (WHERE amount > 0), 0) AS gross_amount,
            COALESCE(SUM(ABS(amount)) FILTER (WHERE amount < 0), 0) AS fees_total,
            COALESCE(SUM(amount), 0) AS net_amount
          FROM settlement_fee_lines
          GROUP BY uploaded_file_id
        ),
        claim_totals AS (
          SELECT
            rr.tenant_id,
            rr.settlement_id,
            COUNT(DISTINCT c.id) AS claims_count
          FROM reconciliation_runs rr
          LEFT JOIN claims c ON c.reconciliation_run_id = rr.id
          GROUP BY rr.tenant_id, rr.settlement_id
        )
        SELECT
          uf.id,
          uf.settlement_id,
          uf.marketplace,
          uf.file_name,
          uf.status,
          uf.row_count,
          uf.settlement_start_date,
          uf.settlement_end_date,
          uf.created_at,
          uf.updated_at,
          uf.processed_at,
          uf.error_message,
          COALESCE(sfl.total_records, 0) AS total_records,
          COALESCE(sfl.gross_amount, 0) AS gross_amount,
          COALESCE(sfl.fees_total, 0) AS fees_total,
          COALESCE(sfl.net_amount, 0) AS net_amount,
          CASE
            WHEN EXISTS (
              SELECT 1 FROM reconciliation_runs rr
              WHERE rr.tenant_id = uf.tenant_id
                AND rr.marketplace = uf.marketplace
                AND rr.settlement_id = uf.settlement_id
                AND rr.status = 'COMPLETED'
                AND rr.trigger_type = 'FULL'
            ) THEN 'COMPLETED'
            WHEN EXISTS (
              SELECT 1 FROM reconciliation_runs rr
              WHERE rr.tenant_id = uf.tenant_id
                AND rr.marketplace = uf.marketplace
                AND rr.settlement_id = uf.settlement_id
                AND rr.status = 'STARTED'
            ) THEN 'PROCESSING'
            ELSE 'NOT_RUN'
          END AS reconciliation_status,
          COALESCE(ct.claims_count, 0) AS claims_count
        FROM uploaded_files uf
        LEFT JOIN sfl_totals sfl ON sfl.uploaded_file_id = uf.id
        LEFT JOIN claim_totals ct
          ON ct.settlement_id = uf.settlement_id
         AND ct.tenant_id = uf.tenant_id
        WHERE uf.tenant_id = $1
          AND ($2 = '' OR uf.marketplace = $2)
          ${showAll === "true" ? "" : "AND uf.status != 'DUPLICATE'"}
        ORDER BY uf.created_at DESC
      `,
      [tenantId, marketplace || ""],
    );

    const summaryResult = await pool.query(
      `
        SELECT
          COUNT(*) FILTER (WHERE uf.status != 'DUPLICATE') AS total_files,
          COALESCE(SUM(sfl_totals.net_amount) FILTER (WHERE uf.status != 'DUPLICATE'), 0) AS total_net_amount,
          COUNT(*) FILTER (WHERE uf.status = 'PROCESSED') AS processed_count,
          COUNT(*) FILTER (WHERE uf.status NOT IN ('PROCESSED', 'DUPLICATE')) AS pending_count
        FROM uploaded_files uf
        LEFT JOIN (
          SELECT uploaded_file_id, SUM(amount) AS net_amount
          FROM settlement_fee_lines
          GROUP BY uploaded_file_id
        ) sfl_totals ON sfl_totals.uploaded_file_id = uf.id
        WHERE uf.tenant_id = $1
          AND ($2 = '' OR uf.marketplace = $2)
      `,
      [tenantId, marketplace || ""],
    );

    return res.json({
      files: result.rows,
      summary: summaryResult.rows[0] ?? null,
    });
  } catch (error) {
    console.error("Settlements files error:", error);
    return res.status(500).json({ error: "Failed to fetch settlement files" });
  }
});

router.post(
  "/settlements/upload-file",
  upload.single("file"),
  async (req: Request, res: Response) => {
    const tenantId = String(req.body?.tenant_id ?? "").trim();
    const userProfileId = req.body?.user_profile_id ? String(req.body.user_profile_id).trim() : null;
    const userName = req.body?.user_name ? String(req.body.user_name).trim() : null;
    const marketplace = String(req.body?.marketplace ?? "").trim();
    const file = req.file;

    if (!file) {
      return res.status(400).json({ error: "No file provided" });
    }

    if (!tenantId || !marketplace) {
      return res.status(400).json({ error: "tenant_id and marketplace are required" });
    }

    const supabaseUrl =
      process.env.SUPABASE_URL ??
      process.env.PROJECT_URL ??
      process.env.VITE_SUPABASE_URL;
    const serviceRoleKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY ??
      process.env.SERVICE_ROLE_KEY ??
      process.env.SUPABASE_SERVICE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return res.status(500).json({ error: "Supabase environment variables are not configured" });
    }

    try {
      const safeName = (file.originalname || "settlement.csv").replace(/[^a-zA-Z0-9._-]/g, "_");
      const rawName = (file.originalname || "settlement").replace(/\.csv$/i, "").trim();
      const derivedSettlementId = rawName
        .replace(/[^a-zA-Z0-9._-]/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "");
      const uploadedFileId = randomUUID();
      const storagePath = `${tenantId}/${marketplace}/${Date.now()}-${safeName}`;
      const storageObjectPath = storagePath
        .split("/")
        .map((part) => encodeURIComponent(part))
        .join("/");
      const preferredSettlementId =
        derivedSettlementId.length > 5 && derivedSettlementId.length < 50
          ? derivedSettlementId.toUpperCase()
          : `SETTLE-${Date.now()}`;

      const storageResponse = await fetch(
        `${supabaseUrl}/storage/v1/object/settlement-uploads/${storageObjectPath}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${serviceRoleKey}`,
            apikey: serviceRoleKey,
            "Content-Type": file.mimetype || "text/csv",
            "x-upsert": "false",
          },
          body: file.buffer,
        },
      );

      if (!storageResponse.ok) {
        throw new Error(`Storage upload failed: ${await storageResponse.text()}`);
      }

      const insertUploadedFile = async (settlementId: string) =>
        fetch(`${supabaseUrl}/rest/v1/uploaded_files`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${serviceRoleKey}`,
            apikey: serviceRoleKey,
            "Content-Type": "application/json",
            Prefer: "return=representation",
          },
          body: JSON.stringify({
            id: uploadedFileId,
            tenant_id: tenantId,
            marketplace,
            settlement_id: settlementId,
            file_name: file.originalname || "settlement.csv",
            storage_path: storagePath,
            status: "PROCESSING",
          }),
        });

      let insertResponse = await insertUploadedFile(preferredSettlementId);
      let insertErrorText = insertResponse.ok ? "" : await insertResponse.text();

      if (
        !insertResponse.ok &&
        insertResponse.status === 409 &&
        insertErrorText.includes("uploaded_files_idempotency_uq")
      ) {
        insertResponse = await insertUploadedFile(`SETTLE-${Date.now()}`);
        insertErrorText = insertResponse.ok ? "" : await insertResponse.text();
      }

      if (!insertResponse.ok) {
        throw new Error(`uploaded_files insert failed: ${insertErrorText}`);
      }

      const insertedRows = (await insertResponse.json()) as Array<{ id: string }>;
      const uploadRowId = insertedRows[0]?.id ?? uploadedFileId;

      const edgeResponse = await fetch(
        `${supabaseUrl}/functions/v1/process-settlement-upload`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${serviceRoleKey}`,
            apikey: serviceRoleKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            uploaded_file_id: uploadRowId,
            tenant_id: tenantId,
            marketplace,
          }),
        },
      );

      const edgeText = await edgeResponse.text();
      let edgeResult: unknown = null;
      try {
        edgeResult = edgeText ? JSON.parse(edgeText) : null;
      } catch {
        edgeResult = edgeText;
      }

      if (!edgeResponse.ok) {
        throw new Error(
          `Edge function failed: ${typeof edgeResult === "string" ? edgeResult : JSON.stringify(edgeResult)}`,
        );
      }

      const edgeStatus =
        typeof edgeResult === "object" &&
        edgeResult !== null &&
        "status" in edgeResult &&
        typeof edgeResult.status === "string"
          ? edgeResult.status
          : null;
      const edgeRowCount =
        typeof edgeResult === "object" &&
        edgeResult !== null &&
        "row_count" in edgeResult &&
        typeof edgeResult.row_count !== "undefined"
          ? Number(edgeResult.row_count) || null
          : null;
      const finalStatus =
        edgeStatus === "DUPLICATE"
          ? "DUPLICATE"
          : edgeStatus === "PROCESSED"
            ? "PROCESSED"
            : edgeStatus === "FAILED"
              ? "FAILED"
              : "PROCESSING";
      const confirmedSettlementId =
        typeof edgeResult === "object" &&
        edgeResult !== null &&
        "settlement_id" in edgeResult &&
        typeof edgeResult.settlement_id === "string" &&
        edgeResult.settlement_id.trim()
          ? edgeResult.settlement_id
          : preferredSettlementId;

      await pool.query(
        `
          UPDATE uploaded_files
          SET
            status = $1,
            row_count = COALESCE($2, row_count),
            processed_at = CASE
              WHEN $1 IN ('PROCESSED', 'DUPLICATE', 'FAILED') THEN NOW()
              ELSE processed_at
            END,
            updated_at = NOW()
          WHERE id = $3
        `,
        [finalStatus, edgeRowCount, uploadRowId],
      );

      await logAuditEvent({
        tenantId,
        userProfileId,
        userName,
        action: "FILE_UPLOADED",
        module: "uploads",
        entityType: "upload",
        entityId: uploadRowId,
        description: `Settlement file uploaded (${edgeRowCount ?? 0} rows)`,
        metadata: {
          upload_type: "settlement",
          row_count: edgeRowCount,
          marketplace,
          final_status: finalStatus,
        },
      });

      return res.json({
        status: "success",
        message:
          finalStatus === "DUPLICATE"
            ? "This settlement has already been processed"
            : "Settlement file uploaded and processing started",
        uploaded_file_id: uploadRowId,
        settlement_id: confirmedSettlementId,
        marketplace,
        result: edgeResult,
      });
    } catch (error) {
      console.error("Settlement upload error:", error);
      return res.status(500).json({ error: "Failed to upload settlement file" });
    }
  },
);

router.get("/claims/detail", async (req: Request, res: Response) => {
  const {
    batch_id: batchId,
    group_key: groupKey,
    claim_id: claimId,
    tenant_id: tenantId,
  } = req.query as Record<
    string,
    string
  >;

  if ((!batchId || !groupKey) && !claimId) {
    return res.status(400).json({
      error: "batch_id and group_key, or claim_id, and tenant_id are required",
    });
  }

  if (!tenantId) {
    return res.status(400).json({ error: "tenant_id is required" });
  }

  try {
    if (claimId) {
      const singleClaimQuery = `
        SELECT
          c.id,
          COALESCE(c.batch_id::text, c.id::text) AS resolved_batch_id,
          COALESCE(c.group_key, c.order_id) AS resolved_group_key,
          c.order_id,
          c.bucket,
          c.zone,
          c.marketplace,
          c.claim_amount,
          c.expected_amount,
          c.actual_amount,
          c.discrepancy_amount,
          c.claim_status,
          c.evidence_snapshot,
          c.marketplace_ticket_id,
          c.created_by,
          c.submitted_at,
          c.created_at,
          c.updated_at,
          c.resolution_status,
          c.recovered_at,
          o.sku,
          o.dispatch_date,
          cb.batch_name,
          CONCAT(
            'CLM-',
            UPPER(SUBSTRING(MD5(c.id::text), 1, 4)),
            '-01'
          ) AS display_id
        FROM claims c
        LEFT JOIN orders o
          ON o.order_id = c.order_id
         AND o.tenant_id = c.tenant_id
        LEFT JOIN claim_batches cb
          ON cb.id = c.batch_id
        WHERE c.id = $1::uuid
          AND c.tenant_id = $2
        LIMIT 1
      `;

      const singleClaimResult = await pool.query(singleClaimQuery, [claimId, tenantId]);
      const claimRow = singleClaimResult.rows[0];
      if (!claimRow) {
        return res.status(404).json({ error: "Claim not found" });
      }

      return res.json({
        claim: {
          display_id: claimRow.display_id,
          batch_id: claimRow.resolved_batch_id,
          group_key: claimRow.resolved_group_key,
          order_id: claimRow.order_id ?? null,
          marketplace: claimRow.marketplace,
          bucket: claimRow.bucket,
          zone: claimRow.zone || null,
          claim_status: claimRow.claim_status,
          total_claim_value: asNumber(claimRow.claim_amount),
          order_count: 1,
          created_at: claimRow.created_at,
          updated_at: claimRow.updated_at,
          marketplace_ticket_id: claimRow.marketplace_ticket_id,
          created_by: claimRow.created_by,
          submitted_at: claimRow.submitted_at ?? null,
          batch_name: String(claimRow.batch_name ?? ""),
          claim_ids: [claimRow.id],
          recovered_at: claimRow.recovered_at ?? null,
        },
        summary: {
          expected_total: asNumber(claimRow.expected_amount),
          actual_total: asNumber(claimRow.actual_amount),
          difference: asNumber(claimRow.claim_amount),
        },
        orders: [
          {
            order_id: claimRow.order_id,
            claim_id: claimRow.id,
            sku: claimRow.sku ?? "—",
            date: claimRow.dispatch_date ?? claimRow.created_at,
            expected: asNumber(claimRow.expected_amount),
            actual: asNumber(claimRow.actual_amount),
            diff: asNumber(claimRow.claim_amount),
            resolution_status: claimRow.resolution_status ?? "PENDING",
            recovered_at: claimRow.recovered_at ?? null,
            evidence: claimRow.evidence_snapshot ?? null,
          },
        ],
      });
    }

    const claimsQuery = `
      SELECT
        c.id,
        c.order_id,
        c.bucket,
        c.zone,
        c.marketplace,
        c.claim_amount,
        c.expected_amount,
        c.actual_amount,
        c.discrepancy_amount,
        c.claim_status,
        c.evidence_snapshot,
        c.marketplace_ticket_id,
        c.created_by,
        c.submitted_at,
        c.created_at,
        c.updated_at,
        c.resolution_status,
        c.recovered_at,
        o.sku,
        o.dispatch_date,
        cb.batch_name,
        CONCAT(
          'CLM-',
          UPPER(SUBSTRING(MD5($1::text), 1, 4)),
          '-',
          LPAD(
            ROW_NUMBER() OVER (
              PARTITION BY c.batch_id
              ORDER BY c.created_at
            )::text,
            2,
            '0'
          )
        ) AS display_id
      FROM claims c
      LEFT JOIN orders o
        ON o.order_id = c.order_id
       AND o.tenant_id = c.tenant_id
      LEFT JOIN claim_batches cb
        ON cb.id = c.batch_id
      WHERE c.batch_id = $1::uuid
        AND c.group_key = $2
        AND c.tenant_id = $3
      ORDER BY c.created_at ASC
    `;

    const claimsResult = await pool.query(claimsQuery, [batchId, groupKey, tenantId]);
    if (!claimsResult.rows.length) {
      return res.status(404).json({ error: "Claim group not found" });
    }

    const firstClaim = claimsResult.rows[0];
    const expectedTotal = claimsResult.rows.reduce(
      (sum, row) => sum + asNumber(row.expected_amount),
      0,
    );
    const actualTotal = claimsResult.rows.reduce((sum, row) => sum + asNumber(row.actual_amount), 0);
    const totalClaimValue = claimsResult.rows.reduce(
      (sum, row) => sum + asNumber(row.claim_amount),
      0,
    );

    return res.json({
      claim: {
        display_id: firstClaim.display_id,
        batch_id: batchId,
        group_key: groupKey,
        order_id: claimsResult.rows.length === 1 ? firstClaim.order_id ?? null : null,
        marketplace: firstClaim.marketplace ?? groupKey.split("|")[0],
        bucket: firstClaim.bucket,
        zone: firstClaim.zone || groupKey.split("|")[2] || null,
        claim_status: firstClaim.claim_status,
        total_claim_value: totalClaimValue,
        order_count: claimsResult.rows.length,
        created_at: firstClaim.created_at,
        updated_at: firstClaim.updated_at,
        marketplace_ticket_id: firstClaim.marketplace_ticket_id,
        created_by: firstClaim.created_by,
        submitted_at: firstClaim.submitted_at ?? null,
        batch_name: String(firstClaim.batch_name ?? ""),
        claim_ids: claimsResult.rows.map((row) => row.id),
        recovered_at: firstClaim.recovered_at ?? null,
      },
      summary: {
        expected_total: expectedTotal,
        actual_total: actualTotal,
        difference: totalClaimValue,
      },
      orders: claimsResult.rows.map((row) => ({
        order_id: row.order_id,
        claim_id: row.id,
        sku: row.sku ?? "—",
        date: row.dispatch_date ?? row.created_at,
        expected: asNumber(row.expected_amount),
        actual: asNumber(row.actual_amount),
        diff: asNumber(row.claim_amount),
        resolution_status: row.resolution_status ?? "PENDING",
        recovered_at: row.recovered_at ?? null,
        evidence: row.evidence_snapshot ?? null,
      })),
    });
  } catch (error) {
    console.error("Claim detail error:", error);
    return res.status(500).json({ error: "Failed to fetch claim detail" });
  }
});

router.patch("/claims/:id/resolution", async (req: Request, res: Response) => {
  const claimId = String(req.params.id ?? "").trim();
  const {
    resolution_status: resolutionStatus,
    tenant_id: tenantId,
    user_profile_id: userProfileId,
    user_name: userName,
  } = req.body ?? {};

  if (!tenantId) {
    return res.status(400).json({ error: "Missing tenant_id" });
  }

  if (!["APPROVED", "REJECTED", "PENDING"].includes(String(resolutionStatus ?? ""))) {
    return res.status(400).json({ error: "Invalid resolution_status" });
  }

  try {
    const previousStatusResult = await pool.query(
      `
        SELECT resolution_status
        FROM claims
        WHERE id = $1
          AND tenant_id = $2
        LIMIT 1
      `,
      [claimId, tenantId],
    );
    const previousStatus = previousStatusResult.rows[0]?.resolution_status ?? null;

    await pool.query(
      `
        UPDATE claims
        SET
          resolution_status = $1,
          resolution_updated_at = NOW(),
          recovered_at = CASE WHEN $1 = 'APPROVED' THEN recovered_at ELSE NULL END,
          updated_at = NOW()
        WHERE id = $2
          AND tenant_id = $3
      `,
      [resolutionStatus, claimId, tenantId],
    );

    const allOrdersQuery = await pool.query(
      `
        SELECT resolution_status
        FROM claims
        WHERE tenant_id = $1
          AND (
            (batch_id IS NOT NULL AND batch_id = (SELECT batch_id FROM claims WHERE id = $2))
            OR (batch_id IS NULL AND id = $2)
          )
      `,
      [tenantId, claimId],
    );

    if (resolutionStatus === "PENDING") {
      await pool.query(
        `
          UPDATE claims
          SET claim_status = 'IN_REVIEW',
              updated_at = NOW()
          WHERE tenant_id = $1
            AND claim_status = 'CLOSED'
            AND (
              (batch_id IS NOT NULL AND batch_id = (SELECT batch_id FROM claims WHERE id = $2))
              OR (batch_id IS NULL AND id = $2)
            )
        `,
        [tenantId, claimId],
      );
    } else {
      const allResolved =
        allOrdersQuery.rows.length > 0 &&
        allOrdersQuery.rows.every(
          (row) => row.resolution_status === "APPROVED" || row.resolution_status === "REJECTED",
        );

      if (allResolved) {
        await pool.query(
          `
            UPDATE claims
            SET claim_status = 'CLOSED',
                updated_at = NOW()
            WHERE tenant_id = $1
              AND (
                (batch_id IS NOT NULL AND batch_id = (SELECT batch_id FROM claims WHERE id = $2))
                OR (batch_id IS NULL AND id = $2)
              )
          `,
          [tenantId, claimId],
        );
      }
    }

    const displayId = await getClaimAuditReference({
      tenantId,
      claimId,
    });

    await logAuditEvent({
      tenantId,
      userProfileId: userProfileId || null,
      userName: userName || null,
      action: "CLAIM_STATUS_CHANGED",
      module: "claims",
      entityType: "claim",
      entityId: claimId,
      description: `Claim ${displayId} status changed to ${resolutionStatus}`,
      metadata: {
        previous_status: previousStatus,
        new_status: resolutionStatus,
      },
    });

    return res.json({ status: "success" });
  } catch (error) {
    console.error("Resolution update error:", error);
    return res.status(500).json({ error: "Failed to update resolution" });
  }
});

router.patch("/claims/detail", async (req: Request, res: Response) => {
  const {
    batch_id: batchId,
    group_key: groupKey,
    claim_id: claimId,
    tenant_id: tenantId,
    user_profile_id: userProfileId,
    user_name: userName,
    claim_status: claimStatus,
    marketplace_ticket_id: marketplaceTicketId,
    created_by: createdBy,
    submitted_at: submittedAt,
  } = req.body ?? {};

  if ((!batchId || !groupKey) && !claimId) {
    return res.status(400).json({
      error: "batch_id and group_key, or claim_id, and tenant_id required",
    });
  }

  if (!tenantId) {
    return res.status(400).json({ error: "tenant_id required" });
  }

  if (claimStatus === "CLOSED") {
    return res.status(400).json({
      error:
        "CLOSED status is set automatically when all orders are resolved. Use resolution actions to close a claim.",
    });
  }

  const allowedWorkflowStatuses = ["DRAFT", "SUBMITTED", "IN_REVIEW", "FOLLOW_UP"];
  if (claimStatus && !allowedWorkflowStatuses.includes(claimStatus)) {
    return res.status(400).json({
      error: `Invalid workflow status. Allowed: ${allowedWorkflowStatuses.join(", ")}`,
    });
  }

  try {
    let previousClaimStatus: string | null = null;
    if (claimStatus) {
      const previousQuery = claimId
        ? `
            SELECT claim_status
            FROM claims
            WHERE id = $1::uuid
              AND tenant_id = $2
            LIMIT 1
          `
        : `
            SELECT claim_status
            FROM claims
            WHERE batch_id = $1::uuid
              AND group_key = $2
              AND tenant_id = $3
            LIMIT 1
          `;
      const previousParams = claimId ? [claimId, tenantId] : [batchId, groupKey, tenantId];
      const previousResult = await pool.query(previousQuery, previousParams);
      previousClaimStatus = previousResult.rows[0]?.claim_status ?? null;
    }

    const updates: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (claimStatus) {
      updates.push(`claim_status = $${idx++}`);
      values.push(claimStatus);
    }
    if (marketplaceTicketId !== undefined) {
      updates.push(`marketplace_ticket_id = $${idx++}`);
      values.push(marketplaceTicketId);
    }
    if (createdBy !== undefined) {
      updates.push(`created_by = $${idx++}`);
      values.push(createdBy);
    }
    if (submittedAt !== undefined) {
      updates.push(`submitted_at = COALESCE(submitted_at, $${idx++}::timestamptz)`);
      values.push(submittedAt ?? null);
    }
    updates.push("updated_at = NOW()");

    if (claimId) {
      values.push(claimId, tenantId);
      await pool.query(
        `
          UPDATE claims
          SET ${updates.join(", ")}
          WHERE id = $${idx++}::uuid
            AND tenant_id = $${idx++}
        `,
        values,
      );
    } else {
      values.push(batchId, groupKey, tenantId, batchId, groupKey, tenantId);
      await pool.query(
        `
          UPDATE claims
          SET ${updates.join(", ")}
          WHERE (
            batch_id = $${idx++}::uuid
            AND group_key = $${idx++}
            AND tenant_id = $${idx++}
          ) OR (
            id = $${idx++}::uuid
            AND order_id = $${idx++}
            AND tenant_id = $${idx++}
            AND batch_id IS NULL
          )
        `,
        values,
      );
    }

    if (claimStatus) {
      const entityId = claimId ? String(claimId) : `${String(batchId)}:${String(groupKey)}`;
      const displayId = await getClaimAuditReference({
        tenantId,
        claimId: claimId ? String(claimId) : null,
        batchId: batchId ? String(batchId) : null,
        groupKey: groupKey ? String(groupKey) : null,
      });
      await logAuditEvent({
        tenantId,
        userProfileId: userProfileId || null,
        userName: userName || null,
        action: "CLAIM_STATUS_CHANGED",
        module: "claims",
        entityType: "claim",
        entityId,
        description: `Claim ${displayId} status changed to ${claimStatus}`,
        metadata: {
          previous_status: previousClaimStatus,
          new_status: claimStatus,
        },
      });
    }

    return res.json({ status: "success" });
  } catch (error) {
    console.error("Claim update error:", error);
    return res.status(500).json({ error: "Failed to update claim" });
  }
});

router.get("/claims/:id", async (req: Request, res: Response) => {
  try {
    const claimId = String(req.params.id ?? "").trim();
    const tenantId = String(req.query.tenant_id ?? "").trim();

    if (!claimId || !tenantId) {
      return res.status(400).json({ error: "id and tenant_id are required" });
    }

    const detailQuery = `
      SELECT c.*, r.settlement_id
      FROM claims c
      LEFT JOIN reconciliation_runs r ON r.id = c.reconciliation_run_id
      WHERE c.id = $1
        AND c.tenant_id = $2
      LIMIT 1
    `;
    const result = await pool.query(detailQuery, [claimId, tenantId]);
    const claim = result.rows[0];
    if (!claim) {
      return res.status(404).json({ error: "Claim not found" });
    }

    return res.json({ claim });
  } catch (error) {
    console.error("Error fetching claim detail:", error);
    return res.status(500).json({ error: "Failed to fetch claim detail" });
  }
});

router.get("/claims/:id/comments", async (req: Request, res: Response) => {
  const { id } = req.params;
  const { tenant_id: tenantId } = req.query as Record<string, string>;

  if (!tenantId) {
    return res.status(400).json({ error: "tenant_id is required" });
  }

  try {
    const result = await pool.query(
      `
        SELECT id, claim_id, author, body, created_at, updated_at
        FROM claim_comments
        WHERE claim_id = $1
          AND tenant_id = $2
        ORDER BY created_at ASC
        LIMIT 100
      `,
      [id, tenantId],
    );

    return res.json({ comments: result.rows });
  } catch (error) {
    console.error("fetch comments error:", error);
    return res.status(500).json({ error: "Failed to fetch comments" });
  }
});

router.post("/claims/:id/comments", async (req: Request, res: Response) => {
  const { id } = req.params;
  const { tenant_id: tenantId, body, author } = req.body ?? {};

  if (!tenantId || !String(body ?? "").trim()) {
    return res.status(400).json({ error: "tenant_id and body are required" });
  }

  try {
    const result = await pool.query(
      `
        INSERT INTO claim_comments (claim_id, tenant_id, author, body)
        VALUES ($1, $2, $3, $4)
        RETURNING id, claim_id, author, body, created_at, updated_at
      `,
      [id, tenantId, String(author ?? "").trim() || "User", String(body).trim()],
    );

    return res.json({ comment: result.rows[0] });
  } catch (error) {
    console.error("post comment error:", error);
    return res.status(500).json({ error: "Failed to post comment" });
  }
});

router.patch("/claims/:id", async (req: Request, res: Response) => {
  try {
    const claimId = String(req.params.id ?? "").trim();
    const tenantId = String(req.query.tenant_id ?? req.body?.tenant_id ?? "").trim();
    const hasRecoveredAtField = Object.prototype.hasOwnProperty.call(req.body ?? {}, "recovered_at");

    if (!claimId || !tenantId) {
      return res.status(400).json({ error: "id and tenant_id are required" });
    }

    const claimStatus =
      typeof req.body?.claim_status === "string" ? req.body.claim_status.trim() : null;
    const createdBy =
      typeof req.body?.created_by === "string" ? req.body.created_by.trim() : null;
    const marketplaceTicketId =
      typeof req.body?.marketplace_ticket_id === "string"
        ? req.body.marketplace_ticket_id.trim()
        : null;
    const recoveredAt =
      typeof req.body?.recovered_at === "string" ? req.body.recovered_at.trim() : null;

    if (
      claimStatus === null &&
      createdBy === null &&
      marketplaceTicketId === null &&
      !hasRecoveredAtField
    ) {
      return res.status(400).json({
        error:
          "At least one of claim_status, created_by, marketplace_ticket_id, recovered_at is required",
      });
    }

    const checkQuery = `
      SELECT id, resolution_status
      FROM claims
      WHERE id = $1
        AND tenant_id = $2
      LIMIT 1
    `;
    const checkResult = await pool.query(checkQuery, [claimId, tenantId]);
    if (!checkResult.rows[0]) {
      return res.status(404).json({ error: "Claim not found" });
    }

    if (recoveredAt !== null && checkResult.rows[0].resolution_status !== "APPROVED") {
      return res.status(400).json({
        error: "Cannot mark as recovered. Order must be approved by marketplace first.",
      });
    }

    const updateQuery = `
      UPDATE claims
      SET
        claim_status = COALESCE($1, claim_status),
        created_by = COALESCE($2, created_by),
        marketplace_ticket_id = COALESCE($3, marketplace_ticket_id),
        recovered_at = COALESCE(recovered_at, $4::timestamptz),
        updated_at = NOW()
      WHERE id = $5
        AND tenant_id = $6
      RETURNING *
    `;
    const updateResult = await pool.query(updateQuery, [
      claimStatus,
      createdBy,
      marketplaceTicketId,
      recoveredAt ?? null,
      claimId,
      tenantId,
    ]);

    return res.json({ claim: updateResult.rows[0] });
  } catch (error) {
    console.error("Error updating claim:", error);
    return res.status(500).json({ error: "Failed to update claim" });
  }
});

router.post("/claims", async (req: Request, res: Response) => {
  const {
    tenant_id: tenantId,
    marketplace: requestedMarketplace,
    order_id: orderId,
    bucket,
    reconciliation_run_id: reconciliationRunId,
    reconciliation_component_id: reconciliationComponentId,
    uploaded_file_id: uploadedFileId,
    claim_amount: requestedClaimAmount,
    expected_amount: requestedExpectedAmount,
    actual_amount: requestedActualAmount,
    notes,
  } = req.body ?? {};

  if (!tenantId || !orderId || !bucket) {
    return res.status(400).json({
      error: "tenant_id, order_id and bucket are required",
    });
  }

  try {
    let resolvedRunId = reconciliationRunId;

    if (!resolvedRunId && bucket === "PAYMENT_NOT_RECEIVED") {
      if (!requestedMarketplace) {
        return res.status(400).json({
          error: "marketplace is required for PAYMENT_NOT_RECEIVED claims",
        });
      }

      const latestRunResult = await pool.query(
        `
          SELECT id
          FROM reconciliation_runs
          WHERE tenant_id = $1
            AND marketplace = $2
            AND status = 'COMPLETED'
            AND trigger_type = 'FULL'
          ORDER BY completed_at DESC NULLS LAST, created_at DESC
          LIMIT 1
        `,
        [tenantId, requestedMarketplace],
      );

      resolvedRunId = latestRunResult.rows[0]?.id ?? null;
      if (!resolvedRunId) {
        return res.status(400).json({
          error: "No completed reconciliation run found for this marketplace",
        });
      }
    }

    if (!resolvedRunId && bucket !== "PAYMENT_NOT_RECEIVED") {
      return res.status(400).json({
        error: "reconciliation_run_id is required",
      });
    }

    const existingClaimQuery = `
      SELECT *
      FROM claims
      WHERE tenant_id = $1
        AND order_id = $2
        AND bucket = $3
        AND reconciliation_run_id = $4
      LIMIT 1
    `;
    const existingClaimResult = await pool.query(existingClaimQuery, [
      tenantId,
      orderId,
      bucket,
      resolvedRunId,
    ]);
    if (existingClaimResult.rowCount && existingClaimResult.rows[0]) {
      return res.status(200).json({ claim: existingClaimResult.rows[0] });
    }

    const runQuery = `
      SELECT id, tenant_id, marketplace
      FROM reconciliation_runs
      WHERE id = $1
      LIMIT 1
    `;
    const runResult = await pool.query(runQuery, [resolvedRunId]);
    const run = runResult.rows[0];
    if (!run) {
      return res.status(404).json({ error: "Reconciliation run not found" });
    }

    if (String(run.tenant_id) !== String(tenantId)) {
      return res.status(400).json({
        error: "tenant_id does not match reconciliation_run_id",
      });
    }

    let expectedAmount = 0;
    let actualAmount = 0;
    let discrepancyAmount = 0;

    if (bucket === "PAYMENT_NOT_RECEIVED") {
      expectedAmount = asNumber(requestedExpectedAmount ?? requestedClaimAmount);
      actualAmount = asNumber(requestedActualAmount);
      discrepancyAmount =
        asNumber(requestedClaimAmount) ||
        Math.max(expectedAmount - actualAmount, 0);
    } else if (reconciliationComponentId) {
      const componentQuery = `
        SELECT expected_amount, actual_amount, discrepancy_amount
        FROM reconciliation_fee_components
        WHERE id = $1
        LIMIT 1
      `;
      const componentResult = await pool.query(componentQuery, [reconciliationComponentId]);
      const component = componentResult.rows[0];
      if (!component) {
        return res.status(404).json({ error: "Reconciliation snapshot not found" });
      }

      expectedAmount = asNumber(component.expected_amount);
      actualAmount = asNumber(component.actual_amount);
      discrepancyAmount = asNumber(component.discrepancy_amount);
    } else {
      const summaryQuery = `
        SELECT expected_commission AS expected_amount,
               actual_commission AS actual_amount,
               commission_discrepancy AS discrepancy
        FROM reconciliation_order_summary
        WHERE order_id = $1
          AND run_id = $2
          AND tenant_id = $3
          AND marketplace = $4
        LIMIT 1
      `;
      const summaryResult = await pool.query(summaryQuery, [
        orderId,
        reconciliationRunId,
        tenantId,
        run.marketplace,
      ]);
      const summary = summaryResult.rows[0];
      if (!summary) {
        return res.status(404).json({ error: "Reconciliation snapshot not found" });
      }

      expectedAmount = asNumber(summary.expected_amount);
      actualAmount = asNumber(summary.actual_amount);
      discrepancyAmount = asNumber(summary.discrepancy);
    }

    const claimAmount = Math.abs(discrepancyAmount);
    const evidenceSnapshot = {
      orderId,
      bucket,
      expectedAmount,
      actualAmount,
      discrepancyAmount,
      createdFromRun: resolvedRunId,
      notes: notes ?? null,
      ...(bucket === "PAYMENT_NOT_RECEIVED" && { source: "PAYMENT_ALERT" }),
    };

    const insertQuery = `
      INSERT INTO claims (
        tenant_id,
        marketplace,
        order_id,
        bucket,
        claim_amount,
        expected_amount,
        actual_amount,
        discrepancy_amount,
        reconciliation_run_id,
        reconciliation_component_id,
        uploaded_file_id,
        evidence_snapshot,
        claim_status
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb, 'DRAFT'
      )
      RETURNING *
    `;

    const insertParams = [
      tenantId,
      run.marketplace,
      orderId,
      bucket,
      claimAmount,
      expectedAmount,
      actualAmount,
      discrepancyAmount,
      resolvedRunId,
      reconciliationComponentId ?? null,
      uploadedFileId ?? null,
      JSON.stringify(evidenceSnapshot),
    ];

    try {
      const inserted = await pool.query(insertQuery, insertParams);
      return res.status(200).json({ claim: inserted.rows[0] });
    } catch (insertError: any) {
      if (insertError?.code === "23505") {
        const dupeResult = await pool.query(existingClaimQuery, [
          tenantId,
          orderId,
          bucket,
          resolvedRunId,
        ]);
        if (dupeResult.rowCount && dupeResult.rows[0]) {
          return res.status(200).json({ claim: dupeResult.rows[0] });
        }
      }
      throw insertError;
    }
  } catch (error) {
    console.error("Create claim error:", error);
    return res.status(500).json({ error: "Failed to create claim" });
  }
});

router.get("/users", async (req: Request, res: Response) => {
  const { tenant_id: tenantId } = req.query as Record<string, string>;
  if (!tenantId) return res.status(400).json({ error: "tenant_id required" });

  try {
    const result = await pool.query(
      `SELECT
        id, auth_user_id, full_name, email, role,
        department, status, avatar_color, created_at, last_login
       FROM user_profiles
       WHERE tenant_id = $1
       ORDER BY created_at ASC`,
      [tenantId],
    );
    return res.json({ users: result.rows });
  } catch (err) {
    console.error("fetch users error:", err);
    return res.status(500).json({ error: "Failed to fetch users" });
  }
});

router.get("/users/by-auth-id", async (req: Request, res: Response) => {
  const { auth_user_id: authUserId, tenant_id: tenantId } = req.query as Record<string, string>;
  if (!authUserId || !tenantId) {
    return res.status(400).json({ error: "auth_user_id and tenant_id required" });
  }

  try {
    const result = await pool.query(
      `SELECT id, full_name, email, role, avatar_color
       FROM user_profiles
       WHERE auth_user_id = $1 AND tenant_id = $2
       LIMIT 1`,
      [authUserId, tenantId],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "User profile not found" });
    }

    return res.json({ user: result.rows[0] });
  } catch (err) {
    console.error("by-auth-id error:", err);
    return res.status(500).json({ error: "Failed to fetch user" });
  }
});

router.get("/audit-log", async (req: Request, res: Response) => {
  const { tenant_id: tenantId, module, limit = "100" } = req.query as Record<string, string>;
  if (!tenantId) return res.status(400).json({ error: "tenant_id required" });

  try {
    const parsedLimit = Number.parseInt(limit, 10);
    const effectiveLimit = Number.isFinite(parsedLimit) ? Math.max(1, Math.min(parsedLimit, 500)) : 100;
    const result = await pool.query(
      `SELECT
        al.id,
        al.action,
        al.module,
        al.entity_type,
        al.entity_id,
        al.description,
        al.metadata,
        al.status,
        al.created_at,
        al.user_name,
        up.full_name,
        up.email,
        up.avatar_color
       FROM audit_log al
       LEFT JOIN user_profiles up ON al.user_profile_id = up.id
       WHERE al.tenant_id = $1
         AND ($2::text IS NULL OR al.module = $2)
       ORDER BY al.created_at DESC
       LIMIT $3`,
      [tenantId, module || null, effectiveLimit],
    );

    return res.json({ events: result.rows });
  } catch (err) {
    console.error("audit log fetch error:", err);
    return res.status(500).json({ error: "Failed to fetch audit log" });
  }
});

router.patch("/users/:id", async (req: Request, res: Response) => {
  const { id } = req.params;
  const { tenant_id: tenantId, role, department, status, full_name: fullName } = req.body ?? {};

  if (!tenantId) return res.status(400).json({ error: "tenant_id required" });

  try {
    const result = await pool.query(
      `UPDATE user_profiles
       SET
         role = COALESCE($1, role),
         department = COALESCE($2, department),
         status = COALESCE($3, status),
         full_name = COALESCE($4, full_name)
       WHERE id = $5 AND tenant_id = $6
       RETURNING *`,
      [role ?? null, department ?? null, status ?? null, fullName ?? null, id, tenantId],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    return res.json({ user: result.rows[0] });
  } catch (err) {
    console.error("update user error:", err);
    return res.status(500).json({ error: "Failed to update user" });
  }
});

router.delete("/users/:id", async (req: Request, res: Response) => {
  const { id } = req.params;
  const { tenant_id: tenantId } = req.body ?? {};

  if (!tenantId) return res.status(400).json({ error: "tenant_id required" });

  try {
    const result = await pool.query(
      `DELETE FROM user_profiles
       WHERE id = $1 AND tenant_id = $2
       RETURNING id`,
      [id, tenantId],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    return res.json({ success: true });
  } catch (err) {
    console.error("delete user error:", err);
    return res.status(500).json({ error: "Failed to delete user" });
  }
});

export default router;
