// server/src/db/schema.ts
import { pgTable, uuid, text, numeric, integer, date, timestamp } from "drizzle-orm/pg-core";

export const rate_cards = pgTable("rate_cards", {
  id: uuid("id").defaultRandom().primaryKey(),
  platform_id: text("platform_id").notNull(),
  category_id: text("category_id").notNull(),
  commission_type: text("commission_type").notNull(), // 'flat' | 'tiered'
  commission_percent: numeric("commission_percent"),

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

export const rate_card_slabs = pgTable("rate_card_slabs", {
  id: uuid("id").defaultRandom().primaryKey(),
  rate_card_id: uuid("rate_card_id").notNull().references(() => rate_cards.id, { onDelete: "cascade" }),
  min_price: numeric("min_price").notNull().default("0"),
  max_price: numeric("max_price"),
  commission_percent: numeric("commission_percent").notNull(),
});

export const rate_card_fees = pgTable("rate_card_fees", {
  id: uuid("id").defaultRandom().primaryKey(),
  rate_card_id: uuid("rate_card_id").notNull().references(() => rate_cards.id, { onDelete: "cascade" }),
  fee_code: text("fee_code").notNull(), // shipping|rto|packaging|fixed|collection|tech|storage
  fee_type: text("fee_type").notNull(), // percent|amount
  fee_value: numeric("fee_value").notNull(),
});
