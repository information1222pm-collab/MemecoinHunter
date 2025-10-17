import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLanguage } from "@/hooks/use-language";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { MoreHorizontal, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useWebSocket } from "@/hooks/use-websocket";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { getCsrfToken } from "@/lib/auth-utils";
import { useEffect } from "react";
import { motion } from "framer-motion";

const languages = [
  { code: "en", flag: "🇺🇸", name: "English" },
  { code: "es", flag: "🇪🇸", name: "Español" },
  { code: "fr", flag: "🇫🇷", name: "Français" },
  { code: "de", flag: "🇩🇪", name: "Deutsch" },
  { code: "ja", flag: "🇯🇵", name: "日本語" },
  { code: "ko", flag: "🇰🇷", name: "한국어" },
];

export function Header() {
  const { language, setLanguage, t } = useLanguage();
  const { isConnected, lastMessage } = useWebSocket();
  const { user, refetch } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const currentLanguage = languages.find(lang => lang.code === language) || languages[0];
  
  // Fetch real portfolio data
  const { data: portfolio, error: portfolioError } = useQuery<{
    totalValue: string;
  }>({
    queryKey: ['/api/portfolio', 'default'],
    refetchInterval: 30000, // Refetch every 30 seconds
    staleTime: 15000, // Data stays fresh for 15 seconds
    retry: false, // Don't retry on 401 errors
  });

  // Check if user is authenticated (401 errors indicate unauthenticated)
  const hasAuthError = (error: any) => {
    if (!error) return false;
    // Check multiple possible error structures
    return (
      error?.response?.status === 401 ||
      error?.status === 401 ||
      (error?.message && error.message.includes('401')) ||
      (error?.cause?.status === 401)
    );
  };

  const isAuthenticated = !hasAuthError(portfolioError);

  // Logout mutation
  const logoutMutation = useMutation({
    mutationFn: async () => {
      const csrfToken = await getCsrfToken();
      await apiRequest("POST", "/api/auth/logout", {
        _csrf: csrfToken
      });
    },
    onSuccess: () => {
      toast({
        title: "Logged out",
        description: "You have been successfully logged out.",
      });
      // Clear all cached data
      queryClient.clear();
      // Refetch auth status
      refetch();
    },
    onError: (error: any) => {
      toast({
        title: "Logout failed",
        description: error.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleLogout = () => {
    logoutMutation.mutate();
  };

  // Demo data for unauthenticated users
  const demoPortfolioValue = "25847.32";

  const portfolioValue = isAuthenticated ? 
    (portfolio?.totalValue && parseFloat(portfolio.totalValue) > 0 ? 
      new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
      }).format(parseFloat(portfolio.totalValue)) : 
      '$10,000.00') : // Default starting balance if totalValue is missing or zero
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(parseFloat(demoPortfolioValue));

  // Real-time WebSocket data updates for header portfolio value
  useEffect(() => {
    if (!lastMessage || !isConnected) return;

    const { type, data } = lastMessage;

    switch (type) {
      case 'portfolio_update':
        // Update portfolio value in real-time
        if (data?.totalValue) {
          queryClient.setQueryData(['/api/portfolio', 'default'], (oldData: any) => 
            oldData ? { ...oldData, totalValue: data.totalValue } : { totalValue: data.totalValue }
          );
        }
        break;
      
      case 'trade_executed':
        // Invalidate portfolio data when trades are executed
        queryClient.invalidateQueries({ queryKey: ['/api/portfolio', 'default'] });
        break;
      
      case 'price_update':
        // Invalidate portfolio when prices change (affects total value)
        queryClient.invalidateQueries({ queryKey: ['/api/portfolio', 'default'] });
        break;
    }
  }, [lastMessage, isConnected, queryClient]);

  return (
    <header className="bg-card border-b border-border px-4 md:px-6 py-3 md:py-4" data-testid="header-main">
      <div className="flex items-center justify-between">
        {/* Left section - Title and status */}
        <div className="flex items-center space-x-2 md:space-x-4 flex-1 min-w-0">
          {/* Add left padding on mobile to account for menu button */}
          <div className="ml-12 md:ml-0">
            <h2 className="text-lg md:text-2xl font-semibold truncate" data-testid="text-page-title">
              {t("dashboard.title")}
            </h2>
            <div className="flex items-center space-x-2 text-xs md:text-sm text-muted-foreground">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" data-testid="indicator-live-data" />
              <span className="hidden xs:inline">{t("dashboard.liveData")}</span>
              <span className="xs:hidden">Live</span>
            </div>
          </div>
        </div>
        
        {/* Right section - Controls */}
        <div className="flex items-center space-x-2 md:space-x-4">
          {/* Portfolio Value - Desktop */}
          <div className="hidden md:block text-right">
            <p className="text-sm text-muted-foreground">{t("portfolio.totalValue")}</p>
            <p className="text-lg font-semibold price-up" data-testid="text-portfolio-value">
              {portfolioValue}
            </p>
          </div>
          
          {/* Portfolio Value - Mobile (compact) */}
          <div className="md:hidden text-right">
            <p className="text-sm font-semibold price-up" data-testid="text-portfolio-value-mobile">
              {portfolioValue}
            </p>
          </div>
          
          {/* Language Switcher - Desktop */}
          <div className="hidden md:block">
            <Select value={language} onValueChange={setLanguage} data-testid="select-language">
              <SelectTrigger className="w-36">
                <SelectValue>
                  <span className="flex items-center space-x-2">
                    <span>{currentLanguage.flag}</span>
                    <span>{currentLanguage.name}</span>
                  </span>
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {languages.map((lang) => (
                  <SelectItem key={lang.code} value={lang.code} data-testid={`option-lang-${lang.code}`}>
                    <span className="flex items-center space-x-2">
                      <span>{lang.flag}</span>
                      <span>{lang.name}</span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          {/* Mobile Menu - Language and other options */}
          <div className="md:hidden">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="w-11 h-11 p-0 min-h-[44px] min-w-[44px]" data-testid="button-mobile-menu">
                  <MoreHorizontal className="w-4 h-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-48 p-3" align="end">
                <div className="space-y-3">
                  <div>
                    <p className="text-sm font-medium mb-2">Language</p>
                    <Select value={language} onValueChange={setLanguage}>
                      <SelectTrigger className="w-full h-9">
                        <SelectValue>
                          <span className="flex items-center space-x-2 text-sm">
                            <span>{currentLanguage.flag}</span>
                            <span>{currentLanguage.name}</span>
                          </span>
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {languages.map((lang) => (
                          <SelectItem key={lang.code} value={lang.code}>
                            <span className="flex items-center space-x-2">
                              <span>{lang.flag}</span>
                              <span>{lang.name}</span>
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {user && (
                    <div className="border-t pt-3">
                      <div className="mb-2">
                        <p className="text-sm font-medium">{user.username}</p>
                        <p className="text-xs text-muted-foreground">{user.email}</p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full flex items-center justify-center space-x-2"
                        onClick={handleLogout}
                        disabled={logoutMutation.isPending}
                        data-testid="button-logout"
                      >
                        <LogOut className="w-4 h-4" />
                        <span>{logoutMutation.isPending ? "Logging out..." : "Logout"}</span>
                      </Button>
                    </div>
                  )}
                </div>
              </PopoverContent>
            </Popover>
          </div>
          
          {/* User Avatar with Popover */}
          <Popover>
            <PopoverTrigger asChild>
              <Avatar className="w-8 h-8 md:w-10 md:h-10 cursor-pointer hover:ring-2 hover:ring-primary/20 transition-all" data-testid="avatar-user">
                <AvatarFallback className="bg-primary text-primary-foreground text-sm">
                  {user ? user.username.slice(0, 2).toUpperCase() : "GU"}
                </AvatarFallback>
              </Avatar>
            </PopoverTrigger>
            <PopoverContent className="w-56 p-3" align="end">
              {user ? (
                <div className="space-y-3">
                  <div className="pb-2 border-b">
                    <p className="text-sm font-medium">{user.username}</p>
                    <p className="text-xs text-muted-foreground">{user.email}</p>
                    <p className="text-xs text-muted-foreground capitalize">{user.subscriptionTier} Plan</p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full flex items-center justify-center space-x-2 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/20"
                    onClick={handleLogout}
                    disabled={logoutMutation.isPending}
                    data-testid="button-avatar-logout"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>{logoutMutation.isPending ? "Logging out..." : "Sign Out"}</span>
                  </Button>
                </div>
              ) : (
                <div className="text-center py-2">
                  <p className="text-sm text-muted-foreground">Not signed in</p>
                </div>
              )}
            </PopoverContent>
          </Popover>
        </div>
      </div>
    </header>
  );
}
