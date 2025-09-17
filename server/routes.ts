import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertSettlementSchema, insertAlertSchema, rateCardsV2, rateCardSlabs, rateCardFees } from "@shared/schema";
import { db } from "./db";
import { z } from "zod";
import { eq } from "drizzle-orm";

export async function registerRoutes(app: Express): Promise<Server> {
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
