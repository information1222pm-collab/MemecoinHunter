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

class PriceFeedService extends EventEmitter {
  private isRunning = false;
  private updateInterval?: NodeJS.Timeout;
  private mockTokens = [
    { symbol: 'PEPE', name: 'Pepe Coin', basePrice: 0.000012 },
    { symbol: 'DOGE', name: 'Dogecoin', basePrice: 0.082 },
    { symbol: 'SHIB', name: 'Shiba Inu', basePrice: 0.000009 },
    { symbol: 'FLOKI', name: 'Floki Inu', basePrice: 0.000034 },
    { symbol: 'BONK', name: 'Bonk', basePrice: 0.000015 },
    { symbol: 'WIF', name: 'Dogwifhat', basePrice: 2.45 },
    { symbol: 'MEME', name: 'Memecoin', basePrice: 0.012 },
    { symbol: 'WOJAK', name: 'Wojak', basePrice: 0.00087 },
  ];

  start() {
    if (this.isRunning) return;
    
    this.isRunning = true;
    console.log('📡 Price feed service started');
    
    // Initialize mock tokens
    this.initializeMockTokens();
    
    // Update prices every 15 seconds
    this.updateInterval = setInterval(() => {
      this.updatePrices();
    }, 15000);
    
    // Initial price update
    this.updatePrices();
  }

  stop() {
    if (!this.isRunning) return;
    
    this.isRunning = false;
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }
    console.log('🛑 Price feed service stopped');
  }

  private async initializeMockTokens() {
    try {
      for (const mockToken of this.mockTokens) {
        const existing = await storage.getTokenBySymbol(mockToken.symbol);
        
        if (!existing) {
          const tokenData: InsertToken = {
            symbol: mockToken.symbol,
            name: mockToken.name,
            currentPrice: mockToken.basePrice.toString(),
            marketCap: this.calculateMarketCap(mockToken.basePrice).toString(),
            volume24h: this.generateRandomVolume().toString(),
            priceChange24h: this.generateRandomChange().toString(),
            contractAddress: `0x${this.generateRandomAddress()}`,
          };
          
          await storage.createToken(tokenData);
          console.log(`📊 Initialized token: ${mockToken.symbol}`);
        }
      }
    } catch (error) {
      console.error('Error initializing mock tokens:', error);
    }
  }

  private async updatePrices() {
    try {
      const tokens = await storage.getActiveTokens();
      
      for (const token of tokens) {
        const mockToken = this.mockTokens.find(mt => mt.symbol === token.symbol);
        if (!mockToken) continue;
        
        const priceUpdate = this.generatePriceUpdate(token, mockToken);
        
        // Update token price
        await storage.updateToken(token.id, {
          currentPrice: priceUpdate.price.toString(),
          volume24h: priceUpdate.volume.toString(),
          priceChange24h: priceUpdate.change24h.toString(),
          marketCap: this.calculateMarketCap(priceUpdate.price).toString(),
        });
        
        // Save price history
        await storage.createPriceHistory({
          tokenId: token.id,
          price: priceUpdate.price.toString(),
          volume: priceUpdate.volume.toString(),
        });
        
        this.emit('priceUpdate', priceUpdate);
      }
      
    } catch (error) {
      console.error('Error updating prices:', error);
    }
  }

  private generatePriceUpdate(token: any, mockToken: any): PriceUpdate {
    const currentPrice = parseFloat(token.currentPrice || mockToken.basePrice.toString());
    
    // Generate realistic price movement (-5% to +5% typically, with occasional spikes)
    const randomFactor = Math.random();
    let changePercent;
    
    if (randomFactor < 0.1) {
      // 10% chance of significant spike/drop
      changePercent = (Math.random() - 0.5) * 40; // -20% to +20%
    } else {
      // Normal volatility
      changePercent = (Math.random() - 0.5) * 10; // -5% to +5%
    }
    
    const newPrice = currentPrice * (1 + changePercent / 100);
    const volume = this.generateRandomVolume();
    
    return {
      tokenId: token.id,
      symbol: token.symbol,
      price: Math.max(newPrice, 0.000001), // Ensure positive price
      volume,
      change24h: changePercent,
    };
  }

  private generateRandomVolume(): number {
    // Generate volume between $10K and $10M
    return Math.random() * 9990000 + 10000;
  }

  private generateRandomChange(): number {
    // Generate 24h change between -50% and +200%
    return (Math.random() - 0.2) * 250;
  }

  private calculateMarketCap(price: number): number {
    // Mock market cap calculation
    const supply = Math.random() * 1000000000000 + 1000000000; // 1B to 1T tokens
    return price * supply;
  }

  private generateRandomAddress(): string {
    const chars = '0123456789abcdef';
    let result = '';
    for (let i = 0; i < 40; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }
}

export const priceFeed = new PriceFeedService();
