import { storage } from '../storage';
import type { LaunchCoin } from '@shared/schema';

interface LaunchSnapshot {
  launchCoinId: string;
  tokenId: string;
  symbol: string;
  initialPrice: number;
  initialMarketCap: number;
  detectedAt: Date;
  priceSnapshots: { time: Date; price: number; marketCap: number }[];
}

/**
 * Launch Performance Tracker
 * Monitors newly launched coins for 1 hour to track price movements
 * and categorize launches as successful (>100% growth) or failed
 */
export class LaunchPerformanceTracker {
  private monitoringLaunches: Map<string, LaunchSnapshot> = new Map();
  private checkInterval: NodeJS.Timeout | null = null;
  
  // Configuration
  private readonly monitorDurationMs = 60 * 60 * 1000; // 1 hour
  private readonly checkIntervalMs = 2 * 60 * 1000; // Check every 2 minutes
  private readonly successThreshold = 1.0; // 100% growth = 2x price

  constructor() {}

  /**
   * Start monitoring performance
   */
  start() {
    console.log('🎯 Launch Performance Tracker started');
    
    // Load any existing monitoring launches from DB
    this.loadMonitoringLaunches();
    
    // Start periodic checks
    this.checkInterval = setInterval(() => {
      this.checkLaunchPerformance();
    }, this.checkIntervalMs);
  }

