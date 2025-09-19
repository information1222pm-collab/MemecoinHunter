import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { TokenScanner } from "@/components/trading/token-scanner";
import { PriceChart } from "@/components/trading/price-chart";
import { PortfolioSummary } from "@/components/trading/portfolio-summary";
import { QuickTrade } from "@/components/trading/quick-trade";
import { PatternInsights } from "@/components/ml/pattern-insights";
import { CLITerminal } from "@/components/terminal/cli-terminal";
import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, Activity, Search, CheckCircle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

export default function Dashboard() {
  const { data: portfolioData } = useQuery({
    queryKey: ['/api/portfolio/default'],
  });

  const { data: alertsData } = useQuery({
    queryKey: ['/api/alerts'],
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  const mockStats = {
    activePositions: 7,
    dailyPnL: 347.82,
    scannedToday: 1847,
    winRate: 73.2,
    alertsTriggered: 47,
  };

  return (
    <div className="min-h-screen flex bg-background">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <Header />
        
        <div className="p-6 space-y-6">
          {/* Quick Stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card data-testid="card-active-positions">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Active Positions</p>
                    <p className="text-2xl font-bold" data-testid="text-active-positions">{mockStats.activePositions}</p>
                  </div>
                  <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                    <Activity className="w-6 h-6 text-primary" />
                  </div>
                </div>
                <div className="mt-4 flex items-center text-sm">
                  <span className="text-price-up">↗ 2 new today</span>
                </div>
              </CardContent>
            </Card>

            <Card data-testid="card-daily-pnl">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">24h P&L</p>
                    <p className="text-2xl font-bold price-up" data-testid="text-daily-pnl">+${mockStats.dailyPnL}</p>
                  </div>
                  <div className="w-12 h-12 bg-green-400/10 rounded-full flex items-center justify-center">
                    <TrendingUp className="w-6 h-6 text-green-400" />
                  </div>
                </div>
                <div className="mt-4 flex items-center text-sm">
                  <span className="text-price-up">+2.84% today</span>
                </div>
              </CardContent>
            </Card>

            <Card data-testid="card-scanned-tokens">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Scanned Tokens</p>
                    <p className="text-2xl font-bold" data-testid="text-scanned-tokens">{mockStats.scannedToday}</p>
                  </div>
                  <div className="w-12 h-12 bg-accent/10 rounded-full flex items-center justify-center">
                    <Search className="w-6 h-6 text-accent" />
                  </div>
                </div>
                <div className="mt-4 flex items-center text-sm">
                  <span className="text-muted-foreground">{mockStats.alertsTriggered} alerts triggered</span>
                </div>
              </CardContent>
            </Card>

            <Card data-testid="card-win-rate">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Win Rate</p>
                    <p className="text-2xl font-bold" data-testid="text-win-rate">{mockStats.winRate}%</p>
                  </div>
                  <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                    <CheckCircle className="w-6 h-6 text-primary" />
                  </div>
                </div>
                <div className="mt-4 flex items-center text-sm">
                  <span className="text-price-up">+1.2% this week</span>
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
