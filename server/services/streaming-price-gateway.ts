import { EventEmitter } from 'events';
import WebSocket from 'ws';
import { storage } from '../storage';

interface BinanceMiniTicker {
  e: '24hrMiniTicker';
  E: number; // Event time
  s: string; // Symbol (e.g., "BTCUSDT")
  c: string; // Last price
  o: string; // Open price
  h: string; // High price
  l: string; // Low price
  v: string; // Total traded base asset volume
  q: string; // Total traded quote asset volume
}

interface StreamPriceUpdate {
  tokenId: string;
  symbol: string;
  price: number;
  volume: number;
  change24h: number;
  high24h: number;
  low24h: number;
  timestamp: number;
}

/**
 * Streaming Price Gateway - Real-time price feeds with <1s latency
 * 
 * Uses Binance WebSocket API for instant price updates instead of polling.
 * Provides sub-second latency for all tracked tokens.
 */
class StreamingPriceGateway extends EventEmitter {
  private isRunning = false;
  private connections = new Map<string, WebSocket>();
  private reconnectTimeouts = new Map<string, NodeJS.Timeout>();
  private readonly BINANCE_WS_BASE = 'wss://stream.binance.com:9443/stream';
  private readonly RECONNECT_DELAY = 5000; // 5 seconds
  private readonly MAX_SYMBOLS_PER_CONNECTION = 200; // Binance limit
  
  // Symbol mapping: CoinGecko ID -> Binance trading pair
  private readonly SYMBOL_MAP: Record<string, string> = {
    'bitcoin': 'BTCUSDT',
    'ethereum': 'ETHUSDT',
    'binancecoin': 'BNBUSDT',
    'ripple': 'XRPUSDT',
    'cardano': 'ADAUSDT',
    'solana': 'SOLUSDT',
    'polkadot': 'DOTUSDT',
    'dogecoin': 'DOGEUSDT',
    'avalanche-2': 'AVAXUSDT',
    'shiba-inu': 'SHIBUSDT',
    'matic-network': 'MATICUSDT',
    'litecoin': 'LTCUSDT',
    'uniswap': 'UNIUSDT',
    'chainlink': 'LINKUSDT',
    'tron': 'TRXUSDT',
    'near': 'NEARUSDT',
    'monero': 'XMRUSDT',
    'ethereum-classic': 'ETCUSDT',
    'stellar': 'XLMUSDT',
    'internet-computer': 'ICPUSDT',
    'aptos': 'APTUSDT',
    'hedera-hashgraph': 'HBARUSDT',
    'cronos': 'CROUSDT',
    'the-graph': 'GRTUSDT',
    'apecoin': 'APEUSDT',
    'aave': 'AAVEUSDT',
    'eos': 'EOSUSDT',
    'filecoin': 'FILUSDT',
    'sandbox': 'SANDUSDT',
    'decentraland': 'MANAUSDT',
    'axie-infinity': 'AXSUSDT',
    'theta-token': 'THETAUSDT',
    'maker': 'MKRUSDT',
    'pancakeswap-token': 'CAKEUSDT',
    'pepe': 'PEPEUSDT',
    'floki': 'FLOKIUSDT',
    'bonk': 'BONKUSDT',
    'worldcoin-wld': 'WLDUSDT',
    'pendle': 'PENDLEUSDT',
    'sui': 'SUIUSDT',
    'arbitrum': 'ARBUSDT',
    'optimism': 'OPUSDT',
    'injective-protocol': 'INJUSDT',
    'sei-network': 'SEIUSDT',
    'render-token': 'RENDERUSDT',
  };
  
  // Token ID cache for reverse lookup (symbol -> tokenId)
  private tokenIdCache = new Map<string, string>();
  private priceCache = new Map<string, StreamPriceUpdate>();
  
  async start() {
    if (this.isRunning) {
      console.log('⚡ Streaming Price Gateway already running');
      return;
    }
    
    this.isRunning = true;
    console.log('⚡ Starting Streaming Price Gateway...');
    
    // Build token ID cache from database
    await this.buildTokenCache();
    
    // Start WebSocket connections
    await this.connectToStreams();
    
    console.log('✅ Streaming Price Gateway started - <1s latency active');
  }
  
  stop() {
    if (!this.isRunning) return;
    
    console.log('⚡ Stopping Streaming Price Gateway...');
    this.isRunning = false;
    
    // Close all WebSocket connections
    this.connections.forEach((ws, symbol) => {
      ws.close();
    });
    this.connections.clear();
    
    // Clear reconnect timeouts
    this.reconnectTimeouts.forEach((timeout) => clearTimeout(timeout));
    this.reconnectTimeouts.clear();
    
    console.log('✅ Streaming Price Gateway stopped');
  }
  
