import type { PriceHistory } from '@shared/schema';

export interface SupportResistanceLevel {
  price: number;
  strength: number; // 0-100, how strong the level is
  type: 'support' | 'resistance';
  touches: number; // how many times price tested this level
  confidence: number; // confidence in the level's significance
}

export interface FibonacciLevels {
  levels: Record<number, number>; // ratio -> price
  direction: 'retracement' | 'extension';
  entryLevels: number[]; // optimal entry prices
  exitLevels: number[]; // optimal exit/target prices
  stopLoss: number;
}

export interface PivotPoints {
  pivot: number;
  resistance1: number;
  resistance2: number;
  resistance3: number;
  support1: number;
  support2: number;
  support3: number;
  fibonacciPivot?: {
    r3: number;
    r2: number;
    r1: number;
    pivot: number;
    s1: number;
    s2: number;
    s3: number;
  };
  camarillaPivot?: {
    r4: number;
    r3: number;
    r2: number;
    r1: number;
    pivot: number;
    s1: number;
    s2: number;
    s3: number;
    s4: number;
  };
}

export interface ChartPattern {
  type: 'ascending_triangle' | 'descending_triangle' | 'symmetrical_triangle' | 
        'rising_wedge' | 'falling_wedge' | 'channel_up' | 'channel_down' | 
        'head_and_shoulders' | 'inverse_head_and_shoulders' | 'double_top' | 'double_bottom';
  confidence: number;
  breakoutTarget: number;
  entry: number;
  stopLoss: number;
  riskRewardRatio: number;
}

export interface TrailingStop {
  currentStop: number;
  highestPrice: number;
  trailPercentage: number;
  triggered: boolean;
}

export interface EntryExitSignal {
  action: 'buy' | 'sell' | 'hold';
  price: number;
  confidence: number;
  stopLoss: number;
  takeProfit: number[];
  riskRewardRatio: number;
  reasoning: string[];
  supportLevels: number[];
  resistanceLevels: number[];
}

export class ChartAnalyzer {
  
  /**
   * Identify strong support and resistance levels
   */
  identifySupportResistance(history: PriceHistory[]): SupportResistanceLevel[] {
    // Validate input to prevent stack overflow
    if (!history || history.length < 5) {
      return [];
    }
    
    const prices = history.map(h => parseFloat(h.price)).filter(p => !isNaN(p) && p > 0);
    const volumes = history.map(h => parseFloat(h.volume || '0'));
    
    // Limit data to prevent stack overflow
    const limitedPrices = prices.length > 1000 ? prices.slice(-1000) : prices;
    const limitedVolumes = volumes.length > 1000 ? volumes.slice(-1000) : volumes;
    
    if (limitedPrices.length < 5) {
      return [];
    }
    
    const levels: SupportResistanceLevel[] = [];
    const currentPrice = limitedPrices[limitedPrices.length - 1];
    
    // Find local peaks (resistance) and valleys (support)
    for (let i = 2; i < limitedPrices.length - 2; i++) {
      const price = limitedPrices[i];
      const volume = limitedVolumes[i];
      
      // Check if it's a local peak (resistance)
      if (price > limitedPrices[i-1] && price > limitedPrices[i-2] && 
          price > limitedPrices[i+1] && price > limitedPrices[i+2]) {
        
        const touches = this.countTouches(limitedPrices, price, 0.015); // Within 1.5%
        const strength = this.calculateLevelStrength(price, touches, volume, limitedVolumes);
        
        levels.push({
          price,
          strength,
          type: 'resistance',
          touches,
          confidence: strength > 70 ? 85 : strength > 50 ? 70 : 55
        });
      }
      
      // Check if it's a local valley (support)
      if (price < limitedPrices[i-1] && price < limitedPrices[i-2] && 
          price < limitedPrices[i+1] && price < limitedPrices[i+2]) {
        
        const touches = this.countTouches(limitedPrices, price, 0.015);
        const strength = this.calculateLevelStrength(price, touches, volume, limitedVolumes);
        
        levels.push({
          price,
          strength,
          type: 'support',
          touches,
          confidence: strength > 70 ? 85 : strength > 50 ? 70 : 55
        });
      }
    }
    
    // Merge nearby levels
    const mergedLevels = this.mergeSimilarLevels(levels);
    
    // Sort by strength and return top levels
    return mergedLevels
      .sort((a, b) => b.strength - a.strength)
      .slice(0, 10); // Top 10 strongest levels
  }
  
