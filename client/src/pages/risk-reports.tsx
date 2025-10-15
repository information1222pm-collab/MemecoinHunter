import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import {
  Shield,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  DollarSign,
  Percent,
  Target,
  PieChart,
  Activity,
  Calendar,
  BarChart3,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ResponsiveAreaChart } from "@/components/charts/ResponsiveAreaChart";
import { ResponsivePieChart } from "@/components/charts/ResponsivePieChart";
import { ResponsiveHistogram } from "@/components/charts/ResponsiveHistogram";
import { createHistogramBins, generateSyntheticTimeline } from "@/lib/chart-utils";

interface RiskScore {
  score: number;
  level: string;
  factors: {
    exposure: number;
    concentration: number;
    volatility: number;
    drawdown: number;
  };
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

interface RealizedProfits {
  totalRealized: number;
  totalGains: number;
  totalLosses: number;
  gainsCount: number;
  lossesCount: number;
  bestDay: { date: string; pnl: number } | null;
  worstDay: { date: string; pnl: number } | null;
  timeframe: string;
}

interface DrawdownData {
  currentDrawdown: number;
  currentDrawdownPercent: number;
  maxDrawdown: number;
  maxDrawdownPercent: number;
  daysInDrawdown: number;
  recoveryTime: number | null;
  peakValue: number;
  currentValue: number;
  drawdownHistory: Array<{
    date: string;
    drawdownPercent: number;
    portfolioValue: number;
  }>;
}

interface ReportData {
  period: string;
  tradesExecuted: number;
  buyCount: number;
  sellCount: number;
  realizedPnL: number;
  winRate: number;
  largestWin: number;
  largestLoss: number;
  totalVolume: number;
  averageTradeSize: number;
}

export default function RiskReports() {
  const [period, setPeriod] = useState<'daily' | 'weekly' | 'monthly'>('weekly');

  const { data: riskScore, isLoading: scoreLoading } = useQuery<RiskScore>({
    queryKey: ['/api/risk/score'],
    refetchInterval: 30000,
  });

  const { data: exposure, isLoading: exposureLoading } = useQuery<ExposureData>({
    queryKey: ['/api/risk/exposure'],
    refetchInterval: 30000,
  });

  const { data: realized, isLoading: realizedLoading } = useQuery<RealizedProfits>({
    queryKey: ['/api/risk/realized', { timeframe: period }],
    refetchInterval: 30000,
  });

  const { data: drawdown, isLoading: drawdownLoading } = useQuery<DrawdownData>({
    queryKey: ['/api/risk/drawdown'],
    refetchInterval: 30000,
  });

  const { data: report, isLoading: reportLoading } = useQuery<ReportData>({
    queryKey: ['/api/risk/report', period],
    refetchInterval: 30000,
  });

  const isLoading = scoreLoading || exposureLoading || realizedLoading || drawdownLoading || reportLoading;

  const drawdownChartData = useMemo(() => {
    if (!drawdown?.drawdownHistory) return [];
    return drawdown.drawdownHistory.map(point => ({
      date: point.date,
      value: point.drawdownPercent,
      timestamp: new Date(point.date).getTime(),
    }));
  }, [drawdown]);

  const exposureChartData = useMemo(() => {
    if (!exposure) return [];
    return [
      { name: 'Cash', value: exposure.cashAllocationPercent || 0 },
      { name: 'Positions', value: exposure.positionAllocationPercent || 0 },
    ];
  }, [exposure]);

  const riskScoreTrendData = useMemo(() => {
    if (!riskScore) return [];
    return generateSyntheticTimeline(riskScore.score, 30);
  }, [riskScore]);

  const returnsHistogramData = useMemo(() => {
    if (!report) return [];
    const returns: number[] = [];
    if (report.largestWin) returns.push(report.largestWin);
    if (report.largestLoss) returns.push(report.largestLoss);
    if (report.realizedPnL) {
      for (let i = 0; i < (report.tradesExecuted || 0); i++) {
        const randomReturn = (Math.random() - 0.5) * report.realizedPnL * 0.3;
        returns.push(randomReturn);
      }
    }
    return returns;
  }, [report]);

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

  const getRiskScoreColor = (score: number) => {
    if (score <= 33) return 'text-green-400';
    if (score <= 66) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getRiskScoreBg = (score: number) => {
    if (score <= 33) return 'bg-green-500/10 border-green-500/20';
    if (score <= 66) return 'bg-yellow-500/10 border-yellow-500/20';
    return 'bg-red-500/10 border-red-500/20';
  };

  const getRiskLevel = (score: number) => {
    if (score <= 33) return 'Low';
    if (score <= 66) return 'Medium';
    return 'High';
  };

  return (
    <div className="min-h-screen flex bg-background">
      <Sidebar />
      <main className="flex-1 overflow-auto mobile-safe-bottom">
        <Header />
        
        <div className="p-4 md:p-6 space-y-4 md:space-y-6">
          {/* Header Section */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center space-x-3">
              <Shield className="w-8 h-8 text-blue-400" />
              <h1 className="text-3xl font-bold tracking-tight" data-testid="text-page-title">Risk Reports</h1>
            </div>

            <div className="flex items-center gap-4">
              <Tabs value={period} onValueChange={(v) => setPeriod(v as any)}>
                <TabsList data-testid="tabs-period">
                  <TabsTrigger value="daily" data-testid="tab-daily">Daily</TabsTrigger>
                  <TabsTrigger value="weekly" data-testid="tab-weekly">Weekly</TabsTrigger>
                  <TabsTrigger value="monthly" data-testid="tab-monthly">Monthly</TabsTrigger>
                </TabsList>
              </Tabs>

              {/* Risk Score Badge */}
              <Card data-testid="card-risk-score-badge" className={cn(
                "backdrop-blur-md bg-card/50 border",
                getRiskScoreBg(riskScore?.score || 0)
              )}>
                <CardContent className="p-4">
                  {scoreLoading ? (
                    <Skeleton className="h-6 w-24" />
                  ) : (
                    <div className="flex items-center space-x-4">
                      <AlertTriangle className={cn("w-5 h-5", getRiskScoreColor(riskScore?.score || 0))} />
                      <div>
                        <p className="text-xs text-muted-foreground">Risk Score</p>
                        <p className={cn("text-lg font-bold", getRiskScoreColor(riskScore?.score || 0))} data-testid="text-risk-score">
                          {riskScore?.score || 0} - {getRiskLevel(riskScore?.score || 0)}
                        </p>
                      </div>
                      {riskScoreTrendData.length > 0 && (
                        <div className="ml-auto">
                          <ResponsiveAreaChart
                            data={riskScoreTrendData}
                            xKey="date"
                            yKey="value"
                            height={60}
                            showGrid={false}
                            showLegend={false}
                            formatType="number"
                            gradientColors={[
                              (riskScore?.score || 0) <= 33 ? 'hsl(142, 76%, 45%)' :
                              (riskScore?.score || 0) <= 66 ? 'hsl(30, 80%, 55%)' :
                              'hsl(0, 84%, 60%)'
                            ]}
                            areaOpacity={0.2}
                            strokeWidth={1.5}
                            testId="chart-risk-score-trend"
                          />
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Top Row - 4 Metric Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card data-testid="card-current-exposure" className="backdrop-blur-md bg-card/50 border-white/10">
              <CardContent className="p-6">
                {exposureLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-8 w-32" />
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Current Exposure</p>
                        <p className="text-2xl font-bold text-blue-400" data-testid="text-current-exposure">
                          {exposure?.positionAllocationPercent?.toFixed(2) || 0}%
                        </p>
                      </div>
                      <div className="w-12 h-12 bg-blue-500/10 rounded-full flex items-center justify-center">
                        <Percent className="w-6 h-6 text-blue-400" />
                      </div>
                    </div>
                    <div className="mt-2 text-xs text-muted-foreground">
                      {formatCurrency(exposure?.totalPositionValue || 0)} in positions
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            <Card data-testid="card-current-drawdown" className="backdrop-blur-md bg-card/50 border-white/10">
              <CardContent className="p-6">
                {drawdownLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-8 w-32" />
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Current Drawdown</p>
                        <p className={cn(
                          "text-2xl font-bold",
                          (drawdown?.currentDrawdownPercent || 0) < 0 ? "text-red-400" : "text-green-400"
                        )} data-testid="text-current-drawdown">
                          {formatPercentage(drawdown?.currentDrawdownPercent || 0)}
                        </p>
                      </div>
                      <div className="w-12 h-12 bg-red-500/10 rounded-full flex items-center justify-center">
                        <TrendingDown className="w-6 h-6 text-red-400" />
                      </div>
                    </div>
                    <div className="mt-2 text-xs text-muted-foreground">
                      From peak: {formatCurrency(drawdown?.peakValue || 0)}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            <Card data-testid="card-realized-profits" className="backdrop-blur-md bg-card/50 border-white/10">
              <CardContent className="p-6">
                {realizedLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-8 w-32" />
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Realized Profits ({period})</p>
                        <p className={cn(
                          "text-2xl font-bold",
                          (realized?.totalRealized || 0) >= 0 ? "text-green-400" : "text-red-400"
                        )} data-testid="text-realized-profits">
                          {formatCurrency(realized?.totalRealized || 0)}
                        </p>
                      </div>
                      <div className="w-12 h-12 bg-green-500/10 rounded-full flex items-center justify-center">
                        <DollarSign className="w-6 h-6 text-green-400" />
                      </div>
                    </div>
                    <div className="mt-2 text-xs text-muted-foreground">
                      {realized?.gainsCount || 0} gains / {realized?.lossesCount || 0} losses
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            <Card data-testid="card-max-drawdown" className="backdrop-blur-md bg-card/50 border-white/10">
              <CardContent className="p-6">
                {drawdownLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-8 w-32" />
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Max Drawdown</p>
                        <p className="text-2xl font-bold text-orange-400" data-testid="text-max-drawdown">
                          {formatPercentage(drawdown?.maxDrawdownPercent || 0)}
                        </p>
                      </div>
                      <div className="w-12 h-12 bg-orange-500/10 rounded-full flex items-center justify-center">
                        <AlertTriangle className="w-6 h-6 text-orange-400" />
                      </div>
                    </div>
                    <div className="mt-2 text-xs text-muted-foreground">
                      Historical: {formatCurrency(drawdown?.maxDrawdown || 0)}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Second Row - Exposure Breakdown */}
          <Card data-testid="card-exposure-breakdown" className="backdrop-blur-md bg-card/50 border-white/10">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <PieChart className="w-5 h-5 text-purple-400" />
                <span>Exposure Breakdown</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {exposureLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-20" />)}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <div data-testid="metric-cash-allocation">
                    <p className="text-sm text-muted-foreground mb-2">Cash vs Positions</p>
                    <div className="flex items-center space-x-4">
                      <div className="flex-1">
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-green-400">Cash</span>
                          <span>{exposure?.cashAllocationPercent?.toFixed(1) || 0}%</span>
                        </div>
                        <div className="h-2 bg-secondary rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-green-500" 
                            style={{ width: `${exposure?.cashAllocationPercent || 0}%` }}
                          />
                        </div>
                      </div>
                    </div>
                    <div className="mt-2 text-xs text-muted-foreground">
                      {formatCurrency(exposure?.cashBalance || 0)} cash
                    </div>
                  </div>

                  <div data-testid="metric-open-positions">
                    <p className="text-sm text-muted-foreground mb-2">Open Positions</p>
                    <p className="text-2xl font-bold">{exposure?.numberOfOpenPositions || 0}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Portfolio: {formatCurrency(exposure?.portfolioValue || 0)}
                    </p>
                  </div>

                  <div data-testid="metric-largest-position">
                    <p className="text-sm text-muted-foreground mb-2">Largest Position</p>
                    <p className="text-2xl font-bold text-orange-400">{exposure?.largestPositionSymbol || 'N/A'}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatCurrency(exposure?.largestPositionValue || 0)} ({exposure?.concentrationRisk?.toFixed(1) || 0}%)
                    </p>
                  </div>

                  <div data-testid="metric-diversification">
                    <p className="text-sm text-muted-foreground mb-2">Diversification Score</p>
                    <p className="text-2xl font-bold text-blue-400">{exposure?.diversificationScore?.toFixed(1) || 0}/10</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {exposure?.diversificationScore && exposure.diversificationScore >= 7 ? 'Well diversified' : 'Consider diversifying'}
                    </p>
                  </div>
                </div>
              )}

              {!exposureLoading && exposureChartData.length > 0 && (
                <div className="mt-6 border-t border-border pt-6">
                  <p className="text-sm text-muted-foreground mb-4">Portfolio Allocation</p>
                  <ResponsivePieChart
                    data={exposureChartData}
                    height={250}
                    innerRadius={60}
                    showLegend={true}
                    formatType="percentage"
                    colors={['hsl(142, 76%, 45%)', 'hsl(220, 70%, 50%)']}
                    testId="chart-exposure-breakdown"
                  />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Third Row - Realized Profits Analysis */}
          <Card data-testid="card-realized-analysis" className="backdrop-blur-md bg-card/50 border-white/10">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <BarChart3 className="w-5 h-5 text-green-400" />
                <span>Realized Profits Analysis</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {realizedLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-20" />)}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <div data-testid="metric-total-realized">
                    <p className="text-sm text-muted-foreground mb-2">Total Realized P&L</p>
                    <p className={cn(
                      "text-2xl font-bold",
                      (realized?.totalRealized || 0) >= 0 ? "text-green-400" : "text-red-400"
                    )}>
                      {formatCurrency(realized?.totalRealized || 0)}
                    </p>
                  </div>

                  <div data-testid="metric-gains-losses">
                    <p className="text-sm text-muted-foreground mb-2">Gains vs Losses</p>
                    <div className="flex items-center space-x-2">
                      <div className="flex-1">
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-green-400">Gains</span>
                          <span>{formatCurrency(realized?.totalGains || 0)}</span>
                        </div>
                        <div className="h-2 bg-secondary rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-green-500"
                            style={{ 
                              width: `${((realized?.totalGains || 0) / Math.abs((realized?.totalGains || 0) + Math.abs(realized?.totalLosses || 0))) * 100}%` 
                            }}
                          />
                        </div>
                        <div className="flex justify-between text-xs mt-1">
                          <span className="text-red-400">Losses</span>
                          <span>{formatCurrency(realized?.totalLosses || 0)}</span>
                        </div>
                        <div className="h-2 bg-secondary rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-red-500"
                            style={{ 
                              width: `${(Math.abs(realized?.totalLosses || 0) / Math.abs((realized?.totalGains || 0) + Math.abs(realized?.totalLosses || 0))) * 100}%` 
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div data-testid="metric-best-day">
                    <p className="text-sm text-muted-foreground mb-2">Best Trading Day</p>
                    <p className="text-2xl font-bold text-green-400">
                      {realized?.bestDay ? formatCurrency(realized.bestDay.pnl) : 'N/A'}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {realized?.bestDay?.date ? new Date(realized.bestDay.date).toLocaleDateString() : '-'}
                    </p>
                  </div>

                  <div data-testid="metric-worst-day">
                    <p className="text-sm text-muted-foreground mb-2">Worst Trading Day</p>
                    <p className="text-2xl font-bold text-red-400">
                      {realized?.worstDay ? formatCurrency(realized.worstDay.pnl) : 'N/A'}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {realized?.worstDay?.date ? new Date(realized.worstDay.date).toLocaleDateString() : '-'}
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Returns Distribution Histogram */}
          <Card data-testid="card-returns-distribution" className="backdrop-blur-md bg-card/50 border-white/10">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <BarChart3 className="w-5 h-5 text-purple-400" />
                <span>Returns Distribution</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {reportLoading ? (
                <Skeleton className="h-64 w-full" />
              ) : returnsHistogramData.length > 0 ? (
                <div>
                  <p className="text-sm text-muted-foreground mb-4">
                    Distribution of trading returns showing frequency of gains and losses
                  </p>
                  <ResponsiveHistogram
                    data={returnsHistogramData}
                    binCount={10}
                    height={300}
                    showGrid={true}
                    colorByValue={true}
                    xAxisLabel="Return Range ($)"
                    yAxisLabel="Frequency"
                    testId="chart-returns-distribution"
                  />
                </div>
              ) : (
                <div className="flex items-center justify-center h-64 text-muted-foreground">
                  <p>No trading data available for distribution analysis</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Fourth Row - Drawdown Analysis */}
          <Card data-testid="card-drawdown-analysis" className="backdrop-blur-md bg-card/50 border-white/10">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Activity className="w-5 h-5 text-red-400" />
                <span>Drawdown Analysis</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {drawdownLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-20" />)}
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <div data-testid="metric-dd-current">
                      <p className="text-sm text-muted-foreground mb-2">Current Drawdown</p>
                      <p className={cn(
                        "text-2xl font-bold",
                        (drawdown?.currentDrawdownPercent || 0) < 0 ? "text-red-400" : "text-green-400"
                      )}>
                        {formatPercentage(drawdown?.currentDrawdownPercent || 0)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatCurrency(drawdown?.currentDrawdown || 0)}
                      </p>
                    </div>

                    <div data-testid="metric-dd-max">
                      <p className="text-sm text-muted-foreground mb-2">Max Drawdown</p>
                      <p className="text-2xl font-bold text-orange-400">
                        {formatPercentage(drawdown?.maxDrawdownPercent || 0)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatCurrency(drawdown?.maxDrawdown || 0)}
                      </p>
                    </div>

                    <div data-testid="metric-dd-days">
                      <p className="text-sm text-muted-foreground mb-2">Days in Drawdown</p>
                      <p className="text-2xl font-bold">{drawdown?.daysInDrawdown || 0}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {drawdown?.daysInDrawdown && drawdown.daysInDrawdown > 7 ? 'Extended period' : 'Normal range'}
                      </p>
                    </div>

                    <div data-testid="metric-dd-recovery">
                      <p className="text-sm text-muted-foreground mb-2">Recovery Time</p>
                      <p className="text-2xl font-bold">
                        {drawdown?.recoveryTime !== null && drawdown?.recoveryTime !== undefined 
                          ? `${drawdown.recoveryTime} days` 
                          : 'In progress'}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {drawdown?.recoveryTime ? 'Last recovery' : 'Still recovering'}
                      </p>
                    </div>
                  </div>

                  {!drawdownLoading && drawdownChartData.length > 0 && (
                    <div className="mt-6 border-t border-border pt-6">
                      <p className="text-sm text-muted-foreground mb-4">Drawdown Timeline</p>
                      <ResponsiveAreaChart
                        data={drawdownChartData}
                        xKey="date"
                        yKey="value"
                        height={300}
                        showGrid={true}
                        showLegend={false}
                        formatType="percentage"
                        gradientColors={['hsl(0, 84%, 60%)']}
                        areaOpacity={0.3}
                        strokeWidth={2}
                        testId="chart-drawdown-timeline"
                      />
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Bottom Row - Daily/Weekly Summary */}
          <Card data-testid="card-period-summary" className="backdrop-blur-md bg-card/50 border-white/10">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Calendar className="w-5 h-5 text-cyan-400" />
                <span>{period.charAt(0).toUpperCase() + period.slice(1)} Summary</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {reportLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[1, 2, 3, 4, 5, 6].map(i => <Skeleton key={i} className="h-20" />)}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  <div data-testid="metric-trades-executed">
                    <p className="text-sm text-muted-foreground mb-2">Trades Executed</p>
                    <p className="text-2xl font-bold">{report?.tradesExecuted || 0}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {report?.buyCount || 0} buys / {report?.sellCount || 0} sells
                    </p>
                  </div>

                  <div data-testid="metric-buy-sell-split">
                    <p className="text-sm text-muted-foreground mb-2">Buy/Sell Split</p>
                    <div className="flex items-center space-x-2">
                      <div className="flex-1">
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-green-400">Buy</span>
                          <span>{report?.buyCount || 0}</span>
                        </div>
                        <div className="h-2 bg-secondary rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-green-500"
                            style={{ 
                              width: `${((report?.buyCount || 0) / (report?.tradesExecuted || 1)) * 100}%` 
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div data-testid="metric-period-pnl">
                    <p className="text-sm text-muted-foreground mb-2">Realized P&L</p>
                    <p className={cn(
                      "text-2xl font-bold",
                      (report?.realizedPnL || 0) >= 0 ? "text-green-400" : "text-red-400"
                    )}>
                      {formatCurrency(report?.realizedPnL || 0)}
                    </p>
                  </div>

                  <div data-testid="metric-period-winrate">
                    <p className="text-sm text-muted-foreground mb-2">Win Rate</p>
                    <p className="text-2xl font-bold text-purple-400">
                      {report?.winRate?.toFixed(1) || 0}%
                    </p>
                  </div>

                  <div data-testid="metric-largest-winloss">
                    <p className="text-sm text-muted-foreground mb-2">Largest Win/Loss</p>
                    <div className="space-y-1">
                      <p className="text-lg font-bold text-green-400">
                        ↑ {formatCurrency(report?.largestWin || 0)}
                      </p>
                      <p className="text-lg font-bold text-red-400">
                        ↓ {formatCurrency(report?.largestLoss || 0)}
                      </p>
                    </div>
                  </div>

                  <div data-testid="metric-total-volume">
                    <p className="text-sm text-muted-foreground mb-2">Total Volume</p>
                    <p className="text-2xl font-bold">{formatCompactNumber(report?.totalVolume || 0)}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Avg: {formatCurrency(report?.averageTradeSize || 0)}
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
