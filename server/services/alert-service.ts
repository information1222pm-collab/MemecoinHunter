import { EventEmitter } from 'events';
import { storage } from '../storage';
import type { AlertRule, InsertAlertEvent } from '@shared/schema';

interface PriceUpdate {
  tokenId: string;
  symbol: string;
  price: number;
  volume: number;
  change24h: number;
}

interface AlertTriggerEvent {
  alertId: string;
  tokenSymbol: string;
  tokenId: string;
  conditionType: string;
  triggeredPrice: number;
  triggeredPercent?: number;
  triggeredAt: string;
  userId: string;
}

class AlertService extends EventEmitter {
  private isRunning = false;
  private readonly COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes
  private lastTriggerTimes = new Map<string, number>();

  start() {
    if (this.isRunning) return;
    
    this.isRunning = true;
    console.log('🔔 Alert service started');
  }

  stop() {
    if (!this.isRunning) return;
    
    this.isRunning = false;
    console.log('🛑 Alert service stopped');
  }

  // Called by price-feed service on price updates
  async handlePriceUpdate(update: PriceUpdate) {
    if (!this.isRunning) return;

    try {
      const activeAlerts = await storage.getActiveAlerts();
      
      for (const alert of activeAlerts) {
        // Skip if alert is for a different token
        if (alert.tokenId !== update.tokenId) continue;

        // Check cooldown
        if (this.isInCooldown(alert.id)) continue;

        // Evaluate alert condition
        const shouldTrigger = await this.evaluateAlert(alert, update);
        
        if (shouldTrigger) {
          await this.triggerAlert(alert, update);
        }
      }
    } catch (error) {
      console.error('Error handling price update for alerts:', error);
    }
  }

  private isInCooldown(alertId: string): boolean {
    const lastTrigger = this.lastTriggerTimes.get(alertId);
    if (!lastTrigger) return false;
    
    const elapsed = Date.now() - lastTrigger;
    return elapsed < this.COOLDOWN_MS;
  }

  private async evaluateAlert(alert: AlertRule, update: PriceUpdate): Promise<boolean> {
    const currentPrice = update.price;
    const thresholdValue = parseFloat(alert.thresholdValue);

    switch (alert.conditionType) {
      case 'price_above':
        return currentPrice > thresholdValue;
      
      case 'price_below':
        return currentPrice < thresholdValue;
      
      case 'percent_change_up':
      case 'percent_change_down':
        // For percent change, we use the 24h change from the update
        if (!alert.percentWindow) return false;
        
        const targetPercent = parseFloat(alert.percentWindow);
        const currentPercent = update.change24h;
        
        if (alert.conditionType === 'percent_change_up') {
          return currentPercent >= targetPercent;
        } else {
          return currentPercent <= -targetPercent;
        }
      
      default:
        return false;
    }
  }

  private async triggerAlert(alert: AlertRule, update: PriceUpdate) {
    try {
      // Calculate triggered percent if applicable
      let triggeredPercent: number | undefined;
      if (alert.conditionType.includes('percent_change')) {
        triggeredPercent = update.change24h;
      }

      // Create alert event
      const eventData: InsertAlertEvent = {
        alertId: alert.id,
        triggeredPrice: update.price.toString(),
        triggeredPercent: triggeredPercent?.toString(),
        payload: {
          tokenSymbol: update.symbol,
          volume: update.volume,
          change24h: update.change24h
        }
      };

      await storage.createAlertEvent(eventData);

      // Update last triggered time on the alert
      await storage.updateAlertRule(alert.id, {
        lastTriggeredAt: new Date()
      });

      // Set cooldown
      this.lastTriggerTimes.set(alert.id, Date.now());

      // Emit WebSocket event
      const triggerEvent: AlertTriggerEvent = {
        alertId: alert.id,
        tokenSymbol: update.symbol,
        tokenId: update.tokenId,
        conditionType: alert.conditionType,
        triggeredPrice: update.price,
        triggeredPercent,
        triggeredAt: new Date().toISOString(),
        userId: alert.userId
      };

      this.emit('alert:triggered', triggerEvent);

      console.log(`🔔 Alert triggered: ${alert.conditionType} for ${update.symbol} at $${update.price}`);
    } catch (error) {
      console.error('Error triggering alert:', error);
    }
  }

  // Set broadcaster for WebSocket notifications
  setBroadcaster(broadcaster: (userId: string, message: any) => void) {
    this.on('alert:triggered', (event: AlertTriggerEvent) => {
      broadcaster(event.userId, {
        type: 'alert:triggered',
        data: {
          alertId: event.alertId,
          tokenSymbol: event.tokenSymbol,
          conditionType: event.conditionType,
          triggeredPrice: event.triggeredPrice,
          triggeredPercent: event.triggeredPercent,
          triggeredAt: event.triggeredAt
        }
      });
    });
  }
}

export const alertService = new AlertService();