  private countTouches(prices: number[], level: number, tolerance: number): number {
    return prices.filter(p => Math.abs(p - level) / level <= tolerance).length;
  }
  
  private calculateLevelStrength(price: number, touches: number, volume: number, allVolumes: number[]): number {
    const avgVolume = allVolumes.reduce((sum, v) => sum + v, 0) / allVolumes.length;
    const volumeRatio = avgVolume > 0 ? volume / avgVolume : 1;
    
    // Strength based on touches and volume
    const touchScore = Math.min(touches * 15, 60); // Max 60 from touches
    const volumeScore = Math.min(volumeRatio * 30, 40); // Max 40 from volume
    
    return Math.min(touchScore + volumeScore, 100);
  }
  
  private mergeSimilarLevels(levels: SupportResistanceLevel[]): SupportResistanceLevel[] {
    const merged: SupportResistanceLevel[] = [];
    const sorted = [...levels].sort((a, b) => a.price - b.price);
    
    for (const level of sorted) {
      const similar = merged.find(m => 
        Math.abs(m.price - level.price) / level.price < 0.02 && m.type === level.type
      );
      
      if (similar) {
        // Merge into existing level
        similar.touches += level.touches;
        similar.strength = Math.max(similar.strength, level.strength);
        similar.price = (similar.price + level.price) / 2; // Average price
      } else {
        merged.push(level);
      }
    }
    
    return merged;
  }
  
  /**
   * Calculate Fibonacci retracement and extension levels with entry/exit signals
   */
  calculateFibonacciLevels(history: PriceHistory[]): FibonacciLevels {
    // Validate input to prevent stack overflow
    if (!history || history.length === 0) {
      return {
        levels: {},
        direction: 'retracement',
        entryLevels: [],
        exitLevels: [],
        stopLoss: 0
      };
    }
    
    const prices = history.map(h => parseFloat(h.price)).filter(p => !isNaN(p) && p > 0);
    
    // Prevent stack overflow with too many prices (limit to last 1000)
    const limitedPrices = prices.length > 1000 ? prices.slice(-1000) : prices;
    
    if (limitedPrices.length === 0) {
      return {
        levels: {},
        direction: 'retracement',
        entryLevels: [],
        exitLevels: [],
        stopLoss: 0
      };
    }
    
    // Use reduce to find min/max to avoid spread operator stack overflow
    const high = limitedPrices.reduce((max, p) => Math.max(max, p), limitedPrices[0]);
    const low = limitedPrices.reduce((min, p) => Math.min(min, p), limitedPrices[0]);
    const range = high - low;
    const currentPrice = prices[prices.length - 1];
    
    // Determine if we're in retracement or extension
    const isUptrend = prices[prices.length - 1] > prices[0];
    const direction = isUptrend ? 'retracement' : 'extension';
    
    // Calculate key Fibonacci levels
    const levels: Record<number, number> = {};
    
    if (isUptrend) {
      // Retracement levels (from high to low)
      levels[0] = high;
      levels[0.236] = high - (range * 0.236);
      levels[0.382] = high - (range * 0.382);
      levels[0.5] = high - (range * 0.5);
      levels[0.618] = high - (range * 0.618); // Golden ratio
      levels[0.786] = high - (range * 0.786);
      levels[1] = low;
      
      // Extension levels (targets above high)
      levels[1.272] = high + (range * 0.272);
      levels[1.618] = high + (range * 0.618);
      levels[2.618] = high + (range * 1.618);
    } else {
      // Retracement levels for downtrend (from low to high)
      levels[0] = low;
      levels[0.236] = low + (range * 0.236);
      levels[0.382] = low + (range * 0.382);
      levels[0.5] = low + (range * 0.5);
      levels[0.618] = low + (range * 0.618);
      levels[0.786] = low + (range * 0.786);
      levels[1] = high;
      
      // Extension levels (targets below low)
      levels[1.272] = low - (range * 0.272);
      levels[1.618] = low - (range * 0.618);
      levels[2.618] = low - (range * 1.618);
    }
    
    // Identify optimal entry levels (0.382, 0.5, 0.618 are best)
    const entryLevels = isUptrend 
      ? [levels[0.382], levels[0.5], levels[0.618]]
      : [levels[0.618], levels[0.5], levels[0.382]];
    
    // Identify exit/target levels
    const exitLevels = isUptrend
      ? [levels[1.272], levels[1.618], levels[2.618]]
      : [levels[1.272], levels[1.618], levels[2.618]];
    
    // Stop loss below/above key Fib level
    const stopLoss = isUptrend ? levels[0.786] * 0.98 : levels[0.786] * 1.02;
    
    return {
      levels,
      direction,
      entryLevels,
      exitLevels,
      stopLoss
    };
  }
  
