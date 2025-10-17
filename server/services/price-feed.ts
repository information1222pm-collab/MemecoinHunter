import { EventEmitter } from 'events';
import { storage } from '../storage';
import { cacheService } from './cache-service';
import type { InsertPriceHistory, InsertToken } from '@shared/schema';

interface PriceUpdate {
  tokenId: string;
  symbol: string;
  price: number;
  volume: number;
  change24h: number;
}

interface CoinGeckoToken {
  id: string;
  symbol: string;
  name: string;
  current_price: number;
  market_cap: number;
  total_volume: number;
  price_change_percentage_24h: number;
  contract_address?: string;
  // Enhanced data fields
  circulating_supply?: number;
  total_supply?: number;
  max_supply?: number;
  ath?: number;
  ath_change_percentage?: number;
  atl?: number;
  atl_change_percentage?: number;
  roi?: { percentage: number };
  price_change_percentage_7d?: number;
  price_change_percentage_30d?: number;
  high_24h?: number;
  low_24h?: number;
}

interface TrendingCoin {
  id: string;
  coin_id: number;
  name: string;
  symbol: string;
  market_cap_rank: number;
  thumb: string;
  small: string;
  large: string;
  slug: string;
  price_btc: number;
  score: number;
}

interface TopGainer {
  id: string;
  symbol: string;
  name: string;
  current_price: number;
  price_change_percentage_24h: number;
  market_cap: number;
  total_volume: number;
}

interface NewlyLaunchedCoin {
  id: string;
  symbol: string;
  name: string;
  current_price: number;
  market_cap: number;
  total_volume: number;
  ath_date?: string;
  genesis_date?: string;
  price_change_percentage_24h: number;
}

interface CachedResponse {
  data: any;
  timestamp: number;
}

class PriceFeedService extends EventEmitter {
  private isRunning = false;
  private updateInterval?: NodeJS.Timeout;
  private readonly API_BASE = 'https://api.coingecko.com/api/v3';
  private readonly RATE_LIMIT_DELAY = 6000; // 6 seconds between requests to avoid rate limits
  private readonly CACHE_TTL = 600000; // 10 minutes cache TTL
  private lastRequestTime = 0;
  private responseCache = new Map<string, CachedResponse>(); // Response caching layer
  private requestQueue: Array<() => Promise<void>> = [];
  private isProcessingQueue = false;
  
  // EXPANDED: Now fetching top 5000 coins dynamically
  private readonly MAX_COINS_TO_TRACK = 5000; // Track top 5000 coins by market cap
  private readonly COINS_PER_PAGE = 250; // CoinGecko max per page
  private readonly BATCH_SIZE = 100; // Process in batches for memory efficiency
  
  start() {
    if (this.isRunning) return;
    
    this.isRunning = true;
    console.log('📡 Price feed service started (CoinGecko API)');
    
    // Initialize tokens on startup
    this.initializeTokensFromAPI();
    
    // Update prices every 2 minutes (reduced frequency for 5000 coins)
    this.updateInterval = setInterval(() => {
      this.updatePrices();
    }, 120000); // 2 minutes
  }

