import { db } from '../db';
import { aiInsights, portfolios, trades, tokens, positions } from '@shared/schema';
import { eq, and, gte, desc, sql, gt, lt, or } from 'drizzle-orm';
import { EventEmitter } from 'events';
import crypto from 'crypto';

interface AITradeSignal {
  portfolioId: string;
  tokenId: string;
  action: 'buy' | 'sell';
  price: number;
  confidence: number;
  stopLoss?: number;
  takeProfit?: number;
  positionSize: number;
  reason: string;
}

export class AITradeExecutor extends EventEmitter {
  private isRunning: boolean = false;
  private executionInterval: NodeJS.Timeout | null = null;
  private minConfidence: number = 75; // Minimum confidence for auto-execution
  private maxPositionSize: number = 0.05; // Max 5% of portfolio per trade
  private cooldownPeriod: number = 5 * 60 * 1000; // 5 minutes between trades

  constructor() {
    super();
    console.log('🤖 AI Trade Executor initialized');
  }

  start(): void {
    if (this.isRunning) return;
    
    this.isRunning = true;
    console.log('🎯 AI Trade Executor started - Monitoring AI signals');
    
    // Check for actionable AI insights every minute
    this.executionInterval = setInterval(() => {
      this.processAISignals();
    }, 60 * 1000);
    
    // Process immediately on start
    this.processAISignals();
  }

  stop(): void {
    if (!this.isRunning) return;
    
    this.isRunning = false;
    if (this.executionInterval) {
      clearInterval(this.executionInterval);
      this.executionInterval = null;
    }
    console.log('🛑 AI Trade Executor stopped');
  }

  private async processAISignals(): Promise<void> {
    try {
      // Get recent high-confidence AI insights that haven't been acted on
      const insights = await db.select()
        .from(aiInsights)
        .where(
          and(
            eq(aiInsights.status, 'new'),
            gte(aiInsights.confidence, this.minConfidence.toString()),
            or(
              eq(aiInsights.insightType, 'opportunity_alert'),
              eq(aiInsights.insightType, 'performance_summary')
            )
          )
        )
        .orderBy(desc(aiInsights.confidence))
        .limit(10);

      for (const insight of insights) {
        await this.processInsight(insight);
      }
    } catch (error) {
      console.error('❌ AI-EXECUTOR: Error processing signals:', error);
    }
  }

  private async processInsight(insight: any): Promise<void> {
    try {
      // Parse the recommendation for trading signals
      const signal = this.extractTradeSignal(insight);
      
      if (!signal) {
        return; // No actionable signal found
      }

      // Check if portfolio has AI automation enabled
      const portfolio = await db.select()
        .from(portfolios)
        .where(eq(portfolios.id, insight.portfolioId))
        .limit(1);

      if (!portfolio[0]?.aiTradingEnabled) {
        console.log(`🔒 AI-EXECUTOR: Portfolio ${insight.portfolioId} doesn't have AI trading enabled`);
        return;
      }

      // Check cooldown period
      const recentTrades = await db.select()
        .from(trades)
        .where(
          and(
            eq(trades.portfolioId, insight.portfolioId),
            gte(trades.createdAt, new Date(Date.now() - this.cooldownPeriod))
          )
        )
        .limit(1);

      if (recentTrades.length > 0) {
        console.log(`⏳ AI-EXECUTOR: Portfolio ${insight.portfolioId} in cooldown period`);
        return;
      }

      // Execute the trade
      await this.executeTrade(signal, insight);
      
      // Mark insight as acted on
      await db.update(aiInsights)
        .set({ 
          status: 'acted_on',
          actedOnAt: new Date()
        })
        .where(eq(aiInsights.id, insight.id));

    } catch (error) {
      console.error(`❌ AI-EXECUTOR: Error processing insight ${insight.id}:`, error);
    }
  }

  private extractTradeSignal(insight: any): AITradeSignal | null {
    try {
      const recommendation = insight.recommendation.toLowerCase();
      const description = insight.description.toLowerCase();
      
      // Extract token symbol from recommendation
      const tokenMatch = recommendation.match(/buy\s+(\w+)|sell\s+(\w+)/i);
      if (!tokenMatch) return null;
      
      const tokenSymbol = tokenMatch[1] || tokenMatch[2];
      const action = recommendation.includes('buy') ? 'buy' : 'sell';
      
      // Extract price ranges
      const priceMatch = recommendation.match(/\$?([\d.]+)\s*-\s*\$?([\d.]+)/);
      const targetPrice = priceMatch ? parseFloat(priceMatch[1]) : null;
      
      // Extract stop-loss and take-profit
      const stopLossMatch = recommendation.match(/stop.?loss.*?\$?([\d.]+)/i);
      const takeProfitMatch = recommendation.match(/take.?profit.*?\$?([\d.]+)/i);
      
      // Extract position size
      const sizeMatch = recommendation.match(/([\d.]+)%\s*of\s*portfolio/i);
      const positionSize = sizeMatch ? 
        Math.min(parseFloat(sizeMatch[1]) / 100, this.maxPositionSize) : 
        0.02; // Default 2%

      if (!tokenSymbol || !targetPrice) return null;

      return {
        portfolioId: insight.portfolioId,
        tokenId: '', // Will be resolved later
        action,
        price: targetPrice,
        confidence: parseFloat(insight.confidence),
        stopLoss: stopLossMatch ? parseFloat(stopLossMatch[1]) : undefined,
        takeProfit: takeProfitMatch ? parseFloat(takeProfitMatch[1]) : undefined,
        positionSize,
        reason: `AI Signal: ${insight.title}`
      };
    } catch (error) {
      console.error('❌ AI-EXECUTOR: Error extracting trade signal:', error);
      return null;
    }
  }

