import { EventEmitter } from 'events';
import { storage } from '../storage';
import type { Trade, Position, Portfolio, Pattern } from '@shared/schema';

export interface RealtimePnLMetrics {
  totalRealizedPnL: number;
  totalUnrealizedPnL: number;
  totalPnL: number;
  dailyPnL: number;
  pnlPercentage: number;
  startingCapital: number;
  currentValue: number;
}

export interface WinLossMetrics {
  totalWins: number;
  totalLosses: number;
  totalBreakeven: number;
  winRate: number;
  averageWin: number;
  averageLoss: number;
  profitFactor: number;
  largestWin: number;
  largestLoss: number;
}

export interface HoldTimeMetrics {
  averageHoldTime: string;
  averageHoldTimeMs: number;
  averageWinHoldTime: string;
  averageWinHoldTimeMs: number;
  averageLossHoldTime: string;
  averageLossHoldTimeMs: number;
  totalClosedTrades: number;
}

export interface StrategyROI {
  patternId: string | null;
  patternType: string;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  totalProfit: number;
  totalLoss: number;
  netProfit: number;
  roi: number;
  winRate: number;
  averageReturn: number;
}

export class TradingAnalyticsService extends EventEmitter {
  
  async getRealtimePnL(portfolioId: string): Promise<RealtimePnLMetrics> {
    try {
      const portfolio = await storage.getPortfolio(portfolioId);
      if (!portfolio) {
        throw new Error(`Portfolio ${portfolioId} not found`);
      }

      const trades = await storage.getTradesByPortfolio(portfolioId);
      const positions = await storage.getPositionsByPortfolio(portfolioId);

      const startingCapital = parseFloat(portfolio.startingCapital || '10000');
      const cashBalance = parseFloat(portfolio.cashBalance || '0');

      // Use portfolio's accumulated realized P&L instead of summing trades
      const totalRealizedPnL = parseFloat(portfolio.realizedPnL || '0');

      // Calculate current position values and unrealized P&L
      let currentPositionsValue = 0;
      let totalUnrealizedPnL = 0;
      
      for (const position of positions) {
        const amount = parseFloat(position.amount);
        if (amount > 0) {
          const token = await storage.getToken(position.tokenId);
          if (token) {
            const currentPrice = parseFloat(token.currentPrice || '0');
            const avgBuyPrice = parseFloat(position.avgBuyPrice || '0');
            
            const positionValue = amount * currentPrice;
            const costBasis = amount * avgBuyPrice;
            const unrealizedPnL = positionValue - costBasis;
            
            currentPositionsValue += positionValue;
            totalUnrealizedPnL += unrealizedPnL;
          }
        }
      }
      
      // CORRECT P&L CALCULATION: Current Value - Starting Capital
      const currentValue = cashBalance + currentPositionsValue;
      const totalPnL = currentValue - startingCapital;

      const dailyPnL = parseFloat(portfolio.dailyPnL || '0');
      const pnlPercentage = startingCapital > 0 ? (totalPnL / startingCapital) * 100 : 0;

      return {
        totalRealizedPnL,
        totalUnrealizedPnL,
        totalPnL,
        dailyPnL,
        pnlPercentage,
        startingCapital,
        currentValue,
      };
    } catch (error) {
      console.error('Error calculating real-time P&L:', error);
      return {
        totalRealizedPnL: 0,
        totalUnrealizedPnL: 0,
        totalPnL: 0,
        dailyPnL: 0,
        pnlPercentage: 0,
        startingCapital: 10000,
        currentValue: 10000,
      };
    }
  }

