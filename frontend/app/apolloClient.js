// /app/apolloClient.js
import { ApolloClient, InMemoryCache, HttpLink, ApolloLink, from } from "@apollo/client";

// Optional: attach Bearer token from cookie/localStorage (client-side)
function getToken() {
  try {
    // If you store the token in a cookie named 'authToken'
    const m = document.cookie.match(/(?:^|; )authToken=([^;]+)/);
    return m ? decodeURIComponent(m[1]) : null;
  } catch { return null; }
}

const httpLink = new HttpLink({
  uri: process.env.NEXT_PUBLIC_GRAPHQL_ENDPOINT, // REQUIRED
  credentials: "include", // if you need cookies; otherwise omit
});

// Inject Authorization header when token exists
const authLink = new ApolloLink((operation, forward) => {
  const token = typeof window !== "undefined" ? getToken() : null;
  if (token) {
    operation.setContext(({ headers = {} }) => ({
      headers: { ...headers, Authorization: `Bearer ${token}` },
    }));
  }
  return forward(operation);
});

export const apolloClient = new ApolloClient({
  link: from([authLink, httpLink]),
  cache: new InMemoryCache(),
});
