import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useQuery } from "@tanstack/react-query";
import { useWebSocket } from "@/hooks/use-websocket";
import { useLanguage } from "@/hooks/use-language";
import { useIsMobile } from "@/hooks/use-mobile";
import { Filter, Play, ChevronUp, ChevronDown, TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useMemo } from "react";
import { QuickTradeModal } from "./quick-trade-modal";

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
  const isMobile = useIsMobile();
  const { data: tokens, isLoading } = useQuery<Token[]>({
    queryKey: ['/api/tokens'],
    refetchInterval: 30000,
  });

  const { lastMessage } = useWebSocket();

  // Filter and sort state
  const [filters, setFilters] = useState({
    minMarketCap: 0,
    minVolume: 0,
    priceChange: 'any'
  });
  const [sort, setSort] = useState<{
    column: keyof Token | 'signal' | null;
    direction: 'asc' | 'desc';
  }>({ column: null, direction: 'asc' });
  const [showFilters, setShowFilters] = useState(false);
  
  // Trade modal state
  const [tradeModalOpen, setTradeModalOpen] = useState(false);
  const [selectedToken, setSelectedToken] = useState<Token | null>(null);

  const openTradeModal = (token: Token) => {
    setSelectedToken(token);
    setTradeModalOpen(true);
  };

  // Helper functions (must be defined before useMemo)
  const getSignal = (change: string) => {
    const changeNum = parseFloat(change);
    if (changeNum > 5) return { label: "BULLISH", variant: "success" };
    if (changeNum < -3) return { label: "BEARISH", variant: "destructive" };
    return { label: "NEUTRAL", variant: "secondary" };
  };

  const getPriceChangeClass = (change: string) => {
    const changeNum = parseFloat(change);
    return changeNum >= 0 ? "price-up" : "price-down";
  };

  // Filtered and sorted tokens
  const filteredAndSortedTokens = useMemo(() => {
    if (!tokens) return [];
    
    // Apply filters
    let filtered = tokens.filter(token => {
      const marketCap = parseFloat(token.marketCap);
      const volume = parseFloat(token.volume24h);
      const priceChange = parseFloat(token.priceChange24h);
      
      // Market cap filter
      if (filters.minMarketCap > 0 && marketCap < filters.minMarketCap) return false;
      
      // Volume filter  
      if (filters.minVolume > 0 && volume < filters.minVolume) return false;
      
      // Price change filter
      if (filters.priceChange === 'positive' && priceChange <= 0) return false;
      if (filters.priceChange === 'negative' && priceChange >= 0) return false;
      if (filters.priceChange === 'significant' && Math.abs(priceChange) < 10) return false;
      
      return true;
    });
    
    // Apply sorting
    if (sort.column) {
      filtered.sort((a, b) => {
        let aVal: any, bVal: any;
        
        switch (sort.column) {
          case 'symbol':
            aVal = a.symbol;
            bVal = b.symbol;
            break;
          case 'currentPrice':
            aVal = parseFloat(a.currentPrice);
            bVal = parseFloat(b.currentPrice);
            break;
          case 'priceChange24h':
            aVal = parseFloat(a.priceChange24h);
            bVal = parseFloat(b.priceChange24h);
            break;
          case 'volume24h':
            aVal = parseFloat(a.volume24h);
            bVal = parseFloat(b.volume24h);
            break;
          case 'marketCap':
            aVal = parseFloat(a.marketCap);
            bVal = parseFloat(b.marketCap);
            break;
          case 'signal':
            aVal = getSignal(a.priceChange24h).label;
            bVal = getSignal(b.priceChange24h).label;
            break;
          default:
            return 0;
        }
        
        if (typeof aVal === 'string') {
          const comparison = aVal.localeCompare(bVal);
          return sort.direction === 'asc' ? comparison : -comparison;
        } else {
          return sort.direction === 'asc' ? aVal - bVal : bVal - aVal;
        }
      });
    }
    
    return filtered;
  }, [tokens, filters, sort]);
  
  const handleSort = (column: keyof Token | 'signal') => {
    setSort(prev => ({
      column,
      direction: prev.column === column && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };
  
  const getSortIcon = (column: keyof Token | 'signal') => {
    if (sort.column !== column) return null;
    return sort.direction === 'asc' ? <ChevronUp className="w-4 h-4 ml-1" /> : <ChevronDown className="w-4 h-4 ml-1" />;
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
            <Button 
              variant="secondary" 
              size="sm" 
              data-testid="button-filters"
              onClick={() => setShowFilters(!showFilters)}
            >
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
      
      {showFilters && (
        <div className="border-b border-border p-4 bg-secondary/20">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium">Min Market Cap</label>
              <select 
                className="w-full mt-1 bg-secondary border border-border rounded-md px-3 py-2 text-sm" 
                data-testid="select-min-market-cap"
                value={filters.minMarketCap}
                onChange={(e) => setFilters(prev => ({ ...prev, minMarketCap: parseInt(e.target.value) }))}
              >
                <option value="0">No minimum</option>
                <option value="100000">$100K+</option>
                <option value="1000000">$1M+</option>
                <option value="10000000">$10M+</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium">Min Volume (24h)</label>
              <select 
                className="w-full mt-1 bg-secondary border border-border rounded-md px-3 py-2 text-sm" 
                data-testid="select-min-volume"
                value={filters.minVolume}
                onChange={(e) => setFilters(prev => ({ ...prev, minVolume: parseInt(e.target.value) }))}
              >
                <option value="0">No minimum</option>
                <option value="10000">$10K+</option>
                <option value="100000">$100K+</option>
                <option value="1000000">$1M+</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium">Price Change</label>
              <select 
                className="w-full mt-1 bg-secondary border border-border rounded-md px-3 py-2 text-sm" 
                data-testid="select-price-change"
                value={filters.priceChange}
                onChange={(e) => setFilters(prev => ({ ...prev, priceChange: e.target.value }))}
              >
                <option value="any">Any</option>
                <option value="positive">Positive only</option>
                <option value="negative">Negative only</option>
                <option value="significant">Significant (±10%)</option>
              </select>
            </div>
          </div>
        </div>
      )}
      
      <CardContent className="p-0">
        {isMobile ? (
          <div>
            {/* Mobile Sort Controls */}
            <div className="p-4 border-b border-border bg-secondary/30">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm text-muted-foreground">Sort by:</span>
                <select 
                  className="flex-1 bg-secondary border border-border rounded-md px-3 text-sm touch-manipulation min-h-[44px]"
                  value={sort.column || 'symbol'}
                  onChange={(e) => handleSort(e.target.value as any)}
                  data-testid="select-mobile-sort"
                >
                  <option value="symbol">Token</option>
                  <option value="currentPrice">Price</option>
                  <option value="priceChange24h">24h Change</option>
                  <option value="volume24h">Volume</option>
                  <option value="marketCap">Market Cap</option>
                </select>
                <button
                  onClick={() => setSort(prev => ({ ...prev, direction: prev.direction === 'asc' ? 'desc' : 'asc' }))}
                  className="rounded-md bg-secondary border border-border touch-manipulation min-h-[44px] min-w-[44px] flex items-center justify-center"
                  data-testid="button-mobile-sort-direction"
                  aria-label={sort.direction === 'asc' ? 'Sort descending' : 'Sort ascending'}
                >
                  {sort.direction === 'asc' ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                </button>
              </div>
            </div>
            
            <div className="divide-y divide-border">
            {filteredAndSortedTokens?.map((token) => {
              const signal = getSignal(token.priceChange24h);
              const priceChangeClass = getPriceChangeClass(token.priceChange24h);
              const changeNum = parseFloat(token.priceChange24h);
              
              return (
                <div
                  key={token.id}
                  className="p-4 hover:bg-secondary/20 transition-colors"
                  data-testid={`row-token-${token.symbol}`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-orange-400 to-red-500 rounded-full flex-shrink-0" />
                      <div>
                        <div className="font-semibold text-base" data-testid={`text-symbol-${token.symbol}`}>{token.symbol}</div>
                        <div className="text-sm text-muted-foreground" data-testid={`text-name-${token.symbol}`}>{token.name}</div>
                      </div>
                    </div>
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
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">{t("scanner.price")}</div>
                      <div className="font-mono text-base" data-testid={`text-price-${token.symbol}`}>
                        ${parseFloat(token.currentPrice).toFixed(6)}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">{t("scanner.change24h")}</div>
                      <div className={cn("font-semibold text-base flex items-center", priceChangeClass)} data-testid={`text-change-${token.symbol}`}>
                        {changeNum >= 0 ? <TrendingUp className="w-4 h-4 mr-1" /> : <TrendingDown className="w-4 h-4 mr-1" />}
                        {changeNum >= 0 ? '+' : ''}{changeNum.toFixed(1)}%
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">{t("scanner.volume")}</div>
                      <div className="font-mono text-sm" data-testid={`text-volume-${token.symbol}`}>
                        ${(parseFloat(token.volume24h) / 1000000).toFixed(1)}M
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">{t("scanner.marketCap")}</div>
                      <div className="font-mono text-sm" data-testid={`text-marketcap-${token.symbol}`}>
                        ${(parseFloat(token.marketCap) / 1000000).toFixed(1)}M
                      </div>
                    </div>
                  </div>
                  
                  <Button 
                    size="sm"
                    className="w-full"
                    data-testid={`button-trade-${token.symbol}`}
                    onClick={() => openTradeModal(token)}
                  >
                    {t("scanner.trade")}
                  </Button>
                </div>
              );
            })}
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-secondary/50">
                <tr>
                  <th 
                    className="text-left p-4 text-sm font-medium text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
                    onClick={() => handleSort('symbol')}
                  >
                    <div className="flex items-center">
                      {t("scanner.token")}
                      {getSortIcon('symbol')}
                    </div>
                  </th>
                  <th 
                    className="text-left p-4 text-sm font-medium text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
                    onClick={() => handleSort('currentPrice')}
                  >
                    <div className="flex items-center">
                      {t("scanner.price")}
                      {getSortIcon('currentPrice')}
                    </div>
                  </th>
                  <th 
                    className="text-left p-4 text-sm font-medium text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
                    onClick={() => handleSort('priceChange24h')}
                  >
                    <div className="flex items-center">
                      {t("scanner.change24h")}
                      {getSortIcon('priceChange24h')}
                    </div>
                  </th>
                  <th 
                    className="text-left p-4 text-sm font-medium text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
                    onClick={() => handleSort('volume24h')}
                  >
                    <div className="flex items-center">
                      {t("scanner.volume")}
                      {getSortIcon('volume24h')}
                    </div>
                  </th>
                  <th 
                    className="text-left p-4 text-sm font-medium text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
                    onClick={() => handleSort('marketCap')}
                  >
                    <div className="flex items-center">
                      {t("scanner.marketCap")}
                      {getSortIcon('marketCap')}
                    </div>
                  </th>
                  <th 
                    className="text-left p-4 text-sm font-medium text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
                    onClick={() => handleSort('signal')}
                  >
                    <div className="flex items-center">
                      {t("scanner.signal")}
                      {getSortIcon('signal')}
                    </div>
                  </th>
                  <th className="text-left p-4 text-sm font-medium text-muted-foreground">{t("scanner.action")}</th>
                </tr>
              </thead>
              <tbody>
                {filteredAndSortedTokens?.map((token) => {
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
                        <Button 
                          size="sm" 
                          data-testid={`button-trade-${token.symbol}`}
                          onClick={() => openTradeModal(token)}
                        >
                          {t("scanner.trade")}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
      
      {/* Trade Modal */}
      <Dialog open={tradeModalOpen} onOpenChange={setTradeModalOpen}>
        <DialogContent className="max-w-md" data-testid="modal-trade">
          <DialogHeader>
            <DialogTitle>
              Trade {selectedToken?.symbol}
            </DialogTitle>
          </DialogHeader>
          <QuickTradeModal 
            selectedToken={selectedToken} 
            onClose={() => setTradeModalOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </Card>
  );
}
