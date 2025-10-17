import { EventEmitter } from 'events';
import { storage } from '../storage';
import type { Position, Token } from '@shared/schema';
import { streamingPriceGateway } from './streaming-price-gateway';
import { safeParseFloat } from '../utils/safe-number';

/**
 * Safely convert a number to a fixed decimal string, preventing NaN from being saved to database
 */
function safeToFixed(value: number, decimals: number = 2, fallback: string = '0'): string {
  if (isNaN(value) || !isFinite(value)) {
    return fallback;
  }
  return value.toFixed(decimals);
}

interface PositionAnalytics {
  positionId: string;
  tokenSymbol: string;
  currentValue: string;
  unrealizedPnL: string;
  unrealizedPnLPercent: number;
  costBasis: string;
  allocation: number; // Percentage of portfolio
  dayChange: number;
  dayChangeValue: string;
  holdingPeriod: number;
}

interface PortfolioAnalytics {
  portfolioId: string;
  userId: string;
  totalValue: string;
  totalPnL: string;
  totalPnLPercent: number;
  dayChange: number;
  dayChangeValue: string;
  positionsCount: number;
  topPerformers: Array<{
    symbol: string;
    pnlPercent: number;
    value: string;
  }>;
  riskMetrics: {
    concentration: number; // How concentrated the portfolio is (0-100)
    diversification: number; // Number of different tokens
    volatility: number; // Portfolio volatility estimate
  };
}

class PositionTracker extends EventEmitter {
  private isRunning = false;
  private updateInterval?: NodeJS.Timeout;
  private readonly BACKUP_UPDATE_FREQUENCY = 30000; // Backup polling every 30s
  private throttleTimers = new Map<string, NodeJS.Timeout>(); // Throttle per portfolio
  private readonly THROTTLE_MS = 250; // Update UI every 250ms max
  private tokenToPortfoliosCache = new Map<string, Set<string>>(); // Cache token -> portfolios mapping

  async start() {
    if (this.isRunning) return;
    
    this.isRunning = true;
    console.log('📊 Position Tracker started (Event-Driven Mode)');
    
    // Build token-to-portfolio cache
    await this.buildTokenCache();
    
    // Initial update
    await this.updateAllPositions();
    
    // Listen to real-time price updates from streaming gateway
    streamingPriceGateway.on('priceUpdate', async (update: any) => {
      await this.handlePriceUpdate(update);
    });
    
    // Backup polling mechanism (every 30s) to catch any missed updates
    this.updateInterval = setInterval(async () => {
      await this.updateAllPositions();
      await this.buildTokenCache(); // Refresh cache periodically
    }, this.BACKUP_UPDATE_FREQUENCY);
    
    console.log('📊 Position Tracker: Real-time updates enabled with 250ms throttling');
  }

  stop() {
    if (!this.isRunning) return;
    
    this.isRunning = false;
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }
    
    // Clear all throttle timers
    const timers = Array.from(this.throttleTimers.values());
    for (const timer of timers) {
      clearTimeout(timer);
    }
    this.throttleTimers.clear();
    
