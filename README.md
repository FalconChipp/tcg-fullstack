# TCG Fullstack Monorepo

This repository bundles the complete SixByFive TCG platform: a public web app, an administrative dashboard, and the Node.js GraphQL backend that powers both. Use this document as the canonical entry point for understanding the system, spinning up local environments, and planning changes across the stack.

## Repository Layout

- ackend/ – Express + Apollo GraphQL API, market data ingestion workers, Stripe billing, notifications, and all business logic.
- rontend/ – Customer-facing Next.js application for collection management, binder tools, marketplace browsing, and subscriptions.
- dashboard/ – Staff-only Next.js dashboard used to triage data, monitor jobs, and exercise admin workflows.
- h/ – Auxiliary scripts or personal workspace (not part of the core app).

Each subproject maintains its own package.json, dependencies, and README with detailed guidance. Treat them as independent Node applications that happen to share a repo and deployment cadence.

## High-Level Architecture

1. **Backend (API + Jobs)**
   - Provides the single GraphQL endpoint used by both web apps (/graphql).
   - Exposes RESTful admin maintenance endpoints under /admin/md2/* for market data control.
   - Uses Sequelize to connect to MySQL in production (SQLite fallback for local testing).
   - Orchestrates the Marketdata v2 pipeline (set ingest, price collection, FX refresh, rollups) and stores derived artefacts in ackend/data/marketdata2.

2. **Frontend (Customer Web App)**
   - Communicates with the backend via Apollo Client.
   - Handles auth (NextAuth + Google OAuth), binder UI/drag-and-drop, marketplace views, and notifications.
   - Ships as a standalone Next.js 14 build (Netlify ready), but expects the backend reachable at runtime.

3. **Dashboard (Staff Tools)**
   - Shares the GraphQL backend and uses the same schema, but authenticates with admin tokens stored in localStorage.
   - Provides lightweight views into user stats, moderation data, and marketdata status.

4. **Shared Concepts**
   - GraphQL schema is composed from feature modules under ackend/src/modules/**/typeDefs.js + esolvers.js.
   - Market data is cached in JSON alongside relational tables (m_* models) so web clients can mix static and live data.
   - Environment variables are defined per app; secrets should be managed using your deployment platform (Vercel/Netlify/Render/etc.).

## Prerequisites

- **Node.js** 18 or newer.
- **npm** (ships with Node 18).
- **MySQL 8** (or a compatible hosted instance) for backend persistence.
- Optional: **Redis** or external services depending on future features (not required today).

## Quickstart: Local Development

`ash
# Clone once
git clone <repo-url>
cd tcg-fullstack

# Install dependencies for each app
(cd backend && npm install)
(cd frontend && npm install)
(cd dashboard && npm install)

# Start backend first (port 4000)
(cd backend && npm run dev)

# In another terminal, run the frontend (port 3000)
(cd frontend && npm run dev)

# Optionally, run the admin dashboard (port 3030)
(cd dashboard && npm run dev)
`

> Tip: copy each subproject's .env.example / .env.* as .env.local and adjust credentials before running.

## Deployment Overview

| Component | Build Command      | Runtime Command | Typical Host              |
|-----------|--------------------|-----------------|---------------------------|
| backend   | 
pm install      | 
pm start     | Node server/PM2/Render    |
| frontend  | 
pm run build    | 
pm run start | Netlify/Vercel/Static CDN |
| dashboard | 
pm run build    | 
pm run start | Netlify/Vercel            |

Ensure NEXT_PUBLIC_GRAPHQL_ENDPOINT points at the deployed backend for both web apps. The backend requires ADMIN_API_TOKEN, JWT_SECRET, DB credentials, Stripe keys, and marketdata provider keys at minimum.

## Data & Marketdata Pipeline

- JSON caches live under ackend/data/marketdata2 (sets, cards, FX).
- Scheduled ticks (metadataTick, pricingTick, patchTick) are orchestrated from ackend/src/tasks/marketdata2.schedule.js and can be invoked manually via REST or GraphQL mutations.
- Price ingestion hits multiple providers (TCGdex, PokemonTCG.io, PokemonPriceTracker) with FX normalization to GBP.
- Rollups aggregate observations for 1/7/30/90-day spans accessible via models m_PriceDaily, m_PriceLatest, m_PriceRollup.

## Testing Philosophy

- Backend uses Vitest (UI + coverage) and ESLint; unit/integration tests should live beside modules.
- Frontend currently relies on lint/build; consider Playwright/Cypress for UI coverage.
- Dashboard has no automated suite; spot-check through 
pm run build to catch breaking GraphQL changes.

## Contributing

1. Branch from main (or appropriate release branch).
2. Update the relevant README/CHANGELOG when behavior changes.
3. Run tests/lint as appropriate for each app.
4. Submit PR with a description of impacted subsystems.

## Support & Troubleshooting

- **Port conflicts**: ensure 3000/3030/4000 free or override in env files.
- **DB connectivity**: confirm .env host/port and that MySQL accepts TCP connections.
- **Marketdata jobs**: check admin endpoints /admin/md2/providers and scheduler logs in backend console.
- **Auth issues**: verify JWT secret consistency between backend and web apps; clear cookies/localStorage during debugging.

For subsystem-specific instructions, continue with the READMEs inside ackend/, rontend/, and dashboard/.
