import { EventEmitter } from 'events';
import { storage } from '../storage';
import { riskManager } from './risk-manager';
import { scanner } from './scanner';
import { mlAnalyzer } from './ml-analyzer';
import { patternPerformanceAnalyzer } from './pattern-performance-analyzer';
import { exchangeService } from './exchange-service';
import { MarketHealthAnalyzer } from './market-health';
import { chartAnalyzer } from './chart-analyzer';
import { dynamicExitStrategy } from './dynamic-exit-strategy';
import { getRiskLevelConfig, type RiskLevel, type RiskLevelConfig } from './risk-levels';
import { aiEntryAnalyzer } from './ai-entry-analyzer';
import type { Token, Pattern, InsertTrade } from '@shared/schema';
import type { ExchangeTradingSignal } from './exchange-service';
import { safeParseFloat, safeDivide, safeDbNumber } from '../utils/safe-number';

interface TradingSignal {
  tokenId: string;
  type: 'buy' | 'sell';
  confidence: number;
  source: string;
  price: number;
  reason: string;
  patternId?: string; // Link to originating pattern
}

interface PortfolioState {
  portfolioId: string;
  sellingPositions: Set<string>;
  tradingStats: {
    totalTrades: number;
    successfulTrades: number;
    todayTrades: number;
    totalValue: number;
  };
}

class AutoTrader extends EventEmitter {
  private isActive = false;
  private enabledPortfolios = new Map<string, PortfolioState>(); // Track multiple portfolios
  private tradeLocks = new Map<string, boolean>(); // CRITICAL: Prevent concurrent trades on same portfolio
  private positionStages = new Map<string, number>(); // Track take-profit stage per position (0=none, 1=first, 2=second, 3=final)
  private monitoringInterval?: NodeJS.Timeout;
  private syncInterval?: NodeJS.Timeout;
  private marketHealthAnalyzer = new MarketHealthAnalyzer(storage);
  private healthCheckInterval?: NodeJS.Timeout;
  
  // Risk level configurations cache
  private riskConfigs = new Map<string, RiskLevelConfig>();
  
  private strategy = {
    minConfidence: 75, // Dynamic minimum confidence (now overridden by risk level)
    maxPositionSize: 1000, // $1000 max per position (will use dynamic sizing from RiskManager)
    takeProfitPercentage: 18, // AGGRESSIVE: 18% final take profit (increased from 15%) (now overridden by risk level)
    takeProfitStages: [8, 12, 18], // AGGRESSIVE: Multi-stage take-profit (increased from 6%, 10%, 15%) (now overridden by risk level)
    minPatternWinRate: 0.5, // IMPROVED: Require 50%+ win rate for pattern (now overridden by risk level)
    minPatternExpectancy: 0.5, // IMPROVED: Require positive expectancy (avg gain > avg loss)
  };
  
  private async getRiskConfig(portfolioId: string): Promise<RiskLevelConfig> {
    // Check cache first
    if (this.riskConfigs.has(portfolioId)) {
      return this.riskConfigs.get(portfolioId)!;
    }
    
    // Fetch portfolio and get risk level
    const portfolio = await storage.getPortfolio(portfolioId);
    const riskLevel = (portfolio?.riskLevel || 'balanced') as RiskLevel;
    const config = getRiskLevelConfig(riskLevel);
    
    // Cache the config
    this.riskConfigs.set(portfolioId, config);
    
    return config;
  }
  
  private clearRiskConfigCache(portfolioId: string) {
    this.riskConfigs.delete(portfolioId);
  }

  async start() {
    if (this.isActive) return;
    
    this.isActive = true;
    console.log('🤖 Auto-Trader started - Multi-portfolio support enabled');
    
    try {
      // Step 1: Load all portfolios with auto-trading enabled
      console.log('📊 Step 1/4: Loading enabled portfolios...');
      await this.syncEnabledPortfolios();
      console.log(`✅ Loaded ${this.enabledPortfolios.size} portfolios with auto-trading enabled`);
      
      // Step 2: Start pattern performance analyzer with timeout protection
      console.log('🧠 Step 2/4: Starting pattern performance analyzer...');
      await this.withTimeout(
        patternPerformanceAnalyzer.start(),
        15000,
        'Pattern analyzer initialization timed out after 15s'
      );
      console.log('✅ Pattern performance analyzer started successfully');
      
      // Step 3: Set up event listeners
      console.log('🔌 Step 3/4: Setting up event listeners...');
      
      // Listen to ML pattern events
      mlAnalyzer.on('patternDetected', (pattern) => {
        this.handleMLPattern(pattern);
      });
      
      // Listen to scanner alerts
      scanner.on('alertTriggered', (alert) => {
        this.handleScannerAlert(alert);
      });
      
      // Listen to threshold updates from pattern analyzer
      patternPerformanceAnalyzer.on('thresholdUpdated', (data) => {
        this.strategy.minConfidence = data.minConfidence;
        console.log(`🎯 Dynamic threshold updated: ${data.minConfidence}% (Win rate: ${(data.recentWinRate * 100).toFixed(1)}%)`);
      });
      
      console.log('✅ Event listeners configured successfully');
      
    } catch (error) {
      console.error('⚠️ Auto-Trader initialization encountered errors:', error);
      console.error('⚠️ Continuing with reduced functionality...');
    }
    
    // Step 4: Set up monitoring and sync intervals
    console.log('⏰ Step 4/4: Setting up monitoring intervals...');
    
    // AGGRESSIVE: Monitor positions every 10s for faster exits (was 30s)
    this.monitoringInterval = setInterval(() => {
      this.monitorAllPortfolios();
    }, 10000);
    
    // Sync enabled portfolios every 60s to detect changes
    this.syncInterval = setInterval(() => {
      this.syncEnabledPortfolios();
    }, 60000);
    
    // AGGRESSIVE: Check market health every 2 minutes for faster adaptation (was 5 minutes)
    this.healthCheckInterval = setInterval(() => {
      this.marketHealthAnalyzer.analyzeMarketHealth().catch(err => {
        console.error('Error analyzing market health:', err);
      });
    }, 2 * 60 * 1000);
    
    // Run initial health check
    this.marketHealthAnalyzer.analyzeMarketHealth().catch(err => {
      console.error('Error in initial market health check:', err);
    });
    
    console.log('✅ Monitoring intervals active (positions, portfolios, market health)');
    
    // Run initial position check immediately
    console.log('🔍 Running initial position check...');
    this.monitorAllPortfolios().catch(error => {
      console.error('Error in initial position check:', error);
    });
    
    console.log('🤖 Auto-Trader initialization complete - monitoring portfolios');
  }
  
