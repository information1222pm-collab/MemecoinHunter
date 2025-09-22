import { sql, relations } from "drizzle-orm";
import { pgTable, text, varchar, decimal, integer, timestamp, boolean, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  subscriptionTier: text("subscription_tier").default("basic"),
  language: text("language").default("en"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const tokens = pgTable("tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  symbol: text("symbol").notNull(),
  name: text("name").notNull(),
  contractAddress: text("contract_address"),
  currentPrice: decimal("current_price", { precision: 20, scale: 8 }),
  marketCap: decimal("market_cap", { precision: 20, scale: 2 }),
  volume24h: decimal("volume_24h", { precision: 20, scale: 2 }),
  priceChange24h: decimal("price_change_24h", { precision: 8, scale: 4 }),
  isActive: boolean("is_active").default(true),
  lastUpdated: timestamp("last_updated").defaultNow(),
});

export const portfolios = pgTable("portfolios", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  totalValue: decimal("total_value", { precision: 20, scale: 2 }).default("0"),
  startingCapital: decimal("starting_capital", { precision: 20, scale: 2 }).default("10000.00"),
  cashBalance: decimal("cash_balance", { precision: 20, scale: 2 }).default("10000.00"),
  realizedPnL: decimal("realized_pnl", { precision: 20, scale: 2 }).default("0"),
  dailyPnL: decimal("daily_pnl", { precision: 20, scale: 2 }).default("0"),
  totalPnL: decimal("total_pnl", { precision: 20, scale: 2 }).default("0"),
  winRate: decimal("win_rate", { precision: 5, scale: 2 }).default("0"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const trades = pgTable("trades", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  portfolioId: varchar("portfolio_id").notNull().references(() => portfolios.id),
  tokenId: varchar("token_id").notNull().references(() => tokens.id),
  patternId: varchar("pattern_id").references(() => patterns.id), // Link to originating pattern
  type: text("type").notNull(), // 'buy' or 'sell'
  amount: decimal("amount", { precision: 20, scale: 8 }).notNull(),
  price: decimal("price", { precision: 20, scale: 8 }).notNull(),
  totalValue: decimal("total_value", { precision: 20, scale: 2 }).notNull(),
  exitPrice: decimal("exit_price", { precision: 20, scale: 8 }), // Price when position was closed
  realizedPnL: decimal("realized_pnl", { precision: 20, scale: 2 }), // Actual profit/loss
  status: text("status").default("completed"), // 'pending', 'completed', 'cancelled'
  createdAt: timestamp("created_at").defaultNow(),
  closedAt: timestamp("closed_at"), // When trade was closed
});

export const positions = pgTable("positions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  portfolioId: varchar("portfolio_id").notNull().references(() => portfolios.id),
  tokenId: varchar("token_id").notNull().references(() => tokens.id),
  amount: decimal("amount", { precision: 20, scale: 8 }).notNull(),
  avgBuyPrice: decimal("avg_buy_price", { precision: 20, scale: 8 }).notNull(),
  currentValue: decimal("current_value", { precision: 20, scale: 2 }),
  unrealizedPnL: decimal("unrealized_pnl", { precision: 20, scale: 2 }),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const scanAlerts = pgTable("scan_alerts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tokenId: varchar("token_id").notNull().references(() => tokens.id),
  alertType: text("alert_type").notNull(), // 'price_spike', 'volume_surge', 'pattern_detected'
  message: text("message").notNull(),
  confidence: integer("confidence"), // 0-100
  isRead: boolean("is_read").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const priceHistory = pgTable("price_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tokenId: varchar("token_id").notNull().references(() => tokens.id),
  price: decimal("price", { precision: 20, scale: 8 }).notNull(),
  volume: decimal("volume", { precision: 20, scale: 2 }),
  timestamp: timestamp("timestamp").defaultNow(),
});

export const patterns = pgTable("patterns", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tokenId: varchar("token_id").notNull().references(() => tokens.id),
  patternType: text("pattern_type").notNull(), // 'bull_flag', 'double_bottom', 'volume_spike', etc.
  confidence: decimal("confidence", { precision: 5, scale: 2 }).notNull(), // 0.00-100.00
  adjustedConfidence: decimal("adjusted_confidence", { precision: 5, scale: 2 }), // ML-adjusted confidence
  timeframe: text("timeframe").notNull(), // '1h', '4h', '1d', '1w'
  metadata: jsonb("metadata"), // Additional pattern data
  detectedAt: timestamp("detected_at").defaultNow(),
});

export const subscriptions = pgTable("subscriptions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  plan: text("plan").notNull(), // 'basic', 'pro', 'enterprise'
  status: text("status").default("active"), // 'active', 'cancelled', 'expired'
  currentPeriodStart: timestamp("current_period_start").notNull(),
  currentPeriodEnd: timestamp("current_period_end").notNull(),
  cancelAtPeriodEnd: boolean("cancel_at_period_end").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

// Pattern Performance Tracking
export const patternPerformance = pgTable("pattern_performance", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  patternType: text("pattern_type").notNull(),
  timeframe: text("timeframe").notNull(),
  totalTrades: integer("total_trades").default(0),
  successfulTrades: integer("successful_trades").default(0),
  totalProfit: decimal("total_profit", { precision: 20, scale: 2 }).default("0"),
  averageReturn: decimal("average_return", { precision: 8, scale: 4 }).default("0"),
  winRate: decimal("win_rate", { precision: 5, scale: 2 }).default("0"),
  confidenceMultiplier: decimal("confidence_multiplier", { precision: 5, scale: 4 }).default("1.0"),
  lastUpdated: timestamp("last_updated").defaultNow(),
});

// ML Learning Parameters
export const mlLearningParams = pgTable("ml_learning_params", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  paramKey: text("param_key").notNull().unique(),
  paramValue: text("param_value").notNull(),
  paramType: text("param_type").notNull(), // 'threshold', 'multiplier', 'weight'
  description: text("description"),
  lastUpdated: timestamp("last_updated").defaultNow(),
});

// Relations
export const usersRelations = relations(users, ({ one, many }) => ({
  portfolio: one(portfolios),
  subscription: one(subscriptions),
}));

export const portfoliosRelations = relations(portfolios, ({ one, many }) => ({
  user: one(users, { fields: [portfolios.userId], references: [users.id] }),
  trades: many(trades),
  positions: many(positions),
}));

export const tokensRelations = relations(tokens, ({ many }) => ({
  trades: many(trades),
  positions: many(positions),
  alerts: many(scanAlerts),
  priceHistory: many(priceHistory),
  patterns: many(patterns),
}));

export const tradesRelations = relations(trades, ({ one }) => ({
  portfolio: one(portfolios, { fields: [trades.portfolioId], references: [portfolios.id] }),
  token: one(tokens, { fields: [trades.tokenId], references: [tokens.id] }),
  pattern: one(patterns, { fields: [trades.patternId], references: [patterns.id] }),
}));

export const positionsRelations = relations(positions, ({ one }) => ({
  portfolio: one(portfolios, { fields: [positions.portfolioId], references: [portfolios.id] }),
  token: one(tokens, { fields: [positions.tokenId], references: [tokens.id] }),
}));

export const scanAlertsRelations = relations(scanAlerts, ({ one }) => ({
  token: one(tokens, { fields: [scanAlerts.tokenId], references: [tokens.id] }),
}));

export const priceHistoryRelations = relations(priceHistory, ({ one }) => ({
  token: one(tokens, { fields: [priceHistory.tokenId], references: [tokens.id] }),
}));

export const patternsRelations = relations(patterns, ({ one, many }) => ({
  token: one(tokens, { fields: [patterns.tokenId], references: [tokens.id] }),
  trades: many(trades),
}));

export const subscriptionsRelations = relations(subscriptions, ({ one }) => ({
  user: one(users, { fields: [subscriptions.userId], references: [users.id] }),
}));

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
});

