import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Sidebar } from "@/components/layout/sidebar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Lightbulb, 
  TrendingUp, 
  AlertTriangle, 
  Target, 
  Activity,
  CheckCircle2,
  Eye,
  ThumbsUp,
  X
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

interface AIInsight {
  id: string;
  portfolioId: string;
  insightType: string;
  title: string;
  description: string;
  recommendation: string;
  confidence: string;
  priority: string;
  supportingData: any;
  status: string;
  expiresAt: string | null;
  createdAt: string;
  viewedAt: string | null;
  actedOnAt: string | null;
}

const insightTypeConfig = {
  performance_summary: {
    icon: TrendingUp,
    label: "Performance Analysis",
    color: "text-cyan-500 dark:text-cyan-400",
    bgColor: "bg-cyan-500/10 dark:bg-cyan-500/20",
  },
  risk_assessment: {
    icon: AlertTriangle,
    label: "Risk Assessment",
    color: "text-orange-500 dark:text-orange-400",
    bgColor: "bg-orange-500/10 dark:bg-orange-500/20",
  },
  opportunity_alert: {
    icon: Target,
    label: "Opportunity Alert",
    color: "text-green-500 dark:text-green-400",
    bgColor: "bg-green-500/10 dark:bg-green-500/20",
  },
  market_trend: {
    icon: Activity,
    label: "Market Trend",
    color: "text-blue-500 dark:text-blue-400",
    bgColor: "bg-blue-500/10 dark:bg-blue-500/20",
  },
  pattern_analysis: {
    icon: Lightbulb,
    label: "Pattern Analysis",
    color: "text-purple-500 dark:text-purple-400",
    bgColor: "bg-purple-500/10 dark:bg-purple-500/20",
  },
};

const priorityConfig = {
  critical: { color: "bg-red-500", label: "Critical" },
  high: { color: "bg-orange-500", label: "High" },
  medium: { color: "bg-yellow-500", label: "Medium" },
  low: { color: "bg-blue-500", label: "Low" },
};

