import { EventEmitter } from 'events';
import { storage } from '../storage';
import { riskManager } from './risk-manager';
import { scanner } from './scanner';
import { mlAnalyzer } from './ml-analyzer';
import { patternPerformanceAnalyzer } from './pattern-performance-analyzer';
import { exchangeService } from './exchange-service';
import type { Token, Pattern, InsertTrade } from '@shared/schema';
import type { ExchangeTradingSignal } from './exchange-service';

interface TradingSignal {
  tokenId: string;
  type: 'buy' | 'sell';
  confidence: number;
  source: string;
  price: number;
  reason: string;
  patternId?: string; // Link to originating pattern
}

class AutoTrader extends EventEmitter {
  private isActive = false;
  private defaultPortfolioId: string | null = null;
  private monitoringInterval?: NodeJS.Timeout;
  private sellOnlyMode = false; // Track when portfolio can no longer buy
  private sellingPositions = new Set<string>(); // Track positions currently being sold to prevent concurrent sells
  
  private strategy = {
    minConfidence: 75, // Dynamic minimum confidence
    maxPositionSize: 1000, // $1000 max per position
    stopLossPercentage: 8, // 8% stop loss
    takeProfitPercentage: 15, // 15% take profit
    sellOnlyTakeProfit: 5, // More aggressive take profit when in sell-only mode
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
    console.log('🤖 Auto-Trader started - Multi-mode (Paper + Real money trading with exchange integration)');
    
    await this.initializePortfolio();
    
    // Start pattern performance analyzer
    await patternPerformanceAnalyzer.start();
    
    // Listen to ML pattern events
    mlAnalyzer.on('patternDetected', (pattern) => {
      this.handleMLPattern(pattern);
    });
    
    // Listen to scanner alerts
    scanner.on('alertTriggered', (alert) => {
      this.handleScannerAlert(alert);
    });
    
    // Listen to threshold updates from pattern analyzer
    patternPerformanceAnalyzer.on('thresholdUpdated', (data) => {
      this.strategy.minConfidence = data.minConfidence;
      console.log(`🎯 Dynamic threshold updated: ${data.minConfidence}% (Win rate: ${(data.recentWinRate * 100).toFixed(1)}%)`);
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
          startingCapital: '10000',
          cashBalance: '10000',
          realizedPnL: '0',
          dailyPnL: '0',
          totalPnL: '0',
        });
        console.log('📊 Created auto-trading portfolio with $10,000 capital (Cash: $10,000)');
      } else if (!autoPortfolio.startingCapital || !autoPortfolio.cashBalance) {
        // Update existing portfolio to have proper cash tracking fields
        await storage.updatePortfolio(autoPortfolio.id, {
          startingCapital: autoPortfolio.startingCapital || '10000',
          cashBalance: autoPortfolio.cashBalance || '10000',
          realizedPnL: autoPortfolio.realizedPnL || '0',
        });
        console.log('📊 Updated auto-trading portfolio with cash tracking fields');
      }
      
