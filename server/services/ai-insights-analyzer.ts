import { EventEmitter } from 'events';
import { storage } from '../storage';
import type { Portfolio, Trade, Position, Pattern } from '@shared/schema';
import OpenAI from 'openai';

interface PortfolioMetrics {
  portfolioId: string;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  avgProfitPerTrade: number;
  totalPnL: number;
  currentRiskExposure: number;
  activePositions: number;
  recentPatterns: Pattern[];
  tradingFrequency: string;
  profitTrend: 'improving' | 'declining' | 'stable';
  riskLevel: string;
}

interface AIInsightData {
  portfolioId: string;
  insightType: string;
  title: string;
  description: string;
  recommendation: string;
  confidence: string;
  priority: string;
  supportingData: any;
  expiresAt: Date;
}

class AIInsightsAnalyzer extends EventEmitter {
  private isRunning = false;
  private analysisInterval?: NodeJS.Timeout;
  private openai: OpenAI;

  constructor() {
    super();
    
    // Initialize OpenAI client with Replit AI Integrations
    this.openai = new OpenAI({
      baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
      apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
    });
  }

  start() {
    if (this.isRunning) return;
    
    this.isRunning = true;
    console.log('🧠 AI Insights Analyzer started');
    
    // Analyze every 30 minutes
    this.analysisInterval = setInterval(() => {
      console.log('🔍 AI-INSIGHTS: Starting analysis cycle...');
      this.analyzePortfolios();
    }, 30 * 60 * 1000); // 30 minutes
    
    // Initial analysis after 30 seconds to let system stabilize
    setTimeout(() => {
      console.log('🔍 AI-INSIGHTS: Running initial analysis...');
      this.analyzePortfolios();
    }, 30000);
  }

  stop() {
    if (!this.isRunning) return;
    
    this.isRunning = false;
    if (this.analysisInterval) {
      clearInterval(this.analysisInterval);
    }
    console.log('🛑 AI Insights Analyzer stopped');
  }

  private async analyzePortfolios() {
    try {
      // Get all portfolios with auto-trading enabled
      const portfolios = await storage.getAutoTradingPortfolios();
      
      console.log(`🧠 AI-INSIGHTS: Analyzing ${portfolios.length} portfolios...`);
      
      // Process portfolios in batches to avoid overwhelming the system
      // Reduced batch size and process only first 20 portfolios to prevent OOM
      const maxPortfolios = Math.min(portfolios.length, 20); // Limit to 20 portfolios
      const BATCH_SIZE = 2; // Reduced from 5 to 2
      
      for (let i = 0; i < maxPortfolios; i += BATCH_SIZE) {
        const batch = portfolios.slice(i, Math.min(i + BATCH_SIZE, maxPortfolios));
        
        // Process sequentially instead of parallel to reduce memory pressure
        for (const portfolio of batch) {
          await this.analyzePortfolio(portfolio);
        }
        
        // Longer delay between batches to allow garbage collection
        if (i + BATCH_SIZE < maxPortfolios) {
          await new Promise(resolve => setTimeout(resolve, 2000)); // Increased from 1000ms
        }
      }
      
      console.log('✅ AI-INSIGHTS: Analysis cycle completed');
    } catch (error) {
      console.error('❌ AI-INSIGHTS: Analysis error:', error);
    }
  }

