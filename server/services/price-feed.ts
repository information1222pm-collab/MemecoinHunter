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
}

class PriceFeedService extends EventEmitter {
  private isRunning = false;
  private updateInterval?: NodeJS.Timeout;
  private readonly API_BASE = 'https://api.coingecko.com/api/v3';
  private readonly RATE_LIMIT_DELAY = 1000; // 1 second between requests
  private lastRequestTime = 0;
  
  // Popular memecoins to track
  private readonly TRACKED_COINS = [
    'pepe',
    'dogecoin', 
    'shiba-inu',
    'floki',
    'bonk',
    'dogwifcoin',
    'memecoin',
    'wojak-coin'
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
    
    const url = `${this.API_BASE}/coins/markets?vs_currency=usd&ids=${this.TRACKED_COINS.join(',')}&order=market_cap_desc&per_page=20&page=1&sparkline=false&price_change_percentage=24h`;
    
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
}

export const priceFeed = new PriceFeedService();
