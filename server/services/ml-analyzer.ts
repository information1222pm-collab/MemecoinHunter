import { EventEmitter } from 'events';
import { storage } from '../storage';
import type { Token, PriceHistory, InsertPattern } from '@shared/schema';

interface TechnicalIndicators {
  sma: number[];
  ema: number[];
  rsi: number;
  volume: number[];
  volatility: number;
  macd: { macdLine: number[]; signalLine: number[]; histogram: number[] };
  bollingerBands: { upper: number[]; middle: number[]; lower: number[] };
  stochastic: { k: number[]; d: number[] };
  momentum: number[];
  priceVelocity: number[];
}

interface MarketSentiment {
  priceAcceleration: number;
  volumeWeightedPrice: number;
  marketRegime: 'bullish' | 'bearish' | 'sideways';
  trendStrength: number;
  volatilityRegime: 'low' | 'medium' | 'high';
}

interface MLFeatures {
  technicalFeatures: number[];
  sentimentFeatures: number[];
  patternFeatures: number[];
  momentumFeatures: number[];
}

class MLAnalyzer extends EventEmitter {
  private isRunning = false;
  private analysisInterval?: NodeJS.Timeout;

  start() {
    if (this.isRunning) return;
    
    this.isRunning = true;
    console.log('🤖 ML Pattern Analyzer started');
    
    // Analyze every 2 minutes
    this.analysisInterval = setInterval(() => {
      this.analyzePatterns();
    }, 120000);
    
    // Initial analysis
    this.analyzePatterns();
  }

  stop() {
    if (!this.isRunning) return;
    
    this.isRunning = false;
    if (this.analysisInterval) {
      clearInterval(this.analysisInterval);
    }
    console.log('🛑 ML Pattern Analyzer stopped');
  }

  private async analyzePatterns() {
    try {
      const tokens = await storage.getActiveTokens();
      
      for (const token of tokens) {
        await this.analyzeTokenPatterns(token);
      }
      
      console.log(`🧠 Analyzed patterns for ${tokens.length} tokens`);
    } catch (error) {
      console.error('Error analyzing patterns:', error);
    }
  }

  private async analyzeTokenPatterns(token: Token) {
    try {
      // Get price history for the last 24 hours
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const history = await storage.getPriceHistory(token.id, oneDayAgo);
      
      if (history.length < 20) return; // Need at least 20 data points
      
      const indicators = this.calculateTechnicalIndicators(history);
      const patterns = this.detectPatterns(history, indicators);
      
      for (const pattern of patterns) {
        await this.savePattern(token.id, pattern);
      }
      
    } catch (error) {
      console.error(`Error analyzing patterns for ${token.symbol}:`, error);
    }
  }

  private calculateTechnicalIndicators(history: PriceHistory[]): TechnicalIndicators {
    const prices = history.map(h => parseFloat(h.price)).reverse();
    const volumes = history.map(h => parseFloat(h.volume || '0')).reverse();
    
    return {
      sma: this.calculateSMA(prices, 10),
      ema: this.calculateEMA(prices, 10),
      rsi: this.calculateRSI(prices, 14),
      volume: volumes,
      volatility: this.calculateVolatility(prices),
      macd: this.calculateMACD(prices),
      bollingerBands: this.calculateBollingerBands(prices, 20, 2),
      stochastic: this.calculateStochastic(prices, 14),
      momentum: this.calculateMomentum(prices, 10),
      priceVelocity: this.calculatePriceVelocity(prices),
    };
  }

  private calculateSMA(prices: number[], period: number): number[] {
    const sma: number[] = [];
    
    for (let i = period - 1; i < prices.length; i++) {
      const sum = prices.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
      sma.push(sum / period);
    }
    
    return sma;
  }

  private calculateEMA(prices: number[], period: number): number[] {
    const ema: number[] = [];
    const multiplier = 2 / (period + 1);
    
    ema[0] = prices[0];
    
    for (let i = 1; i < prices.length; i++) {
      ema[i] = (prices[i] * multiplier) + (ema[i - 1] * (1 - multiplier));
    }
    
    return ema;
  }

