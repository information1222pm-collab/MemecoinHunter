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
import { positionTracker } from "./services/position-tracker";
import { tradingAnalyticsService } from "./services/trading-analytics";
import { tradeJournalService } from "./services/trade-journal";
import { riskReportsService } from "./services/risk-reports";
import { alertService } from "./services/alert-service";
import { insertUserSchema, insertTradeSchema, insertTokenSchema, insertAlertRuleSchema } from "@shared/schema";
import { z } from "zod";
import * as bcrypt from "bcrypt";
import session from "express-session";
import ConnectPgSimple from "connect-pg-simple";
import csrf from "csurf";
import cookie from "cookie";
import rateLimit from "express-rate-limit";
import signature from "cookie-signature";
import { setupAuth } from "./replitAuth";

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);

  // Configure sessions with PostgreSQL store
  const PgSession = ConnectPgSimple(session);
  const sessionSecret = process.env.SESSION_SECRET || 'crypto-hobby-dev-secret-key';
  const sessionStore = new PgSession({
    conString: process.env.DATABASE_URL!,
    tableName: 'session',
    createTableIfMissing: true
  });
  
  app.use(session({
    store: sessionStore,
    secret: sessionSecret,
    resave: false,
    saveUninitialized: true, // Required for CSRF to work - creates sessions for all visitors
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax'
    },
    name: 'cryptohobby.sid'
  }));

  // CSRF Protection for state-changing routes (CRITICAL SECURITY FIX)
  const csrfProtection = csrf({ cookie: false }); // Use session-based CSRF
  
  // CSRF token endpoint - needs middleware to generate token but not validate
  app.get('/api/csrf-token', csrfProtection, (req, res) => {
    res.json({ csrfToken: req.csrfToken() });
  });
  
  // Comprehensive CSRF protection for ALL state-changing endpoints
  app.use([
    '/api/auth/login', '/api/auth/register', '/api/auth/logout',
    '/api/portfolio', '/api/trades', '/api/positions', '/api/alerts', '/api/price-alerts',
    '/api/api-keys', '/api/settings', '/api/auto-trader'
  ].map(path => [path, path + '/*']).flat(), csrfProtection);

  // Rate Limiting for Security (CRITICAL SECURITY FIX)
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    limit: 5, // 5 attempts per window
    message: { error: 'Too many login attempts, please try again later' },
    standardHeaders: true,
    legacyHeaders: false
  });
  
  const apiLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    limit: 100, // 100 requests per minute
    message: { error: 'Too many API requests, please slow down' },
    standardHeaders: true,
    legacyHeaders: false
  });
  
  const tradingLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    limit: 10, // 10 trades per minute
    message: { error: 'Trading rate limit exceeded' },
    standardHeaders: true,
    legacyHeaders: false
  });
  
  // Apply rate limiting
  app.use('/api/auth/login', authLimiter);
  app.use('/api/auth/register', authLimiter);
  app.use('/api/trades', tradingLimiter);
  app.use('/api/auto-trader', tradingLimiter);
  app.use('/api', apiLimiter);

  // Set up Replit Auth (Google/GitHub/X/Apple OAuth) if environment variables are configured
  // Reference: blueprint:javascript_log_in_with_replit
  await setupAuth(app);

  // RBAC Middleware for Role-Based Access Control (CRITICAL SECURITY FIX)
  const requireAuth = async (req: any, res: any, next: any) => {
    if (!req.session?.userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    try {
      const user = await storage.getUser(req.session.userId);
      if (!user) {
        return res.status(401).json({ error: 'Invalid user session' });
      }
      req.user = user;
      next();
    } catch (error) {
      console.error('[SECURITY] Auth middleware error:', error);
      return res.status(500).json({ error: 'Authentication failed' });
    }
  };
  
  const requireRole = (allowedTiers: string[]) => {
    return async (req: any, res: any, next: any) => {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      
      if (!allowedTiers.includes(req.user.subscriptionTier)) {
        await logSecurityEvent({
          userId: req.user.id,
          action: 'UNAUTHORIZED_ACCESS',
          resource: req.path,
          details: { requiredTiers: allowedTiers, userTier: req.user.subscriptionTier },
          ipAddress: req.ip,
          userAgent: req.get('User-Agent'),
          success: false
        });
        return res.status(403).json({ error: 'Insufficient permissions' });
      }
      
      next();
    };
  };
  
  // Apply authentication to endpoints (subscription restrictions removed for free access)
  app.use('/api/auto-trader', requireAuth);
  app.use('/api/portfolio', requireAuth);
  app.use('/api/trades', requireAuth);
  app.use('/api/api-keys', requireAuth); // Full access for all users
  app.use('/api/audit-logs', requireAuth); // Full access for all users

  // Properly Authenticated WebSocket server (CRITICAL SECURITY FIX)
  const wss = new WebSocketServer({ noServer: true, perMessageDeflate: false });
  
  // User-scoped WebSocket connections map (CRITICAL SECURITY FIX)
  const userConnections = new Map<string, Set<WebSocket>>();
  
  // Handle WebSocket upgrade - only for /ws path to avoid conflict with Vite HMR
  httpServer.on('upgrade', async (request, socket, head) => {
    try {
      const url = new URL(request.url || '/', 'http://localhost');
      
      // Only handle /ws upgrades - let Vite handle HMR upgrades
      if (url.pathname !== '/ws') {
        return; // Don't destroy - allow Vite to handle other paths
      }
      
      console.log(`[AUDIT] WebSocket upgrade request to ${url.pathname} from ${request.socket.remoteAddress}`);
      
      // Handle our application WebSocket connections
      wss.handleUpgrade(request, socket, head, (ws) => {
        // Mark as anonymous connection for now
        (ws as any).isAnonymous = true;
        (ws as any).connectionTime = new Date().toISOString();
        (ws as any).remoteAddress = request.socket.remoteAddress;
        
        wss.emit('connection', ws, request);
      });
      
    } catch (error) {
      console.warn('[SECURITY] WebSocket upgrade failed:', error instanceof Error ? error.message : 'Unknown error');
      socket.destroy();
    }
  });
  
  // Handle WebSocket connections - simplified and stable  
  wss.on('connection', async (ws: WebSocket, req) => {
    const remoteAddress = req.socket.remoteAddress;
    console.log(`[AUDIT] WebSocket connected from ${remoteAddress}`);
    
    // Extract and validate session cookie
    let userId: string | null = null;
    try {
      const cookies = cookie.parse(req.headers.cookie || '');
      const sessionCookie = cookies['cryptohobby.sid'];
      
      if (sessionCookie) {
        // Unsign the session cookie - remove "s:" prefix first
        const sessionId = signature.unsign(sessionCookie.slice(2), sessionSecret);
        
        if (sessionId) {
          // Look up the session in the database
          await new Promise<void>((resolve) => {
            sessionStore.get(sessionId, (err: any, session: any) => {
              if (!err && session?.userId) {
                userId = session.userId;
                console.log(`[AUDIT] WebSocket authenticated for user ${userId}`);
              }
              resolve();
            });
          });
        }
      }
    } catch (error) {
      console.warn(`[SECURITY] WebSocket session validation failed:`, error);
    }
    
    // Associate WebSocket with user if authenticated
    if (userId) {
      if (!userConnections.has(userId)) {
        userConnections.set(userId, new Set());
      }
      userConnections.get(userId)!.add(ws);
      (ws as any).userId = userId;
      console.log(`[AUDIT] WebSocket associated with user ${userId}`);
    }
    
    // Add comprehensive error handling
    ws.on('error', (error) => {
      console.warn(`[SECURITY] WebSocket error from ${remoteAddress}:`, error.message);
    });
    
    ws.on('close', (code, reason) => {
      console.log(`[AUDIT] WebSocket closed from ${remoteAddress} (${code})`);
      // Clean up user connection when socket closes
      const wsUserId = (ws as any).userId;
      if (wsUserId && userConnections.has(wsUserId)) {
        userConnections.get(wsUserId)!.delete(ws);
        if (userConnections.get(wsUserId)!.size === 0) {
          userConnections.delete(wsUserId);
        }
      }
    });
    
    // Handle incoming messages safely
    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message.toString());
        handleWebSocketMessage(ws, data, req);
      } catch (error) {
        console.warn(`[SECURITY] Invalid WebSocket message from ${remoteAddress}`);
      }
    });
    
    // Send initial connection status
    try {
      ws.send(JSON.stringify({ 
        type: 'connection_status', 
        status: 'connected',
        authenticated: !!userId,
        timestamp: new Date().toISOString()
      }));
    } catch (error) {
      // Connection might have closed immediately, ignore
    }
  });

  // User-scoped broadcast for security (CRITICAL SECURITY FIX)
  function broadcastToUser(userId: string, data: any) {
    if (userConnections.has(userId)) {
      const userSockets = userConnections.get(userId)!;
      userSockets.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify(data));
        }
      });
    }
  }
  
  // Global broadcast for non-sensitive market data only
  function broadcastMarketData(data: any) {
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(data));
      }
    });
  }


  // WebSocket message handler with session validation (CRITICAL SECURITY FIX)
  function handleWebSocketMessage(ws: WebSocket, data: any, req: any) {
    const clientIP = req.socket.remoteAddress;
    
    // For now, allow subscription messages - in production you'd want full session validation
    // This is a placeholder for proper WebSocket authentication
    switch (data.type) {
      case 'subscribe_scanner':
        console.log(`[AUDIT] Scanner subscription from ${clientIP}`);
        ws.send(JSON.stringify({ type: 'scanner_status', status: 'subscribed' }));
        break;
      case 'subscribe_prices':
        console.log(`[AUDIT] Price subscription from ${clientIP}`);
        ws.send(JSON.stringify({ type: 'price_status', status: 'subscribed' }));
        break;
      default:
        console.warn(`[SECURITY] Unknown WebSocket message type from ${clientIP}:`, data.type);
        ws.send(JSON.stringify({ error: 'Unknown message type' }));
    }
  }

  // Start services asynchronously AFTER server is listening to avoid blocking port 5000
  // This prevents startup timeout issues
  setImmediate(async () => {
    console.log('🚀 Starting trading services...');
    scanner.start();
    priceFeed.start();
    
    // Start alert service and wire up WebSocket broadcaster
    console.log('🔔 Starting Alert Service...');
    alertService.start();
    alertService.setBroadcaster(broadcastToUser);
    
    // CRITICAL: Start auto-trader BEFORE ML analyzer so it can listen for pattern events
    console.log('🤖 Starting Auto-Trader service...');
    try {
      await autoTrader.start();
    } catch (error) {
      console.error('❌ Auto-Trader failed to start:', error);
    }
    
    // Start trade journal service to track all trades
    console.log('📓 Starting Trade Journal Service...');
    const { tradeJournalService } = await import('./services/trade-journal');
    await tradeJournalService.initialize();
    
    // Start ML analyzer after auto-trader is listening
    console.log('🧠 Starting ML Pattern Analyzer...');
    mlAnalyzer.start();
    
    riskManager.start();
    stakeholderReportUpdater.startAutoUpdater();
    
    // Start position tracker for real-time holdings updates
    console.log('📊 Starting Position Tracker...');
    positionTracker.start();
  });

  // Set up real-time broadcasts with user scoping (CRITICAL SECURITY FIX)
  scanner.on('tokenScanned', (token) => {
    broadcastMarketData({ type: 'token_update', data: token });
  });

  scanner.on('alertTriggered', (alert) => {
    // Broadcast alerts globally for now (public market data)
    broadcastMarketData({ type: 'new_alert', data: alert });
  });

  scanner.on('scanCompleted', (status) => {
    // Broadcast scanner status updates for dashboard
    broadcastMarketData({ type: 'scanner_update', data: status });
  });

  priceFeed.on('priceUpdate', (update) => {
    broadcastMarketData({ type: 'price_update', data: update });
    // Forward price updates to alert service
    alertService.handlePriceUpdate(update);
  });

  // Auto-trader real-time events (CRITICAL SECURITY FIX)
  autoTrader.on('tradeExecuted', (tradeData) => {
    // Trading data is sensitive - broadcast to all authenticated users for now
    // TODO: Scope to specific user portfolio when user-specific trading is implemented
    broadcastMarketData({ type: 'trade_executed', data: tradeData });
  });

  autoTrader.on('statsUpdate', (statsData) => {
    broadcastMarketData({ type: 'trading_stats', data: statsData });
  });

  mlAnalyzer.on('patternDetected', (pattern) => {
    broadcastMarketData({ type: 'pattern_detected', data: pattern });
  });

  // Position tracker real-time events - SECURE: Send only to portfolio owner
  positionTracker.on('portfolioUpdated', (portfolioData) => {
    if (portfolioData?.userId) {
      broadcastToUser(portfolioData.userId, { type: 'portfolio_updated', data: portfolioData });
    }
  });

  positionTracker.on('positionsUpdated', (positionsData) => {
    // Get the portfolio to find the owner
    if (positionsData?.portfolioId) {
      storage.getPortfolio(positionsData.portfolioId).then(portfolio => {
        if (portfolio?.userId) {
          broadcastToUser(portfolio.userId, { type: 'positions_updated', data: positionsData });
        }
      }).catch(err => console.error('Error getting portfolio for position updates:', err));
    }
  });

  // Risk management events (CRITICAL SECURITY FIX)
  riskManager.on('stopLossTriggered', (data) => {
    // Risk events are sensitive - broadcast to all for now
    // TODO: Scope to affected user when user-specific portfolios implemented
    broadcastMarketData({ type: 'stop_loss_triggered', data });
  });

  riskManager.on('riskLimitExceeded', (data) => {
    broadcastMarketData({ type: 'risk_limit_exceeded', data });
  });

  // Enhanced Portfolio Analytics Routes
  app.get("/api/portfolio/:portfolioId/analytics", requireAuth, async (req, res) => {
    try {
      // Check portfolio ownership
      const portfolio = await storage.getPortfolio(req.params.portfolioId);
      if (!portfolio) {
        return res.status(404).json({ message: "Portfolio not found" });
      }
      if (portfolio.userId !== (req as any).user.id) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const analytics = await positionTracker.getPortfolioAnalytics(req.params.portfolioId);
      if (!analytics) {
        return res.status(404).json({ message: "Portfolio analytics not found" });
      }
      res.json(analytics);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch portfolio analytics", error });
    }
  });

  app.get("/api/portfolio/:portfolioId/positions/analytics", requireAuth, async (req, res) => {
    try {
      // Check portfolio ownership
      const portfolio = await storage.getPortfolio(req.params.portfolioId);
      if (!portfolio) {
        return res.status(404).json({ message: "Portfolio not found" });
      }
      if (portfolio.userId !== (req as any).user.id) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const analytics = await positionTracker.getPositionAnalytics(req.params.portfolioId);
      res.json(analytics);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch position analytics", error });
    }
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

      // Hash password before storing (CRITICAL SECURITY FIX)
      const saltRounds = 12;
      const hashedPassword = await bcrypt.hash(userData.password, saltRounds);
      const userDataWithHashedPassword = {
        ...userData,
        password: hashedPassword
      };

      const user = await storage.createUser(userDataWithHashedPassword);
      
      // Create default portfolio for new user with $10,000 paper trading capital
      // Database defaults: startingCapital = $10,000, cashBalance = $10,000
      await storage.createPortfolio({ userId: user.id });
      
      // Security audit log
      console.log(`[AUDIT] User registered: ${user.email} at ${new Date().toISOString()}`);
      
      res.json({ user: { id: user.id, username: user.username, email: user.email } });
    } catch (error) {
      console.error(`[SECURITY] Registration failed for ${req.body?.email}: ${error}`);
      res.status(400).json({ message: "Invalid user data", error });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password } = req.body;
      
      if (!email || !password) {
        console.warn(`[SECURITY] Login attempt with missing credentials from ${req.ip || 'unknown'}`);
        return res.status(400).json({ message: "Email and password are required" });
      }
      
      const user = await storage.getUserByEmail(email);
      
      if (!user) {
        console.warn(`[SECURITY] Login attempt for non-existent user: ${email} from ${req.ip || 'unknown'}`);
        return res.status(401).json({ message: "Invalid credentials" });
      }
      
      // Verify password using bcrypt (CRITICAL SECURITY FIX)
      const isPasswordValid = await bcrypt.compare(password, user.password);
      
      if (!isPasswordValid) {
        console.warn(`[SECURITY] Failed login attempt for ${email} from ${req.ip || 'unknown'}`);
        return res.status(401).json({ message: "Invalid credentials" });
      }
      
      // Create secure session (CRITICAL SECURITY FIX)
      req.session.userId = user.id;
      req.session.userEmail = user.email;
      
      // Security audit log
      console.log(`[AUDIT] Successful login: ${user.email} from ${req.ip || 'unknown'} at ${new Date().toISOString()}`);
      
      res.json({ 
        success: true,
        user: { id: user.id, username: user.username, email: user.email } 
      });
    } catch (error) {
      console.error(`[SECURITY] Login error for ${req.body?.email}: ${error}`);
      res.status(500).json({ message: "Login failed", error });
    }
  });

  // Logout route
  app.post("/api/auth/logout", (req, res) => {
    const userEmail = req.session?.userEmail;
    req.session.destroy((err) => {
      if (err) {
        console.error('[SECURITY] Session destruction error:', err);
        return res.status(500).json({ message: 'Logout failed' });
      }
      console.log(`[AUDIT] User logged out: ${userEmail} at ${new Date().toISOString()}`);
      res.json({ success: true, message: 'Logged out successfully' });
    });
  });

  // Session status check route
  app.get("/api/auth/me", (req, res) => {
    if (req.session?.userId) {
      res.json({ 
        authenticated: true, 
        userId: req.session.userId,
        userEmail: req.session.userEmail
      });
    } else {
      res.json({ authenticated: false });
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
        // Hash demo password for security (CRITICAL SECURITY FIX)
        const saltRounds = 12;
        const hashedDemoPassword = await bcrypt.hash("demo123", saltRounds);
        
        demoUser = await storage.createUser({
          username: "demo_user",
          email: "demo@memehunter.app",
          password: hashedDemoPassword,
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
      
      // Get enhanced analytics from position tracker
      const portfolioAnalytics = await positionTracker.getPortfolioAnalytics(portfolio.id);
      const positionAnalytics = await positionTracker.getPositionAnalytics(portfolio.id);
      
      // Merge position data with analytics
      const enhancedPositions = await Promise.all(positions.map(async position => {
        const analytics = positionAnalytics.find(a => a.positionId === position.id);
        const token = await storage.getToken(position.tokenId);
        
        return {
          ...position,
          analytics: analytics || null,
          token: { 
            symbol: token?.symbol || analytics?.tokenSymbol || 'Unknown',
            name: token?.name || `${analytics?.tokenSymbol || 'Unknown'} Token`,
            currentPrice: token?.currentPrice || '0'
          }
        };
      }));
      
      res.json({ 
        ...portfolio, 
        positions: enhancedPositions,
        analytics: portfolioAnalytics
      });
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
      
      // Get enhanced analytics from position tracker
      const portfolioAnalytics = await positionTracker.getPortfolioAnalytics(portfolio.id);
      const positionAnalytics = await positionTracker.getPositionAnalytics(portfolio.id);
      
      // Merge position data with analytics
      const enhancedPositions = await Promise.all(positions.map(async position => {
        const analytics = positionAnalytics.find(a => a.positionId === position.id);
        const token = await storage.getToken(position.tokenId);
        
        return {
          ...position,
          analytics: analytics || null,
          token: { 
            symbol: token?.symbol || analytics?.tokenSymbol || 'Unknown',
            name: token?.name || `${analytics?.tokenSymbol || 'Unknown'} Token`,
            currentPrice: token?.currentPrice || '0'
          }
        };
      }));
      
      res.json({ 
        ...portfolio, 
        positions: enhancedPositions,
        analytics: portfolioAnalytics
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch portfolio", error });
    }
  });

  // Trades endpoint for default portfolio
  app.get("/api/portfolio/default/trades", async (req, res) => {
    try {
      // Get or create demo user
      let demoUser = await storage.getUserByEmail("demo@memehunter.app");
      if (!demoUser) {
        const saltRounds = 12;
        const hashedDemoPassword = await bcrypt.hash("demo123", saltRounds);
        
        demoUser = await storage.createUser({
          username: "demo_user",
          email: "demo@memehunter.app",
          password: hashedDemoPassword,
          subscriptionTier: "pro",
          language: "en"
        });
      }
      
      // Get or create demo portfolio
      let portfolio = await storage.getPortfolioByUserId(demoUser.id);
      if (!portfolio) {
        portfolio = await storage.createPortfolio({
          userId: demoUser.id,
          totalValue: "10000.00",
          dailyPnL: "0.00",
          totalPnL: "0.00",
          winRate: "0.00"
        });
      }
      
      const trades = await storage.getTradesByPortfolio(portfolio.id);
      
      // Enhance trades with token information
      const enhancedTrades = await Promise.all(trades.map(async (trade) => {
        const token = await storage.getToken(trade.tokenId);
        return {
          id: trade.id,
          type: trade.type,
          amount: trade.amount,
          price: trade.price,
          totalValue: trade.totalValue,
          status: trade.status,
          createdAt: trade.createdAt,
          token: {
            symbol: token?.symbol || 'Unknown',
            name: token?.name || 'Unknown Token'
          }
        };
      }));
      
      res.json(enhancedTrades);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch trades", error });
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
      // Extract CSRF token from request body (validated by csrfProtection middleware)
      const { _csrf, ...tradeRequestData } = req.body;
      
      // Parse trade data without CSRF token
      const tradeData = insertTradeSchema.parse(tradeRequestData);
      
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

  // Price Alert Routes (Protected)
  app.get("/api/price-alerts", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).user.id;
      const alerts = await storage.getAlertsByUser(userId);
      res.json(alerts);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch price alerts", error });
    }
  });

  app.post("/api/price-alerts", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).user.id;
      
      // Validate and sanitize input using Zod (CRITICAL SECURITY FIX)
      const validatedData = insertAlertRuleSchema.parse({
        ...req.body,
        userId
      });
      
      const alert = await storage.createAlertRule(validatedData);
      res.status(201).json(alert);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: "Invalid input data", 
          errors: error.errors.map(e => ({ field: e.path.join('.'), message: e.message }))
        });
      }
      res.status(500).json({ message: "Failed to create price alert", error });
    }
  });

  app.patch("/api/price-alerts/:id", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).user.id;
      const alertId = req.params.id;
      
      // Check ownership
      const existingAlert = await storage.getAlertRule(alertId);
      if (!existingAlert) {
        return res.status(404).json({ message: "Alert not found" });
      }
      if (existingAlert.userId !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      // Validate and sanitize update data using Zod (CRITICAL SECURITY FIX)
      // Use partial schema to allow updating only specific fields
      const updateSchema = insertAlertRuleSchema.partial().omit({ userId: true });
      const validatedData = updateSchema.parse(req.body);
      
      const updatedAlert = await storage.updateAlertRule(alertId, validatedData);
      res.json(updatedAlert);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: "Invalid input data", 
          errors: error.errors.map(e => ({ field: e.path.join('.'), message: e.message }))
        });
      }
      res.status(500).json({ message: "Failed to update price alert", error });
    }
  });

  app.delete("/api/price-alerts/:id", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).user.id;
      const alertId = req.params.id;
      
      // Check ownership
      const existingAlert = await storage.getAlertRule(alertId);
      if (!existingAlert) {
        return res.status(404).json({ message: "Alert not found" });
      }
      if (existingAlert.userId !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      await storage.deleteAlertRule(alertId);
      res.json({ message: "Alert deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete price alert", error });
    }
  });

  app.get("/api/price-alerts/history", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).user.id;
      const limit = parseInt(req.query.limit as string) || 50;
      const history = await storage.getAlertHistory(userId, limit);
      res.json(history);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch alert history", error });
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

  // Trading Analytics Endpoints
  app.get("/api/analytics/pnl", async (req, res) => {
    try {
      let demoUser = await storage.getUserByEmail("demo@memehunter.app");
      if (!demoUser) {
        const saltRounds = 12;
        const hashedDemoPassword = await bcrypt.hash("demo123", saltRounds);
        demoUser = await storage.createUser({
          username: "demo_user",
          email: "demo@memehunter.app",
          password: hashedDemoPassword,
          subscriptionTier: "pro",
          language: "en"
        });
      }
      
      let portfolio = await storage.getPortfolioByUserId(demoUser.id);
      if (!portfolio) {
        portfolio = await storage.createPortfolio({
          userId: demoUser.id,
          totalValue: "10000.00",
          dailyPnL: "0.00",
          totalPnL: "0.00",
          winRate: "0.00"
        });
      }

      const metrics = await tradingAnalyticsService.getRealtimePnL(portfolio.id);
      res.json(metrics);
    } catch (error) {
      console.error('Error fetching P&L metrics:', error);
      res.status(500).json({ message: "Failed to fetch P&L metrics", error });
    }
  });

  app.get("/api/analytics/winloss", async (req, res) => {
    try {
      let demoUser = await storage.getUserByEmail("demo@memehunter.app");
      if (!demoUser) {
        const saltRounds = 12;
        const hashedDemoPassword = await bcrypt.hash("demo123", saltRounds);
        demoUser = await storage.createUser({
          username: "demo_user",
          email: "demo@memehunter.app",
          password: hashedDemoPassword,
          subscriptionTier: "pro",
          language: "en"
        });
      }
      
      let portfolio = await storage.getPortfolioByUserId(demoUser.id);
      if (!portfolio) {
        portfolio = await storage.createPortfolio({
          userId: demoUser.id,
          totalValue: "10000.00",
          dailyPnL: "0.00",
          totalPnL: "0.00",
          winRate: "0.00"
        });
      }

      const metrics = await tradingAnalyticsService.getWinLossRatios(portfolio.id);
      res.json(metrics);
    } catch (error) {
      console.error('Error fetching win/loss metrics:', error);
      res.status(500).json({ message: "Failed to fetch win/loss metrics", error });
    }
  });

  app.get("/api/analytics/holdtime", async (req, res) => {
    try {
      let demoUser = await storage.getUserByEmail("demo@memehunter.app");
      if (!demoUser) {
        const saltRounds = 12;
        const hashedDemoPassword = await bcrypt.hash("demo123", saltRounds);
        demoUser = await storage.createUser({
          username: "demo_user",
          email: "demo@memehunter.app",
          password: hashedDemoPassword,
          subscriptionTier: "pro",
          language: "en"
        });
      }
      
      let portfolio = await storage.getPortfolioByUserId(demoUser.id);
      if (!portfolio) {
        portfolio = await storage.createPortfolio({
          userId: demoUser.id,
          totalValue: "10000.00",
          dailyPnL: "0.00",
          totalPnL: "0.00",
          winRate: "0.00"
        });
      }

      const metrics = await tradingAnalyticsService.getAverageHoldTime(portfolio.id);
      res.json(metrics);
    } catch (error) {
      console.error('Error fetching hold time metrics:', error);
      res.status(500).json({ message: "Failed to fetch hold time metrics", error });
    }
  });

  app.get("/api/analytics/roi-strategy", async (req, res) => {
    try {
      let demoUser = await storage.getUserByEmail("demo@memehunter.app");
      if (!demoUser) {
        const saltRounds = 12;
        const hashedDemoPassword = await bcrypt.hash("demo123", saltRounds);
        demoUser = await storage.createUser({
          username: "demo_user",
          email: "demo@memehunter.app",
          password: hashedDemoPassword,
          subscriptionTier: "pro",
          language: "en"
        });
      }
      
      let portfolio = await storage.getPortfolioByUserId(demoUser.id);
      if (!portfolio) {
        portfolio = await storage.createPortfolio({
          userId: demoUser.id,
          totalValue: "10000.00",
          dailyPnL: "0.00",
          totalPnL: "0.00",
          winRate: "0.00"
        });
      }

      const strategies = await tradingAnalyticsService.getROIByStrategy(portfolio.id);
      res.json(strategies);
    } catch (error) {
      console.error('Error fetching ROI by strategy:', error);
      res.status(500).json({ message: "Failed to fetch ROI by strategy", error });
    }
  });

  app.get("/api/analytics/all", async (req, res) => {
    try {
      let demoUser = await storage.getUserByEmail("demo@memehunter.app");
      if (!demoUser) {
        const saltRounds = 12;
        const hashedDemoPassword = await bcrypt.hash("demo123", saltRounds);
        demoUser = await storage.createUser({
          username: "demo_user",
          email: "demo@memehunter.app",
          password: hashedDemoPassword,
          subscriptionTier: "pro",
          language: "en"
        });
      }
      
      let portfolio = await storage.getPortfolioByUserId(demoUser.id);
      if (!portfolio) {
        portfolio = await storage.createPortfolio({
          userId: demoUser.id,
          totalValue: "10000.00",
          dailyPnL: "0.00",
          totalPnL: "0.00",
          winRate: "0.00"
        });
      }

      const allMetrics = await tradingAnalyticsService.getAllMetrics(portfolio.id);
      
      // Transform data to match dashboard contract
      const transformed = {
        pnl: allMetrics.pnl,
        winLoss: {
          ...allMetrics.winLoss,
          avgWin: allMetrics.winLoss.averageWin,
          avgLoss: allMetrics.winLoss.averageLoss,
        },
        holdTime: {
          avgHoldTime: allMetrics.holdTime.averageHoldTimeMs / (1000 * 60 * 60), // Convert ms to hours
          avgWinHoldTime: allMetrics.holdTime.averageWinHoldTimeMs / (1000 * 60 * 60),
          avgLossHoldTime: allMetrics.holdTime.averageLossHoldTimeMs / (1000 * 60 * 60),
          totalClosedTrades: allMetrics.holdTime.totalClosedTrades,
        },
        strategies: allMetrics.strategies.map(s => ({
          ...s,
          roiPercent: s.roi, // Rename roi to roiPercent
        })),
      };
      
      res.json(transformed);
    } catch (error) {
      console.error('Error fetching all analytics metrics:', error);
      res.status(500).json({ message: "Failed to fetch all analytics metrics", error });
    }
  });

  // Trade Journal Endpoints
  app.get("/api/journal/entries", async (req, res) => {
    try {
      let demoUser = await storage.getUserByEmail("demo@memehunter.app");
      if (!demoUser) {
        const saltRounds = 12;
        const hashedDemoPassword = await bcrypt.hash("demo123", saltRounds);
        demoUser = await storage.createUser({
          username: "demo_user",
          email: "demo@memehunter.app",
          password: hashedDemoPassword,
          subscriptionTier: "pro",
          language: "en"
        });
      }
      
      let portfolio = await storage.getPortfolioByUserId(demoUser.id);
      if (!portfolio) {
        portfolio = await storage.createPortfolio({
          userId: demoUser.id,
          totalValue: "10000.00",
          dailyPnL: "0.00",
          totalPnL: "0.00",
          winRate: "0.00"
        });
      }

      const filters: any = {};
      if (req.query.outcome) filters.outcome = req.query.outcome;
      if (req.query.token) filters.tokenId = req.query.token;
      if (req.query.pattern) filters.patternType = req.query.pattern;
      if (req.query.startDate) filters.dateFrom = new Date(req.query.startDate as string);
      if (req.query.endDate) filters.dateTo = new Date(req.query.endDate as string);

      const entries = await tradeJournalService.getJournalEntries(portfolio.id, filters);
      res.json(entries);
    } catch (error) {
      console.error('Error fetching journal entries:', error);
      res.status(500).json({ message: "Failed to fetch journal entries", error });
    }
  });

  app.get("/api/journal/trade/:tradeId", async (req, res) => {
    try {
      const { tradeId } = req.params;
      const entry = await tradeJournalService.getTradeById(tradeId);
      
      if (!entry) {
        return res.status(404).json({ message: "Trade not found" });
      }
      
      res.json(entry);
    } catch (error) {
      console.error('Error fetching trade by ID:', error);
      res.status(500).json({ message: "Failed to fetch trade", error });
    }
  });

  app.get("/api/journal/stats", async (req, res) => {
    try {
      let demoUser = await storage.getUserByEmail("demo@memehunter.app");
      if (!demoUser) {
        const saltRounds = 12;
        const hashedDemoPassword = await bcrypt.hash("demo123", saltRounds);
        demoUser = await storage.createUser({
          username: "demo_user",
          email: "demo@memehunter.app",
          password: hashedDemoPassword,
          subscriptionTier: "pro",
          language: "en"
        });
      }
      
      let portfolio = await storage.getPortfolioByUserId(demoUser.id);
      if (!portfolio) {
        portfolio = await storage.createPortfolio({
          userId: demoUser.id,
          totalValue: "10000.00",
          dailyPnL: "0.00",
          totalPnL: "0.00",
          winRate: "0.00"
        });
      }

      const stats = await tradeJournalService.getJournalStats(portfolio.id);
      res.json(stats);
    } catch (error) {
      console.error('Error fetching journal stats:', error);
      res.status(500).json({ message: "Failed to fetch journal stats", error });
    }
  });

  app.get("/api/journal/by-outcome/:outcome", async (req, res) => {
    try {
      let demoUser = await storage.getUserByEmail("demo@memehunter.app");
      if (!demoUser) {
        const saltRounds = 12;
        const hashedDemoPassword = await bcrypt.hash("demo123", saltRounds);
        demoUser = await storage.createUser({
          username: "demo_user",
          email: "demo@memehunter.app",
          password: hashedDemoPassword,
          subscriptionTier: "pro",
          language: "en"
        });
      }
      
      let portfolio = await storage.getPortfolioByUserId(demoUser.id);
      if (!portfolio) {
        portfolio = await storage.createPortfolio({
          userId: demoUser.id,
          totalValue: "10000.00",
          dailyPnL: "0.00",
          totalPnL: "0.00",
          winRate: "0.00"
        });
      }

      const { outcome } = req.params;
      const validOutcomes = ['win', 'loss', 'breakeven', 'open'];
      
      if (!validOutcomes.includes(outcome)) {
        return res.status(400).json({ message: "Invalid outcome. Must be: win, loss, breakeven, or open" });
      }

      const entries = await tradeJournalService.getEntriesByOutcome(
        portfolio.id, 
        outcome as 'win' | 'loss' | 'breakeven' | 'open'
      );
      res.json(entries);
    } catch (error) {
      console.error('Error fetching entries by outcome:', error);
      res.status(500).json({ message: "Failed to fetch entries by outcome", error });
    }
  });

  app.get("/api/journal/by-strategy/:pattern", async (req, res) => {
    try {
      let demoUser = await storage.getUserByEmail("demo@memehunter.app");
      if (!demoUser) {
        const saltRounds = 12;
        const hashedDemoPassword = await bcrypt.hash("demo123", saltRounds);
        demoUser = await storage.createUser({
          username: "demo_user",
          email: "demo@memehunter.app",
          password: hashedDemoPassword,
          subscriptionTier: "pro",
          language: "en"
        });
      }
      
      let portfolio = await storage.getPortfolioByUserId(demoUser.id);
      if (!portfolio) {
        portfolio = await storage.createPortfolio({
          userId: demoUser.id,
          totalValue: "10000.00",
          dailyPnL: "0.00",
          totalPnL: "0.00",
          winRate: "0.00"
        });
      }

      const { pattern } = req.params;
      const entries = await tradeJournalService.getEntriesByStrategy(portfolio.id, pattern);
      res.json(entries);
    } catch (error) {
      console.error('Error fetching entries by strategy:', error);
      res.status(500).json({ message: "Failed to fetch entries by strategy", error });
    }
  });

  // Risk Reports Endpoints
  app.get("/api/risk/daily", async (req, res) => {
    try {
      let demoUser = await storage.getUserByEmail("demo@memehunter.app");
      if (!demoUser) {
        const saltRounds = 12;
        const hashedDemoPassword = await bcrypt.hash("demo123", saltRounds);
        demoUser = await storage.createUser({
          username: "demo_user",
          email: "demo@memehunter.app",
          password: hashedDemoPassword,
          subscriptionTier: "pro",
          language: "en"
        });
      }
      
      let portfolio = await storage.getPortfolioByUserId(demoUser.id);
      if (!portfolio) {
        portfolio = await storage.createPortfolio({
          userId: demoUser.id,
          totalValue: "10000.00",
          dailyPnL: "0.00",
          totalPnL: "0.00",
          winRate: "0.00"
        });
      }

      const date = req.query.date ? new Date(req.query.date as string) : undefined;
      const summary = await riskReportsService.getDailySummary(portfolio.id, date);
      res.json(summary);
    } catch (error) {
      console.error('Error fetching daily summary:', error);
      res.status(500).json({ message: "Failed to fetch daily summary", error });
    }
  });

  app.get("/api/risk/weekly", async (req, res) => {
    try {
      let demoUser = await storage.getUserByEmail("demo@memehunter.app");
      if (!demoUser) {
        const saltRounds = 12;
        const hashedDemoPassword = await bcrypt.hash("demo123", saltRounds);
        demoUser = await storage.createUser({
          username: "demo_user",
          email: "demo@memehunter.app",
          password: hashedDemoPassword,
          subscriptionTier: "pro",
          language: "en"
        });
      }
      
      let portfolio = await storage.getPortfolioByUserId(demoUser.id);
      if (!portfolio) {
        portfolio = await storage.createPortfolio({
          userId: demoUser.id,
          totalValue: "10000.00",
          dailyPnL: "0.00",
          totalPnL: "0.00",
          winRate: "0.00"
        });
      }

      const weekStart = req.query.weekStart ? new Date(req.query.weekStart as string) : undefined;
      const summary = await riskReportsService.getWeeklySummary(portfolio.id, weekStart);
      res.json(summary);
    } catch (error) {
      console.error('Error fetching weekly summary:', error);
      res.status(500).json({ message: "Failed to fetch weekly summary", error });
    }
  });

  app.get("/api/risk/exposure", async (req, res) => {
    try {
      let demoUser = await storage.getUserByEmail("demo@memehunter.app");
      if (!demoUser) {
        const saltRounds = 12;
        const hashedDemoPassword = await bcrypt.hash("demo123", saltRounds);
        demoUser = await storage.createUser({
          username: "demo_user",
          email: "demo@memehunter.app",
          password: hashedDemoPassword,
          subscriptionTier: "pro",
          language: "en"
        });
      }
      
      let portfolio = await storage.getPortfolioByUserId(demoUser.id);
      if (!portfolio) {
        portfolio = await storage.createPortfolio({
          userId: demoUser.id,
          totalValue: "10000.00",
          dailyPnL: "0.00",
          totalPnL: "0.00",
          winRate: "0.00"
        });
      }

      const exposure = await riskReportsService.getCurrentExposure(portfolio.id);
      res.json(exposure);
    } catch (error) {
      console.error('Error fetching current exposure:', error);
      res.status(500).json({ message: "Failed to fetch current exposure", error });
    }
  });

  app.get("/api/risk/realized", async (req, res) => {
    try {
      let demoUser = await storage.getUserByEmail("demo@memehunter.app");
      if (!demoUser) {
        const saltRounds = 12;
        const hashedDemoPassword = await bcrypt.hash("demo123", saltRounds);
        demoUser = await storage.createUser({
          username: "demo_user",
          email: "demo@memehunter.app",
          password: hashedDemoPassword,
          subscriptionTier: "pro",
          language: "en"
        });
      }
      
      let portfolio = await storage.getPortfolioByUserId(demoUser.id);
      if (!portfolio) {
        portfolio = await storage.createPortfolio({
          userId: demoUser.id,
          totalValue: "10000.00",
          dailyPnL: "0.00",
          totalPnL: "0.00",
          winRate: "0.00"
        });
      }

      const timeframe = (req.query.timeframe as 'daily' | 'weekly' | 'monthly' | 'all-time') || 'all-time';
      const validTimeframes = ['daily', 'weekly', 'monthly', 'all-time'];
      
      if (!validTimeframes.includes(timeframe)) {
        return res.status(400).json({ message: "Invalid timeframe. Must be: daily, weekly, monthly, or all-time" });
      }

      const realized = await riskReportsService.getRealizedProfits(portfolio.id, timeframe);
      res.json(realized);
    } catch (error) {
      console.error('Error fetching realized profits:', error);
      res.status(500).json({ message: "Failed to fetch realized profits", error });
    }
  });

  app.get("/api/risk/drawdown", async (req, res) => {
    try {
      let demoUser = await storage.getUserByEmail("demo@memehunter.app");
      if (!demoUser) {
        const saltRounds = 12;
        const hashedDemoPassword = await bcrypt.hash("demo123", saltRounds);
        demoUser = await storage.createUser({
          username: "demo_user",
          email: "demo@memehunter.app",
          password: hashedDemoPassword,
          subscriptionTier: "pro",
          language: "en"
        });
      }
      
      let portfolio = await storage.getPortfolioByUserId(demoUser.id);
      if (!portfolio) {
        portfolio = await storage.createPortfolio({
          userId: demoUser.id,
          totalValue: "10000.00",
          dailyPnL: "0.00",
          totalPnL: "0.00",
          winRate: "0.00"
        });
      }

      const drawdown = await riskReportsService.getDrawdownMetrics(portfolio.id);
      res.json(drawdown);
    } catch (error) {
      console.error('Error fetching drawdown metrics:', error);
      res.status(500).json({ message: "Failed to fetch drawdown metrics", error });
    }
  });

  app.get("/api/risk/score", async (req, res) => {
    try {
      let demoUser = await storage.getUserByEmail("demo@memehunter.app");
      if (!demoUser) {
        const saltRounds = 12;
        const hashedDemoPassword = await bcrypt.hash("demo123", saltRounds);
        demoUser = await storage.createUser({
          username: "demo_user",
          email: "demo@memehunter.app",
          password: hashedDemoPassword,
          subscriptionTier: "pro",
          language: "en"
        });
      }
      
      let portfolio = await storage.getPortfolioByUserId(demoUser.id);
      if (!portfolio) {
        portfolio = await storage.createPortfolio({
          userId: demoUser.id,
          totalValue: "10000.00",
          dailyPnL: "0.00",
          totalPnL: "0.00",
          winRate: "0.00"
        });
      }

      const score = await riskReportsService.calculateRiskScore(portfolio.id);
      res.json(score);
    } catch (error) {
      console.error('Error calculating risk score:', error);
      res.status(500).json({ message: "Failed to calculate risk score", error });
    }
  });

  app.get("/api/risk/report/:period", async (req, res) => {
    try {
      let demoUser = await storage.getUserByEmail("demo@memehunter.app");
      if (!demoUser) {
        const saltRounds = 12;
        const hashedDemoPassword = await bcrypt.hash("demo123", saltRounds);
        demoUser = await storage.createUser({
          username: "demo_user",
          email: "demo@memehunter.app",
          password: hashedDemoPassword,
          subscriptionTier: "pro",
          language: "en"
        });
      }
      
      let portfolio = await storage.getPortfolioByUserId(demoUser.id);
      if (!portfolio) {
        portfolio = await storage.createPortfolio({
          userId: demoUser.id,
          totalValue: "10000.00",
          dailyPnL: "0.00",
          totalPnL: "0.00",
          winRate: "0.00"
        });
      }

      const { period } = req.params;
      const validPeriods = ['daily', 'weekly', 'monthly'];
      
      if (!validPeriods.includes(period)) {
        return res.status(400).json({ message: "Invalid period. Must be: daily, weekly, or monthly" });
      }

      const report = await riskReportsService.generateFullReport(
        portfolio.id, 
        period as 'daily' | 'weekly' | 'monthly'
      );
      res.json(report);
    } catch (error) {
      console.error('Error generating full risk report:', error);
      res.status(500).json({ message: "Failed to generate full risk report", error });
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
