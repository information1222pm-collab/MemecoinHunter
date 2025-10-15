import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo, useEffect, Fragment } from "react";
import { useWebSocket } from "@/hooks/use-websocket";
import { 
  TrendingUp, 
  TrendingDown, 
  FileText, 
  Calendar, 
  DollarSign, 
  Percent, 
  Target,
  Clock,
  Filter,
  X,
  ChevronDown,
  ChevronUp,
  PieChart,
  BarChart3,
  Clock3
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { ResponsivePieChart } from "@/components/charts/ResponsivePieChart";
import { ResponsiveBarChart } from "@/components/charts/ResponsiveBarChart";
import { ResponsiveHistogram } from "@/components/charts/ResponsiveHistogram";

interface JournalStats {
  totalTrades: number;
  openPositions: number;
  closedPositions: number;
  winCount: number;
  lossCount: number;
  breakevenCount: number;
  winRate: number;
  averageReturn: number;
  averageHoldTime: number;
  totalProfitLoss: number;
}

interface TradeJournalEntry {
  id: string;
  portfolioId: string;
  tokenId: string;
  type: 'buy' | 'sell';
  amount: string;
  price: string;
  totalValue: string;
  exitPrice: string | null;
  realizedPnL: string | null;
  closedAt: Date | null;
  entryReason: string;
  entrySignal: string;
  patternType: string | null;
  patternConfidence: number | null;
  patternId: string | null;
  exitReason: string | null;
  exitSignal: string | null;
  stopLossTriggered: boolean;
  takeProfitTriggered: boolean;
  holdTime: number | null;
  holdTimeDays: number | null;
  returnPercent: number | null;
  outcome: 'win' | 'loss' | 'breakeven' | 'open';
  tokenSymbol: string;
  tokenName: string;
  entryTime: Date;
  exitTime: Date | null;
}

export default function Journal() {
  const queryClient = useQueryClient();
  const { isConnected, lastMessage } = useWebSocket();
  const [outcomeFilter, setOutcomeFilter] = useState<string>("all");
  const [strategyFilter, setStrategyFilter] = useState<string>("all");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  // Build query params from filters
  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    if (outcomeFilter !== "all") params.append("outcome", outcomeFilter);
    if (strategyFilter !== "all") params.append("pattern", strategyFilter);
    if (startDate) params.append("startDate", startDate);
    if (endDate) params.append("endDate", endDate);
    return params.toString();
  }, [outcomeFilter, strategyFilter, startDate, endDate]);

  // Fetch journal stats
  const { data: stats, isLoading: statsLoading } = useQuery<JournalStats>({
    queryKey: ['/api/journal/stats'],
    refetchInterval: 30000,
  });

  // Fetch journal entries with filters
  const { data: entries, isLoading: entriesLoading } = useQuery<TradeJournalEntry[]>({
    queryKey: ['/api/journal/entries', queryParams],
    refetchInterval: 30000,
  });

  // WebSocket real-time updates
  useEffect(() => {
    if (!lastMessage || !isConnected) return;

    const { type } = lastMessage;

    switch (type) {
      case 'trade_executed':
      case 'portfolio_updated':
      case 'positions_updated':
        // Refresh journal when trades or positions change
        queryClient.invalidateQueries({ queryKey: ['/api/journal/stats'] });
        queryClient.invalidateQueries({ queryKey: ['/api/journal/entries'] });
        break;
    }
  }, [lastMessage, isConnected, queryClient]);

  // Get unique strategies from entries
  const uniqueStrategies = useMemo(() => {
    if (!entries) return [];
    const strategies = new Set<string>();
    entries.forEach(entry => {
      if (entry.patternType) {
        strategies.add(entry.patternType);
      }
    });
    return Array.from(strategies);
  }, [entries]);

  // Chart 1: Trade Outcomes Donut Chart Data
  const outcomesData = useMemo(() => {
    if (!stats) return [];
    return [
      { name: 'Wins', value: stats.winCount || 0 },
      { name: 'Losses', value: stats.lossCount || 0 },
      { name: 'Breakeven', value: stats.breakevenCount || 0 },
    ].filter(item => item.value > 0);
  }, [stats]);

  // Chart 2: P&L by Strategy Stacked Bar Chart Data
  const strategyPnLData = useMemo(() => {
    if (!entries || entries.length === 0) return [];
    
    const grouped: Record<string, { wins: number; losses: number }> = {};
    
    entries.forEach(entry => {
      if (entry.outcome === 'open' || !entry.realizedPnL) return;
      
      const strategy = entry.patternType || 'Manual';
      const pnl = parseFloat(entry.realizedPnL);
      
      if (!grouped[strategy]) {
        grouped[strategy] = { wins: 0, losses: 0 };
      }
      
      if (pnl > 0) {
        grouped[strategy].wins += pnl;
      } else if (pnl < 0) {
        grouped[strategy].losses += Math.abs(pnl);
      }
    });
    
    return Object.entries(grouped).map(([name, values]) => ({
      name: name.replace(/_/g, ' ').toUpperCase(),
      wins: values.wins,
      losses: values.losses,
    }));
  }, [entries]);

  // Chart 3: Hold Time Distribution Histogram Data
  const holdTimeData = useMemo(() => {
    if (!entries || entries.length === 0) return [];
    
    const bins = [
      { range: '0-1h', min: 0, max: 1, count: 0 },
      { range: '1-6h', min: 1, max: 6, count: 0 },
      { range: '6-24h', min: 6, max: 24, count: 0 },
      { range: '1-3d', min: 24, max: 72, count: 0 },
      { range: '3-7d', min: 72, max: 168, count: 0 },
      { range: '7d+', min: 168, max: Infinity, count: 0 },
    ];
    
    entries.forEach(entry => {
      if (!entry.holdTime) return;
      
      const hours = entry.holdTime / (1000 * 60 * 60);
      
      for (const bin of bins) {
        if (hours >= bin.min && hours < bin.max) {
          bin.count++;
          break;
        }
      }
    });
    
    return bins.filter(bin => bin.count > 0);
  }, [entries]);

  // Formatting helpers
  const formatCurrency = (value: string | number) => {
    const numValue = typeof value === 'string' ? parseFloat(value) || 0 : (value || 0);
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(numValue);
  };

  const formatPercentage = (value: number | null) => {
    if (value === null || value === undefined) return 'N/A';
    const sign = value >= 0 ? '+' : '';
    return `${sign}${value.toFixed(2)}%`;
  };

  const formatHoldTime = (milliseconds: number | null) => {
    if (!milliseconds) return 'N/A';
    const hours = milliseconds / (1000 * 60 * 60);
    if (hours < 1) {
      const minutes = Math.floor(milliseconds / (1000 * 60));
      return `${minutes}m`;
    }
    if (hours < 24) return `${hours.toFixed(1)}h`;
    const days = hours / 24;
    return `${days.toFixed(1)}d`;
  };

  const getOutcomeColor = (outcome: string) => {
    switch (outcome) {
      case 'win': return 'text-green-400';
      case 'loss': return 'text-red-400';
      case 'breakeven': return 'text-gray-400';
      case 'open': return 'text-blue-400';
      default: return 'text-gray-400';
    }
  };

  const getOutcomeBg = (outcome: string) => {
    switch (outcome) {
      case 'win': return 'bg-green-500/10 border-green-500/20';
      case 'loss': return 'bg-red-500/10 border-red-500/20';
      case 'breakeven': return 'bg-gray-500/10 border-gray-500/20';
      case 'open': return 'bg-blue-500/10 border-blue-500/20';
      default: return 'bg-gray-500/10 border-gray-500/20';
    }
  };

  const clearFilters = () => {
    setOutcomeFilter("all");
    setStrategyFilter("all");
    setStartDate("");
    setEndDate("");
  };

  const hasActiveFilters = outcomeFilter !== "all" || strategyFilter !== "all" || startDate || endDate;

  const toggleRowExpansion = (id: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedRows(newExpanded);
  };

  return (
    <div className="min-h-screen flex bg-background">
      <Sidebar />
      <main className="flex-1 overflow-auto mobile-safe-bottom">
        <Header />
        
        <div className="p-4 md:p-6 space-y-4 md:space-y-6">
          {/* Page Header */}
          <div className="flex items-center space-x-3">
            <FileText className="w-8 h-8 text-orange-400" />
            <h1 className="text-3xl font-bold tracking-tight" data-testid="text-page-title">Trade Journal</h1>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total Trades */}
            <Card data-testid="card-total-trades" className="backdrop-blur-md bg-card/50 border-white/10">
              <CardContent className="p-6">
                {statsLoading ? (
                  <div className="space-y-2">
                    <div className="h-4 bg-secondary/30 rounded animate-pulse" />
                    <div className="h-8 bg-secondary/30 rounded animate-pulse" />
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Total Trades</p>
                        <p className="text-2xl font-bold" data-testid="text-total-trades">
                          {stats?.totalTrades || 0}
                        </p>
                      </div>
                      <div className="w-12 h-12 bg-orange-500/10 rounded-full flex items-center justify-center">
                        <FileText className="w-6 h-6 text-orange-400" />
                      </div>
                    </div>
                    <div className="mt-2 text-xs text-muted-foreground">
                      {stats?.closedPositions || 0} closed / {stats?.openPositions || 0} open
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Win Rate */}
            <Card data-testid="card-win-rate" className="backdrop-blur-md bg-card/50 border-white/10">
              <CardContent className="p-6">
                {statsLoading ? (
                  <div className="space-y-2">
                    <div className="h-4 bg-secondary/30 rounded animate-pulse" />
                    <div className="h-8 bg-secondary/30 rounded animate-pulse" />
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Win Rate</p>
                        <p className="text-2xl font-bold text-green-400" data-testid="text-win-rate">
                          {(stats?.closedPositions || 0) === 0 ? 'N/A' : `${stats?.winRate?.toFixed(1)}%`}
                        </p>
                      </div>
                      <div className="w-12 h-12 bg-green-500/10 rounded-full flex items-center justify-center">
                        <Target className="w-6 h-6 text-green-400" />
                      </div>
                    </div>
                    <div className="mt-2 text-xs text-muted-foreground">
                      {(stats?.closedPositions || 0) === 0 
                        ? 'No closed trades yet' 
                        : `${stats?.winCount || 0}W / ${stats?.lossCount || 0}L / ${stats?.breakevenCount || 0}BE`
                      }
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Average Return */}
            <Card data-testid="card-avg-return" className="backdrop-blur-md bg-card/50 border-white/10">
              <CardContent className="p-6">
                {statsLoading ? (
                  <div className="space-y-2">
                    <div className="h-4 bg-secondary/30 rounded animate-pulse" />
                    <div className="h-8 bg-secondary/30 rounded animate-pulse" />
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Avg Return</p>
                        <p className={cn(
                          "text-2xl font-bold",
                          (stats?.closedPositions || 0) === 0 ? "text-gray-400" : (stats?.averageReturn || 0) >= 0 ? "text-green-400" : "text-red-400"
                        )} data-testid="text-avg-return">
                          {(stats?.closedPositions || 0) === 0 ? 'N/A' : formatPercentage(stats?.averageReturn || 0)}
                        </p>
                      </div>
                      <div className="w-12 h-12 bg-blue-500/10 rounded-full flex items-center justify-center">
                        <Percent className="w-6 h-6 text-blue-400" />
                      </div>
                    </div>
                    <div className="mt-2 text-xs text-muted-foreground">
                      {(stats?.closedPositions || 0) === 0 ? 'No data available' : 'Per trade average'}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Total P&L */}
            <Card data-testid="card-total-pnl" className="backdrop-blur-md bg-card/50 border-white/10">
              <CardContent className="p-6">
                {statsLoading ? (
                  <div className="space-y-2">
                    <div className="h-4 bg-secondary/30 rounded animate-pulse" />
                    <div className="h-8 bg-secondary/30 rounded animate-pulse" />
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Total P&L</p>
                        <p className={cn(
                          "text-2xl font-bold",
                          (stats?.totalProfitLoss || 0) >= 0 ? "text-green-400" : "text-red-400"
                        )} data-testid="text-total-pnl">
                          {formatCurrency(stats?.totalProfitLoss || 0)}
                        </p>
                      </div>
                      <div className={cn(
                        "w-12 h-12 rounded-full flex items-center justify-center",
                        (stats?.totalProfitLoss || 0) >= 0 ? "bg-green-500/10" : "bg-red-500/10"
                      )}>
                        {(stats?.totalProfitLoss || 0) >= 0 ? (
                          <TrendingUp className="w-6 h-6 text-green-400" />
                        ) : (
                          <TrendingDown className="w-6 h-6 text-red-400" />
                        )}
                      </div>
                    </div>
                    <div className="mt-2 text-xs text-muted-foreground">
                      Realized profit/loss
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Charts Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
            {/* Trade Outcomes Donut Chart */}
            <Card data-testid="chart-trade-outcomes" className="backdrop-blur-md bg-card/50 border-white/10">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <PieChart className="w-5 h-5 text-orange-400" />
                  <span>Trade Outcomes</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {statsLoading ? (
                  <Skeleton className="h-[300px] w-full" />
                ) : outcomesData.length === 0 ? (
                  <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                    No trade data available
                  </div>
                ) : (
                  <ResponsivePieChart
                    data={outcomesData}
                    height={300}
                    innerRadius={60}
                    showLegend={true}
                    formatType="number"
                    colors={['hsl(142, 76%, 45%)', 'hsl(0, 84%, 60%)', 'hsl(215, 20%, 65%)']}
                    testId="pie-trade-outcomes"
                  />
                )}
              </CardContent>
            </Card>

            {/* P&L by Strategy Stacked Bar Chart */}
            <Card data-testid="chart-strategy-pnl" className="backdrop-blur-md bg-card/50 border-white/10">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <BarChart3 className="w-5 h-5 text-orange-400" />
                  <span>P&L by Strategy</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {entriesLoading ? (
                  <Skeleton className="h-[300px] w-full" />
                ) : strategyPnLData.length === 0 ? (
                  <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                    No strategy data available
                  </div>
                ) : (
                  <ResponsiveBarChart
                    data={strategyPnLData}
                    xKey="name"
                    yKey={['wins', 'losses']}
                    height={300}
                    showLegend={true}
                    showGrid={true}
                    formatType="currency"
                    stacked={true}
                    colors={['hsl(142, 76%, 45%)', 'hsl(0, 84%, 60%)']}
                    testId="bar-strategy-pnl"
                  />
                )}
              </CardContent>
            </Card>
          </div>

          {/* Hold Time Distribution Histogram */}
          <Card data-testid="chart-hold-time-distribution" className="backdrop-blur-md bg-card/50 border-white/10">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Clock3 className="w-5 h-5 text-orange-400" />
                <span>Hold Time Distribution</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {entriesLoading ? (
                <Skeleton className="h-[300px] w-full" />
              ) : holdTimeData.length === 0 ? (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                  No hold time data available
                </div>
              ) : (
                <ResponsiveBarChart
                  data={holdTimeData}
                  xKey="range"
                  yKey="count"
                  height={300}
                  showGrid={true}
                  formatType="number"
                  colors={['hsl(262, 73%, 65%)']}
                  testId="histogram-hold-time"
                />
              )}
            </CardContent>
          </Card>

          {/* Filters Section */}
          <Card className="backdrop-blur-md bg-card/50 border-white/10">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center space-x-2">
                  <Filter className="w-5 h-5 text-orange-400" />
                  <span>Filters</span>
                </CardTitle>
                {hasActiveFilters && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearFilters}
                    className="text-orange-400 hover:text-orange-300"
                    data-testid="button-clear-filters"
                  >
                    <X className="w-4 h-4 mr-1" />
                    Clear
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Outcome Filter */}
                <div>
                  <label className="text-sm text-muted-foreground mb-2 block">Outcome</label>
                  <Select value={outcomeFilter} onValueChange={setOutcomeFilter}>
                    <SelectTrigger data-testid="filter-outcome" className="bg-secondary/30 border-white/10">
                      <SelectValue placeholder="All outcomes" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="win">Win</SelectItem>
                      <SelectItem value="loss">Loss</SelectItem>
                      <SelectItem value="breakeven">Breakeven</SelectItem>
                      <SelectItem value="open">Open</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Strategy/Pattern Filter */}
                <div>
                  <label className="text-sm text-muted-foreground mb-2 block">Strategy</label>
                  <Select value={strategyFilter} onValueChange={setStrategyFilter}>
                    <SelectTrigger data-testid="filter-strategy" className="bg-secondary/30 border-white/10">
                      <SelectValue placeholder="All strategies" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      {uniqueStrategies.map(strategy => (
                        <SelectItem key={strategy} value={strategy}>
                          {strategy.replace(/_/g, ' ').toUpperCase()}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Start Date */}
                <div>
                  <label className="text-sm text-muted-foreground mb-2 block">From Date</label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full bg-secondary/30 border border-white/10 rounded-md px-10 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                      data-testid="input-start-date"
                    />
                  </div>
                </div>

                {/* End Date */}
                <div>
                  <label className="text-sm text-muted-foreground mb-2 block">To Date</label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-full bg-secondary/30 border border-white/10 rounded-md px-10 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                      data-testid="input-end-date"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Trades List */}
          <Card className="backdrop-blur-md bg-card/50 border-white/10">
            <CardHeader>
              <CardTitle>Trade History</CardTitle>
            </CardHeader>
            <CardContent>
              {entriesLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="h-24 bg-secondary/30 rounded-lg animate-pulse" />
                  ))}
                </div>
              ) : entries && entries.length > 0 ? (
                <div className="space-y-2">
                  {/* Desktop Table */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-white/10">
                          <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Entry Time</th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Token</th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Type</th>
                          <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Amount</th>
                          <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Entry Price</th>
                          <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Exit Price</th>
                          <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Hold Time</th>
                          <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Return %</th>
                          <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">P&L</th>
                          <th className="text-center py-3 px-4 text-sm font-medium text-muted-foreground">Outcome</th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Strategy</th>
                          <th className="w-8"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {entries.map((entry, index) => (
                          <Fragment key={entry.id}>
                            <tr
                              className={cn(
                                "border-b border-white/5 hover:bg-secondary/30 transition-colors cursor-pointer",
                                index % 2 === 0 ? "bg-secondary/10" : ""
                              )}
                              onClick={() => toggleRowExpansion(entry.id)}
                              data-testid={`trade-row-${entry.id}`}
                            >
                              <td className="py-3 px-4 text-sm">
                                {formatDistanceToNow(new Date(entry.entryTime), { addSuffix: true })}
                              </td>
                              <td className="py-3 px-4">
                                <div>
                                  <div className="font-medium">{entry.tokenSymbol}</div>
                                  <div className="text-xs text-muted-foreground">{entry.tokenName}</div>
                                </div>
                              </td>
                              <td className="py-3 px-4">
                                <Badge
                                  variant={entry.type === 'buy' ? 'default' : 'secondary'}
                                  className={cn(
                                    entry.type === 'buy' 
                                      ? 'bg-green-600/80 hover:bg-green-600' 
                                      : 'bg-red-600/80 hover:bg-red-600'
                                  )}
                                >
                                  {entry.type.toUpperCase()}
                                </Badge>
                              </td>
                              <td className="py-3 px-4 text-sm text-right">{parseFloat(entry.amount).toFixed(4)}</td>
                              <td className="py-3 px-4 text-sm text-right">{formatCurrency(entry.price)}</td>
                              <td className="py-3 px-4 text-sm text-right">
                                {entry.exitPrice ? formatCurrency(entry.exitPrice) : '-'}
                              </td>
                              <td className="py-3 px-4 text-sm text-right">{formatHoldTime(entry.holdTime)}</td>
                              <td className={cn(
                                "py-3 px-4 text-sm text-right font-medium",
                                getOutcomeColor(entry.outcome)
                              )}>
                                {formatPercentage(entry.returnPercent)}
                              </td>
                              <td className={cn(
                                "py-3 px-4 text-sm text-right font-medium",
                                getOutcomeColor(entry.outcome)
                              )}>
                                {entry.realizedPnL ? formatCurrency(entry.realizedPnL) : '-'}
                              </td>
                              <td className="py-3 px-4">
                                <Badge className={cn("capitalize", getOutcomeBg(entry.outcome))}>
                                  {entry.outcome}
                                </Badge>
                              </td>
                              <td className="py-3 px-4 text-sm">
                                {entry.patternType ? entry.patternType.replace(/_/g, ' ').toUpperCase() : 'Manual'}
                              </td>
                              <td className="py-3 px-4">
                                {expandedRows.has(entry.id) ? (
                                  <ChevronUp className="w-4 h-4 text-muted-foreground" />
                                ) : (
                                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                                )}
                              </td>
                            </tr>
                            {expandedRows.has(entry.id) && (
                              <tr className="bg-secondary/20 border-b border-white/5">
                                <td colSpan={12} className="p-4">
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                                    <div>
                                      <h4 className="font-semibold mb-2 text-orange-400">Entry Details</h4>
                                      <div className="space-y-1">
                                        <div className="flex justify-between">
                                          <span className="text-muted-foreground">Reason:</span>
                                          <Badge variant="outline" className="text-xs">{entry.entryReason}</Badge>
                                        </div>
                                        <div className="flex justify-between">
                                          <span className="text-muted-foreground">Signal:</span>
                                          <span>{entry.entrySignal}</span>
                                        </div>
                                        {entry.patternConfidence && (
                                          <div className="flex justify-between">
                                            <span className="text-muted-foreground">Pattern Confidence:</span>
                                            <span>{entry.patternConfidence}%</span>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                    <div>
                                      <h4 className="font-semibold mb-2 text-orange-400">Exit Details</h4>
                                      <div className="space-y-1">
                                        <div className="flex justify-between">
                                          <span className="text-muted-foreground">Reason:</span>
                                          <Badge variant="outline" className="text-xs">
                                            {entry.exitReason || 'Still Open'}
                                          </Badge>
                                        </div>
                                        <div className="flex justify-between">
                                          <span className="text-muted-foreground">Signal:</span>
                                          <span>{entry.exitSignal || 'N/A'}</span>
                                        </div>
                                        <div className="flex justify-between">
                                          <span className="text-muted-foreground">Stop Loss:</span>
                                          <span className={entry.stopLossTriggered ? "text-red-400" : ""}>
                                            {entry.stopLossTriggered ? 'Triggered' : 'Not Triggered'}
                                          </span>
                                        </div>
                                        <div className="flex justify-between">
                                          <span className="text-muted-foreground">Take Profit:</span>
                                          <span className={entry.takeProfitTriggered ? "text-green-400" : ""}>
                                            {entry.takeProfitTriggered ? 'Triggered' : 'Not Triggered'}
                                          </span>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </Fragment>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile Cards */}
                  <div className="md:hidden space-y-3">
                    {entries.map((entry) => (
                      <div
                        key={entry.id}
                        className="p-4 bg-secondary/30 rounded-lg border border-white/10"
                        data-testid={`trade-card-${entry.id}`}
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <div className="flex items-center space-x-2 mb-1">
                              <span className="font-bold">{entry.tokenSymbol}</span>
                              <Badge
                                variant={entry.type === 'buy' ? 'default' : 'secondary'}
                                className={cn(
                                  'text-xs',
                                  entry.type === 'buy' 
                                    ? 'bg-green-600/80' 
                                    : 'bg-red-600/80'
                                )}
                              >
                                {entry.type.toUpperCase()}
                              </Badge>
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {formatDistanceToNow(new Date(entry.entryTime), { addSuffix: true })}
                            </div>
                          </div>
                          <Badge className={cn("capitalize", getOutcomeBg(entry.outcome))}>
                            {entry.outcome}
                          </Badge>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                          <div>
                            <div className="text-muted-foreground text-xs">Entry Price</div>
                            <div className="font-medium">{formatCurrency(entry.price)}</div>
                          </div>
                          <div>
                            <div className="text-muted-foreground text-xs">Exit Price</div>
                            <div className="font-medium">{entry.exitPrice ? formatCurrency(entry.exitPrice) : '-'}</div>
                          </div>
                          <div>
                            <div className="text-muted-foreground text-xs">Return</div>
                            <div className={cn("font-medium", getOutcomeColor(entry.outcome))}>
                              {formatPercentage(entry.returnPercent)}
                            </div>
                          </div>
                          <div>
                            <div className="text-muted-foreground text-xs">P&L</div>
                            <div className={cn("font-medium", getOutcomeColor(entry.outcome))}>
                              {entry.realizedPnL ? formatCurrency(entry.realizedPnL) : '-'}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t border-white/10">
                          <Badge variant="outline" className="text-xs">
                            {entry.entryReason}
                          </Badge>
                          <div className="flex items-center space-x-1 text-xs text-muted-foreground">
                            <Clock className="w-3 h-3" />
                            <span>{formatHoldTime(entry.holdTime)}</span>
                          </div>
                        </div>

                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full mt-2"
                          onClick={() => toggleRowExpansion(entry.id)}
                          data-testid={`button-expand-${entry.id}`}
                        >
                          {expandedRows.has(entry.id) ? (
                            <>Less Details <ChevronUp className="w-4 h-4 ml-1" /></>
                          ) : (
                            <>More Details <ChevronDown className="w-4 h-4 ml-1" /></>
                          )}
                        </Button>

                        {expandedRows.has(entry.id) && (
                          <div className="mt-3 pt-3 border-t border-white/10">
                            <div className="space-y-3 text-sm">
                              <div>
                                <h4 className="font-semibold mb-2 text-orange-400">Entry Details</h4>
                                <div className="space-y-1">
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">Signal:</span>
                                    <span>{entry.entrySignal}</span>
                                  </div>
                                  {entry.patternType && (
                                    <div className="flex justify-between">
                                      <span className="text-muted-foreground">Pattern:</span>
                                      <span>{entry.patternType.replace(/_/g, ' ').toUpperCase()}</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                              <div>
                                <h4 className="font-semibold mb-2 text-orange-400">Exit Details</h4>
                                <div className="space-y-1">
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">Reason:</span>
                                    <span>{entry.exitReason || 'Still Open'}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">Stop Loss:</span>
                                    <span className={entry.stopLossTriggered ? "text-red-400" : ""}>
                                      {entry.stopLossTriggered ? 'Triggered' : 'Not Triggered'}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-12">
                  <FileText className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-30" />
                  <p className="text-lg font-medium text-muted-foreground mb-2">No trades found</p>
                  <p className="text-sm text-muted-foreground">
                    {hasActiveFilters 
                      ? "Try adjusting your filters to see more trades" 
                      : "Trades will appear here once executed"}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