  private calculateRSI(prices: number[], period: number): number {
    if (prices.length < period + 1) return 50;
    
    let gains = 0;
    let losses = 0;
    
    for (let i = 1; i <= period; i++) {
      const change = prices[i] - prices[i - 1];
      if (change > 0) {
        gains += change;
      } else {
        losses -= change;
      }
    }
    
    const avgGain = gains / period;
    const avgLoss = losses / period;
    
    if (avgLoss === 0) return 100;
    
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
  }

  private calculateVolatility(prices: number[]): number {
    if (prices.length < 2) return 0;
    
    const returns = [];
    for (let i = 1; i < prices.length; i++) {
      returns.push((prices[i] - prices[i - 1]) / prices[i - 1]);
    }
    
    const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
    
    return Math.sqrt(variance) * 100; // Convert to percentage
  }

  private detectPatterns(history: PriceHistory[], indicators: TechnicalIndicators): Array<{
    type: string;
    confidence: number;
    timeframe: string;
    metadata: any;
  }> {
    const patterns = [];
    const prices = history.map(h => parseFloat(h.price)).reverse();
    const volumes = history.map(h => parseFloat(h.volume || '0')).reverse();
    
    // Calculate market sentiment
    const sentiment = this.calculateMarketSentiment(prices, volumes, indicators);
    
    // Extract ML features
    const features = this.extractMLFeatures(prices, volumes, indicators, sentiment);
    
    // Advanced pattern detection using ML features
    const mlPatterns = this.detectMLPatterns(features, prices, indicators);
    patterns.push(...mlPatterns);
    
    // Enhanced traditional patterns with ML scoring
    const enhancedPatterns = this.detectEnhancedPatterns(prices, volumes, indicators, sentiment);
    patterns.push(...enhancedPatterns);
    
    // Momentum-based patterns
    const momentumPatterns = this.detectMomentumPatterns(indicators, sentiment);
    patterns.push(...momentumPatterns);
    
    return patterns.filter(p => p.confidence > 65); // Higher threshold for better quality
  }

  private detectBullFlag(prices: number[], volumes: number[]): { confidence: number; metadata: any } {
    if (prices.length < 20) return { confidence: 0, metadata: {} };
    
    const recent = prices.slice(-10);
    const earlier = prices.slice(-20, -10);
    
    // Check for initial strong upward movement
    const initialMove = (Math.max(...earlier) - Math.min(...earlier)) / Math.min(...earlier);
    
    // Check for consolidation in recent prices
    const recentVolatility = this.calculateVolatility(recent);
    const earlierVolatility = this.calculateVolatility(earlier);
    
    let confidence = 0;
    
    if (initialMove > 0.2) confidence += 30; // 20%+ initial move
    if (recentVolatility < earlierVolatility * 0.7) confidence += 40; // Consolidation
    if (volumes.slice(-5).every((v, i) => i === 0 || v >= volumes[volumes.length - 6 + i])) {
      confidence += 17; // Volume confirmation
    }
    
    return {
      confidence: Math.min(confidence, 95),
      metadata: {
        initialMove: initialMove * 100,
        consolidationStrength: ((earlierVolatility - recentVolatility) / earlierVolatility) * 100,
      },
    };
  }

  private detectDoubleBottom(prices: number[]): { confidence: number; metadata: any } {
    if (prices.length < 20) return { confidence: 0, metadata: {} };
    
    // Find local minima
    const minima = this.findLocalMinima(prices);
    
    if (minima.length < 2) return { confidence: 0, metadata: {} };
    
    const lastTwo = minima.slice(-2);
    const [first, second] = lastTwo;
    
    // Check if the two bottoms are at similar levels
    const priceDiff = Math.abs(prices[first] - prices[second]) / prices[first];
    
    let confidence = 0;
    
    if (priceDiff < 0.05) confidence += 50; // Bottoms within 5%
    if (second - first > 5) confidence += 30; // Adequate time between bottoms
    if (prices[second] > prices[first] * 0.95) confidence += 20; // Second bottom not much lower
    
    return {
      confidence: Math.min(confidence, 95),
      metadata: {
        firstBottom: first,
        secondBottom: second,
        priceDifference: priceDiff * 100,
      },
    };
  }

