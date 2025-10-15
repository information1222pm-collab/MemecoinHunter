import { 
  users, tokens, portfolios, trades, positions, scanAlerts, 
  priceHistory, patterns, subscriptions, patternPerformance, mlLearningParams, auditLog,
  exchangeConfig, exchangeTrades, exchangeBalances, tradingConfig, apiKeys,
  alertRules, alertEvents, visitors,
  type User, type InsertUser, type UpsertUser, type Token, type InsertToken,
  type Portfolio, type InsertPortfolio, type Trade, type InsertTrade,
  type Position, type InsertPosition, type ScanAlert, type InsertScanAlert,
  type PriceHistory, type InsertPriceHistory, type Pattern, type InsertPattern,
  type Subscription, type InsertSubscription, type PatternPerformance, type InsertPatternPerformance,
  type MLLearningParams, type InsertMLLearningParams,
  type AlertRule, type InsertAlertRule, type AlertEvent, type InsertAlertEvent,
  type Visitor, type InsertVisitor
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, gte, lte, sql } from "drizzle-orm";

// Audit log types from schema inference
type AuditLog = typeof auditLog.$inferSelect;
type InsertAuditLog = typeof auditLog.$inferInsert;

export interface IStorage {
  // User operations
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, updates: Partial<InsertUser>): Promise<User>;
  upsertUser(user: UpsertUser): Promise<User>; // For OAuth (Replit Auth)

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
  resetPortfolio(portfolioId: string, startingCapital: string): Promise<Portfolio>;

  // Trade operations
  getTrade(id: string): Promise<Trade | undefined>;
  getTradesByPortfolio(portfolioId: string): Promise<Trade[]>;
  createTrade(trade: InsertTrade): Promise<Trade>;
  updateTrade(id: string, updates: Partial<InsertTrade>): Promise<Trade>;
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
  getAllPatterns(): Promise<Pattern[]>;
  updatePatternConfidenceMultiplier(patternType: string, timeframe: string, multiplier: number): Promise<void>;

  // Trade operations extensions
  getTradesByPatternType(patternType: string, timeframe: string): Promise<Trade[]>;

  // Pattern Performance operations
  getPatternPerformance(patternType: string, timeframe: string): Promise<PatternPerformance | undefined>;
  getAllPatternPerformance(): Promise<PatternPerformance[]>;
  upsertPatternPerformance(performance: InsertPatternPerformance): Promise<PatternPerformance>;

  // ML Learning Parameters operations
  getMLLearningParam(key: string): Promise<MLLearningParams | undefined>;
  createMLLearningParam(param: InsertMLLearningParams): Promise<MLLearningParams>;
  updateMLLearningParam(key: string, value: string): Promise<MLLearningParams>;

  // Subscription operations
  getSubscription(id: string): Promise<Subscription | undefined>;
  getSubscriptionByUserId(userId: string): Promise<Subscription | undefined>;
  createSubscription(subscription: InsertSubscription): Promise<Subscription>;
  updateSubscription(id: string, updates: Partial<InsertSubscription>): Promise<Subscription>;

  // Security - Audit Log operations (CRITICAL SECURITY FIX)
  createAuditLog(log: InsertAuditLog): Promise<AuditLog>;
  getAuditLogs(userId?: string, limit?: number): Promise<AuditLog[]>;
  
  // WebSocket session validation (CRITICAL SECURITY FIX)
  getSessionData(sessionId: string): Promise<{ userId: string } | null>;

  // Exchange integration methods for real money trading
  getActiveExchangeConfigs(): Promise<any[]>; // ExchangeConfig[]
  getApiKey(id: string): Promise<any | undefined>; // ApiKey
  getTradingConfigByPortfolio(portfolioId: string): Promise<any | undefined>; // TradingConfig  
  createExchangeTrade(trade: any): Promise<any>; // InsertExchangeTrade -> ExchangeTrade
  updateExchangeHealth(exchangeName: string, status: string): Promise<void>;
  upsertExchangeBalance(balance: any): Promise<any>; // InsertExchangeBalance -> ExchangeBalance
  getAllExchangeBalances(): Promise<any[]>; // ExchangeBalance[]
  updateExchangeTrade(id: string, updates: any): Promise<any>; // CRITICAL FIX: Missing interface declaration

  // Price Alert operations
  getAlertsByUser(userId: string): Promise<AlertRule[]>;
  createAlertRule(data: InsertAlertRule): Promise<AlertRule>;
  updateAlertRule(id: string, data: Partial<InsertAlertRule>): Promise<AlertRule>;
  deleteAlertRule(id: string): Promise<void>;
  getActiveAlerts(): Promise<AlertRule[]>;
  createAlertEvent(data: InsertAlertEvent): Promise<AlertEvent>;
  getAlertHistory(userId: string, limit?: number): Promise<AlertEvent[]>;
  getAlertRule(id: string): Promise<AlertRule | undefined>;
  
  // Visitor tracking operations
  getVisitorByIp(ipAddress: string): Promise<Visitor | undefined>;
  createVisitor(data: InsertVisitor): Promise<Visitor>;
  updateVisitorDemo(ipAddress: string, hasSeenDemo: boolean): Promise<void>;
  updateVisitorLastVisit(ipAddress: string): Promise<void>;
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

  // OAuth user upsert (create or update) - Reference: blueprint:javascript_log_in_with_replit
  // Critical: Link accounts by email if user already exists with that email
  async upsertUser(userData: UpsertUser): Promise<User> {
    // Check if user with this email already exists (for account linking)
    let existingUser: User | undefined = undefined;
    if (userData.email) {
      existingUser = await this.getUserByEmail(userData.email);
    }
    
    let user: User;
    if (existingUser) {
      // Update existing user to link OAuth account
      [user] = await db
        .update(users)
        .set({
          firstName: userData.firstName,
          lastName: userData.lastName,
          profileImageUrl: userData.profileImageUrl,
          updatedAt: new Date(),
        })
        .where(eq(users.id, existingUser.id))
        .returning();
    } else {
      // Create new OAuth user
      [user] = await db
        .insert(users)
        .values(userData)
        .onConflictDoUpdate({
          target: users.id,
          set: {
            ...userData,
            updatedAt: new Date(),
          },
        })
        .returning();
    }
    
    // Create default portfolio for new OAuth users if they don't have one
    const existingPortfolio = await this.getPortfolioByUserId(user.id);
    if (!existingPortfolio) {
      await this.createPortfolio({ userId: user.id });
    }
    
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

  async resetPortfolio(portfolioId: string, startingCapital: string): Promise<Portfolio> {
    // Delete all positions for this portfolio
    await db.delete(positions).where(eq(positions.portfolioId, portfolioId));
    
    // Reset portfolio values with new starting capital
    const [portfolio] = await db.update(portfolios)
      .set({
        startingCapital,
        cashBalance: startingCapital,
        totalValue: "0",
        realizedPnL: "0",
        dailyPnL: "0",
        totalPnL: "0",
        winRate: "0",
        updatedAt: new Date(),
      })
      .where(eq(portfolios.id, portfolioId))
      .returning();
    
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

  async updateTrade(id: string, updates: Partial<InsertTrade>): Promise<Trade> {
    const [updated] = await db.update(trades)
      .set({ ...updates })
      .where(eq(trades.id, id))
      .returning();
    return updated;
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

  async getAllPatterns(): Promise<Pattern[]> {
    return await db.select().from(patterns).orderBy(desc(patterns.detectedAt));
  }

  async updatePatternConfidenceMultiplier(patternType: string, timeframe: string, multiplier: number): Promise<void> {
    await db.update(patterns)
      .set({ adjustedConfidence: (multiplier * 100).toString() })
      .where(and(
        eq(patterns.patternType, patternType),
        eq(patterns.timeframe, timeframe)
      ));
  }

  // Trade operations extensions
  async getTradesByPatternType(patternType: string, timeframe: string): Promise<Trade[]> {
    const patternIds = await db.select({ id: patterns.id })
      .from(patterns)
      .where(and(
        eq(patterns.patternType, patternType),
        eq(patterns.timeframe, timeframe)
      ));
    
    if (patternIds.length === 0) return [];
    
    const tradeResults: Trade[] = [];
    for (const pattern of patternIds) {
      const patternTrades = await db.select().from(trades).where(eq(trades.patternId, pattern.id));
      tradeResults.push(...patternTrades);
    }
    
    return tradeResults;
  }

  // Pattern Performance operations
  async getPatternPerformance(patternType: string, timeframe: string): Promise<PatternPerformance | undefined> {
    const [performance] = await db.select().from(patternPerformance)
      .where(and(
        eq(patternPerformance.patternType, patternType),
        eq(patternPerformance.timeframe, timeframe)
      ));
    return performance || undefined;
  }

  async getAllPatternPerformance(): Promise<PatternPerformance[]> {
    return await db.select().from(patternPerformance).orderBy(desc(patternPerformance.lastUpdated));
  }

  async upsertPatternPerformance(performance: InsertPatternPerformance): Promise<PatternPerformance> {
    const existing = await this.getPatternPerformance(performance.patternType, performance.timeframe);
    
    if (existing) {
      const [updated] = await db.update(patternPerformance)
        .set({ ...performance, lastUpdated: new Date() })
        .where(and(
          eq(patternPerformance.patternType, performance.patternType),
          eq(patternPerformance.timeframe, performance.timeframe)
        ))
        .returning();
      return updated;
    } else {
      const [created] = await db.insert(patternPerformance).values(performance).returning();
      return created;
    }
  }

  // ML Learning Parameters operations
  async getMLLearningParam(key: string): Promise<MLLearningParams | undefined> {
    const [param] = await db.select().from(mlLearningParams).where(eq(mlLearningParams.paramKey, key));
    return param || undefined;
  }

  async createMLLearningParam(param: InsertMLLearningParams): Promise<MLLearningParams> {
    const [created] = await db.insert(mlLearningParams).values(param).returning();
    return created;
  }

  async updateMLLearningParam(key: string, value: string): Promise<MLLearningParams> {
    const [updated] = await db.update(mlLearningParams)
      .set({ paramValue: value, lastUpdated: new Date() })
      .where(eq(mlLearningParams.paramKey, key))
      .returning();
    return updated;
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

  // Security - Audit Log operations (CRITICAL SECURITY FIX)
  async createAuditLog(log: InsertAuditLog): Promise<AuditLog> {
    const [created] = await db.insert(auditLog).values(log).returning();
    return created;
  }

  async getAuditLogs(userId?: string, limit: number = 100): Promise<AuditLog[]> {
    if (userId) {
      return await db.select().from(auditLog)
        .where(eq(auditLog.userId, userId))
        .orderBy(desc(auditLog.timestamp))
        .limit(limit);
    } else {
      return await db.select().from(auditLog)
        .orderBy(desc(auditLog.timestamp))
        .limit(limit);
    }
  }
  
  // WebSocket session validation (CRITICAL SECURITY FIX)
  async getSessionData(sessionId: string): Promise<{ userId: string } | null> {
    try {
      // Query the session table directly to validate session exists
      const result = await db.execute(sql`
        SELECT sess->'userId' as user_id 
        FROM session 
        WHERE sid = ${sessionId}
        AND expire > NOW()
      `);
      
      if (!result.rows || result.rows.length === 0) {
        return null;
      }
      
      const row = result.rows[0];
      if (!row || !row.user_id) {
        return null;
      }
      
      const userId = row.user_id as string;
      return userId ? { userId: userId.replace(/"/g, '') } : null;
    } catch (error) {
      console.error('[SECURITY] Session validation error:', error);
      return null;
    }
  }

  // Exchange integration methods for real money trading
  async getActiveExchangeConfigs(): Promise<any[]> {
    try {
      return await db.select().from(exchangeConfig).where(eq(exchangeConfig.isActive, true));
    } catch (error) {
      console.error('Error getting active exchange configs:', error);
      return [];
    }
  }

  async getApiKey(id: string): Promise<any | undefined> {
    try {
      const [apiKey] = await db.select().from(apiKeys).where(eq(apiKeys.id, id));
      return apiKey;
    } catch (error) {
      console.error('Error getting API key:', error);
      return undefined;
    }
  }

  async getTradingConfigByPortfolio(portfolioId: string): Promise<any | undefined> {
    try {
      // First get the portfolio to find the user
      const portfolio = await this.getPortfolio(portfolioId);
      if (!portfolio) return undefined;
      
      const [config] = await db.select().from(tradingConfig)
        .where(eq(tradingConfig.userId, portfolio.userId));
      return config;
    } catch (error) {
      console.error('Error getting trading config by portfolio:', error);
      return undefined;
    }
  }

  async createExchangeTrade(trade: any): Promise<any> {
    try {
      const [created] = await db.insert(exchangeTrades).values(trade).returning();
      return created;
    } catch (error) {
      console.error('Error creating exchange trade:', error);
      throw error;
    }
  }

  async updateExchangeHealth(exchangeName: string, status: string): Promise<void> {
    try {
      await db.update(exchangeConfig)
        .set({ 
          healthStatus: status,
          lastHealthCheck: new Date(),
          updatedAt: new Date()
        })
        .where(eq(exchangeConfig.exchangeName, exchangeName));
    } catch (error) {
      console.error('Error updating exchange health:', error);
    }
  }

  async upsertExchangeBalance(balance: any): Promise<any> {
    try {
      // Try to find existing balance
      const existing = await db.select().from(exchangeBalances)
        .where(and(
          eq(exchangeBalances.exchangeName, balance.exchangeName),
          eq(exchangeBalances.currency, balance.currency)
        ));
      
      if (existing.length > 0) {
        // Update existing
        const [updated] = await db.update(exchangeBalances)
          .set({ ...balance, lastUpdated: new Date() })
          .where(eq(exchangeBalances.id, existing[0].id))
          .returning();
        return updated;
      } else {
        // Create new
        const [created] = await db.insert(exchangeBalances).values(balance).returning();
        return created;
      }
    } catch (error) {
      console.error('Error upserting exchange balance:', error);
      throw error;
    }
  }

  async getAllExchangeBalances(): Promise<any[]> {
    try {
      return await db.select().from(exchangeBalances);
    } catch (error) {
      console.error('Error getting all exchange balances:', error);
      return [];
    }
  }

  async updateExchangeTrade(id: string, updates: any): Promise<any> {
    try {
      const [updated] = await db.update(exchangeTrades)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(exchangeTrades.id, id))
        .returning();
      return updated;
    } catch (error) {
      console.error('Error updating exchange trade:', error);
      throw error;
    }
  }

  // Price Alert operations
  async getAlertsByUser(userId: string): Promise<AlertRule[]> {
    return await db.select().from(alertRules)
      .where(eq(alertRules.userId, userId))
      .orderBy(desc(alertRules.createdAt));
  }

  async createAlertRule(data: InsertAlertRule): Promise<AlertRule> {
    const [alert] = await db.insert(alertRules).values(data).returning();
    return alert;
  }

  async updateAlertRule(id: string, data: Partial<InsertAlertRule>): Promise<AlertRule> {
    const [alert] = await db.update(alertRules)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(alertRules.id, id))
      .returning();
    return alert;
  }

  async deleteAlertRule(id: string): Promise<void> {
    await db.delete(alertRules).where(eq(alertRules.id, id));
  }

  async getActiveAlerts(): Promise<AlertRule[]> {
    return await db.select().from(alertRules)
      .where(eq(alertRules.isEnabled, true))
      .orderBy(desc(alertRules.createdAt));
  }

  async createAlertEvent(data: InsertAlertEvent): Promise<AlertEvent> {
    const [event] = await db.insert(alertEvents).values(data).returning();
    return event;
  }

  async getAlertHistory(userId: string, limit: number = 50): Promise<AlertEvent[]> {
    const userAlerts = await db.select().from(alertRules)
      .where(eq(alertRules.userId, userId));
    
    const alertIds = userAlerts.map(a => a.id);
    
    if (alertIds.length === 0) {
      return [];
    }
    
    return await db.select().from(alertEvents)
      .where(sql`${alertEvents.alertId} = ANY(${alertIds})`)
      .orderBy(desc(alertEvents.createdAt))
      .limit(limit);
  }

  async getAlertRule(id: string): Promise<AlertRule | undefined> {
    const [alert] = await db.select().from(alertRules).where(eq(alertRules.id, id));
    return alert || undefined;
  }

  // Visitor tracking operations
  async getVisitorByIp(ipAddress: string): Promise<Visitor | undefined> {
    const [visitor] = await db.select().from(visitors).where(eq(visitors.ipAddress, ipAddress));
    return visitor || undefined;
  }

  async createVisitor(data: InsertVisitor): Promise<Visitor> {
    const [visitor] = await db.insert(visitors).values(data).returning();
    return visitor;
  }

  async updateVisitorDemo(ipAddress: string, hasSeenDemo: boolean): Promise<void> {
    await db.update(visitors)
      .set({ hasSeenDemo, lastVisit: new Date() })
      .where(eq(visitors.ipAddress, ipAddress));
  }

  async updateVisitorLastVisit(ipAddress: string): Promise<void> {
    await db.update(visitors)
      .set({ 
        lastVisit: new Date(),
        visitCount: sql`${visitors.visitCount} + 1`
      })
      .where(eq(visitors.ipAddress, ipAddress));
  }
}

export const storage = new DatabaseStorage();
