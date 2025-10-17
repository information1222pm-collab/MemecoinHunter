import { db } from '../db';
import { trades, patterns, portfolios, tokens, priceHistory } from '@shared/schema';
import { eq, and, gte, lte, desc, sql, inArray } from 'drizzle-orm';
import { EventEmitter } from 'events';

interface BacktestParameters {
  portfolioId?: string;
  startDate: Date;
  endDate: Date;
  initialCapital: number;
  strategies: string[];
  stopLoss?: number;
  takeProfit?: number;
  maxPositions?: number;
  positionSize?: number;
}

interface BacktestResult {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  totalPnL: number;
  maxDrawdown: number;
  sharpeRatio: number;
  profitFactor: number;
  avgWin: number;
  avgLoss: number;
  bestTrade: TradeResult | null;
  worstTrade: TradeResult | null;
  equityCurve: EquityPoint[];
  tradeResults: TradeResult[];
  strategyPerformance: Map<string, StrategyMetrics>;
}

interface TradeResult {
  tokenSymbol: string;
  entryPrice: number;
  exitPrice: number;
  quantity: number;
  pnl: number;
  pnlPercent: number;
  entryDate: Date;
  exitDate: Date;
  strategy: string;
  holdTime: number;
}

interface EquityPoint {
  date: Date;
  equity: number;
  drawdown: number;
  openPositions: number;
}

interface StrategyMetrics {
  trades: number;
  winRate: number;
  avgReturn: number;
  sharpeRatio: number;
  maxDrawdown: number;
}

export class BacktestingEngine extends EventEmitter {
  private isRunning: boolean = false;
  private currentBacktest: BacktestParameters | null = null;
  private progress: number = 0;

  constructor() {
    super();
    console.log('📊 Backtesting Engine initialized');
  }

  async runBacktest(params: BacktestParameters): Promise<BacktestResult> {
    this.isRunning = true;
    this.currentBacktest = params;
    this.progress = 0;

    console.log('🔄 Starting backtest...');
    console.log(`   Period: ${params.startDate.toISOString()} to ${params.endDate.toISOString()}`);
    console.log(`   Strategies: ${params.strategies.join(', ')}`);
    console.log(`   Initial Capital: $${params.initialCapital}`);

    try {
      // Get historical patterns for the specified strategies
      const historicalPatterns = await this.getHistoricalPatterns(params);
      
      // Simulate trades based on patterns
      const tradeResults = await this.simulateTrades(historicalPatterns, params);
      
      // Calculate performance metrics
      const metrics = this.calculateMetrics(tradeResults, params);
      
      // Generate equity curve
      const equityCurve = this.generateEquityCurve(tradeResults, params);
      
      // Calculate strategy-specific performance
      const strategyPerformance = this.analyzeStrategyPerformance(tradeResults);

      const result: BacktestResult = {
        ...metrics,
        equityCurve,
        tradeResults,
        strategyPerformance,
        bestTrade: tradeResults.reduce((best, trade) => 
          !best || trade.pnl > best.pnl ? trade : best, null as TradeResult | null),
        worstTrade: tradeResults.reduce((worst, trade) => 
          !worst || trade.pnl < worst.pnl ? trade : worst, null as TradeResult | null),
      };

      console.log('✅ Backtest complete!');
      console.log(`   Total Trades: ${result.totalTrades}`);
      console.log(`   Win Rate: ${result.winRate.toFixed(2)}%`);
      console.log(`   Total P&L: $${result.totalPnL.toFixed(2)}`);
      console.log(`   Max Drawdown: ${result.maxDrawdown.toFixed(2)}%`);
      console.log(`   Sharpe Ratio: ${result.sharpeRatio.toFixed(2)}`);

      this.emit('backtest-complete', result);
      return result;

    } catch (error) {
      console.error('❌ Backtest failed:', error);
      throw error;
    } finally {
      this.isRunning = false;
      this.currentBacktest = null;
    }
  }

  private async getHistoricalPatterns(params: BacktestParameters): Promise<any[]> {
    const patterns = await db.select()
      .from(patterns)
      .where(
        and(
          gte(patterns.detectedAt, params.startDate),
          lte(patterns.detectedAt, params.endDate),
          inArray(patterns.patternType, params.strategies)
        )
      )
      .orderBy(patterns.detectedAt);

    console.log(`📊 Found ${patterns.length} historical patterns to backtest`);
    return patterns;
  }

