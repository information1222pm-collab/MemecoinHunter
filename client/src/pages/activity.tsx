import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useQuery } from "@tanstack/react-query";
import { useLanguage } from "@/hooks/use-language";
import { useWebSocket } from "@/hooks/use-websocket";
import { useState, useEffect } from "react";
import { 
  Activity as ActivityIcon, 
  Search, 
  TrendingUp, 
  AlertCircle, 
  Brain, 
  DollarSign, 
  Zap,
  Clock,
  Eye,
  RefreshCw,
  Filter,
  CheckCircle,
  AlertTriangle
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ActivityEvent {
  id: string;
  timestamp: Date;
  type: 'scanner' | 'alert' | 'pattern' | 'price' | 'risk' | 'trade' | 'system';
  severity: 'info' | 'warning' | 'success' | 'error';
  message: string;
  details?: string;
  symbol?: string;
  value?: string;
}

export default function Activity() {
  const { t } = useLanguage();
  const { isConnected, lastMessage } = useWebSocket();
  const [activityEvents, setActivityEvents] = useState<ActivityEvent[]>([]);
  const [filter, setFilter] = useState<string>('all');

  // Fetch initial activity data
  const { data: alerts } = useQuery({
    queryKey: ['/api/alerts'],
    refetchInterval: 30000,
  });

  const { data: patterns } = useQuery({
    queryKey: ['/api/patterns/recent'],
    refetchInterval: 30000,
  });

  const { data: scannerStatus } = useQuery({
    queryKey: ['/api/scanner/status'],
    refetchInterval: 10000,
  });

  // Convert API data to activity events
  useEffect(() => {
    const events: ActivityEvent[] = [];

    // Add alerts as activity events
    if (alerts && Array.isArray(alerts)) {
      alerts.forEach((alert: any) => {
        events.push({
          id: alert.id,
          timestamp: new Date(alert.createdAt),
          type: 'alert',
          severity: alert.alertType === 'price_spike' ? 'warning' : 'info',
          message: alert.message,
          symbol: alert.token?.symbol,
          value: alert.confidence ? `${alert.confidence}%` : undefined,
        });
      });
    }

    // Add ML patterns as activity events
    if (patterns && Array.isArray(patterns)) {
      patterns.forEach((pattern: any) => {
        events.push({
          id: pattern.id,
          timestamp: new Date(pattern.detectedAt),
          type: 'pattern',
          severity: 'success',
          message: `ML Pattern detected: ${pattern.patternType}`,
          details: `Confidence: ${pattern.confidence}%`,
          symbol: pattern.token?.symbol,
          value: `${pattern.confidence}%`,
        });
      });
    }

    // Sort by timestamp (newest first)
    events.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    setActivityEvents(events);
  }, [alerts, patterns]);

  // Handle real-time WebSocket updates
  useEffect(() => {
    if (lastMessage) {
      const newEvent: ActivityEvent = {
        id: `ws-${Date.now()}`,
        timestamp: new Date(),
        type: 'system',
        severity: 'info',
        message: 'Real-time update received',
        details: lastMessage.type,
      };

      switch (lastMessage.type) {
        case 'new_alert':
          newEvent.type = 'alert';
          newEvent.severity = 'warning';
          newEvent.message = lastMessage.data?.message || 'New alert triggered';
          newEvent.symbol = lastMessage.data?.symbol;
          break;
        case 'pattern_detected':
          newEvent.type = 'pattern';
          newEvent.severity = 'success';
          newEvent.message = `New pattern: ${lastMessage.data?.patternType || 'Unknown'}`;
          newEvent.symbol = lastMessage.data?.symbol;
          newEvent.value = lastMessage.data?.confidence ? `${lastMessage.data.confidence}%` : undefined;
          break;
        case 'price_update':
          newEvent.type = 'price';
          newEvent.severity = 'info';
          newEvent.message = `Price updated: ${lastMessage.data?.symbol || 'Unknown'}`;
          newEvent.symbol = lastMessage.data?.symbol;
          newEvent.value = lastMessage.data?.price ? `$${lastMessage.data.price}` : undefined;
          break;
        case 'token_update':
          newEvent.type = 'scanner';
          newEvent.severity = 'info';
          newEvent.message = `Token scanned: ${lastMessage.data?.symbol || 'Unknown'}`;
          newEvent.symbol = lastMessage.data?.symbol;
          break;
      }

      setActivityEvents(prev => [newEvent, ...prev.slice(0, 199)]); // Keep only 200 most recent
    }
  }, [lastMessage]);

  const getActivityIcon = (type: ActivityEvent['type']) => {
    switch (type) {
      case 'scanner': return <Search className="w-4 h-4" />;
      case 'alert': return <AlertCircle className="w-4 h-4" />;
      case 'pattern': return <Brain className="w-4 h-4" />;
      case 'price': return <DollarSign className="w-4 h-4" />;
      case 'risk': return <AlertTriangle className="w-4 h-4" />;
      case 'trade': return <TrendingUp className="w-4 h-4" />;
      case 'system': return <Zap className="w-4 h-4" />;
      default: return <ActivityIcon className="w-4 h-4" />;
    }
  };

  const getSeverityColor = (severity: ActivityEvent['severity']) => {
    switch (severity) {
      case 'success': return 'text-green-400';
      case 'warning': return 'text-yellow-400';
      case 'error': return 'text-red-400';
      case 'info': 
      default: return 'text-blue-400';
    }
  };

  const getSeverityBadgeVariant = (severity: ActivityEvent['severity']) => {
    switch (severity) {
      case 'success': return 'default';
      case 'warning': return 'secondary';
      case 'error': return 'destructive';
      case 'info':
      default: return 'outline';
    }
  };

  const filteredEvents = filter === 'all' 
    ? activityEvents 
    : activityEvents.filter(event => event.type === filter);

  const formatTimestamp = (timestamp: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - timestamp.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return timestamp.toLocaleDateString();
  };

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
                <ActivityIcon className="w-8 h-8" />
                <span>System Activity</span>
              </h1>
              <p className="text-muted-foreground mt-1">Real-time monitoring of all system operations</p>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`} />
                <Badge variant={isConnected ? "default" : "destructive"} data-testid="badge-connection-status">
                  {isConnected ? "Live" : "Disconnected"}
                </Badge>
              </div>
              <Button variant="outline" size="sm" data-testid="button-refresh">
                <RefreshCw className="w-4 h-4" />
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Activity Stats */}
            <Card data-testid="card-activity-stats" className="lg:col-span-1">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Eye className="w-5 h-5" />
                  <span>Activity Summary</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Total Events:</span>
                    <Badge variant="outline" data-testid="text-total-events">{activityEvents.length}</Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Live Connection:</span>
                    <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-400' : 'bg-red-400'}`} />
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Scanner:</span>
                    <Badge variant="default">Active</Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">ML Analyzer:</span>
                    <Badge variant="default">Running</Badge>
                  </div>
                </div>

                {/* Activity Type Filters */}
                <div className="pt-4 border-t">
                  <h4 className="text-sm font-medium mb-3">Filter by Type</h4>
                  <div className="space-y-2">
                    {[
                      { key: 'all', label: 'All Events', count: activityEvents.length },
                      { key: 'alert', label: 'Alerts', count: activityEvents.filter(e => e.type === 'alert').length },
                      { key: 'pattern', label: 'ML Patterns', count: activityEvents.filter(e => e.type === 'pattern').length },
                      { key: 'price', label: 'Price Updates', count: activityEvents.filter(e => e.type === 'price').length },
                      { key: 'system', label: 'System', count: activityEvents.filter(e => e.type === 'system').length },
                    ].map((filterOption) => (
                      <button
                        key={filterOption.key}
                        onClick={() => setFilter(filterOption.key)}
                        className={cn(
                          "w-full flex justify-between items-center px-3 py-2 rounded-md text-sm transition-colors",
                          filter === filterOption.key
                            ? "bg-primary/10 text-primary"
                            : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                        )}
                        data-testid={`button-filter-${filterOption.key}`}
                      >
                        <span>{filterOption.label}</span>
                        <Badge variant="outline">{filterOption.count}</Badge>
                      </button>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Activity Feed */}
            <Card data-testid="card-activity-feed" className="lg:col-span-3">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Clock className="w-5 h-5" />
                  <span>Live Activity Feed</span>
                  <Badge variant="outline">{filteredEvents.length} events</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-[600px]">
                  <div className="p-6 space-y-3">
                    {filteredEvents.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <ActivityIcon className="w-8 h-8 mx-auto mb-3 opacity-50" />
                        <p>No activity events found</p>
                        <p className="text-sm">Events will appear here as they happen</p>
                      </div>
                    ) : (
                      filteredEvents.map((event) => (
                        <div
                          key={event.id}
                          className="flex items-start space-x-4 p-4 rounded-lg border border-border hover:bg-accent/50 transition-colors"
                          data-testid={`activity-event-${event.id}`}
                        >
                          <div className={cn(
                            "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0",
                            "bg-background border border-border",
                            getSeverityColor(event.severity)
                          )}>
                            {getActivityIcon(event.type)}
                          </div>
                          
                          <div className="flex-1 space-y-1">
                            <div className="flex items-center space-x-2">
                              <p className="font-medium text-foreground">{event.message}</p>
                              {event.symbol && (
                                <Badge variant="outline" className="text-xs">{event.symbol}</Badge>
                              )}
                              {event.value && (
                                <Badge variant={getSeverityBadgeVariant(event.severity)} className="text-xs">
                                  {event.value}
                                </Badge>
                              )}
                            </div>
                            
                            {event.details && (
                              <p className="text-sm text-muted-foreground">{event.details}</p>
                            )}
                            
                            <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                              <span>{formatTimestamp(event.timestamp)}</span>
                              <span>•</span>
                              <span className="capitalize">{event.type}</span>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}