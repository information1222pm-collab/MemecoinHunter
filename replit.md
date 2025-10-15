# CryptoHobby - Memecoin Trading Platform

## Overview
CryptoHobby is a comprehensive memecoin trading platform for real-time market scanning, portfolio management, and pattern analysis with integrated trading capabilities. It features a dark-themed UI, multilingual support, and aims to assist users in identifying trading opportunities in the volatile memecoin market through automated token scanning and machine learning pattern detection. The platform includes a CLI-style terminal for advanced users and utilizes WebSocket connectivity for live market data. All features are currently available to authenticated users free of charge, and new users receive $10,000 in virtual trading capital.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
Built with React 18 and TypeScript, using Vite for development. Styling is handled by Tailwind CSS with a custom dark theme and shadcn/ui for consistent components. State management uses TanStack Query for server state and React hooks for local state. Wouter is used for client-side routing. WebSocket integration provides real-time updates. The platform features a modern glassmorphism design system with a dark theme, utilizing Framer Motion for animations and transitions. The UI is responsive and optimized for a professional trading experience, including sophisticated icon-specific animations and micro-interactions throughout the sidebar, and prominent center-screen modal dialogs for trade notifications and milestones.

**Optimized Real-Time Data Updates:**
- Dashboard analytics: 15s refresh (analytics, exposure, market health)
- Scanner status: 3s refresh for near real-time updates
- Alerts: 10s refresh for faster alert notifications
- Portfolio positions: 15s refresh with 10s stale time
- Trade history: 20s refresh with 15s stale time
- WebSocket integration for instant updates on trades, portfolio changes, and price movements

### Backend
Developed with Express.js and TypeScript (ESM configuration), providing a RESTful API and WebSocket support. Key background services include a Token Scanner, an ML Pattern Analyzer, and a Price Feed Service. The WebSocket server manages real-time client connections.

