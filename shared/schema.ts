import { sql, relations } from "drizzle-orm";
import { pgTable, text, varchar, decimal, integer, timestamp, boolean, jsonb, index } from "drizzle-orm/pg-core";
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
}, (table) => ({
  symbolIdx: index("tokens_symbol_idx").on(table.symbol),
  isActiveIdx: index("tokens_is_active_idx").on(table.isActive),
}));

export const portfolios = pgTable("portfolios", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  totalValue: decimal("total_value", { precision: 20, scale: 2 }).default("10000.00"),
  startingCapital: decimal("starting_capital", { precision: 20, scale: 2 }).default("10000.00"),
  cashBalance: decimal("cash_balance", { precision: 20, scale: 2 }).default("10000.00"),
  realizedPnL: decimal("realized_pnl", { precision: 20, scale: 2 }).default("0"),
  dailyPnL: decimal("daily_pnl", { precision: 20, scale: 2 }).default("0"),
  totalPnL: decimal("total_pnl", { precision: 20, scale: 2 }).default("0"),
  winRate: decimal("win_rate", { precision: 5, scale: 2 }).default("0"),
  autoTradingEnabled: boolean("auto_trading_enabled").default(true),
  riskLevel: text("risk_level").default("balanced"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  userIdIdx: index("portfolios_user_id_idx").on(table.userId),
  autoTradingEnabledIdx: index("portfolios_auto_trading_enabled_idx").on(table.autoTradingEnabled),
}));

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
}, (table) => ({
  portfolioIdIdx: index("trades_portfolio_id_idx").on(table.portfolioId),
  tokenIdIdx: index("trades_token_id_idx").on(table.tokenId),
  patternIdIdx: index("trades_pattern_id_idx").on(table.patternId),
  statusIdx: index("trades_status_idx").on(table.status),
  createdAtIdx: index("trades_created_at_idx").on(table.createdAt),
}));

export const positions = pgTable("positions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  portfolioId: varchar("portfolio_id").notNull().references(() => portfolios.id),
  tokenId: varchar("token_id").notNull().references(() => tokens.id),
  amount: decimal("amount", { precision: 20, scale: 8 }).notNull(),
  avgBuyPrice: decimal("avg_buy_price", { precision: 20, scale: 8 }).notNull(),
  currentValue: decimal("current_value", { precision: 20, scale: 2 }),
  unrealizedPnL: decimal("unrealized_pnl", { precision: 20, scale: 2 }),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  portfolioIdIdx: index("positions_portfolio_id_idx").on(table.portfolioId),
  tokenIdIdx: index("positions_token_id_idx").on(table.tokenId),
}));

export const scanAlerts = pgTable("scan_alerts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tokenId: varchar("token_id").notNull().references(() => tokens.id),
  alertType: text("alert_type").notNull(), // 'price_spike', 'volume_surge', 'pattern_detected'
  message: text("message").notNull(),
  confidence: integer("confidence"), // 0-100
  isRead: boolean("is_read").default(false),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  tokenIdIdx: index("scan_alerts_token_id_idx").on(table.tokenId),
  isReadIdx: index("scan_alerts_is_read_idx").on(table.isRead),
  createdAtIdx: index("scan_alerts_created_at_idx").on(table.createdAt),
}));

export const priceHistory = pgTable("price_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tokenId: varchar("token_id").notNull().references(() => tokens.id),
  price: decimal("price", { precision: 20, scale: 8 }).notNull(),
  volume: decimal("volume", { precision: 20, scale: 2 }),
  timestamp: timestamp("timestamp").defaultNow(),
}, (table) => ({
  tokenIdIdx: index("price_history_token_id_idx").on(table.tokenId),
  timestampIdx: index("price_history_timestamp_idx").on(table.timestamp),
  tokenTimestampIdx: index("price_history_token_timestamp_idx").on(table.tokenId, table.timestamp),
}));

