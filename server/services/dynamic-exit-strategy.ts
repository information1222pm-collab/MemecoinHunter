import type { PriceHistory, Trade } from '@shared/schema';
import { chartAnalyzer, type TrailingStop } from './chart-analyzer';

export interface ExitStrategy {
  type: 'fixed' | 'trailing' | 'volatility_based' | 'trend_based' | 'hybrid';
  stopLoss: number;
  takeProfitLevels: number[];
  trailingStopActivated: boolean;
  trailingStopPrice?: number;
  dynamicAdjustments: string[];
}

export interface RiskRewardAnalysis {
  riskAmount: number;
  rewardAmount: number;
  ratio: number;
  quality: 'excellent' | 'good' | 'acceptable' | 'poor';
  shouldTake: boolean;
  confidenceAdjustment: number;
}

export class DynamicExitStrategyService {
  
  /**
   * Generate optimal exit strategy based on market conditions
   */
  generateExitStrategy(
    entryPrice: number,
    history: PriceHistory[],
    volatility: number,
    trendStrength: number
  ): ExitStrategy {
    const prices = history.map(h => parseFloat(h.price));
    const currentPrice = prices[prices.length - 1];
    
    // Get chart analysis
    const signal = chartAnalyzer.generateEntryExitSignal(history);
    const srLevels = chartAnalyzer.identifySupportResistance(history);
    const fib = chartAnalyzer.calculateFibonacciLevels(history);
    
    let stopLoss = entryPrice * 0.95; // Default 5% stop loss
    let takeProfitLevels: number[] = [];
    let type: ExitStrategy['type'] = 'fixed';
    const dynamicAdjustments: string[] = [];
    
    // Adjust based on volatility
    if (volatility > 5) {
      // High volatility - wider stops
      stopLoss = entryPrice * 0.93; // 7% stop loss
      dynamicAdjustments.push(`Widened stop-loss to 7% due to high volatility (${volatility.toFixed(1)}%)`);
      type = 'volatility_based';
    } else if (volatility < 2) {
      // Low volatility - tighter stops
      stopLoss = entryPrice * 0.97; // 3% stop loss
      dynamicAdjustments.push(`Tightened stop-loss to 3% due to low volatility (${volatility.toFixed(1)}%)`);
      type = 'volatility_based';
    }
    
    // Adjust based on trend strength
    if (trendStrength > 70) {
      // Strong trend - use trailing stop
      type = 'trailing';
      dynamicAdjustments.push(`Activated trailing stop due to strong trend (${trendStrength.toFixed(1)}%)`);
    }
    
    // Use support levels for stop loss (below entry)
    const supportBelow = srLevels
      .filter(l => l.type === 'support' && l.price < entryPrice)
      .sort((a, b) => b.price - a.price)[0];
    
    if (supportBelow && supportBelow.price > stopLoss) {
      stopLoss = supportBelow.price * 0.98; // Just below support
      dynamicAdjustments.push(`Stop-loss placed below support at $${supportBelow.price.toFixed(6)}`);
    }
    
    // Use resistance levels for take profit
    const resistancesAbove = srLevels
      .filter(l => l.type === 'resistance' && l.price > entryPrice)
      .sort((a, b) => a.price - b.price)
      .slice(0, 3);
    
    if (resistancesAbove.length > 0) {
      takeProfitLevels = resistancesAbove.map(r => r.price);
      dynamicAdjustments.push(`Take-profit levels set at resistance zones`);
    } else {
      // Use Fibonacci targets
      takeProfitLevels = fib.exitLevels.filter(e => e > entryPrice).slice(0, 3);
      dynamicAdjustments.push(`Take-profit levels set using Fibonacci extensions`);
    }
    
    // Ensure minimum risk-reward ratio of 1.5:1
    if (takeProfitLevels.length > 0) {
      const firstTarget = takeProfitLevels[0];
      const potentialReward = firstTarget - entryPrice;
      const risk = entryPrice - stopLoss;
      const ratio = potentialReward / risk;
      
      if (ratio < 1.5) {
        // Adjust first target to meet minimum R:R
        takeProfitLevels[0] = entryPrice + (risk * 1.5);
        dynamicAdjustments.push(`Adjusted first target to achieve minimum 1.5:1 risk-reward ratio`);
      }
    }
    
    // Use hybrid strategy for best results
    if (trendStrength > 50 && volatility > 2 && volatility < 5) {
      type = 'hybrid';
      dynamicAdjustments.push(`Using hybrid strategy combining trailing stops and fixed targets`);
    }
    
    return {
      type,
      stopLoss,
      takeProfitLevels,
      trailingStopActivated: type === 'trailing' || type === 'hybrid',
      dynamicAdjustments
    };
  }
  
  /**
   * Update trailing stop for an active position
   */
  updateTrailingStop(
    trade: Trade,
    currentPrice: number,
    highestPrice: number,
    trailPercentage: number = 5
  ): TrailingStop {
    return chartAnalyzer.calculateTrailingStop(
      parseFloat(trade.price),
      currentPrice,
      highestPrice,
      trailPercentage
    );
  }
  