  /**
   * Calculate pivot points for day trading
   */
  calculatePivotPoints(history: PriceHistory[]): PivotPoints {
    // Validate input to prevent stack overflow
    if (!history || history.length === 0) {
      return {
        pivot: 0,
        resistance1: 0,
        resistance2: 0,
        resistance3: 0,
        support1: 0,
        support2: 0,
        support3: 0
      };
    }
    
    // Use last trading period data
    const recentHistory = history.slice(-24); // Last 24 data points
    const prices = recentHistory.map(h => parseFloat(h.price)).filter(p => !isNaN(p) && p > 0);
    
    if (prices.length === 0) {
      return {
        pivot: 0,
        resistance1: 0,
        resistance2: 0,
        resistance3: 0,
        support1: 0,
        support2: 0,
        support3: 0
      };
    }
    
    // Use reduce to find min/max to avoid spread operator stack overflow
    const high = prices.reduce((max, p) => Math.max(max, p), prices[0]);
    const low = prices.reduce((min, p) => Math.min(min, p), prices[0]);
    const close = prices[prices.length - 1];
    
    // Classic Pivot Points
    const pivot = (high + low + close) / 3;
    const resistance1 = (2 * pivot) - low;
    const support1 = (2 * pivot) - high;
    const resistance2 = pivot + (high - low);
    const support2 = pivot - (high - low);
    const resistance3 = high + 2 * (pivot - low);
    const support3 = low - 2 * (high - pivot);
    
    // Fibonacci Pivot Points
    const fibonacciPivot = {
      pivot,
      r3: pivot + 1.000 * (high - low),
      r2: pivot + 0.618 * (high - low),
      r1: pivot + 0.382 * (high - low),
      s1: pivot - 0.382 * (high - low),
      s2: pivot - 0.618 * (high - low),
      s3: pivot - 1.000 * (high - low)
    };
    
    // Camarilla Pivot Points (for intraday)
    const camarillaPivot = {
      pivot,
      r4: close + ((high - low) * 1.1) / 2,
      r3: close + ((high - low) * 1.1) / 4,
      r2: close + ((high - low) * 1.1) / 6,
      r1: close + ((high - low) * 1.1) / 12,
      s1: close - ((high - low) * 1.1) / 12,
      s2: close - ((high - low) * 1.1) / 6,
      s3: close - ((high - low) * 1.1) / 4,
      s4: close - ((high - low) * 1.1) / 2
    };
    
    return {
      pivot,
      resistance1,
      resistance2,
      resistance3,
      support1,
      support2,
      support3,
      fibonacciPivot,
      camarillaPivot
    };
  }
  
  /**
   * Detect chart patterns (triangles, wedges, channels, head & shoulders)
   */
  detectChartPatterns(history: PriceHistory[]): ChartPattern[] {
    // Validate input to prevent stack overflow
    if (!history || history.length < 30) {
      return [];
    }
    
    const prices = history.map(h => parseFloat(h.price)).filter(p => !isNaN(p) && p > 0);
    
    // Limit data to prevent stack overflow
    const limitedPrices = prices.length > 1000 ? prices.slice(-1000) : prices;
    
    if (limitedPrices.length < 30) {
      return [];
    }
    
    const patterns: ChartPattern[] = [];
    
    // Detect ascending triangle
    const ascendingTriangle = this.detectAscendingTriangle(limitedPrices);
    if (ascendingTriangle) patterns.push(ascendingTriangle);
    
    // Detect descending triangle
    const descendingTriangle = this.detectDescendingTriangle(limitedPrices);
    if (descendingTriangle) patterns.push(descendingTriangle);
    
    // Detect symmetrical triangle
    const symmetricalTriangle = this.detectSymmetricalTriangle(limitedPrices);
    if (symmetricalTriangle) patterns.push(symmetricalTriangle);
    
    // Detect rising wedge
    const risingWedge = this.detectRisingWedge(limitedPrices);
    if (risingWedge) patterns.push(risingWedge);
    
    // Detect falling wedge
    const fallingWedge = this.detectFallingWedge(limitedPrices);
    if (fallingWedge) patterns.push(fallingWedge);
    
    // Detect channels
    const channelPattern = this.detectChannel(limitedPrices);
    if (channelPattern) patterns.push(channelPattern);
    
    // Detect head and shoulders
    const headShoulders = this.detectHeadAndShoulders(limitedPrices);
    if (headShoulders) patterns.push(headShoulders);
    
    // Detect double top/bottom
    const doublePattern = this.detectDoubleTopBottom(limitedPrices);
    if (doublePattern) patterns.push(doublePattern);
    
    return patterns.sort((a, b) => b.confidence - a.confidence);
  }
  
