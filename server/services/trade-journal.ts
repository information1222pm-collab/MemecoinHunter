import { EventEmitter } from 'events';
import { autoTrader } from './auto-trader';
import { storage } from '../storage';
import type { Trade, Token, Pattern } from '@shared/schema';

export interface TradeJournalEntry {
  // Core trade data
  id: string;
  portfolioId: string;
  tokenId: string;
  type: 'buy' | 'sell';
  amount: string;
  price: string;
  totalValue: string;
  
  // Exit data (for closed positions)
  exitPrice: string | null;
  realizedPnL: string | null;
  closedAt: Date | null;
  
  // Entry metadata
  entryReason: string;
  entrySignal: string;
  patternType: string | null;
  patternConfidence: number | null;
  patternId: string | null;
  
  // Exit metadata
  exitReason: string | null;
  exitSignal: string | null;
  stopLossTriggered: boolean;
  takeProfitTriggered: boolean;
  
  // Performance metrics
  holdTime: number | null; // in milliseconds
  holdTimeDays: number | null;
  returnPercent: number | null;
  outcome: 'win' | 'loss' | 'breakeven' | 'open';
  
  // Token details
  tokenSymbol: string;
  tokenName: string;
  
  // Timestamps
  entryTime: Date;
  exitTime: Date | null;
}

export interface JournalFilters {
  dateFrom?: Date;
  dateTo?: Date;
  outcome?: 'win' | 'loss' | 'breakeven' | 'open';
  tokenId?: string;
  patternType?: string;
  minReturn?: number;
  maxReturn?: number;
}

class TradeJournalService extends EventEmitter {
  private isInitialized = false;

  async initialize() {
    if (this.isInitialized) return;

    // Listen to trade execution events from auto-trader
    autoTrader.on('tradeExecuted', async (event) => {
      await this.handleTradeExecuted(event);
    });

    this.isInitialized = true;
    console.log('📓 Trade Journal Service initialized - listening for trade events');
  }

  private async handleTradeExecuted(event: any) {
    try {
      const { trade, signal, token, realizedPnL, timestamp } = event;
      
      if (trade.type === 'buy') {
        // Log new entry for buy trades
        await this.logBuyEntry(trade, signal, token);
      } else if (trade.type === 'sell') {
        // Update entry for sell trades
        await this.logSellExit(trade, signal, token, realizedPnL);
      }
    } catch (error) {
      console.error('Error handling trade execution in journal:', error);
    }
  }

