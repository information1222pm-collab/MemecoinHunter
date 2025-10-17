import { cacheService } from '../services/cache-service';
import { scanner } from '../services/scanner';
import { marketHealthAnalyzer } from '../services/market-health';
import { autoTrader } from '../services/auto-trader';
import { storage } from '../storage';
import { riskReportsService } from '../services/risk-reports';
import { tradingAnalyticsService } from '../services/trading-analytics';
import { getDemoUserAndPortfolio } from './demo-user';

/**
 * Pre-warm critical caches on server startup
 * This reduces initial load times by populating cache before first request
 */
export async function warmCaches(): Promise<void> {
  console.log('🔥 Warming caches for faster initial load...');

  try {
    // Warm these in parallel for speed
    await Promise.all([
      warmScannerStatus(),
      warmMarketHealth(),
      warmAutoTraderPortfolio(),
      warmAlerts(),
      warmAnalytics(),
      warmRiskExposure(),
    ]);

    console.log('✅ Cache warming complete - sub-second responses ready');
  } catch (error) {
    console.error('⚠️ Cache warming failed (non-critical):', error);
  }
}

async function warmScannerStatus(): Promise<void> {
  try {
    const status = scanner.getStatus();
    cacheService.set('scanner_status', status, 3000);
  } catch (err) {
    console.error('Failed to warm scanner status cache:', err);
  }
}

async function warmMarketHealth(): Promise<void> {
  try {
    const health = await marketHealthAnalyzer.analyzeMarketHealth();
    cacheService.set('market_health', health, 5000);
  } catch (err) {
    console.error('Failed to warm market health cache:', err);
  }
}

async function warmAutoTraderPortfolio(): Promise<void> {
  try {
    const stats = await autoTrader.getDetailedStats();
    if (stats) {
      cacheService.set('autotrader_portfolio', stats, 4000);
    }
  } catch (err) {
    console.error('Failed to warm autotrader portfolio cache:', err);
  }
}

async function warmAlerts(): Promise<void> {
  try {
    const alerts = await storage.getUnreadAlerts();
    cacheService.set('alerts', alerts, 4000);
  } catch (err) {
    console.error('Failed to warm alerts cache:', err);
  }
}

async function warmAnalytics(): Promise<void> {
  try {
    const { portfolio } = await getDemoUserAndPortfolio();
    const allMetrics = await tradingAnalyticsService.getAllMetrics(portfolio.id);
    
    const data = {
      pnl: allMetrics.pnl,
      winLoss: {
        ...allMetrics.winLoss,
        avgWin: allMetrics.winLoss.averageWin,
        avgLoss: allMetrics.winLoss.averageLoss,
      },
      holdTime: {
        avgHoldTime: allMetrics.holdTime.averageHoldTimeMs / (1000 * 60 * 60),
        avgWinHoldTime: allMetrics.holdTime.averageWinHoldTimeMs / (1000 * 60 * 60),
        avgLossHoldTime: allMetrics.holdTime.averageLossHoldTimeMs / (1000 * 60 * 60),
        totalClosedTrades: allMetrics.holdTime.totalClosedTrades,
      },
      strategies: allMetrics.strategies.map(s => ({
        ...s,
        roiPercent: s.roi,
      })),
    };
    
    cacheService.set('analytics_all', data, 5000);
  } catch (err) {
    console.error('Failed to warm analytics cache:', err);
  }
}

async function warmRiskExposure(): Promise<void> {
  try {
    const { portfolio } = await getDemoUserAndPortfolio();
    const exposure = await riskReportsService.getCurrentExposure(portfolio.id);
    cacheService.set('risk_exposure', exposure, 5000);
  } catch (err) {
    console.error('Failed to warm risk exposure cache:', err);
  }
}