  private async simulateTrades(
    historicalPatterns: any[], 
    params: BacktestParameters
  ): Promise<TradeResult[]> {
    const tradeResults: TradeResult[] = [];
    const openPositions = new Map<string, TradeResult>();
    let currentCapital = params.initialCapital;
    const maxPositions = params.maxPositions || 5;
    const positionSize = params.positionSize || 0.02; // 2% default

    for (const pattern of historicalPatterns) {
      this.progress = (historicalPatterns.indexOf(pattern) / historicalPatterns.length) * 100;
      this.emit('backtest-progress', this.progress);

      // Skip if max positions reached
      if (openPositions.size >= maxPositions) {
        continue;
      }

      // Skip if we already have a position in this token
      if (openPositions.has(pattern.tokenId)) {
        continue;
      }

      // Get price at pattern detection
      const entryPrice = await this.getPriceAtDate(pattern.tokenId, pattern.detectedAt);
      if (!entryPrice) continue;

      // Calculate position size
      const tradeAmount = currentCapital * positionSize;
      const quantity = tradeAmount / entryPrice;

      // Simulate entry
      const trade: TradeResult = {
        tokenSymbol: pattern.tokenId, // Will be replaced with actual symbol
        entryPrice,
        exitPrice: 0,
        quantity,
        pnl: 0,
        pnlPercent: 0,
        entryDate: pattern.detectedAt,
        exitDate: new Date(),
        strategy: pattern.patternType,
        holdTime: 0,
      };

      openPositions.set(pattern.tokenId, trade);
      currentCapital -= tradeAmount;

      // Simulate exit based on stop loss/take profit or time-based exit
      const exitData = await this.simulateExit(
        pattern.tokenId,
        entryPrice,
        pattern.detectedAt,
        params
      );

      if (exitData) {
        trade.exitPrice = exitData.price;
        trade.exitDate = exitData.date;
        trade.holdTime = (trade.exitDate.getTime() - trade.entryDate.getTime()) / (1000 * 60 * 60 * 24); // Days
        trade.pnl = (trade.exitPrice - trade.entryPrice) * trade.quantity;
        trade.pnlPercent = ((trade.exitPrice - trade.entryPrice) / trade.entryPrice) * 100;

        currentCapital += trade.exitPrice * trade.quantity;
        openPositions.delete(pattern.tokenId);
        tradeResults.push(trade);
      }
    }

    // Close any remaining open positions at end date
    for (const [tokenId, trade] of openPositions) {
      const exitPrice = await this.getPriceAtDate(tokenId, params.endDate);
      if (exitPrice) {
        trade.exitPrice = exitPrice;
        trade.exitDate = params.endDate;
        trade.holdTime = (trade.exitDate.getTime() - trade.entryDate.getTime()) / (1000 * 60 * 60 * 24);
        trade.pnl = (trade.exitPrice - trade.entryPrice) * trade.quantity;
        trade.pnlPercent = ((trade.exitPrice - trade.entryPrice) / trade.entryPrice) * 100;
        tradeResults.push(trade);
      }
    }

    return tradeResults;
  }

  private async getPriceAtDate(tokenId: string, date: Date): Promise<number | null> {
    const price = await db.select()
      .from(priceHistory)
      .where(
        and(
          eq(priceHistory.tokenId, tokenId),
          lte(priceHistory.timestamp, date)
        )
      )
      .orderBy(desc(priceHistory.timestamp))
      .limit(1);

    return price[0] ? parseFloat(price[0].price) : null;
  }

  private async simulateExit(
    tokenId: string,
    entryPrice: number,
    entryDate: Date,
    params: BacktestParameters
  ): Promise<{ price: number; date: Date } | null> {
    // Get price history after entry
    const prices = await db.select()
      .from(priceHistory)
      .where(
        and(
          eq(priceHistory.tokenId, tokenId),
          gte(priceHistory.timestamp, entryDate),
          lte(priceHistory.timestamp, params.endDate)
        )
      )
      .orderBy(priceHistory.timestamp)
      .limit(100); // Check next 100 price points

    for (const pricePoint of prices) {
      const currentPrice = parseFloat(pricePoint.price);
      
      // Check stop loss
      if (params.stopLoss && currentPrice <= entryPrice * (1 - params.stopLoss)) {
        return { price: currentPrice, date: pricePoint.timestamp };
      }
      
      // Check take profit
      if (params.takeProfit && currentPrice >= entryPrice * (1 + params.takeProfit)) {
        return { price: currentPrice, date: pricePoint.timestamp };
      }
      
      // Time-based exit after 7 days
      const holdTime = (pricePoint.timestamp.getTime() - entryDate.getTime()) / (1000 * 60 * 60 * 24);
      if (holdTime >= 7) {
        return { price: currentPrice, date: pricePoint.timestamp };
      }
    }

    return null;
  }