**Real-Time Price Streaming Infrastructure (LATEST - October 2025):**
- **Streaming Price Gateway**: WebSocket-based real-time price feeds with <1s latency (replaces traditional 20s polling)
- **Primary Provider**: Coinbase WebSocket API (wss://ws-feed.exchange.coinbase.com)
  - Supports 32+ major tokens (BTC, ETH, SOL, DOGE, SHIB, XRP, NEAR, AAVE, ARB, etc.)
  - No geo-blocking restrictions
  - Sub-second price updates with tick-level granularity
- **Fallback Provider**: Binance WebSocket API (wss://stream.binance.com:9443/stream) 
  - Auto-switches on Coinbase failure
  - Supports 45+ trading pairs
- **Hybrid Architecture**: Exchange WebSocket for listed tokens, CoinGecko API fallback for unlisted tokens
- **Event-Driven Updates**: Price changes emit real-time events to auto-trader, ML analyzer, and WebSocket clients
- **Database Integration**: Async non-blocking price history writes for ML pattern analysis

**Real-Time Portfolio Tracking (Event-Driven - October 2025):**
- **Event-Driven Position Updates**: Portfolio values recalculate immediately on price tick events (<250ms latency)
- **Smart Throttling**: 250ms batching per portfolio prevents update storms while maintaining real-time responsiveness
- **Token-Portfolio Cache**: O(1) lookups via cached mapping, refreshed every 30s for new positions
- **Backup Polling**: 30s fallback sweep ensures no missed updates
- **WebSocket Broadcasting**: Instant portfolio_updated events to subscribed users with sub-second delivery

**Legacy Service Intervals (still active for non-exchange tokens):**
- Price Feed Service: 20s update interval (CoinGecko fallback)
- WebSocket price broadcasting: Instant relay of streaming exchange data
- Market health analysis: Real-time calculation with 5-minute caching

### Data Storage
Primary database is PostgreSQL, accessed via Drizzle ORM and hosted on Neon. The schema is normalized, including tables for users, tokens, portfolios, trades, and subscriptions. Drizzle Kit manages schema migrations.

### Authentication and Authorization
Supports dual authentication: password-based and OAuth (Google Login via Replit Auth). Every new user receives $10,000 in virtual trading money. Account linking is supported by email. Security measures include Zod validation, CORS, CSRF protection, and secure OAuth token management. New users are automatically logged in after registration with session persistence.

**Recent Authentication Fixes:**
- Fixed Google OAuth empty user session bug by properly extracting and storing userId, email, firstName, lastName from Replit Auth claims
- Fixed OAuth error redirect loop by redirecting errors to root page with error parameters instead of /api/login

### Technical Implementations
Includes a robust token scanning system that automatically discovers and tracks trending memecoins using CoinGecko APIs, significantly expanding tracked coins and lowering discovery thresholds for more opportunities.

**Enhanced ML Pattern Analysis System (Latest Update):**
- **Extended Historical Analysis**: Analyzes 7 days of price history (up from 24 hours) with minimum 50 data points for superior pattern recognition
- **Advanced Technical Indicators**: ATR (Average True Range) for volatility measurement, ADX (Average Directional Index) for trend strength detection, OBV (On-Balance Volume) for volume momentum tracking, and Ichimoku Cloud for comprehensive multi-timeframe trend analysis
- **Price Action Pattern Recognition**: Detects V-shaped reversals, strong bullish momentum (3+ consecutive highs), accumulation patterns (stable price + rising volume), and consolidation breakouts using close-price analysis
- **Order Flow Analysis**: Identifies buy/sell pressure ratios (>65% buy pressure triggers signal) and institutional accumulation patterns by analyzing volume-weighted price action and OBV trends
- **Ensemble ML Scoring**: Combines multiple pattern signals with weighted confidence scoring (80%+ threshold) for high-quality buy signals, incorporating trend strength bonuses from ADX (>25) and Ichimoku cloud alignment for +10% confidence boost
- **ML Feature Enhancement**: Expanded feature set includes 10 technical indicators (vs previous 5), 6 sentiment features (vs previous 5), and advanced pattern recognition for superior signal accuracy

**Market Health Analyzer System:**
- **Multi-Dimensional Market Analysis**: Evaluates 5 key market metrics - volatility levels, trend direction, market breadth (% tokens trending up), volume health, and cross-asset correlation
- **Health Scoring (0-100 scale)**: Weighted combination of metrics provides comprehensive market health score: Healthy (80+), Caution (60-80), Minimize (40-60), Halt (<40)
- **Intelligent Trade Gating**: Blocks trades during unfavorable market conditions based on health score and pattern confidence thresholds
- **Dynamic Position Sizing**: Automatically adjusts position sizes (0.5x-1.0x multiplier) based on market health to reduce risk during uncertain conditions
- **Performance Optimization**: 5-minute caching prevents excessive computation while maintaining market awareness, health checks run every 5 minutes
- **Auto-Trader Integration**: All trades pass through market health validation before execution, ensuring trades only occur when market conditions support success

**Advanced Chart Analysis System (Latest):**
- **Support/Resistance Detection**: Identifies key price levels with strength scoring (0-100) based on touch count and volume. Automatically merges similar levels within 2% range and ranks by significance
- **Chart Pattern Recognition**: Detects 8 major patterns including ascending/descending/symmetrical triangles, rising/falling wedges, channels (up/down), head & shoulders, and double top/bottom. Each pattern includes breakout targets, entry points, stop-loss levels, and risk-reward ratios
- **Fibonacci Analysis**: Calculates retracement (23.6%, 38.2%, 50%, 61.8%, 78.6%) and extension levels (127.2%, 161.8%, 261.8%) for precise entry/exit targets. Automatically determines optimal entry zones and profit targets based on trend direction
- **Pivot Point System**: Three calculation methods - Classic, Fibonacci, and Camarilla pivots for intraday trading levels. Provides multiple resistance/support levels for scalping and day trading strategies
- **Dynamic Exit Strategy**: Volatility-based stop-loss adjustment (3-7% range), trend-strength trailing stops, and multi-target profit taking. Integrates support/resistance levels for optimal exit timing
- **Risk-Reward Calculator**: Analyzes trade quality before execution with four-tier scoring (excellent ≥3:1, good ≥2:1, acceptable ≥1.5:1, poor <1.5:1). Automatically rejects trades below 1.5:1 R:R ratio
- **Entry Signal Enhancement**: ML patterns now validated against chart analysis for confirmation. Confidence adjusted ±15% based on chart alignment. Trade quality assessment includes support proximity, pattern confirmation, and technical alignment scoring
- **Exit Signal Enhancement**: Chart-based exits detect bearish patterns and resistance levels for early profit-taking. Monitors price action for optimal exit timing beyond fixed percentage targets

Automated trading functionalities have comprehensive profitability improvements, including pattern performance gating (50%+ win rate, positive expectancy), a multi-stage take-profit strategy (30% at 8% gain, 40% at 12% gain, rest at 18% gain), improved risk management (5% stop-loss, cash floor enforcement, daily loss thresholds), and dynamic position sizing using 2x Kelly Criterion calculations. Chart analysis integration ensures trades have favorable entry/exit points with proper risk-reward ratios (minimum 1.2:1). Critical bug fixes include accurate portfolio position display, correct portfolio analytics calculations (total value, P&L, daily P&L), and live data updates for the dashboard and portfolio pages.

**Portfolio Management Features:**
- Portfolio reset functionality with custom starting capital (minimum $100, accessible in Settings page)
- Atomic portfolio reset: deletes all positions, resets P&L values to zero, preserves trade history for reference
- User-specific portfolio endpoints: `/api/portfolio` for authenticated user's portfolio, `/api/portfolio/trades` for trade history
- Real-time portfolio updates via WebSocket for instant position and balance changes
- Comprehensive portfolio analytics including risk metrics, top performers, and diversification analysis

**Aggressive Trading Mode (Latest):**
- **2x Kelly Position Sizing**: Doubled position sizes from Kelly Criterion (15% → 30% maximum) for higher profit potential
- **Relaxed Market Health Thresholds**: Lowered trading barriers (trade_cautiously: 40-60, minimize_trading: 20-40, trade_normally: 60+) to enable more opportunities
- **Lower Confidence Requirements**: Reduced minimum confidence from 75-90% to 75-82% across market conditions
- **Reduced Risk-Reward Requirement**: Lowered minimum R:R ratio from 1.5:1 to 1.2:1 for more trade entries
- **Higher Take-Profit Targets**: Increased exit levels to 8%, 12%, 18% (from 6%, 10%, 15%) for larger gains per trade

## External Dependencies

-   **Database Infrastructure**:
    -   `@neondatabase/serverless`: Serverless PostgreSQL connection pooling
    -   `drizzle-orm`: Type-safe ORM
    -   `connect-pg-simple`: PostgreSQL session store for Express
-   **Frontend UI Framework**:
    -   `@radix-ui/*`: Accessible UI primitives
    -   `@tanstack/react-query`: Server state management
    -   `tailwindcss`: Utility-first CSS framework
-   **Development Tools**:
    -   `Vite`: Build tool and development server
    -   `TypeScript`: Type safety
    -   `ESBuild`: Production bundling
-   **Real-time Communication**:
    -   `ws`: WebSocket library for Node.js
    -   `WebSocket API`: Browser-native WebSocket
-   **Validation and Utilities**:
    -   `zod`: Runtime type validation
    -   `date-fns`: Date manipulation
    -   `clsx` & `tailwind-merge`: Conditional CSS class utilities