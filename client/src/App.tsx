import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { LanguageProvider } from "@/contexts/language-context";
import { useAuth } from "@/hooks/use-auth";
import { TradeAlertModal } from "@/components/trade-alert-modal";
import { MobileBottomNav } from "@/components/layout/mobile-bottom-nav";
import { CryptoBackground } from "@/components/background/CryptoBackground";
import { lazy, Suspense, useEffect } from "react";

const Home = lazy(() => import("@/pages/home"));
const Dashboard = lazy(() => import("@/pages/dashboard"));
const Scanner = lazy(() => import("@/pages/scanner"));
const Portfolio = lazy(() => import("@/pages/portfolio"));
const Analytics = lazy(() => import("@/pages/analytics"));
const Activity = lazy(() => import("@/pages/activity"));
const Journal = lazy(() => import("@/pages/journal"));
const TrophyRoom = lazy(() => import("@/pages/trophy-room"));
const RiskReports = lazy(() => import("@/pages/risk-reports"));
const Alerts = lazy(() => import("@/pages/alerts"));
const Terminal = lazy(() => import("@/pages/terminal"));
const Subscription = lazy(() => import("@/pages/subscription"));
const Settings = lazy(() => import("@/pages/settings"));
const SignIn = lazy(() => import("@/pages/signin"));
const DemoAlerts = lazy(() => import("@/pages/demo-alerts"));
const NotFound = lazy(() => import("@/pages/not-found"));

function LoadingFallback() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-emerald-400 mx-auto mb-4"></div>
        <p className="text-slate-300">Loading...</p>
      </div>
    </div>
  );
}

function AuthenticatedSignInRedirect() {
  const [, setLocation] = useLocation();
  
  useEffect(() => {
    // Redirect authenticated users visiting /signin to home page
    setLocation('/');
  }, [setLocation]);
  
  return null; // Redirect happens immediately
}

function Router() {
  const { isAuthenticated, isLoading } = useAuth();
  const [location] = useLocation();

  // Public routes that don't require authentication
  if (location === '/demo') {
    return (
      <Suspense fallback={<LoadingFallback />}>
        <DemoAlerts />
      </Suspense>
    );
  }

  // Show loading state while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-emerald-400 mx-auto mb-4"></div>
          <p className="text-slate-300">Loading MemeCoin Hunter...</p>
        </div>
      </div>
    );
  }

  // Show sign-in page if not authenticated
  if (!isAuthenticated) {
    return (
      <Suspense fallback={<LoadingFallback />}>
        <SignIn />
      </Suspense>
    );
  }

  // Show main app if authenticated
  return (
    <>
      <TradeAlertModal />
      <MobileBottomNav />
      <Suspense fallback={<LoadingFallback />}>
        <Switch>
          <Route path="/" component={Home} />
          <Route path="/dashboard" component={Dashboard} />
          <Route path="/scanner" component={Scanner} />
          <Route path="/portfolio" component={Portfolio} />
          <Route path="/analytics" component={Analytics} />
          <Route path="/activity" component={Activity} />
          <Route path="/journal" component={Journal} />
          <Route path="/trophy-room" component={TrophyRoom} />
          <Route path="/risk" component={RiskReports} />
          <Route path="/alerts" component={Alerts} />
          <Route path="/terminal" component={Terminal} />
          <Route path="/subscription" component={Subscription} />
          <Route path="/settings" component={Settings} />
          <Route path="/signin" component={AuthenticatedSignInRedirect} />
          <Route component={NotFound} />
        </Switch>
      </Suspense>
    </>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <LanguageProvider>
          <div className="dark relative min-h-screen">
            <CryptoBackground />
            <Toaster />
            <Router />
          </div>
        </LanguageProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
