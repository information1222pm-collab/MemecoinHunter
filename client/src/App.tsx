import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { LanguageProvider } from "@/contexts/language-context";
import { RefreshIntervalProvider } from "@/hooks/use-refresh-interval";
import { useAuth } from "@/hooks/use-auth";
import { TradeAlertModal } from "@/components/trade-alert-modal";
import { InstantLoader } from "@/components/loading/instant-loader";
import { lazy, Suspense, useEffect } from "react";

const CryptoBackground = lazy(async () => {
  const module = await import("@/components/background/CryptoBackground");
  return { default: module.CryptoBackground };
});

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
const LaunchAnalytics = lazy(() => import("@/pages/launch-analytics"));
const Insights = lazy(() => import("@/pages/insights"));
const Backtest = lazy(() => import("@/pages/backtest"));
const SignIn = lazy(() => import("@/pages/signin"));
const DemoAlerts = lazy(() => import("@/pages/demo-alerts"));
const NotFound = lazy(() => import("@/pages/not-found"));

function LoadingFallback() {
  return <InstantLoader />;
}

function AuthenticatedSignInRedirect() {
  const [, setLocation] = useLocation();
  
  useEffect(() => {
    // Redirect authenticated users visiting /signin to home page
    setLocation('/');
  }, [setLocation]);
  
  return null; // Redirect happens immediately
}

function BillingRedirect() {
  const [, setLocation] = useLocation();
  
  useEffect(() => {
    // Redirect /billing to /subscription for unified subscription management
    setLocation('/subscription');
  }, [setLocation]);
  
  return null; // Redirect happens immediately
}

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isAuthenticated) {
      setLocation('/signin');
    }
  }, [isAuthenticated, setLocation]);

  if (!isAuthenticated) {
    return null;
  }

  return <Component />;
}

function Router() {
  const { isAuthenticated, isLoading } = useAuth();

  // Prefetch critical data for authenticated users
  useEffect(() => {
    if (isAuthenticated) {
      // Prefetch portfolio data
      queryClient.prefetchQuery({
        queryKey: ['/api/portfolio'],
        staleTime: 30000,
      });
      // Prefetch scanner status
      queryClient.prefetchQuery({
        queryKey: ['/api/scanner/status'],
        staleTime: 10000,
      });
    }
  }, [isAuthenticated]);

  // Show loading state while checking authentication
  if (isLoading) {
    return <InstantLoader />;
  }

  return (
    <>
      {isAuthenticated && (
        <TradeAlertModal />
      )}
      <Suspense fallback={<LoadingFallback />}>
        <Switch>
          {/* Public routes */}
          <Route path="/demo" component={DemoAlerts} />
          <Route path="/signin">
            {isAuthenticated ? <AuthenticatedSignInRedirect /> : <SignIn />}
          </Route>

          {/* Protected routes */}
          <Route path="/">
            {() => <ProtectedRoute component={Home} />}
          </Route>
          <Route path="/dashboard">
            {() => <ProtectedRoute component={Dashboard} />}
          </Route>
          <Route path="/scanner">
            {() => <ProtectedRoute component={Scanner} />}
          </Route>
          <Route path="/portfolio">
            {() => <ProtectedRoute component={Portfolio} />}
          </Route>
          <Route path="/analytics">
            {() => <ProtectedRoute component={Analytics} />}
          </Route>
          <Route path="/activity">
            {() => <ProtectedRoute component={Activity} />}
          </Route>
          <Route path="/journal">
            {() => <ProtectedRoute component={Journal} />}
          </Route>
          <Route path="/trophy-room">
            {() => <ProtectedRoute component={TrophyRoom} />}
          </Route>
          <Route path="/risk">
            {() => <ProtectedRoute component={RiskReports} />}
          </Route>
          <Route path="/alerts">
            {() => <ProtectedRoute component={Alerts} />}
          </Route>
          <Route path="/terminal">
            {() => <ProtectedRoute component={Terminal} />}
          </Route>
          <Route path="/subscription">
            {() => <ProtectedRoute component={Subscription} />}
          </Route>
          <Route path="/billing">
            <BillingRedirect />
          </Route>
          <Route path="/settings">
            {() => <ProtectedRoute component={Settings} />}
          </Route>
          <Route path="/launch-analytics">
            {() => <ProtectedRoute component={LaunchAnalytics} />}
          </Route>
          <Route path="/insights">
            {() => <ProtectedRoute component={Insights} />}
          </Route>
          <Route path="/backtest">
            {() => <ProtectedRoute component={Backtest} />}
          </Route>
          
          {/* 404 */}
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
          <RefreshIntervalProvider>
            <div className="dark relative min-h-screen">
              <Suspense fallback={null}>
                <CryptoBackground />
              </Suspense>
              <Toaster />
              <Router />
            </div>
          </RefreshIntervalProvider>
        </LanguageProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