  private detectVolumeSpike(volumes: number[]): { confidence: number; metadata: any } {
    if (volumes.length < 10) return { confidence: 0, metadata: {} };
    
    const recent = volumes.slice(-3);
    const baseline = volumes.slice(-10, -3);
    
    const avgRecent = recent.reduce((sum, v) => sum + v, 0) / recent.length;
    const avgBaseline = baseline.reduce((sum, v) => sum + v, 0) / baseline.length;
    
    if (avgBaseline === 0) return { confidence: 0, metadata: {} };
    
    const volumeIncrease = (avgRecent - avgBaseline) / avgBaseline;
    
    let confidence = 0;
    
    if (volumeIncrease > 2) confidence += 60; // 200%+ increase
    if (volumeIncrease > 4) confidence += 32; // 400%+ increase
    
    return {
      confidence: Math.min(confidence, 95),
      metadata: {
        volumeIncrease: volumeIncrease * 100,
        avgRecent,
        avgBaseline,
      },
    };
  }

  private detectRSIDivergence(prices: number[], rsi: number): { confidence: number; metadata: any } {
    if (prices.length < 20) return { confidence: 0, metadata: {} };
    
    // Simple RSI overbought/oversold detection
    let confidence = 0;
    let signal = 'neutral';
    
    if (rsi > 70) {
      confidence = 75;
      signal = 'overbought';
    } else if (rsi < 30) {
      confidence = 75;
      signal = 'oversold';
    }
    
    return {
      confidence,
      metadata: {
        rsi,
        signal,
        interpretation: rsi > 70 ? 'Potential bearish reversal' : rsi < 30 ? 'Potential bullish reversal' : 'Neutral',
      },
    };
  }

  private findLocalMinima(prices: number[]): number[] {
    const minima = [];
    
    for (let i = 1; i < prices.length - 1; i++) {
      if (prices[i] < prices[i - 1] && prices[i] < prices[i + 1]) {
        minima.push(i);
      }
    }
    
    return minima;
  }

  // Advanced ML and Technical Analysis Methods
  
  private calculateMACD(prices: number[], fastPeriod: number = 12, slowPeriod: number = 26, signalPeriod: number = 9): { macdLine: number[]; signalLine: number[]; histogram: number[] } {
    const fastEMA = this.calculateEMA(prices, fastPeriod);
    const slowEMA = this.calculateEMA(prices, slowPeriod);
    
    const macdLine = fastEMA.map((fast, i) => fast - (slowEMA[i] || 0));
    const signalLine = this.calculateEMA(macdLine, signalPeriod);
    const histogram = macdLine.map((macd, i) => macd - (signalLine[i] || 0));
    
    return { macdLine, signalLine, histogram };
  }
  
  private calculateBollingerBands(prices: number[], period: number = 20, stdDev: number = 2): { upper: number[]; middle: number[]; lower: number[] } {
    const sma = this.calculateSMA(prices, period);
    const upper: number[] = [];
    const lower: number[] = [];
    
    for (let i = period - 1; i < prices.length; i++) {
      const slice = prices.slice(i - period + 1, i + 1);
      const mean = slice.reduce((a, b) => a + b, 0) / slice.length;
      const variance = slice.reduce((sum, price) => sum + Math.pow(price - mean, 2), 0) / slice.length;
      const std = Math.sqrt(variance);
      
      upper.push(sma[i - period + 1] + (stdDev * std));
      lower.push(sma[i - period + 1] - (stdDev * std));
    }
    
    return { upper, middle: sma, lower };
  }
  
  private calculateStochastic(prices: number[], period: number = 14): { k: number[]; d: number[] } {
    const k: number[] = [];
    
    for (let i = period - 1; i < prices.length; i++) {
      const slice = prices.slice(i - period + 1, i + 1);
      const highest = Math.max(...slice);
      const lowest = Math.min(...slice);
      const current = prices[i];
      
      if (highest === lowest) {
        k.push(50); // Avoid division by zero
      } else {
        k.push(((current - lowest) / (highest - lowest)) * 100);
      }
    }
    
    const d = this.calculateSMA(k, 3); // 3-period SMA of %K
    
    return { k, d };
  }
  
  private calculateMomentum(prices: number[], period: number = 10): number[] {
    const momentum: number[] = [];
    
    for (let i = period; i < prices.length; i++) {
      momentum.push(((prices[i] - prices[i - period]) / prices[i - period]) * 100);
    }
    
    return momentum;
  }
  
