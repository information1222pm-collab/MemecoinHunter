import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { TokenScanner } from "@/components/trading/token-scanner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { useLanguage } from "@/hooks/use-language";
import { useWebSocket } from "@/hooks/use-websocket";
import { Settings, Play, Pause, RefreshCw } from "lucide-react";

export default function Scanner() {
  const { t } = useLanguage();
  const { isConnected, lastMessage } = useWebSocket();
  
  const { data: scannerStatus } = useQuery({
    queryKey: ['/api/scanner/status'],
    refetchInterval: 5000,
  });

  const { data: alerts } = useQuery({
    queryKey: ['/api/alerts'],
    refetchInterval: 30000,
  });

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
                  <span>Scanner Status</span>
                  <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`} />
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Status:</span>
                    <Badge variant={isConnected ? "default" : "destructive"} data-testid="badge-scanner-status">
                      {isConnected ? "Running" : "Stopped"}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Tokens Scanned:</span>
                    <span className="font-medium" data-testid="text-tokens-scanned">
                      {scannerStatus?.scannedTokensCount || 0}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Last Update:</span>
                    <span className="text-sm font-mono" data-testid="text-last-update">
                      {scannerStatus?.lastScanTime ? new Date(scannerStatus.lastScanTime).toLocaleTimeString() : 'N/A'}
                    </span>
                  </div>
                </div>
                
                <div className="flex space-x-2 mt-4">
                  <Button size="sm" className="flex-1" data-testid="button-start-scanner">
                    <Play className="w-4 h-4 mr-2" />
                    Start
                  </Button>
                  <Button size="sm" variant="secondary" className="flex-1" data-testid="button-pause-scanner">
                    <Pause className="w-4 h-4 mr-2" />
                    Pause
                  </Button>
                  <Button size="sm" variant="outline" data-testid="button-refresh-scanner">
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
                  {alerts?.slice(0, 5).map((alert: any, index: number) => (
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
