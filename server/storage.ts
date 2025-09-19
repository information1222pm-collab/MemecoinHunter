import { 
  users, tokens, portfolios, trades, positions, scanAlerts, 
  priceHistory, patterns, subscriptions,
  type User, type InsertUser, type Token, type InsertToken,
  type Portfolio, type InsertPortfolio, type Trade, type InsertTrade,
  type Position, type InsertPosition, type ScanAlert, type InsertScanAlert,
  type PriceHistory, type InsertPriceHistory, type Pattern, type InsertPattern,
  type Subscription, type InsertSubscription
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, gte, lte } from "drizzle-orm";

export interface IStorage {
  // User operations
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, updates: Partial<InsertUser>): Promise<User>;

  // Token operations
  getToken(id: string): Promise<Token | undefined>;
  getTokenBySymbol(symbol: string): Promise<Token | undefined>;
  getAllTokens(): Promise<Token[]>;
  getActiveTokens(): Promise<Token[]>;
  createToken(token: InsertToken): Promise<Token>;
  updateToken(id: string, updates: Partial<InsertToken>): Promise<Token>;

  // Portfolio operations
  getPortfolio(id: string): Promise<Portfolio | undefined>;
  getPortfolioByUserId(userId: string): Promise<Portfolio | undefined>;
  getAllPortfolios(): Promise<Portfolio[]>;
  createPortfolio(portfolio: InsertPortfolio): Promise<Portfolio>;
  updatePortfolio(id: string, updates: Partial<InsertPortfolio>): Promise<Portfolio>;

  // Trade operations
  getTrade(id: string): Promise<Trade | undefined>;
  getTradesByPortfolio(portfolioId: string): Promise<Trade[]>;
  createTrade(trade: InsertTrade): Promise<Trade>;
  getRecentTrades(limit?: number): Promise<Trade[]>;

  // Position operations
  getPosition(id: string): Promise<Position | undefined>;
  getPositionsByPortfolio(portfolioId: string): Promise<Position[]>;
  getPositionByPortfolioAndToken(portfolioId: string, tokenId: string): Promise<Position | undefined>;
  createPosition(position: InsertPosition): Promise<Position>;
  updatePosition(id: string, updates: Partial<InsertPosition>): Promise<Position>;

  // Alert operations
  getUnreadAlerts(): Promise<ScanAlert[]>;
  createAlert(alert: InsertScanAlert): Promise<ScanAlert>;
  markAlertAsRead(id: string): Promise<ScanAlert>;

  // Price history operations
  getPriceHistory(tokenId: string, from?: Date, to?: Date): Promise<PriceHistory[]>;
  createPriceHistory(history: InsertPriceHistory): Promise<PriceHistory>;

  // Pattern operations
  getPatternsByToken(tokenId: string): Promise<Pattern[]>;
  createPattern(pattern: InsertPattern): Promise<Pattern>;
  getRecentPatterns(limit?: number): Promise<Pattern[]>;

  // Subscription operations
  getSubscription(id: string): Promise<Subscription | undefined>;
  getSubscriptionByUserId(userId: string): Promise<Subscription | undefined>;
  createSubscription(subscription: InsertSubscription): Promise<Subscription>;
  updateSubscription(id: string, updates: Partial<InsertSubscription>): Promise<Subscription>;
}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async updateUser(id: string, updates: Partial<InsertUser>): Promise<User> {
    const [user] = await db.update(users).set(updates).where(eq(users.id, id)).returning();
    return user;
  }

  // Token operations
  async getToken(id: string): Promise<Token | undefined> {
    const [token] = await db.select().from(tokens).where(eq(tokens.id, id));
    return token || undefined;
  }

  async getTokenBySymbol(symbol: string): Promise<Token | undefined> {
    const [token] = await db.select().from(tokens).where(eq(tokens.symbol, symbol));
    return token || undefined;
  }

  async getAllTokens(): Promise<Token[]> {
    return await db.select().from(tokens).orderBy(desc(tokens.marketCap));
  }

  async getActiveTokens(): Promise<Token[]> {
    return await db.select().from(tokens).where(eq(tokens.isActive, true)).orderBy(desc(tokens.marketCap));
  }

  async createToken(insertToken: InsertToken): Promise<Token> {
    const [token] = await db.insert(tokens).values(insertToken).returning();
    return token;
  }

  async updateToken(id: string, updates: Partial<InsertToken>): Promise<Token> {
    const [token] = await db.update(tokens).set(updates).where(eq(tokens.id, id)).returning();
    return token;
  }

  // Portfolio operations
  async getPortfolio(id: string): Promise<Portfolio | undefined> {
    const [portfolio] = await db.select().from(portfolios).where(eq(portfolios.id, id));
    return portfolio || undefined;
  }

  async getPortfolioByUserId(userId: string): Promise<Portfolio | undefined> {
    const [portfolio] = await db.select().from(portfolios).where(eq(portfolios.userId, userId));
    return portfolio || undefined;
  }

  async getAllPortfolios(): Promise<Portfolio[]> {
    return await db.select().from(portfolios);
  }

  async createPortfolio(insertPortfolio: InsertPortfolio): Promise<Portfolio> {
    const [portfolio] = await db.insert(portfolios).values(insertPortfolio).returning();
    return portfolio;
  }

  async updatePortfolio(id: string, updates: Partial<InsertPortfolio>): Promise<Portfolio> {
    const [portfolio] = await db.update(portfolios).set(updates).where(eq(portfolios.id, id)).returning();
    return portfolio;
  }

  // Trade operations
  async getTrade(id: string): Promise<Trade | undefined> {
    const [trade] = await db.select().from(trades).where(eq(trades.id, id));
    return trade || undefined;
  }

  async getTradesByPortfolio(portfolioId: string): Promise<Trade[]> {
    return await db.select().from(trades).where(eq(trades.portfolioId, portfolioId)).orderBy(desc(trades.createdAt));
  }

  async createTrade(insertTrade: InsertTrade): Promise<Trade> {
    const [trade] = await db.insert(trades).values(insertTrade).returning();
    return trade;
  }

  async getRecentTrades(limit: number = 10): Promise<Trade[]> {
    return await db.select().from(trades).orderBy(desc(trades.createdAt)).limit(limit);
  }

  // Position operations
  async getPosition(id: string): Promise<Position | undefined> {
    const [position] = await db.select().from(positions).where(eq(positions.id, id));
    return position || undefined;
  }

  async getPositionsByPortfolio(portfolioId: string): Promise<Position[]> {
    return await db.select().from(positions).where(eq(positions.portfolioId, portfolioId));
  }

  async getPositionByPortfolioAndToken(portfolioId: string, tokenId: string): Promise<Position | undefined> {
    const [position] = await db.select().from(positions)
      .where(and(eq(positions.portfolioId, portfolioId), eq(positions.tokenId, tokenId)));
    return position || undefined;
  }

  async createPosition(insertPosition: InsertPosition): Promise<Position> {
    const [position] = await db.insert(positions).values(insertPosition).returning();
    return position;
  }

  async updatePosition(id: string, updates: Partial<InsertPosition>): Promise<Position> {
    const [position] = await db.update(positions).set(updates).where(eq(positions.id, id)).returning();
    return position;
  }

  // Alert operations
  async getUnreadAlerts(): Promise<ScanAlert[]> {
    return await db.select().from(scanAlerts).where(eq(scanAlerts.isRead, false)).orderBy(desc(scanAlerts.createdAt));
  }

  async createAlert(insertAlert: InsertScanAlert): Promise<ScanAlert> {
    const [alert] = await db.insert(scanAlerts).values(insertAlert).returning();
    return alert;
  }

  async markAlertAsRead(id: string): Promise<ScanAlert> {
    const [alert] = await db.update(scanAlerts).set({ isRead: true }).where(eq(scanAlerts.id, id)).returning();
    return alert;
  }

  // Price history operations
  async getPriceHistory(tokenId: string, from?: Date, to?: Date): Promise<PriceHistory[]> {
    if (from && to) {
      return await db.select().from(priceHistory)
        .where(and(
          eq(priceHistory.tokenId, tokenId),
          gte(priceHistory.timestamp, from),
          lte(priceHistory.timestamp, to)
        ))
        .orderBy(desc(priceHistory.timestamp));
    }
    
    return await db.select().from(priceHistory)
      .where(eq(priceHistory.tokenId, tokenId))
      .orderBy(desc(priceHistory.timestamp));
  }

  async createPriceHistory(insertHistory: InsertPriceHistory): Promise<PriceHistory> {
    const [history] = await db.insert(priceHistory).values(insertHistory).returning();
    return history;
  }

  // Pattern operations
  async getPatternsByToken(tokenId: string): Promise<Pattern[]> {
    return await db.select().from(patterns).where(eq(patterns.tokenId, tokenId)).orderBy(desc(patterns.detectedAt));
  }

  async createPattern(insertPattern: InsertPattern): Promise<Pattern> {
    const [pattern] = await db.insert(patterns).values(insertPattern).returning();
    return pattern;
  }

  async getRecentPatterns(limit: number = 10): Promise<Pattern[]> {
    return await db.select().from(patterns).orderBy(desc(patterns.detectedAt)).limit(limit);
  }

  // Subscription operations
  async getSubscription(id: string): Promise<Subscription | undefined> {
    const [subscription] = await db.select().from(subscriptions).where(eq(subscriptions.id, id));
    return subscription || undefined;
  }

  async getSubscriptionByUserId(userId: string): Promise<Subscription | undefined> {
    const [subscription] = await db.select().from(subscriptions).where(eq(subscriptions.userId, userId));
    return subscription || undefined;
  }

  async createSubscription(insertSubscription: InsertSubscription): Promise<Subscription> {
    const [subscription] = await db.insert(subscriptions).values(insertSubscription).returning();
    return subscription;
  }

  async updateSubscription(id: string, updates: Partial<InsertSubscription>): Promise<Subscription> {
    const [subscription] = await db.update(subscriptions).set(updates).where(eq(subscriptions.id, id)).returning();
    return subscription;
  }
}

export const storage = new DatabaseStorage();
