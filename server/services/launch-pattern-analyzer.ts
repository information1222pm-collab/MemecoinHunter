import { storage } from '../storage';
import { db } from '../db';
import { launchAnalysis, launchStrategies, launchPerformance } from '@shared/schema';
import { eq, desc, and, gte } from 'drizzle-orm';

interface PatternInsight {
  pattern: string;
  successRate: number;
  occurrences: number;
  avgGain: number;
}

interface RejectionCriterion {
  indicator: string;
  threshold: string;
  failureRate: number;
  reason: string;
}

/**
 * Launch Pattern Analyzer
 * Analyzes completed launch data to extract success patterns
 * and build rejection criteria for improving trading strategies
 */
export class LaunchPatternAnalyzer {
  private analyzeInterval: NodeJS.Timeout | null = null;
  private readonly analyzeIntervalMs = 60 * 60 * 1000; // Analyze every hour
  private readonly minSampleSize = 10; // Minimum launches needed to identify patterns

  constructor() {}

  /**
   * Start pattern analysis
   */
  start() {
    console.log('🧬 Launch Pattern Analyzer started');
    
    // Run initial analysis
    this.analyzePatterns();
    
    // Schedule periodic analysis
    this.analyzeInterval = setInterval(() => {
      this.analyzePatterns();
    }, this.analyzeIntervalMs);
  }

  /**
   * Stop pattern analysis
   */
  stop() {
    if (this.analyzeInterval) {
      clearInterval(this.analyzeInterval);
      this.analyzeInterval = null;
    }
    console.log('🛑 Launch Pattern Analyzer stopped');
  }

  /**
   * Main analysis routine
   */
  private async analyzePatterns() {
    try {
      console.log('🧬 PATTERN-ANALYZER: Starting launch pattern analysis...');
      
      // Get all completed launch analyses
      const analyses = await db.select()
        .from(launchAnalysis)
        .where(eq(launchAnalysis.analysisComplete, true))
        .orderBy(desc(launchAnalysis.createdAt));

      if (analyses.length < this.minSampleSize) {
        console.log(`🧬 PATTERN-ANALYZER: Insufficient data (${analyses.length}/${this.minSampleSize} launches) - waiting for more launches`);
        return;
      }

      // Separate success and failure cases
      const successes = analyses.filter(a => a.outcomeType === 'success');
      const failures = analyses.filter(a => a.outcomeType === 'failure');

      console.log(`🧬 PATTERN-ANALYZER: Analyzing ${successes.length} successes and ${failures.length} failures`);

      // Extract insights from successful launches
      const successPatterns = this.extractSuccessPatterns(successes);
      
      // Build rejection criteria from failures
      const rejectionCriteria = this.buildRejectionCriteria(failures, successes);

      // Update or create strategies based on learnings
      await this.updateStrategies(successPatterns, rejectionCriteria);

      console.log(`🧬 PATTERN-ANALYZER: Analysis complete - identified ${successPatterns.length} success patterns and ${rejectionCriteria.length} rejection criteria`);

    } catch (error) {
      console.error('🧬 PATTERN-ANALYZER: Error analyzing patterns:', error);
    }
  }

  /**
   * Extract common patterns from successful launches
   */
  private extractSuccessPatterns(successes: any[]): PatternInsight[] {
    if (successes.length === 0) return [];

    const patternMap = new Map<string, { count: number; totalGain: number }>();

    // Analyze identified patterns from successful launches
    for (const success of successes) {
      const patterns = success.identifiedPatterns || [];
      const gain = parseFloat(success.maxGainPercent || '0');

      for (const pattern of patterns) {
        if (!patternMap.has(pattern)) {
          patternMap.set(pattern, { count: 0, totalGain: 0 });
        }
        const data = patternMap.get(pattern)!;
        data.count++;
        data.totalGain += gain;
      }
    }

    // Calculate success rates and average gains
    const insights: PatternInsight[] = [];
    
    for (const [pattern, data] of Array.from(patternMap.entries())) {
      const successRate = data.count / successes.length;
      const avgGain = data.totalGain / data.count;
      
      // Only include patterns that appear in at least 20% of successes
      if (successRate >= 0.2) {
        insights.push({
          pattern,
          successRate,
          occurrences: data.count,
          avgGain,
        });
      }
    }

    // Sort by success rate descending
    return insights.sort((a, b) => b.successRate - a.successRate);
  }

  /**
   * Build rejection criteria from failed launches
   */
  private buildRejectionCriteria(failures: any[], successes: any[]): RejectionCriterion[] {
    if (failures.length === 0) return [];

    const criteria: RejectionCriterion[] = [];

    // Analyze volume patterns
    const failureVolumePatterns = failures.map(f => f.volumePattern).filter(Boolean);
    const volumePatternCounts: { [key: string]: number } = {};
    
    for (const pattern of failureVolumePatterns) {
      volumePatternCounts[pattern] = (volumePatternCounts[pattern] || 0) + 1;
    }

    // Identify volume patterns that appear more in failures than successes
    for (const [pattern, count] of Object.entries(volumePatternCounts)) {
      const failureRate = count / failures.length;
      const successVolumePatterns = successes.filter(s => s.volumePattern === pattern);
      const successRate = successVolumePatterns.length / (successes.length || 1);
      
      // If pattern appears in >40% of failures and <20% of successes, it's a red flag
      if (failureRate > 0.4 && successRate < 0.2) {
        criteria.push({
          indicator: 'volume_pattern',
          threshold: pattern,
          failureRate,
          reason: `Volume pattern "${pattern}" correlates with ${(failureRate * 100).toFixed(0)}% of failures`,
        });
      }
    }

    // Analyze initial momentum
    const lowMomentumFailures = failures.filter(f => {
      const factors = f.successFactors as any;
      return factors && factors.initial_momentum < 0.2;
    });

    if (lowMomentumFailures.length / failures.length > 0.5) {
      criteria.push({
        indicator: 'initial_momentum',
        threshold: '< 0.2',
        failureRate: lowMomentumFailures.length / failures.length,
        reason: 'Low initial momentum (<20%) correlates with failure',
      });
    }

    // Analyze volume ratio (volume vs market cap)
    const lowVolumeRatioFailures = failures.filter(f => {
      const volumeRatio = parseFloat(f.volumeVsMarketCap || '0');
      return volumeRatio < 0.5;
    });

    if (lowVolumeRatioFailures.length / failures.length > 0.4) {
      criteria.push({
        indicator: 'volume_ratio',
        threshold: '< 0.5',
        failureRate: lowVolumeRatioFailures.length / failures.length,
        reason: 'Low volume/market-cap ratio (<0.5) indicates weak interest',
      });
    }

    return criteria;
  }

