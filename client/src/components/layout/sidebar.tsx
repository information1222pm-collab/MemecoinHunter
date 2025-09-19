import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/hooks/use-language";
import {
  BarChart3,
  Zap,
  Briefcase,
  TrendingUp,
  Terminal,
  Activity,
  Star,
  CreditCard,
  Settings,
  Users,
} from "lucide-react";

const navigationItems = [
  { href: "/", icon: BarChart3, labelKey: "navigation.dashboard" },
  { href: "/scanner", icon: Zap, labelKey: "navigation.scanner", hasIndicator: true },
  { href: "/portfolio", icon: Briefcase, labelKey: "navigation.portfolio" },
  { href: "/analytics", icon: TrendingUp, labelKey: "navigation.analytics" },
  { href: "/activity", icon: Activity, labelKey: "navigation.activity", hasIndicator: true },
  { href: "/terminal", icon: Terminal, labelKey: "navigation.terminal" },
];

const subscriptionItems = [
  { href: "/subscription", icon: Star, labelKey: "navigation.premium", badge: "PRO" },
  { href: "/billing", icon: CreditCard, labelKey: "navigation.billing" },
];

export function Sidebar() {
  const [location] = useLocation();
  const { t } = useLanguage();

  return (
    <aside className="w-64 bg-sidebar border-r border-sidebar-border flex-shrink-0" data-testid="sidebar-main">
      <div className="p-6">
        <div className="flex items-center space-x-3" data-testid="sidebar-logo">
          <div className="w-10 h-10 rounded-lg bg-sidebar-primary flex items-center justify-center">
            <Users className="w-6 h-6 text-sidebar-primary-foreground" />
          </div>
          <div>
            <h1 className="text-xl font-bold">CryptoHobby</h1>
            <p className="text-xs text-muted-foreground">v2.1.0</p>
          </div>
        </div>
      </div>

      <nav className="px-4 pb-4">
        <div className="space-y-2">
          {navigationItems.map((item) => {
            const isActive = location === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                data-testid={`link-nav-${item.href.slice(1) || 'dashboard'}`}
              >
                <div
                  className={cn(
                    "flex items-center space-x-3 px-3 py-2 rounded-md transition-colors",
                    isActive
                      ? "bg-sidebar-primary/10 text-sidebar-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/50"
                  )}
                >
                  <item.icon className="w-5 h-5" />
                  <span>{t(item.labelKey)}</span>
                  {item.hasIndicator && (
                    <div className="ml-auto w-2 h-2 bg-green-400 rounded-full animate-pulse" data-testid="indicator-live" />
                  )}
                </div>
              </Link>
            );
          })}
        </div>

        <div className="mt-8 pt-4 border-t border-sidebar-border">
          <div className="px-3 py-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              {t("navigation.subscription")}
            </p>
          </div>
          {subscriptionItems.map((item) => (
            <Link key={item.href} href={item.href} data-testid={`link-sub-${item.href.slice(1)}`}>
              <div className="flex items-center space-x-3 px-3 py-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/50 transition-colors">
                <item.icon className="w-5 h-5" />
                <span>{t(item.labelKey)}</span>
                {item.badge && (
                  <span className="ml-auto px-2 py-1 text-xs bg-accent text-accent-foreground rounded-full" data-testid="badge-pro">
                    {item.badge}
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>

        <div className="mt-6 pt-4 border-t border-sidebar-border">
          <Link href="/settings" data-testid="link-settings">
            <div className="flex items-center space-x-3 px-3 py-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/50 transition-colors">
              <Settings className="w-5 h-5" />
              <span>{t("navigation.settings")}</span>
            </div>
          </Link>
        </div>
      </nav>
    </aside>
  );
}
