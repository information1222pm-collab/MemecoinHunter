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

interface PortfolioState {
  portfolioId: string;
  sellOnlyMode: boolean;
  sellingPositions: Set<string>;
  tradingStats: {
    totalTrades: number;
    successfulTrades: number;
    todayTrades: number;
    totalValue: number;
  };
}

class AutoTrader extends EventEmitter {
  private isActive = false;
  private enabledPortfolios = new Map<string, PortfolioState>(); // Track multiple portfolios
  private monitoringInterval?: NodeJS.Timeout;
  private syncInterval?: NodeJS.Timeout;
  
  private strategy = {
    minConfidence: 75, // Dynamic minimum confidence
    maxPositionSize: 1000, // $1000 max per position
    stopLossPercentage: 8, // 8% stop loss
    takeProfitPercentage: 15, // 15% take profit
    sellOnlyTakeProfit: 5, // More aggressive take profit when in sell-only mode
  };

  async start() {
    if (this.isActive) return;
    
    this.isActive = true;
    console.log('🤖 Auto-Trader started - Multi-portfolio support enabled');
    
    try {
      // Step 1: Load all portfolios with auto-trading enabled
      console.log('📊 Step 1/4: Loading enabled portfolios...');
      await this.syncEnabledPortfolios();
      console.log(`✅ Loaded ${this.enabledPortfolios.size} portfolios with auto-trading enabled`);
      
      // Step 2: Start pattern performance analyzer with timeout protection
      console.log('🧠 Step 2/4: Starting pattern performance analyzer...');
      await this.withTimeout(
        patternPerformanceAnalyzer.start(),
        15000,
        'Pattern analyzer initialization timed out after 15s'
      );
      console.log('✅ Pattern performance analyzer started successfully');
      
      // Step 3: Set up event listeners
      console.log('🔌 Step 3/4: Setting up event listeners...');
      
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
      
      console.log('✅ Event listeners configured successfully');
      
    } catch (error) {
      console.error('⚠️ Auto-Trader initialization encountered errors:', error);
      console.error('⚠️ Continuing with reduced functionality...');
    }
    
    // Step 4: Set up monitoring and sync intervals
    console.log('⏰ Step 4/4: Setting up monitoring intervals...');
    
    // Monitor positions every 30s
    this.monitoringInterval = setInterval(() => {
      this.monitorAllPortfolios();
    }, 30000);
    
    // Sync enabled portfolios every 60s to detect changes
    this.syncInterval = setInterval(() => {
      this.syncEnabledPortfolios();
    }, 60000);
    
    console.log('✅ Monitoring intervals active');
    
    // Run initial position check immediately
    console.log('🔍 Running initial position check...');
    this.monitorAllPortfolios().catch(error => {
      console.error('Error in initial position check:', error);
    });
    
    console.log('🤖 Auto-Trader initialization complete - monitoring portfolios');
  }
  
