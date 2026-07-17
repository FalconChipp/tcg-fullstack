# Frontend tech debt audit — TCG web app

**Date:** 2026-07-12 · **Scope:** `frontend/` (Next.js app) · **Method:** static analysis, `npm audit`, `npm outdated`, git inspection

**Scoring:** Priority = (Impact + Risk) × (6 − Effort), each rated 1–5.

## Prioritized findings

| # | Item | Category | Impact | Risk | Effort | Priority |
|---|------|----------|--------|------|--------|----------|
| 1 | Secrets committed to git (`frontend/.env`, `frontend/.npmrc`) | Security | 5 | 5 | 2 | **40** |
| 2 | 9 dependency vulnerabilities (2 critical, 3 high) | Dependency | 3 | 5 | 2 | **32** |
| 3 | `package-lock.json` gitignored — non-reproducible builds | Infrastructure | 3 | 3 | 1 | **30** |
| 4 | Toolchain drift: eslint-config-next 14 vs Next 15, Node 18 (EOL) on Netlify, stale `experimental.appDir` | Dependency | 3 | 3 | 2 | **24** |
| 5 | God components (10+ files over 700 lines; `search.js` at 1,770) | Code | 4 | 3 | 3 | **21** |
| 6 | GraphQL operations scattered: 29 files define inline `gql`, only 4 centralized in `src/graphql/` | Code | 3 | 2 | 2 | **20** |
| 7 | Root README garbled (duplicated/broken sections); no frontend contributor docs | Documentation | 2 | 2 | 1 | **20** |
| 8 | Zero automated tests across 240 JS files | Test | 4 | 5 | 4 | **18** |
| 9 | ~2,100 lines of static Pokémon data as JS in `src/utils` (`pokemonList.js` + near-duplicate `pokemonListShiny.js`) | Code | 2 | 1 | 1 | **15** |
| 10 | Mixed routing: `src/pages` (Pages Router) + two App Router dirs (`app/`, `src/app/`) with duplicate layouts; stray `marketplace.js` alongside `marketplace/`, empty `extracted/` | Architecture | 4 | 3 | 4 | **14** |

## Detail and business justification

### 1. Secrets committed to git — CRITICAL, act immediately
`frontend/.env` is tracked and pushed to the GitHub remote (`FalconChipp/tcg-fullstack`). It contains `GOOGLE_CLIENT_SECRET`, `NODE_AUTH_TOKEN`, and `DISCORD_BOT_API_KEY`. `frontend/.npmrc` is also tracked and contains a **literal GitHub Packages auth token** rather than an env-var placeholder. `.gitignore` lists `frontend/.env` three times, but ignoring a file after it's tracked does nothing.

Anyone with repo access (or anyone, if the repo is ever public) can impersonate the app's Google OAuth client, publish to your npm scope, and control the Discord bot. Remediation: rotate all four credentials, `git rm --cached` both files, replace the `.npmrc` token with `${NODE_AUTH_TOKEN}`, and scrub history (`git filter-repo`) since rotation alone leaves the old values in every clone.

### 2. Dependency vulnerabilities
`npm audit`: 2 critical (next 15.0.7, swiper), 3 high (ws — memory disclosure + DoS, socket.io-parser — unbounded binary attachments, picomatch), 4 moderate (postcss, uuid). The ws and socket.io issues are directly exposed via the realtime client. `npm audit fix` clears the non-breaking ones; next and swiper need version bumps (see item 4).

### 3. Non-reproducible builds
`frontend/package-lock.json` exists locally but is gitignored, so Netlify resolves fresh dependency trees on every deploy. Any transitive release can break production with no code change — the worst kind of incident to debug. One-line fix: remove from `.gitignore` and commit the lockfile.

### 4. Toolchain drift
`eslint-config-next` is pinned to 14.1.0 against Next 15.0.7, so lint rules don't match the framework. `next.config.js` still sets `experimental: { appDir: true }`, obsolete since Next 13.4. Netlify pins `NODE_VERSION = "18"`, which is past end-of-life (no security patches). Next itself is one major behind (16.x is latest). Aligning these unblocks the audit fixes in item 2.

### 5. God components
`src/pages/search.js` (1,770 lines), `CardDetailsModal.js` (1,519), `CardSearch.js` (1,389), `SellingTab.js` (1,310), `AdminProductsPanel.js` (1,171), plus six more over 700 lines. These files mix data fetching, state, and rendering, making every change high-risk and code review ineffective. Recent commits ("Refactor CardDetailsModal") show this is already slowing work. Decompose opportunistically — when a file is touched for a feature, extract hooks and subcomponents first.

### 6. Scattered GraphQL operations
29 files define operations inline while `src/graphql/` holds only 4 modules. Schema changes on the backend require hunting through components; the README's own advice is "spot-check through `npm run build`". Centralizing operations (and eventually adding codegen) turns backend schema drift into a compile-time error.

### 7. Documentation debt
The root README has duplicated deployment tables, broken code fences, and truncated sections — it reads as merge-conflict residue. There's no documented dev workflow for the frontend beyond it. Low effort, high onboarding value.

### 8. Zero tests
No test files, no test runner, no `test` script anywhere in `frontend/`. Every regression ships to production and is caught by users. Given items 5 and 6, start where risk concentrates: pure functions in `src/utils` (price/currency/condition formatting, search normalization) are cheap to test today without any refactoring, then add a smoke-level integration test for checkout and marketplace listing flows.

### 9. Static data as code
`pokemonList.js` and `pokemonListShiny.js` are ~2,100 lines of near-duplicate static data inside `src/utils`, inflating bundles and polluting the utils namespace. Move to JSON under `src/data/` (which already exists) and derive the shiny variant if possible.

### 10. Mixed routing architecture
Three router roots coexist: `src/pages` (primary, Pages Router), `app/` (Discord API routes + parent verify), and `src/app/` (a second layout + not-found). Two `layout.js` files differ; it's unclear which App Router tree is authoritative. Also: `src/pages/marketplace.js` coexists with `src/pages/marketplace/`, and `extracted/` is an empty leftover directory. Pick one App Router root, delete the other, remove `extracted/`, and document the long-term router migration intent in `.intent/`.

## Phased remediation plan

**Phase 0 — Security triage (this week, ~1 day)**
Rotate Google OAuth secret, npm token, GitHub Packages token, Discord bot key → untrack `.env`/`.npmrc` → scrub git history → run `npm audit fix` for non-breaking patches (ws, socket.io-parser, picomatch). Items 1, 2 (partial).

**Phase 1 — Build stability (sprint 1, ~2 days alongside feature work)**
Commit `package-lock.json` → bump Netlify to Node 22 → align `eslint-config-next` to 15.x → drop `experimental.appDir` → bump swiper and evaluate Next 15→16. Verify with `npm run build`. Items 3, 4, 2 (rest).

**Phase 2 — Safety net (sprints 2–3, incremental)**
Add a test runner + unit tests for `src/utils` pure functions → CI to run lint, build, and tests on PRs → smoke tests for checkout/marketplace. Item 8.

**Phase 3 — Structural cleanup (ongoing, opportunistic)**
Boy-scout rule for god components (item 5) → centralize GraphQL ops per feature as they're touched, consider codegen (item 6) → consolidate to a single App Router dir and delete dead paths (item 10) → move Pokémon data to JSON (item 9) → rewrite root README (item 7).

---
*Housekeeping: `@dev-sixbyfive/intent@^1.1.0` (latest) was added to `frontend/package.json` devDependencies and installed, per project tooling policy. Backend was out of scope (exists only as `backend.zip`).*
