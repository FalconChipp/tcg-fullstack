// /app/apolloClient.js
import {
  ApolloClient,
  InMemoryCache,
  HttpLink,
  ApolloLink,
  from,
} from "@apollo/client";
import { onError } from "@apollo/client/link/error";

// ---- Auth (kept) ----
function getToken() {
  try {
    const m = document.cookie.match(/(?:^|; )authToken=([^;]+)/);
    return m ? decodeURIComponent(m[1]) : null;
  } catch {
    return null;
  }
}

const httpLink = new HttpLink({
  uri: process.env.NEXT_PUBLIC_GRAPHQL_ENDPOINT,
  credentials: "include",
});

const authLink = new ApolloLink((operation, forward) => {
  const token = typeof window !== "undefined" ? getToken() : null;
  if (token) {
    operation.setContext(({ headers = {} }) => ({
      headers: { ...headers, Authorization: `Bearer ${token}` },
    }));
  }
  return forward(operation);
});

// Optional: clean console noise while developing
const errorLink = onError(({ graphQLErrors, networkError, operation }) => {
  if (graphQLErrors?.length) {
    // Keep this light; detailed logs can be noisy during infinite scroll
    console.warn(
      "[GraphQL]",
      operation.operationName || "anonymous",
      graphQLErrors.map((e) => e.message).join(" | ")
    );
  }
  if (networkError) {
    console.warn("[Network]", networkError?.message || networkError);
  }
});

// ---- Cache with sane type policies ----
// Configure cardsearch pagination so offset-based fetchMore calls merge predictably.
const cache = new InMemoryCache({
  typePolicies: {
    Query: {
      fields: {
        cardsearchSearchCards: {
          keyArgs: (args) => {
            const input = args?.input || {};
            return [
              input.name ?? "",
              input.set ?? "",
              input.number ?? "",
              input.variant ?? "",
              input.orderBy ?? "RELEVANCE",
            ];
          },
          merge(existing = { items: [] }, incoming, { args }) {
            if (!incoming) return existing;
            const offset = args?.input?.offset ?? 0;
            const mergedItems = Array.isArray(existing?.items) ? [...existing.items] : [];
            const incomingItems = Array.isArray(incoming.items) ? incoming.items : [];

            for (let i = 0; i < incomingItems.length; i += 1) {
              mergedItems[offset + i] = incomingItems[i];
            }

            const total =
              typeof incoming.total === "number"
                ? incoming.total
                : typeof existing?.total === "number"
                  ? existing.total
                  : mergedItems.length;
            const limit =
              typeof incoming.limit === "number"
                ? incoming.limit
                : typeof args?.input?.limit === "number"
                  ? args.input.limit
                  : typeof existing?.limit === "number"
                    ? existing.limit
                    : incomingItems.length;

            return {
              ...incoming,
              items: mergedItems,
              total,
              limit,
              offset,
            };
          },
        },
      },
    },
  },
});

// ---- Client ----
export const apolloClient = new ApolloClient({
  ssrMode: typeof window === "undefined",
  link: from([errorLink, authLink, httpLink]),
  cache,
  // Reduce extra network traffic and render sooner from cache
  defaultOptions: {
    watchQuery: {
      fetchPolicy: "cache-first",
      nextFetchPolicy: "cache-first",
      notifyOnNetworkStatusChange: true,
      returnPartialData: true,
    },
    query: {
      fetchPolicy: "cache-first",
      nextFetchPolicy: "cache-first",
    },
  },
  // Avoid sending the same query twice in quick succession
  queryDeduplication: true,
  // Minor perf: assume results are immutable (typical in GraphQL)
  assumeImmutableResults: true,
  // Uncomment if you want to inspect cache in devtools
  // connectToDevTools: process.env.NODE_ENV !== "production",
});
