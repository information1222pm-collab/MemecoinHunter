import { storage } from '../storage';
import type { Trade, Position, Portfolio, Token } from '@shared/schema';

export interface DailySummary {
  date: string;
  tradesExecuted: number;
  buyTrades: number;
  sellTrades: number;
  realizedPnL: number;
  feesPaid: number;
  winRate: number;
  largestWin: number;
  largestLoss: number;
  totalVolume: number;
}

export interface WeeklySummary {
  weekStart: string;
  weekEnd: string;
  tradesExecuted: number;
  buyTrades: number;
  sellTrades: number;
  realizedPnL: number;
  feesPaid: number;
  winRate: number;
  largestWin: number;
  largestLoss: number;
  totalVolume: number;
  dailyBreakdown: DailySummary[];
}

export interface ExposureMetrics {
  totalPositionValue: number;
  cashBalance: number;
  portfolioValue: number;
  cashAllocationPercent: number;
  positionAllocationPercent: number;
  largestPositionValue: number;
  largestPositionSymbol: string;
  concentrationRisk: number;
  numberOfOpenPositions: number;
  diversificationScore: number;
  positions: Array<{
    tokenId: string;
    symbol: string;
    value: number;
    percentOfPortfolio: number;
  }>;
}

export interface RealizedProfitsMetrics {
  timeframe: string;
  totalRealizedPnL: number;
  totalGains: number;
  totalLosses: number;
  gainsCount: number;
  lossesCount: number;
  averageGain: number;
  averageLoss: number;
  cumulativeProfitChart: Array<{
    date: string;
    cumulativeProfit: number;
  }>;
  bestTradingDay: {
    date: string;
    profit: number;
  };
  worstTradingDay: {
    date: string;
    loss: number;
  };
}

export interface DrawdownMetrics {
  currentDrawdown: number;
  currentDrawdownPercent: number;
  maxDrawdown: number;
  maxDrawdownPercent: number;
  drawdownDuration: number;
  recoveryTime: number | null;
  portfolioPeak: number;
  currentValue: number;
  drawdownChart: Array<{
    date: string;
    value: number;
    drawdownPercent: number;
  }>;
}

export interface RiskScore {
  overallScore: number;
  riskLevel: 'Low' | 'Medium' | 'High';
  concentrationScore: number;
  drawdownScore: number;
  volatilityScore: number;
  exposureScore: number;
  factors: {
    concentration: string;
    drawdown: string;
    volatility: string;
    exposure: string;
  };
}

export interface FullRiskReport {
  portfolioId: string;
  period: string;
  generatedAt: string;
  summary: DailySummary | WeeklySummary;
  exposure: ExposureMetrics;
  realizedProfits: RealizedProfitsMetrics;
  drawdown: DrawdownMetrics;
  riskScore: RiskScore;
}

export class RiskReportsService {
  
