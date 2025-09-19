import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { useWebSocket } from "@/hooks/use-websocket";
import { useLanguage } from "@/hooks/use-language";
import { Filter, Play } from "lucide-react";
import { cn } from "@/lib/utils";

interface Token {
  id: string;
  symbol: string;
  name: string;
  currentPrice: string;
  priceChange24h: string;
  volume24h: string;
  marketCap: string;
}

export function TokenScanner() {
  const { t } = useLanguage();
  const { data: tokens, isLoading } = useQuery<Token[]>({
    queryKey: ['/api/tokens'],
    refetchInterval: 30000,
  });

  const { lastMessage } = useWebSocket();

  const getSignal = (change: string) => {
    const changeNum = parseFloat(change);
    if (changeNum > 20) return { label: "BULLISH", variant: "success" };
    if (changeNum < -10) return { label: "BEARISH", variant: "destructive" };
    return { label: "NEUTRAL", variant: "secondary" };
  };

  const getPriceChangeClass = (change: string) => {
    const changeNum = parseFloat(change);
    return changeNum >= 0 ? "price-up" : "price-down";
  };

  if (isLoading) {
    return (
      <Card data-testid="card-token-scanner">
        <CardHeader>
          <CardTitle>{t("scanner.title")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="card-token-scanner">
      <CardHeader className="border-b border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <CardTitle>{t("scanner.title")}</CardTitle>
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" data-testid="indicator-scanner-active" />
          </div>
          <div className="flex items-center space-x-2">
            <Button variant="secondary" size="sm" data-testid="button-filters">
              <Filter className="w-4 h-4 mr-2" />
              {t("scanner.filters")}
            </Button>
            <Button size="sm" data-testid="button-start-scan">
              <Play className="w-4 h-4 mr-2" />
              {t("scanner.startScan")}
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-secondary/50">
              <tr>
                <th className="text-left p-4 text-sm font-medium text-muted-foreground">{t("scanner.token")}</th>
                <th className="text-left p-4 text-sm font-medium text-muted-foreground">{t("scanner.price")}</th>
                <th className="text-left p-4 text-sm font-medium text-muted-foreground">{t("scanner.change24h")}</th>
                <th className="text-left p-4 text-sm font-medium text-muted-foreground">{t("scanner.volume")}</th>
                <th className="text-left p-4 text-sm font-medium text-muted-foreground">{t("scanner.marketCap")}</th>
                <th className="text-left p-4 text-sm font-medium text-muted-foreground">{t("scanner.signal")}</th>
                <th className="text-left p-4 text-sm font-medium text-muted-foreground">{t("scanner.action")}</th>
              </tr>
            </thead>
            <tbody>
              {tokens?.map((token) => {
                const signal = getSignal(token.priceChange24h);
                const priceChangeClass = getPriceChangeClass(token.priceChange24h);
                
                return (
                  <tr
                    key={token.id}
                    className="border-b border-border hover:bg-secondary/20 transition-colors"
                    data-testid={`row-token-${token.symbol}`}
                  >
                    <td className="p-4">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-gradient-to-br from-orange-400 to-red-500 rounded-full" />
                        <div>
                          <div className="font-medium" data-testid={`text-symbol-${token.symbol}`}>{token.symbol}</div>
                          <div className="text-sm text-muted-foreground" data-testid={`text-name-${token.symbol}`}>{token.name}</div>
                        </div>
                      </div>
                    </td>
                    <td className="p-4 font-mono" data-testid={`text-price-${token.symbol}`}>
                      ${parseFloat(token.currentPrice).toFixed(6)}
                    </td>
                    <td className="p-4">
                      <span className={cn("font-medium", priceChangeClass)} data-testid={`text-change-${token.symbol}`}>
                        {parseFloat(token.priceChange24h) >= 0 ? '+' : ''}{parseFloat(token.priceChange24h).toFixed(1)}%
                      </span>
                    </td>
                    <td className="p-4 font-mono" data-testid={`text-volume-${token.symbol}`}>
                      ${(parseFloat(token.volume24h) / 1000000).toFixed(1)}M
                    </td>
                    <td className="p-4 font-mono" data-testid={`text-marketcap-${token.symbol}`}>
                      ${(parseFloat(token.marketCap) / 1000000).toFixed(1)}M
                    </td>
                    <td className="p-4">
                      <Badge
                        variant={signal.variant as any}
                        className={cn(
                          "text-xs",
                          signal.variant === "success" && "bg-green-400/10 text-green-400",
                          signal.variant === "destructive" && "bg-destructive/10 text-destructive",
                          signal.variant === "secondary" && "bg-accent/10 text-accent"
                        )}
                        data-testid={`badge-signal-${token.symbol}`}
                      >
                        {signal.label}
                      </Badge>
                    </td>
                    <td className="p-4">
                      <Button size="sm" data-testid={`button-trade-${token.symbol}`}>
                        {t("scanner.trade")}
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
