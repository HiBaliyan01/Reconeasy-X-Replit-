import { pgTable, text, serial, integer, boolean, uuid, doublePrecision, date, timestamp, jsonb, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const rateCards = pgTable("rate_cards", {
  id: uuid("id").primaryKey().defaultRandom(),
  platform: text("platform").notNull(),
  category: text("category").notNull(),
  commission_rate: doublePrecision("commission_rate"),
  shipping_fee: doublePrecision("shipping_fee"),
  gst_rate: doublePrecision("gst_rate"),
  rto_fee: doublePrecision("rto_fee"),
  packaging_fee: doublePrecision("packaging_fee"),
  fixed_fee: doublePrecision("fixed_fee"),
  min_price: doublePrecision("min_price"),
  max_price: doublePrecision("max_price"),
  effective_from: date("effective_from"),
  effective_to: date("effective_to"),
  promo_discount_fee: doublePrecision("promo_discount_fee"),
  territory_fee: doublePrecision("territory_fee"),
  notes: text("notes"),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// New Rate Card V2 tables for advanced rate card management
export const rateCardsV2 = pgTable("rate_cards_v2", {
  id: uuid("id").defaultRandom().primaryKey(),
  platform_id: text("platform_id").notNull(),
  category_id: text("category_id").notNull(),
  commission_type: text("commission_type").notNull(), // 'flat' | 'tiered'
  commission_percent: numeric("commission_percent"),
  archived: boolean("archived").notNull().default(false),

  gst_percent: numeric("gst_percent").notNull().default("18"),
  tcs_percent: numeric("tcs_percent").notNull().default("1"),

  settlement_basis: text("settlement_basis").notNull(), // 't_plus'|'weekly'|'bi_weekly'|'monthly'
  t_plus_days: integer("t_plus_days"),
  weekly_weekday: integer("weekly_weekday"),
  bi_weekly_weekday: integer("bi_weekly_weekday"),
  bi_weekly_which: text("bi_weekly_which"),
  monthly_day: text("monthly_day"),
  grace_days: integer("grace_days").notNull().default(0),

  effective_from: date("effective_from").notNull(),
  effective_to: date("effective_to"),

  global_min_price: numeric("global_min_price"),
  global_max_price: numeric("global_max_price"),

  notes: text("notes"),

  created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const rateCardSlabs = pgTable("rate_card_slabs", {
  id: uuid("id").defaultRandom().primaryKey(),
  rate_card_id: uuid("rate_card_id").notNull().references(() => rateCardsV2.id, { onDelete: "cascade" }),
  min_price: numeric("min_price").notNull().default("0"),
  max_price: numeric("max_price"),
  commission_percent: numeric("commission_percent").notNull(),
});

export const rateCardFees = pgTable("rate_card_fees", {
  id: uuid("id").defaultRandom().primaryKey(),
  rate_card_id: uuid("rate_card_id").notNull().references(() => rateCardsV2.id, { onDelete: "cascade" }),
  fee_code: text("fee_code").notNull(), // shipping|rto|packaging|fixed|collection|tech|storage
  fee_type: text("fee_type").notNull(), // percent|amount
  fee_value: numeric("fee_value").notNull(),
});

export const settlements = pgTable("settlements", {
  id: uuid("id").primaryKey().defaultRandom(),
  // Original fields for API compatibility
  expected_amount: doublePrecision("expected_amount"),
  paid_amount: doublePrecision("paid_amount"),
  fee_breakdown: jsonb("fee_breakdown"),
  reco_status: text("reco_status"),
  delta: doublePrecision("delta"),
  
  // New CSV upload fields
  order_id: text("order_id"),
  utr_number: text("utr_number"),
  payout_date: date("payout_date"),
  actual_settlement_amount: doublePrecision("actual_settlement_amount"),
  commission: doublePrecision("commission"),
  shipping_fee: doublePrecision("shipping_fee"),
  rto_fee: doublePrecision("rto_fee"),
  packaging_fee: doublePrecision("packaging_fee"),
  fixed_fee: doublePrecision("fixed_fee"),
  gst: doublePrecision("gst"),
  order_status: text("order_status"),
  marketplace: text("marketplace"),
  
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const alerts = pgTable("alerts", {
  id: uuid("id").primaryKey().defaultRandom(),
  type: text("type").notNull(),
  message: text("message").notNull(),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const orders = pgTable("orders", {
  id: uuid("id").defaultRandom().primaryKey(),
  brandId: text("brand_id").notNull(),
  orderId: text("order_id").notNull(),
  sku: text("sku").notNull(),
  quantity: integer("quantity").notNull(),
  sellingPrice: doublePrecision("selling_price"),
  dispatchDate: date("dispatch_date"),
  orderStatus: text("order_status"),
  marketplace: text("marketplace"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const returns = pgTable("returns", {
  id: uuid("id").defaultRandom().primaryKey(),
  marketplace: text("marketplace").notNull(),
  orderId: text("order_id").notNull(),
  returnId: text("return_id").notNull(),
  sku: text("sku").notNull(),
  qtyReturned: integer("qty_returned").notNull(),
  returnType: text("return_type"),
  returnReasonCode: text("return_reason_code"),
  returnReasonDesc: text("return_reason_desc"),
  returnDate: date("return_date"),
  refundAmount: doublePrecision("refund_amount"),
  returnStatus: text("return_status"),
  receivedDateWh: date("received_date_wh"),
  qcResult: text("qc_result"),
  disposition: text("disposition"),
  commissionReversal: doublePrecision("commission_reversal"),
  logisticsReversal: doublePrecision("logistics_reversal"),
  otherFeeReversal: doublePrecision("other_fee_reversal"),
  settlementRefId: text("settlement_ref_id"),
  utrNumber: text("utr_number"),
  refundMode: text("refund_mode"),
  pickupDate: date("pickup_date"),
  pickupPartner: text("pickup_partner"),
  customerPin: text("customer_pin"),
  warehouseCode: text("warehouse_code"),
  brandSku: text("brand_sku"),
  asinStyleCode: text("asin_style_code"),
  evidenceUrl: text("evidence_url"),
  claimDeadline: date("claim_deadline"),
  claimStatus: text("claim_status"),
  claimAmountRequested: doublePrecision("claim_amount_requested"),
  claimAmountApproved: doublePrecision("claim_amount_approved"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Insert schemas
export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const insertRateCardSchema = createInsertSchema(rateCards).omit({
  id: true,
  created_at: true,
});

export const insertSettlementSchema = createInsertSchema(settlements).omit({
  id: true,
  created_at: true,
});

export const insertAlertSchema = createInsertSchema(alerts).omit({
  id: true,
  created_at: true,
});

export const insertOrderSchema = createInsertSchema(orders).omit({
  id: true,
  createdAt: true,
});

export const insertReturnSchema = createInsertSchema(returns).omit({
  id: true,
  createdAt: true,
});

// Select schemas
export const selectRateCardSchema = createSelectSchema(rateCards);
export const selectSettlementSchema = createSelectSchema(settlements);
export const selectAlertSchema = createSelectSchema(alerts);
export const selectOrderSchema = createSelectSchema(orders);
export const selectReturnSchema = createSelectSchema(returns);

// Types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertRateCard = z.infer<typeof insertRateCardSchema>;
export type RateCard = typeof rateCards.$inferSelect;

export type InsertSettlement = z.infer<typeof insertSettlementSchema>;
export type Settlement = typeof settlements.$inferSelect;

export type InsertAlert = z.infer<typeof insertAlertSchema>;
export type Alert = typeof alerts.$inferSelect;

export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type Order = typeof orders.$inferSelect;

export type InsertReturn = z.infer<typeof insertReturnSchema>;
export type Return = typeof returns.$inferSelect;
