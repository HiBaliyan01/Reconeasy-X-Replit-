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
  type InsertReturn
} from "@shared/schema";

// modify the interface with any CRUD methods
// you might need

export interface IStorage {
  // User methods
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Rate card methods
  getRateCards(): Promise<RateCard[]>;
  getRateCard(id: string): Promise<RateCard | undefined>;
  createRateCard(rateCard: InsertRateCard): Promise<RateCard>;
  updateRateCard(id: string, updates: Partial<InsertRateCard>): Promise<RateCard | undefined>;
  deleteRateCard(id: string): Promise<boolean>;
  saveRateCards(csvData: any[]): Promise<RateCard[]>;
  
  // Settlement methods
  getSettlements(marketplace?: string): Promise<Settlement[]>;
  getSettlement(id: string): Promise<Settlement | undefined>;
  createSettlement(settlement: InsertSettlement): Promise<Settlement>;
  createMultipleSettlements(settlements: InsertSettlement[]): Promise<Settlement[]>;
  
  // Alert methods
  getAlerts(): Promise<Alert[]>;
  createAlert(alert: InsertAlert): Promise<Alert>;
  
  // Order methods
  getOrders(marketplace?: string): Promise<Order[]>;
  getOrder(id: string): Promise<Order | undefined>;
  createOrder(order: InsertOrder): Promise<Order>;
  createMultipleOrders(orders: InsertOrder[]): Promise<Order[]>;
  
  // Return methods
  getReturns(marketplace?: string): Promise<Return[]>;
  getReturn(id: string): Promise<Return | undefined>;
  createReturn(returnData: InsertReturn): Promise<Return>;
  createMultipleReturns(returns: InsertReturn[]): Promise<Return[]>;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private rateCards: Map<string, RateCard>;
  private settlements: Map<string, Settlement>;
  private alerts: Map<string, Alert>;
  private orders: Map<string, Order>;
  private returns: Map<string, Return>;
  private currentUserId: number;
  private currentId: number;

  constructor() {
    this.users = new Map();
    this.rateCards = new Map();
    this.settlements = new Map();
    this.alerts = new Map();
    this.orders = new Map();
    this.returns = new Map();
    this.currentUserId = 1;
    this.currentId = 1;
    
    // Add some sample rate cards for testing
    this.initializeSampleData();
  }

  private initializeSampleData() {
    // Sample rate cards
    const sampleRateCards: RateCard[] = [
      {
        id: "rc_1",
        platform: "Amazon",
        category: "Apparel",
        commission_rate: 15.0,
        shipping_fee: 50.0,
        gst_rate: 18.0,
        rto_fee: 100.0,
        packaging_fee: 20.0,
        fixed_fee: 10.0,
        min_price: 100.0,
        max_price: 10000.0,
        effective_from: "2024-01-01",
        effective_to: "2024-12-31",
        promo_discount_fee: null,
        territory_fee: null,
        notes: "Standard Amazon apparel rate card",
        created_at: new Date("2024-01-01")
      },
      {
        id: "rc_2",
        platform: "Flipkart",
        category: "Apparel",
        commission_rate: 18.0,
        shipping_fee: 60.0,
        gst_rate: 18.0,
        rto_fee: 120.0,
        packaging_fee: 25.0,
        fixed_fee: 15.0,
        min_price: 100.0,
        max_price: 15000.0,
        effective_from: "2024-01-01",
        effective_to: "2024-12-31",
        promo_discount_fee: null,
        territory_fee: null,
        notes: "Standard Flipkart apparel rate card",
        created_at: new Date("2024-01-01")
      },
      {
        id: "rc_3",
        platform: "Amazon",
        category: "Electronics",
        commission_rate: 12.0,
        shipping_fee: 80.0,
        gst_rate: 18.0,
        rto_fee: 200.0,
        packaging_fee: 40.0,
        fixed_fee: 25.0,
        min_price: 500.0,
        max_price: 50000.0,
        effective_from: "2024-01-01",
        effective_to: "2024-12-31",
        promo_discount_fee: null,
        territory_fee: null,
        notes: "Amazon electronics rate card",
        created_at: new Date("2024-01-01")
      }
    ];

    sampleRateCards.forEach(card => {
      this.rateCards.set(card.id, card);
    });

    // Sample settlements
    const sampleSettlements: Settlement[] = [
      {
        id: "st_1",
        expected_amount: 850.0,
        paid_amount: 845.0,
        fee_breakdown: {
          commission: 150.0,
          shipping_fee: 50.0,
          gst: 36.0,
          rto_fee: 0.0,
          packaging_fee: 20.0,
          fixed_fee: 10.0,
          total_deductions: 266.0
        },
        reco_status: "matched",
        delta: -5.0,
        created_at: new Date("2024-07-15")
      },
      {
        id: "st_2",
        expected_amount: 920.0,
        paid_amount: 900.0,
        fee_breakdown: {
          commission: 180.0,
          shipping_fee: 60.0,
          gst: 43.2,
          rto_fee: 0.0,
          packaging_fee: 25.0,
          fixed_fee: 15.0,
          total_deductions: 323.2
        },
        reco_status: "mismatch",
        delta: -20.0,
        created_at: new Date("2024-07-16")
      }
    ];

    sampleSettlements.forEach(settlement => {
      this.settlements.set(settlement.id, settlement);
    });

    // Sample alerts
    const sampleAlerts: Alert[] = [
      {
        id: "al_1",
        type: "mismatch",
        message: "Settlement amount mismatch detected for Order #ORD001",
        created_at: new Date("2024-07-16")
      },
      {
        id: "al_2",
        type: "info",
        message: "New rate card added for Myntra Electronics",
        created_at: new Date("2024-07-15")
      }
    ];

    sampleAlerts.forEach(alert => {
      this.alerts.set(alert.id, alert);
    });

    this.currentId = 10; // Start from 10 for new IDs
  }