  private calculatePriceVelocity(prices: number[]): number[] {
    const velocity: number[] = [];
    
    for (let i = 1; i < prices.length; i++) {
      velocity.push(prices[i] - prices[i - 1]);
    }
    
    return velocity;
  }
  
  private calculateMarketSentiment(prices: number[], volumes: number[], indicators: TechnicalIndicators): MarketSentiment {
    // Price acceleration (second derivative)
    const velocity = this.calculatePriceVelocity(prices);
    const acceleration = this.calculatePriceVelocity(velocity);
    const priceAcceleration = acceleration.length > 0 ? acceleration[acceleration.length - 1] : 0;
    
    // Volume-weighted average price
    const totalVolume = volumes.reduce((sum, v) => sum + v, 0);
    const volumeWeightedPrice = totalVolume > 0 ? 
      prices.reduce((sum, price, i) => sum + (price * volumes[i]), 0) / totalVolume : 0;
    
    // Market regime detection
    const shortMA = indicators.sma.length > 5 ? indicators.sma[indicators.sma.length - 1] : 0;
    const longMA = indicators.sma.length > 20 ? indicators.sma[indicators.sma.length - 20] : 0;
    const currentPrice = prices[prices.length - 1];
    
    let marketRegime: 'bullish' | 'bearish' | 'sideways' = 'sideways';
    if (currentPrice > shortMA && shortMA > longMA) {
      marketRegime = 'bullish';
    } else if (currentPrice < shortMA && shortMA < longMA) {
      marketRegime = 'bearish';
    }
    
    // Trend strength using ADX-like calculation
    const trendStrength = this.calculateTrendStrength(prices);
    
    // Volatility regime
    const volatilityRegime = indicators.volatility > 5 ? 'high' : indicators.volatility > 2 ? 'medium' : 'low';
    
    return {
      priceAcceleration,
      volumeWeightedPrice,
      marketRegime,
      trendStrength,
      volatilityRegime,
    };
  }
  
  private calculateTrendStrength(prices: number[]): number {
    if (prices.length < 14) return 0;
    
    const period = 14;
    let sumDM = 0;
    let sumTR = 0;
    
    for (let i = 1; i < period && i < prices.length; i++) {
      const high = prices[i];
      const low = prices[i];
      const prevClose = prices[i - 1];
      
      const trueRange = Math.max(
        high - low,
        Math.abs(high - prevClose),
        Math.abs(low - prevClose)
      );
      
      const directionalMove = Math.abs(prices[i] - prices[i - 1]);
      
      sumDM += directionalMove;
      sumTR += trueRange;
    }
    
    return sumTR > 0 ? (sumDM / sumTR) * 100 : 0;
  }
  
  private extractMLFeatures(prices: number[], volumes: number[], indicators: TechnicalIndicators, sentiment: MarketSentiment): MLFeatures {
    const technicalFeatures = [
      indicators.rsi,
      indicators.volatility,
      indicators.macd.macdLine[indicators.macd.macdLine.length - 1] || 0,
      indicators.stochastic.k[indicators.stochastic.k.length - 1] || 0,
      indicators.momentum[indicators.momentum.length - 1] || 0,
    ];
    
    const sentimentFeatures = [
      sentiment.priceAcceleration,
      sentiment.volumeWeightedPrice,
      sentiment.trendStrength,
      sentiment.marketRegime === 'bullish' ? 1 : sentiment.marketRegime === 'bearish' ? -1 : 0,
      sentiment.volatilityRegime === 'high' ? 1 : sentiment.volatilityRegime === 'medium' ? 0.5 : 0,
    ];
    
    const patternFeatures = [
      this.calculateSupporResistanceStrength(prices),
      this.calculateBreakoutPotential(prices, volumes),
      this.calculateVolumeProfile(volumes),
    ];
    
    const momentumFeatures = [
      this.calculateMomentumDivergence(prices, indicators.rsi),
      this.calculateVolumeWeightedMomentum(prices, volumes),
      this.calculatePriceVolumeCorrelation(prices, volumes),
    ];
    
    return {
      technicalFeatures,
      sentimentFeatures,
      patternFeatures,
      momentumFeatures,
    };
  }
  
