import {
  users,
  rateCards,
  settlements,
  alerts,
  orders,
  returns,
  type User,
  type InsertUser,
  type RateCard,
  type InsertRateCard,
  type Settlement,
  type InsertSettlement,
  type Alert,
  type InsertAlert,
  type Order,
  type InsertOrder,
  type Return,
  type InsertReturn,
} from "@shared/schema";
import { db } from "./db";
import { desc, eq } from "drizzle-orm";

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  getRateCards(): Promise<RateCard[]>;
  getRateCard(id: string): Promise<RateCard | undefined>;
  createRateCard(rateCard: InsertRateCard): Promise<RateCard>;
  updateRateCard(id: string, updates: Partial<InsertRateCard>): Promise<RateCard | undefined>;
  deleteRateCard(id: string): Promise<boolean>;
  saveRateCards(csvData: any[]): Promise<RateCard[]>;

  getSettlements(marketplace?: string): Promise<Settlement[]>;
  getSettlement(id: string): Promise<Settlement | undefined>;
  createSettlement(settlement: InsertSettlement): Promise<Settlement>;
  createMultipleSettlements(settlements: InsertSettlement[]): Promise<Settlement[]>;

  getAlerts(): Promise<Alert[]>;
  createAlert(alert: InsertAlert): Promise<Alert>;

  getOrders(marketplace?: string): Promise<Order[]>;
  getOrder(id: string): Promise<Order | undefined>;
  createOrder(order: InsertOrder): Promise<Order>;
  createMultipleOrders(orders: InsertOrder[]): Promise<Order[]>;

  getReturns(marketplace?: string): Promise<Return[]>;
  getReturn(id: string): Promise<Return | undefined>;
  createReturn(returnData: InsertReturn): Promise<Return>;
  createMultipleReturns(returns: InsertReturn[]): Promise<Return[]>;
}

type Nullable<T> = T | null;

function toNullable<T>(value: T | null | undefined): Nullable<T> {
  return value === undefined ? null : value;
}

function toNullableOptional<T>(value: T | null | undefined): Nullable<T> | undefined {
  return value === undefined ? undefined : value === null ? null : value;
}

function cleanUndefined<T extends Record<string, unknown>>(value: T): Partial<T> {
  return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) as Partial<T>;
}

function parseNullableNumber(value: unknown): number | null {
  if (value === undefined || value === null || value === "") return null;
  const num = Number(value);
  return Number.isNaN(num) ? null : num;
}

function normaliseInsertRateCard(payload: InsertRateCard): InsertRateCard {
  return {
    ...payload,
    commission_rate: toNullable(payload.commission_rate),
    shipping_fee: toNullable(payload.shipping_fee),
    gst_rate: toNullable(payload.gst_rate),
    rto_fee: toNullable(payload.rto_fee),
    packaging_fee: toNullable(payload.packaging_fee),
    fixed_fee: toNullable(payload.fixed_fee),
    min_price: toNullable(payload.min_price),
    max_price: toNullable(payload.max_price),
    promo_discount_fee: toNullable(payload.promo_discount_fee),
    territory_fee: toNullable(payload.territory_fee),
    notes: payload.notes ?? null,
  };
}

function normaliseUpdateRateCard(updates: Partial<InsertRateCard>) {
  return cleanUndefined({
    ...updates,
    commission_rate: toNullableOptional(updates.commission_rate),
    shipping_fee: toNullableOptional(updates.shipping_fee),
    gst_rate: toNullableOptional(updates.gst_rate),
    rto_fee: toNullableOptional(updates.rto_fee),
    packaging_fee: toNullableOptional(updates.packaging_fee),
    fixed_fee: toNullableOptional(updates.fixed_fee),
    min_price: toNullableOptional(updates.min_price),
    max_price: toNullableOptional(updates.max_price),
    promo_discount_fee: toNullableOptional(updates.promo_discount_fee),
    territory_fee: toNullableOptional(updates.territory_fee),
    notes: toNullableOptional(updates.notes),
  });
}

