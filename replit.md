# MemeCoin Hunter - Memecoin Trading Platform

## Overview
MemeCoin Hunter is a comprehensive memecoin trading platform for real-time market scanning, portfolio management, and pattern analysis with integrated trading capabilities. It aims to identify trading opportunities in the volatile memecoin market through automated token scanning and machine learning pattern detection. Key features include a dark-themed UI, multilingual support, and a virtual trading capital of $10,000 for authenticated users. The platform focuses on providing a robust, data-driven environment for memecoin trading.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
The frontend uses React 18 with TypeScript, Vite, Tailwind CSS (dark theme), and shadcn/ui for a modern glassmorphism design. **GUI Theme**: Minimalist cyan/teal financial dashboard aesthetic with dark blue backgrounds (October 2025 update) featuring professional contrast, glassmorphism effects, and a simplified monochromatic color palette optimized for data visualization. All charts and UI elements use cyan/teal variations for consistency, with red for errors and green for success. State management relies on TanStack Query and React hooks, with Wouter for routing and Framer Motion for animations. WebSocket integration provides real-time updates. An interactive 5-step onboarding demo modal guides first-time users. Comprehensive data visualization is implemented using Recharts, with reusable chart components and utilities for various dashboards and reports.

### Backend
The backend is built with Express.js and TypeScript, offering a RESTful API and WebSocket support. It includes a Token Scanner, an ML Pattern Analyzer, and a Price Feed Service. A hybrid real-time price streaming infrastructure uses Coinbase and Binance WebSocket APIs (primary and fallback) and CoinGecko for unlisted tokens, ensuring sub-second latency. Event-driven real-time portfolio tracking provides updates within 250ms, supported by smart throttling and a token-portfolio cache. Authentication uses password-based and Google OAuth via Replit Auth, with new users receiving $10,000 virtual capital. Security includes Zod validation, CORS, CSRF protection, and secure OAuth.

### Data Storage
PostgreSQL is the primary database, accessed via Drizzle ORM and hosted on Neon. The schema includes tables for users, tokens, portfolios, trades, and subscriptions, with Drizzle Kit for migrations.

### Payment and Subscription System
A Stripe-powered subscription system offers Basic, Pro, and Enterprise tiers. Stripe Checkout handles secure payment processing with recurring billing. The system includes API endpoints for subscription management and webhook support for lifecycle handling. Real money trading is restricted to Enterprise subscribers with verified broker API keys. Server-side price validation prevents manipulation, and the system gracefully degrades if Stripe is not configured.

### Technical Implementations
The platform features a robust token scanning system using CoinGecko APIs. The Enhanced ML Pattern Analysis System utilizes 7 days of price history, advanced technical indicators (ATR, ADX, OBV, Ichimoku Cloud), recognizes price action patterns, and performs order flow analysis. An Ensemble ML Scoring system combines signals. The Market Health Analyzer evaluates five key metrics for trade gating and dynamic position sizing. The Advanced Chart Analysis System detects support/resistance, chart patterns, Fibonacci levels, and pivot points, with dynamic exit strategies and risk-reward calculation. Automated trading functionalities include pattern performance gating, multi-stage take-profit, and dynamic position sizing using Kelly Criterion. **Trading operates continuously without stop-loss mechanisms or daily trading limits** (October 2025 update: Removed all stop-loss percentages, maxDailyTrades, sellOnlyMode, maxDailyLossPercentage, and minCashPercentage - only take-profit stages remain for position management). An Aggressive Trading Mode is available. Portfolio management includes reset functionality and real-time updates. An Email Communication System, integrated with Resend, sends daily performance reports and updates. A pre-authentication demo experience showcases platform capabilities. A 5-tier risk level system allows portfolio-specific trading parameters, affecting position sizing, stop-loss, and confidence thresholds. A "Trophy Room" feature displays the top 20 most profitable closed trades across all users.