  async getDailySummary(portfolioId: string, date?: Date): Promise<DailySummary> {
    try {
      const targetDate = date || new Date();
      const startOfDay = new Date(targetDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(targetDate);
      endOfDay.setHours(23, 59, 59, 999);

      const allTrades = await storage.getTradesByPortfolio(portfolioId);
      
      const dayTrades = allTrades.filter(trade => {
        const tradeDate = new Date(trade.createdAt || '');
        return tradeDate >= startOfDay && tradeDate <= endOfDay;
      });

      const closedTrades = dayTrades.filter(t => t.closedAt && t.realizedPnL);
      
      let realizedPnL = 0;
      let largestWin = 0;
      let largestLoss = 0;
      let wins = 0;
      let totalVolume = 0;
      let feesPaid = 0;
      let buyTrades = 0;
      let sellTrades = 0;

      for (const trade of dayTrades) {
        totalVolume += parseFloat(trade.totalValue || '0');
        
        if (trade.type === 'buy') buyTrades++;
        if (trade.type === 'sell') sellTrades++;
        
        feesPaid += parseFloat(trade.totalValue || '0') * 0.001;
      }

      for (const trade of closedTrades) {
        const pnl = parseFloat(trade.realizedPnL || '0');
        realizedPnL += pnl;
        
        if (pnl > 0) {
          wins++;
          largestWin = Math.max(largestWin, pnl);
        } else if (pnl < 0) {
          largestLoss = Math.min(largestLoss, pnl);
        }
      }

      const winRate = closedTrades.length > 0 ? (wins / closedTrades.length) * 100 : 0;

      return {
        date: targetDate.toISOString().split('T')[0],
        tradesExecuted: dayTrades.length,
        buyTrades,
        sellTrades,
        realizedPnL,
        feesPaid,
        winRate,
        largestWin,
        largestLoss: Math.abs(largestLoss),
        totalVolume,
      };
    } catch (error) {
      console.error('Error calculating daily summary:', error);
      return {
        date: (date || new Date()).toISOString().split('T')[0],
        tradesExecuted: 0,
        buyTrades: 0,
        sellTrades: 0,
        realizedPnL: 0,
        feesPaid: 0,
        winRate: 0,
        largestWin: 0,
        largestLoss: 0,
        totalVolume: 0,
      };
    }
  }

  async getWeeklySummary(portfolioId: string, weekStartDate?: Date): Promise<WeeklySummary> {
    try {
      const startDate = weekStartDate || this.getWeekStart(new Date());
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 6);
      endDate.setHours(23, 59, 59, 999);

      const dailyBreakdown: DailySummary[] = [];
      let totalTrades = 0;
      let totalBuyTrades = 0;
      let totalSellTrades = 0;
      let totalRealizedPnL = 0;
      let totalFees = 0;
      let totalWinningTrades = 0;
      let totalClosedTrades = 0;
      let weekLargestWin = 0;
      let weekLargestLoss = 0;
      let totalVolume = 0;

      for (let i = 0; i < 7; i++) {
        const currentDate = new Date(startDate);
        currentDate.setDate(currentDate.getDate() + i);
        
        const daySummary = await this.getDailySummary(portfolioId, currentDate);
        dailyBreakdown.push(daySummary);
        
        totalTrades += daySummary.tradesExecuted;
        totalBuyTrades += daySummary.buyTrades;
        totalSellTrades += daySummary.sellTrades;
        totalRealizedPnL += daySummary.realizedPnL;
        totalFees += daySummary.feesPaid;
        totalVolume += daySummary.totalVolume;
        
        weekLargestWin = Math.max(weekLargestWin, daySummary.largestWin);
        weekLargestLoss = Math.max(weekLargestLoss, daySummary.largestLoss);
        
        if (daySummary.tradesExecuted > 0) {
          totalWinningTrades += (daySummary.winRate / 100) * daySummary.tradesExecuted;
          totalClosedTrades += daySummary.tradesExecuted;
        }
      }

      const winRate = totalClosedTrades > 0 ? (totalWinningTrades / totalClosedTrades) * 100 : 0;

      return {
        weekStart: startDate.toISOString().split('T')[0],
        weekEnd: endDate.toISOString().split('T')[0],
        tradesExecuted: totalTrades,
        buyTrades: totalBuyTrades,
        sellTrades: totalSellTrades,
        realizedPnL: totalRealizedPnL,
        feesPaid: totalFees,
        winRate,
        largestWin: weekLargestWin,
        largestLoss: weekLargestLoss,
        totalVolume,
        dailyBreakdown,
      };
    } catch (error) {
      console.error('Error calculating weekly summary:', error);
      const startDate = weekStartDate || this.getWeekStart(new Date());
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 6);
      
      return {
        weekStart: startDate.toISOString().split('T')[0],
        weekEnd: endDate.toISOString().split('T')[0],
        tradesExecuted: 0,
        buyTrades: 0,
        sellTrades: 0,
        realizedPnL: 0,
        feesPaid: 0,
        winRate: 0,
        largestWin: 0,
        largestLoss: 0,
        totalVolume: 0,
        dailyBreakdown: [],
      };
    }
  }

  async getCurrentExposure(portfolioId: string): Promise<ExposureMetrics> {
    try {
      const portfolio = await storage.getPortfolio(portfolioId);
      if (!portfolio) {
        throw new Error(`Portfolio ${portfolioId} not found`);
      }

      const positions = await storage.getPositionsByPortfolio(portfolioId);
      const activePositions = positions.filter(p => parseFloat(p.amount) > 0);

      const cashBalance = parseFloat(portfolio.cashBalance || '0');
      let totalPositionValue = 0;
      let largestPositionValue = 0;
      let largestPositionSymbol = '';

      const positionDetails: Array<{
        tokenId: string;
        symbol: string;
        value: number;
        percentOfPortfolio: number;
      }> = [];

      for (const position of activePositions) {
        const posValue = parseFloat(position.currentValue || '0');
        totalPositionValue += posValue;

        if (posValue > largestPositionValue) {
          largestPositionValue = posValue;
          const token = await storage.getToken(position.tokenId);
          largestPositionSymbol = token?.symbol || 'Unknown';
        }

        const token = await storage.getToken(position.tokenId);
        positionDetails.push({
          tokenId: position.tokenId,
          symbol: token?.symbol || 'Unknown',
          value: posValue,
          percentOfPortfolio: 0,
        });
      }

      const portfolioValue = cashBalance + totalPositionValue;
      const cashAllocationPercent = portfolioValue > 0 ? (cashBalance / portfolioValue) * 100 : 100;
      const positionAllocationPercent = portfolioValue > 0 ? (totalPositionValue / portfolioValue) * 100 : 0;
      const concentrationRisk = portfolioValue > 0 ? (largestPositionValue / portfolioValue) * 100 : 0;

      positionDetails.forEach(pos => {
        pos.percentOfPortfolio = portfolioValue > 0 ? (pos.value / portfolioValue) * 100 : 0;
      });

      const diversificationScore = this.calculateDiversificationScore(
        activePositions.length,
        concentrationRisk
      );

      return {
        totalPositionValue,
        cashBalance,
        portfolioValue,
        cashAllocationPercent,
        positionAllocationPercent,
        largestPositionValue,
        largestPositionSymbol,
        concentrationRisk,
        numberOfOpenPositions: activePositions.length,
        diversificationScore,
        positions: positionDetails,
      };
    } catch (error) {
      console.error('Error calculating exposure metrics:', error);
      return {
        totalPositionValue: 0,
        cashBalance: 0,
        portfolioValue: 0,
        cashAllocationPercent: 100,
        positionAllocationPercent: 0,
        largestPositionValue: 0,
        largestPositionSymbol: '',
        concentrationRisk: 0,
        numberOfOpenPositions: 0,
        diversificationScore: 0,
        positions: [],
      };
    }
  }

  async getRealizedProfits(portfolioId: string, timeframe: 'daily' | 'weekly' | 'monthly' | 'all-time'): Promise<RealizedProfitsMetrics> {
    try {
      const allTrades = await storage.getTradesByPortfolio(portfolioId);
      const closedTrades = allTrades.filter(t => t.closedAt && t.realizedPnL);

      const { startDate, endDate } = this.getTimeframeRange(timeframe);
      
      const filteredTrades = closedTrades.filter(trade => {
        const tradeDate = new Date(trade.closedAt || '');
        return tradeDate >= startDate && tradeDate <= endDate;
      });

      let totalRealizedPnL = 0;
      let totalGains = 0;
      let totalLosses = 0;
      let gainsCount = 0;
      let lossesCount = 0;

      const dailyProfits = new Map<string, number>();

      for (const trade of filteredTrades) {
        const pnl = parseFloat(trade.realizedPnL || '0');
        totalRealizedPnL += pnl;

        const tradeDate = new Date(trade.closedAt || '').toISOString().split('T')[0];
        dailyProfits.set(tradeDate, (dailyProfits.get(tradeDate) || 0) + pnl);

        if (pnl > 0) {
          totalGains += pnl;
          gainsCount++;
        } else if (pnl < 0) {
          totalLosses += Math.abs(pnl);
          lossesCount++;
        }
      }

      const averageGain = gainsCount > 0 ? totalGains / gainsCount : 0;
      const averageLoss = lossesCount > 0 ? totalLosses / lossesCount : 0;

      const sortedDates = Array.from(dailyProfits.keys()).sort();
      const cumulativeProfitChart: Array<{ date: string; cumulativeProfit: number }> = [];
      let cumulative = 0;

      for (const date of sortedDates) {
        cumulative += dailyProfits.get(date) || 0;
        cumulativeProfitChart.push({
          date,
          cumulativeProfit: cumulative,
        });
      }

      let bestDay = { date: '', profit: 0 };
      let worstDay = { date: '', loss: 0 };

      for (const date of Array.from(dailyProfits.keys())) {
        const profit = dailyProfits.get(date) || 0;
        if (profit > bestDay.profit) {
          bestDay = { date, profit };
        }
        if (profit < worstDay.loss) {
          worstDay = { date, loss: profit };
        }
      }

      return {
        timeframe,
        totalRealizedPnL,
        totalGains,
        totalLosses,
        gainsCount,
        lossesCount,
        averageGain,
        averageLoss,
        cumulativeProfitChart,
        bestTradingDay: bestDay,
        worstTradingDay: worstDay,
      };
    } catch (error) {
      console.error('Error calculating realized profits:', error);
      return {
        timeframe,
        totalRealizedPnL: 0,
        totalGains: 0,
        totalLosses: 0,
        gainsCount: 0,
        lossesCount: 0,
        averageGain: 0,
        averageLoss: 0,
        cumulativeProfitChart: [],
        bestTradingDay: { date: '', profit: 0 },
        worstTradingDay: { date: '', loss: 0 },
      };
    }
  }

  async getDrawdownMetrics(portfolioId: string): Promise<DrawdownMetrics> {
    try {
      const portfolio = await storage.getPortfolio(portfolioId);
      if (!portfolio) {
        throw new Error(`Portfolio ${portfolioId} not found`);
      }

      const allTrades = await storage.getTradesByPortfolio(portfolioId);
      const closedTrades = allTrades.filter(t => t.closedAt).sort((a, b) => 
        new Date(a.closedAt || '').getTime() - new Date(b.closedAt || '').getTime()
      );

      const startingCapital = parseFloat(portfolio.startingCapital || '10000');
      const positions = await storage.getPositionsByPortfolio(portfolioId);
      const cashBalance = parseFloat(portfolio.cashBalance || '0');
      
      let currentPositionsValue = 0;
      for (const position of positions) {
        if (parseFloat(position.amount) > 0) {
          currentPositionsValue += parseFloat(position.currentValue || '0');
        }
      }
      const currentValue = cashBalance + currentPositionsValue;

      const portfolioHistory: Array<{ date: string; value: number }> = [];
      let runningValue = startingCapital;

      portfolioHistory.push({
        date: portfolio.createdAt?.toISOString().split('T')[0] || new Date().toISOString().split('T')[0],
        value: startingCapital,
      });

      for (const trade of closedTrades) {
        runningValue += parseFloat(trade.realizedPnL || '0');
        portfolioHistory.push({
          date: new Date(trade.closedAt || '').toISOString().split('T')[0],
          value: runningValue,
        });
      }

      if (portfolioHistory[portfolioHistory.length - 1]?.value !== currentValue) {
        portfolioHistory.push({
          date: new Date().toISOString().split('T')[0],
          value: currentValue,
        });
      }

      let portfolioPeak = startingCapital;
      let maxDrawdown = 0;
      let maxDrawdownPercent = 0;
      let currentDrawdown = 0;
      let currentDrawdownPercent = 0;
      let drawdownStart: string | null = null;
      let maxDrawdownStart: string | null = null;
      let maxDrawdownEnd: string | null = null;
      let recoveryTime: number | null = null;

      const drawdownChart: Array<{ date: string; value: number; drawdownPercent: number }> = [];

      for (const point of portfolioHistory) {
        if (point.value > portfolioPeak) {
          portfolioPeak = point.value;
          if (drawdownStart && currentDrawdown < 0) {
            drawdownStart = null;
          }
        }

        const drawdown = point.value - portfolioPeak;
        const drawdownPercent = portfolioPeak > 0 ? (drawdown / portfolioPeak) * 100 : 0;

        drawdownChart.push({
          date: point.date,
          value: point.value,
          drawdownPercent,
        });

        if (drawdown < maxDrawdown) {
          maxDrawdown = drawdown;
          maxDrawdownPercent = drawdownPercent;
          maxDrawdownStart = drawdownStart;
          maxDrawdownEnd = point.date;
        }

        if (drawdown < 0 && !drawdownStart) {
          drawdownStart = point.date;
        }
      }

      currentDrawdown = currentValue - portfolioPeak;
      currentDrawdownPercent = portfolioPeak > 0 ? (currentDrawdown / portfolioPeak) * 100 : 0;

      if (maxDrawdownStart && maxDrawdownEnd) {
        const start = new Date(maxDrawdownStart);
        const end = new Date(maxDrawdownEnd);
        recoveryTime = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
      }

      const drawdownDuration = drawdownStart 
        ? Math.floor((new Date().getTime() - new Date(drawdownStart).getTime()) / (1000 * 60 * 60 * 24))
        : 0;

      return {
        currentDrawdown,
        currentDrawdownPercent,
        maxDrawdown,
        maxDrawdownPercent,
        drawdownDuration,
        recoveryTime,
        portfolioPeak,
        currentValue,
        drawdownChart,
      };
    } catch (error) {
      console.error('Error calculating drawdown metrics:', error);
      return {
        currentDrawdown: 0,
        currentDrawdownPercent: 0,
        maxDrawdown: 0,
        maxDrawdownPercent: 0,
        drawdownDuration: 0,
        recoveryTime: null,
        portfolioPeak: 10000,
        currentValue: 10000,
        drawdownChart: [],
      };
    }
  }

  async calculateRiskScore(portfolioId: string): Promise<RiskScore> {
    try {
      const [exposure, drawdown] = await Promise.all([
        this.getCurrentExposure(portfolioId),
        this.getDrawdownMetrics(portfolioId),
      ]);

      const concentrationScore = this.scoreConcentration(exposure.concentrationRisk);
      const drawdownScore = this.scoreDrawdown(Math.abs(drawdown.maxDrawdownPercent));
      const exposureScore = this.scoreExposure(exposure.positionAllocationPercent);
      
      const allTrades = await storage.getTradesByPortfolio(portfolioId);
      const recentTrades = allTrades.slice(0, 20);
      const volatilityScore = this.scoreVolatility(recentTrades);

      const overallScore = Math.round(
        (concentrationScore * 0.3) +
        (drawdownScore * 0.3) +
        (volatilityScore * 0.2) +
        (exposureScore * 0.2)
      );

      let riskLevel: 'Low' | 'Medium' | 'High';
      if (overallScore <= 33) {
        riskLevel = 'Low';
      } else if (overallScore <= 66) {
        riskLevel = 'Medium';
      } else {
        riskLevel = 'High';
      }

      return {
        overallScore,
        riskLevel,
        concentrationScore,
        drawdownScore,
        volatilityScore,
        exposureScore,
        factors: {
          concentration: this.getConcentrationDescription(concentrationScore),
          drawdown: this.getDrawdownDescription(drawdownScore),
          volatility: this.getVolatilityDescription(volatilityScore),
          exposure: this.getExposureDescription(exposureScore),
        },
      };
    } catch (error) {
      console.error('Error calculating risk score:', error);
      return {
        overallScore: 50,
        riskLevel: 'Medium',
        concentrationScore: 50,
        drawdownScore: 50,
        volatilityScore: 50,
        exposureScore: 50,
        factors: {
          concentration: 'Moderate concentration',
          drawdown: 'Moderate drawdown',
          volatility: 'Moderate volatility',
          exposure: 'Moderate exposure',
        },
      };
    }
  }

  async generateFullReport(portfolioId: string, period: 'daily' | 'weekly' | 'monthly'): Promise<FullRiskReport> {
    try {
      let summary: DailySummary | WeeklySummary;
      
      if (period === 'daily') {
        summary = await this.getDailySummary(portfolioId);
      } else if (period === 'weekly') {
        summary = await this.getWeeklySummary(portfolioId);
      } else {
        const monthStart = new Date();
        monthStart.setDate(1);
        monthStart.setHours(0, 0, 0, 0);
        summary = await this.getWeeklySummary(portfolioId, monthStart);
      }

      const [exposure, realizedProfits, drawdown, riskScore] = await Promise.all([
        this.getCurrentExposure(portfolioId),
        this.getRealizedProfits(portfolioId, period === 'daily' ? 'daily' : period === 'weekly' ? 'weekly' : 'monthly'),
        this.getDrawdownMetrics(portfolioId),
        this.calculateRiskScore(portfolioId),
      ]);

      return {
        portfolioId,
        period,
        generatedAt: new Date().toISOString(),
        summary,
        exposure,
        realizedProfits,
        drawdown,
        riskScore,
      };
    } catch (error) {
      console.error('Error generating full report:', error);
      throw error;
    }
  }

  private getWeekStart(date: Date): Date {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const weekStart = new Date(d.setDate(diff));
    weekStart.setHours(0, 0, 0, 0);
    return weekStart;
  }

  private getTimeframeRange(timeframe: 'daily' | 'weekly' | 'monthly' | 'all-time'): { startDate: Date; endDate: Date } {
    const endDate = new Date();
    endDate.setHours(23, 59, 59, 999);
    let startDate = new Date();
    
    switch (timeframe) {
      case 'daily':
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'weekly':
        startDate = this.getWeekStart(new Date());
        break;
      case 'monthly':
        startDate.setDate(1);
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'all-time':
        startDate = new Date(0);
        break;
    }
    
    return { startDate, endDate };
  }

  private calculateDiversificationScore(numberOfPositions: number, concentrationRisk: number): number {
    if (numberOfPositions === 0) return 0;
    
    const positionScore = Math.min(numberOfPositions * 10, 50);
    const concentrationScore = Math.max(0, 50 - concentrationRisk);
    
    return Math.min(100, positionScore + concentrationScore);
  }

  private scoreConcentration(concentrationPercent: number): number {
    if (concentrationPercent < 20) return 10;
    if (concentrationPercent < 40) return 30;
    if (concentrationPercent < 60) return 60;
    if (concentrationPercent < 80) return 80;
    return 100;
  }

  private scoreDrawdown(drawdownPercent: number): number {
    if (drawdownPercent < 5) return 10;
    if (drawdownPercent < 10) return 25;
    if (drawdownPercent < 20) return 50;
    if (drawdownPercent < 30) return 75;
    return 100;
  }

  private scoreExposure(exposurePercent: number): number {
    if (exposurePercent < 50) return 20;
    if (exposurePercent < 70) return 40;
    if (exposurePercent < 85) return 60;
    if (exposurePercent < 95) return 80;
    return 100;
  }

  private scoreVolatility(recentTrades: Trade[]): number {
    if (recentTrades.length < 5) return 50;
    
    const pnls = recentTrades
      .filter(t => t.realizedPnL)
      .map(t => parseFloat(t.realizedPnL || '0'));
    
    if (pnls.length === 0) return 50;
    
    const mean = pnls.reduce((a, b) => a + b, 0) / pnls.length;
    const variance = pnls.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / pnls.length;
    const stdDev = Math.sqrt(variance);
    
    const coefficientOfVariation = mean !== 0 ? Math.abs(stdDev / mean) * 100 : 50;
    
    if (coefficientOfVariation < 20) return 20;
    if (coefficientOfVariation < 40) return 40;
    if (coefficientOfVariation < 60) return 60;
    if (coefficientOfVariation < 80) return 80;
    return 100;
  }

  private getConcentrationDescription(score: number): string {
    if (score <= 20) return 'Well diversified portfolio';
    if (score <= 40) return 'Moderate concentration risk';
    if (score <= 60) return 'Elevated concentration risk';
    if (score <= 80) return 'High concentration risk';
    return 'Critical concentration risk';
  }

  private getDrawdownDescription(score: number): string {
    if (score <= 20) return 'Minimal drawdown';
    if (score <= 40) return 'Moderate drawdown';
    if (score <= 60) return 'Significant drawdown';
    if (score <= 80) return 'Severe drawdown';
    return 'Critical drawdown';
  }

  private getVolatilityDescription(score: number): string {
    if (score <= 30) return 'Low volatility';
    if (score <= 50) return 'Moderate volatility';
    if (score <= 70) return 'High volatility';
    return 'Extreme volatility';
  }

  private getExposureDescription(score: number): string {
    if (score <= 30) return 'Conservative exposure';
    if (score <= 50) return 'Balanced exposure';
    if (score <= 70) return 'Aggressive exposure';
    return 'Extreme exposure';
  }
}

export const riskReportsService = new RiskReportsService();
