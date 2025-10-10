import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { useLanguage } from "@/hooks/use-language";
import { Link } from "wouter";
import { TrendingUp, TrendingDown } from "lucide-react";

interface PortfolioPosition {
  id: string;
  tokenId: string;
  amount: string;
  avgBuyPrice: string;
  currentValue: string;
  unrealizedPnL: string;
  analytics: {
    positionId: string;
    tokenSymbol: string;
    currentValue: string;
    unrealizedPnL: string;
    unrealizedPnLPercent: number;
    costBasis: string;
    allocation: number;
    dayChange: number;
    dayChangeValue: string;
    holdingPeriod: number;
  } | null;
  token: {
    symbol: string;
    name: string;
    currentPrice: string;
  };
}

interface PortfolioData {
  id: string;
  positions: PortfolioPosition[];
}

export function PortfolioSummary() {
  const { t } = useLanguage();
  
  const { data: portfolio, isLoading } = useQuery<PortfolioData>({
    queryKey: ['/api/portfolio', 'default'],
    refetchInterval: 30000,
    staleTime: 15000,
    retry: false,
  });

  const positions = portfolio?.positions || [];
  
  // Format amount for display
  const formatAmount = (amount: string, symbol: string) => {
    const numAmount = parseFloat(amount);
    if (numAmount >= 1000000) {
      return `${(numAmount / 1000000).toFixed(1)}M ${symbol}`;
    } else if (numAmount >= 1000) {
      return `${(numAmount / 1000).toFixed(1)}K ${symbol}`;
    }
    return `${numAmount.toFixed(2)} ${symbol}`;
  };

  return (
    <Card data-testid="card-portfolio-summary">
      <CardHeader>
        <CardTitle>{t("portfolio.summary")}</CardTitle>
      </CardHeader>
      
      <CardContent>
        {isLoading ? (
          <div className="space-y-4">
            <div className="h-16 bg-secondary/30 rounded-lg animate-pulse" />
            <div className="h-16 bg-secondary/30 rounded-lg animate-pulse" />
            <div className="h-16 bg-secondary/30 rounded-lg animate-pulse" />
          </div>
        ) : positions.length > 0 ? (
          <>
            <div className="space-y-4">
              {positions.slice(0, 3).map((position) => {
                const pnlPercent = position.analytics?.unrealizedPnLPercent || 0;
                const isPositive = pnlPercent >= 0;
                
                return (
                  <div
                    key={position.id}
                    className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg"
                    data-testid={`position-${position.token.symbol}`}
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-gradient-to-br from-orange-400 to-red-500 rounded-full flex items-center justify-center">
                        {isPositive ? (
                          <TrendingUp className="w-4 h-4 text-white" />
                        ) : (
                          <TrendingDown className="w-4 h-4 text-white" />
                        )}
                      </div>
                      <div>
                        <div className="font-medium" data-testid={`text-position-symbol-${position.token.symbol}`}>
                          {position.token.symbol}
                        </div>
                        <div className="text-sm text-muted-foreground" data-testid={`text-position-amount-${position.token.symbol}`}>
                          {formatAmount(position.amount, position.token.symbol)}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium" data-testid={`text-position-value-${position.token.symbol}`}>
                        ${parseFloat(position.currentValue || '0').toFixed(2)}
                      </div>
                      <div className={`text-sm ${isPositive ? 'text-price-up' : 'text-price-down'}`} data-testid={`text-position-pnl-${position.token.symbol}`}>
                        {isPositive ? '+' : ''}{pnlPercent.toFixed(2)}%
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            
            <Link href="/portfolio">
              <Button className="w-full mt-4" data-testid="button-view-portfolio">
                {t("portfolio.viewFull")}
              </Button>
            </Link>
          </>
        ) : (
          <div className="text-center py-8" data-testid="empty-positions">
            <p className="text-muted-foreground mb-4">
              {t("portfolio.noPositions") || "No active positions yet"}
            </p>
            <p className="text-sm text-muted-foreground">
              {t("portfolio.startTrading") || "Execute a trade to start building your portfolio"}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