  /**
   * Analyze risk-reward ratio for a trade
   */
  analyzeRiskReward(
    entryPrice: number,
    stopLoss: number,
    takeProfit: number,
    positionSize: number
  ): RiskRewardAnalysis {
    const riskAmount = (entryPrice - stopLoss) * positionSize;
    const rewardAmount = (takeProfit - entryPrice) * positionSize;
    const ratio = riskAmount > 0 ? rewardAmount / riskAmount : 0;
    
    let quality: RiskRewardAnalysis['quality'] = 'poor';
    let shouldTake = false;
    let confidenceAdjustment = 0;
    
    if (ratio >= 3) {
      quality = 'excellent';
      shouldTake = true;
      confidenceAdjustment = 15; // Boost confidence by 15%
    } else if (ratio >= 2) {
      quality = 'good';
      shouldTake = true;
      confidenceAdjustment = 10; // Boost confidence by 10%
    } else if (ratio >= 1.5) {
      quality = 'acceptable';
      shouldTake = true;
      confidenceAdjustment = 5; // Boost confidence by 5%
    } else {
      quality = 'poor';
      shouldTake = false;
      confidenceAdjustment = -20; // Reduce confidence by 20%
    }
    
    return {
      riskAmount,
      rewardAmount,
      ratio,
      quality,
      shouldTake,
      confidenceAdjustment
    };
  }
  
  /**
   * Determine optimal exit timing based on price action
   */
  shouldExitNow(
    entryPrice: number,
    currentPrice: number,
    history: PriceHistory[],
    exitStrategy: ExitStrategy
  ): {
    shouldExit: boolean;
    reason: string;
    exitType: 'stop_loss' | 'take_profit' | 'trailing_stop' | 'market_condition';
  } {
    // Check stop loss
    if (currentPrice <= exitStrategy.stopLoss) {
      return {
        shouldExit: true,
        reason: `Stop-loss triggered at $${currentPrice.toFixed(6)}`,
        exitType: 'stop_loss'
      };
    }
    
    // Check take profit levels
    for (let i = 0; i < exitStrategy.takeProfitLevels.length; i++) {
      if (currentPrice >= exitStrategy.takeProfitLevels[i]) {
        return {
          shouldExit: true,
          reason: `Take-profit level ${i + 1} reached at $${currentPrice.toFixed(6)}`,
          exitType: 'take_profit'
        };
      }
    }
    
    // Check trailing stop
    if (exitStrategy.trailingStopActivated && exitStrategy.trailingStopPrice) {
      if (currentPrice <= exitStrategy.trailingStopPrice) {
        return {
          shouldExit: true,
          reason: `Trailing stop triggered at $${currentPrice.toFixed(6)}`,
          exitType: 'trailing_stop'
        };
      }
    }
    
    // Check chart patterns for exit signals
    const signal = chartAnalyzer.generateEntryExitSignal(history);
    if (signal.action === 'sell' && signal.confidence > 75) {
      return {
        shouldExit: true,
        reason: `Bearish signal detected: ${signal.reasoning.join(', ')}`,
        exitType: 'market_condition'
      };
    }
    
    return {
      shouldExit: false,
      reason: 'Continue holding position',
      exitType: 'market_condition'
    };
  }
  
  /**
   * Calculate partial exit levels for scaling out
   */
  calculateScaleOutLevels(
    entryPrice: number,
    finalTarget: number,
    numLevels: number = 3
  ): { percentage: number; price: number }[] {
    const totalGain = finalTarget - entryPrice;
    const levels = [];
    
    // Common scale-out percentages
    const scaleOutPercentages = [
      { level: 0.3, percentage: 30 }, // 30% at 30% of the way
      { level: 0.5, percentage: 40 }, // 40% at 50% of the way  
      { level: 1.0, percentage: 30 }  // 30% at final target
    ];
    
    for (const scale of scaleOutPercentages.slice(0, numLevels)) {
      levels.push({
        percentage: scale.percentage,
        price: entryPrice + (totalGain * scale.level)
      });
    }
    
    return levels;
  }
  
  /**
   * Assess trade quality before execution
   */
  assessTradeQuality(
    entryPrice: number,
    history: PriceHistory[],
    confidence: number
  ): {
    score: number; // 0-100
    recommendation: 'strong_buy' | 'buy' | 'hold' | 'avoid';
    factors: string[];
  } {
    const factors: string[] = [];
    let score = confidence;
    
    const signal = chartAnalyzer.generateEntryExitSignal(history);
    const patterns = chartAnalyzer.detectChartPatterns(history);
    
    // Check risk-reward ratio
    if (signal.riskRewardRatio >= 2) {
      score += 15;
      factors.push(`Excellent risk-reward ratio: ${signal.riskRewardRatio.toFixed(2)}:1`);
    } else if (signal.riskRewardRatio < 1.5) {
      score -= 20;
      factors.push(`Poor risk-reward ratio: ${signal.riskRewardRatio.toFixed(2)}:1`);
    }
    
    // Check support/resistance proximity
    if (signal.supportLevels.length > 0) {
      const nearSupport = signal.supportLevels.some(s => 
        Math.abs(entryPrice - s) / s < 0.02
      );
      if (nearSupport) {
        score += 10;
        factors.push('Entry near strong support level');
      }
    }
    
    // Check chart patterns
    const highConfidencePattern = patterns.find(p => p.confidence > 75);
    if (highConfidencePattern) {
      score += 10;
      factors.push(`${highConfidencePattern.type.replace(/_/g, ' ')} pattern confirmed`);
    }
    
    // Multiple confirmation factors
    const confirmations = signal.reasoning.length;
    if (confirmations >= 3) {
      score += 10;
      factors.push(`${confirmations} technical confirmations aligned`);
    }
    
    // Determine recommendation
    let recommendation: 'strong_buy' | 'buy' | 'hold' | 'avoid';
    if (score >= 85) {
      recommendation = 'strong_buy';
    } else if (score >= 70) {
      recommendation = 'buy';
    } else if (score >= 55) {
      recommendation = 'hold';
    } else {
      recommendation = 'avoid';
    }
    
    return {
      score: Math.min(score, 100),
      recommendation,
      factors
    };
  }
}

export const dynamicExitStrategy = new DynamicExitStrategyService();
