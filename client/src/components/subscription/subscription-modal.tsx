import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/hooks/use-language";
import { Check, Shield, RefreshCw, Info } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface SubscriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SubscriptionModal({ isOpen, onClose }: SubscriptionModalProps) {
  const { t } = useLanguage();
  const { toast } = useToast();

  const subscriptionMutation = useMutation({
    mutationFn: async (plan: string) => {
      return await apiRequest("POST", "/api/subscription", {
        userId: "default", // Would come from auth context
        plan,
      });
    },
    onSuccess: () => {
      toast({
        title: "Subscription Updated",
        description: "Your subscription has been updated successfully.",
      });
      onClose();
    },
    onError: () => {
      toast({
        title: "Subscription Error",
        description: "Failed to update subscription. Please try again.",
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
      buttonText: t("subscription.choose"),
      popular: false,
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
      buttonText: t("subscription.choose"),
      popular: true,
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
      buttonText: t("subscription.contact"),
      popular: false,
    },
  ];

  const handleSelectPlan = (planId: string) => {
    if (planId === "enterprise") {
      // Handle contact sales
      toast({
        title: "Contact Sales",
        description: "Please contact our sales team for enterprise pricing.",
      });
      return;
    }
    
    subscriptionMutation.mutate(planId);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto" data-testid="modal-subscription">
        <DialogHeader>
          <DialogTitle className="text-2xl text-center">{t("subscription.title")}</DialogTitle>
          <p className="text-muted-foreground text-center mt-2">
            {t("subscription.subtitle")}
          </p>
        </DialogHeader>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className={`relative rounded-lg border p-6 ${
                plan.popular
                  ? "gradient-border"
                  : "bg-secondary/30 border-border"
              }`}
              data-testid={`plan-${plan.id}`}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                  <Badge className="bg-accent text-accent-foreground" data-testid="badge-popular">
                    {t("subscription.popular")}
                  </Badge>
                </div>
              )}
              
              <div className={plan.popular ? "bg-card rounded-lg p-6" : ""}>
                <div className="text-center">
                  <h3 className="text-lg font-semibold mb-2">{plan.name}</h3>
                  <div className="text-3xl font-bold mb-1" data-testid={`text-price-${plan.id}`}>
                    ${plan.price}
                  </div>
                  <div className="text-sm text-muted-foreground mb-6">
                    {t("subscription.monthly")}
                  </div>
                </div>
                
                <ul className="space-y-3 mb-6">
                  {plan.features.map((feature, index) => (
                    <li key={index} className="flex items-center space-x-2" data-testid={`feature-${plan.id}-${index}`}>
                      <Check className="w-4 h-4 text-green-400 flex-shrink-0" />
                      <span className="text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>
                
                <Button
                  className="w-full"
                  variant={plan.popular ? "default" : "secondary"}
                  onClick={() => handleSelectPlan(plan.id)}
                  disabled={subscriptionMutation.isPending}
                  data-testid={`button-select-${plan.id}`}
                >
                  {subscriptionMutation.isPending ? "Processing..." : plan.buttonText}
                </Button>
              </div>
            </div>
          ))}
        </div>
        
        <div className="mt-8 text-center">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="flex items-center justify-center space-x-2 text-sm text-muted-foreground">
              <Shield className="w-4 h-4" />
              <span>{t("subscription.secure")}</span>
            </div>
            <div className="flex items-center justify-center space-x-2 text-sm text-muted-foreground">
              <RefreshCw className="w-4 h-4" />
              <span>{t("subscription.moneyBack")}</span>
            </div>
            <div className="flex items-center justify-center space-x-2 text-sm text-muted-foreground">
              <Info className="w-4 h-4" />
              <span>{t("subscription.cancelAnytime")}</span>
            </div>
          </div>
          
          <div className="text-sm text-muted-foreground">
            <p>{t("subscription.footer")}</p>
            <p className="mt-1">{t("subscription.payments")}</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
