import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLanguage } from "@/hooks/use-language";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

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

  return (
    <header className="bg-card border-b border-border px-6 py-4" data-testid="header-main">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <h2 className="text-2xl font-semibold" data-testid="text-page-title">{t("dashboard.title")}</h2>
          <div className="flex items-center space-x-2 text-sm text-muted-foreground">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" data-testid="indicator-live-data" />
            <span>{t("dashboard.liveData")}</span>
          </div>
        </div>
        
        <div className="flex items-center space-x-4">
          {/* Language Switcher */}
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
          
          {/* Portfolio Value */}
          <div className="text-right">
            <p className="text-sm text-muted-foreground">{t("portfolio.totalValue")}</p>
            <p className="text-lg font-semibold price-up" data-testid="text-portfolio-value">$12,847.32</p>
          </div>
          
          {/* User Avatar */}
          <Avatar data-testid="avatar-user">
            <AvatarFallback className="bg-primary text-primary-foreground">JD</AvatarFallback>
          </Avatar>
        </div>
      </div>
    </header>
  );
}
