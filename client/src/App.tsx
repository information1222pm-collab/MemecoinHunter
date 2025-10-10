import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { LanguageProvider } from "@/contexts/language-context";
import { useAuth } from "@/hooks/use-auth";
import Home from "@/pages/home";
import Dashboard from "@/pages/dashboard";
import Scanner from "@/pages/scanner";
import Portfolio from "@/pages/portfolio";
import Analytics from "@/pages/analytics";
import Activity from "@/pages/activity";
import Journal from "@/pages/journal";
import RiskReports from "@/pages/risk-reports";
import Terminal from "@/pages/terminal";
import Subscription from "@/pages/subscription";
import Settings from "@/pages/settings";
import SignIn from "@/pages/signin";
import NotFound from "@/pages/not-found";
import { useEffect } from "react";

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

  // Show loading state while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-emerald-400 mx-auto mb-4"></div>
          <p className="text-slate-300">Loading CryptoHobby...</p>
        </div>
      </div>
    );
  }

  // Show sign-in page if not authenticated
  if (!isAuthenticated) {
    return <SignIn />;
  }

  // Show main app if authenticated
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/scanner" component={Scanner} />
      <Route path="/portfolio" component={Portfolio} />
      <Route path="/analytics" component={Analytics} />
      <Route path="/activity" component={Activity} />
      <Route path="/journal" component={Journal} />
      <Route path="/risk" component={RiskReports} />
      <Route path="/terminal" component={Terminal} />
      <Route path="/subscription" component={Subscription} />
      <Route path="/settings" component={Settings} />
      <Route path="/signin" component={AuthenticatedSignInRedirect} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <LanguageProvider>
          <div className="dark">
            <Toaster />
            <Router />
          </div>
        </LanguageProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
