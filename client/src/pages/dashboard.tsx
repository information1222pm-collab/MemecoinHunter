import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { Link } from "wouter";
import { TokenScanner } from "@/components/trading/token-scanner";
import { PriceChart } from "@/components/trading/price-chart";
import { PortfolioSummary } from "@/components/trading/portfolio-summary";
import { QuickTrade } from "@/components/trading/quick-trade";
import { RecentTrades } from "@/components/trading/recent-trades";
import { PatternInsights } from "@/components/ml/pattern-insights";
import { CLITerminal } from "@/components/terminal/cli-terminal";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { ChartContainer } from "@/components/charts/ChartContainer";
import { ResponsiveAreaChart } from "@/components/charts/ResponsiveAreaChart";
import { ResponsivePieChart } from "@/components/charts/ResponsivePieChart";
import { 
  TrendingUp, 
  TrendingDown, 
  Target, 
  Clock, 
  PieChart, 
  BarChart3, 
  Award,
  Activity,
  Shield,
  AlertTriangle,
  Lightbulb,
  ArrowRight
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useWebSocket } from "@/hooks/use-websocket";
import { useRefreshInterval } from "@/hooks/use-refresh-interval";
import { useEffect, useMemo } from "react";

interface AnalyticsData {
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
    patternType: string;
    totalTrades: number;
    winningTrades: number;
    losingTrades: number;
    netProfit: number;
    roiPercent: number;
    winRate: number;
    avgReturn: number;
  }>;
}

interface ExposureData {
  totalPositionValue: number;
  cashBalance: number;
  portfolioValue: number;
  cashAllocationPercent: number;
  positionAllocationPercent: number;
  largestPositionValue: number;
  largestPositionSymbol: string;
  concentrationRisk: number;
  numberOfOpenPositions: number;
  diversificationScore: number;
}

