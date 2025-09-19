import { EventEmitter } from 'events';
import { storage } from '../storage';
import { riskManager } from './risk-manager';
import { scanner } from './scanner';
import { mlAnalyzer } from './ml-analyzer';
import type { Token, Pattern, Portfolio, InsertTrade } from '@shared/schema';

interface TradingSignal {
  tokenId: string;
  type: 'buy' | 'sell';
  confidence: number;
  source: 'ml_pattern' | 'scanner_alert' | 'risk_trigger';
  pattern?: string;
  price: number;
  reason: string;
}

interface TradingStrategy {
  minConfidence: number;
  maxPositionSize: number;
  stopLossPercentage: number;
  takeProfitPercentage: number;
  maxOpenPositions: number;
}

class TradingEngine extends EventEmitter {
  private isActive = false;
  private tradingInterval?: NodeJS.Timeout;
  private defaultPortfolioId: string | null = null;
  
  private readonly strategy: TradingStrategy = {
    minConfidence: 75, // Minimum 75% confidence to trade
    maxPositionSize: 5, // 5% of portfolio per position
    stopLossPercentage: 8, // 8% stop loss
    takeProfitPercentage: 15, // 15% take profit target
    maxOpenPositions: 10, // Max 10 open positions
  };

  private activeTrades = new Map<string, any>(); // Track active positions
  private tradingStats = {
    totalTrades: 0,
    successfulTrades: 0,
    totalProfit: 0,
    todayTrades: 0,
    todayProfit: 0,
  };

  async start() {
    if (this.isActive) return;
    
    this.isActive = true;
    console.log('🤖 Automated Trading Engine started');
    
    // Get or create default portfolio for automated trading
    await this.initializeDefaultPortfolio();
    
    // Listen to ML pattern events
    mlAnalyzer.on('patternDetected', (pattern) => {
      this.handleMLPattern(pattern);
    });
    
    // Listen to scanner alerts
    scanner.on('alertTriggered', (alert) => {
      this.handleScannerAlert(alert);
    });
    
    // Monitor positions and execute trades every 15 seconds
    this.tradingInterval = setInterval(() => {
      this.monitorAndExecuteTrades();
    }, 15000);
    
    // Initial monitoring
    this.monitorAndExecuteTrades();
  }

  stop() {
    if (!this.isActive) return;
    
    this.isActive = false;
    if (this.tradingInterval) {
      clearInterval(this.tradingInterval);
    }
    
    mlAnalyzer.removeAllListeners('patternDetected');
    scanner.removeAllListeners('alertTriggered');
    
    console.log('🛑 Automated Trading Engine stopped');
  }

  private async initializeDefaultPortfolio() {
    try {
      // Try to find existing automated trading portfolio
      const portfolios = await storage.getAllPortfolios();
      let autoPortfolio = portfolios.find(p => p.name === 'Automated Trading');
      
      if (!autoPortfolio) {
        // Create automated trading portfolio
        autoPortfolio = await storage.createPortfolio({
          userId: 'auto-trader', // System user for automated trading
          name: 'Automated Trading',
          totalValue: '10000', // $10,000 starting capital
          dailyPnl: '0',
          totalPnl: '0',
        });
        console.log('📊 Created automated trading portfolio with $10,000 capital');
      }
      
      this.defaultPortfolioId = autoPortfolio.id;
    } catch (error) {
      console.error('Error initializing trading portfolio:', error);
    }
  }

  private async handleMLPattern(pattern: Pattern) {
    if (!this.isActive || !this.defaultPortfolioId) return;
    
    try {
      // Only trade on high-confidence patterns
      if (pattern.confidence < this.strategy.minConfidence) return;
      
      const token = await storage.getTokenById(pattern.tokenId);
      if (!token) return;
      
      const signal = await this.evaluateMLPattern(pattern, token);
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
      // Only trade on high-confidence alerts
      if (alert.confidence < this.strategy.minConfidence) return;
      
      const token = await storage.getTokenById(alert.tokenId);
      if (!token) return;
      
      const signal = await this.evaluateScannerAlert(alert, token);
      if (signal) {
        await this.executeTradeSignal(signal);
      }
    } catch (error) {
      console.error('Error handling scanner alert:', error);
    }
  }