  async getWinLossRatios(portfolioId: string): Promise<WinLossMetrics> {
    try {
      const trades = await storage.getTradesByPortfolio(portfolioId);

      const closedTrades = trades.filter(t => t.closedAt && t.realizedPnL !== null && t.realizedPnL !== undefined);
      
      if (closedTrades.length === 0) {
        return {
          totalWins: 0,
          totalLosses: 0,
          totalBreakeven: 0,
          winRate: 0,
          averageWin: 0,
          averageLoss: 0,
          profitFactor: 0,
          largestWin: 0,
          largestLoss: 0,
        };
      }

      let totalWins = 0;
      let totalLosses = 0;
      let totalBreakeven = 0;
      let totalWinAmount = 0;
      let totalLossAmount = 0;
      let largestWin = 0;
      let largestLoss = 0;

      for (const trade of closedTrades) {
        const pnl = parseFloat(trade.realizedPnL || '0');
        
        if (pnl > 0) {
          totalWins++;
          totalWinAmount += pnl;
          largestWin = Math.max(largestWin, pnl);
        } else if (pnl < 0) {
          totalLosses++;
          totalLossAmount += Math.abs(pnl);
          largestLoss = Math.max(largestLoss, Math.abs(pnl));
        } else {
          totalBreakeven++;
        }
      }

      const totalTrades = totalWins + totalLosses + totalBreakeven;
      const winRate = totalTrades > 0 ? (totalWins / totalTrades) * 100 : 0;
      
      const averageWin = totalWins > 0 ? totalWinAmount / totalWins : 0;
      const averageLoss = totalLosses > 0 ? totalLossAmount / totalLosses : 0;
      
      const profitFactor = totalLossAmount > 0 ? totalWinAmount / totalLossAmount : totalWinAmount > 0 ? Infinity : 0;

      return {
        totalWins,
        totalLosses,
        totalBreakeven,
        winRate,
        averageWin,
        averageLoss,
        profitFactor: profitFactor === Infinity ? 999 : profitFactor,
        largestWin,
        largestLoss,
      };
    } catch (error) {
      console.error('Error calculating win/loss ratios:', error);
      return {
        totalWins: 0,
        totalLosses: 0,
        totalBreakeven: 0,
        winRate: 0,
        averageWin: 0,
        averageLoss: 0,
        profitFactor: 0,
        largestWin: 0,
        largestLoss: 0,
      };
    }
  }

  async getAverageHoldTime(portfolioId: string): Promise<HoldTimeMetrics> {
    try {
      const trades = await storage.getTradesByPortfolio(portfolioId);

      const closedTrades = trades.filter(t => t.closedAt && t.createdAt);
      
      if (closedTrades.length === 0) {
        return {
          averageHoldTime: '0 hours',
          averageHoldTimeMs: 0,
          averageWinHoldTime: '0 hours',
          averageWinHoldTimeMs: 0,
          averageLossHoldTime: '0 hours',
          averageLossHoldTimeMs: 0,
          totalClosedTrades: 0,
        };
      }

      const winningTrades = closedTrades.filter(t => parseFloat(t.realizedPnL || '0') > 0);
      const losingTrades = closedTrades.filter(t => parseFloat(t.realizedPnL || '0') < 0);

      const calculateAvgHoldTime = (tradeList: Trade[]): number => {
        if (tradeList.length === 0) return 0;
        
        let totalMs = 0;
        for (const trade of tradeList) {
          if (trade.closedAt && trade.createdAt) {
            const closedTime = new Date(trade.closedAt).getTime();
            const createdTime = new Date(trade.createdAt).getTime();
            totalMs += closedTime - createdTime;
          }
        }
        
        return tradeList.length > 0 ? totalMs / tradeList.length : 0;
      };

      const avgHoldTimeMs = calculateAvgHoldTime(closedTrades);
      const avgWinHoldTimeMs = calculateAvgHoldTime(winningTrades);
      const avgLossHoldTimeMs = calculateAvgHoldTime(losingTrades);

      const formatHoldTime = (ms: number): string => {
        if (ms === 0) return '0 hours';
        
        const hours = ms / (1000 * 60 * 60);
        const days = hours / 24;
        
        if (days >= 1) {
          return `${days.toFixed(1)} days`;
        } else if (hours >= 1) {
          return `${hours.toFixed(1)} hours`;
        } else {
          const minutes = ms / (1000 * 60);
          return `${minutes.toFixed(1)} minutes`;
        }
      };

      return {
        averageHoldTime: formatHoldTime(avgHoldTimeMs),
        averageHoldTimeMs: avgHoldTimeMs,
        averageWinHoldTime: formatHoldTime(avgWinHoldTimeMs),
        averageWinHoldTimeMs: avgWinHoldTimeMs,
        averageLossHoldTime: formatHoldTime(avgLossHoldTimeMs),
        averageLossHoldTimeMs: avgLossHoldTimeMs,
        totalClosedTrades: closedTrades.length,
      };
    } catch (error) {
      console.error('Error calculating average hold time:', error);
      return {
        averageHoldTime: '0 hours',
        averageHoldTimeMs: 0,
        averageWinHoldTime: '0 hours',
        averageWinHoldTimeMs: 0,
        averageLossHoldTime: '0 hours',
        averageLossHoldTimeMs: 0,
        totalClosedTrades: 0,
      };
    }
  }

