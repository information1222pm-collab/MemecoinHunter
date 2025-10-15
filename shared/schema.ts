import { sql, relations } from "drizzle-orm";
import { pgTable, text, varchar, decimal, integer, timestamp, boolean, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").unique(), // Optional for OAuth users
  email: text("email").unique(), // Can be null for some OAuth providers
  password: text("password"), // Optional - only for password-based auth
  firstName: text("first_name"), // For OAuth providers
  lastName: text("last_name"), // For OAuth providers
  profileImageUrl: text("profile_image_url"), // For OAuth providers
  subscriptionTier: text("subscription_tier").default("basic"),
  language: text("language").default("en"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Session storage table for Replit Auth (OpenID Connect)
// Reference: blueprint:javascript_log_in_with_replit
export const sessions = pgTable("sessions", {
  sid: varchar("sid").primaryKey(),
  sess: jsonb("sess").notNull(),
  expire: timestamp("expire").notNull(),
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
  autoTradingEnabled: boolean("auto_trading_enabled").default(true),
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

// Encrypted API Key Storage for Real Money Trading
export const apiKeys = pgTable("api_keys", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  provider: text("provider").notNull(), // 'coinbase', 'kraken', 'binance'
  keyName: text("key_name").notNull(), // User-friendly name
  encryptedApiKey: text("encrypted_api_key").notNull(),
  encryptedApiSecret: text("encrypted_api_secret").notNull(),
  permissions: text("permissions").array(), // ['trade', 'view'] - no 'withdraw' ever
  isActive: boolean("is_active").default(true),
  lastUsed: timestamp("last_used"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Security Audit Log for Financial Compliance
export const auditLog = pgTable("audit_log", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  action: text("action").notNull(), // 'login', 'trade_executed', 'api_key_added', etc.
  resource: text("resource").notNull(), // 'user', 'trade', 'portfolio', 'api_key'
  resourceId: varchar("resource_id"),
  details: jsonb("details"), // Additional structured data
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  success: boolean("success").notNull(),
  timestamp: timestamp("timestamp").defaultNow(),
});

// Trading Risk Settings per User
export const riskSettings = pgTable("risk_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id).unique(),
  maxPositionSize: decimal("max_position_size", { precision: 20, scale: 2 }).default("500.00"),
  maxDailyLoss: decimal("max_daily_loss", { precision: 20, scale: 2 }).default("1000.00"),
  maxWeeklyLoss: decimal("max_weekly_loss", { precision: 20, scale: 2 }).default("5000.00"),
  enableStopLoss: boolean("enable_stop_loss").default(true),
  stopLossPercent: decimal("stop_loss_percent", { precision: 5, scale: 2 }).default("10.00"),
  requireManualApproval: boolean("require_manual_approval").default(false),
  tradingEnabled: boolean("trading_enabled").default(false), // Must be explicitly enabled
  lastUpdated: timestamp("last_updated").defaultNow(),
});

// Price Alert Rules
export const alertRules = pgTable("alert_rules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  tokenId: varchar("token_id").notNull().references(() => tokens.id),
  conditionType: text("condition_type").notNull(), // 'price_above', 'price_below', 'percent_change_up', 'percent_change_down'
  thresholdValue: decimal("threshold_value", { precision: 20, scale: 8 }).notNull(),
  percentWindow: decimal("percent_window", { precision: 5, scale: 2 }), // For percent change alerts
  comparisonWindow: text("comparison_window"), // '1h', '24h', '7d' for percent change
  isEnabled: boolean("is_enabled").default(true),
  lastTriggeredAt: timestamp("last_triggered_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Alert Events (history of triggered alerts)
export const alertEvents = pgTable("alert_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  alertId: varchar("alert_id").notNull().references(() => alertRules.id),
  triggeredPrice: decimal("triggered_price", { precision: 20, scale: 8 }).notNull(),
  triggeredPercent: decimal("triggered_percent", { precision: 8, scale: 4 }),
  payload: jsonb("payload"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Visitor Tracking for IP-based Demo
export const visitors = pgTable("visitors", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ipAddress: text("ip_address").notNull().unique(),
  hasSeenDemo: boolean("has_seen_demo").default(false),
  firstVisit: timestamp("first_visit").defaultNow(),
  lastVisit: timestamp("last_visit").defaultNow(),
  visitCount: integer("visit_count").default(1),
  userAgent: text("user_agent"),
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

export const apiKeysRelations = relations(apiKeys, ({ one }) => ({
  user: one(users, { fields: [apiKeys.userId], references: [users.id] }),
}));

export const auditLogRelations = relations(auditLog, ({ one }) => ({
  user: one(users, { fields: [auditLog.userId], references: [users.id] }),
}));

export const riskSettingsRelations = relations(riskSettings, ({ one }) => ({
  user: one(users, { fields: [riskSettings.userId], references: [users.id] }),
}));

export const alertRulesRelations = relations(alertRules, ({ one, many }) => ({
  user: one(users, { fields: [alertRules.userId], references: [users.id] }),
  token: one(tokens, { fields: [alertRules.tokenId], references: [tokens.id] }),
  events: many(alertEvents),
}));

export const alertEventsRelations = relations(alertEvents, ({ one }) => ({
  alert: one(alertRules, { fields: [alertEvents.alertId], references: [alertRules.id] }),
}));

// Insert schemas
// For password-based registration
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// For OAuth user upsert (Replit Auth)
// Reference: blueprint:javascript_log_in_with_replit
export const upsertUserSchema = z.object({
  id: z.string(),
  email: z.string().email().nullable(),
  firstName: z.string().nullable(),
  lastName: z.string().nullable(),
  profileImageUrl: z.string().nullable(),
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

export const insertApiKeySchema = createInsertSchema(apiKeys).omit({
  id: true,
  createdAt: true,
  lastUsed: true,
});

export const insertAuditLogSchema = createInsertSchema(auditLog).omit({
  id: true,
  timestamp: true,
});

export const insertRiskSettingsSchema = createInsertSchema(riskSettings).omit({
  id: true,
  lastUpdated: true,
});

export const insertAlertRuleSchema = createInsertSchema(alertRules).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  lastTriggeredAt: true,
}).extend({
  // Ensure numeric fields are properly coerced and validated (CRITICAL SECURITY FIX)
  thresholdValue: z.coerce.number().positive({ message: "Threshold value must be a positive number" }),
  percentWindow: z.coerce.number().positive({ message: "Percent window must be a positive number" }).optional().nullable(),
  // Ensure required string fields are not empty
  userId: z.string().min(1, { message: "User ID is required" }),
  tokenId: z.string().min(1, { message: "Token ID is required" }),
  conditionType: z.enum(['price_above', 'price_below', 'percent_change_up', 'percent_change_down'], {
    errorMap: () => ({ message: "Invalid condition type" })
  }),
  comparisonWindow: z.string().optional().nullable(),
  isEnabled: z.boolean().optional(),
});

export const insertAlertEventSchema = createInsertSchema(alertEvents).omit({
  id: true,
  createdAt: true,
});

export const insertVisitorSchema = createInsertSchema(visitors).omit({
  id: true,
  firstVisit: true,
  lastVisit: true,
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

// Exchange configuration and API management
export const exchangeConfig = pgTable("exchange_config", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  exchangeName: text("exchange_name").notNull(), // 'binance', 'kraken', 'coinbase'
  isActive: boolean("is_active").default(true),
  apiKeyId: varchar("api_key_id").references(() => apiKeys.id), // Reference to encrypted API key
  testMode: boolean("test_mode").default(true), // Use testnet/sandbox
  maxDailyVolume: decimal("max_daily_volume", { precision: 20, scale: 8 }),
  tradingPairs: text("trading_pairs").array(), // Supported trading pairs
  lastHealthCheck: timestamp("last_health_check"),
  healthStatus: text("health_status").default("unknown"), // 'healthy', 'degraded', 'down'
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Exchange trade execution log for real money trading
export const exchangeTrades = pgTable("exchange_trades", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tradeId: varchar("trade_id").notNull().references(() => trades.id), // References trades table
  exchangeName: text("exchange_name").notNull(),
  exchangeOrderId: text("exchange_order_id"), // Exchange's order ID
  status: text("status").notNull().default("pending"), // 'pending', 'filled', 'cancelled', 'failed'
  requestedPrice: decimal("requested_price", { precision: 20, scale: 8 }),
  executedPrice: decimal("executed_price", { precision: 20, scale: 8 }),
  requestedAmount: decimal("requested_amount", { precision: 20, scale: 8 }),
  executedAmount: decimal("executed_amount", { precision: 20, scale: 8 }),
  fees: decimal("fees", { precision: 20, scale: 8 }),
  feeCurrency: text("fee_currency"),
  executionTime: timestamp("execution_time"),
  errorMessage: text("error_message"),
  retryCount: integer("retry_count").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Exchange balance tracking for real money accounts
export const exchangeBalances = pgTable("exchange_balances", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  exchangeName: text("exchange_name").notNull(),
  currency: text("currency").notNull(), // 'USDT', 'BTC', 'ETH', etc.
  available: decimal("available", { precision: 20, scale: 8 }).default("0"),
  locked: decimal("locked", { precision: 20, scale: 8 }).default("0"),
  total: decimal("total", { precision: 20, scale: 8 }).default("0"),
  lastSyncTime: timestamp("last_sync_time").defaultNow(),
  syncStatus: text("sync_status").default("synced"), // 'synced', 'syncing', 'error'
  lastUpdated: timestamp("last_updated").defaultNow(),
});

// Trading mode configuration per user (paper vs real money)
export const tradingConfig = pgTable("trading_config", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id).unique(),
  tradingMode: text("trading_mode").notNull().default("paper"), // 'paper', 'real'
  primaryExchange: text("primary_exchange"), // 'binance', 'kraken', 'coinbase'
  enabledExchanges: text("enabled_exchanges").array().default(sql`'{}'::text[]`),
  autoTradingEnabled: boolean("auto_trading_enabled").default(false),
  realMoneyConfirmed: boolean("real_money_confirmed").default(false), // Explicit confirmation for real trading
  lastModeSwitch: timestamp("last_mode_switch").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type UpsertUser = z.infer<typeof upsertUserSchema>; // For OAuth users

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

// Exchange integration types
export type ExchangeConfig = typeof exchangeConfig.$inferSelect;
export type InsertExchangeConfig = typeof exchangeConfig.$inferInsert;

export type ExchangeTrade = typeof exchangeTrades.$inferSelect;
export type InsertExchangeTrade = typeof exchangeTrades.$inferInsert;

export type ExchangeBalance = typeof exchangeBalances.$inferSelect;
export type InsertExchangeBalance = typeof exchangeBalances.$inferInsert;

export type TradingConfig = typeof tradingConfig.$inferSelect;
export type InsertTradingConfig = typeof tradingConfig.$inferInsert;

export type AlertRule = typeof alertRules.$inferSelect;
export type InsertAlertRule = z.infer<typeof insertAlertRuleSchema>;

export type AlertEvent = typeof alertEvents.$inferSelect;
export type InsertAlertEvent = z.infer<typeof insertAlertEventSchema>;

export type Visitor = typeof visitors.$inferSelect;
export type InsertVisitor = z.infer<typeof insertVisitorSchema>;
