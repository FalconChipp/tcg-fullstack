# Cardsearch V2 Adoption Audit

## Overview
The repository already includes the new `cardsearch` module alongside the legacy search stack. This audit lists every frontend and backend touchpoint that must be updated before the application can rely exclusively on the new module.

## Frontend

### `frontend/src/components/Collection/CardSearch.js`

**Current coupling**
* Still defines both the legacy `searchCardsConnection` query and the new `cardsearchSearchCards` operation, switching between them via the `NEXT_PUBLIC_CARDSEARCH_V2` feature flag. All fetching, pagination, and normalization logic is branched to support both payload shapes.【F:frontend/src/components/Collection/CardSearch.js†L24-L135】【F:frontend/src/components/Collection/CardSearch.js†L315-L360】【F:frontend/src/components/Collection/CardSearch.js†L409-L588】
* Utility helpers such as `normalizeNode`, `mapCardsearchV2Items`, and price-formatting still normalize legacy fields (e.g., `image`, `prices`, `variations`).【F:frontend/src/components/Collection/CardSearch.js†L95-L140】【F:frontend/src/components/Collection/CardSearch.js†L315-L335】

**Migration work items**
1. Delete the legacy GraphQL documents (`searchCardsConnection`, `SearchCardConnectionFragment`) and remove the feature flag branches in `handleSearch`, `loadMoreResults`, and `loadInitialResults` so the component exclusively calls `cardsearchSearchCards`.
2. Refactor helper functions to expect only the v2 schema. This includes renaming `normalizeNode` to reflect the new shape (or inlining the mapping), dropping legacy field fallbacks, and ensuring UI consumers only read from `cardsearch` properties such as `variants`, `marketPrice`, and `images.large`.
3. Revisit pagination state (`nextCursor`, `hasMoreResults`) to align with the cursor-based API returned by `cardsearchSearchCards`. Update any offset/page calculations hard-coded for the legacy API.
4. Update tests/stories that import the legacy mocks (`searchCardsConnection.json`) so they reference new fixtures produced by `cardsearchSearchCards`.

### `frontend/src/components/Binder/BinderCardSearch.js`

**Current coupling**
* Binder search calls the legacy `searchCards` GraphQL query directly against `SearchInput` and expects `CardSearchResult.cards`. Result adapters still consume `setCode`, `image`, and other legacy-only fields.【F:frontend/src/components/Binder/BinderCardSearch.js†L46-L175】

**Migration work items**
1. Replace the `searchCards` document with `cardsearchSearchCards` and switch the query variables from `page/pageSize` to `cursor/limit` (or the equivalent inputs surfaced by the v2 API).
2. Update normalization logic to pull card metadata from cardsearch (`card.id`, `set.id`, `set.symbol`, `variants[].number`). Confirm binder filters (rarity, type, set) are still supported.
3. Adjust UI components that render binder results (e.g., `BinderSearchResultItem`) to consume the new data shape and drop unused legacy props.
4. Remove legacy-specific debounce or pagination helpers once the component relies solely on cardsearch responses.

### `frontend/app/apolloClient.js`

**Current coupling**
* Apollo cache policies only account for `searchCards` and `searchCardsConnection`, and there is no merge policy for cardsearch edges.【F:frontend/app/apolloClient.js†L15-L37】

**Migration work items**
1. Remove cache key policies for legacy queries and register new key fields for `cardsearchSearchCards` and its nested types (`CardsearchCard`, `CardsearchVariant`).
2. Implement a merge function that concatenates result edges based on the `cursor` returned by cardsearch to avoid duplicate entries when paginating.
3. Audit custom hooks (`useCardSearch`, binder hooks) to ensure they rely on the updated cache keys instead of the removed legacy ones.

## Backend

### GraphQL wiring (`backend/src/schema.js`)

**Current coupling**
* Both legacy `search` and new `cardsearch` typeDefs/resolvers are merged into Apollo, exposing duplicate entry points to clients.【F:backend/src/schema.js†L6-L95】

**Migration work items**
1. Remove the legacy `search` module from the resolver/typeDef merge once all callers migrate. If compatibility is required temporarily, re-export v2 resolvers under the legacy names.
2. Update any schema-level directives, auth checks, or context building that currently depends on legacy type names to reference the v2 equivalents.
3. Regenerate the GraphQL schema artifact so tooling (frontend codegen, docs) reflects the removal of the old entry points.

### Express bootstrap (`backend/index.js`)

**Current coupling**
* The server imports cardsearch scheduler helpers, mounts the admin UI/API routes, and registers cron jobs unless `CARDSEARCH_SCHED_DISABLE` is set. The legacy search bootstrap still configures Express middleware and routes alongside the cardsearch admin endpoints.【F:backend/index.js†L40-L92】【F:backend/index.js†L287-L327】【F:backend/index.js†L400-L434】

