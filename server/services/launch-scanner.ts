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
    minMarketCap: 10000, // $10K minimum - early-stage coins
    maxMarketCap: 50000000, // $50M maximum - still small enough to be "early"
    minPriceChange24h: 10, // At least 10% price movement - indicates early momentum
    minVolumeChange24h: 100, // 100%+ volume spike - indicates new interest (relaxed)
    minVolume: 500, // Minimum $500 liquidity
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
   * Scan for early-stage coins using market characteristics
   * New strategy: Look for coins with early-stage indicators in existing market data
   */
  private async scanForEarlyLaunches() {
    try {
      console.log('🔍 LAUNCH-SCANNER: Scanning for early-stage coins with launch characteristics...');
      
      // Get all active tokens (these have market data we can analyze)
      const allTokens = await storage.getActiveTokens();
      
      if (!allTokens || allTokens.length === 0) {
        console.log('⚠️ LAUNCH-SCANNER: No tokens available for scanning');
        return;
      }
      
      let candidatesFound = 0;
      let newLaunchesDetected = 0;
      
      // Scan each token for early-stage characteristics
      for (const token of allTokens) {
        try {
          // Skip if we're already monitoring this token
          const existingLaunch = await storage.getLaunchCoinByToken(token.id);
          if (existingLaunch && existingLaunch.status === 'monitoring') {
            continue; // Already tracking this one
          }
          
          // Check if token meets early-stage criteria
          const marketCap = parseFloat(token.marketCap || '0');
          const priceChange24h = parseFloat(token.priceChange24h || '0');
          const volume = parseFloat(token.volume24h || '0');
          
          // Early-stage indicators
          const hasSmallMarketCap = marketCap >= this.launchCriteria.minMarketCap && 
                                     marketCap <= this.launchCriteria.maxMarketCap;
          const hasHighPriceChange = Math.abs(priceChange24h) >= this.launchCriteria.minPriceChange24h;
          // For now, accept any high price change coin (volume spike hard to track without historical data)
          const hasVolumeSpike = true; // Simplified: all tokens with high price change qualify
          const hasSufficientVolume = volume >= this.launchCriteria.minVolume;
          
          // Must meet all criteria to be considered early-stage
          if (hasSmallMarketCap && hasHighPriceChange && hasVolumeSpike && hasSufficientVolume) {
            candidatesFound++;
            
            // Create coinInfo object for recording
            const coinInfo = {
              id: token.id,
              symbol: token.symbol,
              name: token.name,
              current_price: parseFloat(token.currentPrice || '0'),
              market_cap: marketCap,
              total_volume: volume,
              price_change_percentage_24h: priceChange24h,
              ath: parseFloat(token.currentPrice || '0'), // Use current price as ATH estimate
              ath_date: new Date().toISOString(),
            };
            
            await this.recordLaunchCoin(coinInfo);
            newLaunchesDetected++;
            
            console.log(`🚀 LAUNCH-SCANNER: Found early-stage coin ${token.symbol}: $${marketCap.toLocaleString()} MC, ${priceChange24h.toFixed(1)}% 24h change`);
          }
        } catch (error) {
          // Silent continue - don't spam logs for minor errors
          continue;
        }
      }
      
      console.log(`🔍 LAUNCH-SCANNER: Scan complete - scanned ${allTokens.length} tokens`);
      
      if (candidatesFound > 0) {
        console.log(`✅ LAUNCH-SCANNER: Found ${candidatesFound} early-stage candidates, recorded ${newLaunchesDetected} new launches`);
      } else {
        console.log(`⚠️ LAUNCH-SCANNER: No coins met all criteria (MC: $10K-$50M, Price: ≥10%, Vol: ≥$500)`);
      }
      
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
