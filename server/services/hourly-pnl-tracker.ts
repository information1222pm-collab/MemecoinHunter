import { storage } from '../storage';
import type { InsertHourlyPnL } from '@shared/schema';

class HourlyPnLTracker {
  private trackingIntervalId: NodeJS.Timeout | null = null;
  private portfolioSnapshots = new Map<string, { equity: number; hour: Date }>();
  
  start() {
    console.log('📊 Starting Hourly PnL Tracker...');
    
    this.captureSnapshots();
    
    this.trackingIntervalId = setInterval(() => {
      this.captureSnapshots();
    }, 60 * 60 * 1000);
    
    console.log('✅ Hourly PnL Tracker started - tracking every hour');
  }
  
  stop() {
    if (this.trackingIntervalId) {
      clearInterval(this.trackingIntervalId);
      this.trackingIntervalId = null;
      console.log('🛑 Hourly PnL Tracker stopped');
    }
  }
  
  private async captureSnapshots() {
    try {
      const now = new Date();
      const currentHour = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), 0, 0, 0);
      
      const portfolios = await storage.getAutoTradingPortfolios();
      
      for (const portfolio of portfolios) {
        const portfolioId = portfolio.id;
        const currentEquity = parseFloat(portfolio.totalValue || '10000');
        
        const snapshot = this.portfolioSnapshots.get(portfolioId);
        
        if (snapshot && snapshot.hour.getTime() < currentHour.getTime()) {
          const hourlyPnL = currentEquity - snapshot.equity;
          
          const oneHourAgo = new Date(currentHour.getTime() - 60 * 60 * 1000);
          const trades = await storage.getPortfolioTrades(portfolioId, oneHourAgo, currentHour);
          
          const wins = trades.filter(t => 
            t.type === 'sell' && parseFloat(t.realizedPnL || '0') > 0
          ).length;
          
          const losses = trades.filter(t => 
            t.type === 'sell' && parseFloat(t.realizedPnL || '0') < 0
          ).length;
          
          const sellTrades = trades.filter(t => t.type === 'sell' && t.realizedPnL);
          const totalReturn = sellTrades.reduce((sum, t) => sum + parseFloat(t.realizedPnL || '0'), 0);
          
          const avgReturn = sellTrades.length > 0 ? totalReturn / sellTrades.length : 0;
          
          const hourlyData: InsertHourlyPnL = {
            portfolioId,
            hour: snapshot.hour,
            startingEquity: snapshot.equity.toFixed(2),
            endingEquity: currentEquity.toFixed(2),
            hourlyPnL: hourlyPnL.toFixed(2),
            trades: trades.length,
            wins,
            losses,
            averageReturn: avgReturn.toFixed(4),
          };
          
          await storage.createHourlyPnL(hourlyData);
          
          const targetHourly = 100;
          const performanceVsTarget = ((hourlyPnL / targetHourly) * 100).toFixed(1);
          
          console.log(`💰 HOURLY-PNL [Portfolio ${portfolioId}]: $${hourlyPnL.toFixed(2)} (${performanceVsTarget}% of $${targetHourly} target)`);
          console.log(`   📊 Trades: ${trades.length} | Wins: ${wins} | Losses: ${losses} | Avg Return: $${avgReturn.toFixed(2)}`);
        }
        
        this.portfolioSnapshots.set(portfolioId, {
          equity: currentEquity,
          hour: currentHour,
        });
      }
    } catch (error) {
      console.error('Error capturing hourly PnL snapshots:', error);
    }
  }
  
  async getHourlyPerformance(portfolioId: string, hours: number = 24) {
    return await storage.getHourlyPnL(portfolioId, hours);
  }
  
  async getTodayPerformance(portfolioId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const hourlyData = await storage.getHourlyPnLSince(portfolioId, today);
    
    const totalPnL = hourlyData.reduce((sum, h) => sum + parseFloat(h.hourlyPnL || '0'), 0);
    const totalTrades = hourlyData.reduce((sum, h) => sum + (h.trades || 0), 0);
    const totalWins = hourlyData.reduce((sum, h) => sum + (h.wins || 0), 0);
    const totalLosses = hourlyData.reduce((sum, h) => sum + (h.losses || 0), 0);
    
    const hoursActive = hourlyData.length;
    const avgHourlyPnL = hoursActive > 0 ? totalPnL / hoursActive : 0;
    
    return {
      totalPnL,
      avgHourlyPnL,
      hoursActive,
      totalTrades,
      totalWins,
      totalLosses,
      winRate: totalTrades > 0 ? (totalWins / totalTrades) * 100 : 0,
      targetProgress: (avgHourlyPnL / 100) * 100,
    };
  }
}

export const hourlyPnLTracker = new HourlyPnLTracker();
