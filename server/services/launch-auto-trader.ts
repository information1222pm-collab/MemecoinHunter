import { storage } from '../storage';
import { db } from '../db';
import { launchCoins, launchStrategies, launchPerformance, portfolios, trades } from '@shared/schema';
import { eq, and, desc, gte, sql, inArray } from 'drizzle-orm';
import { EventEmitter } from 'events';

interface LaunchTradeSignal {
  launchCoinId: string;
  tokenId: string;
  strategyId: string;
  confidence: number;
  entryPrice: number;
  marketCap: number;
  volume: number;
}

/**
 * Launch Auto-Trader
 * Executes trades on early-launch coins using proven strategies
 * Only trades when strategy meets performance thresholds (>65% win rate, >50% profit)
 */
export class LaunchAutoTrader extends EventEmitter {
  private monitoringInterval: NodeJS.Timeout | null = null;
  private readonly checkIntervalMs = 30 * 1000; // Check every 30 seconds
  private activeStrategy: any = null;
  private isReady: boolean = false;

  constructor() {
    super();
  }

  /**
   * Start launch auto-trading
   */
  start() {
    console.log('🎯 Launch Auto-Trader started');
    
    // Check if we have a ready strategy
    this.checkStrategyReadiness();
    
    // Monitor for new launch opportunities
    this.monitoringInterval = setInterval(() => {
      this.checkForLaunchOpportunities();
    }, this.checkIntervalMs);
  }

