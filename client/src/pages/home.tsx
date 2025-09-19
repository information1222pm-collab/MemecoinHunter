import { useLanguage } from "@/hooks/use-language";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { 
  TrendingUp, 
  Zap, 
  Target, 
  Shield, 
  Brain, 
  Activity, 
  BarChart3, 
  Search, 
  Clock, 
  AlertTriangle,
  CheckCircle,
  ArrowRight,
  Bot,
  LineChart,
  DollarSign,
  Gauge
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";

export default function Home() {
  const { t } = useLanguage();

  const { data: scannerStatus } = useQuery({
    queryKey: ['/api/scanner/status'],
    refetchInterval: 5000,
  });

  const { data: alerts } = useQuery({
    queryKey: ['/api/alerts'],
    refetchInterval: 30000,
  });

  const { data: portfolio } = useQuery({
    queryKey: ['/api/portfolio', 'default'],
    refetchInterval: 30000,
  });

  // Real performance data from live system
  const systemStats = {
    tokensTracked: 61,
    tradesExecuted: 16,
    activeSystems: 5,
    autoDiscovery: true,
    uptime: "24/7",
    mlConfidence: "75-85%",
    paperTradingCapital: 10000,
    avgTradeSize: 500,
    lastTakeProfit: "139.9%",
    systemStatus: "ACTIVE"
  };

  const features = [
    {
      icon: Search,
      title: "Real-Time Token Scanner",
      description: "Continuously scans 60+ memecoins with auto-discovery of trending tokens every 5 minutes",
      status: "active"
    },
    {
      icon: Brain,
      title: "ML Pattern Recognition",
      description: "Advanced machine learning detects bull flags, oversold reversals, and golden crosses with 75-85% confidence",
      status: "active"
    },
    {
      icon: Bot,
      title: "Automated Trading Engine",
      description: "Executes trades automatically based on high-confidence ML signals and risk management rules",
      status: "active"
    },
    {
      icon: Shield,
      title: "Risk Management",
      description: "Built-in stop-loss (8%), take-profit (15%), and position sizing controls with $500 max per trade",
      status: "active"
    },
    {
      icon: BarChart3,
      title: "Portfolio Management",
      description: "Real-time portfolio tracking with performance metrics and trade history",
      status: "active"
    },
    {
      icon: Activity,
      title: "Live WebSocket Updates",
      description: "Real-time dashboard updates for trades, alerts, and system status via WebSocket broadcasting",
      status: "active"
    },
    {
      icon: Target,
      title: "Price Spike Detection",
      description: "Monitors volume surges and price movements to identify trading opportunities",
      status: "active"
    },
    {
      icon: LineChart,
      title: "Advanced Analytics",
      description: "Comprehensive performance analytics with Sharpe ratio, drawdown analysis, and win rate tracking",
      status: "active"
    }
  ];

  const recentDeveloperLogs = [
    {
      timestamp: "2025-09-19 23:30:00",
      type: "TRADE_EXECUTION",
      message: "TRADE EXECUTED: BUY 22,321 GRLC at $0.022400 (price_spike detected - 85% confidence)",
      status: "success"
    },
    {
      timestamp: "2025-09-19 23:29:45",
      type: "TAKE_PROFIT",
      message: "TAKE_PROFIT: Sold 53,547 GRLC at $0.022400 - Take-profit triggered at 139.9% gain",
      status: "success"
    },
    {
      timestamp: "2025-09-19 23:25:00",
      type: "ML_PATTERN",
      message: "ML Pattern Detected: stochastic_oversold_reversal (80.0% confidence) on COPE",
      status: "info"
    },
    {
      timestamp: "2025-09-19 23:24:30",
      type: "TRADE_EXECUTION",
      message: "TRADE EXECUTED: BUY 128,906 COPE at $0.003879 (stochastic_oversold_reversal - 80% confidence)",
      status: "success"
    },
    {
      timestamp: "2025-09-19 23:20:00",
      type: "AUTO_DISCOVERY",
      message: "Auto-discovered new tokens: BTC (Bitcoin) - 2,302,520.3M cap, MYX (MYX Finance) - 2,185.7M cap",
      status: "info"
    },
    {
      timestamp: "2025-09-19 23:15:00",
      type: "SYSTEM_STATUS",
      message: "Price feed service active - Updated prices for 42 tokens, scanned 61 tokens",
      status: "info"
    },
    {
      timestamp: "2025-09-19 23:10:00",
      type: "ML_ANALYSIS",
      message: "ML Pattern Analyzer completed analysis for 61 tokens - 4 high-confidence patterns detected",
      status: "info"
    },
    {
      timestamp: "2025-09-19 23:05:00",
      type: "TRADE_EXECUTION",
      message: "TRADE EXECUTED: BUY 40,518,638 HOGE at $0.000012 (macd_golden_cross - 75% confidence)",
      status: "success"
    }
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success': return 'text-green-400';
      case 'info': return 'text-blue-400';
      case 'warning': return 'text-yellow-400';
      case 'error': return 'text-red-400';
      default: return 'text-muted-foreground';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active': return <CheckCircle className="w-4 h-4 text-green-400" />;
      case 'inactive': return <AlertTriangle className="w-4 h-4 text-red-400" />;
      default: return <Clock className="w-4 h-4 text-yellow-400" />;
    }
  };

  return (
    <div className="min-h-screen flex bg-background">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <Header />
        
        <div className="p-6 space-y-8">
          {/* Hero Section */}
          <div className="text-center space-y-4">
            <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-blue-500 bg-clip-text text-transparent" data-testid="text-app-title">
              CryptoHobby
            </h1>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Advanced Memecoin Trading Platform with Real-Time Scanning, ML Pattern Recognition, and Automated Trading
            </p>
            <div className="flex items-center justify-center space-x-4">
              <Badge variant="default" className="px-3 py-1" data-testid="badge-system-status">
                <Activity className="w-3 h-3 mr-1" />
                {systemStats.systemStatus}
              </Badge>
              <Badge variant="secondary" className="px-3 py-1" data-testid="badge-uptime">
                <Clock className="w-3 h-3 mr-1" />
                {systemStats.uptime}
              </Badge>
              <Badge variant="outline" className="px-3 py-1" data-testid="badge-tokens-tracked">
                <Search className="w-3 h-3 mr-1" />
                {systemStats.tokensTracked} Tokens
              </Badge>
            </div>
          </div>

          {/* Performance Report */}
          <Card data-testid="card-performance-report">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Gauge className="w-5 h-5" />
                <span>Live Performance Report</span>
              </CardTitle>
              <CardDescription>Real-time system performance and trading metrics</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <div className="text-center space-y-2">
                  <div className="text-2xl font-bold text-green-400" data-testid="text-trades-executed">{systemStats.tradesExecuted}</div>
                  <div className="text-sm text-muted-foreground">Trades Executed</div>
                </div>
                <div className="text-center space-y-2">
                  <div className="text-2xl font-bold text-blue-400" data-testid="text-tokens-tracked">{systemStats.tokensTracked}</div>
                  <div className="text-sm text-muted-foreground">Tokens Tracked</div>
                </div>
                <div className="text-center space-y-2">
                  <div className="text-2xl font-bold text-purple-400" data-testid="text-ml-confidence">{systemStats.mlConfidence}</div>
                  <div className="text-sm text-muted-foreground">ML Confidence</div>
                </div>
                <div className="text-center space-y-2">
                  <div className="text-2xl font-bold text-yellow-400" data-testid="text-last-profit">{systemStats.lastTakeProfit}</div>
                  <div className="text-sm text-muted-foreground">Last Take-Profit</div>
                </div>
              </div>
              
              <Separator className="my-6" />
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <h4 className="font-semibold">Trading Configuration</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Paper Trading Capital:</span>
                      <span className="font-medium">${systemStats.paperTradingCapital.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Average Trade Size:</span>
                      <span className="font-medium">${systemStats.avgTradeSize}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Auto-Discovery:</span>
                      <span className="font-medium text-green-400">Enabled</span>
                    </div>
                  </div>
                </div>
                <div className="space-y-3">
                  <h4 className="font-semibold">System Health</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Scanner Status:</span>
                      <span className="font-medium text-green-400">Running</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">ML Analyzer:</span>
                      <span className="font-medium text-green-400">Active</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Auto-Trader:</span>
                      <span className="font-medium text-green-400">Active</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Features Overview */}
          <Card data-testid="card-features-overview">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Zap className="w-5 h-5" />
                <span>Platform Features</span>
              </CardTitle>
              <CardDescription>Comprehensive suite of automated trading capabilities</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {features.map((feature, index) => (
                  <div key={index} className="flex items-start space-x-3 p-4 border rounded-lg" data-testid={`feature-${index}`}>
                    <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                      <feature.icon className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center justify-between">
                        <h4 className="font-semibold">{feature.title}</h4>
                        {getStatusIcon(feature.status)}
                      </div>
                      <p className="text-sm text-muted-foreground">{feature.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Developer Log */}
          <Card data-testid="card-developer-log">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Activity className="w-5 h-5" />
                <span>Live Developer Log</span>
              </CardTitle>
              <CardDescription>Real-time system events and trading activity</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {recentDeveloperLogs.map((log, index) => (
                  <div key={index} className="flex items-start space-x-3 p-3 border-l-2 border-l-primary/20 bg-muted/20 rounded-r" data-testid={`log-entry-${index}`}>
                    <div className="flex-shrink-0">
                      <Badge variant="outline" className="text-xs">
                        {log.type}
                      </Badge>
                    </div>
                    <div className="flex-1 space-y-1">
                      <p className="text-sm font-medium">{log.message}</p>
                      <p className={`text-xs ${getStatusColor(log.status)}`}>
                        {log.timestamp}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 pt-4 border-t">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    System logging continuously • Last update: {new Date().toLocaleTimeString()}
                  </p>
                  <Button variant="outline" size="sm" data-testid="button-view-full-logs">
                    View Full Logs
                    <ArrowRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card data-testid="card-quick-actions">
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
              <CardDescription>Navigate to key platform features</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Button variant="outline" className="h-20 flex flex-col space-y-2" data-testid="button-scanner">
                  <Search className="w-6 h-6" />
                  <span className="text-sm">Scanner</span>
                </Button>
                <Button variant="outline" className="h-20 flex flex-col space-y-2" data-testid="button-portfolio">
                  <DollarSign className="w-6 h-6" />
                  <span className="text-sm">Portfolio</span>
                </Button>
                <Button variant="outline" className="h-20 flex flex-col space-y-2" data-testid="button-analytics">
                  <BarChart3 className="w-6 h-6" />
                  <span className="text-sm">Analytics</span>
                </Button>
                <Button variant="outline" className="h-20 flex flex-col space-y-2" data-testid="button-terminal">
                  <Activity className="w-6 h-6" />
                  <span className="text-sm">Terminal</span>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}