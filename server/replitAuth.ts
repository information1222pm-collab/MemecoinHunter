// Replit Auth - OpenID Connect integration for Google, GitHub, X, Apple login
// Reference: blueprint:javascript_log_in_with_replit
import * as client from "openid-client";
import { Strategy, type VerifyFunction } from "openid-client/passport";
import passport from "passport";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import memoize from "memoizee";
import connectPg from "connect-pg-simple";
import { storage } from "./storage";

// Check if Replit Auth environment variables are available
export const isReplitAuthAvailable = !!(
  process.env.REPLIT_DOMAINS &&
  process.env.REPL_ID &&
  process.env.SESSION_SECRET
);

if (!isReplitAuthAvailable) {
  console.warn("⚠️  Replit Auth not configured. Google login will be unavailable.");
  console.warn("   Required environment variables: REPLIT_DOMAINS, REPL_ID, SESSION_SECRET");
}

const getOidcConfig = memoize(
  async () => {
    return await client.discovery(
      new URL(process.env.ISSUER_URL ?? "https://replit.com/oidc"),
      process.env.REPL_ID!
    );
  },
  { maxAge: 3600 * 1000 }
);

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: false,
    ttl: sessionTtl,
    tableName: "sessions",
  });
  return session({
    secret: process.env.SESSION_SECRET!,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production', // Only secure cookies in production
      maxAge: sessionTtl,
    },
  });
}

function updateUserSession(
  user: any,
  tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers
) {
  user.claims = tokens.claims();
  user.access_token = tokens.access_token;
  user.refresh_token = tokens.refresh_token;
  user.expires_at = user.claims?.exp;
}

async function upsertUser(claims: any) {
  await storage.upsertUser({
    id: claims["sub"],
    email: claims["email"],
    firstName: claims["first_name"],
    lastName: claims["last_name"],
    profileImageUrl: claims["profile_image_url"],
  });
}

export async function setupAuth(app: Express) {
  // Only set up Replit Auth if environment variables are available
  if (!isReplitAuthAvailable) {
    console.log("ℹ️  Skipping Replit Auth setup - environment variables not configured");
    return;
  }

  // Note: Session middleware is already set up in routes.ts
  // We only need to add passport middleware and OAuth routes
  app.use(passport.initialize());
  app.use(passport.session());

  const config = await getOidcConfig();

  const verify: VerifyFunction = async (
    tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers,
    verified: passport.AuthenticateCallback
  ) => {
    const claims = tokens.claims();
    if (!claims) {
      return verified(new Error("No claims in token"));
    }
    
    const user: any = {
      id: claims["sub"],
      email: claims["email"],
      firstName: claims["first_name"],
      lastName: claims["last_name"],
    };
    updateUserSession(user, tokens);
    await upsertUser(claims);
    verified(null, user);
  };

  for (const domain of process.env.REPLIT_DOMAINS!.split(",")) {
    const strategy = new Strategy(
      {
        name: `replitauth:${domain}`,
        config,
        scope: "openid email profile offline_access",
        callbackURL: `https://${domain}/api/callback`,
      },
      verify
    );
    passport.use(strategy);
  }

  passport.serializeUser((user: Express.User, cb) => cb(null, user));
  passport.deserializeUser((user: Express.User, cb) => cb(null, user));

  // Helper function to get the correct domain for passport strategy
  const getDomainForStrategy = (hostname: string): string => {
    const domains = process.env.REPLIT_DOMAINS!.split(",");
    
    // If hostname matches one of the registered domains, use it
    if (domains.includes(hostname)) {
      return hostname;
    }
    
    // Otherwise, use the first domain as fallback (handles localhost, etc.)
    console.log(`[OAUTH] Hostname ${hostname} not in REPLIT_DOMAINS, using first domain: ${domains[0]}`);
    return domains[0];
  };

  app.get("/api/login", (req, res, next) => {
    const domain = getDomainForStrategy(req.hostname);
    
    // CRITICAL: Save session before OAuth redirect to preserve state token
    req.session.save((err) => {
      if (err) {
        console.error('[OAUTH] Session save error before redirect:', err);
      }
      
      passport.authenticate(`replitauth:${domain}`, {
        prompt: "login consent",
        scope: ["openid", "email", "profile", "offline_access"],
      })(req, res, next);
    });
  });

  app.get("/api/callback", (req, res, next) => {
    console.log(`[OAUTH-CALLBACK] Route hit! Hostname: ${req.hostname}, Full URL: ${req.protocol}://${req.get('host')}${req.originalUrl}`);
    const domain = getDomainForStrategy(req.hostname);
    console.log(`[OAUTH] Callback received from ${req.hostname}, using strategy domain: ${domain}`);
    console.log(`[OAUTH] Query params:`, req.query);
    
    passport.authenticate(`replitauth:${domain}`, 
      (err: any, user: any, info: any) => {
        if (err) {
          console.error(`[OAUTH] Authentication error:`, err);
          return res.redirect("/?error=auth_failed");
        }
        
        if (!user) {
          console.error(`[OAUTH] No user returned. Info:`, info);
          return res.redirect("/?error=no_user");
        }
        
        req.logIn(user, (loginErr) => {
          if (loginErr) {
            console.error(`[OAUTH] Login error:`, loginErr);
            return res.redirect("/?error=login_failed");
          }
          
          // CRITICAL FIX: Store userId in session for app authentication
          (req.session as any).userId = user.id;
          
          console.log(`[OAUTH] User authenticated, userId set to: ${user.id}`);
          console.log(`[OAUTH] Session before save:`, req.session);
          
          // CRITICAL: Explicitly save session to ensure userId persists
          req.session.save((saveErr) => {
            if (saveErr) {
              console.error(`[OAUTH] Session save error:`, saveErr);
              return res.redirect("/?error=session_save_failed");
            }
            
            console.log(`[OAUTH] Session saved successfully for user ${user.id}`);
            return res.redirect("/");
          });
        });
      }
    )(req, res, next);
  });

  app.get("/api/logout", (req, res) => {
    req.logout(() => {
      res.redirect(
        client.buildEndSessionUrl(config, {
          client_id: process.env.REPL_ID!,
          post_logout_redirect_uri: `${req.protocol}://${req.hostname}`,
        }).href
      );
    });
  });
}

export const isAuthenticated: RequestHandler = async (req, res, next) => {
  const user = req.user as any;

  if (!req.isAuthenticated() || !user.expires_at) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const now = Math.floor(Date.now() / 1000);
  if (now <= user.expires_at) {
    return next();
  }

  const refreshToken = user.refresh_token;
  if (!refreshToken) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  try {
    const config = await getOidcConfig();
    const tokenResponse = await client.refreshTokenGrant(config, refreshToken);
    updateUserSession(user, tokenResponse);
    return next();
  } catch (error) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }
};
