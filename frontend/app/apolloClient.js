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

/**
 * CHANGED:
 * - Added local runtime fallback for GraphQL endpoint.
 * - Added apollo-require-preflight header to satisfy Apollo Server CSRF protection.
 */
const httpLink = new HttpLink({
  uri: process.env.NEXT_PUBLIC_GRAPHQL_ENDPOINT || "http://localhost:4010/graphql",
  credentials: "include",
  headers: {
    "apollo-require-preflight": "true",
  },
});

const authLink = new ApolloLink((operation, forward) => {
  const token = typeof window !== "undefined" ? getToken() : null;

  operation.setContext(({ headers = {} }) => ({
    headers: {
      ...headers,
      "apollo-require-preflight": "true",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  }));

  return forward(operation);
});

// Optional: clean console noise while developing
const errorLink = onError(({ graphQLErrors, networkError, operation }) => {
  if (graphQLErrors?.length) {
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
// possibleTypes tells Apollo which concrete types implement each interface / union so
// inline fragments (... on CardListing) are recognised correctly in the cache.
const cache = new InMemoryCache({
  possibleTypes: {
    ListingBase: ['CardListing', 'ProductListing'],
  },
  typePolicies: {
    Query: {
      fields: {
        cardsearchSearchCards: {
          // keyArgs must be a KeySpecifier — a list of *argument paths* for
          // Apollo to read at cache-key time, not precomputed values. The
          // previous version returned actual strings (e.g. "Drampa", "sm1"),
          // which Apollo tried to interpret as field names to look up on
          // `args` — none matched, so every search collapsed to the same
          // empty key ("cardsearchSearchCards:{}") and merge() below kept
          // blending results across totally different searches.
          keyArgs: ["input", ["name", "set", "number"]],
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
  queryDeduplication: true,
  assumeImmutableResults: true,
});