  stop() {
    this.isRunning = false;
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }
    console.log('🛑 Price feed service stopped');
  }

  private async initializeTokensFromAPI() {
    try {
      console.log('🔄 Fetching top 5000 tokens from CoinGecko API...');
      const allCoins = await this.fetchAllCoinsData();
      
      console.log(`📊 Processing ${allCoins.length} coins...`);
      
      // Process in batches to avoid overwhelming the database
      for (let i = 0; i < allCoins.length; i += this.BATCH_SIZE) {
        const batch = allCoins.slice(i, Math.min(i + this.BATCH_SIZE, allCoins.length));
        
        await Promise.all(batch.map(async (coin) => {
          try {
            const existing = await storage.getTokenBySymbol(coin.symbol.toUpperCase());
            
            if (!existing) {
              const tokenData: InsertToken = {
                symbol: coin.symbol.toUpperCase(),
                name: coin.name,
                currentPrice: coin.current_price.toString(),
                marketCap: coin.market_cap.toString(),
                volume24h: coin.total_volume.toString(),
                priceChange24h: coin.price_change_percentage_24h.toString(),
                contractAddress: coin.contract_address || `coingecko:${coin.id}`,
              };
              
              await storage.createToken(tokenData);
            } else {
              // Update existing token
              await storage.updateToken(existing.id, {
                currentPrice: coin.current_price.toString(),
                marketCap: coin.market_cap.toString(),
                volume24h: coin.total_volume.toString(),
                priceChange24h: coin.price_change_percentage_24h.toString(),
              });
            }
          } catch (error) {
            console.error(`Error processing coin ${coin.symbol}:`, error);
          }
        }));
        
        console.log(`📊 Processed ${Math.min(i + this.BATCH_SIZE, allCoins.length)}/${allCoins.length} coins`);
        
        // Small delay between batches to avoid overwhelming the system
        if (i + this.BATCH_SIZE < allCoins.length) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
      
      console.log(`✅ Successfully initialized ${allCoins.length} tokens`);
    } catch (error) {
      console.error('Error initializing tokens from API:', error);
      // Fallback to ensure some tokens exist
      await this.createFallbackTokens();
    }
  }

  private async updatePrices() {
    try {
      console.log('🔄 Updating prices for top 5000 coins...');
      const allCoins = await this.fetchAllCoinsData();
      const tokens = await storage.getActiveTokens();
      
      // Create a map for faster lookup
      const tokenMap = new Map(tokens.map(t => [t.symbol.toLowerCase(), t]));
      
      let updatedCount = 0;
      
      // Process in batches
      for (let i = 0; i < allCoins.length; i += this.BATCH_SIZE) {
        const batch = allCoins.slice(i, Math.min(i + this.BATCH_SIZE, allCoins.length));
        
        await Promise.all(batch.map(async (coin) => {
          try {
            const token = tokenMap.get(coin.symbol.toLowerCase());
            if (!token) return;
            
            const priceUpdate: PriceUpdate = {
              tokenId: token.id,
              symbol: token.symbol,
              price: coin.current_price,
              volume: coin.total_volume,
              change24h: coin.price_change_percentage_24h,
            };
            
            // Update token price
            await storage.updateToken(token.id, {
              currentPrice: coin.current_price.toString(),
              volume24h: coin.total_volume.toString(),
              priceChange24h: coin.price_change_percentage_24h.toString(),
              marketCap: coin.market_cap.toString(),
            });
            
            // Save price history
            await storage.createPriceHistory({
              tokenId: token.id,
              price: coin.current_price.toString(),
              volume: coin.total_volume.toString(),
            });
            
            this.emit('priceUpdate', priceUpdate);
            updatedCount++;
          } catch (error) {
            console.error(`Error updating price for ${coin.symbol}:`, error);
          }
        }));
        
        // Small delay between batches
        if (i + this.BATCH_SIZE < allCoins.length) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }
      
      console.log(`💰 Updated prices for ${updatedCount} tokens`);
    } catch (error) {
      console.error('Error updating prices:', error);
    }
  }

  /**
   * Check cache before making API request
   */
  private getCachedResponse(cacheKey: string): any | null {
    const cached = this.responseCache.get(cacheKey);
    if (!cached) return null;
    
    const now = Date.now();
    const age = now - cached.timestamp;
    
    if (age > this.CACHE_TTL) {
      this.responseCache.delete(cacheKey);
      return null;
    }
    
    console.log(`📦 Using cached response for ${cacheKey} (age: ${Math.floor(age/1000)}s)`);
    return cached.data;
  }

  /**
   * Store response in cache
   */
  private setCachedResponse(cacheKey: string, data: any): void {
    this.responseCache.set(cacheKey, {
      data,
      timestamp: Date.now()
    });
  }

  /**
   * Fetch all 5000 coins with pagination
   */
  private async fetchAllCoinsData(): Promise<CoinGeckoToken[]> {
    const cacheKey = 'all_coins_5000';
    const cachedData = this.getCachedResponse(cacheKey);
    if (cachedData) {
      return cachedData;
    }

    console.log('🌐 Fetching 5000 coins from CoinGecko (this may take a moment)...');
    
    const allCoins: CoinGeckoToken[] = [];
    const totalPages = Math.ceil(this.MAX_COINS_TO_TRACK / this.COINS_PER_PAGE);
    
    for (let page = 1; page <= totalPages; page++) {
      try {
        const pageData = await this.fetchCoinsPage(page);
        allCoins.push(...pageData);
        
        console.log(`📄 Fetched page ${page}/${totalPages} (${allCoins.length} coins so far)`);
        
        // Rate limiting between pages
        if (page < totalPages) {
          await new Promise(resolve => setTimeout(resolve, this.RATE_LIMIT_DELAY));
        }
      } catch (error) {
        console.error(`Error fetching page ${page}:`, error);
        // Continue with what we have so far
        break;
      }
    }
    
    // Cache the result
    this.setCachedResponse(cacheKey, allCoins);
    
    console.log(`✅ Fetched ${allCoins.length} coins total`);
    return allCoins;
  }

  /**
   * Fetch a single page of coins from CoinGecko
   */
  private async fetchCoinsPage(page: number, retryCount = 0): Promise<CoinGeckoToken[]> {
    const maxRetries = 3;
    const baseDelay = 2000;
    
    try {
      await this.respectRateLimit();
      
      // Fetch coins ordered by market cap
      const url = `${this.API_BASE}/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=${this.COINS_PER_PAGE}&page=${page}&sparkline=false&price_change_percentage=24h,7d,30d`;
      
      const response = await fetch(url, {
        headers: {
          'Accept': 'application/json',
        }
      });
      
      // Handle rate limiting with exponential backoff
      if (response.status === 429) {
        if (retryCount < maxRetries) {
          const delay = baseDelay * Math.pow(2, retryCount);
          console.log(`⏳ Rate limited on page ${page}. Retrying in ${delay/1000}s...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          return this.fetchCoinsPage(page, retryCount + 1);
        }
        throw new Error(`Rate limit exceeded for page ${page}`);
      }
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      
      return data.map((coin: any) => ({
        id: coin.id,
        symbol: coin.symbol,
        name: coin.name,
        current_price: coin.current_price || 0,
        market_cap: coin.market_cap || 0,
        total_volume: coin.total_volume || 0,
        price_change_percentage_24h: coin.price_change_percentage_24h || 0,
        contract_address: coin.contract_address,
        circulating_supply: coin.circulating_supply,
        total_supply: coin.total_supply,
        max_supply: coin.max_supply,
        ath: coin.ath,
        ath_change_percentage: coin.ath_change_percentage,
        atl: coin.atl,
        atl_change_percentage: coin.atl_change_percentage,
        roi: coin.roi,
        price_change_percentage_7d: coin.price_change_percentage_7d_in_currency,
        price_change_percentage_30d: coin.price_change_percentage_30d_in_currency,
        high_24h: coin.high_24h,
        low_24h: coin.low_24h,
      }));
    } catch (error) {
      if (retryCount >= maxRetries) {
        throw error;
      }
      const delay = baseDelay * Math.pow(2, retryCount);
      await new Promise(resolve => setTimeout(resolve, delay));
      return this.fetchCoinsPage(page, retryCount + 1);
    }
  }

  /**
   * Deprecated - kept for backward compatibility
   * Now fetches first page only
   */
  private async fetchCoinsData(retryCount = 0): Promise<CoinGeckoToken[]> {
    return this.fetchCoinsPage(1, retryCount);
  }

  private async respectRateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    
    if (timeSinceLastRequest < this.RATE_LIMIT_DELAY) {
      await new Promise(resolve => setTimeout(resolve, this.RATE_LIMIT_DELAY - timeSinceLastRequest));
    }
    
    this.lastRequestTime = Date.now();
  }

  /**
   * Process the request queue to ensure rate limiting
   */
  private async processRequestQueue(): Promise<void> {
    if (this.isProcessingQueue || this.requestQueue.length === 0) {
      return;
    }
    
    this.isProcessingQueue = true;
    
    while (this.requestQueue.length > 0) {
      const request = this.requestQueue.shift();
      if (request) {
        await this.respectRateLimit();
        try {
          await request();
        } catch (error) {
          console.error('Error processing queued request:', error);
        }
      }
    }
    
    this.isProcessingQueue = false;
  }

  /**
   * Add a request to the queue and process it
   */
  private async queueRequest<T>(requestFn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.requestQueue.push(async () => {
        try {
          const result = await requestFn();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });
      
      // Start processing the queue if not already running
      this.processRequestQueue();
    });
  }

  private async createFallbackTokens(): Promise<void> {
    console.log('⚠️ Creating fallback tokens due to API failure');
    const fallbackTokens = [
      { symbol: 'BTC', name: 'Bitcoin', price: '50000', marketCap: '1000000000000' },
      { symbol: 'ETH', name: 'Ethereum', price: '3000', marketCap: '400000000000' },
      { symbol: 'SOL', name: 'Solana', price: '100', marketCap: '50000000000' },
      { symbol: 'DOGE', name: 'Dogecoin', price: '0.1', marketCap: '15000000000' },
      { symbol: 'SHIB', name: 'Shiba Inu', price: '0.00001', marketCap: '10000000000' },
      { symbol: 'PEPE', name: 'Pepe', price: '0.000001', marketCap: '5000000000' },
    ];

    for (const token of fallbackTokens) {
      const existing = await storage.getTokenBySymbol(token.symbol);
      if (!existing) {
        await storage.createToken({
          symbol: token.symbol,
          name: token.name,
          currentPrice: token.price,
          marketCap: token.marketCap,
          volume24h: '1000000',
          priceChange24h: '0',
          contractAddress: `fallback:${token.symbol.toLowerCase()}`,
        });
      }
    }
  }

  async getTrendingCoins(): Promise<TrendingCoin[]> {
    try {
      const cacheKey = 'trending_coins';
      const cached = this.getCachedResponse(cacheKey);
      if (cached) return cached;

      await this.respectRateLimit();
      
      const response = await fetch(`${this.API_BASE}/search/trending`);
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }
      
      const data = await response.json();
      const trending = data.coins.map((item: any) => item.item);
      
      this.setCachedResponse(cacheKey, trending);
      return trending;
    } catch (error) {
      console.error('Error fetching trending coins:', error);
      return [];
    }
  }

  async getTopGainers(limit = 10): Promise<TopGainer[]> {
    try {
      const cacheKey = `top_gainers_${limit}`;
      const cached = this.getCachedResponse(cacheKey);
      if (cached) return cached;

      await this.respectRateLimit();
      
      const url = `${this.API_BASE}/coins/markets?vs_currency=usd&order=price_change_percentage_24h_desc&per_page=${limit}&page=1&sparkline=false`;
      
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }
      
      const data = await response.json();
      const gainers = data.map((coin: any) => ({
        id: coin.id,
        symbol: coin.symbol,
        name: coin.name,
        current_price: coin.current_price,
        price_change_percentage_24h: coin.price_change_percentage_24h,
        market_cap: coin.market_cap,
        total_volume: coin.total_volume,
      }));
      
      this.setCachedResponse(cacheKey, gainers);
      return gainers;
    } catch (error) {
      console.error('Error fetching top gainers:', error);
      return [];
    }
  }

  async getNewlyLaunchedCoins(): Promise<NewlyLaunchedCoin[]> {
    try {
      const cacheKey = 'newly_launched';
      const cached = this.getCachedResponse(cacheKey);
      if (cached) return cached;

      await this.respectRateLimit();
      
      // Fetch recently added coins (low market cap, new listings)
      const url = `${this.API_BASE}/coins/markets?vs_currency=usd&order=market_cap_asc&per_page=50&page=1&sparkline=false`;
      
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Filter for coins with recent ATH dates (indicating new launch)
      const newCoins = data
        .filter((coin: any) => {
          if (!coin.ath_date) return false;
          const athDate = new Date(coin.ath_date);
          const daysSinceATH = (Date.now() - athDate.getTime()) / (1000 * 60 * 60 * 24);
          return daysSinceATH <= 30; // Coins that hit ATH in last 30 days
        })
        .map((coin: any) => ({
          id: coin.id,
          symbol: coin.symbol,
          name: coin.name,
          current_price: coin.current_price,
          market_cap: coin.market_cap,
          total_volume: coin.total_volume,
          ath_date: coin.ath_date,
          price_change_percentage_24h: coin.price_change_percentage_24h,
        }));
      
      this.setCachedResponse(cacheKey, newCoins);
      return newCoins;
    } catch (error) {
      console.error('Error fetching newly launched coins:', error);
      return [];
    }
  }

  async getTokenInfo(tokenId: string): Promise<any> {
    try {
      const cacheKey = `token_info_${tokenId}`;
      const cached = this.getCachedResponse(cacheKey);
      if (cached) return cached;

      await this.respectRateLimit();
      
      const response = await fetch(`${this.API_BASE}/coins/${tokenId}`);
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }
      
      const data = await response.json();
      this.setCachedResponse(cacheKey, data);
      return data;
    } catch (error) {
      console.error(`Error fetching token info for ${tokenId}:`, error);
      return null;
    }
  }

  async getHistoricalPrices(tokenId: string, days = 7): Promise<any> {
    try {
      const cacheKey = `historical_${tokenId}_${days}`;
      const cached = this.getCachedResponse(cacheKey);
      if (cached) return cached;

      await this.respectRateLimit();
      
      const response = await fetch(
        `${this.API_BASE}/coins/${tokenId}/market_chart?vs_currency=usd&days=${days}`
      );
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }
      
      const data = await response.json();
      this.setCachedResponse(cacheKey, data);
      return data;
    } catch (error) {
      console.error(`Error fetching historical prices for ${tokenId}:`, error);
      return null;
    }
  }
}

export const priceFeed = new PriceFeedService();