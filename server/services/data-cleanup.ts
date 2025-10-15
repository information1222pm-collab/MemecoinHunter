import { db } from '../db';
import { priceHistory, patterns, trades, scanAlerts, auditLog } from '@shared/schema';
import { lt, sql } from 'drizzle-orm';

class DataCleanupService {
  private cleanupInterval?: NodeJS.Timeout;
  private isRunning = false;

  start() {
    if (this.isRunning) return;
    
    this.isRunning = true;
    console.log('🧹 Data Cleanup Service started');
    
    // Run cleanup immediately
    this.runCleanup();
    
    // Then run cleanup every 6 hours
    this.cleanupInterval = setInterval(() => {
      this.runCleanup();
    }, 6 * 60 * 60 * 1000); // 6 hours
  }

  stop() {
    if (!this.isRunning) return;
    
    this.isRunning = false;
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    console.log('🛑 Data Cleanup Service stopped');
  }

  private async runCleanup() {
    try {
      console.log('🧹 Starting data cleanup...');
      
      // Clean up old price history (keep only last 14 days)
      const priceHistoryDeleted = await this.cleanPriceHistory();
      
      // Clean up old scan alerts (keep only last 30 days)
      const scanAlertsDeleted = await this.cleanScanAlerts();
      
      // Clean up old audit logs (keep only last 90 days)
      const auditLogsDeleted = await this.cleanAuditLogs();
      
      // Clean up orphaned patterns (patterns not referenced by any trade, older than 7 days)
      const orphanedPatternsDeleted = await this.cleanOrphanedPatterns();
      
      console.log(`✅ Data cleanup complete:
        - Price history: ${priceHistoryDeleted} records deleted
        - Scan alerts: ${scanAlertsDeleted} records deleted
        - Audit logs: ${auditLogsDeleted} records deleted
        - Orphaned patterns: ${orphanedPatternsDeleted} records deleted`);
        
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
        console.log('🗑️ Forced garbage collection');
      }
    } catch (error) {
      console.error('❌ Error during data cleanup:', error);
    }
  }

  private async cleanPriceHistory(): Promise<number> {
    try {
      // Keep only last 14 days of price history
      const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
      
      const result = await db
        .delete(priceHistory)
        .where(lt(priceHistory.timestamp, fourteenDaysAgo));
      
      return result.rowCount || 0;
    } catch (error) {
      console.error('Error cleaning price history:', error);
      return 0;
    }
  }

  private async cleanScanAlerts(): Promise<number> {
    try {
      // Keep only last 30 days of scan alerts
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      
      const result = await db
        .delete(scanAlerts)
        .where(lt(scanAlerts.createdAt, thirtyDaysAgo));
      
      return result.rowCount || 0;
    } catch (error) {
      console.error('Error cleaning scan alerts:', error);
      return 0;
    }
  }

  private async cleanAuditLogs(): Promise<number> {
    try {
      // Keep only last 90 days of audit logs
      const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
      
      const result = await db
        .delete(auditLog)
        .where(lt(auditLog.timestamp, ninetyDaysAgo));
      
      return result.rowCount || 0;
    } catch (error) {
      console.error('Error cleaning audit logs:', error);
      return 0;
    }
  }

  private async cleanOrphanedPatterns(): Promise<number> {
    try {
      // Delete patterns older than 7 days that are not referenced by any trade
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      
      const result = await db.execute(sql`
        DELETE FROM patterns 
        WHERE detected_at < ${sevenDaysAgo}
        AND id NOT IN (SELECT DISTINCT pattern_id FROM trades WHERE pattern_id IS NOT NULL)
      `);
      
      return result.rowCount || 0;
    } catch (error) {
      console.error('Error cleaning orphaned patterns:', error);
      return 0;
    }
  }
}

export const dataCleanupService = new DataCleanupService();