export default function InsightsPage() {
  const { data: insights, isLoading } = useQuery<AIInsight[]>({
    queryKey: ['/api/insights'],
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const response = await fetch(`/api/insights/${id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!response.ok) throw new Error('Failed to update insight status');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/insights'] });
    },
  });

  const handleMarkViewed = (id: string) => {
    updateStatusMutation.mutate({ id, status: 'viewed' });
  };

  const handleMarkActedOn = (id: string) => {
    updateStatusMutation.mutate({ id, status: 'acted_on' });
  };

  const handleDismiss = (id: string) => {
    updateStatusMutation.mutate({ id, status: 'dismissed' });
  };

  const getInsightConfig = (type: string) => {
    return insightTypeConfig[type as keyof typeof insightTypeConfig] || insightTypeConfig.pattern_analysis;
  };

  const getPriorityConfig = (priority: string) => {
    return priorityConfig[priority as keyof typeof priorityConfig] || priorityConfig.medium;
  };

  return (
    <div className="flex h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 dark:from-slate-950 dark:via-blue-950 dark:to-slate-900">
      <Sidebar />
      <main className="flex-1 overflow-hidden">
        <ScrollArea className="h-full">
          <div className="container mx-auto p-6 space-y-6">
            {/* Header */}
            <div className="space-y-2">
              <h1 className="text-3xl font-bold text-white flex items-center gap-2">
                <Lightbulb className="w-8 h-8 text-cyan-400" />
                AI-Powered Insights
              </h1>
              <p className="text-slate-400">
                Intelligent recommendations and analysis powered by advanced machine learning
              </p>
            </div>

            {/* Insights Grid */}
            {isLoading ? (
              <div className="grid gap-4">
                {[1, 2, 3].map((i) => (
                  <Card key={i} className="bg-slate-900/50 border-slate-700 animate-pulse">
                    <CardHeader>
                      <div className="h-6 bg-slate-700 rounded w-3/4" />
                      <div className="h-4 bg-slate-700 rounded w-1/2 mt-2" />
                    </CardHeader>
                    <CardContent>
                      <div className="h-20 bg-slate-700 rounded" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : insights && insights.length > 0 ? (
              <div className="grid gap-4">
                {insights
                  .filter(i => i.status !== 'dismissed')
                  .map((insight) => {
                    const config = getInsightConfig(insight.insightType);
                    const Icon = config.icon;
                    const priorityConf = getPriorityConfig(insight.priority);
                    const isExpired = insight.expiresAt && new Date(insight.expiresAt) < new Date();

                    return (
                      <Card 
                        key={insight.id} 
                        className={cn(
                          "bg-slate-900/50 border-slate-700 transition-all hover:bg-slate-900/70",
                          insight.status === 'new' && "border-cyan-500/50",
                          isExpired && "opacity-60"
                        )}
                        data-testid={`insight-card-${insight.id}`}
                      >
                        <CardHeader>
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex items-start gap-3 flex-1">
                              <div className={cn("p-2 rounded-lg", config.bgColor)}>
                                <Icon className={cn("w-5 h-5", config.color)} />
                              </div>
                              <div className="flex-1 space-y-2">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <CardTitle className="text-lg text-white" data-testid={`insight-title-${insight.id}`}>
                                    {insight.title}
                                  </CardTitle>
                                  <Badge 
                                    variant="outline" 
                                    className={cn(
                                      "text-xs text-white border-0",
                                      priorityConf.color
                                    )}
                                    data-testid={`insight-priority-${insight.id}`}
                                  >
                                    {priorityConf.label}
                                  </Badge>
                                  {insight.status === 'new' && (
                                    <Badge variant="outline" className="text-xs bg-cyan-500/20 text-cyan-400 border-cyan-500/50">
                                      New
                                    </Badge>
                                  )}
                                  {insight.status === 'acted_on' && (
                                    <Badge variant="outline" className="text-xs bg-green-500/20 text-green-400 border-green-500/50">
                                      Acted On
                                    </Badge>
                                  )}
                                </div>
                                <CardDescription className="text-sm text-slate-400">
                                  {config.label} • {format(new Date(insight.createdAt), 'MMM d, yyyy h:mm a')}
                                  {isExpired && " • Expired"}
                                </CardDescription>
                              </div>
                            </div>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDismiss(insight.id)}
                                className="h-8 w-8 text-slate-400 hover:text-slate-200"
                                data-testid={`button-dismiss-${insight.id}`}
                              >
                                <X className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="space-y-3">
                            <div>
                              <p className="text-sm text-slate-300" data-testid={`insight-description-${insight.id}`}>
                                {insight.description}
                              </p>
                            </div>
                            <div className="p-4 bg-slate-800/50 rounded-lg border border-cyan-500/20">
                              <p className="text-sm font-medium text-cyan-400 mb-2">💡 Recommendation</p>
                              <p className="text-sm text-slate-200" data-testid={`insight-recommendation-${insight.id}`}>
                                {insight.recommendation}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="text-xs text-slate-500">
                                Confidence: {parseFloat(insight.confidence).toFixed(0)}%
                              </div>
                              <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                <div 
                                  className="h-full bg-gradient-to-r from-cyan-500 to-blue-500"
                                  style={{ width: `${parseFloat(insight.confidence)}%` }}
                                />
                              </div>
                            </div>
                          </div>
                          
                          {insight.status === 'new' && (
                            <div className="flex gap-2 pt-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleMarkViewed(insight.id)}
                                className="flex items-center gap-2 bg-slate-800/50 border-slate-600 hover:bg-slate-700"
                                data-testid={`button-viewed-${insight.id}`}
                              >
                                <Eye className="w-4 h-4" />
                                Mark as Viewed
                              </Button>
                              <Button
                                size="sm"
                                onClick={() => handleMarkActedOn(insight.id)}
                                className="flex items-center gap-2 bg-cyan-600 hover:bg-cyan-700 text-white"
                                data-testid={`button-acted-${insight.id}`}
                              >
                                <CheckCircle2 className="w-4 h-4" />
                                Acted On
                              </Button>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
              </div>
            ) : (
              <Card className="bg-slate-900/50 border-slate-700">
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Lightbulb className="w-16 h-16 text-slate-600 mb-4" />
                  <h3 className="text-xl font-semibold text-white mb-2">No Insights Yet</h3>
                  <p className="text-slate-400 text-center max-w-md">
                    AI insights will appear here as you trade. The system analyzes your trading patterns 
                    and provides personalized recommendations every 30 minutes.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </ScrollArea>
      </main>
    </div>
  );
}
