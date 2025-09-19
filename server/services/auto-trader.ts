import { EventEmitter } from 'events';
import { storage } from '../storage';
import { riskManager } from './risk-manager';
import { scanner } from './scanner';
import { mlAnalyzer } from './ml-analyzer';
import type { Token, Pattern, InsertTrade } from '@shared/schema';

interface TradingSignal {
  tokenId: string;
  type: 'buy' | 'sell';
  confidence: number;
  source: string;
  price: number;
  reason: string;
}

class AutoTrader extends EventEmitter {
  private isActive = false;
  private defaultPortfolioId: string | null = null;
  private monitoringInterval?: NodeJS.Timeout;
  
  private readonly strategy = {
    minConfidence: 75, // Minimum 75% confidence to trade
    maxPositionSize: 1000, // $1000 max per position
    stopLossPercentage: 8, // 8% stop loss
    takeProfitPercentage: 15, // 15% take profit
  };

  private tradingStats = {
    totalTrades: 0,
    successfulTrades: 0,
    todayTrades: 0,
    totalValue: 10000, // Starting with $10k
  };

  async start() {
    if (this.isActive) return;
    
    this.isActive = true;
    console.log('🤖 Auto-Trader started - Paper trading mode');
    
    await this.initializePortfolio();
    
    // Listen to ML pattern events
    mlAnalyzer.on('patternDetected', (pattern) => {
      this.handleMLPattern(pattern);
    });
    
    // Listen to scanner alerts
    scanner.on('alertTriggered', (alert) => {
      this.handleScannerAlert(alert);
    });
    
    // Monitor positions every 30 seconds
    this.monitoringInterval = setInterval(() => {
      this.monitorPositions();
    }, 30000);
  }

  stop() {
    if (!this.isActive) return;
    
    this.isActive = false;
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }
    
    mlAnalyzer.removeAllListeners('patternDetected');
    scanner.removeAllListeners('alertTriggered');
    