  private async analyzePortfolio(portfolio: Portfolio) {
    try {
      const metrics = await this.calculatePortfolioMetrics(portfolio);
      
      // Skip portfolios with no trading activity
      if (metrics.totalTrades === 0) {
        return;
      }
      
      // Generate insights for different aspects
      const insights: AIInsightData[] = [];
      
      // 1. Performance Analysis
      if (metrics.totalTrades >= 5) {
        const performanceInsight = await this.generatePerformanceInsight(metrics);
        if (performanceInsight) insights.push(performanceInsight);
      }
      
      // 2. Risk Assessment
      if (metrics.currentRiskExposure > 50) {
        const riskInsight = await this.generateRiskInsight(metrics);
        if (riskInsight) insights.push(riskInsight);
      }
      
      // 3. Pattern Opportunities
      if (metrics.recentPatterns.length > 0) {
        const opportunityInsight = await this.generateOpportunityInsight(metrics);
        if (opportunityInsight) insights.push(opportunityInsight);
      }
      
      // 4. Market Trend Analysis (weekly)
      const lastInsight = await storage.getLatestInsightForPortfolio(portfolio.id);
      const shouldGenerateTrend = !lastInsight || 
        (lastInsight.createdAt && (new Date().getTime() - new Date(lastInsight.createdAt).getTime()) > 7 * 24 * 60 * 60 * 1000);
      
      if (shouldGenerateTrend) {
        const trendInsight = await this.generateMarketTrendInsight(metrics);
        if (trendInsight) insights.push(trendInsight);
      }
      
      // Store insights in database
      for (const insight of insights) {
        await storage.createAIInsight({
          portfolioId: insight.portfolioId,
          insightType: insight.insightType,
          title: insight.title,
          description: insight.description,
          recommendation: insight.recommendation,
          confidence: insight.confidence,
          priority: insight.priority,
          supportingData: insight.supportingData,
          expiresAt: insight.expiresAt,
          status: 'new',
        });
        
        console.log(`💡 AI-INSIGHTS: Generated ${insight.insightType} for portfolio ${portfolio.id}`);
      }
      
    } catch (error) {
      console.error(`❌ AI-INSIGHTS: Error analyzing portfolio ${portfolio.id}:`, error);
    }
  }

  private async calculatePortfolioMetrics(portfolio: Portfolio): Promise<PortfolioMetrics> {
    // Get all trades for this portfolio
    const trades = await storage.getTradesByPortfolio(portfolio.id);
    const positions = await storage.getPositionsByPortfolio(portfolio.id);
    
    // Get recent patterns (last 24 hours)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentPatterns = await storage.getPatternsSince(oneDayAgo);
    
    // Calculate closed trades only for PnL metrics
    const closedTrades = trades.filter(t => t.exitPrice !== null);
    const winningTrades = closedTrades.filter(t => 
      parseFloat(t.realizedPnL || '0') > 0
    );
    const losingTrades = closedTrades.filter(t => 
      parseFloat(t.realizedPnL || '0') < 0
    );
    
    const totalPnL = closedTrades.reduce((sum, t) => 
      sum + parseFloat(t.realizedPnL || '0'), 0
    );
    
    const avgProfitPerTrade = closedTrades.length > 0 
      ? totalPnL / closedTrades.length 
      : 0;
    
    const winRate = closedTrades.length > 0 
      ? (winningTrades.length / closedTrades.length) * 100 
      : 0;
    
    // Calculate current risk exposure (% of portfolio in positions)
    const totalValue = parseFloat(portfolio.totalValue || '0');
    const positionValue = positions
      .filter(p => parseFloat(p.amount) > 0)
      .reduce((sum, p) => sum + parseFloat(p.currentValue || '0'), 0);
    
    const currentRiskExposure = totalValue > 0 
      ? (positionValue / totalValue) * 100 
      : 0;
    
    // Determine profit trend (compare last 10 vs previous 10 trades)
    let profitTrend: 'improving' | 'declining' | 'stable' = 'stable';
    if (closedTrades.length >= 20) {
      const recent10 = closedTrades.slice(-10);
      const previous10 = closedTrades.slice(-20, -10);
      
      const recentAvg = recent10.reduce((sum, t) => 
        sum + parseFloat(t.realizedPnL || '0'), 0) / 10;
      const previousAvg = previous10.reduce((sum, t) => 
        sum + parseFloat(t.realizedPnL || '0'), 0) / 10;
      
      if (recentAvg > previousAvg * 1.2) profitTrend = 'improving';
      else if (recentAvg < previousAvg * 0.8) profitTrend = 'declining';
    }
    
    // Determine trading frequency
    let tradingFrequency = 'low';
    if (closedTrades.length > 0 && closedTrades[0].createdAt) {
      const daysSinceFirstTrade = (Date.now() - new Date(closedTrades[0].createdAt).getTime()) 
        / (1000 * 60 * 60 * 24);
      const tradesPerDay = closedTrades.length / Math.max(daysSinceFirstTrade, 1);
      
      if (tradesPerDay > 5) tradingFrequency = 'high';
      else if (tradesPerDay > 2) tradingFrequency = 'moderate';
    }
    
    return {
      portfolioId: portfolio.id,
      totalTrades: closedTrades.length,
      winningTrades: winningTrades.length,
      losingTrades: losingTrades.length,
      winRate,
      avgProfitPerTrade,
      totalPnL,
      currentRiskExposure,
      activePositions: positions.filter(p => parseFloat(p.amount) > 0).length,
      recentPatterns: recentPatterns.slice(0, 5), // Top 5 recent patterns
      tradingFrequency,
      profitTrend,
      riskLevel: portfolio.riskLevel || 'balanced',
    };
  }

