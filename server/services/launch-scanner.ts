import { EventEmitter } from 'events';
import { storage } from '../storage';
import { priceFeed } from './price-feed';
import { launchPerformanceTracker } from './launch-performance-tracker';
import { InsertLaunchCoin, Token } from '../../shared/schema';

/**
 * Early-Launch Coin Scanner Service
 * 
 * Detects coins ≤5 minutes on the market by tracking first detection time
 * and monitoring price movements for 1 hour to categorize success/failure.
 * 
 * Detection Strategy:
 * - Poll CoinGecko every 2 minutes for newly added coins
 * - Track first detection timestamp
 * - Consider coins with <5 min since first detection as "early launch"
 * - Monitor for 1 hour to determine if >100% growth (success) or not (failure)
 */
export class LaunchScanner extends EventEmitter {
  private isRunning = false;
  private scanInterval?: NodeJS.Timeout;
  private detectedCoins = new Map<string, Date>(); // tokenId -> first detection time
  private scanIntervalMs = 2 * 60 * 1000; // 2 minutes
  
  private launchCriteria = {
    maxMinutesOnMarket: 5, // Consider coins ≤5 minutes as "newly launched"
    minMarketCap: 10000, // $10K minimum
    maxMarketCap: 50000000, // $50M maximum (likely not a brand new launch if higher)
    minPriceChange24h: 10, // At least 10% price movement indicates activity
    minVolume: 500, // Minimum liquidity
  };

  start() {
    if (this.isRunning) {
      console.log('🚀 Launch Scanner already running');
      return;
    }

    this.isRunning = true;
    console.log('🚀 Launch Scanner started - scanning every 2 minutes for newly launched coins');
    
    // Run initial scan immediately
    this.scanForEarlyLaunches();
    
    // Schedule regular scans
    this.scanInterval = setInterval(() => {
      this.scanForEarlyLaunches();
    }, this.scanIntervalMs);
  }

  stop() {
    if (this.scanInterval) {
      clearInterval(this.scanInterval);
      this.scanInterval = undefined;
    }
    this.isRunning = false;
    console.log('🛑 Launch Scanner stopped');
  }

  /**
   * Scan for newly launched coins
   */
  private async scanForEarlyLaunches() {
    try {
      console.log('🔍 LAUNCH-SCANNER: Scanning for newly launched coins...');
      
      // Fetch potential new launches from multiple sources
      const [recentlyAdded, lowCapGems] = await Promise.all([
        priceFeed.fetchRecentlyAddedCoins(),
        priceFeed.fetchLowCapGems(),
      ]);

      // Combine and deduplicate
      const allCoins = [...recentlyAdded, ...lowCapGems];
      const uniqueCoins = Array.from(
        new Map(allCoins.map(coin => [coin.id, coin])).values()
      );

      let newLaunchesDetected = 0;

      for (const coin of uniqueCoins) {
        // Check if this coin meets early launch criteria
        const isEarlyLaunch = await this.checkEarlyLaunchCriteria(coin);
        
        if (isEarlyLaunch) {
          await this.recordLaunchCoin(coin);
          newLaunchesDetected++;
        }
      }

      console.log(`🚀 LAUNCH-SCANNER: Detected ${newLaunchesDetected} potential early launches from ${uniqueCoins.length} candidates`);
      
      // Cleanup old detections (>6 hours)
      this.cleanupOldDetections();
      
    } catch (error) {
      console.error('❌ LAUNCH-SCANNER: Error during scan:', error);
    }
  }