export const insertTokenSchema = createInsertSchema(tokens).omit({
  id: true,
  lastUpdated: true,
});

export const insertPortfolioSchema = createInsertSchema(portfolios).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertTradeSchema = createInsertSchema(trades).omit({
  id: true,
  createdAt: true,
});

export const insertPatternPerformanceSchema = createInsertSchema(patternPerformance).omit({
  id: true,
  lastUpdated: true,
});

export const insertMLLearningParamsSchema = createInsertSchema(mlLearningParams).omit({
  id: true,
  lastUpdated: true,
});

export const insertPositionSchema = createInsertSchema(positions).omit({
  id: true,
  updatedAt: true,
});

export const insertScanAlertSchema = createInsertSchema(scanAlerts).omit({
  id: true,
  createdAt: true,
});

export const insertPriceHistorySchema = createInsertSchema(priceHistory).omit({
  id: true,
  timestamp: true,
});

export const insertPatternSchema = createInsertSchema(patterns).omit({
  id: true,
  detectedAt: true,
});

export const insertSubscriptionSchema = createInsertSchema(subscriptions).omit({
  id: true,
  createdAt: true,
});

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Token = typeof tokens.$inferSelect;
export type InsertToken = z.infer<typeof insertTokenSchema>;

export type Portfolio = typeof portfolios.$inferSelect;
export type InsertPortfolio = z.infer<typeof insertPortfolioSchema>;

export type Trade = typeof trades.$inferSelect;
export type InsertTrade = z.infer<typeof insertTradeSchema>;

export type Position = typeof positions.$inferSelect;
export type InsertPosition = z.infer<typeof insertPositionSchema>;

export type ScanAlert = typeof scanAlerts.$inferSelect;
export type InsertScanAlert = z.infer<typeof insertScanAlertSchema>;

export type PriceHistory = typeof priceHistory.$inferSelect;
export type InsertPriceHistory = z.infer<typeof insertPriceHistorySchema>;

export type Pattern = typeof patterns.$inferSelect;
export type InsertPattern = z.infer<typeof insertPatternSchema>;

export type Subscription = typeof subscriptions.$inferSelect;
export type InsertSubscription = z.infer<typeof insertSubscriptionSchema>;

export type PatternPerformance = typeof patternPerformance.$inferSelect;
export type InsertPatternPerformance = z.infer<typeof insertPatternPerformanceSchema>;

export type MLLearningParams = typeof mlLearningParams.$inferSelect;
export type InsertMLLearningParams = z.infer<typeof insertMLLearningParamsSchema>;