function normaliseInsertSettlement(payload: InsertSettlement): InsertSettlement {
  return {
    ...payload,
    expected_amount: toNullable(payload.expected_amount),
    paid_amount: toNullable(payload.paid_amount),
    fee_breakdown: payload.fee_breakdown ?? null,
    reco_status: payload.reco_status ?? null,
    delta: toNullable(payload.delta),
    order_id: payload.order_id ?? null,
    utr_number: payload.utr_number ?? null,
    payout_date: payload.payout_date ?? null,
    actual_settlement_amount: toNullable(payload.actual_settlement_amount),
    commission: toNullable(payload.commission),
    shipping_fee: toNullable(payload.shipping_fee),
    rto_fee: toNullable(payload.rto_fee),
    packaging_fee: toNullable(payload.packaging_fee),
    fixed_fee: toNullable(payload.fixed_fee),
    gst: toNullable(payload.gst),
    order_status: payload.order_status ?? null,
    marketplace: payload.marketplace ?? null,
  };
}

function normaliseInsertOrder(payload: InsertOrder): InsertOrder {
  return {
    ...payload,
    sellingPrice: toNullable(payload.sellingPrice),
    dispatchDate: payload.dispatchDate ?? null,
    orderStatus: payload.orderStatus ?? null,
    marketplace: payload.marketplace ?? null,
  };
}

function normaliseInsertReturn(payload: InsertReturn): InsertReturn {
  return {
    ...payload,
    returnType: payload.returnType ?? null,
    returnReasonCode: payload.returnReasonCode ?? null,
    returnReasonDesc: payload.returnReasonDesc ?? null,
    returnDate: payload.returnDate ?? null,
    refundAmount: toNullable(payload.refundAmount),
    returnStatus: payload.returnStatus ?? null,
    receivedDateWh: payload.receivedDateWh ?? null,
    qcResult: payload.qcResult ?? null,
    disposition: payload.disposition ?? null,
    commissionReversal: toNullable(payload.commissionReversal),
    logisticsReversal: toNullable(payload.logisticsReversal),
    otherFeeReversal: toNullable(payload.otherFeeReversal),
    settlementRefId: payload.settlementRefId ?? null,
    utrNumber: payload.utrNumber ?? null,
    refundMode: payload.refundMode ?? null,
    pickupDate: payload.pickupDate ?? null,
    pickupPartner: payload.pickupPartner ?? null,
    customerPin: payload.customerPin ?? null,
    warehouseCode: payload.warehouseCode ?? null,
    brandSku: payload.brandSku ?? null,
    asinStyleCode: payload.asinStyleCode ?? null,
    evidenceUrl: payload.evidenceUrl ?? null,
    claimDeadline: payload.claimDeadline ?? null,
    claimStatus: payload.claimStatus ?? null,
    claimAmountRequested: toNullable(payload.claimAmountRequested),
    claimAmountApproved: toNullable(payload.claimAmountApproved),
  };
}

class DatabaseStorage implements IStorage {
  async getUser(id: number): Promise<User | undefined> {
    const [row] = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return row;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [row] = await db.select().from(users).where(eq(users.username, username)).limit(1);
    return row;
  }

  async createUser(user: InsertUser): Promise<User> {
    const [inserted] = await db.insert(users).values(user).returning();
    return inserted;
  }

  async getRateCards(): Promise<RateCard[]> {
    return db.select().from(rateCards).orderBy(desc(rateCards.created_at));
  }

  async getRateCard(id: string): Promise<RateCard | undefined> {
    const [row] = await db.select().from(rateCards).where(eq(rateCards.id, id)).limit(1);
    return row;
  }

  async createRateCard(rateCard: InsertRateCard): Promise<RateCard> {
    const payload = normaliseInsertRateCard(rateCard);
    const [inserted] = await db.insert(rateCards).values(payload).returning();
    return inserted;
  }

  async updateRateCard(id: string, updates: Partial<InsertRateCard>): Promise<RateCard | undefined> {
    const payload = normaliseUpdateRateCard(updates);
    if (!Object.keys(payload).length) {
      return this.getRateCard(id);
    }
    const [updated] = await db
      .update(rateCards)
      .set(payload)
      .where(eq(rateCards.id, id))
      .returning();
    return updated;
  }

  async deleteRateCard(id: string): Promise<boolean> {
    const deleted = await db.delete(rateCards).where(eq(rateCards.id, id)).returning({ id: rateCards.id });
    return deleted.length > 0;
  }

