import cron from 'node-cron';
import { emailService } from './email-service.js';
import type { IStorage } from '../storage.js';

export class SchedulerService {
  private jobs: cron.ScheduledTask[] = [];
  private storage: IStorage;

  constructor(storage: IStorage) {
    this.storage = storage;
  }

  startDailyEmailScheduler(): void {
    // Schedule daily performance reports for 9:00 AM UTC
    const dailyEmailJob = cron.schedule('0 9 * * *', async () => {
      console.log('📧 [SCHEDULER] Starting daily performance report emails...');
      
      try {
        const users = await this.storage.getAllUsers();
        let sentCount = 0;
        let errorCount = 0;

        for (const user of users) {
          try {
            if (!user.email) {
              console.log(`⚠️  [SCHEDULER] Skipping user ${user.id} - no email`);
              continue;
            }

            const portfolio = await this.storage.getPortfolioByUserId(user.id);
            if (!portfolio) {
              console.log(`⚠️  [SCHEDULER] Skipping user ${user.email} - no portfolio`);
              continue;
            }

            const positions = await this.storage.getActivePositionsByPortfolio(portfolio.id);
            const trades = await this.storage.getTradesByPortfolio(portfolio.id);
            
            const totalTrades = trades.length;
            const winningTrades = trades.filter(t => {
              const pnl = parseFloat(t.profitLoss || "0");
              return pnl > 0;
            }).length;
            const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;

            const metrics = {
              totalValue: parseFloat(portfolio.totalValue || "0"),
              dailyPnL: parseFloat(portfolio.dailyPnL || "0"),
              dailyPnLPercent: parseFloat(portfolio.dailyPnL || "0") / parseFloat(portfolio.totalValue || "1") * 100,
              totalPnL: parseFloat(portfolio.totalPnL || "0"),
              totalPnLPercent: parseFloat(portfolio.totalPnL || "0") / 10000 * 100,
              winRate: winRate,
              totalTrades: totalTrades,
              activePositions: positions.length
            };

            await emailService.sendDailyPerformanceReport(
              {
                email: user.email,
                firstName: user.firstName || undefined,
                subscriptionTier: user.subscriptionTier || undefined
              },
              metrics
            );

            sentCount++;
            console.log(`✅ [SCHEDULER] Sent performance report to ${user.email}`);

          } catch (userError) {
            errorCount++;
            console.error(`❌ [SCHEDULER] Failed to send email to ${user.email}:`, userError);
          }
        }

        console.log(`📧 [SCHEDULER] Daily email batch complete: ${sentCount} sent, ${errorCount} errors`);
      } catch (error) {
        console.error('❌ [SCHEDULER] Fatal error in daily email job:', error);
      }
    }, {
      scheduled: true,
      timezone: "UTC"
    });

    this.jobs.push(dailyEmailJob);
    console.log('✅ Daily email scheduler started (9:00 AM UTC)');
  }

  stopAllJobs(): void {
    this.jobs.forEach(job => job.stop());
    console.log('⏸️  All scheduled jobs stopped');
  }
}