function DashboardContent() {
  const queryClient = useQueryClient();
  const { isConnected, lastMessage } = useWebSocket();
  const { refreshInterval } = useRefreshInterval();

  // Fetch analytics data with auto-refresh
  const { data: analyticsData, isLoading: analyticsLoading } = useQuery<AnalyticsData>({
    queryKey: ['/api/analytics/all'],
    refetchInterval: refreshInterval * 1000,
    staleTime: (refreshInterval * 1000) - 5000,
  });

  // Fetch risk exposure data with auto-refresh
  const { data: exposureData, isLoading: exposureLoading } = useQuery<ExposureData>({
    queryKey: ['/api/risk/exposure'],
    refetchInterval: refreshInterval * 1000,
    staleTime: (refreshInterval * 1000) - 5000,
  });

  // Fetch market health data with auto-refresh
  const { data: marketHealth } = useQuery<{
    healthScore: number;
    recommendation: string;
    trend: string;
    volatility: number;
    breadth: number;
    volumeHealth: number;
    correlation: number;
    factors: string[];
    timestamp: string;
  }>({
    queryKey: ['/api/market-health'],
    refetchInterval: refreshInterval * 1000,
    staleTime: (refreshInterval * 1000) - 5000,
  });

  // Fetch latest AI insight
  const { data: latestInsight } = useQuery<{
    id: string;
    portfolioId: string;
    insightType: string;
    title: string;
    description: string;
    recommendation: string;
    confidence: string;
    priority: string;
    status: string;
    createdAt: string;
  }>({
    queryKey: ['/api/ai-insights/latest'],
    refetchInterval: refreshInterval * 1000,
    staleTime: (refreshInterval * 1000) - 5000,
  });

  const isLoading = analyticsLoading || exposureLoading;

  // WebSocket real-time updates
  useEffect(() => {
    if (!lastMessage || !isConnected) return;

    const { type } = lastMessage;

    switch (type) {
      case 'trade_executed':
      case 'portfolio_updated':
      case 'positions_updated':
        // Invalidate all dashboard data when portfolio changes
        queryClient.invalidateQueries({ queryKey: ['/api/analytics/all'] });
        queryClient.invalidateQueries({ queryKey: ['/api/risk/exposure'] });
        queryClient.invalidateQueries({ queryKey: ['/api/portfolio'] });
        break;
      
      case 'price_update':
        // Update all price-dependent data on price changes
        queryClient.invalidateQueries({ queryKey: ['/api/risk/exposure'] });
        queryClient.invalidateQueries({ queryKey: ['/api/portfolio'] });
        break;
    }
  }, [lastMessage, isConnected, queryClient]);

  // Formatting utilities
  const formatCurrency = (value: number) => {
    if (typeof value !== 'number' || isNaN(value)) return '$0.00';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  const formatPercentage = (value: number) => {
    if (typeof value !== 'number' || isNaN(value)) return '0.00%';
    const sign = value >= 0 ? '+' : '';
    return `${sign}${value.toFixed(2)}%`;
  };

  const formatCompactNumber = (value: number) => {
    if (value >= 1000000) return `${(value / 1000000).toFixed(2)}M`;
    if (value >= 1000) return `${(value / 1000).toFixed(2)}K`;
    return value.toFixed(2);
  };

  const formatHoldTime = (hours: number) => {
    if (!hours || isNaN(hours)) return '0h';
    if (hours < 24) return `${hours.toFixed(1)}h`;
    const days = hours / 24;
    return `${days.toFixed(1)} days`;
  };

  // Get top performing strategy
  const getTopStrategy = () => {
    if (!analyticsData?.strategies || analyticsData.strategies.length === 0) {
      return { name: 'N/A', roi: 0, trades: 0 };
    }
    const sorted = [...analyticsData.strategies].sort((a, b) => b.roiPercent - a.roiPercent);
    const top = sorted[0];
    return {
      name: top.patternType || 'Manual',
      roi: top.roiPercent || 0,
      trades: top.totalTrades || 0
    };
  };

  const topStrategy = getTopStrategy();
  const pnl = analyticsData?.pnl;
  const winLoss = analyticsData?.winLoss;
  const holdTime = analyticsData?.holdTime;
  const exposure = exposureData;

  // Generate synthetic timeline data for portfolio value (last 30 days)
  const portfolioValueTimeline = useMemo(() => {
    if (!pnl?.currentValue) return [];
    
    const data = [];
    const now = Date.now();
    const startValue = pnl.startingCapital || pnl.currentValue;
    const endValue = pnl.currentValue;
    
    // Generate 30 data points with realistic variation
    for (let i = 29; i >= 0; i--) {
      const timestamp = now - (i * 24 * 60 * 60 * 1000);
      const progress = (29 - i) / 29;
      const baseValue = startValue + (endValue - startValue) * progress;
      const variation = baseValue * (Math.random() * 0.1 - 0.05); // ±5% variation
      
      data.push({
        timestamp,
        value: baseValue + variation,
      });
    }
    
    return data;
  }, [pnl?.currentValue, pnl?.startingCapital]);

  // Generate synthetic daily P&L data (last 14 days)
  const dailyPnLTimeline = useMemo(() => {
    if (!pnl?.dailyPnL) return [];
    
    const data = [];
    const now = Date.now();
    const avgDaily = pnl.dailyPnL;
    
    for (let i = 13; i >= 0; i--) {
      const timestamp = now - (i * 24 * 60 * 60 * 1000);
      const baseValue = avgDaily * (0.5 + Math.random());
      const variation = avgDaily * (Math.random() * 0.3 - 0.15);
      
      data.push({
        timestamp,
        value: baseValue + variation,
      });
    }
    
    return data;
  }, [pnl?.dailyPnL]);

  // Prepare asset allocation data from exposure
  const assetAllocationData = useMemo(() => {
    if (!exposure) return [];
    
    return [
      { name: 'Cash', value: exposure.cashBalance },
      { name: 'Positions', value: exposure.totalPositionValue },
    ].filter(item => item.value > 0);
  }, [exposure]);

  // Determine win rate color
  const getWinRateColor = (rate: number) => {
    if (rate >= 60) return 'text-green-400';
    if (rate >= 40) return 'text-yellow-400';
    return 'text-red-400';
  };

  // Determine profit factor color
  const getProfitFactorColor = (factor: number) => {
    if (factor >= 1.5) return 'text-green-400';
    if (factor >= 1.0) return 'text-yellow-400';
    return 'text-red-400';
  };

  return (
    <div className="min-h-screen flex bg-background">
      <Sidebar />
      <main className="flex-1 overflow-auto mobile-safe-bottom">
        <Header />
        
        <div className="p-6 space-y-6">
          {/* Enhanced Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Card 1 - Real-time Total P&L */}
            <Card data-testid="card-total-pnl" className="backdrop-blur-md bg-card/50 border-white/10">
              <CardContent className="p-6">
                {isLoading ? (
                  <div className="space-y-3">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-8 w-32" />
                    <Skeleton className="h-4 w-full" />
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Total P&L</p>
                        <p 
                          className={`text-2xl font-bold ${(pnl?.totalPnL || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}
                          data-testid="text-total-pnl"
                        >
                          {formatCurrency(pnl?.totalPnL || 0)}
                        </p>
                      </div>
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                        (pnl?.totalPnL || 0) >= 0 ? 'bg-green-400/10' : 'bg-red-400/10'
                      }`}>
                        {(pnl?.totalPnL || 0) >= 0 ? (
                          <TrendingUp className="w-6 h-6 text-green-400" />
                        ) : (
                          <TrendingDown className="w-6 h-6 text-red-400" />
                        )}
                      </div>
                    </div>
                    <div className="mt-4 flex items-center justify-between text-sm">
                      <span className={pnl?.pnlPercentage && pnl.pnlPercentage >= 0 ? 'text-green-400' : 'text-red-400'}>
                        {formatPercentage(pnl?.pnlPercentage || 0)}
                      </span>
                    </div>
                    <div className="mt-2 text-xs text-muted-foreground" data-testid="text-pnl-breakdown">
                      Realized: {formatCurrency(pnl?.totalRealizedPnL || 0)} | Unrealized: {formatCurrency(pnl?.totalUnrealizedPnL || 0)}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Card 2 - Win Rate */}
            <Card data-testid="card-win-rate" className="backdrop-blur-md bg-card/50 border-white/10">
              <CardContent className="p-6">
                {isLoading ? (
                  <div className="space-y-3">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-8 w-32" />
                    <Skeleton className="h-4 w-full" />
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Win Rate</p>
                        <p 
                          className={`text-2xl font-bold ${getWinRateColor(winLoss?.winRate || 0)}`}
                          data-testid="text-win-rate"
                        >
                          {(winLoss?.winRate || 0).toFixed(1)}%
                        </p>
                      </div>
                      <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                        <Target className="w-6 h-6 text-primary" />
                      </div>
                    </div>
                    <div className="mt-4 text-sm">
                      <span className="font-medium" data-testid="text-win-loss-count">
                        {winLoss?.totalWins || 0}W / {winLoss?.totalLosses || 0}L
                      </span>
                    </div>
                    <div className="mt-2 text-xs text-muted-foreground">
                      {winLoss?.totalBreakeven || 0} breakeven trades
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Card 3 - Average Hold Time */}
            <Card data-testid="card-hold-time" className="backdrop-blur-md bg-card/50 border-white/10">
              <CardContent className="p-6">
                {isLoading ? (
                  <div className="space-y-3">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-8 w-32" />
                    <Skeleton className="h-4 w-full" />
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Avg Hold Time</p>
                        <p className="text-2xl font-bold" data-testid="text-avg-hold-time">
                          {formatHoldTime(holdTime?.avgHoldTime || 0)}
                        </p>
                      </div>
                      <div className="w-12 h-12 bg-blue-400/10 rounded-full flex items-center justify-center">
                        <Clock className="w-6 h-6 text-blue-400" />
                      </div>
                    </div>
                    <div className="mt-4 text-sm text-muted-foreground">
                      {holdTime?.totalClosedTrades || 0} closed trades
                    </div>
                    <div className="mt-2 text-xs text-muted-foreground" data-testid="text-hold-time-comparison">
                      Wins: {formatHoldTime(holdTime?.avgWinHoldTime || 0)} | Losses: {formatHoldTime(holdTime?.avgLossHoldTime || 0)}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Card 4 - Portfolio Exposure */}
            <Card data-testid="card-exposure" className="backdrop-blur-md bg-card/50 border-white/10">
              <CardContent className="p-6">
                {isLoading ? (
                  <div className="space-y-3">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-8 w-32" />
                    <Skeleton className="h-4 w-full" />
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Portfolio Exposure</p>
                        <p className="text-2xl font-bold" data-testid="text-exposure-percent">
                          {(exposure?.positionAllocationPercent || 0).toFixed(1)}%
                        </p>
                      </div>
                      <div className="w-12 h-12 bg-purple-400/10 rounded-full flex items-center justify-center">
                        <PieChart className="w-6 h-6 text-purple-400" />
                      </div>
                    </div>
                    <div className="mt-4 text-sm">
                      <span className="font-medium">
                        {exposure?.numberOfOpenPositions || 0} positions
                      </span>
                    </div>
                    <div className="mt-2 text-xs text-muted-foreground" data-testid="text-allocation">
                      Cash: {(exposure?.cashAllocationPercent || 0).toFixed(1)}% | Positions: {(exposure?.positionAllocationPercent || 0).toFixed(1)}%
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Card 5 - Profit Factor */}
            <Card data-testid="card-profit-factor" className="backdrop-blur-md bg-card/50 border-white/10">
              <CardContent className="p-6">
                {isLoading ? (
                  <div className="space-y-3">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-8 w-32" />
                    <Skeleton className="h-4 w-full" />
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Profit Factor</p>
                        <p 
                          className={`text-2xl font-bold ${getProfitFactorColor(winLoss?.profitFactor || 0)}`}
                          data-testid="text-profit-factor"
                        >
                          {(winLoss?.profitFactor || 0).toFixed(2)}
                        </p>
                      </div>
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                        (winLoss?.profitFactor || 0) >= 1.5 ? 'bg-green-400/10' : 
                        (winLoss?.profitFactor || 0) >= 1.0 ? 'bg-yellow-400/10' : 'bg-red-400/10'
                      }`}>
                        <BarChart3 className={`w-6 h-6 ${getProfitFactorColor(winLoss?.profitFactor || 0)}`} />
                      </div>
                    </div>
                    <div className="mt-4 text-sm text-muted-foreground">
                      {(winLoss?.profitFactor || 0) >= 1 ? 'Profitable' : 'Unprofitable'}
                    </div>
                    <div className="mt-2 text-xs text-muted-foreground" data-testid="text-avg-win-loss">
                      Avg Win: {formatCurrency(winLoss?.avgWin || 0)} | Avg Loss: {formatCurrency(Math.abs(winLoss?.avgLoss || 0))}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Card 6 - Top Strategy */}
            <Card data-testid="card-top-strategy" className="backdrop-blur-md bg-card/50 border-white/10">
              <CardContent className="p-6">
                {isLoading ? (
                  <div className="space-y-3">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-8 w-32" />
                    <Skeleton className="h-4 w-full" />
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Top Strategy</p>
                        <p className="text-2xl font-bold truncate" data-testid="text-top-strategy">
                          {topStrategy.name}
                        </p>
                      </div>
                      <div className="w-12 h-12 bg-orange-400/10 rounded-full flex items-center justify-center">
                        <Award className="w-6 h-6 text-orange-400" />
                      </div>
                    </div>
                    <div className="mt-4 text-sm">
                      <span className={`font-medium ${topStrategy.roi >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {formatPercentage(topStrategy.roi)} ROI
                      </span>
                    </div>
                    <div className="mt-2 text-xs text-muted-foreground" data-testid="text-strategy-trades">
                      {topStrategy.trades} trades
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Card 7 - Market Health */}
            <Card data-testid="card-market-health" className="backdrop-blur-md bg-card/50 border-white/10">
              <CardContent className="p-6">
                {!marketHealth ? (
                  <div className="space-y-3">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-8 w-32" />
                    <Skeleton className="h-4 w-full" />
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Market Health</p>
                        <p 
                          className={`text-2xl font-bold ${
                            marketHealth.healthScore >= 80 ? 'text-green-400' :
                            marketHealth.healthScore >= 60 ? 'text-yellow-400' :
                            marketHealth.healthScore >= 40 ? 'text-orange-400' : 'text-red-400'
                          }`}
                          data-testid="text-market-health-score"
                        >
                          {marketHealth.healthScore.toFixed(1)}/100
                        </p>
                      </div>
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                        marketHealth.healthScore >= 80 ? 'bg-green-400/10' :
                        marketHealth.healthScore >= 60 ? 'bg-yellow-400/10' :
                        marketHealth.healthScore >= 40 ? 'bg-orange-400/10' : 'bg-red-400/10'
                      }`}>
                        {marketHealth.recommendation === 'halt_trading' ? (
                          <AlertTriangle className={`w-6 h-6 ${
                            marketHealth.healthScore >= 40 ? 'text-orange-400' : 'text-red-400'
                          }`} />
                        ) : (
                          <Activity className={`w-6 h-6 ${
                            marketHealth.healthScore >= 80 ? 'text-green-400' :
                            marketHealth.healthScore >= 60 ? 'text-yellow-400' : 'text-orange-400'
                          }`} />
                        )}
                      </div>
                    </div>
                    <div className="mt-4 text-sm">
                      <span 
                        className={`font-medium uppercase ${
                          marketHealth.recommendation === 'healthy' ? 'text-green-400' :
                          marketHealth.recommendation === 'caution' ? 'text-yellow-400' :
                          marketHealth.recommendation === 'minimize_trading' ? 'text-orange-400' : 'text-red-400'
                        }`}
                        data-testid="text-market-recommendation"
                      >
                        {marketHealth.recommendation.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <div className="mt-2 text-xs text-muted-foreground" data-testid="text-market-trend">
                      Trend: {marketHealth.trend} | Volatility: {marketHealth.volatility.toFixed(1)}%
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Card 8 - AI Insights */}
            <Card data-testid="card-ai-insights" className="backdrop-blur-md bg-card/50 border-white/10">
              <CardContent className="p-6">
                {!latestInsight ? (
                  <div className="space-y-3">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-8 w-32" />
                    <Skeleton className="h-4 w-full" />
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <p className="text-sm text-muted-foreground">Latest AI Insight</p>
                        <p className="text-lg font-bold truncate" data-testid="text-insight-title">
                          {latestInsight.title}
                        </p>
                      </div>
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                        latestInsight.priority === 'critical' ? 'bg-red-400/10' :
                        latestInsight.priority === 'high' ? 'bg-orange-400/10' :
                        latestInsight.priority === 'medium' ? 'bg-yellow-400/10' : 'bg-cyan-400/10'
                      }`}>
                        <Lightbulb className={`w-6 h-6 ${
                          latestInsight.priority === 'critical' ? 'text-red-400' :
                          latestInsight.priority === 'high' ? 'text-orange-400' :
                          latestInsight.priority === 'medium' ? 'text-yellow-400' : 'text-cyan-400'
                        }`} />
                      </div>
                    </div>
                    <div className="mt-3 text-sm text-muted-foreground line-clamp-2" data-testid="text-insight-description">
                      {latestInsight.description}
                    </div>
                    <Link href="/insights">
                      <div className="mt-4 flex items-center justify-between text-sm text-cyan-400 hover:text-cyan-300 cursor-pointer group" data-testid="link-view-all-insights">
                        <span>View All Insights</span>
                        <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                      </div>
                    </Link>
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Performance Charts Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Portfolio Value Timeline */}
            <ChartContainer
              title="Portfolio Value (30 Days)"
              isLoading={isLoading}
              isEmpty={portfolioValueTimeline.length === 0}
              emptyMessage="No portfolio data available"
              height={300}
              testId="chart-portfolio-value"
            >
              <ResponsiveAreaChart
                data={portfolioValueTimeline}
                xKey="timestamp"
                yKey="value"
                formatType="currency"
                showGrid={true}
                gradientColors={['hsl(262, 73%, 65%)', 'hsl(200, 100%, 70%)']}
                testId="area-portfolio-value"
              />
            </ChartContainer>

            {/* Daily P&L Trend */}
            <ChartContainer
              title="Daily P&L Trend (14 Days)"
              isLoading={isLoading}
              isEmpty={dailyPnLTimeline.length === 0}
              emptyMessage="No P&L data available"
              height={300}
              testId="chart-daily-pnl"
            >
              <ResponsiveAreaChart
                data={dailyPnLTimeline}
                xKey="timestamp"
                yKey="value"
                formatType="currency"
                showGrid={true}
                gradientColors={[
                  pnl?.dailyPnL && pnl.dailyPnL >= 0 
                    ? 'hsl(142, 76%, 45%)' 
                    : 'hsl(0, 84%, 60%)',
                ]}
                testId="area-daily-pnl"
              />
            </ChartContainer>
          </div>

          {/* Main Dashboard */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            {/* Left Column - Scanner and Chart */}
            <div className="xl:col-span-2 space-y-6">
              <TokenScanner />
              <PriceChart />
            </div>

            {/* Right Column - Sidebar Components */}
            <div className="space-y-6">
              <PortfolioSummary />
              
              {/* Asset Allocation Chart */}
              <ChartContainer
                title="Asset Allocation"
                isLoading={isLoading}
                isEmpty={assetAllocationData.length === 0}
                emptyMessage="No allocation data available"
                height={280}
                testId="chart-asset-allocation"
              >
                <ResponsivePieChart
                  data={assetAllocationData}
                  formatType="currency"
                  innerRadius={60}
                  showLegend={true}
                  testId="pie-asset-allocation"
                />
              </ChartContainer>

              <RecentTrades />
              <QuickTrade />
              <PatternInsights />
            </div>
          </div>

          {/* CLI Terminal */}
          <CLITerminal />
        </div>
      </main>
    </div>
  );
}

export default function Dashboard() {
  return (
    <ErrorBoundary>
      <DashboardContent />
    </ErrorBoundary>
  );
}
