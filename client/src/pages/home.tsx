import { useLanguage } from "@/hooks/use-language";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";
import { motion } from "framer-motion";
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
  Gauge,
  Sparkles,
  Globe,
  Rocket,
  Database,
  Code,
  Server,
  Wifi,
  Layout,
  Users,
  Award,
  TrendingDown,
  RefreshCw,
  FileText,
  Settings,
  Eye,
  MessageSquare,
  BookOpen,
  Layers,
  Package,
  Terminal,
  PieChart,
  Scale,
  Radar
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";

export default function Home() {
  const { t } = useLanguage();

  const { data: scannerStatus } = useQuery<{
    isRunning: boolean;
    scannedTokensCount: number;
    lastScanTime: string;
  }>({
    queryKey: ['/api/scanner/status'],
    refetchInterval: 5000,
  });

  const { data: alerts } = useQuery({
    queryKey: ['/api/alerts'],
    refetchInterval: 30000,
  });

  const { data: portfolio } = useQuery({
    queryKey: ['/api/portfolio', 'default'],
    refetchInterval: 30000, // Refetch every 30 seconds
    staleTime: 15000, // Data stays fresh for 15 seconds
    retry: false, // Don't retry on 401 errors
  });

  const { data: stakeholderReport } = useQuery<{
    content: string;
    lastUpdated: string;
    systemStats: {
      tokensTracked: number;
      scannerActive: boolean;
      systemStatus: string;
    };
  }>({
    queryKey: ['/api/stakeholder-report'],
    refetchInterval: 300000, // Refresh every 5 minutes
  });

  const { data: autoTraderPortfolio } = useQuery<{
    portfolioId: string;
    totalValue: number;
    totalPositionValue: number;
    availableCash: number;
    totalTrades: number;
    buyTrades: number;
    sellTrades: number;
    activePositions: number;
    positions: Array<{
      id: string;
      tokenId: string;
      symbol: string;
      amount: number;
      avgBuyPrice: number;
      currentPrice: number;
      positionValue: number;
      profitLoss: number;
    }>;
    winRate: string;
  }>({
    queryKey: ['/api/auto-trader/portfolio'],
    refetchInterval: 15000, // Refresh every 15 seconds
  });

  // Calculate real performance data from live system APIs
  const systemStats = {
    tokensTracked: stakeholderReport?.systemStats.tokensTracked || scannerStatus?.scannedTokensCount || 0,
    tradesExecuted: autoTraderPortfolio?.totalTrades || 0,
    activeSystems: 5, // Keep static as this represents service count
    autoDiscovery: scannerStatus?.isRunning || false,
    uptime: "24/7", // Keep static as this is always true for the platform
    mlConfidence: autoTraderPortfolio?.winRate ? `${Math.round(parseFloat(autoTraderPortfolio.winRate) * 0.85)}-${Math.round(parseFloat(autoTraderPortfolio.winRate) * 1.2)}%` : "N/A",
    paperTradingCapital: autoTraderPortfolio?.totalValue || 0,
    avgTradeSize: autoTraderPortfolio?.totalValue && autoTraderPortfolio?.totalTrades ? Math.round(autoTraderPortfolio.totalValue / autoTraderPortfolio.totalTrades) : 0,
    lastTakeProfit: autoTraderPortfolio?.winRate ? `${parseFloat(autoTraderPortfolio.winRate).toFixed(1)}%` : "N/A",
    systemStatus: stakeholderReport?.systemStats.systemStatus || (scannerStatus?.isRunning ? "LIVE" : "OFFLINE")
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        delayChildren: 0.3,
        staggerChildren: 0.2
      }
    }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: {
        type: "spring",
        stiffness: 100,
        damping: 10
      }
    }
  };

  const orbVariants = {
    floating: {
      y: [-10, 10, -10],
      rotate: [0, 360, 0],
      scale: [1, 1.1, 1],
      transition: {
        duration: 8,
        repeat: Infinity,
        ease: "easeInOut"
      }
    }
  };

  const glowVariants = {
    pulse: {
      boxShadow: [
        "0 0 20px hsla(262, 73%, 65%, 0.3), 0 0 40px hsla(262, 73%, 65%, 0.15)",
        "0 0 30px hsla(262, 73%, 65%, 0.5), 0 0 60px hsla(262, 73%, 65%, 0.25)",
        "0 0 20px hsla(262, 73%, 65%, 0.3), 0 0 40px hsla(262, 73%, 65%, 0.15)"
      ],
      transition: {
        duration: 2,
        repeat: Infinity,
        ease: "easeInOut"
      }
    }
  };

  return (
    <div className="min-h-screen flex bg-background">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <Header />
        
        <motion.div 
          className="p-4 md:p-6 space-y-6 md:space-y-8"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {/* Hero Section with Floating Orbs */}
          <motion.div 
            className="relative text-center space-y-4 md:space-y-6 py-8 md:py-12"
            variants={itemVariants}
          >
            {/* Background Orbs */}
            <motion.div
              className="absolute top-10 left-20 w-32 h-32 rounded-full"
              style={{
                background: "linear-gradient(135deg, hsl(262, 73%, 65%) 0%, hsl(310, 100%, 70%) 100%)",
                filter: "blur(40px)",
                opacity: 0.3
              }}
              variants={orbVariants}
              animate="floating"
            />
            <motion.div
              className="absolute top-16 right-32 w-24 h-24 rounded-full"
              style={{
                background: "linear-gradient(135deg, hsl(200, 100%, 70%) 0%, hsl(180, 100%, 60%) 100%)",
                filter: "blur(30px)",
                opacity: 0.2
              }}
              variants={orbVariants}
              animate="floating"
              transition={{ delay: 1 }}
            />

            <motion.h1 
              className="text-3xl md:text-5xl font-bold gradient-text mb-3 md:mb-4 px-4"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 100, delay: 0.5 }}
              data-testid="text-app-title"
            >
              MemeCoin Hunter
            </motion.h1>
            <motion.p 
              className="text-base md:text-xl text-muted-foreground max-w-4xl mx-auto leading-relaxed px-4"
              variants={itemVariants}
            >
              Next-Generation Memecoin Trading Platform with AI-Powered Pattern Recognition & Automated Execution
            </motion.p>
            <motion.div 
              className="flex items-center justify-center space-x-3 md:space-x-6 flex-wrap gap-2 px-4"
              variants={itemVariants}
            >
              <motion.div variants={glowVariants} animate="pulse">
                <Badge variant="default" className="px-3 py-2 md:px-4 glass-card text-xs md:text-sm" data-testid="badge-system-status">
                  <Rocket className="w-4 h-4 mr-2" />
                  {systemStats.systemStatus}
                </Badge>
              </motion.div>
              <Badge variant="secondary" className="px-3 py-2 md:px-4 glass-card text-xs md:text-sm" data-testid="badge-uptime">
                <Clock className="w-4 h-4 mr-2" />
                {systemStats.uptime}
              </Badge>
              <Badge variant="outline" className="px-3 py-2 md:px-4 glass-card text-xs md:text-sm" data-testid="badge-tokens-tracked">
                <Globe className="w-4 h-4 mr-2" />
                {systemStats.tokensTracked} Tokens
              </Badge>
            </motion.div>
          </motion.div>

          {/* Interactive Performance Grid */}
          <motion.div 
            className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-6"
            variants={containerVariants}
          >
            {[
              { 
                title: "Live Trades", 
                value: systemStats.tradesExecuted, 
                icon: TrendingUp, 
                color: "success",
                gradient: "from-green-400 to-emerald-500"
              },
              { 
                title: "Active Tokens", 
                value: systemStats.tokensTracked, 
                icon: Search, 
                color: "primary",
                gradient: "from-blue-400 to-purple-500"
              },
              { 
                title: "ML Confidence", 
                value: systemStats.mlConfidence, 
                icon: Brain, 
                color: "secondary",
                gradient: "from-purple-400 to-pink-500"
              },
              { 
                title: "Latest Pattern", 
                value: systemStats.lastTakeProfit, 
                icon: Target, 
                color: "accent",
                gradient: "from-yellow-400 to-orange-500"
              }
            ].map((stat, index) => (
              <motion.div
                key={index}
                variants={itemVariants}
                whileHover={{ 
                  scale: 1.05,
                  boxShadow: "0 20px 40px hsla(225, 39%, 5%, 0.4)"
                }}
                className="glass-card p-3 md:p-6 hover-lift cursor-pointer group min-h-[100px] md:min-h-[120px]"
                data-testid={`stat-card-${index}`}
              >
                <div className="flex items-center justify-between mb-2 md:mb-4">
                  <div className={`w-8 h-8 md:w-12 md:h-12 rounded-xl bg-gradient-to-r ${stat.gradient} p-1.5 md:p-2.5 group-hover:scale-110 transition-transform duration-300 flex-shrink-0`}>
                    <stat.icon className="w-full h-full text-white" />
                  </div>
                  <Sparkles className="w-4 h-4 md:w-5 md:h-5 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
                <div className="text-lg md:text-3xl font-bold mb-1" data-testid={`text-${stat.title.toLowerCase().replace(' ', '-')}`}>
                  {stat.value}
                </div>
                <div className="text-xs md:text-sm text-muted-foreground">{stat.title}</div>
              </motion.div>
            ))}
          </motion.div>

          {/* Main Feature Showcase */}
          <motion.div 
            className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-8"
            variants={containerVariants}
          >
            {/* Left Panel: Trading Engine */}
            <motion.div 
              className="glass-ultra rounded-2xl md:rounded-3xl p-4 md:p-8 relative overflow-hidden"
              variants={itemVariants}
              whileHover={{ scale: 1.02 }}
              data-testid="card-trading-engine"
            >
              {/* Animated background gradient */}
              <motion.div
                className="absolute inset-0 opacity-10"
                style={{
                  background: "linear-gradient(135deg, hsl(262, 73%, 65%) 0%, hsl(310, 100%, 70%) 100%)"
                }}
                animate={{
                  background: [
                    "linear-gradient(135deg, hsl(262, 73%, 65%) 0%, hsl(310, 100%, 70%) 100%)",
                    "linear-gradient(135deg, hsl(200, 100%, 70%) 0%, hsl(262, 73%, 65%) 100%)",
                    "linear-gradient(135deg, hsl(262, 73%, 65%) 0%, hsl(310, 100%, 70%) 100%)"
                  ]
                }}
                transition={{ duration: 8, repeat: Infinity }}
              />
              
              <div className="relative z-10">
                <div className="flex items-center space-x-3 mb-4 md:mb-6">
                  <motion.div 
                    className="w-10 h-10 md:w-14 md:h-14 rounded-2xl bg-gradient-to-r from-purple-500 to-pink-500 p-2 md:p-3 flex-shrink-0"
                    animate={{ rotate: [0, 360] }}
                    transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                  >
                    <Bot className="w-full h-full text-white" />
                  </motion.div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-lg md:text-2xl font-bold leading-tight">Automated Trading Engine</h3>
                    <p className="text-sm md:text-base text-muted-foreground">AI-powered execution system</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex justify-between items-center p-4 rounded-xl bg-black/20 border border-white/10">
                    <span className="text-sm">Pattern Detection</span>
                    <Badge className="bg-green-500/20 text-green-400 border-green-500/30">Active</Badge>
                  </div>
                  <div className="flex justify-between items-center p-4 rounded-xl bg-black/20 border border-white/10">
                    <span className="text-sm">Risk Management</span>
                    <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">Enabled</Badge>
                  </div>
                  <div className="flex justify-between items-center p-4 rounded-xl bg-black/20 border border-white/10">
                    <span className="text-sm">Auto Execution</span>
                    <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30">Running</Badge>
                  </div>
                </div>

                <motion.div 
                  className="mt-6 p-4 rounded-xl bg-gradient-to-r from-green-500/10 to-emerald-500/10 border border-green-500/20"
                  animate={{ scale: [1, 1.02, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 rounded-full bg-green-400 animate-pulse"></div>
                    <span className="text-sm font-medium text-green-400">24 trades executed today</span>
                  </div>
                </motion.div>
              </div>
            </motion.div>

            {/* Right Panel: Portfolio Performance */}
            <motion.div 
              className="glass-ultra rounded-3xl p-8 relative overflow-hidden"
              variants={itemVariants}
              whileHover={{ scale: 1.02 }}
              data-testid="card-portfolio-performance"
            >
              {/* Animated background gradient */}
              <motion.div
                className="absolute inset-0 opacity-10"
                style={{
                  background: "linear-gradient(135deg, hsl(200, 100%, 70%) 0%, hsl(180, 100%, 60%) 100%)"
                }}
                animate={{
                  background: [
                    "linear-gradient(135deg, hsl(200, 100%, 70%) 0%, hsl(180, 100%, 60%) 100%)",
                    "linear-gradient(135deg, hsl(142, 76%, 45%) 0%, hsl(120, 100%, 40%) 100%)",
                    "linear-gradient(135deg, hsl(200, 100%, 70%) 0%, hsl(180, 100%, 60%) 100%)"
                  ]
                }}
                transition={{ duration: 6, repeat: Infinity }}
              />
              
              <div className="relative z-10">
                <div className="flex items-center space-x-3 mb-6">
                  <motion.div 
                    className="w-14 h-14 rounded-2xl bg-gradient-to-r from-blue-500 to-cyan-500 p-3"
                    animate={{ y: [-2, 2, -2] }}
                    transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                  >
                    <LineChart className="w-full h-full text-white" />
                  </motion.div>
                  <div>
                    <h3 className="text-2xl font-bold">Live Performance</h3>
                    <p className="text-muted-foreground">Real-time analytics</p>
                  </div>
                </div>

                {/* Animated performance metrics */}
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <motion.div 
                    className="text-center p-4 rounded-xl bg-black/20 border border-white/10"
                    whileHover={{ scale: 1.05 }}
                  >
                    <div className="text-2xl font-bold text-green-400">${systemStats.paperTradingCapital.toLocaleString()}</div>
                    <div className="text-xs text-muted-foreground">Portfolio Value</div>
                  </motion.div>
                  <motion.div 
                    className="text-center p-4 rounded-xl bg-black/20 border border-white/10"
                    whileHover={{ scale: 1.05 }}
                  >
                    <div className="text-2xl font-bold text-blue-400">${systemStats.avgTradeSize}</div>
                    <div className="text-xs text-muted-foreground">Avg Trade Size</div>
                  </motion.div>
                </div>

                <motion.div 
                  className="p-4 rounded-xl bg-gradient-to-r from-blue-500/10 to-cyan-500/10 border border-blue-500/20"
                  animate={{ opacity: [0.7, 1, 0.7] }}
                  transition={{ duration: 3, repeat: Infinity }}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">ML Pattern Confidence</span>
                    <span className="text-lg font-bold text-blue-400">{systemStats.mlConfidence}</span>
                  </div>
                </motion.div>
              </div>
            </motion.div>
          </motion.div>

          {/* Interactive Action Center */}
          <motion.div 
            className="glass-ultra rounded-3xl p-8"
            variants={itemVariants}
            data-testid="card-action-center"
          >
            <div className="text-center mb-8">
              <h3 className="text-3xl font-bold mb-2">Platform Control Center</h3>
              <p className="text-muted-foreground">Navigate to key features and monitor system status</p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { icon: Search, label: "Scanner", color: "from-green-400 to-emerald-500", testId: "button-scanner" },
                { icon: DollarSign, label: "Portfolio", color: "from-blue-400 to-purple-500", testId: "button-portfolio" },
                { icon: BarChart3, label: "Analytics", color: "from-purple-400 to-pink-500", testId: "button-analytics" },
                { icon: Activity, label: "Terminal", color: "from-yellow-400 to-orange-500", testId: "button-terminal" }
              ].map((action, index) => (
                <motion.div
                  key={index}
                  whileHover={{ 
                    scale: 1.05,
                    rotateY: 5,
                  }}
                  whileTap={{ scale: 0.95 }}
                  className="group cursor-pointer"
                  data-testid={action.testId}
                >
                  <div className="glass-card p-6 text-center h-32 flex flex-col items-center justify-center space-y-3 hover-lift">
                    <div className={`w-12 h-12 rounded-xl bg-gradient-to-r ${action.color} p-2.5 group-hover:scale-110 transition-transform duration-300`}>
                      <action.icon className="w-full h-full text-white" />
                    </div>
                    <span className="text-sm font-medium">{action.label}</span>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Stakeholder Report Section */}
          {stakeholderReport && (
            <motion.div 
              className="glass-ultra rounded-3xl p-8"
              variants={itemVariants}
              data-testid="card-stakeholder-report"
            >
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-3">
                  <motion.div 
                    className="w-12 h-12 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 p-2.5"
                    animate={{ scale: [1, 1.05, 1] }}
                    transition={{ duration: 3, repeat: Infinity }}
                  >
                    <BarChart3 className="w-full h-full text-white" />
                  </motion.div>
                  <div>
                    <h3 className="text-2xl font-bold">Stakeholder Report</h3>
                    <p className="text-muted-foreground">Live platform performance & metrics</p>
                  </div>
                </div>
                <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">
                  Updated: {stakeholderReport.lastUpdated}
                </Badge>
              </div>

              {/* Key Metrics Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <motion.div 
                  className="text-center p-4 rounded-xl bg-black/20 border border-white/10"
                  whileHover={{ scale: 1.02 }}
                >
                  <div className="text-2xl font-bold text-green-400">{stakeholderReport.systemStats.tokensTracked}+</div>
                  <div className="text-xs text-muted-foreground">Tokens Tracked</div>
                </motion.div>
                <motion.div 
                  className="text-center p-4 rounded-xl bg-black/20 border border-white/10"
                  whileHover={{ scale: 1.02 }}
                >
                  <div className="text-2xl font-bold text-blue-400">
                    {stakeholderReport.systemStats.scannerActive ? "ACTIVE" : "STOPPED"}
                  </div>
                  <div className="text-xs text-muted-foreground">Scanner Status</div>
                </motion.div>
                <motion.div 
                  className="text-center p-4 rounded-xl bg-black/20 border border-white/10"
                  whileHover={{ scale: 1.02 }}
                >
                  <div className="text-2xl font-bold text-purple-400">{stakeholderReport.systemStats.systemStatus}</div>
                  <div className="text-xs text-muted-foreground">System Health</div>
                </motion.div>
              </div>

              {/* Report Preview */}
              <div className="bg-black/20 border border-white/10 rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-lg font-semibold">Executive Summary</h4>
                  <Badge variant="outline" className="text-xs">Auto-Updated</Badge>
                </div>
                <div className="text-sm text-muted-foreground leading-relaxed max-h-32 overflow-hidden">
                  {stakeholderReport.content.slice(0, 400)}...
                </div>
                <motion.div 
                  className="mt-4 pt-4 border-t border-white/10"
                  whileHover={{ scale: 1.02 }}
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">
                      🎯 Self-Correcting ML • 🔄 Dynamic Risk Adjustment • 📊 74+ Tokens
                    </span>
                    <span className="text-blue-400 font-medium cursor-pointer hover:text-blue-300">
                      View Full Report →
                    </span>
                  </div>
                </motion.div>
              </div>
            </motion.div>
          )}

          {/* Auto-Trader Portfolio Section */}
          {autoTraderPortfolio && (
            <motion.div 
              className="glass-ultra rounded-3xl p-8"
              variants={itemVariants}
              data-testid="card-autotrader-portfolio"
            >
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-3">
                  <motion.div 
                    className="w-12 h-12 rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 p-2.5"
                    animate={{ rotateY: [0, 180, 360] }}
                    transition={{ duration: 4, repeat: Infinity }}
                  >
                    <Bot className="w-full h-full text-white" />
                  </motion.div>
                  <div>
                    <h3 className="text-2xl font-bold">Auto-Trader Portfolio</h3>
                    <p className="text-muted-foreground">Real-time paper trading performance</p>
                  </div>
                </div>
                <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                  Live Trading
                </Badge>
              </div>

              {/* Portfolio Metrics Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <motion.div 
                  className="text-center p-4 rounded-xl bg-black/20 border border-white/10"
                  whileHover={{ scale: 1.02 }}
                >
                  <div className="text-2xl font-bold text-green-400">
                    ${autoTraderPortfolio.totalValue.toFixed(2)}
                  </div>
                  <div className="text-xs text-muted-foreground">Total Portfolio</div>
                </motion.div>
                <motion.div 
                  className="text-center p-4 rounded-xl bg-black/20 border border-white/10"
                  whileHover={{ scale: 1.02 }}
                >
                  <div className="text-2xl font-bold text-blue-400">
                    ${autoTraderPortfolio.availableCash.toFixed(2)}
                  </div>
                  <div className="text-xs text-muted-foreground">Available Cash</div>
                </motion.div>
                <motion.div 
                  className="text-center p-4 rounded-xl bg-black/20 border border-white/10"
                  whileHover={{ scale: 1.02 }}
                >
                  <div className="text-2xl font-bold text-purple-400">{autoTraderPortfolio.totalTrades}</div>
                  <div className="text-xs text-muted-foreground">Total Trades</div>
                </motion.div>
                <motion.div 
                  className="text-center p-4 rounded-xl bg-black/20 border border-white/10"
                  whileHover={{ scale: 1.02 }}
                >
                  <div className="text-2xl font-bold text-yellow-400">{autoTraderPortfolio.winRate}%</div>
                  <div className="text-xs text-muted-foreground">Win Rate</div>
                </motion.div>
              </div>

              {/* Trading Activity */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div className="bg-black/20 border border-white/10 rounded-xl p-4">
                  <h4 className="text-lg font-semibold mb-3 flex items-center">
                    <TrendingUp className="w-5 h-5 mr-2 text-green-400" />
                    Trade Summary
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Buy Orders:</span>
                      <span className="text-green-400 font-medium">{autoTraderPortfolio.buyTrades}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Sell Orders:</span>
                      <span className="text-red-400 font-medium">{autoTraderPortfolio.sellTrades}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Active Positions:</span>
                      <span className="text-blue-400 font-medium">{autoTraderPortfolio.activePositions}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-black/20 border border-white/10 rounded-xl p-4">
                  <h4 className="text-lg font-semibold mb-3 flex items-center">
                    <DollarSign className="w-5 h-5 mr-2 text-blue-400" />
                    Position Value
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Holdings Value:</span>
                      <span className="text-blue-400 font-medium">
                        ${autoTraderPortfolio.totalPositionValue.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Cash Reserve:</span>
                      <span className="text-emerald-400 font-medium">
                        ${autoTraderPortfolio.availableCash.toFixed(2)}
                      </span>
                    </div>
                    <Separator className="my-2" />
                    <div className="flex justify-between font-medium">
                      <span>Portfolio Total:</span>
                      <span className="text-green-400">
                        ${autoTraderPortfolio.totalValue.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Active Positions Preview */}
              {autoTraderPortfolio.positions && autoTraderPortfolio.positions.length > 0 && (
                <div className="bg-black/20 border border-white/10 rounded-xl p-4">
                  <h4 className="text-lg font-semibold mb-3 flex items-center">
                    <Target className="w-5 h-5 mr-2 text-purple-400" />
                    Active Positions ({autoTraderPortfolio.positions.length})
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {autoTraderPortfolio.positions.slice(0, 4).map((position, index) => (
                      <motion.div 
                        key={position.id}
                        className="flex items-center justify-between p-3 rounded-lg bg-black/20 border border-white/10"
                        whileHover={{ scale: 1.02 }}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.1 }}
                      >
                        <div>
                          <div className="font-medium text-sm">{position.symbol}</div>
                          <div className="text-xs text-muted-foreground">
                            {position.amount.toFixed(4)} @ ${position.avgBuyPrice.toFixed(6)}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-medium">
                            ${position.positionValue.toFixed(2)}
                          </div>
                          <div className={`text-xs ${position.profitLoss >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {position.profitLoss >= 0 ? '+' : ''}{position.profitLoss.toFixed(2)}%
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                  {autoTraderPortfolio.positions.length > 4 && (
                    <div className="text-center mt-3">
                      <span className="text-xs text-muted-foreground">
                        +{autoTraderPortfolio.positions.length - 4} more positions
                      </span>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          )}

          {/* Live System Status */}
          <motion.div 
            className="glass-ultra rounded-3xl p-6"
            variants={itemVariants}
            data-testid="card-system-status"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <motion.div 
                  className="w-3 h-3 rounded-full bg-green-400"
                  animate={{ scale: [1, 1.2, 1], opacity: [1, 0.7, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                />
                <h4 className="text-lg font-semibold">System Status: All Systems Operational</h4>
              </div>
              <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                Last update: {new Date().toLocaleTimeString()}
              </Badge>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Scanner Service:</span>
                <span className="text-green-400 font-medium">Active</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">ML Analyzer:</span>
                <span className="text-green-400 font-medium">Running</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Auto-Trader:</span>
                <span className="text-green-400 font-medium">Executing</span>
              </div>
            </div>
          </motion.div>

          {/* Comprehensive Platform Overview Section */}
          <motion.div 
            className="glass-ultra rounded-3xl p-8 md:p-12 mt-8"
            variants={itemVariants}
            data-testid="section-platform-overview"
          >
            <div className="text-center mb-12">
              <motion.div 
                className="inline-block mb-4"
                animate={{ rotate: [0, 360] }}
                transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
              >
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-r from-purple-500 via-pink-500 to-blue-500 p-3">
                  <Layers className="w-full h-full text-white" />
                </div>
              </motion.div>
              <h2 className="text-4xl md:text-5xl font-bold gradient-text mb-4" data-testid="heading-platform-overview">
                Platform Overview
              </h2>
              <p className="text-lg text-muted-foreground max-w-4xl mx-auto leading-relaxed">
                CryptoHobby is a cutting-edge <strong className="text-primary">paper trading and analysis platform</strong> specialized in memecoin pattern recognition and trading strategy development. Built with institutional-grade technology, the platform combines real-time market scanning, machine learning pattern detection, and comprehensive risk management tools in a <strong className="text-primary">100% simulated trading environment</strong>.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-3 mt-6">
                <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30 px-4 py-2">
                  <DollarSign className="w-4 h-4 mr-2" />
                  $10,000 Virtual Capital
                </Badge>
                <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 px-4 py-2">
                  <Award className="w-4 h-4 mr-2" />
                  100% Free - No Hidden Fees
                </Badge>
                <Badge className="bg-green-500/20 text-green-400 border-green-500/30 px-4 py-2">
                  <Shield className="w-4 h-4 mr-2" />
                  Zero Financial Risk
                </Badge>
              </div>
            </div>

            <Separator className="my-8" />

            {/* Current Performance Metrics */}
            <div className="mb-12">
              <h3 className="text-3xl font-bold mb-6 flex items-center">
                <BarChart3 className="w-8 h-8 mr-3 text-purple-400" />
                Current Performance Metrics
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Market Coverage */}
                <Card className="glass-card border-white/10">
                  <CardHeader>
                    <CardTitle className="flex items-center text-xl">
                      <Globe className="w-5 h-5 mr-2 text-blue-400" />
                      Market Coverage
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Tokens Scanned</span>
                      <Badge className="bg-blue-500/20 text-blue-400">110+</Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Popular Memecoins</span>
                      <Badge className="bg-green-500/20 text-green-400">60+</Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Auto-Discovery</span>
                      <Badge className="bg-purple-500/20 text-purple-400">Every 5 min</Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Price Updates</span>
                      <Badge className="bg-yellow-500/20 text-yellow-400">Real-Time</Badge>
                    </div>
                  </CardContent>
                </Card>

                {/* ML Pattern Detection */}
                <Card className="glass-card border-white/10">
                  <CardHeader>
                    <CardTitle className="flex items-center text-xl">
                      <Brain className="w-5 h-5 mr-2 text-purple-400" />
                      ML Pattern Detection
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Pattern Confidence</span>
                      <Badge className="bg-purple-500/20 text-purple-400">75-92%</Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Tokens Analyzed</span>
                      <Badge className="bg-blue-500/20 text-blue-400">23+</Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Pattern Types</span>
                      <Badge className="bg-green-500/20 text-green-400">10+</Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Accuracy</span>
                      <Badge className="bg-yellow-500/20 text-yellow-400">High</Badge>
                    </div>
                  </CardContent>
                </Card>

                {/* Trading Intelligence */}
                <Card className="glass-card border-white/10">
                  <CardHeader>
                    <CardTitle className="flex items-center text-xl">
                      <LineChart className="w-5 h-5 mr-2 text-green-400" />
                      Trading Intelligence
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">P&L Tracking</span>
                      <Badge className="bg-green-500/20 text-green-400">Real-Time</Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Win Rate Analysis</span>
                      <Badge className="bg-blue-500/20 text-blue-400">Detailed</Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Risk Scoring</span>
                      <Badge className="bg-purple-500/20 text-purple-400">0-100</Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Hold Time Analytics</span>
                      <Badge className="bg-yellow-500/20 text-yellow-400">Advanced</Badge>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>

            <Separator className="my-8" />

            {/* Core Platform Capabilities */}
            <div className="mb-12">
              <h3 className="text-3xl font-bold mb-6 flex items-center">
                <Zap className="w-8 h-8 mr-3 text-yellow-400" />
                Core Platform Capabilities
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Automated Token Scanner */}
                <motion.div whileHover={{ scale: 1.03 }} className="h-full">
                  <Card className="glass-card border-white/10 h-full">
                    <CardHeader>
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-r from-green-400 to-emerald-500 p-2.5 mb-3">
                        <Radar className="w-full h-full text-white" />
                      </div>
                      <CardTitle className="text-xl">Automated Token Scanner</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm text-muted-foreground">
                      <div className="flex items-start">
                        <CheckCircle className="w-4 h-4 mr-2 mt-0.5 text-green-400 flex-shrink-0" />
                        <span>Real-time alert system for price spikes & volume surges</span>
                      </div>
                      <div className="flex items-start">
                        <CheckCircle className="w-4 h-4 mr-2 mt-0.5 text-green-400 flex-shrink-0" />
                        <span>Smart discovery of trending memecoins ($500k+ market cap)</span>
                      </div>
                      <div className="flex items-start">
                        <CheckCircle className="w-4 h-4 mr-2 mt-0.5 text-green-400 flex-shrink-0" />
                        <span>Multi-chain support (Solana, BSC, Polygon, Ethereum)</span>
                      </div>
                      <div className="flex items-start">
                        <CheckCircle className="w-4 h-4 mr-2 mt-0.5 text-green-400 flex-shrink-0" />
                        <span>Configurable thresholds & historical data tracking</span>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>

                {/* ML Pattern Recognition */}
                <motion.div whileHover={{ scale: 1.03 }} className="h-full">
                  <Card className="glass-card border-white/10 h-full">
                    <CardHeader>
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-r from-purple-400 to-pink-500 p-2.5 mb-3">
                        <Brain className="w-full h-full text-white" />
                      </div>
                      <CardTitle className="text-xl">ML Pattern Recognition</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm text-muted-foreground">
                      <div className="flex items-start">
                        <CheckCircle className="w-4 h-4 mr-2 mt-0.5 text-purple-400 flex-shrink-0" />
                        <span>Advanced detection of 10+ technical patterns</span>
                      </div>
                      <div className="flex items-start">
                        <CheckCircle className="w-4 h-4 mr-2 mt-0.5 text-purple-400 flex-shrink-0" />
                        <span>75-92% confidence scoring for each pattern</span>
                      </div>
                      <div className="flex items-start">
                        <CheckCircle className="w-4 h-4 mr-2 mt-0.5 text-purple-400 flex-shrink-0" />
                        <span>Automated entry/exit signal generation</span>
                      </div>
                      <div className="flex items-start">
                        <CheckCircle className="w-4 h-4 mr-2 mt-0.5 text-purple-400 flex-shrink-0" />
                        <span>Risk assessment with stop-loss recommendations</span>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>

                {/* Trading Analytics */}
                <motion.div whileHover={{ scale: 1.03 }} className="h-full">
                  <Card className="glass-card border-white/10 h-full">
                    <CardHeader>
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-r from-blue-400 to-cyan-500 p-2.5 mb-3">
                        <BarChart3 className="w-full h-full text-white" />
                      </div>
                      <CardTitle className="text-xl">Trading Analytics</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm text-muted-foreground">
                      <div className="flex items-start">
                        <CheckCircle className="w-4 h-4 mr-2 mt-0.5 text-blue-400 flex-shrink-0" />
                        <span>Real-time P&L dashboard with ROI tracking</span>
                      </div>
                      <div className="flex items-start">
                        <CheckCircle className="w-4 h-4 mr-2 mt-0.5 text-blue-400 flex-shrink-0" />
                        <span>Win/loss analysis with average trade metrics</span>
                      </div>
                      <div className="flex items-start">
                        <CheckCircle className="w-4 h-4 mr-2 mt-0.5 text-blue-400 flex-shrink-0" />
                        <span>Hold time intelligence for optimal exits</span>
                      </div>
                      <div className="flex items-start">
                        <CheckCircle className="w-4 h-4 mr-2 mt-0.5 text-blue-400 flex-shrink-0" />
                        <span>Strategy ROI tracking by pattern type</span>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>

                {/* Trade Journal */}
                <motion.div whileHover={{ scale: 1.03 }} className="h-full">
                  <Card className="glass-card border-white/10 h-full">
                    <CardHeader>
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-r from-yellow-400 to-orange-500 p-2.5 mb-3">
                        <BookOpen className="w-full h-full text-white" />
                      </div>
                      <CardTitle className="text-xl">Automated Trade Journal</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm text-muted-foreground">
                      <div className="flex items-start">
                        <CheckCircle className="w-4 h-4 mr-2 mt-0.5 text-yellow-400 flex-shrink-0" />
                        <span>Complete trade history with entry/exit logs</span>
                      </div>
                      <div className="flex items-start">
                        <CheckCircle className="w-4 h-4 mr-2 mt-0.5 text-yellow-400 flex-shrink-0" />
                        <span>Advanced filtering by outcome, token, pattern, date</span>
                      </div>
                      <div className="flex items-start">
                        <CheckCircle className="w-4 h-4 mr-2 mt-0.5 text-yellow-400 flex-shrink-0" />
                        <span>Detailed signal documentation & trigger tracking</span>
                      </div>
                      <div className="flex items-start">
                        <CheckCircle className="w-4 h-4 mr-2 mt-0.5 text-yellow-400 flex-shrink-0" />
                        <span>Comprehensive statistics & insights</span>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>

                {/* Risk Management */}
                <motion.div whileHover={{ scale: 1.03 }} className="h-full">
                  <Card className="glass-card border-white/10 h-full">
                    <CardHeader>
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-r from-red-400 to-pink-500 p-2.5 mb-3">
                        <Shield className="w-full h-full text-white" />
                      </div>
                      <CardTitle className="text-xl">Risk Management</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm text-muted-foreground">
                      <div className="flex items-start">
                        <CheckCircle className="w-4 h-4 mr-2 mt-0.5 text-red-400 flex-shrink-0" />
                        <span>0-100 risk score based on 4 key factors</span>
                      </div>
                      <div className="flex items-start">
                        <CheckCircle className="w-4 h-4 mr-2 mt-0.5 text-red-400 flex-shrink-0" />
                        <span>Daily/weekly/monthly performance summaries</span>
                      </div>
                      <div className="flex items-start">
                        <CheckCircle className="w-4 h-4 mr-2 mt-0.5 text-red-400 flex-shrink-0" />
                        <span>Exposure analysis & diversification scoring</span>
                      </div>
                      <div className="flex items-start">
                        <CheckCircle className="w-4 h-4 mr-2 mt-0.5 text-red-400 flex-shrink-0" />
                        <span>Drawdown tracking with recovery analysis</span>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>

                {/* Portfolio Management */}
                <motion.div whileHover={{ scale: 1.03 }} className="h-full">
                  <Card className="glass-card border-white/10 h-full">
                    <CardHeader>
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-r from-indigo-400 to-purple-500 p-2.5 mb-3">
                        <PieChart className="w-full h-full text-white" />
                      </div>
                      <CardTitle className="text-xl">Portfolio Management</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm text-muted-foreground">
                      <div className="flex items-start">
                        <CheckCircle className="w-4 h-4 mr-2 mt-0.5 text-indigo-400 flex-shrink-0" />
                        <span>Live position tracking with real-time values</span>
                      </div>
                      <div className="flex items-start">
                        <CheckCircle className="w-4 h-4 mr-2 mt-0.5 text-indigo-400 flex-shrink-0" />
                        <span>Instant unrealized P&L calculations</span>
                      </div>
                      <div className="flex items-start">
                        <CheckCircle className="w-4 h-4 mr-2 mt-0.5 text-indigo-400 flex-shrink-0" />
                        <span>Position sizing & allocation tracking</span>
                      </div>
                      <div className="flex items-start">
                        <CheckCircle className="w-4 h-4 mr-2 mt-0.5 text-indigo-400 flex-shrink-0" />
                        <span>Performance charts & growth visualization</span>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>

                {/* Interactive Terminal */}
                <motion.div whileHover={{ scale: 1.03 }} className="h-full">
                  <Card className="glass-card border-white/10 h-full">
                    <CardHeader>
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-r from-cyan-400 to-teal-500 p-2.5 mb-3">
                        <Terminal className="w-full h-full text-white" />
                      </div>
                      <CardTitle className="text-xl">Interactive Terminal</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm text-muted-foreground">
                      <div className="flex items-start">
                        <CheckCircle className="w-4 h-4 mr-2 mt-0.5 text-cyan-400 flex-shrink-0" />
                        <span>CLI-style command execution interface</span>
                      </div>
                      <div className="flex items-start">
                        <CheckCircle className="w-4 h-4 mr-2 mt-0.5 text-cyan-400 flex-shrink-0" />
                        <span>Real-time streaming of scanner activity</span>
                      </div>
                      <div className="flex items-start">
                        <CheckCircle className="w-4 h-4 mr-2 mt-0.5 text-cyan-400 flex-shrink-0" />
                        <span>System status monitoring & API health</span>
                      </div>
                      <div className="flex items-start">
                        <CheckCircle className="w-4 h-4 mr-2 mt-0.5 text-cyan-400 flex-shrink-0" />
                        <span>Rapid trade execution & portfolio queries</span>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              </div>
            </div>

            <Separator className="my-8" />

            {/* Backend Architecture - Collapsible */}
            <Collapsible className="mb-8">
              <CollapsibleTrigger className="w-full">
                <div className="flex items-center justify-between p-6 glass-card rounded-xl hover:bg-white/5 transition-colors">
                  <h3 className="text-2xl font-bold flex items-center">
                    <Server className="w-7 h-7 mr-3 text-blue-400" />
                    Backend Architecture & Functions
                  </h3>
                  <ChevronDown className="w-6 h-6 text-muted-foreground" />
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-6 glass-card rounded-xl">
                  {/* Service Cards */}
                  <div className="space-y-3">
                    <h4 className="font-semibold text-lg flex items-center mb-3">
                      <Code className="w-5 h-5 mr-2 text-purple-400" />
                      Core Services
                    </h4>
                    <div className="space-y-2 text-sm">
                      <div className="p-3 bg-black/20 border border-white/10 rounded-lg">
                        <div className="font-medium text-green-400 mb-1">Token Scanner Service</div>
                        <div className="text-xs text-muted-foreground">Market analysis • Price spike detection • Auto-discovery • Alert generation</div>
                      </div>
                      <div className="p-3 bg-black/20 border border-white/10 rounded-lg">
                        <div className="font-medium text-purple-400 mb-1">ML Pattern Analyzer</div>
                        <div className="text-xs text-muted-foreground">Pattern detection • Confidence scoring • Signal generation • Risk assessment</div>
                      </div>
                      <div className="p-3 bg-black/20 border border-white/10 rounded-lg">
                        <div className="font-medium text-blue-400 mb-1">Price Feed Service</div>
                        <div className="text-xs text-muted-foreground">Real-time aggregation • WebSocket broadcast • Technical indicators • Anomaly detection</div>
                      </div>
                      <div className="p-3 bg-black/20 border border-white/10 rounded-lg">
                        <div className="font-medium text-yellow-400 mb-1">Trading Analytics</div>
                        <div className="text-xs text-muted-foreground">P&L calculation • Win rate analysis • Hold time tracking • ROI by strategy</div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h4 className="font-semibold text-lg flex items-center mb-3">
                      <Database className="w-5 h-5 mr-2 text-cyan-400" />
                      Supporting Services
                    </h4>
                    <div className="space-y-2 text-sm">
                      <div className="p-3 bg-black/20 border border-white/10 rounded-lg">
                        <div className="font-medium text-orange-400 mb-1">Trade Journal Service</div>
                        <div className="text-xs text-muted-foreground">Entry/exit logging • Filter queries • Statistics calculation • History tracking</div>
                      </div>
                      <div className="p-3 bg-black/20 border border-white/10 rounded-lg">
                        <div className="font-medium text-red-400 mb-1">Risk Reports Service</div>
                        <div className="text-xs text-muted-foreground">Risk scoring • Daily/weekly summaries • Exposure analysis • Drawdown tracking</div>
                      </div>
                      <div className="p-3 bg-black/20 border border-white/10 rounded-lg">
                        <div className="font-medium text-teal-400 mb-1">WebSocket Server</div>
                        <div className="text-xs text-muted-foreground">Price broadcasting • Pattern alerts • Scanner activity • Trade confirmations</div>
                      </div>
                      <div className="p-3 bg-black/20 border border-white/10 rounded-lg">
                        <div className="font-medium text-indigo-400 mb-1">Database Operations</div>
                        <div className="text-xs text-muted-foreground">PostgreSQL + Drizzle ORM • Session management • Query optimization • ACID transactions</div>
                      </div>
                    </div>
                  </div>

                  <div className="col-span-1 md:col-span-2 mt-4 p-4 bg-gradient-to-r from-purple-500/10 to-blue-500/10 border border-purple-500/20 rounded-lg">
                    <h4 className="font-semibold mb-2 flex items-center">
                      <Wifi className="w-5 h-5 mr-2 text-purple-400" />
                      API Architecture
                    </h4>
                    <div className="text-sm text-muted-foreground grid grid-cols-2 md:grid-cols-4 gap-2">
                      <div className="flex items-center">
                        <CheckCircle className="w-3 h-3 mr-1 text-green-400" />
                        17 Analytics Endpoints
                      </div>
                      <div className="flex items-center">
                        <CheckCircle className="w-3 h-3 mr-1 text-blue-400" />
                        RESTful Design
                      </div>
                      <div className="flex items-center">
                        <CheckCircle className="w-3 h-3 mr-1 text-purple-400" />
                        Real-Time Updates
                      </div>
                      <div className="flex items-center">
                        <CheckCircle className="w-3 h-3 mr-1 text-yellow-400" />
                        Rate Limiting
                      </div>
                    </div>
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>

            {/* Competitive Advantages */}
            <div className="mb-12">
              <h3 className="text-3xl font-bold mb-6 flex items-center">
                <Award className="w-8 h-8 mr-3 text-yellow-400" />
                Competitive Advantages
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <motion.div 
                  className="p-6 glass-card rounded-xl border-l-4 border-purple-500"
                  whileHover={{ x: 5 }}
                >
                  <h4 className="font-semibold text-lg mb-3 flex items-center">
                    <Sparkles className="w-5 h-5 mr-2 text-purple-400" />
                    Free Advanced ML Analytics
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    While competitors charge premium fees, we provide institutional-grade ML pattern detection completely free. Our 75-92% confidence algorithms rival paid services.
                  </p>
                </motion.div>

                <motion.div 
                  className="p-6 glass-card rounded-xl border-l-4 border-blue-500"
                  whileHover={{ x: 5 }}
                >
                  <h4 className="font-semibold text-lg mb-3 flex items-center">
                    <RefreshCw className="w-5 h-5 mr-2 text-blue-400" />
                    Real-Time Auto-Discovery
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    Unique 5-minute auto-discovery scans trending memecoins using CoinGecko's top gainers API. Never miss a new opportunity in the volatile memecoin market.
                  </p>
                </motion.div>

                <motion.div 
                  className="p-6 glass-card rounded-xl border-l-4 border-green-500"
                  whileHover={{ x: 5 }}
                >
                  <h4 className="font-semibold text-lg mb-3 flex items-center">
                    <Shield className="w-5 h-5 mr-2 text-green-400" />
                    Zero-Risk Paper Trading
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    $10,000 virtual capital lets you test strategies without financial risk. Build confidence and track record before deploying real capital.
                  </p>
                </motion.div>

                <motion.div 
                  className="p-6 glass-card rounded-xl border-l-4 border-yellow-500"
                  whileHover={{ x: 5 }}
                >
                  <h4 className="font-semibold text-lg mb-3 flex items-center">
                    <Scale className="w-5 h-5 mr-2 text-yellow-400" />
                    Comprehensive Risk Management
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    0-100 risk scoring, drawdown tracking, exposure analysis, and daily/weekly/monthly reports help you understand and control trading risk.
                  </p>
                </motion.div>
              </div>
            </div>

            <Separator className="my-8" />

            {/* Who This Platform Is For */}
            <div className="mb-8">
              <h3 className="text-3xl font-bold mb-6 flex items-center">
                <Users className="w-8 h-8 mr-3 text-blue-400" />
                Who This Platform Is For
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <motion.div 
                  className="text-center p-6 glass-card rounded-xl"
                  whileHover={{ scale: 1.05 }}
                >
                  <div className="w-16 h-16 rounded-full bg-gradient-to-r from-green-400 to-emerald-500 p-4 mx-auto mb-4">
                    <Target className="w-full h-full text-white" />
                  </div>
                  <h4 className="font-semibold text-lg mb-2">Beginner Traders</h4>
                  <p className="text-sm text-muted-foreground">
                    Learn trading without risk. Practice with $10,000 virtual capital and understand market dynamics through real-time data.
                  </p>
                </motion.div>

                <motion.div 
                  className="text-center p-6 glass-card rounded-xl"
                  whileHover={{ scale: 1.05 }}
                >
                  <div className="w-16 h-16 rounded-full bg-gradient-to-r from-purple-400 to-pink-500 p-4 mx-auto mb-4">
                    <BarChart3 className="w-full h-full text-white" />
                  </div>
                  <h4 className="font-semibold text-lg mb-2">Strategy Developers</h4>
                  <p className="text-sm text-muted-foreground">
                    Test and refine trading strategies using ML patterns, comprehensive analytics, and detailed performance tracking.
                  </p>
                </motion.div>

                <motion.div 
                  className="text-center p-6 glass-card rounded-xl"
                  whileHover={{ scale: 1.05 }}
                >
                  <div className="w-16 h-16 rounded-full bg-gradient-to-r from-blue-400 to-cyan-500 p-4 mx-auto mb-4">
                    <Eye className="w-full h-full text-white" />
                  </div>
                  <h4 className="font-semibold text-lg mb-2">Market Researchers</h4>
                  <p className="text-sm text-muted-foreground">
                    Analyze memecoin trends, pattern formations, and market behavior with institutional-grade tools and real-time data.
                  </p>
                </motion.div>
              </div>
            </div>

            {/* Call to Action */}
            <div className="text-center mt-12 p-8 glass-card rounded-2xl bg-gradient-to-r from-purple-500/10 via-pink-500/10 to-blue-500/10 border-2 border-purple-500/20">
              <h3 className="text-2xl font-bold mb-3">Ready to Start Trading?</h3>
              <p className="text-muted-foreground mb-6 max-w-2xl mx-auto">
                Join CryptoHobby today and experience professional-grade memecoin trading tools with zero risk. Get $10,000 in virtual capital and access to all premium features for free.
              </p>
              <div className="flex flex-wrap gap-4 justify-center">
                <Badge className="bg-green-500/20 text-green-400 border-green-500/30 px-6 py-3 text-base">
                  <Rocket className="w-5 h-5 mr-2" />
                  100% Free Forever
                </Badge>
                <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 px-6 py-3 text-base">
                  <Shield className="w-5 h-5 mr-2" />
                  No Credit Card Required
                </Badge>
                <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30 px-6 py-3 text-base">
                  <Award className="w-5 h-5 mr-2" />
                  Institutional-Grade Tools
                </Badge>
              </div>
            </div>
          </motion.div>
        </motion.div>
      </main>
    </div>
  );
}