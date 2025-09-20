import { EventEmitter } from 'events';
import { storage } from '../storage';
import type { Trade, Pattern, InsertPatternPerformance, InsertMLLearningParams } from '@shared/schema';

interface PatternStats {
  patternType: string;
  timeframe: string;
  totalTrades: number;
  successfulTrades: number;
  totalProfit: number;
  winRate: number;
  averageReturn: number;
  confidenceMultiplier: number;
}

class PatternPerformanceAnalyzer extends EventEmitter {
  private isActive = false;
  private updateInterval?: NodeJS.Timeout;
  
  private readonly learningParams = {
    minTradesForLearning: 5, // Need at least 5 trades to start learning
    winRateThreshold: 0.6, // 60% win rate is good
    profitabilityThreshold: 0.02, // 2% average return is good
    confidenceDecayRate: 0.1, // How much to reduce confidence for poor patterns
    confidenceBoostRate: 0.2, // How much to increase confidence for good patterns
    maxConfidenceMultiplier: 2.0, // Max 2x confidence boost
    minConfidenceMultiplier: 0.3, // Min 30% confidence (never go below)
  };

  async start() {
    if (this.isActive) return;
    
    this.isActive = true;
    console.log('🧠 Pattern Performance Analyzer started');
    
    await this.initializeLearningParams();
    
    // Update pattern performance every 2 minutes
    this.updateInterval = setInterval(() => {
      this.analyzeAllPatterns();
    }, 120000);
    
    // Run initial analysis
    await this.analyzeAllPatterns();
  }

  stop() {
    if (!this.isActive) return;
    
    this.isActive = false;
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }
    
