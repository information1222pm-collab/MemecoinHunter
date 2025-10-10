import { EventEmitter } from 'events';
import { storage } from '../storage';
import type { Portfolio, Position, Trade, Token } from '@shared/schema';

interface RiskMetrics {
  portfolioValue: number;
  totalPnL: number;
  winRate: number;
  maxDrawdown: number;
  sharpeRatio: number;
  volatility: number;
  dailyVaR: number; // Value at Risk
  concentration: number; // Largest position as % of portfolio
}

interface PositionSizing {
  maxPositionSize: number;
  recommendedSize: number;
  riskLevel: 'low' | 'medium' | 'high';
  reasoning: string;
}

interface RiskLimits {
  maxPositionSize: number; // % of portfolio
  maxDailyLoss: number; // % of portfolio
  maxDrawdown: number; // % of portfolio
  maxConcentration: number; // % in single asset
  stopLossPercentage: number; // % from entry price
  maxOpenPositions: number;
}

interface TradeRiskAnalysis {
  allowed: boolean;
  reason?: string;
  suggestedSize?: number;
  stopLossPrice?: number;
  riskRewardRatio?: number;
}

class RiskManager extends EventEmitter {
  private isMonitoring = false;
  private monitoringInterval?: NodeJS.Timeout;
  
  private readonly defaultRiskLimits: RiskLimits = {
    maxPositionSize: 10, // 10% of portfolio per position
    maxDailyLoss: 5, // 5% daily loss limit
    maxDrawdown: 20, // 20% maximum drawdown
    maxConcentration: 25, // 25% max in single asset
    stopLossPercentage: 8, // 8% stop loss
    maxOpenPositions: 15,
  };

  start() {
    if (this.isMonitoring) return;
    
    this.isMonitoring = true;
    console.log('🛡️ Risk Manager started');
    
    // Monitor risk limits every 30 seconds
    this.monitoringInterval = setInterval(() => {
      this.monitorAllPortfolios();
    }, 30000);
    
    // Initial monitoring
    this.monitorAllPortfolios();
  }

