import OpenAI from 'openai';
import type { Token, Pattern, PriceHistory } from '@shared/schema';

interface AIAnalysisResult {
  shouldTrade: boolean;
  confidence: number;
  reasoning: string[];
  riskFactors: string[];
  opportunities: string[];
  recommendedAction: 'strong_buy' | 'buy' | 'hold' | 'avoid';
}

class AIEntryAnalyzer {
  private openai: OpenAI | null = null;
  private isEnabled = false;

  constructor() {
    if (process.env.OPENAI_API_KEY) {
      this.openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });
      this.isEnabled = true;
      console.log('✅ AI Entry Analyzer initialized with OpenAI');
    } else {
      console.log('⚠️  AI Entry Analyzer disabled - no OpenAI API key');
    }
  }

  async analyzeTradeEntry(
    token: Token,
    pattern: Pattern,
    chartSignal: any,
    priceHistory: PriceHistory[],
    mlConfidence: number
  ): Promise<AIAnalysisResult> {
    if (!this.isEnabled || !this.openai) {
      return {
        shouldTrade: true,
        confidence: mlConfidence,
        reasoning: ['AI analysis not available'],
        riskFactors: [],
        opportunities: [],
        recommendedAction: mlConfidence > 75 ? 'buy' : 'hold',
      };
    }

    try {
      const currentPrice = parseFloat(token.currentPrice || '0');
      const priceChange24h = parseFloat(token.priceChange24h || '0');
      const volume24h = parseFloat(token.volume24h || '0');
      const marketCap = parseFloat(token.marketCap || '0');

      // FIXED: Handle empty or sparse price history gracefully
      const recentPrices = priceHistory.slice(-20).map(h => parseFloat(h.price)).filter(p => !isNaN(p) && p > 0);
      
      let priceVolatility = 0;
      let priceRange = {
        high: currentPrice,
        low: currentPrice,
        current: currentPrice,
      };
      
      // Only calculate volatility and range if we have sufficient price history
      if (recentPrices.length >= 2) {
        priceVolatility = this.calculateVolatility(recentPrices);
        priceRange = {
          high: Math.max(...recentPrices),
          low: Math.min(...recentPrices),
          current: currentPrice,
        };
      } else if (recentPrices.length === 1) {
        // Single price point - use it for range
        priceRange = {
          high: recentPrices[0],
          low: recentPrices[0],
          current: currentPrice,
        };
      }

      const prompt = `You are an expert cryptocurrency trader analyzing a potential trade entry. Evaluate this opportunity:

**Token: ${token.symbol} (${token.name})**
- Current Price: $${currentPrice}
- 24h Change: ${priceChange24h.toFixed(2)}%
- Market Cap: $${(marketCap / 1000000).toFixed(2)}M
- 24h Volume: $${(volume24h / 1000000).toFixed(2)}M
- Price Volatility: ${(priceVolatility * 100).toFixed(2)}%

**ML Pattern Detected:**
- Pattern Type: ${pattern.patternType}
- ML Confidence: ${mlConfidence.toFixed(1)}%
- Timeframe: ${pattern.timeframe}

**Chart Analysis:**
- Action: ${chartSignal?.action || 'N/A'}
- Chart Confidence: ${chartSignal?.confidence || 'N/A'}%
- Support Levels: ${chartSignal?.supportLevels?.slice(0, 2).map((s: number) => '$' + s.toFixed(6)).join(', ') || 'None'}
- Resistance Levels: ${chartSignal?.resistanceLevels?.slice(0, 2).map((r: number) => '$' + r.toFixed(6)).join(', ') || 'None'}
- Risk/Reward Ratio: ${chartSignal?.riskRewardRatio?.toFixed(2) || 'N/A'}:1

**Recent Price Action:**
- 20-period High: $${priceRange.high.toFixed(6)}
- 20-period Low: $${priceRange.low.toFixed(6)}
- Position in Range: ${priceRange.high === priceRange.low ? '50.0' : (((currentPrice - priceRange.low) / (priceRange.high - priceRange.low)) * 100).toFixed(1)}%

Provide a comprehensive trade analysis in JSON format:
{
  "shouldTrade": boolean,
  "confidence": number (0-100),
  "reasoning": ["reason1", "reason2", "reason3"],
  "riskFactors": ["risk1", "risk2"],
  "opportunities": ["opportunity1", "opportunity2"],
  "recommendedAction": "strong_buy" | "buy" | "hold" | "avoid"
}

Consider:
1. Pattern reliability and confluence with chart signals
2. Market cap and liquidity (volume/mcap ratio)
3. Entry timing relative to support/resistance
4. Risk/reward ratio adequacy
5. Volatility appropriateness for high-frequency trading
6. Overall market conditions implied by price action`;

      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are an expert cryptocurrency trading analyst. Provide precise, data-driven analysis in valid JSON format only. Be conservative with confidence scores - only recommend strong_buy when multiple factors strongly align.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.3,
        max_tokens: 600,
        response_format: { type: 'json_object' },
      });

      const analysisText = completion.choices[0].message.content;
      if (!analysisText) {
        throw new Error('No response from OpenAI');
      }

      const analysis = JSON.parse(analysisText) as AIAnalysisResult;

      console.log(`🤖 AI-ENTRY-ANALYZER: ${token.symbol} - ${analysis.recommendedAction.toUpperCase()} (${analysis.confidence.toFixed(1)}% confidence)`);
      console.log(`   💡 Reasoning: ${analysis.reasoning.join('; ')}`);
      if (analysis.riskFactors.length > 0) {
        console.log(`   ⚠️  Risks: ${analysis.riskFactors.join('; ')}`);
      }

      return analysis;
    } catch (error) {
      console.error('❌ AI Entry Analyzer error:', error);
      return {
        shouldTrade: true,
        confidence: mlConfidence,
        reasoning: ['AI analysis failed, using ML confidence only'],
        riskFactors: ['AI analysis unavailable'],
        opportunities: [],
        recommendedAction: mlConfidence > 75 ? 'buy' : 'hold',
      };
    }
  }

  private calculateVolatility(prices: number[]): number {
    if (prices.length < 2) return 0;
    
    const returns = [];
    for (let i = 1; i < prices.length; i++) {
      returns.push((prices[i] - prices[i - 1]) / prices[i - 1]);
    }
    
    const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
    
    return Math.sqrt(variance);
  }
}

export const aiEntryAnalyzer = new AIEntryAnalyzer();
