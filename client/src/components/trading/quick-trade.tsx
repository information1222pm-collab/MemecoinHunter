import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLanguage } from "@/hooks/use-language";
import { useState } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export function QuickTrade() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [selectedToken, setSelectedToken] = useState("");
  const [tradeType, setTradeType] = useState<"buy" | "sell">("buy");
  const [amount, setAmount] = useState("");
  const [orderType, setOrderType] = useState("market");

  // Fetch portfolio data
  const { data: portfolio } = useQuery({
    queryKey: ['/api/portfolio/default'],
    staleTime: 0,
  });

  // Fetch available tokens
  const { data: tokens } = useQuery({
    queryKey: ['/api/tokens'],
    staleTime: 0,
  });

  const tradeMutation = useMutation({
    mutationFn: async (tradeData: any) => {
      return await apiRequest("POST", "/api/trades", tradeData);
    },
    onSuccess: () => {
      toast({
        title: t("trade.success"),
        description: t("trade.executed"),
      });
      queryClient.invalidateQueries({ queryKey: ['/api/portfolio'] });
      setAmount("");
    },
    onError: () => {
      toast({
        title: t("trade.error"),
        description: t("trade.failed"),
        variant: "destructive",
      });
    },
  });

  const handleTrade = () => {
    if (!selectedToken || !amount || !portfolio || !tokens) {
      toast({
        title: t("trade.error"),
        description: t("trade.fillFields"),
        variant: "destructive",
      });
      return;
    }

    // Find the selected token to get current price
    const selectedTokenData = tokens.find((token: any) => token.id === selectedToken);
    if (!selectedTokenData) {
      toast({
        title: t("trade.error"),
        description: "Token not found",
        variant: "destructive",
      });
      return;
    }

    const currentPrice = parseFloat(selectedTokenData.currentPrice || "0");
    const tradeAmount = parseFloat(amount);
    const tokenQuantity = tradeAmount / currentPrice;

    const tradeData = {
      portfolioId: portfolio.id,
      tokenId: selectedToken,
      type: tradeType,
      amount: tokenQuantity.toString(),
      price: currentPrice.toString(),
      totalValue: tradeAmount.toString(),
    };

    tradeMutation.mutate(tradeData);
  };

  return (
    <Card data-testid="card-quick-trade">
      <CardHeader>
        <CardTitle>{t("trade.quickTrade")}</CardTitle>
      </CardHeader>
      
      <CardContent>
        <div className="space-y-4">
          <div>
            <Label htmlFor="token-select">{t("trade.token")}</Label>
            <Select value={selectedToken} onValueChange={setSelectedToken} data-testid="select-trade-token">
              <SelectTrigger>
                <SelectValue placeholder={t("trade.selectToken")} />
              </SelectTrigger>
              <SelectContent>
                {tokens?.map((token: any) => (
                  <SelectItem key={token.id} value={token.id}>
                    {token.symbol} - {token.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            <Button
              variant={tradeType === "buy" ? "default" : "outline"}
              onClick={() => setTradeType("buy")}
              className={tradeType === "buy" ? "bg-green-600 hover:bg-green-700" : ""}
              data-testid="button-trade-buy"
            >
              {t("trade.buy")}
            </Button>
            <Button
              variant={tradeType === "sell" ? "default" : "outline"}
              onClick={() => setTradeType("sell")}
              className={tradeType === "sell" ? "bg-red-600 hover:bg-red-700" : ""}
              data-testid="button-trade-sell"
            >
              {t("trade.sell")}
            </Button>
          </div>
          
          <div>
            <Label htmlFor="amount">{t("trade.amount")} (USD)</Label>
            <Input
              id="amount"
              type="number"
              placeholder="100.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="font-mono"
              data-testid="input-trade-amount"
            />
          </div>
          
          <div>
            <Label htmlFor="order-type">{t("trade.orderType")}</Label>
            <Select value={orderType} onValueChange={setOrderType} data-testid="select-order-type">
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="market">{t("trade.market")}</SelectItem>
                <SelectItem value="limit">{t("trade.limit")}</SelectItem>
                <SelectItem value="stop">{t("trade.stopLoss")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <Button
            className="w-full"
            onClick={handleTrade}
            disabled={tradeMutation.isPending}
            data-testid="button-execute-trade"
          >
            {tradeMutation.isPending ? t("trade.executing") : t("trade.execute")}
          </Button>
          
          <p className="text-xs text-muted-foreground text-center" data-testid="text-paper-trading">
            {t("trade.paperMode")}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
