import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { SubscriptionModal } from "@/components/subscription/subscription-modal";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLanguage } from "@/hooks/use-language";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { 
  Check, 
  Crown, 
  CreditCard, 
  Calendar, 
  AlertCircle, 
  Zap,
  Shield,
  RefreshCw,
  Info,
  Star
} from "lucide-react";

interface Subscription {
  id: string;
  plan: string;
  status: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
}

export default function Subscription() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  const { data: subscription, isLoading } = useQuery<Subscription>({
    queryKey: ['/api/subscription', 'default'],
  });

  const cancelMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("PATCH", `/api/subscription/${subscription?.id}`, {
        cancelAtPeriodEnd: true,
      });
    },
    onSuccess: () => {
      toast({
        title: "Subscription Cancelled",
        description: "Your subscription will be cancelled at the end of the current period.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/subscription'] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to cancel subscription. Please try again.",
        variant: "destructive",
      });
    },
  });

  const reactivateMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("PATCH", `/api/subscription/${subscription?.id}`, {
        cancelAtPeriodEnd: false,
      });
    },
    onSuccess: () => {
      toast({
        title: "Subscription Reactivated",
        description: "Your subscription has been reactivated.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/subscription'] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to reactivate subscription. Please try again.",
        variant: "destructive",
      });
    },
  });

  const plans = [
    {
      id: "basic",
      name: t("subscription.basic"),
      price: 9,
      features: [
        t("subscription.features.basicScanning"),
        t("subscription.features.paperTrading"),
        t("subscription.features.basicCharts"),
        t("subscription.features.emailSupport"),
      ],
      popular: false,
      icon: Zap,
    },
    {
      id: "pro",
      name: t("subscription.pro"),
      price: 29,
      features: [
        t("subscription.features.advancedScanning"),
        t("subscription.features.aiPatterns"),
        t("subscription.features.realTimeAlerts"),
        t("subscription.features.advancedCharts"),
        t("subscription.features.cliAccess"),
        t("subscription.features.prioritySupport"),
      ],
      popular: true,
      icon: Star,
    },
    {
      id: "enterprise",
      name: t("subscription.enterprise"),
      price: 99,
      features: [
        t("subscription.features.unlimitedScanning"),
        t("subscription.features.customML"),
        t("subscription.features.apiAccess"),
        t("subscription.features.whiteLabel"),
        t("subscription.features.dedicatedSupport"),
      ],
      popular: false,
      icon: Crown,
    },
  ];

  const currentPlan = plans.find(plan => plan.id === subscription?.plan) || plans[0];

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'text-green-400';
      case 'cancelled':
        return 'text-yellow-400';
      case 'expired':
        return 'text-red-400';
      default:
        return 'text-muted-foreground';
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'active':
        return 'default';
      case 'cancelled':
        return 'secondary';
      case 'expired':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex bg-background">
        <Sidebar />
        <main className="flex-1 overflow-auto">
          <Header />
          <div className="p-6">
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          </div>
        </main>
      </div>
    );
  }

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
                <CreditCard className="w-8 h-8" />
                <span>Subscription Management</span>
              </h1>
              <p className="text-muted-foreground mt-1">Manage your subscription and billing preferences</p>
            </div>
            <Button 
              onClick={() => setShowUpgradeModal(true)}
              className="flex items-center space-x-2"
              data-testid="button-upgrade-plan"
            >
              <Crown className="w-4 h-4" />
              <span>Upgrade Plan</span>
            </Button>
          </div>

          {/* Current Subscription Status */}
          <Card data-testid="card-current-subscription">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <currentPlan.icon className="w-5 h-5" />
                <span>Current Subscription</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="text-center" data-testid="current-plan-info">
                  <div className="text-2xl font-bold">{currentPlan.name}</div>
                  <div className="text-muted-foreground">Current Plan</div>
                  <div className="text-sm text-primary mt-1">
                    ${currentPlan.price}/{t("subscription.monthly")}
                  </div>
                </div>
                
                <div className="text-center" data-testid="subscription-status">
                  <div className="flex items-center justify-center space-x-2">
                    <Badge 
                      variant={getStatusBadgeVariant(subscription?.status || 'active')}
                      className={getStatusColor(subscription?.status || 'active')}
                    >
                      {subscription?.status?.toUpperCase() || 'ACTIVE'}
                    </Badge>
                  </div>
                  <div className="text-muted-foreground">Status</div>
                </div>
                
                <div className="text-center" data-testid="billing-period">
                  <div className="text-lg font-semibold">
                    {subscription?.currentPeriodEnd ? formatDate(subscription.currentPeriodEnd) : 'N/A'}
                  </div>
                  <div className="text-muted-foreground">Next Billing</div>
                </div>
                
                <div className="text-center" data-testid="subscription-actions">
                  {subscription?.cancelAtPeriodEnd ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => reactivateMutation.mutate()}
                      disabled={reactivateMutation.isPending}
                      data-testid="button-reactivate"
                    >
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Reactivate
                    </Button>
                  ) : (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => cancelMutation.mutate()}
                      disabled={cancelMutation.isPending}
                      data-testid="button-cancel"
                    >
                      <AlertCircle className="w-4 h-4 mr-2" />
                      Cancel
                    </Button>
                  )}
                </div>
              </div>
              
              {subscription?.cancelAtPeriodEnd && (
                <div className="mt-4 p-4 bg-yellow-400/10 border border-yellow-400/20 rounded-lg" data-testid="cancellation-notice">
                  <div className="flex items-center space-x-2">
                    <AlertCircle className="w-4 h-4 text-yellow-400" />
                    <span className="text-sm font-medium text-yellow-400">Subscription Cancelled</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    Your subscription will end on {subscription.currentPeriodEnd ? formatDate(subscription.currentPeriodEnd) : 'N/A'}. 
                    You can reactivate anytime before then.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Plan Comparison */}
          <Card data-testid="card-plan-comparison">
            <CardHeader>
              <CardTitle>Available Plans</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {plans.map((plan) => {
                  const isCurrentPlan = plan.id === subscription?.plan;
                  const PlanIcon = plan.icon;
                  
                  return (
                    <div
                      key={plan.id}
                      className={`relative rounded-lg border p-6 ${
                        plan.popular
                          ? "gradient-border"
                          : isCurrentPlan
                          ? "border-primary bg-primary/5"
                          : "bg-secondary/30 border-border"
                      }`}
                      data-testid={`plan-card-${plan.id}`}
                    >
                      {plan.popular && (
                        <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                          <Badge className="bg-accent text-accent-foreground">
                            {t("subscription.popular")}
                          </Badge>
                        </div>
                      )}
                      
                      {isCurrentPlan && (
                        <div className="absolute -top-3 right-4">
                          <Badge className="bg-primary text-primary-foreground">
                            Current Plan
                          </Badge>
                        </div>
                      )}
                      
                      <div className={plan.popular ? "bg-card rounded-lg p-6" : ""}>
                        <div className="text-center">
                          <div className="flex items-center justify-center space-x-2 mb-3">
                            <PlanIcon className="w-6 h-6" />
                            <h3 className="text-lg font-semibold">{plan.name}</h3>
                          </div>
                          <div className="text-3xl font-bold mb-1" data-testid={`price-${plan.id}`}>
                            ${plan.price}
                          </div>
                          <div className="text-sm text-muted-foreground mb-6">
                            {t("subscription.monthly")}
                          </div>
                        </div>
                        
                        <ul className="space-y-3 mb-6">
                          {plan.features.map((feature, index) => (
                            <li 
                              key={index} 
                              className="flex items-center space-x-2"
                              data-testid={`feature-${plan.id}-${index}`}
                            >
                              <Check className="w-4 h-4 text-green-400 flex-shrink-0" />
                              <span className="text-sm">{feature}</span>
                            </li>
                          ))}
                        </ul>
                        
                        <Button
                          className="w-full"
                          variant={isCurrentPlan ? "outline" : plan.popular ? "default" : "secondary"}
                          disabled={isCurrentPlan}
                          onClick={() => setShowUpgradeModal(true)}
                          data-testid={`button-select-${plan.id}`}
                        >
                          {isCurrentPlan ? "Current Plan" : plan.id === "enterprise" ? t("subscription.contact") : t("subscription.choose")}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Billing Information */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card data-testid="card-billing-info">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Calendar className="w-5 h-5" />
                  <span>Billing Information</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between" data-testid="billing-cycle">
                    <span className="text-sm text-muted-foreground">Billing Cycle:</span>
                    <span className="font-medium">Monthly</span>
                  </div>
                  <div className="flex justify-between" data-testid="next-payment">
                    <span className="text-sm text-muted-foreground">Next Payment:</span>
                    <span className="font-medium">
                      {subscription?.currentPeriodEnd ? formatDate(subscription.currentPeriodEnd) : 'N/A'}
                    </span>
                  </div>
                  <div className="flex justify-between" data-testid="payment-method">
                    <span className="text-sm text-muted-foreground">Payment Method:</span>
                    <span className="font-medium">•••• •••• •••• 4242</span>
                  </div>
                  <div className="flex justify-between" data-testid="billing-email">
                    <span className="text-sm text-muted-foreground">Billing Email:</span>
                    <span className="font-medium">user@example.com</span>
                  </div>
                </div>
                
                <Button variant="outline" className="w-full mt-4" data-testid="button-update-billing">
                  Update Billing Info
                </Button>
              </CardContent>
            </Card>

            <Card data-testid="card-usage-stats">
              <CardHeader>
                <CardTitle>Current Usage</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span>Tokens Scanned</span>
                      <span>1,847 / ∞</span>
                    </div>
                    <div className="w-full bg-secondary rounded-full h-2">
                      <div className="bg-primary h-2 rounded-full" style={{ width: '45%' }}></div>
                    </div>
                  </div>
                  
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span>API Calls</span>
                      <span>12,456 / ∞</span>
                    </div>
                    <div className="w-full bg-secondary rounded-full h-2">
                      <div className="bg-green-400 h-2 rounded-full" style={{ width: '62%' }}></div>
                    </div>
                  </div>
                  
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span>Storage Used</span>
                      <span>2.3 GB / ∞</span>
                    </div>
                    <div className="w-full bg-secondary rounded-full h-2">
                      <div className="bg-accent h-2 rounded-full" style={{ width: '23%' }}></div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Support and Security */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center justify-center space-x-2 text-sm text-muted-foreground p-4 bg-secondary/20 rounded-lg">
              <Shield className="w-4 h-4" />
              <span>{t("subscription.secure")}</span>
            </div>
            <div className="flex items-center justify-center space-x-2 text-sm text-muted-foreground p-4 bg-secondary/20 rounded-lg">
              <RefreshCw className="w-4 h-4" />
              <span>{t("subscription.moneyBack")}</span>
            </div>
            <div className="flex items-center justify-center space-x-2 text-sm text-muted-foreground p-4 bg-secondary/20 rounded-lg">
              <Info className="w-4 h-4" />
              <span>{t("subscription.cancelAnytime")}</span>
            </div>
          </div>
        </div>
      </main>

      <SubscriptionModal
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
      />
    </div>
  );
}