**Early-Launch Detection System** (Experimental): An intelligent system that automatically detects newly launched coins (≤5 minutes on market), tracks their 1-hour performance to classify success (>100% growth) or failure, analyzes patterns from historical launches, experiments with trading strategies, and executes trades when strategies achieve ≥65% win rate and ≥50% profit per trade. The system includes: (1) Launch Scanner service scanning every 2 minutes for early coins, (2) Performance Tracker monitoring final 1-hour prices for outcome classification, (3) Pattern Analyzer mining successful launches and rejection criteria from failures, (4) Strategy Experimenter testing approaches with performance tracking, (5) Launch Auto-Trader executing validated strategies with configurable daily limits and position sizes. Database schema includes launch_coins, launch_analysis, launch_strategies, and launch_performance tables. Frontend features a dedicated Launch Analytics dashboard (`/launch-analytics`) displaying statistics, active strategy performance, strategy comparison with colored badges (green ≥65%/≥50%, yellow ≥50%/≥30%, red below thresholds), and recent launches with success/failure classification. Portfolio-level configuration available in Settings with enable/disable toggle, max daily trades, and max position size controls.

### Memory Management & Performance
The platform includes comprehensive memory management and performance optimizations:
- **Instant Loading Screens**: Pre-React HTML splash screen with cyan/teal branding appears immediately on page load, comprehensive skeleton screens provide instant visual feedback while React loads, optimized font preloading and lazy-loaded background animations ensure sub-second perceived load times, animated progress bar with shimmer effect shows loading status
- **Stale-While-Revalidate Caching**: In-memory cache with stale-while-revalidate strategy ensures consistent sub-second API responses (10-150ms cached, <1s initial load), background refresh keeps data fresh without blocking requests. Cached endpoints: `/api/analytics/all` (5s TTL), `/api/risk/exposure` (5s TTL), `/api/market-health` (5s TTL), `/api/scanner/status` (3s TTL), `/api/alerts` (4s TTL), `/api/auto-trader/portfolio` (4s TTL)
- **Cache Pre-warming**: Critical endpoint caches are warmed on server startup (`server/utils/cache-warmer.ts`) for instant first-load responses, eliminating cold-start latency
- **Demo User Helper**: Shared utility (`server/utils/demo-user.ts`) centralizes demo account creation across endpoints, reducing duplicate code and improving response times
- **Dynamic Refresh Interval**: User-configurable refresh interval (10s, 30s, 1min, 5min) in settings controls all data query refetch rates across the app, persisted in localStorage, applied globally to Dashboard, Scanner, Home, and other pages
- **Data Cleanup Service**: Runs every 6 hours to automatically delete old data (price history >14 days, orphaned patterns >7 days, scan alerts >30 days, audit logs >90 days), preventing database bloat and memory issues
- **ML Analyzer Optimization**: Processes only top 50 tokens by market cap in batches of 10, with forced garbage collection between batches to control memory usage
- **Code Splitting**: React.lazy() on 16 pages reduces initial bundle size by ~50%
- **Chart Memoization**: 6 chart components use React.memo to prevent unnecessary re-renders
- **Compression**: Gzip middleware reduces response sizes by ~70%
- **Database Indexing**: 26 strategic indexes improve query performance by 2-5x
- **Price History Truncation**: ML Analyzer limits historical data to 1000 most recent points per token

### Routing & Navigation
- **Billing Route**: The `/billing` route redirects to `/subscription` for unified subscription management (October 2025)
- **Auto-Trading Toggle**: Portfolio-level auto-trading control with real-time monitoring of 38 portfolios, fixed dynamic import issues for reliable service initialization

### Chart Behavior & Data Display
Charts display data based on actual trading activity and applied filters:
- **Empty State Behavior**: Charts appear empty when filters exclude all data, user has no closed trades, or viewing a portfolio with no trading history
- **Data Requirements**: Journal and Analytics charts require closed trades; Portfolio charts need active positions or historical data
- **Filter Impact**: Date range, outcome, strategy, and token filters can restrict displayed data

## External Dependencies

-   **Database Infrastructure**: `@neondatabase/serverless`, `drizzle-orm`, `connect-pg-simple`
-   **Frontend UI Framework**: `@radix-ui/*`, `@tanstack/react-query`, `tailwindcss`
-   **Real-time Communication**: `ws`, `WebSocket API`
-   **Validation and Utilities**: `zod`, `date-fns`, `clsx`, `tailwind-merge`
-   **Email Service**: `Resend API`
-   **Task Scheduling**: `node-cron`
-   **Payment Processing**: `Stripe API`
-   **Market Data APIs**: `Coinbase WebSocket API`, `Binance WebSocket API`, `CoinGecko API`