  // User methods
  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.currentUserId++;
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  // Rate card methods
  async getRateCards(): Promise<RateCard[]> {
    return Array.from(this.rateCards.values()).sort((a, b) => 
      new Date(b.created_at!).getTime() - new Date(a.created_at!).getTime()
    );
  }

  async getRateCard(id: string): Promise<RateCard | undefined> {
    return this.rateCards.get(id);
  }

  async createRateCard(insertRateCard: InsertRateCard): Promise<RateCard> {
    const id = `rc_${this.currentId++}`;
    const rateCard: RateCard = { 
      id,
      platform: insertRateCard.platform,
      category: insertRateCard.category,
      commission_rate: insertRateCard.commission_rate ?? null,
      shipping_fee: insertRateCard.shipping_fee ?? null,
      gst_rate: insertRateCard.gst_rate ?? null,
      rto_fee: insertRateCard.rto_fee ?? null,
      packaging_fee: insertRateCard.packaging_fee ?? null,
      fixed_fee: insertRateCard.fixed_fee ?? null,
      min_price: insertRateCard.min_price ?? null,
      max_price: insertRateCard.max_price ?? null,
      effective_from: insertRateCard.effective_from ?? null,
      effective_to: insertRateCard.effective_to ?? null,
      promo_discount_fee: insertRateCard.promo_discount_fee ?? null,
      territory_fee: insertRateCard.territory_fee ?? null,
      notes: insertRateCard.notes ?? null,
      created_at: new Date() 
    };
    this.rateCards.set(id, rateCard);
    return rateCard;
  }

  async updateRateCard(id: string, updates: Partial<InsertRateCard>): Promise<RateCard | undefined> {
    const existing = this.rateCards.get(id);
    if (!existing) return undefined;
    
    const updated: RateCard = { ...existing, ...updates };
    this.rateCards.set(id, updated);
    return updated;
  }

  async deleteRateCard(id: string): Promise<boolean> {
    return this.rateCards.delete(id);
  }

  async saveRateCards(csvData: any[]): Promise<RateCard[]> {
    const createdRateCards: RateCard[] = [];
    
    for (const row of csvData) {
      try {
        const rateCardData: InsertRateCard = {
          platform: row.marketplace || row.platform,
          category: row.category,
          commission_rate: parseFloat(row.commission_pct) || null,
          shipping_fee: parseFloat(row.shipping_fee) || null,
          gst_rate: parseFloat(row.gst_rate) || null,
          rto_fee: parseFloat(row.rto_fee) || null,
          packaging_fee: parseFloat(row.packaging_fee) || null,
          fixed_fee: parseFloat(row.fixed_fee) || null,
          min_price: parseFloat(row.price_range_min) || null,
          max_price: parseFloat(row.price_range_max) || null,
          effective_from: row.effective_from || null,
          effective_to: row.effective_to || null,
          promo_discount_fee: null,
          territory_fee: null,
          notes: `Imported from CSV on ${new Date().toISOString().split('T')[0]}`
        };

        const createdRateCard = await this.createRateCard(rateCardData);
        createdRateCards.push(createdRateCard);
      } catch (error) {
        console.error('Error creating rate card from CSV row:', error, row);
      }
    }
    
    return createdRateCards;
  }

