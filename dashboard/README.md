# Dashboard (Admin Interface)

The dashboard is a staff-only Next.js application used to monitor platform health, inspect user/card data, and trigger marketdata maintenance workflows. It reuses the public GraphQL API but requires an admin JWT stored in the browser.

## Table of Contents

1. [Feature Overview](#feature-overview)
2. [Tech Stack](#tech-stack)
3. [Project Structure](#project-structure)
4. [Environment Configuration](#environment-configuration)
5. [Getting Started](#getting-started)
6. [NPM Scripts](#npm-scripts)
7. [Authentication Model](#authentication-model)
8. [Core Pages & Modules](#core-pages--modules)
9. [GraphQL Integration](#graphql-integration)
10. [Styling & UX](#styling--ux)
11. [Deployment Notes](#deployment-notes)
12. [Troubleshooting](#troubleshooting)

## Feature Overview

- **Dashboard Home**: Quick stats (dminStats query) summarizing users, listings, trades, bans, etc.
- **Entity Management**: Route stubs for users, cards, binders, listings, logs, messages, notifications, wishlist, rewards, and trades.
- **Marketdata Oversight**: Intended to consume /admin/md2/* endpoints and marketdata GraphQL queries for provider health and scheduling.
- **Responsive Layout**: Sidebar navigation with mobile drawer, dark theme with Tailwind.

## Tech Stack

| Concern        | Technology                    |
|----------------|-------------------------------|
| Framework      | Next.js 14 (pages router)     |
| Data Layer     | Apollo Client 3               |
| Auth           | Custom hook (useAdminAuth)  |
| Styling        | Tailwind CSS (darkMode: 'class') |
| Deployment     | Netlify-ready (
etlify.toml) |

## Project Structure

`
dashboard/
+-- components/
¦   +-- Layout.js       # Sidebar, layout frame, responsive navigation
+-- hooks/
¦   +-- useAdminAuth.js # Verifies admin token and fetches current user
+-- lib/
¦   +-- apolloClient.js # Apollo HTTP client with Authorization header
+-- pages/
¦   +-- _app.js         # App wrapper with ApolloProvider + Layout
¦   +-- login.js        # Admin login screen (token capture)
¦   +-- index.js        # Dashboard landing (stats cards)
¦   +-- users/…         # Domain-specific pages (extend as needed)
¦   +-- ...             # Additional admin sections
+-- styles/
¦   +-- globals.css     # Tailwind base styles
+-- tailwind.config.js  # Tailwind configuration
+-- next.config.js      # Next.js settings
`

## Environment Configuration

Create .env.local with:

`
NEXT_PUBLIC_GRAPHQL_ENDPOINT=http://localhost:4000/graphql
`

For production, point to the deployed backend hostname. All other secrets (admin token provisioning) are handled manually or via backend auth flows.

## Getting Started

`ash
npm install
npm run dev
`

Navigate to http://localhost:3030 (default Next.js port if 3000 taken). When prompted, enter a valid admin token (matching backend ADMIN_API_TOKEN).

## NPM Scripts

| Script           | Description |
|------------------|-------------|
| 
pm run dev    | Start Next.js dev server.
| 
pm run build  | Create production build (smoke test for CI).
| 
pm run start  | Serve production build locally.

## Authentication Model

- useAdminAuth checks localStorage.getItem('tcg_admin_token') and queries me { id email isAdmin }.
- If the backend reports isAdmin !== true, the hook purges the token and redirects to /login.
- Pages should call useAdminAuth() and handle loading/checked states to avoid flashing unauthenticated content.
- Tokens are manually issued (e.g., via backend console or dedicated login mutation). Ensure HTTPS in production to protect localStorage tokens.

## Core Pages & Modules

- pages/index.js: Displays aggregate admin stats using the ADMIN_STATS query.
- pages/login.js: Minimal form to accept an admin token and store in localStorage.
- Domain directories (pages/users, pages/cards, etc.) are prepared for CRUD tooling; implement GraphQL operations and UI inside each route as needed.
- Extend the sidebar in components/Layout.js whenever you enable a new module.

## GraphQL Integration

- lib/apolloClient.js configures Apollo with Authorization: Bearer <token> header pulled from localStorage.
- Queries/mutations should live alongside pages or in dedicated modules when reused.
- Be mindful of caching; the default InMemoryCache is sufficient for the current surface area, but you can add type policies if pagination is introduced.

## Styling & UX

- Tailwind classes applied throughout; dark palette set by default (g-gray-950, 	ext-gray-300, etc.).
- Mobile users receive a collapsible sidebar toggled by the hamburger menu.
- Update styles/globals.css or Tailwind config when introducing bespoke themes or component libraries.

## Deployment Notes

- Deploy via Netlify/Vercel using 
pm run build followed by 
pm run start.
- Ensure environment variable NEXT_PUBLIC_GRAPHQL_ENDPOINT matches the production backend.
- Provide a secure method for staff to obtain/administer tokens (e.g., login mutation that issues JWTs with isAdmin claim) and consider a more robust session store if requirements grow.

## Troubleshooting

| Issue | Resolution |
|-------|------------|
| Infinite redirect to /login | Verify 	cg_admin_token exists and backend me query returns isAdmin: true. |
| GraphQL 401/403 errors | Confirm Authorization header includes a current admin token; backend ADMIN_API_TOKEN must match. |
| Stats query fails | Ensure backend schema exposes dminStats; check backend logs for resolver errors. |
| Styling anomalies | Re-run 
pm run dev after updating Tailwind config to regenerate classes. |

Consult the backend README for details on admin endpoints (/admin/md2/*) and the overall GraphQL schema.
