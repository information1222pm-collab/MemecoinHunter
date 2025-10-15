import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { 
  TrendingUp, 
  Brain, 
  Zap, 
  Shield, 
  BarChart3, 
  Clock, 
  Target,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  Activity,
  Coins,
  LineChart,
  Bot
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface DemoModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function DemoModal({ isOpen, onClose }: DemoModalProps) {
  const [step, setStep] = useState(0);

  const steps = [
    {
      title: "Welcome to CryptoHobby",
      subtitle: "Your AI-Powered Memecoin Trading Platform",
      content: (
        <div className="space-y-6">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-emerald-500 to-blue-500 mb-4">
              <Sparkles className="w-10 h-10 text-white" />
            </div>
            <h3 className="text-2xl font-bold mb-3 bg-gradient-to-r from-emerald-400 to-blue-400 bg-clip-text text-transparent">
              Next-Generation Trading Platform
            </h3>
            <p className="text-muted-foreground max-w-md mx-auto">
              Powered by advanced machine learning, real-time data streaming, and institutional-grade risk management
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 mt-8">
            <div className="p-4 rounded-xl bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border border-emerald-500/20">
              <div className="text-3xl font-bold text-emerald-400 mb-1">95%+</div>
              <div className="text-sm text-muted-foreground">ML Pattern Accuracy</div>
            </div>
            <div className="p-4 rounded-xl bg-gradient-to-br from-blue-500/10 to-blue-500/5 border border-blue-500/20">
              <div className="text-3xl font-bold text-blue-400 mb-1">&lt;1s</div>
              <div className="text-sm text-muted-foreground">Price Update Latency</div>
            </div>
            <div className="p-4 rounded-xl bg-gradient-to-br from-purple-500/10 to-purple-500/5 border border-purple-500/20">
              <div className="text-3xl font-bold text-purple-400 mb-1">100+</div>
              <div className="text-sm text-muted-foreground">Tokens Monitored 24/7</div>
            </div>
            <div className="p-4 rounded-xl bg-gradient-to-br from-orange-500/10 to-orange-500/5 border border-orange-500/20">
              <div className="text-3xl font-bold text-orange-400 mb-1">250ms</div>
              <div className="text-sm text-muted-foreground">Portfolio Updates</div>
            </div>
          </div>
        </div>
      )
    },
    {
      title: "Real-Time Intelligence",
      subtitle: "Advanced ML & Market Analysis",
      content: (
        <div className="space-y-4">
          <div className="flex items-start space-x-3 p-4 rounded-lg bg-secondary/50">
            <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center">
              <Brain className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1">
              <h4 className="font-semibold mb-1">AI Pattern Recognition</h4>
              <p className="text-sm text-muted-foreground">
                10 advanced ML algorithms analyze 7 days of price history with 50+ technical indicators
              </p>
              <div className="flex items-center space-x-2 mt-2">
                <Badge variant="outline" className="text-xs">Fibonacci</Badge>
                <Badge variant="outline" className="text-xs">Volume Profile</Badge>
                <Badge variant="outline" className="text-xs">Harmonic Patterns</Badge>
              </div>
            </div>
          </div>

          <div className="flex items-start space-x-3 p-4 rounded-lg bg-secondary/50">
            <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1">
              <h4 className="font-semibold mb-1">Streaming Price Gateway</h4>
              <p className="text-sm text-muted-foreground">
                WebSocket connections to Coinbase & Binance deliver price updates in &lt;1s latency
              </p>
              <div className="flex items-center space-x-2 mt-2">
                <Badge variant="outline" className="text-xs bg-green-500/10 text-green-400 border-green-500/20">SOL: 0.4s</Badge>
                <Badge variant="outline" className="text-xs bg-blue-500/10 text-blue-400 border-blue-500/20">BTC: 0.5s</Badge>
                <Badge variant="outline" className="text-xs bg-purple-500/10 text-purple-400 border-purple-500/20">ETH: 0.7s</Badge>
              </div>
            </div>
          </div>

          <div className="flex items-start space-x-3 p-4 rounded-lg bg-secondary/50">
            <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center">
              <LineChart className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1">
              <h4 className="font-semibold mb-1">Advanced Chart Analysis</h4>
              <p className="text-sm text-muted-foreground">
                Support/resistance detection, chart patterns, Fibonacci levels, and dynamic exit strategies
              </p>
              <div className="flex items-center space-x-2 mt-2">
                <Badge variant="outline" className="text-xs">8 Patterns</Badge>
                <Badge variant="outline" className="text-xs">Risk/Reward</Badge>
                <Badge variant="outline" className="text-xs">Auto Exits</Badge>
              </div>
            </div>
          </div>
        </div>
      )
    },
    {
      title: "Automated Trading Engine",
      subtitle: "Professional-Grade Execution",
      content: (
        <div className="space-y-4">
          <div className="flex items-start space-x-3 p-4 rounded-lg bg-secondary/50">
            <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center">
              <Bot className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1">
              <h4 className="font-semibold mb-1">Intelligent Position Sizing</h4>
              <p className="text-sm text-muted-foreground">
                2x Kelly Criterion with dynamic risk adjustment based on market conditions
              </p>
              <div className="mt-3 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Pattern Confidence Threshold</span>
                  <span className="font-medium text-emerald-400">75-82%</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Risk/Reward Minimum</span>
                  <span className="font-medium text-blue-400">1.2:1</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-start space-x-3 p-4 rounded-lg bg-secondary/50">
            <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center">
              <Target className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1">
              <h4 className="font-semibold mb-1">Multi-Stage Take Profit</h4>
              <p className="text-sm text-muted-foreground">
                Systematic profit-taking at multiple levels to maximize gains
              </p>
              <div className="mt-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">30% at 8% gain</span>
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">40% at 12% gain</span>
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Rest at 18% gain</span>
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-start space-x-3 p-4 rounded-lg bg-secondary/50">
            <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1">
              <h4 className="font-semibold mb-1">Risk Management</h4>
              <p className="text-sm text-muted-foreground">
                5% stop-loss, cash floor enforcement, and market health gating
              </p>
              <div className="flex items-center space-x-2 mt-2">
                <Badge variant="outline" className="text-xs bg-red-500/10 text-red-400 border-red-500/20">Stop Loss</Badge>
                <Badge variant="outline" className="text-xs">Cash Protection</Badge>
                <Badge variant="outline" className="text-xs">Market Health</Badge>
              </div>
            </div>
          </div>
        </div>
      )
    },
    {
      title: "Performance Highlights",
      subtitle: "Proven Track Record",
      content: (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border border-emerald-500/20 text-center">
              <Activity className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
              <div className="text-2xl font-bold text-emerald-400 mb-1">Real-Time</div>
              <div className="text-xs text-muted-foreground">Portfolio Updates</div>
              <div className="text-xs text-emerald-400 mt-1 font-medium">&lt;250ms latency</div>
            </div>
            
            <div className="p-4 rounded-xl bg-gradient-to-br from-blue-500/10 to-blue-500/5 border border-blue-500/20 text-center">
              <Coins className="w-8 h-8 text-blue-400 mx-auto mb-2" />
              <div className="text-2xl font-bold text-blue-400 mb-1">100+</div>
              <div className="text-xs text-muted-foreground">Tokens Scanned</div>
              <div className="text-xs text-blue-400 mt-1 font-medium">Continuously</div>
            </div>

            <div className="p-4 rounded-xl bg-gradient-to-br from-purple-500/10 to-purple-500/5 border border-purple-500/20 text-center">
              <Clock className="w-8 h-8 text-purple-400 mx-auto mb-2" />
              <div className="text-2xl font-bold text-purple-400 mb-1">24/7</div>
              <div className="text-xs text-muted-foreground">Market Monitoring</div>
              <div className="text-xs text-purple-400 mt-1 font-medium">Never miss a trade</div>
            </div>

            <div className="p-4 rounded-xl bg-gradient-to-br from-orange-500/10 to-orange-500/5 border border-orange-500/20 text-center">
              <BarChart3 className="w-8 h-8 text-orange-400 mx-auto mb-2" />
              <div className="text-2xl font-bold text-orange-400 mb-1">50+</div>
              <div className="text-xs text-muted-foreground">Indicators</div>
              <div className="text-xs text-orange-400 mt-1 font-medium">Per analysis</div>
            </div>
          </div>

          <div className="p-6 rounded-xl bg-gradient-to-br from-slate-800/50 to-slate-900/50 border border-slate-700/50">
            <h4 className="font-semibold mb-4 text-center">System Performance</h4>
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-muted-foreground">ML Pattern Detection</span>
                  <span className="font-medium text-emerald-400">95%+ Confidence</span>
                </div>
                <div className="h-2 bg-secondary rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-emerald-500 to-green-400" style={{ width: '95%' }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-muted-foreground">Price Update Speed</span>
                  <span className="font-medium text-blue-400">40-60x Faster</span>
                </div>
                <div className="h-2 bg-secondary rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-blue-500 to-cyan-400" style={{ width: '98%' }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-muted-foreground">Risk Management</span>
                  <span className="font-medium text-purple-400">Multi-Layer Protection</span>
                </div>
                <div className="h-2 bg-secondary rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-purple-500 to-pink-400" style={{ width: '100%' }} />
                </div>
              </div>
            </div>
          </div>
        </div>
      )
    },
    {
      title: "Get Started",
      subtitle: "Your $10,000 Paper Trading Account is Ready",
      content: (
        <div className="space-y-6">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-emerald-500 to-blue-500 mb-4">
              <TrendingUp className="w-10 h-10 text-white" />
            </div>
            <h3 className="text-xl font-bold mb-2">Your Trading Journey Begins</h3>
            <p className="text-muted-foreground max-w-md mx-auto">
              Start with $10,000 in virtual capital to test strategies risk-free
            </p>
          </div>

          <div className="grid gap-3">
            <div className="flex items-center space-x-3 p-3 rounded-lg bg-secondary/50">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
              <div className="text-sm">
                <span className="font-medium">Auto-Trading Enabled</span>
                <span className="text-muted-foreground ml-1">- AI executes trades automatically</span>
              </div>
            </div>
            <div className="flex items-center space-x-3 p-3 rounded-lg bg-secondary/50">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
              <div className="text-sm">
                <span className="font-medium">Real-Time Monitoring</span>
                <span className="text-muted-foreground ml-1">- Live portfolio updates</span>
              </div>
            </div>
            <div className="flex items-center space-x-3 p-3 rounded-lg bg-secondary/50">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
              <div className="text-sm">
                <span className="font-medium">Risk Protection</span>
                <span className="text-muted-foreground ml-1">- Stop-loss & take-profit automated</span>
              </div>
            </div>
            <div className="flex items-center space-x-3 p-3 rounded-lg bg-secondary/50">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
              <div className="text-sm">
                <span className="font-medium">Full Analytics</span>
                <span className="text-muted-foreground ml-1">- Track every metric & pattern</span>
              </div>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-gradient-to-r from-emerald-500/10 to-blue-500/10 border border-emerald-500/20">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-muted-foreground mb-1">Starting Balance</div>
                <div className="text-2xl font-bold bg-gradient-to-r from-emerald-400 to-blue-400 bg-clip-text text-transparent">
                  $10,000.00
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm text-muted-foreground mb-1">Status</div>
                <Badge className="bg-green-500/20 text-green-400 border-green-500/30">Active</Badge>
              </div>
            </div>
          </div>
        </div>
      )
    }
  ];

  const markDemoComplete = async () => {
    // Mark as complete in both localStorage and server (IP-based tracking)
    localStorage.setItem('demo_completed', 'true');
    try {
      const { getCsrfToken } = await import('@/lib/auth-utils');
      const csrfToken = await getCsrfToken();
      
      await fetch('/api/visitor/demo-complete', { 
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ _csrf: csrfToken }),
        credentials: 'include'
      });
    } catch (error) {
      console.error('Error marking demo complete:', error);
    }
  };

  const handleNext = async () => {
    if (step < steps.length - 1) {
      setStep(step + 1);
    } else {
      await markDemoComplete();
      onClose();
    }
  };

  const handlePrevious = () => {
    if (step > 0) {
      setStep(step - 1);
    }
  };

  const handleSkip = async () => {
    await markDemoComplete();
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent 
        className="max-w-3xl max-h-[90vh] overflow-auto p-0" 
        data-testid="modal-demo"
      >
        <div className="p-8">
          {/* Progress Indicator */}
          <div className="flex items-center justify-center space-x-2 mb-8">
            {steps.map((_, index) => (
              <div
                key={index}
                className={`h-2 rounded-full transition-all ${
                  index === step 
                    ? 'w-8 bg-gradient-to-r from-emerald-500 to-blue-500' 
                    : index < step
                    ? 'w-2 bg-emerald-500/50'
                    : 'w-2 bg-secondary'
                }`}
              />
            ))}
          </div>

          {/* Content */}
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              <div className="text-center mb-6">
                <h2 className="text-3xl font-bold mb-2" data-testid={`text-demo-title-${step}`}>
                  {steps[step].title}
                </h2>
                <p className="text-muted-foreground">{steps[step].subtitle}</p>
              </div>

              <div className="mb-8">
                {steps[step].content}
              </div>
            </motion.div>
          </AnimatePresence>

          {/* Navigation */}
          <div className="flex items-center justify-between pt-6 border-t">
            <Button
              variant="ghost"
              onClick={handleSkip}
              className="text-muted-foreground"
              data-testid="button-skip-demo"
            >
              Skip Tour
            </Button>

            <div className="flex items-center space-x-3">
              {step > 0 && (
                <Button
                  variant="outline"
                  onClick={handlePrevious}
                  data-testid="button-previous-step"
                >
                  Previous
                </Button>
              )}
              <Button
                onClick={handleNext}
                className="bg-gradient-to-r from-emerald-500 to-blue-500 hover:from-emerald-600 hover:to-blue-600"
                data-testid="button-next-step"
              >
                {step === steps.length - 1 ? (
                  <>
                    Start Trading
                    <Sparkles className="w-4 h-4 ml-2" />
                  </>
                ) : (
                  <>
                    Next
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