  /**
   * Check if a coin meets early launch criteria
   */
  private async checkEarlyLaunchCriteria(coin: any): Promise<boolean> {
    const marketCap = coin.market_cap || 0;
    const volume = coin.total_volume || 0;
    const priceChange = Math.abs(coin.price_change_percentage_24h || 0);

    // Check basic criteria
    if (
      marketCap < this.launchCriteria.minMarketCap ||
      marketCap > this.launchCriteria.maxMarketCap ||
      volume < this.launchCriteria.minVolume ||
      priceChange < this.launchCriteria.minPriceChange24h
    ) {
      return false;
    }

    // Check if we've seen this coin before
    const now = new Date();
    const firstDetection = this.detectedCoins.get(coin.id);
    
    if (!firstDetection) {
      // First time seeing this coin - record it
      this.detectedCoins.set(coin.id, now);
      
      // Check if it's already in our database by symbol (most reliable identifier)
      const existingToken = await storage.getTokenBySymbol(coin.symbol.toUpperCase());
      if (existingToken) {
        // Coin already exists, estimate how long it's been tracked
        const tokenAge = now.getTime() - (existingToken.lastUpdated ? new Date(existingToken.lastUpdated).getTime() : now.getTime());
        const ageMinutes = tokenAge / (60 * 1000);
        
        if (ageMinutes > this.launchCriteria.maxMinutesOnMarket) {
          return false; // Too old
        }
        
        // Check if already in launch_coins table using the actual token UUID
        const existingLaunch = await storage.getLaunchCoinByToken(existingToken.id);
        if (existingLaunch) {
          return false; // Already tracking this launch
        }
      }
      
      return true; // New coin, within criteria
    } else {
      // Calculate time since first detection
      const timeSinceDetection = now.getTime() - firstDetection.getTime();
      const minutesSinceDetection = timeSinceDetection / (60 * 1000);
      
      // Only consider it early launch if ≤5 minutes since first detection
      if (minutesSinceDetection <= this.launchCriteria.maxMinutesOnMarket) {
        // Get token by symbol to check if already recorded
        const existingToken = await storage.getTokenBySymbol(coin.symbol.toUpperCase());
        if (existingToken) {
          const existingLaunch = await storage.getLaunchCoinByToken(existingToken.id);
          return !existingLaunch;
        }
        return true; // Token doesn't exist yet, so no launch record either
      }
      
      return false;
    }
  }

  /**
   * Record a newly detected launch coin
   */
  private async recordLaunchCoin(coin: any) {
    try {
      // Ensure the token exists in main tokens table
      let token = await storage.getTokenBySymbol(coin.symbol.toUpperCase());
      
      if (!token) {
        // Add to main tokens table first with CoinGecko ID in contractAddress
        token = await storage.createToken({
          symbol: coin.symbol.toUpperCase(),
          name: coin.name,
          contractAddress: `coingecko:${coin.id}`, // Store CoinGecko ID for reference
          currentPrice: coin.current_price.toString(),
          marketCap: coin.market_cap?.toString() || '0',
          volume24h: coin.total_volume?.toString() || '0',
          priceChange24h: coin.price_change_percentage_24h?.toString() || '0',
          isActive: true,
        });
      }

      // Calculate estimated age
      const firstDetection = this.detectedCoins.get(coin.id);
      const minutesOnMarket = firstDetection 
        ? Math.floor((new Date().getTime() - firstDetection.getTime()) / (60 * 1000))
        : 0;

      // Create launch coin record
      const launchCoin: InsertLaunchCoin = {
        tokenId: token.id,
        launchPrice: coin.current_price.toString(),
        initialMarketCap: coin.market_cap?.toString() || '0',
        initialVolume: coin.total_volume?.toString() || '0',
        minutesOnMarket,
        status: 'monitoring', // Will be updated to 'success' or 'failure' after 1 hour
      };

      const created = await storage.createLaunchCoin(launchCoin);
      
      console.log(`🚀 NEW LAUNCH DETECTED: ${coin.symbol} (${coin.name})`);
      console.log(`   💰 Price: $${coin.current_price}`);
      console.log(`   📊 Market Cap: $${(coin.market_cap / 1000000).toFixed(2)}M`);
      console.log(`   📈 24h Change: ${coin.price_change_percentage_24h.toFixed(2)}%`);
      console.log(`   ⏱️ Estimated Age: ${minutesOnMarket} minutes`);
      
      // Emit event for other services to react
      this.emit('launchDetected', {
        launchCoinId: created.id,
        token,
        launchData: created,
      });

      // Start tracking performance for this launch
      await launchPerformanceTracker.trackLaunch(
        created,
        token.symbol,
        parseFloat(coin.current_price),
        coin.market_cap || 0
      );

    } catch (error) {
      console.error(`❌ LAUNCH-SCANNER: Error recording launch coin ${coin.symbol}:`, error);
    }
  }

  /**
   * Cleanup old detection records (>6 hours old)
   */
  private cleanupOldDetections() {
    const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000);
    
    for (const [coinId, detectionTime] of Array.from(this.detectedCoins.entries())) {
      if (detectionTime < sixHoursAgo) {
        this.detectedCoins.delete(coinId);
      }
    }
  }

  /**
   * Get current scanner status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      trackedCoins: this.detectedCoins.size,
      scanInterval: `${this.scanIntervalMs / 1000}s`,
      criteria: this.launchCriteria,
    };
  }
}

// Export singleton instance
export const launchScanner = new LaunchScanner();
