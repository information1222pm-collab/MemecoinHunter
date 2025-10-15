export type RiskLevel = 'conservative' | 'moderate' | 'balanced' | 'aggressive' | 'very_aggressive';

export interface RiskLevelConfig {
  level: RiskLevel;
  displayName: string;
  description: string;
  color: string;
  icon: string;
  
  // Position Sizing
  kellyMultiplier: number;
  maxPositionSizePercent: number;
  minCashPercentage: number;
  
  // Confidence & Quality Filters
  minConfidence: number;
  minRiskRewardRatio: number;
  minPatternWinRate: number;
  
  // Risk Management
  stopLossPercentage: number;
  maxDailyLossPercentage: number;
  maxOpenPositions: number;
  
  // Take Profit Strategy
  takeProfitStages: number[];
  finalTakeProfitPercent: number;
  
  // Market Health Requirements
  minMarketHealthScore: number;
  marketHealthMultiplier: number;
  
  // Advanced Settings
  volatilityTolerance: number;
  maxConcentration: number;
  aggressiveSellThreshold: number;
}

export const RISK_LEVEL_CONFIGS: Record<RiskLevel, RiskLevelConfig> = {
  conservative: {
    level: 'conservative',
    displayName: 'Conservative',
    description: 'Minimal risk, steady growth. Perfect for risk-averse traders.',
    color: 'green',
    icon: '🛡️',
    
    // Position Sizing - Very cautious
    kellyMultiplier: 0.5,
    maxPositionSizePercent: 5,
    minCashPercentage: 25,
    
    // Confidence & Quality - High standards
    minConfidence: 85,
    minRiskRewardRatio: 2.0,
    minPatternWinRate: 0.65,
    
    // Risk Management - Tight stops
    stopLossPercentage: 3,
    maxDailyLossPercentage: 2,
    maxOpenPositions: 8,
    
    // Take Profit - Quick wins
    takeProfitStages: [4, 7, 10],
    finalTakeProfitPercent: 10,
    
    // Market Health - Only trade in healthy markets
    minMarketHealthScore: 70,
    marketHealthMultiplier: 1.0,
    
    // Advanced
    volatilityTolerance: 0.6,
    maxConcentration: 15,
    aggressiveSellThreshold: 1.5,
  },
  
  moderate: {
    level: 'moderate',
    displayName: 'Moderate',
    description: 'Balanced approach with controlled risk. Good for cautious traders.',
    color: 'blue',
    icon: '⚖️',
    
    // Position Sizing - Moderate allocation
    kellyMultiplier: 0.75,
    maxPositionSizePercent: 8,
    minCashPercentage: 20,
    
    // Confidence & Quality - Good standards
    minConfidence: 78,
    minRiskRewardRatio: 1.8,
    minPatternWinRate: 0.58,
    
    // Risk Management - Standard stops
    stopLossPercentage: 4,
    maxDailyLossPercentage: 3,
    maxOpenPositions: 10,
    
    // Take Profit - Balanced targets
    takeProfitStages: [5, 9, 13],
    finalTakeProfitPercent: 13,
    
    // Market Health - Decent market conditions
    minMarketHealthScore: 60,
    marketHealthMultiplier: 1.0,
    
    // Advanced
    volatilityTolerance: 0.75,
    maxConcentration: 20,
    aggressiveSellThreshold: 2.0,
  },
  
  balanced: {
    level: 'balanced',
    displayName: 'Balanced',
    description: 'Optimal risk-reward balance. Recommended for most traders.',
    color: 'yellow',
    icon: '⚡',
    
    // Position Sizing - Standard allocation
    kellyMultiplier: 1.0,
    maxPositionSizePercent: 10,
    minCashPercentage: 15,
    
    // Confidence & Quality - Reasonable standards
    minConfidence: 72,
    minRiskRewardRatio: 1.5,
    minPatternWinRate: 0.52,
    
    // Risk Management - Moderate stops
    stopLossPercentage: 5,
    maxDailyLossPercentage: 4,
    maxOpenPositions: 12,
    
    // Take Profit - Standard targets
    takeProfitStages: [6, 11, 16],
    finalTakeProfitPercent: 16,
    
    // Market Health - Fair market conditions
    minMarketHealthScore: 50,
    marketHealthMultiplier: 1.0,
    
    // Advanced
    volatilityTolerance: 1.0,
    maxConcentration: 25,
    aggressiveSellThreshold: 2.5,
  },
  
  aggressive: {
    level: 'aggressive',
    displayName: 'Aggressive',
    description: 'Higher risk for higher rewards. For experienced traders.',
    color: 'orange',
    icon: '🔥',
    
    // Position Sizing - Larger positions
    kellyMultiplier: 1.5,
    maxPositionSizePercent: 15,
    minCashPercentage: 10,
    
    // Confidence & Quality - Relaxed standards
    minConfidence: 65,
    minRiskRewardRatio: 1.3,
    minPatternWinRate: 0.48,
    
    // Risk Management - Wider stops
    stopLossPercentage: 6,
    maxDailyLossPercentage: 6,
    maxOpenPositions: 15,
    
    // Take Profit - Ambitious targets
    takeProfitStages: [8, 14, 22],
    finalTakeProfitPercent: 22,
    
    // Market Health - More tolerant
    minMarketHealthScore: 40,
    marketHealthMultiplier: 0.8,
    
    // Advanced
    volatilityTolerance: 1.3,
    maxConcentration: 30,
    aggressiveSellThreshold: 3.0,
  },
  
  very_aggressive: {
    level: 'very_aggressive',
    displayName: 'Very Aggressive',
    description: 'Maximum risk, maximum potential. Only for risk-tolerant experts.',
    color: 'red',
    icon: '🚀',
    
    // Position Sizing - Maximum allocation
    kellyMultiplier: 2.0,
    maxPositionSizePercent: 20,
    minCashPercentage: 5,
    
    // Confidence & Quality - Minimal filters
    minConfidence: 58,
    minRiskRewardRatio: 1.1,
    minPatternWinRate: 0.42,
    
    // Risk Management - Wide stops
    stopLossPercentage: 8,
    maxDailyLossPercentage: 8,
    maxOpenPositions: 20,
    
    // Take Profit - Extreme targets
    takeProfitStages: [10, 18, 30],
    finalTakeProfitPercent: 30,
    
    // Market Health - Trade in any conditions
    minMarketHealthScore: 30,
    marketHealthMultiplier: 0.5,
    
    // Advanced
    volatilityTolerance: 1.5,
    maxConcentration: 40,
    aggressiveSellThreshold: 4.0,
  },
};

export function getRiskLevelConfig(level: RiskLevel): RiskLevelConfig {
  return RISK_LEVEL_CONFIGS[level] || RISK_LEVEL_CONFIGS.balanced;
}

export function getAllRiskLevels(): RiskLevelConfig[] {
  return Object.values(RISK_LEVEL_CONFIGS);
}

export function isValidRiskLevel(level: string): level is RiskLevel {
  return level in RISK_LEVEL_CONFIGS;
}

export function getRiskLevelDisplay(level: RiskLevel): { name: string; emoji: string; color: string } {
  const config = getRiskLevelConfig(level);
  return {
    name: config.displayName,
    emoji: config.icon,
    color: config.color,
  };
}

export function getRecommendedRiskLevel(
  experience: 'beginner' | 'intermediate' | 'advanced',
  riskTolerance: 'low' | 'medium' | 'high'
): RiskLevel {
  if (riskTolerance === 'low') return 'conservative';
  if (riskTolerance === 'high' && experience === 'advanced') return 'very_aggressive';
  if (riskTolerance === 'high') return 'aggressive';
  if (experience === 'beginner') return 'moderate';
  return 'balanced';
}
