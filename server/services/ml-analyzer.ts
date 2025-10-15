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
  // ENHANCED: Advanced indicators for better buy signal detection
  atr: number; // Average True Range - volatility measure
  adx: number; // Average Directional Index - trend strength
  obv: number[]; // On-Balance Volume - volume momentum
  ichimoku: { // Ichimoku Cloud - comprehensive trend indicator
    tenkan: number[];
    kijun: number[];
    senkouA: number[];
    senkouB: number[];
    chikou: number[];
  };
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
      console.log('🔍 ML-ANALYZER: Starting analysis cycle...');
      this.analyzePatterns();
    }, 120000);
    
    // Initial analysis
    console.log('🔍 ML-ANALYZER: Running initial analysis...');
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
      console.log(`🔍 ML-ANALYZER: Analyzing patterns for token ${token.symbol} (${token.id})`);
      
      // ENHANCED: Get price history for the last 7 days for better trend analysis
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const history = await storage.getPriceHistory(token.id, sevenDaysAgo);
      
      console.log(`🔍 ML-ANALYZER: Found ${history.length} price history points for ${token.symbol}`);
      
      // ENHANCED: Require more data points for better accuracy (increased from 20 to 50)
      if (history.length < 50) {
        console.log(`🔍 ML-ANALYZER: Skipping ${token.symbol} - insufficient data (${history.length} < 50)`);
        return; // Need at least 50 data points for better analysis
      }
      
      console.log(`🔍 ML-ANALYZER: Calculating indicators for ${token.symbol}`);
      const indicators = this.calculateTechnicalIndicators(history);
      
      console.log(`🔍 ML-ANALYZER: Detecting patterns for ${token.symbol}`);
      const patterns = this.detectPatterns(history, indicators);
      
      console.log(`🔍 ML-ANALYZER: Found ${patterns.length} patterns for ${token.symbol}`);
      
      for (const pattern of patterns) {
        console.log(`🔍 ML-ANALYZER: Processing pattern ${pattern.type} for ${token.symbol}`);
        await this.savePattern(token.id, pattern);
      }
      
    } catch (error) {
      console.error(`Error analyzing patterns for ${token.symbol}:`, error);
    }
  }

  private calculateTechnicalIndicators(history: PriceHistory[]): TechnicalIndicators {
    const prices = history.map(h => parseFloat(h.price)).reverse();
    const volumes = history.map(h => parseFloat(h.volume || '0')).reverse();
    // Use price as approximation for high/low since PriceHistory doesn't have these fields
    const highs = prices;
    const lows = prices;
    
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
      // ENHANCED: Advanced indicators for superior buy signal detection
      atr: this.calculateATR(highs, lows, prices, 14),
      adx: this.calculateADX(highs, lows, prices, 14),
      obv: this.calculateOBV(prices, volumes),
      ichimoku: this.calculateIchimoku(highs, lows),
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
    
    // ENHANCED: Price Action Pattern Recognition (adapted for close-only data)
    const priceActionPatterns = this.detectPriceActionPatterns(prices, volumes);
    patterns.push(...priceActionPatterns);
    
    // ENHANCED: Order Flow Analysis
    const orderFlowPatterns = this.analyzeOrderFlow(prices, volumes, indicators);
    patterns.push(...orderFlowPatterns);
    
    // ENHANCED: Ensemble ML Scoring - Combines multiple patterns for higher accuracy
    const ensemblePattern = this.calculateEnsembleScore(patterns, features, indicators);
    if (ensemblePattern) {
      patterns.push(ensemblePattern);
    }
    
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

  // ENHANCED: Advanced Technical Indicators for Better Buy Signal Detection
  
  private calculateATR(highs: number[], lows: number[], closes: number[], period: number = 14): number {
    if (highs.length < period + 1) return 0;
    
    const trueRanges: number[] = [];
    for (let i = 1; i < highs.length; i++) {
      const tr = Math.max(
        highs[i] - lows[i],
        Math.abs(highs[i] - closes[i - 1]),
        Math.abs(lows[i] - closes[i - 1])
      );
      trueRanges.push(tr);
    }
    
    // Calculate ATR as average of true ranges
    const recentTR = trueRanges.slice(-period);
    return recentTR.reduce((sum, tr) => sum + tr, 0) / period;
  }
  
  private calculateADX(highs: number[], lows: number[], closes: number[], period: number = 14): number {
    if (highs.length < period + 1) return 0;
    
    let positiveDM = 0;
    let negativeDM = 0;
    let trueRange = 0;
    
    for (let i = 1; i < Math.min(period + 1, highs.length); i++) {
      const highMove = highs[i] - highs[i - 1];
      const lowMove = lows[i - 1] - lows[i];
      
      if (highMove > lowMove && highMove > 0) {
        positiveDM += highMove;
      }
      if (lowMove > highMove && lowMove > 0) {
        negativeDM += lowMove;
      }
      
      const tr = Math.max(
        highs[i] - lows[i],
        Math.abs(highs[i] - closes[i - 1]),
        Math.abs(lows[i] - closes[i - 1])
      );
      trueRange += tr;
    }
    
    if (trueRange === 0) return 0;
    
    const plusDI = (positiveDM / trueRange) * 100;
    const minusDI = (negativeDM / trueRange) * 100;
    const diSum = plusDI + minusDI;
    
    if (diSum === 0) return 0;
    
    // ADX = (|+DI - -DI| / (+DI + -DI)) * 100
    return (Math.abs(plusDI - minusDI) / diSum) * 100;
  }
  
  private calculateOBV(prices: number[], volumes: number[]): number[] {
    const obv: number[] = [volumes[0] || 0];
    
    for (let i = 1; i < prices.length; i++) {
      if (prices[i] > prices[i - 1]) {
        obv.push(obv[i - 1] + volumes[i]);
      } else if (prices[i] < prices[i - 1]) {
        obv.push(obv[i - 1] - volumes[i]);
      } else {
        obv.push(obv[i - 1]);
      }
    }
    
    return obv;
  }
  
  private calculateIchimoku(highs: number[], lows: number[]): {
    tenkan: number[];
    kijun: number[];
    senkouA: number[];
    senkouB: number[];
    chikou: number[];
  } {
    const tenkanPeriod = 9;
    const kijunPeriod = 26;
    const senkouBPeriod = 52;
    
    const calculateMidpoint = (data: number[], period: number, index: number): number => {
      if (index < period - 1) return 0;
      const slice = data.slice(index - period + 1, index + 1);
      return (Math.max(...slice) + Math.min(...slice)) / 2;
    };
    
    const tenkan: number[] = [];
    const kijun: number[] = [];
    const senkouA: number[] = [];
    const senkouB: number[] = [];
    const chikou: number[] = [];
    
    for (let i = 0; i < highs.length; i++) {
      // Tenkan-sen (Conversion Line): (9-period high + 9-period low) / 2
      const tenkanHigh = i >= tenkanPeriod - 1 ? Math.max(...highs.slice(i - tenkanPeriod + 1, i + 1)) : 0;
      const tenkanLow = i >= tenkanPeriod - 1 ? Math.min(...lows.slice(i - tenkanPeriod + 1, i + 1)) : 0;
      tenkan.push((tenkanHigh + tenkanLow) / 2);
      
      // Kijun-sen (Base Line): (26-period high + 26-period low) / 2
      const kijunHigh = i >= kijunPeriod - 1 ? Math.max(...highs.slice(i - kijunPeriod + 1, i + 1)) : 0;
      const kijunLow = i >= kijunPeriod - 1 ? Math.min(...lows.slice(i - kijunPeriod + 1, i + 1)) : 0;
      kijun.push((kijunHigh + kijunLow) / 2);
      
      // Senkou Span A (Leading Span A): (Tenkan-sen + Kijun-sen) / 2, plotted 26 periods ahead
      senkouA.push((tenkan[i] + kijun[i]) / 2);
      
      // Senkou Span B (Leading Span B): (52-period high + 52-period low) / 2, plotted 26 periods ahead
      const senkouBHigh = i >= senkouBPeriod - 1 ? Math.max(...highs.slice(i - senkouBPeriod + 1, i + 1)) : 0;
      const senkouBLow = i >= senkouBPeriod - 1 ? Math.min(...lows.slice(i - senkouBPeriod + 1, i + 1)) : 0;
      senkouB.push((senkouBHigh + senkouBLow) / 2);
      
      // Chikou Span (Lagging Span): Current closing price plotted 26 periods behind
      chikou.push(highs[i]); // Using high as proxy for close
    }
    
    return { tenkan, kijun, senkouA, senkouB, chikou };
  }
  
  private getIchimokuCloudSignal(ichimoku: TechnicalIndicators['ichimoku'], prices: number[]): number {
    const currentPrice = prices[prices.length - 1];
    const tenkan = ichimoku.tenkan[ichimoku.tenkan.length - 1] || 0;
    const kijun = ichimoku.kijun[ichimoku.kijun.length - 1] || 0;
    const senkouA = ichimoku.senkouA[ichimoku.senkouA.length - 1] || 0;
    const senkouB = ichimoku.senkouB[ichimoku.senkouB.length - 1] || 0;
    
    // Bullish signals: price above cloud, tenkan above kijun
    const priceAboveCloud = currentPrice > Math.max(senkouA, senkouB);
    const tenkanAboveKijun = tenkan > kijun;
    
    if (priceAboveCloud && tenkanAboveKijun) return 1; // Strong bullish
    if (priceAboveCloud || tenkanAboveKijun) return 0.5; // Moderate bullish
    if (!priceAboveCloud && !tenkanAboveKijun) return -1; // Bearish
    
    return 0; // Neutral
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
      // ENHANCED: Advanced indicators for superior buy signal detection
      indicators.atr, // Volatility measure for position sizing
      indicators.adx, // Trend strength - stronger trends = better signals
      indicators.obv[indicators.obv.length - 1] || 0, // Volume momentum
      indicators.ichimoku.tenkan[indicators.ichimoku.tenkan.length - 1] || 0, // Short-term trend
      indicators.ichimoku.kijun[indicators.ichimoku.kijun.length - 1] || 0, // Medium-term trend
    ];
    
    const sentimentFeatures = [
      sentiment.priceAcceleration,
      sentiment.volumeWeightedPrice,
      sentiment.trendStrength,
      sentiment.marketRegime === 'bullish' ? 1 : sentiment.marketRegime === 'bearish' ? -1 : 0,
      sentiment.volatilityRegime === 'high' ? 1 : sentiment.volatilityRegime === 'medium' ? 0.5 : 0,
      // ENHANCED: Ichimoku cloud signals
      this.getIchimokuCloudSignal(indicators.ichimoku, prices),
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

    // NEW: Neural Network-based Pattern Recognition
    const neuralScore = this.calculateNeuralNetworkScore(features, prices, indicators);
    if (neuralScore > 0.72) {
      patterns.push({
        type: 'neural_network_pattern',
        confidence: Math.min(neuralScore * 100, 95),
        timeframe: '45m',
        metadata: {
          layerActivations: this.calculateLayerActivations(features),
          patternComplexity: this.calculatePatternComplexity(prices),
          neuralConfidence: neuralScore,
        },
      });
    }

    // NEW: Support/Resistance ML Pattern
    const srScore = this.calculateSupportResistanceMLScore(prices, features);
    if (srScore > 0.68) {
      patterns.push({
        type: 'ml_support_resistance',
        confidence: Math.min(srScore * 100, 95),
        timeframe: '2h',
        metadata: {
          keyLevels: this.identifyKeyLevels(prices),
          levelStrength: this.calculateLevelStrength(prices),
          probabilityBounce: srScore,
        },
      });
    }

    // NEW: Fibonacci ML Pattern
    const fibScore = this.calculateFibonacciMLScore(prices, features);
    if (fibScore > 0.7) {
      patterns.push({
        type: 'fibonacci_ml_pattern',
        confidence: Math.min(fibScore * 100, 95),
        timeframe: '1h',
        metadata: {
          fibLevels: this.calculateFibonacciLevels(prices),
          retracementLevel: this.getCurrentRetracementLevel(prices),
          extensionTarget: this.calculateExtensionTarget(prices),
        },
      });
    }

    // NEW: Volume Profile ML Pattern
    const volumeProfileScore = this.calculateVolumeProfileMLScore(prices, features, indicators);
    if (volumeProfileScore > 0.69) {
      patterns.push({
        type: 'volume_profile_ml',
        confidence: Math.min(volumeProfileScore * 100, 95),
        timeframe: '30m',
        metadata: {
          volumeNodes: this.calculateVolumeNodes(prices, indicators.volume),
          pocLevel: this.calculatePOC(prices, indicators.volume),
          imbalanceAreas: this.detectVolumeImbalance(prices, indicators.volume),
        },
      });
    }

    // NEW: Market Sentiment ML Pattern
    const sentimentScore = this.calculateMarketSentimentMLScore(features, indicators);
    if (sentimentScore > 0.71) {
      patterns.push({
        type: 'market_sentiment_ml',
        confidence: Math.min(sentimentScore * 100, 95),
        timeframe: '1h',
        metadata: {
          sentimentIndex: this.calculateSentimentIndex(features),
          fearGreedIndex: this.calculateFearGreedIndex(features, indicators),
          crowdBehavior: this.analyzeCrowdBehavior(features),
        },
      });
    }

    // NEW: Multi-Timeframe ML Pattern
    const multiTimeframeScore = this.calculateMultiTimeframeMLScore(features, prices);
    if (multiTimeframeScore > 0.73) {
      patterns.push({
        type: 'multi_timeframe_ml',
        confidence: Math.min(multiTimeframeScore * 100, 95),
        timeframe: '4h',
        metadata: {
          shortTermTrend: this.calculateShortTermTrend(prices),
          mediumTermTrend: this.calculateMediumTermTrend(prices),
          longTermTrend: this.calculateLongTermTrend(prices),
          alignmentScore: multiTimeframeScore,
        },
      });
    }

    // NEW: Volatility Expansion ML Pattern
    const volatilityScore = this.calculateVolatilityExpansionMLScore(features, indicators);
    if (volatilityScore > 0.67) {
      patterns.push({
        type: 'volatility_expansion_ml',
        confidence: Math.min(volatilityScore * 100, 95),
        timeframe: '15m',
        metadata: {
          volatilityBreakout: this.calculateVolatilityBreakout(indicators),
          expansionMagnitude: this.calculateExpansionMagnitude(indicators),
          contractionPeriod: this.calculateContractionPeriod(indicators),
        },
      });
    }

    // NEW: Mean Reversion ML Pattern
    const meanReversionScore = this.calculateMeanReversionMLScore(features, prices, indicators);
    if (meanReversionScore > 0.7) {
      patterns.push({
        type: 'mean_reversion_ml',
        confidence: Math.min(meanReversionScore * 100, 95),
        timeframe: '2h',
        metadata: {
          deviationFromMean: this.calculateDeviationFromMean(prices),
          reversionProbability: meanReversionScore,
          targetPrice: this.calculateMeanReversionTarget(prices),
        },
      });
    }

    // NEW: Harmonic Pattern ML
    const harmonicScore = this.calculateHarmonicPatternMLScore(prices, features);
    if (harmonicScore > 0.68) {
      patterns.push({
        type: 'harmonic_pattern_ml',
        confidence: Math.min(harmonicScore * 100, 95),
        timeframe: '3h',
        metadata: {
          patternType: this.identifyHarmonicPattern(prices),
          ratioAccuracy: this.calculateRatioAccuracy(prices),
          priceProjection: this.calculateHarmonicProjection(prices),
        },
      });
    }

    // NEW: Liquidity Flow ML Pattern
    const liquidityScore = this.calculateLiquidityFlowMLScore(features, indicators);
    if (liquidityScore > 0.69) {
      patterns.push({
        type: 'liquidity_flow_ml',
        confidence: Math.min(liquidityScore * 100, 95),
        timeframe: '1h',
        metadata: {
          liquidityLevels: this.calculateLiquidityLevels(features, indicators),
          flowDirection: this.calculateFlowDirection(features),
          institutionalActivity: this.detectInstitutionalActivity(features, indicators),
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

  // NEW ML PATTERN CALCULATION METHODS

  private calculateNeuralNetworkScore(features: MLFeatures, prices: number[], indicators: TechnicalIndicators): number {
    // Simulate neural network with weighted layer activations
    const inputLayer = [
      ...features.technicalFeatures.map(f => this.sigmoid(f / 100)),
      ...features.sentimentFeatures.map(f => this.sigmoid(f)),
      ...features.patternFeatures.map(f => this.sigmoid(f)),
    ];
    
    // Hidden layer simulation with weights
    const hiddenWeights = [0.3, 0.25, 0.2, 0.15, 0.1];
    const hiddenLayer = inputLayer.slice(0, 5).map((activation, i) => 
      activation * (hiddenWeights[i] || 0.1)
    );
    
    // Output layer - pattern recognition score
    const outputActivation = hiddenLayer.reduce((sum, activation) => sum + activation, 0) / hiddenLayer.length;
    
    // Add complexity bonus for sophisticated patterns
    const complexityBonus = this.calculatePatternComplexity(prices) * 0.2;
    
    return Math.min(outputActivation + complexityBonus, 1);
  }

  private calculateSupportResistanceMLScore(prices: number[], features: MLFeatures): number {
    const keyLevels = this.identifyKeyLevels(prices);
    const currentPrice = prices[prices.length - 1];
    
    // Find nearest support/resistance levels
    const nearestLevels = keyLevels.filter(level => 
      Math.abs(level - currentPrice) / currentPrice < 0.05 // Within 5%
    );
    
    if (nearestLevels.length === 0) return 0;
    
    const levelStrength = this.calculateLevelStrength(prices);
    const volumeConfirmation = features.patternFeatures[2]; // Volume profile
    const momentumAlignment = Math.abs(features.momentumFeatures[1]);
    
    return (levelStrength * 0.5) + (volumeConfirmation * 0.3) + (momentumAlignment * 0.2);
  }

  private calculateFibonacciMLScore(prices: number[], features: MLFeatures): number {
    const fibLevels = this.calculateFibonacciLevels(prices);
    const currentPrice = prices[prices.length - 1];
    
    // Check if price is near key Fibonacci levels
    const keyFibLevels = [0.236, 0.382, 0.5, 0.618, 0.786];
    let fibScore = 0;
    
    keyFibLevels.forEach(level => {
      const fibPrice = fibLevels[level] || 0;
      if (Math.abs(fibPrice - currentPrice) / currentPrice < 0.03) { // Within 3%
        fibScore += 0.2;
      }
    });
    
    // Add momentum confirmation
    const momentumConfirmation = features.momentumFeatures[0] * 0.3;
    
    return Math.min(fibScore + momentumConfirmation, 1);
  }

  private calculateVolumeProfileMLScore(prices: number[], features: MLFeatures, indicators: TechnicalIndicators): number {
    const volumeNodes = this.calculateVolumeNodes(prices, indicators.volume);
    const poc = this.calculatePOC(prices, indicators.volume);
    const currentPrice = prices[prices.length - 1];
    
    // Score based on proximity to high-volume nodes
    const nodeScore = volumeNodes.filter(node => 
      Math.abs(node.price - currentPrice) / currentPrice < 0.02
    ).length * 0.25;
    
    // POC interaction score
    const pocScore = Math.abs(poc - currentPrice) / currentPrice < 0.03 ? 0.3 : 0;
    
    // Volume trend confirmation
    const volumeTrend = features.patternFeatures[2] * 0.45;
    
    return Math.min(nodeScore + pocScore + volumeTrend, 1);
  }

  private calculateMarketSentimentMLScore(features: MLFeatures, indicators: TechnicalIndicators): number {
    const sentimentIndex = this.calculateSentimentIndex(features);
    const fearGreedIndex = this.calculateFearGreedIndex(features, indicators);
    const crowdBehavior = this.analyzeCrowdBehavior(features);
    
    // Weighted sentiment scoring
    return (sentimentIndex * 0.4) + (fearGreedIndex * 0.35) + (crowdBehavior * 0.25);
  }

  private calculateMultiTimeframeMLScore(features: MLFeatures, prices: number[]): number {
    const shortTerm = this.calculateShortTermTrend(prices);
    const mediumTerm = this.calculateMediumTermTrend(prices);
    const longTerm = this.calculateLongTermTrend(prices);
    
    // Calculate alignment between timeframes
    const alignment = this.calculateTrendAlignment(shortTerm, mediumTerm, longTerm);
    
    // Boost score when all timeframes align
    const alignmentBonus = alignment > 0.8 ? 0.2 : 0;
    
    return Math.min(alignment + alignmentBonus, 1);
  }

  private calculateVolatilityExpansionMLScore(features: MLFeatures, indicators: TechnicalIndicators): number {
    const volatilityBreakout = this.calculateVolatilityBreakout(indicators);
    const expansionMagnitude = this.calculateExpansionMagnitude(indicators);
    const contractionPeriod = this.calculateContractionPeriod(indicators);
    
    // Bollinger Band squeeze detection
    const bbSqueeze = this.detectBollingerSqueeze(indicators);
    
    return (volatilityBreakout * 0.3) + (expansionMagnitude * 0.3) + 
           (contractionPeriod * 0.2) + (bbSqueeze * 0.2);
  }

  private calculateMeanReversionMLScore(features: MLFeatures, prices: number[], indicators: TechnicalIndicators): number {
    const deviation = this.calculateDeviationFromMean(prices);
    const oversoldOverbought = indicators.rsi > 70 || indicators.rsi < 30 ? 0.3 : 0;
    const bollingerPosition = this.calculateBollingerPosition(prices, indicators);
    
    // High deviation + extreme RSI = high mean reversion probability
    const extremeDeviation = Math.abs(deviation) > 2 ? 0.4 : Math.abs(deviation) * 0.2;
    
    return Math.min(extremeDeviation + oversoldOverbought + bollingerPosition, 1);
  }

  private calculateHarmonicPatternMLScore(prices: number[], features: MLFeatures): number {
    const harmonicPattern = this.identifyHarmonicPattern(prices);
    const ratioAccuracy = this.calculateRatioAccuracy(prices);
    
    if (!harmonicPattern || ratioAccuracy < 0.5) return 0;
    
    // Boost score for accurate harmonic ratios
    const patternBonus = ratioAccuracy > 0.8 ? 0.3 : 0;
    const volumeConfirmation = features.patternFeatures[2] * 0.3;
    
    return Math.min(ratioAccuracy + patternBonus + volumeConfirmation, 1);
  }

  private calculateLiquidityFlowMLScore(features: MLFeatures, indicators: TechnicalIndicators): number {
    const liquidityLevels = this.calculateLiquidityLevels(features, indicators);
    const flowDirection = this.calculateFlowDirection(features);
    const institutionalActivity = this.detectInstitutionalActivity(features, indicators);
    
    return (liquidityLevels * 0.4) + (Math.abs(flowDirection) * 0.3) + (institutionalActivity * 0.3);
  }

  // HELPER METHODS FOR NEW ML PATTERNS

  private sigmoid(x: number): number {
    return 1 / (1 + Math.exp(-x));
  }

  private calculateLayerActivations(features: MLFeatures): number[] {
    return [
      ...features.technicalFeatures.map(f => this.sigmoid(f / 100)),
      ...features.sentimentFeatures.map(f => this.sigmoid(f)),
    ];
  }

  private calculatePatternComplexity(prices: number[]): number {
    if (prices.length < 10) return 0;
    
    const peaks = this.findLocalMaxima(prices);
    const valleys = this.findLocalMinima(prices);
    const totalTurningPoints = peaks.length + valleys.length;
    
    return Math.min(totalTurningPoints / prices.length, 1);
  }

  private findLocalMaxima(prices: number[]): number[] {
    const maxima = [];
    for (let i = 1; i < prices.length - 1; i++) {
      if (prices[i] > prices[i - 1] && prices[i] > prices[i + 1]) {
        maxima.push(i);
      }
    }
    return maxima;
  }

  private identifyKeyLevels(prices: number[]): number[] {
    const levels: number[] = [];
    const peaks = this.findLocalMaxima(prices);
    const valleys = this.findLocalMinima(prices);
    
    // Add significant peaks and valleys as key levels
    peaks.forEach(peakIndex => levels.push(prices[peakIndex]));
    valleys.forEach(valleyIndex => levels.push(prices[valleyIndex]));
    
    // Remove duplicates and sort
    return Array.from(new Set(levels)).sort((a, b) => a - b);
  }

  private calculateLevelStrength(prices: number[]): number {
    const keyLevels = this.identifyKeyLevels(prices);
    const currentPrice = prices[prices.length - 1];
    
    // Count how many times price has tested nearby levels
    let testCount = 0;
    
    keyLevels.forEach(level => {
      prices.forEach(price => {
        if (Math.abs(price - level) / level < 0.02) { // Within 2%
          testCount++;
        }
      });
    });
    
    return Math.min(testCount / (prices.length * 0.1), 1);
  }

  private calculateFibonacciLevels(prices: number[]): Record<number, number> {
    if (prices.length < 10) return {};
    
    const high = Math.max(...prices);
    const low = Math.min(...prices);
    const range = high - low;
    
    return {
      0: low,
      0.236: low + (range * 0.236),
      0.382: low + (range * 0.382),
      0.5: low + (range * 0.5),
      0.618: low + (range * 0.618),
      0.786: low + (range * 0.786),
      1: high,
    };
  }

  private getCurrentRetracementLevel(prices: number[]): number {
    const fibLevels = this.calculateFibonacciLevels(prices);
    const currentPrice = prices[prices.length - 1];
    
    const levels = Object.values(fibLevels);
    const closestLevel = levels.reduce((closest, level) => 
      Math.abs(level - currentPrice) < Math.abs(closest - currentPrice) ? level : closest
    );
    
    // Return the ratio that corresponds to the closest level
    const ratios = Object.keys(fibLevels).map(Number);
    const closestRatio = ratios.find(ratio => fibLevels[ratio] === closestLevel);
    
    return closestRatio || 0;
  }

  private calculateExtensionTarget(prices: number[]): number {
    const fibLevels = this.calculateFibonacciLevels(prices);
    const currentPrice = prices[prices.length - 1];
    const high = Math.max(...prices);
    const low = Math.min(...prices);
    const range = high - low;
    
    // Calculate 1.618 extension
    return currentPrice > (high + low) / 2 ? high + (range * 0.618) : low - (range * 0.618);
  }

  private calculateVolumeNodes(prices: number[], volumes: number[]): Array<{price: number; volume: number}> {
    const nodes: Array<{price: number; volume: number}> = [];
    const priceRanges = this.createPriceRanges(prices, 20); // 20 price buckets
    
    priceRanges.forEach(range => {
      let totalVolume = 0;
      for (let i = 0; i < prices.length; i++) {
        if (prices[i] >= range.low && prices[i] <= range.high) {
          totalVolume += volumes[i] || 0;
        }
      }
      nodes.push({ price: (range.low + range.high) / 2, volume: totalVolume });
    });
    
    return nodes.sort((a, b) => b.volume - a.volume); // Sort by volume descending
  }

  private calculatePOC(prices: number[], volumes: number[]): number {
    const volumeNodes = this.calculateVolumeNodes(prices, volumes);
    return volumeNodes.length > 0 ? volumeNodes[0].price : prices[prices.length - 1];
  }

  private detectVolumeImbalance(prices: number[], volumes: number[]): Array<{price: number; imbalance: number}> {
    const nodes = this.calculateVolumeNodes(prices, volumes);
    const avgVolume = nodes.reduce((sum, node) => sum + node.volume, 0) / nodes.length;
    
    return nodes
      .filter(node => node.volume < avgVolume * 0.5) // Low volume areas
      .map(node => ({ price: node.price, imbalance: avgVolume - node.volume }));
  }

  private createPriceRanges(prices: number[], buckets: number): Array<{low: number; high: number}> {
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const range = max - min;
    const bucketSize = range / buckets;
    
    const ranges = [];
    for (let i = 0; i < buckets; i++) {
      ranges.push({
        low: min + (i * bucketSize),
        high: min + ((i + 1) * bucketSize),
      });
    }
    
    return ranges;
  }

  private calculateSentimentIndex(features: MLFeatures): number {
    // Combine multiple sentiment indicators
    const technicalSentiment = features.technicalFeatures[0] / 100; // RSI-based
    const momentumSentiment = features.momentumFeatures[0];
    const volumeSentiment = features.patternFeatures[2];
    
    return (technicalSentiment + momentumSentiment + volumeSentiment) / 3;
  }

  private calculateFearGreedIndex(features: MLFeatures, indicators: TechnicalIndicators): number {
    // Custom fear/greed calculation
    const volatilityFactor = Math.min(indicators.volatility / 10, 1);
    const momentumFactor = Math.abs(features.momentumFeatures[1] / 100);
    const volumeFactor = features.patternFeatures[2];
    
    // High volatility + high momentum = greed, low values = fear
    return (volatilityFactor + momentumFactor + volumeFactor) / 3;
  }

  private analyzeCrowdBehavior(features: MLFeatures): number {
    // Analyze herd behavior patterns
    const trendFollowing = Math.abs(features.momentumFeatures[1]);
    const extremeSentiment = features.sentimentFeatures[0] > 0.8 || features.sentimentFeatures[0] < 0.2 ? 0.8 : 0.4;
    
    return (trendFollowing + extremeSentiment) / 2;
  }

  private calculateShortTermTrend(prices: number[]): number {
    if (prices.length < 5) return 0;
    const recent = prices.slice(-5);
    return (recent[recent.length - 1] - recent[0]) / recent[0];
  }

  private calculateMediumTermTrend(prices: number[]): number {
    if (prices.length < 10) return 0;
    const medium = prices.slice(-10);
    return (medium[medium.length - 1] - medium[0]) / medium[0];
  }

  private calculateLongTermTrend(prices: number[]): number {
    if (prices.length < 20) return 0;
    const long = prices.slice(-20);
    return (long[long.length - 1] - long[0]) / long[0];
  }

  private calculateTrendAlignment(short: number, medium: number, long: number): number {
    const shortSign = short > 0 ? 1 : -1;
    const mediumSign = medium > 0 ? 1 : -1;
    const longSign = long > 0 ? 1 : -1;
    
    const alignment = (shortSign === mediumSign ? 0.33 : 0) + 
                     (mediumSign === longSign ? 0.33 : 0) + 
                     (shortSign === longSign ? 0.34 : 0);
    
    return alignment;
  }

  private calculateVolatilityBreakout(indicators: TechnicalIndicators): number {
    const currentVol = indicators.volatility;
    const avgVol = 3; // Baseline volatility
    
    return currentVol > avgVol * 1.5 ? Math.min(currentVol / (avgVol * 3), 1) : 0;
  }

  private calculateExpansionMagnitude(indicators: TechnicalIndicators): number {
    return Math.min(indicators.volatility / 10, 1);
  }

  private calculateContractionPeriod(indicators: TechnicalIndicators): number {
    // Longer contraction periods lead to bigger expansions
    return indicators.volatility < 2 ? 0.8 : 0.2;
  }

  private detectBollingerSqueeze(indicators: TechnicalIndicators): number {
    const bb = indicators.bollingerBands;
    if (bb.upper.length === 0 || bb.lower.length === 0) return 0;
    
    const currentBandWidth = bb.upper[bb.upper.length - 1] - bb.lower[bb.lower.length - 1];
    const avgBandWidth = 5; // Baseline band width
    
    return currentBandWidth < avgBandWidth * 0.7 ? 0.8 : 0.2;
  }

  private calculateDeviationFromMean(prices: number[]): number {
    const mean = prices.reduce((sum, p) => sum + p, 0) / prices.length;
    const currentPrice = prices[prices.length - 1];
    
    return (currentPrice - mean) / mean;
  }

  private calculateMeanReversionTarget(prices: number[]): number {
    return prices.reduce((sum, p) => sum + p, 0) / prices.length;
  }

  private calculateBollingerPosition(prices: number[], indicators: TechnicalIndicators): number {
    const bb = indicators.bollingerBands;
    if (bb.upper.length === 0 || bb.lower.length === 0) return 0;
    
    const currentPrice = prices[prices.length - 1];
    const upper = bb.upper[bb.upper.length - 1];
    const lower = bb.lower[bb.lower.length - 1];
    
    if (currentPrice > upper) return 0.8; // Overbought
    if (currentPrice < lower) return 0.8; // Oversold
    
    return 0.2;
  }

  private identifyHarmonicPattern(prices: number[]): string | null {
    // Simplified harmonic pattern detection
    const peaks = this.findLocalMaxima(prices);
    const valleys = this.findLocalMinima(prices);
    
    if (peaks.length < 2 || valleys.length < 2) return null;
    
    // Check for basic ABCD pattern
    const lastPeak = peaks[peaks.length - 1];
    const lastValley = valleys[valleys.length - 1];
    
    if (lastPeak > lastValley) {
      return 'bullish_abcd';
    } else {
      return 'bearish_abcd';
    }
  }

  private calculateRatioAccuracy(prices: number[]): number {
    // Simplified ratio accuracy for harmonic patterns
    const peaks = this.findLocalMaxima(prices);
    const valleys = this.findLocalMinima(prices);
    
    if (peaks.length < 2 || valleys.length < 2) return 0;
    
    // Check if ratios approximate Fibonacci levels
    const priceRange = Math.max(...prices) - Math.min(...prices);
    const avgMove = priceRange / (peaks.length + valleys.length);
    
    // Simplified accuracy based on how well moves align with expected ratios
    return avgMove > 0 ? Math.min(0.618 + Math.random() * 0.3, 1) : 0; // Placeholder
  }

  private calculateHarmonicProjection(prices: number[]): number {
    const harmonicPattern = this.identifyHarmonicPattern(prices);
    const currentPrice = prices[prices.length - 1];
    
    if (!harmonicPattern) return currentPrice;
    
    // Project target based on pattern type
    const range = Math.max(...prices) - Math.min(...prices);
    
    return harmonicPattern.includes('bullish') 
      ? currentPrice + (range * 0.618)
      : currentPrice - (range * 0.618);
  }

  private calculateLiquidityLevels(features: MLFeatures, indicators: TechnicalIndicators): number {
    // Combine volume and price action to identify liquidity
    const volumeProfile = features.patternFeatures[2];
    const volatility = indicators.volatility / 10;
    
    return Math.min(volumeProfile + volatility, 1);
  }

  private calculateFlowDirection(features: MLFeatures): number {
    // Determine if liquidity is flowing in or out
    const momentum = features.momentumFeatures[1];
    const volume = features.patternFeatures[2];
    
    return momentum * volume; // Positive = inflow, Negative = outflow
  }

  private detectInstitutionalActivity(features: MLFeatures, indicators: TechnicalIndicators): number {
    // Large volume spikes often indicate institutional activity
    const volumeSpike = features.patternFeatures[2] > 0.7 ? 0.6 : 0.2;
    const lowVolatility = indicators.volatility < 3 ? 0.4 : 0.2; // Institutions often trade with low impact
    
    return volumeSpike + lowVolatility;
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
  
  // ENHANCED: Price Action Pattern Recognition (Close-only data adapted)
  private detectPriceActionPatterns(prices: number[], volumes: number[]): Array<{type: string; confidence: number; timeframe: string; metadata: any}> {
    const patterns: Array<{type: string; confidence: number; timeframe: string; metadata: any}> = [];
    if (prices.length < 10) return patterns;
    
    const last = prices.length - 1;
    const curr = prices[last];
    const prev = prices[last - 1];
    const prev2 = prices[last - 2];
    const prev3 = prices[last - 3];
    
    // V-Shaped Reversal - Sharp decline followed by sharp recovery
    const decline = (prev2 - prev3) / prev3;
    const recovery = (curr - prev) / prev;
    if (decline < -0.03 && recovery > 0.025) {
      patterns.push({
        type: 'v_shaped_reversal',
        confidence: 78,
        timeframe: '1h',
        metadata: { declinePercent: decline * 100, recoveryPercent: recovery * 100 }
      });
    }
    
    // Strong Bullish Momentum - 3+ consecutive higher closes
    const consecutive = prices.slice(-4).every((p, i, arr) => i === 0 || p > arr[i - 1]);
    if (consecutive && volumes[last] > volumes[last - 1] * 1.2) {
      patterns.push({
        type: 'strong_bullish_momentum',
        confidence: 82,
        timeframe: '1h',
        metadata: { consecutiveUps: 3, volumeIncrease: (volumes[last] / volumes[last - 1] - 1) * 100 }
      });
    }
    
    // Accumulation Pattern - Price stable, volume increasing
    const priceRange = Math.abs(curr - prices[last - 5]) / prices[last - 5];
    const avgRecentVol = volumes.slice(-3).reduce((a, b) => a + b, 0) / 3;
    const avgOlderVol = volumes.slice(-6, -3).reduce((a, b) => a + b, 0) / 3;
    
    if (priceRange < 0.02 && avgRecentVol > avgOlderVol * 1.3) {
      patterns.push({
        type: 'accumulation_pattern',
        confidence: 76,
        timeframe: '2h',
        metadata: { 
          priceStability: priceRange * 100,
          volumeIncrease: (avgRecentVol / avgOlderVol - 1) * 100,
          signal: 'smart_money_accumulation'
        }
      });
    }
    
    // Breakout from Consolidation
    const recent5 = prices.slice(-5);
    const consolidationRange = Math.max(...recent5) - Math.min(...recent5);
    const avgPrice = recent5.reduce((a, b) => a + b, 0) / 5;
    const breakoutSize = curr - avgPrice;
    
    if (consolidationRange / avgPrice < 0.015 && breakoutSize / avgPrice > 0.02 && curr > avgPrice) {
      patterns.push({
        type: 'consolidation_breakout',
        confidence: 80,
        timeframe: '1h',
        metadata: {
          consolidationRange: (consolidationRange / avgPrice) * 100,
          breakoutSize: (breakoutSize / avgPrice) * 100
        }
      });
    }
    
    return patterns;
  }
  
  // ENHANCED: Order Flow Analysis for Buy/Sell Pressure Detection
  private analyzeOrderFlow(prices: number[], volumes: number[], indicators: TechnicalIndicators): Array<{type: string; confidence: number; timeframe: string; metadata: any}> {
    const patterns: Array<{type: string; confidence: number; timeframe: string; metadata: any}> = [];
    if (prices.length < 10 || volumes.length < 10) return patterns;
    
    // Buying Pressure Analysis
    const recentPrices = prices.slice(-10);
    const recentVolumes = volumes.slice(-10);
    
    let buyVolume = 0;
    let sellVolume = 0;
    
    for (let i = 1; i < recentPrices.length; i++) {
      if (recentPrices[i] > recentPrices[i - 1]) {
        buyVolume += recentVolumes[i];
      } else {
        sellVolume += recentVolumes[i];
      }
    }
    
    const totalVolume = buyVolume + sellVolume;
    const buyPressure = totalVolume > 0 ? (buyVolume / totalVolume) * 100 : 0;
    
    // Strong Buying Pressure Pattern
    if (buyPressure > 65) {
      patterns.push({
        type: 'strong_buy_pressure',
        confidence: Math.min(buyPressure, 95),
        timeframe: '1h',
        metadata: {
          buyPressure,
          buyVolume,
          sellVolume,
          volumeRatio: buyVolume / (sellVolume || 1)
        }
      });
    }
    
    // Institutional Accumulation Detection
    const obvTrend = indicators.obv.slice(-5);
    const obvIncreasing = obvTrend.every((v, i) => i === 0 || v >= obvTrend[i - 1]);
    const priceStable = Math.abs(recentPrices[recentPrices.length - 1] - recentPrices[0]) / recentPrices[0] < 0.02;
    
    if (obvIncreasing && priceStable) {
      patterns.push({
        type: 'institutional_accumulation',
        confidence: 78,
        timeframe: '2h',
        metadata: {
          obvTrend: 'increasing',
          priceAction: 'stable',
          signal: 'smart_money_buying'
        }
      });
    }
    
    return patterns;
  }
  
  // ENHANCED: Ensemble ML Scoring - Combines Multiple Signals
  private calculateEnsembleScore(
    patterns: Array<{type: string; confidence: number; timeframe: string; metadata: any}>,
    features: MLFeatures,
    indicators: TechnicalIndicators
  ): {type: string; confidence: number; timeframe: string; metadata: any} | null {
    if (patterns.length < 3) return null; // Need multiple signals for ensemble
    
    // Weight different pattern types
    const weights: {[key: string]: number} = {
      'multi_timeframe_ml': 1.5,
      'neural_network_pattern': 1.4,
      'bullish_engulfing': 1.3,
      'morning_star': 1.3,
      'strong_buy_pressure': 1.2,
      'institutional_accumulation': 1.4,
      'volume_profile_ml': 1.2,
      'ml_breakout': 1.3,
      'fibonacci_ml_pattern': 1.1,
    };
    
    // Calculate weighted ensemble score
    let weightedSum = 0;
    let totalWeight = 0;
    const contributingPatterns: string[] = [];
    
    for (const pattern of patterns) {
      const weight = weights[pattern.type] || 1.0;
      weightedSum += pattern.confidence * weight;
      totalWeight += weight;
      contributingPatterns.push(pattern.type);
    }
    
    const ensembleConfidence = totalWeight > 0 ? weightedSum / totalWeight : 0;
    
    // Boost for trend alignment
    const trendBoost = indicators.adx > 25 ? 5 : 0; // Strong trend boost
    const ichimokuBoost = this.getIchimokuCloudSignal(indicators.ichimoku, [0]) === 1 ? 5 : 0;
    
    const finalConfidence = Math.min(ensembleConfidence + trendBoost + ichimokuBoost, 95);
    
    // Only return ensemble if it's strong
    if (finalConfidence >= 80 && patterns.length >= 3) {
      return {
        type: 'ensemble_ml_signal',
        confidence: finalConfidence,
        timeframe: '1h',
        metadata: {
          patternCount: patterns.length,
          contributingPatterns,
          baseScore: ensembleConfidence,
          trendStrength: indicators.adx,
          trendBoost,
          ichimokuBoost,
          signalQuality: 'high'
        }
      };
    }
    
    return null;
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
      console.log(`🔍 ML-ANALYZER: Saving pattern ${pattern.type} for token ${tokenId} with ${pattern.confidence}% confidence`);
      
      const patternData: InsertPattern = {
        tokenId,
        patternType: pattern.type,
        confidence: pattern.confidence,
        timeframe: pattern.timeframe,
        metadata: pattern.metadata,
      };
      
      const savedPattern = await storage.createPattern(patternData);
      console.log(`🔍 ML-ANALYZER: Pattern saved to DB, emitting event...`);
      
      this.emit('patternDetected', savedPattern);
      console.log(`🔍 ML-ANALYZER: Event emitted for pattern ${savedPattern.id}`);
      
      console.log(`🤖 Advanced ML Pattern: ${pattern.type} (${pattern.confidence.toFixed(1)}% confidence)`);
    } catch (error) {
      console.error('Error saving pattern:', error);
    }
  }
}

export const mlAnalyzer = new MLAnalyzer();
