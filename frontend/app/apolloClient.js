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
// We keep merges manual in the component to avoid accidental double-appends.
const cache = new InMemoryCache({
  typePolicies: {
    Query: {
      fields: {
        searchCards: {
          keyArgs: ["input"], // legacy paged query
          // no merge -> component controls pagination
        },
        searchCardsConnection: {
          keyArgs: ["input"], // cursor query
          // no merge -> component controls pagination (edges appended manually)
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