  /**
   * Stop launch auto-trading
   */
  stop() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    console.log('🛑 Launch Auto-Trader stopped');
  }

  /**
   * Check if we have a strategy ready for live trading
   */
  private async checkStrategyReadiness() {
    try {
      const activeStrategy = await storage.getActiveStrategy();
      
      if (!activeStrategy) {
        console.log('🎯 LAUNCH-TRADER: No active strategy found');
        this.isReady = false;
        return;
      }

      const performance = await storage.getStrategyPerformance(activeStrategy.id);
      
      if (!performance) {
        console.log('🎯 LAUNCH-TRADER: No performance data for active strategy');
        this.isReady = false;
        return;
      }

      // Enforce numeric thresholds directly as safety backstop
      const winRate = parseFloat(performance.winRate || '0');
      const avgProfit = parseFloat(performance.avgProfitPerTrade || '0');
      const meetsWinRateThreshold = winRate >= 65;
      const meetsProfitThreshold = avgProfit >= 50;

      if (meetsWinRateThreshold && meetsProfitThreshold && performance.isReadyForLive) {
        this.activeStrategy = activeStrategy;
        this.isReady = true;
        console.log(`🎯 LAUNCH-TRADER: Strategy "${activeStrategy.strategyName}" is READY for live trading`);
        console.log(`   📊 Win Rate: ${winRate.toFixed(1)}%, Avg Profit: ${avgProfit.toFixed(1)}%`);
      } else {
        this.isReady = false;
        console.log(`🎯 LAUNCH-TRADER: Strategy not ready - Win Rate: ${winRate.toFixed(1)}%, Avg Profit: ${avgProfit.toFixed(1)}%`);
      }

    } catch (error) {
      console.error('🎯 LAUNCH-TRADER: Error checking strategy readiness:', error);
      this.isReady = false;
    }
  }

  /**
   * Monitor for new launch opportunities
   */
  private async checkForLaunchOpportunities() {
    try {
      // Re-check strategy readiness periodically
      await this.checkStrategyReadiness();

      if (!this.isReady || !this.activeStrategy) {
        return;
      }

      // Get recent launch coins that are still being monitored
      const recentLaunches = await db.select()
        .from(launchCoins)
        .where(eq(launchCoins.status, 'monitoring'))
        .orderBy(desc(launchCoins.detectedAt))
        .limit(10);

      if (recentLaunches.length === 0) {
        return;
      }

      console.log(`🎯 LAUNCH-TRADER: Evaluating ${recentLaunches.length} launch opportunities...`);

      for (const launch of recentLaunches) {
        await this.evaluateLaunchOpportunity(launch);
      }

    } catch (error) {
      console.error('🎯 LAUNCH-TRADER: Error checking launch opportunities:', error);
    }
  }

  /**
   * Evaluate a launch opportunity against active strategy
   */
  private async evaluateLaunchOpportunity(launch: any) {
    try {
      if (!this.activeStrategy) return;

      const strategy = this.activeStrategy;

      // Check market cap constraints (treat null/undefined as no limit)
      const marketCap = parseFloat(launch.initialMarketCap || '0');
      const minMc = parseFloat(strategy.minMarketCap || '0');
      const maxMc = strategy.maxMarketCap ? parseFloat(strategy.maxMarketCap) : Infinity;

      if (marketCap < minMc || (maxMc !== Infinity && marketCap > maxMc)) {
        console.log(`🎯 LAUNCH-TRADER: ${launch.symbol} rejected - market cap $${marketCap.toFixed(0)} outside range ($${minMc}-${maxMc === Infinity ? 'unlimited' : maxMc})`);
        return;
      }

      // Check volume constraints (treat null/undefined as no limit)
      const volume = parseFloat(launch.initialVolume || '0');
      const minVol = parseFloat(strategy.minVolume || '0');

      if (volume < minVol) {
        console.log(`🎯 LAUNCH-TRADER: ${launch.symbol} rejected - volume $${volume.toFixed(0)} < $${minVol.toFixed(0)}`);
        return;
      }

      // Check momentum if specified (null/undefined means no requirement)
      const minMomentum = strategy.minMomentum ? parseFloat(strategy.minMomentum) : 0;

      if (minMomentum > 0) {
        const momentum = parseFloat(launch.initialMomentum || '0');
        if (momentum < minMomentum) {
          console.log(`🎯 LAUNCH-TRADER: ${launch.symbol} rejected - momentum ${(momentum * 100).toFixed(1)}% < ${(minMomentum * 100).toFixed(1)}%`);
          return;
        }
      }

      // Check rejection patterns (if any)
      const rejectionPatterns = strategy.rejectionPatterns || [];
      // This would require pattern analysis data - simplified for now
      
      // All checks passed - execute trade
      console.log(`✅ LAUNCH-TRADER: ${launch.symbol} QUALIFIES for trading`);
      await this.executeLaunchTrade(launch, strategy);

    } catch (error) {
      console.error(`🎯 LAUNCH-TRADER: Error evaluating ${launch.symbol}:`, error);
    }
  }

  /**
   * Execute a trade on a qualified launch coin
   */
  private async executeLaunchTrade(launch: any, strategy: any) {
    try {
      // Get portfolios with launch trading enabled via the config table
      const { portfolioLaunchConfig } = await import('@shared/schema');
      
      const launchConfigs = await db.select()
        .from(portfolioLaunchConfig)
        .where(eq(portfolioLaunchConfig.launchTradingEnabled, true));

      if (launchConfigs.length === 0) {
        console.log('🎯 LAUNCH-TRADER: No portfolios with launch trading enabled');
        return;
      }

      // Get the actual portfolios
      const portfolioIds = launchConfigs.map(c => c.portfolioId);
      const eligiblePortfolios = await db.select()
        .from(portfolios)
        .where(
          and(
            eq(portfolios.autoTradingEnabled, true),
            inArray(portfolios.id, portfolioIds)
          )
        );

      console.log(`🎯 LAUNCH-TRADER: Executing launch trade for ${launch.symbol} across ${eligiblePortfolios.length} portfolios`);

      let tradesExecuted = 0;
      for (const portfolio of eligiblePortfolios) {
        const success = await this.executePortfolioTrade(portfolio, launch, strategy);
        if (success) tradesExecuted++;
      }

      // Only mark as traded if at least one trade succeeded
      if (tradesExecuted > 0) {
        await db.update(launchCoins)
          .set({ status: 'traded' })
          .where(eq(launchCoins.id, launch.id));
        console.log(`🎯 LAUNCH-TRADER: Successfully executed ${tradesExecuted} trades for ${launch.symbol}`);
      } else {
        console.log(`🎯 LAUNCH-TRADER: No trades executed for ${launch.symbol} - leaving in monitoring`);
      }

    } catch (error) {
      console.error('🎯 LAUNCH-TRADER: Error executing launch trade:', error);
    }
  }

  /**
   * Execute trade for a specific portfolio
   * @returns true if trade executed successfully, false otherwise
   */
  private async executePortfolioTrade(portfolio: any, launch: any, strategy: any): Promise<boolean> {
    try {
      const currentValue = parseFloat(portfolio.totalValue || '10000');
      const cashBalance = parseFloat(portfolio.cashBalance || currentValue);

      // Calculate position size based on strategy
      const entryPercent = parseFloat(strategy.entryPercent || '2.00') / 100;
      const maxPositionSize = parseFloat(strategy.maxPositionSize || '500');
      
      let positionSize = currentValue * entryPercent;
      positionSize = Math.min(positionSize, maxPositionSize);
      positionSize = Math.min(positionSize, cashBalance * 0.9); // Max 90% of cash

      if (positionSize < 50) {
        console.log(`🎯 LAUNCH-TRADER: [${portfolio.userId}] Position too small: $${positionSize.toFixed(2)}`);
        return false;
      }

      const entryPrice = parseFloat(launch.launchPrice || '0');
      if (entryPrice <= 0) {
        console.log(`🎯 LAUNCH-TRADER: [${portfolio.userId}] Invalid entry price for ${launch.symbol}`);
        return false;
      }

      const quantity = positionSize / entryPrice;

      // Create trade record
      const [trade] = await db.insert(trades).values({
        portfolioId: portfolio.id,
        tokenId: launch.tokenId,
        type: 'buy',
        amount: quantity.toString(),
        price: entryPrice.toString(),
        totalValue: positionSize.toString(),
        status: 'completed',
      }).returning();

      console.log(`🚀 LAUNCH-TRADER: [${portfolio.userId}] BUY ${quantity.toFixed(2)} ${launch.symbol} @ $${entryPrice} = $${positionSize.toFixed(2)}`);

      // Update portfolio cash balance
      const newCashBalance = cashBalance - positionSize;
      await db.update(portfolios)
        .set({ cashBalance: newCashBalance.toString() })
        .where(eq(portfolios.id, portfolio.id));

      // Emit event for tracking
      this.emit('launchTrade', {
        portfolioId: portfolio.id,
        tokenId: launch.tokenId,
        symbol: launch.symbol,
        tradeId: trade.id,
        positionSize,
        entryPrice,
      });

      return true;

    } catch (error) {
      console.error(`🎯 LAUNCH-TRADER: Error executing trade for portfolio ${portfolio.userId}:`, error);
      return false;
    }
  }

  /**
   * Get trading status
   */
  async getStatus() {
    await this.checkStrategyReadiness();

    return {
      isReady: this.isReady,
      activeStrategy: this.activeStrategy ? {
        id: this.activeStrategy.id,
        name: this.activeStrategy.strategyName,
        description: this.activeStrategy.description,
      } : null,
      lastCheck: new Date().toISOString(),
    };
  }

  /**
   * Force strategy refresh
   */
  async refreshStrategy() {
    await this.checkStrategyReadiness();
  }
}

export const launchAutoTrader = new LaunchAutoTrader();
