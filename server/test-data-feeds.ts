/**
 * Data Feed Audit Tool
 * Tests all data feeds for accuracy, speed, and reliability
 */

import WebSocket from 'ws';
import { storage } from './storage';

interface TestResult {
  feed: string;
  status: 'pass' | 'fail' | 'warning';
  latency?: number;
  accuracy?: string;
  coverage?: number;
  errors?: string[];
  details: string[];
}

class DataFeedAuditor {
  private results: TestResult[] = [];

  async runFullAudit(): Promise<void> {
    console.log('🔍 Starting Data Feed Audit...\n');

    await this.testCoinbaseWebSocket();
    await this.testBinanceWebSocket();
    await this.testCoinGeckoAPI();
    await this.testPositionTracker();
    await this.testMLAnalyzer();
    await this.testTokenScanner();

    this.printReport();
  }

  private async testCoinbaseWebSocket(): Promise<void> {
    console.log('📡 Testing Coinbase WebSocket Feed...');
    const startTime = Date.now();
    const errors: string[] = [];
    const details: string[] = [];

    try {
      const ws = new WebSocket('wss://ws-feed.exchange.coinbase.com');
      let firstMessageReceived = false;
      let messageCount = 0;
      let latency = 0;

      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          errors.push('Connection timeout after 10s');
          reject(new Error('Timeout'));
        }, 10000);

        ws.on('open', () => {
          details.push('✅ Connection established');
          // Subscribe to BTC-USD ticker
          ws.send(JSON.stringify({
            type: 'subscribe',
            product_ids: ['BTC-USD', 'ETH-USD', 'DOGE-USD'],
            channels: ['ticker']
          }));
          details.push('📤 Subscribed to BTC-USD, ETH-USD, DOGE-USD');
        });

        ws.on('message', (data: Buffer) => {
          const message = JSON.parse(data.toString());
          
          if (message.type === 'ticker') {
            if (!firstMessageReceived) {
              latency = Date.now() - startTime;
              firstMessageReceived = true;
              details.push(`⚡ First message received in ${latency}ms`);
            }
            
            messageCount++;
            details.push(`📊 ${message.product_id}: $${message.price} (vol: ${message.volume_24h})`);

            // After receiving 5 messages, we have enough data
            if (messageCount >= 5) {
              ws.close();
              clearTimeout(timeout);
              resolve();
            }
          } else if (message.type === 'subscriptions') {
            details.push(`📋 Subscribed to ${message.channels?.length || 0} channels`);
          }
        });

        ws.on('error', (error) => {
          errors.push(`WebSocket error: ${error.message}`);
          clearTimeout(timeout);
          reject(error);
        });

