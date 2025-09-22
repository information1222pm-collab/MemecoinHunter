import { EventEmitter } from 'events';
import { storage } from '../storage';
import { decryptSensitiveData, logSecurityEvent } from '../utils/security';
import type { 
  ExchangeConfig, InsertExchangeConfig, 
  ExchangeTrade, InsertExchangeTrade,
  ExchangeBalance, InsertExchangeBalance,
  TradingConfig, InsertTradingConfig,
  Trade, Token
} from '@shared/schema';

// Exchange API interfaces for real money trading
export interface ExchangeAPI {
  name: string;
  connect(apiKey: string, apiSecret: string, testMode?: boolean): Promise<boolean>;
  disconnect(): Promise<void>;
  
  // Account & Balance Management
  getBalances(): Promise<ExchangeBalance[]>;
  
  // Trading Operations
  placeBuyOrder(symbol: string, amount: number, price?: number): Promise<ExchangeOrderResponse>;
  placeSellOrder(symbol: string, amount: number, price?: number): Promise<ExchangeOrderResponse>;
  cancelOrder(orderId: string): Promise<boolean>;
  getOrderStatus(orderId: string): Promise<ExchangeOrderStatus>;
  
  // Market Data
  getCurrentPrice(symbol: string): Promise<number>;
  getOrderBook(symbol: string): Promise<OrderBook>;
  
  // Health & Status
  testConnection(): Promise<boolean>;
  getServerTime(): Promise<number>;
}

export interface ExchangeOrderResponse {
  orderId: string;
  status: 'pending' | 'filled' | 'cancelled' | 'failed';
  executedPrice?: number;
  executedAmount?: number;
  fees?: number;
  feeCurrency?: string;
}

export interface ExchangeOrderStatus {
  orderId: string;
  status: 'pending' | 'filled' | 'cancelled' | 'failed';
  executedPrice?: number;
  executedAmount?: number;
  remainingAmount?: number;
  fees?: number;
  timestamp?: number;
}

export interface OrderBook {
  bids: [number, number][]; // [price, amount]
  asks: [number, number][];
  timestamp: number;
}

// Trading signal interface for exchange execution
export interface ExchangeTradingSignal {
  tokenId: string;
  symbol: string;
  type: 'buy' | 'sell';
  amount: number;
  price: number;
  confidence: number;
  source: string;
  patternId?: string;
  portfolioId: string;
}

class ExchangeService extends EventEmitter {
  private exchanges = new Map<string, ExchangeAPI>();
  private isActive = false;
  private healthCheckInterval?: NodeJS.Timeout;
  private orderMonitors = new Map<string, NodeJS.Timeout>();

  async start() {
    if (this.isActive) return;
    
    this.isActive = true;
    console.log('💱 Exchange Service started - Multi-exchange real money trading');
    
    // Initialize configured exchanges
    await this.initializeExchanges();
    
    // Start health monitoring every 5 minutes
    this.healthCheckInterval = setInterval(() => {
      this.performHealthChecks();
    }, 300000);
    
    // Initial health check
    await this.performHealthChecks();
  }

  async stop() {
    if (!this.isActive) return;
    
    this.isActive = false;
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    
    // Disconnect from all exchanges
    const exchanges = Array.from(this.exchanges.values());
    for (const exchange of exchanges) {
      await exchange.disconnect();
    }
    this.exchanges.clear();
    
    console.log('💱 Exchange Service stopped');
  }

  private async initializeExchanges() {
    try {
      // Get all active exchange configurations
      const configs = await storage.getActiveExchangeConfigs();
      
      for (const config of configs) {
        try {
          await this.connectExchange(config);
        } catch (error) {
          console.error(`❌ Failed to connect to ${config.exchangeName}:`, error);
        }
      }
      
      console.log(`💱 Connected to ${this.exchanges.size} exchanges`);
    } catch (error) {
      console.error('❌ Failed to initialize exchanges:', error);
    }
  }

