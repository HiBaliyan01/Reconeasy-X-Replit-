// server/src/routes/rateCards.ts
import { Router } from "express";
import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { rate_cards, rate_card_fees, rate_card_slabs } from "../db/schema";
import { eq } from "drizzle-orm";

const router = Router();

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql);

router.post("/rate-cards", async (req, res) => {
  try {
    const body = req.body;
    const [rc] = await db.insert(rate_cards).values({
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
    }).returning({ id: rate_cards.id });

    if (body.slabs?.length) {
      await db.insert(rate_card_slabs).values(
        body.slabs.map((s: any) => ({
          rate_card_id: rc.id, min_price: s.min_price, max_price: s.max_price, commission_percent: s.commission_percent,
        }))
      );
    }
    if (body.fees?.length) {
      await db.insert(rate_card_fees).values(
        body.fees.map((f: any) => ({
          rate_card_id: rc.id, fee_code: f.fee_code, fee_type: f.fee_type, fee_value: f.fee_value,
        }))
      );
    }
    res.status(201).json({ id: rc.id });
  } catch (e:any) {
    console.error(e);
    res.status(500).json({ message: e.message || "Failed to create rate card" });
  }
});

router.put("/rate-cards", async (req, res) => {
  try {
    const body = req.body;
    const id = body.id;
    if (!id) return res.status(400).json({ message: "id required" });

    await db.update(rate_cards).set({
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
      updated_at: new Date(),
    }).where(eq(rate_cards.id, id));

    await db.delete(rate_card_slabs).where(eq(rate_card_slabs.rate_card_id, id));
    await db.delete(rate_card_fees).where(eq(rate_card_fees.rate_card_id, id));

    if (body.slabs?.length) {
      await db.insert(rate_card_slabs).values(
        body.slabs.map((s: any) => ({
          rate_card_id: id, min_price: s.min_price, max_price: s.max_price, commission_percent: s.commission_percent,
        }))
      );
    }
    if (body.fees?.length) {
      await db.insert(rate_card_fees).values(
        body.fees.map((f: any) => ({
          rate_card_id: id, fee_code: f.fee_code, fee_type: f.fee_type, fee_value: f.fee_value,
        }))
      );
    }
    res.json({ id });
  } catch (e:any) {
    console.error(e);
    res.status(500).json({ message: e.message || "Failed to update rate card" });
  }
});

export default router;
