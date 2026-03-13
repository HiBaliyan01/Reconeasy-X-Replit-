import { Router, type Request, type Response } from "express";
import { pool } from "../db";

type CursorShape = {
  dispatchDate: string;
  orderId: string;
};

const router = Router();

function asNumber(value: unknown): number {
  const num = Number(value ?? 0);
  return Number.isFinite(num) ? num : 0;
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

router.get("/reconciliation/orders", async (req: Request, res: Response) => {
  try {
    const tenantId = String(req.query.tenant_id ?? "").trim();
    const marketplace = String(req.query.marketplace ?? "").trim();
    const status = String(req.query.status ?? "").trim();
    const statusList = status
      ? status
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : [];
    const limit = parseLimit(req.query.limit);
    const cursor = parseCursor(req.query.cursor);

    if (!tenantId || !marketplace) {
      return res.status(400).json({ error: "tenant_id and marketplace are required" });
    }

    const params: Array<string | number | string[]> = [tenantId, marketplace];
    let whereClause = "ros.tenant_id = $1 AND ros.marketplace = $2";

    if (statusList.length > 0) {
      params.push(statusList);
      whereClause += ` AND ros.status = ANY($${params.length}::text[])`;
    } else {
      whereClause += " AND ros.status != 'MATCHED'";
    }

    if (cursor) {
      params.push(cursor.dispatchDate, cursor.orderId);
      whereClause += ` AND (ros.created_at::date, ros.order_id) > ($${params.length - 1}, $${params.length})`;
    }

    params.push(limit);

    const rowsQuery = `
      SELECT
        ros.order_id,
        o.sku,
        ros.created_at::date AS dispatch_date,
        ros.expected_commission,
        ros.actual_commission,
        ros.commission_discrepancy,
        ros.status,
        ros.run_id AS run_id
      FROM latest_reconciliation_summary ros
      LEFT JOIN orders o
        ON o.order_id = ros.order_id
       AND o.brand_id = ros.tenant_id
      WHERE ${whereClause}
      ORDER BY ros.created_at::date ASC, ros.order_id ASC
      LIMIT $${params.length}
    `;

    const rowsResult = await pool.query(rowsQuery, params);

    const countParams: Array<string | string[]> = [tenantId, marketplace];
    let countWhere = "tenant_id = $1 AND marketplace = $2";
    if (statusList.length > 0) {
      countParams.push(statusList);
      countWhere += ` AND status = ANY($${countParams.length}::text[])`;
    } else {
      countWhere += " AND status != 'MATCHED'";
    }

    const countQuery = `
      SELECT COUNT(*) AS total_count
      FROM latest_reconciliation_summary
      WHERE ${countWhere}
    `;
    const countResult = await pool.query(countQuery, countParams);
    const totalCount = asNumber(countResult.rows[0]?.total_count);

    const rows = rowsResult.rows.map((row) => ({
      orderId: row.order_id,
      sku: row.sku ?? null,
      dispatchDate: row.dispatch_date,
      expectedCommission: asNumber(row.expected_commission),
      actualCommission: asNumber(row.actual_commission),
      discrepancy: asNumber(row.commission_discrepancy),
      status: row.status,
      runId: row.run_id ?? null,
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

router.get("/reconciliation/order/:orderId", async (req: Request, res: Response) => {
  try {
    const orderId = String(req.params.orderId ?? "").trim();
    const tenantId = String(req.query.tenant_id ?? "").trim();
    const marketplace = String(req.query.marketplace ?? "").trim();

    if (!orderId || !tenantId || !marketplace) {
      return res
        .status(400)
        .json({ error: "orderId, tenant_id and marketplace are required" });
    }

    const detailQuery = `
      SELECT
        order_id,
        created_at::date AS dispatch_date,
        marketplace,
        expected_commission,
        actual_commission,
        commission_discrepancy,
        status
      FROM reconciliation_order_summary
      WHERE order_id = $1
        AND tenant_id = $2
        AND marketplace = $3
      LIMIT 1
    `;

    const detailResult = await pool.query(detailQuery, [orderId, tenantId, marketplace]);
    const detail = detailResult.rows[0];
    if (!detail) {
      return res.status(404).json({ error: "Order not found" });
    }

    const metadataQuery = `
      SELECT
        MAX(sku) FILTER (WHERE sku IS NOT NULL AND sku != '') AS sku,
        MIN(posted_date) AS dispatch_date
      FROM settlement_fee_lines
      WHERE order_id = $1
        AND tenant_id = $2
    `;
    const metadataResult = await pool.query(metadataQuery, [orderId, tenantId]);
    const metadata = metadataResult.rows[0] ?? {};

    const feeQuery = `
      SELECT
        bucket,
        SUM(amount) AS actual_amount
      FROM settlement_fee_lines
      WHERE order_id = $1
        AND tenant_id = $2
      GROUP BY bucket
      ORDER BY bucket ASC
    `;
    const feeResult = await pool.query(feeQuery, [orderId, tenantId]);

    const feeBreakdown = [
      {
        type: "Commission",
        expected: asNumber(detail.expected_commission),
        actual: asNumber(detail.actual_commission),
      },
      ...feeResult.rows
        .filter((fee) => String(fee.bucket ?? "").toLowerCase() !== "commission")
        .map((fee) => ({
          type: fee.bucket,
          expected: null,
          actual: fee.actual_amount === null ? null : asNumber(fee.actual_amount),
        })),
    ];

    return res.json({
      orderId: detail.order_id,
      sku: metadata.sku ?? null,
      dispatchDate: metadata.dispatch_date ?? detail.dispatch_date,
      marketplace: detail.marketplace,
      category: null,
      rateCard: null,
      status: detail.status,
      expectedCommission: asNumber(detail.expected_commission),
      actualCommission: asNumber(detail.actual_commission),
      discrepancy: asNumber(detail.commission_discrepancy),
      expectedRate: null,
      actualRate: null,
      feeBreakdown,
    });
  } catch (error) {
    console.error("Error fetching reconciliation order:", error);
    return res.status(500).json({ error: "Failed to fetch reconciliation order details" });
  }
});

router.get("/reconciliation/summary", async (req: Request, res: Response) => {
  try {
    const tenantId = String(req.query.tenant_id ?? "").trim();
    const marketplace = String(req.query.marketplace ?? "").trim();

    if (!tenantId || !marketplace) {
      return res.status(400).json({ error: "tenant_id and marketplace are required" });
    }

    const summaryQuery = `
      SELECT
        COUNT(*) AS orders_analyzed,
        SUM(CASE WHEN commission_discrepancy < 0 THEN ABS(commission_discrepancy) ELSE 0 END) AS leakage_detected,
        COUNT(CASE WHEN status = 'OVERCHARGED' THEN 1 END) AS overcharged_orders,
        SUM(CASE WHEN commission_discrepancy < 0 THEN ABS(commission_discrepancy) ELSE 0 END) AS recovery_potential
      FROM latest_reconciliation_summary
      WHERE tenant_id = $1
        AND marketplace = $2
    `;

    const result = await pool.query(summaryQuery, [tenantId, marketplace]);
    const summary = result.rows[0] ?? {};

    return res.json({
      ordersAnalyzed: asNumber(summary.orders_analyzed),
      leakageDetected: asNumber(summary.leakage_detected),
      overchargedOrders: asNumber(summary.overcharged_orders),
      recoveryPotential: asNumber(summary.recovery_potential),
    });
  } catch (error) {
    console.error("Error fetching reconciliation summary:", error);
    return res.status(500).json({ error: "Failed to fetch reconciliation summary" });
  }
});

router.post("/reconciliation/run", async (req: Request, res: Response) => {
  const { tenant_id: tenantId, marketplace } = req.body ?? {};
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
      `${supabaseUrl}/functions/v1/run-reconciliation`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${serviceRoleKey}`,
        },
        body: JSON.stringify({
          tenant_id: tenantId,
          marketplace,
          // Phase 2 improvement: derive latest settlement_id automatically.
          settlement_id: "SETTLE123",
        }),
      },
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Edge function failed: ${error}`);
    }

    const result = await response.json();
    return res.json(result);
  } catch (error) {
    console.error("Run reconciliation error:", error);
    return res.status(500).json({
      error: "Failed to trigger reconciliation",
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

router.patch("/claims/:id", async (req: Request, res: Response) => {
  try {
    const claimId = String(req.params.id ?? "").trim();
    const tenantId = String(req.query.tenant_id ?? "").trim();

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

    if (claimStatus === null && createdBy === null && marketplaceTicketId === null) {
      return res.status(400).json({
        error: "At least one of claim_status, created_by, marketplace_ticket_id is required",
      });
    }

    const checkQuery = `
      SELECT id
      FROM claims
      WHERE id = $1
        AND tenant_id = $2
      LIMIT 1
    `;
    const checkResult = await pool.query(checkQuery, [claimId, tenantId]);
    if (!checkResult.rows[0]) {
      return res.status(404).json({ error: "Claim not found" });
    }

    const updateQuery = `
      UPDATE claims
      SET
        claim_status = COALESCE($1, claim_status),
        created_by = COALESCE($2, created_by),
        marketplace_ticket_id = COALESCE($3, marketplace_ticket_id),
        updated_at = NOW()
      WHERE id = $4
        AND tenant_id = $5
      RETURNING *
    `;
    const updateResult = await pool.query(updateQuery, [
      claimStatus,
      createdBy,
      marketplaceTicketId,
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
    order_id: orderId,
    bucket,
    reconciliation_run_id: reconciliationRunId,
    reconciliation_component_id: reconciliationComponentId,
    uploaded_file_id: uploadedFileId,
  } = req.body ?? {};

  if (!tenantId || !orderId || !bucket || !reconciliationRunId) {
    return res.status(400).json({
      error: "tenant_id, order_id, bucket and reconciliation_run_id are required",
    });
  }

  try {
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
      reconciliationRunId,
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
    const runResult = await pool.query(runQuery, [reconciliationRunId]);
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

    if (reconciliationComponentId) {
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
      createdFromRun: reconciliationRunId,
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
      reconciliationRunId,
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
          reconciliationRunId,
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

export default router;
