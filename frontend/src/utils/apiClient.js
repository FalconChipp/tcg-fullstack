// src/utils/apiClient.js
const GRAPHQL_URL = process.env.NEXT_PUBLIC_GRAPHQL_ENDPOINT;

export async function apiClient(query, variables = {}, token) {
  console.log("[apiClient] query:", query, "variables:", variables);

  const headers = { 
    "Content-Type": "application/json",
    "apollo-require-preflight": "true"
   };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(GRAPHQL_URL, {
    method: "POST",
    headers,
    body: JSON.stringify({ query, variables }),
  });

  if (!res.ok) {
    throw new Error(`Network error: ${res.status} ${res.statusText}`);
  }

  const json = await res.json();
  if (json.errors?.length) {
    const err = json.errors[0];
    const msg = err?.extensions?.debugMessage || err?.message || "GraphQL Error";
    throw new Error(msg);
  }
  console.log('[env endpoint]', process.env.NEXT_PUBLIC_GRAPHQL_ENDPOINT);
  return json.data;
}