export const patterns = pgTable("patterns", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tokenId: varchar("token_id").notNull().references(() => tokens.id),
  patternType: text("pattern_type").notNull(), // 'bull_flag', 'double_bottom', 'volume_spike', etc.
  confidence: decimal("confidence", { precision: 5, scale: 2 }).notNull(), // 0.00-100.00
  adjustedConfidence: decimal("adjusted_confidence", { precision: 5, scale: 2 }), // ML-adjusted confidence
  timeframe: text("timeframe").notNull(), // '1h', '4h', '1d', '1w'
  metadata: jsonb("metadata"), // Additional pattern data
  detectedAt: timestamp("detected_at").defaultNow(),
}, (table) => ({
  tokenIdIdx: index("patterns_token_id_idx").on(table.tokenId),
  patternTypeIdx: index("patterns_pattern_type_idx").on(table.patternType),
  detectedAtIdx: index("patterns_detected_at_idx").on(table.detectedAt),
}));

export const subscriptions = pgTable("subscriptions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  plan: text("plan").notNull(), // 'basic', 'pro', 'enterprise'
  status: text("status").default("active"), // 'active', 'cancelled', 'expired'
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  stripePriceId: text("stripe_price_id"),
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
}, (table) => ({
  userIdIdx: index("audit_log_user_id_idx").on(table.userId),
  actionIdx: index("audit_log_action_idx").on(table.action),
  timestampIdx: index("audit_log_timestamp_idx").on(table.timestamp),
}));

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
}, (table) => ({
  userIdIdx: index("alert_rules_user_id_idx").on(table.userId),
  tokenIdIdx: index("alert_rules_token_id_idx").on(table.tokenId),
  isEnabledIdx: index("alert_rules_is_enabled_idx").on(table.isEnabled),
}));

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

// Early-Launch Coin Detection System Tables
// Track newly detected coins (≤5 minutes on market)
export const launchCoins = pgTable("launch_coins", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tokenId: varchar("token_id").notNull().references(() => tokens.id),
  detectedAt: timestamp("detected_at").defaultNow(), // When we first detected this coin
  launchPrice: decimal("launch_price", { precision: 20, scale: 8 }).notNull(),
  initialMarketCap: decimal("initial_market_cap", { precision: 20, scale: 2 }),
  initialVolume: decimal("initial_volume", { precision: 20, scale: 2 }),
  minutesOnMarket: integer("minutes_on_market"), // Estimated age when detected
  status: text("status").default("monitoring"), // 'monitoring', 'success', 'failure', 'expired'
  outcomePrice: decimal("outcome_price", { precision: 20, scale: 8 }), // Price after 1 hour
  priceChange1h: decimal("price_change_1h", { precision: 8, scale: 4 }), // % change after 1 hour
  evaluatedAt: timestamp("evaluated_at"), // When we evaluated success/failure
}, (table) => ({
  tokenIdIdx: index("launch_coins_token_id_idx").on(table.tokenId),
  statusIdx: index("launch_coins_status_idx").on(table.status),
  detectedAtIdx: index("launch_coins_detected_at_idx").on(table.detectedAt),
}));

// Detailed analysis of successful and failed launches
export const launchAnalysis = pgTable("launch_analysis", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  launchCoinId: varchar("launch_coin_id").notNull().references(() => launchCoins.id),
  outcomeType: text("outcome_type").notNull(), // 'success', 'failure'
  // Success indicators
  maxPriceReached: decimal("max_price_reached", { precision: 20, scale: 8 }),
  maxGainPercent: decimal("max_gain_percent", { precision: 8, scale: 4 }),
  timeToMaxGain: integer("time_to_max_gain"), // Minutes to reach max gain
  volumePattern: text("volume_pattern"), // 'increasing', 'decreasing', 'stable', 'spike'
  priceVolatility: decimal("price_volatility", { precision: 8, scale: 4 }),
  // Technical indicators at launch
  initialMomentum: decimal("initial_momentum", { precision: 8, scale: 4 }),
  volumeVsMarketCap: decimal("volume_vs_market_cap", { precision: 8, scale: 4 }),
  // Pattern insights
  identifiedPatterns: text("identified_patterns").array(), // Patterns detected
  successFactors: jsonb("success_factors"), // Key factors contributing to success/failure
  rejectionCriteria: jsonb("rejection_criteria"), // Criteria that should reject similar launches
  analysisComplete: boolean("analysis_complete").default(false),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  launchCoinIdIdx: index("launch_analysis_launch_coin_id_idx").on(table.launchCoinId),
  outcomeTypeIdx: index("launch_analysis_outcome_type_idx").on(table.outcomeType),
}));