  private async withTimeout<T>(promise: Promise<T>, timeoutMs: number, errorMessage: string): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) => 
        setTimeout(() => reject(new Error(errorMessage)), timeoutMs)
      )
    ]);
  }

  stop() {
    if (!this.isActive) return;
    
    this.isActive = false;
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }
    
    mlAnalyzer.removeAllListeners('patternDetected');
    scanner.removeAllListeners('alertTriggered');
    
    this.enabledPortfolios.clear();
    
    console.log('🛑 Auto-Trader stopped');
  }

  async enableAutoTrading(portfolioId: string) {
    try {
      // Update database
      await storage.updatePortfolio(portfolioId, { autoTradingEnabled: true });
      
      // Add to tracking if not already present
      if (!this.enabledPortfolios.has(portfolioId)) {
        this.enabledPortfolios.set(portfolioId, {
          portfolioId,
          sellOnlyMode: false,
          sellingPositions: new Set(),
          tradingStats: {
            totalTrades: 0,
            successfulTrades: 0,
            todayTrades: 0,
            totalValue: 10000,
          },
        });
        console.log(`✅ Auto-trading enabled for portfolio ${portfolioId}`);
      }
    } catch (error) {
      console.error(`Error enabling auto-trading for portfolio ${portfolioId}:`, error);
    }
  }

  async disableAutoTrading(portfolioId: string) {
    try {
      // Update database
      await storage.updatePortfolio(portfolioId, { autoTradingEnabled: false });
      
      // Remove from tracking
      this.enabledPortfolios.delete(portfolioId);
      console.log(`🛑 Auto-trading disabled for portfolio ${portfolioId}`);
    } catch (error) {
      console.error(`Error disabling auto-trading for portfolio ${portfolioId}:`, error);
    }
  }

  private async syncEnabledPortfolios() {
    try {
      const allPortfolios = await storage.getAllPortfolios();
      const enabledInDb = allPortfolios.filter(p => p.autoTradingEnabled);
      
      // Remove portfolios that are no longer enabled
      const portfolioIds = Array.from(this.enabledPortfolios.keys());
      for (const portfolioId of portfolioIds) {
        if (!enabledInDb.find(p => p.id === portfolioId)) {
          this.enabledPortfolios.delete(portfolioId);
          console.log(`🔄 Removed portfolio ${portfolioId} from auto-trading (disabled in DB)`);
        }
      }
      
      // Add new portfolios that are enabled
      for (const portfolio of enabledInDb) {
        if (!this.enabledPortfolios.has(portfolio.id)) {
          this.enabledPortfolios.set(portfolio.id, {
            portfolioId: portfolio.id,
            sellOnlyMode: false,
            sellingPositions: new Set(),
            tradingStats: {
              totalTrades: 0,
              successfulTrades: 0,
              todayTrades: 0,
              totalValue: parseFloat(portfolio.totalValue || '10000'),
            },
          });
          console.log(`🔄 Added portfolio ${portfolio.id} to auto-trading`);
        }
      }
    } catch (error) {
      console.error('Error syncing enabled portfolios:', error);
    }
  }

  private async handleMLPattern(pattern: Pattern) {
    console.log(`🔍 AUTO-TRADER: Received ML pattern ${pattern.patternType} for token ${pattern.tokenId} with ${pattern.confidence}% confidence`);
    
    if (!this.isActive) {
      console.log(`🔍 AUTO-TRADER: Inactive - skipping pattern ${pattern.patternType}`);
      return;
    }
    
    if (this.enabledPortfolios.size === 0) {
      console.log(`🔍 AUTO-TRADER: No enabled portfolios - skipping pattern ${pattern.patternType}`);
      return;
    }
    
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
      
      // Execute on ALL enabled portfolios
      const portfolioIds = Array.from(this.enabledPortfolios.keys());
      for (const portfolioId of portfolioIds) {
        const signal = await this.evaluatePattern(pattern, token, adjustedConfidence, portfolioId);
        if (signal) {
          signal.patternId = pattern.id; // Link signal to pattern
          await this.executeTradeSignal(signal, pattern.id, portfolioId);
        }
      }
    } catch (error) {
      console.error('Error handling ML pattern:', error);
    }
  }

  private async handleScannerAlert(alert: any) {
    if (!this.isActive || this.enabledPortfolios.size === 0) return;
    
    try {
      if (alert.confidence < this.strategy.minConfidence) return;
      
      const token = await storage.getToken(alert.tokenId);
      if (!token) return;
      
      // Only trade on significant price movements with volume
      if (alert.alertType === 'volume_surge' || alert.alertType === 'price_spike') {
        // Execute on ALL enabled portfolios
        const portfolioIds = Array.from(this.enabledPortfolios.keys());
        for (const portfolioId of portfolioIds) {
          const signal = this.evaluateAlert(alert, token, portfolioId);
          if (signal) {
            await this.executeTradeSignal(signal, undefined, portfolioId);
          }
        }
      }
    } catch (error) {
      console.error('Error handling scanner alert:', error);
    }
  }

  private async evaluatePattern(pattern: Pattern, token: Token, confidence: number, portfolioId: string): Promise<TradingSignal | null> {
    const currentPrice = parseFloat(token.currentPrice || '0');
    if (currentPrice <= 0) return null;
    
    const portfolioState = this.enabledPortfolios.get(portfolioId);
    if (!portfolioState) return null;
    
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
    const existingPosition = await storage.getPositionByPortfolioAndToken(portfolioId, token.id);
    
    // In sell-only mode, prioritize sell signals for positions we hold
    if (portfolioState.sellOnlyMode && existingPosition && parseFloat(existingPosition.amount) > 0) {
      // Generate sell signal for bearish patterns on held positions
      if (bearishPatterns.includes(pattern.patternType)) {
        return {
          tokenId: token.id,
          type: 'sell',
          confidence,
          source: `ML Pattern: ${pattern.patternType}`,
          price: currentPrice,
          reason: `🔴 [Portfolio ${portfolioId}] ${pattern.patternType} detected - Sell-only mode active (${confidence.toFixed(1)}% confidence)`
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
            reason: `📈 [Portfolio ${portfolioId}] Taking profit on ${pattern.patternType} - ${profitPercent.toFixed(1)}% gain (Sell-only mode)`
          };
        }
      }
    }
    
    // Regular buy signals when not in sell-only mode
    if (!portfolioState.sellOnlyMode && bullishPatterns.includes(pattern.patternType)) {
      return {
        tokenId: token.id,
        type: 'buy',
        confidence,
        source: `ML Pattern: ${pattern.patternType}`,
        price: currentPrice,
        reason: `🤖 [Portfolio ${portfolioId}] ${pattern.patternType} detected (${confidence.toFixed(1)}% confidence)`
      };
    }
    
    return null;
  }

  private evaluateAlert(alert: any, token: Token, portfolioId: string): TradingSignal | null {
    const currentPrice = parseFloat(token.currentPrice || '0');
    if (currentPrice <= 0) return null;
    
    const portfolioState = this.enabledPortfolios.get(portfolioId);
    if (!portfolioState) return null;
    
    // Only generate buy signals when not in sell-only mode
    if (!portfolioState.sellOnlyMode && (alert.alertType === 'volume_surge' || alert.alertType === 'price_spike')) {
      return {
        tokenId: token.id,
        type: 'buy',
        confidence: alert.confidence,
        source: `Scanner: ${alert.alertType}`,
        price: currentPrice,
        reason: `📊 [Portfolio ${portfolioId}] ${alert.alertType} detected (${alert.confidence}% confidence)`
      };
    }
    
    return null;
  }

  private async executeTradeSignal(signal: TradingSignal, patternId?: string, portfolioId?: string) {
    if (!portfolioId) return;
    
    const portfolioState = this.enabledPortfolios.get(portfolioId);
    if (!portfolioState) return;
    
    try {
      // Check if real money trading is enabled for this portfolio
      const isRealTradingEnabled = await exchangeService.isRealTradingEnabled(portfolioId);
      
      if (isRealTradingEnabled) {
        // Execute real money trade via exchange service
        await this.executeRealMoneyTrade(signal, patternId, portfolioId);
        return;
      }
      
      // Handle sell signals differently from buy signals (paper trading)
      if (signal.type === 'sell') {
        await this.executeSellSignal(signal, patternId, portfolioId);
        return;
      }
      
      // Buy signal handling - check cash balance
      const portfolio = await storage.getPortfolio(portfolioId);
      if (!portfolio) return;
      
      const tradeValue = 500;
      const availableCash = parseFloat(portfolio.cashBalance || '0');
      
      // If insufficient funds, try to rebalance by selling stagnant positions at break-even or above
      if (availableCash < tradeValue) {
        console.log(`💸 [Portfolio ${portfolioId}] Insufficient funds: Available $${availableCash.toFixed(2)}, Need $${tradeValue}`);
        console.log(`🔄 [Portfolio ${portfolioId}] Attempting to rebalance portfolio by selling stagnant positions...`);
        
        const freedCapital = await this.rebalancePortfolioForNewOpportunity(signal, tradeValue, portfolioId);
        if (freedCapital >= tradeValue) {
          console.log(`✅ [Portfolio ${portfolioId}] Successfully freed $${freedCapital.toFixed(2)} from stagnant positions`);
          
          // Re-fetch portfolio to get updated cash balance after rebalancing
          const updatedPortfolio = await storage.getPortfolio(portfolioId);
          if (!updatedPortfolio) return;
          
          const newAvailableCash = parseFloat(updatedPortfolio.cashBalance || '0');
          console.log(`💰 [Portfolio ${portfolioId}] Updated cash balance after rebalancing: $${newAvailableCash.toFixed(2)}`);
          
          if (newAvailableCash < tradeValue) {
            console.log(`❌ [Portfolio ${portfolioId}] Still insufficient funds after rebalancing: $${newAvailableCash.toFixed(2)} < $${tradeValue}`);
            return;
          }
          
          // Continue with the buy after successful rebalancing
        } else {
          console.log(`❌ [Portfolio ${portfolioId}] Could not free enough capital ($${freedCapital.toFixed(2)} < $${tradeValue})`);
          return;
        }
      }
      
      // Check if we already have a position in this token
      const existingPosition = await storage.getPositionByPortfolioAndToken(
        portfolioId,
        signal.tokenId
      );
      
      if (existingPosition && parseFloat(existingPosition.amount) > 0) {
        console.log(`📋 [Portfolio ${portfolioId}] Position already exists for ${signal.tokenId}, skipping duplicate buy`);
        return; // Skip if we already have an active position
      }
      
      // Calculate trade amount ($500 per trade)
      const tradeAmount = (tradeValue / signal.price).toString();
      const totalValue = (parseFloat(tradeAmount) * signal.price).toString();
      
      // Create trade record with pattern linkage
      const tradeData: InsertTrade = {
        portfolioId: portfolioId,
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
        console.log(`📝 [Portfolio ${portfolioId}] Updated existing zero-amount position for ${signal.tokenId}`);
      } else {
        // Create new position (first time buying this token)
        await storage.createPosition({
          portfolioId: portfolioId,
          tokenId: signal.tokenId,
          amount: tradeAmount,
          avgBuyPrice: signal.price.toString(),
        });
      }
      
      // Re-fetch current cash balance to ensure accuracy after potential rebalancing
      const currentPortfolio = await storage.getPortfolio(portfolioId);
      if (!currentPortfolio) return;
      
      const currentCashBalance = parseFloat(currentPortfolio.cashBalance || '0');
      
      // Update portfolio cash balance atomically using current balance
      const newCashBalance = (currentCashBalance - tradeValue).toString();
      await storage.updatePortfolio(portfolioId, {
        cashBalance: newCashBalance,
      });
      
      // Update sell-only mode immediately after cash change
      await this.updateSellOnlyModeState(portfolioId);
      
      // Update stats
      portfolioState.tradingStats.totalTrades++;
      portfolioState.tradingStats.todayTrades++;
      
      // Get token info for logging
      const token = await storage.getToken(signal.tokenId);
      
      console.log(`🚀 [Portfolio ${portfolioId}] TRADE EXECUTED: BUY ${parseFloat(tradeAmount).toFixed(6)} ${token?.symbol} at $${signal.price.toFixed(6)}`);
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
        portfolioId,
        timestamp: new Date().toISOString(),
        stats: this.getStatsForPortfolio(portfolioId)
      });
      
    } catch (error) {
      console.error(`[Portfolio ${portfolioId}] Error executing trade signal:`, error);
    }
  }

  private async executeSellSignal(signal: TradingSignal, patternId?: string, portfolioId?: string) {
    if (!portfolioId) return;
    
    try {
      // Find the existing position for this token
      const position = await storage.getPositionByPortfolioAndToken(
        portfolioId,
        signal.tokenId
      );
      
      if (!position || parseFloat(position.amount) <= 0) {
        console.log(`⚠️ [Portfolio ${portfolioId}] No position found for ${signal.tokenId}, skipping sell signal`);
        return;
      }
      
      const token = await storage.getToken(signal.tokenId);
      if (!token) return;
      
      // Execute the sell using the existing executeSell method
      await this.executeSell(position, token, 'ml_pattern', signal.reason, portfolioId);
      
    } catch (error) {
      console.error(`[Portfolio ${portfolioId}] Error executing sell signal:`, error);
    }
  }

  private async updateSellOnlyModeState(portfolioId: string) {
    const portfolioState = this.enabledPortfolios.get(portfolioId);
    if (!portfolioState) return;
    
    try {
      const portfolio = await storage.getPortfolio(portfolioId);
      if (!portfolio) return;
      
      const availableCash = parseFloat(portfolio.cashBalance || '0');
      const tradeValue = 500;
      const previousMode = portfolioState.sellOnlyMode;
      
      // Update sell-only mode based on cash balance
      if (availableCash < tradeValue) {
        portfolioState.sellOnlyMode = true;
        if (!previousMode) {
          console.log(`🔴 [Portfolio ${portfolioId}] SELL-ONLY MODE ACTIVATED: Portfolio switching to exit-focused strategy`);
          console.log(`💰 [Portfolio ${portfolioId}] Available cash: $${availableCash.toFixed(2)}, Required: $${tradeValue}`);
        }
      } else if (availableCash >= tradeValue * 2) {
        portfolioState.sellOnlyMode = false;
        if (previousMode) {
          console.log(`🟢 [Portfolio ${portfolioId}] BUY MODE REACTIVATED: Sufficient cash restored for new positions`);
          console.log(`💰 [Portfolio ${portfolioId}] Available cash: $${availableCash.toFixed(2)}, Required: $${tradeValue}`);
        }
      }
    } catch (error) {
      console.error(`[Portfolio ${portfolioId}] Error updating sell-only mode state:`, error);
    }
  }

  private async monitorAllPortfolios() {
    if (!this.isActive) {
      console.log('⚠️ Position monitoring skipped: Auto-trader inactive');
      return;
    }
    
    console.log(`🔍 Monitoring ${this.enabledPortfolios.size} enabled portfolios for stop-loss/take-profit...`);
    
    // Monitor each enabled portfolio
    const portfolioIds = Array.from(this.enabledPortfolios.keys());
    for (const portfolioId of portfolioIds) {
      await this.monitorPositions(portfolioId);
    }
  }

  private async monitorPositions(portfolioId: string) {
    const portfolioState = this.enabledPortfolios.get(portfolioId);
    if (!portfolioState) return;
    
    try {
      // Update sell-only mode state based on current cash balance
      await this.updateSellOnlyModeState(portfolioId);
      
      const positions = await storage.getPositionsByPortfolio(portfolioId);
      console.log(`📊 [Portfolio ${portfolioId}] Checking ${positions.length} positions (${positions.filter(p => parseFloat(p.amount) > 0).length} active)`);
      
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
          else if (profitLoss >= (portfolioState.sellOnlyMode ? this.strategy.sellOnlyTakeProfit : this.strategy.takeProfitPercentage)) {
            const mode = portfolioState.sellOnlyMode ? 'SELL-ONLY' : 'NORMAL';
            sellReason = `${mode} take-profit triggered at ${profitLoss.toFixed(1)}% gain`;
            sellTrigger = 'take_profit';
          }
          // In sell-only mode, also monitor for any meaningful profit to exit positions
          else if (portfolioState.sellOnlyMode && profitLoss > 2) {
            sellReason = `Sell-only mode: Exiting profitable position (${profitLoss.toFixed(1)}% gain)`;
            sellTrigger = 'cash_generation';
          }
          
          // Execute sell only once per position per cycle
          if (sellReason && sellTrigger && !positionsSold.has(position.id)) {
            await this.executeSell(position, token, sellTrigger, sellReason, portfolioId);
            positionsSold.add(position.id);
          }
        }
      }
      
      // Update portfolio value based on current positions + cash balance
      const portfolio = await storage.getPortfolio(portfolioId);
      if (portfolio) {
        const startingCapital = parseFloat(portfolio.startingCapital || '10000');
        const currentCashBalance = parseFloat(portfolio.cashBalance || '0');
        
        // Total portfolio value = current positions value + current cash balance
        const newTotalValue = totalPortfolioValue + currentCashBalance;
        const totalPnL = newTotalValue - startingCapital;
        
        console.log(`💰 [Portfolio ${portfolioId}] Portfolio Update: Positions $${totalPortfolioValue.toFixed(2)}, Cash $${currentCashBalance.toFixed(2)}, Total $${newTotalValue.toFixed(2)}`);
        
        await storage.updatePortfolio(portfolio.id, {
          totalValue: newTotalValue.toString(),
          totalPnL: totalPnL.toString(),
        });
        
        portfolioState.tradingStats.totalValue = newTotalValue;
        
        // Emit stats update for dashboard
        this.emit('statsUpdate', {
          portfolioId,
          totalValue: newTotalValue,
          totalPnL,
          totalTrades: portfolioState.tradingStats.totalTrades,
          todayTrades: portfolioState.tradingStats.todayTrades,
          activePositions: positions.filter(p => parseFloat(p.amount) > 0).length,
          timestamp: new Date().toISOString()
        });
      }
      
    } catch (error) {
      console.error(`[Portfolio ${portfolioId}] Error monitoring positions:`, error);
    }
  }

  private async executeSell(position: any, token: Token, trigger: string, reason: string, portfolioId: string) {
    const portfolioState = this.enabledPortfolios.get(portfolioId);
    if (!portfolioState) return;
    
    // Check if this position is already being sold (prevent concurrent sells)
    if (portfolioState.sellingPositions.has(position.id)) {
      console.log(`❌ [Portfolio ${portfolioId}] Cannot sell ${token.symbol}: position is already being sold`);
      return;
    }
    
    // Mark position as being sold
    portfolioState.sellingPositions.add(position.id);
    
    try {
      // Re-fetch position to ensure it still exists and has non-zero amount (prevent double sells)
      const currentPosition = await storage.getPosition(position.id);
      if (!currentPosition || parseFloat(currentPosition.amount) <= 0) {
        console.log(`❌ [Portfolio ${portfolioId}] Cannot sell ${token.symbol}: position no longer exists or has zero amount`);
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
      const buyTrades = await storage.getTradesByPortfolio(portfolioId);
      const originalBuyTrade = buyTrades.find(t => 
        t.tokenId === currentPosition.tokenId && 
        t.type === 'buy' && 
        parseFloat(t.price) === avgBuyPrice
      );
      
      const tradeData: InsertTrade = {
        portfolioId: portfolioId,
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
      const portfolio = await storage.getPortfolio(portfolioId);
      if (portfolio) {
        const currentCash = parseFloat(portfolio.cashBalance || '0');
        const newCashBalance = (currentCash + totalSellValue).toString();
        const currentRealizedPnL = parseFloat(portfolio.realizedPnL || '0');
        const newRealizedPnL = (currentRealizedPnL + realizedPnL).toString();
        
        await storage.updatePortfolio(portfolioId, {
          cashBalance: newCashBalance,
          realizedPnL: newRealizedPnL,
        });
        
        console.log(`   💰 [Portfolio ${portfolioId}] Cash credited: +$${totalSellValue.toFixed(2)}, New balance: $${(currentCash + totalSellValue).toFixed(2)}`);
        
        // Update sell-only mode immediately after cash change
        await this.updateSellOnlyModeState(portfolioId);
      }
      
      // Update success stats
      if (realizedPnL > 0) {
        portfolioState.tradingStats.successfulTrades++;
      }
      
      portfolioState.tradingStats.totalTrades++;
      portfolioState.tradingStats.todayTrades++;
      
      const pnlSymbol = realizedPnL >= 0 ? '💚' : '❌';
      const pnlText = realizedPnL >= 0 ? `+$${realizedPnL.toFixed(2)}` : `-$${Math.abs(realizedPnL).toFixed(2)}`;
      
      console.log(`🎯 [Portfolio ${portfolioId}] ${trigger.toUpperCase()}: Sold ${position.amount} ${token.symbol} at $${currentPrice.toFixed(6)}`);
      console.log(`   📝 ${reason}`);
      console.log(`   ${pnlSymbol} P&L: ${pnlText}`);
      if (originalBuyTrade?.patternId) {
        console.log(`   🧠 Pattern: ${originalBuyTrade.patternId}`);
      }
      
      const profitPercentage = avgBuyPrice > 0 ? (realizedPnL / totalBuyValue) * 100 : 0;
      
      this.emit('tradeExecuted', {
        trade,
        signal: { type: 'sell', source: trigger, reason },
        token,
        portfolioId,
        profitLoss: realizedPnL.toFixed(2),
        profitPercentage: profitPercentage,
        timestamp: new Date().toISOString(),
        stats: this.getStatsForPortfolio(portfolioId)
      });
      
    } catch (error) {
      console.error(`[Portfolio ${portfolioId}] Error executing sell:`, error);
    } finally {
      // Always remove position from selling set to prevent deadlock
      portfolioState.sellingPositions.delete(position.id);
    }
  }

  /**
   * Rebalance portfolio by selling stagnant positions at break-even or above
   * to free up capital for new opportunities
   */
  private async rebalancePortfolioForNewOpportunity(newSignal: TradingSignal, targetAmount: number, portfolioId: string): Promise<number> {
    let totalFreedCapital = 0;
    
    try {
      // Get all current positions
      const positions = await storage.getPositionsByPortfolio(portfolioId);
      const activePositions = positions.filter(p => parseFloat(p.amount) > 0);
      
      if (activePositions.length === 0) {
        console.log(`📊 [Portfolio ${portfolioId}] No active positions to rebalance`);
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
        console.log(`📊 [Portfolio ${portfolioId}] No stagnant break-even positions available for rebalancing`);
        return 0;
      }
      
      // Sort by stagnancy score (most stagnant first)
      rebalanceCandidates.sort((a, b) => b.stagnancyScore - a.stagnancyScore);
      
      console.log(`🔍 [Portfolio ${portfolioId}] Found ${rebalanceCandidates.length} stagnant positions eligible for rebalancing:`);
      rebalanceCandidates.forEach(candidate => {
        console.log(`   • ${candidate.token.symbol}: ${candidate.profitPercent.toFixed(2)}% gain, $${candidate.currentValue.toFixed(2)} value`);
      });
      
      // Sell stagnant positions until we have enough capital
      for (const candidate of rebalanceCandidates) {
        if (totalFreedCapital >= targetAmount) break;
        
        const { position, token, profitPercent } = candidate;
        
        console.log(`🔄 [Portfolio ${portfolioId}] Rebalancing: Selling stagnant ${token.symbol} at ${profitPercent.toFixed(2)}% for new opportunity`);
        
        // Calculate expected proceeds before selling
        const amount = parseFloat(position.amount);
        const currentPrice = parseFloat(token.currentPrice || '0');
        const expectedProceeds = amount * currentPrice;
        
        // Execute the sell to free up capital
        await this.executeSell(position, token, 'rebalance', `Portfolio rebalancing: Selling stagnant position (${profitPercent.toFixed(1)}% gain) for new opportunity`, portfolioId);
        
        // Track freed capital (actual sell proceeds)
        totalFreedCapital += expectedProceeds;
        
        console.log(`   💰 [Portfolio ${portfolioId}] Freed $${expectedProceeds.toFixed(2)} from ${token.symbol}, Total freed: $${totalFreedCapital.toFixed(2)}`);
      }
      
      console.log(`🎯 [Portfolio ${portfolioId}] Portfolio rebalancing complete: Freed $${totalFreedCapital.toFixed(2)} for new opportunity`);
      
    } catch (error) {
      console.error(`[Portfolio ${portfolioId}] Error during portfolio rebalancing:`, error);
    }
    
    return totalFreedCapital;
  }

  async getDetailedStats(portfolioId?: string) {
    // If no portfolioId provided, use the first enabled portfolio (for backward compatibility)
    const targetPortfolioId = portfolioId || Array.from(this.enabledPortfolios.keys())[0];
    if (!targetPortfolioId) return null;
    
    const portfolioState = this.enabledPortfolios.get(targetPortfolioId);
    if (!portfolioState) return null;
    
    try {
      const portfolio = await storage.getPortfolio(targetPortfolioId);
      const positions = await storage.getPositionsByPortfolio(targetPortfolioId);
      const trades = await storage.getTradesByPortfolio(targetPortfolioId);
      
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
              id: position.id, // Add unique position ID to prevent duplicate React keys
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
        portfolioId: targetPortfolioId,
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
        winRate: portfolioState.tradingStats.totalTrades > 0 
          ? (portfolioState.tradingStats.successfulTrades / portfolioState.tradingStats.totalTrades * 100).toFixed(1)
          : '0'
      };
    } catch (error) {
      console.error(`[Portfolio ${targetPortfolioId}] Error getting detailed stats:`, error);
      return null;
    }
  }

  private async executeRealMoneyTrade(signal: TradingSignal, patternId?: string, portfolioId?: string): Promise<void> {
    if (!portfolioId) return;
    
    const portfolioState = this.enabledPortfolios.get(portfolioId);
    if (!portfolioState) return;
    
    try {
      // Get token details
      const token = await storage.getToken(signal.tokenId);
      if (!token) {
        console.error(`❌ [Portfolio ${portfolioId}] Token ${signal.tokenId} not found for real money trade`);
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
        portfolioId: portfolioId
      };

      console.log(`💱 🔴 [Portfolio ${portfolioId}] REAL MONEY ${signal.type.toUpperCase()}: ${token.symbol} at $${signal.price} (${signal.confidence}% confidence)`);
      
      // Execute through exchange service
      const exchangeTrade = await exchangeService.executeTradeSignal(exchangeSignal);
      
      if (exchangeTrade) {
        console.log(`✅ [Portfolio ${portfolioId}] Real money trade executed: ${exchangeTrade.id}`);
        
        // Update trading stats
        portfolioState.tradingStats.totalTrades++;
        portfolioState.tradingStats.todayTrades++;
        
        // Emit trading event for real-time dashboard updates
        this.emit('tradeExecuted', {
          exchangeTrade,
          signal,
          token,
          portfolioId,
          timestamp: new Date().toISOString(),
          stats: this.getStatsForPortfolio(portfolioId),
          mode: 'real_money'
        });
      } else {
        console.log(`❌ [Portfolio ${portfolioId}] Real money trade execution failed or skipped`);
      }
      
    } catch (error) {
      console.error(`❌ [Portfolio ${portfolioId}] Real money trade execution failed:`, error);
    }
  }

  getStatsForPortfolio(portfolioId: string) {
    const portfolioState = this.enabledPortfolios.get(portfolioId);
    if (!portfolioState) return null;
    
    return {
      isActive: this.isActive,
      portfolioId,
      ...portfolioState.tradingStats,
      strategy: this.strategy,
    };
  }

  getStats() {
    // Return stats for first enabled portfolio (for backward compatibility)
    const firstPortfolioId = Array.from(this.enabledPortfolios.keys())[0];
    if (!firstPortfolioId) {
      return {
        isActive: this.isActive,
        totalTrades: 0,
        successfulTrades: 0,
        todayTrades: 0,
        totalValue: 0,
        strategy: this.strategy,
      };
    }
    return this.getStatsForPortfolio(firstPortfolioId);
  }
}

export const autoTrader = new AutoTrader();