  private async evaluateMLPattern(pattern: Pattern, token: Token): Promise<TradingSignal | null> {
    const currentPrice = parseFloat(token.currentPrice || '0');
    if (currentPrice <= 0) return null;
    
    // Define bullish patterns that trigger buy signals
    const bullishPatterns = [
      'enhanced_bull_flag',
      'macd_golden_cross', 
      'stochastic_oversold_reversal',
      'volume_breakout',
      'bull_flag',
      'hammer_reversal'
    ];
    
    // Define bearish patterns that trigger sell signals
    const bearishPatterns = [
      'bear_flag',
      'macd_death_cross',
      'stochastic_overbought_reversal',
      'head_and_shoulders',
      'shooting_star'
    ];
    
    if (bullishPatterns.includes(pattern.patternType)) {
      return {
        tokenId: token.id,
        type: 'buy',
        confidence: pattern.confidence,
        source: 'ml_pattern',
        pattern: pattern.patternType,
        price: currentPrice,
        reason: `ML detected ${pattern.patternType} with ${pattern.confidence.toFixed(1)}% confidence`
      };
    }
    
    if (bearishPatterns.includes(pattern.patternType)) {
      // Only sell if we have an existing position
      const existingPosition = await storage.getPositionByPortfolioAndToken(
        this.defaultPortfolioId!,
        token.id
      );
      
      if (existingPosition && parseFloat(existingPosition.amount) > 0) {
        return {
          tokenId: token.id,
          type: 'sell',
          confidence: pattern.confidence,
          source: 'ml_pattern',
          pattern: pattern.patternType,
          price: currentPrice,
          reason: `ML detected ${pattern.patternType} - taking profit/cutting losses`
        };
      }
    }
    
    return null;
  }

  private async evaluateScannerAlert(alert: any, token: Token): Promise<TradingSignal | null> {
    const currentPrice = parseFloat(token.currentPrice || '0');
    if (currentPrice <= 0) return null;
    
    // Volume surge + price spike = strong buy signal
    if (alert.alertType === 'volume_surge' || alert.alertType === 'price_spike') {
      // Check if price is moving up (positive momentum)
      const priceHistory = await storage.getPriceHistory(token.id);
      if (priceHistory.length >= 2) {
        const recent = parseFloat(priceHistory[0].price);
        const previous = parseFloat(priceHistory[1].price);
        const momentum = ((recent - previous) / previous) * 100;
        
        if (momentum > 5) { // 5%+ positive momentum
          return {
            tokenId: token.id,
            type: 'buy',
            confidence: alert.confidence,
            source: 'scanner_alert',
            price: currentPrice,
            reason: `Scanner detected ${alert.alertType} with ${momentum.toFixed(1)}% momentum`
          };
        }
      }
    }
    
    return null;
  }