  private async connectExchange(config: ExchangeConfig): Promise<void> {
    try {
      // Get API key details
      const apiKey = await storage.getApiKey(config.apiKeyId!);
      if (!apiKey) {
        throw new Error(`API key not found: ${config.apiKeyId}`);
      }

      // SECURITY: Decrypt API keys before use
      const decryptedApiKey = decryptSensitiveData(apiKey.encryptedApiKey);
      const decryptedApiSecret = decryptSensitiveData(apiKey.encryptedApiSecret);
      
      // AUDIT: Log exchange connection attempt
      await logSecurityEvent({
        action: 'exchange_connect_attempt',
        resource: 'exchange_service',
        resourceId: config.exchangeName,
        details: { exchangeName: config.exchangeName, testMode: config.testMode },
        success: true
      });

      // Create appropriate exchange API instance
      const exchange = this.createExchangeAPI(config.exchangeName);
      
      // Connect to exchange
      const connected = await exchange.connect(
        decryptedApiKey,
        decryptedApiSecret,
        config.testMode || false
      );
      
      if (connected) {
        this.exchanges.set(config.exchangeName, exchange);
        console.log(`✅ Connected to ${config.exchangeName} (${config.testMode ? 'testnet' : 'live'})`);
        
        // AUDIT: Log successful exchange connection  
        await logSecurityEvent({
          action: 'exchange_connected',
          resource: 'exchange_service', 
          resourceId: config.exchangeName,
          details: { exchangeName: config.exchangeName, testMode: config.testMode },
          success: true
        });
      } else {
        // AUDIT: Log failed connection
        await logSecurityEvent({
          action: 'exchange_connect_failed',
          resource: 'exchange_service',
          resourceId: config.exchangeName, 
          details: { exchangeName: config.exchangeName, error: 'Connection failed' },
          success: false
        });
        throw new Error('Connection failed');
      }
    } catch (error) {
      console.error(`❌ Failed to connect to ${config.exchangeName}:`, error);
      throw error;
    }
  }

  private createExchangeAPI(exchangeName: string): ExchangeAPI {
    switch (exchangeName.toLowerCase()) {
      case 'binance':
        return new BinanceAPI();
      case 'kraken':
        return new KrakenAPI();
      case 'coinbase':
        return new CoinbaseAPI();
      default:
        throw new Error(`Unsupported exchange: ${exchangeName}`);
    }
  }

  // Main trading execution method - transforms paper trades to real money trades
  async executeTradeSignal(signal: ExchangeTradingSignal): Promise<ExchangeTrade | null> {
    try {
      // AUDIT: Log incoming trading signal
      await logSecurityEvent({
        action: 'trade_signal_received',
        resource: 'exchange_service',
        resourceId: signal.tokenId,
        details: { 
          symbol: signal.symbol, 
          type: signal.type, 
          amount: signal.amount, 
          price: signal.price,
          confidence: signal.confidence,
          source: signal.source 
        },
        success: true
      });
      
      // Get user's trading configuration
      const tradingConfig = await storage.getTradingConfigByPortfolio(signal.portfolioId);
      if (!tradingConfig || tradingConfig.tradingMode !== 'real' || !tradingConfig.autoTradingEnabled) {
        console.log(`📄 Trade skipped - Portfolio in paper trading mode`);
        
        // AUDIT: Log trade skipped
        await logSecurityEvent({
          action: 'trade_skipped_paper_mode',
          resource: 'exchange_service',
          resourceId: signal.portfolioId,
          details: { reason: 'Paper trading mode or auto-trading disabled' },
          success: true
        });
        return null;
      }

      // Select best exchange for this trade
      const exchange = this.selectBestExchange(signal.symbol, tradingConfig.enabledExchanges);
      if (!exchange) {
        console.error(`❌ No available exchange for ${signal.symbol}`);
        return null;
      }

      // Execute trade on selected exchange
      let orderResponse: ExchangeOrderResponse;
      if (signal.type === 'buy') {
        orderResponse = await exchange.placeBuyOrder(signal.symbol, signal.amount, signal.price);
      } else {
        orderResponse = await exchange.placeSellOrder(signal.symbol, signal.amount, signal.price);
      }

      // Create exchange trade record
      const exchangeTrade = await storage.createExchangeTrade({
        tradeId: '', // Will be linked after trade is created
        exchangeName: exchange.name,
        exchangeOrderId: orderResponse.orderId,
        status: orderResponse.status,
        requestedPrice: signal.price.toString(),
        requestedAmount: signal.amount.toString(),
        executedPrice: orderResponse.executedPrice?.toString(),
        executedAmount: orderResponse.executedAmount?.toString(),
        fees: orderResponse.fees?.toString(),
        feeCurrency: orderResponse.feeCurrency,
        executionTime: orderResponse.status === 'filled' ? new Date() : undefined,
      });

      // AUDIT: Log successful order placement
      await logSecurityEvent({
        action: `real_money_${signal.type}_order_placed`,
        resource: 'exchange_service',
        resourceId: exchangeTrade.id,
        details: {
          exchangeName: exchange.name,
          orderId: orderResponse.orderId,
          symbol: signal.symbol,
          amount: signal.amount,
          price: signal.price,
          status: orderResponse.status,
          portfolioId: signal.portfolioId
        },
        success: true
      });

      // Start order lifecycle monitoring for non-filled orders
      if (orderResponse.status !== 'filled') {
        this.startOrderMonitoring(exchangeTrade.id, exchange, orderResponse.orderId);
      }

      // Emit success event
      this.emit('tradeExecuted', {
        exchangeTrade,
        signal,
        exchange: exchange.name,
      });

      console.log(`💱 ${signal.type.toUpperCase()} order placed on ${exchange.name}: ${signal.amount} ${signal.symbol} at $${signal.price}`);
      
      return exchangeTrade;
    } catch (error) {
      console.error(`❌ Failed to execute trade signal:`, error);
      
      // Create failed exchange trade record
      await storage.createExchangeTrade({
        tradeId: '',
        exchangeName: 'unknown',
        status: 'failed',
        requestedPrice: signal.price.toString(),
        requestedAmount: signal.amount.toString(),
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      });

      this.emit('tradeError', { signal, error });
      return null;
    }
  }

