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

interface CoinbaseTickerMessage {
  type: 'ticker';
  product_id: string; // Symbol (e.g., "BTC-USD")
  price: string;
  volume_24h: string;
  high_24h: string;
  low_24h: string;
  open_24h: string;
  time: string;
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
 * Uses multiple exchange WebSocket APIs with auto-fallback:
 * 1. Coinbase WebSocket (primary - reliable, no geo-blocking)
 * 2. Binance WebSocket (fallback if Coinbase unavailable)
 * 
 * Provides sub-second latency for all tracked tokens.
 */
class StreamingPriceGateway extends EventEmitter {
  private isRunning = false;
  private connections = new Map<string, WebSocket>();
  private reconnectTimeouts = new Map<string, NodeJS.Timeout>();
  private readonly COINBASE_WS_BASE = 'wss://ws-feed.exchange.coinbase.com';
  private readonly BINANCE_WS_BASE = 'wss://stream.binance.com:9443/stream';
  private readonly RECONNECT_DELAY = 5000; // 5 seconds
  private readonly MAX_SYMBOLS_PER_CONNECTION = 200;
  private currentProvider: 'coinbase' | 'binance' = 'coinbase'; // Start with Coinbase
  
  // Symbol mapping for Coinbase: CoinGecko ID -> Coinbase product ID
  private readonly COINBASE_SYMBOL_MAP: Record<string, string> = {
    'bitcoin': 'BTC-USD',
    'ethereum': 'ETH-USD',
    'ripple': 'XRP-USD',
    'cardano': 'ADA-USD',
    'solana': 'SOL-USD',
    'polkadot': 'DOT-USD',
    'dogecoin': 'DOGE-USD',
    'avalanche-2': 'AVAX-USD',
    'shiba-inu': 'SHIB-USD',
    'matic-network': 'MATIC-USD',
    'litecoin': 'LTC-USD',
    'uniswap': 'UNI-USD',
    'chainlink': 'LINK-USD',
    'near': 'NEAR-USD',
    'stellar': 'XLM-USD',
    'internet-computer': 'ICP-USD',
    'aptos': 'APT-USD',
    'the-graph': 'GRT-USD',
    'apecoin': 'APE-USD',
    'aave': 'AAVE-USD',
    'eos': 'EOS-USD',
    'filecoin': 'FIL-USD',
    'sandbox': 'SAND-USD',
    'decentraland': 'MANA-USD',
    'axie-infinity': 'AXS-USD',
    'maker': 'MKR-USD',
    'sui': 'SUI-USD',
    'arbitrum': 'ARB-USD',
    'optimism': 'OP-USD',
    'injective-protocol': 'INJ-USD',
    'sei-network': 'SEI-USD',
    'render-token': 'RENDER-USD',
  };
  