  private async executeTradeSignal(signal: TradingSignal) {
    if (!this.defaultPortfolioId) return;
    
    try {
      // Get portfolio for balance check
      const portfolio = await storage.getPortfolio(this.defaultPortfolioId);
      if (!portfolio) return;
      
      // Calculate position size based on strategy
      const portfolioValue = parseFloat(portfolio.totalValue);
      const maxTradeValue = portfolioValue * (this.strategy.maxPositionSize / 100);
      const tradeAmount = (maxTradeValue / signal.price).toString();
      
      // Check if we already have a position
      const existingPosition = await storage.getPositionByPortfolioAndToken(
        this.defaultPortfolioId,
        signal.tokenId
      );
      
      // Skip if we already have a position and it's a buy signal
      if (signal.type === 'buy' && existingPosition && parseFloat(existingPosition.amount) > 0) {
        return;
      }
      
      // Skip if we don't have a position and it's a sell signal
      if (signal.type === 'sell' && (!existingPosition || parseFloat(existingPosition.amount) <= 0)) {
        return;
      }
      
      // Create trade data
      const tradeData: InsertTrade = {
        portfolioId: this.defaultPortfolioId,
        tokenId: signal.tokenId,
        type: signal.type,
        amount: signal.type === 'sell' ? existingPosition!.amount : tradeAmount,
        price: signal.price.toString(),
        fee: '0',
      };
      
      // Execute trade through risk manager
      const riskAnalysis = await riskManager.analyzeTradeRisk(
        tradeData.portfolioId,
        tradeData.tokenId,
        tradeData.type as 'buy' | 'sell',
        parseFloat(tradeData.amount),
        parseFloat(tradeData.price)
      );
      
      if (!riskAnalysis.allowed) {
        console.log(`🚫 Trade blocked: ${riskAnalysis.reason}`);
        return;
      }
      
      // Execute the trade
      const trade = await storage.createTrade(tradeData);
      
      // Update position
      if (existingPosition) {
        const newAmount = signal.type === 'buy' 
          ? parseFloat(existingPosition.amount) + parseFloat(tradeData.amount)
          : parseFloat(existingPosition.amount) - parseFloat(tradeData.amount);
          
        if (newAmount <= 0) {
          await storage.updatePosition(existingPosition.id, { amount: "0" });
        } else {
          await storage.updatePosition(existingPosition.id, { 
            amount: newAmount.toString() 
          });
        }
      } else if (signal.type === 'buy') {
        await storage.createPosition({
          portfolioId: this.defaultPortfolioId,
          tokenId: signal.tokenId,
          amount: tradeData.amount,
          avgBuyPrice: tradeData.price,
        });
      }
      
      // Update trading stats
      this.tradingStats.totalTrades++;
      this.tradingStats.todayTrades++;
      
      // Log successful trade
      const token = await storage.getTokenById(signal.tokenId);
      console.log(`🚀 EXECUTED TRADE: ${signal.type.toUpperCase()} ${parseFloat(tradeData.amount).toFixed(6)} ${token?.symbol} at $${signal.price.toFixed(6)}`);
      console.log(`   💡 Reason: ${signal.reason}`);
      console.log(`   📊 Confidence: ${signal.confidence.toFixed(1)}%`);
      
      // Emit trading event for real-time updates
      this.emit('tradeExecuted', {
        trade,
        signal,
        token,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('Error executing trade signal:', error);
    }
  }

  private async monitorAndExecuteTrades() {
    if (!this.isActive || !this.defaultPortfolioId) return;
    
    try {
      // Monitor existing positions for stop-loss/take-profit
      const positions = await storage.getPositionsByPortfolio(this.defaultPortfolioId);
      
      for (const position of positions) {
        await this.checkPositionLimits(position);
      }
      
      // Update portfolio value and stats
      await this.updateTradingStats();
      
    } catch (error) {
      console.error('Error monitoring trades:', error);
    }
  }

  private async checkPositionLimits(position: any) {
    try {
      const token = await storage.getTokenById(position.tokenId);
      if (!token) return;
      
      const currentPrice = parseFloat(token.currentPrice || '0');
      const avgBuyPrice = parseFloat(position.avgBuyPrice);
      const amount = parseFloat(position.amount);
      
      if (currentPrice <= 0 || amount <= 0) return;
      
      const profitLoss = ((currentPrice - avgBuyPrice) / avgBuyPrice) * 100;
      
      // Check stop-loss
      if (profitLoss <= -this.strategy.stopLossPercentage) {
        await this.executeForcedSell(position, token, 'stop_loss', 
          `Stop-loss triggered at ${profitLoss.toFixed(1)}% loss`);
      }
      
      // Check take-profit
      if (profitLoss >= this.strategy.takeProfitPercentage) {
        await this.executeForcedSell(position, token, 'take_profit', 
          `Take-profit triggered at ${profitLoss.toFixed(1)}% gain`);
      }
      
    } catch (error) {
      console.error('Error checking position limits:', error);
    }
  }

  private async executeForcedSell(position: any, token: Token, trigger: string, reason: string) {
    if (!this.defaultPortfolioId) return;
    
    try {
      const currentPrice = parseFloat(token.currentPrice || '0');
      
      const tradeData: InsertTrade = {
        portfolioId: this.defaultPortfolioId,
        tokenId: position.tokenId,
        type: 'sell',
        amount: position.amount,
        price: currentPrice.toString(),
        fee: '0',
      };
      
      const trade = await storage.createTrade(tradeData);
      await storage.updatePosition(position.id, { amount: "0" });
      
      console.log(`🎯 ${trigger.toUpperCase()}: Sold ${position.amount} ${token.symbol} at $${currentPrice.toFixed(6)}`);
      console.log(`   📝 ${reason}`);
      
      this.emit('tradeExecuted', {
        trade,
        signal: { type: 'sell', source: 'risk_trigger', reason },
        token,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('Error executing forced sell:', error);
    }
  }

  private async updateTradingStats() {
    try {
      if (!this.defaultPortfolioId) return;
      
      const portfolio = await storage.getPortfolio(this.defaultPortfolioId);
      const positions = await storage.getPositionsByPortfolio(this.defaultPortfolioId);
      
      // Calculate total portfolio value
      let totalValue = 0;
      for (const position of positions) {
        const token = await storage.getTokenById(position.tokenId);
        if (token && parseFloat(position.amount) > 0) {
          totalValue += parseFloat(position.amount) * parseFloat(token.currentPrice || '0');
        }
      }
      
      // Add cash balance (remaining funds)
      const currentPortfolioValue = parseFloat(portfolio?.totalValue || '10000');
      const usedValue = totalValue;
      const cashBalance = Math.max(0, 10000 - usedValue); // Starting with $10k
      totalValue += cashBalance;
      
      // Update portfolio
      if (portfolio) {
        const totalPnl = totalValue - 10000; // Profit/Loss from $10k start
        await storage.updatePortfolio(portfolio.id, {
          totalValue: totalValue.toString(),
          totalPnl: totalPnl.toString(),
        });
      }
      
      // Emit stats update for real-time dashboard
      this.emit('statsUpdate', {
        totalValue,
        totalTrades: this.tradingStats.totalTrades,
        todayTrades: this.tradingStats.todayTrades,
        activePositions: positions.filter(p => parseFloat(p.amount) > 0).length,
        cashBalance,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('Error updating trading stats:', error);
    }
  }

  getStats() {
    return {
      isActive: this.isActive,
      ...this.tradingStats,
      activePositions: this.activeTrades.size,
      strategy: this.strategy,
    };
  }
}

export const tradingEngine = new TradingEngine();