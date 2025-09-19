import { EventEmitter } from 'events';
import { storage } from '../storage';
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

class PriceFeedService extends EventEmitter {
  private isRunning = false;
  private updateInterval?: NodeJS.Timeout;
  private readonly API_BASE = 'https://api.coingecko.com/api/v3';
  private readonly RATE_LIMIT_DELAY = 1000; // 1 second between requests
  private lastRequestTime = 0;
  
  // Comprehensive list of memecoins and trending tokens to track
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
    
    // Recent Trends & Solana Ecosystem
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
    
    // Polygon & BSC Memecoins
    'polygon-ecosystem-token',
    'matic-network',
    'pancakeswap-token',
    'biswap',
    'baby-cake',
    'safemars',
    'elongate',
    'pig-finance',
    'refinable',
    'mooncake'
  ];

  start() {
    if (this.isRunning) return;
    
    this.isRunning = true;
    console.log('📡 Price feed service started (CoinGecko API)');
    
    // Initialize tokens from CoinGecko API
    this.initializeTokensFromAPI();
    
    // Update prices every 30 seconds (respect API limits)
    this.updateInterval = setInterval(() => {
      this.updatePrices();
    }, 30000);
    
    // Initial price update
    setTimeout(() => this.updatePrices(), 2000);
    
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

  private async fetchCoinsData(): Promise<CoinGeckoToken[]> {
    await this.respectRateLimit();
    
    // Enhanced URL with more data fields
    const url = `${this.API_BASE}/coins/markets?vs_currency=usd&ids=${this.TRACKED_COINS.join(',')}&order=market_cap_desc&per_page=100&page=1&sparkline=false&price_change_percentage=24h,7d,30d&include_24hr_change=true`;
    
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

  async fetchTopGainers(limit: number = 50): Promise<TopGainer[]> {
    await this.respectRateLimit();
    
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
      console.log('🔍 Discovering trending memecoins...');
      
      // Fetch trending coins
      const trendingCoins = await this.fetchTrendingCoins();
      const topGainers = await this.fetchTopGainers(30);
      
      // Process trending coins
      for (const trendingCoin of trendingCoins) {
        await this.processDiscoveredCoin(trendingCoin.id, trendingCoin.name, trendingCoin.symbol);
      }
      
      // Process top gainers (focus on memecoins)
      for (const gainer of topGainers) {
        if (gainer.price_change_percentage_24h > 20 && gainer.market_cap > 1000000) {
          await this.processDiscoveredCoin(gainer.id, gainer.name, gainer.symbol);
        }
      }
      
      console.log(`🎯 Discovered and processed ${trendingCoins.length + topGainers.length} potential coins`);
    } catch (error) {
      console.error('Error in coin discovery:', error);
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
      
      // Only add coins that meet memecoin criteria
      const marketCap = marketData?.market_cap?.usd || 0;
      const volume = marketData?.total_volume?.usd || 0;
      
      if (marketCap > 500000 && volume > 10000) { // Min $500k market cap and $10k volume
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
