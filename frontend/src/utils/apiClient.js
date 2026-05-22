// Central API configuration and GraphQL fetch helper.
// All components should import from here — never hardcode localhost fallbacks inline.

export function getApiBase() {
  return (
    (typeof process !== "undefined" && process.env.NEXT_PUBLIC_API_BASE_URL) ||
    "http://localhost:4010"
  );
}

export function getGraphqlUrl() {
  return (
    (typeof process !== "undefined" && process.env.NEXT_PUBLIC_GRAPHQL_ENDPOINT) ||
    `${getApiBase()}/graphql`
  );
}

/**
 * Thin GraphQL fetch helper.
 * Works with both tagged-template gql objects (Apollo) and plain strings.
 */
export async function gqlFetch(query, variables = {}, token = null) {
  const res = await fetch(getGraphqlUrl(), {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      "apollo-require-preflight": "true",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      query: query?.loc?.source?.body ?? query,
      variables,
    }),
  });

  if (!res.ok) {
    throw new Error(`Network error: ${res.status} ${res.statusText}`);
  }

  const json = await res.json();
  if (json.errors?.length) {
    const first = json.errors[0];
    const err = new Error(first?.extensions?.debugMessage || first?.message || "GraphQL error");
    err.graphQLErrors = json.errors;
    err.extensions = first?.extensions ?? null;
    err.code = first?.extensions?.code ?? null;
    throw err;
  }

  return json.data;
}

// Legacy named export used by older components that pass (query, variables, token)
export const apiClient = gqlFetch;