  /**
   * Stop monitoring
   */
  stop() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    console.log('🛑 Launch Performance Tracker stopped');
  }

  /**
   * Add a newly detected launch to monitoring
   */
  async trackLaunch(launchCoin: LaunchCoin, symbol: string, currentPrice: number, currentMarketCap: number) {
    const detectedAt = launchCoin.detectedAt ? new Date(launchCoin.detectedAt) : new Date();
    
    const snapshot: LaunchSnapshot = {
      launchCoinId: launchCoin.id,
      tokenId: launchCoin.tokenId,
      symbol,
      initialPrice: currentPrice,
      initialMarketCap: currentMarketCap,
      detectedAt,
      priceSnapshots: [
        { time: new Date(), price: currentPrice, marketCap: currentMarketCap }
      ]
    };

    this.monitoringLaunches.set(launchCoin.id, snapshot);
    console.log(`📊 Now tracking launch: ${symbol} at $${currentPrice}`);
  }

  /**
   * Load existing monitoring launches from database
   */
  private async loadMonitoringLaunches() {
    try {
      const monitoringCoins = await storage.getMonitoringLaunchCoins();
      
      for (const coin of monitoringCoins) {
        if (!coin.detectedAt) continue;
        
        // Check if still within monitoring window
        const timeSinceDetection = Date.now() - new Date(coin.detectedAt).getTime();
        
        if (timeSinceDetection < this.monitorDurationMs) {
          // Get current price and symbol from token
          const token = await storage.getToken(coin.tokenId);
          if (token) {
            const currentPrice = parseFloat(token.currentPrice || '0');
            const currentMarketCap = parseFloat(token.marketCap || '0');
            const launchPrice = parseFloat(coin.launchPrice);
            const initMarketCap = coin.initialMarketCap ? parseFloat(coin.initialMarketCap || '0') : currentMarketCap;
            
            const snapshot: LaunchSnapshot = {
              launchCoinId: coin.id,
              tokenId: coin.tokenId,
              symbol: token.symbol,
              initialPrice: launchPrice,
              initialMarketCap: initMarketCap,
              detectedAt: new Date(coin.detectedAt),
              priceSnapshots: [
                { time: new Date(coin.detectedAt), price: launchPrice, marketCap: initMarketCap },
                { time: new Date(), price: currentPrice, marketCap: currentMarketCap }
              ]
            };
            
            this.monitoringLaunches.set(coin.id, snapshot);
            console.log(`📈 Resumed tracking: ${token.symbol}`);
          }
        }
      }
      
      console.log(`📊 Loaded ${this.monitoringLaunches.size} launches for monitoring`);
    } catch (error) {
      console.error('Error loading monitoring launches:', error);
    }
  }

  /**
   * Check performance of all monitored launches
   */
  private async checkLaunchPerformance() {
    const now = Date.now();
    const launchesToAnalyze: string[] = [];

    for (const [launchId, snapshot] of Array.from(this.monitoringLaunches.entries())) {
      try {
        const timeSinceDetection = now - snapshot.detectedAt.getTime();
        
        // Update current price snapshot
        const token = await storage.getToken(snapshot.tokenId);
        if (token) {
          const currentPrice = parseFloat(token.currentPrice || '0');
          const currentMarketCap = parseFloat(token.marketCap || '0');
          
          snapshot.priceSnapshots.push({
            time: new Date(),
            price: currentPrice,
            marketCap: currentMarketCap
          });
        }

        // Check if monitoring period is complete
        if (timeSinceDetection >= this.monitorDurationMs) {
          launchesToAnalyze.push(launchId);
        }
      } catch (error) {
        console.error(`Error checking launch ${snapshot.symbol}:`, error);
      }
    }

    // Analyze completed launches
    for (const launchId of launchesToAnalyze) {
      await this.analyzeLaunch(launchId);
      this.monitoringLaunches.delete(launchId);
    }
  }

  /**
   * Analyze a launch after monitoring period completes
   */
  private async analyzeLaunch(launchId: string) {
    const snapshot = this.monitoringLaunches.get(launchId);
    if (!snapshot) return;

    try {
      // Calculate performance metrics
      const latestSnapshot = snapshot.priceSnapshots[snapshot.priceSnapshots.length - 1];
      const peakPrice = Math.max(...snapshot.priceSnapshots.map(s => s.price));
      const lowestPrice = Math.min(...snapshot.priceSnapshots.map(s => s.price));
      const finalPrice = latestSnapshot.price;

      const peakGainPercent = ((peakPrice - snapshot.initialPrice) / snapshot.initialPrice) * 100;
      const finalGainPercent = ((finalPrice - snapshot.initialPrice) / snapshot.initialPrice) * 100;
      const maxDrawdown = peakPrice > 0 ? ((lowestPrice - peakPrice) / peakPrice) * 100 : 0;

      // Find time to max gain
      const peakSnapshot = snapshot.priceSnapshots.find(s => s.price === peakPrice);
      const timeToMaxGain = peakSnapshot 
        ? Math.floor((peakSnapshot.time.getTime() - snapshot.detectedAt.getTime()) / (60 * 1000))
        : 0;

      // Determine outcome based on FINAL 1-hour performance (not peak)
      // Success = final price after 1 hour is >100% above initial (2x or more)
      const isSuccess = finalGainPercent >= (this.successThreshold * 100);
      const outcomeType = isSuccess ? 'success' : 'failure';
      const status = isSuccess ? 'success' : 'failure';

      // Extract pattern characteristics
      const patterns = this.extractPatterns(snapshot);

      // Check if analysis already exists
      const existingAnalysis = await storage.getLaunchAnalysisByLaunchId(launchId);
      
      if (!existingAnalysis) {
        // Create analysis record
        await storage.createLaunchAnalysis({
          launchCoinId: launchId,
          outcomeType,
          maxPriceReached: peakPrice.toString(),
          maxGainPercent: (peakGainPercent / 100).toString(), // Store as decimal
          timeToMaxGain,
          volumePattern: patterns.volumePattern,
          priceVolatility: (Math.abs(maxDrawdown) / 100).toString(), // Store as decimal
          initialMomentum: patterns.initialMomentum.toString(),
          volumeVsMarketCap: patterns.volumeVsMarketCap.toString(),
          identifiedPatterns: patterns.identifiedPatterns,
          successFactors: patterns.successFactors,
          analysisComplete: true,
        });

        // Update launch coin status
        await storage.updateLaunchCoin(launchId, {
          status,
          outcomePrice: finalPrice.toString(),
          priceChange1h: (finalGainPercent / 100).toString(), // Store as decimal
          evaluatedAt: new Date(),
        });

        console.log(
          `✅ Analysis complete: ${snapshot.symbol} - ${outcomeType.toUpperCase()} ` +
          `(Peak: ${peakGainPercent.toFixed(1)}%, Final: ${finalGainPercent.toFixed(1)}%)`
        );
      }
    } catch (error) {
      console.error(`Error analyzing launch ${snapshot.symbol}:`, error);
    }
  }

  /**
   * Extract pattern characteristics from price snapshots
   */
  private extractPatterns(snapshot: LaunchSnapshot) {
    const snapshots = snapshot.priceSnapshots;
    const prices = snapshots.map(s => s.price);
    const marketCaps = snapshots.map(s => s.marketCap);

    // Volume pattern analysis
    const avgMarketCap = marketCaps.reduce((a, b) => a + b, 0) / marketCaps.length;
    let volumePattern = 'stable';
    if (avgMarketCap > snapshot.initialMarketCap * 2) {
      volumePattern = 'increasing';
    } else if (avgMarketCap < snapshot.initialMarketCap * 0.5) {
      volumePattern = 'decreasing';
    }

    // Check for volume spike
    const maxMarketCap = Math.max(...marketCaps);
    if (maxMarketCap > avgMarketCap * 3) {
      volumePattern = 'spike';
    }

    // Calculate initial momentum (first 15 minutes)
    const quarterIndex = Math.floor(prices.length / 4);
    const earlyPrice = prices[Math.min(quarterIndex, prices.length - 1)];
    const initialMomentum = ((earlyPrice - prices[0]) / prices[0]);

    // Volume vs market cap ratio
    const avgVolume = marketCaps.reduce((a, b) => a + b, 0) / marketCaps.length;
    const volumeVsMarketCap = avgVolume > 0 ? (avgVolume / snapshot.initialMarketCap) : 0;

    // Identify patterns
    const identifiedPatterns: string[] = [];
    const peakIndex = prices.indexOf(Math.max(...prices));
    
    if (peakIndex < snapshots.length / 3) {
      identifiedPatterns.push('early_peak');
    } else if (peakIndex > snapshots.length * 0.66) {
      identifiedPatterns.push('late_pump');
    }
    
    if (initialMomentum > 0.5) {
      identifiedPatterns.push('strong_open');
    } else if (initialMomentum < 0) {
      identifiedPatterns.push('weak_open');
    }
    
    if (volumePattern === 'spike') {
      identifiedPatterns.push('volume_spike');
    }

    // Success/failure factors
    const successFactors = {
      initial_momentum: initialMomentum,
      volume_pattern: volumePattern,
      peak_timing: peakIndex / snapshots.length,
      volume_ratio: volumeVsMarketCap,
    };

    return {
      volumePattern,
      initialMomentum,
      volumeVsMarketCap,
      identifiedPatterns,
      successFactors,
    };
  }

  /**
   * Get current monitoring status
   */
  getMonitoringStatus() {
    return {
      activeMonitoring: this.monitoringLaunches.size,
      launches: Array.from(this.monitoringLaunches.values()).map(s => ({
        symbol: s.symbol,
        detectedAt: s.detectedAt,
        initialPrice: s.initialPrice,
        currentPrice: s.priceSnapshots[s.priceSnapshots.length - 1]?.price,
        snapshotCount: s.priceSnapshots.length,
      }))
    };
  }
}

export const launchPerformanceTracker = new LaunchPerformanceTracker();
