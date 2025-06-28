# TCG Fullstack

This monorepo contains the complete stack for the SixByFive trading card game (TCG) site. It aggregates the backend API, the public-facing web app and an admin dashboard in a single repository.

## Repository structure

- `backend/` – Node.js GraphQL server with a MySQL database
- `dashboard/` – admin dashboard built with Next.js
- `frontend/` – main Next.js application for end users

Each folder includes its own `README.md` with detailed setup instructions.

## Getting started

Clone the repository and install dependencies for the parts you wish to run:

```bash
# clone
git clone <repo-url>
cd tcg-fullstack

# install backend dependencies
cd backend && npm install

# install dashboard dependencies
cd ../dashboard && npm install

# install frontend dependencies
cd ../frontend && npm install
```

Refer to the subproject READMEs for environment variables and development commands.

## Security

- Backend CORS allowed origins are set via the `CORS_ORIGINS` environment variable.
- A global rate limiter restricts clients to 100 requests every 15 minutes.
- Stripe webhook signatures are verified using `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET`.
- Avatar uploads now require authentication via the Authorization header.
