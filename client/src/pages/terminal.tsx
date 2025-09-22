import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { CLITerminal } from "@/components/terminal/cli-terminal";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { useLanguage } from "@/hooks/use-language";
import { useWebSocket } from "@/hooks/use-websocket";
import { Terminal as TerminalIcon, Zap, Activity, AlertCircle } from "lucide-react";

export default function Terminal() {
  const { t } = useLanguage();
  const { isConnected } = useWebSocket();
  
  const { data: scannerStatus } = useQuery<{
    isRunning: boolean;
    scannedTokensCount: number;
    lastScanTime?: string;
  }>({
    queryKey: ['/api/scanner/status'],
    refetchInterval: 5000,
  });

  const { data: alerts } = useQuery<Array<{
    id: string;
    tokenId: string;
    alertType: string;
    message: string;
    confidence?: number;
    createdAt: string;
  }>>({
    queryKey: ['/api/alerts'],
    refetchInterval: 30000,
  });

  const commands = [
    {
      command: "scan --tokens=PEPE,DOGE,SHIB",
      description: "Start scanning specific tokens",
    },
    {
      command: "alerts --unread",
      description: "Show unread alerts",
    },
    {
      command: "portfolio --summary",
      description: "Display portfolio summary",
    },
    {
      command: "patterns --recent --limit=10",
      description: "Show recent pattern detections",
    },
    {
      command: "status",
      description: "Display system status",
    },
    {
      command: "help",
      description: "Show available commands",
    },
  ];

  return (
    <div className="min-h-screen flex bg-background">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <Header />
        
        <div className="p-6 space-y-6">
          {/* Page Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold flex items-center space-x-3" data-testid="text-page-title">
                <TerminalIcon className="w-8 h-8" />
                <span>{t("terminal.title")}</span>
              </h1>
              <p className="text-muted-foreground mt-1">Command-line interface for advanced trading operations</p>
            </div>
            <div className="flex items-center space-x-2">
              <Badge variant={isConnected ? "default" : "destructive"} data-testid="badge-connection-status">
                {isConnected ? "Connected" : "Disconnected"}
              </Badge>
            </div>
          </div>

          {/* System Status Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card data-testid="card-scanner-status">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Scanner Status</p>
                    <p className="text-xl font-bold">
                      {scannerStatus?.isRunning ? "Running" : "Stopped"}
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                    <Zap className="w-6 h-6 text-primary" />
                  </div>
                </div>
                <div className="mt-4 flex items-center text-sm">
                  <div className={`w-2 h-2 rounded-full mr-2 ${isConnected ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`} />
                  <span className="text-muted-foreground">
                    {scannerStatus?.scannedTokensCount || 0} tokens scanned
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card data-testid="card-active-sessions">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Active Sessions</p>
                    <p className="text-xl font-bold">1</p>
                  </div>
                  <div className="w-12 h-12 bg-green-400/10 rounded-full flex items-center justify-center">
                    <Activity className="w-6 h-6 text-green-400" />
                  </div>
                </div>
                <div className="mt-4 flex items-center text-sm">
                  <span className="text-muted-foreground">This session</span>
                </div>
              </CardContent>
            </Card>

            <Card data-testid="card-unread-alerts">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Unread Alerts</p>
                    <p className="text-xl font-bold">{alerts?.length || 0}</p>
                  </div>
                  <div className="w-12 h-12 bg-accent/10 rounded-full flex items-center justify-center">
                    <AlertCircle className="w-6 h-6 text-accent" />
                  </div>
                </div>
                <div className="mt-4 flex items-center text-sm">
                  <span className="text-muted-foreground">Last 24 hours</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Terminal and Command Reference */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            {/* Main Terminal */}
            <div className="xl:col-span-2">
              <CLITerminal />
            </div>

            {/* Command Reference */}
            <Card data-testid="card-command-reference">
              <CardHeader>
                <CardTitle>Command Reference</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {commands.map((cmd, index) => (
                    <div key={index} className="p-3 bg-secondary/20 rounded-lg" data-testid={`command-ref-${index}`}>
                      <div className="font-mono text-sm text-primary mb-1" data-testid={`text-command-${index}`}>
                        {cmd.command}
                      </div>
                      <div className="text-xs text-muted-foreground" data-testid={`text-description-${index}`}>
                        {cmd.description}
                      </div>
                    </div>
                  ))}
                </div>
                
                <div className="mt-6 p-4 bg-accent/10 border border-accent/20 rounded-lg">
                  <div className="text-sm font-medium text-accent mb-2">Quick Tip</div>
                  <div className="text-xs text-muted-foreground">
                    Use the ↑ and ↓ arrow keys to navigate through command history. 
                    Type 'help' for a complete list of available commands.
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Recent Activity */}
          <Card data-testid="card-recent-activity">
            <CardHeader>
              <CardTitle>Recent Terminal Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-secondary/20 rounded-lg" data-testid="activity-scan">
                  <div>
                    <div className="font-mono text-sm">scan --tokens=PEPE,DOGE</div>
                    <div className="text-xs text-muted-foreground">Scanned 2 tokens, 3 alerts generated</div>
                  </div>
                  <div className="text-xs text-muted-foreground">2 min ago</div>
                </div>
                
                <div className="flex items-center justify-between p-3 bg-secondary/20 rounded-lg" data-testid="activity-portfolio">
                  <div>
                    <div className="font-mono text-sm">portfolio --summary</div>
                    <div className="text-xs text-muted-foreground">Portfolio value: $12,847.32</div>
                  </div>
                  <div className="text-xs text-muted-foreground">5 min ago</div>
                </div>
                
                <div className="flex items-center justify-between p-3 bg-secondary/20 rounded-lg" data-testid="activity-patterns">
                  <div>
                    <div className="font-mono text-sm">patterns --recent</div>
                    <div className="text-xs text-muted-foreground">Found 5 patterns with 85% avg confidence</div>
                  </div>
                  <div className="text-xs text-muted-foreground">8 min ago</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
