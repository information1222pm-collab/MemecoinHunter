# MemeCoin Hunter - Memecoin Trading Platform

## Overview
MemeCoin Hunter is a comprehensive memecoin trading platform for real-time market scanning, portfolio management, and pattern analysis with integrated trading capabilities. It aims to identify trading opportunities in the volatile memecoin market through automated token scanning and machine learning pattern detection. Key features include a dark-themed UI, multilingual support, and a virtual trading capital of $10,000 for authenticated users. The platform focuses on providing a robust, data-driven environment for memecoin trading.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
The frontend uses React 18 with TypeScript, Vite, Tailwind CSS (dark theme), and shadcn/ui for a modern glassmorphism design. **GUI Theme**: Cyan/teal financial dashboard aesthetic with dark blue backgrounds (October 2025 update) featuring professional contrast, glassmorphism effects, and complementary color palette optimized for data visualization. State management relies on TanStack Query and React hooks, with Wouter for routing and Framer Motion for animations. WebSocket integration provides real-time updates. An interactive 5-step onboarding demo modal guides first-time users. Comprehensive data visualization is implemented using Recharts, with reusable chart components and utilities for various dashboards and reports.

### Backend
The backend is built with Express.js and TypeScript, offering a RESTful API and WebSocket support. It includes a Token Scanner, an ML Pattern Analyzer, and a Price Feed Service. A hybrid real-time price streaming infrastructure uses Coinbase and Binance WebSocket APIs (primary and fallback) and CoinGecko for unlisted tokens, ensuring sub-second latency. Event-driven real-time portfolio tracking provides updates within 250ms, supported by smart throttling and a token-portfolio cache. Authentication uses password-based and Google OAuth via Replit Auth, with new users receiving $10,000 virtual capital. Security includes Zod validation, CORS, CSRF protection, and secure OAuth.

### Data Storage
PostgreSQL is the primary database, accessed via Drizzle ORM and hosted on Neon. The schema includes tables for users, tokens, portfolios, trades, and subscriptions, with Drizzle Kit for migrations.

### Payment and Subscription System
A Stripe-powered subscription system offers Basic, Pro, and Enterprise tiers. Stripe Checkout handles secure payment processing with recurring billing. The system includes API endpoints for subscription management and webhook support for lifecycle handling. Real money trading is restricted to Enterprise subscribers with verified broker API keys. Server-side price validation prevents manipulation, and the system gracefully degrades if Stripe is not configured.

### Technical Implementations
The platform features a robust token scanning system using CoinGecko APIs. The Enhanced ML Pattern Analysis System utilizes 7 days of price history, advanced technical indicators (ATR, ADX, OBV, Ichimoku Cloud), recognizes price action patterns, and performs order flow analysis. An Ensemble ML Scoring system combines signals. The Market Health Analyzer evaluates five key metrics for trade gating and dynamic position sizing. The Advanced Chart Analysis System detects support/resistance, chart patterns, Fibonacci levels, and pivot points, with dynamic exit strategies and risk-reward calculation. Automated trading functionalities include pattern performance gating, multi-stage take-profit, improved risk management (5% stop-loss, cash floor, daily loss thresholds), and dynamic position sizing using Kelly Criterion. An Aggressive Trading Mode is available. Portfolio management includes reset functionality and real-time updates. An Email Communication System, integrated with Resend, sends daily performance reports and updates. A pre-authentication demo experience showcases platform capabilities. A 5-tier risk level system allows portfolio-specific trading parameters, affecting position sizing, stop-loss, and confidence thresholds. A "Trophy Room" feature displays the top 20 most profitable closed trades across all users.

### Memory Management & Performance
The platform includes comprehensive memory management and performance optimizations:
- **Data Cleanup Service**: Runs every 6 hours to automatically delete old data (price history >14 days, orphaned patterns >7 days, scan alerts >30 days, audit logs >90 days), preventing database bloat and memory issues
- **ML Analyzer Optimization**: Processes only top 50 tokens by market cap in batches of 10, with forced garbage collection between batches to control memory usage
- **Code Splitting**: React.lazy() on 16 pages reduces initial bundle size by ~50%
- **Chart Memoization**: 6 chart components use React.memo to prevent unnecessary re-renders
- **Compression**: Gzip middleware reduces response sizes by ~70%
- **Database Indexing**: 26 strategic indexes improve query performance by 2-5x
- **Price History Truncation**: ML Analyzer limits historical data to 1000 most recent points per token

## External Dependencies

-   **Database Infrastructure**: `@neondatabase/serverless`, `drizzle-orm`, `connect-pg-simple`
-   **Frontend UI Framework**: `@radix-ui/*`, `@tanstack/react-query`, `tailwindcss`
-   **Real-time Communication**: `ws`, `WebSocket API`
-   **Validation and Utilities**: `zod`, `date-fns`, `clsx`, `tailwind-merge`
-   **Email Service**: `Resend API`
-   **Task Scheduling**: `node-cron`
-   **Payment Processing**: `Stripe API`
-   **Market Data APIs**: `Coinbase WebSocket API`, `Binance WebSocket API`, `CoinGecko API`