  private detectAscendingTriangle(prices: number[]): ChartPattern | null {
    if (prices.length < 30) return null;
    
    const recent = prices.slice(-30);
    const peaks = this.findLocalMaxima(recent);
    const valleys = this.findLocalMinima(recent);
    
    if (peaks.length < 2 || valleys.length < 2) return null;
    
    // Check for horizontal resistance
    const peakPrices = peaks.map(i => recent[i]);
    const peakVariance = this.calculateVariance(peakPrices);
    const horizontalResistance = peakVariance < 0.01; // Low variance = horizontal
    
    // Check for rising support
    const valleyPrices = valleys.map(i => recent[i]);
    const valleyTrend = (valleyPrices[valleyPrices.length - 1] - valleyPrices[0]) / valleyPrices[0];
    const risingSupport = valleyTrend > 0.02; // 2% upward trend
    
    if (horizontalResistance && risingSupport) {
      const resistance = peakPrices.reduce((max, p) => Math.max(max, p), peakPrices[0] || 0);
      const currentPrice = recent[recent.length - 1];
      const entry = currentPrice;
      const breakoutTarget = resistance * 1.05; // 5% above resistance
      const stopLoss = valleyPrices.reduce((min, p) => Math.min(min, p), valleyPrices[0] || 0) * 0.98; // Below recent support
      const riskRewardRatio = (breakoutTarget - entry) / (entry - stopLoss);
      
      return {
        type: 'ascending_triangle',
        confidence: 75 + (riskRewardRatio > 2 ? 10 : 0),
        breakoutTarget,
        entry,
        stopLoss,
        riskRewardRatio
      };
    }
    
    return null;
  }
  
  private detectDescendingTriangle(prices: number[]): ChartPattern | null {
    if (prices.length < 30) return null;
    
    const recent = prices.slice(-30);
    const peaks = this.findLocalMaxima(recent);
    const valleys = this.findLocalMinima(recent);
    
    if (peaks.length < 2 || valleys.length < 2) return null;
    
    // Check for horizontal support
    const valleyPrices = valleys.map(i => recent[i]);
    const valleyVariance = this.calculateVariance(valleyPrices);
    const horizontalSupport = valleyVariance < 0.01;
    
    // Check for descending resistance
    const peakPrices = peaks.map(i => recent[i]);
    const peakTrend = (peakPrices[peakPrices.length - 1] - peakPrices[0]) / peakPrices[0];
    const descendingResistance = peakTrend < -0.02;
    
    if (horizontalSupport && descendingResistance) {
      const support = Math.min(...valleyPrices);
      const currentPrice = recent[recent.length - 1];
      const entry = currentPrice;
      const breakoutTarget = support * 0.95; // 5% below support
      const stopLoss = Math.max(...peakPrices) * 1.02; // Above recent resistance
      const riskRewardRatio = (entry - breakoutTarget) / (stopLoss - entry);
      
      return {
        type: 'descending_triangle',
        confidence: 75 + (riskRewardRatio > 2 ? 10 : 0),
        breakoutTarget,
        entry,
        stopLoss,
        riskRewardRatio
      };
    }
    
    return null;
  }
  
