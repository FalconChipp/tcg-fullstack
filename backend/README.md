# Backend (GraphQL API & Marketdata Workers)

This directory implements the SixByFive TCG backend: a Node 18 Express server with Apollo GraphQL, background job runners, market data ingestion, Stripe billing, messaging, and admin tooling. Treat it as the single source of truth for business logic consumed by both frontend apps.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Runtime Stack](#runtime-stack)
3. [Getting Started](#getting-started)
4. [Environment Variables](#environment-variables)
5. [NPM Scripts](#npm-scripts)
6. [GraphQL Schema Layout](#graphql-schema-layout)
7. [Sequelize Models](#sequelize-models)
8. [Marketdata v2 Pipeline](#marketdata-v2-pipeline)
9. [Background Jobs & Schedulers](#background-jobs--schedulers)
10. [Admin Endpoints](#admin-endpoints)
11. [Logging & Monitoring](#logging--monitoring)
12. [Testing & Quality](#testing--quality)
13. [Troubleshooting](#troubleshooting)

## Architecture Overview

- **Express HTTP server** (index.js) pairs REST endpoints (uploads, health checks, admin actions) with the Apollo /graphql endpoint.
- **Apollo Server 4** merges schemas from modular feature folders (src/modules/**). Each module exports 	ypeDefs + 
esolvers for separation of concerns.
- **Sequelize ORM** connects to MySQL (production) or SQLite (local fallback) and initializes all legacy models plus marketdata v2 models (m_*).
- **Socket.IO** provides real-time hooks for clients (e.g., messaging/notifications) via an attached WebSocket server.
- **Background jobs** run inside the Node process (cron + manual triggers) handling cleanup, scheduler ticks, and market data ingestion.
- **Filesystem caches** in data/marketdata2 store set/card snapshots, FX rates, and derived indices shared with the frontend.

## Runtime Stack

| Concern            | Technology                                   |
|--------------------|----------------------------------------------|
| HTTP / REST        | Express 4, Helmet, Compression, Morgan       |
| GraphQL            | @apollo/server, modular schema composition |
| ORM                | Sequelize 6 + CLI                            |
| Auth               | JWT (cookie or Authorization bearer token) |
| Payments           | Stripe SDK + webhook endpoint                |
| Background Cron    | 
ode-cron, custom scheduler service        |
| File Uploads       | Multer + local disk storage (uploads/)     |
| Logging            | Winston + console transports                 |
| Testing            | Vitest (configured via pm test)           |

## Getting Started

1. Install dependencies:
   `bash
   npm install
   `
2. Copy an environment template:
   `bash
   cp .env.development .env
   # Update secrets, DB credentials, provider keys
   `
3. Create local directories:
   `bash
   mkdir -p uploads/avatars data/marketdata2/{cards,sets,index,fx}
   `
4. Start the server with auto-reload:
   `bash
   npm run dev
   `
5. Access GraphQL at http://localhost:4000/graphql and the admin UI at http://localhost:4000/admin (requires ADMIN_API_TOKEN).

> Without MySQL configured, Sequelize will fall back to a local SQLite file (sixbyfive-tcg.sqlite). For full parity, run a MySQL instance and set DB_HOST/DB_USER/DB_PASS/DB_NAME.

## Environment Variables

| Category          | Key(s)                                | Notes |
|-------------------|----------------------------------------|-------|
| Database          | DB_HOST, DB_PORT, DB_USER, DB_PASS, DB_NAME, DB_SSL | Required for MySQL. Omit to use SQLite fallback. |
| Server            | PORT, LOG_LEVEL, CORS_ORIGINS    | CORS_ORIGINS is a comma-separated allowlist. |
| Auth              | JWT_SECRET, ADMIN_API_TOKEN        | JWT secret shared with web apps; admin token guards /admin/md2/*. |
| Stripe            | STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET | Needed for subscription billing. |
| Email             | SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, EMAIL_FROM | Used by notification helpers. |
| Marketdata v2     | MD2_DATA_ROOT, MD2_LANG, MD2_METADATA_PER_TICK, MD2_PRICING_PER_TICK, MD2_TCGDEX_TIMEOUT_MS, MD2_HEALTH_TTL_MS, MARKETDATA_SCHED_DISABLE | Control cache location, scheduling cadence, provider timeouts, and scheduler enablement. |
| Provider APIs     | TCGDEX_BASE_URL, PTCGIO_API_KEY, POKEMONTCG_KEY, PPT_BASE_URL, EXCHANGERATE_HOST_KEY | Enable card/price fetching and FX conversion. |
| Legacy Search     | SEARCH_FAST_PATH, SEARCH_FETCH_TIMEOUT_MS, etc. | Still used by legacy modules and scripts. |

Update .env for production; keep secrets out of version control.

## NPM Scripts

| Script         | Description |
|----------------|-------------|
| 
pm start    | Launches the server (no autoreload).
| 
pm run dev  | Nodemon development server.
| 
pm run migrate | Run Sequelize migrations via CLI (sequelize db:migrate).
| 
pm run seed | Execute all seeders (sequelize db:seed:all).
| 
pm run lint | Run ESLint across the codebase.
| 
pm test     | Execute Vitest with UI and coverage (HTML/JSON/JUnit outputs under 
eports/).
| 
pm run monitor | Start Express status monitor (at /status).

## GraphQL Schema Layout

- Root schema defined in src/schema.js, merging per-module 	ypeDefs and 
esolvers.
- Feature modules live under src/modules/<name>/.
  - Examples: auth, users, collection, marketplace, 	rading, wishlist, 
otifications, subscriptions, marketdata2, etc.
- marketdata2 injects new queries/mutations such as marketdataFx, marketdataSets, searchCards, and tick mutations for scheduler control.
- Legacy search module remains for compatibility but is marked deprecated; prefer marketdata2 search services.

Additions to the schema require exporting 	ypeDefs + 
esolvers from a module and registering them in src/schema.js (imports and merge arrays).

## Sequelize Models

- Legacy tables (users, profiles, cards, listings, trades, achievements, notifications, subscriptions) defined in src/models/*.js and wired in src/models/index.js.
- Marketdata v2 models prefixed with m_ (m_Set, m_Card, m_CardVariant, m_PriceObservation, m_PriceLatest, m_PriceDaily, m_PriceRollup).
- Associations established in src/models/index.js (e.g., User.hasOne(Profile), Card.hasMany(Listing), m_PriceLatest association to cards).
- Database initialization occurs on boot via sequelize.authenticate() then sequelize.sync() (safe for development; use migrations for production schema evolution).

## Marketdata v2 Pipeline

**Core Services** (src/modules/marketdata2/services/):

- scheduler.service.js � Chooses sets to ingest/price, computes next scheduled times, and invokes jobs.
- setIndex.service.js � Builds and maintains sets.index.json, manages cadence computation, and repairs caches.
- ingest.service.js � Normalizes set data (cards, variants, metadata) from TCGdex.
- priceAdapter.*.service.js � Provider adapters (TCGdex, PokemonTCG.io, PokemonPriceTracker) returning price observations.
- fx.service.js � Fetches GBP-centric FX data (USD/EUR) with caching.
- 
ollup.service.js � Computes rolling averages and stats from observations for dashboard/analytics.
- searchCards.service.js � Reads cached card data with DB fallback for GraphQL search queries.

**Jobs** (src/modules/marketdata2/jobs/):

- ingestSet.job.js � Pulls metadata/cards for a set.
- collectPrices.job.js � Collects prices across providers, normalizes to GBP, updates m_PriceObservation + m_PriceLatest.
- collectBoth.job.js � Convenience wrapper ingesting metadata then prices.
- patchGaps.job.js � Re-runs pricing for stale sets.
- priceRollup.job.js � Recomputes rollup tables for historical windows.

Artifacts are stored on disk (data/marketdata2) and in MySQL tables. Admin REST and GraphQL endpoints allow manual triggers.

## Background Jobs & Schedulers

- **Message cleanup** (src/jobs/messageCleanup.js) and **notification cleanup** (src/jobs/notificationCleanup.js) run on intervals created during boot.
- **Marketdata scheduler**: src/tasks/marketdata2.schedule.js exports startMarketdata2Schedule invoked automatically unless MARKETDATA_SCHED_DISABLE=1.
- **Legacy tasks** (src/tasks/marketdata.prices.refresh.js, etc.) retained for backwards compatibility but largely superseded by marketdata2.
- Extend by adding new functions under src/tasks/ or src/jobs/ and import them in index.js or scheduler modules.

## Admin Endpoints

All routes under /admin require x-admin-token: <ADMIN_API_TOKEN> header.

| Route | Method | Purpose |
|-------|--------|---------|
| /admin | GET | Serves compiled admin HTML page.
| /admin/admin.js | GET | Admin UI script bundle.
| /admin/md2/providers | GET | Provider health check results (TCGdex, PokemonTCG.io, PPT).
| /admin/md2/sets | GET | Current set index snapshot with scheduling metadata.
| /admin/md2/preview | GET | Preview upcoming schedule (if provided by marketdata2.schedule.js).
| /admin/md2/collect | POST | Trigger metadata/pricing run for a set (body selects job).
| /admin/md2/pricing/patch | POST | Run patchTick for stale sets.
| /admin/md2/fx/refresh | POST | Force-refresh FX cache.
| /admin/md2/rollups/rebuild | POST | Recompute rollup stats.
| /admin/md2/cleanup/wipe | POST | Wipe caches (requires body.confirm = "WIPE").
| /admin/md2/debug-price | GET | Inspect latest price + observations for a given cardId.

Use these endpoints through the dashboard or direct tooling (curl/Postman) when diagnosing marketdata issues.

## Logging & Monitoring

- **Winston logger** outputs timestamped logs for application-level events.
- **Morgan** HTTP logging integrated with Winston for consistent log lines.
- **Express Status Monitor** available at /status for runtime metrics.
- Scheduler and job modules emit structured logs prefixed with module identifiers (e.g., [prices], [ingest]).
- Unhandled rejections and exceptions are captured and logged before shutdown.

## Testing & Quality

- Run 
pm test to execute the Vitest suite (UI accessible via CLI output).
- Coverage reports stored in 
eports/ (HTML, JSON, JUnit) for CI integrations.
- ESLint (
pm run lint) should pass before merging.
- For database-sensitive changes, add migration files under migrations/ and update models accordingly.

## Troubleshooting

- **Cannot connect to DB**: verify DB_* variables; if missing, confirm SQLite file has writable permissions.
- **CORS errors**: ensure frontend origin is listed in CORS_ORIGINS (comma-separated).
- **JWT invalid**: confirm frontends share the same JWT_SECRET and that Authorization: Bearer headers are present.
- **Admin endpoints 401**: set ADMIN_API_TOKEN in .env and supply via x-admin-token header.
- **Marketdata stuck**: check logs for provider timeouts, run /admin/md2/providers, and inspect data/marketdata2/set-index.json entries for scheduling anomalies.
- **Price normalization issues**: verify FX cache (data/marketdata2/fx/fx_gbp.json) is fresh; run /admin/md2/fx/refresh to regenerate.

For deeper dives, inspect source files referenced above or run 
pm run monitor to access live metrics.
