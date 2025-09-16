import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertRateCardSchema, insertSettlementSchema, insertAlertSchema, rateCardsV2, rateCardSlabs, rateCardFees } from "@shared/schema";
import { db } from "./db";
import { validateRateCard } from "./src/routes/rateCards";
import { buildRateCardTemplateCsv } from "./src/routes/rateCardTemplate";
import { z } from "zod";
import { eq } from "drizzle-orm";
import multer from "multer";
import { parse } from "csv-parse/sync";
import * as XLSX from "xlsx";

export async function registerRoutes(app: Express): Promise<Server> {
  const upload = multer(); // in-memory storage for CSV uploads

  // CSV template download - MUST be before /:id route
  app.get("/api/rate-cards/template.csv", async (_req, res) => {
    const csv = buildRateCardTemplateCsv();
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=rate-card-template.csv");
    res.send(csv);
  });

  // CSV/XLSX upload (field name: file) — strict header & row validation
  app.post("/api/rate-cards/upload", upload.single("file"), async (req, res) => {
    try {
      if (!req.file?.buffer) {
        return res.status(400).json({ message: "No file uploaded. Use multipart/form-data with field 'file'." });
      }

      const REQUIRED_COLS = [
        "platform_id","category_id","commission_type",
        "slabs_json","fees_json",
        "settlement_basis","effective_from"
      ];
      const OPTIONAL_COLS = [
        "commission_percent",
        "gst_percent","tcs_percent",
        "t_plus_days","weekly_weekday","bi_weekly_weekday","bi_weekly_which","monthly_day","grace_days",
        "effective_to","global_min_price","global_max_price","notes"
      ];
      const ALL_COLS = new Set([...REQUIRED_COLS, ...OPTIONAL_COLS]);

      const FEE_CODES = new Set(["shipping","rto","packaging","fixed","collection","tech","storage"]);
      const SETTLEMENTS = new Set(["t_plus","weekly","bi_weekly","monthly"]);
      const BIW = new Set(["first","second"]);

      // ---- helpers
      const isYYYYMMDD = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(new Date(s).getTime());
      const numOrNull = (v: any) => (v === "" || v === null || v === undefined ? null : Number(v));
      const safeJSON = (label: string, raw: any, pushErr: (s: string) => void) => {
        if (!raw || String(raw).trim() === "") return [];
        try { const x = JSON.parse(raw); if (!Array.isArray(x)) pushErr(`${label} must be a JSON array`); return Array.isArray(x) ? x : []; }
        catch { pushErr(`${label} is not valid JSON`); return []; }
      };

      // ---- detect file type
      const name = req.file.originalname || "";
      const mime = req.file.mimetype || "";
      const isCSV = /\.csv$/i.test(name) || /text\/csv/i.test(mime);
      const isXLSX = /\.xlsx$/i.test(name) || /application\/vnd\.openxmlformats-officedocument\.spreadsheetml\.sheet/i.test(mime);

      // ---- parse into records + headerCols
      let records: any[] = [];
      let headerCols: string[] = [];

      if (isXLSX) {
        const wb = XLSX.read(req.file.buffer, { type: "buffer" });
        const firstSheetName = wb.SheetNames[0];
        if (!firstSheetName) return res.status(400).json({ message: "XLSX has no sheets." });
        const ws = wb.Sheets[firstSheetName];

        // Extract header row
        const headerRows = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, raw: false, defval: "" }) as any[];
        headerCols = (headerRows[0] || []).map((h: any) => String(h).trim());

        // Records (object mode keyed by headers)
        records = XLSX.utils.sheet_to_json(ws, { raw: false, defval: "" }) as any[];
      } else {
        // default to CSV
        const text = req.file.buffer.toString("utf-8");
        const firstLine = text.split(/\r?\n/).shift() || "";
        headerCols = firstLine.split(",").map((h) => h.trim());
        records = parse(text, { columns: true, skip_empty_lines: true, trim: true }) as any[];
      }

      // ---- header validation
      const missing = REQUIRED_COLS.filter((c) => !headerCols.includes(c));
      const unexpected = headerCols.filter((c) => c && !ALL_COLS.has(c));
      if (missing.length) {
        return res.status(400).json({ message: `File missing required columns: ${missing.join(", ")}` });
      }
      if (unexpected.length) {
        return res.status(400).json({ message: `File has unexpected columns: ${unexpected.join(", ")}. Allowed: ${Array.from(ALL_COLS).join(", ")}` });
      }

      const results: Array<{ row: number; status: "ok" | "error"; id?: string; error?: string }> = [];

      for (let i = 0; i < records.length; i++) {
        const r = records[i];
        const rowErrors: string[] = [];
        const rowN = i + 1;

        // normalize: some XLSX rows may carry undefined -> treat as ""
        const get = (k: string) => (r[k] === undefined ? "" : String(r[k]).trim());

        const platform_id = get("platform_id");
        const category_id = get("category_id");
        const commission_type = get("commission_type");
        const settlement_basis = get("settlement_basis");
        const effective_from = get("effective_from");
        const effective_to_g = get("effective_to");

        // presence & enums
        if (!platform_id) rowErrors.push("platform_id is required");
        if (!category_id) rowErrors.push("category_id is required");
        if (!commission_type) rowErrors.push("commission_type is required");
        if (commission_type && !["flat","tiered"].includes(commission_type)) rowErrors.push("commission_type must be 'flat' or 'tiered'");
        if (!settlement_basis) rowErrors.push("settlement_basis is required");
        if (settlement_basis && !SETTLEMENTS.has(settlement_basis)) rowErrors.push("settlement_basis must be one of t_plus|weekly|bi_weekly|monthly");
        if (!effective_from) rowErrors.push("effective_from is required");
        if (effective_from && !isYYYYMMDD(effective_from)) rowErrors.push("effective_from must be YYYY-MM-DD");
        if (effective_to_g && !isYYYYMMDD(effective_to_g)) rowErrors.push("effective_to must be YYYY-MM-DD");

        // numbers & optionals
        const commission_percent_raw = get("commission_percent");
        const gst_percent = numOrNull(get("gst_percent")) ?? 18;
        const tcs_percent = numOrNull(get("tcs_percent")) ?? 1;

        const commission_percent =
          commission_type === "flat"
            ? (commission_percent_raw === "" ? NaN : Number(commission_percent_raw))
            : null;

        if (commission_type === "flat") {
          if (commission_percent === null || isNaN(commission_percent)) rowErrors.push("commission_percent is required for flat commission_type");
          else if (commission_percent < 0 || commission_percent > 100) rowErrors.push("commission_percent must be between 0 and 100");
        }

        const t_plus_days = numOrNull(get("t_plus_days"));
        const weekly_weekday = numOrNull(get("weekly_weekday"));
        const bi_weekly_weekday = numOrNull(get("bi_weekly_weekday"));
        const bi_weekly_which = get("bi_weekly_which") || null;
        const monthly_day = get("monthly_day") || null;
        const grace_days = numOrNull(get("grace_days")) ?? 0;
        const global_min_price = numOrNull(get("global_min_price"));
        const global_max_price = numOrNull(get("global_max_price"));
        const notes = get("notes") || "";

        // settlement-specific checks
        if (settlement_basis === "t_plus" && !t_plus_days) rowErrors.push("t_plus_days required when settlement_basis=t_plus");
        if (settlement_basis === "weekly" && !weekly_weekday) rowErrors.push("weekly_weekday required when settlement_basis=weekly");
        if (settlement_basis === "bi_weekly") {
          if (!bi_weekly_weekday) rowErrors.push("bi_weekly_weekday required when settlement_basis=bi_weekly");
          if (!bi_weekly_which) rowErrors.push("bi_weekly_which required when settlement_basis=bi_weekly");
          if (bi_weekly_which && !BIW.has(String(bi_weekly_which))) rowErrors.push("bi_weekly_which must be 'first' or 'second'");
        }
        if (settlement_basis === "monthly" && !monthly_day) rowErrors.push("monthly_day required when settlement_basis=monthly");

        // JSON blobs
        const slabs_raw = get("slabs_json");
        const fees_raw = get("fees_json");

        const slabs = safeJSON("slabs_json", slabs_raw, (m) => rowErrors.push(m));
        const fees = safeJSON("fees_json", fees_raw, (m) => rowErrors.push(m));

        // tiered needs slabs
        if (commission_type === "tiered" && (!Array.isArray(slabs) || slabs.length === 0)) {
          rowErrors.push("slabs_json must be a non-empty array when commission_type=tiered");
        }

        // quick schema checks
        if (Array.isArray(slabs)) {
          slabs.forEach((s: any, idx: number) => {
            if (typeof s.min_price !== "number") rowErrors.push(`slabs_json[${idx}].min_price must be number`);
            if (s.max_price !== null && typeof s.max_price !== "number") rowErrors.push(`slabs_json[${idx}].max_price must be number or null`);
            if (typeof s.commission_percent !== "number") rowErrors.push(`slabs_json[${idx}].commission_percent must be number`);
          });
        }
        if (Array.isArray(fees)) {
          fees.forEach((f: any, idx: number) => {
            if (!FEE_CODES.has(String(f.fee_code))) rowErrors.push(`fees_json[${idx}].fee_code invalid; allowed: ${Array.from(FEE_CODES).join("|")}`);
            if (!["percent","amount"].includes(String(f.fee_type))) rowErrors.push(`fees_json[${idx}].fee_type must be 'percent' or 'amount'`);
            if (typeof f.fee_value !== "number" || f.fee_value < 0) rowErrors.push(`fees_json[${idx}].fee_value must be a non-negative number`);
          });
        }

        if (rowErrors.length) {
          results.push({ row: rowN, status: "error", error: rowErrors.join("; ") });
          continue;
        }

        // Build payload for legacy storage compatibility
        const legacyPayload = {
          platform: platform_id,
          category: category_id,
          commission_rate: commission_percent || 0,
          shipping_fee: null,
          gst_rate: gst_percent,
          rto_fee: null,
          packaging_fee: null,
          fixed_fee: null,
          min_price: global_min_price || 0,
          max_price: global_max_price,
          effective_from: effective_from,
          effective_to: effective_to_g || null,
          promo_discount_fee: null,
          territory_fee: null,
          notes: notes
        };

        try {
          const id = await storage.createRateCard(legacyPayload);
          results.push({ row: rowN, status: "ok", id: typeof id === 'object' ? id.id : id });
        } catch (err: any) {
          results.push({ row: rowN, status: "error", error: err?.message || "Validation/Insert failed" });
        }
      }

      res.json({ total: records.length, results });
    } catch (e: any) {
      console.error(e);
      res.status(500).json({ message: e.message || "Failed to process upload" });
    }
  });

  // Rate Cards API with enhanced metrics
  app.get("/api/rate-cards", async (req, res) => {
    try {
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
          platform_name: PLATFORM_LABELS[c.platform_id] || c.platform_id,
          category_name: CATEGORY_LABELS[c.category_id] || c.category_id,
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
    } catch (error) {
      console.error("Error fetching rate cards:", error);
      res.status(500).json({ error: "Failed to fetch rate cards" });
    }
  });

  app.get("/api/rate-cards/:id", async (req, res) => {
    try {
      const { id } = req.params;
      console.log(`Rate card by ID route hit with id: ${id}`);
      const rateCard = await storage.getRateCard(id);
      
      if (!rateCard) {
        res.status(404).json({ error: "Rate card not found" });
        return;
      }
      
      res.json(rateCard);
    } catch (error) {
      console.error("Error fetching rate card:", error);
      res.status(500).json({ error: "Failed to fetch rate card" });
    }
  });

  app.post("/api/rate-cards", async (req, res) => {
    try {
      const validatedData = insertRateCardSchema.parse(req.body);
      const rateCard = await storage.createRateCard(validatedData);
      res.json(rateCard);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Invalid data", details: error.errors });
      } else {
        console.error("Error creating rate card:", error);
        res.status(500).json({ error: "Failed to create rate card" });
      }
    }
  });

  app.put("/api/rate-cards", async (req, res) => {
    try {
      const id = req.body.id;
      const validatedData = insertRateCardSchema.partial().parse(req.body);
      const rateCard = await storage.updateRateCard(id, validatedData);
      
      if (!rateCard) {
        res.status(404).json({ error: "Rate card not found" });
        return;
      }
      
      res.json(rateCard);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Invalid data", details: error.errors });
      } else {
        console.error("Error updating rate card:", error);
        res.status(500).json({ error: "Failed to update rate card" });
      }
    }
  });

  app.delete("/api/rate-cards/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const success = await storage.deleteRateCard(id);
      
      if (!success) {
        res.status(404).json({ error: "Rate card not found" });
        return;
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting rate card:", error);
      res.status(500).json({ error: "Failed to delete rate card" });
    }
  });

  app.post("/api/rate-cards/upload", async (req, res) => {
    try {
      const { rows } = req.body;
      
      if (!rows || !Array.isArray(rows) || rows.length === 0) {
        res.status(400).json({ error: "Invalid or empty CSV data" });
        return;
      }

      const createdRateCards = await storage.saveRateCards(rows);
      res.json({ 
        message: `Successfully uploaded ${createdRateCards.length} rate cards.`,
        count: createdRateCards.length,
        rateCards: createdRateCards
      });
    } catch (error) {
      console.error("Error uploading rate cards:", error);
      res.status(500).json({ 
        message: "Upload failed.", 
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Settlements API
  app.get("/api/settlements", async (req, res) => {
    try {
      const { marketplace } = req.query;
      const settlements = await storage.getSettlements(marketplace as string);
      res.json(settlements);
    } catch (error) {
      console.error("Error fetching settlements:", error);
      res.status(500).json({ error: "Failed to fetch settlements" });
    }
  });

  app.post("/api/settlements", async (req, res) => {
    try {
      // Handle bulk settlement upload
      if (req.body.settlements && Array.isArray(req.body.settlements)) {
        const settlements = req.body.settlements.map((settlement: any) => ({
          expected_amount: Number(settlement.predicted_settlement_amount || settlement.expected_amount || 0),
          paid_amount: Number(settlement.actual_settlement_amount || settlement.paid_amount || 0),
          fee_breakdown: settlement.fee_breakdown || null,
          reco_status: settlement.variance_percentage && Math.abs(settlement.variance_percentage) <= 5 ? 'matched' : 'unmatched',
          delta: Number(settlement.variance || 0)
        }));

        const createdSettlements = await storage.createMultipleSettlements(settlements);
        res.status(201).json({ 
          message: `Successfully created ${createdSettlements.length} settlements`,
          settlements: createdSettlements 
        });
        return;
      }

      // Handle single settlement creation
      const validatedData = insertSettlementSchema.parse(req.body);
      const settlement = await storage.createSettlement(validatedData);
      res.json(settlement);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Invalid data", details: error.errors });
      } else {
        console.error("Error creating settlement:", error);
        res.status(500).json({ error: "Failed to create settlement" });
      }
    }
  });

  // Settlement CSV Upload API
  app.post("/api/settlements/upload", async (req, res) => {
    try {
      const { rows, marketplace } = req.body;
      
      if (!Array.isArray(rows) || rows.length === 0) {
        res.status(400).json({ error: "Invalid or empty CSV data" });
        return;
      }

      const validRows = [];
      const errorRows = [];
      
      for (const row of rows) {
        try {
          const {
            order_id, utr_number, payout_date, actual_settlement_amount,
            commission, shipping_fee, rto_fee, packaging_fee,
            fixed_fee, gst, order_status
          } = row;

          // Validate required fields
          if (!order_id || !actual_settlement_amount || isNaN(Number(actual_settlement_amount))) {
            errorRows.push({ row, error: "Missing required fields: order_id or actual_settlement_amount" });
            continue;
          }

          // Auto-fill today's date if missing
          const settlementDate = payout_date || new Date().toISOString().split('T')[0];

          validRows.push({
            order_id,
            utr_number: utr_number || null,
            payout_date: settlementDate,
            actual_settlement_amount: Number(actual_settlement_amount),
            commission: Number(commission || 0),
            shipping_fee: Number(shipping_fee || 0),
            rto_fee: Number(rto_fee || 0),
            packaging_fee: Number(packaging_fee || 0),
            fixed_fee: Number(fixed_fee || 0),
            gst: Number(gst || 0),
            order_status: order_status || 'Delivered',
            marketplace: marketplace || 'Unknown', // Add marketplace field
            // Also set the original API fields for compatibility
            expected_amount: Number(actual_settlement_amount),
            paid_amount: Number(actual_settlement_amount),
            reco_status: 'matched'
          });
        } catch (error) {
          errorRows.push({ row, error: error instanceof Error ? error.message : "Invalid row data" });
        }
      }

      if (validRows.length === 0) {
        res.status(400).json({ 
          error: "No valid rows to process",
          errorRows: errorRows.slice(0, 10) // Limit error rows in response
        });
        return;
      }

      const createdSettlements = await storage.createMultipleSettlements(validRows);
      
      res.status(201).json({
        success: true,
        message: `Successfully uploaded ${createdSettlements.length} settlements`,
        processed: validRows.length,
        errors: errorRows.length,
        errorRows: errorRows.slice(0, 10) // Limit error rows in response
      });
      
    } catch (error) {
      console.error("Settlement upload error:", error);
      res.status(500).json({ 
        error: "Upload failed", 
        message: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Alerts API
  app.get("/api/alerts", async (req, res) => {
    try {
      const alerts = await storage.getAlerts();
      res.json(alerts);
    } catch (error) {
      console.error("Error fetching alerts:", error);
      res.status(500).json({ error: "Failed to fetch alerts" });
    }
  });

  app.post("/api/alerts", async (req, res) => {
    try {
      const validatedData = insertAlertSchema.parse(req.body);
      const alert = await storage.createAlert(validatedData);
      res.json(alert);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Invalid data", details: error.errors });
      } else {
        console.error("Error creating alert:", error);
        res.status(500).json({ error: "Failed to create alert" });
      }
    }
  });

  // Predict Reconciliation API (port from Supabase Edge Function)
  app.post("/api/predict-reco", async (req, res) => {
    try {
      const { mrp, order_id, marketplace, category, date, actual_settlement_amount } = req.body;

      // Validate input
      if (!mrp || !order_id || !marketplace || !category || !date || actual_settlement_amount === undefined) {
        res.status(400).json({ 
          error: "Missing required fields: mrp, order_id, marketplace, category, date, actual_settlement_amount" 
        });
        return;
      }

      if (mrp <= 0 || actual_settlement_amount < 0) {
        res.status(400).json({ 
          error: "MRP must be positive and actual settlement amount must be non-negative" 
        });
        return;
      }

      // Get rate cards
      const rateCards = await storage.getRateCards();
      
      // Find matching rate card
      const rateCard = rateCards.find(card => {
        const isMarketplaceMatch = card.platform.toLowerCase() === marketplace.toLowerCase();
        const isCategoryMatch = card.category.toLowerCase() === category.toLowerCase();
        
        // Check date range
        const inputDate = new Date(date);
        const effectiveFrom = card.effective_from ? new Date(card.effective_from) : new Date("2024-01-01");
        const effectiveTo = card.effective_to ? new Date(card.effective_to) : new Date("2024-12-31");
        
        const isDateInRange = inputDate >= effectiveFrom && inputDate <= effectiveTo;
        const isPriceInRange = (!card.min_price || mrp >= card.min_price) && 
                              (!card.max_price || mrp <= card.max_price);
        
        return isMarketplaceMatch && isCategoryMatch && isDateInRange && isPriceInRange;
      });

      // Calculate expected payout
      let expected_payout = mrp;
      let breakdown = {
        commission: 0,
        shipping_fee: 0,
        gst: 0,
        rto_fee: 0,
        packaging_fee: 0,
        fixed_fee: 0,
        total_deductions: 0
      };

      if (rateCard) {
        const commission = (rateCard.commission_rate || 0) / 100 * mrp;
        const shipping_fee = rateCard.shipping_fee || 0;
        const rto_fee = rateCard.rto_fee || 0;
        const packaging_fee = rateCard.packaging_fee || 0;
        const fixed_fee = rateCard.fixed_fee || 0;
        
        const totalFeesBeforeGST = commission + shipping_fee + rto_fee + packaging_fee + fixed_fee;
        const gst = (totalFeesBeforeGST * (rateCard.gst_rate || 0)) / 100;
        const total_deductions = totalFeesBeforeGST + gst;
        
        expected_payout = mrp - total_deductions;
        
        breakdown = {
          commission: Math.round(commission * 100) / 100,
          shipping_fee,
          gst: Math.round(gst * 100) / 100,
          rto_fee,
          packaging_fee,
          fixed_fee,
          total_deductions: Math.round(total_deductions * 100) / 100
        };
      }

      // Calculate delta and mismatch flag
      const delta = expected_payout - actual_settlement_amount;
      const mismatch_flag = Math.abs(delta) > 10; // ₹10 threshold

      // Store result in settlements
      await storage.createSettlement({
        expected_amount: expected_payout,
        paid_amount: actual_settlement_amount,
        fee_breakdown: breakdown,
        reco_status: mismatch_flag ? "mismatch" : "matched",
        delta: delta
      });

      const result = {
        order_id,
        marketplace,
        category,
        mrp,
        actual_settlement_amount,
        expected_payout: Math.round(expected_payout * 100) / 100,
        delta: Math.round(delta * 100) / 100,
        mismatch_flag,
        calculation_breakdown: breakdown,
        rate_card_found: rateCard !== null,
        rate_card_id: rateCard?.id
      };

      res.json(result);
    } catch (error) {
      console.error("Error in predict_reco:", error);
      res.status(500).json({ 
        error: "Internal server error", 
        details: error instanceof Error ? error.message : "Unknown error" 
      });
    }
  });

  // Orders API routes
  app.get("/api/orders", async (req, res) => {
    try {
      const marketplace = req.query.marketplace as string;
      const orders = await storage.getOrders(marketplace);
      res.json(orders);
    } catch (error) {
      console.error("Error fetching orders:", error);
      res.status(500).json({ error: "Failed to fetch orders" });
    }
  });

  app.post("/api/orders/upload", async (req, res) => {
    try {
      const { orders: orderData, marketplace } = req.body;

      if (!Array.isArray(orderData) || orderData.length === 0) {
        return res.status(400).json({ error: "Invalid order data provided" });
      }

      // Transform orders to include marketplace
      const transformedOrders = orderData.map(order => ({
        ...order,
        marketplace: marketplace || order.marketplace || 'Unknown'
      }));

      const createdOrders = await storage.createMultipleOrders(transformedOrders);

      res.json({
        success: true,
        message: `Successfully uploaded ${createdOrders.length} orders`,
        processed: createdOrders.length,
        orders: createdOrders
      });
    } catch (error) {
      console.error("Error uploading orders:", error);
      res.status(500).json({ error: "Failed to upload orders" });
    }
  });

  // Returns API routes
  app.get("/api/returns", async (req, res) => {
    try {
      const marketplace = req.query.marketplace as string;
      const returns = await storage.getReturns(marketplace);
      res.json(returns);
    } catch (error) {
      console.error("Error fetching returns:", error);
      res.status(500).json({ error: "Failed to fetch returns" });
    }
  });

  app.post("/api/returns/upload", async (req, res) => {
    try {
      const { returns: returnData, marketplace } = req.body;

      if (!Array.isArray(returnData) || returnData.length === 0) {
        return res.status(400).json({ error: "Invalid return data provided" });
      }

      // Transform returns to include marketplace
      const transformedReturns = returnData.map(returnItem => ({
        ...returnItem,
        marketplace: marketplace || returnItem.marketplace || 'Unknown'
      }));

      const createdReturns = await storage.createMultipleReturns(transformedReturns);

      res.json({
        success: true,
        message: `Successfully uploaded ${createdReturns.length} returns`,
        processed: createdReturns.length,
        returns: createdReturns
      });
    } catch (error) {
      console.error("Error uploading returns:", error);
      res.status(500).json({ error: "Failed to upload returns" });
    }
  });

  // Returns Reconciliation API
  app.get("/api/returns/reconcile", async (req, res) => {
    try {
      const { reconcileReturns } = await import('./returnsReconciliation');
      const results = await reconcileReturns();
      res.json(results);
    } catch (error) {
      console.error("Error reconciling returns:", error);
      res.status(500).json({ error: "Failed to reconcile returns" });
    }
  });

  // Myntra Integration Routes
  app.get("/api/integrations/myntra/connect", async (req, res) => {
    try {
      // TODO: Replace with actual user logic from session/auth
      const userId = req.query.userId as string || 'default-user';
      
      const { myntraAuthService } = await import('./integrations/myntra/auth');
      const authUrl = myntraAuthService.generateAuthUrl(userId);
      
      res.redirect(authUrl);
    } catch (error) {
      console.error('Myntra connect error:', error);
      res.status(500).json({ error: 'Failed to initiate Myntra connection' });
    }
  });

  app.get("/api/integrations/myntra/callback", async (req, res) => {
    try {
      const { myntraAuthService } = await import('./integrations/myntra/auth');
      await myntraAuthService.handleCallback(req, res);
    } catch (error) {
      console.error('Myntra callback error:', error);
      res.redirect('/integrations?connected=myntra&status=error&message=Callback%20failed');
    }
  });

  app.get("/api/integrations/myntra/status", async (req, res) => {
    try {
      // TODO: Replace with actual user logic from session/auth
      const userId = req.query.userId as string || 'default-user';
      
      const { myntraAuthService } = await import('./integrations/myntra/auth');
      const isConnected = await myntraAuthService.isConnected(userId);
      
      res.json({ 
        connected: isConnected,
        marketplace: 'myntra',
        userId: userId
      });
    } catch (error) {
      console.error('Myntra status error:', error);
      res.status(500).json({ error: 'Failed to check Myntra status' });
    }
  });

  app.post("/api/integrations/myntra/disconnect", async (req, res) => {
    try {
      // TODO: Replace with actual user logic from session/auth
      const userId = req.body.userId || req.query.userId as string || 'default-user';
      
      const { myntraAuthService } = await import('./integrations/myntra/auth');
      await myntraAuthService.disconnect(userId);
      
      res.json({ success: true, message: 'Myntra integration disconnected' });
    } catch (error) {
      console.error('Myntra disconnect error:', error);
      res.status(500).json({ error: 'Failed to disconnect Myntra integration' });
    }
  });

  app.post("/api/integrations/myntra/sync", async (req, res) => {
    try {
      // TODO: Replace with actual user logic from session/auth
      const userId = req.body.userId || req.query.userId as string || 'default-user';
      
      const { myntraApiService } = await import('./integrations/myntra/api');
      const result = await myntraApiService.syncSettlements(userId);
      
      res.json({
        success: true,
        message: `Synced ${result.synced} settlements from Myntra`,
        synced: result.synced,
        errors: result.errors
      });
    } catch (error) {
      console.error('Myntra sync error:', error);
      res.status(500).json({ error: 'Failed to sync Myntra data' });
    }
  });

  // Import and use modular rate cards routes
  const rateCardsRouter = (await import("./src/routes/rateCards")).default;
  app.use("/api", rateCardsRouter);

  // Import and use notifications routes
  const notificationsRouter = (await import("./src/routes/notifications")).default;
  app.use("/api", notificationsRouter);

  // Rate Cards V2 API (Advanced rate card management)
  app.post("/api/rate-cards-v2", async (req, res) => {
    try {
      const body = req.body;
      
      const { db } = await import("./storage");
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
      console.error("Error creating rate card v2:", e);
      res.status(500).json({ message: e.message || "Failed to create rate card" });
    }
  });

  app.put("/api/rate-cards-v2", async (req, res) => {
    try {
      const body = req.body;
      const id = body.id;
      if (!id) return res.status(400).json({ message: "id required" });
      
      const { db } = await import("./storage");

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
        updated_at: new Date(),
      }).where(eq(rateCardsV2.id, id));

      await db.delete(rateCardSlabs).where(eq(rateCardSlabs.rate_card_id, id));
      await db.delete(rateCardFees).where(eq(rateCardFees.rate_card_id, id));

      if (body.slabs?.length) {
        await db.insert(rateCardSlabs).values(
          body.slabs.map((s: any) => ({
            rate_card_id: id,
            min_price: s.min_price.toString(),
            max_price: s.max_price ? s.max_price.toString() : null,
            commission_percent: s.commission_percent.toString(),
          }))
        );
      }
      
      if (body.fees?.length) {
        await db.insert(rateCardFees).values(
          body.fees.map((f: any) => ({
            rate_card_id: id,
            fee_code: f.fee_code,
            fee_type: f.fee_type,
            fee_value: f.fee_value.toString(),
          }))
        );
      }
      
      res.json({ id });
    } catch (e: any) {
      console.error("Error updating rate card v2:", e);
      res.status(500).json({ message: e.message || "Failed to update rate card" });
    }
  });

  app.get("/api/rate-cards-v2", async (req, res) => {
    try {
      const { db } = await import("./storage");
      const cards = await db.select().from(rateCardsV2);
      res.json(cards);
    } catch (e: any) {
      console.error("Error fetching rate cards v2:", e);
      res.status(500).json({ message: e.message || "Failed to fetch rate cards" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
