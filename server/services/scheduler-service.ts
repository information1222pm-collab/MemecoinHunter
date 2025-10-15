import * as cron from 'node-cron';
import { emailService } from './email-service.js';

export class SchedulerService {
  private jobs: cron.ScheduledTask[] = [];

  startDailyEmailScheduler(): void {
    // Schedule daily performance reports for 9:00 AM UTC
    const dailyEmailJob = cron.schedule('0 9 * * *', async () => {
      console.log('📧 [SCHEDULER] Starting daily performance report emails...');
      console.log('📧 [SCHEDULER] Daily email job triggered at:', new Date().toISOString());
      
      // For now, just log that the job would run
      // Full email sending implementation will be added once IStorage interface is updated
      console.log('📧 [SCHEDULER] Daily email job complete');
    });

    this.jobs.push(dailyEmailJob);
    console.log('✅ Daily email scheduler started (9:00 AM UTC)');
  }

  stopAllJobs(): void {
    this.jobs.forEach(job => job.stop());
    console.log('⏸️  All scheduled jobs stopped');
  }
}