    console.log('🛑 Pattern Performance Analyzer stopped');
  }

  private async initializeLearningParams() {
    try {
      // Initialize default learning parameters if they don't exist
      const params = [
        { paramKey: 'minConfidenceThreshold', paramValue: '75', paramType: 'threshold', description: 'Minimum confidence to execute trades' },
        { paramKey: 'dynamicAdjustment', paramValue: 'true', paramType: 'boolean', description: 'Enable dynamic confidence adjustment' },
        { paramKey: 'learningRate', paramValue: '0.1', paramType: 'multiplier', description: 'How fast the system learns from outcomes' },
      ];

      for (const param of params) {
        try {
          await storage.createMLLearningParam(param);
        } catch (error) {
          // Param might already exist, that's fine
        }
      }
    } catch (error) {
      console.error('Error initializing learning parameters:', error);
    }
  }

  async analyzePatternPerformance(patternType: string, timeframe: string): Promise<PatternStats | null> {
    try {
      // Get all trades linked to this pattern type
      const trades = await storage.getTradesByPatternType(patternType, timeframe);
      
      if (trades.length < this.learningParams.minTradesForLearning) {
        return null; // Not enough data to learn
      }

      // Calculate performance metrics
      const closedTrades = trades.filter(t => t.closedAt && t.realizedPnL !== null);
      const successfulTrades = closedTrades.filter(t => parseFloat(t.realizedPnL?.toString() || '0') > 0);
      
      const totalProfit = closedTrades.reduce((sum, t) => sum + parseFloat(t.realizedPnL?.toString() || '0'), 0);
      const winRate = closedTrades.length > 0 ? successfulTrades.length / closedTrades.length : 0;
      const averageReturn = closedTrades.length > 0 ? totalProfit / closedTrades.length : 0;

      // Calculate confidence multiplier based on performance
      let confidenceMultiplier = 1.0;
      
      if (winRate > this.learningParams.winRateThreshold && averageReturn > this.learningParams.profitabilityThreshold) {
        // Pattern is performing well, boost confidence
        confidenceMultiplier = Math.min(
          1.0 + this.learningParams.confidenceBoostRate,
          this.learningParams.maxConfidenceMultiplier
        );
      } else if (winRate < 0.4 || averageReturn < -0.02) {
        // Pattern is performing poorly, reduce confidence
        confidenceMultiplier = Math.max(
          1.0 - this.learningParams.confidenceDecayRate,
          this.learningParams.minConfidenceMultiplier
        );
      }

      return {
        patternType,
        timeframe,
        totalTrades: trades.length,
        successfulTrades: successfulTrades.length,
        totalProfit,
        winRate,
        averageReturn,
        confidenceMultiplier,
      };
    } catch (error) {
      console.error(`Error analyzing pattern ${patternType}:`, error);
      return null;
    }
  }

  private async analyzeAllPatterns() {
    try {
      // Get all unique pattern types and timeframes
      const patterns = await storage.getAllPatterns();
      const patternGroups = new Map<string, Set<string>>();
      
      patterns.forEach(pattern => {
        if (!patternGroups.has(pattern.patternType)) {
          patternGroups.set(pattern.patternType, new Set());
        }
        patternGroups.get(pattern.patternType)?.add(pattern.timeframe);
      });

      let updatedPatterns = 0;
      
      // Analyze each pattern type/timeframe combination
      const patternTypeKeys = Array.from(patternGroups.keys());
      for (const patternType of patternTypeKeys) {
        const timeframes = patternGroups.get(patternType)!;
        for (const timeframe of Array.from(timeframes)) {
          const stats = await this.analyzePatternPerformance(patternType, timeframe);
          if (stats) {
            await this.updatePatternPerformance(stats);
            updatedPatterns++;
          }
        }
      }

      if (updatedPatterns > 0) {
        console.log(`🔄 Updated performance stats for ${updatedPatterns} pattern types`);
        await this.adjustGlobalThresholds();
      }
    } catch (error) {
      console.error('Error in pattern analysis:', error);
    }
  }

  private async updatePatternPerformance(stats: PatternStats) {
    try {
      const performanceData: InsertPatternPerformance = {
        patternType: stats.patternType,
        timeframe: stats.timeframe,
        totalTrades: stats.totalTrades,
        successfulTrades: stats.successfulTrades,
        totalProfit: stats.totalProfit.toString(),
        averageReturn: stats.averageReturn.toString(),
        winRate: (stats.winRate * 100).toString(),
        confidenceMultiplier: stats.confidenceMultiplier.toString(),
      };

      await storage.upsertPatternPerformance(performanceData);
      
      // Update existing patterns with new confidence multiplier
      await storage.updatePatternConfidenceMultiplier(
        stats.patternType,
        stats.timeframe,
        stats.confidenceMultiplier
      );

    } catch (error) {
      console.error('Error updating pattern performance:', error);
    }
  }

  private async adjustGlobalThresholds() {
    try {
      // Get overall system performance
      const allPerformance = await storage.getAllPatternPerformance();
      const recentTrades = await storage.getRecentTrades(50);
      
      if (recentTrades.length < 10) return; // Not enough data
      
      // Calculate recent win rate
      const closedTrades = recentTrades.filter(t => t.closedAt && t.realizedPnL !== null);
      const recentWinRate = closedTrades.length > 0 
        ? closedTrades.filter(t => parseFloat(t.realizedPnL?.toString() || '0') > 0).length / closedTrades.length
        : 0;

      // Adjust global minimum confidence based on recent performance
      let newMinConfidence = 75; // Default
      
      if (recentWinRate < 0.4) {
        // Poor recent performance, be more conservative
        newMinConfidence = Math.min(90, 75 + 15);
        console.log(`📉 Recent win rate low (${(recentWinRate * 100).toFixed(1)}%), raising min confidence to ${newMinConfidence}%`);
      } else if (recentWinRate > 0.7) {
        // Good recent performance, can be more aggressive
        newMinConfidence = Math.max(60, 75 - 15);
        console.log(`📈 Recent win rate high (${(recentWinRate * 100).toFixed(1)}%), lowering min confidence to ${newMinConfidence}%`);
      }

      // Update the global parameter
      await storage.updateMLLearningParam('minConfidenceThreshold', newMinConfidence.toString());
      
      this.emit('thresholdUpdated', { minConfidence: newMinConfidence, recentWinRate });
      
    } catch (error) {
      console.error('Error adjusting global thresholds:', error);
    }
  }

  async getPatternPerformance(patternType: string, timeframe: string): Promise<PatternStats | null> {
    try {
      const performance = await storage.getPatternPerformance(patternType, timeframe);
      if (!performance) return null;

      return {
        patternType: performance.patternType,
        timeframe: performance.timeframe,
        totalTrades: performance.totalTrades || 0,
        successfulTrades: performance.successfulTrades || 0,
        totalProfit: parseFloat(performance.totalProfit?.toString() || '0'),
        winRate: parseFloat(performance.winRate?.toString() || '0') / 100,
        averageReturn: parseFloat(performance.averageReturn?.toString() || '0'),
        confidenceMultiplier: parseFloat(performance.confidenceMultiplier?.toString() || '1'),
      };
    } catch (error) {
      console.error('Error getting pattern performance:', error);
      return null;
    }
  }

  async getCurrentMinConfidence(): Promise<number> {
    try {
      const param = await storage.getMLLearningParam('minConfidenceThreshold');
      return param ? parseFloat(param.paramValue) : 75;
    } catch (error) {
      return 75; // Default fallback
    }
  }
}

export const patternPerformanceAnalyzer = new PatternPerformanceAnalyzer();