  private selectBestExchange(symbol: string, enabledExchanges: string[]): ExchangeAPI | null {
    // Priority order for exchange selection
    const priorityOrder = ['binance', 'kraken', 'coinbase'];
    
    for (const exchangeName of priorityOrder) {
      if (enabledExchanges.includes(exchangeName) && this.exchanges.has(exchangeName)) {
        const exchange = this.exchanges.get(exchangeName)!;
        // TODO: Add more sophisticated selection logic (fees, liquidity, etc.)
        return exchange;
      }
    }
    
    return null;
  }

  private async performHealthChecks() {
    const exchanges = Array.from(this.exchanges.entries());
    for (const [name, exchange] of exchanges) {
      try {
        const isHealthy = await exchange.testConnection();
        await storage.updateExchangeHealth(name, isHealthy ? 'healthy' : 'degraded');
        
        if (!isHealthy) {
          console.warn(`⚠️ Exchange ${name} health check failed`);
        }
      } catch (error) {
        console.error(`❌ Health check failed for ${name}:`, error);
        await storage.updateExchangeHealth(name, 'down');
      }
    }
  }

  // Balance synchronization for real money accounts
  async syncExchangeBalances(): Promise<void> {
    const exchanges = Array.from(this.exchanges.entries());
    for (const [name, exchange] of exchanges) {
      try {
        const balances = await exchange.getBalances();
        
        for (const balance of balances) {
          await storage.upsertExchangeBalance({
            exchangeName: name,
            currency: balance.currency,
            available: (balance.available || 0).toString(),
            locked: (balance.locked || 0).toString(),
            total: (balance.total || 0).toString(),
            syncStatus: 'synced',
          });
        }
        
        console.log(`💰 Synced balances for ${name}`);
      } catch (error) {
        console.error(`❌ Failed to sync balances for ${name}:`, error);
      }
    }
  }

  // Get combined balances across all exchanges
  async getTotalBalances(): Promise<Map<string, number>> {
    const totalBalances = new Map<string, number>();
    
    try {
      const allBalances = await storage.getAllExchangeBalances();
      
      for (const balance of allBalances) {
        const current = totalBalances.get(balance.currency) || 0;
        totalBalances.set(balance.currency, current + parseFloat(balance.total));
      }
    } catch (error) {
      console.error('❌ Failed to get total balances:', error);
    }
    
    return totalBalances;
  }

  // Check if real money trading is enabled and properly configured
  async isRealTradingEnabled(portfolioId: string): Promise<boolean> {
    try {
      const config = await storage.getTradingConfigByPortfolio(portfolioId);
      return config?.tradingMode === 'real' && 
             config.autoTradingEnabled && 
             config.realMoneyConfirmed &&
             this.exchanges.size > 0;
    } catch (error) {
      return false;
    }
  }

  getConnectedExchanges(): string[] {
    return Array.from(this.exchanges.keys());
  }

