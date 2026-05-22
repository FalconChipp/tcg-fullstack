# Frontend (Public Web App)

The frontend is the customer-facing Next.js 14 application for the SixByFive TCG platform. It provides authentication, collection management, binder tooling, marketplace browsing, subscriptions, and supporting UI flows. This document explains how the app is structured, configured, and extended.

## Table of Contents

1. [Feature Overview](#feature-overview)
2. [Tech Stack](#tech-stack)
3. [Project Structure](#project-structure)
4. [Environment Configuration](#environment-configuration)
5. [Getting Started](#getting-started)
6. [NPM Scripts](#npm-scripts)
7. [Key Modules & Patterns](#key-modules--patterns)
8. [GraphQL & Data Layer](#graphql--data-layer)
9. [Styling & Theming](#styling--theming)
10. [Authentication Flow](#authentication-flow)
11. [Testing & Quality](#testing--quality)
12. [Deployment Notes](#deployment-notes)
13. [Troubleshooting](#troubleshooting)

## Feature Overview

- **Authentication**: NextAuth.js with Google OAuth, session persistence, protected routes, and cookie consent flows.
- **Collections & Binders**: Drag-and-drop binder editor (powered by DnD Kit), card search, detail modals, and statistics.
- **Marketplace**: Browsing listings, filtering, cart interactions (where supported by backend).
- **Price Tracking**: Per-card price history charts, rollup summaries, and user-configurable price alerts with in-app/email notifications.
- **Notifications & Messaging**: Hooks prepared for real-time updates (Socket.IO integration toggled via providers).
- **Subscriptions**: UI for viewing and purchasing subscription tiers backed by Stripe.
- **SEO & Marketing**: Meta tags, sitemap generation, public marketing pages (About, Contact, Privacy, Terms, Roadmap).

## Tech Stack

| Concern             | Technology                        |
|---------------------|-----------------------------------|
| Framework           | Next.js 15 (pages router primary) |
| Language            | React 18 + modern JSX             |
| Data Layer          | Apollo Client 3                   |
| State Management    | Component-local + hooks           |
| Styling             | Tailwind CSS + custom CSS         |
| Forms               | React Hook Form                   |
| Auth                | NextAuth.js + Google OAuth        |
| Drag & Drop         | @dnd-kit suite                  |
| Visual Enhancements | Framer Motion, Swiper, Lucide/Heroicons |

## Project Structure

`
frontend/
+-- app/                 # Minimal app router entry (layout, error, etc.)
+-- public/              # Static assets (favicons, logos, etc.)
+-- scripts/             # Build/deploy helper scripts
+-- src/
�   +-- app/             # Shared client setup (Apollo client)
�   +-- components/      # UI modules grouped by feature (Auth, Binder, Collection, Home, Layout, Marketplace, Messenger, Notifications, Subscriptions, UI, etc.)
�   +-- graphql/         # Queries/mutations consumed by components
�   +-- hooks/           # Custom React hooks (theme, marketplace cart, notifications, binder helpers)
�   +-- pages/           # Pages router routes (legacy & marketing pages)
�   +-- styles/          # Tailwind/global stylesheets
�   +-- utils/           # Shared utilities (auth token helpers, formatting, dataset maps)
+-- next.config.js       # Next.js configuration (image domains, headers, rewrites)
+-- tailwind.config.js   # Tailwind theme & content scanning
+-- eslint.config.mjs    # ESLint configuration
`

## Environment Configuration

Create frontend/.env.local (or update .env) with the following keys:

`
NEXT_PUBLIC_GRAPHQL_ENDPOINT=http://localhost:4000/graphql
NEXT_PUBLIC_BACKEND_URL=http://localhost:4000/      # optional, for uploads
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-secret-key
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
`

Other optional values:

- NODE_AUTH_TOKEN (only needed when installing private packages).
- NEXT_PUBLIC_SENTRY_DSN, NEXT_PUBLIC_ANALYTICS_ID, etc., if you integrate monitoring.

## Getting Started

`ash
npm install
npm run dev
`

Visit http://localhost:3000 to interact with the app. Ensure the backend is running at the endpoint configured in NEXT_PUBLIC_GRAPHQL_ENDPOINT.

## NPM Scripts

| Script            | Description |
|-------------------|-------------|
| 
pm run dev     | Start Next.js dev server (hot reload).
| 
pm run build   | Compile production bundle.
| 
pm run start   | Run the production server locally with compiled assets.
| 
pm run lint    | Execute ESLint.
| 
pm run postbuild | Generate sitemap using 
ext-sitemap (runs automatically after uild).

## Key Modules & Patterns

- **Providers**: src/pages/_app.js wires ThemeProvider, AuthProvider, ApolloProvider, and Google OAuth provider. Adjust here when adding global context.
- **Apollo Client**: pp/apolloClient.js configures HTTP link, auth header injection (reads uthToken cookie), error logging, and caching policies.
- **Auth Components**: Located in src/components/Auth (modal, provider). Ensure new protected routes leverage <ProtectedRoute> or NextAuth session checks.
- **Binder Suite**: src/components/Binder contains binder modals, settings, drag-drop slots, and detail panels. Utilities for binder grids live under src/utils/* (e.g., inderPagesTo2DArray, deepClonePages).
- **Marketplace**: Components under src/components/Marketplace coordinate GraphQL queries with filters and cart hooks (useMarketplaceCart).
- **Notifications & Messenger**: Hooks in src/hooks/useNotifications.js and components/Messenger/*; the provider is currently commented out in _app.js but can be re-enabled when the backend socket is ready.

## GraphQL & Data Layer

- Queries defined under src/graphql are consumed via @apollo/client hooks (useQuery, useMutation).
- utils/apiClient.js and utils/graphqlUtils.js centralize request helpers.
- useSetPrices, useProfileCollection, useWishlistData, etc., coordinate GraphQL data with component state.
- When adding new queries, colocate GraphQL documents with the feature or place in src/graphql/<domain>.js for reuse.

## Styling & Theming

- Tailwind CSS handles utility-first styling; configured for dark mode by default (class-based toggling).
- Global rules live in src/styles/global.css; card condition colors in src/styles/condition.css.
- ThemeProvider manages user-selected themes; currently forces dark mode on mount.

## Authentication Flow

1. Users authenticate via Google OAuth (or email/password if implemented) through NextAuth.
2. Backend issues JWT stored in cookies (uthToken) used by Apollo Client for GraphQL requests.
3. Protected routes should either use Next.js middleware (optional) or React guards inside pages/components.
4. AuthProvider supplies session data and helper methods across the component tree.

For admin/staff-only pages, gate via backend roles (e.g., iewer.isAdmin) and redirect accordingly.

## Testing & Quality

- 
pm run lint must pass before deployment.
- Add storybook or component tests as needed (not currently included).
- Consider integrating Playwright/Cypress for end-to-end coverage (especially binder and marketplace flows).

## Deployment Notes

- The project is configured for Netlify (
etlify.toml, _redirects). For Vercel, adjust environment variables via dashboard and ensure 
ext.config.js aligns with hosting requirements.
- Set NEXT_PUBLIC_GRAPHQL_ENDPOINT to the production backend URL.
- Provide Google OAuth credentials and NextAuth secret in the hosting environment.
- If deploying as static export, confirm all dynamic routes are supported; otherwise run the Next.js server in SSR mode.

## Troubleshooting

| Issue | Resolution |
|-------|------------|
| GraphQL CORS errors | Confirm backend CORS_ORIGINS includes the frontend host. |
| Auth token missing | Inspect cookies for uthToken; ensure backend sets SameSite/Domain values compatible with your domain. |
| Apollo errors | Check console warnings from polloClient errorLink for GraphQL or network diagnostics. |
| Stale card data | Backend caches drive results; trigger marketdata refresh via admin dashboard if necessary. |
| Tailwind styles missing | Ensure 	ailwind.config.js content paths cover new directories; restart dev server after config changes. |

For architecture questions or design changes, consult the ackend/README.md to understand API expectations and marketdata behaviors.
