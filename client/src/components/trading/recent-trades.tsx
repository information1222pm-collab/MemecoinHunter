import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowUpRight, ArrowDownRight, Clock, TrendingUp } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";

interface Trade {
  id: string;
  type: string;
  amount: string;
  price: string;
  totalValue: string;
  status: string;
  createdAt: string;
  token: {
    symbol: string;
    name: string;
  };
}

export function RecentTrades() {
  const { data: trades, isLoading } = useQuery<Trade[]>({
    queryKey: ['/api/portfolio', 'default', 'trades'],
    refetchInterval: 30000,
    staleTime: 15000,
    retry: false,
  });

  const formatCurrency = (value: string) => {
    const numValue = parseFloat(value) || 0;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(numValue);
  };

  const formatAmount = (amount: string) => {
    const num = parseFloat(amount);
    if (num >= 1000000) return `${(num / 1000000).toFixed(2)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(2)}K`;
    return num.toFixed(2);
  };

  const recentTrades = trades?.slice(0, 5) || [];

  return (
    <Card data-testid="card-recent-trades" className="backdrop-blur-md bg-card/50 border-white/10">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center space-x-2">
            <TrendingUp className="w-5 h-5 text-orange-400" />
            <span>Recent Trades</span>
          </CardTitle>
          {trades && trades.length > 0 && (
            <Badge variant="secondary" className="bg-orange-500/10 text-orange-400 border-orange-500/20">
              {trades.length} total
            </Badge>
          )}
        </div>
      </CardHeader>
      
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 bg-secondary/30 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : recentTrades.length > 0 ? (
          <div className="space-y-3">
            {recentTrades.map((trade) => (
              <div
                key={trade.id}
                className="flex items-center justify-between p-3 bg-secondary/30 hover:bg-secondary/50 rounded-lg transition-colors backdrop-blur-sm border border-white/5"
                data-testid={`trade-${trade.id}`}
              >
                <div className="flex items-center space-x-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    trade.type === 'buy' 
                      ? 'bg-gradient-to-br from-green-400/20 to-green-600/20 border border-green-400/20' 
                      : 'bg-gradient-to-br from-red-400/20 to-red-600/20 border border-red-400/20'
                  }`}>
                    {trade.type === 'buy' ? (
                      <ArrowUpRight className="w-5 h-5 text-green-400" />
                    ) : (
                      <ArrowDownRight className="w-5 h-5 text-red-400" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <Badge
                        variant={trade.type === 'buy' ? 'default' : 'secondary'}
                        className={`${trade.type === 'buy' ? 'bg-green-600/80 hover:bg-green-600' : 'bg-red-600/80 hover:bg-red-600'} text-xs`}
                        data-testid={`badge-trade-type-${trade.id}`}
                      >
                        {trade.type.toUpperCase()}
                      </Badge>
                      <span className="font-medium" data-testid={`text-trade-symbol-${trade.id}`}>
                        {trade.token.symbol}
                      </span>
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">
                      {formatAmount(trade.amount)} @ {formatCurrency(trade.price)}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-semibold" data-testid={`text-trade-value-${trade.id}`}>
                    {formatCurrency(trade.totalValue)}
                  </div>
                  <div className="text-xs text-muted-foreground flex items-center justify-end mt-1">
                    <Clock className="w-3 h-3 mr-1" />
                    {formatDistanceToNow(new Date(trade.createdAt), { addSuffix: true })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <TrendingUp className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No trades yet</p>
            <p className="text-xs mt-1">Trades will appear here once executed</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
