// src/utils/apiClient.js
const GRAPHQL_URL = process.env.NEXT_PUBLIC_GRAPHQL_ENDPOINT;

export async function apiClient(query, variables = {}, token) {
  console.log("apiClient: Called with query:", query, "variables:", variables, "token:", token);
  const headers = {
    "Content-Type": "application/json",
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  } else {
    null
  }
  const res = await fetch(GRAPHQL_URL, {
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
