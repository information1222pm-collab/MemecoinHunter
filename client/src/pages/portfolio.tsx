import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useLanguage } from "@/hooks/use-language";
import { useWebSocket } from "@/hooks/use-websocket";
import { useToast } from "@/hooks/use-toast";
import { useEffect, useState, useMemo } from "react";
import { TrendingUp, TrendingDown, DollarSign, Percent, Clock, ArrowUpRight, ArrowDownRight, BarChart3, PieChart, Bot } from "lucide-react";
import { cn } from "@/lib/utils";
import { PositionAnalytics } from "@/components/portfolio/position-analytics";
import { ResponsivePieChart } from "@/components/charts/ResponsivePieChart";
import { ResponsiveAreaChart } from "@/components/charts/ResponsiveAreaChart";
import { ResponsiveBarChart } from "@/components/charts/ResponsiveBarChart";
import { generateColorPalette, generateSyntheticTimeline, getValueColor } from "@/lib/chart-utils";
import { apiRequest, queryClient as globalQueryClient } from "@/lib/queryClient";

export default function Portfolio() {
  const { t } = useLanguage();
  const { isConnected, lastMessage } = useWebSocket();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [showAnalytics, setShowAnalytics] = useState(false);
  
  const { data: portfolio, error: portfolioError } = useQuery<{
    id: string;
    totalValue: string;
    cashBalance: string;
    dailyPnL: string;
    totalPnL: string;
    winRate: string;
    autoTradingEnabled: boolean;
    positions: Array<{
      id: string;
      tokenId: string;
      amount: string;
      avgBuyPrice: string;
      currentValue: string;
      unrealizedPnL: string;
      analytics: {
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
      } | null;
      token: {
        symbol: string;
        name: string;
        currentPrice: string;
      };
    }>;
    analytics?: {
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
    };
  }>({
    queryKey: ['/api/portfolio'],
    refetchInterval: 45000, // 45s - portfolio doesn't change rapidly
    staleTime: 30000,
    retry: false,
  });

  const { data: trades, error: tradesError } = useQuery<Array<{
    id: string;
    type: string;
    amount: string;
    price: string;
    totalValue: string;
    status: string;
    createdAt: string;
    token: {
      symbol: string;
      name: string;
    };
  }>>({
    queryKey: ['/api/portfolio/trades'],
    refetchInterval: 60000, // 60s - trade history is historical
    staleTime: 45000,
    retry: false,
  });

  // Auto-trading toggle mutation
  const toggleAutoTradingMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      return await apiRequest('PATCH', '/api/portfolio/auto-trading', { enabled });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/portfolio'] });
      toast({
        title: data.message,
        description: data.portfolio.autoTradingEnabled 
          ? "The trading bot will now automatically execute trades based on ML pattern signals." 
          : "Automated trading has been paused. No new trades will be executed.",
        duration: 4000,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error toggling auto-trading",
        description: error.message || "Failed to update auto-trading status",
        variant: "destructive",
        duration: 4000,
      });
    },
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

  const isAuthenticated = !hasAuthError(portfolioError) && !hasAuthError(tradesError);

  // Real-time WebSocket data updates
  useEffect(() => {
    if (!lastMessage || !isConnected) return;

    const { type, data } = lastMessage;

    switch (type) {
      case 'trade_executed':
        // Invalidate portfolio and trades data when a new trade is executed
        queryClient.invalidateQueries({ queryKey: ['/api/portfolio'] });
        queryClient.invalidateQueries({ queryKey: ['/api/portfolio/trades'] });
        break;
      
      case 'portfolio_update':
      case 'portfolio_updated':
        // Update portfolio data in real-time
        if (data) {
          queryClient.setQueryData(['/api/portfolio', 'default'], (oldData: any) => 
            oldData ? { ...oldData, ...data } : data
          );
        }
        break;
      
      case 'positions_updated':
        // Real-time position value updates from position tracker
        queryClient.invalidateQueries({ queryKey: ['/api/portfolio', 'default'] });
        break;
      
      case 'price_update':
        // Invalidate portfolio when prices change (affects position values)
        queryClient.invalidateQueries({ queryKey: ['/api/portfolio', 'default'] });
        break;
      
      case 'trading_stats':
        // Update trading statistics in real-time
        if (data) {
          queryClient.setQueryData(['/api/portfolio', 'default'], (oldData: any) => 
            oldData ? { ...oldData, winRate: data.winRate?.toString() } : oldData
          );
        }
        break;
    }
  }, [lastMessage, isConnected, queryClient]);
  
  // Demo data for unauthenticated users
  const demoPortfolioData = {
    totalValue: "25847.32",
    dailyPnL: "567.89", 
    totalPnL: "3247.12",
    winRate: "72.3",
    positions: [
      {
        id: "demo-1",
        tokenId: "demo-btc",
        amount: "0.5",
        avgBuyPrice: "42500.00",
        currentValue: "21250.00",
        unrealizedPnL: "2750.00",
        analytics: null,
        token: { symbol: "BTC", name: "Bitcoin", currentPrice: "45000.00" }
      },
      {
        id: "demo-2", 
        tokenId: "demo-eth",
        amount: "15.2",
        avgBuyPrice: "2200.00",
        currentValue: "33440.00",
        unrealizedPnL: "440.00",
        analytics: null,
        token: { symbol: "ETH", name: "Ethereum", currentPrice: "2200.00" }
      }
    ],
    analytics: undefined
  };

  const demoTrades = [
    {
      id: "demo-trade-1",
      type: "buy",
      amount: "0.25",
      price: "43000.00",
      totalValue: "10750.00",
      status: "completed",
      createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      token: { symbol: "BTC", name: "Bitcoin" }
    },
    {
      id: "demo-trade-2",
      type: "sell",
      amount: "5.0",
      price: "2180.00",
      totalValue: "10900.00",
      status: "completed",
      createdAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
      token: { symbol: "ETH", name: "Ethereum" }
    }
  ];

  // Use real data if authenticated, demo data if not
  const portfolioData = isAuthenticated ? (portfolio || {
    totalValue: "0",
    dailyPnL: "0", 
    totalPnL: "0",
    winRate: "0",
    positions: [],
    analytics: undefined
  }) : demoPortfolioData;

  const tradeData = isAuthenticated ? (trades || []) : demoTrades;

  const formatCurrency = (value: string | number) => {
    const numValue = typeof value === 'string' ? parseFloat(value) || 0 : (value || 0);
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(numValue);
  };

  const formatPercentage = (value: string | number) => {
    const numValue = typeof value === 'string' ? parseFloat(value) || 0 : (value || 0);
    return `${numValue >= 0 ? '+' : ''}${numValue.toFixed(2)}%`;
  };

  const formatTokenAmount = (amount: string | number) => {
    const numValue = typeof amount === 'string' ? parseFloat(amount) || 0 : (amount || 0);
    if (numValue === 0) return '0';
    if (numValue < 0.000001) return numValue.toExponential(2);
    if (numValue < 1) return numValue.toFixed(8).replace(/\.?0+$/, '');
    return numValue.toLocaleString(undefined, { maximumFractionDigits: 2 });
  };

  const getPnLColor = (value: string | number) => {
    const numValue = typeof value === 'string' ? parseFloat(value) || 0 : (value || 0);
    return numValue >= 0 ? 'price-up' : 'price-down';
  };

  // Chart Data Transformations
  const allocationData = useMemo(() => {
    if (!portfolioData.positions || portfolioData.positions.length === 0) return [];
    
    return portfolioData.positions.map(pos => {
      const quantity = parseFloat(pos.amount) || 0;
      const currentPrice = parseFloat(pos.token?.currentPrice) || 0;
      return {
        name: pos.token?.symbol || 'Unknown',
        value: quantity * currentPrice,
      };
    }).filter(item => item.value > 0);
  }, [portfolioData.positions]);

  const performanceData = useMemo(() => {
    const totalValue = parseFloat(portfolioData.totalValue) || 0;
    return generateSyntheticTimeline(totalValue, 30);
  }, [portfolioData.totalValue]);

  const comparisonData = useMemo(() => {
    if (!portfolioData.positions || portfolioData.positions.length === 0) return [];
    
    return portfolioData.positions.map(pos => ({
      name: pos.token?.symbol || 'Unknown',
      value: parseFloat(pos.unrealizedPnL) || 0,
    })).filter(item => item.name !== 'Unknown');
  }, [portfolioData.positions]);

  const isLoading = !portfolio && !portfolioError;
  const hasPositions = portfolioData.positions && portfolioData.positions.length > 0;

  return (
    <div className="min-h-screen flex bg-background">
      <Sidebar />
      <main className="flex-1 overflow-auto mobile-safe-bottom">
        <Header />
        
        <div className="p-4 md:p-6 space-y-4 md:space-y-6">
          {/* Authentication Status */}
          {!isAuthenticated && (
            <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                <span className="text-sm text-blue-500">You're viewing demo data. Sign in to see your actual portfolio.</span>
              </div>
              <Button variant="outline" size="sm" className="border-blue-500/20 text-blue-500 hover:bg-blue-500/10" data-testid="button-sign-in">
                Sign In
              </Button>
            </div>
          )}
          
          {/* Page Header with Controls */}
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold tracking-tight">{t('portfolio.title')}</h1>
            <div className="flex items-center space-x-4">
              {/* Auto-Trading Toggle */}
              {isAuthenticated && portfolio && (
                <div className="flex items-center space-x-3 px-3 py-2 rounded-lg border border-primary/20 bg-primary/5">
                  <Bot className={cn(
                    "w-4 h-4 transition-colors",
                    portfolio.autoTradingEnabled ? "text-green-500" : "text-gray-500"
                  )} />
                  <span className="text-sm font-medium">Auto-Trading</span>
                  <Switch
                    checked={portfolio.autoTradingEnabled || false}
                    onCheckedChange={(checked) => toggleAutoTradingMutation.mutate(checked)}
                    disabled={toggleAutoTradingMutation.isPending}
                    data-testid="switch-auto-trading"
                  />
                </div>
              )}
              
              <Button
                variant={showAnalytics ? "default" : "outline"}
                size="sm"
                onClick={() => setShowAnalytics(!showAnalytics)}
                data-testid="button-toggle-analytics"
                className="flex items-center space-x-2"
              >
                <BarChart3 className="w-4 h-4" />
                <span>{showAnalytics ? 'Simple View' : 'Analytics View'}</span>
              </Button>
              <div className="flex items-center space-x-2">
                <div className={cn(
                  "w-2 h-2 rounded-full transition-colors",
                  isConnected ? "bg-green-500" : "bg-red-500"
                )} />
                <span className="text-sm text-muted-foreground">
                  {isConnected ? t('common.connected') : t('common.disconnected')}
                </span>
              </div>
            </div>
          </div>

          {/* Portfolio Overview */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-6">
            <Card data-testid="card-total-value">
              <CardContent className="p-3 md:p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{t("portfolio.totalValue")}</p>
                    <p className="text-2xl font-bold" data-testid="text-total-value">
                      {formatCurrency(parseFloat(portfolioData.totalValue) || 0)}
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                    <DollarSign className="w-6 h-6 text-primary" />
                  </div>
                </div>
                <div className="mt-4 flex items-center text-sm">
                  <span className={portfolioData.analytics?.totalPnLPercent !== undefined ? 
                    (portfolioData.analytics.totalPnLPercent >= 0 ? "text-price-up" : "text-price-down") : 
                    "text-muted-foreground"}>
                    {portfolioData.analytics?.totalPnLPercent !== undefined ? 
                      `${portfolioData.analytics.totalPnLPercent >= 0 ? '↗ +' : '↘ '}${Math.abs(portfolioData.analytics.totalPnLPercent).toFixed(1)}% all time` :
                      "Portfolio return tracking"}
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card data-testid="card-daily-pnl">
              <CardContent className="p-3 md:p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Daily P&L</p>
                    <p className={`text-2xl font-bold ${getPnLColor(parseFloat(portfolioData.dailyPnL) || 0)}`} data-testid="text-daily-pnl">
                      {formatCurrency(parseFloat(portfolioData.dailyPnL) || 0)}
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-green-400/10 rounded-full flex items-center justify-center">
                    <TrendingUp className="w-6 h-6 text-green-400" />
                  </div>
                </div>
                <div className="mt-4 flex items-center text-sm">
                  <span className={portfolioData.analytics?.dayChange !== undefined ? 
                    (portfolioData.analytics.dayChange >= 0 ? "text-price-up" : "text-price-down") : 
                    "text-muted-foreground"}>
                    {portfolioData.analytics?.dayChange !== undefined ? 
                      `${portfolioData.analytics.dayChange >= 0 ? '+' : ''}${portfolioData.analytics.dayChange.toFixed(2)}% today` :
                      "Daily change tracking"}
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card data-testid="card-total-pnl">
              <CardContent className="p-3 md:p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Total P&L</p>
                    <p className={`text-2xl font-bold ${getPnLColor(parseFloat(portfolioData.totalPnL) || 0)}`} data-testid="text-total-pnl">
                      {formatCurrency(parseFloat(portfolioData.totalPnL) || 0)}
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-accent/10 rounded-full flex items-center justify-center">
                    <Percent className="w-6 h-6 text-accent" />
                  </div>
                </div>
                <div className="mt-4 flex items-center text-sm">
                  <span className="text-price-up">All time gains</span>
                </div>
              </CardContent>
            </Card>

            <Card data-testid="card-win-rate">
              <CardContent className="p-3 md:p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Win Rate</p>
                    <p className="text-2xl font-bold" data-testid="text-win-rate">
                      {formatPercentage(parseFloat(portfolioData.winRate) || 0)}
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                    <TrendingUp className="w-6 h-6 text-primary" />
                  </div>
                </div>
                <div className="mt-4 flex items-center text-sm">
                  <span className="text-muted-foreground">
                    Trading performance since inception
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Interactive Charts Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Position Allocation Donut Chart */}
            <Card data-testid="card-chart-allocation">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PieChart className="w-5 h-5" />
                  Position Allocation
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="space-y-3">
                    <Skeleton className="h-[300px] w-full" />
                    <div className="flex justify-center gap-4">
                      <Skeleton className="h-4 w-20" />
                      <Skeleton className="h-4 w-20" />
                      <Skeleton className="h-4 w-20" />
                    </div>
                  </div>
                ) : !hasPositions ? (
                  <div className="h-[300px] flex items-center justify-center">
                    <div className="text-center text-muted-foreground">
                      <PieChart className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      <p>No positions to display</p>
                      <p className="text-sm">Start trading to see allocation</p>
                    </div>
                  </div>
                ) : (
                  <ResponsivePieChart
                    data={allocationData}
                    height={300}
                    innerRadius={60}
                    formatType="currency"
                    showLegend={true}
                    colors={generateColorPalette(allocationData.length)}
                    testId="chart-position-allocation"
                  />
                )}
              </CardContent>
            </Card>

            {/* Performance Timeline Area Chart */}
            <Card data-testid="card-chart-performance">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5" />
                  Portfolio Performance (30 Days)
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="space-y-3">
                    <Skeleton className="h-[300px] w-full" />
                  </div>
                ) : !hasPositions || performanceData.length === 0 ? (
                  <div className="h-[300px] flex items-center justify-center">
                    <div className="text-center text-muted-foreground">
                      <TrendingUp className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      <p>No performance data available</p>
                      <p className="text-sm">Start trading to track performance</p>
                    </div>
                  </div>
                ) : (
                  <ResponsiveAreaChart
                    data={performanceData}
                    xKey="date"
                    yKey="value"
                    height={300}
                    formatType="currency"
                    showGrid={true}
                    gradientColors={
                      parseFloat(portfolioData.totalPnL) >= 0
                        ? ['hsl(142, 76%, 45%)', 'hsl(142, 76%, 45%)']
                        : ['hsl(0, 84%, 60%)', 'hsl(0, 84%, 60%)']
                    }
                    testId="chart-portfolio-performance"
                  />
                )}
              </CardContent>
            </Card>
          </div>

          {/* Position Comparison Bar Chart */}
          <Card data-testid="card-chart-comparison">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5" />
                Position P&L Comparison
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-[350px] w-full" />
                </div>
              ) : !hasPositions ? (
                <div className="h-[350px] flex items-center justify-center">
                  <div className="text-center text-muted-foreground">
                    <BarChart3 className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>No positions to compare</p>
                    <p className="text-sm">Start trading to see P&L comparison</p>
                  </div>
                </div>
              ) : (
                <ResponsiveBarChart
                  data={comparisonData}
                  xKey="name"
                  yKey="value"
                  height={350}
                  formatType="currency"
                  showGrid={true}
                  horizontal={true}
                  colorByValue={true}
                  testId="chart-position-comparison"
                />
              )}
            </CardContent>
          </Card>

          {/* Positions and Trades */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {/* Current Positions */}
            <Card data-testid="card-positions">
              <CardHeader>
                <CardTitle>{t("portfolio.positions")}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {portfolioData.positions.map((position) => {
                    const pnlValue = parseFloat(position.unrealizedPnL);
                    return (
                      <div
                        key={position.token?.symbol || position.id}
                        className="flex items-center justify-between p-3 md:p-4 bg-secondary/30 rounded-lg min-h-[60px]"
                        data-testid={`position-${position.token?.symbol || 'unknown'}`}
                      >
                        <div className="flex items-center space-x-2 md:space-x-3 min-w-0 flex-1">
                          <div className="w-8 h-8 md:w-10 md:h-10 bg-gradient-to-br from-orange-400 to-red-500 rounded-full flex-shrink-0" />
                          <div className="min-w-0 flex-1">
                            <div className="font-medium text-sm md:text-base" data-testid={`text-position-symbol-${position.token?.symbol || 'unknown'}`}>
                              {position.token?.symbol || 'Unknown'}
                            </div>
                            <div className="text-xs md:text-sm text-muted-foreground truncate" data-testid={`text-position-name-${position.token?.symbol || 'unknown'}`}>
                              {position.token?.name || 'Unknown Token'}
                            </div>
                            <div className="text-xs text-muted-foreground hidden md:block">
                              {formatTokenAmount(position.amount)} tokens
                            </div>
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <div className="font-medium text-sm md:text-base" data-testid={`text-position-value-${position.token?.symbol || 'unknown'}`}>
                            {formatCurrency(position.currentValue)}
                          </div>
                          <div className={`text-xs md:text-sm ${getPnLColor(position.unrealizedPnL)}`} data-testid={`text-position-pnl-${position.token?.symbol || 'unknown'}`}>
                            {formatPercentage(position.unrealizedPnL)}
                          </div>
                          <div className="text-xs text-muted-foreground hidden md:block">
                            @ {formatCurrency(parseFloat(position.token?.currentPrice || '0'))}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Analytics View */}
            {showAnalytics && (
              <PositionAnalytics
                positions={portfolioData.positions ? portfolioData.positions
                  .map(p => ({
                    symbol: p.token?.symbol || 'Unknown',
                    currentPrice: Number(p.token?.currentPrice) || 0,
                    quantity: Number(p.amount) || 0,
                    value: Number(p.currentValue) || 0,
                    pnl: Number(p.unrealizedPnL) || 0,
                    pnlPercent: Number(p.analytics?.unrealizedPnLPercent) || 0,
                    allocationPercent: Number(p.analytics?.allocation) || 0
                  }))
                  .filter(p => p.symbol !== 'Unknown') : []}
                portfolioAnalytics={portfolioData.analytics ? {
                  totalValue: Number(portfolioData.analytics.totalValue) || 0,
                  totalPnL: Number(portfolioData.analytics.totalPnL) || 0,
                  totalPnLPercent: Number(portfolioData.analytics.totalPnLPercent) || 0,
                  dayChange: Number(portfolioData.analytics.dayChange) || 0,
                  positionsCount: Number(portfolioData.analytics.positionsCount) || 0,
                  topPerformers: portfolioData.analytics.topPerformers?.map(p => ({
                    symbol: p.symbol || 'Unknown',
                    value: Number(p.value) || 0,
                    pnlPercent: Number(p.pnlPercent) || 0
                  })) || [],
                  riskMetrics: {
                    concentration: Number(portfolioData.analytics.riskMetrics?.concentration) || 0,
                    diversification: Number(portfolioData.analytics.riskMetrics?.diversification) || 0,
                    volatility: Number(portfolioData.analytics.riskMetrics?.volatility) || 0
                  }
                } : null}
                isLoading={!portfolio && !portfolioError}
                error={portfolioError}
              />
            )}

            {/* Recent Trades */}
            <Card data-testid="card-recent-trades">
              <CardHeader>
                <CardTitle>{t("portfolio.trades")}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {tradeData.map((trade) => (
                    <div
                      key={trade.id}
                      className="flex items-center justify-between p-4 bg-secondary/30 rounded-lg"
                      data-testid={`trade-${trade.id}`}
                    >
                      <div className="flex items-center space-x-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                          trade.type === 'buy' ? 'bg-green-400/10' : 'bg-red-400/10'
                        }`}>
                          {trade.type === 'buy' ? (
                            <ArrowUpRight className="w-4 h-4 text-green-400" />
                          ) : (
                            <ArrowDownRight className="w-4 h-4 text-red-400" />
                          )}
                        </div>
                        <div>
                          <div className="flex items-center space-x-2">
                            <Badge
                              variant={trade.type === 'buy' ? 'default' : 'secondary'}
                              className={trade.type === 'buy' ? 'bg-green-600' : 'bg-red-600'}
                              data-testid={`badge-trade-type-${trade.id}`}
                            >
                              {trade.type.toUpperCase()}
                            </Badge>
                            <span className="font-medium" data-testid={`text-trade-symbol-${trade.id}`}>
                              {trade.token?.symbol || 'Unknown'}
                            </span>
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {parseFloat(trade.amount).toLocaleString()} @ {formatCurrency(parseFloat(trade.price))}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-medium" data-testid={`text-trade-value-${trade.id}`}>
                          {formatCurrency(trade.totalValue)}
                        </div>
                        <div className="text-xs text-muted-foreground flex items-center">
                          <Clock className="w-3 h-3 mr-1" />
                          {new Date(trade.createdAt).toLocaleTimeString()}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                
                <Button variant="outline" className="w-full mt-4" data-testid="button-view-all-trades">
                  View All Trades
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Performance Chart Placeholder */}
          <Card data-testid="card-performance-chart">
            <CardHeader>
              <CardTitle>{t("portfolio.performance")}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64 flex items-center justify-center bg-secondary/20 rounded-lg">
                <div className="text-center">
                  <TrendingUp className="w-12 h-12 text-muted-foreground mx-auto mb-2" />
                  <p className="text-muted-foreground">Portfolio performance chart</p>
                  <p className="text-sm text-muted-foreground">Coming soon with advanced analytics</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