  private calculateSupporResistanceStrength(prices: number[]): number {
    const currentPrice = prices[prices.length - 1];
    const recentPrices = prices.slice(-20);
    
    let supportCount = 0;
    let resistanceCount = 0;
    
    recentPrices.forEach(price => {
      if (Math.abs(price - currentPrice) / currentPrice < 0.02) { // Within 2%
        if (price < currentPrice) supportCount++;
        else resistanceCount++;
      }
    });
    
    return (supportCount + resistanceCount) / recentPrices.length;
  }
  
  private calculateBreakoutPotential(prices: number[], volumes: number[]): number {
    if (prices.length < 10 || volumes.length < 10) return 0;
    
    const recentPrices = prices.slice(-10);
    const recentVolumes = volumes.slice(-10);
    
    const priceRange = Math.max(...recentPrices) - Math.min(...recentPrices);
    const averageVolume = recentVolumes.reduce((sum, v) => sum + v, 0) / recentVolumes.length;
    const currentVolume = recentVolumes[recentVolumes.length - 1];
    
    const priceCompression = 1 - (priceRange / prices[prices.length - 1]);
    const volumeIncrease = averageVolume > 0 ? currentVolume / averageVolume : 0;
    
    return (priceCompression * 0.7) + (Math.min(volumeIncrease, 3) * 0.3);
  }
  
  private calculateVolumeProfile(volumes: number[]): number {
    if (volumes.length < 10) return 0;
    
    const recentVolumes = volumes.slice(-10);
    const averageVolume = recentVolumes.reduce((sum, v) => sum + v, 0) / recentVolumes.length;
    const volumeStdDev = Math.sqrt(
      recentVolumes.reduce((sum, v) => sum + Math.pow(v - averageVolume, 2), 0) / recentVolumes.length
    );
    
    return averageVolume > 0 ? volumeStdDev / averageVolume : 0;
  }
  
  private calculateMomentumDivergence(prices: number[], rsi: number): number {
    if (prices.length < 10) return 0;
    
    const recentPrices = prices.slice(-5);
    const priceChange = (recentPrices[recentPrices.length - 1] - recentPrices[0]) / recentPrices[0];
    
    // Simplified divergence: price goes up but RSI suggests overbought (or vice versa)
    if (priceChange > 0 && rsi > 70) return 0.8; // Bearish divergence
    if (priceChange < 0 && rsi < 30) return 0.8; // Bullish divergence
    
    return 0;
  }
  
  private calculateVolumeWeightedMomentum(prices: number[], volumes: number[]): number {
    if (prices.length < 5 || volumes.length < 5) return 0;
    
    const recent = Math.min(5, prices.length);
    let weightedMomentum = 0;
    let totalVolume = 0;
    
    for (let i = prices.length - recent; i < prices.length - 1; i++) {
      const priceChange = prices[i + 1] - prices[i];
      const volume = volumes[i];
      weightedMomentum += priceChange * volume;
      totalVolume += volume;
    }
    
    return totalVolume > 0 ? weightedMomentum / totalVolume : 0;
  }
  
  private calculatePriceVolumeCorrelation(prices: number[], volumes: number[]): number {
    if (prices.length < 10 || volumes.length < 10) return 0;
    
    const n = Math.min(prices.length, volumes.length, 20);
    const recentPrices = prices.slice(-n);
    const recentVolumes = volumes.slice(-n);
    
    const avgPrice = recentPrices.reduce((sum, p) => sum + p, 0) / n;
    const avgVolume = recentVolumes.reduce((sum, v) => sum + v, 0) / n;
    
    let covariance = 0;
    let priceVariance = 0;
    let volumeVariance = 0;
    
    for (let i = 0; i < n; i++) {
      const priceDiff = recentPrices[i] - avgPrice;
      const volumeDiff = recentVolumes[i] - avgVolume;
      
      covariance += priceDiff * volumeDiff;
      priceVariance += priceDiff * priceDiff;
      volumeVariance += volumeDiff * volumeDiff;
    }
    
    const denominator = Math.sqrt(priceVariance * volumeVariance);
    return denominator > 0 ? covariance / denominator : 0;
  }
  
