import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/hooks/use-language";
import { TrendingUp, TrendingDown, BarChart3, PieChart, Activity, AlertTriangle, Target, Zap } from "lucide-react";

export default function Analytics() {
  const { t } = useLanguage();

  // Mock analytics data
  const performanceMetrics = {
    totalReturn: 18.5,
    sharpeRatio: 1.84,
    maxDrawdown: -12.3,
    volatility: 24.7,
    winRate: 73.2,
    avgWin: 8.4,
    avgLoss: -3.2,
    profitFactor: 2.1,
  };

  const topPerformers = [
    { symbol: "PEPE", return: 187.3, allocation: 32.9 },
    { symbol: "FLOKI", return: 45.8, allocation: 14.7 },
    { symbol: "DOGE", return: 23.7, allocation: 22.1 },
    { symbol: "BONK", return: 12.4, allocation: 13.0 },
    { symbol: "WIF", return: -8.2, allocation: 17.3 },
  ];

  const riskMetrics = {
    portfolioRisk: "Medium",
    concentrationRisk: "High",
    correlationRisk: "Low",
    liquidityRisk: "Medium",
  };

  const formatPercentage = (value: number) => {
    return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
  };

  const getRiskColor = (risk: string) => {
    switch (risk.toLowerCase()) {
      case 'low': return 'text-green-400';
      case 'medium': return 'text-yellow-400';
      case 'high': return 'text-red-400';
      default: return 'text-muted-foreground';
    }
  };

  const getRiskBadgeVariant = (risk: string) => {
    switch (risk.toLowerCase()) {
      case 'low': return 'default';
      case 'medium': return 'secondary';
      case 'high': return 'destructive';
      default: return 'outline';
    }
  };

  return (
    <div className="min-h-screen flex bg-background">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <Header />
        
        <div className="p-6 space-y-6">
          {/* Page Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold" data-testid="text-page-title">{t("analytics.title")}</h1>
              <p className="text-muted-foreground mt-1">Comprehensive portfolio analysis and insights</p>
            </div>
            <div className="flex space-x-2">
              <Button variant="outline" size="sm" data-testid="button-export">
                Export Report
              </Button>
              <Button size="sm" data-testid="button-refresh-analytics">
                Refresh Data
              </Button>
            </div>
          </div>

          {/* Performance Overview */}
          <Card data-testid="card-performance-overview">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <BarChart3 className="w-5 h-5" />
                <span>{t("analytics.performance")}</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <div className="text-center" data-testid="metric-total-return">
                  <div className="text-2xl font-bold text-price-up">
                    {formatPercentage(performanceMetrics.totalReturn)}
                  </div>
                  <div className="text-sm text-muted-foreground">Total Return</div>
                </div>
                <div className="text-center" data-testid="metric-sharpe-ratio">
                  <div className="text-2xl font-bold">
                    {performanceMetrics.sharpeRatio}
                  </div>
                  <div className="text-sm text-muted-foreground">Sharpe Ratio</div>
                </div>
                <div className="text-center" data-testid="metric-max-drawdown">
                  <div className="text-2xl font-bold text-price-down">
                    {formatPercentage(performanceMetrics.maxDrawdown)}
                  </div>
                  <div className="text-sm text-muted-foreground">Max Drawdown</div>
                </div>
                <div className="text-center" data-testid="metric-volatility">
                  <div className="text-2xl font-bold">
                    {formatPercentage(performanceMetrics.volatility)}
                  </div>
                  <div className="text-sm text-muted-foreground">Volatility</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Trading Statistics */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card data-testid="card-trading-stats">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Activity className="w-5 h-5" />
                  <span>Trading Statistics</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-4 bg-secondary/20 rounded-lg" data-testid="stat-win-rate">
                    <div className="text-xl font-bold text-price-up">
                      {formatPercentage(performanceMetrics.winRate)}
                    </div>
                    <div className="text-sm text-muted-foreground">Win Rate</div>
                  </div>
                  <div className="text-center p-4 bg-secondary/20 rounded-lg" data-testid="stat-profit-factor">
                    <div className="text-xl font-bold">
                      {performanceMetrics.profitFactor}x
                    </div>
                    <div className="text-sm text-muted-foreground">Profit Factor</div>
                  </div>
                  <div className="text-center p-4 bg-secondary/20 rounded-lg" data-testid="stat-avg-win">
                    <div className="text-xl font-bold text-price-up">
                      {formatPercentage(performanceMetrics.avgWin)}
                    </div>
                    <div className="text-sm text-muted-foreground">Avg Win</div>
                  </div>
                  <div className="text-center p-4 bg-secondary/20 rounded-lg" data-testid="stat-avg-loss">
                    <div className="text-xl font-bold text-price-down">
                      {formatPercentage(performanceMetrics.avgLoss)}
                    </div>
                    <div className="text-sm text-muted-foreground">Avg Loss</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card data-testid="card-risk-analysis">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <AlertTriangle className="w-5 h-5" />
                  <span>{t("analytics.riskAnalysis")}</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between" data-testid="risk-portfolio">
                    <span className="text-sm">Portfolio Risk</span>
                    <Badge variant={getRiskBadgeVariant(riskMetrics.portfolioRisk)}>
                      {riskMetrics.portfolioRisk}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between" data-testid="risk-concentration">
                    <span className="text-sm">Concentration Risk</span>
                    <Badge variant={getRiskBadgeVariant(riskMetrics.concentrationRisk)}>
                      {riskMetrics.concentrationRisk}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between" data-testid="risk-correlation">
                    <span className="text-sm">Correlation Risk</span>
                    <Badge variant={getRiskBadgeVariant(riskMetrics.correlationRisk)}>
                      {riskMetrics.correlationRisk}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between" data-testid="risk-liquidity">
                    <span className="text-sm">Liquidity Risk</span>
                    <Badge variant={getRiskBadgeVariant(riskMetrics.liquidityRisk)}>
                      {riskMetrics.liquidityRisk}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Top Performers */}
          <Card data-testid="card-top-performers">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Target className="w-5 h-5" />
                <span>{t("analytics.topPerformers")}</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {topPerformers.map((token, index) => (
                  <div
                    key={token.symbol}
                    className="flex items-center justify-between p-4 bg-secondary/20 rounded-lg"
                    data-testid={`performer-${token.symbol}`}
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-gradient-to-br from-orange-400 to-red-500 rounded-full flex items-center justify-center">
                        <span className="text-xs font-bold text-white">#{index + 1}</span>
                      </div>
                      <div>
                        <div className="font-medium" data-testid={`text-performer-symbol-${token.symbol}`}>
                          {token.symbol}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {token.allocation}% allocation
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`font-medium ${token.return >= 0 ? 'text-price-up' : 'text-price-down'}`} data-testid={`text-performer-return-${token.symbol}`}>
                        {formatPercentage(token.return)}
                      </div>
                      {token.return >= 0 ? (
                        <TrendingUp className="w-4 h-4 text-price-up ml-auto" />
                      ) : (
                        <TrendingDown className="w-4 h-4 text-price-down ml-auto" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Performance Chart Placeholder */}
          <Card data-testid="card-performance-chart">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <PieChart className="w-5 h-5" />
                <span>Portfolio Performance Chart</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64 flex items-center justify-center bg-secondary/20 rounded-lg">
                <div className="text-center">
                  <BarChart3 className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                  <p className="text-lg font-medium text-muted-foreground">Interactive Charts Coming Soon</p>
                  <p className="text-sm text-muted-foreground">Advanced portfolio analytics and visualizations</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* AI Insights */}
          <Card data-testid="card-ai-insights">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Zap className="w-5 h-5" />
                <span>AI Insights & Recommendations</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="p-4 bg-primary/10 border border-primary/20 rounded-lg" data-testid="insight-diversification">
                  <div className="flex items-center space-x-2 mb-2">
                    <div className="w-2 h-2 bg-primary rounded-full"></div>
                    <span className="text-sm font-medium text-primary">Portfolio Diversification</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Consider reducing PEPE allocation (32.9%) to improve diversification. Recommended max allocation: 25%.
                  </p>
                </div>
                
                <div className="p-4 bg-accent/10 border border-accent/20 rounded-lg" data-testid="insight-rebalancing">
                  <div className="flex items-center space-x-2 mb-2">
                    <div className="w-2 h-2 bg-accent rounded-full"></div>
                    <span className="text-sm font-medium text-accent">Rebalancing Opportunity</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    WIF showing oversold conditions. Consider dollar-cost averaging into position over next 7 days.
                  </p>
                </div>
                
                <div className="p-4 bg-green-400/10 border border-green-400/20 rounded-lg" data-testid="insight-performance">
                  <div className="flex items-center space-x-2 mb-2">
                    <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                    <span className="text-sm font-medium text-green-400">Strong Performance</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Portfolio outperforming memecoin index by 12.3% this month. Current strategy showing effectiveness.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
