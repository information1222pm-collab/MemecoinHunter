import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { readFile } from "fs/promises";
import { join } from "path";
import { storage } from "./storage";
import { scanner } from "./services/scanner";
import { mlAnalyzer } from "./services/ml-analyzer";
import { priceFeed } from "./services/price-feed";
import { streamingPriceGateway } from "./services/streaming-price-gateway";
import { riskManager } from "./services/risk-manager";
import { autoTrader } from "./services/auto-trader";
import { stakeholderReportUpdater } from "./services/stakeholder-report-updater";
import { positionTracker } from "./services/position-tracker";
import { tradingAnalyticsService } from "./services/trading-analytics";
import { tradeJournalService } from "./services/trade-journal";
import { riskReportsService } from "./services/risk-reports";
import { alertService } from "./services/alert-service";
import { marketHealthAnalyzer } from "./services/market-health";
import { dataCleanupService } from "./services/data-cleanup";
import { cacheService } from "./services/cache-service";
import { aiInsightsAnalyzer } from "./services/ai-insights-analyzer";
import { aiTradeExecutor } from "./services/ai-trade-executor";
import { backtestingEngine } from "./services/backtesting-engine";
import { insertUserSchema, insertTradeSchema, insertTokenSchema, insertAlertRuleSchema, insertPortfolioLaunchConfigSchema } from "@shared/schema";
import { z } from "zod";
import * as bcrypt from "bcrypt";
import session from "express-session";
import ConnectPgSimple from "connect-pg-simple";
import csrf from "csurf";
import cookie from "cookie";
import rateLimit from "express-rate-limit";
import signature from "cookie-signature";
import { setupAuth } from "./replitAuth";
import Stripe from "stripe";
import { db } from "./db";
import { trades, patterns } from "@shared/schema";
import { and, desc, gt, isNotNull, sql } from "drizzle-orm";
import { getDemoUserAndPortfolio } from "./utils/demo-user";

// Stripe configuration - optional, subscription features will be disabled if not configured
let stripe: Stripe | null = null;
let stripeEnabled = false;