  // Symbol mapping for Binance: CoinGecko ID -> Binance trading pair
  private readonly BINANCE_SYMBOL_MAP: Record<string, string> = {
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
  
  private getSymbolMap() {
    return this.currentProvider === 'coinbase' ? this.COINBASE_SYMBOL_MAP : this.BINANCE_SYMBOL_MAP;
  }
  
  private async buildTokenCache() {
    console.log('🔍 Building token ID cache...');
    
    // Get all tracked tokens from database
    const tokens = await storage.getAllTokens();
    
    const symbolMap = this.getSymbolMap();
    
    for (const token of tokens) {
      const tokenSymbolLower = token.symbol.toLowerCase();
      
      // Direct mapping attempts
      for (const [cgId, exchangeSymbol] of Object.entries(symbolMap)) {
        if (cgId.includes(tokenSymbolLower) || tokenSymbolLower.includes(cgId.split('-')[0])) {
          this.tokenIdCache.set(exchangeSymbol, token.id);
          console.log(`  📊 Mapped ${token.symbol} (${token.id}) -> ${exchangeSymbol}`);
          break;
        }
      }
    }
    
    console.log(`✅ Cached ${this.tokenIdCache.size} token mappings`);
  }
  
  private async connectToStreams() {
    const symbolMap = this.getSymbolMap();
    const symbols = Object.values(symbolMap);
    
    if (symbols.length === 0) {
      console.warn('⚠️  No symbols to track');
      return;
    }
    
    if (this.currentProvider === 'coinbase') {
      await this.connectToCoinbase(symbols);
    } else {
      await this.connectToBinance(symbols);
    }
  }
  
  private async connectToCoinbase(symbols: string[]) {
    const wsUrl = this.COINBASE_WS_BASE;
    
    console.log(`⚡ Connecting to Coinbase WebSocket for ${symbols.length} symbols...`);
    
    const ws = new WebSocket(wsUrl);
    this.connections.set('coinbase', ws);
    
    ws.on('open', () => {
      console.log('✅ Connected to Coinbase WebSocket - Real-time feeds active');
      
      // Subscribe to ticker channel for all symbols
      const subscribeMessage = {
        type: 'subscribe',
        product_ids: symbols,
        channels: ['ticker']
      };
      ws.send(JSON.stringify(subscribeMessage));
    });
    
    ws.on('message', (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString()) as CoinbaseTickerMessage;
        
        if (message.type === 'ticker' && message.product_id) {
          this.processCoinbaseMessage(message);
        }
      } catch (error) {
        console.error('❌ Error parsing Coinbase message:', error);
      }
    });
    
    ws.on('error', (error) => {
      console.error('❌ Coinbase WebSocket error:', error.message);
      
      // Try Binance as fallback
      if (this.currentProvider === 'coinbase') {
        console.log('⚠️  Switching to Binance as fallback provider...');
        this.currentProvider = 'binance';
        this.reconnectToProvider();
      }
    });
    
    ws.on('close', () => {
      console.log('⚠️  Coinbase WebSocket connection closed - attempting reconnect...');
      this.reconnectToProvider();
    });
  }
  
  private async connectToBinance(symbols: string[]) {
    // Binance allows multiple symbols in one stream
    // Format: btcusdt@miniTicker/ethusdt@miniTicker/...
    const streams = symbols.map(s => `${s.toLowerCase()}@miniTicker`).join('/');
    const wsUrl = `${this.BINANCE_WS_BASE}?streams=${streams}`;
    
    console.log(`⚡ Connecting to Binance WebSocket for ${symbols.length} symbols...`);
    
    const ws = new WebSocket(wsUrl);
    this.connections.set('binance', ws);
    
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
      console.warn('⚠️  Binance WebSocket connection closed - attempting reconnect...');
      this.connections.delete('binance');
      
      if (this.isRunning) {
        this.reconnectToProvider();
      }
    });
  }
  
  private reconnectToProvider() {
    if (!this.isRunning) return;
    
    const timeout = setTimeout(async () => {
      console.log(`🔄 Reconnecting to ${this.currentProvider}...`);
      
      // Clear old connections
      this.connections.forEach((ws) => ws.close());
      this.connections.clear();
      
      // Rebuild cache and reconnect
      await this.buildTokenCache();
      await this.connectToStreams();
    }, this.RECONNECT_DELAY);
    
    this.reconnectTimeouts.set(this.currentProvider, timeout);
  }
  
  private processCoinbaseMessage(message: CoinbaseTickerMessage) {
    const symbol = message.product_id; // e.g., "BTC-USD"
    const tokenId = this.tokenIdCache.get(symbol);
    
    if (!tokenId) {
      // Token not in our database, skip
      return;
    }
    
    const currentPrice = parseFloat(message.price);
    const openPrice = parseFloat(message.open_24h);
    const change24h = openPrice > 0 ? ((currentPrice - openPrice) / openPrice) * 100 : 0;
    
    const update: StreamPriceUpdate = {
      tokenId,
      symbol: symbol.split('-')[0], // Convert BTC-USD -> BTC
      price: currentPrice,
      volume: parseFloat(message.volume_24h),
      change24h,
      high24h: parseFloat(message.high_24h),
      low24h: parseFloat(message.low_24h),
      timestamp: new Date(message.time).getTime(),
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