  // Settlement methods
  async getSettlements(marketplace?: string): Promise<Settlement[]> {
    let settlements = Array.from(this.settlements.values());
    
    if (marketplace && marketplace !== 'all') {
      settlements = settlements.filter(settlement => settlement.marketplace === marketplace);
    }
    
    return settlements.sort((a, b) => 
      new Date(b.created_at!).getTime() - new Date(a.created_at!).getTime()
    );
  }

  async getSettlement(id: string): Promise<Settlement | undefined> {
    return this.settlements.get(id);
  }

  async createSettlement(insertSettlement: InsertSettlement): Promise<Settlement> {
    const id = `st_${this.currentId++}`;
    const settlement: Settlement = { 
      id,
      expected_amount: insertSettlement.expected_amount,
      paid_amount: insertSettlement.paid_amount,
      fee_breakdown: insertSettlement.fee_breakdown ?? null,
      reco_status: insertSettlement.reco_status ?? null,
      delta: insertSettlement.delta ?? null,
      created_at: new Date() 
    };
    this.settlements.set(id, settlement);
    return settlement;
  }

  async createMultipleSettlements(settlements: InsertSettlement[]): Promise<Settlement[]> {
    const createdSettlements: Settlement[] = [];
    for (const settlement of settlements) {
      const created = await this.createSettlement(settlement);
      createdSettlements.push(created);
    }
    return createdSettlements;
  }

  // Alert methods
  async getAlerts(): Promise<Alert[]> {
    return Array.from(this.alerts.values()).sort((a, b) => 
      new Date(b.created_at!).getTime() - new Date(a.created_at!).getTime()
    );
  }

  async createAlert(insertAlert: InsertAlert): Promise<Alert> {
    const id = `al_${this.currentId++}`;
    const alert: Alert = { 
      ...insertAlert, 
      id, 
      created_at: new Date() 
    };
    this.alerts.set(id, alert);
    return alert;
  }

  // Order methods
  async getOrders(marketplace?: string): Promise<Order[]> {
    const allOrders = Array.from(this.orders.values());
    if (marketplace) {
      return allOrders.filter(order => order.marketplace === marketplace);
    }
    return allOrders;
  }

  async getOrder(id: string): Promise<Order | undefined> {
    return this.orders.get(id);
  }

  async createOrder(order: InsertOrder): Promise<Order> {
    const newOrder: Order = {
      id: `order_${this.currentId++}`,
      ...order,
      createdAt: new Date(),
    };
    this.orders.set(newOrder.id, newOrder);
    return newOrder;
  }

  async createMultipleOrders(orders: InsertOrder[]): Promise<Order[]> {
    const createdOrders: Order[] = [];
    for (const orderData of orders) {
      const newOrder = await this.createOrder(orderData);
      createdOrders.push(newOrder);
    }
    return createdOrders;
  }

  // Return methods
  async getReturns(marketplace?: string): Promise<Return[]> {
    const allReturns = Array.from(this.returns.values());
    if (marketplace) {
      return allReturns.filter(returnData => returnData.marketplace === marketplace);
    }
    return allReturns;
  }

  async getReturn(id: string): Promise<Return | undefined> {
    return this.returns.get(id);
  }

  async createReturn(returnData: InsertReturn): Promise<Return> {
    const newReturn: Return = {
      id: `return_${this.currentId++}`,
      ...returnData,
      createdAt: new Date(),
    };
    this.returns.set(newReturn.id, newReturn);
    return newReturn;
  }

  async createMultipleReturns(returns: InsertReturn[]): Promise<Return[]> {
    const createdReturns: Return[] = [];
    for (const returnData of returns) {
      const newReturn = await this.createReturn(returnData);
      createdReturns.push(newReturn);
    }
    return createdReturns;
  }
}

export const storage = new MemStorage();

export { db } from "./db";