  private async generatePerformanceInsight(metrics: PortfolioMetrics): Promise<AIInsightData | null> {
    try {
      const prompt = `Analyze this trading portfolio performance and provide actionable insights:

Portfolio Metrics:
- Total Trades: ${metrics.totalTrades}
- Win Rate: ${metrics.winRate.toFixed(2)}%
- Average Profit per Trade: $${metrics.avgProfitPerTrade.toFixed(2)}
- Total P&L: $${metrics.totalPnL.toFixed(2)}
- Profit Trend: ${metrics.profitTrend}
- Trading Frequency: ${metrics.tradingFrequency}
- Risk Level: ${metrics.riskLevel}

Provide a concise analysis in JSON format with:
1. title: Brief headline (max 60 chars)
2. description: Detailed analysis (2-3 sentences)
3. recommendation: Specific action to take (1-2 sentences)
4. confidence: Score from 0-100 (as a number)
5. priority: "low", "medium", "high", or "critical" (as a quoted string)

Example format:
{
  "title": "Strong Performance Trend",
  "description": "Portfolio shows consistent gains...",
  "recommendation": "Continue current strategy...",
  "confidence": 85,
  "priority": "medium"
}

Focus on:
- If win rate is below 50%, suggest specific improvements
- If profitable, recommend scaling strategies
- Identify best performing patterns to focus on
- Suggest optimal position sizes based on current performance`;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `You are an elite crypto trading AI assistant specialized in memecoin markets. Provide sharp, actionable insights that directly improve trading performance. Focus on:
- Specific entry/exit points
- Risk-reward ratios
- Position sizing recommendations
- Pattern-based predictions
Always respond with valid JSON only, no markdown formatting.`
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 500,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) return null;

      // Clean the response - remove markdown code blocks if present
      const cleanContent = content
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim();

      let aiResponse: any;
      try {
        aiResponse = JSON.parse(cleanContent);
      } catch (parseError) {
        console.error('Failed to parse AI response:', cleanContent);
        // Provide default values if JSON parsing fails
        aiResponse = {
          title: 'Performance Analysis',
          description: 'Unable to generate detailed analysis at this time.',
          recommendation: 'Please review your portfolio performance manually.',
          confidence: 50,
          priority: 'medium'
        };
      }
      
      // Ensure all required fields have values
      return {
        portfolioId: metrics.portfolioId,
        insightType: 'performance_summary',
        title: aiResponse.title || 'Performance Summary',
        description: aiResponse.description || 'Analysis of recent trading performance.',
        recommendation: aiResponse.recommendation || 'Continue monitoring portfolio performance.',
        confidence: (aiResponse.confidence || 50).toString(),
        priority: aiResponse.priority || 'medium',
        supportingData: {
          winRate: metrics.winRate,
          avgProfit: metrics.avgProfitPerTrade,
          totalPnL: metrics.totalPnL,
          profitTrend: metrics.profitTrend,
        },
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      };
    } catch (error) {
      console.error('❌ AI-INSIGHTS: Error generating performance insight:', error);
      return null;
    }
  }

  private async generateRiskInsight(metrics: PortfolioMetrics): Promise<AIInsightData | null> {
    try {
      const prompt = `Analyze this portfolio's risk exposure and provide risk management recommendations:

Risk Metrics:
- Current Risk Exposure: ${metrics.currentRiskExposure.toFixed(2)}% of portfolio
- Active Positions: ${metrics.activePositions}
- Risk Level Setting: ${metrics.riskLevel}
- Win Rate: ${metrics.winRate.toFixed(2)}%
- Average Loss per Losing Trade: $${(metrics.totalPnL / Math.max(metrics.losingTrades, 1)).toFixed(2)}

Provide a concise risk assessment in JSON format with:
1. title: Risk alert headline (max 60 chars)
2. description: Risk analysis (2-3 sentences)
3. recommendation: Specific risk mitigation action (1-2 sentences)
4. confidence: Score from 0-100 (as a number)
5. priority: "low", "medium", "high", or "critical" (as a quoted string)

Example format:
{
  "title": "Moderate Risk Exposure",
  "description": "Current positions are balanced...",
  "recommendation": "Maintain current risk levels...",
  "confidence": 75,
  "priority": "medium"
}

Focus on:
- Recommend specific stop-loss levels for current positions
- Suggest position size adjustments based on risk/reward
- Identify overexposed positions that need reduction
- Calculate optimal portfolio allocation percentages`;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `You are a risk management AI specialized in crypto trading. Your goal is to protect capital while maximizing returns. Focus on:
- Position sizing based on Kelly Criterion
- Stop-loss and take-profit levels
- Portfolio diversification
- Risk/reward optimization
Always respond with valid JSON only, no markdown formatting.`
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 500,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) return null;

      // Clean the response - remove markdown code blocks if present
      const cleanContent = content
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim();

      let aiResponse: any;
      try {
        aiResponse = JSON.parse(cleanContent);
      } catch (parseError) {
        console.error('Failed to parse AI response for risk:', cleanContent);
        // Provide default values if JSON parsing fails
        aiResponse = {
          title: 'Risk Assessment',
          description: 'Unable to generate detailed risk analysis at this time.',
          recommendation: 'Maintain current risk management practices.',
          confidence: 50,
          priority: 'medium'
        };
      }
      
      // Ensure all required fields have values
      return {
        portfolioId: metrics.portfolioId,
        insightType: 'risk_assessment',
        title: aiResponse.title || 'Risk Assessment',
        description: aiResponse.description || 'Analysis of current portfolio risk levels.',
        recommendation: aiResponse.recommendation || 'Monitor risk exposure carefully.',
        confidence: (aiResponse.confidence || 50).toString(),
        priority: aiResponse.priority || 'medium',
        supportingData: {
          riskExposure: metrics.currentRiskExposure,
          activePositions: metrics.activePositions,
          riskLevel: metrics.riskLevel,
        },
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      };
    } catch (error) {
      console.error('❌ AI-INSIGHTS: Error generating risk insight:', error);
      return null;
    }
  }

  private async generateOpportunityInsight(metrics: PortfolioMetrics): Promise<AIInsightData | null> {
    try {
      const topPatterns = metrics.recentPatterns
        .sort((a, b) => parseFloat(b.confidence || '0') - parseFloat(a.confidence || '0'))
        .slice(0, 3);

      const patternSummary = topPatterns.map(p => 
        `${p.patternType} (${parseFloat(p.confidence || '0').toFixed(0)}% confidence)`
      ).join(', ');

      const prompt = `Identify trading opportunities based on recent pattern detections:

Recent Patterns Detected:
${patternSummary}

Portfolio Context:
- Current Risk Exposure: ${metrics.currentRiskExposure.toFixed(2)}%
- Win Rate: ${metrics.winRate.toFixed(2)}%
- Risk Level: ${metrics.riskLevel}

Provide an opportunity analysis in JSON format with:
1. title: Opportunity headline (max 60 chars)
2. description: Opportunity analysis (2-3 sentences)
3. recommendation: Specific trading action (1-2 sentences)
4. confidence: Score from 0-100
5. priority: low, medium, high, or critical

Focus on:
- Name specific tokens showing strong patterns
- Provide exact entry price ranges (e.g., "Buy PEPE between $0.0012-$0.0013")
- Set clear profit targets and stop-losses
- Recommend position size as percentage of portfolio`;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `You are an AI pattern recognition expert for memecoin trading. Identify high-probability setups with:
- Specific token symbols to trade
- Exact entry price ranges
- Target prices and stop-losses
- Timeframe for the trade
Always respond with valid JSON only, no markdown formatting.`
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 500,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) return null;

      // Clean the response - remove markdown code blocks if present
      const cleanContent = content
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim();

      let aiResponse: any;
      try {
        aiResponse = JSON.parse(cleanContent);
      } catch (parseError) {
        console.error('Failed to parse AI response for opportunity:', cleanContent);
        // Provide default values if JSON parsing fails
        aiResponse = {
          title: 'Trading Opportunity',
          description: 'Potential trading opportunity detected.',
          recommendation: 'Review pattern signals before trading.',
          confidence: 50,
          priority: 'medium'
        };
      }
      
      // Ensure all required fields have values
      return {
        portfolioId: metrics.portfolioId,
        insightType: 'opportunity_alert',
        title: aiResponse.title || 'Trading Opportunity',
        description: aiResponse.description || 'New trading opportunity detected based on pattern analysis.',
        recommendation: aiResponse.recommendation || 'Review pattern signals and market conditions.',
        confidence: (aiResponse.confidence || 50).toString(),
        priority: aiResponse.priority || 'medium',
        supportingData: {
          patterns: topPatterns.map(p => ({
            type: p.patternType,
            confidence: parseFloat(p.confidence || '0'),
            token: p.tokenId,
          })),
        },
        expiresAt: new Date(Date.now() + 6 * 60 * 60 * 1000), // 6 hours
      };
    } catch (error) {
      console.error('❌ AI-INSIGHTS: Error generating opportunity insight:', error);
      return null;
    }
  }

  private async generateMarketTrendInsight(metrics: PortfolioMetrics): Promise<AIInsightData | null> {
    try {
      const prompt = `Provide a weekly market trend analysis for this memecoin trading portfolio:

Portfolio Performance:
- Total P&L: $${metrics.totalPnL.toFixed(2)}
- Win Rate: ${metrics.winRate.toFixed(2)}%
- Profit Trend: ${metrics.profitTrend}
- Trading Frequency: ${metrics.tradingFrequency}

Provide a market trend analysis in JSON format with:
1. title: Market trend headline (max 60 chars)
2. description: Trend analysis and market outlook (2-3 sentences)
3. recommendation: Strategic guidance for next week (1-2 sentences)
4. confidence: Score from 0-100
5. priority: low, medium, high, or critical

Focus on market conditions and strategic positioning.`;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `You are an AI market analyst specializing in memecoin trends. Provide insights on:
- Market sentiment shifts
- Volume and liquidity analysis
- Whale movements and smart money flow
- Upcoming catalysts and risks
Always respond with valid JSON only, no markdown formatting.`
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 500,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) return null;

      // Clean the response - remove markdown code blocks if present
      const cleanContent = content
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim();

      let aiResponse: any;
      try {
        aiResponse = JSON.parse(cleanContent);
      } catch (parseError) {
        console.error('Failed to parse AI response for market trend:', cleanContent);
        // Provide default values if JSON parsing fails
        aiResponse = {
          title: 'Market Trend Analysis',
          description: 'Market conditions analysis unavailable.',
          recommendation: 'Continue monitoring market conditions.',
          confidence: 50,
          priority: 'medium'
        };
      }
      
      // Ensure all required fields have values
      return {
        portfolioId: metrics.portfolioId,
        insightType: 'market_trend',
        title: aiResponse.title || 'Market Trend Analysis',
        description: aiResponse.description || 'Analysis of current market trends and conditions.',
        recommendation: aiResponse.recommendation || 'Monitor market trends and adapt strategy accordingly.',
        confidence: (aiResponse.confidence || 50).toString(),
        priority: aiResponse.priority || 'medium',
        supportingData: {
          totalPnL: metrics.totalPnL,
          profitTrend: metrics.profitTrend,
          tradingFrequency: metrics.tradingFrequency,
        },
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      };
    } catch (error) {
      console.error('❌ AI-INSIGHTS: Error generating market trend insight:', error);
      return null;
    }
  }
}

export const aiInsightsAnalyzer = new AIInsightsAnalyzer();
