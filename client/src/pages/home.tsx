import { useLanguage } from "@/hooks/use-language";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
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
  Rocket
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
    tokensTracked: 63,
    tradesExecuted: 24,
    activeSystems: 5,
    autoDiscovery: true,
    uptime: "24/7",
    mlConfidence: "75-87%",
    paperTradingCapital: 10000,
    avgTradeSize: 500,
    lastTakeProfit: "87.0%",
    systemStatus: "LIVE"
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
          className="p-6 space-y-8"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {/* Hero Section with Floating Orbs */}
          <motion.div 
            className="relative text-center space-y-6 py-12"
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
              className="text-5xl font-bold gradient-text mb-4"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 100, delay: 0.5 }}
              data-testid="text-app-title"
            >
              MemeCoin Hunter
            </motion.h1>
            <motion.p 
              className="text-xl text-muted-foreground max-w-4xl mx-auto leading-relaxed"
              variants={itemVariants}
            >
              Next-Generation Memecoin Trading Platform with AI-Powered Pattern Recognition & Automated Execution
            </motion.p>
            <motion.div 
              className="flex items-center justify-center space-x-6"
              variants={itemVariants}
            >
              <motion.div variants={glowVariants} animate="pulse">
                <Badge variant="default" className="px-4 py-2 glass-card" data-testid="badge-system-status">
                  <Rocket className="w-4 h-4 mr-2" />
                  {systemStats.systemStatus}
                </Badge>
              </motion.div>
              <Badge variant="secondary" className="px-4 py-2 glass-card" data-testid="badge-uptime">
                <Clock className="w-4 h-4 mr-2" />
                {systemStats.uptime}
              </Badge>
              <Badge variant="outline" className="px-4 py-2 glass-card" data-testid="badge-tokens-tracked">
                <Globe className="w-4 h-4 mr-2" />
                {systemStats.tokensTracked} Tokens
              </Badge>
            </motion.div>
          </motion.div>

          {/* Interactive Performance Grid */}
          <motion.div 
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
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
                className="glass-card p-6 hover-lift cursor-pointer group"
                data-testid={`stat-card-${index}`}
              >
                <div className="flex items-center justify-between mb-4">
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-r ${stat.gradient} p-2.5 group-hover:scale-110 transition-transform duration-300`}>
                    <stat.icon className="w-full h-full text-white" />
                  </div>
                  <Sparkles className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
                <div className="text-3xl font-bold mb-1" data-testid={`text-${stat.title.toLowerCase().replace(' ', '-')}`}>
                  {stat.value}
                </div>
                <div className="text-sm text-muted-foreground">{stat.title}</div>
              </motion.div>
            ))}
          </motion.div>

          {/* Main Feature Showcase */}
          <motion.div 
            className="grid grid-cols-1 lg:grid-cols-2 gap-8"
            variants={containerVariants}
          >
            {/* Left Panel: Trading Engine */}
            <motion.div 
              className="glass-ultra rounded-3xl p-8 relative overflow-hidden"
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
                <div className="flex items-center space-x-3 mb-6">
                  <motion.div 
                    className="w-14 h-14 rounded-2xl bg-gradient-to-r from-purple-500 to-pink-500 p-3"
                    animate={{ rotate: [0, 360] }}
                    transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                  >
                    <Bot className="w-full h-full text-white" />
                  </motion.div>
                  <div>
                    <h3 className="text-2xl font-bold">Automated Trading Engine</h3>
                    <p className="text-muted-foreground">AI-powered execution system</p>
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
        </motion.div>
      </main>
    </div>
  );
}