# MemeCoin Hunter - Memecoin Trading Platform

## Overview
MemeCoin Hunter is a comprehensive memecoin trading platform designed for real-time market scanning, portfolio management, and pattern analysis with integrated trading capabilities. It aims to help users identify trading opportunities in the volatile memecoin market through automated token scanning and machine learning pattern detection, featuring a dark-themed UI and multilingual support. Authenticated users receive $10,000 in virtual trading capital and access to all features free of charge.

## User Preferences
Preferred communication style: Simple, everyday language.

## Testing Credentials
**Standard Test Account:**
- **Email**: testuser@example.com
- **Password**: TestPassword123!
- **Username**: test_user
- **Portfolio**: $10,000.00 starting balance (Main Portfolio)

Use these credentials consistently for all testing and development work.

## System Architecture

### Frontend
The frontend is built with React 18 and TypeScript, using Vite, Tailwind CSS (dark theme), and shadcn/ui for a consistent, modern glassmorphism design. State management uses TanStack Query and React hooks, with Wouter for routing. Framer Motion provides animations and transitions. WebSocket integration ensures real-time updates. An interactive 5-step onboarding demo modal showcases platform capabilities to first-time users, highlighting performance metrics and key features.

### Backend
The backend utilizes Express.js and TypeScript, providing a RESTful API and WebSocket support. Key services include a Token Scanner, an ML Pattern Analyzer, and a Price Feed Service. A hybrid real-time price streaming infrastructure uses Coinbase and Binance WebSocket APIs as primary and fallback providers, with CoinGecko for unlisted tokens, achieving sub-second latency. Event-driven real-time portfolio tracking ensures updates within 250ms, complemented by smart throttling and a token-portfolio cache.

### Data Storage
PostgreSQL is the primary database, accessed via Drizzle ORM and hosted on Neon. The schema is normalized, including tables for users, tokens, portfolios, trades, and subscriptions, with Drizzle Kit for migrations.

### Authentication and Authorization
The platform supports password-based and Google OAuth authentication via Replit Auth. New users automatically receive $10,000 in virtual trading capital. Security measures include Zod validation, CORS, CSRF protection, and secure OAuth token management.

### Payment and Subscription System
The platform features a complete Stripe-powered subscription system with three membership tiers: Basic ($9/month), Pro ($29/month), and Enterprise ($99.99/month). Stripe Checkout handles secure payment processing with automatic recurring billing. The system includes subscription management endpoints for creating, updating, and canceling subscriptions, with webhook support for automated subscription lifecycle handling. Real money trading features are restricted to Enterprise tier subscribers with verified broker API keys.

**Security Features:**
- Server-side price validation using PLAN_PRICE_MAPPING prevents price manipulation attacks
- Price IDs stored in environment variables (STRIPE_PRICE_BASIC, STRIPE_PRICE_PRO, STRIPE_PRICE_ENTERPRISE)
- Frontend cannot forge plan/price mismatches - backend validates all checkout requests
- CSRF protection on all payment endpoints
- Graceful degradation: App runs without Stripe configured (subscription features return 503)

### Technical Implementations
A robust token scanning system utilizes CoinGecko APIs for discovering trending memecoins. The Enhanced ML Pattern Analysis System analyzes 7 days of price history, incorporates advanced technical indicators (ATR, ADX, OBV, Ichimoku Cloud), recognizes price action patterns (V-shaped reversals, accumulation), and performs order flow analysis. An Ensemble ML Scoring system combines signals with weighted confidence. The Market Health Analyzer evaluates five key metrics (volatility, trend, breadth, volume, correlation) to provide a health score, enabling intelligent trade gating and dynamic position sizing. The Advanced Chart Analysis System detects support/resistance levels, chart patterns (triangles, wedges, channels, H&S, double top/bottom), Fibonacci levels, and pivot points. It also features a dynamic exit strategy, risk-reward calculator, and entry/exit signal enhancements. Automated trading functionalities include pattern performance gating, a multi-stage take-profit strategy, improved risk management (5% stop-loss, cash floor, daily loss thresholds), and dynamic position sizing using Kelly Criterion calculations. Aggressive Trading Mode provides increased position sizing, relaxed market health thresholds, and lower confidence/risk-reward requirements. Portfolio management features include reset functionality, user-specific endpoints, and real-time updates via WebSocket. An Email Communication System, integrated with Resend, sends daily performance reports and feature update notifications with dark-themed HTML templates. **Pre-Authentication Demo Experience** displays an interactive 6-step onboarding modal to first-time visitors BEFORE requiring sign-in, showcasing platform capabilities including AI pattern recognition, real-time intelligence, automated trading engine, Trophy Room leaderboard, performance highlights, and paper trading account setup.

