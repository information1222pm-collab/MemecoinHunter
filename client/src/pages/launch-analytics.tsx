import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { Rocket, TrendingUp, Target, Activity, Zap, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function LaunchAnalytics() {
  // Fetch launch statistics
  const { data: stats } = useQuery<any>({
    queryKey: ['/api/launch/statistics'],
  });

  // Fetch all strategies
  const { data: strategies = [] } = useQuery<any[]>({
    queryKey: ['/api/launch/strategies'],
  });

  // Fetch active strategy
  const { data: activeStrategyData } = useQuery<any>({
    queryKey: ['/api/launch/strategies/active'],
  });

  // Fetch recent launches
  const { data: recentLaunches = [] } = useQuery<any[]>({
    queryKey: ['/api/launch/recent-launches'],
  });

  const activeStrategy = activeStrategyData?.strategy;
  const activePerformance = activeStrategyData?.performance;

  // Calculate overall success rate
  const successRate = stats?.totalLaunches > 0 
    ? ((stats.successfulLaunches / stats.totalLaunches) * 100).toFixed(1)
    : 0;

  return (
    <div className="min-h-screen flex bg-background">
      <Sidebar />
      <main className="flex-1 overflow-auto mobile-safe-bottom">
        <Header />
        
        <div className="p-6 space-y-6">
          {/* Page Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold flex items-center space-x-3" data-testid="text-page-title">
                <Rocket className="w-8 h-8 text-cyan-500" />
                <span>Early-Launch Analytics</span>
                <Badge variant="outline" className="ml-2 bg-cyan-500/20 text-cyan-500 border-cyan-500/30">EXPERIMENTAL</Badge>
              </h1>
              <p className="text-muted-foreground mt-1">Monitor and analyze early-launch coin detection and trading performance</p>
            </div>
          </div>

          {/* Statistics Overview */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card data-testid="card-total-launches">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center space-x-2">
                  <Rocket className="w-4 h-4" />
                  <span>Total Launches Detected</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-cyan-500">{stats?.totalLaunches || 0}</div>
                <p className="text-xs text-muted-foreground mt-1">Coins ≤5 minutes on market</p>
              </CardContent>
            </Card>

            <Card data-testid="card-success-rate">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center space-x-2">
                  <TrendingUp className="w-4 h-4" />
                  <span>Success Rate</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-green-500">{successRate}%</div>
                <p className="text-xs text-muted-foreground mt-1">{stats?.successfulLaunches || 0} successful / {stats?.failedLaunches || 0} failed</p>
              </CardContent>
            </Card>

            <Card data-testid="card-active-strategies">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center space-x-2">
                  <Target className="w-4 h-4" />
                  <span>Active Strategies</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{strategies.filter((s: any) => s.isActive).length}</div>
                <p className="text-xs text-muted-foreground mt-1">Out of {strategies.length} total strategies</p>
              </CardContent>
            </Card>

            <Card data-testid="card-learning-status">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center space-x-2">
                  <Activity className="w-4 h-4" />
                  <span>Learning Status</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {activePerformance?.isReadyForLive ? (
                  <>
                    <div className="text-3xl font-bold text-green-500">READY</div>
                    <p className="text-xs text-muted-foreground mt-1">Strategy ready for trading</p>
                  </>
                ) : (
                  <>
                    <div className="text-3xl font-bold text-yellow-500">LEARNING</div>
                    <p className="text-xs text-muted-foreground mt-1">Analyzing patterns...</p>
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Active Strategy Performance */}
          {activeStrategy && activePerformance && (
            <Card data-testid="card-active-strategy" className="border-cyan-500/30">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Zap className="w-5 h-5 text-cyan-500" />
                    <span>Active Strategy: {activeStrategy.strategyName}</span>
                  </div>
                  {activePerformance.isReadyForLive ? (
                    <Badge className="bg-green-500/20 text-green-500 border-green-500/30">READY FOR LIVE</Badge>
                  ) : (
                    <Badge className="bg-yellow-500/20 text-yellow-500 border-yellow-500/30">IN LEARNING MODE</Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  <div className="bg-muted/30 rounded-lg p-4">
                    <p className="text-sm text-muted-foreground mb-1">Win Rate</p>
                    <p className="text-2xl font-bold text-cyan-500">{activePerformance.winRate || 0}%</p>
                    <p className="text-xs text-muted-foreground mt-1">Target: ≥65%</p>
                  </div>
                  
                  <div className="bg-muted/30 rounded-lg p-4">
                    <p className="text-sm text-muted-foreground mb-1">Avg Profit/Trade</p>
                    <p className="text-2xl font-bold text-cyan-500">{activePerformance.avgProfitPerTrade || 0}%</p>
                    <p className="text-xs text-muted-foreground mt-1">Target: ≥50%</p>
                  </div>
                  
                  <div className="bg-muted/30 rounded-lg p-4">
                    <p className="text-sm text-muted-foreground mb-1">Total Trades</p>
                    <p className="text-2xl font-bold">{activePerformance.totalTrades || 0}</p>
                    <p className="text-xs text-muted-foreground mt-1">Minimum: 20</p>
                  </div>
                  
                  <div className="bg-muted/30 rounded-lg p-4">
                    <p className="text-sm text-muted-foreground mb-1">Total P&L</p>
                    <p className={`text-2xl font-bold ${parseFloat(activePerformance.totalProfitLoss || '0') >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                      ${parseFloat(activePerformance.totalProfitLoss || '0').toFixed(2)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">All-time</p>
                  </div>
                </div>

                {/* Strategy Details */}
                <div className="mt-4 pt-4 border-t border-border/50">
                  <h4 className="font-semibold text-sm mb-2">Strategy Criteria</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                    {activeStrategy.minMarketCap !== undefined && (
                      <div className="flex items-center space-x-2">
                        <span className="text-muted-foreground">Min Market Cap:</span>
                        <span className="font-medium">${(activeStrategy.minMarketCap / 1_000_000).toFixed(2)}M</span>
                      </div>
                    )}
                    {activeStrategy.maxMarketCap !== undefined && (
                      <div className="flex items-center space-x-2">
                        <span className="text-muted-foreground">Max Market Cap:</span>
                        <span className="font-medium">${(activeStrategy.maxMarketCap / 1_000_000).toFixed(2)}M</span>
                      </div>
                    )}
                    {activeStrategy.minVolume !== undefined && (
                      <div className="flex items-center space-x-2">
                        <span className="text-muted-foreground">Min Volume:</span>
                        <span className="font-medium">${(activeStrategy.minVolume / 1_000_000).toFixed(2)}M</span>
                      </div>
                    )}
                    {activeStrategy.maxVolume !== undefined && (
                      <div className="flex items-center space-x-2">
                        <span className="text-muted-foreground">Max Volume:</span>
                        <span className="font-medium">${(activeStrategy.maxVolume / 1_000_000).toFixed(2)}M</span>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* All Strategies Comparison */}
          {strategies.length > 0 && (
            <Card data-testid="card-all-strategies">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Target className="w-5 h-5" />
                  <span>Strategy Comparison</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Strategy Name</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Win Rate</TableHead>
                        <TableHead>Avg Profit</TableHead>
                        <TableHead>Total Trades</TableHead>
                        <TableHead>Total P&L</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {strategies.map((strategy: any) => {
                        const winRate = strategy.winRate || 0;
                        const avgProfit = strategy.avgProfitPerTrade || 0;
                        const totalPL = parseFloat(strategy.totalProfitLoss || '0');
                        
                        return (
                          <TableRow key={strategy.id} data-testid={`row-strategy-${strategy.id}`}>
                            <TableCell className="font-medium">{strategy.strategyName}</TableCell>
                            <TableCell>
                              {strategy.isActive ? (
                                <Badge className="bg-cyan-500/20 text-cyan-500 border-cyan-500/30">Active</Badge>
                              ) : (
                                <Badge variant="outline">Inactive</Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              {winRate >= 65 ? (
                                <Badge className="bg-green-500/20 text-green-500 border-green-500/30">{winRate}%</Badge>
                              ) : winRate >= 50 ? (
                                <Badge className="bg-yellow-500/20 text-yellow-500 border-yellow-500/30">{winRate}%</Badge>
                              ) : (
                                <Badge className="bg-red-500/20 text-red-500 border-red-500/30">{winRate}%</Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              {avgProfit >= 50 ? (
                                <Badge className="bg-green-500/20 text-green-500 border-green-500/30">{avgProfit}%</Badge>
                              ) : avgProfit >= 30 ? (
                                <Badge className="bg-yellow-500/20 text-yellow-500 border-yellow-500/30">{avgProfit}%</Badge>
                              ) : (
                                <Badge className="bg-red-500/20 text-red-500 border-red-500/30">{avgProfit}%</Badge>
                              )}
                            </TableCell>
                            <TableCell>{strategy.totalTrades || 0}</TableCell>
                            <TableCell>
                              {totalPL >= 0 ? (
                                <span className="text-green-500 font-medium">${totalPL.toFixed(2)}</span>
                              ) : (
                                <span className="text-red-500 font-medium">${totalPL.toFixed(2)}</span>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Recent Launches */}
          <Card data-testid="card-recent-launches">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Rocket className="w-5 h-5" />
                <span>Recent Launches</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {recentLaunches.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <AlertCircle className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No recent launches detected</p>
                  <p className="text-sm mt-1">The system scans for new coins every 2 minutes</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Token</TableHead>
                        <TableHead>Detected</TableHead>
                        <TableHead>Market Cap</TableHead>
                        <TableHead>Volume</TableHead>
                        <TableHead>Initial Price</TableHead>
                        <TableHead>Final Price</TableHead>
                        <TableHead>Outcome</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {recentLaunches.map((launch: any) => {
                        const priceChange = launch.finalPrice && launch.initialPrice
                          ? ((parseFloat(launch.finalPrice) - parseFloat(launch.initialPrice)) / parseFloat(launch.initialPrice) * 100)
                          : null;
                        
                        // Determine outcome based on price change (>100% = success)
                        let outcomeDisplay = null;
                        if (launch.outcome === 'success' || (priceChange !== null && priceChange > 100)) {
                          outcomeDisplay = <Badge className="bg-green-500/20 text-green-500 border-green-500/30">Success ({'>'}100%)</Badge>;
                        } else if (launch.outcome === 'failure' || (priceChange !== null && priceChange <= 100 && launch.finalPrice)) {
                          outcomeDisplay = <Badge className="bg-red-500/20 text-red-500 border-red-500/30">Failure (≤100%)</Badge>;
                        } else {
                          outcomeDisplay = <Badge variant="outline" className="text-cyan-500">Monitoring</Badge>;
                        }
                        
                        return (
                          <TableRow key={launch.id} data-testid={`row-launch-${launch.id}`}>
                            <TableCell className="font-medium">
                              <div>
                                <div className="font-semibold">{launch.tokenSymbol}</div>
                                <div className="text-xs text-muted-foreground">{launch.tokenName}</div>
                              </div>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {formatDistanceToNow(new Date(launch.detectedAt), { addSuffix: true })}
                            </TableCell>
                            <TableCell>
                              ${launch.marketCap ? (parseFloat(launch.marketCap) / 1_000_000).toFixed(2) : '0'}M
                            </TableCell>
                            <TableCell>
                              ${launch.volume ? (parseFloat(launch.volume) / 1_000_000).toFixed(2) : '0'}M
                            </TableCell>
                            <TableCell>${parseFloat(launch.initialPrice || '0').toFixed(6)}</TableCell>
                            <TableCell>
                              {launch.finalPrice ? (
                                <div>
                                  <div>${parseFloat(launch.finalPrice).toFixed(6)}</div>
                                  {priceChange !== null && (
                                    <div className={`text-xs font-medium ${priceChange >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                      {priceChange >= 0 ? '+' : ''}{priceChange.toFixed(2)}%
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <span className="text-muted-foreground text-sm">Pending...</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {outcomeDisplay}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* System Information */}
          <Card data-testid="card-system-info" className="bg-muted/30">
            <CardHeader>
              <CardTitle className="text-sm flex items-center space-x-2">
                <AlertCircle className="w-4 h-4" />
                <span>How It Works</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-2">
              <p className="text-muted-foreground">
                <strong className="text-foreground">1. Detection:</strong> Scanner identifies coins ≤5 minutes on the market every 2 minutes
              </p>
              <p className="text-muted-foreground">
                <strong className="text-foreground">2. Tracking:</strong> Performance tracker monitors 1-hour price movements and categorizes as success ({'>'}100% growth) or failure
              </p>
              <p className="text-muted-foreground">
                <strong className="text-foreground">3. Analysis:</strong> Pattern analyzer extracts insights from successful launches and builds rejection criteria from failures (minimum 10 launches)
              </p>
              <p className="text-muted-foreground">
                <strong className="text-foreground">4. Experimentation:</strong> Strategy experimenter tests different approaches and tracks performance (minimum 20 trades)
              </p>
              <p className="text-muted-foreground">
                <strong className="text-foreground">5. Auto-Trading:</strong> System automatically trades when strategy achieves ≥65% win rate and ≥50% profit per trade
              </p>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
