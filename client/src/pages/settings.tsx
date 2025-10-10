import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useLanguage } from "@/hooks/use-language";
import { useState } from "react";
import { Settings as SettingsIcon, User, Bell, Shield, Globe, Palette, TestTube } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useWebSocket } from "@/hooks/use-websocket";

export default function Settings() {
  const { t, language, setLanguage } = useLanguage();
  const { toast } = useToast();
  const { emitCustomEvent } = useWebSocket();
  const [notifications, setNotifications] = useState(true);
  const [darkMode, setDarkMode] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const handleSaveSettings = () => {
    toast({
      title: "Settings Saved",
      description: "Your preferences have been updated successfully",
    });
  };

  const testBuyAlert = () => {
    emitCustomEvent({
      type: 'trade_executed',
      data: {
        trade: {
          id: 'test-buy-' + Date.now(),
          portfolioId: 'test',
          tokenId: 'test-token',
          type: 'buy',
          amount: '125000',
          price: '0.004',
          totalValue: '500',
          timestamp: new Date(),
        },
        signal: {
          type: 'ml_pattern',
          source: 'pattern_analyzer',
          reason: 'Strong bullish reversal pattern detected with 95% confidence',
        },
        token: {
          id: 'test-token',
          symbol: 'DOGE',
          name: 'Dogecoin',
          currentPrice: '0.004',
        },
      },
    });
  };

  const testSellAlert = () => {
    emitCustomEvent({
      type: 'trade_executed',
      data: {
        trade: {
          id: 'test-sell-' + Date.now(),
          portfolioId: 'test',
          tokenId: 'test-token',
          type: 'sell',
          amount: '125000',
          price: '0.0052',
          totalValue: '650',
          timestamp: new Date(),
        },
        signal: {
          type: 'take_profit',
          reason: 'Price target reached, securing profits',
        },
        token: {
          id: 'test-token',
          symbol: 'DOGE',
          name: 'Dogecoin',
          currentPrice: '0.0052',
        },
        profitLoss: '150',
        profitPercentage: 30,
      },
    });
  };

  const testMilestoneAlert = () => {
    emitCustomEvent({
      type: 'portfolio_updated',
      data: {
        id: 'test-portfolio',
        totalValue: '12500',
        totalPnL: '2500',
        startingCapital: '10000',
      },
    });
  };

  return (
    <div className="min-h-screen flex bg-background">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <Header />
        
        <div className="p-6 space-y-6">
          {/* Page Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold flex items-center space-x-3" data-testid="text-page-title">
                <SettingsIcon className="w-8 h-8" />
                <span>{t("navigation.settings")}</span>
              </h1>
              <p className="text-muted-foreground mt-1">Manage your account preferences and application settings</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Profile Settings */}
            <Card data-testid="card-profile-settings">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <User className="w-5 h-5" />
                  <span>Profile Settings</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="username">Username</Label>
                  <Input 
                    id="username" 
                    defaultValue="trader123" 
                    className="mt-1"
                    data-testid="input-username"
                  />
                </div>
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input 
                    id="email" 
                    type="email" 
                    defaultValue="trader@example.com" 
                    className="mt-1"
                    data-testid="input-email"
                  />
                </div>
                <div>
                  <Label htmlFor="timezone">Timezone</Label>
                  <Select defaultValue="utc">
                    <SelectTrigger className="mt-1" data-testid="select-timezone">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="utc">UTC</SelectItem>
                      <SelectItem value="est">Eastern Time</SelectItem>
                      <SelectItem value="pst">Pacific Time</SelectItem>
                      <SelectItem value="cet">Central European Time</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Application Settings */}
            <Card data-testid="card-app-settings">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Palette className="w-5 h-5" />
                  <span>Application Settings</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="dark-mode">Dark Mode</Label>
                    <p className="text-sm text-muted-foreground">Use dark theme</p>
                  </div>
                  <Switch 
                    id="dark-mode" 
                    checked={darkMode} 
                    onCheckedChange={setDarkMode}
                    data-testid="switch-dark-mode"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="auto-refresh">Auto Refresh</Label>
                    <p className="text-sm text-muted-foreground">Automatically refresh data</p>
                  </div>
                  <Switch 
                    id="auto-refresh" 
                    checked={autoRefresh} 
                    onCheckedChange={setAutoRefresh}
                    data-testid="switch-auto-refresh"
                  />
                </div>
                <div>
                  <Label htmlFor="refresh-interval">Refresh Interval</Label>
                  <Select defaultValue="30">
                    <SelectTrigger className="mt-1" data-testid="select-refresh-interval">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="10">10 seconds</SelectItem>
                      <SelectItem value="30">30 seconds</SelectItem>
                      <SelectItem value="60">1 minute</SelectItem>
                      <SelectItem value="300">5 minutes</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Language & Localization */}
            <Card data-testid="card-language-settings">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Globe className="w-5 h-5" />
                  <span>Language & Localization</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="language">Language</Label>
                  <Select value={language} onValueChange={setLanguage}>
                    <SelectTrigger className="mt-1" data-testid="select-language">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="en">English</SelectItem>
                      <SelectItem value="es">Español</SelectItem>
                      <SelectItem value="fr">Français</SelectItem>
                      <SelectItem value="de">Deutsch</SelectItem>
                      <SelectItem value="ja">日本語</SelectItem>
                      <SelectItem value="ko">한국어</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="currency">Display Currency</Label>
                  <Select defaultValue="usd">
                    <SelectTrigger className="mt-1" data-testid="select-currency">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="usd">USD ($)</SelectItem>
                      <SelectItem value="eur">EUR (€)</SelectItem>
                      <SelectItem value="btc">BTC (₿)</SelectItem>
                      <SelectItem value="eth">ETH (Ξ)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Notifications */}
            <Card data-testid="card-notification-settings">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Bell className="w-5 h-5" />
                  <span>Notifications</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="notifications">Enable Notifications</Label>
                    <p className="text-sm text-muted-foreground">Receive alerts and updates</p>
                  </div>
                  <Switch 
                    id="notifications" 
                    checked={notifications} 
                    onCheckedChange={setNotifications}
                    data-testid="switch-notifications"
                  />
                </div>
                <div>
                  <Label htmlFor="alert-types">Alert Types</Label>
                  <div className="mt-2 space-y-2">
                    <div className="flex items-center space-x-2">
                      <input type="checkbox" id="price-alerts" defaultChecked className="rounded" data-testid="checkbox-price-alerts" />
                      <Label htmlFor="price-alerts" className="text-sm">Price Alerts</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input type="checkbox" id="pattern-alerts" defaultChecked className="rounded" data-testid="checkbox-pattern-alerts" />
                      <Label htmlFor="pattern-alerts" className="text-sm">Pattern Alerts</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input type="checkbox" id="system-alerts" className="rounded" data-testid="checkbox-system-alerts" />
                      <Label htmlFor="system-alerts" className="text-sm">System Alerts</Label>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Test Trade Alerts */}
            <Card data-testid="card-test-alerts" className="col-span-1 lg:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <TestTube className="w-5 h-5" />
                  <span>Test Trade Alert Windows</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Click the buttons below to see example trade alert windows. These large modals appear in the center of your screen whenever trades are executed, sold, or your portfolio reaches milestones.
                  </p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Button 
                      onClick={testBuyAlert} 
                      className="w-full bg-green-600 hover:bg-green-700"
                      data-testid="button-test-buy"
                    >
                      Test Buy Alert
                    </Button>
                    
                    <Button 
                      onClick={testSellAlert} 
                      className="w-full bg-blue-600 hover:bg-blue-700"
                      data-testid="button-test-sell"
                    >
                      Test Sell Alert
                    </Button>
                    
                    <Button 
                      onClick={testMilestoneAlert} 
                      className="w-full bg-yellow-600 hover:bg-yellow-700"
                      data-testid="button-test-milestone"
                    >
                      Test Milestone Alert
                    </Button>
                  </div>
                  
                  <div className="bg-muted/50 rounded-lg p-4 mt-4">
                    <h4 className="font-semibold mb-2">What you'll see:</h4>
                    <ul className="text-sm space-y-1 text-muted-foreground">
                      <li>• <strong>Buy Alerts:</strong> Green modal showing token, amount, price, and total investment</li>
                      <li>• <strong>Sell Alerts:</strong> Blue/Red modal with profit/loss breakdown and percentage</li>
                      <li>• <strong>Milestone Alerts:</strong> Yellow celebration modal for 10%, 25%, 50%, 100% gains</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Save Settings */}
          <div className="flex justify-end">
            <Button onClick={handleSaveSettings} data-testid="button-save-settings">
              Save Settings
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}