  async getROIByStrategy(portfolioId: string): Promise<StrategyROI[]> {
    try {
      const trades = await storage.getTradesByPortfolio(portfolioId);
      const allPatterns = await storage.getAllPatterns();

      const closedTrades = trades.filter(t => t.closedAt && t.realizedPnL !== null && t.realizedPnL !== undefined);
      
      if (closedTrades.length === 0) {
        return [];
      }

      const strategyMap = new Map<string, {
        patternId: string | null;
        patternType: string;
        trades: Trade[];
      }>();

      for (const trade of closedTrades) {
        const key = trade.patternId || 'manual';
        
        if (!strategyMap.has(key)) {
          let patternType = 'Manual Trading';
          
          if (trade.patternId) {
            const pattern = allPatterns.find(p => p.id === trade.patternId);
            patternType = pattern ? pattern.patternType : 'Unknown Pattern';
          }
          
          strategyMap.set(key, {
            patternId: trade.patternId,
            patternType,
            trades: [],
          });
        }
        
        strategyMap.get(key)!.trades.push(trade);
      }

      const strategies: StrategyROI[] = [];

      for (const [key, data] of Array.from(strategyMap.entries())) {
        const { patternId, patternType, trades: strategyTrades } = data;
        
        let totalProfit = 0;
        let totalLoss = 0;
        let winningTrades = 0;
        let losingTrades = 0;
        let totalInvestment = 0;

        for (const trade of strategyTrades) {
          const pnl = parseFloat(trade.realizedPnL || '0');
          const investment = parseFloat(trade.totalValue || '0');
          totalInvestment += investment;
          
          if (pnl > 0) {
            totalProfit += pnl;
            winningTrades++;
          } else if (pnl < 0) {
            totalLoss += Math.abs(pnl);
            losingTrades++;
          }
        }

        const netProfit = totalProfit - totalLoss;
        const roi = totalInvestment > 0 ? (netProfit / totalInvestment) * 100 : 0;
        const totalTrades = strategyTrades.length;
        const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;
        const averageReturn = totalTrades > 0 ? netProfit / totalTrades : 0;

        strategies.push({
          patternId,
          patternType,
          totalTrades,
          winningTrades,
          losingTrades,
          totalProfit,
          totalLoss,
          netProfit,
          roi,
          winRate,
          averageReturn,
        });
      }

      strategies.sort((a, b) => b.roi - a.roi);

      return strategies;
    } catch (error) {
      console.error('Error calculating ROI by strategy:', error);
      return [];
    }
  }

  async getAllMetrics(portfolioId: string): Promise<{
    pnl: RealtimePnLMetrics;
    winLoss: WinLossMetrics;
    holdTime: HoldTimeMetrics;
    strategies: StrategyROI[];
  }> {
    const [pnl, winLoss, holdTime, strategies] = await Promise.all([
      this.getRealtimePnL(portfolioId),
      this.getWinLossRatios(portfolioId),
      this.getAverageHoldTime(portfolioId),
      this.getROIByStrategy(portfolioId),
    ]);

    return {
      pnl,
      winLoss,
      holdTime,
      strategies,
    };
  }

