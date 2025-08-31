import { Router } from "express";
import { z } from "zod";
import { db } from "../../storage";
import { rateCardsV2, rateCardSlabs, rateCardFees } from "@shared/schema";
import { and, eq, sql } from "drizzle-orm";
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

export async function validateRateCard(dbInstance: any, body: Payload) {
  const errs: string[] = [];

  // 1) duplicate fees
  const feeCodes = (body.fees || []).map(f => f.fee_code);
  const dup = feeCodes.find((c, i) => feeCodes.indexOf(c) !== i);
  if (dup) errs.push(`Duplicate fee code "${dup}" not allowed.`);

  // 2) slabs (only when tiered)
  if (body.commission_type === "tiered") {
    const slabs = [...(body.slabs || [])].sort((a, b) => a.min_price - b.min_price);
    if (!slabs.length) errs.push("Tiered commission requires at least one slab.");
    for (let i = 0; i < slabs.length; i++) {
      const s = slabs[i];
      if (s.max_price !== null && s.max_price <= s.min_price) {
        errs.push(`Slab ${i + 1}: max_price must be greater than min_price or null for open-ended.`);
      }
      if (i < slabs.length - 1) {
        const curMax = slabs[i].max_price ?? Number.POSITIVE_INFINITY;
        if (curMax > slabs[i + 1].min_price) {
          errs.push(`Slabs overlap between rows ${i + 1} and ${i + 2}.`);
          break;
        }
      }
    }
  }

  // 3) overlapping validity (same platform+category) - using storage instead of direct db for compatibility
  const from = dateOnly(body.effective_from);
  const to = body.effective_to ? dateOnly(body.effective_to) : null;

  // Use storage to get existing cards for the same (platform, category)
  const { storage } = await import("../../storage");
  const allCards = await storage.getRateCards();
  const existing = allCards.filter((rc: any) => 
    rc.platform === body.platform_id && rc.category === body.category_id
  );

  for (const rc of existing) {
    if (body.id && rc.id === body.id) continue; // skip self when updating

    const rcFrom = dateOnly(rc.effective_from as any);
    const rcTo = rc.effective_to ? dateOnly(rc.effective_to as any) : null;

    // Overlap rule for half-open/closed intervals [from, to]
    // They overlap if (A.from <= B.to || B.to==null) && (B.from <= A.to || A.to==null)
    const overlaps =
      (!to || rcFrom <= to) &&
      (!rcTo || from <= rcTo);

    if (overlaps) {
      errs.push(
        `Validity overlaps with an existing rate card (id=${rc.id}) for ${rc.platform}/${rc.category}.`
      );
      break;
    }
  }

  if (errs.length) {
    const e: any = new Error(errs.join(" "));
    e.statusCode = 400;
    throw e;
  }
}

const upload = multer(); // in-memory storage

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

// CSV upload route
router.post("/rate-cards/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const csvData = req.file.buffer.toString("utf-8");
    const records = parse(csvData, { 
      columns: true, 
      skip_empty_lines: true,
      trim: true 
    });

    const results = [];
    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < records.length; i++) {
      const row = records[i] as any;
      const rowNum = i + 2; // +2 because CSV has header and we start from 1

      try {
        // Parse JSON fields
        const slabs = row.slabs_json ? JSON.parse(row.slabs_json) : [];
        const fees = row.fees_json ? JSON.parse(row.fees_json) : [];

        // Build rate card payload
        const payload = {
          platform_id: row.platform_id,
          category_id: row.category_id,
          commission_type: row.commission_type,
          commission_percent: row.commission_percent ? parseFloat(row.commission_percent) : null,
          slabs,
          fees,
          gst_percent: row.gst_percent || "18",
          tcs_percent: row.tcs_percent || "1",
          settlement_basis: row.settlement_basis,
          t_plus_days: row.t_plus_days ? parseInt(row.t_plus_days) : null,
          weekly_weekday: row.weekly_weekday ? parseInt(row.weekly_weekday) : null,
          bi_weekly_weekday: row.bi_weekly_weekday ? parseInt(row.bi_weekly_weekday) : null,
          bi_weekly_which: row.bi_weekly_which || null,
          monthly_day: row.monthly_day || null,
          grace_days: row.grace_days ? parseInt(row.grace_days) : 0,
          effective_from: row.effective_from,
          effective_to: row.effective_to || null,
          global_min_price: row.global_min_price ? parseFloat(row.global_min_price) : null,
          global_max_price: row.global_max_price ? parseFloat(row.global_max_price) : null,
          notes: row.notes || null
        };

        // Validate the row using our existing validation
        await validateRateCard(db, payload);

        // Insert rate card
        const [rc] = await db.insert(rateCardsV2).values({
          ...payload
        }).returning({ id: rateCardsV2.id });

        // Insert slabs if any
        if (slabs.length > 0) {
          await db.insert(rateCardSlabs).values(
            slabs.map((s: any) => ({
              rate_card_id: rc.id,
              min_price: s.min_price,
              max_price: s.max_price,
              commission_percent: s.commission_percent,
            }))
          );
        }

        // Insert fees if any
        if (fees.length > 0) {
          await db.insert(rateCardFees).values(
            fees.map((f: any) => ({
              rate_card_id: rc.id,
              fee_code: f.fee_code,
              fee_type: f.fee_type,
              fee_value: f.fee_value,
            }))
          );
        }

        results.push({
          row: rowNum,
          status: "success",
          id: rc.id,
          platform: payload.platform_id,
          category: payload.category_id
        });
        successCount++;

      } catch (error: any) {
        results.push({
          row: rowNum,
          status: "error",
          error: error.message || "Unknown error",
          platform: row.platform_id,
          category: row.category_id
        });
        errorCount++;
      }
    }

    res.json({
      message: `Processed ${records.length} rows: ${successCount} successful, ${errorCount} failed`,
      summary: {
        total: records.length,
        successful: successCount,
        failed: errorCount
      },
      results
    });

  } catch (error: any) {
    console.error("CSV upload error:", error);
    res.status(500).json({ 
      message: "Failed to process CSV file",
      error: error.message 
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