    console.log('🛑 Auto-Trader stopped');
  }

  private async initializePortfolio() {
    try {
      const portfolios = await storage.getAllPortfolios();
      let autoPortfolio = portfolios.find(p => p.userId === 'auto-trader');
      
      if (!autoPortfolio) {
        autoPortfolio = await storage.createPortfolio({
          userId: 'auto-trader',
          totalValue: '10000',
          dailyPnL: '0',
          totalPnL: '0',
        });
        console.log('📊 Created auto-trading portfolio with $10,000 capital');
      }
      
      this.defaultPortfolioId = autoPortfolio.id;
    } catch (error) {
      console.error('Error initializing auto-trading portfolio:', error);
    }
  }

  private async handleMLPattern(pattern: Pattern) {
    if (!this.isActive || !this.defaultPortfolioId) return;
    
    try {
      const confidence = parseFloat(pattern.confidence.toString());
      if (confidence < this.strategy.minConfidence) return;
      
      const token = await storage.getToken(pattern.tokenId);
      if (!token) return;
      
      const signal = this.evaluatePattern(pattern, token, confidence);
      if (signal) {
        await this.executeTradeSignal(signal);
      }
    } catch (error) {
      console.error('Error handling ML pattern:', error);
    }
  }

  private async handleScannerAlert(alert: any) {
    if (!this.isActive || !this.defaultPortfolioId) return;
    
    try {
      if (alert.confidence < this.strategy.minConfidence) return;
      
      const token = await storage.getToken(alert.tokenId);
      if (!token) return;
      
      // Only trade on significant price movements with volume
      if (alert.alertType === 'volume_surge' || alert.alertType === 'price_spike') {
        const signal = this.evaluateAlert(alert, token);
        if (signal) {
          await this.executeTradeSignal(signal);
        }
      }
    } catch (error) {
      console.error('Error handling scanner alert:', error);
    }
  }

  private evaluatePattern(pattern: Pattern, token: Token, confidence: number): TradingSignal | null {
    const currentPrice = parseFloat(token.currentPrice || '0');
    if (currentPrice <= 0) return null;
    
    // Strong bullish patterns - BUY signals
    const bullishPatterns = [
      'enhanced_bull_flag',
      'macd_golden_cross', 
      'stochastic_oversold_reversal',
      'volume_breakout',
      'bull_flag'
    ];
    
    if (bullishPatterns.includes(pattern.patternType)) {
      return {
        tokenId: token.id,
        type: 'buy',
        confidence,
        source: `ML Pattern: ${pattern.patternType}`,
        price: currentPrice,
        reason: `🤖 ${pattern.patternType} detected (${confidence.toFixed(1)}% confidence)`
      };
    }
    
    return null;
  }

  private evaluateAlert(alert: any, token: Token): TradingSignal | null {
    const currentPrice = parseFloat(token.currentPrice || '0');
    if (currentPrice <= 0) return null;
    
    // Volume surge + price momentum = buy signal
    if (alert.alertType === 'volume_surge' || alert.alertType === 'price_spike') {
      return {
        tokenId: token.id,
        type: 'buy',
        confidence: alert.confidence,
        source: `Scanner: ${alert.alertType}`,
        price: currentPrice,
        reason: `📊 ${alert.alertType} detected (${alert.confidence}% confidence)`
      };
    }
    
    return null;
  }

  private async executeTradeSignal(signal: TradingSignal) {
    if (!this.defaultPortfolioId) return;
    
    try {
      // Check if we already have a position in this token
      const existingPosition = await storage.getPositionByPortfolioAndToken(
        this.defaultPortfolioId,
        signal.tokenId
      );
      
      if (existingPosition && parseFloat(existingPosition.amount) > 0) {
        return; // Skip if we already have a position
      }
      
      // Calculate trade amount ($500 per trade)
      const tradeValue = 500;
      const tradeAmount = (tradeValue / signal.price).toString();
      const totalValue = (parseFloat(tradeAmount) * signal.price).toString();
      
      // Create trade record
      const tradeData: InsertTrade = {
        portfolioId: this.defaultPortfolioId,
        tokenId: signal.tokenId,
        type: signal.type,
        amount: tradeAmount,
        price: signal.price.toString(),
        totalValue,
      };
      
      // Execute trade
      const trade = await storage.createTrade(tradeData);
      
      // Create/update position
      await storage.createPosition({
        portfolioId: this.defaultPortfolioId,
        tokenId: signal.tokenId,
        amount: tradeAmount,
        avgBuyPrice: signal.price.toString(),
      });
      
      // Update stats
      this.tradingStats.totalTrades++;
      this.tradingStats.todayTrades++;
      
      // Get token info for logging
      const token = await storage.getToken(signal.tokenId);
      
      console.log(`🚀 TRADE EXECUTED: BUY ${parseFloat(tradeAmount).toFixed(6)} ${token?.symbol} at $${signal.price.toFixed(6)}`);
      console.log(`   💡 ${signal.reason}`);
      console.log(`   💰 Value: $${tradeValue}`);
      
      // Emit trading event for real-time dashboard updates
      this.emit('tradeExecuted', {
        trade,
        signal,
        token,
        timestamp: new Date().toISOString(),
        stats: this.getStats()
      });
      
    } catch (error) {
      console.error('Error executing trade signal:', error);
    }
  }

  private async monitorPositions() {
    if (!this.isActive || !this.defaultPortfolioId) return;
    
    try {
      const positions = await storage.getPositionsByPortfolio(this.defaultPortfolioId);
      let totalPortfolioValue = 0;
      
      for (const position of positions) {
        const token = await storage.getToken(position.tokenId);
        if (!token || parseFloat(position.amount) <= 0) continue;
        
        const currentPrice = parseFloat(token.currentPrice || '0');
        const avgBuyPrice = parseFloat(position.avgBuyPrice);
        const amount = parseFloat(position.amount);
        
        if (currentPrice > 0) {
          const positionValue = amount * currentPrice;
          totalPortfolioValue += positionValue;
          
          const profitLoss = ((currentPrice - avgBuyPrice) / avgBuyPrice) * 100;
          
          // Check stop-loss (8% loss)
          if (profitLoss <= -this.strategy.stopLossPercentage) {
            await this.executeSell(position, token, 'stop_loss', 
              `Stop-loss triggered at ${profitLoss.toFixed(1)}% loss`);
          }
          
          // Check take-profit (15% gain)  
          if (profitLoss >= this.strategy.takeProfitPercentage) {
            await this.executeSell(position, token, 'take_profit', 
              `Take-profit triggered at ${profitLoss.toFixed(1)}% gain`);
          }
        }
      }
      
      // Update portfolio value
      const portfolio = await storage.getPortfolio(this.defaultPortfolioId);
      if (portfolio) {
        const startingValue = 10000;
        const cashUsed = this.tradingStats.totalTrades * 500; // $500 per trade
        const remainingCash = Math.max(0, startingValue - cashUsed);
        const newTotalValue = totalPortfolioValue + remainingCash;
        const totalPnL = newTotalValue - startingValue;
        
        await storage.updatePortfolio(portfolio.id, {
          totalValue: newTotalValue.toString(),
          totalPnL: totalPnL.toString(),
        });
        
        this.tradingStats.totalValue = newTotalValue;
        
        // Emit stats update for dashboard
        this.emit('statsUpdate', {
          totalValue: newTotalValue,
          totalPnL,
          totalTrades: this.tradingStats.totalTrades,
          todayTrades: this.tradingStats.todayTrades,
          activePositions: positions.filter(p => parseFloat(p.amount) > 0).length,
          timestamp: new Date().toISOString()
        });
      }
      
    } catch (error) {
      console.error('Error monitoring positions:', error);
    }
  }

  private async executeSell(position: any, token: Token, trigger: string, reason: string) {
    if (!this.defaultPortfolioId) return;
    
    try {
      const currentPrice = parseFloat(token.currentPrice || '0');
      const amount = parseFloat(position.amount);
      const totalValue = (amount * currentPrice).toString();
      
      const tradeData: InsertTrade = {
        portfolioId: this.defaultPortfolioId,
        tokenId: position.tokenId,
        type: 'sell',
        amount: position.amount,
        price: currentPrice.toString(),
        totalValue,
      };
      
      const trade = await storage.createTrade(tradeData);
      await storage.updatePosition(position.id, { amount: "0" });
      
      this.tradingStats.totalTrades++;
      this.tradingStats.todayTrades++;
      
      console.log(`🎯 ${trigger.toUpperCase()}: Sold ${position.amount} ${token.symbol} at $${currentPrice.toFixed(6)}`);
      console.log(`   📝 ${reason}`);
      
      this.emit('tradeExecuted', {
        trade,
        signal: { type: 'sell', source: trigger, reason },
        token,
        timestamp: new Date().toISOString(),
        stats: this.getStats()
      });
      
    } catch (error) {
      console.error('Error executing sell:', error);
    }
  }

  getStats() {
    return {
      isActive: this.isActive,
      ...this.tradingStats,
      strategy: this.strategy,
    };
  }
}

export const autoTrader = new AutoTrader();