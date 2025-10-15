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
  private readonly RATE_LIMIT_DELAY = 4500; // INCREASED: 4.5 seconds between requests to avoid rate limits (was 2.5s)
  private readonly CACHE_TTL = 300000; // 5 minutes cache TTL
  private lastRequestTime = 0;
  private responseCache = new Map<string, CachedResponse>(); // Response caching layer
  
  // EXPANDED: Comprehensive list of memecoins and trending tokens to track (200+ coins)
  private readonly TRACKED_COINS = [
    // Top Tier Memecoins
    'dogecoin',
    'shiba-inu', 
    'pepe',
    'floki',
    'bonk',
    'dogwifcoin',
    'memecoin',
    'wojak-coin',
    
    // Popular Memecoins
    'baby-doge-coin',
    'safemoon-v2',
    'dogelon-mars',
    'akita-inu',
    'catecoin',
    'hoge-finance',
    'kishu-inu',
    'mona-coin',
    'banano',
    'garlicoin',
    
    // Trending & New Memecoins  
    'myro',
    'cat-in-a-dogs-world',
    'mog-coin',
    'book-of-meme',
    'peng',
    'bonk1',
    'slerf',
    'jeo-boden',
    'ponke',
    'mew',
    
    // Animal-themed Tokens
    'shibarium',
    'corgi-inu',
    'pitbull',
    'husky-token',
    'bear-inu',
    'wolf-safe-poor-people',
    'tiger-king-coin',
    'panda-coin',
    'rabbit-coin',
    'fox-token',
    
    // Community & Cult Tokens
    'degen-base',
    'based-token',
    'cult-dao',
    'shibaswap',
    'saitama-inu',
    'elongate',
    'rocket-bunny',
    'moonshot',
    'diamond-hands',
    'stonks',
    
    // Solana Ecosystem (EXPANDED)
    'jito',
    'jupiter-exchange-token',
    'raydium',
    'serum',
    'cope',
    'maps',
    'samo-coin',
    'ninja-protocol',
    'star-atlas',
    'solape-token',
    'orca',
    'saber',
    'marinade-staked-sol',
    'step-finance',
    'media-network',
    'solanium',
    'rope-token',
    'sunny-aggregator',
    'grape-2',
    'gofx',
    
    // Polygon & BSC Ecosystem (EXPANDED)
    'polygon-ecosystem-token',
    'matic-network',
    'pancakeswap-token',
    'biswap',
    'baby-cake',
    'safemars',
    'pig-finance',
    'refinable',
    'mooncake',
    'bakerytoken',
    'autofarm',
    'beefy-finance',
    'alpaca-finance',
    'venus',
    'bunny-token',
    'apeswap-finance',
    
    // Base Chain Memecoins
    'toshi',
    'normie',
    'based-brett',
    'higher',
    'keycat',
    'mochi-the-cat',
    'tybg',
    
    // New Cat-themed Coins
    'popcat',
    'cats',
    'mog-coin',
    'smog',
    'hobbes',
    'cat-token',
    'cheshire-grin',
    'felix-the-cat',
    
    // New Dog-themed Coins
    'baby-bonk',
    'corgibnb',
    'shih-tzu',
    'malamute',
    'golden-inu',
    'saint-bernard',
    'beagle-inu',
    'pomeranian',
    
    // Frog/Amphibian Theme
    'apu-apustaja',
    'pepe-2-0',
    'pepecoin-2',
    'groyper',
    'kek',
    'ribbit',
    'hoppy',
    
    // AI & Tech Memecoins
    'turbo',
    'grok',
    'aidoge',
    'chatai',
    'agix-token',
    'worldcoin-wld',
    'singularitynet',
    
    // Gaming & Metaverse Memecoins
    'gala',
    'sandbox',
    'axie-infinity',
    'illuvium',
    'my-neighbor-alice',
    'ufo-gaming',
    'sidus',
    'bloktopia',
    
    // Celebrity & Culture Coins
    'elon-musk',
    'donald-trump',
    'joe-biden',
    'kanye-west',
    'kim-kardashian',
    'bezos',
    'zuckerberg',
    
    // Food & Drink Themed
    'sushi',
    'burger-swap',
    'pizza-game',
    'sake-token',
    'tacos',
    'beer-money',
    'wine',
    
    // Sports & Fan Tokens
    'santos-fc-fan-token',
    'barcelona-fan-token',
    'juventus-fan-token',
    'paris-saint-germain-fan-token',
    'manchester-city-fan-token',
    'ufc-fan-token',
    
    // Emoji & Symbol Coins
    'moon',
    'rocket-raccoon',
    'fire-protocol',
    'heart-protocol',
    'star-coin',
    'diamond-token',
    'thunder-token',
    
    // New Layer 1/2 Ecosystem Tokens
    'arbitrum',
    'optimism',
    'zkSync',
    'linea',
    'scroll',
    'blast',
    'mantle',
    'manta-network',
    'sei-network',
    'celestia',
    'berachain',
    
    // DeFi Yield Farmers
    'yearn-finance',
    'convex-finance',
    'curve-dao-token',
    'aave',
    'compound-governance-token',
    'synthetix-network-token',
    'maker',
    
    // NFT & Creator Coins
    'apecoin',
    'looks-rare',
    'x2y2',
    'rarible',
    'superrare',
    'doodles',
    'pudgy-penguins',
    
    // Experimental & New Launches
    'friend-tech',
    'blur',
    'paraswap',
    'maverick-protocol',
    'velocore',
    'traderjoe',
    'camelot-token',
    
    // Asian Market Memecoins
    'babydoge-2',
    'floki-ceo',
    'saitama-v2',
    'luffy',
    'zoro-inu',
    'naruto',
    'goku',
    
    // Utility Memecoins
    'shiba-predator',
    'bone-shibaswap',
    'leash-token',
    'treat-token',
    'cheems',
    'doge-killer',
    'shib-army',
  ];

  start() {
    if (this.isRunning) return;
    
    this.isRunning = true;
    console.log('📡 Price feed service started (CoinGecko API)');
    
    // Initialize tokens from CoinGecko API (with fallback)
    this.initializeTokensFromAPI().catch(err => {
      console.log('⚠️ Initial API call failed, using fallback tokens');
    });
    
    // Delay first price update to avoid overwhelming API on startup
    setTimeout(() => {
      this.updatePrices();
    }, 5000); // Wait 5 seconds before first update (faster startup)
    
    // OPTIMIZED: Update prices every 20 seconds for faster real-time data
    this.updateInterval = setInterval(() => {
      this.updatePrices();
    }, 20000);
    
    
    // Run coin discovery every 5 minutes
    setTimeout(() => {
      this.discoverNewMemecoins();
      setInterval(() => {
        this.discoverNewMemecoins();
      }, 5 * 60 * 1000); // Every 5 minutes
    }, 10000); // Start after 10 seconds
  }

  stop() {
    if (!this.isRunning) return;
    
    this.isRunning = false;
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }
    console.log('🛑 Price feed service stopped');
  }

  private async initializeTokensFromAPI() {
    try {
      console.log('🔄 Fetching token data from CoinGecko API...');
      const coinData = await this.fetchCoinsData();
      
      for (const coin of coinData) {
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
          console.log(`📊 Initialized token: ${coin.symbol.toUpperCase()} (${coin.name})`);
        }
      }
    } catch (error) {
      console.error('Error initializing tokens from API:', error);
      // Fallback to ensure some tokens exist
      await this.createFallbackTokens();
    }
  }

  private async updatePrices() {
    try {
      console.log('🔄 Updating prices from CoinGecko API...');
      const coinData = await this.fetchCoinsData();
      const tokens = await storage.getActiveTokens();
      
      for (const coin of coinData) {
        const token = tokens.find(t => t.symbol.toLowerCase() === coin.symbol.toLowerCase());
        if (!token) continue;
        
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
        
        // NOTE: Don't invalidate cache here - let TTL expire naturally for better performance
        // Cache invalidation on every price update defeats the caching purpose
        
        // Save price history
        await storage.createPriceHistory({
          tokenId: token.id,
          price: coin.current_price.toString(),
          volume: coin.total_volume.toString(),
        });
        
        this.emit('priceUpdate', priceUpdate);
      }
      
      console.log(`💰 Updated prices for ${coinData.length} tokens`);
    } catch (error) {
      console.error('Error updating prices:', error);
    }
  }

  /**
   * Check cache before making API request
   * Returns cached data if available and not expired
   */
  private getCachedResponse(cacheKey: string): any | null {
    const cached = this.responseCache.get(cacheKey);
    if (!cached) return null;
    
    const now = Date.now();
    const age = now - cached.timestamp;
    
    if (age > this.CACHE_TTL) {
      // Cache expired, remove it
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

  private async fetchCoinsData(retryCount = 0): Promise<CoinGeckoToken[]> {
    const maxRetries = 3;
    const baseDelay = 2000; // 2 seconds base delay
    
    try {
      // Check cache first
      const cacheKey = 'coins_markets';
      const cachedData = this.getCachedResponse(cacheKey);
      if (cachedData) {
        return cachedData;
      }

      await this.respectRateLimit();
      
      // Enhanced URL with more data fields
      const url = `${this.API_BASE}/coins/markets?vs_currency=usd&ids=${this.TRACKED_COINS.join(',')}&order=market_cap_desc&per_page=100&page=1&sparkline=false&price_change_percentage=24h,7d,30d&include_24hr_change=true`;
      
      const response = await fetch(url, {
        headers: {
          'Accept': 'application/json',
        }
      });
      
      // Handle rate limiting with exponential backoff
      if (response.status === 429) {
        if (retryCount < maxRetries) {
          const delay = baseDelay * Math.pow(2, retryCount); // Exponential backoff: 2s, 4s, 8s
          console.log(`⏳ Rate limited. Retrying in ${delay/1000}s... (attempt ${retryCount + 1}/${maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, delay));
          return this.fetchCoinsData(retryCount + 1);
        }
        throw new Error(`CoinGecko API rate limit exceeded after ${maxRetries} retries`);
      }
      
      if (!response.ok) {
        throw new Error(`CoinGecko API error: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      const formattedData = data.map((coin: any) => ({
        id: coin.id,
        symbol: coin.symbol,
        name: coin.name,
        current_price: coin.current_price || 0,
        market_cap: coin.market_cap || 0,
        total_volume: coin.total_volume || 0,
        price_change_percentage_24h: coin.price_change_percentage_24h || 0,
        contract_address: coin.contract_address,
        // Enhanced data fields
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

      // Store in cache for future requests
      this.setCachedResponse(cacheKey, formattedData);
      
      return formattedData;
    } catch (error) {
      // If we've exhausted retries or hit a non-retryable error, rethrow
      if (retryCount >= maxRetries || !(error instanceof Error && error.message.includes('429'))) {
        throw error;
      }
      // This shouldn't be reached but just in case
      const delay = baseDelay * Math.pow(2, retryCount);
      await new Promise(resolve => setTimeout(resolve, delay));
      return this.fetchCoinsData(retryCount + 1);
    }
  }

  private async respectRateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    
    if (timeSinceLastRequest < this.RATE_LIMIT_DELAY) {
      await new Promise(resolve => setTimeout(resolve, this.RATE_LIMIT_DELAY - timeSinceLastRequest));
    }
    
    this.lastRequestTime = Date.now();
  }

  private async createFallbackTokens(): Promise<void> {
    console.log('⚠️ Creating fallback tokens due to API failure');
    const fallbackTokens = [
      { symbol: 'DOGE', name: 'Dogecoin' },
      { symbol: 'SHIB', name: 'Shiba Inu' },
      { symbol: 'PEPE', name: 'Pepe' },
    ];
    
    for (const token of fallbackTokens) {
      const existing = await storage.getTokenBySymbol(token.symbol);
      if (!existing) {
        await storage.createToken({
          symbol: token.symbol,
          name: token.name,
          currentPrice: '0.01',
          marketCap: '1000000',
          volume24h: '100000',
          priceChange24h: '0',
          contractAddress: `fallback:${token.symbol.toLowerCase()}`,
        });
      }
    }
  }

  async fetchHistoricalData(coinId: string, days: number = 7): Promise<Array<{timestamp: number, price: number, volume: number}>> {
    await this.respectRateLimit();
    
    const url = `${this.API_BASE}/coins/${coinId}/market_chart?vs_currency=usd&days=${days}&interval=hourly`;
    
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`CoinGecko API error: ${response.status}`);
      }
      
      const data = await response.json();
      
      return data.prices.map((pricePoint: [number, number], index: number) => ({
        timestamp: pricePoint[0],
        price: pricePoint[1],
        volume: data.total_volumes[index]?.[1] || 0,
      }));
    } catch (error) {
      console.error(`Error fetching historical data for ${coinId}:`, error);
      return [];
    }
  }

  // Enhanced coin discovery methods
  async fetchTrendingCoins(): Promise<TrendingCoin[]> {
    await this.respectRateLimit();
    
    const url = `${this.API_BASE}/search/trending`;
    
    try {
      const response = await fetch(url, {
        headers: {
          'Accept': 'application/json',
        }
      });
      
      if (!response.ok) {
        throw new Error(`CoinGecko API error: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      return data.coins.map((item: any) => ({
        id: item.item.id,
        coin_id: item.item.coin_id,
        name: item.item.name,
        symbol: item.item.symbol,
        market_cap_rank: item.item.market_cap_rank,
        thumb: item.item.thumb,
        small: item.item.small,
        large: item.item.large,
        slug: item.item.slug,
        price_btc: item.item.price_btc,
        score: item.item.score || 0,
      }));
    } catch (error) {
      console.error('Error fetching trending coins:', error);
      return [];
    }
  }

  async fetchTopGainers(limit: number = 100): Promise<TopGainer[]> {
    await this.respectRateLimit();
    
    // EXPANDED: Get top 100 gainers from meme-token category
    const url = `${this.API_BASE}/coins/markets?vs_currency=usd&order=percent_change_24h_desc&per_page=${limit}&page=1&sparkline=false&price_change_percentage=24h&category=meme-token`;
    
    try {
      const response = await fetch(url, {
        headers: {
          'Accept': 'application/json',
        }
      });
      
      if (!response.ok) {
        throw new Error(`CoinGecko API error: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      return data.map((coin: any) => ({
        id: coin.id,
        symbol: coin.symbol,
        name: coin.name,
        current_price: coin.current_price || 0,
        price_change_percentage_24h: coin.price_change_percentage_24h || 0,
        market_cap: coin.market_cap || 0,
        total_volume: coin.total_volume || 0,
      }));
    } catch (error) {
      console.error('Error fetching top gainers:', error);
      return [];
    }
  }

  async discoverNewMemecoins(): Promise<void> {
    try {
      console.log('🔍 EXPANDED SEARCH: Discovering trending memecoins and newly launched coins...');
      
      // Fetch trending coins
      const trendingCoins = await this.fetchTrendingCoins();
      const topGainers = await this.fetchTopGainers(100); // EXPANDED: Get top 100 instead of 30
      
      // Fetch newly launched coins
      const newlyLaunched = await this.fetchNewlyLaunchedCoins();
      const recentlyAdded = await this.fetchRecentlyAddedCoins();
      const lowCapGems = await this.fetchLowCapGems();
      
      // Process trending coins (all of them)
      for (const trendingCoin of trendingCoins) {
        await this.processDiscoveredCoin(trendingCoin.id, trendingCoin.name, trendingCoin.symbol);
      }
      
      // EXPANDED: Process top gainers with lower threshold (10% instead of 20%, $100k instead of $1M)
      for (const gainer of topGainers) {
        if (gainer.price_change_percentage_24h > 10 && gainer.market_cap > 100000) {
          await this.processDiscoveredCoin(gainer.id, gainer.name, gainer.symbol);
        }
      }
      
      // Process newly launched coins (all of them - threshold check in processNewLaunch)
      for (const newCoin of newlyLaunched) {
        await this.processNewLaunch(newCoin.id, newCoin.name, newCoin.symbol, newCoin.market_cap);
      }
      
      // Process recently added coins to CoinGecko (all of them)
      for (const recentCoin of recentlyAdded) {
        await this.processNewLaunch(recentCoin.id, recentCoin.name, recentCoin.symbol, recentCoin.market_cap);
      }
      
      // EXPANDED: Process low cap gems with lower threshold (20% instead of 50%)
      for (const gem of lowCapGems) {
        if (gem.price_change_percentage_24h > 20) { // Lower threshold for more opportunities
          await this.processNewLaunch(gem.id, gem.name, gem.symbol, gem.market_cap);
        }
      }
      
      const totalProcessed = trendingCoins.length + topGainers.length + newlyLaunched.length + recentlyAdded.length + lowCapGems.length;
      console.log(`🎯 EXPANDED SEARCH: Discovered ${totalProcessed} potential coins (${newlyLaunched.length + recentlyAdded.length + lowCapGems.length} newly launched)`);
    } catch (error) {
      console.error('Error in coin discovery:', error);
    }
  }

  // NEW: Fetch newly launched coins with recent ATH dates
  async fetchNewlyLaunchedCoins(): Promise<NewlyLaunchedCoin[]> {
    await this.respectRateLimit();
    
    // Get coins sorted by market cap with recent ATH dates (indicating new launches)
    const url = `${this.API_BASE}/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=100&page=1&sparkline=false&price_change_percentage=24h`;
    
    try {
      const response = await fetch(url, {
        headers: {
          'Accept': 'application/json',
        }
      });
      
      if (!response.ok) {
        throw new Error(`CoinGecko API error: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      
      // EXPANDED: Filter for more recently launched coins
      return data
        .filter((coin: any) => {
          // Look for signs of new launches: low market cap but high price change
          const marketCap = coin.market_cap || 0;
          const priceChange24h = coin.price_change_percentage_24h || 0;
          
          return marketCap > 50000 && marketCap < 100000000 && // EXPANDED: $50K - $100M range
                 Math.abs(priceChange24h) > 5; // EXPANDED: Lower threshold (5% instead of 10%)
        })
        .slice(0, 50) // EXPANDED: Top 50 candidates instead of 20
        .map((coin: any) => ({
          id: coin.id,
          symbol: coin.symbol,
          name: coin.name,
          current_price: coin.current_price || 0,
          market_cap: coin.market_cap || 0,
          total_volume: coin.total_volume || 0,
          ath_date: coin.ath_date,
          price_change_percentage_24h: coin.price_change_percentage_24h || 0,
        }));
    } catch (error) {
      console.error('Error fetching newly launched coins:', error);
      return [];
    }
  }

  // NEW: Fetch recently added coins to CoinGecko platform
  async fetchRecentlyAddedCoins(): Promise<NewlyLaunchedCoin[]> {
    await this.respectRateLimit();
    
    // Get coins with very low market cap rank (indicating recent additions)
    const url = `${this.API_BASE}/coins/markets?vs_currency=usd&order=gecko_desc&per_page=50&page=1&sparkline=false&price_change_percentage=24h`;
    
    try {
      const response = await fetch(url, {
        headers: {
          'Accept': 'application/json',
        }
      });
      
      if (!response.ok) {
        throw new Error(`CoinGecko API error: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      
      // EXPANDED: Filter for more recent additions
      return data
        .filter((coin: any) => {
          const marketCap = coin.market_cap || 0;
          const volume = coin.total_volume || 0;
          
          return marketCap > 25000 && marketCap < 25000000 && // EXPANDED: $25K - $25M range
                 volume > 1000; // EXPANDED: Lower volume threshold
        })
        .slice(0, 30) // EXPANDED: Top 30 candidates instead of 15
        .map((coin: any) => ({
          id: coin.id,
          symbol: coin.symbol,
          name: coin.name,
          current_price: coin.current_price || 0,
          market_cap: coin.market_cap || 0,
          total_volume: coin.total_volume || 0,
          price_change_percentage_24h: coin.price_change_percentage_24h || 0,
        }));
    } catch (error) {
      console.error('Error fetching recently added coins:', error);
      return [];
    }
  }

  // NEW: Fetch low cap gems with high growth potential
  async fetchLowCapGems(): Promise<NewlyLaunchedCoin[]> {
    await this.respectRateLimit();
    
    // Search for low cap coins with high percentage gains
    const url = `${this.API_BASE}/coins/markets?vs_currency=usd&order=percent_change_24h_desc&per_page=100&page=1&sparkline=false&price_change_percentage=24h`;
    
    try {
      const response = await fetch(url, {
        headers: {
          'Accept': 'application/json',
        }
      });
      
      if (!response.ok) {
        throw new Error(`CoinGecko API error: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      
      // EXPANDED: Filter for more low cap gems
      return data
        .filter((coin: any) => {
          const marketCap = coin.market_cap || 0;
          const priceChange24h = coin.price_change_percentage_24h || 0;
          const volume = coin.total_volume || 0;
          
          return marketCap > 10000 && marketCap < 10000000 && // EXPANDED: $10K - $10M range
                 priceChange24h > 15 && // EXPANDED: 15%+ gain (instead of 30%)
                 volume > 500; // EXPANDED: Lower liquidity threshold
        })
        .slice(0, 25) // EXPANDED: Top 25 gems instead of 10
        .map((coin: any) => ({
          id: coin.id,
          symbol: coin.symbol,
          name: coin.name,
          current_price: coin.current_price || 0,
          market_cap: coin.market_cap || 0,
          total_volume: coin.total_volume || 0,
          price_change_percentage_24h: coin.price_change_percentage_24h || 0,
        }));
    } catch (error) {
      console.error('Error fetching low cap gems:', error);
      return [];
    }
  }

  // NEW: Process newly launched coins with lower thresholds
  private async processNewLaunch(coinId: string, name: string, symbol: string, marketCap: number): Promise<void> {
    try {
      // Check if token already exists
      const existing = await storage.getTokenBySymbol(symbol.toUpperCase());
      if (existing) return;
      
      // Fetch detailed data for the new coin
      await this.respectRateLimit();
      const url = `${this.API_BASE}/coins/${coinId}?localization=false&tickers=false&market_data=true&community_data=true&developer_data=true&sparkline=false`;
      
      const response = await fetch(url, {
        headers: {
          'Accept': 'application/json',
        }
      });
      
      if (!response.ok) return;
      
      const coinData = await response.json();
      const marketData = coinData.market_data;
      
      // EXPANDED: Lower thresholds for newly launched coins
      const coinMarketCap = marketData?.market_cap?.usd || 0;
      const volume = marketData?.total_volume?.usd || 0;
      
      // EXPANDED: More lenient criteria for new launches: $10k market cap, $500 volume
      if (coinMarketCap > 10000 && volume > 500) {
        await storage.createToken({
          symbol: symbol.toUpperCase(),
          name: name,
          currentPrice: (marketData?.current_price?.usd || 0).toString(),
          marketCap: coinMarketCap.toString(),
          volume24h: volume.toString(),
          priceChange24h: (marketData?.price_change_percentage_24h || 0).toString(),
          contractAddress: coinData.contract_address || `coingecko:${coinId}`,
        });
        
        console.log(`🚀 New launch detected: ${symbol.toUpperCase()} (${name}) - ${(coinMarketCap / 1000000).toFixed(3)}M cap`);
      }
    } catch (error) {
      console.error(`Error processing new launch ${symbol}:`, error);
    }
  }

  private async processDiscoveredCoin(coinId: string, name: string, symbol: string): Promise<void> {
    try {
      // Check if token already exists
      const existing = await storage.getTokenBySymbol(symbol.toUpperCase());
      if (existing) return;
      
      // Fetch detailed data for the new coin
      await this.respectRateLimit();
      const url = `${this.API_BASE}/coins/${coinId}?localization=false&tickers=false&market_data=true&community_data=true&developer_data=true&sparkline=false`;
      
      const response = await fetch(url, {
        headers: {
          'Accept': 'application/json',
        }
      });
      
      if (!response.ok) return;
      
      const coinData = await response.json();
      const marketData = coinData.market_data;
      
      // EXPANDED: Accept more coins with lower criteria
      const marketCap = marketData?.market_cap?.usd || 0;
      const volume = marketData?.total_volume?.usd || 0;
      
      if (marketCap > 100000 && volume > 2000) { // EXPANDED: Min $100k market cap and $2k volume
        await storage.createToken({
          symbol: symbol.toUpperCase(),
          name: name,
          currentPrice: (marketData?.current_price?.usd || 0).toString(),
          marketCap: marketCap.toString(),
          volume24h: volume.toString(),
          priceChange24h: (marketData?.price_change_percentage_24h || 0).toString(),
          contractAddress: coinData.contract_address || `coingecko:${coinId}`,
        });
        
        console.log(`🆕 Auto-discovered new token: ${symbol.toUpperCase()} (${name}) - ${(marketCap / 1000000).toFixed(1)}M cap`);
      }
    } catch (error) {
      console.error(`Error processing discovered coin ${symbol}:`, error);
    }
  }
}

export const priceFeed = new PriceFeedService();
