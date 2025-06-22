// src/utils/apiClient.js
export async function apiClient(query, variables = {}, token) {
  console.log("apiClient: Called with query:", query, "variables:", variables, "token:", token);
  const WP_GRAPHQL_URL = "http://tcg.local/graphql";
  const headers = {
    "Content-Type": "application/json",
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  } else {
    null
  }
  const res = await fetch(WP_GRAPHQL_URL, {
    method: "POST",
    headers,
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (json.errors) {
    throw new Error(json.errors[0].message || "GraphQL Error");
  }
  return json.data;
}
