import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLanguage } from "@/hooks/use-language";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";

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

  const currentLanguage = languages.find(lang => lang.code === language) || languages[0];
  
  // Fetch real portfolio data
  const { data: portfolio, error: portfolioError } = useQuery<{
    totalValue: string;
  }>({
    queryKey: ['/api/portfolio', 'default'],
    refetchInterval: 30000,
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

  // Demo data for unauthenticated users
  const demoPortfolioValue = "25847.32";

  const portfolioValue = isAuthenticated ? 
    (portfolio?.totalValue ? 
      new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
      }).format(parseFloat(portfolio.totalValue)) : 
      '$0.00') :
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(parseFloat(demoPortfolioValue));

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
                </div>
              </PopoverContent>
            </Popover>
          </div>
          
          {/* User Avatar */}
          <Avatar className="w-8 h-8 md:w-10 md:h-10" data-testid="avatar-user">
            <AvatarFallback className="bg-primary text-primary-foreground text-sm">JD</AvatarFallback>
          </Avatar>
        </div>
      </div>
    </header>
  );
}
