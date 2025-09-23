import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  DollarSign, 
  TrendingUp, 
  TrendingDown, 
  Target, 
  Percent,
  PieChart,
  BarChart3,
  Activity
} from "lucide-react";

interface PortfolioAnalytics {
  totalValue: number;
  totalPnL: number;
  totalPnLPercent: number;
  dayChange: number;
  positionsCount: number;
  topPerformers: Array<{
    symbol: string;
    value: number;
    pnlPercent: number;
  }>;
  riskMetrics: {
    concentration: number;
    diversification: number;
    volatility: number;
  };
}

interface Position {
  symbol: string;
  currentPrice: number;
  quantity: number;
  value: number;
  pnl: number;
  pnlPercent: number;
  allocationPercent: number;
}

interface PositionAnalyticsProps {
  portfolioAnalytics: PortfolioAnalytics | null;
  positions: Position[];
  isLoading?: boolean;
  error?: any;
}

export function PositionAnalytics({ portfolioAnalytics, positions, isLoading, error }: PositionAnalyticsProps) {
  const formatCurrency = (amount: number) => {
    if (typeof amount !== 'number' || isNaN(amount)) return '$0.00';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const formatPercentage = (percent: number) => {
    if (typeof percent !== 'number' || isNaN(percent)) return '0.00%';
    const sign = percent >= 0 ? '+' : '';
    return `${sign}${percent.toFixed(2)}%`;
  };

  const getPnLColor = (percent: number) => {
    return percent >= 0 ? 'text-green-400' : 'text-red-400';
  };

  const getRiskColor = (value: number) => {
    if (value < 30) return 'text-green-400';
    if (value < 60) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getRiskLevel = (concentration: number) => {
    if (concentration < 30) return 'Low';
    if (concentration < 60) return 'Medium';
    return 'High';
  };

  // Handle rate limiting or API errors
  if (error) {
    const statusCode = error?.response?.status || error?.status;
    const isRateLimited = statusCode === 429 || error.message?.includes('429') || error.message?.includes('Too Many Requests');
    const isServerError = statusCode >= 500 || error.message?.includes('500') || error.message?.includes('Failed to fetch');
    
    return (
      <div className="flex items-center justify-center p-8" data-testid="analytics-error">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 mx-auto bg-red-500/10 rounded-full flex items-center justify-center">
            <Activity className="w-8 h-8 text-red-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold mb-2">
              {isRateLimited ? 'Rate Limited' : 'Analytics Unavailable'}
            </h3>
            <p className="text-muted-foreground text-sm mb-4">
              {isRateLimited 
                ? 'API rate limit reached. Analytics will reload automatically when available.'
                : isServerError
                ? 'Server error loading analytics. Please try again in a moment.'
                : 'Unable to load portfolio analytics at this time.'
              }
            </p>
            {isRateLimited && (
              <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3">
                <p className="text-xs text-yellow-400">
                  🕒 High traffic detected. Retrying automatically...
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Handle loading state
  if (isLoading || !portfolioAnalytics) {
    return (
      <div className="flex items-center justify-center p-8" data-testid="analytics-loading">
        <div className="text-center">
          <Activity className="w-8 h-8 mx-auto mb-2 animate-pulse text-muted-foreground" />
          <p className="text-muted-foreground">Loading portfolio analytics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="position-analytics">
      {/* Portfolio Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card data-testid="analytics-total-value">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Value</p>
                <p className="text-2xl font-bold" data-testid="text-total-value">
                  {formatCurrency(portfolioAnalytics.totalValue)}
                </p>
              </div>
              <DollarSign className="w-8 h-8 text-primary opacity-70" />
            </div>
            <p className={`text-sm mt-2 ${getPnLColor(portfolioAnalytics.dayChange)}`}>
              {formatPercentage(portfolioAnalytics.dayChange)} today
            </p>
          </CardContent>
        </Card>

        <Card data-testid="analytics-total-pnl">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total P&L</p>
                <p className={`text-2xl font-bold ${getPnLColor(portfolioAnalytics.totalPnLPercent)}`} data-testid="text-total-pnl">
                  {formatCurrency(portfolioAnalytics.totalPnL)}
                </p>
              </div>
              {portfolioAnalytics.totalPnLPercent >= 0 ? 
                <TrendingUp className="w-8 h-8 text-green-400" /> : 
                <TrendingDown className="w-8 h-8 text-red-400" />}
            </div>
            <p className={`text-sm mt-2 ${getPnLColor(portfolioAnalytics.totalPnLPercent)}`}>
              {formatPercentage(portfolioAnalytics.totalPnLPercent)} overall
            </p>
          </CardContent>
        </Card>

        <Card data-testid="analytics-positions-count">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active Positions</p>
                <p className="text-2xl font-bold" data-testid="text-positions-count">
                  {portfolioAnalytics.positionsCount}
                </p>
              </div>
              <Target className="w-8 h-8 text-blue-400 opacity-70" />
            </div>
            <p className="text-sm mt-2 text-muted-foreground">
              Diversified holdings
            </p>
          </CardContent>
        </Card>

        <Card data-testid="analytics-diversification">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Portfolio Risk</p>
                <p className={`text-2xl font-bold ${getRiskColor(portfolioAnalytics.riskMetrics.concentration)}`} data-testid="text-risk-level">
                  {getRiskLevel(portfolioAnalytics.riskMetrics.concentration)}
                </p>
              </div>
              <Percent className="w-8 h-8 text-orange-400 opacity-70" />
            </div>
            <p className="text-sm mt-2 text-muted-foreground">
              {portfolioAnalytics.riskMetrics.concentration.toFixed(1)}% max concentration
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Top Performers */}
      <Card data-testid="card-top-performers">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <TrendingUp className="w-5 h-5" />
            <span>Top Performers</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {portfolioAnalytics.topPerformers.map((performer, index) => (
              <div key={performer.symbol} className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg" data-testid={`top-performer-${performer.symbol}`}>
                <div className="flex items-center space-x-3">
                  <Badge variant="outline" className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold">
                    {index + 1}
                  </Badge>
                  <div>
                    <p className="font-medium" data-testid={`text-performer-symbol-${performer.symbol}`}>{performer.symbol}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatCurrency(performer.value)}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`font-medium ${getPnLColor(performer.pnlPercent)}`} data-testid={`text-performer-pnl-${performer.symbol}`}>
                    {formatPercentage(performer.pnlPercent)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Position Details */}
      <Card data-testid="card-position-details">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <BarChart3 className="w-5 h-5" />
            <span>Position Details</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {positions.length === 0 ? (
            <div className="text-center py-8">
              <Target className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">No positions to analyze</p>
              <p className="text-sm text-muted-foreground">Start trading to see position analytics</p>
            </div>
          ) : (
            <div className="space-y-4">
              {positions.map((position) => (
              <div key={position.symbol} className="flex items-center justify-between p-4 border rounded-lg" data-testid={`position-${position.symbol}`}>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium" data-testid={`text-position-symbol-${position.symbol}`}>{position.symbol}</h4>
                    <div className="text-right">
                      <p className="font-medium" data-testid={`text-position-value-${position.symbol}`}>
                        {formatCurrency(position.value)}
                      </p>
                      <p className={`text-sm ${getPnLColor(position.pnlPercent)}`} data-testid={`text-position-pnl-${position.symbol}`}>
                        {formatPercentage(position.pnlPercent)}
                      </p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 text-sm text-muted-foreground">
                    <div>
                      <p>Quantity: {position.quantity.toFixed(8)}</p>
                      <p>Price: {formatCurrency(position.currentPrice)}</p>
                    </div>
                    <div className="text-right">
                      <p>Allocation: {position.allocationPercent.toFixed(1)}%</p>
                      <p>P&L: {formatCurrency(position.pnl)}</p>
                    </div>
                  </div>
                  
                  <div className="mt-2">
                    <Progress 
                      value={position.allocationPercent} 
                      className="h-2" 
                      data-testid={`progress-allocation-${position.symbol}`}
                    />
                  </div>
                </div>
              </div>
            ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Risk Metrics */}
      <Card data-testid="card-risk-metrics">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <PieChart className="w-5 h-5" />
            <span>Risk Analysis</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="mb-2">
                <p className="text-sm text-muted-foreground">Concentration</p>
                <p className={`text-2xl font-bold ${getRiskColor(portfolioAnalytics.riskMetrics.concentration)}`}>
                  {portfolioAnalytics.riskMetrics.concentration.toFixed(1)}%
                </p>
              </div>
              <div className="flex justify-center">
                <Badge 
                  variant={portfolioAnalytics.riskMetrics.concentration < 30 ? 'default' : 'destructive'}
                  className={getRiskColor(portfolioAnalytics.riskMetrics.concentration)}
                >
                  {getRiskLevel(portfolioAnalytics.riskMetrics.concentration)} Risk
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Maximum single position
              </p>
            </div>

            <div className="text-center">
              <div className="mb-2">
                <p className="text-sm text-muted-foreground">Diversification</p>
                <p className="text-2xl font-bold text-blue-400">
                  {portfolioAnalytics.riskMetrics.diversification}
                </p>
              </div>
              <div className="flex justify-center">
                <Badge variant="outline" className="text-blue-400">
                  {portfolioAnalytics.riskMetrics.diversification > 5 ? 'Well Diversified' : 'Concentrated'}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Active positions
              </p>
            </div>

            <div className="text-center">
              <div className="mb-2">
                <p className="text-sm text-muted-foreground">Volatility</p>
                <p className={`text-2xl font-bold ${getRiskColor(portfolioAnalytics.riskMetrics.volatility)}`}>
                  {portfolioAnalytics.riskMetrics.volatility.toFixed(1)}%
                </p>
              </div>
              <Progress value={Math.min(portfolioAnalytics.riskMetrics.volatility, 100)} className="h-2" />
              <p className="text-xs text-muted-foreground mt-1">
                Portfolio volatility
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}