  private detectSymmetricalTriangle(prices: number[]): ChartPattern | null {
    if (prices.length < 30) return null;
    
    const recent = prices.slice(-30);
    const peaks = this.findLocalMaxima(recent);
    const valleys = this.findLocalMinima(recent);
    
    if (peaks.length < 2 || valleys.length < 2) return null;
    
    const peakPrices = peaks.map(i => recent[i]);
    const valleyPrices = valleys.map(i => recent[i]);
    
    const peakTrend = (peakPrices[peakPrices.length - 1] - peakPrices[0]) / peakPrices[0];
    const valleyTrend = (valleyPrices[valleyPrices.length - 1] - valleyPrices[0]) / valleyPrices[0];
    
    // Both lines converging
    if (peakTrend < -0.02 && valleyTrend > 0.02) {
      const currentPrice = recent[recent.length - 1];
      const priceRange = Math.max(...peakPrices) - Math.min(...valleyPrices);
      const breakoutTarget = currentPrice + (priceRange * 0.5);
      const entry = currentPrice;
      const stopLoss = currentPrice - (priceRange * 0.3);
      const riskRewardRatio = (breakoutTarget - entry) / (entry - stopLoss);
      
      return {
        type: 'symmetrical_triangle',
        confidence: 70 + (riskRewardRatio > 1.5 ? 10 : 0),
        breakoutTarget,
        entry,
        stopLoss,
        riskRewardRatio
      };
    }
    
    return null;
  }
  
  private detectRisingWedge(prices: number[]): ChartPattern | null {
    if (prices.length < 30) return null;
    
    const recent = prices.slice(-30);
    const peaks = this.findLocalMaxima(recent);
    const valleys = this.findLocalMinima(recent);
    
    if (peaks.length < 2 || valleys.length < 2) return null;
    
    const peakPrices = peaks.map(i => recent[i]);
    const valleyPrices = valleys.map(i => recent[i]);
    
    const peakTrend = (peakPrices[peakPrices.length - 1] - peakPrices[0]) / peakPrices[0];
    const valleyTrend = (valleyPrices[valleyPrices.length - 1] - valleyPrices[0]) / valleyPrices[0];
    
    // Both lines rising, but converging (bearish pattern)
    if (peakTrend > 0.02 && valleyTrend > 0.02 && peakTrend < valleyTrend) {
      const currentPrice = recent[recent.length - 1];
      const support = Math.min(...valleyPrices);
      const breakoutTarget = support * 0.95;
      const entry = currentPrice;
      const stopLoss = Math.max(...peakPrices) * 1.02;
      const riskRewardRatio = (entry - breakoutTarget) / (stopLoss - entry);
      
      return {
        type: 'rising_wedge',
        confidence: 72,
        breakoutTarget,
        entry,
        stopLoss,
        riskRewardRatio
      };
    }
    
    return null;
  }
  
  private detectFallingWedge(prices: number[]): ChartPattern | null {
    if (prices.length < 30) return null;
    
    const recent = prices.slice(-30);
    const peaks = this.findLocalMaxima(recent);
    const valleys = this.findLocalMinima(recent);
    
    if (peaks.length < 2 || valleys.length < 2) return null;
    
    const peakPrices = peaks.map(i => recent[i]);
    const valleyPrices = valleys.map(i => recent[i]);
    
    const peakTrend = (peakPrices[peakPrices.length - 1] - peakPrices[0]) / peakPrices[0];
    const valleyTrend = (valleyPrices[valleyPrices.length - 1] - valleyPrices[0]) / valleyPrices[0];
    
    // Both lines falling, but converging (bullish pattern)
    if (peakTrend < -0.02 && valleyTrend < -0.02 && valleyTrend < peakTrend) {
      const currentPrice = recent[recent.length - 1];
      const resistance = Math.max(...peakPrices);
      const breakoutTarget = resistance * 1.05;
      const entry = currentPrice;
      const stopLoss = Math.min(...valleyPrices) * 0.98;
      const riskRewardRatio = (breakoutTarget - entry) / (entry - stopLoss);
      
      return {
        type: 'falling_wedge',
        confidence: 72,
        breakoutTarget,
        entry,
        stopLoss,
        riskRewardRatio
      };
    }
    
    return null;
  }
  
