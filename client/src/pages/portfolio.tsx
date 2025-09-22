import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { useLanguage } from "@/hooks/use-language";
import { TrendingUp, TrendingDown, DollarSign, Percent, Clock, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { cn } from "@/lib/utils";

export default function Portfolio() {
  const { t } = useLanguage();
  
  const { data: portfolio } = useQuery<{
    id: string;
    totalValue: string;
    cashBalance: string;
    dailyPnL: string;
    totalPnL: string;
    winRate: string;
    positions: Array<{
      id: string;
      tokenId: string;
      amount: string;
      avgBuyPrice: string;
      currentValue: string;
      unrealizedPnL: string;
      token: {
        symbol: string;
        name: string;
        currentPrice: string;
      };
    }>;
  }>({
    queryKey: ['/api/portfolio', 'default'],
  });

  const { data: trades } = useQuery<Array<{
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
    queryKey: ['/api/portfolio', 'default', 'trades'],
  });

  // Use real portfolio data
  const portfolioData = portfolio || {
    totalValue: "0",
    dailyPnL: "0", 
    totalPnL: "0",
    winRate: "0",
    positions: []
  };

  const tradeData = trades || [];

  const formatCurrency = (value: string | number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(typeof value === 'string' ? parseFloat(value) : value);
  };

  const formatPercentage = (value: string | number) => {
    const numValue = typeof value === 'string' ? parseFloat(value) : value;
    return `${numValue >= 0 ? '+' : ''}${numValue.toFixed(2)}%`;
  };

  const getPnLColor = (value: string | number) => {
    const numValue = typeof value === 'string' ? parseFloat(value) : value;
    return numValue >= 0 ? 'price-up' : 'price-down';
  };

  return (
    <div className="min-h-screen flex bg-background">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <Header />
        
        <div className="p-6 space-y-6">
          {/* Portfolio Overview */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card data-testid="card-total-value">
              <CardContent className="p-6">
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
                  <span className="text-price-up">↗ +5.2% all time</span>
                </div>
              </CardContent>
            </Card>

            <Card data-testid="card-daily-pnl">
              <CardContent className="p-6">
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
                  <span className="text-price-up">+2.84% today</span>
                </div>
              </CardContent>
            </Card>

            <Card data-testid="card-total-pnl">
              <CardContent className="p-6">
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
              <CardContent className="p-6">
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
                  <span className="text-price-up">+1.2% this week</span>
                </div>
              </CardContent>
            </Card>
          </div>

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
                        className="flex items-center justify-between p-4 bg-secondary/30 rounded-lg"
                        data-testid={`position-${position.token?.symbol || 'unknown'}`}
                      >
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 bg-gradient-to-br from-orange-400 to-red-500 rounded-full" />
                          <div>
                            <div className="font-medium" data-testid={`text-position-symbol-${position.token?.symbol || 'unknown'}`}>
                              {position.token?.symbol || 'Unknown'}
                            </div>
                            <div className="text-sm text-muted-foreground" data-testid={`text-position-name-${position.token?.symbol || 'unknown'}`}>
                              {position.token?.name || 'Unknown Token'}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {parseFloat(position.amount).toLocaleString()} tokens
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-medium" data-testid={`text-position-value-${position.token?.symbol || 'unknown'}`}>
                            {formatCurrency(position.currentValue)}
                          </div>
                          <div className={`text-sm ${getPnLColor(position.unrealizedPnL)}`} data-testid={`text-position-pnl-${position.token?.symbol || 'unknown'}`}>
                            {formatPercentage(position.unrealizedPnL)}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            @ {formatCurrency(parseFloat(position.token?.currentPrice || '0'))}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

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