  private detectMLPatterns(features: MLFeatures, prices: number[], indicators: TechnicalIndicators): Array<{type: string; confidence: number; timeframe: string; metadata: any}> {
    const patterns = [];
    
    // ML-based breakout pattern
    const breakoutScore = this.calculateMLBreakoutScore(features);
    if (breakoutScore > 0.7) {
      patterns.push({
        type: 'ml_breakout',
        confidence: Math.min(breakoutScore * 100, 95),
        timeframe: '1h',
        metadata: {
          technicalScore: features.technicalFeatures.reduce((sum, f) => sum + f, 0) / features.technicalFeatures.length,
          sentimentScore: features.sentimentFeatures.reduce((sum, f) => sum + f, 0) / features.sentimentFeatures.length,
          momentumScore: features.momentumFeatures.reduce((sum, f) => sum + f, 0) / features.momentumFeatures.length,
        },
      });
    }
    
    // ML-based reversal pattern
    const reversalScore = this.calculateMLReversalScore(features);
    if (reversalScore > 0.7) {
      patterns.push({
        type: 'ml_reversal',
        confidence: Math.min(reversalScore * 100, 95),
        timeframe: '2h',
        metadata: {
          divergenceStrength: features.momentumFeatures[0],
          volumePattern: features.patternFeatures[2],
          trendExhaustion: features.sentimentFeatures[2],
        },
      });
    }
    
    // Advanced momentum pattern
    const momentumScore = this.calculateAdvancedMomentumScore(features, indicators);
    if (momentumScore > 0.75) {
      patterns.push({
        type: 'advanced_momentum',
        confidence: Math.min(momentumScore * 100, 95),
        timeframe: '30m',
        metadata: {
          momentumStrength: features.momentumFeatures[1],
          volumeConfirmation: features.momentumFeatures[2],
          technicalAlignment: features.technicalFeatures[4],
        },
      });
    }
    
    return patterns;
  }
  
  private calculateMLBreakoutScore(features: MLFeatures): number {
    // Weighted scoring based on multiple ML features
    const technicalWeight = 0.3;
    const sentimentWeight = 0.25;
    const patternWeight = 0.25;
    const momentumWeight = 0.2;
    
    const technicalScore = this.normalizeFeatures(features.technicalFeatures);
    const sentimentScore = this.normalizeFeatures(features.sentimentFeatures);
    const patternScore = this.normalizeFeatures(features.patternFeatures);
    const momentumScore = this.normalizeFeatures(features.momentumFeatures);
    
    return (technicalScore * technicalWeight) + 
           (sentimentScore * sentimentWeight) + 
           (patternScore * patternWeight) + 
           (momentumScore * momentumWeight);
  }
  
  private calculateMLReversalScore(features: MLFeatures): number {
    // Focus on divergence and extreme conditions
    const divergenceWeight = 0.4;
    const extremeWeight = 0.3;
    const volumeWeight = 0.3;
    
    const divergenceScore = Math.abs(features.momentumFeatures[0]); // Momentum divergence
    const extremeScore = features.technicalFeatures[0] > 70 || features.technicalFeatures[0] < 30 ? 1 : 0; // RSI extreme
    const volumeScore = features.patternFeatures[2]; // Volume profile
    
    return (divergenceScore * divergenceWeight) + 
           (extremeScore * extremeWeight) + 
           (volumeScore * volumeWeight);
  }
  
  private calculateAdvancedMomentumScore(features: MLFeatures, indicators: TechnicalIndicators): number {
    // Multi-timeframe momentum analysis
    const macdStrength = Math.abs(indicators.macd.histogram[indicators.macd.histogram.length - 1] || 0);
    const volumeMomentum = features.momentumFeatures[1];
    const priceVolumeCorr = Math.abs(features.momentumFeatures[2]);
    
    const normalizedMACD = Math.min(macdStrength / 10, 1); // Normalize MACD
    const normalizedVolume = Math.min(Math.abs(volumeMomentum) / 100, 1);
    
    return (normalizedMACD * 0.4) + (normalizedVolume * 0.3) + (priceVolumeCorr * 0.3);
  }
  
  private normalizeFeatures(features: number[]): number {
    if (features.length === 0) return 0;
    
    const sum = features.reduce((sum, f) => sum + Math.abs(f), 0);
    return Math.min(sum / (features.length * 100), 1); // Normalize to 0-1 range
  }
  
