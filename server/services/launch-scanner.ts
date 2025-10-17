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
  private knownCoinIds = new Set<string>(); // Track all known coin IDs from CoinGecko
  private firstDetectionTime = new Map<string, Date>(); // tokenId -> first detection time
  private scanIntervalMs = 2 * 60 * 1000; // 2 minutes
  private isInitialized = false;
  
  private launchCriteria = {
    maxMinutesOnMarket: 60, // Consider coins ≤60 minutes as "newly launched" (more realistic)
    minMarketCap: 5000, // $5K minimum (lowered for better detection)
    maxMarketCap: 100000000, // $100M maximum (increased for better detection)
    minPriceChange24h: 5, // At least 5% price movement (lowered for better detection)
    minVolume: 100, // Minimum liquidity (lowered for better detection)
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
   * Scan for newly launched coins using polling method
   */
  private async scanForEarlyLaunches() {
    try {
      console.log('🔍 LAUNCH-SCANNER: Scanning for newly launched coins...');
      
      // Get all coins from CoinGecko to detect new additions
      const allCoinsList = await priceFeed.getAllCoins();
      const currentCoinIds = new Set(allCoinsList.map((c: any) => c.id));
      
      // Initialize on first run
      if (!this.isInitialized) {
        console.log(`🔍 LAUNCH-SCANNER: Initializing with ${currentCoinIds.size} known coins`);
        this.knownCoinIds = currentCoinIds;
        this.isInitialized = true;
        return;
      }
      
      // Find newly added coins
      const newCoinIds = Array.from(currentCoinIds).filter(id => !this.knownCoinIds.has(id));
      
      if (newCoinIds.length === 0) {
        console.log(`🔍 LAUNCH-SCANNER: No new coins detected from ${currentCoinIds.size} total`);
        // Update known coins
        this.knownCoinIds = currentCoinIds;
        return;
      }
      
      console.log(`🚨 LAUNCH-SCANNER: Detected ${newCoinIds.length} NEW coins!`);
      
      // Fetch detailed data for new coins
      let newLaunchesDetected = 0;
      
      for (const coinId of newCoinIds) {
        try {
          const coinInfo = await priceFeed.getCoinMarketData(coinId);
          
          if (!coinInfo) {
            console.log(`⚠️ No market data for ${coinId}, skipping`);
            continue;
          }
          
          // Check if meets launch criteria
          const isEarlyLaunch = this.meetsLaunchCriteria(coinInfo);
          
          if (isEarlyLaunch) {
            await this.recordLaunchCoin(coinInfo);
            newLaunchesDetected++;
          } else {
            console.log(`⚠️ Coin ${coinInfo.symbol} detected but doesn't meet criteria`);
          }
        } catch (error) {
          console.error(`❌ Error processing new coin ${coinId}:`, error);
        }
      }
      
      // Update known coins
      this.knownCoinIds = currentCoinIds;
      
      console.log(`🚀 LAUNCH-SCANNER: Recorded ${newLaunchesDetected} qualifying launches from ${newCoinIds.length} new coins`);
      
      // Cleanup old detections (>6 hours)
      this.cleanupOldDetections();
      
    } catch (error) {
      console.error('❌ LAUNCH-SCANNER: Error during scan:', error);
    }
  }

  /**
   * Check if a coin meets early launch criteria (simplified)
   */
  private meetsLaunchCriteria(coin: any): boolean {
    const marketCap = coin.market_cap || 0;
    const volume = coin.total_volume || 0;
    const priceChange = Math.abs(coin.price_change_percentage_24h || 0);

    // Check basic criteria
    const meetsBasic = 
      marketCap >= this.launchCriteria.minMarketCap &&
      marketCap <= this.launchCriteria.maxMarketCap &&
      volume >= this.launchCriteria.minVolume &&
      priceChange >= this.launchCriteria.minPriceChange24h;
    
    if (!meetsBasic) {
      console.log(`⚠️ ${coin.symbol}: MC=${marketCap}, Vol=${volume}, Change=${priceChange}% - doesn't meet criteria`);
    }
    
    return meetsBasic;
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

      // Calculate estimated age (newly detected = 0 minutes)
      const firstDetection = this.firstDetectionTime.get(coin.id) || new Date();
      const minutesOnMarket = Math.floor((new Date().getTime() - firstDetection.getTime()) / (60 * 1000));

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
    
    for (const [coinId, detectionTime] of Array.from(this.firstDetectionTime.entries())) {
      if (detectionTime < sixHoursAgo) {
        this.firstDetectionTime.delete(coinId);
      }
    }
  }

  /**
   * Get current scanner status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      trackedCoins: this.knownCoinIds.size,
      firstDetections: this.firstDetectionTime.size,
      scanInterval: `${this.scanIntervalMs / 1000}s`,
      criteria: this.launchCriteria,
    };
  }
}

// Export singleton instance
export const launchScanner = new LaunchScanner();
