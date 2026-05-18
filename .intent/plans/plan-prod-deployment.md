---
id: plan-prod-deployment
title: Frontend production deployment readiness
type: plan
status: draft
created: "2026-05-17T00:00:00.000Z"
updated: "2026-05-17T00:00:00.000Z"
system: sys-frontend
decisions: [DEC-0001]
tags: [production, deployment, config, netlify]
---

## Goal

Get the frontend web app to a clean production build targeting the new tcg-runtime backend.

## Audit summary (2026-05-17)

The frontend is in good shape. Apollo Client already points at the new gateway (`NEXT_PUBLIC_GRAPHQL_ENDPOINT || "http://localhost:4010/graphql"`). All GraphQL queries use the correct field shapes for the new schema. Auth flow is compatible.

## Checklist

### Build fix
- [x] **Add `@sixbyfive/api-client` to package.json** — was in node_modules but undeclared; would break any fresh npm install / Netlify build (see DEC-0001)
- [ ] **Run `npm install` in `frontend/`** — regenerate `package-lock.json` after adding the dependency

### Config
- [x] **Gateway URLs** — `netlify.toml` updated with all prod endpoints pointing at `https://backendtcg.sixbyfive.com`:
  - `NEXT_PUBLIC_GRAPHQL_ENDPOINT` = `https://backendtcg.sixbyfive.com/graphql`
  - `NEXT_PUBLIC_API_BASE_URL` / `NEXT_PUBLIC_BACKEND_URL` / `NEXT_PUBLIC_GATEWAY_URL` = `https://backendtcg.sixbyfive.com`
  - `NEXT_PUBLIC_REALTIME_URL` = `https://backendtcg.sixbyfive.com`
- [ ] **`GOOGLE_CLIENT_ID`** — set real Google OAuth client ID in Netlify UI (currently placeholder in `.env`)
- [ ] **`NODE_AUTH_TOKEN`** — GitHub Packages read token; already in `frontend/.npmrc` which Netlify reads via `NPM_CONFIG_USERCONFIG`

### Image domains
- [x] **Image domains** — `next.config.js` already has `backendtcg.sixbyfive.com` in `remotePatterns`; same domain used for new backend, no change needed

### Pre-build verification
- [ ] Confirm `npm run build` passes locally with `NEXT_PUBLIC_GRAPHQL_ENDPOINT` pointing at the new gateway
- [ ] Test login / register flow (uses `@sixbyfive/tcg-binder` `LoginDocument` / `RegisterDocument` — compatible with `AuthPayload { token, user }`)
- [ ] Test card search, collection, binder pages
- [ ] Test admin dashboard (`allUsers`, `listings`, `adminQueryReportedUsers` — all present in gateway schema)
- [ ] Test notifications and price alerts
- [ ] Test password reset email flow (depends on gateway `requestPasswordReset` + SMTP being configured)

### Known deferred / disabled features
- Messenger / real-time chat — `MessengerProvider` is commented out in `_app.js`; intentionally not shipped yet
- Subscriptions tab in account — marked `soon: true` in the nav, not functional
- Marketplace / card listings tab — card listings segment is visually disabled; product listings work