  async saveRateCards(csvData: any[]): Promise<RateCard[]> {
    const inserted: RateCard[] = [];
    for (const row of csvData || []) {
      try {
        const rateCard: InsertRateCard = {
          platform: row.marketplace || row.platform,
          category: row.category,
          commission_rate: parseNullableNumber(row.commission_pct),
          shipping_fee: parseNullableNumber(row.shipping_fee),
          gst_rate: parseNullableNumber(row.gst_rate),
          rto_fee: parseNullableNumber(row.rto_fee),
          packaging_fee: parseNullableNumber(row.packaging_fee),
          fixed_fee: parseNullableNumber(row.fixed_fee),
          min_price: parseNullableNumber(row.price_range_min),
          max_price: parseNullableNumber(row.price_range_max),
          effective_from: row.effective_from || null,
          effective_to: row.effective_to || null,
          promo_discount_fee: null,
          territory_fee: null,
          notes: row.notes || `Imported on ${new Date().toISOString()}`,
        };
        inserted.push(await this.createRateCard(rateCard));
      } catch (error) {
        console.error("Failed to persist CSV rate card row", error, row);
      }
    }
    return inserted;
  }

  async getSettlements(marketplace?: string): Promise<Settlement[]> {
    const query = db.select().from(settlements);
    const rows = marketplace && marketplace !== "all"
      ? await query.where(eq(settlements.marketplace, marketplace))
      : await query;
    return rows.sort((a, b) => {
      const aDate = a.created_at ? new Date(a.created_at).getTime() : 0;
      const bDate = b.created_at ? new Date(b.created_at).getTime() : 0;
      return bDate - aDate;
    });
  }

  async getSettlement(id: string): Promise<Settlement | undefined> {
    const [row] = await db.select().from(settlements).where(eq(settlements.id, id)).limit(1);
    return row;
  }

  async createSettlement(settlement: InsertSettlement): Promise<Settlement> {
    const payload = normaliseInsertSettlement(settlement);
    const [inserted] = await db.insert(settlements).values(payload).returning();
    return inserted;
  }

  async createMultipleSettlements(rows: InsertSettlement[]): Promise<Settlement[]> {
    if (!rows.length) return [];
    const payload = rows.map((row) => normaliseInsertSettlement(row));
    return db.insert(settlements).values(payload).returning();
  }

  async getAlerts(): Promise<Alert[]> {
    return db.select().from(alerts).orderBy(desc(alerts.created_at));
  }

  async createAlert(alert: InsertAlert): Promise<Alert> {
    const [inserted] = await db.insert(alerts).values(alert).returning();
    return inserted;
  }

  async getOrders(marketplace?: string): Promise<Order[]> {
    const query = db.select().from(orders);
    return marketplace
      ? await query.where(eq(orders.marketplace, marketplace))
      : await query;
  }

  async getOrder(id: string): Promise<Order | undefined> {
    const [row] = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
    return row;
  }

  async createOrder(order: InsertOrder): Promise<Order> {
    const payload = normaliseInsertOrder(order);
    const [inserted] = await db.insert(orders).values(payload).returning();
    return inserted;
  }

  async createMultipleOrders(rows: InsertOrder[]): Promise<Order[]> {
    if (!rows.length) return [];
    const payload = rows.map((row) => normaliseInsertOrder(row));
    return db.insert(orders).values(payload).returning();
  }

  async getReturns(marketplace?: string): Promise<Return[]> {
    const query = db.select().from(returns);
    return marketplace
      ? await query.where(eq(returns.marketplace, marketplace))
      : await query;
  }

  async getReturn(id: string): Promise<Return | undefined> {
    const [row] = await db.select().from(returns).where(eq(returns.id, id)).limit(1);
    return row;
  }

  async createReturn(returnData: InsertReturn): Promise<Return> {
    const payload = normaliseInsertReturn(returnData);
    const [inserted] = await db.insert(returns).values(payload).returning();
    return inserted;
  }

  async createMultipleReturns(rows: InsertReturn[]): Promise<Return[]> {
    if (!rows.length) return [];
    const payload = rows.map((row) => normaliseInsertReturn(row));
    return db.insert(returns).values(payload).returning();
  }
}

export const storage: IStorage = new DatabaseStorage();
export { db } from "./db";