  stop() {
    if (!this.isMonitoring) return;
    
    this.isMonitoring = false;
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }
    console.log('🛡️ Risk Manager stopped');
  }

  private async monitorAllPortfolios() {
    try {
      // Get all active portfolios for comprehensive monitoring
      const portfolios = await storage.getAllPortfolios();
      
      for (const portfolio of portfolios) {
        try {
          await this.monitorRiskLimits(portfolio.id);
        } catch (error) {
          console.error(`❌ Error monitoring portfolio ${portfolio.id}:`, error);
        }
      }
    } catch (error) {
      console.error('❌ Error monitoring portfolios:', error);
    }
  }

  async analyzePortfolioRisk(portfolioId: string): Promise<RiskMetrics> {
    try {
      const portfolio = await storage.getPortfolio(portfolioId);
      const positions = await storage.getPositionsByPortfolio(portfolioId);
      const trades = await storage.getTradesByPortfolio(portfolioId);

      if (!portfolio) {
        throw new Error('Portfolio not found');
      }

      const portfolioValue = parseFloat(portfolio.totalValue || '0');
      const totalPnL = parseFloat(portfolio.totalPnL || '0');
      const winRate = parseFloat(portfolio.winRate || '0');

      // Calculate maximum drawdown
      const maxDrawdown = await this.calculateMaxDrawdown(trades);

      // Calculate Sharpe ratio
      const sharpeRatio = await this.calculateSharpeRatio(trades);

      // Calculate portfolio volatility
      const volatility = await this.calculatePortfolioVolatility(trades);

      // Calculate daily Value at Risk (95% confidence)
      const dailyVaR = this.calculateVaR(portfolioValue, volatility);

      // Calculate concentration risk
      const concentration = this.calculateConcentration(positions, portfolioValue);

      return {
        portfolioValue,
        totalPnL,
        winRate,
        maxDrawdown,
        sharpeRatio,
        volatility,
        dailyVaR,
        concentration,
      };
    } catch (error) {
      console.error('Error analyzing portfolio risk:', error);
      throw error;
    }
  }

  async calculatePositionSizing(
    portfolioId: string,
    tokenId: string,
    entryPrice: number,
    confidence: number = 0.7
  ): Promise<PositionSizing> {
    try {
      const portfolio = await storage.getPortfolio(portfolioId);
      const positions = await storage.getPositionsByPortfolio(portfolioId);
      const token = await storage.getToken(tokenId);

      if (!portfolio || !token) {
        throw new Error('Portfolio or token not found');
      }

      const portfolioValue = parseFloat(portfolio.totalValue || '0');
      const riskLimits = this.defaultRiskLimits;

      // Base position size (Kelly Criterion adapted for stop loss)
      const kellyPercentage = this.calculateKellyPercentage(confidence, riskLimits.stopLossPercentage);
      
      // Risk-adjusted position size as percentage
      const availableCapacity = this.getAvailableCapacity(positions, portfolioValue, riskLimits);
      const riskAdjustedPercentage = Math.min(
        kellyPercentage,
        riskLimits.maxPositionSize,
        availableCapacity
      );

      // Token-specific volatility adjustment
      const tokenVolatility = await this.getTokenVolatility(tokenId);
      const volatilityAdjustment = this.calculateVolatilityAdjustment(tokenVolatility);
      
      const finalPercentage = riskAdjustedPercentage * volatilityAdjustment;
      
      // Convert to dollar amount and then to token amount
      const dollarAmount = (finalPercentage / 100) * portfolioValue;
      const tokenAmount = dollarAmount / entryPrice;
      
      // Maximum position in tokens
      const maxDollarAmount = (riskLimits.maxPositionSize / 100) * portfolioValue;
      const maxTokenAmount = maxDollarAmount / entryPrice;

      // Determine risk level
      const riskLevel = this.determineRiskLevel(finalPercentage, tokenVolatility, confidence);

      // Generate reasoning
      const reasoning = this.generatePositionSizingReasoning(
        kellyPercentage,
        volatilityAdjustment,
        confidence,
        tokenVolatility
      );

      return {
        maxPositionSize: maxTokenAmount,
        recommendedSize: Math.max(0, tokenAmount),
        riskLevel,
        reasoning,
      };
    } catch (error) {
      console.error('Error calculating position sizing:', error);
      throw error;
    }
  }

  async analyzeTradeRisk(
    portfolioId: string,
    tokenId: string,
    tradeType: 'buy' | 'sell',
    amount: number,
    price: number
  ): Promise<TradeRiskAnalysis> {
    try {
      const portfolio = await storage.getPortfolio(portfolioId);
      const positions = await storage.getPositionsByPortfolio(portfolioId);
      const existingPosition = await storage.getPositionByPortfolioAndToken(portfolioId, tokenId);

      if (!portfolio) {
        return { allowed: false, reason: 'Portfolio not found' };
      }

      const portfolioValue = parseFloat(portfolio.totalValue || '0');
      const tradeValue = amount * price;
      const riskLimits = this.defaultRiskLimits;

      // Strict sell validation
      if (tradeType === 'sell') {
        if (!existingPosition) {
          return {
            allowed: false,
            reason: 'Cannot sell - no existing position found for this token'
          };
        }
        
        const currentAmount = parseFloat(existingPosition.amount);
        if (amount > currentAmount) {
          return {
            allowed: false,
            reason: `Cannot sell ${amount} tokens - only ${currentAmount} available`,
            suggestedSize: currentAmount
          };
        }
        
        if (currentAmount <= 0) {
          return {
            allowed: false,
            reason: 'Cannot sell - position has zero or negative amount'
          };
        }
      }

      // Check maximum position size
      if (tradeType === 'buy') {
        const currentPositionValue = existingPosition 
          ? parseFloat(existingPosition.amount) * price 
          : 0;
        const newPositionValue = currentPositionValue + tradeValue;
        const positionPercentage = (newPositionValue / portfolioValue) * 100;

        if (positionPercentage > riskLimits.maxPositionSize) {
          const suggestedSize = (portfolioValue * riskLimits.maxPositionSize / 100) / price;
          return {
            allowed: false,
            reason: `Position would exceed ${riskLimits.maxPositionSize}% portfolio limit`,
            suggestedSize: Math.max(0, suggestedSize - (existingPosition ? parseFloat(existingPosition.amount) : 0)),
          };
        }
      }

      // Check portfolio concentration including the prospective trade
      const concentration = this.calculateProspectiveConcentration(
        positions, 
        portfolioValue, 
        tokenId, 
        tradeType, 
        tradeValue
      );
      if (tradeType === 'buy' && concentration > riskLimits.maxConcentration) {
        return {
          allowed: false,
          reason: `Trade would exceed concentration limit of ${riskLimits.maxConcentration}%`,
        };
      }

      // Check maximum open positions (only count positions with amount > 0)
      if (tradeType === 'buy' && !existingPosition) {
        const activePositions = positions.filter(p => parseFloat(p.amount) > 0);
        if (activePositions.length >= riskLimits.maxOpenPositions) {
          return {
            allowed: false,
            reason: `Maximum ${riskLimits.maxOpenPositions} open positions reached`,
          };
        }
      }

      // Calculate stop-loss price
      const stopLossPrice = tradeType === 'buy' 
        ? price * (1 - riskLimits.stopLossPercentage / 100)
        : price * (1 + riskLimits.stopLossPercentage / 100);

      // Calculate risk-reward ratio
      const riskRewardRatio = this.calculateRiskRewardRatio(price, stopLossPrice, tradeType);

      // Check daily loss limits
      const dailyPnL = parseFloat(portfolio.dailyPnL || '0');
      const potentialLoss = tradeValue * (riskLimits.stopLossPercentage / 100);
      const maxDailyLossAmount = portfolioValue * (riskLimits.maxDailyLoss / 100);

      if (Math.abs(dailyPnL) + potentialLoss > maxDailyLossAmount) {
        return {
          allowed: false,
          reason: `Trade would exceed daily loss limit of ${riskLimits.maxDailyLoss}%`,
        };
      }

      return {
        allowed: true,
        stopLossPrice,
        riskRewardRatio,
      };
    } catch (error) {
      console.error('Error analyzing trade risk:', error);
      return { allowed: false, reason: 'Risk analysis failed' };
    }
  }

  async implementStopLoss(positionId: string): Promise<boolean> {
    try {
      const position = await storage.getPosition(positionId);
      if (!position) return false;

      const token = await storage.getToken(position.tokenId);
      if (!token) return false;

      const currentPrice = parseFloat(token.currentPrice || '0');
      const avgBuyPrice = parseFloat(position.avgBuyPrice || '0');
      const amount = parseFloat(position.amount || '0');

      if (amount <= 0) return false; // Position already closed

      // Calculate stop-loss trigger
      const stopLossPrice = avgBuyPrice * (1 - this.defaultRiskLimits.stopLossPercentage / 100);
      
      if (currentPrice <= stopLossPrice) {
        // Execute stop-loss trade
        await storage.createTrade({
          portfolioId: position.portfolioId,
          tokenId: position.tokenId,
          type: 'sell',
          amount: position.amount,
          price: currentPrice.toString(),
          totalValue: (amount * currentPrice).toString(),
          status: 'completed',
        });

        // Close position
        await storage.updatePosition(positionId, { 
          amount: '0',
          currentValue: '0',
          unrealizedPnL: '0',
        });

        // Update portfolio totals after stop-loss
        const portfolio = await storage.getPortfolio(position.portfolioId);
        if (portfolio) {
          const sellValue = amount * currentPrice;
          const pnl = sellValue - (amount * avgBuyPrice);
          const currentTotal = parseFloat(portfolio.totalValue || '0');
          const currentDailyPnL = parseFloat(portfolio.dailyPnL || '0');
          
          await storage.updatePortfolio(position.portfolioId, {
            totalValue: (currentTotal + pnl).toString(),
            dailyPnL: (currentDailyPnL + pnl).toString()
          });
        }

        this.emit('stopLossTriggered', {
          positionId,
          tokenSymbol: token.symbol,
          stopLossPrice,
          currentPrice,
          loss: (avgBuyPrice - currentPrice) * amount,
          portfolioId: position.portfolioId
        });

        console.log(`🛡️ Stop-loss triggered for ${token.symbol}: ${currentPrice} (${stopLossPrice} target)`);
        return true;
      }

      return false;
    } catch (error) {
      console.error('Error implementing stop-loss:', error);
      return false;
    }
  }

  async monitorRiskLimits(portfolioId: string): Promise<void> {
    try {
      const riskMetrics = await this.analyzePortfolioRisk(portfolioId);
      const portfolio = await storage.getPortfolio(portfolioId);
      const positions = await storage.getPositionsByPortfolio(portfolioId);

      if (!portfolio) return;

      // Check maximum drawdown
      if (riskMetrics.maxDrawdown > this.defaultRiskLimits.maxDrawdown) {
        this.emit('riskLimitExceeded', {
          type: 'maxDrawdown',
          current: riskMetrics.maxDrawdown,
          limit: this.defaultRiskLimits.maxDrawdown,
          portfolioId,
        });
      }

      // Check concentration risk
      if (riskMetrics.concentration > this.defaultRiskLimits.maxConcentration) {
        this.emit('riskLimitExceeded', {
          type: 'concentration',
          current: riskMetrics.concentration,
          limit: this.defaultRiskLimits.maxConcentration,
          portfolioId,
        });
      }

      // Monitor stop-losses for all positions
      for (const position of positions) {
        await this.implementStopLoss(position.id);
      }

      // Check daily loss limit
      const dailyLossPercentage = (Math.abs(parseFloat(portfolio.dailyPnL || '0')) / riskMetrics.portfolioValue) * 100;
      if (dailyLossPercentage > this.defaultRiskLimits.maxDailyLoss) {
        this.emit('riskLimitExceeded', {
          type: 'dailyLoss',
          current: dailyLossPercentage,
          limit: this.defaultRiskLimits.maxDailyLoss,
          portfolioId,
        });
      }

    } catch (error) {
      console.error('Error monitoring risk limits:', error);
    }
  }

  // Private helper methods

  private async calculateMaxDrawdown(trades: Trade[]): Promise<number> {
    if (trades.length < 2) return 0;

    let peak = 0;
    let maxDrawdown = 0;
    let runningPnL = 0;

    // Sort trades by date
    const sortedTrades = trades.sort((a, b) => 
      new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime()
    );

    for (const trade of sortedTrades) {
      const tradeValue = parseFloat(trade.totalValue);
      runningPnL += trade.type === 'sell' ? tradeValue : -tradeValue;

      if (runningPnL > peak) {
        peak = runningPnL;
      }

      const drawdown = ((peak - runningPnL) / Math.max(peak, 1)) * 100;
      maxDrawdown = Math.max(maxDrawdown, drawdown);
    }

    return maxDrawdown;
  }

  private async calculateSharpeRatio(trades: Trade[]): Promise<number> {
    if (trades.length < 30) return 0; // Need sufficient data

    const returns = this.calculateDailyReturns(trades);
    if (returns.length < 2) return 0;

    const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
    const stdDev = Math.sqrt(variance);

    return stdDev > 0 ? (avgReturn / stdDev) * Math.sqrt(252) : 0; // Annualized
  }

  private async calculatePortfolioVolatility(trades: Trade[]): Promise<number> {
    const returns = this.calculateDailyReturns(trades);
    if (returns.length < 2) return 0;

    const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
    
    return Math.sqrt(variance) * 100; // Return as percentage
  }

  private calculateDailyReturns(trades: Trade[]): number[] {
    // Simplified daily returns calculation
    const dailyPnL: { [date: string]: number } = {};
    
    for (const trade of trades) {
      const date = new Date(trade.createdAt || 0).toDateString();
      const pnl = trade.type === 'sell' ? parseFloat(trade.totalValue) : -parseFloat(trade.totalValue);
      dailyPnL[date] = (dailyPnL[date] || 0) + pnl;
    }

    return Object.values(dailyPnL);
  }

  private calculateVaR(portfolioValue: number, volatility: number, confidence: number = 0.95): number {
    // 95% confidence VaR using normal distribution approximation
    const zScore = 1.645; // 95% confidence z-score
    return portfolioValue * (volatility / 100) * zScore;
  }

  private calculateConcentration(positions: Position[], portfolioValue: number): number {
    if (positions.length === 0 || portfolioValue === 0) return 0;

    const positionValues = positions.map(p => parseFloat(p.currentValue || '0'));
    const largestPosition = Math.max(...positionValues);
    
    return (largestPosition / portfolioValue) * 100;
  }

  private calculateProspectiveConcentration(
    positions: Position[], 
    portfolioValue: number, 
    tokenId: string, 
    tradeType: 'buy' | 'sell',
    tradeValue: number
  ): number {
    if (portfolioValue === 0) return 0;

    // Calculate position values including the prospective trade
    const positionValues: number[] = [];
    let hasTargetToken = false;

    for (const position of positions) {
      let value = parseFloat(position.currentValue || '0');
      
      // Adjust for the prospective trade
      if (position.tokenId === tokenId) {
        hasTargetToken = true;
        if (tradeType === 'buy') {
          value += tradeValue;
        } else {
          value = Math.max(0, value - tradeValue);
        }
      }
      
      if (value > 0) {
        positionValues.push(value);
      }
    }

    // If buying a new token not in existing positions
    if (!hasTargetToken && tradeType === 'buy') {
      positionValues.push(tradeValue);
    }

    if (positionValues.length === 0) return 0;

    const largestPosition = Math.max(...positionValues);
    return (largestPosition / portfolioValue) * 100;
  }

  private calculateKellyPercentage(confidence: number, stopLossPercentage: number): number {
    // Kelly Criterion adapted for stop loss: f = (bp - q) / b
    // where b = reward/risk ratio, p = probability of win, q = probability of loss
    const winProbability = confidence;
    const lossProbability = 1 - confidence;
    
    // Risk per trade based on stop loss
    const riskPerTrade = stopLossPercentage / 100;
    
    // Assume 2:1 reward/risk ratio (target gain vs stop loss)
    const rewardRiskRatio = 2.0;
    
    // Kelly formula: f = (probability_win * reward_ratio - probability_loss) / reward_ratio
    const kellyFraction = (winProbability * rewardRiskRatio - lossProbability) / rewardRiskRatio;
    
    // Scale by risk per trade and convert to percentage
    const kellyPercentage = (kellyFraction / riskPerTrade) * 100;
    
    // Cap at reasonable limits for crypto (more volatile than traditional assets)
    return Math.max(0, Math.min(kellyPercentage, 15));
  }

  private getAvailableCapacity(positions: Position[], portfolioValue: number, riskLimits: RiskLimits): number {
    // Filter out zero-amount positions before calculating
    const activePositions = positions.filter(p => parseFloat(p.amount) > 0);
    const totalPositionValue = activePositions.reduce((sum, p) => sum + parseFloat(p.currentValue || '0'), 0);
    const usedCapacity = portfolioValue > 0 ? (totalPositionValue / portfolioValue) * 100 : 0;
    const availableCapacity = Math.max(0, 95 - usedCapacity); // Keep 5% cash
    
    return Math.min(availableCapacity, riskLimits.maxPositionSize);
  }

  private async getTokenVolatility(tokenId: string): Promise<number> {
    try {
      // Get recent price history for volatility calculation
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const history = await storage.getPriceHistory(tokenId, oneDayAgo);
      
      if (history.length < 10) return 20; // Default high volatility for new tokens

      const prices = history.map(h => parseFloat(h.price));
      const returns = [];
      
      for (let i = 1; i < prices.length; i++) {
        returns.push((prices[i] - prices[i - 1]) / prices[i - 1]);
      }

      const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
      const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
      
      return Math.sqrt(variance) * 100; // Return as percentage
    } catch (error) {
      return 20; // Default volatility if calculation fails
    }
  }

  private calculateVolatilityAdjustment(volatility: number): number {
    // Reduce position size for high volatility tokens
    if (volatility > 15) return 0.5; // High volatility
    if (volatility > 10) return 0.7; // Medium volatility
    if (volatility > 5) return 0.85; // Low-medium volatility
    return 1.0; // Low volatility
  }

  private determineRiskLevel(positionSize: number, volatility: number, confidence: number): 'low' | 'medium' | 'high' {
    const riskScore = (positionSize / 10) + (volatility / 20) + ((1 - confidence) * 2);
    
    if (riskScore > 1.5) return 'high';
    if (riskScore > 0.8) return 'medium';
    return 'low';
  }

  private generatePositionSizingReasoning(
    kellyPercentage: number,
    volatilityAdjustment: number,
    confidence: number,
    tokenVolatility: number
  ): string {
    let reasoning = `Kelly Criterion suggests ${kellyPercentage.toFixed(1)}% allocation. `;
    
    if (volatilityAdjustment < 1) {
      reasoning += `Reduced by ${((1 - volatilityAdjustment) * 100).toFixed(0)}% due to high volatility (${tokenVolatility.toFixed(1)}%). `;
    }
    
    reasoning += `Pattern confidence: ${(confidence * 100).toFixed(0)}%.`;
    
    return reasoning;
  }

  private calculateRiskRewardRatio(entryPrice: number, stopLossPrice: number, tradeType: 'buy' | 'sell'): number {
    const risk = Math.abs(entryPrice - stopLossPrice);
    const reward = risk * 2; // Assume 2:1 reward ratio target
    return reward / risk;
  }
}

export const riskManager = new RiskManager();