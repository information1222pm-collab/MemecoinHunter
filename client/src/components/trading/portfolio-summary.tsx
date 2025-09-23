import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { useLanguage } from "@/hooks/use-language";

interface Position {
  tokenSymbol: string;
  tokenName: string;
  amount: string;
  currentValue: string;
  unrealizedPnL: string;
}

export function PortfolioSummary() {
  const { t } = useLanguage();
  
  const { data: portfolio } = useQuery({
    queryKey: ['/api/portfolio', 'default'],
    refetchInterval: 30000, // Refetch every 30 seconds to match main portfolio page
    staleTime: 15000, // Data stays fresh for 15 seconds
    retry: false, // Don't retry on 401 errors
  });

  // Mock data for demonstration
  const mockPositions: Position[] = [
    {
      tokenSymbol: "PEPE",
      tokenName: "847.2K tokens",
      amount: "847200",
      currentValue: "4234",
      unrealizedPnL: "23",
    },
    {
      tokenSymbol: "DOGE",
      tokenName: "3,247 tokens",
      amount: "3247",
      currentValue: "2847",
      unrealizedPnL: "12",
    },
    {
      tokenSymbol: "FLOKI",
      tokenName: "156.8K tokens",
      amount: "156800",
      currentValue: "1892",
      unrealizedPnL: "45",
    },
  ];

  return (
    <Card data-testid="card-portfolio-summary">
      <CardHeader>
        <CardTitle>{t("portfolio.summary")}</CardTitle>
      </CardHeader>
      
      <CardContent>
        <div className="space-y-4">
          {mockPositions.map((position, index) => (
            <div
              key={position.tokenSymbol}
              className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg"
              data-testid={`position-${position.tokenSymbol}`}
            >
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-gradient-to-br from-orange-400 to-red-500 rounded-full" />
                <div>
                  <div className="font-medium" data-testid={`text-position-symbol-${position.tokenSymbol}`}>
                    {position.tokenSymbol}
                  </div>
                  <div className="text-sm text-muted-foreground" data-testid={`text-position-amount-${position.tokenSymbol}`}>
                    {position.tokenName}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="font-medium price-up" data-testid={`text-position-value-${position.tokenSymbol}`}>
                  ${position.currentValue}
                </div>
                <div className="text-sm text-price-up" data-testid={`text-position-pnl-${position.tokenSymbol}`}>
                  +{position.unrealizedPnL}%
                </div>
              </div>
            </div>
          ))}
        </div>
        
        <Button className="w-full mt-4" data-testid="button-view-portfolio">
          {t("portfolio.viewFull")}
        </Button>
      </CardContent>
    </Card>
  );
}
