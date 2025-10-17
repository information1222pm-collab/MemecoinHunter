import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLanguage } from "@/hooks/use-language";
import { useState, useEffect } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { getCsrfToken } from "@/lib/auth-utils";

interface Token {
  id: string;
  symbol: string;
  name: string;
  currentPrice: string;
  priceChange24h: string;
  volume24h: string;
  marketCap: string;
}

interface QuickTradeModalProps {
  selectedToken: Token | null;
  onClose: () => void;
}

export function QuickTradeModal({ selectedToken, onClose }: QuickTradeModalProps) {
  const { t } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [tradeType, setTradeType] = useState<"buy" | "sell">("buy");
  const [amount, setAmount] = useState("");
  const [orderType, setOrderType] = useState("market");

  // Fetch portfolio data
  const { data: portfolio } = useQuery<any>({
    queryKey: ['/api/portfolio', 'default'],
    staleTime: 0,
  });

  const tradeMutation = useMutation({
    mutationFn: async (tradeData: any) => {
      const csrfToken = await getCsrfToken();
      return await apiRequest("POST", "/api/trades", {
        ...tradeData,
        _csrf: csrfToken
      });
    },
    onSuccess: () => {
      toast({
        title: t("trade.success"),
        description: t("trade.executed"),
      });
      queryClient.invalidateQueries({ queryKey: ['/api/portfolio', 'default'] });
      queryClient.invalidateQueries({ queryKey: ['/api/portfolio'] });
      setAmount("");
      onClose();
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
    if (!selectedToken || !amount || !portfolio) {
      toast({
        title: t("trade.error"),
        description: t("trade.fillFields"),
        variant: "destructive",
      });
      return;
    }

    const currentPrice = parseFloat(selectedToken.currentPrice || "0");
    const tradeAmount = parseFloat(amount);
    const tokenQuantity = tradeAmount / currentPrice;

    const tradeData = {
      portfolioId: portfolio.id,
      tokenId: selectedToken.id,
      type: tradeType,
      amount: tokenQuantity.toString(),
      price: currentPrice.toString(),
      totalValue: tradeAmount.toString(),
    };

    tradeMutation.mutate(tradeData);
  };

  // Reset form when token changes
  useEffect(() => {
    setAmount("");
    setTradeType("buy");
    setOrderType("market");
  }, [selectedToken]);

  if (!selectedToken) {
    return <div>No token selected</div>;
  }

  return (
    <div className="space-y-4" data-testid="trade-modal-content">
      {/* Token Info */}
      <div className="bg-secondary/20 p-3 rounded-lg">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-gradient-to-br from-orange-400 to-red-500 rounded-full" />
          <div>
            <div className="font-medium" data-testid="text-selected-token-symbol">{selectedToken.symbol}</div>
            <div className="text-sm text-muted-foreground">{selectedToken.name}</div>
            <div className="text-sm font-mono" data-testid="text-selected-token-price">
              ${parseFloat(selectedToken.currentPrice).toFixed(6)}
            </div>
          </div>
        </div>
      </div>

      {/* Trade Type */}
      <div>
        <Label htmlFor="trade-type">{t("trade.orderType")}</Label>
        <div className="flex space-x-2 mt-1">
          <Button
            type="button"
            variant={tradeType === "buy" ? "default" : "outline"}
            className="flex-1"
            onClick={() => setTradeType("buy")}
            data-testid="button-buy"
          >
            {t("trade.buy")}
          </Button>
          <Button
            type="button"
            variant={tradeType === "sell" ? "default" : "outline"}
            className="flex-1"
            onClick={() => setTradeType("sell")}
            data-testid="button-sell"
          >
            {t("trade.sell")}
          </Button>
        </div>
      </div>

      {/* Amount */}
      <div>
        <Label htmlFor="amount">{t("trade.amount")} (USD)</Label>
        <Input
          id="amount"
          type="number"
          placeholder="Enter amount in USD"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="mt-1"
          data-testid="input-trade-amount"
        />
      </div>

      {/* Order Type */}
      <div>
        <Label htmlFor="order-type">{t("trade.orderType")}</Label>
        <Select value={orderType} onValueChange={setOrderType}>
          <SelectTrigger className="mt-1" data-testid="select-order-type">
            <SelectValue placeholder="Select order type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="market">{t("trade.market")}</SelectItem>
            <SelectItem value="limit">{t("trade.limit")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Trade Button */}
      <div className="space-y-2 pt-2">
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
    </div>
  );
}