## External Dependencies

-   **Database Infrastructure**: `@neondatabase/serverless`, `drizzle-orm`, `connect-pg-simple`
-   **Frontend UI Framework**: `@radix-ui/*`, `@tanstack/react-query`, `tailwindcss`
-   **Development Tools**: `Vite`, `TypeScript`, `ESBuild`
-   **Real-time Communication**: `ws`, `WebSocket API`
-   **Validation and Utilities**: `zod`, `date-fns`, `clsx`, `tailwind-merge`
-   **Email Service**: `Resend API`
-   **Task Scheduling**: `node-cron` for automated daily email sending
-   **Payment Processing**: `Stripe API` for subscription management
-   **Market Data APIs**: `Coinbase WebSocket API`, `Binance WebSocket API`, `CoinGecko API`

## Recent Updates (2025-10-15)

### Critical Bug Fixes ✅
- **Trade Journal User Authentication Fix**: Fixed critical bug where Trade Journal endpoints (/api/journal/entries, /api/journal/stats, /api/journal/by-outcome/:outcome, /api/journal/by-strategy/:pattern) were hardcoded to show trades for demo@memehunter.app user only. Implementation includes:
  - Added `app.use('/api/journal', requireAuth)` middleware to ensure authentication
  - Updated all journal endpoints to use `req.user.id` instead of hardcoded demo user
  - Endpoints return 401 Unauthorized if user is not authenticated
  - Portfolio retrieval now user-scoped via `storage.getPortfolioByUserId(user.id)`
  - **Impact**: Trade Journal now displays trades specific to the logged-in user
- **Enterprise Subscription**: Updated from "Contact Sales" to direct purchase at $99.99/month
- **Stripe API Version Compatibility**: Removed future version override causing compile failures

### Stripe Payment Integration ✅
- Implemented complete Stripe subscription payment system with Checkout Sessions
- Added subscription tiers: Basic ($9), Pro ($29), Enterprise ($99) monthly plans
- Created subscription management endpoints with CSRF protection
- Integrated payment success handling and subscription activation
- Database schema updated with Stripe customer/subscription ID fields
- Setup guide created (STRIPE_SETUP.md) for product configuration

### Email Communication System ✅  
- Daily performance reports with portfolio metrics
- Feature update notifications
- Subscription upsell content for non-Enterprise users
- Dark-themed HTML email templates via Resend
- **Automated Email Scheduler**: Uses node-cron to send daily emails at 9:00 AM UTC
- **Dynamic URL Generation**: All email links use actual deployment domain (no hardcoded URLs)
- **Graceful Integration**: Scheduler starts on server init, runs alongside Position Tracker

### IP-Based Visitor Tracking ✅
- First-time visitor detection for demo modal
- Privacy-focused tracking (IP and user agent only)
- Automatic onboarding experience

### Social Media Marketing Campaign ✅
- Comprehensive multi-platform strategy document (SOCIAL_MEDIA_CAMPAIGN.md)
- Platform-specific content for Twitter, Telegram, Discord, TikTok, Reddit
- Engagement-optimized posts, hashtags, and influencer outreach plan

### Trophy Room Feature ✅
- **System-Wide Display**: Showcases top 20 most profitable closed trades across ALL portfolios and users
- Award-style UI with podium ranks (gold/silver/bronze medals) for top 3 trades
- Backend endpoint `/api/trophy-room` queries all trades using direct database access (not portfolio-scoped)
- Proper data serialization (ISO date strings, numeric values) for frontend compatibility
- Stats overview cards displaying top profit, average return, and best performer
- Trophy/award-themed dark glassmorphism design with responsive layout
- Multilingual navigation support (EN, ES, DE, JA, KO)
- Integrated between Journal and Risk Reports in sidebar navigation