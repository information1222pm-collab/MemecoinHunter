import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { TokenScanner } from "@/components/trading/token-scanner";
import { PriceChart } from "@/components/trading/price-chart";
import { PortfolioSummary } from "@/components/trading/portfolio-summary";
import { QuickTrade } from "@/components/trading/quick-trade";
import { PatternInsights } from "@/components/ml/pattern-insights";
import { CLITerminal } from "@/components/terminal/cli-terminal";
import { Card, CardContent } from "@/components/ui/card";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { TrendingUp, Activity, Search, CheckCircle, Wifi, WifiOff } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useWebSocket } from "@/hooks/use-websocket";
import { useEffect, useState } from "react";

function DashboardContent() {
  const [realTimeStats, setRealTimeStats] = useState({
    scannedTokens: 0,
    alertsTriggered: 0,
    mlConfidence: 0,
    isScanning: false
  });
  
  // Initialize WebSocket with error handling
  const [wsError, setWsError] = useState<string | null>(null);
  
  // Use WebSocket hook with error boundary
  let wsHook = null;
  let isConnected = false;
  let lastMessage = null;
  
  try {
    wsHook = useWebSocket();
    isConnected = wsHook?.isConnected || false;
    lastMessage = wsHook?.lastMessage || null;
  } catch (error) {
    console.warn('WebSocket initialization failed:', error);
    setWsError('WebSocket connection unavailable');
  }

  // Fetch portfolio data with auto-refresh
  const { data: portfolioData } = useQuery({
    queryKey: ['/api/portfolio', 'default'],
    refetchInterval: 10000, // Refetch every 10 seconds
  });

  // Fetch alerts data with auto-refresh
  const { data: alertsData } = useQuery({
    queryKey: ['/api/alerts'],
    refetchInterval: 15000, // Refetch every 15 seconds
  });

  // Fetch scanner status with auto-refresh
  const { data: scannerStatus } = useQuery({
    queryKey: ['/api/scanner/status'],
    refetchInterval: 5000, // Refetch every 5 seconds
  });

  // Fetch recent patterns for ML insights
  const { data: recentPatterns } = useQuery({
    queryKey: ['/api/patterns/recent'],
    refetchInterval: 20000, // Refetch every 20 seconds
  });

  // Update real-time stats from API data
  useEffect(() => {
    if (scannerStatus || alertsData || recentPatterns) {
      setRealTimeStats({
        scannedTokens: (scannerStatus as any)?.scannedTokensCount || 0,
        alertsTriggered: Array.isArray(alertsData) ? alertsData.length : 0,
        mlConfidence: Array.isArray(recentPatterns) && recentPatterns.length > 0 ? recentPatterns[0]?.confidence || 0 : 0,
        isScanning: (scannerStatus as any)?.isRunning || false
      });
    }
  }, [scannerStatus, alertsData, recentPatterns]);

  // Handle WebSocket real-time updates
  useEffect(() => {
    if (lastMessage) {
      try {
        const message = lastMessage as any;
        switch (message?.type) {
          case 'scanner_update':
            setRealTimeStats(prev => ({
              ...prev,
              scannedTokens: message?.data?.tokenCount || prev.scannedTokens,
              isScanning: message?.data?.isRunning !== undefined ? message.data.isRunning : prev.isScanning
            }));
            break;
          case 'new_alert':
            setRealTimeStats(prev => ({
              ...prev,
              alertsTriggered: prev.alertsTriggered + 1
            }));
            break;
          case 'pattern_detected':
            setRealTimeStats(prev => ({
              ...prev,
              mlConfidence: message?.data?.confidence || prev.mlConfidence
            }));
            break;
        }
      } catch (error) {
        console.warn('Error processing WebSocket message:', error);
        setWsError('WebSocket message processing error');
      }
    }
  }, [lastMessage]);

  // Calculate dynamic stats from real data with safe number conversion
  const stats = {
    activePositions: Array.isArray((portfolioData as any)?.positions) ? (portfolioData as any).positions.length : 0,
    dailyPnL: Number((portfolioData as any)?.dailyPnL) || 0,
    scannedToday: Number(realTimeStats.scannedTokens) || 0,
    winRate: Number((portfolioData as any)?.winRate) || 0,
    alertsTriggered: Number(realTimeStats.alertsTriggered) || 0,
    mlConfidence: Number(realTimeStats.mlConfidence) || 0,
    totalValue: Number((portfolioData as any)?.totalValue) || 0,
    isScanning: Boolean(realTimeStats.isScanning)
  };

  return (
    <div className="min-h-screen flex bg-background">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <Header />
        
        {/* Connection Status */}
        {wsError && (
          <div className="p-4 m-6 bg-yellow-500/10 border border-yellow-500/20 rounded-lg flex items-center space-x-2">
            <WifiOff className="w-4 h-4 text-yellow-500" />
            <span className="text-sm text-yellow-500">Real-time updates unavailable - using cached data</span>
          </div>
        )}
        
        <div className="p-6 space-y-6">
          {/* Quick Stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card data-testid="card-active-positions">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Active Positions</p>
                    <p className="text-2xl font-bold" data-testid="text-active-positions">
                      {Number(stats.activePositions)}
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                    <Activity className="w-6 h-6 text-primary" />
                  </div>
                </div>
                <div className="mt-4 flex items-center text-sm">
                  <span className="text-price-up">↗ Live data</span>
                </div>
              </CardContent>
            </Card>

            <Card data-testid="card-daily-pnl">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">24h P&L</p>
                    <p className={`text-2xl font-bold ${stats.dailyPnL >= 0 ? 'price-up' : 'price-down'}`} data-testid="text-daily-pnl">
                      {stats.dailyPnL >= 0 ? '+' : ''}${Number(stats.dailyPnL).toFixed(2)}
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-green-400/10 rounded-full flex items-center justify-center">
                    <TrendingUp className="w-6 h-6 text-green-400" />
                  </div>
                </div>
                <div className="mt-4 flex items-center text-sm">
                  <span className={stats.dailyPnL >= 0 ? 'text-price-up' : 'text-price-down'}>
                    {stats.totalValue > 0 ? `${Number((stats.dailyPnL / stats.totalValue) * 100).toFixed(2)}% today` : '0% today'}
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card data-testid="card-scanned-tokens">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Scanned Tokens</p>
                    <p className="text-2xl font-bold" data-testid="text-scanned-tokens">
                      {Number(stats.scannedToday)}
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-accent/10 rounded-full flex items-center justify-center">
                    <Search className="w-6 h-6 text-accent" />
                  </div>
                </div>
                <div className="mt-4 flex items-center text-sm">
                  <div className="flex items-center space-x-2">
                    <div className={`w-2 h-2 rounded-full ${stats.isScanning ? 'bg-green-400 animate-pulse' : 'bg-gray-400'}`}></div>
                    <span className="text-muted-foreground">{Number(stats.alertsTriggered)} alerts triggered</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card data-testid="card-win-rate">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Win Rate</p>
                    <p className="text-2xl font-bold" data-testid="text-win-rate">
                      {Number(stats.winRate).toFixed(1)}%
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                    <CheckCircle className="w-6 h-6 text-primary" />
                  </div>
                </div>
                <div className="mt-4 flex items-center text-sm">
                  <span className={`${stats.mlConfidence > 75 ? 'text-price-up' : 'text-muted-foreground'}`}>
                    ML: {Number(stats.mlConfidence).toFixed(1)}% confidence
                  </span>
                </div>
              </CardContent>
            </Card>
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
