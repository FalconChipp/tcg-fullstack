# TCG Backend

This directory contains the Node.js GraphQL API used by the TCG applications. It requires Node.js 18+ and connects to a MySQL database, exposing all functionality consumed by the frontend and dashboard.

## Setup

1. Install dependencies

```bash
npm install
```

2. Configure environment variables in a `.env` file. Common variables include:

- `DB_NAME`, `DB_USER`, `DB_PASS`, `DB_HOST`, `DB_PORT` – MySQL connection details
- `PORT` – port for the server (defaults to 4000)
- `STRIPE_WEBHOOK_SECRET` – secret used for Stripe webhooks
- `STRIPE_SECRET_KEY` – your Stripe API key
- `CORS_ORIGINS` – comma-separated list of allowed origins for CORS

## Development

Start the server with nodemon:

```bash
npm run dev
```

The GraphQL endpoint will be available at `http://localhost:4000/graphql`.

Seed initial data (achievements and subscription tiers) with:

```bash
npm run seed
```

### Example: Adding a new achievement

Use the `addAchievement` mutation (admin only) to create achievements:

```graphql
mutation {
  addAchievement(input: {
    code: "first_collection_entry"
    name: "First Card!"
    description: "Add your first card to your collection"
    tier: "Bronze"
    iconUrl: "/achievements/first_card.png"
    points: 10
    isActive: true
    criteria: "{ \"type\": \"collection_entry\", \"count\": 1 }"
    isHidden: false
  }) { id code name }
}
```

### Example: Auto-grant trigger

Use `maybeGrantAchievement` in backend code when an action might earn an achievement:

```javascript
import { maybeGrantAchievement } from './modules/achievements/helpers.js';

// After a user action succeeds
await maybeGrantAchievement(userId, 'first_collection_entry', { cardId });
```

### Subscriptions

Use the `createSubscription` mutation to start a plan:

```graphql
mutation {
  createSubscription(tierId: "<tier>", paymentMethodId: "pm_123") {
    id
    status
  }
}
```

Active subscriptions can be queried with `mySubscription`.

## Testing & Linting

Run the Jest test suite:

```bash
npm test
```

Check code style with ESLint:

```bash
npm run lint
```

### Security Notes
- CORS allowed origins are configurable via `CORS_ORIGINS`.
- A global rate limiter restricts each IP to 100 requests per 15 minutes.
- Avatar uploads verify the user ID from the Authorization token.
- Stripe webhooks are validated using your secret key.