  private calculateMetrics(trades: TradeResult[], params: BacktestParameters): Partial<BacktestResult> {
    if (trades.length === 0) {
      return {
        totalTrades: 0,
        winningTrades: 0,
        losingTrades: 0,
        winRate: 0,
        totalPnL: 0,
        maxDrawdown: 0,
        sharpeRatio: 0,
        profitFactor: 0,
        avgWin: 0,
        avgLoss: 0,
      };
    }

    const winningTrades = trades.filter(t => t.pnl > 0);
    const losingTrades = trades.filter(t => t.pnl < 0);
    
    const totalPnL = trades.reduce((sum, t) => sum + t.pnl, 0);
    const avgWin = winningTrades.length > 0 ? 
      winningTrades.reduce((sum, t) => sum + t.pnl, 0) / winningTrades.length : 0;
    const avgLoss = losingTrades.length > 0 ? 
      Math.abs(losingTrades.reduce((sum, t) => sum + t.pnl, 0) / losingTrades.length) : 0;
    
    const profitFactor = avgLoss > 0 ? avgWin / avgLoss : avgWin > 0 ? Infinity : 0;
    
    // Calculate Sharpe Ratio
    const returns = trades.map(t => t.pnlPercent);
    const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const stdDev = Math.sqrt(
      returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length
    );
    const sharpeRatio = stdDev > 0 ? (avgReturn / stdDev) * Math.sqrt(252) : 0; // Annualized

    // Calculate max drawdown
    let peak = params.initialCapital;
    let maxDrawdown = 0;
    let runningCapital = params.initialCapital;
    
    for (const trade of trades) {
      runningCapital += trade.pnl;
      if (runningCapital > peak) {
        peak = runningCapital;
      }
      const drawdown = ((peak - runningCapital) / peak) * 100;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }
    }

    return {
      totalTrades: trades.length,
      winningTrades: winningTrades.length,
      losingTrades: losingTrades.length,
      winRate: (winningTrades.length / trades.length) * 100,
      totalPnL,
      maxDrawdown,
      sharpeRatio,
      profitFactor,
      avgWin,
      avgLoss,
    };
  }

  private generateEquityCurve(trades: TradeResult[], params: BacktestParameters): EquityPoint[] {
    const curve: EquityPoint[] = [];
    let currentEquity = params.initialCapital;
    let peak = params.initialCapital;
    
    // Sort trades by exit date
    const sortedTrades = [...trades].sort((a, b) => 
      a.exitDate.getTime() - b.exitDate.getTime()
    );

    // Add initial point
    curve.push({
      date: params.startDate,
      equity: currentEquity,
      drawdown: 0,
      openPositions: 0,
    });

    for (const trade of sortedTrades) {
      currentEquity += trade.pnl;
      if (currentEquity > peak) {
        peak = currentEquity;
      }
      
      const drawdown = ((peak - currentEquity) / peak) * 100;
      
      curve.push({
        date: trade.exitDate,
        equity: currentEquity,
        drawdown,
        openPositions: 0, // Simplified for now
      });
    }

    return curve;
  }

  private analyzeStrategyPerformance(trades: TradeResult[]): Map<string, StrategyMetrics> {
    const strategyMap = new Map<string, StrategyMetrics>();
    
    // Group trades by strategy
    const tradesByStrategy = new Map<string, TradeResult[]>();
    for (const trade of trades) {
      if (!tradesByStrategy.has(trade.strategy)) {
        tradesByStrategy.set(trade.strategy, []);
      }
      tradesByStrategy.get(trade.strategy)!.push(trade);
    }

    // Calculate metrics for each strategy
    for (const [strategy, strategyTrades] of tradesByStrategy) {
      const wins = strategyTrades.filter(t => t.pnl > 0).length;
      const winRate = (wins / strategyTrades.length) * 100;
      const avgReturn = strategyTrades.reduce((sum, t) => sum + t.pnlPercent, 0) / strategyTrades.length;
      
      // Simplified Sharpe calculation
      const returns = strategyTrades.map(t => t.pnlPercent);
      const stdDev = Math.sqrt(
        returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length
      );
      const sharpeRatio = stdDev > 0 ? (avgReturn / stdDev) * Math.sqrt(252) : 0;
      
      // Max drawdown for this strategy
      let peak = 0;
      let maxDrawdown = 0;
      let runningPnL = 0;
      
      for (const trade of strategyTrades) {
        runningPnL += trade.pnl;
        if (runningPnL > peak) {
          peak = runningPnL;
        }
        const drawdown = peak > 0 ? ((peak - runningPnL) / peak) * 100 : 0;
        if (drawdown > maxDrawdown) {
          maxDrawdown = drawdown;
        }
      }

      strategyMap.set(strategy, {
        trades: strategyTrades.length,
        winRate,
        avgReturn,
        sharpeRatio,
        maxDrawdown,
      });
    }

    return strategyMap;
  }

  async compareStrategies(strategies: string[], period: number = 30): Promise<Map<string, BacktestResult>> {
    const results = new Map<string, BacktestResult>();
    const endDate = new Date();
    const startDate = new Date(Date.now() - period * 24 * 60 * 60 * 1000);

    for (const strategy of strategies) {
      const result = await this.runBacktest({
        startDate,
        endDate,
        initialCapital: 10000,
        strategies: [strategy],
        stopLoss: 0.05,
        takeProfit: 0.1,
        maxPositions: 5,
        positionSize: 0.02,
      });
      
      results.set(strategy, result);
    }

    return results;
  }

  getProgress(): number {
    return this.progress;
  }

  isBacktesting(): boolean {
    return this.isRunning;
  }

  cancelBacktest(): void {
    if (this.isRunning) {
      this.isRunning = false;
      this.emit('backtest-cancelled');
      console.log('🛑 Backtest cancelled');
    }
  }
}

// Export singleton instance
export const backtestingEngine = new BacktestingEngine();