import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { LanguageProvider } from "@/contexts/language-context";
import Home from "@/pages/home";
import Dashboard from "@/pages/dashboard";
import Scanner from "@/pages/scanner";
import Portfolio from "@/pages/portfolio";
import Analytics from "@/pages/analytics";
import Activity from "@/pages/activity";
import Terminal from "@/pages/terminal";
import Subscription from "@/pages/subscription";
import Settings from "@/pages/settings";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/scanner" component={Scanner} />
      <Route path="/portfolio" component={Portfolio} />
      <Route path="/analytics" component={Analytics} />
      <Route path="/activity" component={Activity} />
      <Route path="/terminal" component={Terminal} />
      <Route path="/subscription" component={Subscription} />
      <Route path="/settings" component={Settings} />
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
