import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useWebSocket } from "@/hooks/use-websocket";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Bell, BellOff, Trash2, Plus, TrendingUp, TrendingDown, DollarSign, Percent } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import type { AlertRule, AlertEvent, Token } from "@shared/schema";

const alertFormSchema = z.object({
  tokenId: z.string().min(1, "Token is required"),
  conditionType: z.enum(["price_above", "price_below", "percent_change_up", "percent_change_down"]),
  thresholdValue: z.string().min(1, "Threshold value is required"),
  percentWindow: z.string().optional(),
  comparisonWindow: z.string().optional(),
});

type AlertFormData = z.infer<typeof alertFormSchema>;

export default function Alerts() {
  const { toast } = useToast();
  const { lastMessage } = useWebSocket();
  const [deleteAlertId, setDeleteAlertId] = useState<string | null>(null);
  const [editingAlert, setEditingAlert] = useState<AlertRule | null>(null);

  // Fetch user's alerts
  const { data: alerts = [], isLoading: alertsLoading } = useQuery<AlertRule[]>({
    queryKey: ["/api/price-alerts"],
  });

  // Fetch tokens for dropdown
  const { data: tokens = [] } = useQuery<Token[]>({
    queryKey: ["/api/tokens"],
  });

  // Fetch alert history
  const { data: alertHistory = [] } = useQuery<AlertEvent[]>({
    queryKey: ["/api/price-alerts/history"],
  });

  // Create alert mutation
  const createAlertMutation = useMutation({
    mutationFn: async (data: AlertFormData) => {
      const res = await apiRequest("POST", "/api/price-alerts", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/price-alerts"] });
      toast({
        title: "Alert created",
        description: "Your price alert has been created successfully",
      });
      form.reset();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create alert",
        variant: "destructive",
      });
    },
  });

  // Update alert mutation
  const updateAlertMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<AlertFormData> }) => {
      const res = await apiRequest("PATCH", `/api/price-alerts/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/price-alerts"] });
      toast({
        title: "Alert updated",
        description: "Your price alert has been updated successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update alert",
        variant: "destructive",
      });
    },
  });

  // Delete alert mutation
  const deleteAlertMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/price-alerts/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/price-alerts"] });
      toast({
        title: "Alert deleted",
        description: "Your price alert has been deleted successfully",
      });
      setDeleteAlertId(null);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete alert",
        variant: "destructive",
      });
    },
  });

  // Toggle alert enabled/disabled
  const toggleAlertMutation = useMutation({
    mutationFn: async ({ id, isEnabled }: { id: string; isEnabled: boolean }) => {
      const res = await apiRequest("PATCH", `/api/price-alerts/${id}`, { isEnabled });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/price-alerts"] });
    },
  });

  // Form setup
  const form = useForm<AlertFormData>({
    resolver: zodResolver(alertFormSchema),
    defaultValues: {
      tokenId: "",
      conditionType: "price_above",
      thresholdValue: "",
      percentWindow: "",
      comparisonWindow: "24h",
    },
  });

  const conditionType = form.watch("conditionType");
  const isPercentCondition = conditionType.includes("percent_change");

  // Handle WebSocket alert notifications
  useEffect(() => {
    if (lastMessage?.type === "alert:triggered") {
      const alertData = lastMessage.data;
      toast({
        title: "🔔 Alert Triggered!",
        description: `${alertData.tokenSymbol}: ${alertData.conditionType.replace(/_/g, " ")} at $${alertData.triggeredPrice}`,
        duration: 10000,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/price-alerts/history"] });
    }
  }, [lastMessage, toast]);

  // Load alert data for editing
  useEffect(() => {
    if (editingAlert) {
      form.reset({
        tokenId: editingAlert.tokenId,
        conditionType: editingAlert.conditionType as any,
        thresholdValue: editingAlert.thresholdValue,
        percentWindow: editingAlert.percentWindow || "",
        comparisonWindow: editingAlert.comparisonWindow || "24h",
      });
    }
  }, [editingAlert, form]);

  const onSubmit = (data: AlertFormData) => {
    if (editingAlert) {
      updateAlertMutation.mutate({ id: editingAlert.id, data });
      setEditingAlert(null);
    } else {
      createAlertMutation.mutate(data);
    }
  };

  const getConditionIcon = (type: string) => {
    switch (type) {
      case "price_above":
        return <TrendingUp className="h-4 w-4" />;
      case "price_below":
        return <TrendingDown className="h-4 w-4" />;
      case "percent_change_up":
        return <Percent className="h-4 w-4 text-green-500" />;
      case "percent_change_down":
        return <Percent className="h-4 w-4 text-red-500" />;
      default:
        return <DollarSign className="h-4 w-4" />;
    }
  };

  const getConditionLabel = (type: string) => {
    return type.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase());
  };

  const getTokenSymbol = (tokenId: string) => {
    const token = tokens.find(t => t.id === tokenId);
    return token?.symbol || "Unknown";
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Price Alerts</h1>
          <p className="text-muted-foreground">Set up custom price alerts for your favorite tokens</p>
        </div>
        <Badge variant="outline" className="text-lg">
          <Bell className="h-4 w-4 mr-2" />
          {alerts.filter(a => a.isEnabled).length} Active
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Alert Form */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>{editingAlert ? "Edit Alert" : "Create New Alert"}</CardTitle>
            <CardDescription>
              {editingAlert ? "Update your price alert" : "Set up a new price alert"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="tokenId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Token</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-token">
                            <SelectValue placeholder="Select a token" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {tokens.slice(0, 50).map((token) => (
                            <SelectItem key={token.id} value={token.id} data-testid={`token-${token.symbol}`}>
                              {token.symbol} - {token.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="conditionType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Condition Type</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-condition">
                            <SelectValue placeholder="Select condition" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="price_above">Price Above</SelectItem>
                          <SelectItem value="price_below">Price Below</SelectItem>
                          <SelectItem value="percent_change_up">Percent Change Up</SelectItem>
                          <SelectItem value="percent_change_down">Percent Change Down</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="thresholdValue"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{isPercentCondition ? "Percent (%)" : "Price ($)"}</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.00000001"
                          placeholder={isPercentCondition ? "e.g., 5" : "e.g., 0.001"}
                          {...field}
                          data-testid="input-threshold"
                        />
                      </FormControl>
                      <FormDescription>
                        {isPercentCondition ? "Percentage change threshold" : "Price threshold in USD"}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {isPercentCondition && (
                  <FormField
                    control={form.control}
                    name="comparisonWindow"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Time Window</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-window">
                              <SelectValue placeholder="Select time window" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="1h">1 Hour</SelectItem>
                            <SelectItem value="24h">24 Hours</SelectItem>
                            <SelectItem value="7d">7 Days</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                <div className="flex gap-2">
                  <Button
                    type="submit"
                    className="flex-1"
                    disabled={createAlertMutation.isPending || updateAlertMutation.isPending}
                    data-testid="button-submit-alert"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    {editingAlert ? "Update Alert" : "Create Alert"}
                  </Button>
                  {editingAlert && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setEditingAlert(null);
                        form.reset();
                      }}
                      data-testid="button-cancel-edit"
                    >
                      Cancel
                    </Button>
                  )}
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>

        {/* Active Alerts List */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Your Alerts</CardTitle>
            <CardDescription>Manage your active price alerts</CardDescription>
          </CardHeader>
          <CardContent>
            {alertsLoading ? (
              <div className="text-center py-8">Loading alerts...</div>
            ) : alerts.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Bell className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No alerts created yet</p>
                <p className="text-sm">Create your first alert to get notified of price changes</p>
              </div>
            ) : (
              <div className="space-y-3">
                {alerts.map((alert) => (
                  <div
                    key={alert.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                    data-testid={`alert-${alert.id}`}
                  >
                    <div className="flex items-center gap-3 flex-1">
                      <div className="p-2 rounded-full bg-primary/10">
                        {getConditionIcon(alert.conditionType)}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">{getTokenSymbol(alert.tokenId)}</span>
                          <Badge variant="outline" className="text-xs">
                            {getConditionLabel(alert.conditionType)}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {alert.conditionType.includes("percent") 
                            ? `${alert.thresholdValue}% change`
                            : `$${parseFloat(alert.thresholdValue).toFixed(8)}`}
                          {alert.lastTriggeredAt && (
                            <span className="ml-2">
                              • Last triggered: {new Date(alert.lastTriggeredAt).toLocaleString()}
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={alert.isEnabled}
                        onCheckedChange={(checked) =>
                          toggleAlertMutation.mutate({ id: alert.id, isEnabled: checked })
                        }
                        data-testid={`switch-alert-${alert.id}`}
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditingAlert(alert)}
                        data-testid={`button-edit-${alert.id}`}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeleteAlertId(alert.id)}
                        data-testid={`button-delete-${alert.id}`}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Alert History */}
      <Card>
        <CardHeader>
          <CardTitle>Alert History</CardTitle>
          <CardDescription>Recent alert triggers</CardDescription>
        </CardHeader>
        <CardContent>
          {alertHistory.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <BellOff className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No alert history yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {alertHistory.slice(0, 10).map((event) => {
                const alert = alerts.find(a => a.id === event.alertId);
                return (
                  <div
                    key={event.id}
                    className="flex items-center justify-between p-3 border rounded-lg"
                    data-testid={`history-${event.id}`}
                  >
                    <div className="flex items-center gap-3">
                      <Bell className="h-4 w-4 text-primary" />
                      <div>
                        <p className="font-medium">
                          {alert ? getTokenSymbol(alert.tokenId) : "Unknown Token"}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Triggered at ${parseFloat(event.triggeredPrice).toFixed(8)}
                          {event.triggeredPercent && ` (${parseFloat(event.triggeredPercent).toFixed(2)}%)`}
                        </p>
                      </div>
                    </div>
                    <span className="text-sm text-muted-foreground" data-testid={`history-time-${event.id}`}>
                      {new Date(event.createdAt).toLocaleString()}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteAlertId} onOpenChange={() => setDeleteAlertId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Alert</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this alert? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteAlertId && deleteAlertMutation.mutate(deleteAlertId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