  getExchangeStatus(): { [key: string]: string } {
    const status: { [key: string]: string } = {};
    const exchanges = Array.from(this.exchanges.entries());
    exchanges.forEach(([name]) => {
      status[name] = 'connected';
    });
    return status;
  }
  async isRealTradingEnabled(portfolioId: string): Promise<boolean> {
    try {
      const config = await storage.getTradingConfigByPortfolio(portfolioId);
      return config?.tradingMode === 'real' && 
             config.autoTradingEnabled && 
             config.realMoneyConfirmed &&
             this.exchanges.size > 0;
    } catch (error) {
      console.error('Error checking real trading status:', error);
      return false;
    }
  }

  // Order lifecycle monitoring for real money trades  
  private async startOrderMonitoring(exchangeTradeId: string, exchange: ExchangeAPI, orderId: string) {
    const monitor = async () => {
      try {
        const orderStatus = await exchange.getOrderStatus(orderId);
        
        // Update exchange trade status
        await storage.updateExchangeTrade(exchangeTradeId, {
          status: orderStatus.status,
          executedPrice: orderStatus.executedPrice?.toString(),
          executedAmount: orderStatus.executedAmount?.toString(),
          fees: orderStatus.fees?.toString(),
          executionTime: orderStatus.status === 'filled' ? new Date() : undefined,
        });

        // AUDIT: Log order status update
        await logSecurityEvent({
          action: 'order_status_updated',
          resource: 'exchange_service',
          resourceId: exchangeTradeId,
          details: {
            orderId,
            exchangeName: exchange.name,
            status: orderStatus.status,
            executedPrice: orderStatus.executedPrice,
            executedAmount: orderStatus.executedAmount
          },
          success: true
        });

        // If order completed, stop monitoring and reconcile
        if (orderStatus.status === 'filled' || orderStatus.status === 'cancelled' || orderStatus.status === 'failed') {
          this.stopOrderMonitoring(exchangeTradeId);
          
          if (orderStatus.status === 'filled') {
            // TODO: Update portfolio balances and positions
            await this.reconcileCompletedOrder(exchangeTradeId, orderStatus);
          }
        }
        
      } catch (error) {
        console.error(`❌ Order monitoring failed for ${orderId}:`, error);
        
        // AUDIT: Log monitoring error
        await logSecurityEvent({
          action: 'order_monitoring_error',
          resource: 'exchange_service',
          resourceId: exchangeTradeId,
          details: { orderId, error: error instanceof Error ? error.message : 'Unknown error' },
          success: false
        });
      }
    };

    // Monitor every 30 seconds
    const intervalId = setInterval(monitor, 30000);
    this.orderMonitors.set(exchangeTradeId, intervalId);
    
    // Initial check immediately
    await monitor();
  }

  private stopOrderMonitoring(exchangeTradeId: string) {
    const intervalId = this.orderMonitors.get(exchangeTradeId);
    if (intervalId) {
      clearInterval(intervalId);
      this.orderMonitors.delete(exchangeTradeId);
    }
  }

  private async reconcileCompletedOrder(exchangeTradeId: string, orderStatus: ExchangeOrderStatus) {
    try {
      // TODO: Implement portfolio balance reconciliation
      // This should update portfolio positions and cash balances based on filled orders
      console.log(`💰 Order reconciliation needed for ${exchangeTradeId}`);
      
      // AUDIT: Log reconciliation event
      await logSecurityEvent({
        action: 'order_reconciliation_needed',
        resource: 'exchange_service', 
        resourceId: exchangeTradeId,
        details: { orderStatus },
        success: true
      });
    } catch (error) {
      console.error(`❌ Order reconciliation failed for ${exchangeTradeId}:`, error);
    }
  }
}

// Placeholder exchange API implementations
// These would be replaced with actual exchange SDK integrations

class BinanceAPI implements ExchangeAPI {
  name = 'binance';
  
  async connect(apiKey: string, apiSecret: string, testMode = true): Promise<boolean> {
    // TODO: Implement Binance API connection
    console.log(`🔗 Connecting to Binance ${testMode ? 'testnet' : 'live'}...`);
    return true;
  }
  
  async disconnect(): Promise<void> {
    console.log('🔌 Disconnecting from Binance...');
  }
  
  async getBalances(): Promise<ExchangeBalance[]> {
    // TODO: Implement balance fetching
    return [];
  }
  
  async placeBuyOrder(symbol: string, amount: number, price?: number): Promise<ExchangeOrderResponse> {
    // TODO: Implement buy order placement
    return {
      orderId: `binance_${Date.now()}`,
      status: 'pending',
      executedPrice: price,
      executedAmount: amount,
    };
  }
  
