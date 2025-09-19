import { EventEmitter } from 'events';
import { storage } from '../storage';
import { priceFeed } from './price-feed';
import type { Token, InsertScanAlert } from '@shared/schema';

class TokenScanner extends EventEmitter {
  private isRunning = false;
  private scannedTokens = new Set<string>();
  private scanInterval?: NodeJS.Timeout;
  private alertThresholds = {
    priceSpike: 50, // 50% increase
    volumeSurge: 200, // 200% increase
    marketCapThreshold: 1000000, // $1M minimum market cap
  };

  start() {
    if (this.isRunning) return;
    
    this.isRunning = true;
    console.log('🔍 Token scanner started');
    
    // Scan every 30 seconds
    this.scanInterval = setInterval(() => {
      this.scanTokens();
    }, 30000);
    
    // Initial scan
    this.scanTokens();
  }

  stop() {
    if (!this.isRunning) return;
    
    this.isRunning = false;
    if (this.scanInterval) {
      clearInterval(this.scanInterval);
    }
    console.log('🛑 Token scanner stopped');
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      scannedTokensCount: this.scannedTokens.size,
      lastScanTime: new Date().toISOString(),
    };
  }

  private async scanTokens() {
    try {
      const tokens = await storage.getActiveTokens();
      
      for (const token of tokens) {
        await this.analyzeToken(token);
        this.scannedTokens.add(token.id);
        this.emit('tokenScanned', token);
      }
      
      console.log(`📊 Scanned ${tokens.length} tokens`);
    } catch (error) {
      console.error('Error scanning tokens:', error);
    }
  }

  private async analyzeToken(token: Token) {
    try {
      // Get recent price history
      const history = await storage.getPriceHistory(token.id);
      if (history.length < 2) return;

      const current = history[0];
      const previous = history[1];
      
      const currentPrice = parseFloat(current.price);
      const previousPrice = parseFloat(previous.price);
      const priceChange = ((currentPrice - previousPrice) / previousPrice) * 100;
      
      // Check for price spike
      if (Math.abs(priceChange) > this.alertThresholds.priceSpike) {
        await this.createAlert(token.id, 'price_spike', 
          `${token.symbol} price ${priceChange > 0 ? 'surged' : 'dropped'} ${Math.abs(priceChange).toFixed(1)}% in the last period`,
          85
        );
      }
      
      // Check for volume surge
      const currentVolume = parseFloat(current.volume || '0');
      const previousVolume = parseFloat(previous.volume || '0');
      
      if (previousVolume > 0) {
        const volumeChange = ((currentVolume - previousVolume) / previousVolume) * 100;
        
        if (volumeChange > this.alertThresholds.volumeSurge) {
          await this.createAlert(token.id, 'volume_surge',
            `${token.symbol} volume increased ${volumeChange.toFixed(1)}% - unusual activity detected`,
            92
          );
        }
      }
      
      // Check market cap threshold for new tokens
      const marketCap = parseFloat(token.marketCap || '0');
      if (marketCap > this.alertThresholds.marketCapThreshold && !this.scannedTokens.has(token.id)) {
        await this.createAlert(token.id, 'new_token',
          `New token ${token.symbol} detected with ${(marketCap / 1000000).toFixed(1)}M market cap`,
          75
        );
      }
      
    } catch (error) {
      console.error(`Error analyzing token ${token.symbol}:`, error);
    }
  }

  private async createAlert(tokenId: string, alertType: string, message: string, confidence: number) {
    try {
      const alert: InsertScanAlert = {
        tokenId,
        alertType,
        message,
        confidence,
      };
      
      const createdAlert = await storage.createAlert(alert);
      this.emit('alertTriggered', createdAlert);
      
      console.log(`🚨 Alert: ${message}`);
    } catch (error) {
      console.error('Error creating alert:', error);
    }
  }
}

export const scanner = new TokenScanner();