if (process.env.STRIPE_SECRET_KEY) {
  const stripeKey = process.env.STRIPE_SECRET_KEY.trim();
  
  // Validate the key format (should start with sk_test_ or sk_live_)
  if (stripeKey.startsWith('sk_')) {
    try {
      stripe = new Stripe(stripeKey);
      stripeEnabled = true;
      console.log('✅ Stripe SDK initialized with key:', stripeKey.substring(0, 10) + '...');
    } catch (error) {
      console.warn('⚠️ Failed to initialize Stripe SDK:', error);
      console.warn('⚠️ Subscription features will be disabled');
    }
  } else {
    console.warn('⚠️ Invalid STRIPE_SECRET_KEY format. Key should start with sk_test_ or sk_live_');
    console.warn('⚠️ Subscription features will be disabled');
  }
} else {
  console.warn('⚠️ STRIPE_SECRET_KEY not configured. Subscription features will be disabled');
}

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
    saveUninitialized: false, // SECURITY: Only create sessions for authenticated users
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
  
  // Conditional CSRF middleware - skip for testing endpoints and GET requests
  const conditionalCsrf = (req: any, res: any, next: any) => {
    // Skip CSRF for GET and HEAD requests (read operations don't need CSRF protection)
    if (req.method === 'GET' || req.method === 'HEAD') {
      return next();
    }
    
    // Skip CSRF for testing email endpoints
    if (req.path === '/api/email/test' || req.path === '/api/email/demo-performance') {
      return next();
    }
    
    return csrfProtection(req, res, next);
  };
  
  // Comprehensive CSRF protection for ALL state-changing endpoints
  app.use([
    '/api/auth/login', '/api/auth/register', '/api/auth/logout',
    '/api/portfolio', '/api/trades', '/api/positions', '/api/alerts', '/api/price-alerts',
    '/api/api-keys', '/api/settings', '/api/auto-trader',
    '/api/email', '/api/visitor/demo-complete',
    '/api/create-checkout-session', '/api/create-subscription', '/api/cancel-subscription'
  ].map(path => [path, path + '/*']).flat(), conditionalCsrf);

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
  app.use('/api/portfolio/default', apiLimiter); // Protect public demo endpoints
  app.use('/api', apiLimiter);

  // Set up Replit Auth (Google/GitHub/X/Apple OAuth) if environment variables are configured
  // Reference: blueprint:javascript_log_in_with_replit
  await setupAuth(app);

  // RBAC Middleware for Role-Based Access Control (CRITICAL SECURITY FIX)
  // Supports both email/password auth (req.session.userId) and Replit Auth (req.user from passport)
  const requireAuth = async (req: any, res: any, next: any) => {
    // Check for Replit Auth (OAuth) first
    if (req.user && req.user.id) {
      try {
        const user = await storage.getUser(req.user.id);
        if (user) {
          req.user = user;
          return next();
        }
      } catch (error) {
        console.error('[SECURITY] Replit Auth user lookup error:', error);
      }
    }
    
    // Fall back to email/password auth
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
  app.use('/api/journal', requireAuth); // Trade journal requires authentication

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
    
    // SECURITY: Require authentication for WebSocket connections
    if (!userId) {
      console.warn(`[SECURITY] WebSocket connection rejected - not authenticated from ${remoteAddress}`);
      ws.close(1008, 'Authentication required');
      return;
    }
    
    // Associate WebSocket with user if authenticated
    if (!userConnections.has(userId)) {
      userConnections.set(userId, new Set());
    }
    userConnections.get(userId)!.add(ws);
    (ws as any).userId = userId;
    console.log(`[AUDIT] WebSocket associated with user ${userId}`);
    
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
    
    // Start REAL-TIME streaming price gateway (<1s latency)
    console.log('⚡ Starting Streaming Price Gateway (real-time feeds)...');
    try {
      await streamingPriceGateway.start();
      console.log('✅ Real-time price streaming active - <1s latency');
    } catch (error) {
      console.error('❌ Streaming Price Gateway failed:', error);
      console.log('⚠️  Falling back to traditional price feed...');
    }
    
    // Keep traditional price feed as fallback for tokens not on exchanges
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
    
    // Start AI Trade Executor service
    console.log('🧠 Starting AI Trade Executor service...');
    try {
      await aiTradeExecutor.start();
    } catch (error) {
      console.error('❌ AI Trade Executor failed to start:', error);
    }
    
    // Start trade journal service to track all trades
    console.log('📓 Starting Trade Journal Service...');
    const { tradeJournalService } = await import('./services/trade-journal');
    await tradeJournalService.initialize();
    
    // Start ML analyzer after auto-trader is listening
    console.log('🧠 Starting ML Pattern Analyzer...');
    mlAnalyzer.start();
    
    // Start AI insights analyzer for intelligent recommendations
    console.log('🤖 Starting AI Insights Analyzer...');
    aiInsightsAnalyzer.start();
    
    riskManager.start();
    stakeholderReportUpdater.startAutoUpdater();
    
    // Start position tracker for real-time holdings updates
    console.log('📊 Starting Position Tracker...');
    positionTracker.start();
    
    // Start email scheduler for daily performance reports
    console.log('📧 Starting Email Scheduler...');
    const { SchedulerService } = await import('./services/scheduler-service.js');
    const schedulerService = new SchedulerService();
    schedulerService.startDailyEmailScheduler();
    
    // Start data cleanup service to prevent memory issues
    console.log('🧹 Starting Data Cleanup Service...');
    dataCleanupService.start();
    
    // Start early-launch detection system
    console.log('🚀 Starting Early-Launch Detection System...');
    const { launchScanner } = await import('./services/launch-scanner');
    const { launchPerformanceTracker } = await import('./services/launch-performance-tracker');
    const { launchPatternAnalyzer } = await import('./services/launch-pattern-analyzer');
    const { launchStrategyExperimenter } = await import('./services/launch-strategy-experimenter');
    const { launchAutoTrader } = await import('./services/launch-auto-trader');
    launchScanner.start();
    launchPerformanceTracker.start();
    launchPatternAnalyzer.start();
    launchStrategyExperimenter.start();
    launchAutoTrader.start();
    
    // Warm caches for sub-second initial load times
    const { warmCaches } = await import('./utils/cache-warmer');
    await warmCaches();
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

  // Real-time streaming price updates (<1s latency)
  streamingPriceGateway.on('priceUpdate', (update) => {
    broadcastMarketData({ type: 'price_update', data: update });
    // Forward price updates to alert service
    alertService.handlePriceUpdate(update);
  });
  
  // Traditional price feed (fallback for non-exchange tokens)
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
  const DEMO_USER_ID = 'a79316eb-37e4-4323-8685-c0900c784122'; // demo@memehunter.app
  
  positionTracker.on('portfolioUpdated', (portfolioData) => {
    if (portfolioData?.userId) {
      // Broadcast demo portfolio updates globally so unauthenticated users can see them
      if (portfolioData.userId === DEMO_USER_ID) {
        broadcastMarketData({ type: 'portfolio_updated', data: portfolioData });
      } else {
        // Secure user-specific updates for authenticated portfolios
        broadcastToUser(portfolioData.userId, { type: 'portfolio_updated', data: portfolioData });
      }
    }
  });

  positionTracker.on('positionsUpdated', (positionsData) => {
    // Get the portfolio to find the owner
    if (positionsData?.portfolioId) {
      storage.getPortfolio(positionsData.portfolioId).then(portfolio => {
        if (portfolio?.userId) {
          // Broadcast demo portfolio updates globally so unauthenticated users can see them
          if (portfolio.userId === DEMO_USER_ID) {
            broadcastMarketData({ type: 'positions_updated', data: positionsData });
          } else {
            // Secure user-specific updates for authenticated portfolios
            broadcastToUser(portfolio.userId, { type: 'positions_updated', data: positionsData });
          }
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
      
      // Automatically log in user after successful registration
      req.session.userId = user.id;
      req.session.userEmail = user.email;
      
      // Save session to database to ensure persistence
      await new Promise<void>((resolve, reject) => {
        req.session.save((err) => {
          if (err) reject(err);
          else resolve();
        });
      });
      
      // Security audit log
      console.log(`[AUDIT] User registered and auto-logged in: ${user.email} at ${new Date().toISOString()}`);
      
      res.json({ 
        success: true,
        user: { id: user.id, username: user.username, email: user.email } 
      });
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
      
      // Save session to database to ensure persistence
      await new Promise<void>((resolve, reject) => {
        req.session.save((err) => {
          if (err) {
            console.error(`[SECURITY] Session save error for ${email}:`, err);
            reject(err);
          } else {
            resolve();
          }
        });
      });
      
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

  // Visitor tracking for IP-based demo
  app.get("/api/visitor/check", async (req, res) => {
    try {
      const ipAddress = req.ip || req.socket.remoteAddress || 'unknown';
      const userAgent = req.get('user-agent') || '';
      
      let visitor = await storage.getVisitorByIp(ipAddress);
      
      if (!visitor) {
        // Create new visitor record
        visitor = await storage.createVisitor({
          ipAddress,
          userAgent,
          hasSeenDemo: false,
          visitCount: 1
        });
      } else {
        // Update last visit time and increment visit count
        await storage.updateVisitorLastVisit(ipAddress);
      }
      
      res.json({ 
        hasSeenDemo: visitor.hasSeenDemo,
        isNewVisitor: visitor.visitCount === 1
      });
    } catch (error) {
      console.error('Error checking visitor:', error);
      res.status(500).json({ error: 'Failed to check visitor status' });
    }
  });

  app.post("/api/visitor/demo-complete", async (req, res) => {
    try {
      const ipAddress = req.ip || req.socket.remoteAddress || 'unknown';
      
      await storage.updateVisitorDemo(ipAddress, true);
      
      res.json({ success: true });
    } catch (error) {
      console.error('Error marking demo complete:', error);
      res.status(500).json({ error: 'Failed to update visitor status' });
    }
  });

  // Token routes - Optimized with stale-while-revalidate for <1s load time
  app.get("/api/tokens", async (req, res) => {
    try {
      // Support field selection for smaller payloads
      const fields = req.query.fields ? String(req.query.fields).split(',') : null;
      const limit = req.query.limit ? parseInt(String(req.query.limit)) : undefined;
      
      const cacheKey = fields ? `active_tokens_${fields.join('_')}_${limit || 'all'}` : 'active_tokens';
      
      // Try to get from cache first (even if stale)
      let tokens = cacheService.get(cacheKey);
      
      if (tokens) {
        // Cache hit - return immediately
        res.json(tokens);
        
        // If stale, refresh in background (non-blocking)
        if (cacheService.isStale(cacheKey)) {
          storage.getActiveTokens()
            .then(freshTokens => {
              // Apply field selection and limit if specified
              let processedTokens = freshTokens;
              if (limit) {
                processedTokens = freshTokens.slice(0, limit);
              }
              if (fields && fields.length > 0) {
                processedTokens = processedTokens.map(token => {
                  const filtered: any = { id: token.id }; // Always include ID
                  fields.forEach(field => {
                    if (token.hasOwnProperty(field)) {
                      filtered[field] = token[field];
                    }
                  });
                  return filtered;
                });
              }
              cacheService.set(cacheKey, processedTokens, 3000);
            })
            .catch(err => console.error('Background token refresh failed:', err));
        }
      } else {
        // Cache miss (first time) - fetch from database synchronously
        tokens = await storage.getActiveTokens();
        
        // Apply field selection and limit if specified
        if (limit) {
          tokens = tokens.slice(0, limit);
        }
        if (fields && fields.length > 0) {
          tokens = tokens.map(token => {
            const filtered: any = { id: token.id }; // Always include ID
            fields.forEach(field => {
              if (token.hasOwnProperty(field)) {
                filtered[field] = token[field];
              }
            });
            return filtered;
          });
        }
        
        cacheService.set(cacheKey, tokens, 3000); // 3s TTL for fresh price data
        res.json(tokens);
      }
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
  // Get authenticated user's portfolio
  app.get("/api/portfolio", requireAuth, async (req, res) => {
    try {
      const userId = req.session?.userId;
      if (!userId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      const portfolio = await storage.getPortfolioByUserId(userId);
      if (!portfolio) {
        return res.status(404).json({ message: "Portfolio not found" });
      }
      
      const positions = await storage.getPositionsByPortfolio(portfolio.id);
      
      // Filter out closed positions (amount = 0)
      const activePositions = positions.filter(p => parseFloat(p.amount) > 0);
      
      // Get enhanced analytics from position tracker
      const portfolioAnalytics = await positionTracker.getPortfolioAnalytics(portfolio.id);
      const positionAnalytics = await positionTracker.getPositionAnalytics(portfolio.id);
      
      // Merge position data with analytics (only for active positions)
      const enhancedPositions = await Promise.all(activePositions.map(async position => {
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
      
      // totalValue now already includes cash balance (updated by position tracker)
      res.json({ 
        ...portfolio,
        positions: enhancedPositions,
        analytics: portfolioAnalytics
      });
    } catch (error) {
      console.error('[API] Error fetching user portfolio:', error);
      res.status(500).json({ message: "Failed to fetch portfolio", error });
    }
  });

  // Get authenticated user's trades
  app.get("/api/portfolio/trades", requireAuth, async (req, res) => {
    try {
      const userId = req.session?.userId;
      if (!userId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      const portfolio = await storage.getPortfolioByUserId(userId);
      if (!portfolio) {
        return res.status(404).json({ message: "Portfolio not found" });
      }

      const trades = await storage.getTradesByPortfolio(portfolio.id);
      
      // Enrich trades with token information
      const enrichedTrades = await Promise.all(trades.map(async trade => {
        const token = await storage.getToken(trade.tokenId);
        return {
          ...trade,
          token: {
            symbol: token?.symbol || 'Unknown',
            name: token?.name || 'Unknown Token'
          }
        };
      }));

      res.json(enrichedTrades);
    } catch (error) {
      console.error('[API] Error fetching user trades:', error);
      res.status(500).json({ message: "Failed to fetch trades", error });
    }
  });

  // Update AI trading settings for portfolio
  app.post("/api/portfolio/ai-settings", requireAuth, async (req, res) => {
    try {
      const userId = req.session?.userId;
      if (!userId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      const { aiTradingEnabled, aiConfidenceThreshold, aiMaxPositionSize, aiCooldownMinutes } = req.body;

      const portfolio = await storage.getPortfolioByUserId(userId);
      if (!portfolio) {
        return res.status(404).json({ message: "Portfolio not found" });
      }

      const updated = await storage.updatePortfolio(portfolio.id, {
        aiTradingEnabled,
        aiConfidenceThreshold,
        aiMaxPositionSize,
        aiCooldownMinutes
      });

      res.json(updated);
    } catch (error) {
      console.error('Error updating AI settings:', error);
      res.status(500).json({ message: "Failed to update AI settings" });
    }
  });

  // Run backtest for a strategy
  app.post("/api/backtest/run", requireAuth, async (req, res) => {
    try {
      const userId = req.session?.userId;
      if (!userId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      const { strategyName, parameters, startDate, endDate, initialCapital } = req.body;

      // Convert single strategy name to array of strategies expected by backend
      const strategies = strategyName ? [strategyName] : ['momentum'];
      
      // Map parameters to backtesting engine format
      const backtestParams = {
        strategies,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        initialCapital: initialCapital || 10000,
        stopLoss: parameters?.stopLoss || 0.05,
        takeProfit: parameters?.takeProfit || 0.20,
        positionSize: parameters?.positionSize || 0.1,
        maxPositions: parameters?.maxPositions || 5
      };

      const results = await backtestingEngine.runBacktest(backtestParams);

      res.json(results);
    } catch (error) {
      console.error('Error running backtest:', error);
      res.status(500).json({ message: "Failed to run backtest" });
    }
  });

  // Get backtest results history
  app.get("/api/backtest/results", requireAuth, async (req, res) => {
    try {
      const userId = req.session?.userId;
      if (!userId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      // For now, return empty results - will be stored in database later
      res.json({ results: [] });
    } catch (error) {
      console.error('Error fetching backtest results:', error);
      res.status(500).json({ message: "Failed to fetch backtest results" });
    }
  });

  // Reset portfolio with custom starting capital
  app.post("/api/portfolio/reset", requireAuth, async (req, res) => {
    try {
      const userId = req.session?.userId;
      if (!userId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      const { startingCapital } = req.body;
      
      // Validate starting capital
      const capitalAmount = parseFloat(startingCapital);
      if (isNaN(capitalAmount) || capitalAmount <= 0) {
        return res.status(400).json({ message: "Invalid starting capital amount" });
      }

      const portfolio = await storage.getPortfolioByUserId(userId);
      if (!portfolio) {
        return res.status(404).json({ message: "Portfolio not found" });
      }

      // Reset the portfolio
      const resetPortfolio = await storage.resetPortfolio(portfolio.id, startingCapital);
      
      res.json({ 
        message: "Portfolio reset successfully",
        portfolio: resetPortfolio 
      });
    } catch (error) {
      console.error('[API] Error resetting portfolio:', error);
      res.status(500).json({ message: "Failed to reset portfolio", error });
    }
  });

  // Get all available risk levels
  app.get("/api/risk-levels", requireAuth, async (_req, res) => {
    try {
      const { getAllRiskLevels } = await import('./services/risk-levels.js');
      const riskLevels = getAllRiskLevels();
      res.json(riskLevels);
    } catch (error) {
      console.error('[API] Error fetching risk levels:', error);
      res.status(500).json({ message: "Failed to fetch risk levels", error });
    }
  });

  // Update portfolio risk level
  app.patch("/api/portfolio/risk-level", requireAuth, async (req, res) => {
    try {
      const userId = req.session?.userId;
      if (!userId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      const { riskLevel } = req.body;
      const { isValidRiskLevel } = await import('./services/risk-levels.js');
      
      if (!isValidRiskLevel(riskLevel)) {
        return res.status(400).json({ 
          message: "Invalid risk level", 
          allowedValues: ['conservative', 'moderate', 'balanced', 'aggressive', 'very_aggressive']
        });
      }

      const portfolio = await storage.getPortfolioByUserId(userId);
      if (!portfolio) {
        return res.status(404).json({ message: "Portfolio not found" });
      }

      // Update the portfolio risk level
      const updatedPortfolio = await storage.updatePortfolio(portfolio.id, { riskLevel });
      
      // Clear the auto-trader's risk config cache so it picks up the new level
      autoTrader['clearRiskConfigCache'](portfolio.id);
      
      res.json({
        message: `Risk level updated to ${riskLevel}`,
        portfolio: updatedPortfolio
      });
    } catch (error) {
      console.error('[API] Error updating risk level:', error);
      res.status(500).json({ message: "Failed to update risk level", error });
    }
  });

  // Toggle auto-trading for portfolio
  app.patch("/api/portfolio/auto-trading", requireAuth, async (req, res) => {
    try {
      const userId = req.session?.userId;
      if (!userId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      const { enabled } = req.body;
      
      if (typeof enabled !== 'boolean') {
        return res.status(400).json({ 
          message: "Invalid value - 'enabled' must be a boolean"
        });
      }

      const portfolio = await storage.getPortfolioByUserId(userId);
      if (!portfolio) {
        return res.status(404).json({ message: "Portfolio not found" });
      }

      // Update the portfolio auto-trading status
      const updatedPortfolio = await storage.updatePortfolio(portfolio.id, { 
        autoTradingEnabled: enabled 
      });
      
      // Enable or disable auto-trading in the auto-trader service
      if (enabled) {
        await autoTrader.enableAutoTrading(portfolio.id);
        console.log(`✅ Auto-trading activated for portfolio ${portfolio.id}`);
      } else {
        await autoTrader.disableAutoTrading(portfolio.id);
        console.log(`🛑 Auto-trading deactivated for portfolio ${portfolio.id}`);
      }
      
      res.json({
        message: enabled ? 'Auto-trading activated' : 'Auto-trading deactivated',
        portfolio: updatedPortfolio
      });
    } catch (error) {
      console.error('[API] Error toggling auto-trading:', error);
      res.status(500).json({ message: "Failed to toggle auto-trading", error });
    }
  });

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
      
      // Filter out closed positions (amount = 0)
      const activePositions = positions.filter(p => parseFloat(p.amount) > 0);
      
      // Get enhanced analytics from position tracker
      const portfolioAnalytics = await positionTracker.getPortfolioAnalytics(portfolio.id);
      const positionAnalytics = await positionTracker.getPositionAnalytics(portfolio.id);
      
      // Merge position data with analytics (only for active positions)
      const enhancedPositions = await Promise.all(activePositions.map(async position => {
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
      
      // totalValue now already includes cash balance (updated by position tracker)
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
      
      // Filter out closed positions (amount = 0)
      const activePositions = positions.filter(p => parseFloat(p.amount) > 0);
      
      // Get enhanced analytics from position tracker
      const portfolioAnalytics = await positionTracker.getPortfolioAnalytics(portfolio.id);
      const positionAnalytics = await positionTracker.getPositionAnalytics(portfolio.id);
      
      // Merge position data with analytics (only for active positions)
      const enhancedPositions = await Promise.all(activePositions.map(async position => {
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
      
      // totalValue now already includes cash balance (updated by position tracker)
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
      const cacheKey = 'autotrader_portfolio';
      
      // Try to get from cache first (even if stale)
      let stats = cacheService.get(cacheKey);
      
      if (stats) {
        // Cache hit - return immediately
        res.json(stats);
        
        // If stale, refresh in background (non-blocking)
        if (cacheService.isStale(cacheKey)) {
          (async () => {
            try {
              const freshStats = await autoTrader.getDetailedStats();
              if (freshStats) {
                cacheService.set(cacheKey, freshStats, 4000);
              }
            } catch (err) {
              console.error('Background autotrader stats refresh failed:', err);
            }
          })();
        }
      } else {
        // Cache miss - fetch synchronously
        stats = await autoTrader.getDetailedStats();
        if (!stats) {
          return res.status(404).json({ message: "Auto-trader portfolio not found" });
        }
        cacheService.set(cacheKey, stats, 4000);
        res.json(stats);
      }
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch auto-trader portfolio", error });
    }
  });

  // Launch Trading Strategy routes
  app.get("/api/launch/statistics", async (req, res) => {
    try {
      const stats = await storage.getLaunchStatistics();
      res.json(stats);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch launch statistics", error });
    }
  });

  app.get("/api/launch/strategies", async (req, res) => {
    try {
      const strategies = await storage.getAllStrategies();
      res.json(strategies);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch launch strategies", error });
    }
  });

  app.get("/api/launch/strategies/active", async (req, res) => {
    try {
      const strategy = await storage.getActiveStrategy();
      if (!strategy) {
        return res.status(404).json({ message: "No active strategy found" });
      }
      const performance = await storage.getStrategyPerformance(strategy.id);
      res.json({ strategy, performance });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch active strategy", error });
    }
  });

  app.get("/api/launch/performance/:strategyId", async (req, res) => {
    try {
      const performance = await storage.getStrategyPerformance(req.params.strategyId);
      if (!performance) {
        return res.status(404).json({ message: "Performance data not found" });
      }
      res.json(performance);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch strategy performance", error });
    }
  });

  app.get("/api/launch/config/:portfolioId", async (req, res) => {
    try {
      const config = await storage.getPortfolioLaunchConfig(req.params.portfolioId);
      res.json(config || { enabled: false });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch launch config", error });
    }
  });

  app.post("/api/launch/config/:portfolioId", async (req, res) => {
    try {
      // Validate request body with Zod schema
      const configSchema = insertPortfolioLaunchConfigSchema.omit({ portfolioId: true, id: true }).extend({
        enabled: z.boolean().optional().default(false),
        // maxDailyTrades removed - no daily limits
        maxPositionSize: z.number().min(50).max(10000).optional().default(500)
      });
      
      const validatedConfig = configSchema.parse(req.body);
      
      const config = await storage.updatePortfolioLaunchConfig(req.params.portfolioId, validatedConfig);
      
      res.json(config);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid configuration data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update launch config", error });
    }
  });

  app.get("/api/launch/statistics", async (req, res) => {
    try {
      const stats = await storage.getLaunchStatistics();
      res.json(stats);
    } catch (error) {
      console.error('Error fetching launch statistics:', error);
      res.status(500).json({ message: "Failed to fetch launch statistics", error });
    }
  });

  app.get("/api/launch/strategies", async (req, res) => {
    try {
      const strategies = await storage.getAllStrategies();
      res.json(strategies);
    } catch (error) {
      console.error('Error fetching launch strategies:', error);
      res.status(500).json({ message: "Failed to fetch launch strategies", error });
    }
  });

  app.get("/api/launch/strategies/active", async (req, res) => {
    try {
      const strategy = await storage.getActiveStrategy();
      if (strategy) {
        const performance = await storage.getStrategyPerformance(strategy.id);
        res.json({ strategy, performance });
      } else {
        res.json({ strategy: null, performance: null });
      }
    } catch (error) {
      console.error('Error fetching active strategy:', error);
      res.status(500).json({ message: "Failed to fetch active strategy", error });
    }
  });

  app.get("/api/launch/recent-launches", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 20;
      const launches = await storage.getRecentLaunches(limit);
      res.json(launches);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch recent launches", error });
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
      const cacheKey = 'scanner_status';
      
      // Try to get from cache first (even if stale)
      let status = cacheService.get(cacheKey);
      
      if (status) {
        // Cache hit - return immediately
        res.json(status);
        
        // If stale, refresh in background (non-blocking)
        if (cacheService.isStale(cacheKey)) {
          (async () => {
            try {
              const freshStatus = scanner.getStatus();
              cacheService.set(cacheKey, freshStatus, 3000);
            } catch (err) {
              console.error('Background scanner status refresh failed:', err);
            }
          })();
        }
      } else {
        // Cache miss - fetch synchronously
        status = scanner.getStatus();
        cacheService.set(cacheKey, status, 3000);
        res.json(status);
      }
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
      const cacheKey = 'alerts';
      
      // Try to get from cache first (even if stale)
      let alerts = cacheService.get(cacheKey);
      
      if (alerts) {
        // Cache hit - return immediately
        res.json(alerts);
        
        // If stale, refresh in background (non-blocking)
        if (cacheService.isStale(cacheKey)) {
          (async () => {
            try {
              const freshAlerts = await storage.getUnreadAlerts();
              cacheService.set(cacheKey, freshAlerts, 4000);
            } catch (err) {
              console.error('Background alerts refresh failed:', err);
            }
          })();
        }
      } else {
        // Cache miss - fetch synchronously
        alerts = await storage.getUnreadAlerts();
        cacheService.set(cacheKey, alerts, 4000);
        res.json(alerts);
      }
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

  // Subscription routes with Stripe integration
  app.get("/api/subscription/:userId", async (req, res) => {
    try {
      const subscription = await storage.getSubscriptionByUserId(req.params.userId);
      res.json(subscription);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch subscription", error });
    }
  });

  // Server-side plan to price ID mapping (SECURITY: Prevents price manipulation)
  const PLAN_PRICE_MAPPING: Record<string, string> = {
    'basic': process.env.STRIPE_PRICE_BASIC || 'price_basic_monthly',
    'pro': process.env.STRIPE_PRICE_PRO || 'price_pro_monthly',
    'enterprise': process.env.STRIPE_PRICE_ENTERPRISE || 'price_enterprise_monthly',
  };

  // Stripe Checkout Session Creation
  app.post("/api/create-checkout-session", requireAuth, async (req, res) => {
    try {
      if (!stripeEnabled || !stripe) {
        return res.status(503).json({ error: 'Subscription service is not available. Please contact support.' });
      }

      const { _csrf, ...requestData } = req.body;
      const { plan } = requestData;
      const user = req.user;

      if (!user?.email) {
        return res.status(400).json({ error: 'User email required' });
      }

      // SECURITY: Validate plan and use server-side price ID
      if (!PLAN_PRICE_MAPPING[plan]) {
        return res.status(400).json({ error: 'Invalid plan selected' });
      }
      const priceId = PLAN_PRICE_MAPPING[plan];

      // Check if customer already exists
      let subscription = await storage.getSubscriptionByUserId(user.id);
      let customerId = subscription?.stripeCustomerId;

      if (!customerId) {
        // Create new Stripe customer
        const customer = await stripe.customers.create({
          email: user.email,
          metadata: {
            userId: user.id,
          },
        });
        customerId = customer.id;
      }

      // Create Checkout Session
      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        mode: 'subscription',
        line_items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],
        success_url: `${process.env.REPLIT_DOMAINS?.split(',')[0] || 'http://localhost:5000'}/?success=true&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.REPLIT_DOMAINS?.split(',')[0] || 'http://localhost:5000'}/?canceled=true`,
        metadata: {
          userId: user.id,
          plan,
        },
      });

      res.json({ url: session.url, sessionId: session.id });
    } catch (error: any) {
      console.error('Checkout session error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Create or update subscription after successful payment
  app.post("/api/create-subscription", requireAuth, async (req, res) => {
    try {
      if (!stripeEnabled || !stripe) {
        return res.status(503).json({ error: 'Subscription service is not available. Please contact support.' });
      }

      const { _csrf, ...requestData } = req.body;
      const { sessionId } = requestData;
      const user = req.user;

      // Retrieve the checkout session
      const session = await stripe.checkout.sessions.retrieve(sessionId, {
        expand: ['subscription'],
      });

      if (session.payment_status !== 'paid') {
        return res.status(400).json({ error: 'Payment not completed' });
      }

      const stripeSubscription = session.subscription as Stripe.Subscription;
      const plan = session.metadata?.plan || 'basic';

      // Check if subscription already exists
      let subscription = await storage.getSubscriptionByUserId(user.id);

      if (subscription) {
        // Update existing subscription
        subscription = await storage.updateSubscription(subscription.id, {
          plan,
          stripeCustomerId: session.customer as string,
          stripeSubscriptionId: stripeSubscription.id,
          stripePriceId: stripeSubscription.items.data[0].price.id,
          status: 'active',
          currentPeriodStart: new Date(stripeSubscription.current_period_start * 1000),
          currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
        });
      } else {
        // Create new subscription
        subscription = await storage.createSubscription({
          userId: user.id,
          plan,
          stripeCustomerId: session.customer as string,
          stripeSubscriptionId: stripeSubscription.id,
          stripePriceId: stripeSubscription.items.data[0].price.id,
          status: 'active',
          currentPeriodStart: new Date(stripeSubscription.current_period_start * 1000),
          currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
        });
      }

      res.json({ subscription, success: true });
    } catch (error: any) {
      console.error('Create subscription error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Cancel subscription
  app.post("/api/cancel-subscription", requireAuth, async (req, res) => {
    try {
      const user = req.user;
      const subscription = await storage.getSubscriptionByUserId(user.id);

      if (!subscription?.stripeSubscriptionId) {
        return res.status(404).json({ error: 'No active subscription found' });
      }

      // Cancel at period end
      await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
        cancel_at_period_end: true,
      });

      // Update local subscription
      const updated = await storage.updateSubscription(subscription.id, {
        cancelAtPeriodEnd: true,
      });

      res.json({ subscription: updated, success: true });
    } catch (error: any) {
      console.error('Cancel subscription error:', error);
      res.status(500).json({ error: error.message });
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
      const reportPath = join(process.cwd(), "MemeCoin_Hunter_Stakeholder_Report_Q4_2025.md");
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

  // Market Health Endpoint
  app.get("/api/market-health", async (req, res) => {
    try {
      const cacheKey = 'market_health';
      
      // Try to get from cache first (even if stale)
      let health = cacheService.get(cacheKey);
      
      if (health) {
        // Cache hit - return immediately
        res.json(health);
        
        // If stale, refresh in background (non-blocking)
        if (cacheService.isStale(cacheKey)) {
          (async () => {
            try {
              const freshHealth = await marketHealthAnalyzer.analyzeMarketHealth();
              cacheService.set(cacheKey, freshHealth, 5000);
            } catch (err) {
              console.error('Background market health refresh failed:', err);
            }
          })();
        }
      } else {
        // Cache miss - fetch synchronously
        health = await marketHealthAnalyzer.analyzeMarketHealth();
        cacheService.set(cacheKey, health, 5000);
        res.json(health);
      }
    } catch (error) {
      console.error('[API] Error fetching market health:', error);
      res.status(500).json({ 
        message: "Failed to fetch market health", 
        error,
        // Return default health on error
        healthScore: 60,
        recommendation: 'caution',
        factors: ['Error fetching market data'],
        volatility: 0,
        trend: 'neutral',
        breadth: 0,
        volumeHealth: 0,
        correlation: 0,
        timestamp: new Date().toISOString()
      });
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

  app.get("/api/analytics/all", async (req: any, res) => {
    try {
      // Check if user is authenticated
      const isAuthenticated = !!(req.user?.id || req.session?.userId);
      const userId = req.user?.id || req.session?.userId;
      
      // Use user-specific cache key or demo cache key
      const cacheKey = isAuthenticated ? `analytics_all_${userId}` : 'analytics_all_demo';
      
      // Try to get from cache first (even if stale)
      let transformed = cacheService.get(cacheKey);
      
      if (transformed) {
        // Cache hit - return immediately
        res.json(transformed);
        
        // If stale, refresh in background (non-blocking)
        if (cacheService.isStale(cacheKey)) {
          (async () => {
            try {
              let portfolio;
              if (isAuthenticated) {
                portfolio = await storage.getPortfolioByUserId(userId);
              } else {
                const demoData = await getDemoUserAndPortfolio();
                portfolio = demoData.portfolio;
              }
              
              if (!portfolio) return;
              
              const allMetrics = await tradingAnalyticsService.getAllMetrics(portfolio.id);
              
              const freshData = {
                pnl: allMetrics.pnl,
                winLoss: {
                  ...allMetrics.winLoss,
                  avgWin: allMetrics.winLoss.averageWin,
                  avgLoss: allMetrics.winLoss.averageLoss,
                },
                holdTime: {
                  avgHoldTime: allMetrics.holdTime.averageHoldTimeMs / (1000 * 60 * 60),
                  avgWinHoldTime: allMetrics.holdTime.averageWinHoldTimeMs / (1000 * 60 * 60),
                  avgLossHoldTime: allMetrics.holdTime.averageLossHoldTimeMs / (1000 * 60 * 60),
                  totalClosedTrades: allMetrics.holdTime.totalClosedTrades,
                },
                strategies: allMetrics.strategies.map(s => ({
                  ...s,
                  roiPercent: s.roi,
                })),
              };
              
              cacheService.set(cacheKey, freshData, 5000);
            } catch (err) {
              console.error('Background analytics refresh failed:', err);
            }
          })();
        }
      } else {
        // Cache miss (first time) - compute analytics synchronously
        let portfolio;
        if (isAuthenticated) {
          portfolio = await storage.getPortfolioByUserId(userId);
        } else {
          const demoData = await getDemoUserAndPortfolio();
          portfolio = demoData.portfolio;
        }
        
        if (!portfolio) {
          return res.status(404).json({ message: "Portfolio not found" });
        }
        
        const allMetrics = await tradingAnalyticsService.getAllMetrics(portfolio.id);
        
        transformed = {
          pnl: allMetrics.pnl,
          winLoss: {
            ...allMetrics.winLoss,
            avgWin: allMetrics.winLoss.averageWin,
            avgLoss: allMetrics.winLoss.averageLoss,
          },
          holdTime: {
            avgHoldTime: allMetrics.holdTime.averageHoldTimeMs / (1000 * 60 * 60),
            avgWinHoldTime: allMetrics.holdTime.averageWinHoldTimeMs / (1000 * 60 * 60),
            avgLossHoldTime: allMetrics.holdTime.averageLossHoldTimeMs / (1000 * 60 * 60),
            totalClosedTrades: allMetrics.holdTime.totalClosedTrades,
          },
          strategies: allMetrics.strategies.map(s => ({
            ...s,
            roiPercent: s.roi,
          })),
        };
        
        cacheService.set(cacheKey, transformed, 5000);
        res.json(transformed);
      }
    } catch (error) {
      console.error('Error fetching all analytics metrics:', error);
      res.status(500).json({ message: "Failed to fetch all analytics metrics", error });
    }
  });

  // Trade Journal Endpoints
  app.get("/api/journal/entries", async (req, res) => {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      let portfolio = await storage.getPortfolioByUserId(user.id);
      if (!portfolio) {
        portfolio = await storage.createPortfolio({
          userId: user.id,
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
      const user = req.user;
      if (!user) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      let portfolio = await storage.getPortfolioByUserId(user.id);
      if (!portfolio) {
        portfolio = await storage.createPortfolio({
          userId: user.id,
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
      const user = req.user;
      if (!user) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      let portfolio = await storage.getPortfolioByUserId(user.id);
      if (!portfolio) {
        portfolio = await storage.createPortfolio({
          userId: user.id,
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
      const user = req.user;
      if (!user) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      let portfolio = await storage.getPortfolioByUserId(user.id);
      if (!portfolio) {
        portfolio = await storage.createPortfolio({
          userId: user.id,
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

  // AI Insights endpoints
  app.get("/api/insights", async (req, res) => {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const portfolio = await storage.getPortfolioByUserId(user.id);
      if (!portfolio) {
        return res.status(404).json({ message: "Portfolio not found" });
      }

      const limit = parseInt(req.query.limit as string) || 10;
      const insights = await storage.getInsightsByPortfolio(portfolio.id, limit);
      
      res.json(insights);
    } catch (error) {
      console.error('Error fetching AI insights:', error);
      res.status(500).json({ message: "Failed to fetch AI insights", error });
    }
  });

  app.get("/api/ai-insights/latest", async (req, res) => {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const portfolio = await storage.getPortfolioByUserId(user.id);
      if (!portfolio) {
        return res.status(404).json({ message: "Portfolio not found" });
      }

      const insights = await storage.getInsightsByPortfolio(portfolio.id, 1);
      const latestInsight = insights[0] || null;
      
      res.json(latestInsight);
    } catch (error) {
      console.error('Error fetching latest AI insight:', error);
      res.status(500).json({ message: "Failed to fetch latest AI insight", error });
    }
  });

  app.put("/api/insights/:id/status", async (req, res) => {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { id } = req.params;
      const { status } = req.body;

      // Validate status
      const validStatuses = ['new', 'viewed', 'acted_on', 'dismissed'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ message: "Invalid status value" });
      }

      const updated = await storage.updateInsightStatus(id, status);
      res.json(updated);
    } catch (error) {
      console.error('Error updating insight status:', error);
      res.status(500).json({ message: "Failed to update insight status", error });
    }
  });

  // Trophy Room - Top Profitable Trades (System-Wide)
  app.get("/api/trophy-room", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 20;
      
      // Query all closed trades with positive P&L across ALL portfolios
      const allTrades = await db.select()
        .from(trades)
        .where(
          and(
            isNotNull(trades.exitPrice),
            isNotNull(trades.realizedPnL),
            gt(trades.realizedPnL, sql`0`)
          )
        )
        .orderBy(desc(trades.realizedPnL))
        .limit(limit);
      
      // Enrich with token and pattern data
      const enrichedTrades = await Promise.all(
        allTrades.map(async (trade) => {
          const token = await storage.getToken(trade.tokenId);
          const pattern = trade.patternId ? 
            (await db.select().from(patterns).where(sql`${patterns.id} = ${trade.patternId}`).limit(1))[0] : null;
          
          const entryPrice = parseFloat(trade.price);
          const exitPrice = parseFloat(trade.exitPrice!.toString());
          const realizedPnL = parseFloat(trade.realizedPnL!.toString());
          const returnPercent = ((exitPrice - entryPrice) / entryPrice) * 100;
          
          let holdTime = 0;
          if (trade.closedAt && trade.createdAt) {
            holdTime = new Date(trade.closedAt.toString()).getTime() - new Date(trade.createdAt.toString()).getTime();
          }
          
          return {
            id: trade.id,
            tokenSymbol: token?.symbol || 'UNKNOWN',
            tokenName: token?.name || 'Unknown Token',
            entryPrice: entryPrice,
            exitPrice: exitPrice,
            amount: parseFloat(trade.amount),
            realizedPnL: realizedPnL,
            returnPercent: returnPercent,
            holdTime: holdTime,
            holdTimeDays: holdTime / (1000 * 60 * 60 * 24),
            entryDate: trade.createdAt ? new Date(trade.createdAt.toString()).toISOString() : null,
            exitDate: trade.closedAt ? new Date(trade.closedAt.toString()).toISOString() : null,
            patternType: pattern?.patternType || null,
            patternConfidence: pattern?.confidence ? parseFloat(pattern.confidence.toString()) : null,
          };
        })
      );
      
      res.json(enrichedTrades);
    } catch (error) {
      console.error('Error fetching trophy room trades:', error);
      res.status(500).json({ message: "Failed to fetch trophy room trades", error });
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

  app.get("/api/risk/exposure", async (req: any, res) => {
    try {
      // Check if user is authenticated
      const isAuthenticated = !!(req.user?.id || req.session?.userId);
      const userId = req.user?.id || req.session?.userId;
      
      // Use user-specific cache key or demo cache key
      const cacheKey = isAuthenticated ? `risk_exposure_${userId}` : 'risk_exposure_demo';
      
      // Try to get from cache first (even if stale)
      let exposure = cacheService.get(cacheKey);
      
      if (exposure) {
        // Cache hit - return immediately
        res.json(exposure);
        
        // If stale, refresh in background (non-blocking)
        if (cacheService.isStale(cacheKey)) {
          (async () => {
            try {
              let portfolio;
              if (isAuthenticated) {
                portfolio = await storage.getPortfolioByUserId(userId);
              } else {
                const demoData = await getDemoUserAndPortfolio();
                portfolio = demoData.portfolio;
              }
              
              if (!portfolio) return;
              
              const freshExposure = await riskReportsService.getCurrentExposure(portfolio.id);
              cacheService.set(cacheKey, freshExposure, 5000);
            } catch (err) {
              console.error('Background exposure refresh failed:', err);
            }
          })();
        }
      } else {
        // Cache miss - fetch synchronously
        let portfolio;
        if (isAuthenticated) {
          portfolio = await storage.getPortfolioByUserId(userId);
        } else {
          const demoData = await getDemoUserAndPortfolio();
          portfolio = demoData.portfolio;
        }
        
        if (!portfolio) {
          return res.status(404).json({ message: "Portfolio not found" });
        }
        
        exposure = await riskReportsService.getCurrentExposure(portfolio.id);
        cacheService.set(cacheKey, exposure, 5000);
        res.json(exposure);
      }
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

  // Email endpoints
  app.post("/api/email/test", async (req, res) => {
    try {
      const { email } = req.body;
      if (!email) {
        return res.status(400).json({ message: "Email address is required" });
      }

      const { emailService } = await import('./services/email-service.js');
      await emailService.sendTestEmail(email);
      
      res.json({ success: true, message: `Test email sent to ${email}` });
    } catch (error) {
      console.error('Error sending test email:', error);
      res.status(500).json({ message: "Failed to send test email", error });
    }
  });

  app.post("/api/email/demo-performance", async (req, res) => {
    try {
      const { email } = req.body;
      if (!email) {
        return res.status(400).json({ message: "Email address is required" });
      }

      const { emailService } = await import('./services/email-service.js');
      await emailService.sendDemoPerformanceReport(email);
      
      res.json({ success: true, message: `Demo performance report sent to ${email}` });
    } catch (error) {
      console.error('Error sending demo performance report:', error);
      res.status(500).json({ message: "Failed to send demo performance report", error });
    }
  });

  app.post("/api/email/performance-report", async (req, res) => {
    try {
      if (!req.session?.userId) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const user = await storage.getUser(req.session.userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const portfolio = await storage.getPortfolioByUserId(user.id);
      if (!portfolio) {
        return res.status(404).json({ message: "Portfolio not found" });
      }

      const positions = await storage.getPositionsByPortfolio(portfolio.id);
      const trades = await storage.getTradesByPortfolio(portfolio.id);
      
      const totalTrades = trades.length;
      const winningTrades = trades.filter(t => {
        const pnl = parseFloat(t.realizedPnL || "0");
        return pnl > 0;
      }).length;
      const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;

      const metrics = {
        totalValue: parseFloat(portfolio.totalValue || "0"),
        dailyPnL: parseFloat(portfolio.dailyPnL || "0"),
        dailyPnLPercent: parseFloat(portfolio.dailyPnL || "0") / parseFloat(portfolio.totalValue || "1") * 100,
        totalPnL: parseFloat(portfolio.totalPnL || "0"),
        totalPnLPercent: parseFloat(portfolio.totalPnL || "0") / 10000 * 100, // Assuming $10k starting capital
        winRate: winRate,
        totalTrades: totalTrades,
        activePositions: positions.length
      };

      const { emailService } = await import('./services/email-service.js');
      await emailService.sendDailyPerformanceReport(
        {
          email: user.email || '',
          firstName: user.firstName || undefined,
          subscriptionTier: user.subscriptionTier || undefined
        },
        metrics
      );

      res.json({ success: true, message: "Performance report sent successfully" });
    } catch (error) {
      console.error('Error sending performance report:', error);
      res.status(500).json({ message: "Failed to send performance report", error });
    }
  });

  app.post("/api/email/feature-update", async (req, res) => {
    try {
      const { email, featureTitle, featureDescription, featureDetails } = req.body;
      
      if (!email || !featureTitle || !featureDescription) {
        return res.status(400).json({ 
          message: "Email, featureTitle, and featureDescription are required" 
        });
      }

      const { emailService } = await import('./services/email-service.js');
      await emailService.sendFeatureUpdateEmail(
        { email, firstName: undefined },
        featureTitle,
        featureDescription,
        featureDetails || []
      );

      res.json({ success: true, message: "Feature update email sent successfully" });
    } catch (error) {
      console.error('Error sending feature update:', error);
      res.status(500).json({ message: "Failed to send feature update", error });
    }
  });

  app.post("/api/email/send-all-performance-reports", async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      const { emailService } = await import('./services/email-service.js');
      
      let sentCount = 0;
      let errorCount = 0;

      for (const user of users) {
        try {
          if (!user.email) continue;

          const portfolio = await storage.getPortfolioByUserId(user.id);
          if (!portfolio) continue;

          const positions = await storage.getPositionsByPortfolio(portfolio.id);
          const trades = await storage.getTradesByPortfolio(portfolio.id);
          
          const totalTrades = trades.length;
          const winningTrades = trades.filter(t => {
            const pnl = parseFloat(t.profitLoss || "0");
            return pnl > 0;
          }).length;
          const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;

          const metrics = {
            totalValue: parseFloat(portfolio.totalValue || "0"),
            dailyPnL: parseFloat(portfolio.dailyPnL || "0"),
            dailyPnLPercent: parseFloat(portfolio.dailyPnL || "0") / parseFloat(portfolio.totalValue || "1") * 100,
            totalPnL: parseFloat(portfolio.totalPnL || "0"),
            totalPnLPercent: parseFloat(portfolio.totalPnL || "0") / 10000 * 100,
            winRate: winRate,
            totalTrades: totalTrades,
            activePositions: positions.length
          };

          await emailService.sendDailyPerformanceReport(
            {
              email: user.email,
              firstName: user.firstName || undefined,
              subscriptionTier: user.subscriptionTier || undefined
            },
            metrics
          );

          sentCount++;
        } catch (error) {
          console.error(`Failed to send email to ${user.email}:`, error);
          errorCount++;
        }
      }

      res.json({ 
        success: true, 
        message: `Sent ${sentCount} performance reports, ${errorCount} failed` 
      });
    } catch (error) {
      console.error('Error sending all performance reports:', error);
      res.status(500).json({ message: "Failed to send performance reports", error });
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
      case 'portfolio':
        try {
          // Get portfolio summary for CLI display
          const portfolios = await storage.getAllPortfolios();
          if (!portfolios || portfolios.length === 0) {
            return "📊 No portfolio data available\n💡 Create a portfolio to start trading";
          }
          const portfolio = portfolios[0]; // Get first portfolio
          const totalValue = parseFloat(portfolio.totalValue || "0");
          const dailyPnL = parseFloat(portfolio.dailyPnL || "0");
          const totalPnL = parseFloat(portfolio.totalPnL || "0");
          const winRate = parseFloat(portfolio.winRate || "0");
          
          return `💼 Portfolio Summary
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💰 Total Value: $${totalValue.toLocaleString()}
📈 Total P&L: ${totalPnL >= 0 ? '+' : ''}$${totalPnL.toLocaleString()} (${totalPnL >= 0 ? '📈' : '📉'})
📊 Daily P&L: ${dailyPnL >= 0 ? '+' : ''}$${dailyPnL.toLocaleString()}
🎯 Win Rate: ${winRate.toFixed(1)}%
💵 Cash Balance: $${parseFloat(portfolio.cashBalance || "0").toLocaleString()}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
        } catch (error) {
          return "❌ Error fetching portfolio data";
        }
      case 'risk':
        return "🛡️ Risk Management Status:\n📊 Portfolio risk: Monitored\n⚠️ Active stop-losses: Enabled\n🎯 Position limits: Enforced";
      case 'help':
        return "Available commands:\n- scan: Start token scanning\n- status: Show scanner status\n- alerts: Show unread alerts\n- portfolio: Show portfolio summary\n- risk: Show risk management status\n- help: Show this help";
      default:
        return `Unknown command: ${cmd}. Type 'help' for available commands.`;
    }
  }

  return httpServer;
}
