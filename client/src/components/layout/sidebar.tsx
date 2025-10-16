import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/hooks/use-language";
import { motion, AnimatePresence } from "framer-motion";
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
  Menu,
  ChevronLeft,
  X,
  BookOpen,
  Shield,
  Bell,
  Trophy,
} from "lucide-react";

const navigationItems = [
  { href: "/", icon: Home, labelKey: "navigation.home" },
  { href: "/dashboard", icon: BarChart3, labelKey: "navigation.dashboard" },
  { href: "/scanner", icon: Zap, labelKey: "navigation.scanner", hasIndicator: true },
  { href: "/portfolio", icon: Briefcase, labelKey: "navigation.portfolio" },
  { href: "/analytics", icon: TrendingUp, labelKey: "navigation.analytics" },
  { href: "/activity", icon: Activity, labelKey: "navigation.activity", hasIndicator: true },
  { href: "/journal", icon: BookOpen, labelKey: "navigation.journal" },
  { href: "/trophy-room", icon: Trophy, labelKey: "navigation.trophyRoom" },
  { href: "/risk", icon: Shield, labelKey: "navigation.risk" },
  { href: "/alerts", icon: Bell, labelKey: "navigation.alerts" },
  { href: "/terminal", icon: Terminal, labelKey: "navigation.terminal" },
];

const subscriptionItems = [
  { href: "/subscription", icon: Star, labelKey: "navigation.premium", badge: "PRO" },
  { href: "/billing", icon: CreditCard, labelKey: "navigation.billing" },
];

// Icon-specific animation variants
const iconAnimations = {
  Zap: {
    hover: { rotate: [0, -10, 10, -10, 0], transition: { duration: 0.5 } },
    active: { 
      scale: [1, 1.2, 1],
      rotate: [0, 5, -5, 0],
      transition: { duration: 2, repeat: Infinity }
    }
  },
  TrendingUp: {
    hover: { y: [-2, 2, -2], transition: { duration: 0.6, repeat: 3 } },
    active: { 
      y: [0, -3, 0],
      transition: { duration: 1.5, repeat: Infinity }
    }
  },
  Activity: {
    hover: { scale: [1, 1.1, 1], transition: { duration: 0.4, repeat: 2 } },
    active: {
      scale: [1, 1.15, 1],
      transition: { duration: 1, repeat: Infinity }
    }
  },
  Bell: {
    hover: { rotate: [0, -20, 20, -20, 20, 0], transition: { duration: 0.6 } },
    active: {
      rotate: [0, 10, -10, 0],
      transition: { duration: 2, repeat: Infinity }
    }
  },
  Settings: {
    hover: { rotate: 180, transition: { duration: 0.5 } },
    active: { rotate: 360, transition: { duration: 20, repeat: Infinity, ease: "linear" } }
  },
  Star: {
    hover: { 
      scale: 1.2,
      rotate: [0, -15, 15, -15, 15, 0],
      transition: { duration: 0.6 }
    },
    active: {
      scale: [1, 1.1, 1],
      rotate: [0, 5, -5, 0],
      transition: { duration: 2, repeat: Infinity }
    }
  },
  Shield: {
    hover: { scale: [1, 1.1, 0.95, 1.05, 1], transition: { duration: 0.5 } },
    active: {
      scale: [1, 1.05, 1],
      transition: { duration: 1.5, repeat: Infinity }
    }
  },
  Sparkles: {
    active: {
      rotate: [0, 10, -10, 0],
      scale: [1, 1.1, 1],
      transition: { duration: 2, repeat: Infinity }
    }
  }
};

