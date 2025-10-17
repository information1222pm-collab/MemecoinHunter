import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChartContainer, ChartConfig, ChartTooltipContent } from "@/components/ui/chart";
import { Tooltip as ChartTooltip } from "recharts";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, AreaChart, Area } from "recharts";
import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { TrendingUp, TrendingDown, DollarSign, Percent, Activity, Trophy, PlayCircle, Brain, Calendar, LineChartIcon } from "lucide-react";

const chartConfig: ChartConfig = {
  portfolio: {
    label: "Portfolio Value",
    color: "hsl(var(--primary))",
  },
  trades: {
    label: "Trade Count",
    color: "hsl(var(--secondary))",
  },
};

function MetricCard({ title, value, icon: Icon, trend, subtitle }: {
  title: string;
  value: string;
  icon: any;
  trend?: "up" | "down";
  subtitle?: string;
}) {
  return (
    <Card data-testid={`card-metric-${title.toLowerCase().replace(/ /g, '-')}`}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <p className="text-sm text-muted-foreground">{title}</p>
            <div className="flex items-center space-x-2 mt-1">
              <p className="text-2xl font-bold">{value}</p>
              {trend && (
                trend === "up" ? 
                  <TrendingUp className="w-4 h-4 text-green-500" /> :
                  <TrendingDown className="w-4 h-4 text-red-500" />
              )}
            </div>
            {subtitle && (
              <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
            )}
          </div>
          <Icon className="w-8 h-8 text-cyan-500 opacity-50" />
        </div>
      </CardContent>
    </Card>
  );
}