  private detectChannel(prices: number[]): ChartPattern | null {
    if (prices.length < 40) return null;
    
    const recent = prices.slice(-40);
    const peaks = this.findLocalMaxima(recent);
    const valleys = this.findLocalMinima(recent);
    
    if (peaks.length < 3 || valleys.length < 3) return null;
    
    const peakPrices = peaks.map(i => recent[i]);
    const valleyPrices = valleys.map(i => recent[i]);
    
    const peakTrend = (peakPrices[peakPrices.length - 1] - peakPrices[0]) / peakPrices[0];
    const valleyTrend = (valleyPrices[valleyPrices.length - 1] - valleyPrices[0]) / valleyPrices[0];
    
    // Parallel lines
    if (Math.abs(peakTrend - valleyTrend) < 0.03) {
      const currentPrice = recent[recent.length - 1];
      const channelMid = (Math.max(...peakPrices) + Math.min(...valleyPrices)) / 2;
      
      if (peakTrend > 0.02) {
        // Upward channel
        const resistance = Math.max(...peakPrices);
        const support = Math.min(...valleyPrices);
        const entry = currentPrice < channelMid ? currentPrice : support;
        const breakoutTarget = resistance;
        const stopLoss = support * 0.98;
        const riskRewardRatio = (breakoutTarget - entry) / (entry - stopLoss);
        
        return {
          type: 'channel_up',
          confidence: 70,
          breakoutTarget,
          entry,
          stopLoss,
          riskRewardRatio
        };
      } else if (peakTrend < -0.02) {
        // Downward channel
        const resistance = Math.max(...peakPrices);
        const support = Math.min(...valleyPrices);
        const entry = currentPrice > channelMid ? currentPrice : resistance;
        const breakoutTarget = support;
        const stopLoss = resistance * 1.02;
        const riskRewardRatio = (entry - breakoutTarget) / (stopLoss - entry);
        
        return {
          type: 'channel_down',
          confidence: 70,
          breakoutTarget,
          entry,
          stopLoss,
          riskRewardRatio
        };
      }
    }
    
    return null;
  }
  
  private detectHeadAndShoulders(prices: number[]): ChartPattern | null {
    if (prices.length < 50) return null;
    
    const recent = prices.slice(-50);
    const peaks = this.findLocalMaxima(recent);
    
    if (peaks.length < 3) return null;
    
    // Get last 3 peaks
    const lastPeaks = peaks.slice(-3);
    const peakPrices = lastPeaks.map(i => recent[i]);
    
    // Head and shoulders: middle peak (head) is higher than shoulders
    const leftShoulder = peakPrices[0];
    const head = peakPrices[1];
    const rightShoulder = peakPrices[2];
    
    if (head > leftShoulder * 1.03 && head > rightShoulder * 1.03 &&
        Math.abs(leftShoulder - rightShoulder) / leftShoulder < 0.05) {
      
      const valleys = this.findLocalMinima(recent);
      const neckline = valleys.length > 1 ? recent[valleys[valleys.length - 1]] : leftShoulder * 0.95;
      const currentPrice = recent[recent.length - 1];
      const entry = currentPrice;
      const breakoutTarget = neckline - (head - neckline); // Mirror projection
      const stopLoss = head * 1.02;
      const riskRewardRatio = (entry - breakoutTarget) / (stopLoss - entry);
      
      return {
        type: 'head_and_shoulders',
        confidence: 80,
        breakoutTarget,
        entry,
        stopLoss,
        riskRewardRatio
      };
    }
    
    return null;
  }
  
  private detectDoubleTopBottom(prices: number[]): ChartPattern | null {
    if (prices.length < 40) return null;
    
    const recent = prices.slice(-40);
    const peaks = this.findLocalMaxima(recent);
    const valleys = this.findLocalMinima(recent);
    
    // Double top
    if (peaks.length >= 2) {
      const lastPeaks = peaks.slice(-2);
      const peakPrices = lastPeaks.map(i => recent[i]);
      
      if (Math.abs(peakPrices[0] - peakPrices[1]) / peakPrices[0] < 0.03) {
        const support = valleys.length > 0 ? recent[valleys[valleys.length - 1]] : Math.min(...recent);
        const currentPrice = recent[recent.length - 1];
        const entry = currentPrice;
        const breakoutTarget = support * 0.95;
        const stopLoss = Math.max(...peakPrices) * 1.02;
        const riskRewardRatio = (entry - breakoutTarget) / (stopLoss - entry);
        
        return {
          type: 'double_top',
          confidence: 75,
          breakoutTarget,
          entry,
          stopLoss,
          riskRewardRatio
        };
      }
    }
    
    // Double bottom
    if (valleys.length >= 2) {
      const lastValleys = valleys.slice(-2);
      const valleyPrices = lastValleys.map(i => recent[i]);
      
      if (Math.abs(valleyPrices[0] - valleyPrices[1]) / valleyPrices[0] < 0.03) {
        const resistance = peaks.length > 0 ? recent[peaks[peaks.length - 1]] : Math.max(...recent);
        const currentPrice = recent[recent.length - 1];
        const entry = currentPrice;
        const breakoutTarget = resistance * 1.05;
        const stopLoss = Math.min(...valleyPrices) * 0.98;
        const riskRewardRatio = (breakoutTarget - entry) / (entry - stopLoss);
        
        return {
          type: 'double_bottom',
          confidence: 75,
          breakoutTarget,
          entry,
          stopLoss,
          riskRewardRatio
        };
      }
    }
    
    return null;
  }
  
