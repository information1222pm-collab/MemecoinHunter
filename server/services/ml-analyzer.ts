import { EventEmitter } from 'events';
import { storage } from '../storage';
import type { Token, PriceHistory, InsertPattern } from '@shared/schema';

interface TechnicalIndicators {
  sma: number[];
  ema: number[];
  rsi: number;
  volume: number[];
  volatility: number;
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
    
    // Bull Flag Pattern Detection
    const bullFlag = this.detectBullFlag(prices, indicators.volume);
    if (bullFlag.confidence > 70) {
      patterns.push({
        type: 'bull_flag',
        confidence: bullFlag.confidence,
        timeframe: '1h',
        metadata: bullFlag.metadata,
      });
    }
    
    // Double Bottom Pattern Detection
    const doubleBottom = this.detectDoubleBottom(prices);
    if (doubleBottom.confidence > 70) {
      patterns.push({
        type: 'double_bottom',
        confidence: doubleBottom.confidence,
        timeframe: '4h',
        metadata: doubleBottom.metadata,
      });
    }
    
    // Volume Spike Detection
    const volumeSpike = this.detectVolumeSpike(indicators.volume);
    if (volumeSpike.confidence > 80) {
      patterns.push({
        type: 'volume_spike',
        confidence: volumeSpike.confidence,
        timeframe: '1h',
        metadata: volumeSpike.metadata,
      });
    }
    
    // RSI Divergence Detection
    const rsiDivergence = this.detectRSIDivergence(prices, indicators.rsi);
    if (rsiDivergence.confidence > 75) {
      patterns.push({
        type: 'rsi_divergence',
        confidence: rsiDivergence.confidence,
        timeframe: '1h',
        metadata: rsiDivergence.metadata,
      });
    }
    
    return patterns;
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
      
      console.log(`🔍 Pattern detected: ${pattern.type} (${pattern.confidence}% confidence)`);
    } catch (error) {
      console.error('Error saving pattern:', error);
    }
  }
}

export const mlAnalyzer = new MLAnalyzer();