// Experimental strategies for launch trading
export const launchStrategies = pgTable("launch_strategies", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  strategyName: text("strategy_name").notNull().unique(),
  description: text("description"),
  isActive: boolean("is_active").default(true),
  // Entry criteria
  minMarketCap: decimal("min_market_cap", { precision: 20, scale: 2 }),
  maxMarketCap: decimal("max_market_cap", { precision: 20, scale: 2 }),
  minVolume: decimal("min_volume", { precision: 20, scale: 2 }),
  requiredPatterns: text("required_patterns").array(), // Patterns that must be present
  rejectionPatterns: text("rejection_patterns").array(), // Patterns that disqualify
  minMomentum: decimal("min_momentum", { precision: 8, scale: 4 }),
  // Position sizing
  entryPercent: decimal("entry_percent", { precision: 5, scale: 2 }).default("2.00"), // % of portfolio
  maxPositionSize: decimal("max_position_size", { precision: 20, scale: 2 }).default("500.00"),
  // Exit strategy
  takeProfitPercent: decimal("take_profit_percent", { precision: 8, scale: 4 }).default("100.00"), // 100% gain target
  stopLossPercent: decimal("stop_loss_percent", { precision: 8, scale: 4 }).default("20.00"),
  timeoutMinutes: integer("timeout_minutes").default(60), // Exit after X minutes if no profit
  // Risk management
  maxDailyTrades: integer("max_daily_trades").default(5),
  cooldownMinutes: integer("cooldown_minutes").default(30), // Wait between trades
  requireConfidence: decimal("require_confidence", { precision: 5, scale: 2 }).default("70.00"),
  // Strategy parameters as JSON for flexibility
  customParams: jsonb("custom_params"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  isActiveIdx: index("launch_strategies_is_active_idx").on(table.isActive),
}));

// Performance tracking for each strategy
export const launchPerformance = pgTable("launch_performance", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  strategyId: varchar("strategy_id").notNull().references(() => launchStrategies.id),
  // Overall metrics
  totalTrades: integer("total_trades").default(0),
  successfulTrades: integer("successful_trades").default(0),
  failedTrades: integer("failed_trades").default(0),
  winRate: decimal("win_rate", { precision: 5, scale: 2 }).default("0"), // %
  avgProfitPerTrade: decimal("avg_profit_per_trade", { precision: 8, scale: 4 }).default("0"), // %
  totalProfitLoss: decimal("total_profit_loss", { precision: 20, scale: 2 }).default("0"),
  maxDrawdown: decimal("max_drawdown", { precision: 20, scale: 2 }).default("0"),
  // Performance thresholds
  meetsWinRateThreshold: boolean("meets_win_rate_threshold").default(false), // ≥65%
  meetsProfitThreshold: boolean("meets_profit_threshold").default(false), // ≥50% per trade
  isReadyForLive: boolean("is_ready_for_live").default(false), // Both thresholds met
  // Time tracking
  firstTradeAt: timestamp("first_trade_at"),
  lastTradeAt: timestamp("last_trade_at"),
  lastUpdated: timestamp("last_updated").defaultNow(),
}, (table) => ({
  strategyIdIdx: index("launch_performance_strategy_id_idx").on(table.strategyId),
  isReadyForLiveIdx: index("launch_performance_is_ready_for_live_idx").on(table.isReadyForLive),
}));