  /**
   * Calculate trailing stop-loss
   */
  calculateTrailingStop(
    entryPrice: number, 
    currentPrice: number, 
    highestPrice: number, 
    trailPercentage: number = 5
  ): TrailingStop {
    const newHighest = Math.max(highestPrice, currentPrice);
    const trailAmount = newHighest * (trailPercentage / 100);
    const currentStop = newHighest - trailAmount;
    const triggered = currentPrice <= currentStop;
    
    return {
      currentStop,
      highestPrice: newHighest,
      trailPercentage,
      triggered
    };
  }
  
  /**
   * Generate comprehensive entry/exit signals
   */
  generateEntryExitSignal(history: PriceHistory[]): EntryExitSignal {
    const prices = history.map(h => parseFloat(h.price));
    const currentPrice = prices[prices.length - 1];
    
    // Get support/resistance levels
    const srLevels = this.identifySupportResistance(history);
    const supports = srLevels.filter(l => l.type === 'support').map(l => l.price);
    const resistances = srLevels.filter(l => l.type === 'resistance').map(l => l.price);
    
    // Get Fibonacci levels
    const fib = this.calculateFibonacciLevels(history);
    
    // Get pivot points
    const pivots = this.calculatePivotPoints(history);
    
    // Get chart patterns
    const patterns = this.detectChartPatterns(history);
    
    const reasoning: string[] = [];
    let action: 'buy' | 'sell' | 'hold' = 'hold';
    let confidence = 50;
    let stopLoss = currentPrice * 0.95;
    let takeProfit: number[] = [];
    let riskRewardRatio = 0;
    
    // Analyze for BUY signal
    const nearSupport = supports.some(s => Math.abs(currentPrice - s) / s < 0.02);
    const nearFibEntry = fib.entryLevels.some(e => Math.abs(currentPrice - e) / e < 0.02);
    const bullishPattern = patterns.find(p => 
      ['ascending_triangle', 'falling_wedge', 'channel_up', 'double_bottom', 'inverse_head_and_shoulders'].includes(p.type)
    );
    
    if (nearSupport || nearFibEntry || bullishPattern) {
      action = 'buy';
      confidence = 60;
      
      if (nearSupport) {
        reasoning.push(`Price near strong support at $${supports[0].toFixed(6)}`);
        confidence += 10;
      }
      
      if (nearFibEntry) {
        reasoning.push(`Price at key Fibonacci entry level`);
        confidence += 10;
      }
      
      if (bullishPattern) {
        reasoning.push(`${bullishPattern.type.replace(/_/g, ' ')} pattern detected (${bullishPattern.confidence}% confidence)`);
        confidence += 15;
        stopLoss = bullishPattern.stopLoss;
        takeProfit = [bullishPattern.breakoutTarget];
        riskRewardRatio = bullishPattern.riskRewardRatio;
      }
      
      // Use nearest resistance as take profit if no pattern
      if (takeProfit.length === 0 && resistances.length > 0) {
        const nearestResistance = resistances.reduce((nearest, r) => 
          r > currentPrice && r < nearest ? r : nearest, Infinity
        );
        if (nearestResistance !== Infinity) {
          takeProfit = [nearestResistance];
        }
      }
      
      // Add Fibonacci targets
      takeProfit.push(...fib.exitLevels.filter(e => e > currentPrice));
      stopLoss = Math.max(stopLoss, fib.stopLoss);
    }
    
    // Analyze for SELL signal
    const nearResistance = resistances.some(r => Math.abs(currentPrice - r) / r < 0.02);
    const bearishPattern = patterns.find(p => 
      ['descending_triangle', 'rising_wedge', 'channel_down', 'double_top', 'head_and_shoulders'].includes(p.type)
    );
    
    if (nearResistance || bearishPattern) {
      action = 'sell';
      confidence = 60;
      
      if (nearResistance) {
        reasoning.push(`Price near strong resistance at $${resistances[0].toFixed(6)}`);
        confidence += 10;
      }
      
      if (bearishPattern) {
        reasoning.push(`${bearishPattern.type.replace(/_/g, ' ')} pattern detected (${bearishPattern.confidence}% confidence)`);
        confidence += 15;
        stopLoss = bearishPattern.stopLoss;
        takeProfit = [bearishPattern.breakoutTarget];
        riskRewardRatio = bearishPattern.riskRewardRatio;
      }
      
      // Use nearest support as take profit if no pattern
      if (takeProfit.length === 0 && supports.length > 0) {
        const nearestSupport = supports.reduce((nearest, s) => 
          s < currentPrice && s > nearest ? s : nearest, 0
        );
        if (nearestSupport > 0) {
          takeProfit = [nearestSupport];
        }
      }
    }
    
    // CRITICAL FIX: Always calculate risk-reward ratio, never leave it at 0
    if (takeProfit.length > 0 && stopLoss > 0) {
      const avgTakeProfit = takeProfit.reduce((sum, tp) => sum + tp, 0) / takeProfit.length;
      const risk = action === 'buy' ? (currentPrice - stopLoss) : (stopLoss - currentPrice);
      const reward = action === 'buy' ? (avgTakeProfit - currentPrice) : (currentPrice - avgTakeProfit);
      riskRewardRatio = risk > 0 ? reward / risk : 0;
    } else {
      // Fallback: calculate basic R:R from support/resistance
      if (action === 'buy' && supports.length > 0 && resistances.length > 0) {
        const nearestSupport = supports.find(s => s < currentPrice) || currentPrice * 0.95;
        const nearestResistance = resistances.find(r => r > currentPrice) || currentPrice * 1.05;
        stopLoss = nearestSupport;
        takeProfit = [nearestResistance];
        riskRewardRatio = (nearestResistance - currentPrice) / (currentPrice - nearestSupport);
      } else if (action === 'sell' && supports.length > 0 && resistances.length > 0) {
        const nearestSupport = supports.find(s => s < currentPrice) || currentPrice * 0.95;
        const nearestResistance = resistances.find(r => r > currentPrice) || currentPrice * 1.05;
        stopLoss = nearestResistance;
        takeProfit = [nearestSupport];
        riskRewardRatio = (currentPrice - nearestSupport) / (nearestResistance - currentPrice);
      }
    }
    
    // Add pivot point analysis
    if (currentPrice > pivots.pivot) {
      reasoning.push(`Price above pivot point ($${pivots.pivot.toFixed(6)}) - bullish bias`);
    } else {
      reasoning.push(`Price below pivot point ($${pivots.pivot.toFixed(6)}) - bearish bias`);
    }
    
    return {
      action,
      price: currentPrice,
      confidence: Math.min(confidence, 95),
      stopLoss,
      takeProfit: takeProfit.slice(0, 3), // Max 3 targets
      riskRewardRatio: Math.max(riskRewardRatio, 0), // Ensure never negative
      reasoning,
      supportLevels: supports.slice(0, 3),
      resistanceLevels: resistances.slice(0, 3)
    };
  }
  
  private findLocalMaxima(prices: number[]): number[] {
    const maxima: number[] = [];
    for (let i = 2; i < prices.length - 2; i++) {
      if (prices[i] > prices[i-1] && prices[i] > prices[i-2] &&
          prices[i] > prices[i+1] && prices[i] > prices[i+2]) {
        maxima.push(i);
      }
    }
    return maxima;
  }
  
  private findLocalMinima(prices: number[]): number[] {
    const minima: number[] = [];
    for (let i = 2; i < prices.length - 2; i++) {
      if (prices[i] < prices[i-1] && prices[i] < prices[i-2] &&
          prices[i] < prices[i+1] && prices[i] < prices[i+2]) {
        minima.push(i);
      }
    }
    return minima;
  }
  
  private calculateVariance(values: number[]): number {
    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
    return squaredDiffs.reduce((sum, sd) => sum + sd, 0) / values.length;
  }
}

export const chartAnalyzer = new ChartAnalyzer();
