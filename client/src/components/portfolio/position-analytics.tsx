import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { TrendingUp, TrendingDown, DollarSign, Percent, Clock, Target } from 'lucide-react';

interface PositionAnalytics {
  positionId: string;
  tokenSymbol: string;
  currentValue: string;
  unrealizedPnL: string;
  unrealizedPnLPercent: number;
  costBasis: string;
  allocation: number;
  dayChange: number;
  dayChangeValue: string;
  holdingPeriod: number;
}

interface PortfolioAnalytics {
  portfolioId: string;
  userId: string;
  totalValue: string;
  totalPnL: string;
  totalPnLPercent: number;
  dayChange: number;
  dayChangeValue: string;
  positionsCount: number;
  topPerformers: Array<{
    symbol: string;
    pnlPercent: number;
    value: string;
  }>;
  riskMetrics: {
    concentration: number;
    diversification: number;
    volatility: number;
  };
}

interface PositionAnalyticsProps {
  positions: PositionAnalytics[];
  portfolioAnalytics: PortfolioAnalytics | null;
}

export function PositionAnalytics({ positions, portfolioAnalytics }: PositionAnalyticsProps) {
  const formatCurrency = (value: string | number) => {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(num);
  };

  const formatPercentage = (value: number) => {
    return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
  };

  const getPnLColor = (value: number) => {
    if (value > 0) return 'text-green-400';
    if (value < 0) return 'text-red-400';
    return 'text-muted-foreground';
  };

  const getRiskColor = (risk: number) => {
    if (risk < 30) return 'text-green-400';
    if (risk < 70) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getRiskLevel = (risk: number) => {
    if (risk < 30) return 'Low';
    if (risk < 70) return 'Medium';
    return 'High';
  };

  if (!portfolioAnalytics) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="p-6">
            <div className="text-center text-muted-foreground">
              <DollarSign className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Loading portfolio analytics...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
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
                <TrendingDown className="w-8 h-8 text-red-400" />
              }
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
            <DollarSign className="w-5 h-5" />
            <span>Position Analytics</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {positions.map((position) => (
              <div key={position.positionId} className="p-4 bg-secondary/20 rounded-lg border" data-testid={`position-detail-${position.tokenSymbol}`}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full flex items-center justify-center">
                      <span className="text-white font-bold text-sm">{position.tokenSymbol.slice(0, 2)}</span>
                    </div>
                    <div>
                      <h3 className="font-semibold" data-testid={`text-position-symbol-${position.tokenSymbol}`}>{position.tokenSymbol}</h3>
                      <p className="text-sm text-muted-foreground">
                        {position.allocation.toFixed(1)}% of portfolio
                      </p>
                    </div>
                  </div>
                  <Badge variant={position.unrealizedPnLPercent >= 0 ? "default" : "destructive"}>
                    {formatPercentage(position.unrealizedPnLPercent)}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Current Value</p>
                    <p className="font-semibold" data-testid={`text-position-value-${position.tokenSymbol}`}>
                      {formatCurrency(position.currentValue)}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">P&L</p>
                    <p className={`font-semibold ${getPnLColor(position.unrealizedPnLPercent)}`} data-testid={`text-position-pnl-${position.tokenSymbol}`}>
                      {formatCurrency(position.unrealizedPnL)}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Cost Basis</p>
                    <p className="font-semibold">
                      {formatCurrency(position.costBasis)}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Days Held</p>
                    <p className="font-semibold flex items-center space-x-1">
                      <Clock className="w-4 h-4" />
                      <span>{position.holdingPeriod}</span>
                    </p>
                  </div>
                </div>

                <div className="mt-3">
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span>Portfolio Allocation</span>
                    <span>{position.allocation.toFixed(1)}%</span>
                  </div>
                  <Progress value={position.allocation} className="h-2" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Risk Metrics */}
      <Card data-testid="card-risk-metrics">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Target className="w-5 h-5" />
            <span>Risk Analysis</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="mb-2">
                <p className="text-sm text-muted-foreground">Concentration Risk</p>
                <p className={`text-2xl font-bold ${getRiskColor(portfolioAnalytics.riskMetrics.concentration)}`}>
                  {portfolioAnalytics.riskMetrics.concentration.toFixed(1)}%
                </p>
              </div>
              <Progress value={portfolioAnalytics.riskMetrics.concentration} className="h-2" />
              <p className="text-xs text-muted-foreground mt-1">
                {getRiskLevel(portfolioAnalytics.riskMetrics.concentration)} Risk
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