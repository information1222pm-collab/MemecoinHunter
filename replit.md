# CryptoHobby - Memecoin Trading Platform

## Overview
CryptoHobby is a comprehensive memecoin trading platform offering real-time market scanning, portfolio management, and pattern analysis with integrated trading capabilities. It features a dark-themed UI, multilingual support, and aims to assist users in identifying trading opportunities in the volatile memecoin market through automated token scanning and machine learning pattern detection. The platform includes a CLI-style terminal for advanced users and utilizes WebSocket connectivity for live market data. All features are currently available to authenticated users free of charge, and new users receive $10,000 in virtual trading capital.

## User Preferences
Preferred communication style: Simple, everyday language.

## Recent Changes

### October 10, 2025 - Login/Registration Flow Improvements
- **Auto-Login After Registration**: New users are now automatically logged in after registration, eliminating the need to manually switch tabs and log in
- **Session Persistence Enhanced**: Both login and registration endpoints now explicitly save sessions to PostgreSQL database using callback-based `req.session.save()` to ensure persistence before responding
- **Frontend UX Improved**: Registration success handler now calls `refetch()` to automatically update auth status, providing seamless transition to dashboard
- **Testing**: End-to-end tests confirm registration auto-login, dashboard redirect, and portfolio visibility with starting capital ($10,000)
- **Impact**: Smoother onboarding experience - users can start trading immediately after registration

### October 10, 2025 - Live Data Updates Fixed (Dashboard & Portfolio)
- **Critical Bug Fixed**: Dashboard and Portfolio pages weren't receiving live WebSocket updates
- **Dashboard Issue**: Only used polling (15s intervals) with no WebSocket listeners - now has real-time updates via WebSocket
- **Portfolio Issue**: Demo portfolio updates were sent only to the demo user ID, but viewers might not be authenticated as that user
- **Solution**: 
  - Demo portfolio updates now broadcast globally (like market data) so all viewers receive real-time updates
  - Dashboard now listens for trade_executed, portfolio_updated, positions_updated, and price_update events
- **Security**: Authenticated user portfolios remain secure with user-scoped broadcasts
- **Impact**: Both pages now show live position values, price updates, trade executions, and analytics in real-time

## System Architecture

### Frontend
Built with React 18 and TypeScript, using Vite for development. Styling is handled by Tailwind CSS with a custom dark theme and shadcn/ui for consistent components. State management uses TanStack Query for server state and React hooks for local state. Wouter is used for client-side routing. WebSocket integration provides real-time updates.

### Backend
Developed with Express.js and TypeScript (ESM configuration), providing a RESTful API and WebSocket support. Key background services include a Token Scanner, an ML Pattern Analyzer, and a Price Feed Service. The WebSocket server manages real-time client connections.

### Data Storage
Primary database is PostgreSQL, accessed via Drizzle ORM and hosted on Neon. The schema is normalized, including tables for users, tokens, portfolios, trades, and subscriptions. Drizzle Kit manages schema migrations.

### Authentication and Authorization
Supports dual authentication: password-based and OAuth (Google Login via Replit Auth). Every new user receives $10,000 in virtual trading money. Account linking is supported by email. Security measures include Zod validation, CORS, CSRF protection, and secure OAuth token management.

### UI/UX Decisions
The platform features a modern glassmorphism design system with a dark theme, utilizing Framer Motion for animations and transitions. The UI is responsive and optimized for a professional trading experience.

### Technical Implementations
Includes a robust token scanning system that automatically discovers and tracks trending memecoins using CoinGecko APIs. ML pattern analysis runs across numerous tokens for signal generation. Automated trading functionalities are supported.

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