  /**
   * Update or create strategies based on learned patterns
   */
  private async updateStrategies(successPatterns: PatternInsight[], rejectionCriteria: RejectionCriterion[]) {
    try {
      // Check if we have an active strategy
      const activeStrategy = await storage.getActiveStrategy();

      if (!activeStrategy) {
        // Create initial strategy based on learnings
        await this.createInitialStrategy(successPatterns, rejectionCriteria);
      } else {
        // Update existing strategy
        await this.enhanceStrategy(activeStrategy, successPatterns, rejectionCriteria);
      }

    } catch (error) {
      console.error('🧬 PATTERN-ANALYZER: Error updating strategies:', error);
    }
  }

  /**
   * Create initial strategy from learned patterns
   */
  private async createInitialStrategy(successPatterns: PatternInsight[], rejectionCriteria: RejectionCriterion[]) {
    const requiredPatterns = successPatterns
      .filter(p => p.successRate > 0.5)
      .map(p => p.pattern);

    const rejectionPatterns = rejectionCriteria
      .map(c => `${c.indicator}:${c.threshold}`);

    const [strategy] = await db.insert(launchStrategies).values({
      strategyName: 'Learned Pattern Strategy v1.0',
      description: 'Strategy based on analysis of successful and failed launches',
      isActive: true,
      minMarketCap: '100000', // $100K min
      maxMarketCap: '10000000', // $10M max
      minVolume: '50000', // $50K min volume
      requiredPatterns: requiredPatterns.length > 0 ? requiredPatterns : null,
      rejectionPatterns: rejectionPatterns.length > 0 ? rejectionPatterns : null,
      minMomentum: '0.2', // Based on rejection criteria
      entryPercent: '2.00', // 2% of portfolio
      maxPositionSize: '500', // $500 max
      takeProfitPercent: '100.00', // 100% gain target
      stopLossPercent: '30.00', // 30% stop loss
      timeoutMinutes: 60, // 1 hour max hold
    }).returning();

    // Initialize performance tracking
    await db.insert(launchPerformance).values({
      strategyId: strategy.id,
      totalTrades: 0,
      successfulTrades: 0,
      failedTrades: 0,
      winRate: '0',
      avgProfitPerTrade: '0',
      totalProfitLoss: '0',
      maxDrawdown: '0',
    });

    console.log(`🧬 PATTERN-ANALYZER: Created initial strategy with ${requiredPatterns.length} required patterns and ${rejectionPatterns.length} rejection criteria`);
  }

  /**
   * Enhance existing strategy with new learnings
   */
  private async enhanceStrategy(strategy: any, successPatterns: PatternInsight[], rejectionCriteria: RejectionCriterion[]) {
    // Merge new patterns with existing ones
    const currentRequired = strategy.requiredPatterns || [];
    const newPatterns = successPatterns
      .filter(p => p.successRate > 0.5 && !currentRequired.includes(p.pattern))
      .map(p => p.pattern);

    const updatedRequired = [...currentRequired, ...newPatterns];

    // Merge new rejection criteria
    const currentRejection = strategy.rejectionPatterns || [];
    const newRejections = rejectionCriteria
      .map(c => `${c.indicator}:${c.threshold}`)
      .filter(r => !currentRejection.includes(r));

    const updatedRejection = [...currentRejection, ...newRejections];

    // Update strategy
    await db.update(launchStrategies)
      .set({
        requiredPatterns: updatedRequired.length > 0 ? updatedRequired : null,
        rejectionPatterns: updatedRejection.length > 0 ? updatedRejection : null,
        description: `Enhanced strategy (${new Date().toISOString().split('T')[0]}) - added ${newPatterns.length} patterns, ${newRejections.length} rejections`,
      })
      .where(eq(launchStrategies.id, strategy.id));

    console.log(`🧬 PATTERN-ANALYZER: Enhanced strategy with ${newPatterns.length} new patterns and ${newRejections.length} new rejection criteria`);
  }

  /**
   * Get analysis summary
   */
  async getAnalysisSummary() {
    const analyses = await db.select()
      .from(launchAnalysis)
      .where(eq(launchAnalysis.analysisComplete, true));

    const successes = analyses.filter(a => a.outcomeType === 'success');
    const failures = analyses.filter(a => a.outcomeType === 'failure');

    return {
      totalAnalyses: analyses.length,
      successes: successes.length,
      failures: failures.length,
      successRate: analyses.length > 0 ? successes.length / analyses.length : 0,
      readyForStrategy: analyses.length >= this.minSampleSize,
    };
  }
}

export const launchPatternAnalyzer = new LaunchPatternAnalyzer();
