import { IStorage, storage } from '../storage';

interface MarketHealthMetrics {
  healthScore: number; // 0-100, higher is healthier
  volatility: number; // Market-wide volatility level
  trend: 'bullish' | 'bearish' | 'neutral'; // Overall market direction
  breadth: number; // % of tokens advancing
  volumeHealth: number; // Volume quality score
  correlation: number; // Market correlation strength
  recommendation: 'trade_normally' | 'trade_cautiously' | 'minimize_trading' | 'halt_trading';
  factors: string[];
}

interface TokenMetrics {
  symbol: string;
  priceChange24h: number;
  volumeChange: number;
  price: number;
  volume: number;
}

export class MarketHealthAnalyzer {
  private storage: IStorage;
  private lastHealthCheck: MarketHealthMetrics | null = null;
  private lastCheckTime: Date | null = null;
  private readonly CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes

  constructor(storage: IStorage) {
    this.storage = storage;
  }

  async analyzeMarketHealth(): Promise<MarketHealthMetrics> {
    try {
      // Use cached result if recent
      if (this.lastHealthCheck && this.lastCheckTime) {
        const timeSinceCheck = Date.now() - this.lastCheckTime.getTime();
        if (timeSinceCheck < this.CACHE_DURATION_MS) {
          return this.lastHealthCheck;
        }
      }

      console.log('📊 MARKET-HEALTH: Starting market health analysis...');

      // Get all tokens with recent price data
      const tokens = await this.storage.getAllTokens();
      const tokenMetrics: TokenMetrics[] = [];

    for (const token of tokens) {
      // Get price history from last 48 hours
      const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);
      const priceHistory = await this.storage.getPriceHistory(token.id, fortyEightHoursAgo);
      if (priceHistory.length < 2) continue;

      const currentPrice = parseFloat(priceHistory[priceHistory.length - 1].price);
      const price24hAgo = parseFloat(priceHistory[Math.max(0, priceHistory.length - 24)].price);
      
      // Skip if prices are invalid
      if (!currentPrice || !price24hAgo || isNaN(currentPrice) || isNaN(price24hAgo) || price24hAgo === 0) {
        continue;
      }
      
      const priceChange24h = ((currentPrice - price24hAgo) / price24hAgo) * 100;
      
      // Skip if price change is invalid
      if (isNaN(priceChange24h) || !isFinite(priceChange24h)) {
        continue;
      }

      // Calculate volume metrics
      const recentVolume = priceHistory.slice(-6).reduce((sum, h) => sum + parseFloat(h.volume || '0'), 0) / 6;
      const olderVolume = priceHistory.slice(-24, -6).reduce((sum, h) => sum + parseFloat(h.volume || '0'), 0) / 18;
      const volumeChange = olderVolume > 0 ? ((recentVolume - olderVolume) / olderVolume) * 100 : 0;

      tokenMetrics.push({
        symbol: token.symbol,
        priceChange24h,
        volumeChange,
        price: currentPrice,
        volume: parseFloat(token.volume24h || '0')
      });
    }

      if (tokenMetrics.length < 10) {
        console.warn('⚠️ MARKET-HEALTH: Insufficient data for analysis (<10 tokens)');
        return this.getDefaultHealth('insufficient_data');
      }

      // Calculate health metrics
      const volatility = this.calculateVolatility(tokenMetrics);
      const trend = this.calculateTrend(tokenMetrics);
      const breadth = this.calculateBreadth(tokenMetrics);
      const volumeHealth = this.calculateVolumeHealth(tokenMetrics);
      const correlation = this.calculateCorrelation(tokenMetrics);

      // Calculate overall health score (0-100)
      const healthScore = this.calculateHealthScore({
        volatility,
        trend,
        breadth,
        volumeHealth,
        correlation
      });

      // Determine trading recommendation
      const { recommendation, factors } = this.getRecommendation(healthScore, {
        volatility,
        breadth,
        volumeHealth,
        trend
      });

      const health: MarketHealthMetrics = {
        healthScore,
        volatility,
        trend,
        breadth,
        volumeHealth,
        correlation,
        recommendation,
        factors
      };

      // Cache the result
      this.lastHealthCheck = health;
      this.lastCheckTime = new Date();

      console.log(`📊 MARKET-HEALTH: Score ${healthScore.toFixed(1)}/100 | ${recommendation.toUpperCase()} | Trend: ${trend}`);
      console.log(`   💹 Volatility: ${volatility.toFixed(1)}% | Breadth: ${breadth.toFixed(1)}% | Volume: ${volumeHealth.toFixed(1)}/100`);
      
      return health;
    } catch (error) {
      console.error('❌ MARKET-HEALTH: Error during analysis:', error);
      return this.getDefaultHealth('analysis_error');
    }
  }

  private calculateVolatility(metrics: TokenMetrics[]): number {
    // Calculate market-wide volatility based on price changes
    const priceChanges = metrics
      .map(m => Math.abs(m.priceChange24h))
      .filter(v => isFinite(v) && !isNaN(v)); // Filter out invalid values
    
    if (priceChanges.length === 0) return 0;
    
    const avgVolatility = priceChanges.reduce((sum, v) => sum + v, 0) / priceChanges.length;
    return isFinite(avgVolatility) ? avgVolatility : 0;
  }

  private calculateTrend(metrics: TokenMetrics[]): 'bullish' | 'bearish' | 'neutral' {
    const advancing = metrics.filter(m => m.priceChange24h > 0).length;
    const declining = metrics.filter(m => m.priceChange24h < 0).length;
    const total = metrics.length;

    const advanceRatio = advancing / total;

    if (advanceRatio >= 0.6) return 'bullish';
    if (advanceRatio <= 0.4) return 'bearish';
    return 'neutral';
  }

  private calculateBreadth(metrics: TokenMetrics[]): number {
    // Market breadth: percentage of tokens advancing
    const advancing = metrics.filter(m => m.priceChange24h > 0).length;
    return (advancing / metrics.length) * 100;
  }

  private calculateVolumeHealth(metrics: TokenMetrics[]): number {
    // Volume health: based on volume changes and consistency
    const volumeChanges = metrics.map(m => m.volumeChange);
    const positiveVolume = volumeChanges.filter(v => v > 0).length;
    const volumeRatio = positiveVolume / volumeChanges.length;

    // Calculate volume consistency
    const avgVolumeChange = volumeChanges.reduce((sum, v) => sum + Math.abs(v), 0) / volumeChanges.length;
    const volumeStability = Math.max(0, 100 - avgVolumeChange);

    // Combine ratio and stability
    return (volumeRatio * 50) + (volumeStability * 0.5);
  }

  private calculateCorrelation(metrics: TokenMetrics[]): number {
    // Calculate how correlated the market is (simplified version)
    const priceChanges = metrics.map(m => m.priceChange24h);
    const mean = priceChanges.reduce((sum, v) => sum + v, 0) / priceChanges.length;
    
    // Calculate variance
    const variance = priceChanges.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / priceChanges.length;
    const stdDev = Math.sqrt(variance);

    // Low standard deviation = high correlation (all moving together)
    // High standard deviation = low correlation (divergent movements)
    const correlationScore = Math.max(0, 100 - (stdDev * 2));
    
    return correlationScore;
  }

  private calculateHealthScore(components: {
    volatility: number;
    trend: 'bullish' | 'bearish' | 'neutral';
    breadth: number;
    volumeHealth: number;
    correlation: number;
  }): number {
    let score = 0;

    // Volatility component (0-25 points): Lower volatility is better
    // Ideal: 2-8% volatility = full points
    // High volatility (>15%) reduces score significantly
    if (components.volatility <= 8) {
      score += 25;
    } else if (components.volatility <= 15) {
      score += 25 - ((components.volatility - 8) / 7) * 15; // Lose up to 15 points
    } else {
      score += 10 - Math.min(10, (components.volatility - 15) * 0.5); // Very high volatility
    }

    // Trend component (0-25 points)
    if (components.trend === 'bullish') {
      score += 25;
    } else if (components.trend === 'neutral') {
      score += 15;
    } else {
      score += 5; // Bearish market
    }

    // Breadth component (0-25 points): Based on % advancing
    score += (components.breadth / 100) * 25;

    // Volume health component (0-15 points)
    score += (components.volumeHealth / 100) * 15;

    // Correlation component (0-10 points): Moderate correlation is good
    // Too high = systemic risk, too low = chaos
    if (components.correlation >= 40 && components.correlation <= 70) {
      score += 10; // Healthy correlation
    } else if (components.correlation >= 20 && components.correlation <= 80) {
      score += 5; // Acceptable correlation
    } else {
      score += 0; // Unhealthy correlation
    }

    return Math.max(0, Math.min(100, score));
  }

  private getRecommendation(
    healthScore: number,
    metrics: {
      volatility: number;
      breadth: number;
      volumeHealth: number;
      trend: 'bullish' | 'bearish' | 'neutral';
    }
  ): { recommendation: MarketHealthMetrics['recommendation']; factors: string[] } {
    const factors: string[] = [];

    // Critical conditions that force minimal trading
    if (metrics.volatility > 20) {
      factors.push('Extreme volatility detected');
    }
    if (metrics.breadth < 20 && metrics.trend === 'bearish') {
      factors.push('Severe bearish market breadth');
    }
    if (metrics.volumeHealth < 30) {
      factors.push('Unhealthy volume patterns');
    }

    // Determine recommendation based on health score and critical factors
    if (healthScore >= 70 && factors.length === 0) {
      return {
        recommendation: 'trade_normally',
        factors: ['Market conditions favorable', 'Normal trading activity recommended']
      };
    } else if (healthScore >= 50 && factors.length <= 1) {
      return {
        recommendation: 'trade_cautiously',
        factors: factors.length > 0 ? factors : ['Moderate market conditions', 'Reduced position sizes advised']
      };
    } else if (healthScore >= 30 && factors.length <= 2) {
      return {
        recommendation: 'minimize_trading',
        factors: factors.length > 0 ? factors : ['Poor market conditions', 'Minimal trading activity']
      };
    } else {
      return {
        recommendation: 'halt_trading',
        factors: factors.length > 0 ? factors : ['Critical market conditions', 'Trading halted for safety']
      };
    }
  }

  private getDefaultHealth(reason: string): MarketHealthMetrics {
    return {
      healthScore: 50,
      volatility: 0,
      trend: 'neutral',
      breadth: 50,
      volumeHealth: 50,
      correlation: 50,
      recommendation: 'trade_cautiously',
      factors: [`Market health unavailable: ${reason}`, 'Trading with caution']
    };
  }

  getLastHealthCheck(): MarketHealthMetrics | null {
    return this.lastHealthCheck;
  }

  shouldTrade(confidence: number): boolean {
    if (!this.lastHealthCheck) {
      return confidence >= 85; // Very high bar if no health data
    }

    const { recommendation, healthScore } = this.lastHealthCheck;

    switch (recommendation) {
      case 'trade_normally':
        return confidence >= 80; // Normal threshold
      case 'trade_cautiously':
        return confidence >= 85; // Higher threshold
      case 'minimize_trading':
        return confidence >= 90; // Very high threshold
      case 'halt_trading':
        return false; // No trading
      default:
        return confidence >= 85;
    }
  }

  getPositionSizeMultiplier(): number {
    if (!this.lastHealthCheck) {
      return 0.5; // Conservative if no health data
    }

    const { recommendation, healthScore } = this.lastHealthCheck;

    switch (recommendation) {
      case 'trade_normally':
        return 1.0; // Full position size
      case 'trade_cautiously':
        return 0.6; // 60% position size
      case 'minimize_trading':
        return 0.3; // 30% position size
      case 'halt_trading':
        return 0; // No trading
      default:
        return 0.5;
    }
  }
}

// Export singleton instance
export const marketHealthAnalyzer = new MarketHealthAnalyzer();
