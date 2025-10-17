import bcrypt from 'bcrypt';
import { storage } from '../storage';
import type { User, Portfolio } from '@shared/schema';

interface DemoUserResult {
  user: User;
  portfolio: Portfolio;
}

let cachedDemoUser: DemoUserResult | null = null;
let lastCacheTime = 0;
const CACHE_TTL = 60000; // 1 minute cache

/**
 * Get or create demo user and portfolio with caching
 * This eliminates duplicate user creation logic across endpoints
 */
export async function getDemoUserAndPortfolio(): Promise<DemoUserResult> {
  // Return cached result if fresh
  const now = Date.now();
  if (cachedDemoUser && (now - lastCacheTime) < CACHE_TTL) {
    return cachedDemoUser;
  }

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

  // Cache the result
  cachedDemoUser = { user: demoUser, portfolio };
  lastCacheTime = now;

  return cachedDemoUser;
}

/**
 * Clear the demo user cache (useful when portfolio data changes)
 */
export function clearDemoUserCache(): void {
  cachedDemoUser = null;
  lastCacheTime = 0;
}