**Migration work items**
1. Delete legacy search routes and middleware registration (REST `search` endpoints, preview pricing hooks) once no longer needed.
2. Confirm admin auth (`x-admin-token`) and scheduler toggles behave correctly after the removal; document updated environment variables for deploy operators.
3. Validate that the admin UI served at `/admin/cardsearch` continues to function by wiring it exclusively to cardsearch services.
4. Ensure health checks and readiness probes cover the new scheduler and data bootstrap routines (price cache warmers, FX sync).

### Sequelize models (`backend/src/models/index.js`)

**Current coupling**
* Cardsearch introduces its own tables (`m_Set`, `m_Card`, `m_CardVariant`, `m_PriceObservation`, `m_PriceDaily`, `m_PriceLatest`, `m_PriceRollup`) while the legacy `Card` table is still referenced by old search resolvers.【F:backend/src/models/index.js†L70-L118】

**Migration work items**
1. Audit existing migrations to ensure all cardsearch tables are deployed in every environment and backfill scripts cover new columns (`marketPriceUsd`, `printedTotal`).
2. Remove remaining references to the legacy `Card` table from services or cron jobs once read paths fully migrate.
3. Update ORM associations so downstream consumers only use the cardsearch models. Remove redundant scopes/helpers added to mirror the legacy schema.
4. Coordinate database cleanup (dropping obsolete tables, archiving data) with SRE after verifying no other modules depend on the legacy tables.

### Scheduler (`backend/src/tasks/cardsearch.schedule.js`)

**Current coupling**
* Cron registration hooks the cardsearch scheduler service for FX and price rollups, but legacy jobs for tcgdex sync and price cache refreshers are still registered elsewhere in the codebase.【F:backend/src/tasks/cardsearch.schedule.js†L1-L21】

**Migration work items**
1. Remove legacy cron registrations (in `backend/src/tasks/index.js` and related files) once cardsearch jobs supersede them.
2. Validate scheduler config in staging: ensure required environment variables (`CARDSEARCH_CACHE_PATH`, `CARDSEARCH_PRICE_ROLLUP_CRON`) are present and documented.
3. Update monitoring/alerting dashboards to point at cardsearch job metrics; retire alerts tied to deprecated jobs.

### Cardsearch GraphQL module (`backend/src/modules/cardsearch`)

**Current coupling**
* `typeDefs.js` defines the new queries (`cardsearchSearchCards`, `cardsearchCardById`, price endpoints, set lookups) and admin mutations.【F:backend/src/modules/cardsearch/typeDefs.js†L140-L227】
* `resolvers.js` uses the new Sequelize models and query builder to serve unified card data and price rollups.【F:backend/src/modules/cardsearch/resolvers.js†L48-L160】

**Migration work items**
1. Ensure every data requirement satisfied by the legacy module (e.g., `isListedForTrade`, price snapshots) exists here. Port any missing resolver fields before deleting the old module.
2. Document breaking schema changes (field renames, new enums) and update the shared GraphQL fragments consumed by frontend packages.
3. Harden resolver error handling and logging so any missing data is surfaced during rollout. Add metrics around cache misses or slow queries.
4. Expand unit/integration tests to cover binder and collection search scenarios currently validated only via the legacy module.

### Legacy search module (`backend/src/modules/search`)

**Current coupling**
* `typeDefs.js` and `resolvers.js` continue to expose and implement the legacy `searchCards`, `searchCardsConnection`, and related helpers (`applyListedForTradeFilters`, upstream tcgdex hydrations, preview pricing).【F:backend/src/modules/search/typeDefs.js†L110-L135】【F:backend/src/modules/search/resolvers.js†L569-L760】
* `SetMapping.js` bridges to cardsearch’s set resolver but currently exists purely to keep old helpers functional.【F:backend/src/modules/search/SetMapping.js†L1-L47】
* Provider shims such as `api/tcgdex.js` still fetch raw data from external services to backfill the legacy search.【F:backend/src/modules/search/api/tcgdex.js†L196-L248】

**Migration work items**
1. Replace the legacy resolvers with pass-through calls to the cardsearch services as an intermediate step, then delete the module entirely once no clients hit the old schema.
2. Remove tcgdex and other provider shims if their responsibilities are duplicated in the cardsearch ingestion pipeline. Update deployment docs if any credentials/env vars become obsolete.
3. Delete `SetMapping.js` and update any imports to use the canonical cardsearch set helper.
4. Archive or migrate legacy integration tests so they validate the cardsearch path instead of the removed module.

## Follow-up Checklist
1. Remove the `NEXT_PUBLIC_CARDSEARCH_V2` flag and update all client queries/components to consume `cardsearchSearchCards` results, including binder-specific views and tests.
2. Replace binder search and any other direct uses of `searchCards`/`searchCardsConnection` with the new cardsearch API, remapping all DTOs and pagination helpers.
3. Update Apollo cache policies, hooks, and utilities to reflect the new schema shape, then regenerate codegen artifacts.
4. Refactor or retire the legacy backend search module so GraphQL no longer exposes duplicate search endpoints, and clean up associated provider shims.
5. Validate cardsearch scheduler jobs, admin routes, and database models in staging before deleting legacy data ingestion paths. Update runbooks and alerting dashboards accordingly.
