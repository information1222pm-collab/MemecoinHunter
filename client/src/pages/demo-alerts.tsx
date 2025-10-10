import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { TrendingUp, TrendingDown, Trophy, AlertCircle } from "lucide-react";

export default function DemoAlerts() {
  const [showBuy, setShowBuy] = useState(false);
  const [showSell, setShowSell] = useState(false);
  const [showProfit, setShowProfit] = useState(false);
  const [showLoss, setShowLoss] = useState(false);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-6">
      <Card className="max-w-2xl w-full bg-slate-800/50 backdrop-blur-xl border-slate-700">
        <CardHeader>
          <CardTitle className="text-3xl text-center text-white">
            Trade Alert Windows Demo
          </CardTitle>
          <p className="text-center text-slate-300 mt-2">
            Click any button to see the large alert windows that appear when trades execute
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Button
              onClick={() => setShowBuy(true)}
              className="h-20 text-lg bg-green-600 hover:bg-green-700"
              data-testid="demo-buy-alert"
            >
              🟢 Buy Trade Alert
            </Button>

            <Button
              onClick={() => setShowProfit(true)}
              className="h-20 text-lg bg-blue-600 hover:bg-blue-700"
              data-testid="demo-sell-profit-alert"
            >
              🔵 Sell with Profit
            </Button>

            <Button
              onClick={() => setShowLoss(true)}
              className="h-20 text-lg bg-red-600 hover:bg-red-700"
              data-testid="demo-sell-loss-alert"
            >
              🔴 Sell with Loss
            </Button>

            <Button
              onClick={() => setShowSell(true)}
              className="h-20 text-lg bg-yellow-600 hover:bg-yellow-700"
              data-testid="demo-milestone-alert"
            >
              🎊 Portfolio Milestone
            </Button>
          </div>

          <div className="bg-slate-900/50 rounded-lg p-4 mt-6">
            <h3 className="font-semibold text-white mb-2">What You'll See:</h3>
            <ul className="text-sm space-y-1 text-slate-300">
              <li>✨ Large center-screen modals (impossible to miss)</li>
              <li>📊 Complete trade data with token, amount, price, and value</li>
              <li>🤖 ML signal reasoning for each trade</li>
              <li>💰 Profit/loss breakdown with percentages</li>
              <li>🎨 Color-coded by trade type (green/blue/red/yellow)</li>
              <li>⏱️ Auto-dismiss after 8 seconds or manual close</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Buy Trade Modal */}
      <Dialog open={showBuy} onOpenChange={setShowBuy}>
        <DialogContent className="sm:max-w-[500px] bg-gradient-to-br from-green-900/95 to-emerald-900/95 border-green-500/50 text-white">
          <DialogHeader>
            <DialogTitle className="text-2xl flex items-center gap-2">
              <TrendingUp className="w-8 h-8 text-green-400" />
              Trade Executed!
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="text-center">
              <h3 className="text-4xl font-bold text-green-300">DOGE</h3>
              <p className="text-sm text-green-200">Dogecoin</p>
            </div>
            <div className="bg-black/20 rounded-lg p-4 space-y-2">
              <div className="flex justify-between">
                <span className="text-green-200">Amount:</span>
                <span className="font-bold">125,000 tokens</span>
              </div>
              <div className="flex justify-between">
                <span className="text-green-200">Price:</span>
                <span className="font-bold">$0.004</span>
              </div>
              <div className="flex justify-between text-lg">
                <span className="text-green-200">Total:</span>
                <span className="font-bold text-green-300">$500.00</span>
              </div>
            </div>
            <div className="bg-black/20 rounded-lg p-3">
              <p className="text-sm text-green-200 mb-1">🤖 AI Signal:</p>
              <p className="text-sm">Strong bullish reversal pattern detected with 95% confidence</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Sell with Profit Modal */}
      <Dialog open={showProfit} onOpenChange={setShowProfit}>
        <DialogContent className="sm:max-w-[500px] bg-gradient-to-br from-blue-900/95 to-cyan-900/95 border-blue-500/50 text-white">
          <DialogHeader>
            <DialogTitle className="text-2xl flex items-center gap-2">
              <TrendingUp className="w-8 h-8 text-blue-400" />
              Trade Executed!
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="text-center">
              <h3 className="text-4xl font-bold text-blue-300">DOGE</h3>
              <p className="text-sm text-blue-200">Dogecoin</p>
            </div>
            <div className="bg-black/20 rounded-lg p-4 space-y-2">
              <div className="flex justify-between">
                <span className="text-blue-200">Sold:</span>
                <span className="font-bold">125,000 tokens</span>
              </div>
              <div className="flex justify-between">
                <span className="text-blue-200">Price:</span>
                <span className="font-bold">$0.0052</span>
              </div>
              <div className="flex justify-between text-lg">
                <span className="text-blue-200">Total:</span>
                <span className="font-bold">$650.00</span>
              </div>
            </div>
            <div className="bg-green-500/20 rounded-lg p-4 border border-green-500/30">
              <div className="flex justify-between items-center text-lg">
                <span className="text-green-200">💰 Profit:</span>
                <div className="text-right">
                  <div className="font-bold text-green-300 text-2xl">+$150.00</div>
                  <div className="text-green-200 text-sm">+30.0%</div>
                </div>
              </div>
            </div>
            <div className="bg-black/20 rounded-lg p-3">
              <p className="text-sm text-blue-200">Price target reached, securing profits</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Sell with Loss Modal */}
      <Dialog open={showLoss} onOpenChange={setShowLoss}>
        <DialogContent className="sm:max-w-[500px] bg-gradient-to-br from-red-900/95 to-rose-900/95 border-red-500/50 text-white">
          <DialogHeader>
            <DialogTitle className="text-2xl flex items-center gap-2">
              <AlertCircle className="w-8 h-8 text-red-400" />
              Stop Loss Triggered!
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="text-center">
              <h3 className="text-4xl font-bold text-red-300">SHIB</h3>
              <p className="text-sm text-red-200">Shiba Inu</p>
            </div>
            <div className="bg-black/20 rounded-lg p-4 space-y-2">
              <div className="flex justify-between">
                <span className="text-red-200">Sold:</span>
                <span className="font-bold">50,000,000 tokens</span>
              </div>
              <div className="flex justify-between">
                <span className="text-red-200">Price:</span>
                <span className="font-bold">$0.0000095</span>
              </div>
              <div className="flex justify-between text-lg">
                <span className="text-red-200">Total:</span>
                <span className="font-bold">$475.00</span>
              </div>
            </div>
            <div className="bg-red-500/20 rounded-lg p-4 border border-red-500/30">
              <div className="flex justify-between items-center text-lg">
                <span className="text-red-200">📉 Loss:</span>
                <div className="text-right">
                  <div className="font-bold text-red-300 text-2xl">-$25.00</div>
                  <div className="text-red-200 text-sm">-5.0%</div>
                </div>
              </div>
            </div>
            <div className="bg-black/20 rounded-lg p-3">
              <p className="text-sm text-red-200">🛡️ Stop-loss triggered to protect your capital</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Milestone Modal */}
      <Dialog open={showSell} onOpenChange={setShowSell}>
        <DialogContent className="sm:max-w-[500px] bg-gradient-to-br from-yellow-900/95 to-amber-900/95 border-yellow-500/50 text-white">
          <DialogHeader>
            <DialogTitle className="text-2xl flex items-center gap-2">
              <Trophy className="w-8 h-8 text-yellow-400" />
              Portfolio Milestone!
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="text-center">
              <h3 className="text-5xl font-bold text-yellow-300 mb-2">🎊</h3>
              <h4 className="text-3xl font-bold text-yellow-200">25% Growth Achieved!</h4>
            </div>
            <div className="bg-black/20 rounded-lg p-4 space-y-2">
              <div className="flex justify-between text-lg">
                <span className="text-yellow-200">Total Value:</span>
                <span className="font-bold text-2xl text-yellow-300">$12,500</span>
              </div>
              <div className="flex justify-between text-lg">
                <span className="text-yellow-200">Starting Capital:</span>
                <span className="font-bold">$10,000</span>
              </div>
              <div className="flex justify-between text-xl border-t border-yellow-500/30 pt-2 mt-2">
                <span className="text-yellow-200">Total Profit:</span>
                <span className="font-bold text-2xl text-yellow-300">+$2,500</span>
              </div>
            </div>
            <div className="bg-black/20 rounded-lg p-3 text-center">
              <p className="text-sm text-yellow-200">🚀 Keep up the great trading!</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
