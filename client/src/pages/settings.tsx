import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useLanguage } from "@/hooks/use-language";
import { useRefreshInterval } from "@/hooks/use-refresh-interval";
import { useState, useEffect } from "react";
import { Settings as SettingsIcon, User, Bell, Shield, Globe, Palette, TestTube, RefreshCw, DollarSign, TrendingUp, AlertTriangle, Brain, Bot, Percent, Timer } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useWebSocket } from "@/hooks/use-websocket";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

// Map icon names to components
const iconMap: Record<string, any> = {
  '🛡️': Shield,
  '⚖️': TrendingUp,
  '⚡': TrendingUp,
  '🔥': AlertTriangle,
  '🚀': AlertTriangle,
};

// Map colors to Tailwind classes
const colorMap: Record<string, string> = {
  'green': 'text-green-500',
  'blue': 'text-blue-500',
  'yellow': 'text-yellow-500',
  'orange': 'text-orange-500',
  'red': 'text-red-500',
};

function LaunchTradingCard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Fetch current portfolio to get ID
  const { data: portfolio } = useQuery<any>({
    queryKey: ['/api/portfolio'],
  });

  // Fetch launch config for current portfolio
  const { data: launchConfig, isLoading: isLoadingConfig } = useQuery<any>({
    queryKey: ['/api/launch/config', portfolio?.id],
    enabled: !!portfolio?.id,
  });

  // Fetch active strategy and performance
  const { data: activeStrategyData } = useQuery<any>({
    queryKey: ['/api/launch/strategies/active'],
  });

  // Fetch launch statistics
  const { data: launchStats } = useQuery<any>({
    queryKey: ['/api/launch/statistics'],
  });

  const [enabled, setEnabled] = useState(false);
  const [maxDailyTrades, setMaxDailyTrades] = useState("5");
  const [maxPositionSize, setMaxPositionSize] = useState("500");

  // Update local state when config loads
  useEffect(() => {
    if (launchConfig) {
      setEnabled(launchConfig.enabled || false);
      setMaxDailyTrades(launchConfig.maxDailyTrades?.toString() || "5");
      setMaxPositionSize(launchConfig.maxPositionSize?.toString() || "500");
    }
  }, [launchConfig]);

  const updateConfigMutation = useMutation({
    mutationFn: async (configData: any) => {
      if (!portfolio?.id) {
        throw new Error("Portfolio not loaded");
      }
      return await apiRequest("POST", `/api/launch/config/${portfolio.id}`, configData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/launch/config', portfolio?.id] });
      toast({
        title: "Launch Trading Updated",
        description: "Your launch trading configuration has been saved",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update configuration. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSaveConfig = () => {
    if (!portfolio?.id) {
      toast({
        title: "Error",
        description: "Portfolio not loaded. Please try refreshing the page.",
        variant: "destructive",
      });
      return;
    }
    updateConfigMutation.mutate({
      enabled,
      maxDailyTrades: parseInt(maxDailyTrades, 10),
      maxPositionSize: parseFloat(maxPositionSize)
    });
  };

  const strategy = activeStrategyData?.strategy;
  const performance = activeStrategyData?.performance;

  if (isLoadingConfig) {
    return (
      <Card data-testid="card-launch-trading" className="col-span-1 lg:col-span-2">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <TrendingUp className="w-5 h-5" />
            <span>Early-Launch Coin Trading</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">Loading configuration...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="card-launch-trading" className="col-span-1 lg:col-span-2">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <TrendingUp className="w-5 h-5 text-cyan-500" />
          <span>Early-Launch Coin Trading</span>
          <span className="ml-auto text-xs bg-cyan-500/20 text-cyan-500 px-2 py-1 rounded">EXPERIMENTAL</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Automatically detect and trade newly launched coins (≤5 minutes on market) using machine learning strategies. The system learns from successful patterns and experiments with different approaches.
          </p>

          {/* Enable/Disable Toggle */}
          <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg">
            <div>
              <Label htmlFor="launch-trading-enabled" className="text-base">Enable Launch Trading</Label>
              <p className="text-sm text-muted-foreground">Allow this portfolio to trade early-launch coins</p>
            </div>
            <Switch 
              id="launch-trading-enabled" 
              checked={enabled} 
              onCheckedChange={setEnabled}
              data-testid="switch-launch-trading"
            />
          </div>

          {/* Configuration Options */}
          {enabled && (
            <div className="space-y-4 pt-2">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="max-daily-trades">Max Daily Trades</Label>
                  <Input
                    id="max-daily-trades"
                    type="number"
                    min="1"
                    max="100"
                    value={maxDailyTrades}
                    onChange={(e) => setMaxDailyTrades(e.target.value)}
                    className="mt-1"
                    data-testid="input-max-daily-trades"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Maximum launch trades per day</p>
                </div>

                <div>
                  <Label htmlFor="max-position-size">Max Position Size ($)</Label>
                  <Input
                    id="max-position-size"
                    type="number"
                    min="50"
                    max="10000"
                    value={maxPositionSize}
                    onChange={(e) => setMaxPositionSize(e.target.value)}
                    className="mt-1"
                    data-testid="input-max-position-size"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Maximum amount per launch trade</p>
                </div>
              </div>

              {/* Strategy Status */}
              {strategy && performance && (
                <div className="bg-muted/50 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-semibold text-sm">Active Strategy: {strategy.strategyName}</h4>
                    {performance.isReadyForLive ? (
                      <span className="text-xs bg-green-500/20 text-green-500 px-2 py-1 rounded">READY</span>
                    ) : (
                      <span className="text-xs bg-yellow-500/20 text-yellow-500 px-2 py-1 rounded">LEARNING</span>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-3 gap-3 text-sm">
                    <div>
                      <p className="text-muted-foreground">Win Rate</p>
                      <p className="font-semibold text-cyan-500">{performance.winRate || 0}%</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Avg Profit</p>
                      <p className="font-semibold text-cyan-500">{performance.avgProfitPerTrade || 0}%</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Total Trades</p>
                      <p className="font-semibold">{performance.totalTrades || 0}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Learning Progress */}
              {launchStats && (
                <div className="bg-muted/50 rounded-lg p-4">
                  <h4 className="font-semibold text-sm mb-3">Learning Progress</h4>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-muted-foreground">Total Launches Detected</p>
                      <p className="font-semibold">{launchStats.totalLaunches || 0}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Success Rate</p>
                      <p className="font-semibold text-green-500">
                        {launchStats.totalLaunches > 0 
                          ? ((launchStats.successfulLaunches / launchStats.totalLaunches) * 100).toFixed(1)
                          : 0}%
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Save button always visible */}
          <Button 
            onClick={handleSaveConfig} 
            className="w-full bg-cyan-600 hover:bg-cyan-700 mt-4"
            disabled={updateConfigMutation.isPending}
            data-testid="button-save-launch-config"
          >
            {updateConfigMutation.isPending ? "Saving..." : "Save Configuration"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function RiskLevelCard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Fetch current portfolio to get risk level
  const { data: portfolio } = useQuery<any>({
    queryKey: ['/api/portfolio'],
  });

  // Fetch available risk levels
  const { data: riskLevels, isLoading: isLoadingLevels } = useQuery<any[]>({
    queryKey: ['/api/risk-levels'],
  });

  const [selectedRisk, setSelectedRisk] = useState<string>(portfolio?.riskLevel || 'balanced');

  // Update selected risk when portfolio loads
  useEffect(() => {
    if (portfolio?.riskLevel) {
      setSelectedRisk(portfolio.riskLevel);
    }
  }, [portfolio?.riskLevel]);

  const updateRiskLevelMutation = useMutation({
    mutationFn: async (riskLevel: string) => {
      return await apiRequest("PATCH", "/api/portfolio/risk-level", { riskLevel });
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/portfolio'] });
      const riskLevel = data?.portfolio?.riskLevel || selectedRisk;
      const updatedConfig = riskLevels?.find(r => r.level === riskLevel);
      toast({
        title: "Risk Level Updated",
        description: `Your trading risk level has been updated to ${updatedConfig?.displayName || riskLevel}`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update risk level. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleRiskLevelChange = (value: string) => {
    setSelectedRisk(value);
    updateRiskLevelMutation.mutate(value);
  };

  // Get current risk configuration from API data
  const currentRiskConfig = riskLevels?.find(r => r.level === selectedRisk);
  const RiskIcon = currentRiskConfig ? iconMap[currentRiskConfig.icon] || Shield : Shield;
  const colorClass = currentRiskConfig ? colorMap[currentRiskConfig.color] || 'text-gray-500' : 'text-gray-500';
  
  // Build features list from actual config
  const features = currentRiskConfig ? [
    `${currentRiskConfig.kellyMultiplier}x Kelly multiplier`,
    `${currentRiskConfig.minConfidence}% minimum confidence`,
    `${currentRiskConfig.stopLossPercentage}% stop-loss`,
    `${currentRiskConfig.minCashPercentage}% minimum cash reserve`,
    `Max ${currentRiskConfig.maxOpenPositions} open positions`,
  ] : [];

  // Show loading state if risk levels haven't loaded yet
  if (isLoadingLevels || !riskLevels || riskLevels.length === 0) {
    return (
      <Card data-testid="card-risk-level" className="col-span-1 lg:col-span-2">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Shield className="w-5 h-5" />
            <span>Trading Risk Level</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">Loading risk levels...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="card-risk-level" className="col-span-1 lg:col-span-2">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <RiskIcon className={`w-5 h-5 ${colorClass}`} />
          <span>Trading Risk Level</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Configure your automated trading strategy's risk tolerance. This affects position sizing, stop-loss levels, and trade confidence requirements.
          </p>

          <div>
            <Label htmlFor="risk-level">Risk Level</Label>
            <Select value={selectedRisk} onValueChange={handleRiskLevelChange}>
              <SelectTrigger className="mt-1" data-testid="select-risk-level">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {riskLevels.map((level: any) => {
                  const Icon = iconMap[level.icon] || Shield;
                  const color = colorMap[level.color] || 'text-gray-500';
                  return (
                    <SelectItem key={level.level} value={level.level}>
                      <div className="flex items-center space-x-2">
                        <Icon className={`w-4 h-4 ${color}`} />
                        <span>{level.displayName}{level.level === 'balanced' ? ' (Recommended)' : ''}</span>
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          {currentRiskConfig && (
            <div className="bg-muted/50 rounded-lg p-4">
              <div className="flex items-center space-x-2 mb-2">
                <RiskIcon className={`w-5 h-5 ${colorClass}`} />
                <h4 className="font-semibold">{currentRiskConfig.displayName}</h4>
              </div>
              <p className="text-sm text-muted-foreground mb-3">{currentRiskConfig.description}</p>
              <ul className="text-sm space-y-1 text-muted-foreground">
                {features.map((feature, idx) => (
                  <li key={idx}>• {feature}</li>
                ))}
              </ul>
            </div>
          )}

          {updateRiskLevelMutation.isPending && (
            <div className="text-sm text-muted-foreground flex items-center space-x-2">
              <div className="animate-spin w-4 h-4 border-2 border-primary border-t-transparent rounded-full" />
              <span>Updating risk level...</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function AITradingCard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Fetch current portfolio to get AI settings
  const { data: portfolio } = useQuery<any>({
    queryKey: ['/api/portfolio'],
  });

  const [aiEnabled, setAiEnabled] = useState(false);
  const [confidenceThreshold, setConfidenceThreshold] = useState("75");
  const [maxPositionSize, setMaxPositionSize] = useState("5");
  const [cooldownMinutes, setCooldownMinutes] = useState("5");

  // Update local state when portfolio loads
  useEffect(() => {
    if (portfolio) {
      setAiEnabled(portfolio.aiTradingEnabled || false);
      setConfidenceThreshold((portfolio.aiConfidenceThreshold || 75).toString());
      setMaxPositionSize(((portfolio.aiMaxPositionSize || 0.05) * 100).toString());
      setCooldownMinutes((portfolio.aiCooldownMinutes || 5).toString());
    }
  }, [portfolio]);

  const updateAISettingsMutation = useMutation({
    mutationFn: async (settings: any) => {
      return await apiRequest("POST", "/api/portfolio/ai-settings", settings);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/portfolio'] });
      toast({
        title: "AI Trading Settings Updated",
        description: "Your AI automation settings have been saved",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update AI settings",
        variant: "destructive",
      });
    },
  });

  const handleSaveAISettings = () => {
    updateAISettingsMutation.mutate({
      aiTradingEnabled: aiEnabled,
      aiConfidenceThreshold: parseInt(confidenceThreshold, 10),
      aiMaxPositionSize: parseFloat(maxPositionSize) / 100,
      aiCooldownMinutes: parseInt(cooldownMinutes, 10),
    });
  };

  return (
    <Card data-testid="card-ai-trading" className="col-span-1 lg:col-span-2">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Brain className="w-5 h-5 text-cyan-500" />
          <span>AI-Powered Trading Automation</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          <p className="text-sm text-muted-foreground">
            Configure AI-driven automated trading execution based on machine learning insights. The AI analyzes patterns and executes trades automatically when confidence thresholds are met.
          </p>

          {/* Enable/Disable Toggle */}
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label htmlFor="ai-enabled" className="flex items-center space-x-2">
                <Bot className="w-4 h-4" />
                <span>Enable AI Trading</span>
              </Label>
              <p className="text-xs text-muted-foreground">
                Allow AI to automatically execute trades based on insights
              </p>
            </div>
            <Switch
              id="ai-enabled"
              checked={aiEnabled}
              onCheckedChange={setAiEnabled}
              data-testid="switch-ai-trading"
            />
          </div>

          {/* Settings (only show when enabled) */}
          {aiEnabled && (
            <div className="space-y-4 p-4 bg-muted/20 rounded-lg">
              {/* Confidence Threshold */}
              <div>
                <Label htmlFor="confidence-threshold" className="flex items-center space-x-2">
                  <Percent className="w-4 h-4" />
                  <span>Minimum Confidence Threshold</span>
                </Label>
                <div className="mt-2 flex items-center space-x-4">
                  <Input
                    id="confidence-threshold"
                    type="number"
                    min="50"
                    max="100"
                    step="5"
                    value={confidenceThreshold}
                    onChange={(e) => setConfidenceThreshold(e.target.value)}
                    className="max-w-[120px]"
                    data-testid="input-confidence-threshold"
                  />
                  <span className="text-sm text-muted-foreground">%</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Only execute trades when AI confidence is above this level (50-100%)
                </p>
              </div>

              {/* Max Position Size */}
              <div>
                <Label htmlFor="max-position-size" className="flex items-center space-x-2">
                  <DollarSign className="w-4 h-4" />
                  <span>Maximum Position Size</span>
                </Label>
                <div className="mt-2 flex items-center space-x-4">
                  <Input
                    id="max-position-size"
                    type="number"
                    min="1"
                    max="20"
                    step="1"
                    value={maxPositionSize}
                    onChange={(e) => setMaxPositionSize(e.target.value)}
                    className="max-w-[120px]"
                    data-testid="input-max-position-size"
                  />
                  <span className="text-sm text-muted-foreground">% of portfolio</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Maximum percentage of portfolio for each AI-initiated trade (1-20%)
                </p>
              </div>

              {/* Cooldown Period */}
              <div>
                <Label htmlFor="cooldown-minutes" className="flex items-center space-x-2">
                  <Timer className="w-4 h-4" />
                  <span>Trade Cooldown Period</span>
                </Label>
                <div className="mt-2 flex items-center space-x-4">
                  <Input
                    id="cooldown-minutes"
                    type="number"
                    min="1"
                    max="60"
                    step="1"
                    value={cooldownMinutes}
                    onChange={(e) => setCooldownMinutes(e.target.value)}
                    className="max-w-[120px]"
                    data-testid="input-cooldown-minutes"
                  />
                  <span className="text-sm text-muted-foreground">minutes</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Minimum time between AI trades for the same token (1-60 minutes)
                </p>
              </div>
            </div>
          )}

          {/* Save Button */}
          <Button 
            onClick={handleSaveAISettings}
            disabled={updateAISettingsMutation.isPending}
            className="w-full md:w-auto"
            data-testid="button-save-ai-settings"
          >
            {updateAISettingsMutation.isPending ? (
              <>
                <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2" />
                Saving...
              </>
            ) : (
              <>
                <Brain className="w-4 h-4 mr-2" />
                Save AI Settings
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Settings() {
  const { t, language, setLanguage } = useLanguage();
  const { refreshInterval, setRefreshInterval } = useRefreshInterval();
  const { toast } = useToast();
  const { emitCustomEvent } = useWebSocket();
  const queryClient = useQueryClient();
  const [notifications, setNotifications] = useState(true);
  const [darkMode, setDarkMode] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [startingCapital, setStartingCapital] = useState("10000");

  const handleSaveSettings = () => {
    toast({
      title: "Settings Saved",
      description: "Your preferences have been updated successfully",
    });
  };

  const testBuyAlert = () => {
    emitCustomEvent({
      type: 'trade_executed',
      data: {
        trade: {
          id: 'test-buy-' + Date.now(),
          portfolioId: 'test',
          tokenId: 'test-token',
          type: 'buy',
          amount: '125000',
          price: '0.004',
          totalValue: '500',
          timestamp: new Date(),
        },
        signal: {
          type: 'ml_pattern',
          source: 'pattern_analyzer',
          reason: 'Strong bullish reversal pattern detected with 95% confidence',
        },
        token: {
          id: 'test-token',
          symbol: 'DOGE',
          name: 'Dogecoin',
          currentPrice: '0.004',
        },
      },
    });
  };

  const testSellAlert = () => {
    emitCustomEvent({
      type: 'trade_executed',
      data: {
        trade: {
          id: 'test-sell-' + Date.now(),
          portfolioId: 'test',
          tokenId: 'test-token',
          type: 'sell',
          amount: '125000',
          price: '0.0052',
          totalValue: '650',
          timestamp: new Date(),
        },
        signal: {
          type: 'take_profit',
          reason: 'Price target reached, securing profits',
        },
        token: {
          id: 'test-token',
          symbol: 'DOGE',
          name: 'Dogecoin',
          currentPrice: '0.0052',
        },
        profitLoss: '150',
        profitPercentage: 30,
      },
    });
  };

  const testMilestoneAlert = () => {
    emitCustomEvent({
      type: 'portfolio_updated',
      data: {
        id: 'test-portfolio',
        totalValue: '12500',
        totalPnL: '2500',
        startingCapital: '10000',
      },
    });
  };

  const resetPortfolioMutation = useMutation({
    mutationFn: async (startingCapital: string) => {
      return await apiRequest("POST", "/api/portfolio/reset", { startingCapital });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/portfolio'] });
      queryClient.invalidateQueries({ queryKey: ['/api/portfolio/trades'] });
      toast({
        title: "Portfolio Reset",
        description: `Your portfolio has been reset with $${parseFloat(startingCapital).toLocaleString()} starting capital`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Reset Failed",
        description: error.message || "Failed to reset portfolio. Please try again.",
        variant: "destructive",
      });
    },
  });

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
                <SettingsIcon className="w-8 h-8" />
                <span>{t("navigation.settings")}</span>
              </h1>
              <p className="text-muted-foreground mt-1">Manage your account preferences and application settings</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Profile Settings */}
            <Card data-testid="card-profile-settings">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <User className="w-5 h-5" />
                  <span>Profile Settings</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="username">Username</Label>
                  <Input 
                    id="username" 
                    defaultValue="trader123" 
                    className="mt-1"
                    data-testid="input-username"
                  />
                </div>
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input 
                    id="email" 
                    type="email" 
                    defaultValue="trader@example.com" 
                    className="mt-1"
                    data-testid="input-email"
                  />
                </div>
                <div>
                  <Label htmlFor="timezone">Timezone</Label>
                  <Select defaultValue="utc">
                    <SelectTrigger className="mt-1" data-testid="select-timezone">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="utc">UTC</SelectItem>
                      <SelectItem value="est">Eastern Time</SelectItem>
                      <SelectItem value="pst">Pacific Time</SelectItem>
                      <SelectItem value="cet">Central European Time</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Application Settings */}
            <Card data-testid="card-app-settings">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Palette className="w-5 h-5" />
                  <span>Application Settings</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="dark-mode">Dark Mode</Label>
                    <p className="text-sm text-muted-foreground">Use dark theme</p>
                  </div>
                  <Switch 
                    id="dark-mode" 
                    checked={darkMode} 
                    onCheckedChange={setDarkMode}
                    data-testid="switch-dark-mode"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="auto-refresh">Auto Refresh</Label>
                    <p className="text-sm text-muted-foreground">Automatically refresh data</p>
                  </div>
                  <Switch 
                    id="auto-refresh" 
                    checked={autoRefresh} 
                    onCheckedChange={setAutoRefresh}
                    data-testid="switch-auto-refresh"
                  />
                </div>
                <div>
                  <Label htmlFor="refresh-interval">Refresh Interval</Label>
                  <Select 
                    value={refreshInterval.toString()} 
                    onValueChange={(value) => setRefreshInterval(parseInt(value, 10))}
                  >
                    <SelectTrigger className="mt-1" data-testid="select-refresh-interval">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="10">10 seconds</SelectItem>
                      <SelectItem value="30">30 seconds</SelectItem>
                      <SelectItem value="60">1 minute</SelectItem>
                      <SelectItem value="300">5 minutes</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Language & Localization */}
            <Card data-testid="card-language-settings">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Globe className="w-5 h-5" />
                  <span>Language & Localization</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="language">Language</Label>
                  <Select value={language} onValueChange={setLanguage}>
                    <SelectTrigger className="mt-1" data-testid="select-language">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="en">English</SelectItem>
                      <SelectItem value="es">Español</SelectItem>
                      <SelectItem value="fr">Français</SelectItem>
                      <SelectItem value="de">Deutsch</SelectItem>
                      <SelectItem value="ja">日本語</SelectItem>
                      <SelectItem value="ko">한국어</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="currency">Display Currency</Label>
                  <Select defaultValue="usd">
                    <SelectTrigger className="mt-1" data-testid="select-currency">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="usd">USD ($)</SelectItem>
                      <SelectItem value="eur">EUR (€)</SelectItem>
                      <SelectItem value="btc">BTC (₿)</SelectItem>
                      <SelectItem value="eth">ETH (Ξ)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Notifications */}
            <Card data-testid="card-notification-settings">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Bell className="w-5 h-5" />
                  <span>Notifications</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="notifications">Enable Notifications</Label>
                    <p className="text-sm text-muted-foreground">Receive alerts and updates</p>
                  </div>
                  <Switch 
                    id="notifications" 
                    checked={notifications} 
                    onCheckedChange={setNotifications}
                    data-testid="switch-notifications"
                  />
                </div>
                <div>
                  <Label htmlFor="alert-types">Alert Types</Label>
                  <div className="mt-2 space-y-2">
                    <div className="flex items-center space-x-2">
                      <input type="checkbox" id="price-alerts" defaultChecked className="rounded" data-testid="checkbox-price-alerts" />
                      <Label htmlFor="price-alerts" className="text-sm">Price Alerts</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input type="checkbox" id="pattern-alerts" defaultChecked className="rounded" data-testid="checkbox-pattern-alerts" />
                      <Label htmlFor="pattern-alerts" className="text-sm">Pattern Alerts</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input type="checkbox" id="system-alerts" className="rounded" data-testid="checkbox-system-alerts" />
                      <Label htmlFor="system-alerts" className="text-sm">System Alerts</Label>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Test Trade Alerts */}
            <Card data-testid="card-test-alerts" className="col-span-1 lg:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <TestTube className="w-5 h-5" />
                  <span>Test Trade Alert Windows</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Click the buttons below to see example trade alert windows. These large modals appear in the center of your screen whenever trades are executed, sold, or your portfolio reaches milestones.
                  </p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Button 
                      onClick={testBuyAlert} 
                      className="w-full bg-green-600 hover:bg-green-700"
                      data-testid="button-test-buy"
                    >
                      Test Buy Alert
                    </Button>
                    
                    <Button 
                      onClick={testSellAlert} 
                      className="w-full bg-blue-600 hover:bg-blue-700"
                      data-testid="button-test-sell"
                    >
                      Test Sell Alert
                    </Button>
                    
                    <Button 
                      onClick={testMilestoneAlert} 
                      className="w-full bg-yellow-600 hover:bg-yellow-700"
                      data-testid="button-test-milestone"
                    >
                      Test Milestone Alert
                    </Button>
                  </div>
                  
                  <div className="bg-muted/50 rounded-lg p-4 mt-4">
                    <h4 className="font-semibold mb-2">What you'll see:</h4>
                    <ul className="text-sm space-y-1 text-muted-foreground">
                      <li>• <strong>Buy Alerts:</strong> Green modal showing token, amount, price, and total investment</li>
                      <li>• <strong>Sell Alerts:</strong> Blue/Red modal with profit/loss breakdown and percentage</li>
                      <li>• <strong>Milestone Alerts:</strong> Yellow celebration modal for 10%, 25%, 50%, 100% gains</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Risk Level Configuration */}
            <RiskLevelCard />

            {/* Trading Configuration - Removed manual toggles */}
            {/* AI and Launch Trading are now controlled by the system only */}

            {/* Portfolio Reset */}
            <Card data-testid="card-portfolio-reset" className="col-span-1 lg:col-span-2 border-destructive/50">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2 text-destructive">
                  <RefreshCw className="w-5 h-5" />
                  <span>Reset Portfolio</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="bg-destructive/10 rounded-lg p-4">
                    <p className="text-sm text-destructive font-semibold mb-2">⚠️ Warning: This action cannot be undone!</p>
                    <p className="text-sm text-muted-foreground">
                      Resetting your portfolio will:
                    </p>
                    <ul className="text-sm text-muted-foreground mt-2 space-y-1 ml-4">
                      <li>• Delete all current positions</li>
                      <li>• Reset all P&L values to zero</li>
                      <li>• Keep your trade history for reference</li>
                      <li>• Set your cash balance to the new starting capital</li>
                    </ul>
                  </div>

                  <div>
                    <Label htmlFor="starting-capital" className="flex items-center space-x-2">
                      <DollarSign className="w-4 h-4" />
                      <span>Starting Capital Amount</span>
                    </Label>
                    <div className="mt-2 flex items-center space-x-4">
                      <Input
                        id="starting-capital"
                        type="number"
                        min="100"
                        step="100"
                        value={startingCapital}
                        onChange={(e) => setStartingCapital(e.target.value)}
                        className="max-w-xs"
                        data-testid="input-starting-capital"
                        placeholder="10000"
                      />
                      <span className="text-sm text-muted-foreground">
                        = ${parseFloat(startingCapital || "0").toLocaleString()}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Minimum: $100 | Recommended: $1,000 - $100,000
                    </p>
                  </div>

                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button 
                        variant="destructive" 
                        className="w-full md:w-auto"
                        disabled={resetPortfolioMutation.isPending || parseFloat(startingCapital) < 100}
                        data-testid="button-reset-portfolio"
                      >
                        <RefreshCw className="w-4 h-4 mr-2" />
                        {resetPortfolioMutation.isPending ? "Resetting..." : "Reset Portfolio"}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will permanently delete all your current positions and reset your portfolio to ${parseFloat(startingCapital).toLocaleString()} starting capital. 
                          This action cannot be undone. Your trade history will be preserved for reference.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel data-testid="button-cancel-reset">Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => resetPortfolioMutation.mutate(startingCapital)}
                          className="bg-destructive hover:bg-destructive/90"
                          data-testid="button-confirm-reset"
                        >
                          Yes, Reset Portfolio
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Save Settings */}
          <div className="flex justify-end">
            <Button onClick={handleSaveSettings} data-testid="button-save-settings">
              Save Settings
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}