  async getAllPortfoliosMetrics(): Promise<{
    pnl: RealtimePnLMetrics;
    winLoss: WinLossMetrics;
    holdTime: HoldTimeMetrics;
    strategies: StrategyROI[];
  }> {
    try {
      const allPortfolios = await storage.getAllPortfolios();
      
      // Aggregate P&L across all portfolios
      let totalStartingCapital = 0;
      let totalCurrentValue = 0;
      let totalRealizedPnL = 0;
      let totalUnrealizedPnL = 0;
      let totalDailyPnL = 0;

      for (const portfolio of allPortfolios) {
        const pnl = await this.getRealtimePnL(portfolio.id);
        totalStartingCapital += pnl.startingCapital;
        totalCurrentValue += pnl.currentValue;
        totalRealizedPnL += pnl.totalRealizedPnL;
        totalUnrealizedPnL += pnl.totalUnrealizedPnL;
        totalDailyPnL += pnl.dailyPnL;
      }

      const totalPnL = totalCurrentValue - totalStartingCapital;
      const pnlPercentage = totalStartingCapital > 0 ? (totalPnL / totalStartingCapital) * 100 : 0;

      // Aggregate win/loss across all portfolios
      const allWinLoss = await Promise.all(
        allPortfolios.map(p => this.getWinLossRatios(p.id))
      );

      let totalWins = 0;
      let totalLosses = 0;
      let totalBreakeven = 0;
      let totalWinAmount = 0;
      let totalLossAmount = 0;
      let largestWin = 0;
      let largestLoss = 0;

      for (const wl of allWinLoss) {
        totalWins += wl.totalWins;
        totalLosses += wl.totalLosses;
        totalBreakeven += wl.totalBreakeven;
        totalWinAmount += wl.averageWin * wl.totalWins;
        totalLossAmount += wl.averageLoss * wl.totalLosses;
        largestWin = Math.max(largestWin, wl.largestWin);
        largestLoss = Math.max(largestLoss, wl.largestLoss);
      }

      const totalTrades = totalWins + totalLosses + totalBreakeven;
      const winRate = totalTrades > 0 ? (totalWins / totalTrades) * 100 : 0;
      const averageWin = totalWins > 0 ? totalWinAmount / totalWins : 0;
      const averageLoss = totalLosses > 0 ? totalLossAmount / totalLosses : 0;
      const profitFactor = totalLossAmount > 0 ? totalWinAmount / totalLossAmount : totalWinAmount > 0 ? Infinity : 0;

      // Aggregate hold time across all portfolios
      const allHoldTime = await Promise.all(
        allPortfolios.map(p => this.getAverageHoldTime(p.id))
      );

      let totalHoldTimeMs = 0;
      let totalWinHoldTimeMs = 0;
      let totalLossHoldTimeMs = 0;
      let totalClosedTrades = 0;

      for (const ht of allHoldTime) {
        totalHoldTimeMs += ht.averageHoldTimeMs;
        totalWinHoldTimeMs += ht.averageWinHoldTimeMs;
        totalLossHoldTimeMs += ht.averageLossHoldTimeMs;
        totalClosedTrades += ht.totalClosedTrades;
      }

      const avgHoldTimeMs = allPortfolios.length > 0 ? totalHoldTimeMs / allPortfolios.length : 0;
      const avgWinHoldTimeMs = allPortfolios.length > 0 ? totalWinHoldTimeMs / allPortfolios.length : 0;
      const avgLossHoldTimeMs = allPortfolios.length > 0 ? totalLossHoldTimeMs / allPortfolios.length : 0;

      // Aggregate strategies across all portfolios
      const allStrategies = await Promise.all(
        allPortfolios.map(p => this.getROIByStrategy(p.id))
      );

      const strategyMap = new Map<string, {
        patternId: string | null;
        patternType: string;
        totalTrades: number;
        winningTrades: number;
        losingTrades: number;
        totalProfit: number;
        totalLoss: number;
      }>();

      for (const strategies of allStrategies) {
        for (const strategy of strategies) {
          const key = strategy.patternId || 'manual';
          
          if (!strategyMap.has(key)) {
            strategyMap.set(key, {
              patternId: strategy.patternId,
              patternType: strategy.patternType,
              totalTrades: 0,
              winningTrades: 0,
              losingTrades: 0,
              totalProfit: 0,
              totalLoss: 0,
            });
          }

          const existing = strategyMap.get(key)!;
          existing.totalTrades += strategy.totalTrades;
          existing.winningTrades += strategy.winningTrades;
          existing.losingTrades += strategy.losingTrades;
          existing.totalProfit += strategy.totalProfit;
          existing.totalLoss += strategy.totalLoss;
        }
      }

      const aggregatedStrategies: StrategyROI[] = [];
      for (const [key, data] of Array.from(strategyMap.entries())) {
        const netProfit = data.totalProfit - data.totalLoss;
        const roi = data.totalTrades > 0 ? netProfit / data.totalTrades : 0;
        const winRate = data.totalTrades > 0 ? (data.winningTrades / data.totalTrades) * 100 : 0;
        const averageReturn = data.totalTrades > 0 ? netProfit / data.totalTrades : 0;

        aggregatedStrategies.push({
          patternId: data.patternId,
          patternType: data.patternType,
          totalTrades: data.totalTrades,
          winningTrades: data.winningTrades,
          losingTrades: data.losingTrades,
          totalProfit: data.totalProfit,
          totalLoss: data.totalLoss,
          netProfit,
          roi,
          winRate,
          averageReturn,
        });
      }

      aggregatedStrategies.sort((a, b) => b.roi - a.roi);

      return {
        pnl: {
          totalRealizedPnL,
          totalUnrealizedPnL,
          totalPnL,
          dailyPnL: totalDailyPnL,
          pnlPercentage,
          startingCapital: totalStartingCapital,
          currentValue: totalCurrentValue,
        },
        winLoss: {
          totalWins,
          totalLosses,
          totalBreakeven,
          winRate,
          averageWin,
          averageLoss,
          profitFactor,
          largestWin,
          largestLoss,
        },
        holdTime: {
          averageHoldTime: this.formatHoldTime(avgHoldTimeMs),
          averageHoldTimeMs: avgHoldTimeMs,
          averageWinHoldTime: this.formatHoldTime(avgWinHoldTimeMs),
          averageWinHoldTimeMs: avgWinHoldTimeMs,
          averageLossHoldTime: this.formatHoldTime(avgLossHoldTimeMs),
          averageLossHoldTimeMs: avgLossHoldTimeMs,
          totalClosedTrades,
        },
        strategies: aggregatedStrategies,
      };
    } catch (error) {
      console.error('Error calculating all portfolios metrics:', error);
      return {
        pnl: {
          totalRealizedPnL: 0,
          totalUnrealizedPnL: 0,
          totalPnL: 0,
          dailyPnL: 0,
          pnlPercentage: 0,
          startingCapital: 10000,
          currentValue: 10000,
        },
        winLoss: {
          totalWins: 0,
          totalLosses: 0,
          totalBreakeven: 0,
          winRate: 0,
          averageWin: 0,
          averageLoss: 0,
          profitFactor: 0,
          largestWin: 0,
          largestLoss: 0,
        },
        holdTime: {
          averageHoldTime: '0 hours',
          averageHoldTimeMs: 0,
          averageWinHoldTime: '0 hours',
          averageWinHoldTimeMs: 0,
          averageLossHoldTime: '0 hours',
          averageLossHoldTimeMs: 0,
          totalClosedTrades: 0,
        },
        strategies: [],
      };
    }
  }

  private formatHoldTime(ms: number): string {
    if (ms === 0) return '0 hours';
    
    const hours = ms / (1000 * 60 * 60);
    const days = hours / 24;
    
    if (days >= 1) {
      return `${days.toFixed(1)} days`;
    } else if (hours >= 1) {
      return `${hours.toFixed(1)} hours`;
    } else {
      const minutes = ms / (1000 * 60);
      return `${minutes.toFixed(1)} minutes`;
    }
  }

  emitMetricsUpdate(portfolioId: string, metrics: any) {
    this.emit('metricsUpdated', {
      portfolioId,
      metrics,
      timestamp: new Date().toISOString(),
    });
  }
}

export const tradingAnalyticsService = new TradingAnalyticsService();