    console.log('📊 Position Tracker stopped');
  }

  private async buildTokenCache() {
    try {
      const portfolios = await storage.getAllPortfolios();
      const newCache = new Map<string, Set<string>>();
      
      for (const portfolio of portfolios) {
        const positions = await storage.getPositionsByPortfolio(portfolio.id);
        for (const position of positions) {
          if (!newCache.has(position.tokenId)) {
            newCache.set(position.tokenId, new Set());
          }
          newCache.get(position.tokenId)!.add(position.portfolioId);
        }
      }
      
      this.tokenToPortfoliosCache = newCache;
    } catch (error) {
      console.error('📊 POSITION-TRACKER: Error building token cache:', error);
    }
  }

  private async handlePriceUpdate(update: { tokenId: string; price: number; timestamp: Date }) {
    try {
      // Use cache to quickly find affected portfolios
      const affectedPortfolios = this.tokenToPortfoliosCache.get(update.tokenId);
      
      if (!affectedPortfolios || affectedPortfolios.size === 0) return;
      
      // Update each affected portfolio with throttling
      const portfolioIds = Array.from(affectedPortfolios);
      for (const portfolioId of portfolioIds) {
        this.throttledPortfolioUpdate(portfolioId);
      }
      
    } catch (error) {
      console.error('📊 POSITION-TRACKER: Error handling price update:', error);
    }
  }

  private throttledPortfolioUpdate(portfolioId: string) {
    // Clear existing timer for this portfolio if it exists
    if (this.throttleTimers.has(portfolioId)) {
      clearTimeout(this.throttleTimers.get(portfolioId)!);
    }
    
    // Set new timer to update after throttle period
    const timer = setTimeout(async () => {
      await this.updatePortfolioPositions(portfolioId);
      this.throttleTimers.delete(portfolioId);
    }, this.THROTTLE_MS);
    
    this.throttleTimers.set(portfolioId, timer);
  }

  private async updateAllPositions() {
    try {
      const portfolios = await storage.getAllPortfolios();
      
      for (const portfolio of portfolios) {
        await this.updatePortfolioPositions(portfolio.id);
      }
      
    } catch (error) {
      console.error('📊 POSITION-TRACKER: Error updating positions:', error);
    }
  }

  private async updatePortfolioPositions(portfolioId: string) {
    try {
      const positions = await storage.getPositionsByPortfolio(portfolioId);
      const portfolio = await storage.getPortfolio(portfolioId);
      
      if (!portfolio || positions.length === 0) return;

      let totalPortfolioValue = 0;
      let totalUnrealizedPnL = 0;
      const positionAnalytics: PositionAnalytics[] = [];

      // Update each position
      for (const position of positions) {
        const analytics = await this.calculatePositionAnalytics(position);
        
        if (analytics) {
          positionAnalytics.push(analytics);
          totalPortfolioValue += safeParseFloat(analytics.currentValue, 0);
          totalUnrealizedPnL += safeParseFloat(analytics.unrealizedPnL, 0);

          // Update position in database
          await storage.updatePosition(position.id, {
            currentValue: analytics.currentValue,
            unrealizedPnL: analytics.unrealizedPnL
          });
        }
      }

      // Calculate actual portfolio value (positions + cash)
      const cashBalance = safeParseFloat(portfolio.cashBalance, 0);
      const actualTotalValue = totalPortfolioValue + cashBalance;
      const startingCapital = safeParseFloat(portfolio.startingCapital, 10000);
      const actualTotalPnL = actualTotalValue - startingCapital;
      
      // Calculate portfolio analytics with actual total value
      const portfolioAnalytics = await this.calculatePortfolioAnalytics(
        portfolio,
        positionAnalytics,
        actualTotalValue,
        actualTotalPnL
      );
      
      // Update portfolio totals including daily P&L from analytics
      await storage.updatePortfolio(portfolioId, {
        totalValue: safeToFixed(actualTotalValue, 2, portfolio.startingCapital || '10000'),
        totalPnL: safeToFixed(actualTotalPnL, 2, '0'),
        dailyPnL: portfolioAnalytics.dayChangeValue
      });

      // Emit real-time updates
      this.emit('portfolioUpdated', portfolioAnalytics);
      this.emit('positionsUpdated', { portfolioId, positions: positionAnalytics });

    } catch (error) {
      console.error(`📊 POSITION-TRACKER: Error updating portfolio ${portfolioId}:`, error);
    }
  }

  private async calculatePositionAnalytics(position: Position): Promise<PositionAnalytics | null> {
    try {
      const token = await storage.getToken(position.tokenId);
      if (!token) return null;

      const currentPrice = safeParseFloat(token.currentPrice, 0);
      const avgBuyPrice = safeParseFloat(position.avgBuyPrice, 0);
      const amount = safeParseFloat(position.amount, 0);

      if (currentPrice <= 0 || avgBuyPrice <= 0 || amount <= 0) return null;

      const currentValue = amount * currentPrice;
      const costBasis = amount * avgBuyPrice;
      const unrealizedPnL = currentValue - costBasis;
      const unrealizedPnLPercent = (unrealizedPnL / costBasis) * 100;

      // Calculate day change (simplified - would need price history for exact calculation)
      const dayChange = safeParseFloat(token.priceChange24h, 0);
      const dayChangeValue = currentValue * (dayChange / 100);

      // Calculate holding period (simplified)
      const holdingPeriod = position.updatedAt 
        ? Math.floor((Date.now() - new Date(position.updatedAt).getTime()) / (1000 * 60 * 60 * 24))
        : 0;

      return {
        positionId: position.id,
        tokenSymbol: token.symbol,
        currentValue: safeToFixed(currentValue),
        unrealizedPnL: safeToFixed(unrealizedPnL),
        unrealizedPnLPercent,
        costBasis: safeToFixed(costBasis),
        allocation: 0, // Will be calculated at portfolio level
        dayChange,
        dayChangeValue: safeToFixed(dayChangeValue),
        holdingPeriod
      };

    } catch (error) {
      console.error('📊 POSITION-TRACKER: Error calculating position analytics:', error);
      return null;
    }
  }

  private async calculatePortfolioAnalytics(
    portfolio: any,
    positions: PositionAnalytics[],
    totalValue: number,
    totalPnL: number
  ): Promise<PortfolioAnalytics> {
    
    // Calculate allocations
    positions.forEach(position => {
      position.allocation = totalValue > 0 ? (safeParseFloat(position.currentValue, 0) / totalValue) * 100 : 0;
    });

    // Find top performers
    const topPerformers = positions
      .sort((a, b) => b.unrealizedPnLPercent - a.unrealizedPnLPercent)
      .slice(0, 5)
      .map(p => ({
        symbol: p.tokenSymbol,
        pnlPercent: p.unrealizedPnLPercent,
        value: p.currentValue
      }));

    // Calculate risk metrics
    const riskMetrics = this.calculateRiskMetrics(positions);

    // Calculate portfolio-level day change
    const totalDayChangeValue = positions.reduce((sum, p) => sum + safeParseFloat(p.dayChangeValue, 0), 0);
    const dayChange = totalValue > 0 ? (totalDayChangeValue / totalValue) * 100 : 0;

    const startingCapital = safeParseFloat(portfolio.startingCapital, 10000);
    const totalPnLPercent = startingCapital > 0 ? (totalPnL / startingCapital) * 100 : 0;

    return {
      portfolioId: portfolio.id,
      userId: portfolio.userId,
      totalValue: safeToFixed(totalValue),
      totalPnL: safeToFixed(totalPnL),
      totalPnLPercent,
      dayChange,
      dayChangeValue: safeToFixed(totalDayChangeValue),
      positionsCount: positions.length,
      topPerformers,
      riskMetrics
    };
  }

  private calculateRiskMetrics(positions: PositionAnalytics[]) {
    if (positions.length === 0) {
      return { concentration: 0, diversification: 0, volatility: 0 };
    }

    // Calculate concentration (how much is in the largest position)
    const maxAllocation = Math.max(...positions.map(p => p.allocation));
    const concentration = maxAllocation;

    // Diversification is just the number of positions
    const diversification = positions.length;

    // Simple volatility estimate based on P&L variance
    const avgPnL = positions.reduce((sum, p) => sum + p.unrealizedPnLPercent, 0) / positions.length;
    const variance = positions.reduce((sum, p) => sum + Math.pow(p.unrealizedPnLPercent - avgPnL, 2), 0) / positions.length;
    const volatility = Math.sqrt(variance);

    return {
      concentration: Math.round(concentration * 100) / 100,
      diversification,
      volatility: Math.round(volatility * 100) / 100
    };
  }

  // Get current analytics for a portfolio
  async getPortfolioAnalytics(portfolioId: string): Promise<PortfolioAnalytics | null> {
    try {
      const portfolio = await storage.getPortfolio(portfolioId);
      const positions = await storage.getPositionsByPortfolio(portfolioId);
      
      if (!portfolio) return null;

      const positionAnalytics: PositionAnalytics[] = [];
      let totalPositionsValue = 0;

      for (const position of positions) {
        const analytics = await this.calculatePositionAnalytics(position);
        if (analytics) {
          positionAnalytics.push(analytics);
          totalPositionsValue += safeParseFloat(analytics.currentValue, 0);
        }
      }

      // Calculate actual portfolio value including cash
      const cashBalance = safeParseFloat(portfolio.cashBalance, 0);
      const actualTotalValue = totalPositionsValue + cashBalance;
      const startingCapital = safeParseFloat(portfolio.startingCapital, 10000);
      const actualTotalPnL = actualTotalValue - startingCapital;

      return await this.calculatePortfolioAnalytics(portfolio, positionAnalytics, actualTotalValue, actualTotalPnL);
    } catch (error) {
      console.error('📊 POSITION-TRACKER: Error getting portfolio analytics:', error);
      return null;
    }
  }

  // Get current analytics for specific positions
  async getPositionAnalytics(portfolioId: string): Promise<PositionAnalytics[]> {
    try {
      const positions = await storage.getPositionsByPortfolio(portfolioId);
      const analytics: PositionAnalytics[] = [];

      for (const position of positions) {
        const positionAnalytics = await this.calculatePositionAnalytics(position);
        if (positionAnalytics) {
          analytics.push(positionAnalytics);
        }
      }

      return analytics;
    } catch (error) {
      console.error('📊 POSITION-TRACKER: Error getting position analytics:', error);
      return [];
    }
  }
}

export const positionTracker = new PositionTracker();
export type { PositionAnalytics, PortfolioAnalytics };
