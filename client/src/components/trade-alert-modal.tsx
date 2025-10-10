import { useEffect, useState, useRef } from "react";
import { useWebSocket } from "@/hooks/use-websocket";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { TrendingUp, TrendingDown, Sparkles, AlertCircle, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

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

interface AlertData {
  id: string;
  type: 'buy' | 'sell' | 'milestone' | 'stop_loss';
  data: any;
  timestamp: number;
}

export function TradeAlertModal() {
  const { lastMessage } = useWebSocket();
  const [alerts, setAlerts] = useState<AlertData[]>([]);
  const [currentAlert, setCurrentAlert] = useState<AlertData | null>(null);
  const lastMilestoneRef = useRef<number>(0);
  const alertQueue = useRef<AlertData[]>([]);
  const autoDismissTimer = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!lastMessage) return;

    // Handle trade executed events
    if (lastMessage.type === 'trade_executed') {
      const event = lastMessage.data as TradeEvent;
      const alertType = event.trade.type;
      
      const newAlert: AlertData = {
        id: `${alertType}-${Date.now()}-${Math.random()}`,
        type: alertType,
        data: event,
        timestamp: Date.now(),
      };
      
      alertQueue.current.push(newAlert);
      processAlertQueue();
    }

    // Handle portfolio milestone events
    if (lastMessage.type === 'portfolio_updated') {
      const portfolioData = lastMessage.data;
      const totalPnL = portfolioData.totalPnL ? parseFloat(portfolioData.totalPnL) : 0;
      const totalPnLPercentage = portfolioData.startingCapital 
        ? (totalPnL / parseFloat(portfolioData.startingCapital)) * 100 
        : 0;

      let currentMilestone = 0;
      if (totalPnLPercentage >= 100) currentMilestone = 100;
      else if (totalPnLPercentage >= 50) currentMilestone = 50;
      else if (totalPnLPercentage >= 25) currentMilestone = 25;
      else if (totalPnLPercentage >= 10) currentMilestone = 10;

      if (currentMilestone > 0 && currentMilestone > lastMilestoneRef.current) {
        lastMilestoneRef.current = currentMilestone;
        
        const newAlert: AlertData = {
          id: `milestone-${Date.now()}`,
          type: 'milestone',
          data: { percentage: currentMilestone, totalPnL, portfolioData },
          timestamp: Date.now(),
        };
        
        alertQueue.current.push(newAlert);
        processAlertQueue();
      }
    }

    // Handle stop loss events
    if (lastMessage.type === 'stop_loss_triggered') {
      const newAlert: AlertData = {
        id: `stop_loss-${Date.now()}`,
        type: 'stop_loss',
        data: lastMessage.data,
        timestamp: Date.now(),
      };
      
      alertQueue.current.push(newAlert);
      processAlertQueue();
    }
  }, [lastMessage]);

  const processAlertQueue = () => {
    if (currentAlert || alertQueue.current.length === 0) return;
    
    const nextAlert = alertQueue.current.shift();
    if (nextAlert) {
      // Clear any existing timer before setting new one
      if (autoDismissTimer.current) {
        clearTimeout(autoDismissTimer.current);
        autoDismissTimer.current = null;
      }
      
      setCurrentAlert(nextAlert);
      setAlerts(prev => [nextAlert, ...prev].slice(0, 50)); // Keep last 50
      
      // Auto-dismiss after 8 seconds
      autoDismissTimer.current = setTimeout(() => {
        dismissCurrentAlert();
      }, 8000);
    }
  };

  const dismissCurrentAlert = () => {
    // Clear the auto-dismiss timer
    if (autoDismissTimer.current) {
      clearTimeout(autoDismissTimer.current);
      autoDismissTimer.current = null;
    }
    
    setCurrentAlert(null);
    // Process next alert after a short delay
    setTimeout(() => {
      processAlertQueue();
    }, 300);
  };

  const formatAmount = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(2)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(2)}K`;
    if (num < 1) return num.toFixed(6);
    return num.toFixed(2);
  };

  const formatCurrency = (num: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(num);
  };

  const renderAlertContent = () => {
    if (!currentAlert) return null;

    switch (currentAlert.type) {
      case 'buy':
        return <BuyAlert data={currentAlert.data} formatAmount={formatAmount} formatCurrency={formatCurrency} />;
      case 'sell':
        return <SellAlert data={currentAlert.data} formatAmount={formatAmount} formatCurrency={formatCurrency} />;
      case 'milestone':
        return <MilestoneAlert data={currentAlert.data} formatCurrency={formatCurrency} />;
      case 'stop_loss':
        return <StopLossAlert data={currentAlert.data} />;
      default:
        return null;
    }
  };

  return (
    <Dialog open={!!currentAlert} onOpenChange={(open) => !open && dismissCurrentAlert()}>
      <DialogContent 
        className="max-w-md border-2 shadow-2xl"
        data-testid="trade-alert-modal"
      >
        <Button
          variant="ghost"
          size="icon"
          className="absolute right-4 top-4 rounded-full"
          onClick={dismissCurrentAlert}
          data-testid="button-close-alert"
        >
          <X className="h-4 w-4" />
        </Button>
        
        <AnimatePresence mode="wait">
          {currentAlert && (
            <motion.div
              key={currentAlert.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
            >
              {renderAlertContent()}
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}

function BuyAlert({ data, formatAmount, formatCurrency }: any) {
  const { trade, token, signal } = data as TradeEvent;
  const amount = parseFloat(trade.amount);
  const price = parseFloat(trade.price);
  const totalValue = parseFloat(trade.totalValue);

  return (
    <div className="space-y-4" data-testid="alert-buy-content">
      <DialogHeader>
        <div className="flex items-center gap-3 mb-2">
          <div className="p-3 bg-green-500/20 rounded-lg">
            <TrendingUp className="h-8 w-8 text-green-500" />
          </div>
          <div>
            <DialogTitle className="text-2xl font-bold text-green-500">
              Trade Executed!
            </DialogTitle>
            <DialogDescription className="text-lg">
              New Position Opened
            </DialogDescription>
          </div>
        </div>
      </DialogHeader>

      <div className="bg-muted/50 rounded-lg p-4 space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-muted-foreground text-base">Token:</span>
          <span className="text-xl font-bold" data-testid="text-token-symbol">{token.symbol}</span>
        </div>
        
        <div className="flex justify-between items-center">
          <span className="text-muted-foreground text-base">Amount:</span>
          <span className="text-lg font-mono" data-testid="text-trade-amount">{formatAmount(amount)}</span>
        </div>
        
        <div className="flex justify-between items-center">
          <span className="text-muted-foreground text-base">Price:</span>
          <span className="text-lg font-mono" data-testid="text-trade-price">${price.toFixed(6)}</span>
        </div>
        
        <div className="border-t pt-3 mt-3">
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground text-base">Total Invested:</span>
            <span className="text-2xl font-bold text-green-500" data-testid="text-total-value">
              {formatCurrency(totalValue)}
            </span>
          </div>
        </div>
      </div>

      {signal?.reason && (
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
          <p className="text-sm text-muted-foreground font-medium">Why this trade?</p>
          <p className="text-sm mt-1" data-testid="text-trade-reason">{signal.reason}</p>
        </div>
      )}
    </div>
  );
}

function SellAlert({ data, formatAmount, formatCurrency }: any) {
  const { trade, token, signal, profitLoss, profitPercentage } = data as TradeEvent;
  const amount = parseFloat(trade.amount);
  const price = parseFloat(trade.price);
  const totalValue = parseFloat(trade.totalValue);
  const hasProfit = profitLoss && parseFloat(profitLoss) > 0;

  return (
    <div className="space-y-4" data-testid="alert-sell-content">
      <DialogHeader>
        <div className="flex items-center gap-3 mb-2">
          <div className={`p-3 rounded-lg ${hasProfit ? 'bg-blue-500/20' : 'bg-red-500/20'}`}>
            <TrendingDown className={`h-8 w-8 ${hasProfit ? 'text-blue-500' : 'text-red-500'}`} />
          </div>
          <div>
            <DialogTitle className={`text-2xl font-bold ${hasProfit ? 'text-blue-500' : 'text-red-500'}`}>
              Position Closed!
            </DialogTitle>
            <DialogDescription className="text-lg">
              {hasProfit ? 'Profit Secured' : 'Loss Realized'}
            </DialogDescription>
          </div>
        </div>
      </DialogHeader>

      <div className="bg-muted/50 rounded-lg p-4 space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-muted-foreground text-base">Token:</span>
          <span className="text-xl font-bold" data-testid="text-token-symbol">{token.symbol}</span>
        </div>
        
        <div className="flex justify-between items-center">
          <span className="text-muted-foreground text-base">Amount:</span>
          <span className="text-lg font-mono" data-testid="text-trade-amount">{formatAmount(amount)}</span>
        </div>
        
        <div className="flex justify-between items-center">
          <span className="text-muted-foreground text-base">Sell Price:</span>
          <span className="text-lg font-mono" data-testid="text-trade-price">${price.toFixed(6)}</span>
        </div>
        
        <div className="flex justify-between items-center">
          <span className="text-muted-foreground text-base">Sale Value:</span>
          <span className="text-lg font-semibold" data-testid="text-total-value">
            {formatCurrency(totalValue)}
          </span>
        </div>

        {profitLoss && profitPercentage !== undefined && (
          <div className={`border-t pt-3 mt-3 ${hasProfit ? 'border-blue-500/30' : 'border-red-500/30'}`}>
            <div className="flex justify-between items-center">
              <span className="text-base font-medium">Profit/Loss:</span>
              <div className="text-right">
                <div className={`text-2xl font-bold ${hasProfit ? 'text-green-500' : 'text-red-500'}`} data-testid="text-profit-loss">
                  {formatCurrency(parseFloat(profitLoss))}
                </div>
                <div className={`text-lg font-semibold ${hasProfit ? 'text-green-500' : 'text-red-500'}`} data-testid="text-profit-percentage">
                  ({profitPercentage > 0 ? '+' : ''}{profitPercentage.toFixed(2)}%)
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {signal?.reason && (
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
          <p className="text-sm text-muted-foreground font-medium">Why this exit?</p>
          <p className="text-sm mt-1" data-testid="text-trade-reason">{signal.reason}</p>
        </div>
      )}
    </div>
  );
}

function MilestoneAlert({ data, formatCurrency }: any) {
  const { percentage, totalPnL } = data;

  return (
    <div className="space-y-4" data-testid="alert-milestone-content">
      <DialogHeader>
        <div className="flex items-center gap-3 mb-2">
          <div className="p-3 bg-yellow-500/20 rounded-lg">
            <Sparkles className="h-8 w-8 text-yellow-500" />
          </div>
          <div>
            <DialogTitle className="text-2xl font-bold text-yellow-500">
              Milestone Reached!
            </DialogTitle>
            <DialogDescription className="text-lg">
              Portfolio Achievement
            </DialogDescription>
          </div>
        </div>
      </DialogHeader>

      <div className="bg-gradient-to-br from-yellow-500/10 to-orange-500/10 border-2 border-yellow-500/30 rounded-lg p-6 text-center space-y-4">
        <div>
          <div className="text-5xl font-bold text-yellow-500 mb-2" data-testid="text-milestone-percentage">
            {percentage}%
          </div>
          <div className="text-xl font-semibold">Portfolio Growth! 🎉</div>
        </div>
        
        <div className="border-t border-yellow-500/20 pt-4">
          <div className="text-muted-foreground text-sm mb-1">Total Profit</div>
          <div className="text-3xl font-bold text-green-500" data-testid="text-milestone-profit">
            {formatCurrency(totalPnL)}
          </div>
        </div>
      </div>

      <p className="text-center text-sm text-muted-foreground">
        Keep up the great work! Your trading strategy is paying off.
      </p>
    </div>
  );
}

function StopLossAlert({ data }: any) {
  return (
    <div className="space-y-4" data-testid="alert-stoploss-content">
      <DialogHeader>
        <div className="flex items-center gap-3 mb-2">
          <div className="p-3 bg-red-500/20 rounded-lg">
            <AlertCircle className="h-8 w-8 text-red-500" />
          </div>
          <div>
            <DialogTitle className="text-2xl font-bold text-red-500">
              Stop Loss Triggered
            </DialogTitle>
            <DialogDescription className="text-lg">
              Risk Protection Activated
            </DialogDescription>
          </div>
        </div>
      </DialogHeader>

      <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
        <p className="text-base">
          A position was automatically closed to limit losses and protect your capital.
        </p>
        {data.tokenSymbol && (
          <p className="text-base mt-2">
            Token: <span className="font-bold">{data.tokenSymbol}</span>
          </p>
        )}
      </div>
    </div>
  );
}
