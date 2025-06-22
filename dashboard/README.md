# TCG Admin Dashboard

This Next.js project provides a basic admin interface for the TCG backend.
It uses Apollo Client to interact with the GraphQL API exposed by the backend
(found in `../src`) and Tailwind CSS for styling.

## Development

```
npm install
npm run dev
```

Set `NEXT_PUBLIC_GRAPHQL_ENDPOINT` in a `.env.local` file if the backend is
running on a different URL.

Tailwind is configured with `darkMode: 'class'` so the dashboard uses a dark
theme by default.
