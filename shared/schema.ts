import { pgTable, text, serial, integer, boolean, uuid, doublePrecision, date, timestamp, jsonb, numeric, index, unique, foreignKey } from "drizzle-orm/pg-core";
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

export const rateCardTemplates = pgTable("rate_card_templates", {
  id: uuid("id").defaultRandom().primaryKey(),
  templateType: text("template_type").notNull(),
  version: text("version").notNull(),
  headersJson: jsonb("headers_json").notNull(),
  sampleDataUrl: text("sample_data_url"),
  description: text("description"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  createdBy: text("created_by"),
  headerRowIndex: integer("header_row_index"),
  dataStartIndex: integer("data_start_index"),
});

export const rateCardData = pgTable("rate_card_data", {
  id: uuid("id").defaultRandom().primaryKey(),
  rateCardTemplateType: text("rate_card_template_type").notNull(),
  rateCardVersion: text("rate_card_version").notNull(),
  uploadedBy: text("uploaded_by"),
  uploadedAt: timestamp("uploaded_at", { withTimezone: true }).defaultNow(),
  fileName: text("file_name"),
  data: jsonb("data"),
  validationStatus: text("validation_status"),
  issues: jsonb("issues"),
  status: text("status"),
  recordCount: integer("record_count"),
});

// New Rate Card V2 tables for advanced rate card management
export const rateCardsV2 = pgTable("rate_cards_v2", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenant_id: text("tenant_id").notNull(),
  platform_id: text("platform_id").notNull(),
  category_id: text("category_id").notNull(),
  commission_type: text("commission_type").notNull(), // 'flat' | 'tiered'
  commission_percent: numeric("commission_percent"),
  archived: boolean("archived").notNull().default(false),
  version_number: integer("version_number").notNull().default(1),

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
  template_type: text("template_type"),
  template_version: text("template_version"),
  uploaded_by: text("uploaded_by"),
  source_upload_id: uuid("source_upload_id"),
  raw_payload: jsonb("raw_payload"),

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
  applies_to_fulfillment_type: text("applies_to_fulfillment_type"),
  min_price: numeric("min_price"),
  max_price: numeric("max_price"),
  effective_from: date("effective_from"),
  effective_to: date("effective_to"),
  is_active: boolean("is_active").default(true),
  tenant_id: text("tenant_id"),
});

export const reconciliationRuns = pgTable("reconciliation_runs", {
  id: uuid("id").defaultRandom().primaryKey(),
  parent_run_id: uuid("parent_run_id"),
  trigger_type: text("trigger_type"), // NIGHTLY | SETTLEMENT | RATE_CHANGE | MANUAL
  status: text("status"), // PENDING | RUNNING | COMPLETED | FAILED
  is_latest: boolean("is_latest").default(false),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
  completed_at: timestamp("completed_at", { withTimezone: true }),
  total_orders_processed: integer("total_orders_processed").default(0),
  affected_orders_count: integer("affected_orders_count").default(0),
  failure_reason: text("failure_reason"),
  input_orders_count: integer("input_orders_count"),
  input_orders_last_updated: timestamp("input_orders_last_updated", { withTimezone: true }),
  input_settlements_count: integer("input_settlements_count"),
  input_settlements_last_updated: timestamp("input_settlements_last_updated", { withTimezone: true }),
  input_rate_cards_count: integer("input_rate_cards_count"),
  input_rate_cards_last_updated: timestamp("input_rate_cards_last_updated", { withTimezone: true }),
}, (table) => ({
  statusIdx: index("reconciliation_runs_status_idx").on(table.status),
  latestIdx: index("reconciliation_runs_is_latest_idx").on(table.is_latest),
  parentRunFk: foreignKey({
    columns: [table.parent_run_id],
    foreignColumns: [table.id],
  }),
}));

export const reconciliationsV0 = pgTable("reconciliations_v0", {
  id: uuid("id").defaultRandom().primaryKey(),
  order_id: text("order_id").notNull(),
  marketplace: text("marketplace").notNull(),
  category: text("category").notNull(),
  order_date: date("order_date").notNull(),
  delivery_date: date("delivery_date").notNull(),
  actual_payout_date: date("actual_payout_date"),
  rate_card_id: uuid("rate_card_id").notNull(),
  settlement_anchor: text("settlement_anchor").notNull(),
  settlement_cycle: text("settlement_cycle").notNull(),
  expected_payout_after_days: integer("expected_payout_after_days").notNull(),
  grace_days: integer("grace_days").notNull(),
  expected_payout_date: date("expected_payout_date").notNull(),
  delay_threshold_date: date("delay_threshold_date").notNull(),
  reco_status: text("reco_status").notNull(),
  reconciliation_state: text("reconciliation_state"),
  operational_status: text("operational_status"),
  run_id: uuid("run_id").references(() => reconciliationRuns.id),
  gross_order_value: doublePrecision("gross_order_value"),
  expected_commission_amount: doublePrecision("expected_commission_amount"),
  expected_platform_fee_amount: doublePrecision("expected_platform_fee_amount"),
  expected_collection_fee_amount: doublePrecision("expected_collection_fee_amount"),
  expected_total_deductions: doublePrecision("expected_total_deductions"),
  expected_net_payout: doublePrecision("expected_net_payout"),
  actual_payout_amount: doublePrecision("actual_payout_amount"),
  discrepancy_amount: doublePrecision("discrepancy_amount"),
  settlement_rows_count: integer("settlement_rows_count"),
  last_payout_date: date("last_payout_date"),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow(),
}, (table) => ({
  runIdIdx: index("reconciliations_v0_run_id_idx").on(table.run_id),
  orderRunIdx: index("reconciliations_v0_order_run_idx").on(table.order_id, table.run_id),
  orderMarketplaceRunUnique: unique("reconciliations_v0_order_marketplace_run_uidx").on(
    table.order_id,
    table.marketplace,
    table.run_id,
  ),
}));

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
  upload_batch_id: uuid("upload_batch_id"),
  is_superseded: boolean("is_superseded").default(false),

  created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
}, (table) => ({
  orderMarketplaceSupersededIdx: index("settlements_order_mkt_superseded_idx").on(
    table.order_id,
    table.marketplace,
    table.is_superseded,
  ),
}));

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
  deliveryDate: date("delivery_date"),
  orderStatus: text("order_status"),
  marketplace: text("marketplace"),
  weightGrams: integer("weight_grams"),
  categoryId: text("category_id"),
  fulfillmentType: text("fulfillment_type"),
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
  fulfillmentType: text("fulfillment_type"),
  claimId: uuid("claim_id"),
  reimbursementClaimStatus: text("reimbursement_claim_status"),
  reimbursementAmount: numeric("reimbursement_amount"),
  expectedRefundAmount: numeric("expected_refund_amount"),
  expectedCommissionReversal: numeric("expected_commission_reversal"),
  expectedLogisticsReversal: numeric("expected_logistics_reversal"),
  reconciliationStatus: text("reconciliation_status"),
  refundLeakage: numeric("refund_leakage"),
  commissionLeakage: numeric("commission_leakage"),
  logisticsLeakage: numeric("logistics_leakage"),
  leakageAmount: numeric("leakage_amount"),
  createdAt: timestamp("created_at").defaultNow(),
  tenantId: text("tenant_id").notNull(),
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
