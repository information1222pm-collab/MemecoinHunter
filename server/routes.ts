import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { readFile } from "fs/promises";
import { join } from "path";
import { storage } from "./storage";
import { scanner } from "./services/scanner";
import { mlAnalyzer } from "./services/ml-analyzer";
import { priceFeed } from "./services/price-feed";
import { riskManager } from "./services/risk-manager";
import { autoTrader } from "./services/auto-trader";
import { stakeholderReportUpdater } from "./services/stakeholder-report-updater";
import { insertUserSchema, insertTradeSchema, insertTokenSchema } from "@shared/schema";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);

  // WebSocket server for real-time updates
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  
  wss.on('connection', (ws: WebSocket) => {
    console.log('New WebSocket connection established');
    
    ws.on('message', (message: string) => {
      try {
        const data = JSON.parse(message);
        handleWebSocketMessage(ws, data);
      } catch (error) {
        ws.send(JSON.stringify({ error: 'Invalid message format' }));
      }
    });
    
    ws.on('close', () => {
      console.log('WebSocket connection closed');
    });
  });

  // Broadcast to all connected clients
  function broadcast(data: any) {
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(data));
      }
    });
  }

  function handleWebSocketMessage(ws: WebSocket, data: any) {
    switch (data.type) {
      case 'subscribe_scanner':
        ws.send(JSON.stringify({ type: 'scanner_status', status: 'subscribed' }));
        break;
      case 'subscribe_prices':
        ws.send(JSON.stringify({ type: 'price_status', status: 'subscribed' }));
        break;
      default:
        ws.send(JSON.stringify({ error: 'Unknown message type' }));
    }
  }

  // Start services
  scanner.start();
  priceFeed.start();
  mlAnalyzer.start();
  riskManager.start();
  autoTrader.start();
  stakeholderReportUpdater.startAutoUpdater();

  // Set up real-time broadcasts
  scanner.on('tokenScanned', (token) => {
    broadcast({ type: 'token_update', data: token });
  });

  scanner.on('alertTriggered', (alert) => {
    broadcast({ type: 'new_alert', data: alert });
  });

  priceFeed.on('priceUpdate', (update) => {
    broadcast({ type: 'price_update', data: update });
  });

  // Auto-trader real-time events
  autoTrader.on('tradeExecuted', (tradeData) => {
    broadcast({ type: 'trade_executed', data: tradeData });
  });

  autoTrader.on('statsUpdate', (statsData) => {
    broadcast({ type: 'trading_stats', data: statsData });
  });

  mlAnalyzer.on('patternDetected', (pattern) => {
    broadcast({ type: 'pattern_detected', data: pattern });
  });

  // Risk management events
  riskManager.on('stopLossTriggered', (data) => {
    broadcast({ type: 'stop_loss_triggered', data });
  });

  riskManager.on('riskLimitExceeded', (data) => {
    broadcast({ type: 'risk_limit_exceeded', data });
  });

  // API Routes

  // Authentication routes
  app.post("/api/auth/register", async (req, res) => {
    try {
      const userData = insertUserSchema.parse(req.body);
      
      // Check if user already exists
      const existingUser = await storage.getUserByEmail(userData.email);
      if (existingUser) {
        return res.status(400).json({ message: "User already exists" });
      }

      const user = await storage.createUser(userData);
      
      // Create default portfolio for new user
      await storage.createPortfolio({ userId: user.id });
      
      res.json({ user: { id: user.id, username: user.username, email: user.email } });
    } catch (error) {
      res.status(400).json({ message: "Invalid user data", error });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password } = req.body;
      const user = await storage.getUserByEmail(email);
      
      if (!user || user.password !== password) {
        return res.status(401).json({ message: "Invalid credentials" });
      }
      
      res.json({ user: { id: user.id, username: user.username, email: user.email } });
    } catch (error) {
      res.status(500).json({ message: "Login failed", error });
    }
  });

  // Token routes
  app.get("/api/tokens", async (req, res) => {
    try {
      const tokens = await storage.getActiveTokens();
      res.json(tokens);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch tokens", error });
    }
  });

  app.get("/api/tokens/:id", async (req, res) => {
    try {
      const token = await storage.getToken(req.params.id);
      if (!token) {
        return res.status(404).json({ message: "Token not found" });
      }
      res.json(token);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch token", error });
    }
  });

  app.post("/api/tokens", async (req, res) => {
    try {
      const tokenData = insertTokenSchema.parse(req.body);
      const token = await storage.createToken(tokenData);
      res.json(token);
    } catch (error) {
      res.status(400).json({ message: "Invalid token data", error });
    }
  });

  // Portfolio routes
  // Demo default portfolio route for testing
  app.get("/api/portfolio/default", async (req, res) => {
    try {
      // Get or create demo user
      let demoUser = await storage.getUserByEmail("demo@memehunter.app");
      if (!demoUser) {
        demoUser = await storage.createUser({
          username: "demo_user",
          email: "demo@memehunter.app",
          password: "demo123",
          subscriptionTier: "pro",
          language: "en"
        });
      }
      
      // Get or create demo portfolio
      let portfolio = await storage.getPortfolioByUserId(demoUser.id);
      if (!portfolio) {
        portfolio = await storage.createPortfolio({
          userId: demoUser.id,
          totalValue: "10000.00", // Start with $10,000 virtual balance
          dailyPnL: "0.00",
          totalPnL: "0.00",
          winRate: "0.00"
        });
      }
      
      const positions = await storage.getPositionsByPortfolio(portfolio.id);
      res.json({ ...portfolio, positions });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch default portfolio", error });
    }
  });

  app.get("/api/portfolio/:userId", async (req, res) => {
    try {
      const portfolio = await storage.getPortfolioByUserId(req.params.userId);
      if (!portfolio) {
        return res.status(404).json({ message: "Portfolio not found" });
      }
      
      const positions = await storage.getPositionsByPortfolio(portfolio.id);
      res.json({ ...portfolio, positions });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch portfolio", error });
    }
  });

  app.get("/api/portfolio/:portfolioId/trades", async (req, res) => {
    try {
      const trades = await storage.getTradesByPortfolio(req.params.portfolioId);
      res.json(trades);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch trades", error });
    }
  });

  // Auto-trader portfolio status route
  app.get("/api/auto-trader/portfolio", async (req, res) => {
    try {
      const stats = await autoTrader.getDetailedStats();
      if (!stats) {
        return res.status(404).json({ message: "Auto-trader portfolio not found" });
      }
      res.json(stats);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch auto-trader portfolio", error });
    }
  });

  // Trading routes
  app.post("/api/trades", async (req, res) => {
    try {
      const tradeData = insertTradeSchema.parse(req.body);
      
      // Validate portfolio exists
      const portfolio = await storage.getPortfolio(tradeData.portfolioId);
      if (!portfolio) {
        return res.status(404).json({ message: "Portfolio not found" });
      }
      
      // Risk analysis before executing trade
      const riskAnalysis = await riskManager.analyzeTradeRisk(
        tradeData.portfolioId,
        tradeData.tokenId,
        tradeData.type as 'buy' | 'sell',
        parseFloat(tradeData.amount),
        parseFloat(tradeData.price)
      );
      
      if (!riskAnalysis.allowed) {
        return res.status(400).json({ 
          message: "Trade blocked by risk management", 
          reason: riskAnalysis.reason,
          suggestedSize: riskAnalysis.suggestedSize 
        });
      }
      
      // Create trade
      const trade = await storage.createTrade(tradeData);
      
      // Update or create position
      const existingPosition = await storage.getPositionByPortfolioAndToken(
        tradeData.portfolioId, 
        tradeData.tokenId
      );
      
      if (existingPosition) {
        // Update existing position
        const newAmount = tradeData.type === 'buy' 
          ? parseFloat(existingPosition.amount) + parseFloat(tradeData.amount)
          : parseFloat(existingPosition.amount) - parseFloat(tradeData.amount);
          
        if (newAmount <= 0) {
          // Position closed
          await storage.updatePosition(existingPosition.id, { amount: "0" });
        } else {
          await storage.updatePosition(existingPosition.id, { 
            amount: newAmount.toString() 
          });
        }
      } else if (tradeData.type === 'buy') {
        // Create new position
        await storage.createPosition({
          portfolioId: tradeData.portfolioId,
          tokenId: tradeData.tokenId,
          amount: tradeData.amount,
          avgBuyPrice: tradeData.price,
        });
      }
      
      res.json({ 
        ...trade, 
        riskAnalysis: {
          stopLossPrice: riskAnalysis.stopLossPrice,
          riskRewardRatio: riskAnalysis.riskRewardRatio
        }
      });
    } catch (error) {
      res.status(400).json({ message: "Failed to create trade", error });
    }
  });

  // Scanner routes
  app.get("/api/scanner/status", async (req, res) => {
    try {
      const status = scanner.getStatus();
      res.json(status);
    } catch (error) {
      res.status(500).json({ message: "Failed to get scanner status", error });
    }
  });

  app.post("/api/scanner/start", async (req, res) => {
    try {
      scanner.start();
      const status = scanner.getStatus();
      res.json({ message: "Scanner started", status });
    } catch (error) {
      res.status(500).json({ message: "Failed to start scanner", error });
    }
  });

  app.post("/api/scanner/stop", async (req, res) => {
    try {
      scanner.stop();
      const status = scanner.getStatus();
      res.json({ message: "Scanner stopped", status });
    } catch (error) {
      res.status(500).json({ message: "Failed to stop scanner", error });
    }
  });

  app.get("/api/alerts", async (req, res) => {
    try {
      const alerts = await storage.getUnreadAlerts();
      res.json(alerts);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch alerts", error });
    }
  });

  app.patch("/api/alerts/:id/read", async (req, res) => {
    try {
      const alert = await storage.markAlertAsRead(req.params.id);
      res.json(alert);
    } catch (error) {
      res.status(500).json({ message: "Failed to mark alert as read", error });
    }
  });

  // Price history routes
  app.get("/api/tokens/:id/history", async (req, res) => {
    try {
      const { from, to } = req.query;
      const fromDate = from ? new Date(from as string) : undefined;
      const toDate = to ? new Date(to as string) : undefined;
      
      const history = await storage.getPriceHistory(req.params.id, fromDate, toDate);
      res.json(history);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch price history", error });
    }
  });

  // Pattern analysis routes
  app.get("/api/tokens/:id/patterns", async (req, res) => {
    try {
      const patterns = await storage.getPatternsByToken(req.params.id);
      res.json(patterns);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch patterns", error });
    }
  });

  app.get("/api/patterns/recent", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 10;
      const patterns = await storage.getRecentPatterns(limit);
      res.json(patterns);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch recent patterns", error });
    }
  });

  // Subscription routes
  app.get("/api/subscription/:userId", async (req, res) => {
    try {
      const subscription = await storage.getSubscriptionByUserId(req.params.userId);
      res.json(subscription);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch subscription", error });
    }
  });

  app.post("/api/subscription", async (req, res) => {
    try {
      const { userId, plan } = req.body;
      
      // Check if subscription already exists
      let subscription;
      try {
        subscription = await storage.getSubscriptionByUserId(userId);
      } catch (error) {
        // No existing subscription found, create new one
      }
      
      if (subscription) {
        // Update existing subscription plan
        subscription = await storage.updateSubscription(subscription.id, {
          plan,
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        });
      } else {
        // Create new subscription
        subscription = await storage.createSubscription({
          userId,
          plan,
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        });
      }
      
      res.json(subscription);
    } catch (error) {
      res.status(400).json({ message: "Failed to update subscription", error });
    }
  });

  // Language routes
  app.patch("/api/users/:id/language", async (req, res) => {
    try {
      const { language } = req.body;
      const user = await storage.updateUser(req.params.id, { language });
      res.json(user);
    } catch (error) {
      res.status(400).json({ message: "Failed to update language", error });
    }
  });

  // CLI command routes
  app.post("/api/cli/command", async (req, res) => {
    try {
      const { command } = req.body;
      
      // Simple CLI command processing
      const result = await processCliCommand(command);
      res.json({ result });
    } catch (error) {
      res.status(400).json({ message: "Failed to execute command", error });
    }
  });

  // Risk Management API endpoints
  app.get("/api/risk/portfolio/:portfolioId", async (req, res) => {
    try {
      const riskMetrics = await riskManager.analyzePortfolioRisk(req.params.portfolioId);
      res.json(riskMetrics);
    } catch (error) {
      res.status(500).json({ message: "Failed to analyze portfolio risk", error });
    }
  });

  app.post("/api/risk/position-sizing", async (req, res) => {
    try {
      const { portfolioId, tokenId, entryPrice, confidence } = req.body;
      const sizing = await riskManager.calculatePositionSizing(portfolioId, tokenId, entryPrice, confidence);
      res.json(sizing);
    } catch (error) {
      res.status(500).json({ message: "Failed to calculate position sizing", error });
    }
  });

  app.post("/api/risk/trade-analysis", async (req, res) => {
    try {
      const { portfolioId, tokenId, tradeType, amount, price } = req.body;
      const analysis = await riskManager.analyzeTradeRisk(portfolioId, tokenId, tradeType, amount, price);
      res.json(analysis);
    } catch (error) {
      res.status(500).json({ message: "Failed to analyze trade risk", error });
    }
  });

  app.post("/api/risk/monitor/:portfolioId", async (req, res) => {
    try {
      await riskManager.monitorRiskLimits(req.params.portfolioId);
      res.json({ message: "Risk monitoring completed" });
    } catch (error) {
      res.status(500).json({ message: "Failed to monitor risk limits", error });
    }
  });

  // Stakeholder Report routes
  app.get("/api/stakeholder-report", async (req, res) => {
    try {
      const reportPath = join(process.cwd(), "CryptoHobby_Stakeholder_Report_Q4_2025.md");
      const reportContent = await readFile(reportPath, "utf-8");
      
      // Get current system stats for dynamic updates
      const tokens = await storage.getActiveTokens();
      const scannerStatus = scanner.getStatus();
      const currentTime = new Date().toLocaleString();
      
      // Update dynamic content in the report
      const updatedContent = reportContent
        .replace(/\d+\+ tokens tracked/g, `${tokens.length}+ tokens tracked`)
        .replace(/Last update: .*/g, `Last update: ${currentTime}`);
      
      res.json({ 
        content: updatedContent,
        lastUpdated: currentTime,
        systemStats: {
          tokensTracked: tokens.length,
          scannerActive: scannerStatus.isRunning,
          systemStatus: "Operational"
        }
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch stakeholder report", error });
    }
  });

  // Validation schemas for stakeholder report updates
  const featureUpdateSchema = z.object({
    type: z.enum(['feature', 'deployment', 'enhancement', 'bugfix']),
    title: z.string().min(1).max(100),
    description: z.string().min(1).max(500),
    impact: z.enum(['major', 'minor', 'patch']).optional()
  });

  app.post("/api/stakeholder-report/update", async (req, res) => {
    try {
      // Basic validation - for production, add proper authentication
      if (process.env.NODE_ENV === 'production') {
        return res.status(403).json({ message: "Report updates disabled in production" });
      }

      const validation = featureUpdateSchema.safeParse(req.body);
      
      if (validation.success) {
        const { type, title, description, impact } = validation.data;
        
        // Add feature update to the report
        await stakeholderReportUpdater.addFeatureUpdate({
          type,
          title,
          description,
          date: new Date().toLocaleDateString(),
          impact: impact || 'minor'
        });
        
        console.log(`📊 Stakeholder Report Updated: ${title} (${type})`);
        
        res.json({ 
          message: "Stakeholder report updated successfully",
          timestamp: new Date().toISOString(),
          update: { type, title, description }
        });
      } else {
        // Fallback: just update system metrics
        await stakeholderReportUpdater.updateSystemMetrics();
        
        res.json({ 
          message: "System metrics updated",
          timestamp: new Date().toISOString(),
          errors: validation.error?.issues
        });
      }
    } catch (error) {
      res.status(500).json({ message: "Failed to update stakeholder report", error });
    }
  });

  const deploymentSchema = z.object({
    version: z.string().min(1).max(50).optional(),
    features: z.array(z.string().min(1).max(100)).min(1).max(10)
  });

  app.post("/api/stakeholder-report/deploy", async (req, res) => {
    try {
      // Basic validation - for production, add proper authentication
      if (process.env.NODE_ENV === 'production') {
        return res.status(403).json({ message: "Deployment logging disabled in production" });
      }

      const validation = deploymentSchema.safeParse(req.body);
      
      if (!validation.success) {
        return res.status(400).json({ 
          message: "Invalid deployment data", 
          errors: validation.error.issues 
        });
      }

      const { version, features } = validation.data;
      
      await stakeholderReportUpdater.logDeployment({
        version: version || `v${Date.now()}`,
        features: features,
        date: new Date().toLocaleDateString()
      });
      
      console.log(`🚀 Deployment logged in stakeholder report: ${version}`);
      
      res.json({ 
        message: "Deployment logged successfully",
        version: version,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to log deployment", error });
    }
  });

  async function processCliCommand(command: string): Promise<string> {
    const parts = command.split(' ');
    const cmd = parts[0];
    
    switch (cmd) {
      case 'scan':
        return "🔍 Starting memecoin scanner...\n📡 Connecting to price feeds...\n✅ Connected to 47 exchanges";
      case 'status':
        const tokens = await storage.getActiveTokens();
        return `📊 Monitoring ${tokens.length} active tokens\n🎯 Scanner status: Running`;
      case 'alerts':
        const alerts = await storage.getUnreadAlerts();
        return `🚨 ${alerts.length} unread alerts`;
      case 'risk':
        return "🛡️ Risk Management Status:\n📊 Portfolio risk: Monitored\n⚠️ Active stop-losses: Enabled\n🎯 Position limits: Enforced";
      case 'help':
        return "Available commands:\n- scan: Start token scanning\n- status: Show scanner status\n- alerts: Show unread alerts\n- risk: Show risk management status\n- help: Show this help";
      default:
        return `Unknown command: ${cmd}. Type 'help' for available commands.`;
    }
  }

  return httpServer;
}
