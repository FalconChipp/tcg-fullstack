# TCG Admin Dashboard

This Next.js project provides a lightweight administrative interface for the backend API. It requires Node.js 18+ and is intended for staff members to manage content and review user submissions.

## Setup

Install dependencies and start the development server:

```bash
npm install
npm run dev
```

Set `NEXT_PUBLIC_GRAPHQL_ENDPOINT` in a `.env.local` file if the backend runs on a different host.

Tailwind CSS is configured with `darkMode: 'class'` so the dashboard appears in dark theme by default.

## Testing

The dashboard currently has no automated tests. Run a build to ensure compilation succeeds:

```bash
npm run build
```