  async placeSellOrder(symbol: string, amount: number, price?: number): Promise<ExchangeOrderResponse> {
    // TODO: Implement sell order placement
    return {
      orderId: `binance_${Date.now()}`,
      status: 'pending',
      executedPrice: price,
      executedAmount: amount,
    };
  }
  
  async cancelOrder(orderId: string): Promise<boolean> {
    return true;
  }
  
  async getOrderStatus(orderId: string): Promise<ExchangeOrderStatus> {
    return {
      orderId,
      status: 'filled',
    };
  }
  
  async getCurrentPrice(symbol: string): Promise<number> {
    return 0;
  }
  
  async getOrderBook(symbol: string): Promise<OrderBook> {
    return { bids: [], asks: [], timestamp: Date.now() };
  }
  
  async testConnection(): Promise<boolean> {
    return true;
  }
  
  async getServerTime(): Promise<number> {
    return Date.now();
  }
}

class KrakenAPI implements ExchangeAPI {
  name = 'kraken';
  
  async connect(apiKey: string, apiSecret: string, testMode = true): Promise<boolean> {
    console.log(`🔗 Connecting to Kraken ${testMode ? 'demo' : 'live'}...`);
    return true;
  }
  
  async disconnect(): Promise<void> {
    console.log('🔌 Disconnecting from Kraken...');
  }
  
  async getBalances(): Promise<ExchangeBalance[]> {
    return [];
  }
  
  async placeBuyOrder(symbol: string, amount: number, price?: number): Promise<ExchangeOrderResponse> {
    return {
      orderId: `kraken_${Date.now()}`,
      status: 'pending',
      executedPrice: price,
      executedAmount: amount,
    };
  }
  
  async placeSellOrder(symbol: string, amount: number, price?: number): Promise<ExchangeOrderResponse> {
    return {
      orderId: `kraken_${Date.now()}`,
      status: 'pending',
      executedPrice: price,
      executedAmount: amount,
    };
  }
  
  async cancelOrder(orderId: string): Promise<boolean> {
    return true;
  }
  
  async getOrderStatus(orderId: string): Promise<ExchangeOrderStatus> {
    return {
      orderId,
      status: 'filled',
    };
  }
  
  async getCurrentPrice(symbol: string): Promise<number> {
    return 0;
  }
  
  async getOrderBook(symbol: string): Promise<OrderBook> {
    return { bids: [], asks: [], timestamp: Date.now() };
  }
  
  async testConnection(): Promise<boolean> {
    return true;
  }
  
  async getServerTime(): Promise<number> {
    return Date.now();
  }
}

class CoinbaseAPI implements ExchangeAPI {
  name = 'coinbase';
  
  async connect(apiKey: string, apiSecret: string, testMode = true): Promise<boolean> {
    console.log(`🔗 Connecting to Coinbase ${testMode ? 'sandbox' : 'live'}...`);
    return true;
  }
  
  async disconnect(): Promise<void> {
    console.log('🔌 Disconnecting from Coinbase...');
  }
  
  async getBalances(): Promise<ExchangeBalance[]> {
    return [];
  }
  
  async placeBuyOrder(symbol: string, amount: number, price?: number): Promise<ExchangeOrderResponse> {
    return {
      orderId: `coinbase_${Date.now()}`,
      status: 'pending',
      executedPrice: price,
      executedAmount: amount,
    };
  }
  
  async placeSellOrder(symbol: string, amount: number, price?: number): Promise<ExchangeOrderResponse> {
    return {
      orderId: `coinbase_${Date.now()}`,
      status: 'pending',
      executedPrice: price,
      executedAmount: amount,
    };
  }
  
  async cancelOrder(orderId: string): Promise<boolean> {
    return true;
  }
  
  async getOrderStatus(orderId: string): Promise<ExchangeOrderStatus> {
    return {
      orderId,
      status: 'filled',
    };
  }
  
  async getCurrentPrice(symbol: string): Promise<number> {
    return 0;
  }
  
  async getOrderBook(symbol: string): Promise<OrderBook> {
    return { bids: [], asks: [], timestamp: Date.now() };
  }
  
  async testConnection(): Promise<boolean> {
    return true;
  }
  
  async getServerTime(): Promise<number> {
    return Date.now();
  }
}

export const exchangeService = new ExchangeService();