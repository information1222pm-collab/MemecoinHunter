import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/hooks/use-language";
import { motion } from "framer-motion";
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
  Home,
  Sparkles,
} from "lucide-react";

const navigationItems = [
  { href: "/", icon: Home, labelKey: "navigation.home" },
  { href: "/dashboard", icon: BarChart3, labelKey: "navigation.dashboard" },
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

  const containerVariants = {
    hidden: { x: -100, opacity: 0 },
    visible: {
      x: 0,
      opacity: 1,
      transition: {
        type: "spring",
        stiffness: 100,
        damping: 15,
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { x: -20, opacity: 0 },
    visible: {
      x: 0,
      opacity: 1,
      transition: {
        type: "spring",
        stiffness: 100,
        damping: 10
      }
    }
  };

  return (
    <motion.aside 
      className="w-64 glass-card border-r border-white/10 flex-shrink-0 backdrop-blur-xl" 
      data-testid="sidebar-main"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Logo Section */}
      <motion.div className="p-6" variants={itemVariants}>
        <motion.div 
          className="flex items-center space-x-3" 
          data-testid="sidebar-logo"
          whileHover={{ scale: 1.05 }}
          transition={{ type: "spring", stiffness: 400, damping: 10 }}
        >
          <motion.div 
            className="w-12 h-12 rounded-2xl bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center relative overflow-hidden"
            animate={{ 
              boxShadow: [
                "0 0 20px hsla(262, 73%, 65%, 0.3)",
                "0 0 30px hsla(262, 73%, 65%, 0.5)",
                "0 0 20px hsla(262, 73%, 65%, 0.3)"
              ]
            }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <Users className="w-7 h-7 text-white relative z-10" />
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-pink-500 to-purple-500 opacity-50"
              animate={{ rotate: [0, 360] }}
              transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
            />
          </motion.div>
          <div>
            <h1 className="text-xl font-bold gradient-text">MemeCoin Hunter</h1>
            <p className="text-xs text-muted-foreground">v2.1.0 • Live</p>
          </div>
        </motion.div>
      </motion.div>

      {/* Navigation */}
      <nav className="px-4 pb-4">
        <motion.div className="space-y-2" variants={containerVariants}>
          {navigationItems.map((item, index) => {
            const isActive = location === item.href;
            return (
              <motion.div key={item.href} variants={itemVariants}>
                <Link
                  href={item.href}
                  data-testid={`link-nav-${item.href.slice(1) || 'home'}`}
                >
                  <motion.div
                    className={cn(
                      "flex items-center space-x-3 px-4 py-3 rounded-2xl transition-all duration-300 relative overflow-hidden group",
                      isActive
                        ? "glass-card text-white"
                        : "text-muted-foreground hover:text-white hover:glass-card"
                    )}
                    whileHover={{ 
                      scale: 1.02,
                      x: 4
                    }}
                    whileTap={{ scale: 0.98 }}
                  >
                    {/* Active indicator */}
                    {isActive && (
                      <motion.div
                        className="absolute inset-0 bg-gradient-to-r from-purple-500/20 to-pink-500/20 rounded-2xl"
                        layoutId="activeTab"
                        transition={{ type: "spring", stiffness: 500, damping: 30 }}
                      />
                    )}
                    
                    {/* Hover effect */}
                    <motion.div
                      className="absolute inset-0 bg-gradient-to-r from-purple-500/10 to-pink-500/10 rounded-2xl opacity-0 group-hover:opacity-100"
                      transition={{ duration: 0.3 }}
                    />

                    <motion.div
                      className={cn(
                        "w-6 h-6 relative z-10",
                        isActive && "text-purple-400"
                      )}
                      animate={isActive ? { scale: [1, 1.1, 1] } : {}}
                      transition={{ duration: 2, repeat: Infinity }}
                    >
                      <item.icon className="w-full h-full" />
                    </motion.div>
                    
                    <span className="relative z-10 font-medium">{t(item.labelKey)}</span>
                    
                    {item.hasIndicator && (
                      <motion.div 
                        className="ml-auto w-2 h-2 bg-green-400 rounded-full relative z-10"
                        animate={{ 
                          scale: [1, 1.2, 1],
                          opacity: [1, 0.7, 1]
                        }}
                        transition={{ duration: 2, repeat: Infinity }}
                        data-testid="indicator-live" 
                      />
                    )}
                    
                    {isActive && (
                      <motion.div
                        className="absolute right-0 top-1/2 w-1 h-8 bg-gradient-to-b from-purple-400 to-pink-400 rounded-l-full"
                        initial={{ scaleY: 0 }}
                        animate={{ scaleY: 1 }}
                        transition={{ type: "spring", stiffness: 500, damping: 30 }}
                      />
                    )}
                  </motion.div>
                </Link>
              </motion.div>
            );
          })}
        </motion.div>

        {/* Subscription Section */}
        <motion.div 
          className="mt-8 pt-6 border-t border-white/10"
          variants={containerVariants}
        >
          <motion.div className="px-4 py-2 mb-3" variants={itemVariants}>
            <div className="flex items-center space-x-2">
              <Sparkles className="w-4 h-4 text-purple-400" />
              <p className="text-xs font-medium text-purple-400 uppercase tracking-wide">
                {t("navigation.subscription")}
              </p>
            </div>
          </motion.div>
          
          {subscriptionItems.map((item, index) => (
            <motion.div key={item.href} variants={itemVariants}>
              <Link href={item.href} data-testid={`link-sub-${item.href.slice(1)}`}>
                <motion.div 
                  className="flex items-center space-x-3 px-4 py-3 rounded-2xl text-muted-foreground hover:text-white hover:glass-card transition-all duration-300 group relative overflow-hidden"
                  whileHover={{ 
                    scale: 1.02,
                    x: 4
                  }}
                  whileTap={{ scale: 0.98 }}
                >
                  {/* Hover effect */}
                  <motion.div
                    className="absolute inset-0 bg-gradient-to-r from-purple-500/10 to-pink-500/10 rounded-2xl opacity-0 group-hover:opacity-100"
                    transition={{ duration: 0.3 }}
                  />
                  
                  <item.icon className="w-5 h-5 relative z-10" />
                  <span className="relative z-10 font-medium">{t(item.labelKey)}</span>
                  {item.badge && (
                    <motion.span 
                      className="ml-auto px-2 py-1 text-xs bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-full font-medium relative z-10"
                      data-testid="badge-pro"
                      animate={{ 
                        boxShadow: [
                          "0 0 10px hsla(262, 73%, 65%, 0.3)",
                          "0 0 20px hsla(262, 73%, 65%, 0.5)",
                          "0 0 10px hsla(262, 73%, 65%, 0.3)"
                        ]
                      }}
                      transition={{ duration: 3, repeat: Infinity }}
                    >
                      {item.badge}
                    </motion.span>
                  )}
                </motion.div>
              </Link>
            </motion.div>
          ))}
        </motion.div>

        {/* Settings Section */}
        <motion.div 
          className="mt-6 pt-6 border-t border-white/10"
          variants={itemVariants}
        >
          <Link href="/settings" data-testid="link-settings">
            <motion.div 
              className="flex items-center space-x-3 px-4 py-3 rounded-2xl text-muted-foreground hover:text-white hover:glass-card transition-all duration-300 group relative overflow-hidden"
              whileHover={{ 
                scale: 1.02,
                x: 4
              }}
              whileTap={{ scale: 0.98 }}
            >
              {/* Hover effect */}
              <motion.div
                className="absolute inset-0 bg-gradient-to-r from-purple-500/10 to-pink-500/10 rounded-2xl opacity-0 group-hover:opacity-100"
                transition={{ duration: 0.3 }}
              />
              
              <Settings className="w-5 h-5 relative z-10" />
              <span className="relative z-10 font-medium">{t("navigation.settings")}</span>
            </motion.div>
          </Link>
        </motion.div>
      </nav>
    </motion.aside>
  );
}