import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/hooks/use-language";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useWebSocket } from "@/hooks/use-websocket";
import { useEffect } from "react";
import { TrendingUp, TrendingDown, BarChart3, PieChart, Activity, AlertTriangle, Target, Zap, RefreshCw } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function Analytics() {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const { isConnected, lastMessage } = useWebSocket();

  // Fetch real analytics data from API with error handling
  const { data: autoTraderStats, error: autoTraderError } = useQuery<{
    portfolioId: string;
    totalValue: number;
    totalPositionValue: number;
    availableCash: number;
    totalTrades: number;
    buyTrades: number;
    sellTrades: number;
    activePositions: number;
    positions: Array<{
      tokenId: string;
      symbol: string;
      amount: number;
      avgBuyPrice: number;
      currentPrice: number;
      positionValue: number;
      profitLoss: number;
    }>;
    winRate: string;
  }>({
    queryKey: ['/api/auto-trader/portfolio'],
    refetchInterval: 30000,
    retry: false, // Don't retry on 401 errors
  });

  const { data: riskAnalysis, isLoading: riskLoading, error: riskError } = useQuery<{
    portfolioRisk: string;
    riskScore: number;
    volatility: number;
    diversificationScore: number;
    concentrationRisk: string;
    maxDrawdown: number;
    sharpeRatio: number;
  }>({
    queryKey: ['/api/risk/portfolio', autoTraderStats?.portfolioId],
    enabled: !!autoTraderStats?.portfolioId,
    refetchInterval: 60000,
    retry: false, // Don't retry on 401 errors
  });

  const { data: portfolio, isLoading: portfolioLoading, error: portfolioError } = useQuery<{
    totalValue: string;
    dailyPnL: string;
    totalPnL: string;
    winRate: string;
    positions: Array<{
      token: { symbol: string; name: string; };
      currentValue: string;
      unrealizedPnL: string;
    }>;
  }>({
    queryKey: ['/api/portfolio', 'default'],
    refetchInterval: 30000,
    retry: false, // Don't retry on 401 errors
  });

  const { data: trades, error: tradesError } = useQuery<Array<{
    id: string;
    type: string;
    realizedPnL: string;
    totalValue: string;
  }>>({ 
    queryKey: ['/api/portfolio', 'default', 'trades'],
    refetchInterval: 60000,
    retry: false, // Don't retry on 401 errors
  });

  // Check if user is authenticated (401 errors indicate unauthenticated)
  // React Query errors can have different structures depending on the fetcher
  const hasAuthError = (error: any) => {
    if (!error) return false;
    // Check multiple possible error structures
    return (
      error?.response?.status === 401 ||
      error?.status === 401 ||
      (error?.message && error.message.includes('401')) ||
      (error?.cause?.status === 401)
    );
  };

  const isAuthenticated = !hasAuthError(portfolioError) && !hasAuthError(autoTraderError) && !hasAuthError(tradesError);

  // Real-time WebSocket data updates
  useEffect(() => {
    if (!lastMessage || !isConnected) return;

    const { type, data } = lastMessage;

    switch (type) {
      case 'trading_stats':
        // Update auto-trader statistics in real-time
        if (data) {
          queryClient.setQueryData(['/api/auto-trader/portfolio'], (oldData: any) => 
            oldData ? { ...oldData, ...data } : data
          );
        }
        break;
      
      case 'trade_executed':
        // Invalidate auto-trader and trades data when a new trade is executed
        queryClient.invalidateQueries({ queryKey: ['/api/auto-trader/portfolio'] });
        queryClient.invalidateQueries({ queryKey: ['/api/portfolio', 'default', 'trades'] });
        break;
      
      case 'pattern_detected':
        // Invalidate risk analysis when new ML patterns are detected
        queryClient.invalidateQueries({ queryKey: ['/api/risk/portfolio'] });
        break;
      
      case 'portfolio_update':
        // Update portfolio data that affects analytics
        queryClient.invalidateQueries({ queryKey: ['/api/portfolio', 'default'] });
        queryClient.invalidateQueries({ queryKey: ['/api/risk/portfolio'] });
        break;
      
      case 'price_update':
        // Invalidate analytics when prices change
        queryClient.invalidateQueries({ queryKey: ['/api/auto-trader/portfolio'] });
        queryClient.invalidateQueries({ queryKey: ['/api/risk/portfolio'] });
        break;
      
      case 'risk_limit_exceeded':
        // Update risk analysis immediately when risk limits are exceeded
        if (data && autoTraderStats?.portfolioId) {
          queryClient.setQueryData(['/api/risk/portfolio', autoTraderStats.portfolioId], (oldData: any) => 
            oldData ? { ...oldData, riskScore: data.riskScore, portfolioRisk: data.level } : oldData
          );
        }
        break;
    }
  }, [lastMessage, isConnected, queryClient, autoTraderStats?.portfolioId]);

  // Demo data for unauthenticated users
  const demoAutoTraderStats = {
    portfolioId: "demo-portfolio",
    totalValue: 25847.32,
    totalPositionValue: 24280.00,
    availableCash: 1567.32,
    totalTrades: 45,
    buyTrades: 24,
    sellTrades: 21,
    activePositions: 6,
    positions: [
      { tokenId: "btc", symbol: "BTC", amount: 0.5, avgBuyPrice: 42500, currentPrice: 45000, positionValue: 22500, profitLoss: 1250 },
      { tokenId: "eth", symbol: "ETH", amount: 15.2, avgBuyPrice: 2200, currentPrice: 2180, positionValue: 33136, profitLoss: -304 }
    ],
    winRate: "72.3"
  };

  const demoRiskAnalysis = {
    portfolioRisk: "Medium",
    riskScore: 6.2,
    volatility: 15.8,
    diversificationScore: 7.3,
    concentrationRisk: "Low",
    maxDrawdown: 8.4,
    sharpeRatio: 1.42
  };

  const demoTrades = [
    { id: "1", type: "buy", realizedPnL: "150.00", totalValue: "5000.00" },
    { id: "2", type: "sell", realizedPnL: "245.50", totalValue: "8200.00" },
    { id: "3", type: "buy", realizedPnL: "-85.00", totalValue: "3400.00" },
    { id: "4", type: "sell", realizedPnL: "380.25", totalValue: "12500.00" }
  ];

  // Use real data if authenticated, demo data if not
  const currentAutoTraderStats = isAuthenticated ? autoTraderStats : demoAutoTraderStats;
  const currentRiskAnalysis = isAuthenticated ? riskAnalysis : demoRiskAnalysis;
  const currentTrades = isAuthenticated ? trades : demoTrades;

  // Calculate real performance metrics from API data
  const winningTrades = currentTrades?.filter(t => parseFloat(t.realizedPnL || '0') > 0) || [];
  const losingTrades = currentTrades?.filter(t => parseFloat(t.realizedPnL || '0') < 0) || [];
  const avgWin = winningTrades.length ? winningTrades.reduce((sum, t) => sum + parseFloat(t.realizedPnL || '0'), 0) / winningTrades.length : 0;
  const avgLoss = losingTrades.length ? Math.abs(losingTrades.reduce((sum, t) => sum + parseFloat(t.realizedPnL || '0'), 0) / losingTrades.length) : 0;
  
  const performanceMetrics = {
    totalReturn: parseFloat(portfolio?.totalPnL || '0') / parseFloat(portfolio?.totalValue || '1') * 100, // Convert to percentage
    sharpeRatio: currentRiskAnalysis?.sharpeRatio || 0,
    maxDrawdown: currentRiskAnalysis?.maxDrawdown || 0,
    volatility: currentRiskAnalysis?.volatility || 0,
    winRate: parseFloat(currentAutoTraderStats?.winRate || portfolio?.winRate || '0'),
    avgWin: avgWin,
    avgLoss: avgLoss,
    profitFactor: avgLoss ? avgWin / avgLoss : 0,
  };

  // Calculate top performers from real positions (convert PnL to percentage return)
  const topPerformers = portfolio?.positions
    ?.map(position => {
      const currentValue = parseFloat(position.currentValue || '0');
      const unrealizedPnL = parseFloat(position.unrealizedPnL || '0');
      const costBasis = currentValue - unrealizedPnL;
      const returnPercent = costBasis ? (unrealizedPnL / costBasis) * 100 : 0;
      
      return {
        symbol: position.token?.symbol || 'Unknown',
        return: returnPercent, // Now correctly as percentage
        allocation: (currentValue / parseFloat(portfolio?.totalValue || '1')) * 100,
      };
    })
    .sort((a, b) => b.return - a.return)
    .slice(0, 5) || [
      { symbol: "BTC", return: 12.5, allocation: 42.3 },
      { symbol: "ETH", return: 8.7, allocation: 28.9 },
      { symbol: "SOL", return: 15.2, allocation: 15.1 },
      { symbol: "DOGE", return: -3.2, allocation: 8.4 },
      { symbol: "PEPE", return: 22.8, allocation: 5.3 }
    ];

  const riskMetrics = {
    portfolioRisk: currentRiskAnalysis?.portfolioRisk || "Unknown",
    concentrationRisk: currentRiskAnalysis?.concentrationRisk || "Unknown",
    correlationRisk: "Low", // Placeholder - needs additional endpoint
    liquidityRisk: "Medium", // Placeholder - needs additional endpoint
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
          {/* Authentication Status */}
          {!isAuthenticated && (
            <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                <span className="text-sm text-blue-500">You're viewing demo analytics data. Sign in to see your actual trading performance.</span>
              </div>
              <Button variant="outline" size="sm" className="border-blue-500/20 text-blue-500 hover:bg-blue-500/10">
                Sign In
              </Button>
            </div>
          )}
          
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
              <Button 
                size="sm" 
                data-testid="button-refresh-analytics"
                onClick={() => {
                  queryClient.invalidateQueries({ queryKey: ['/api/auto-trader/portfolio'] });
                  queryClient.invalidateQueries({ queryKey: ['/api/portfolio', 'default'] });
                  if (autoTraderStats?.portfolioId) {
                    queryClient.invalidateQueries({ queryKey: ['/api/risk/portfolio', autoTraderStats.portfolioId] });
                  }
                }}
                disabled={portfolioLoading || riskLoading}
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh Data
              </Button>
            </div>
          </div>

          {/* Error Handling - only show errors if not using demo data */}
          {(portfolioError || riskError) && isAuthenticated && (
            <Alert variant="destructive" data-testid="alert-analytics-error">
              <AlertTriangle className="w-4 h-4" />
              <AlertDescription>
                Failed to load analytics data. Please try refreshing the page.
              </AlertDescription>
            </Alert>
          )}

          {/* Performance Overview */}
          <Card data-testid="card-performance-overview">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <BarChart3 className="w-5 h-5" />
                <span>{t("analytics.performance")}</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {portfolioLoading || riskLoading ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="text-center">
                      <Skeleton className="h-8 w-20 mx-auto mb-2" />
                      <Skeleton className="h-4 w-16 mx-auto" />
                    </div>
                  ))}
                </div>
              ) : (
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
              )}
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
