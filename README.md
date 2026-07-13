# TCG Fullstack Monorepo

This repository bundles the complete SixByFive TCG platform: the public Next.js web app and its Node.js GraphQL backend.

## Repository layout

```
frontend/   Next.js app — collection management, binder tools, marketplace, subscriptions, admin UI
backend/    Express + Apollo GraphQL API, Stripe billing, notifications, marketdata pipeline
```

Each subdirectory is an independent Node application with its own `package.json` and README.

## Quick start

```bash
# Terminal 1 — backend (port 4000)
cd backend && npm install && npm run dev

# Terminal 2 — frontend (port 3000)
cd frontend && npm install && npm run dev
```

Copy each project's `.env.example` to `.env.local` and fill in credentials before running.

## Deployment

| Component | Build          | Start          | Host                    |
|-----------|----------------|----------------|-------------------------|
| backend   | `npm install`  | `npm start`    | Node server / PM2       |
| frontend  | `npm run build`| `npm start`    | Netlify                 |

`NEXT_PUBLIC_GRAPHQL_ENDPOINT` must point at the deployed backend URL.

Backend minimum env vars: `ADMIN_API_TOKEN`, `JWT_SECRET`, DB credentials, Stripe keys, marketdata provider keys.

## Backend — marketdata pipeline

- JSON caches live under `backend/data/marketdata2/` (sets, cards, FX).
- Scheduled ticks (`metadataTick`, `pricingTick`, `patchTick`) run from `backend/src/tasks/marketdata2.schedule.js` and can be triggered manually via REST or GraphQL admin mutations.
- Price rollups cover 1/7/30/90-day spans via `m_PriceDaily`, `m_PriceLatest`, `m_PriceRollup`.

## Testing

- Backend: Vitest (unit + integration); tests live beside modules.
- Frontend: lint + build gate only; Playwright/Cypress for UI coverage is a planned addition.

## Contributing

1. Branch from `main`.
2. Update the relevant README when behaviour changes.
3. Run `npm run lint && npm run build` in the affected subproject before opening a PR.
4. Describe impacted subsystems in the PR body.

## Troubleshooting

- **Port conflicts** — ensure 3000 and 4000 are free, or override via env files.
- **DB connectivity** — confirm `.env` host/port and that MySQL accepts TCP connections.
- **Marketdata jobs** — check `/admin/md2/providers` and scheduler logs in the backend console.
- **Auth issues** — verify `JWT_SECRET` is identical in backend and frontend env; clear cookies/localStorage when debugging.

For subsystem-specific details, see `backend/README.md` and `frontend/README.md`.
