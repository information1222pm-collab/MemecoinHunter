import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { Trophy, TrendingUp, DollarSign, Clock, Target, Award, Medal, Crown } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

interface TrophyTrade {
  id: string;
  tokenSymbol: string;
  tokenName: string;
  entryPrice: number;
  exitPrice: number;
  amount: number;
  realizedPnL: number;
  returnPercent: number;
  holdTime: number;
  holdTimeDays: number;
  entryDate: string | null;
  exitDate: string | null;
  patternType: string | null;
  patternConfidence: number | null;
}

export default function TrophyRoom() {
  const { data: topTrades, isLoading } = useQuery<TrophyTrade[]>({
    queryKey: ['/api/trophy-room'],
    refetchInterval: 60000,
  });

  const getRankIcon = (index: number) => {
    switch (index) {
      case 0:
        return <Crown className="w-6 h-6 text-yellow-400" data-testid="icon-rank-1" />;
      case 1:
        return <Medal className="w-6 h-6 text-gray-300" data-testid="icon-rank-2" />;
      case 2:
        return <Medal className="w-6 h-6 text-amber-600" data-testid="icon-rank-3" />;
      default:
        return <Trophy className="w-5 h-5 text-purple-400" data-testid={`icon-rank-${index + 1}`} />;
    }
  };

  const getRankBadge = (index: number) => {
    const rank = index + 1;
    if (rank === 1) return <Badge className="bg-gradient-to-r from-yellow-400 to-yellow-600" data-testid="badge-rank-1">🥇 Champion</Badge>;
    if (rank === 2) return <Badge className="bg-gradient-to-r from-gray-300 to-gray-400 text-gray-900" data-testid="badge-rank-2">🥈 Runner-Up</Badge>;
    if (rank === 3) return <Badge className="bg-gradient-to-r from-amber-600 to-amber-700" data-testid="badge-rank-3">🥉 Third Place</Badge>;
    return <Badge variant="outline" className="text-purple-400 border-purple-400" data-testid={`badge-rank-${rank}`}>#{rank}</Badge>;
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  const formatHoldTime = (days: number) => {
    if (days < 1) {
      const hours = Math.floor(days * 24);
      return `${hours}h`;
    }
    return `${days.toFixed(1)}d`;
  };

  return (
    <div className="flex h-screen bg-background" data-testid="page-trophy-room">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Header Section */}
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <h1 className="text-3xl font-bold flex items-center gap-3" data-testid="text-page-title">
                <Trophy className="w-8 h-8 text-yellow-400" />
                Trophy Room
              </h1>
              <p className="text-muted-foreground" data-testid="text-page-subtitle">
                Hall of fame for the most profitable trades
              </p>
            </div>
          </div>

          {/* Stats Overview */}
          {topTrades && topTrades.length > 0 && (
            <div className="grid gap-4 md:grid-cols-4">
              <Card data-testid="card-stat-total-profit">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Top Trade Profit</CardTitle>
                  <DollarSign className="h-4 w-4 text-green-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-500" data-testid="text-top-profit">
                    {formatCurrency(topTrades[0].realizedPnL)}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {topTrades[0].returnPercent.toFixed(2)}% return
                  </p>
                </CardContent>
              </Card>

              <Card data-testid="card-stat-avg-return">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Avg Top 10 Return</CardTitle>
                  <TrendingUp className="h-4 w-4 text-blue-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-blue-500" data-testid="text-avg-return">
                    {(topTrades.slice(0, 10).reduce((sum, t) => sum + t.returnPercent, 0) / Math.min(10, topTrades.length)).toFixed(2)}%
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Across {Math.min(10, topTrades.length)} trades
                  </p>
                </CardContent>
              </Card>

              <Card data-testid="card-stat-best-token">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Best Performer</CardTitle>
                  <Award className="h-4 w-4 text-purple-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid="text-best-token">
                    {topTrades[0].tokenSymbol}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {topTrades[0].tokenName}
                  </p>
                </CardContent>
              </Card>

              <Card data-testid="card-stat-total-winners">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Winners</CardTitle>
                  <Trophy className="h-4 w-4 text-yellow-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid="text-total-winners">
                    {topTrades.length}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Profitable trades
                  </p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Loading State */}
          {isLoading && (
            <div className="flex items-center justify-center py-12" data-testid="loading-trophy-room">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
          )}

          {/* Empty State */}
          {!isLoading && (!topTrades || topTrades.length === 0) && (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12" data-testid="empty-trophy-room">
                <Trophy className="w-16 h-16 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Trophy Trades Yet</h3>
                <p className="text-muted-foreground text-center max-w-md">
                  Profitable trades will appear here once positions are closed with gains.
                </p>
              </CardContent>
            </Card>
          )}

          {/* Trophy Trades List */}
          {!isLoading && topTrades && topTrades.length > 0 && (
            <div className="space-y-4">
              {topTrades.map((trade, index) => (
                <Card 
                  key={trade.id}
                  className={cn(
                    "transition-all hover:shadow-lg",
                    index === 0 && "border-yellow-400 border-2 shadow-yellow-400/20",
                    index === 1 && "border-gray-300 border-2 shadow-gray-300/20",
                    index === 2 && "border-amber-600 border-2 shadow-amber-600/20"
                  )}
                  data-testid={`card-trophy-trade-${index + 1}`}
                >
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between gap-4">
                      {/* Rank & Token Info */}
                      <div className="flex items-start gap-4 flex-1">
                        <div className="flex flex-col items-center gap-2">
                          {getRankIcon(index)}
                          {getRankBadge(index)}
                        </div>

                        <div className="flex-1 space-y-3">
                          <div>
                            <div className="flex items-center gap-3 mb-1">
                              <h3 className="text-xl font-bold" data-testid={`text-token-symbol-${index + 1}`}>
                                {trade.tokenSymbol}
                              </h3>
                              {trade.patternType && (
                                <Badge variant="outline" className="text-xs" data-testid={`badge-pattern-${index + 1}`}>
                                  {trade.patternType.replace(/_/g, ' ')}
                                  {trade.patternConfidence && ` ${trade.patternConfidence.toFixed(0)}%`}
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground" data-testid={`text-token-name-${index + 1}`}>
                              {trade.tokenName}
                            </p>
                          </div>

                          {/* Trade Metrics */}
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div>
                              <p className="text-xs text-muted-foreground mb-1">Profit</p>
                              <p className="text-lg font-bold text-green-500" data-testid={`text-profit-${index + 1}`}>
                                {formatCurrency(trade.realizedPnL)}
                              </p>
                            </div>

                            <div>
                              <p className="text-xs text-muted-foreground mb-1">Return</p>
                              <p className="text-lg font-bold text-blue-500" data-testid={`text-return-${index + 1}`}>
                                +{trade.returnPercent.toFixed(2)}%
                              </p>
                            </div>

                            <div>
                              <p className="text-xs text-muted-foreground mb-1">Hold Time</p>
                              <div className="flex items-center gap-1">
                                <Clock className="w-4 h-4 text-muted-foreground" />
                                <p className="text-sm font-medium" data-testid={`text-holdtime-${index + 1}`}>
                                  {formatHoldTime(trade.holdTimeDays)}
                                </p>
                              </div>
                            </div>

                            <div>
                              <p className="text-xs text-muted-foreground mb-1">Entry → Exit</p>
                              <div className="flex items-center gap-1">
                                <Target className="w-4 h-4 text-muted-foreground" />
                                <p className="text-sm font-medium" data-testid={`text-prices-${index + 1}`}>
                                  ${trade.entryPrice.toFixed(4)} → ${trade.exitPrice.toFixed(4)}
                                </p>
                              </div>
                            </div>
                          </div>

                          {/* Trade Date */}
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span data-testid={`text-date-${index + 1}`}>
                              Closed {trade.exitDate ? formatDistanceToNow(new Date(trade.exitDate), { addSuffix: true }) : 'Unknown'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