  private async buildTokenCache() {
    console.log('🔍 Building token ID cache...');
    
    // Get all tracked tokens from database
    const tokens = await storage.getAllTokens();
    
    // Create reverse lookup: token symbol -> coingecko ID for matching
    const symbolToCoinGecko: Record<string, string> = {};
    for (const [cgId, binanceSymbol] of Object.entries(this.SYMBOL_MAP)) {
      symbolToCoinGecko[cgId] = cgId;
    }
    
    for (const token of tokens) {
      // Try to find matching Binance symbol by looking up common mappings
      // This is a simplified approach - match by symbol name
      const tokenSymbolLower = token.symbol.toLowerCase();
      
      // Direct mapping attempts
      for (const [cgId, binanceSymbol] of Object.entries(this.SYMBOL_MAP)) {
        if (cgId.includes(tokenSymbolLower) || tokenSymbolLower.includes(cgId.split('-')[0])) {
          this.tokenIdCache.set(binanceSymbol, token.id);
          console.log(`  📊 Mapped ${token.symbol} (${token.id}) -> ${binanceSymbol}`);
          break;
        }
      }
    }
    
    console.log(`✅ Cached ${this.tokenIdCache.size} token mappings`);
  }
  
  private async connectToStreams() {
    const symbols = Object.values(this.SYMBOL_MAP);
    
    if (symbols.length === 0) {
      console.warn('⚠️  No symbols to track');
      return;
    }
    
    // Binance allows multiple symbols in one stream
    // Format: btcusdt@miniTicker/ethusdt@miniTicker/...
    const streams = symbols.map(s => `${s.toLowerCase()}@miniTicker`).join('/');
    const wsUrl = `${this.BINANCE_WS_BASE}?streams=${streams}`;
    
    console.log(`⚡ Connecting to Binance WebSocket for ${symbols.length} symbols...`);
    
    const ws = new WebSocket(wsUrl);
    this.connections.set('combined', ws);
    
    ws.on('open', () => {
      console.log('✅ Connected to Binance WebSocket - Real-time feeds active');
    });
    
    ws.on('message', (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString());
        
        // Binance combined stream format: { stream: "btcusdt@miniTicker", data: {...} }
        if (message.data && message.data.e === '24hrMiniTicker') {
          this.handlePriceUpdate(message.data as BinanceMiniTicker);
        }
      } catch (error) {
        console.error('❌ Error parsing WebSocket message:', error);
      }
    });
    
    ws.on('error', (error) => {
      console.error('❌ WebSocket error:', error.message);
    });
    
    ws.on('close', () => {
      console.warn('⚠️  WebSocket connection closed - attempting reconnect...');
      this.connections.delete('combined');
      
      if (this.isRunning) {
        // Reconnect after delay
        const timeout = setTimeout(() => {
          this.connectToStreams();
        }, this.RECONNECT_DELAY);
        this.reconnectTimeouts.set('combined', timeout);
      }
    });
  }
  
  private handlePriceUpdate(ticker: BinanceMiniTicker) {
    const symbol = ticker.s; // e.g., "BTCUSDT"
    const tokenId = this.tokenIdCache.get(symbol);
    
    if (!tokenId) {
      // Token not in our database, skip
      return;
    }
    
    const currentPrice = parseFloat(ticker.c);
    const openPrice = parseFloat(ticker.o);
    const change24h = openPrice > 0 ? ((currentPrice - openPrice) / openPrice) * 100 : 0;
    
    const update: StreamPriceUpdate = {
      tokenId,
      symbol: symbol.replace('USDT', ''), // Convert BTCUSDT -> BTC
      price: currentPrice,
      volume: parseFloat(ticker.v),
      change24h,
      high24h: parseFloat(ticker.h),
      low24h: parseFloat(ticker.l),
      timestamp: ticker.E,
    };
    
    // Cache the update
    this.priceCache.set(tokenId, update);
    
    // Emit to listeners (will be broadcast via WebSocket)
    this.emit('priceUpdate', update);
    
    // Update database asynchronously (non-blocking)
    this.updateDatabase(update).catch(err => {
      console.error(`❌ Database update failed for ${symbol}:`, err.message);
    });
  }
  
  private async updateDatabase(update: StreamPriceUpdate) {
    try {
      // Update token price
      await storage.updateToken(update.tokenId, {
        currentPrice: update.price.toString(),
        volume24h: update.volume.toString(),
        priceChange24h: update.change24h.toString(),
      });
      
      // Store price history for ML analysis
      await storage.createPriceHistory({
        tokenId: update.tokenId,
        price: update.price.toString(),
        volume: update.volume.toString(),
      });
    } catch (error) {
      // Database errors shouldn't stop the stream
      throw error;
    }
  }
  
  /**
   * Get cached price for a token (instant, no database query)
   */
  getCachedPrice(tokenId: string): StreamPriceUpdate | null {
    return this.priceCache.get(tokenId) || null;
  }
  
  /**
   * Get all cached prices (instant, no database query)
   */
  getAllCachedPrices(): StreamPriceUpdate[] {
    return Array.from(this.priceCache.values());
  }
}

export const streamingPriceGateway = new StreamingPriceGateway();
