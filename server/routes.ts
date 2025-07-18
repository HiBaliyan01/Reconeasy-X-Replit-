import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertRateCardSchema, insertSettlementSchema, insertAlertSchema } from "@shared/schema";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
  // Rate Cards API
  app.get("/api/rate-cards", async (req, res) => {
    try {
      const rateCards = await storage.getRateCards();
      res.json(rateCards);
    } catch (error) {
      console.error("Error fetching rate cards:", error);
      res.status(500).json({ error: "Failed to fetch rate cards" });
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

  app.put("/api/rate-cards/:id", async (req, res) => {
    try {
      const { id } = req.params;
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
      const settlements = await storage.getSettlements();
      res.json(settlements);
    } catch (error) {
      console.error("Error fetching settlements:", error);
      res.status(500).json({ error: "Failed to fetch settlements" });
    }
  });

  app.post("/api/settlements", async (req, res) => {
    try {
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

  const httpServer = createServer(app);
  return httpServer;
}
