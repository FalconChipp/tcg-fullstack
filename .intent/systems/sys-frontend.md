---
id: sys-frontend
title: Frontend Web App
type: system
status: active
created: "2026-05-17T00:00:00.000Z"
updated: "2026-05-17T00:00:00.000Z"
tags: [frontend, nextjs, apollo, web]
---

## Overview

Next.js 15 web application (Pages Router) deployed to Netlify. Serves the SixByFive TCG platform for desktop browsers. Mobile users are redirected to `/mobile-block` (the mobile app is a separate React Native project).

## Stack

- **Framework**: Next.js 15 (Pages Router; minimal App Router usage in `/app`)
- **GraphQL**: Apollo Client 3 — points at `NEXT_PUBLIC_GRAPHQL_ENDPOINT` (new tcg-runtime gateway at port 4010)
- **Auth**: Cookie-based (`authToken` JWT) + silent refresh via `POST /auth/refresh` (HttpOnly `sbf_refresh` cookie)
- **Styling**: Tailwind CSS
- **Hosting**: Netlify (`netlify.toml`, `@netlify/plugin-nextjs`)
- **Private packages**: `@sixbyfive` scoped packages from GitHub Packages (`npm.pkg.github.com`)

## Key paths

| Path | Purpose |
|------|---------|
| `frontend/src/pages/` | All Pages Router routes |
| `frontend/src/components/` | Feature-grouped components |
| `frontend/src/hooks/` | Custom React hooks |
| `frontend/src/graphql/` | GraphQL query/mutation documents |
| `frontend/src/utils/graphqlUtils.js` | Raw-fetch helpers, inline mutation strings, cardsearch queries |
| `frontend/app/apolloClient.js` | Apollo Client singleton |
| `frontend/src/components/Auth/AuthProvider.js` | JWT auth context, silent refresh |

## Private package dependencies

| Package | Version | Source |
|---------|---------|--------|
| `@sixbyfive/api-client` | `^0.1.1` | GitHub Packages — typed GraphQL documents for all domains |
| `@sixbyfive/tcg-binder` | `^0.6.2` | GitHub Packages — `LoginDocument`, `RegisterDocument`, binder types |

Auth token for GitHub Packages is in `frontend/.npmrc` (`_authToken`). Netlify uses it via `NPM_CONFIG_USERCONFIG = "./.npmrc"` in `netlify.toml`.

## Env vars required

| Variable | Purpose | Dev default |
|----------|---------|-------------|
| `NEXT_PUBLIC_GRAPHQL_ENDPOINT` | Gateway GraphQL endpoint | `http://localhost:4010/graphql` |
| `NEXT_PUBLIC_API_BASE_URL` | Gateway base URL (auth REST routes) | `http://localhost:4010` |
| `NEXT_PUBLIC_BACKEND_URL` | Alias for API_BASE_URL (fallback) | `http://localhost:4010` |
| `NEXT_PUBLIC_GATEWAY_URL` | Alias used in some components | `http://localhost:4010` |
| `NEXT_PUBLIC_REALTIME_URL` | WebSocket / realtime endpoint | `http://localhost:4018` |
| `GOOGLE_CLIENT_ID` | Google OAuth | placeholder in `.env` |
| `NODE_AUTH_TOKEN` | GitHub Packages read token | set in `.env` |

For production all `NEXT_PUBLIC_*` vars must be set in Netlify UI (they are baked into the JS bundle at build time).