export default function Backtest() {
  const { toast } = useToast();
  const [strategy, setStrategy] = useState("momentum");
  const [startDate, setStartDate] = useState(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [initialCapital, setInitialCapital] = useState("10000");
  const [results, setResults] = useState<any>(null);

  const runBacktestMutation = useMutation({
    mutationFn: async (params: any) => {
      return await apiRequest("POST", "/api/backtest/run", params);
    },
    onSuccess: (data) => {
      setResults(data);
      // Calculate profit percentage from total P&L and initial capital
      const profitPercentage = ((data.totalPnL / parseFloat(initialCapital)) * 100).toFixed(2);
      toast({
        title: "Backtest Complete",
        description: `Successfully analyzed ${data.totalTrades} trades with ${profitPercentage}% return`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Backtest Failed",
        description: error.message || "Failed to run backtest",
        variant: "destructive",
      });
    },
  });

  const handleRunBacktest = () => {
    runBacktestMutation.mutate({
      strategyName: strategy,
      parameters: {
        minConfidence: strategy === "momentum" ? 70 : 75,
        stopLoss: 0.05,
        takeProfit: 0.20,
      },
      startDate,
      endDate,
      initialCapital: parseFloat(initialCapital),
    });
  };

  // Format chart data if results exist
  const chartData = results?.equityCurve?.map((point: any) => ({
    date: new Date(point.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    portfolio: point.equity || point.value || 0, // Support both field names
  })) || [];

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <Header />
        <div className="max-w-7xl mx-auto p-4 lg:p-6 space-y-6">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold bg-gradient-to-r from-cyan-400 to-cyan-600 bg-clip-text text-transparent">
              Strategy Backtesting
            </h1>
          </div>

          {/* Configuration Card */}
          <Card data-testid="card-backtest-config">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Brain className="w-5 h-5" />
                <span>Backtest Configuration</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {/* Strategy Selection */}
                <div>
                  <Label htmlFor="strategy">Strategy</Label>
                  <Select value={strategy} onValueChange={setStrategy}>
                    <SelectTrigger id="strategy" data-testid="select-strategy">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="momentum">Momentum Trading</SelectItem>
                      <SelectItem value="meanReversion">Mean Reversion</SelectItem>
                      <SelectItem value="breakout">Breakout Strategy</SelectItem>
                      <SelectItem value="aiDriven">AI-Driven Signals</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Start Date */}
                <div>
                  <Label htmlFor="start-date">Start Date</Label>
                  <Input
                    id="start-date"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    data-testid="input-start-date"
                  />
                </div>

                {/* End Date */}
                <div>
                  <Label htmlFor="end-date">End Date</Label>
                  <Input
                    id="end-date"
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    data-testid="input-end-date"
                  />
                </div>

                {/* Initial Capital */}
                <div>
                  <Label htmlFor="initial-capital">Initial Capital ($)</Label>
                  <Input
                    id="initial-capital"
                    type="number"
                    value={initialCapital}
                    onChange={(e) => setInitialCapital(e.target.value)}
                    min="1000"
                    step="1000"
                    data-testid="input-initial-capital"
                  />
                </div>
              </div>

              <Button
                onClick={handleRunBacktest}
                disabled={runBacktestMutation.isPending}
                className="mt-4"
                data-testid="button-run-backtest"
              >
                {runBacktestMutation.isPending ? (
                  <>
                    <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2" />
                    Running Backtest...
                  </>
                ) : (
                  <>
                    <PlayCircle className="w-4 h-4 mr-2" />
                    Run Backtest
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Results Section */}
          {results && (
            <>
              {/* Key Metrics */}
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <MetricCard
                  title="Total Return"
                  value={`${results.profitPercentage?.toFixed(2) || 0}%`}
                  icon={Percent}
                  trend={results.profitPercentage > 0 ? "up" : "down"}
                />
                <MetricCard
                  title="Final Portfolio"
                  value={`$${results.finalCapital?.toLocaleString() || 0}`}
                  icon={DollarSign}
                  subtitle={`From $${parseFloat(initialCapital).toLocaleString()}`}
                />
                <MetricCard
                  title="Win Rate"
                  value={`${results.winRate?.toFixed(1) || 0}%`}
                  icon={Trophy}
                  subtitle={`${results.winningTrades || 0}/${results.totalTrades || 0} trades`}
                />
                <MetricCard
                  title="Sharpe Ratio"
                  value={results.sharpeRatio?.toFixed(2) || "0.00"}
                  icon={Activity}
                  subtitle="Risk-adjusted returns"
                />
              </div>

              {/* Equity Curve Chart */}
              {chartData.length > 0 && (
                <Card data-testid="card-equity-curve">
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <LineChartIcon className="w-5 h-5" />
                      <span>Portfolio Value Over Time</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ChartContainer config={chartConfig} className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chartData}>
                          <defs>
                            <linearGradient id="colorPortfolio" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                              <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                          <XAxis
                            dataKey="date"
                            className="text-xs"
                            tick={{ fill: 'hsl(var(--muted-foreground))' }}
                          />
                          <YAxis
                            className="text-xs"
                            tick={{ fill: 'hsl(var(--muted-foreground))' }}
                            tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                          />
                          <ChartTooltip
                            content={
                              <ChartTooltipContent
                                formatter={(value: any) => `$${value.toLocaleString()}`}
                              />
                            }
                          />
                          <Area
                            type="monotone"
                            dataKey="portfolio"
                            stroke="hsl(var(--primary))"
                            strokeWidth={2}
                            fill="url(#colorPortfolio)"
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </ChartContainer>
                  </CardContent>
                </Card>
              )}

              {/* Performance Statistics */}
              <Card data-testid="card-performance-stats">
                <CardHeader>
                  <CardTitle>Detailed Performance Statistics</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <h4 className="font-semibold mb-2">Risk Metrics</h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Max Drawdown:</span>
                          <span className="font-medium">{results.maxDrawdown?.toFixed(2) || 0}%</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Volatility:</span>
                          <span className="font-medium">{results.volatility?.toFixed(2) || 0}%</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Risk/Reward Ratio:</span>
                          <span className="font-medium">{results.riskRewardRatio?.toFixed(2) || 0}</span>
                        </div>
                      </div>
                    </div>
                    <div>
                      <h4 className="font-semibold mb-2">Trading Performance</h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Average Trade:</span>
                          <span className="font-medium">${results.avgTrade?.toFixed(2) || 0}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Best Trade:</span>
                          <span className="font-medium text-green-500">${results.bestTrade?.toFixed(2) || 0}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Worst Trade:</span>
                          <span className="font-medium text-red-500">${results.worstTrade?.toFixed(2) || 0}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </main>
    </div>
  );
}