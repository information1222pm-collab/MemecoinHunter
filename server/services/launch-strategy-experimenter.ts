import { storage } from '../storage';
import { db } from '../db';
import { launchStrategies, launchPerformance, launchCoins } from '@shared/schema';
import { eq, and, desc } from 'drizzle-orm';

interface StrategyTest {
  strategyId: string;
  strategyName: string;
  totalTrades: number;
  winRate: number;
  avgProfitPerTrade: number;
  meetsThresholds: boolean;
}

/**
 * Launch Strategy Experimenter
 * Tests different trading strategies and identifies the best performers
 * Enables strategies that achieve >65% win rate and >50% avg profit per trade
 */
export class LaunchStrategyExperimenter {
  private evaluationInterval: NodeJS.Timeout | null = null;
  private readonly evaluationIntervalMs = 30 * 60 * 1000; // Evaluate every 30 minutes
  private readonly minTradesForEvaluation = 20; // Minimum trades needed for strategy evaluation
  private readonly winRateThreshold = 65; // 65% win rate required
  private readonly profitThreshold = 50; // 50% avg profit per trade required

  constructor() {}

  /**
   * Start strategy experimentation
   */
  start() {
    console.log('🧪 Launch Strategy Experimenter started');
    
    // Run initial evaluation
    this.evaluateStrategies();
    
    // Schedule periodic evaluation
    this.evaluationInterval = setInterval(() => {
      this.evaluateStrategies();
    }, this.evaluationIntervalMs);
  }

  /**
   * Stop strategy experimentation
   */
  stop() {
    if (this.evaluationInterval) {
      clearInterval(this.evaluationInterval);
      this.evaluationInterval = null;
    }
    console.log('🛑 Launch Strategy Experimenter stopped');
  }

  /**
   * Main evaluation routine
   */
  private async evaluateStrategies() {
    try {
      console.log('🧪 EXPERIMENTER: Evaluating strategy performance...');
      
      // Get all strategies with their performance data
      const strategies = await storage.getAllStrategies();
      
      if (strategies.length === 0) {
        console.log('🧪 EXPERIMENTER: No strategies found - waiting for pattern analyzer to create strategies');
        return;
      }

      const tests: StrategyTest[] = [];

      // Evaluate each strategy
      for (const strategy of strategies) {
        const performance = await storage.getStrategyPerformance(strategy.id);
        
        if (!performance) {
          console.log(`🧪 EXPERIMENTER: No performance data for strategy ${strategy.strategyName}`);
          continue;
        }

        const totalTrades = performance.totalTrades || 0;
        
        if (totalTrades < this.minTradesForEvaluation) {
          console.log(`🧪 EXPERIMENTER: Strategy ${strategy.strategyName} has insufficient trades (${totalTrades}/${this.minTradesForEvaluation})`);
          continue;
        }

        const winRate = parseFloat(performance.winRate || '0');
        const avgProfitPerTrade = parseFloat(performance.avgProfitPerTrade || '0');
        const meetsThresholds = winRate >= this.winRateThreshold && avgProfitPerTrade >= this.profitThreshold;

        tests.push({
          strategyId: strategy.id,
          strategyName: strategy.strategyName,
          totalTrades,
          winRate,
          avgProfitPerTrade,
          meetsThresholds,
        });

        console.log(`🧪 EXPERIMENTER: Strategy "${strategy.strategyName}": ${totalTrades} trades, ${winRate.toFixed(1)}% win rate, ${avgProfitPerTrade.toFixed(1)}% avg profit`);
      }

      if (tests.length === 0) {
        console.log('🧪 EXPERIMENTER: No strategies with sufficient trade history');
        return;
      }

      // Find the best performing strategy
      const bestStrategy = this.findBestStrategy(tests);
      
      if (bestStrategy) {
        await this.activateBestStrategy(bestStrategy);
      } else {
        console.log('🧪 EXPERIMENTER: No strategy meets performance thresholds yet');
      }

    } catch (error) {
      console.error('🧪 EXPERIMENTER: Error evaluating strategies:', error);
    }
  }

  /**
   * Find the best performing strategy
   */
  private findBestStrategy(tests: StrategyTest[]): StrategyTest | null {
    // Filter strategies that meet thresholds
    const qualified = tests.filter(t => t.meetsThresholds);

    if (qualified.length === 0) {
      return null;
    }

    // Sort by combined score (win rate + avg profit)
    qualified.sort((a, b) => {
      const scoreA = a.winRate + a.avgProfitPerTrade;
      const scoreB = b.winRate + b.avgProfitPerTrade;
      return scoreB - scoreA;
    });

    return qualified[0];
  }

  /**
   * Activate the best performing strategy
   */
  private async activateBestStrategy(best: StrategyTest) {
    try {
      // Deactivate all other strategies
      await db.update(launchStrategies)
        .set({ isActive: false })
        .where(eq(launchStrategies.isActive, true));

      // Activate the best strategy
      await db.update(launchStrategies)
        .set({ isActive: true })
        .where(eq(launchStrategies.id, best.strategyId));

      // Update performance flags
      await db.update(launchPerformance)
        .set({
          meetsWinRateThreshold: best.winRate >= this.winRateThreshold,
          meetsProfitThreshold: best.avgProfitPerTrade >= this.profitThreshold,
          isReadyForLive: true,
        })
        .where(eq(launchPerformance.strategyId, best.strategyId));

      console.log(`🚀 EXPERIMENTER: Activated strategy "${best.strategyName}" (${best.winRate.toFixed(1)}% win rate, ${best.avgProfitPerTrade.toFixed(1)}% avg profit)`);

    } catch (error) {
      console.error('🧪 EXPERIMENTER: Error activating strategy:', error);
    }
  }

