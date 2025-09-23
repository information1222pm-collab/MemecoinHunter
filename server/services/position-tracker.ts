import { EventEmitter } from 'events';
import { storage } from '../storage';
import type { Position, Token } from '@shared/schema';

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
  holdingPeriod: number; // Days held
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
  private readonly UPDATE_FREQUENCY = 30000; // 30 seconds

  async start() {
    if (this.isRunning) return;
    
    this.isRunning = true;
    console.log('📊 Position Tracker started');
    
    // Initial update
    await this.updateAllPositions();
    
    // Set up regular updates
    this.updateInterval = setInterval(async () => {
      await this.updateAllPositions();
    }, this.UPDATE_FREQUENCY);
  }

  stop() {
    if (!this.isRunning) return;
    
    this.isRunning = false;
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }
    console.log('📊 Position Tracker stopped');
  }

  private async updateAllPositions() {
    try {
      console.log('📊 POSITION-TRACKER: Updating all position values...');
      
      const portfolios = await storage.getAllPortfolios();
      
      for (const portfolio of portfolios) {
        await this.updatePortfolioPositions(portfolio.id);
      }
      
      console.log(`📊 POSITION-TRACKER: Updated ${portfolios.length} portfolios`);
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
          totalPortfolioValue += parseFloat(analytics.currentValue);
          totalUnrealizedPnL += parseFloat(analytics.unrealizedPnL);

          // Update position in database
          await storage.updatePosition(position.id, {
            currentValue: analytics.currentValue,
            unrealizedPnL: analytics.unrealizedPnL
          });
        }
      }

      // Calculate portfolio analytics
      const portfolioAnalytics = await this.calculatePortfolioAnalytics(
        portfolio,
        positionAnalytics,
        totalPortfolioValue,
        totalUnrealizedPnL
      );

      // Update portfolio totals
      await storage.updatePortfolio(portfolioId, {
        totalValue: totalPortfolioValue.toFixed(2),
        totalPnL: totalUnrealizedPnL.toFixed(2)
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

      const currentPrice = parseFloat(token.currentPrice || '0');
      const avgBuyPrice = parseFloat(position.avgBuyPrice);
      const amount = parseFloat(position.amount);

      if (currentPrice <= 0 || avgBuyPrice <= 0 || amount <= 0) return null;

      const currentValue = amount * currentPrice;
      const costBasis = amount * avgBuyPrice;
      const unrealizedPnL = currentValue - costBasis;
      const unrealizedPnLPercent = (unrealizedPnL / costBasis) * 100;

      // Calculate day change (simplified - would need price history for exact calculation)
      const dayChange = parseFloat(token.priceChange24h || '0');
      const dayChangeValue = currentValue * (dayChange / 100);

      // Calculate holding period (simplified)
      const holdingPeriod = position.updatedAt 
        ? Math.floor((Date.now() - new Date(position.updatedAt).getTime()) / (1000 * 60 * 60 * 24))
        : 0;

      return {
        positionId: position.id,
        tokenSymbol: token.symbol,
        currentValue: currentValue.toFixed(2),
        unrealizedPnL: unrealizedPnL.toFixed(2),
        unrealizedPnLPercent,
        costBasis: costBasis.toFixed(2),
        allocation: 0, // Will be calculated at portfolio level
        dayChange,
        dayChangeValue: dayChangeValue.toFixed(2),
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
      position.allocation = totalValue > 0 ? (parseFloat(position.currentValue) / totalValue) * 100 : 0;
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
    const totalDayChangeValue = positions.reduce((sum, p) => sum + parseFloat(p.dayChangeValue), 0);
    const dayChange = totalValue > 0 ? (totalDayChangeValue / totalValue) * 100 : 0;

    const startingCapital = parseFloat(portfolio.startingCapital || '10000');
    const totalPnLPercent = startingCapital > 0 ? (totalPnL / startingCapital) * 100 : 0;

    return {
      portfolioId: portfolio.id,
      userId: portfolio.userId,
      totalValue: totalValue.toFixed(2),
      totalPnL: totalPnL.toFixed(2),
      totalPnLPercent,
      dayChange,
      dayChangeValue: totalDayChangeValue.toFixed(2),
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
      
      if (!portfolio || positions.length === 0) return null;

      const positionAnalytics: PositionAnalytics[] = [];
      let totalValue = 0;
      let totalPnL = 0;

      for (const position of positions) {
        const analytics = await this.calculatePositionAnalytics(position);
        if (analytics) {
          positionAnalytics.push(analytics);
          totalValue += parseFloat(analytics.currentValue);
          totalPnL += parseFloat(analytics.unrealizedPnL);
        }
      }

      return await this.calculatePortfolioAnalytics(portfolio, positionAnalytics, totalValue, totalPnL);
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