export function Sidebar() {
  const [location] = useLocation();
  const { t } = useLanguage();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isPortrait, setIsPortrait] = useState(false);
  const [hoveredIcon, setHoveredIcon] = useState<string | null>(null);
  const [isHovering, setIsHovering] = useState(false);
  const [autoCollapse, setAutoCollapse] = useState(true);

  // Check if mobile and portrait mode on mount and window resize
  useEffect(() => {
    const checkMobileAndOrientation = () => {
      const mobile = window.innerWidth < 768;
      const portrait = window.innerHeight > window.innerWidth;
      
      setIsMobile(mobile);
      setIsPortrait(portrait);
      
      // Auto-collapse on portrait mode
      if (portrait && !mobile) {
        setIsCollapsed(true);
      } else if (mobile) {
        setIsCollapsed(false);
      }
    };
    
    checkMobileAndOrientation();
    window.addEventListener('resize', checkMobileAndOrientation);
    window.addEventListener('orientationchange', checkMobileAndOrientation);
    
    return () => {
      window.removeEventListener('resize', checkMobileAndOrientation);
      window.removeEventListener('orientationchange', checkMobileAndOrientation);
    };
  }, []);

  // Load collapsed state and auto-collapse preference from localStorage on mount (desktop only)
  useEffect(() => {
    if (!isMobile) {
      const savedState = localStorage.getItem('sidebar-collapsed');
      const savedAutoCollapse = localStorage.getItem('sidebar-auto-collapse');
      if (savedState) {
        setIsCollapsed(JSON.parse(savedState));
      }
      if (savedAutoCollapse) {
        setAutoCollapse(JSON.parse(savedAutoCollapse));
      }
    }
  }, [isMobile]);

  // Save collapsed state to localStorage when it changes (desktop only)
  useEffect(() => {
    if (!isMobile) {
      localStorage.setItem('sidebar-collapsed', JSON.stringify(isCollapsed));
    }
  }, [isCollapsed, isMobile]);

  // Auto-collapse when mouse leaves (with delay)
  useEffect(() => {
    if (!isMobile && autoCollapse && !isHovering && !isCollapsed) {
      const timer = setTimeout(() => {
        setIsCollapsed(true);
      }, 2000); // 2 second delay before auto-collapse
      
      return () => clearTimeout(timer);
    }
  }, [isHovering, isMobile, autoCollapse, isCollapsed]);

  const toggleSidebar = () => {
    if (isMobile) {
      setIsMobileOpen(!isMobileOpen);
    } else {
      setIsCollapsed(!isCollapsed);
      // When manually collapsing, disable auto-collapse
      // When manually expanding, re-enable auto-collapse
      if (!isCollapsed) {
        // User is manually collapsing
        setAutoCollapse(false);
        localStorage.setItem('sidebar-auto-collapse', JSON.stringify(false));
      } else {
        // User is manually expanding
        setAutoCollapse(true);
        localStorage.setItem('sidebar-auto-collapse', JSON.stringify(true));
      }
    }
  };

  const closeMobileSidebar = () => {
    if (isMobile) {
      setIsMobileOpen(false);
    }
  };

  const handleMouseEnter = () => {
    if (!isMobile && autoCollapse) {
      setIsHovering(true);
      // Auto-expand on hover if collapsed and auto-collapse is enabled
      if (isCollapsed) {
        setIsCollapsed(false);
      }
    }
  };

  const handleMouseLeave = () => {
    if (!isMobile && autoCollapse) {
      setIsHovering(false);
    }
  };

  const containerVariants = {
    hidden: { x: -100, opacity: 0 },
    visible: {
      x: 0,
      opacity: 1,
      transition: {
        type: "spring",
        stiffness: 100,
        damping: 15,
        staggerChildren: 0.05,
        delayChildren: 0.1
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
        stiffness: 150,
        damping: 12
      }
    }
  };

  const getIconAnimation = (iconName: string, isActive: boolean, isHovered: boolean) => {
    const animation = iconAnimations[iconName as keyof typeof iconAnimations];
    if (!animation) return {};
    
    if (isHovered && 'hover' in animation) return animation.hover;
    if (isActive && 'active' in animation) return animation.active;
    return {};
  };

  // Mobile overlay backdrop
  const mobileOverlay = isMobile && isMobileOpen && (
    <motion.div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 md:hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={closeMobileSidebar}
      data-testid="mobile-sidebar-overlay"
    />
  );

  return (
    <>
      {/* Mobile Menu Button - Only visible on mobile */}
      {isMobile && (
        <motion.button
          onClick={toggleSidebar}
          className="fixed top-4 left-4 z-50 md:hidden w-10 h-10 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-500 text-white flex items-center justify-center shadow-lg"
          data-testid="button-mobile-menu"
          whileHover={{ scale: 1.1, rotate: 90 }}
          whileTap={{ scale: 0.9 }}
          animate={{
            boxShadow: [
              "0 0 20px hsla(262, 73%, 65%, 0.4)",
              "0 0 30px hsla(262, 73%, 65%, 0.6)",
              "0 0 20px hsla(262, 73%, 65%, 0.4)"
            ]
          }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <motion.div
            animate={{ rotate: isMobileOpen ? 90 : 0 }}
            transition={{ duration: 0.3 }}
          >
            <Menu className="w-5 h-5" />
          </motion.div>
        </motion.button>
      )}

      {mobileOverlay}

      <motion.aside 
        className={cn(
          "glass-card border-r border-white/10 backdrop-blur-xl transition-all duration-300 z-50",
          !isMobile && "flex-shrink-0",
          !isMobile && (isCollapsed ? "w-20" : "w-64"),
          isMobile && "fixed top-0 left-0 h-full w-64",
          isMobile && (isMobileOpen ? "translate-x-0" : "-translate-x-full")
        )}
        data-testid="sidebar-main"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        style={{
          transform: isMobile 
            ? (isMobileOpen ? 'translateX(0)' : 'translateX(-100%)')
            : undefined
        }}
      >
      {/* Logo Section */}
      <motion.div className={cn("p-6 relative", isCollapsed && "px-4")} variants={itemVariants}>
        <motion.div 
          className={cn(
            "flex items-center", 
            isCollapsed ? "justify-center" : "space-x-3"
          )}
          data-testid="sidebar-logo"
          whileHover={{ scale: 1.05 }}
          transition={{ type: "spring", stiffness: 400, damping: 10 }}
        >
          <motion.div 
            className="w-12 h-12 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-500 flex items-center justify-center relative overflow-hidden"
            animate={{ 
              boxShadow: [
                "0 0 20px hsla(180, 73%, 65%, 0.3)",
                "0 0 30px hsla(180, 73%, 65%, 0.5)",
                "0 0 20px hsla(180, 73%, 65%, 0.3)"
              ]
            }}
            transition={{ duration: 2, repeat: Infinity }}
            whileHover={{ 
              scale: 1.1,
              boxShadow: "0 0 40px hsla(180, 73%, 65%, 0.7)"
            }}
          >
            <motion.div
              animate={{ 
                rotate: 360,
                scale: [1, 1.1, 1]
              }}
              transition={{ 
                rotate: { duration: 20, repeat: Infinity, ease: "linear" },
                scale: { duration: 3, repeat: Infinity }
              }}
            >
              <Users className="w-7 h-7 text-white relative z-10" />
            </motion.div>
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-blue-500 to-cyan-500 opacity-50"
              animate={{ rotate: [0, 360] }}
              transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
            />
          </motion.div>
          <AnimatePresence>
            {!isCollapsed && (
              <motion.div
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: "auto" }}
                exit={{ opacity: 0, width: 0 }}
                transition={{ duration: 0.2 }}
              >
                <motion.h1 
                  className="text-xl font-bold gradient-text whitespace-nowrap"
                  animate={{ 
                    backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"]
                  }}
                  transition={{ duration: 5, repeat: Infinity }}
                >
                  MemeCoin Hunter
                </motion.h1>
                <p className="text-xs text-muted-foreground">v2.1.0 • Live</p>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
        
        {/* Toggle Button - Desktop collapse or Mobile close */}
        <motion.button
          onClick={toggleSidebar}
          className={cn(
            "absolute top-6 w-6 h-6 rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 text-white flex items-center justify-center shadow-lg transition-all duration-300 hover:scale-110 z-10 border-2 border-background",
            isMobile ? "right-4" : "-right-3"
          )}
          data-testid="button-sidebar-toggle"
          whileHover={{ 
            scale: 1.2,
            boxShadow: "0 0 20px hsla(180, 73%, 65%, 0.6)"
          }}
          whileTap={{ scale: 0.9 }}
          animate={{
            boxShadow: [
              "0 4px 6px rgba(0,0,0,0.1)",
              "0 6px 12px rgba(6, 182, 212, 0.3)",
              "0 4px 6px rgba(0,0,0,0.1)"
            ]
          }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          {isMobile ? (
            <motion.div
              animate={{ rotate: isMobileOpen ? 180 : 0 }}
              transition={{ duration: 0.3 }}
            >
              <X className="w-3 h-3" />
            </motion.div>
          ) : (
            <motion.div
              animate={{ rotate: isCollapsed ? 0 : 180 }}
              transition={{ duration: 0.3, type: "spring", stiffness: 200 }}
            >
              <ChevronLeft className="w-3 h-3" />
            </motion.div>
          )}
        </motion.button>
      </motion.div>

      {/* Navigation */}
      <nav className="px-4 pb-4">
        <motion.div className="space-y-2" variants={containerVariants}>
          {navigationItems.map((item, index) => {
            const isActive = location === item.href;
            const iconName = item.icon.name;
            const isHovered = hoveredIcon === item.href;
            
            return (
              <motion.div key={item.href} variants={itemVariants}>
                <Link
                  href={item.href}
                  data-testid={`link-nav-${item.href.slice(1) || 'home'}`}
                  onClick={closeMobileSidebar}
                >
                  <motion.div
                    className={cn(
                      "flex items-center space-x-3 px-4 py-3 rounded-2xl transition-all duration-300 relative overflow-hidden group",
                      isMobile && "py-4 min-h-[48px]",
                      isActive
                        ? "glass-card text-white"
                        : "text-muted-foreground hover:text-white hover:glass-card"
                    )}
                    onHoverStart={() => setHoveredIcon(item.href)}
                    onHoverEnd={() => setHoveredIcon(null)}
                    whileHover={{ 
                      scale: 1.02,
                      x: 6,
                      transition: { type: "spring", stiffness: 400, damping: 20 }
                    }}
                    whileTap={{ scale: 0.98 }}
                  >
                    {/* Active indicator with gradient */}
                    {isActive && (
                      <motion.div
                        className="absolute inset-0 bg-gradient-to-r from-cyan-500/20 to-blue-500/20 rounded-2xl"
                        layoutId="activeTab"
                        transition={{ type: "spring", stiffness: 500, damping: 30 }}
                      />
                    )}
                    
                    {/* Hover effect with shimmer */}
                    <motion.div
                      className="absolute inset-0 bg-gradient-to-r from-cyan-500/10 to-blue-500/10 rounded-2xl opacity-0 group-hover:opacity-100"
                      transition={{ duration: 0.3 }}
                    >
                      <motion.div
                        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent"
                        animate={isHovered ? {
                          x: ["-100%", "100%"]
                        } : {}}
                        transition={{
                          duration: 1.5,
                          repeat: Infinity,
                          repeatDelay: 1
                        }}
                      />
                    </motion.div>

                    <motion.div
                      className={cn(
                        "w-6 h-6 relative z-10",
                        isActive && "text-purple-400"
                      )}
                      animate={getIconAnimation(iconName, isActive, isHovered)}
                    >
                      <item.icon className="w-full h-full" />
                    </motion.div>
                    
                    <AnimatePresence>
                      {(!isCollapsed || isMobile) && (
                        <motion.span 
                          className="relative z-10 font-medium"
                          initial={{ opacity: 0, width: 0 }}
                          animate={{ opacity: 1, width: "auto" }}
                          exit={{ opacity: 0, width: 0 }}
                          transition={{ duration: 0.2 }}
                        >
                          {t(item.labelKey)}
                        </motion.span>
                      )}
                    </AnimatePresence>
                    
                    {item.hasIndicator && (
                      <motion.div 
                        className="ml-auto w-2 h-2 bg-green-400 rounded-full relative z-10"
                        animate={{ 
                          scale: [1, 1.3, 1],
                          opacity: [1, 0.6, 1],
                          boxShadow: [
                            "0 0 0px rgba(34, 197, 94, 0)",
                            "0 0 8px rgba(34, 197, 94, 0.8)",
                            "0 0 0px rgba(34, 197, 94, 0)"
                          ]
                        }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                        data-testid="indicator-live" 
                      />
                    )}
                    
                    {isActive && (
                      <motion.div
                        className="absolute right-0 top-1/2 w-1 h-8 bg-gradient-to-b from-purple-400 to-pink-400 rounded-l-full"
                        initial={{ scaleY: 0, opacity: 0 }}
                        animate={{ scaleY: 1, opacity: 1 }}
                        exit={{ scaleY: 0, opacity: 0 }}
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
              <motion.div
                animate={{
                  rotate: [0, 10, -10, 0],
                  scale: [1, 1.1, 1]
                }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                <Sparkles className="w-4 h-4 text-purple-400" />
              </motion.div>
              <p className="text-xs font-medium text-purple-400 uppercase tracking-wide">
                {t("navigation.subscription")}
              </p>
            </div>
          </motion.div>
          
          {subscriptionItems.map((item, index) => {
            const iconName = item.icon.name;
            const isHovered = hoveredIcon === item.href;
            
            return (
              <motion.div key={item.href} variants={itemVariants}>
                <Link href={item.href} data-testid={`link-sub-${item.href.slice(1)}`} onClick={closeMobileSidebar}>
                  <motion.div 
                    className={cn(
                      "flex items-center space-x-3 px-4 py-3 rounded-2xl text-muted-foreground hover:text-white hover:glass-card transition-all duration-300 group relative overflow-hidden",
                      isMobile && "py-4 min-h-[48px]"
                    )}
                    onHoverStart={() => setHoveredIcon(item.href)}
                    onHoverEnd={() => setHoveredIcon(null)}
                    whileHover={{ 
                      scale: 1.02,
                      x: 6,
                      transition: { type: "spring", stiffness: 400, damping: 20 }
                    }}
                    whileTap={{ scale: 0.98 }}
                  >
                    {/* Hover effect */}
                    <motion.div
                      className="absolute inset-0 bg-gradient-to-r from-cyan-500/10 to-blue-500/10 rounded-2xl opacity-0 group-hover:opacity-100"
                      transition={{ duration: 0.3 }}
                    />
                    
                    <motion.div
                      className="w-5 h-5 relative z-10"
                      animate={getIconAnimation(iconName, false, isHovered)}
                    >
                      <item.icon className="w-full h-full" />
                    </motion.div>
                    <AnimatePresence>
                      {(!isCollapsed || isMobile) && (
                        <motion.span 
                          className="relative z-10 font-medium"
                          initial={{ opacity: 0, width: 0 }}
                          animate={{ opacity: 1, width: "auto" }}
                          exit={{ opacity: 0, width: 0 }}
                          transition={{ duration: 0.2 }}
                        >
                          {t(item.labelKey)}
                        </motion.span>
                      )}
                    </AnimatePresence>
                    {item.badge && (
                      <motion.span 
                        className="ml-auto px-2 py-1 text-xs bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-full font-medium relative z-10"
                        data-testid="badge-pro"
                        animate={{ 
                          boxShadow: [
                            "0 0 10px hsla(180, 73%, 65%, 0.3)",
                            "0 0 20px hsla(180, 73%, 65%, 0.6)",
                            "0 0 10px hsla(180, 73%, 65%, 0.3)"
                          ]
                        }}
                        transition={{ duration: 2, repeat: Infinity }}
                        whileHover={{ scale: 1.1 }}
                      >
                        {item.badge}
                      </motion.span>
                    )}
                  </motion.div>
                </Link>
              </motion.div>
            );
          })}
        </motion.div>

        {/* Settings Section */}
        <motion.div 
          className="mt-6 pt-6 border-t border-white/10"
          variants={itemVariants}
        >
          <Link href="/settings" data-testid="link-settings" onClick={closeMobileSidebar}>
            <motion.div 
              className={cn(
                "flex items-center space-x-3 px-4 py-3 rounded-2xl text-muted-foreground hover:text-white hover:glass-card transition-all duration-300 group relative overflow-hidden",
                isMobile && "py-4 min-h-[48px]"
              )}
              onHoverStart={() => setHoveredIcon('/settings')}
              onHoverEnd={() => setHoveredIcon(null)}
              whileHover={{ 
                scale: 1.02,
                x: 6,
                transition: { type: "spring", stiffness: 400, damping: 20 }
              }}
              whileTap={{ scale: 0.98 }}
            >
              {/* Hover effect */}
              <motion.div
                className="absolute inset-0 bg-gradient-to-r from-cyan-500/10 to-blue-500/10 rounded-2xl opacity-0 group-hover:opacity-100"
                transition={{ duration: 0.3 }}
              />
              
              <motion.div
                className="w-5 h-5 relative z-10"
                animate={getIconAnimation('Settings', false, hoveredIcon === '/settings')}
              >
                <Settings className="w-full h-full" />
              </motion.div>
              <AnimatePresence>
                {(!isCollapsed || isMobile) && (
                  <motion.span 
                    className="relative z-10 font-medium"
                    initial={{ opacity: 0, width: 0 }}
                    animate={{ opacity: 1, width: "auto" }}
                    exit={{ opacity: 0, width: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    {t("navigation.settings")}
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.div>
          </Link>
        </motion.div>
      </nav>
      </motion.aside>
    </>
  );
}
