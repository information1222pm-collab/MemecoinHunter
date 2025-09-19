import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { useLanguage } from "@/hooks/use-language";
import { useState } from "react";

interface PriceData {
  timestamp: string;
  price: string;
}

export function PriceChart() {
  const { t } = useLanguage();
  const [timeframe, setTimeframe] = useState("1H");
  const [selectedToken] = useState("PEPE");

  const { data: priceHistory } = useQuery<PriceData[]>({
    queryKey: ['/api/tokens', 'default', 'history'],
    refetchInterval: 60000,
  });

  const timeframes = ["1H", "4H", "1D", "1W"];

  return (
    <Card data-testid="card-price-chart">
      <CardHeader className="border-b border-border">
        <div className="flex items-center justify-between">
          <CardTitle data-testid="text-chart-title">
            {t("chart.title")} - {selectedToken}/USD
          </CardTitle>
          <div className="flex items-center space-x-2">
            {timeframes.map((tf) => (
              <Button
                key={tf}
                variant={timeframe === tf ? "default" : "secondary"}
                size="sm"
                onClick={() => setTimeframe(tf)}
                data-testid={`button-timeframe-${tf}`}
              >
                {tf}
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="p-6">
        <div className="h-64 relative" data-testid="chart-container">
          {/* Mock Chart */}
          <svg className="w-full h-full" viewBox="0 0 400 200">
            <defs>
              <linearGradient id="chartGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" style={{ stopColor: "hsl(var(--primary))", stopOpacity: 0.3 }} />
                <stop offset="100%" style={{ stopColor: "hsl(var(--primary))", stopOpacity: 0 }} />
              </linearGradient>
            </defs>
            <path
              className="chart-line"
              d="M0,150 L50,120 L100,140 L150,80 L200,90 L250,60 L300,70 L350,40 L400,50"
              data-testid="chart-line"
            />
            <path
              d="M0,150 L50,120 L100,140 L150,80 L200,90 L250,60 L300,70 L350,40 L400,50 L400,200 L0,200 Z"
              fill="url(#chartGradient)"
              data-testid="chart-fill"
            />
          </svg>
          
          <div className="absolute top-4 left-4 bg-background/80 backdrop-blur-sm rounded-lg p-3">
            <div className="text-sm text-muted-foreground">{t("chart.currentPrice")}</div>
            <div className="text-lg font-semibold price-up" data-testid="text-current-price">$0.000012</div>
            <div className="text-sm text-price-up" data-testid="text-price-change">+187.3% (24h)</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