// Link portfolios to launch trading strategies
export const portfolioLaunchConfig = pgTable("portfolio_launch_config", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  portfolioId: varchar("portfolio_id").notNull().references(() => portfolios.id).unique(),
  launchTradingEnabled: boolean("launch_trading_enabled").default(false),
  activeStrategyId: varchar("active_strategy_id").references(() => launchStrategies.id),
  maxAllocationPercent: decimal("max_allocation_percent", { precision: 5, scale: 2 }).default("10.00"), // Max % of portfolio for launch trades
  lastUpdated: timestamp("last_updated").defaultNow(),
}, (table) => ({
  portfolioIdIdx: index("portfolio_launch_config_portfolio_id_idx").on(table.portfolioId),
  launchTradingEnabledIdx: index("portfolio_launch_config_enabled_idx").on(table.launchTradingEnabled),
}));

// AI-Powered Insights - ML-driven trading recommendations
export const aiInsights = pgTable("ai_insights", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  portfolioId: varchar("portfolio_id").notNull().references(() => portfolios.id),
  insightType: text("insight_type").notNull(), // 'pattern_analysis', 'risk_assessment', 'opportunity_alert', 'performance_summary', 'market_trend'
  title: text("title").notNull(),
  description: text("description").notNull(),
  recommendation: text("recommendation").notNull(), // AI-generated action recommendation
  confidence: decimal("confidence", { precision: 5, scale: 2 }).notNull(), // 0-100 confidence score
  priority: text("priority").default("medium"), // 'low', 'medium', 'high', 'critical'
  supportingData: jsonb("supporting_data"), // Metrics, charts data, etc.
  status: text("status").default("new"), // 'new', 'viewed', 'acted_on', 'dismissed'
  expiresAt: timestamp("expires_at"), // When insight becomes stale
  createdAt: timestamp("created_at").defaultNow(),
  viewedAt: timestamp("viewed_at"),
  actedOnAt: timestamp("acted_on_at"),
}, (table) => ({
  portfolioIdIdx: index("ai_insights_portfolio_id_idx").on(table.portfolioId),
  insightTypeIdx: index("ai_insights_type_idx").on(table.insightType),
  statusIdx: index("ai_insights_status_idx").on(table.status),
  priorityIdx: index("ai_insights_priority_idx").on(table.priority),
  createdAtIdx: index("ai_insights_created_at_idx").on(table.createdAt),
}));

// Insert schemas for launch system
export const insertLaunchCoinSchema = createInsertSchema(launchCoins).omit({
  id: true,
  detectedAt: true,
});

export const insertLaunchAnalysisSchema = createInsertSchema(launchAnalysis).omit({
  id: true,
  createdAt: true,
});

export const insertLaunchStrategySchema = createInsertSchema(launchStrategies).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertLaunchPerformanceSchema = createInsertSchema(launchPerformance).omit({
  id: true,
  lastUpdated: true,
});

export const insertPortfolioLaunchConfigSchema = createInsertSchema(portfolioLaunchConfig).omit({
  id: true,
  lastUpdated: true,
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

// Launch system types
export type LaunchCoin = typeof launchCoins.$inferSelect;
export type InsertLaunchCoin = z.infer<typeof insertLaunchCoinSchema>;

export type LaunchAnalysis = typeof launchAnalysis.$inferSelect;
export type InsertLaunchAnalysis = z.infer<typeof insertLaunchAnalysisSchema>;

export type LaunchStrategy = typeof launchStrategies.$inferSelect;
export type InsertLaunchStrategy = z.infer<typeof insertLaunchStrategySchema>;

export type LaunchPerformance = typeof launchPerformance.$inferSelect;
export type InsertLaunchPerformance = z.infer<typeof insertLaunchPerformanceSchema>;

export type PortfolioLaunchConfig = typeof portfolioLaunchConfig.$inferSelect;
export type InsertPortfolioLaunchConfig = z.infer<typeof insertPortfolioLaunchConfigSchema>;

// AI Insights insert schema
export const insertAIInsightSchema = createInsertSchema(aiInsights).omit({
  id: true,
  createdAt: true,
  viewedAt: true,
  actedOnAt: true,
});

export type AIInsight = typeof aiInsights.$inferSelect;
export type InsertAIInsight = z.infer<typeof insertAIInsightSchema>;