  private async withTimeout<T>(promise: Promise<T>, timeoutMs: number, errorMessage: string): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) => 
        setTimeout(() => reject(new Error(errorMessage)), timeoutMs)
      )
    ]);
  }

  stop() {
    if (!this.isActive) return;
    
    this.isActive = false;
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    
    mlAnalyzer.removeAllListeners('patternDetected');
    scanner.removeAllListeners('alertTriggered');
    
    this.enabledPortfolios.clear();
    
    console.log('🛑 Auto-Trader stopped');
  }

  async enableAutoTrading(portfolioId: string) {
    try {
      // Update database
      await storage.updatePortfolio(portfolioId, { autoTradingEnabled: true });
      
      // Add to tracking if not already present
      if (!this.enabledPortfolios.has(portfolioId)) {
        this.enabledPortfolios.set(portfolioId, {
          portfolioId,
          sellingPositions: new Set(),
          tradingStats: {
            totalTrades: 0,
            successfulTrades: 0,
            todayTrades: 0,
            totalValue: 10000,
          },
        });
        console.log(`✅ Auto-trading enabled for portfolio ${portfolioId}`);
      }
    } catch (error) {
      console.error(`Error enabling auto-trading for portfolio ${portfolioId}:`, error);
    }
  }

  async disableAutoTrading(portfolioId: string) {
    try {
      // Update database
      await storage.updatePortfolio(portfolioId, { autoTradingEnabled: false });
      
      // Remove from tracking
      this.enabledPortfolios.delete(portfolioId);
      console.log(`🛑 Auto-trading disabled for portfolio ${portfolioId}`);
    } catch (error) {
      console.error(`Error disabling auto-trading for portfolio ${portfolioId}:`, error);
    }
  }

  private async syncEnabledPortfolios() {
    try {
      const allPortfolios = await storage.getAllPortfolios();
      const enabledInDb = allPortfolios.filter(p => p.autoTradingEnabled);
      
      // Remove portfolios that are no longer enabled
      const portfolioIds = Array.from(this.enabledPortfolios.keys());
      for (const portfolioId of portfolioIds) {
        if (!enabledInDb.find(p => p.id === portfolioId)) {
          this.enabledPortfolios.delete(portfolioId);
          console.log(`🔄 Removed portfolio ${portfolioId} from auto-trading (disabled in DB)`);
        }
      }
      
      // Add new portfolios that are enabled
      for (const portfolio of enabledInDb) {
        if (!this.enabledPortfolios.has(portfolio.id)) {
          this.enabledPortfolios.set(portfolio.id, {
            portfolioId: portfolio.id,
            sellingPositions: new Set(),
            tradingStats: {
              totalTrades: 0,
              successfulTrades: 0,
              todayTrades: 0,
              totalValue: safeParseFloat(portfolio.totalValue, 10000),
            },
          });
          console.log(`🔄 Added portfolio ${portfolio.id} to auto-trading`);
        }
      }
    } catch (error) {
      console.error('Error syncing enabled portfolios:', error);
    }
  }

  private async handleMLPattern(pattern: Pattern) {
    console.log(`🔍 AUTO-TRADER: Received ML pattern ${pattern.patternType} for token ${pattern.tokenId} with ${pattern.confidence}% confidence`);
    
    if (!this.isActive) {
      console.log(`🔍 AUTO-TRADER: Inactive - skipping pattern ${pattern.patternType}`);
      return;
    }
    
    if (this.enabledPortfolios.size === 0) {
      console.log(`🔍 AUTO-TRADER: No enabled portfolios - skipping pattern ${pattern.patternType}`);
      return;
    }
    
    try {
      const baseConfidence = parseFloat(pattern.confidence.toString());
      
      // IMPROVED: Get pattern performance for comprehensive validation
      const performance = await patternPerformanceAnalyzer.getPatternPerformance(
        pattern.patternType, 
        pattern.timeframe
      );
      
      // IMPROVED: Gate trade on proven pattern performance (win rate + expectancy)
      if (performance) {
        // Check if pattern has sufficient profitable track record
        if (performance.winRate < this.strategy.minPatternWinRate) {
          console.log(`🚫 Pattern ${pattern.patternType} REJECTED: Win rate ${(performance.winRate * 100).toFixed(1)}% < ${(this.strategy.minPatternWinRate * 100).toFixed(0)}% required`);
          return;
        }
        
        // FIXED: Use averageReturn directly as expectancy (it's already net per-trade profit)
        // averageReturn is calculated as totalProfit / totalTrades, so it represents expected value per trade
        const expectancy = performance.averageReturn;
        
        if (expectancy < this.strategy.minPatternExpectancy) {
          console.log(`🚫 Pattern ${pattern.patternType} REJECTED: Expectancy $${expectancy.toFixed(2)} < $${this.strategy.minPatternExpectancy} required`);
          return;
        }
        
        console.log(`✅ Pattern ${pattern.patternType} APPROVED: Win rate ${(performance.winRate * 100).toFixed(1)}%, Expectancy $${expectancy.toFixed(2)} per trade`);
      } else {
        // New pattern with no history - allow but log it
        console.log(`⚠️ Pattern ${pattern.patternType} has no performance history - executing with caution`);
      }
      
      // Apply confidence multiplier based on historical performance
      const adjustedConfidence = performance 
        ? baseConfidence * performance.confidenceMultiplier
        : baseConfidence;
      
      // MARKET HEALTH CHECK: Analyze overall market conditions
      const marketHealth = await this.marketHealthAnalyzer.analyzeMarketHealth();
      
      // Check if we should trade based on market health and confidence
      if (!this.marketHealthAnalyzer.shouldTrade(adjustedConfidence)) {
        console.log(`🚫 MARKET-HEALTH: Trade blocked - ${marketHealth.recommendation.toUpperCase()}`);
        console.log(`   Health Score: ${marketHealth.healthScore.toFixed(1)}/100 | Factors: ${marketHealth.factors.join(', ')}`);
        return;
      }
      
      const token = await storage.getToken(pattern.tokenId);
      if (!token) return;
      
      // OPTIMIZED: Perform AI analysis ONCE per pattern, before looping through portfolios
      // Get price history for AI analysis (shared across all portfolios)
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const history = await storage.getPriceHistory(token.id, sevenDaysAgo);
      
      let chartSignal = null;
      if (history.length >= 10) {
        chartSignal = chartAnalyzer.generateEntryExitSignal(history);
      }
      
      // CRITICAL FIX: Call AI analyzer ONCE for this pattern, not once per portfolio
      const sharedAIAnalysis = await aiEntryAnalyzer.analyzeTradeEntry(
        token,
        pattern,
        chartSignal,
        history,
        adjustedConfidence
      );
      
      // Execute on ALL enabled portfolios - check confidence per portfolio
      const portfolioIds = Array.from(this.enabledPortfolios.keys());
      for (const portfolioId of portfolioIds) {
        // Get portfolio-specific risk config for confidence threshold
        const riskConfig = await this.getRiskConfig(portfolioId);
        
        // Check against both the pattern analyzer's dynamic minimum AND the portfolio's risk level
        const currentMinConfidence = await patternPerformanceAnalyzer.getCurrentMinConfidence();
        const effectiveMinConfidence = Math.max(currentMinConfidence, riskConfig.minConfidence);
        
        if (adjustedConfidence < effectiveMinConfidence) {
          console.log(`🔍 Pattern ${pattern.patternType} skipped for portfolio ${portfolioId}: ${adjustedConfidence.toFixed(1)}% < ${effectiveMinConfidence}% (dynamic: ${currentMinConfidence}%, ${riskConfig.displayName}: ${riskConfig.minConfidence}%)`);
          continue; // Skip this portfolio
        }
        
        const signal = await this.evaluatePattern(pattern, token, adjustedConfidence, portfolioId, sharedAIAnalysis);
        if (signal) {
          signal.patternId = pattern.id; // Link signal to pattern
          await this.executeTradeSignal(signal, pattern.id, portfolioId);
        }
      }
    } catch (error) {
      console.error('Error handling ML pattern:', error);
    }
  }

  private async handleScannerAlert(alert: any) {
    if (!this.isActive || this.enabledPortfolios.size === 0) return;
    
    try {
      const token = await storage.getToken(alert.tokenId);
      if (!token) return;
      
      // Only trade on significant price movements with volume
      if (alert.alertType === 'volume_surge' || alert.alertType === 'price_spike') {
        // Execute on ALL enabled portfolios - check confidence per portfolio
        const portfolioIds = Array.from(this.enabledPortfolios.keys());
        for (const portfolioId of portfolioIds) {
          // Get portfolio-specific risk config for confidence threshold
          const riskConfig = await this.getRiskConfig(portfolioId);
          if (alert.confidence < riskConfig.minConfidence) {
            console.log(`📊 Alert skipped for portfolio ${portfolioId}: ${alert.confidence}% < ${riskConfig.minConfidence}% threshold (${riskConfig.displayName})`);
            continue; // Skip this portfolio
          }
          
          const signal = this.evaluateAlert(alert, token, portfolioId);
          if (signal) {
            await this.executeTradeSignal(signal, undefined, portfolioId);
          }
        }
      }
    } catch (error) {
      console.error('Error handling scanner alert:', error);
    }
  }

  private async evaluatePattern(pattern: Pattern, token: Token, confidence: number, portfolioId: string, sharedAIAnalysis?: any): Promise<TradingSignal | null> {
    const currentPrice = parseFloat(token.currentPrice || '0');
    if (currentPrice <= 0) return null;
    
    const portfolioState = this.enabledPortfolios.get(portfolioId);
    if (!portfolioState) return null;
    
    // ENHANCED: Get price history for chart analysis
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const history = await storage.getPriceHistory(token.id, sevenDaysAgo);
    
    // Get chart-based entry/exit signal for additional confirmation
    let chartSignal = null;
    let tradeQuality = null;
    
    // REDUCED: Lower threshold to 10 points to allow more trading opportunities
    const MIN_HISTORY_POINTS = 10; // Reduced from 50
    
    if (history.length >= MIN_HISTORY_POINTS) {
      chartSignal = chartAnalyzer.generateEntryExitSignal(history);
      tradeQuality = dynamicExitStrategy.assessTradeQuality(currentPrice, history, confidence);
      
      // ENHANCED: Adjust confidence based on chart analysis
      if (chartSignal.action === 'buy' && tradeQuality.recommendation === 'strong_buy') {
        confidence = Math.min(confidence + 15, 95); // Boost confidence for strong chart alignment
        console.log(`📈 CHART-ANALYZER: Strong buy signal confirmed - confidence boosted to ${confidence.toFixed(1)}%`);
      } else if (chartSignal.action === 'sell' || tradeQuality.recommendation === 'avoid') {
        confidence = Math.max(confidence - 15, 50); // Reduce confidence for conflicting signals
        console.log(`⚠️ CHART-ANALYZER: Bearish chart signal detected - confidence reduced to ${confidence.toFixed(1)}%`);
      }
      
      // DYNAMIC RISK LEVEL: Check risk-reward ratio based on portfolio risk level
      const riskConfig = await this.getRiskConfig(portfolioId);
      
      // RELAXED: Allow trades with lower R:R when data is limited
      const adjustedMinRR = history.length < 50 ? 
        Math.max(1.0, riskConfig.minRiskRewardRatio * 0.5) : // Halve requirement for limited data
        riskConfig.minRiskRewardRatio;
      
      if (chartSignal.riskRewardRatio && chartSignal.riskRewardRatio < adjustedMinRR) {
        console.log(`⚠️ CHART-ANALYZER: Low risk-reward ratio (${chartSignal.riskRewardRatio?.toFixed(2)}:1 < ${adjustedMinRR}:1) - proceeding with caution`);
        confidence = Math.max(confidence - 10, 60); // Reduce confidence instead of blocking
      } else if (chartSignal.riskRewardRatio) {
        console.log(`✅ CHART-ANALYZER: Trade approved with ${chartSignal.riskRewardRatio.toFixed(2)}:1 risk-reward ratio`);
      }
    } else if (history.length > 0) {
      // FALLBACK: Allow pattern-based trading with minimal history but reduced confidence
      console.log(`⚠️ CHART-ANALYZER: Limited price history (${history.length} points) - proceeding with reduced confidence`);
      confidence = Math.max(confidence * 0.7, 50); // Reduce confidence by 30%
    } else {
      // NO HISTORY: Allow ML pattern trades for new tokens with slightly reduced confidence
      // For ML patterns with high initial confidence, reduce less aggressively to allow initial trades
      console.log(`⚠️ CHART-ANALYZER: No price history available - proceeding with ML pattern only (moderate risk)`);
      // Reduce confidence by only 20% for high-confidence ML patterns to stay above trading thresholds
      confidence = Math.max(confidence * 0.8, 65); // Reduce by 20% instead of 50%, minimum 65%
    }
    
    // Strong bullish patterns - BUY signals (only when not in sell-only mode)
    const bullishPatterns = [
      'enhanced_bull_flag',
      'macd_golden_cross', 
      'stochastic_oversold_reversal',
      'volume_breakout',
      'bull_flag',
      // ML patterns that generate buy signals
      'fibonacci_ml_pattern',
      'volume_profile_ml',
      'multi_timeframe_ml',
      'mean_reversion_ml',
      'harmonic_pattern_ml',
      'ensemble_ml_signal',
      'strong_buy_pressure'
    ];
    
    // Strong bearish patterns - SELL signals (for existing positions)
    const bearishPatterns = [
      'ml_reversal',
      'head_and_shoulders',
      'double_top',
      'bearish_flag',
      'volume_collapse'
    ];
    
    // Check if we have an existing position in this token
    const existingPosition = await storage.getPositionByPortfolioAndToken(portfolioId, token.id);
    
    // Regular buy signals for bullish patterns
    if (bullishPatterns.includes(pattern.patternType)) {
      // AI-POWERED: Use shared AI analysis (already calculated once per pattern)
      // This prevents duplicate OpenAI API calls across multiple portfolios
      const aiAnalysis = sharedAIAnalysis || {
        shouldTrade: true,
        confidence,
        reasoning: ['AI analysis not available'],
        riskFactors: [],
        opportunities: [],
        recommendedAction: confidence > 75 ? 'buy' : 'hold',
      };
      
      // Apply AI recommendations
      if (!aiAnalysis.shouldTrade) {
        console.log(`🤖 AI-ENTRY-ANALYZER: Trade REJECTED for ${token.symbol} - ${aiAnalysis.reasoning.join('; ')}`);
        return null;
      }
      
      // Use AI-adjusted confidence (weighted average: 70% AI, 30% ML)
      const finalConfidence = (aiAnalysis.confidence * 0.7) + (confidence * 0.3);
      
      // Require strong AI recommendation for high-frequency trading
      if (aiAnalysis.recommendedAction === 'avoid') {
        console.log(`🤖 AI-ENTRY-ANALYZER: Avoiding ${token.symbol} despite pattern - ${aiAnalysis.reasoning.join('; ')}`);
        return null;
      }
      
      // ENHANCED: Add chart analysis reasoning to the signal
      let enhancedReason = `🤖 [Portfolio ${portfolioId}] ${pattern.patternType} detected (ML: ${confidence.toFixed(1)}%, AI: ${aiAnalysis.confidence.toFixed(1)}%, Final: ${finalConfidence.toFixed(1)}%)`;
      
      if (chartSignal && tradeQuality) {
        enhancedReason += ` | Chart: ${tradeQuality.recommendation.toUpperCase()}`;
        if (chartSignal.riskRewardRatio > 0) {
          enhancedReason += ` | R:R ${chartSignal.riskRewardRatio.toFixed(2)}:1`;
        }
        if (chartSignal.supportLevels.length > 0) {
          enhancedReason += ` | Support: $${chartSignal.supportLevels[0].toFixed(6)}`;
        }
      }
      
      // Add AI insights
      enhancedReason += ` | AI: ${aiAnalysis.recommendedAction.replace(/_/g, ' ').toUpperCase()}`;
      if (aiAnalysis.opportunities.length > 0) {
        enhancedReason += ` - ${aiAnalysis.opportunities[0]}`;
      }
      
      return {
        tokenId: token.id,
        type: 'buy',
        confidence: finalConfidence,
        source: `AI-Enhanced ML Pattern: ${pattern.patternType}`,
        price: currentPrice,
        reason: enhancedReason,
        patternId: pattern.id
      };
    }
    
    return null;
  }

  private evaluateAlert(alert: any, token: Token, portfolioId: string): TradingSignal | null {
    const currentPrice = parseFloat(token.currentPrice || '0');
    if (currentPrice <= 0) return null;
    
    const portfolioState = this.enabledPortfolios.get(portfolioId);
    if (!portfolioState) return null;
    
    // Generate buy signals for volume surges and price spikes
    if (alert.alertType === 'volume_surge' || alert.alertType === 'price_spike') {
      return {
        tokenId: token.id,
        type: 'buy',
        confidence: alert.confidence,
        source: `Scanner: ${alert.alertType}`,
        price: currentPrice,
        reason: `📊 [Portfolio ${portfolioId}] ${alert.alertType} detected (${alert.confidence}% confidence)`
      };
    }
    
    return null;
  }

  private async executeTradeSignal(signal: TradingSignal, patternId?: string, portfolioId?: string) {
    if (!portfolioId) return;
    
    const portfolioState = this.enabledPortfolios.get(portfolioId);
    if (!portfolioState) return;
    
    // CRITICAL: Check if portfolio is already processing a trade
    if (this.tradeLocks.get(portfolioId)) {
      // Skip this trade to prevent race conditions and negative cash balances
      return;
    }
    
    // Lock the portfolio for trading
    this.tradeLocks.set(portfolioId, true);
    
    try {
      // Check if real money trading is enabled for this portfolio
      const isRealTradingEnabled = await exchangeService.isRealTradingEnabled(portfolioId);
      
      if (isRealTradingEnabled) {
        // Execute real money trade via exchange service
        await this.executeRealMoneyTrade(signal, patternId, portfolioId);
        return;
      }
      
      // Handle sell signals differently from buy signals (paper trading)
      if (signal.type === 'sell') {
        await this.executeSellSignal(signal, patternId, portfolioId);
        return;
      }
      
      // Buy signal handling - check cash balance
      const portfolio = await storage.getPortfolio(portfolioId);
      if (!portfolio) return;
      
      const availableCash = safeParseFloat(portfolio.cashBalance, 0);
      const totalValue = safeParseFloat(portfolio.totalValue, 10000);
      const startingCapital = safeParseFloat(portfolio.startingCapital, 10000);
      const totalPnL = safeParseFloat(portfolio.totalPnL, 0);
      const dailyPnL = safeParseFloat(portfolio.dailyPnL, 0);
      
      // CRITICAL: Check market health BEFORE calculating position sizing
      const healthMultiplier = this.marketHealthAnalyzer.getPositionSizeMultiplier();
      if (healthMultiplier === 0) {
        // Market health recommends halting trading - skip this trade
        return;
      }
      
      // Get risk config for portfolio-specific limits
      const riskConfig = await this.getRiskConfig(portfolioId);
      
      // IMPROVED: Dynamic position sizing from RiskManager
      const positionSizing = await riskManager.calculatePositionSizing(
        portfolioId,
        signal.tokenId,
        signal.price,
        signal.confidence / 100
      );
      
      // FIXED: RiskManager returns recommendedSize in TOKENS, convert to DOLLARS
      // Use risk config's maxPositionSizePercent for portfolio-specific limits
      const maxPositionValue = totalValue * (riskConfig.maxPositionSizePercent / 100);
      const recommendedDollars = positionSizing.recommendedSize * signal.price;
      let tradeValue = Math.min(recommendedDollars, maxPositionValue);
      
      // MARKET HEALTH: Apply position size adjustment (already checked for 0 above)
      if (healthMultiplier < 1.0) {
        tradeValue = tradeValue * healthMultiplier;
        console.log(`📊 MARKET-HEALTH: Position size reduced by ${((1 - healthMultiplier) * 100).toFixed(0)}% due to market conditions`);
      }
      
      console.log(`💡 [Portfolio ${portfolioId}] Dynamic position sizing: $${tradeValue.toFixed(2)} (${positionSizing.riskLevel} risk, ${positionSizing.reasoning})`);
      
      // CRITICAL: Validate trade value before proceeding
      if (isNaN(tradeValue) || !isFinite(tradeValue) || tradeValue <= 0) {
        console.log(`❌ [Portfolio ${portfolioId}] Invalid trade value: $${tradeValue} - skipping trade`);
        return;
      }
      
      // Minimum trade size to prevent dust trades
      if (tradeValue < 1) {
        console.log(`❌ [Portfolio ${portfolioId}] Trade value too small: $${tradeValue.toFixed(2)} - minimum is $1`);
        return;
      }
      
      // If insufficient funds, try to rebalance by selling stagnant positions at break-even or above
      if (availableCash < tradeValue) {
        console.log(`💸 [Portfolio ${portfolioId}] Insufficient funds: Available $${availableCash.toFixed(2)}, Need $${tradeValue.toFixed(2)}`);
        console.log(`🔄 [Portfolio ${portfolioId}] Attempting to rebalance portfolio by selling stagnant positions...`);
        
        const freedCapital = await this.rebalancePortfolioForNewOpportunity(signal, tradeValue, portfolioId);
        if (freedCapital >= tradeValue) {
          console.log(`✅ [Portfolio ${portfolioId}] Successfully freed $${freedCapital.toFixed(2)} from stagnant positions`);
          
          // Re-fetch portfolio to get updated cash balance after rebalancing
          const updatedPortfolio = await storage.getPortfolio(portfolioId);
          if (!updatedPortfolio) return;
          
          const newAvailableCash = safeParseFloat(updatedPortfolio.cashBalance, 0);
          console.log(`💰 [Portfolio ${portfolioId}] Updated cash balance after rebalancing: $${newAvailableCash.toFixed(2)}`);
          
          if (newAvailableCash < tradeValue) {
            console.log(`❌ [Portfolio ${portfolioId}] Still insufficient funds after rebalancing: $${newAvailableCash.toFixed(2)} < $${tradeValue.toFixed(2)}`);
            return;
          }
          
          // Continue with the buy after successful rebalancing
        } else {
          console.log(`❌ [Portfolio ${portfolioId}] Could not free enough capital ($${freedCapital.toFixed(2)} < $${tradeValue.toFixed(2)})`);
          return;
        }
      }
      
      // Check if we already have a position in this token
      const existingPosition = await storage.getPositionByPortfolioAndToken(
        portfolioId,
        signal.tokenId
      );
      
      // IMPROVED: Allow adding to existing positions if they're small enough
      if (existingPosition && parseFloat(existingPosition.amount) > 0) {
        const positionValue = parseFloat(existingPosition.amount) * signal.price;
        const maxPositionValue = totalValue * 0.15; // Max 15% of portfolio per token
        
        if (positionValue >= maxPositionValue) {
          console.log(`📋 [Portfolio ${portfolioId}] Position limit reached for ${signal.tokenId} ($${positionValue.toFixed(2)} >= $${maxPositionValue.toFixed(2)})`);
          return; // Skip if position is already large
        } else {
          console.log(`✅ [Portfolio ${portfolioId}] Adding to existing position in ${signal.tokenId} ($${positionValue.toFixed(2)} < $${maxPositionValue.toFixed(2)} limit)`);
        }
      }
      
      // Calculate trade amount ($500 per trade)
      const tradeAmount = (tradeValue / signal.price).toString();
      const tradeTotal = (parseFloat(tradeAmount) * signal.price).toString();
      
      // Create trade record with pattern linkage
      const tradeData: InsertTrade = {
        portfolioId: portfolioId,
        tokenId: signal.tokenId,
        patternId: patternId || null, // Link to originating pattern
        type: signal.type,
        amount: tradeAmount,
        price: signal.price.toString(),
        totalValue: tradeTotal,
      };
      
      // Execute trade
      const trade = await storage.createTrade(tradeData);
      
      // Create or update position (prevent duplicates)
      if (existingPosition) {
        // Update existing position (add to it)
        const currentAmount = parseFloat(existingPosition.amount) || 0;
        const newAmount = currentAmount + (parseFloat(tradeAmount) || 0);
        
        // Calculate new average buy price with validation to prevent NaN
        const currentValue = currentAmount * (parseFloat(existingPosition.avgBuyPrice) || 0);
        const newValue = (parseFloat(tradeAmount) || 0) * signal.price;
        const newAvgPrice = newAmount > 0 ? (currentValue + newValue) / newAmount : signal.price;
        
        // Validate values before saving to prevent NaN corruption
        const validAmount = isNaN(newAmount) || !isFinite(newAmount) ? currentAmount : newAmount;
        const validAvgPrice = isNaN(newAvgPrice) || !isFinite(newAvgPrice) ? parseFloat(existingPosition.avgBuyPrice) || signal.price : newAvgPrice;
        
        await storage.updatePosition(existingPosition.id, {
          amount: validAmount.toString(),
          avgBuyPrice: validAvgPrice.toString(),
        });
        console.log(`📝 [Portfolio ${portfolioId}] Added to existing position for ${signal.tokenId}: ${validAmount.toFixed(6)} @ avg $${validAvgPrice.toFixed(6)}`);
      } else {
        // Create new position (first time buying this token)
        await storage.createPosition({
          portfolioId: portfolioId,
          tokenId: signal.tokenId,
          amount: tradeAmount,
          avgBuyPrice: signal.price.toString(),
        });
      }
      
      // Re-fetch current cash balance to ensure accuracy after potential rebalancing
      const currentPortfolio = await storage.getPortfolio(portfolioId);
      if (!currentPortfolio) return;
      
      const currentCashBalance = safeParseFloat(currentPortfolio.cashBalance, 0);
      
      // Update portfolio cash balance atomically using current balance
      const newCashBalanceValue = currentCashBalance - tradeValue;
      const newCashBalance = safeDbNumber(newCashBalanceValue);
      
      // CRITICAL INVARIANT: Ensure cash balance never goes negative
      if (newCashBalanceValue < -0.01) { // Allow tiny floating point errors
        console.error(`❌ CRITICAL: Portfolio ${portfolioId} cash would go negative: ${currentCashBalance} - ${tradeValue} = ${newCashBalanceValue}`);
        throw new Error('Portfolio cash balance would go negative - trade aborted');
      }
      
      await storage.updatePortfolio(portfolioId, {
        cashBalance: newCashBalance,
      });
      
      
      // Update stats
      portfolioState.tradingStats.totalTrades++;
      portfolioState.tradingStats.todayTrades++;
      
      // Get token info for logging
      const token = await storage.getToken(signal.tokenId);
      
      console.log(`🚀 [Portfolio ${portfolioId}] TRADE EXECUTED: BUY ${parseFloat(tradeAmount).toFixed(6)} ${token?.symbol} at $${signal.price.toFixed(6)}`);
      console.log(`   💡 ${signal.reason}`);
      console.log(`   💰 Value: $${tradeValue}`);
      if (patternId) {
        console.log(`   🧠 Pattern ID: ${patternId}`);
      }
      
      // Emit trading event for real-time dashboard updates
      this.emit('tradeExecuted', {
        trade,
        signal,
        token,
        portfolioId,
        timestamp: new Date().toISOString(),
        stats: this.getStatsForPortfolio(portfolioId)
      });
      
    } catch (error) {
      console.error(`[Portfolio ${portfolioId}] Error executing trade signal:`, error);
    } finally {
      // CRITICAL: Always unlock the portfolio, even if trade fails
      this.tradeLocks.delete(portfolioId);
    }
  }

  private async executeSellSignal(signal: TradingSignal, patternId?: string, portfolioId?: string) {
    if (!portfolioId) return;
    
    try {
      // Find the existing position for this token
      const position = await storage.getPositionByPortfolioAndToken(
        portfolioId,
        signal.tokenId
      );
      
      if (!position || parseFloat(position.amount) <= 0) {
        console.log(`⚠️ [Portfolio ${portfolioId}] No position found for ${signal.tokenId}, skipping sell signal`);
        return;
      }
      
      const token = await storage.getToken(signal.tokenId);
      if (!token) return;
      
      // Execute the sell using the existing executeSell method
      await this.executeSell(position, token, 'ml_pattern', signal.reason, portfolioId);
      
    } catch (error) {
      console.error(`[Portfolio ${portfolioId}] Error executing sell signal:`, error);
    }
  }


  private async monitorAllPortfolios() {
    if (!this.isActive) {
      console.log('⚠️ Position monitoring skipped: Auto-trader inactive');
      return;
    }
    
    console.log(`🔍 Monitoring ${this.enabledPortfolios.size} enabled portfolios for stop-loss/take-profit...`);
    
    // Monitor each enabled portfolio
    const portfolioIds = Array.from(this.enabledPortfolios.keys());
    for (const portfolioId of portfolioIds) {
      await this.monitorPositions(portfolioId);
    }
  }

  private async monitorPositions(portfolioId: string) {
    const portfolioState = this.enabledPortfolios.get(portfolioId);
    if (!portfolioState) return;
    
    try {
      
      const positions = await storage.getPositionsByPortfolio(portfolioId);
      console.log(`📊 [Portfolio ${portfolioId}] Checking ${positions.length} positions (${positions.filter(p => safeParseFloat(p.amount, 0) > 0).length} active)`);
      
      let totalPortfolioValue = 0;
      const positionsSold = new Set<string>(); // Track positions sold in this cycle
      
      for (const position of positions) {
        const token = await storage.getToken(position.tokenId);
        if (!token || safeParseFloat(position.amount, 0) <= 0) continue;
        
        const currentPrice = safeParseFloat(token.currentPrice, 0);
        const avgBuyPrice = safeParseFloat(position.avgBuyPrice, 0);
        const amount = safeParseFloat(position.amount, 0);
        
        if (currentPrice > 0) {
          const positionValue = amount * currentPrice;
          totalPortfolioValue += positionValue;
          
          const profitLoss = ((currentPrice - avgBuyPrice) / avgBuyPrice) * 100;
          let sellReason: string | null = null;
          let sellTrigger: string | null = null;
          let partialSellPercent: number | null = null;
          
          // Get current stage for this position (0 = none completed)
          const currentStage = this.positionStages.get(position.id) || 0;
          
          // AGGRESSIVE: Get chart-based exit signal for frequent exits
          const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
          const history = await storage.getPriceHistory(token.id, sevenDaysAgo);
          
          let chartBasedExit = false;
          if (history.length >= 50) {
            const chartSignal = chartAnalyzer.generateEntryExitSignal(history);
            
            // AGGRESSIVE: Lower confidence threshold from 75% to 60% for quicker exits
            if (chartSignal.action === 'sell' && chartSignal.confidence > 60) {
              chartBasedExit = true;
              console.log(`📉 CHART-ANALYZER: Bearish exit signal for ${token.symbol} - ${chartSignal.reasoning.join(', ')}`);
            }
            
            // AGGRESSIVE: Check resistance levels for exit with lower profit threshold
            if (chartSignal.resistanceLevels.length > 0) {
              const nearResistance = chartSignal.resistanceLevels.some(r => 
                Math.abs(currentPrice - r) / r < 0.02 // Wider detection range (was 0.015)
              );
              // AGGRESSIVE: Lower profit requirement from 3% to 2% for quicker exits
              if (nearResistance && profitLoss > 2) {
                chartBasedExit = true;
                console.log(`📉 CHART-ANALYZER: Price at resistance $${chartSignal.resistanceLevels[0].toFixed(6)} - taking profit on ${token.symbol}`);
              }
            }
            
            // AGGRESSIVE: Exit on support level breaks (new exit condition)
            if (chartSignal.supportLevels.length > 0 && chartSignal.action === 'sell') {
              const brokeSupport = chartSignal.supportLevels.some(s => 
                currentPrice < s * 0.98 // 2% below support = break
              );
              if (brokeSupport) {
                chartBasedExit = true;
                console.log(`📉 CHART-ANALYZER: Support broken at $${chartSignal.supportLevels[0].toFixed(6)} - exit ${token.symbol}`);
              }
            }
          }
          
          // Get risk config for take-profit levels
          const riskConfig = await this.getRiskConfig(portfolioId);
          
          // ENHANCED: Chart-based exit signal - NOW FULLY ACTIVE for all positions
          // Exit on bearish signals even at breakeven or small losses to prevent bigger losses
          if (chartBasedExit) {
            // Strong bearish signals: Exit immediately regardless of P&L
            if (profitLoss >= -3) {
              // Only prevent exits if loss is > 3% (catastrophic scenario - hold for recovery)
              sellReason = `Chart pattern exit signal at ${profitLoss.toFixed(1)}% ${profitLoss >= 0 ? 'gain' : 'loss'}`;
              sellTrigger = 'chart_pattern_exit';
              this.positionStages.delete(position.id);
            } else {
              console.log(`⚠️ CHART-ANALYZER: Bearish signal detected but loss too large (${profitLoss.toFixed(1)}%) - holding for potential recovery`);
            }
          }
          // DYNAMIC RISK LEVEL: Multi-stage take-profit strategy based on portfolio risk level
          // Only execute next stage if previous stages are complete
          else if (profitLoss >= riskConfig.takeProfitStages[2] && currentStage < 3) {
            // Stage 3: Final take-profit - sell remaining position
            sellReason = `Take-profit Stage 3 (${riskConfig.displayName}): ${profitLoss.toFixed(1)}% gain (final exit at ${riskConfig.takeProfitStages[2]}%+)`;
            sellTrigger = 'take_profit_stage_3';
            this.positionStages.set(position.id, 3);
          }
          else if (profitLoss >= riskConfig.takeProfitStages[1] && currentStage < 2) {
            // Stage 2: Mid take-profit - sell 40% of position
            sellReason = `Take-profit Stage 2 (${riskConfig.displayName}): ${profitLoss.toFixed(1)}% gain (partial exit 40% at ${riskConfig.takeProfitStages[1]}%+)`;
            sellTrigger = 'take_profit_stage_2';
            partialSellPercent = 0.4;
            this.positionStages.set(position.id, 2);
          }
          else if (profitLoss >= riskConfig.takeProfitStages[0] && currentStage < 1) {
            // Stage 1: Initial take-profit - sell 30% of position
            sellReason = `Take-profit Stage 1 (${riskConfig.displayName}): ${profitLoss.toFixed(1)}% gain (partial exit 30% at ${riskConfig.takeProfitStages[0]}%+)`;
            sellTrigger = 'take_profit_stage_1';
            partialSellPercent = 0.3;
            this.positionStages.set(position.id, 1);
          }
          
          // Execute sell only once per position per cycle
          if (sellReason && sellTrigger && !positionsSold.has(position.id)) {
            await this.executeSell(position, token, sellTrigger, sellReason, portfolioId, partialSellPercent);
            positionsSold.add(position.id);
            
            // Clean up stage tracking if position is fully closed
            if (parseFloat(position.amount) <= 0 || !partialSellPercent) {
              this.positionStages.delete(position.id);
            }
          }
        }
      }
      
      // Update portfolio value based on current positions + cash balance
      const portfolio = await storage.getPortfolio(portfolioId);
      if (portfolio) {
        const startingCapital = safeParseFloat(portfolio.startingCapital, 10000);
        const currentCashBalance = safeParseFloat(portfolio.cashBalance, 0);
        
        // Total portfolio value = current positions value + current cash balance
        const newTotalValue = totalPortfolioValue + currentCashBalance;
        const totalPnL = newTotalValue - startingCapital;
        
        console.log(`💰 [Portfolio ${portfolioId}] Portfolio Update: Positions $${totalPortfolioValue.toFixed(2)}, Cash $${currentCashBalance.toFixed(2)}, Total $${newTotalValue.toFixed(2)}`);
        
        await storage.updatePortfolio(portfolio.id, {
          totalValue: safeDbNumber(newTotalValue),
          totalPnL: safeDbNumber(totalPnL),
        });
        
        portfolioState.tradingStats.totalValue = newTotalValue;
        
        // Emit stats update for dashboard
        this.emit('statsUpdate', {
          portfolioId,
          totalValue: newTotalValue,
          totalPnL,
          totalTrades: portfolioState.tradingStats.totalTrades,
          todayTrades: portfolioState.tradingStats.todayTrades,
          activePositions: positions.filter(p => parseFloat(p.amount) > 0).length,
          timestamp: new Date().toISOString()
        });
      }
      
    } catch (error) {
      console.error(`[Portfolio ${portfolioId}] Error monitoring positions:`, error);
    }
  }

  private async executeSell(position: any, token: Token, trigger: string, reason: string, portfolioId: string, partialSellPercent: number | null = null) {
    const portfolioState = this.enabledPortfolios.get(portfolioId);
    if (!portfolioState) return;
    
    // Check if this position is already being sold (prevent concurrent sells)
    if (portfolioState.sellingPositions.has(position.id)) {
      console.log(`❌ [Portfolio ${portfolioId}] Cannot sell ${token.symbol}: position is already being sold`);
      return;
    }
    
    // Mark position as being sold
    portfolioState.sellingPositions.add(position.id);
    
    try {
      // Re-fetch position to ensure it still exists and has non-zero amount (prevent double sells)
      const currentPosition = await storage.getPosition(position.id);
      if (!currentPosition || parseFloat(currentPosition.amount) <= 0) {
        console.log(`❌ [Portfolio ${portfolioId}] Cannot sell ${token.symbol}: position no longer exists or has zero amount`);
        return;
      }
      
      const currentPrice = parseFloat(token.currentPrice || '0');
      const fullAmount = parseFloat(currentPosition.amount); // Use fresh position data
      const avgBuyPrice = parseFloat(currentPosition.avgBuyPrice);
      
      // IMPROVED: Calculate sell amount (partial or full)
      const sellAmount = partialSellPercent ? fullAmount * partialSellPercent : fullAmount;
      const remainingAmount = fullAmount - sellAmount;
      
      // Calculate realized P&L
      const totalSellValue = sellAmount * currentPrice;
      const totalBuyValue = sellAmount * avgBuyPrice;
      const realizedPnL = totalSellValue - totalBuyValue;
      const totalValue = (sellAmount * currentPrice).toString();
      
      // CRITICAL FIX: Delete position if fully sold, otherwise update amount
      if (remainingAmount <= 0) {
        // Position fully sold - DELETE from database
        await storage.deletePosition(currentPosition.id);
        this.positionStages.delete(currentPosition.id);
        console.log(`🗑️  [Portfolio ${portfolioId}] Deleted zero-amount position for ${token.symbol}`);
      } else {
        // Partial sell - UPDATE amount
        await storage.updatePosition(currentPosition.id, { 
          amount: remainingAmount.toString() 
        });
      }
      
      // Find the original buy trade to get pattern linkage
      const buyTrades = await storage.getTradesByPortfolio(portfolioId);
      const originalBuyTrade = buyTrades.find(t => 
        t.tokenId === currentPosition.tokenId && 
        t.type === 'buy' && 
        parseFloat(t.price) === avgBuyPrice
      );
      
      const tradeData: InsertTrade = {
        portfolioId: portfolioId,
        tokenId: currentPosition.tokenId,
        patternId: originalBuyTrade?.patternId || null, // Link to same pattern as buy trade
        type: 'sell',
        amount: sellAmount.toString(),
        price: currentPrice.toString(),
        exitPrice: currentPrice.toString(),
        realizedPnL: realizedPnL.toString(),
        totalValue,
        closedAt: new Date(),
      };
      
      const trade = await storage.createTrade(tradeData);
      
      // Update the original buy trade with exit information
      if (originalBuyTrade) {
        await storage.updateTrade(originalBuyTrade.id, {
          exitPrice: currentPrice.toString(),
          realizedPnL: realizedPnL.toString(),
          closedAt: new Date(),
        });
      }
      
      // CRITICAL: Credit cash balance with sell proceeds
      const portfolio = await storage.getPortfolio(portfolioId);
      if (portfolio) {
        const currentCash = safeParseFloat(portfolio.cashBalance, 0);
        const newCashBalance = safeDbNumber(currentCash + totalSellValue);
        const currentRealizedPnL = safeParseFloat(portfolio.realizedPnL, 0);
        const newRealizedPnL = safeDbNumber(currentRealizedPnL + realizedPnL);
        
        await storage.updatePortfolio(portfolioId, {
          cashBalance: newCashBalance,
          realizedPnL: newRealizedPnL,
        });
        
        console.log(`   💰 [Portfolio ${portfolioId}] Cash credited: +$${totalSellValue.toFixed(2)}, New balance: $${(currentCash + totalSellValue).toFixed(2)}`);
        
      }
      
      // Update success stats
      if (realizedPnL > 0) {
        portfolioState.tradingStats.successfulTrades++;
      }
      
      portfolioState.tradingStats.totalTrades++;
      portfolioState.tradingStats.todayTrades++;
      
      const pnlSymbol = realizedPnL >= 0 ? '💚' : '❌';
      const pnlText = realizedPnL >= 0 ? `+$${realizedPnL.toFixed(2)}` : `-$${Math.abs(realizedPnL).toFixed(2)}`;
      const sellType = partialSellPercent ? `PARTIAL SELL (${(partialSellPercent * 100).toFixed(0)}%)` : 'FULL SELL';
      
      console.log(`🎯 [Portfolio ${portfolioId}] ${trigger.toUpperCase()} - ${sellType}: Sold ${sellAmount.toFixed(6)} ${token.symbol} at $${currentPrice.toFixed(6)}`);
      if (partialSellPercent) {
        console.log(`   📊 Remaining position: ${remainingAmount.toFixed(6)} ${token.symbol}`);
      }
      console.log(`   📝 ${reason}`);
      console.log(`   ${pnlSymbol} P&L: ${pnlText}`);
      if (originalBuyTrade?.patternId) {
        console.log(`   🧠 Pattern: ${originalBuyTrade.patternId}`);
      }
      
      const profitPercentage = avgBuyPrice > 0 ? (realizedPnL / totalBuyValue) * 100 : 0;
      
      this.emit('tradeExecuted', {
        trade,
        signal: { type: 'sell', source: trigger, reason },
        token,
        portfolioId,
        profitLoss: realizedPnL.toFixed(2),
        profitPercentage: profitPercentage,
        timestamp: new Date().toISOString(),
        stats: this.getStatsForPortfolio(portfolioId)
      });
      
    } catch (error) {
      console.error(`[Portfolio ${portfolioId}] Error executing sell:`, error);
    } finally {
      // Always remove position from selling set to prevent deadlock
      portfolioState.sellingPositions.delete(position.id);
    }
  }

  /**
   * Rebalance portfolio by selling stagnant positions at break-even or above
   * to free up capital for new opportunities
   */
  private async rebalancePortfolioForNewOpportunity(newSignal: TradingSignal, targetAmount: number, portfolioId: string): Promise<number> {
    let totalFreedCapital = 0;
    
    try {
      // Get all current positions
      const positions = await storage.getPositionsByPortfolio(portfolioId);
      const activePositions = positions.filter(p => parseFloat(p.amount) > 0);
      
      if (activePositions.length === 0) {
        console.log(`📊 [Portfolio ${portfolioId}] No active positions to rebalance`);
        return 0;
      }
      
      // Evaluate each position for stagnancy and break-even potential
      const rebalanceCandidates = [];
      
      for (const position of activePositions) {
        const token = await storage.getToken(position.tokenId);
        if (!token) continue;
        
        const currentPrice = parseFloat(token.currentPrice || '0');
        const avgBuyPrice = parseFloat(position.avgBuyPrice);
        const amount = parseFloat(position.amount);
        
        if (currentPrice <= 0) continue;
        
        const profitPercent = ((currentPrice - avgBuyPrice) / avgBuyPrice) * 100;
        const currentValue = amount * currentPrice;
        
        // Consider a position "stagnant" if:
        // 1. It's at break-even or slightly profitable (0% to 3% gain)
        // 2. It's been flat for a while (could add time-based logic later)
        // 3. It's not the same token as our new signal
        const isStagnant = profitPercent >= 0 && profitPercent <= 3 && position.tokenId !== newSignal.tokenId;
        const isBreakEvenOrAbove = profitPercent >= 0;
        
        if (isStagnant && isBreakEvenOrAbove) {
          rebalanceCandidates.push({
            position,
            token,
            profitPercent,
            currentValue,
            stagnancyScore: 3 - profitPercent // Lower profit = higher stagnancy
          });
        }
      }
      
      if (rebalanceCandidates.length === 0) {
        console.log(`📊 [Portfolio ${portfolioId}] No stagnant break-even positions available for rebalancing`);
        return 0;
      }
      
      // Sort by stagnancy score (most stagnant first)
      rebalanceCandidates.sort((a, b) => b.stagnancyScore - a.stagnancyScore);
      
      console.log(`🔍 [Portfolio ${portfolioId}] Found ${rebalanceCandidates.length} stagnant positions eligible for rebalancing:`);
      rebalanceCandidates.forEach(candidate => {
        console.log(`   • ${candidate.token.symbol}: ${candidate.profitPercent.toFixed(2)}% gain, $${candidate.currentValue.toFixed(2)} value`);
      });
      
      // Sell stagnant positions until we have enough capital
      for (const candidate of rebalanceCandidates) {
        if (totalFreedCapital >= targetAmount) break;
        
        const { position, token, profitPercent } = candidate;
        
        console.log(`🔄 [Portfolio ${portfolioId}] Rebalancing: Selling stagnant ${token.symbol} at ${profitPercent.toFixed(2)}% for new opportunity`);
        
        // Calculate expected proceeds before selling
        const amount = parseFloat(position.amount);
        const currentPrice = parseFloat(token.currentPrice || '0');
        const expectedProceeds = amount * currentPrice;
        
        // Execute the sell to free up capital
        await this.executeSell(position, token, 'rebalance', `Portfolio rebalancing: Selling stagnant position (${profitPercent.toFixed(1)}% gain) for new opportunity`, portfolioId);
        
        // Track freed capital (actual sell proceeds)
        totalFreedCapital += expectedProceeds;
        
        console.log(`   💰 [Portfolio ${portfolioId}] Freed $${expectedProceeds.toFixed(2)} from ${token.symbol}, Total freed: $${totalFreedCapital.toFixed(2)}`);
      }
      
      console.log(`🎯 [Portfolio ${portfolioId}] Portfolio rebalancing complete: Freed $${totalFreedCapital.toFixed(2)} for new opportunity`);
      
    } catch (error) {
      console.error(`[Portfolio ${portfolioId}] Error during portfolio rebalancing:`, error);
    }
    
    return totalFreedCapital;
  }

  async getDetailedStats(portfolioId?: string) {
    // If no portfolioId provided, use the first enabled portfolio (for backward compatibility)
    const targetPortfolioId = portfolioId || Array.from(this.enabledPortfolios.keys())[0];
    if (!targetPortfolioId) return null;
    
    const portfolioState = this.enabledPortfolios.get(targetPortfolioId);
    if (!portfolioState) return null;
    
    try {
      const portfolio = await storage.getPortfolio(targetPortfolioId);
      const positions = await storage.getPositionsByPortfolio(targetPortfolioId);
      const trades = await storage.getTradesByPortfolio(targetPortfolioId);
      
      if (!portfolio) return null;
      
      // Use portfolio's actual cash balance instead of recalculating from trades
      const availableCash = safeParseFloat(portfolio.cashBalance, 0);
      const startingCapital = safeParseFloat(portfolio.startingCapital, 10000);
      const realizedPnL = safeParseFloat(portfolio.realizedPnL, 0);
      
      // Calculate current position values
      let totalPositionValue = 0;
      const activePositions = [];
      
      for (const position of positions) {
        if (parseFloat(position.amount) > 0) {
          const token = await storage.getToken(position.tokenId);
          if (token) {
            const currentPrice = parseFloat(token.currentPrice || '0');
            const positionValue = parseFloat(position.amount) * currentPrice;
            const avgBuyPrice = parseFloat(position.avgBuyPrice);
            const profitLoss = currentPrice > 0 ? ((currentPrice - avgBuyPrice) / avgBuyPrice) * 100 : 0;
            
            totalPositionValue += positionValue;
            activePositions.push({
              id: position.id, // Add unique position ID to prevent duplicate React keys
              tokenId: position.tokenId,
              symbol: token.symbol,
              amount: parseFloat(position.amount),
              avgBuyPrice,
              currentPrice,
              positionValue,
              profitLoss
            });
          }
        }
      }
      
      // Total portfolio value = cash + position values
      const totalValue = availableCash + totalPositionValue;
      
      return {
        portfolioId: targetPortfolioId,
        totalValue,
        totalPositionValue,
        availableCash,
        startingCapital,
        realizedPnL,
        totalTrades: trades.length,
        buyTrades: trades.filter(t => t.type === 'buy').length,
        sellTrades: trades.filter(t => t.type === 'sell').length,
        activePositions: activePositions.length,
        positions: activePositions,
        winRate: portfolioState.tradingStats.totalTrades > 0 
          ? (portfolioState.tradingStats.successfulTrades / portfolioState.tradingStats.totalTrades * 100).toFixed(1)
          : '0'
      };
    } catch (error) {
      console.error(`[Portfolio ${targetPortfolioId}] Error getting detailed stats:`, error);
      return null;
    }
  }

  private async executeRealMoneyTrade(signal: TradingSignal, patternId?: string, portfolioId?: string): Promise<void> {
    if (!portfolioId) return;
    
    const portfolioState = this.enabledPortfolios.get(portfolioId);
    if (!portfolioState) return;
    
    try {
      // Get token details
      const token = await storage.getToken(signal.tokenId);
      if (!token) {
        console.error(`❌ [Portfolio ${portfolioId}] Token ${signal.tokenId} not found for real money trade`);
        return;
      }

      // Calculate conservative position size ($500 position)
      const positionSize = 500 / signal.price;

      // Convert to exchange trading signal with all required fields
      const exchangeSignal: ExchangeTradingSignal = {
        tokenId: signal.tokenId,
        symbol: token.symbol,
        type: signal.type,
        amount: positionSize,
        price: signal.price,
        confidence: signal.confidence,
        source: signal.source,
        patternId: patternId,
        portfolioId: portfolioId
      };

      console.log(`💱 🔴 [Portfolio ${portfolioId}] REAL MONEY ${signal.type.toUpperCase()}: ${token.symbol} at $${signal.price} (${signal.confidence}% confidence)`);
      
      // Execute through exchange service
      const exchangeTrade = await exchangeService.executeTradeSignal(exchangeSignal);
      
      if (exchangeTrade) {
        console.log(`✅ [Portfolio ${portfolioId}] Real money trade executed: ${exchangeTrade.id}`);
        
        // Update trading stats
        portfolioState.tradingStats.totalTrades++;
        portfolioState.tradingStats.todayTrades++;
        
        // Emit trading event for real-time dashboard updates
        this.emit('tradeExecuted', {
          exchangeTrade,
          signal,
          token,
          portfolioId,
          timestamp: new Date().toISOString(),
          stats: this.getStatsForPortfolio(portfolioId),
          mode: 'real_money'
        });
      } else {
        console.log(`❌ [Portfolio ${portfolioId}] Real money trade execution failed or skipped`);
      }
      
    } catch (error) {
      console.error(`❌ [Portfolio ${portfolioId}] Real money trade execution failed:`, error);
    }
  }


  getStatsForPortfolio(portfolioId: string) {
    const portfolioState = this.enabledPortfolios.get(portfolioId);
    if (!portfolioState) return null;
    
    return {
      isActive: this.isActive,
      portfolioId,
      ...portfolioState.tradingStats,
      strategy: this.strategy,
    };
  }

  getStats() {
    // Return stats for first enabled portfolio (for backward compatibility)
    const firstPortfolioId = Array.from(this.enabledPortfolios.keys())[0];
    if (!firstPortfolioId) {
      return {
        isActive: this.isActive,
        totalTrades: 0,
        successfulTrades: 0,
        todayTrades: 0,
        totalValue: 0,
        strategy: this.strategy,
      };
    }
    return this.getStatsForPortfolio(firstPortfolioId);
  }
}

export const autoTrader = new AutoTrader();