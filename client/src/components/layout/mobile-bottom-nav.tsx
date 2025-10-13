import { Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Home,
  BarChart3,
  Zap,
  Briefcase,
  TrendingUp,
} from "lucide-react";

const navItems = [
  { href: "/", icon: Home, label: "Home" },
  { href: "/dashboard", icon: BarChart3, label: "Dashboard" },
  { href: "/scanner", icon: Zap, label: "Scanner" },
  { href: "/portfolio", icon: Briefcase, label: "Portfolio" },
  { href: "/analytics", icon: TrendingUp, label: "Analytics" },
];

export function MobileBottomNav() {
  const [location] = useLocation();
  const isMobile = useIsMobile();

  if (!isMobile) return null;

  return (
    <motion.nav
      className="fixed bottom-0 left-0 right-0 z-40 md:hidden"
      initial={{ y: 100 }}
      animate={{ y: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
    >
      <div className="glass-card border-t border-white/10 backdrop-blur-xl bg-background/95 pb-safe">
        <div className="flex items-center justify-around px-2 py-2">
          {navItems.map((item) => {
            const isActive = location === item.href;
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                data-testid={`link-mobile-nav-${item.label.toLowerCase()}`}
              >
                <motion.div
                  className={cn(
                    "relative flex flex-col items-center justify-center px-3 py-2 rounded-xl transition-all duration-200 touch-manipulation",
                    isActive
                      ? "text-primary"
                      : "text-muted-foreground active:scale-95"
                  )}
                  whileTap={{ scale: 0.9 }}
                  whileHover={{ scale: 1.05 }}
                >
                  {isActive && (
                    <motion.div
                      className="absolute inset-0 bg-primary/10 rounded-xl"
                      layoutId="mobile-nav-bg"
                      transition={{ type: "spring", stiffness: 300, damping: 30 }}
                    />
                  )}
                  <Icon className={cn("w-6 h-6 relative z-10", isActive && "scale-110")} />
                  <span className={cn(
                    "text-xs mt-1 relative z-10 font-medium",
                    isActive && "text-primary"
                  )}>
                    {item.label}
                  </span>
                </motion.div>
              </Link>
            );
          })}
        </div>
      </div>
    </motion.nav>
  );
}
