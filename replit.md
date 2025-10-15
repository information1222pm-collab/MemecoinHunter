# CryptoHobby - Memecoin Trading Platform

## Overview
CryptoHobby is a comprehensive memecoin trading platform designed for real-time market scanning, portfolio management, and pattern analysis with integrated trading capabilities. It aims to help users identify trading opportunities in the volatile memecoin market through automated token scanning and machine learning pattern detection, featuring a dark-themed UI and multilingual support. Authenticated users receive $10,000 in virtual trading capital and access to all features free of charge.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
The frontend is built with React 18 and TypeScript, using Vite, Tailwind CSS (dark theme), and shadcn/ui for a consistent, modern glassmorphism design. State management uses TanStack Query and React hooks, with Wouter for routing. Framer Motion provides animations and transitions. WebSocket integration ensures real-time updates. An interactive 5-step onboarding demo modal showcases platform capabilities to first-time users, highlighting performance metrics and key features.

### Backend
The backend utilizes Express.js and TypeScript, providing a RESTful API and WebSocket support. Key services include a Token Scanner, an ML Pattern Analyzer, and a Price Feed Service. A hybrid real-time price streaming infrastructure uses Coinbase and Binance WebSocket APIs as primary and fallback providers, with CoinGecko for unlisted tokens, achieving sub-second latency. Event-driven real-time portfolio tracking ensures updates within 250ms, complemented by smart throttling and a token-portfolio cache.

### Data Storage
PostgreSQL is the primary database, accessed via Drizzle ORM and hosted on Neon. The schema is normalized, including tables for users, tokens, portfolios, trades, and subscriptions, with Drizzle Kit for migrations.

### Authentication and Authorization
The platform supports password-based and Google OAuth authentication via Replit Auth. New users automatically receive $10,000 in virtual trading capital. Security measures include Zod validation, CORS, CSRF protection, and secure OAuth token management.

### Technical Implementations
A robust token scanning system utilizes CoinGecko APIs for discovering trending memecoins. The Enhanced ML Pattern Analysis System analyzes 7 days of price history, incorporates advanced technical indicators (ATR, ADX, OBV, Ichimoku Cloud), recognizes price action patterns (V-shaped reversals, accumulation), and performs order flow analysis. An Ensemble ML Scoring system combines signals with weighted confidence. The Market Health Analyzer evaluates five key metrics (volatility, trend, breadth, volume, correlation) to provide a health score, enabling intelligent trade gating and dynamic position sizing. The Advanced Chart Analysis System detects support/resistance levels, chart patterns (triangles, wedges, channels, H&S, double top/bottom), Fibonacci levels, and pivot points. It also features a dynamic exit strategy, risk-reward calculator, and entry/exit signal enhancements. Automated trading functionalities include pattern performance gating, a multi-stage take-profit strategy, improved risk management (5% stop-loss, cash floor, daily loss thresholds), and dynamic position sizing using Kelly Criterion calculations. Aggressive Trading Mode provides increased position sizing, relaxed market health thresholds, and lower confidence/risk-reward requirements. Portfolio management features include reset functionality, user-specific endpoints, and real-time updates via WebSocket. An Email Communication System, integrated with Resend, sends daily performance reports and feature update notifications with dark-themed HTML templates. IP-Based Visitor Tracking detects first-time visitors to trigger the onboarding demo.

## External Dependencies

-   **Database Infrastructure**: `@neondatabase/serverless`, `drizzle-orm`, `connect-pg-simple`
-   **Frontend UI Framework**: `@radix-ui/*`, `@tanstack/react-query`, `tailwindcss`
-   **Development Tools**: `Vite`, `TypeScript`, `ESBuild`
-   **Real-time Communication**: `ws`, `WebSocket API`
-   **Validation and Utilities**: `zod`, `date-fns`, `clsx`, `tailwind-merge`
-   **Email Service**: `Resend API`
-   **Market Data APIs**: `Coinbase WebSocket API`, `Binance WebSocket API`, `CoinGecko API`