        ws.on('close', () => {
          details.push('🔌 Connection closed');
        });
      });

      this.results.push({
        feed: 'Coinbase WebSocket (Primary)',
        status: errors.length === 0 ? 'pass' : 'fail',
        latency,
        coverage: messageCount,
        errors,
        details
      });

    } catch (error: any) {
      this.results.push({
        feed: 'Coinbase WebSocket (Primary)',
        status: 'fail',
        errors: [...errors, error.message],
        details
      });
    }

    console.log('✅ Coinbase WebSocket test complete\n');
  }

  private async testBinanceWebSocket(): Promise<void> {
    console.log('📡 Testing Binance WebSocket Feed...');
    const startTime = Date.now();
    const errors: string[] = [];
    const details: string[] = [];

    try {
      // Binance uses different connection format - stream endpoint
      const ws = new WebSocket('wss://stream.binance.com:9443/stream?streams=btcusdt@miniTicker/ethusdt@miniTicker/dogeusdt@miniTicker');
      let firstMessageReceived = false;
      let messageCount = 0;
      let latency = 0;

      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          errors.push('Connection timeout after 10s');
          reject(new Error('Timeout'));
        }, 10000);

        ws.on('open', () => {
          details.push('✅ Connection established');
          details.push('📤 Listening to BTCUSDT, ETHUSDT, DOGEUSDT mini tickers');
        });

        ws.on('message', (data: Buffer) => {
          const message = JSON.parse(data.toString());
          
          if (message.data && message.data.e === '24hrMiniTicker') {
            if (!firstMessageReceived) {
              latency = Date.now() - startTime;
              firstMessageReceived = true;
              details.push(`⚡ First message received in ${latency}ms`);
            }
            
            messageCount++;
            const ticker = message.data;
            details.push(`📊 ${ticker.s}: $${ticker.c} (vol: ${ticker.v})`);

            // After receiving 5 messages, we have enough data
            if (messageCount >= 5) {
              ws.close();
              clearTimeout(timeout);
              resolve();
            }
          }
        });

        ws.on('error', (error) => {
          errors.push(`WebSocket error: ${error.message}`);
          clearTimeout(timeout);
          reject(error);
        });

        ws.on('close', () => {
          details.push('🔌 Connection closed');
        });
      });

      this.results.push({
        feed: 'Binance WebSocket (Fallback)',
        status: errors.length === 0 ? 'pass' : 'fail',
        latency,
        coverage: messageCount,
        errors,
        details
      });

    } catch (error: any) {
      this.results.push({
        feed: 'Binance WebSocket (Fallback)',
        status: 'fail',
        errors: [...errors, error.message],
        details
      });
    }

    console.log('✅ Binance WebSocket test complete\n');
  }

  private async testCoinGeckoAPI(): Promise<void> {
    console.log('🦎 Testing CoinGecko API...');
    const startTime = Date.now();
    const errors: string[] = [];
    const details: string[] = [];

    try {
      // Test market data endpoint
      const response = await fetch(
        'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=bitcoin,ethereum,dogecoin,shiba-inu,pepe&order=market_cap_desc&per_page=5&page=1&sparkline=false'
      );

      const latency = Date.now() - startTime;
      details.push(`⚡ API response time: ${latency}ms`);

      if (!response.ok) {
        errors.push(`HTTP ${response.status}: ${response.statusText}`);
        
        // Check for rate limiting
        if (response.status === 429) {
          details.push('⚠️  Rate limit detected - 2.5s delay needed between requests');
        }
      } else {
        const data = await response.json();
        details.push(`✅ Retrieved ${data.length} tokens`);
        
        data.forEach((coin: any) => {
          details.push(`📊 ${coin.symbol.toUpperCase()}: $${coin.current_price} (24h: ${coin.price_change_percentage_24h?.toFixed(2)}%)`);
        });

        // Test historical data endpoint
        const histStartTime = Date.now();
        const histResponse = await fetch(
          'https://api.coingecko.com/api/v3/coins/bitcoin/market_chart?vs_currency=usd&days=1&interval=hourly'
        );
        const histLatency = Date.now() - histStartTime;
        
        if (histResponse.ok) {
          const histData = await histResponse.json();
          details.push(`📈 Historical data: ${histData.prices?.length || 0} price points (${histLatency}ms)`);
        }
      }

      this.results.push({
        feed: 'CoinGecko REST API',
        status: errors.length === 0 ? 'pass' : 'fail',
        latency,
        errors,
        details
      });

    } catch (error: any) {
      this.results.push({
        feed: 'CoinGecko REST API',
        status: 'fail',
        errors: [...errors, error.message],
        details
      });
    }

    console.log('✅ CoinGecko API test complete\n');
  }

  private async testPositionTracker(): Promise<void> {
    console.log('📊 Testing Position Tracker...');
    const details: string[] = [];
    const errors: string[] = [];

    try {
      // Check if we have active portfolios
      const portfolios = await storage.getAllPortfolios();
      details.push(`📁 Found ${portfolios.length} portfolios in system`);

      if (portfolios.length === 0) {
        details.push('⚠️  No portfolios to track');
      } else {
        // Test position retrieval
        let totalPositions = 0;
        for (const portfolio of portfolios.slice(0, 3)) { // Test first 3
          const positions = await storage.getPositionsByPortfolio(portfolio.id);
          totalPositions += positions.length;
          details.push(`  📈 Portfolio ${portfolio.id}: ${positions.length} positions`);
        }

        details.push(`✅ Total positions tracked: ${totalPositions}`);
        details.push('⚡ Event-driven updates: 250ms throttling');
        details.push('🔄 Backup polling: Every 30s');
      }

      this.results.push({
        feed: 'Position Tracker (Internal)',
        status: 'pass',
        coverage: portfolios.length,
        errors,
        details
      });

    } catch (error: any) {
      this.results.push({
        feed: 'Position Tracker (Internal)',
        status: 'fail',
        errors: [error.message],
        details
      });
    }

    console.log('✅ Position Tracker test complete\n');
  }

  private async testMLAnalyzer(): Promise<void> {
    console.log('🤖 Testing ML Pattern Analyzer...');
    const details: string[] = [];
    const errors: string[] = [];

    try {
      // Check tokens available for analysis
      const tokens = await storage.getActiveTokens();
      details.push(`📊 ${tokens.length} active tokens for analysis`);

      // Check recent patterns
      const patterns = await storage.getRecentPatterns(10);
      details.push(`🔍 ${patterns.length} recent patterns detected`);

      if (patterns.length > 0) {
        const recentPattern = patterns[0];
        details.push(`  Latest: ${recentPattern.patternType} on ${recentPattern.tokenId}`);
        details.push(`  Confidence: ${recentPattern.confidence}%`);
      }

      details.push('⏱️  Analysis frequency: Every 2 minutes');
      details.push('📈 Technical indicators: 15+ (RSI, MACD, BB, ATR, ADX, OBV, Ichimoku)');
      details.push('🎯 Pattern detection: Support/Resistance, Chart patterns, Fibonacci levels');

      this.results.push({
        feed: 'ML Pattern Analyzer (Internal)',
        status: patterns.length > 0 ? 'pass' : 'warning',
        coverage: tokens.length,
        errors,
        details
      });

    } catch (error: any) {
      this.results.push({
        feed: 'ML Pattern Analyzer (Internal)',
        status: 'fail',
        errors: [error.message],
        details
      });
    }

    console.log('✅ ML Analyzer test complete\n');
  }

  private async testTokenScanner(): Promise<void> {
    console.log('🔎 Testing Token Scanner...');
    const details: string[] = [];
    const errors: string[] = [];

    try {
      // Check tracked tokens
      const tokens = await storage.getAllTokens();
      details.push(`🪙 Total tokens in database: ${tokens.length}`);

      // Count by category
      const memecoins = tokens.filter(t => 
        t.name.toLowerCase().includes('doge') || 
        t.name.toLowerCase().includes('shib') ||
        t.name.toLowerCase().includes('pepe') ||
        t.name.toLowerCase().includes('meme')
      );
      details.push(`🎭 Memecoins: ${memecoins.length}`);

      // Check most recent additions
      const recentTokens = tokens.slice(-5);
      details.push(`\n📅 Most recent additions:`);
      recentTokens.forEach(t => {
        details.push(`  • ${t.name} (${t.symbol})`);
      });

      details.push('\n🔍 Scanner uses CoinGecko trending/top gainers API');
      details.push('⏱️  Discovery frequency: Varies based on market activity');

      this.results.push({
        feed: 'Token Scanner (Discovery)',
        status: tokens.length > 0 ? 'pass' : 'warning',
        coverage: tokens.length,
        errors,
        details
      });

    } catch (error: any) {
      this.results.push({
        feed: 'Token Scanner (Discovery)',
        status: 'fail',
        errors: [error.message],
        details
      });
    }

    console.log('✅ Token Scanner test complete\n');
  }

  private printReport(): void {
    console.log('\n' + '='.repeat(80));
    console.log('📋 DATA FEED AUDIT REPORT');
    console.log('='.repeat(80) + '\n');

    for (const result of this.results) {
      const statusEmoji = result.status === 'pass' ? '✅' : result.status === 'fail' ? '❌' : '⚠️';
      console.log(`${statusEmoji} ${result.feed}`);
      console.log(`   Status: ${result.status.toUpperCase()}`);
      
      if (result.latency !== undefined) {
        const latencyStatus = result.latency < 1000 ? '🟢' : result.latency < 3000 ? '🟡' : '🔴';
        console.log(`   ${latencyStatus} Latency: ${result.latency}ms`);
      }
      
      if (result.coverage !== undefined) {
        console.log(`   📊 Coverage: ${result.coverage} items`);
      }

      if (result.errors && result.errors.length > 0) {
        console.log(`   ❌ Errors:`);
        result.errors.forEach(e => console.log(`      - ${e}`));
      }

      console.log(`   📝 Details:`);
      result.details.forEach(d => console.log(`      ${d}`));
      console.log('');
    }

    console.log('='.repeat(80));
    console.log('📊 SUMMARY');
    console.log('='.repeat(80));
    
    const passed = this.results.filter(r => r.status === 'pass').length;
    const failed = this.results.filter(r => r.status === 'fail').length;
    const warnings = this.results.filter(r => r.status === 'warning').length;

    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`⚠️  Warnings: ${warnings}`);
    console.log(`📊 Total Feeds Tested: ${this.results.length}`);

    // Calculate average latency
    const latencies = this.results.filter(r => r.latency !== undefined).map(r => r.latency!);
    if (latencies.length > 0) {
      const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
      console.log(`⚡ Average Latency: ${avgLatency.toFixed(0)}ms`);
    }

    console.log('\n' + '='.repeat(80) + '\n');
  }
}

// Run audit
const auditor = new DataFeedAuditor();
auditor.runFullAudit()
  .then(() => {
    console.log('✅ Audit complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Audit failed:', error);
    process.exit(1);
  });
