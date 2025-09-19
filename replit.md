# CryptoHobby - Memecoin Trading Platform

## Overview

CryptoHobby is a comprehensive memecoin trading platform that provides real-time market scanning, portfolio management, pattern analysis, and trading capabilities. The application features a dark-themed UI optimized for cryptocurrency traders, with multilingual support and subscription-based access tiers.

The platform combines automated token scanning with machine learning pattern detection to help users identify trading opportunities in the volatile memecoin market. It includes a CLI-style terminal for advanced users and real-time WebSocket connectivity for live market data.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
The frontend is built with **React 18** and **TypeScript**, using **Vite** as the build tool and development server. The UI leverages **Tailwind CSS** for styling with a custom dark theme optimized for trading interfaces. Component architecture follows the **shadcn/ui** design system, providing consistent and accessible UI components.

**State Management**: Uses **TanStack Query (React Query)** for server state management, caching, and synchronization. Local state is managed with React hooks and context APIs for global concerns like language preferences.

**Routing**: Implements **Wouter** for lightweight client-side routing, supporting pages for dashboard, scanner, portfolio, analytics, terminal, and subscription management.

**Real-time Features**: WebSocket integration provides live updates for price feeds, scanner alerts, and pattern detection notifications.

### Backend Architecture
The backend uses **Express.js** with **TypeScript** in an ESM configuration. The server implements a RESTful API design with WebSocket support for real-time features.

**API Structure**: Organized around resource-based endpoints (`/api/tokens`, `/api/portfolio`, `/api/trades`, etc.) with consistent error handling and request/response patterns.

**Real-time Services**: Three core background services handle automated functionality:
- **Token Scanner**: Monitors tokens for price spikes, volume surges, and other trading signals
- **ML Pattern Analyzer**: Detects technical analysis patterns using machine learning algorithms
- **Price Feed Service**: Aggregates and distributes real-time price data

**WebSocket Server**: Handles real-time client connections for broadcasting live updates and supporting interactive features.

### Data Storage Solutions
**Primary Database**: **PostgreSQL** with **Drizzle ORM** for type-safe database operations and schema management. The database uses **Neon** as the serverless PostgreSQL provider.

**Schema Design**: Normalized relational structure with tables for users, tokens, portfolios, trades, positions, alerts, price history, patterns, and subscriptions. Includes proper foreign key relationships and indexing for performance.

**Migration Management**: Drizzle Kit handles schema migrations and database versioning, with migrations stored in the `/migrations` directory.

### Authentication and Authorization
The application implements session-based authentication with subscription tier-based access control. Different features are gated based on user subscription levels (basic, premium, pro).

**Security Measures**: Input validation using Zod schemas, CORS configuration, and secure session management with PostgreSQL session storage.

### External Dependencies

**Database Infrastructure**:
- **@neondatabase/serverless**: Serverless PostgreSQL connection pooling
- **drizzle-orm**: Type-safe ORM with PostgreSQL dialect
- **connect-pg-simple**: PostgreSQL session store for Express

**Frontend UI Framework**:
- **@radix-ui/***: Comprehensive suite of accessible UI primitives (dialog, dropdown, select, etc.)
- **@tanstack/react-query**: Server state management and caching
- **tailwindcss**: Utility-first CSS framework with custom trading theme

**Development Tools**:
- **Vite**: Fast build tool and development server
- **TypeScript**: Type safety across the entire application
- **ESBuild**: Production bundling for the server

**Real-time Communication**:
- **ws**: WebSocket library for Node.js server implementation
- **WebSocket API**: Browser-native WebSocket for client connections

**Validation and Utilities**:
- **zod**: Runtime type validation and schema definition
- **date-fns**: Date manipulation and formatting
- **clsx** & **tailwind-merge**: Conditional CSS class utilities

The architecture prioritizes real-time performance, type safety, and scalable subscription management, making it well-suited for high-frequency trading applications with multiple user tiers.