  private detectEnhancedPatterns(prices: number[], volumes: number[], indicators: TechnicalIndicators, sentiment: MarketSentiment): Array<{type: string; confidence: number; timeframe: string; metadata: any}> {
    const patterns = [];
    
    // Enhanced Bull Flag with ML scoring
    const bullFlag = this.detectBullFlag(prices, volumes);
    if (bullFlag.confidence > 50) {
      const mlEnhancement = sentiment.marketRegime === 'bullish' ? 20 : 0;
      const volumeEnhancement = sentiment.volatilityRegime === 'medium' ? 15 : 0;
      
      patterns.push({
        type: 'enhanced_bull_flag',
        confidence: Math.min(bullFlag.confidence + mlEnhancement + volumeEnhancement, 95),
        timeframe: '1h',
        metadata: {
          ...bullFlag.metadata,
          marketRegime: sentiment.marketRegime,
          trendStrength: sentiment.trendStrength,
        },
      });
    }
    
    // Enhanced Volume Analysis
    const volumeSpike = this.detectVolumeSpike(volumes);
    if (volumeSpike.confidence > 60) {
      const priceConfirmation = Math.abs(indicators.momentum[indicators.momentum.length - 1] || 0) > 5 ? 20 : 0;
      
      patterns.push({
        type: 'enhanced_volume_breakout',
        confidence: Math.min(volumeSpike.confidence + priceConfirmation, 95),
        timeframe: '30m',
        metadata: {
          ...volumeSpike.metadata,
          priceAcceleration: sentiment.priceAcceleration,
          momentumConfirmation: indicators.momentum[indicators.momentum.length - 1] || 0,
        },
      });
    }
    
    return patterns;
  }
  
  private detectMomentumPatterns(indicators: TechnicalIndicators, sentiment: MarketSentiment): Array<{type: string; confidence: number; timeframe: string; metadata: any}> {
    const patterns = [];
    
    // MACD Golden Cross
    const macdLine = indicators.macd.macdLine;
    const signalLine = indicators.macd.signalLine;
    
    if (macdLine.length >= 2 && signalLine.length >= 2) {
      const currentMACD = macdLine[macdLine.length - 1];
      const currentSignal = signalLine[signalLine.length - 1];
      const prevMACD = macdLine[macdLine.length - 2];
      const prevSignal = signalLine[signalLine.length - 2];
      
      if (prevMACD <= prevSignal && currentMACD > currentSignal) {
        const trendConfirmation = sentiment.marketRegime === 'bullish' ? 25 : 0;
        
        patterns.push({
          type: 'macd_golden_cross',
          confidence: 75 + trendConfirmation,
          timeframe: '1h',
          metadata: {
            macdValue: currentMACD,
            signalValue: currentSignal,
            histogram: indicators.macd.histogram[indicators.macd.histogram.length - 1],
            trendAlignment: sentiment.marketRegime,
          },
        });
      }
    }
    
    // Stochastic momentum
    const stochK = indicators.stochastic.k;
    const stochD = indicators.stochastic.d;
    
    if (stochK.length > 0 && stochD.length > 0) {
      const currentK = stochK[stochK.length - 1];
      const currentD = stochD[stochD.length - 1];
      
      if (currentK < 20 && currentD < 20 && currentK > currentD) {
        patterns.push({
          type: 'stochastic_oversold_reversal',
          confidence: 80,
          timeframe: '1h',
          metadata: {
            stochK: currentK,
            stochD: currentD,
            oversoldLevel: 20,
          },
        });
      }
    }
    
    return patterns;
  }

  private async savePattern(tokenId: string, pattern: any) {
    try {
      const patternData: InsertPattern = {
        tokenId,
        patternType: pattern.type,
        confidence: pattern.confidence,
        timeframe: pattern.timeframe,
        metadata: pattern.metadata,
      };
      
      const savedPattern = await storage.createPattern(patternData);
      this.emit('patternDetected', savedPattern);
      
      console.log(`🤖 Advanced ML Pattern: ${pattern.type} (${pattern.confidence.toFixed(1)}% confidence)`);
    } catch (error) {
      console.error('Error saving pattern:', error);
    }
  }
}

export const mlAnalyzer = new MLAnalyzer();
