import { useEffect } from "react";
import { useWebSocket } from "@/hooks/use-websocket";
import { useToast } from "@/hooks/use-toast";
import { TrendingUp, TrendingDown, DollarSign, Sparkles, AlertCircle } from "lucide-react";

interface Trade {
  id: string;
  portfolioId: string;
  tokenId: string;
  type: 'buy' | 'sell';
  amount: string;
  price: string;
  totalValue: string;
  timestamp: Date;
}

interface Token {
  id: string;
  symbol: string;
  name: string;
  currentPrice: string;
}

interface TradeEvent {
  trade: Trade;
  signal?: {
    type: string;
    source?: string;
    reason?: string;
  };
  token: Token;
  profitLoss?: string;
  profitPercentage?: number;
}

export function TradeNotifications() {
  const { lastMessage } = useWebSocket();
  const { toast } = useToast();

  useEffect(() => {
    if (!lastMessage) return;

    // Handle trade executed events
    if (lastMessage.type === 'trade_executed') {
      const event = lastMessage.data as TradeEvent;
      showTradeNotification(event);
    }

    // Handle stop loss triggered events
    if (lastMessage.type === 'stop_loss_triggered') {
      const data = lastMessage.data;
      showStopLossNotification(data);
    }

    // Handle portfolio updates with significant gains
    if (lastMessage.type === 'portfolio_updated') {
      const data = lastMessage.data;
      checkForMilestones(data);
    }
  }, [lastMessage]);

  const showTradeNotification = (event: TradeEvent) => {
    const { trade, token, signal, profitLoss, profitPercentage } = event;
    const isBuy = trade.type === 'buy';
    const amount = parseFloat(trade.amount);
    const price = parseFloat(trade.price);
    const totalValue = parseFloat(trade.totalValue);

    // Format amount for display
    const formatAmount = (num: number) => {
      if (num >= 1000000) return `${(num / 1000000).toFixed(2)}M`;
      if (num >= 1000) return `${(num / 1000).toFixed(2)}K`;
      if (num < 1) return num.toFixed(6);
      return num.toFixed(2);
    };

    // Format currency
    const formatCurrency = (num: number) => {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(num);
    };

    if (isBuy) {
      toast({
        title: "Trade Executed: BUY",
        description: (
          <div className="space-y-2" data-testid="toast-trade-buy-details">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1.5 bg-green-500/20 rounded">
                <TrendingUp className="h-4 w-4 text-green-500" />
              </div>
              <span className="text-sm font-semibold text-green-500">New Position Opened</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-sm">Token:</span>
              <span className="font-semibold">{token.symbol}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-sm">Amount:</span>
              <span className="font-mono">{formatAmount(amount)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-sm">Price:</span>
              <span className="font-mono">${price.toFixed(6)}</span>
            </div>
            <div className="flex items-center justify-between border-t pt-1.5 mt-1.5">
              <span className="text-muted-foreground text-sm">Total:</span>
              <span className="font-semibold text-green-500">{formatCurrency(totalValue)}</span>
            </div>
            {signal?.reason && (
              <div className="text-xs text-muted-foreground mt-2 pt-2 border-t">
                {signal.reason}
              </div>
            )}
          </div>
        ),
        variant: "default",
        className: "border-green-500/50 bg-card",
      });
    } else {
      // Sell notification
      const hasProfit = profitLoss && parseFloat(profitLoss) > 0;
      const hasLoss = profitLoss && parseFloat(profitLoss) < 0;

      toast({
        title: "Trade Executed: SELL",
        description: (
          <div className="space-y-2" data-testid="toast-trade-sell-details">
            <div className="flex items-center gap-2 mb-2">
              <div className={`p-1.5 rounded ${hasProfit ? 'bg-blue-500/20' : 'bg-red-500/20'}`}>
                <TrendingDown className={`h-4 w-4 ${hasProfit ? 'text-blue-500' : 'text-red-500'}`} />
              </div>
              <span className={`text-sm font-semibold ${hasProfit ? 'text-blue-500' : 'text-red-500'}`}>
                Position Closed
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-sm">Token:</span>
              <span className="font-semibold">{token.symbol}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-sm">Amount:</span>
              <span className="font-mono">{formatAmount(amount)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-sm">Price:</span>
              <span className="font-mono">${price.toFixed(6)}</span>
            </div>
            <div className="flex items-center justify-between border-t pt-1.5 mt-1.5">
              <span className="text-muted-foreground text-sm">Total:</span>
              <span className="font-semibold">{formatCurrency(totalValue)}</span>
            </div>
            {profitLoss && profitPercentage !== undefined && (
              <div className={`flex items-center justify-between border-t pt-1.5 mt-1.5 ${hasProfit ? 'text-green-500' : 'text-red-500'}`}>
                <span className="text-sm">Profit/Loss:</span>
                <div className="text-right">
                  <div className="font-semibold">{formatCurrency(parseFloat(profitLoss))}</div>
                  <div className="text-xs">({profitPercentage > 0 ? '+' : ''}{profitPercentage.toFixed(2)}%)</div>
                </div>
              </div>
            )}
            {signal?.reason && (
              <div className="text-xs text-muted-foreground mt-2 pt-2 border-t">
                {signal.reason}
              </div>
            )}
          </div>
        ),
        variant: "default",
        className: `border-${hasProfit ? 'blue' : 'red'}-500/50 bg-card`,
      });
    }
  };

  const showStopLossNotification = (data: any) => {
    toast({
      title: "Stop Loss Triggered",
      description: (
        <div className="space-y-2" data-testid="toast-stop-loss-details">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 bg-red-500/20 rounded">
              <AlertCircle className="h-4 w-4 text-red-500" />
            </div>
            <span className="text-sm font-semibold text-red-500">Risk Protection Activated</span>
          </div>
          <p className="text-sm text-muted-foreground">
            Position automatically closed to limit losses.
          </p>
          {data.tokenSymbol && (
            <p className="text-sm mt-1">
              Token: <span className="font-semibold">{data.tokenSymbol}</span>
            </p>
          )}
        </div>
      ),
      variant: "destructive",
    });
  };

  const checkForMilestones = (portfolioData: any) => {
    // Check for significant portfolio milestones
    const totalPnL = portfolioData.totalPnL ? parseFloat(portfolioData.totalPnL) : 0;
    const totalPnLPercentage = portfolioData.startingCapital 
      ? (totalPnL / parseFloat(portfolioData.startingCapital)) * 100 
      : 0;

    // Show notification for reaching profit milestones
    if (totalPnLPercentage >= 10 && totalPnLPercentage < 10.5) {
      showMilestoneNotification(10, totalPnL);
    } else if (totalPnLPercentage >= 25 && totalPnLPercentage < 25.5) {
      showMilestoneNotification(25, totalPnL);
    } else if (totalPnLPercentage >= 50 && totalPnLPercentage < 50.5) {
      showMilestoneNotification(50, totalPnL);
    } else if (totalPnLPercentage >= 100 && totalPnLPercentage < 100.5) {
      showMilestoneNotification(100, totalPnL);
    }
  };

  const showMilestoneNotification = (percentage: number, totalPnL: number) => {
    toast({
      title: "Milestone Reached!",
      description: (
        <div className="space-y-2" data-testid="toast-milestone-details">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 bg-yellow-500/20 rounded">
              <Sparkles className="h-4 w-4 text-yellow-500" />
            </div>
            <span className="text-sm font-semibold text-yellow-500">Portfolio Achievement</span>
          </div>
          <p className="text-base font-semibold text-yellow-500">
            {percentage}% Portfolio Growth! 🎉
          </p>
          <div className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-green-500" />
            <span className="text-sm">
              Total Profit: <span className="font-semibold text-green-500">
                ${totalPnL.toFixed(2)}
              </span>
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Keep up the great work! Your trading strategy is paying off.
          </p>
        </div>
      ),
      variant: "default",
      className: "border-yellow-500/50 bg-card",
    });
  };

  // This component doesn't render anything, it just manages notifications
  return null;
}
