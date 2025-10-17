import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/hooks/use-language";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useWebSocket } from "@/hooks/use-websocket";
import { useEffect, useMemo } from "react";
import { TrendingUp, TrendingDown, BarChart3, PieChart, Activity, AlertTriangle, Target, Zap, RefreshCw } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ResponsiveAreaChart } from "@/components/charts/ResponsiveAreaChart";
import { ResponsivePieChart } from "@/components/charts/ResponsivePieChart";
import { ResponsiveBarChart } from "@/components/charts/ResponsiveBarChart";
import { transformToTimeSeries, getValueColor } from "@/lib/chart-utils";

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
    queryKey: ['/api/portfolio'],
    refetchInterval: 30000, // Refetch every 30 seconds
    staleTime: 15000, // Data stays fresh for 15 seconds
    retry: false, // Don't retry on 401 errors
  });

  const { data: trades, error: tradesError } = useQuery<Array<{
    id: string;
    type: string;
    realizedPnL: string;
    totalValue: string;
    createdAt: string;
    closedAt?: string;
  }>>({ 
    queryKey: ['/api/portfolio', 'default', 'trades'],
    refetchInterval: 60000,
    retry: false, // Don't retry on 401 errors
  });

  // Fetch comprehensive analytics data
  const { data: analyticsData, isLoading: analyticsLoading, error: analyticsError } = useQuery<{
    pnl: {
      totalRealizedPnL: number;
      totalUnrealizedPnL: number;
      totalPnL: number;
      dailyPnL: number;
      pnlPercentage: number;
      startingCapital: number;
      currentValue: number;
    };
    winLoss: {
      totalWins: number;
      totalLosses: number;
      totalBreakeven: number;
      winRate: number;
      avgWin: number;
      avgLoss: number;
      profitFactor: number;
      largestWin: number;
      largestLoss: number;
    };
    holdTime: {
      avgHoldTime: number;
      avgWinHoldTime: number;
      avgLossHoldTime: number;
      totalClosedTrades: number;
    };
    strategies: Array<{
      patternId: string | null;
      patternType: string;
      totalTrades: number;
      winningTrades: number;
      losingTrades: number;
      totalProfit: number;
      totalLoss: number;
      netProfit: number;
      roiPercent: number;
      winRate: number;
      averageReturn: number;
    }>;
  }>({
    queryKey: ['/api/analytics/all'],
    refetchInterval: 60000,
    retry: false,
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

  const isAuthenticated = !hasAuthError(portfolioError) && !hasAuthError(autoTraderError) && !hasAuthError(tradesError) && !hasAuthError(analyticsError);

  // Transform data for charts using useMemo for performance
  const chartData = useMemo(() => {
    // Create cumulative P&L timeline from trades
    const pnlTimeline = trades && trades.length > 0
      ? trades
          .filter(t => t.closedAt)
          .sort((a, b) => new Date(a.closedAt!).getTime() - new Date(b.closedAt!).getTime())
          .reduce((acc, trade, index) => {
            const pnl = parseFloat(trade.realizedPnL || '0');
            const prevCumulative = index > 0 ? acc[index - 1].value : 0;
            const cumulative = prevCumulative + pnl;
            
            acc.push({
              timestamp: new Date(trade.closedAt!).getTime(),
              value: cumulative,
              date: new Date(trade.closedAt!).toLocaleDateString(),
            });
            return acc;
          }, [] as Array<{ timestamp: number; value: number; date: string }>)
      : [];

    // Win/Loss distribution data
    const winLossData = analyticsData?.winLoss
      ? [
          { name: 'Wins', value: analyticsData.winLoss.totalWins },
          { name: 'Losses', value: analyticsData.winLoss.totalLosses },
          { name: 'Breakeven', value: analyticsData.winLoss.totalBreakeven },
        ].filter(item => item.value > 0)
      : [];

    // Strategy performance data
    const strategyData = analyticsData?.strategies
      ? analyticsData.strategies
          .filter(s => s.totalTrades > 0)
          .map(s => ({
            name: s.patternType,
            pnl: s.netProfit,
            trades: s.totalTrades,
            winRate: s.winRate,
          }))
          .sort((a, b) => b.pnl - a.pnl)
      : [];

    // Trading volume data (aggregate by date)
    const volumeData = trades && trades.length > 0
      ? Object.entries(
          trades.reduce((acc, trade) => {
            const date = new Date(trade.createdAt).toLocaleDateString();
            const volume = parseFloat(trade.totalValue || '0');
            acc[date] = (acc[date] || 0) + volume;
            return acc;
          }, {} as Record<string, number>)
        )
          .map(([date, volume]) => ({
            date,
            volume,
            timestamp: new Date(date).getTime(),
          }))
          .sort((a, b) => a.timestamp - b.timestamp)
      : [];

    return { pnlTimeline, winLossData, strategyData, volumeData };
  }, [trades, analyticsData]);

  // Demo chart data for unauthenticated users
  const demoChartData = {
    pnlTimeline: [
      { timestamp: Date.now() - 7 * 24 * 60 * 60 * 1000, value: 0, date: '7 days ago' },
      { timestamp: Date.now() - 6 * 24 * 60 * 60 * 1000, value: 120, date: '6 days ago' },
      { timestamp: Date.now() - 5 * 24 * 60 * 60 * 1000, value: -50, date: '5 days ago' },
      { timestamp: Date.now() - 4 * 24 * 60 * 60 * 1000, value: 200, date: '4 days ago' },
      { timestamp: Date.now() - 3 * 24 * 60 * 60 * 1000, value: 350, date: '3 days ago' },
      { timestamp: Date.now() - 2 * 24 * 60 * 60 * 1000, value: 280, date: '2 days ago' },
      { timestamp: Date.now() - 1 * 24 * 60 * 60 * 1000, value: 450, date: '1 day ago' },
      { timestamp: Date.now(), value: 690, date: 'Today' },
    ],
    winLossData: [
      { name: 'Wins', value: 32 },
      { name: 'Losses', value: 12 },
      { name: 'Breakeven', value: 1 },
    ],
    strategyData: [
      { name: 'V-Reversal', pnl: 450, trades: 12, winRate: 75 },
      { name: 'Accumulation', pnl: 320, trades: 8, winRate: 62.5 },
      { name: 'Breakout', pnl: 180, trades: 6, winRate: 66.7 },
      { name: 'Manual Trading', pnl: -120, trades: 4, winRate: 25 },
    ],
    volumeData: [
      { date: '10/08', volume: 5420, timestamp: Date.now() - 7 * 24 * 60 * 60 * 1000 },
      { date: '10/09', volume: 6890, timestamp: Date.now() - 6 * 24 * 60 * 60 * 1000 },
      { date: '10/10', volume: 4320, timestamp: Date.now() - 5 * 24 * 60 * 60 * 1000 },
      { date: '10/11', volume: 7650, timestamp: Date.now() - 4 * 24 * 60 * 60 * 1000 },
      { date: '10/12', volume: 5890, timestamp: Date.now() - 3 * 24 * 60 * 60 * 1000 },
      { date: '10/13', volume: 8120, timestamp: Date.now() - 2 * 24 * 60 * 60 * 1000 },
      { date: '10/14', volume: 9430, timestamp: Date.now() - 1 * 24 * 60 * 60 * 1000 },
    ],
  };

  // Use real data if authenticated, demo data if not
  const currentChartData = isAuthenticated ? chartData : demoChartData;

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
        queryClient.invalidateQueries({ queryKey: ['/api/portfolio', 'trades'] });
        queryClient.invalidateQueries({ queryKey: ['/api/analytics/all'] });
        break;
      
      case 'pattern_detected':
        // Invalidate risk analysis when new ML patterns are detected
        queryClient.invalidateQueries({ queryKey: ['/api/risk/portfolio'] });
        break;
      
      case 'portfolio_update':
        // Update portfolio data that affects analytics
        queryClient.invalidateQueries({ queryKey: ['/api/portfolio'] });
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
  const topPerformers = currentAutoTraderStats?.positions
    ?.map(position => {
      const positionValue = position.positionValue || 0;
      const profitLoss = position.profitLoss || 0;
      const costBasis = positionValue - profitLoss;
      const returnPercent = costBasis ? (profitLoss / costBasis) * 100 : 0;
      
      return {
        symbol: position.symbol || 'Unknown',
        return: returnPercent, // Now correctly as percentage
        allocation: (positionValue / (currentAutoTraderStats?.totalPositionValue || 1)) * 100,
      };
    })
    .sort((a, b) => b.return - a.return)
    .slice(0, 5) || [];

  // Calculate correlation risk based on portfolio diversification
  const positionCount = currentAutoTraderStats?.positions?.length || 0;
  const correlationRisk = positionCount >= 8 ? "Low" : positionCount >= 4 ? "Medium" : "High";
  
  // Calculate liquidity risk based on position values (as proxy for market liquidity)
  const totalPositionValue = currentAutoTraderStats?.totalPositionValue || 0;
  const avgPositionSize = positionCount ? totalPositionValue / positionCount : 0;
  const liquidityRisk = avgPositionSize > 50000 ? "High" : avgPositionSize > 10000 ? "Medium" : "Low";

  const riskMetrics = {
    portfolioRisk: currentRiskAnalysis?.portfolioRisk || "Unknown",
    concentrationRisk: currentRiskAnalysis?.concentrationRisk || "Unknown",
    correlationRisk,
    liquidityRisk,
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

  // Generate dynamic AI insights based on actual portfolio data
  const generateAIInsights = () => {
    const insights = [];
    
    // Diversification insight
    const largestPosition = topPerformers[0];
    if (largestPosition && largestPosition.allocation > 25) {
      insights.push({
        type: "diversification",
        icon: "primary",
        title: "Portfolio Diversification",
        message: `Consider reducing ${largestPosition.symbol} allocation (${largestPosition.allocation.toFixed(1)}%) to improve diversification. Recommended max allocation: 25%.`
      });
    } else if (positionCount < 5) {
      insights.push({
        type: "diversification",
        icon: "primary",
        title: "Portfolio Diversification",
        message: `Portfolio has ${positionCount} positions. Consider adding more positions to improve diversification and reduce risk.`
      });
    }
    
    // Rebalancing insight
    const worstPerformer = topPerformers.find(p => p.return < -5);
    const bestPerformer = topPerformers.find(p => p.return > 15);
    if (worstPerformer) {
      insights.push({
        type: "rebalancing",
        icon: "accent",
        title: "Rebalancing Opportunity",
        message: `${worstPerformer.symbol} showing ${worstPerformer.return.toFixed(1)}% loss. Consider dollar-cost averaging if fundamentals remain strong, or reducing position size.`
      });
    } else if (bestPerformer) {
      insights.push({
        type: "rebalancing",
        icon: "accent",
        title: "Profit Taking Opportunity",
        message: `${bestPerformer.symbol} up ${bestPerformer.return.toFixed(1)}%. Consider taking some profits to lock in gains and reduce position risk.`
      });
    }
    
    // Performance insight
    if (performanceMetrics.totalReturn > 10) {
      insights.push({
        type: "performance",
        icon: "green-400",
        title: "Strong Performance",
        message: `Portfolio up ${performanceMetrics.totalReturn.toFixed(1)}% overall. Current strategy showing effectiveness with ${performanceMetrics.winRate.toFixed(0)}% win rate.`
      });
    } else if (performanceMetrics.totalReturn < -5) {
      insights.push({
        type: "performance",
        icon: "red-400",
        title: "Performance Review",
        message: `Portfolio down ${Math.abs(performanceMetrics.totalReturn).toFixed(1)}%. Consider reviewing strategy and risk management approach.`
      });
    } else {
      insights.push({
        type: "performance",
        icon: "blue-400",
        title: "Steady Performance",
        message: `Portfolio showing steady performance with ${performanceMetrics.winRate.toFixed(0)}% win rate. Focus on consistent execution of your strategy.`
      });
    }
    
    return insights.slice(0, 3); // Limit to 3 insights
  };

  const aiInsights = generateAIInsights();

  return (
    <div className="min-h-screen flex bg-background">
      <Sidebar />
      <main className="flex-1 overflow-auto mobile-safe-bottom">
        <Header />
        
        <div className="p-6 space-y-6">
          {/* Authentication Status */}
          {!isAuthenticated && (
            <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                <span className="text-sm text-blue-500">You're viewing demo analytics data. Sign in to see your actual trading performance.</span>
              </div>
              <Button variant="outline" size="sm" className="border-blue-500/20 text-blue-500 hover:bg-blue-500/10" data-testid="button-sign-in">
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
                  queryClient.invalidateQueries({ queryKey: ['/api/portfolio'] });
                  queryClient.invalidateQueries({ queryKey: ['/api/portfolio', 'trades'] });
                  queryClient.invalidateQueries({ queryKey: ['/api/analytics/all'] });
                  if (autoTraderStats?.portfolioId) {
                    queryClient.invalidateQueries({ queryKey: ['/api/risk/portfolio', autoTraderStats.portfolioId] });
                  }
                }}
                disabled={portfolioLoading || riskLoading || analyticsLoading}
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
                <div className="grid grid-cols-2 gap-4 mb-6">
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

                {/* Win/Loss Distribution Donut Chart */}
                {analyticsLoading ? (
                  <Skeleton className="h-64 w-full" />
                ) : currentChartData.winLossData.length > 0 ? (
                  <div>
                    <h4 className="text-sm font-medium mb-3">Win/Loss Distribution</h4>
                    <ResponsivePieChart
                      data={currentChartData.winLossData}
                      height={280}
                      innerRadius={60}
                      showLegend={true}
                      formatType="number"
                      colors={['hsl(142, 76%, 45%)', 'hsl(0, 84%, 60%)', 'hsl(215, 20%, 65%)']}
                      showLabels={true}
                      testId="chart-win-loss-distribution"
                    />
                  </div>
                ) : (
                  <div className="h-64 flex items-center justify-center bg-secondary/20 rounded-lg">
                    <p className="text-sm text-muted-foreground">No trade data available</p>
                  </div>
                )}
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

          {/* Strategy Performance Bar Chart */}
          <Card data-testid="card-strategy-performance">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <BarChart3 className="w-5 h-5" />
                <span>Strategy Performance</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {analyticsLoading ? (
                <Skeleton className="h-80 w-full" />
              ) : currentChartData.strategyData.length > 0 ? (
                <ResponsiveBarChart
                  data={currentChartData.strategyData}
                  xKey="name"
                  yKey="pnl"
                  height={320}
                  formatType="currency"
                  colorByValue={true}
                  showGrid={true}
                  testId="chart-strategy-performance"
                />
              ) : (
                <div className="h-80 flex items-center justify-center bg-secondary/20 rounded-lg">
                  <div className="text-center">
                    <BarChart3 className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                    <p className="text-lg font-medium text-muted-foreground">No Strategy Data Available</p>
                    <p className="text-sm text-muted-foreground">Execute trades to see strategy performance</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Trading Volume Column Chart */}
          <Card data-testid="card-trading-volume">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Activity className="w-5 h-5" />
                <span>Trading Volume</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {portfolioLoading ? (
                <Skeleton className="h-80 w-full" />
              ) : currentChartData.volumeData.length > 0 ? (
                <ResponsiveBarChart
                  data={currentChartData.volumeData}
                  xKey="date"
                  yKey="volume"
                  height={320}
                  formatType="currency"
                  colors={['hsl(220, 70%, 50%)']}
                  showGrid={true}
                  testId="chart-trading-volume"
                />
              ) : (
                <div className="h-80 flex items-center justify-center bg-secondary/20 rounded-lg">
                  <div className="text-center">
                    <Activity className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                    <p className="text-lg font-medium text-muted-foreground">No Volume Data Available</p>
                    <p className="text-sm text-muted-foreground">Start trading to see volume trends</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

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

          {/* Cumulative P&L Area Chart */}
          <Card data-testid="card-performance-chart">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Activity className="w-5 h-5" />
                <span>Cumulative P&L Performance</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {portfolioLoading || analyticsLoading ? (
                <div className="h-80">
                  <Skeleton className="h-full w-full" />
                </div>
              ) : currentChartData.pnlTimeline.length > 0 ? (
                <ResponsiveAreaChart
                  data={currentChartData.pnlTimeline}
                  xKey="timestamp"
                  yKey="value"
                  height={320}
                  formatType="currency"
                  gradientColors={
                    currentChartData.pnlTimeline[currentChartData.pnlTimeline.length - 1]?.value >= 0
                      ? ['hsl(142, 76%, 45%)', 'hsl(142, 76%, 35%)']
                      : ['hsl(0, 84%, 60%)', 'hsl(0, 84%, 50%)']
                  }
                  showGrid={true}
                  testId="chart-cumulative-pnl"
                />
              ) : (
                <div className="h-80 flex items-center justify-center bg-secondary/20 rounded-lg">
                  <div className="text-center">
                    <BarChart3 className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                    <p className="text-lg font-medium text-muted-foreground">No P&L Data Available</p>
                    <p className="text-sm text-muted-foreground">Start trading to see your performance</p>
                  </div>
                </div>
              )}
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
                {aiInsights.map((insight, index) => (
                  <div 
                    key={index}
                    className={`p-4 rounded-lg ${
                      insight.icon === 'primary' ? 'bg-primary/10 border border-primary/20' :
                      insight.icon === 'accent' ? 'bg-accent/10 border border-accent/20' :
                      insight.icon === 'green-400' ? 'bg-green-400/10 border border-green-400/20' :
                      insight.icon === 'red-400' ? 'bg-red-400/10 border border-red-400/20' :
                      'bg-blue-400/10 border border-blue-400/20'
                    }`}
                    data-testid={`insight-${insight.type}`}
                  >
                    <div className="flex items-center space-x-2 mb-2">
                      <div className={`w-2 h-2 rounded-full ${
                        insight.icon === 'primary' ? 'bg-primary' :
                        insight.icon === 'accent' ? 'bg-accent' :
                        insight.icon === 'green-400' ? 'bg-green-400' :
                        insight.icon === 'red-400' ? 'bg-red-400' :
                        'bg-blue-400'
                      }`}></div>
                      <span className={`text-sm font-medium ${
                        insight.icon === 'primary' ? 'text-primary' :
                        insight.icon === 'accent' ? 'text-accent' :
                        insight.icon === 'green-400' ? 'text-green-400' :
                        insight.icon === 'red-400' ? 'text-red-400' :
                        'text-blue-400'
                      }`}>
                        {insight.title}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {insight.message}
                    </p>
                  </div>
                ))}
                {aiInsights.length === 0 && (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">No insights available. Start trading to receive AI-powered recommendations.</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