  /**
   * Create experimental strategy variations
   */
  async createExperimentalStrategies() {
    try {
      console.log('🧪 EXPERIMENTER: Creating experimental strategy variations...');

      // Get the current active strategy as a baseline
      const activeStrategy = await storage.getActiveStrategy();

      if (!activeStrategy) {
        console.log('🧪 EXPERIMENTER: No active strategy to base experiments on');
        return;
      }

      // Create aggressive variant (higher risk, higher reward)
      await this.createVariant({
        baseName: activeStrategy.strategyName,
        variantName: 'Aggressive Variant',
        description: 'Higher risk variant with larger position sizes and wider stop-loss',
        modifications: {
          entryPercent: '3.00', // 3% instead of 2%
          maxPositionSize: '750', // $750 instead of $500
          stopLossPercent: '40.00', // 40% instead of 30%
          takeProfitPercent: '150.00', // 150% instead of 100%
          minMomentum: '0.15', // Lower momentum threshold
        },
      });

      // Create conservative variant (lower risk, steadier gains)
      await this.createVariant({
        baseName: activeStrategy.strategyName,
        variantName: 'Conservative Variant',
        description: 'Lower risk variant with smaller positions and tighter stop-loss',
        modifications: {
          entryPercent: '1.00', // 1% instead of 2%
          maxPositionSize: '250', // $250 instead of $500
          stopLossPercent: '20.00', // 20% instead of 30%
          takeProfitPercent: '80.00', // 80% instead of 100%
          minMomentum: '0.3', // Higher momentum threshold
        },
      });

      // Create quick-exit variant (shorter hold times)
      await this.createVariant({
        baseName: activeStrategy.strategyName,
        variantName: 'Quick Exit Variant',
        description: 'Faster trades with shorter hold times and quicker exits',
        modifications: {
          timeoutMinutes: 30, // 30 minutes instead of 60
          takeProfitPercent: '50.00', // 50% instead of 100%
          stopLossPercent: '15.00', // 15% instead of 30%
          minMomentum: '0.25',
        },
      });

      console.log('🧪 EXPERIMENTER: Created 3 experimental strategy variants');

    } catch (error) {
      console.error('🧪 EXPERIMENTER: Error creating experimental strategies:', error);
    }
  }

  /**
   * Create a strategy variant
   */
  private async createVariant(config: {
    baseName: string;
    variantName: string;
    description: string;
    modifications: any;
  }) {
    try {
      const activeStrategy = await storage.getActiveStrategy();
      if (!activeStrategy) return;

      // Check if variant already exists
      const existing = await db.select()
        .from(launchStrategies)
        .where(eq(launchStrategies.strategyName, config.variantName))
        .limit(1);

      if (existing.length > 0) {
        console.log(`🧪 EXPERIMENTER: Variant "${config.variantName}" already exists, skipping`);
        return;
      }

      // Create new variant
      const [variant] = await db.insert(launchStrategies).values({
        strategyName: config.variantName,
        description: config.description,
        isActive: false, // Variants start inactive
        minMarketCap: activeStrategy.minMarketCap,
        maxMarketCap: activeStrategy.maxMarketCap,
        minVolume: activeStrategy.minVolume,
        requiredPatterns: activeStrategy.requiredPatterns,
        rejectionPatterns: activeStrategy.rejectionPatterns,
        ...config.modifications,
      }).returning();

      // Initialize performance tracking
      await db.insert(launchPerformance).values({
        strategyId: variant.id,
        totalTrades: 0,
        successfulTrades: 0,
        failedTrades: 0,
        winRate: '0',
        avgProfitPerTrade: '0',
        totalProfitLoss: '0',
        maxDrawdown: '0',
      });

      console.log(`🧪 EXPERIMENTER: Created variant "${config.variantName}"`);

    } catch (error) {
      console.error(`🧪 EXPERIMENTER: Error creating variant "${config.variantName}":`, error);
    }
  }

  /**
   * Get strategy comparison report
   */
  async getStrategyComparison() {
    const strategies = await storage.getAllStrategies();
    const results: any[] = [];

    for (const strategy of strategies) {
      const performance = await storage.getStrategyPerformance(strategy.id);
      
      if (performance) {
        results.push({
          id: strategy.id,
          name: strategy.strategyName,
          isActive: strategy.isActive,
          totalTrades: performance.totalTrades,
          winRate: parseFloat(performance.winRate || '0'),
          avgProfit: parseFloat(performance.avgProfitPerTrade || '0'),
          totalProfitLoss: parseFloat(performance.totalProfitLoss || '0'),
          meetsThresholds: performance.meetsWinRateThreshold && performance.meetsProfitThreshold,
          isReadyForLive: performance.isReadyForLive,
        });
      }
    }

    // Sort by performance
    results.sort((a, b) => {
      const scoreA = a.winRate + a.avgProfit;
      const scoreB = b.winRate + b.avgProfit;
      return scoreB - scoreA;
    });

    return results;
  }
}

export const launchStrategyExperimenter = new LaunchStrategyExperimenter();