      this.defaultPortfolioId = autoPortfolio.id;
    } catch (error) {
      console.error('Error initializing auto-trading portfolio:', error);
    }
  }

  private async handleMLPattern(pattern: Pattern) {
    if (!this.isActive || !this.defaultPortfolioId) return;
    
    try {
      const baseConfidence = parseFloat(pattern.confidence.toString());
      
      // Get pattern performance for confidence adjustment
      const performance = await patternPerformanceAnalyzer.getPatternPerformance(
        pattern.patternType, 
        pattern.timeframe
      );
      
      // Apply confidence multiplier based on historical performance
      const adjustedConfidence = performance 
        ? baseConfidence * performance.confidenceMultiplier
        : baseConfidence;
      
      // Get current dynamic minimum confidence
      const currentMinConfidence = await patternPerformanceAnalyzer.getCurrentMinConfidence();
      
      if (adjustedConfidence < currentMinConfidence) {
        console.log(`🔍 Pattern ${pattern.patternType} skipped: ${adjustedConfidence.toFixed(1)}% < ${currentMinConfidence}% threshold`);
        return;
      }
      
      const token = await storage.getToken(pattern.tokenId);
      if (!token) return;
      
      const signal = await this.evaluatePattern(pattern, token, adjustedConfidence);
      if (signal) {
        signal.patternId = pattern.id; // Link signal to pattern
        await this.executeTradeSignal(signal, pattern.id);
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

  private async evaluatePattern(pattern: Pattern, token: Token, confidence: number): Promise<TradingSignal | null> {
    const currentPrice = parseFloat(token.currentPrice || '0');
    if (currentPrice <= 0) return null;
    
    // Strong bullish patterns - BUY signals (only when not in sell-only mode)
    const bullishPatterns = [
      'enhanced_bull_flag',
      'macd_golden_cross', 
      'stochastic_oversold_reversal',
      'volume_breakout',
      'bull_flag'
    ];
    
    // Strong bearish patterns - SELL signals (for existing positions)
    const bearishPatterns = [
      'ml_reversal',
      'head_and_shoulders',
      'double_top',
      'bearish_flag',
      'volume_collapse'
    ];
    
    // Check if we have an existing position in this token
    const existingPosition = this.defaultPortfolioId ? 
      await storage.getPositionByPortfolioAndToken(this.defaultPortfolioId, token.id) : null;
    
    // In sell-only mode, prioritize sell signals for positions we hold
    if (this.sellOnlyMode && existingPosition && parseFloat(existingPosition.amount) > 0) {
      // Generate sell signal for bearish patterns on held positions
      if (bearishPatterns.includes(pattern.patternType)) {
        return {
          tokenId: token.id,
          type: 'sell',
          confidence,
          source: `ML Pattern: ${pattern.patternType}`,
          price: currentPrice,
          reason: `🔴 ${pattern.patternType} detected - Sell-only mode active (${confidence.toFixed(1)}% confidence)`
        };
      }
      
      // Also consider selling on weaker bullish patterns to lock in gains
      if (bullishPatterns.includes(pattern.patternType) && confidence > 80) {
        const avgBuyPrice = parseFloat(existingPosition.avgBuyPrice);
        const profitPercent = ((currentPrice - avgBuyPrice) / avgBuyPrice) * 100;
        
        if (profitPercent > this.strategy.sellOnlyTakeProfit) {
          return {
            tokenId: token.id,
            type: 'sell',
            confidence: confidence * 0.8, // Reduce confidence for profit-taking
            source: `ML Pattern: ${pattern.patternType} (Profit Taking)`,
            price: currentPrice,
            reason: `📈 Taking profit on ${pattern.patternType} - ${profitPercent.toFixed(1)}% gain (Sell-only mode)`
          };
        }
      }
    }
    
    // Regular buy signals when not in sell-only mode
    if (!this.sellOnlyMode && bullishPatterns.includes(pattern.patternType)) {
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
    
    // Only generate buy signals when not in sell-only mode
    if (!this.sellOnlyMode && (alert.alertType === 'volume_surge' || alert.alertType === 'price_spike')) {
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

  private async executeTradeSignal(signal: TradingSignal, patternId?: string) {
    if (!this.defaultPortfolioId) return;
    
    try {
      // Check if real money trading is enabled for this portfolio
      const isRealTradingEnabled = await exchangeService.isRealTradingEnabled(this.defaultPortfolioId);
      
      if (isRealTradingEnabled) {
        // Execute real money trade via exchange service
        await this.executeRealMoneyTrade(signal, patternId);
        return;
      }
      
      // Handle sell signals differently from buy signals (paper trading)
      if (signal.type === 'sell') {
        await this.executeSellSignal(signal, patternId);
        return;
      }
      
      // Buy signal handling - check cash balance
      const portfolio = await storage.getPortfolio(this.defaultPortfolioId);
      if (!portfolio) return;
      
      const tradeValue = 500;
      const availableCash = parseFloat(portfolio.cashBalance || '0');
      
      // If insufficient funds, try to rebalance by selling stagnant positions at break-even or above
      if (availableCash < tradeValue) {
        console.log(`💸 Insufficient funds: Available $${availableCash.toFixed(2)}, Need $${tradeValue}`);
        console.log(`🔄 Attempting to rebalance portfolio by selling stagnant positions...`);
        
        const freedCapital = await this.rebalancePortfolioForNewOpportunity(signal, tradeValue);
        if (freedCapital >= tradeValue) {
          console.log(`✅ Successfully freed $${freedCapital.toFixed(2)} from stagnant positions`);
          
          // Re-fetch portfolio to get updated cash balance after rebalancing
          const updatedPortfolio = await storage.getPortfolio(this.defaultPortfolioId);
          if (!updatedPortfolio) return;
          
          const newAvailableCash = parseFloat(updatedPortfolio.cashBalance || '0');
          console.log(`💰 Updated cash balance after rebalancing: $${newAvailableCash.toFixed(2)}`);
          
          if (newAvailableCash < tradeValue) {
            console.log(`❌ Still insufficient funds after rebalancing: $${newAvailableCash.toFixed(2)} < $${tradeValue}`);
            return;
          }
          
          // Continue with the buy after successful rebalancing
        } else {
          console.log(`❌ Could not free enough capital ($${freedCapital.toFixed(2)} < $${tradeValue})`);
          return;
        }
      }
      
      // Check if we already have a position in this token
      const existingPosition = await storage.getPositionByPortfolioAndToken(
        this.defaultPortfolioId,
        signal.tokenId
      );
      
      if (existingPosition && parseFloat(existingPosition.amount) > 0) {
        console.log(`📋 Position already exists for ${signal.tokenId}, skipping duplicate buy`);
        return; // Skip if we already have an active position
      }
      
      // Calculate trade amount ($500 per trade)
      const tradeAmount = (tradeValue / signal.price).toString();
      const totalValue = (parseFloat(tradeAmount) * signal.price).toString();
      
      // Create trade record with pattern linkage
      const tradeData: InsertTrade = {
        portfolioId: this.defaultPortfolioId,
        tokenId: signal.tokenId,
        patternId: patternId || null, // Link to originating pattern
        type: signal.type,
        amount: tradeAmount,
        price: signal.price.toString(),
        totalValue,
      };
      
      // Execute trade
      const trade = await storage.createTrade(tradeData);
      
      // Create or update position (prevent duplicates)
      if (existingPosition && parseFloat(existingPosition.amount) <= 0) {
        // Update existing zero-amount position to prevent duplicates
        await storage.updatePosition(existingPosition.id, {
          amount: tradeAmount,
          avgBuyPrice: signal.price.toString(),
        });
        console.log(`📝 Updated existing zero-amount position for ${signal.tokenId}`);
      } else {
        // Create new position (first time buying this token)
        await storage.createPosition({
          portfolioId: this.defaultPortfolioId,
          tokenId: signal.tokenId,
          amount: tradeAmount,
          avgBuyPrice: signal.price.toString(),
        });
      }
      
      // Re-fetch current cash balance to ensure accuracy after potential rebalancing
      const currentPortfolio = await storage.getPortfolio(this.defaultPortfolioId);
      if (!currentPortfolio) return;
      
      const currentCashBalance = parseFloat(currentPortfolio.cashBalance || '0');
      
      // Update portfolio cash balance atomically using current balance
      const newCashBalance = (currentCashBalance - tradeValue).toString();
      await storage.updatePortfolio(this.defaultPortfolioId, {
        cashBalance: newCashBalance,
      });
      
      // Update sell-only mode immediately after cash change
      await this.updateSellOnlyModeState();
      
      // Update stats
      this.tradingStats.totalTrades++;
      this.tradingStats.todayTrades++;
      
      // Get token info for logging
      const token = await storage.getToken(signal.tokenId);
      
      console.log(`🚀 TRADE EXECUTED: BUY ${parseFloat(tradeAmount).toFixed(6)} ${token?.symbol} at $${signal.price.toFixed(6)}`);
      console.log(`   💡 ${signal.reason}`);
      console.log(`   💰 Value: $${tradeValue}`);
      if (patternId) {
        console.log(`   🧠 Pattern ID: ${patternId}`);
      }
      
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

  private async executeSellSignal(signal: TradingSignal, patternId?: string) {
    if (!this.defaultPortfolioId) return;
    
    try {
      // Find the existing position for this token
      const position = await storage.getPositionByPortfolioAndToken(
        this.defaultPortfolioId,
        signal.tokenId
      );
      
      if (!position || parseFloat(position.amount) <= 0) {
        console.log(`⚠️ No position found for ${signal.tokenId}, skipping sell signal`);
        return;
      }
      
      const token = await storage.getToken(signal.tokenId);
      if (!token) return;
      
      // Execute the sell using the existing executeSell method
      await this.executeSell(position, token, 'ml_pattern', signal.reason);
      
    } catch (error) {
      console.error('Error executing sell signal:', error);
    }
  }

  private async updateSellOnlyModeState() {
    if (!this.defaultPortfolioId) return;
    
    try {
      const portfolio = await storage.getPortfolio(this.defaultPortfolioId);
      if (!portfolio) return;
      
      const availableCash = parseFloat(portfolio.cashBalance || '0');
      const tradeValue = 500;
      const previousMode = this.sellOnlyMode;
      
      // Update sell-only mode based on cash balance
      if (availableCash < tradeValue) {
        this.sellOnlyMode = true;
        if (!previousMode) {
          console.log(`🔴 SELL-ONLY MODE ACTIVATED: Portfolio switching to exit-focused strategy`);
          console.log(`💰 Available cash: $${availableCash.toFixed(2)}, Required: $${tradeValue}`);
        }
      } else if (availableCash >= tradeValue * 2) {
        this.sellOnlyMode = false;
        if (previousMode) {
          console.log(`🟢 BUY MODE REACTIVATED: Sufficient cash restored for new positions`);
          console.log(`💰 Available cash: $${availableCash.toFixed(2)}, Required: $${tradeValue}`);
        }
      }
    } catch (error) {
      console.error('Error updating sell-only mode state:', error);
    }
  }

  private async monitorPositions() {
    if (!this.isActive || !this.defaultPortfolioId) return;
    
    try {
      // Update sell-only mode state based on current cash balance
      await this.updateSellOnlyModeState();
      
      const positions = await storage.getPositionsByPortfolio(this.defaultPortfolioId);
      let totalPortfolioValue = 0;
      const positionsSold = new Set<string>(); // Track positions sold in this cycle
      
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
          let sellReason: string | null = null;
          let sellTrigger: string | null = null;
          
          // Check stop-loss (8% loss) - highest priority
          if (profitLoss <= -this.strategy.stopLossPercentage) {
            sellReason = `Stop-loss triggered at ${profitLoss.toFixed(1)}% loss`;
            sellTrigger = 'stop_loss';
          }
          // Use more aggressive take-profit when in sell-only mode
          else if (profitLoss >= (this.sellOnlyMode ? this.strategy.sellOnlyTakeProfit : this.strategy.takeProfitPercentage)) {
            const mode = this.sellOnlyMode ? 'SELL-ONLY' : 'NORMAL';
            sellReason = `${mode} take-profit triggered at ${profitLoss.toFixed(1)}% gain`;
            sellTrigger = 'take_profit';
          }
          // In sell-only mode, also monitor for any meaningful profit to exit positions
          else if (this.sellOnlyMode && profitLoss > 2) {
            sellReason = `Sell-only mode: Exiting profitable position (${profitLoss.toFixed(1)}% gain)`;
            sellTrigger = 'cash_generation';
          }
          
          // Execute sell only once per position per cycle
          if (sellReason && sellTrigger && !positionsSold.has(position.id)) {
            await this.executeSell(position, token, sellTrigger, sellReason);
            positionsSold.add(position.id);
          }
        }
      }
      
      // Update portfolio value based on current positions + cash balance
      const portfolio = await storage.getPortfolio(this.defaultPortfolioId);
      if (portfolio) {
        const startingCapital = parseFloat(portfolio.startingCapital || '10000');
        const currentCashBalance = parseFloat(portfolio.cashBalance || '0');
        
        // Total portfolio value = current positions value + current cash balance
        const newTotalValue = totalPortfolioValue + currentCashBalance;
        const totalPnL = newTotalValue - startingCapital;
        
        console.log(`💰 Portfolio Update: Positions $${totalPortfolioValue.toFixed(2)}, Cash $${currentCashBalance.toFixed(2)}, Total $${newTotalValue.toFixed(2)}`);
        
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
    
    // Check if this position is already being sold (prevent concurrent sells)
    if (this.sellingPositions.has(position.id)) {
      console.log(`❌ Cannot sell ${token.symbol}: position is already being sold`);
      return;
    }
    
    // Mark position as being sold
    this.sellingPositions.add(position.id);
    
    try {
      // Re-fetch position to ensure it still exists and has non-zero amount (prevent double sells)
      const currentPosition = await storage.getPosition(position.id);
      if (!currentPosition || parseFloat(currentPosition.amount) <= 0) {
        console.log(`❌ Cannot sell ${token.symbol}: position no longer exists or has zero amount`);
        return;
      }
      
      const currentPrice = parseFloat(token.currentPrice || '0');
      const amount = parseFloat(currentPosition.amount); // Use fresh position data
      const avgBuyPrice = parseFloat(currentPosition.avgBuyPrice);
      
      // Calculate realized P&L
      const totalSellValue = amount * currentPrice;
      const totalBuyValue = amount * avgBuyPrice;
      const realizedPnL = totalSellValue - totalBuyValue;
      const totalValue = (amount * currentPrice).toString();
      
      // CRITICAL: Set position amount to 0 to prevent concurrent sells (atomic operation)
      await storage.updatePosition(currentPosition.id, { amount: '0' });
      
      // Find the original buy trade to get pattern linkage
      const buyTrades = await storage.getTradesByPortfolio(this.defaultPortfolioId);
      const originalBuyTrade = buyTrades.find(t => 
        t.tokenId === currentPosition.tokenId && 
        t.type === 'buy' && 
        parseFloat(t.price) === avgBuyPrice
      );
      
      const tradeData: InsertTrade = {
        portfolioId: this.defaultPortfolioId,
        tokenId: currentPosition.tokenId,
        patternId: originalBuyTrade?.patternId || null, // Link to same pattern as buy trade
        type: 'sell',
        amount: currentPosition.amount,
        price: currentPrice.toString(),
        exitPrice: currentPrice.toString(),
        realizedPnL: realizedPnL.toString(),
        totalValue,
        closedAt: new Date(),
      };
      
      const trade = await storage.createTrade(tradeData);
      
      // Update the original buy trade with exit information
      if (originalBuyTrade) {
        await storage.updateTrade(originalBuyTrade.id, {
          exitPrice: currentPrice.toString(),
          realizedPnL: realizedPnL.toString(),
          closedAt: new Date(),
        });
      }
      
      // CRITICAL: Credit cash balance with sell proceeds
      if (this.defaultPortfolioId) {
        const portfolio = await storage.getPortfolio(this.defaultPortfolioId);
        if (portfolio) {
          const currentCash = parseFloat(portfolio.cashBalance || '0');
          const newCashBalance = (currentCash + totalSellValue).toString();
          const currentRealizedPnL = parseFloat(portfolio.realizedPnL || '0');
          const newRealizedPnL = (currentRealizedPnL + realizedPnL).toString();
          
          await storage.updatePortfolio(this.defaultPortfolioId, {
            cashBalance: newCashBalance,
            realizedPnL: newRealizedPnL,
          });
          
          console.log(`   💰 Cash credited: +$${totalSellValue.toFixed(2)}, New balance: $${(currentCash + totalSellValue).toFixed(2)}`);
          
          // Update sell-only mode immediately after cash change
          await this.updateSellOnlyModeState();
        }
      }
      
      // Update success stats
      if (realizedPnL > 0) {
        this.tradingStats.successfulTrades++;
      }
      
      this.tradingStats.totalTrades++;
      this.tradingStats.todayTrades++;
      
      const pnlSymbol = realizedPnL >= 0 ? '💚' : '❌';
      const pnlText = realizedPnL >= 0 ? `+$${realizedPnL.toFixed(2)}` : `-$${Math.abs(realizedPnL).toFixed(2)}`;
      
      console.log(`🎯 ${trigger.toUpperCase()}: Sold ${position.amount} ${token.symbol} at $${currentPrice.toFixed(6)}`);
      console.log(`   📝 ${reason}`);
      console.log(`   ${pnlSymbol} P&L: ${pnlText}`);
      if (originalBuyTrade?.patternId) {
        console.log(`   🧠 Pattern: ${originalBuyTrade.patternId}`);
      }
      
      this.emit('tradeExecuted', {
        trade,
        signal: { type: 'sell', source: trigger, reason },
        token,
        realizedPnL,
        timestamp: new Date().toISOString(),
        stats: this.getStats()
      });
      
    } catch (error) {
      console.error('Error executing sell:', error);
    } finally {
      // Always remove position from selling set to prevent deadlock
      this.sellingPositions.delete(position.id);
    }
  }

  /**
   * Rebalance portfolio by selling stagnant positions at break-even or above
   * to free up capital for new opportunities
   */
  private async rebalancePortfolioForNewOpportunity(newSignal: TradingSignal, targetAmount: number): Promise<number> {
    if (!this.defaultPortfolioId) return 0;
    
    let totalFreedCapital = 0;
    
    try {
      // Get all current positions
      const positions = await storage.getPositionsByPortfolio(this.defaultPortfolioId);
      const activePositions = positions.filter(p => parseFloat(p.amount) > 0);
      
      if (activePositions.length === 0) {
        console.log(`📊 No active positions to rebalance`);
        return 0;
      }
      
      // Evaluate each position for stagnancy and break-even potential
      const rebalanceCandidates = [];
      
      for (const position of activePositions) {
        const token = await storage.getToken(position.tokenId);
        if (!token) continue;
        
        const currentPrice = parseFloat(token.currentPrice || '0');
        const avgBuyPrice = parseFloat(position.avgBuyPrice);
        const amount = parseFloat(position.amount);
        
        if (currentPrice <= 0) continue;
        
        const profitPercent = ((currentPrice - avgBuyPrice) / avgBuyPrice) * 100;
        const currentValue = amount * currentPrice;
        
        // Consider a position "stagnant" if:
        // 1. It's at break-even or slightly profitable (0% to 3% gain)
        // 2. It's been flat for a while (could add time-based logic later)
        // 3. It's not the same token as our new signal
        const isStagnant = profitPercent >= 0 && profitPercent <= 3 && position.tokenId !== newSignal.tokenId;
        const isBreakEvenOrAbove = profitPercent >= 0;
        
        if (isStagnant && isBreakEvenOrAbove) {
          rebalanceCandidates.push({
            position,
            token,
            profitPercent,
            currentValue,
            stagnancyScore: 3 - profitPercent // Lower profit = higher stagnancy
          });
        }
      }
      
      if (rebalanceCandidates.length === 0) {
        console.log(`📊 No stagnant break-even positions available for rebalancing`);
        return 0;
      }
      
      // Sort by stagnancy score (most stagnant first)
      rebalanceCandidates.sort((a, b) => b.stagnancyScore - a.stagnancyScore);
      
      console.log(`🔍 Found ${rebalanceCandidates.length} stagnant positions eligible for rebalancing:`);
      rebalanceCandidates.forEach(candidate => {
        console.log(`   • ${candidate.token.symbol}: ${candidate.profitPercent.toFixed(2)}% gain, $${candidate.currentValue.toFixed(2)} value`);
      });
      
      // Sell stagnant positions until we have enough capital
      for (const candidate of rebalanceCandidates) {
        if (totalFreedCapital >= targetAmount) break;
        
        const { position, token, profitPercent } = candidate;
        
        console.log(`🔄 Rebalancing: Selling stagnant ${token.symbol} at ${profitPercent.toFixed(2)}% for new opportunity`);
        
        // Calculate expected proceeds before selling
        const amount = parseFloat(position.amount);
        const currentPrice = parseFloat(token.currentPrice || '0');
        const expectedProceeds = amount * currentPrice;
        
        // Execute the sell to free up capital
        await this.executeSell(position, token, 'rebalance', `Portfolio rebalancing: Selling stagnant position (${profitPercent.toFixed(1)}% gain) for new opportunity`);
        
        // Track freed capital (actual sell proceeds)
        totalFreedCapital += expectedProceeds;
        
        console.log(`   💰 Freed $${expectedProceeds.toFixed(2)} from ${token.symbol}, Total freed: $${totalFreedCapital.toFixed(2)}`);
      }
      
      console.log(`🎯 Portfolio rebalancing complete: Freed $${totalFreedCapital.toFixed(2)} for new opportunity`);
      
    } catch (error) {
      console.error('Error during portfolio rebalancing:', error);
    }
    
    return totalFreedCapital;
  }

  async getDetailedStats() {
    if (!this.defaultPortfolioId) return null;
    
    try {
      const portfolio = await storage.getPortfolio(this.defaultPortfolioId);
      const positions = await storage.getPositionsByPortfolio(this.defaultPortfolioId);
      const trades = await storage.getTradesByPortfolio(this.defaultPortfolioId);
      
      if (!portfolio) return null;
      
      // Use portfolio's actual cash balance instead of recalculating from trades
      const availableCash = parseFloat(portfolio.cashBalance || '0');
      const startingCapital = parseFloat(portfolio.startingCapital || '10000');
      const realizedPnL = parseFloat(portfolio.realizedPnL || '0');
      
      // Calculate current position values
      let totalPositionValue = 0;
      const activePositions = [];
      
      for (const position of positions) {
        if (parseFloat(position.amount) > 0) {
          const token = await storage.getToken(position.tokenId);
          if (token) {
            const currentPrice = parseFloat(token.currentPrice || '0');
            const positionValue = parseFloat(position.amount) * currentPrice;
            const avgBuyPrice = parseFloat(position.avgBuyPrice);
            const profitLoss = currentPrice > 0 ? ((currentPrice - avgBuyPrice) / avgBuyPrice) * 100 : 0;
            
            totalPositionValue += positionValue;
            activePositions.push({
              tokenId: position.tokenId,
              symbol: token.symbol,
              amount: parseFloat(position.amount),
              avgBuyPrice,
              currentPrice,
              positionValue,
              profitLoss
            });
          }
        }
      }
      
      // Total portfolio value = cash + position values
      const totalValue = availableCash + totalPositionValue;
      
      return {
        portfolioId: this.defaultPortfolioId,
        totalValue,
        totalPositionValue,
        availableCash,
        startingCapital,
        realizedPnL,
        totalTrades: trades.length,
        buyTrades: trades.filter(t => t.type === 'buy').length,
        sellTrades: trades.filter(t => t.type === 'sell').length,
        activePositions: activePositions.length,
        positions: activePositions,
        winRate: this.tradingStats.totalTrades > 0 
          ? (this.tradingStats.successfulTrades / this.tradingStats.totalTrades * 100).toFixed(1)
          : '0'
      };
    } catch (error) {
      console.error('Error getting detailed stats:', error);
      return null;
    }
  }

  private async executeRealMoneyTrade(signal: TradingSignal, patternId?: string): Promise<void> {
    try {
      // Get token details
      const token = await storage.getToken(signal.tokenId);
      if (!token) {
        console.error(`❌ Token ${signal.tokenId} not found for real money trade`);
        return;
      }

      // Calculate conservative position size ($500 position)
      const positionSize = 500 / signal.price;

      // Convert to exchange trading signal with all required fields
      const exchangeSignal: ExchangeTradingSignal = {
        tokenId: signal.tokenId,
        symbol: token.symbol,
        type: signal.type,
        amount: positionSize,
        price: signal.price,
        confidence: signal.confidence,
        source: signal.source,
        patternId: patternId,
        portfolioId: this.defaultPortfolioId!
      };

      console.log(`💱 🔴 REAL MONEY ${signal.type.toUpperCase()}: ${token.symbol} at $${signal.price} (${signal.confidence}% confidence)`);
      
      // Execute through exchange service
      const exchangeTrade = await exchangeService.executeTradeSignal(exchangeSignal);
      
      if (exchangeTrade) {
        console.log(`✅ Real money trade executed: ${exchangeTrade.id}`);
        
        // Update trading stats
        this.tradingStats.totalTrades++;
        this.tradingStats.todayTrades++;
        
        // Emit trading event for real-time dashboard updates
        this.emit('tradeExecuted', {
          exchangeTrade,
          signal,
          token,
          timestamp: new Date().toISOString(),
          stats: this.getStats(),
          mode: 'real_money'
        });
      } else {
        console.log(`❌ Real money trade execution failed or skipped`);
      }
      
    } catch (error) {
      console.error('❌ Real money trade execution failed:', error);
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