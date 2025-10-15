# CryptoHobby - Memecoin Trading Platform

## Overview
CryptoHobby is a comprehensive memecoin trading platform for real-time market scanning, portfolio management, and pattern analysis with integrated trading capabilities. It features a dark-themed UI, multilingual support, and aims to assist users in identifying trading opportunities in the volatile memecoin market through automated token scanning and machine learning pattern detection. The platform includes a CLI-style terminal for advanced users and utilizes WebSocket connectivity for live market data. All features are currently available to authenticated users free of charge, and new users receive $10,000 in virtual trading capital.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
Built with React 18 and TypeScript, using Vite for development. Styling is handled by Tailwind CSS with a custom dark theme and shadcn/ui for consistent components. State management uses TanStack Query for server state and React hooks for local state. Wouter is used for client-side routing. WebSocket integration provides real-time updates. The platform features a modern glassmorphism design system with a dark theme, utilizing Framer Motion for animations and transitions. The UI is responsive and optimized for a professional trading experience, including sophisticated icon-specific animations and micro-interactions throughout the sidebar, and prominent center-screen modal dialogs for trade notifications and milestones.

### Backend
Developed with Express.js and TypeScript (ESM configuration), providing a RESTful API and WebSocket support. Key background services include a Token Scanner, an ML Pattern Analyzer, and a Price Feed Service. The WebSocket server manages real-time client connections.

### Data Storage
Primary database is PostgreSQL, accessed via Drizzle ORM and hosted on Neon. The schema is normalized, including tables for users, tokens, portfolios, trades, and subscriptions. Drizzle Kit manages schema migrations.

### Authentication and Authorization
Supports dual authentication: password-based and OAuth (Google Login via Replit Auth). Every new user receives $10,000 in virtual trading money. Account linking is supported by email. Security measures include Zod validation, CORS, CSRF protection, and secure OAuth token management. New users are automatically logged in after registration with session persistence.

### Technical Implementations
Includes a robust token scanning system that automatically discovers and tracks trending memecoins using CoinGecko APIs, significantly expanding tracked coins and lowering discovery thresholds for more opportunities.

**Enhanced ML Pattern Analysis System (Latest Update):**
- **Extended Historical Analysis**: Analyzes 7 days of price history (up from 24 hours) with minimum 50 data points for superior pattern recognition
- **Advanced Technical Indicators**: ATR (Average True Range) for volatility measurement, ADX (Average Directional Index) for trend strength detection, OBV (On-Balance Volume) for volume momentum tracking, and Ichimoku Cloud for comprehensive multi-timeframe trend analysis
- **Price Action Pattern Recognition**: Detects V-shaped reversals, strong bullish momentum (3+ consecutive highs), accumulation patterns (stable price + rising volume), and consolidation breakouts using close-price analysis
- **Order Flow Analysis**: Identifies buy/sell pressure ratios (>65% buy pressure triggers signal) and institutional accumulation patterns by analyzing volume-weighted price action and OBV trends
- **Ensemble ML Scoring**: Combines multiple pattern signals with weighted confidence scoring (80%+ threshold) for high-quality buy signals, incorporating trend strength bonuses from ADX (>25) and Ichimoku cloud alignment for +10% confidence boost
- **ML Feature Enhancement**: Expanded feature set includes 10 technical indicators (vs previous 5), 6 sentiment features (vs previous 5), and advanced pattern recognition for superior signal accuracy

Automated trading functionalities have comprehensive profitability improvements, including pattern performance gating (50%+ win rate, positive expectancy), a multi-stage take-profit strategy (30% at 6% gain, 40% at 10% gain, rest at 15% gain), improved risk management (5% stop-loss, cash floor enforcement, daily loss thresholds), and dynamic position sizing using Kelly Criterion calculations. Critical bug fixes include accurate portfolio position display, correct portfolio analytics calculations (total value, P&L, daily P&L), and live data updates for the dashboard and portfolio pages.

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