  private async logBuyEntry(trade: Trade, signal: any, token: Token) {
    try {
      // Get pattern details if available
      let pattern: Pattern | null = null;
      let patternConfidence: number | null = null;
      
      if (trade.patternId) {
        const patterns = await storage.getAllPatterns();
        pattern = patterns.find(p => p.id === trade.patternId) || null;
        if (pattern) {
          patternConfidence = parseFloat(pattern.confidence.toString());
        }
      }

      const entryReason = signal.reason || 'Trade executed';
      const entrySignal = signal.source || 'unknown';

      console.log(`📓 JOURNAL: New BUY entry for ${token.symbol}`);
      console.log(`   📝 Reason: ${entryReason}`);
      console.log(`   📊 Signal: ${entrySignal}`);
      if (pattern) {
        console.log(`   🧠 Pattern: ${pattern.patternType} (${patternConfidence}% confidence)`);
      }
      
      this.emit('entryCreated', {
        tradeId: trade.id,
        tokenSymbol: token.symbol,
        entryReason,
        entrySignal,
        patternType: pattern?.patternType || null,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error logging buy entry:', error);
    }
  }

  private async logSellExit(trade: Trade, signal: any, token: Token, realizedPnL?: number) {
    try {
      // Find the original buy trade (it was already updated by auto-trader with exit info)
      const buyTrade = await this.findOriginalBuyTrade(trade.portfolioId, trade.tokenId, trade);
      
      if (!buyTrade) {
        console.log(`⚠️ JOURNAL: No buy trade found for sell of ${token.symbol}`);
        return;
      }

      const exitReason = signal.reason || 'Position closed';
      const exitSignal = signal.source || signal.type || 'manual';
      
      // Detect stop loss and take profit triggers
      const stopLossTriggered = this.detectStopLoss(exitSignal, exitReason);
      const takeProfitTriggered = this.detectTakeProfit(exitSignal, exitReason);
      
      // Calculate hold time
      const entryTime = buyTrade.createdAt ? new Date(buyTrade.createdAt.toString()) : new Date();
      const exitTime = trade.closedAt ? new Date(trade.closedAt.toString()) : new Date();
      const holdTime = exitTime.getTime() - entryTime.getTime();
      const holdTimeDays = holdTime / (1000 * 60 * 60 * 24);
      
      // Calculate return percentage
      const entryPrice = parseFloat(buyTrade.price);
      const exitPrice = parseFloat(trade.price);
      const returnPercent = ((exitPrice - entryPrice) / entryPrice) * 100;
      
      console.log(`📓 JOURNAL: EXIT logged for ${token.symbol}`);
      console.log(`   📝 Exit Reason: ${exitReason}`);
      console.log(`   📊 Exit Signal: ${exitSignal}`);
      console.log(`   ⏱️ Hold Time: ${holdTimeDays.toFixed(2)} days`);
      console.log(`   📈 Return: ${returnPercent.toFixed(2)}%`);
      if (stopLossTriggered) console.log(`   🛑 Stop Loss Triggered`);
      if (takeProfitTriggered) console.log(`   ✅ Take Profit Triggered`);
      
      this.emit('exitLogged', {
        tradeId: buyTrade.id,
        tokenSymbol: token.symbol,
        exitReason,
        exitSignal,
        stopLossTriggered,
        takeProfitTriggered,
        holdTimeDays: parseFloat(holdTimeDays.toFixed(2)),
        returnPercent: parseFloat(returnPercent.toFixed(2)),
        realizedPnL,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error logging sell exit:', error);
    }
  }

  private async findOriginalBuyTrade(portfolioId: string, tokenId: string, sellTrade: Trade): Promise<Trade | null> {
    try {
      const allTrades = await storage.getTradesByPortfolio(portfolioId);
      
      // Find buy trades for this token that have been closed (have exitPrice)
      const buyTrades = allTrades.filter(t => 
        t.tokenId === tokenId && 
        t.type === 'buy' && 
        t.exitPrice !== null &&
        t.closedAt !== null
      );
      
      // Sort by closedAt descending to get the most recent
      buyTrades.sort((a, b) => {
        const aTime = a.closedAt ? new Date(a.closedAt.toString()).getTime() : 0;
        const bTime = b.closedAt ? new Date(b.closedAt.toString()).getTime() : 0;
        return bTime - aTime;
      });
      
      // Return the most recent buy trade that matches this sell
      return buyTrades[0] || null;
    } catch (error) {
      console.error('Error finding original buy trade:', error);
      return null;
    }
  }

  private detectStopLoss(exitSignal: string, exitReason: string): boolean {
    const stopLossIndicators = [
      'stop_loss',
      'stop loss',
      'stoploss',
      'sl triggered',
      'loss'
    ];
    
    const signal = exitSignal.toLowerCase();
    const reason = exitReason.toLowerCase();
    
    return stopLossIndicators.some(indicator => 
      signal.includes(indicator) || reason.includes(indicator)
    );
  }

  private detectTakeProfit(exitSignal: string, exitReason: string): boolean {
    const takeProfitIndicators = [
      'take_profit',
      'take profit',
      'takeprofit',
      'tp triggered',
      'profit taking',
      'taking profit'
    ];
    
    const signal = exitSignal.toLowerCase();
    const reason = exitReason.toLowerCase();
    
    return takeProfitIndicators.some(indicator => 
      signal.includes(indicator) || reason.includes(indicator)
    );
  }

  private determineOutcome(returnPercent: number): 'win' | 'loss' | 'breakeven' {
    if (returnPercent > 0.5) return 'win';
    if (returnPercent < -0.5) return 'loss';
    return 'breakeven';
  }

  /**
   * Get journal entries for a portfolio with optional filters
   */
  async getJournalEntries(portfolioId: string, filters?: JournalFilters): Promise<TradeJournalEntry[]> {
    try {
      let trades = await storage.getTradesByPortfolio(portfolioId);
      
      // Only include buy trades (as they contain the full trade lifecycle)
      trades = trades.filter(t => t.type === 'buy');
      
      // Apply filters
      if (filters) {
        if (filters.dateFrom) {
          trades = trades.filter(t => {
            if (!t.createdAt) return false;
            return new Date(t.createdAt.toString()) >= filters.dateFrom!;
          });
        }
        if (filters.dateTo) {
          trades = trades.filter(t => {
            if (!t.createdAt) return false;
            return new Date(t.createdAt.toString()) <= filters.dateTo!;
          });
        }
        if (filters.tokenId) {
          trades = trades.filter(t => t.tokenId === filters.tokenId);
        }
        if (filters.patternType) {
          const patterns = await storage.getAllPatterns();
          const patternIds = patterns
            .filter(p => p.patternType === filters.patternType)
            .map(p => p.id);
          trades = trades.filter(t => t.patternId && patternIds.includes(t.patternId));
        }
      }
      
      // Convert trades to journal entries
      const entries: TradeJournalEntry[] = [];
      
      for (const trade of trades) {
        const entry = await this.createJournalEntry(trade);
        
        // Apply outcome and return filters
        if (filters) {
          if (filters.outcome && entry.outcome !== filters.outcome) continue;
          if (filters.minReturn !== undefined && entry.returnPercent !== null && entry.returnPercent < filters.minReturn) continue;
          if (filters.maxReturn !== undefined && entry.returnPercent !== null && entry.returnPercent > filters.maxReturn) continue;
        }
        
        entries.push(entry);
      }
      
      return entries;
    } catch (error) {
      console.error('Error getting journal entries:', error);
      return [];
    }
  }

  /**
   * Get a single trade journal entry by ID
   */
  async getTradeById(tradeId: string): Promise<TradeJournalEntry | null> {
    try {
      const trade = await storage.getTrade(tradeId);
      if (!trade) return null;
      
      return await this.createJournalEntry(trade);
    } catch (error) {
      console.error('Error getting trade by ID:', error);
      return null;
    }
  }

  /**
   * Get entries filtered by outcome (win/loss/breakeven)
   */
  async getEntriesByOutcome(portfolioId: string, outcome: 'win' | 'loss' | 'breakeven' | 'open'): Promise<TradeJournalEntry[]> {
    return await this.getJournalEntries(portfolioId, { outcome });
  }

  /**
   * Get entries filtered by strategy/pattern type
   */
  async getEntriesByStrategy(portfolioId: string, patternType: string): Promise<TradeJournalEntry[]> {
    return await this.getJournalEntries(portfolioId, { patternType });
  }

  /**
   * Create a full journal entry from a trade
   */
  private async createJournalEntry(trade: Trade): Promise<TradeJournalEntry> {
    // Get token details
    const token = await storage.getToken(trade.tokenId);
    const tokenSymbol = token?.symbol || 'UNKNOWN';
    const tokenName = token?.name || 'Unknown Token';
    
    // Get pattern details
    let pattern: Pattern | null = null;
    let patternConfidence: number | null = null;
    
    if (trade.patternId) {
      const patterns = await storage.getAllPatterns();
      pattern = patterns.find(p => p.id === trade.patternId) || null;
      if (pattern) {
        patternConfidence = parseFloat(pattern.confidence.toString());
      }
    }
    
    // Calculate performance metrics
    let holdTime: number | null = null;
    let holdTimeDays: number | null = null;
    let returnPercent: number | null = null;
    let outcome: 'win' | 'loss' | 'breakeven' | 'open' = 'open';
    let exitReason: string | null = null;
    let exitSignal: string | null = null;
    let stopLossTriggered = false;
    let takeProfitTriggered = false;
    
    if (trade.exitPrice && trade.closedAt) {
      // Position is closed, calculate metrics
      const entryTime = trade.createdAt ? new Date(trade.createdAt.toString()) : new Date();
      const exitTime = new Date(trade.closedAt.toString());
      holdTime = exitTime.getTime() - entryTime.getTime();
      holdTimeDays = holdTime / (1000 * 60 * 60 * 24);
      
      const entryPrice = parseFloat(trade.price);
      const exitPriceValue = parseFloat(trade.exitPrice);
      returnPercent = ((exitPriceValue - entryPrice) / entryPrice) * 100;
      
      outcome = this.determineOutcome(returnPercent);
      
      // Try to determine exit reason from trade history
      const allTrades = await storage.getTradesByPortfolio(trade.portfolioId);
      const correspondingSell = allTrades.find(t => {
        if (!t.closedAt) return false;
        const sellClosedTime = new Date(t.closedAt.toString()).getTime();
        return t.tokenId === trade.tokenId && 
          t.type === 'sell' && 
          Math.abs(sellClosedTime - exitTime.getTime()) < 1000; // Within 1 second
      });
      
      if (correspondingSell) {
        // Infer exit reason from realized P&L and return
        if (returnPercent <= -8) {
          exitReason = 'Stop loss triggered';
          exitSignal = 'stop_loss';
          stopLossTriggered = true;
        } else if (returnPercent >= 15) {
          exitReason = 'Take profit triggered';
          exitSignal = 'take_profit';
          takeProfitTriggered = true;
        } else if (returnPercent > 0 && returnPercent < 5) {
          exitReason = 'Portfolio rebalancing';
          exitSignal = 'rebalance';
        } else {
          exitReason = 'Position closed';
          exitSignal = 'manual';
        }
      }
    }
    
    // Determine entry reason and signal
    const entryReason = pattern 
      ? `${pattern.patternType} pattern detected (${patternConfidence}% confidence)`
      : 'Trade signal executed';
    const entrySignal = pattern ? `ML Pattern: ${pattern.patternType}` : 'Manual';
    
    return {
      // Core trade data
      id: trade.id,
      portfolioId: trade.portfolioId,
      tokenId: trade.tokenId,
      type: trade.type as 'buy' | 'sell',
      amount: trade.amount,
      price: trade.price,
      totalValue: trade.totalValue,
      
      // Exit data
      exitPrice: trade.exitPrice,
      realizedPnL: trade.realizedPnL,
      closedAt: trade.closedAt,
      
      // Entry metadata
      entryReason,
      entrySignal,
      patternType: pattern?.patternType || null,
      patternConfidence,
      patternId: trade.patternId,
      
      // Exit metadata
      exitReason,
      exitSignal,
      stopLossTriggered,
      takeProfitTriggered,
      
      // Performance metrics
      holdTime,
      holdTimeDays,
      returnPercent,
      outcome,
      
      // Token details
      tokenSymbol,
      tokenName,
      
      // Timestamps
      entryTime: trade.createdAt ? new Date(trade.createdAt.toString()) : new Date(),
      exitTime: trade.closedAt ? new Date(trade.closedAt.toString()) : null
    };
  }

  /**
   * Get statistics for journal entries
   */
  async getJournalStats(portfolioId: string): Promise<{
    totalTrades: number;
    openPositions: number;
    closedPositions: number;
    winCount: number;
    lossCount: number;
    breakevenCount: number;
    winRate: number;
    averageReturn: number;
    averageHoldTime: number;
    totalProfitLoss: number;
  }> {
    try {
      const entries = await this.getJournalEntries(portfolioId);
      
      const totalTrades = entries.length;
      const openPositions = entries.filter(e => e.outcome === 'open').length;
      const closedPositions = entries.filter(e => e.outcome !== 'open').length;
      const winCount = entries.filter(e => e.outcome === 'win').length;
      const lossCount = entries.filter(e => e.outcome === 'loss').length;
      const breakevenCount = entries.filter(e => e.outcome === 'breakeven').length;
      
      const winRate = closedPositions > 0 ? (winCount / closedPositions) * 100 : 0;
      
      const closedEntries = entries.filter(e => e.returnPercent !== null);
      const averageReturn = closedEntries.length > 0
        ? closedEntries.reduce((sum, e) => sum + (e.returnPercent || 0), 0) / closedEntries.length
        : 0;
      
      const entriesWithHoldTime = entries.filter(e => e.holdTimeDays !== null);
      const averageHoldTime = entriesWithHoldTime.length > 0
        ? entriesWithHoldTime.reduce((sum, e) => sum + (e.holdTimeDays || 0), 0) / entriesWithHoldTime.length
        : 0;
      
      const totalProfitLoss = entries.reduce((sum, e) => {
        if (e.realizedPnL) {
          return sum + parseFloat(e.realizedPnL);
        }
        return sum;
      }, 0);
      
      return {
        totalTrades,
        openPositions,
        closedPositions,
        winCount,
        lossCount,
        breakevenCount,
        winRate: parseFloat(winRate.toFixed(2)),
        averageReturn: parseFloat(averageReturn.toFixed(2)),
        averageHoldTime: parseFloat(averageHoldTime.toFixed(2)),
        totalProfitLoss: parseFloat(totalProfitLoss.toFixed(2))
      };
    } catch (error) {
      console.error('Error getting journal stats:', error);
      return {
        totalTrades: 0,
        openPositions: 0,
        closedPositions: 0,
        winCount: 0,
        lossCount: 0,
        breakevenCount: 0,
        winRate: 0,
        averageReturn: 0,
        averageHoldTime: 0,
        totalProfitLoss: 0
      };
    }
  }
}

// Export singleton instance
export const tradeJournalService = new TradeJournalService();