  private async executeTrade(signal: AITradeSignal, insight: any): Promise<void> {
    try {
      // Find token by symbol (if signal contains symbol instead of ID)
      let tokenId = signal.tokenId;
      if (!tokenId.includes('-')) {
        // It's a symbol, not an ID
        const token = await db.select()
          .from(tokens)
          .where(eq(tokens.symbol, signal.tokenId))
          .limit(1);

        if (!token[0]) {
          console.log(`❌ AI-EXECUTOR: Token not found for signal`);
          return;
        }
        tokenId = token[0].id;
      }

      signal.tokenId = tokenId;

      // Get portfolio details
      const portfolio = await db.select()
        .from(portfolios)
        .where(eq(portfolios.id, signal.portfolioId))
        .limit(1);

      if (!portfolio[0]) return;

      const portfolioValue = parseFloat(portfolio[0].totalValue);
      const tradeAmount = portfolioValue * signal.positionSize;

      if (signal.action === 'buy') {
        // Check if we already have a position
        const existingPosition = await db.select()
          .from(positions)
          .where(
            and(
              eq(positions.portfolioId, signal.portfolioId),
              eq(positions.tokenId, signal.tokenId),
              gt(positions.amount, '0')
            )
          )
          .limit(1);

        if (existingPosition[0]) {
          console.log(`📋 AI-EXECUTOR: Position already exists, skipping buy signal`);
          return;
        }

        // Create buy trade
        const quantity = tradeAmount / signal.price;
        
        const trade = await db.insert(trades).values({
          portfolioId: signal.portfolioId,
          tokenId: signal.tokenId,
          type: 'buy',
          quantity: quantity.toString(),
          price: signal.price.toString(),
          stopLoss: signal.stopLoss?.toString(),
          takeProfit: signal.takeProfit?.toString(),
          patternId: insight.id, // Link to AI insight
        }).returning();

        console.log(`✅ AI-EXECUTOR: Executed BUY trade at $${signal.price}`);
        console.log(`   Reason: ${signal.reason}`);
        console.log(`   Confidence: ${signal.confidence}%`);
        
        this.emit('trade-executed', {
          trade: trade[0],
          signal,
          insight
        });

      } else if (signal.action === 'sell') {
        // Find position to sell
        const position = await db.select()
          .from(positions)
          .where(
            and(
              eq(positions.portfolioId, signal.portfolioId),
              eq(positions.tokenId, signal.tokenId),
              gt(positions.amount, '0')
            )
          )
          .limit(1);

        if (!position[0]) {
          console.log(`❌ AI-EXECUTOR: No position to sell`);
          return;
        }

        // Create sell trade
        const trade = await db.insert(trades).values({
          portfolioId: signal.portfolioId,
          tokenId: signal.tokenId,
          type: 'sell',
          quantity: position[0].amount.toString(),
          price: signal.price.toString(),
          patternId: insight.id,
        }).returning();

        console.log(`✅ AI-EXECUTOR: Executed SELL trade at $${signal.price}`);
        console.log(`   Reason: ${signal.reason}`);
        
        this.emit('trade-executed', {
          trade: trade[0],
          signal,
          insight
        });
      }
    } catch (error) {
      console.error('❌ AI-EXECUTOR: Error executing trade:', error);
    }
  }

  // Configuration methods
  setMinConfidence(confidence: number): void {
    this.minConfidence = Math.max(50, Math.min(100, confidence));
    console.log(`🎯 AI-EXECUTOR: Min confidence set to ${this.minConfidence}%`);
  }

  setMaxPositionSize(size: number): void {
    this.maxPositionSize = Math.max(0.01, Math.min(0.1, size));
    console.log(`📊 AI-EXECUTOR: Max position size set to ${this.maxPositionSize * 100}%`);
  }

  setCooldownPeriod(minutes: number): void {
    this.cooldownPeriod = minutes * 60 * 1000;
    console.log(`⏰ AI-EXECUTOR: Cooldown period set to ${minutes} minutes`);
  }
}

// Export singleton instance
export const aiTradeExecutor = new AITradeExecutor();