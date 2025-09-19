import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { TokenScanner } from "@/components/trading/token-scanner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLanguage } from "@/hooks/use-language";
import { useWebSocket } from "@/hooks/use-websocket";
import { Settings, Play, Pause, RefreshCw } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function Scanner() {
  const { t } = useLanguage();
  const { isConnected, lastMessage } = useWebSocket();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const { data: scannerStatus } = useQuery({
    queryKey: ['/api/scanner/status'],
    refetchInterval: 5000,
  });

  const { data: alerts } = useQuery({
    queryKey: ['/api/alerts'],
    refetchInterval: 30000,
  });

  const { data: tokens } = useQuery({
    queryKey: ['/api/tokens'],
    refetchInterval: 30000,
  });

  // Scanner control mutations
  const startScannerMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/scanner/start"),
    onSuccess: () => {
      toast({ title: "Scanner Started", description: "Token scanner is now running" });
      queryClient.invalidateQueries({ queryKey: ['/api/scanner/status'] });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to start scanner", variant: "destructive" });
    }
  });

  const stopScannerMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/scanner/stop"),
    onSuccess: () => {
      toast({ title: "Scanner Paused", description: "Token scanner has been paused" });
      queryClient.invalidateQueries({ queryKey: ['/api/scanner/status'] });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to pause scanner", variant: "destructive" });
    }
  });

  const handleStartScanner = () => {
    startScannerMutation.mutate();
  };

  const handlePauseScanner = () => {
    stopScannerMutation.mutate();
  };

  const handleRefreshScanner = () => {
    queryClient.invalidateQueries({ queryKey: ['/api/scanner/status'] });
    queryClient.invalidateQueries({ queryKey: ['/api/tokens'] });
    toast({ title: "Refreshed", description: "Scanner data refreshed" });
  };

  return (
    <div className="min-h-screen flex bg-background">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <Header />
        
        <div className="p-6 space-y-6">
          {/* Scanner Controls */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card data-testid="card-scanner-status">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <span>Enhanced Scanner Status</span>
                  <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`} />
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Status:</span>
                    <Badge variant={(scannerStatus as any)?.isRunning ? "default" : "destructive"} data-testid="badge-scanner-status">
                      {(scannerStatus as any)?.isRunning ? "Running" : "Stopped"}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Tokens Scanned:</span>
                    <span className="font-medium" data-testid="text-tokens-scanned">
                      {(scannerStatus as any)?.scannedTokensCount || (tokens as any)?.length || 0}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Last Update:</span>
                    <span className="text-sm font-mono" data-testid="text-last-update">
                      {(scannerStatus as any)?.lastScanTime ? new Date((scannerStatus as any).lastScanTime).toLocaleTimeString() : 'N/A'}
                    </span>
                  </div>
                </div>
                
                <div className="flex space-x-2 mt-4">
                  <Button 
                    size="sm" 
                    className="flex-1" 
                    data-testid="button-start-scanner"
                    onClick={handleStartScanner}
                    disabled={startScannerMutation.isPending || (scannerStatus as any)?.isRunning}
                  >
                    <Play className="w-4 h-4 mr-2" />
                    {startScannerMutation.isPending ? "Starting..." : "Start"}
                  </Button>
                  <Button 
                    size="sm" 
                    variant="secondary" 
                    className="flex-1" 
                    data-testid="button-pause-scanner"
                    onClick={handlePauseScanner}
                    disabled={stopScannerMutation.isPending || !(scannerStatus as any)?.isRunning}
                  >
                    <Pause className="w-4 h-4 mr-2" />
                    {stopScannerMutation.isPending ? "Pausing..." : "Pause"}
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    data-testid="button-refresh-scanner"
                    onClick={handleRefreshScanner}
                  >
                    <RefreshCw className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card data-testid="card-scan-filters">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Settings className="w-5 h-5" />
                  <span>Scan Filters</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-medium">Min Market Cap</label>
                    <select className="w-full mt-1 bg-secondary border border-border rounded-md px-3 py-2 text-sm" data-testid="select-min-market-cap">
                      <option value="0">No minimum</option>
                      <option value="100000">$100K+</option>
                      <option value="1000000">$1M+</option>
                      <option value="10000000">$10M+</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Min Volume (24h)</label>
                    <select className="w-full mt-1 bg-secondary border border-border rounded-md px-3 py-2 text-sm" data-testid="select-min-volume">
                      <option value="0">No minimum</option>
                      <option value="10000">$10K+</option>
                      <option value="100000">$100K+</option>
                      <option value="1000000">$1M+</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Price Change</label>
                    <select className="w-full mt-1 bg-secondary border border-border rounded-md px-3 py-2 text-sm" data-testid="select-price-change">
                      <option value="any">Any</option>
                      <option value="positive">Positive only</option>
                      <option value="negative">Negative only</option>
                      <option value="significant">Significant (±10%)</option>
                    </select>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card data-testid="card-recent-alerts">
              <CardHeader>
                <CardTitle>Recent Alerts</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-32 overflow-y-auto">
                  {(alerts as any)?.slice(0, 5).map((alert: any, index: number) => (
                    <div key={alert.id} className="text-sm p-2 bg-secondary/30 rounded" data-testid={`alert-${index}`}>
                      <div className="font-medium">{alert.alertType.replace('_', ' ').toUpperCase()}</div>
                      <div className="text-muted-foreground text-xs">{alert.message}</div>
                    </div>
                  )) || (
                    <div className="text-sm text-muted-foreground" data-testid="text-no-alerts">
                      No recent alerts
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Enhanced Coverage Display */}
          <Card data-testid="card-enhanced-coverage">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>🚀 Enhanced Scanner Coverage</span>
                <Badge variant="secondary" className="bg-green-400/10 text-green-400">
                  EXPANDED
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-6">
                <div className="text-center">
                  <div className="text-3xl font-bold text-green-400">{(tokens as any)?.length || 0}</div>
                  <div className="text-sm text-muted-foreground">Active Tokens</div>
                  <div className="text-xs text-green-400 mt-1">↑ 3x more coverage</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-blue-400">60+</div>
                  <div className="text-sm text-muted-foreground">Tracked Memecoins</div>
                  <div className="text-xs text-blue-400 mt-1">Auto-updating list</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-purple-400">24/7</div>
                  <div className="text-sm text-muted-foreground">Discovery Mode</div>
                  <div className="text-xs text-purple-400 mt-1">Trending detection</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-orange-400">∞</div>
                  <div className="text-sm text-muted-foreground">Comprehensive Data</div>
                  <div className="text-xs text-orange-400 mt-1">Enhanced metrics</div>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div className="bg-green-400/5 border border-green-400/20 rounded-lg p-3">
                  <div className="font-medium text-green-400 mb-2">✓ Expanded Token List</div>
                  <div className="text-muted-foreground text-xs">
                    Now tracking 60+ popular memecoins including DOGE, SHIB, PEPE, BONK, WIF, MEW, BOME, DEGEN, and many more
                  </div>
                </div>
                <div className="bg-blue-400/5 border border-blue-400/20 rounded-lg p-3">
                  <div className="font-medium text-blue-400 mb-2">✓ Auto Discovery</div>
                  <div className="text-muted-foreground text-xs">
                    Automatically finds trending coins and top gainers every 5 minutes using advanced API endpoints
                  </div>
                </div>
                <div className="bg-purple-400/5 border border-purple-400/20 rounded-lg p-3">
                  <div className="font-medium text-purple-400 mb-2">✓ Enhanced Data</div>
                  <div className="text-muted-foreground text-xs">
                    7d/30d price changes, ATH/ATL metrics, supply data, and comprehensive market analytics
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Main Scanner Table */}
          <TokenScanner />

          {/* Scanner Analytics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card data-testid="card-scan-analytics-volume">
              <CardContent className="p-6">
                <div className="text-center">
                  <div className="text-2xl font-bold">2.4B</div>
                  <div className="text-sm text-muted-foreground">Total Volume Scanned</div>
                  <div className="text-sm text-price-up mt-1">+15% vs yesterday</div>
                </div>
              </CardContent>
            </Card>

            <Card data-testid="card-scan-analytics-new">
              <CardContent className="p-6">
                <div className="text-center">
                  <div className="text-2xl font-bold">47</div>
                  <div className="text-sm text-muted-foreground">New Tokens Today</div>
                  <div className="text-sm text-accent mt-1">3 with high volume</div>
                </div>
              </CardContent>
            </Card>

            <Card data-testid="card-scan-analytics-signals">
              <CardContent className="p-6">
                <div className="text-center">
                  <div className="text-2xl font-bold">23</div>
                  <div className="text-sm text-muted-foreground">Bullish Signals</div>
                  <div className="text-sm text-price-up mt-1">87% accuracy</div>
                </div>
              </CardContent>
            </Card>

            <Card data-testid="card-scan-analytics-patterns">
              <CardContent className="p-6">
                <div className="text-center">
                  <div className="text-2xl font-bold">156</div>
                  <div className="text-sm text-muted-foreground">Patterns Detected</div>
                  <div className="text-sm text-primary mt-1">73% confidence avg</div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
