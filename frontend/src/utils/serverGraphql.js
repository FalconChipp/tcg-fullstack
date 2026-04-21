// utils/serverGraphql.js
// Minimal helper to execute GraphQL queries from Next.js data-fetching methods.

export async function executeServerGraphql(query, variables = {}) {
  const FALLBACK_ENDPOINT = "https://backendtcg.sixbyfive.com/graphql";
  const candidates = [
    process.env.GRAPHQL_ENDPOINT,
    process.env.NEXT_PUBLIC_GRAPHQL_ENDPOINT,
    process.env.NEXT_PUBLIC_GRAPHQL_URL,
    process.env.GRAPHQL_URL,
  ]
    .filter((value) => typeof value === "string" && value.trim().length > 0)
    .map((value) => value.trim());

  if (!candidates.includes(FALLBACK_ENDPOINT)) {
    candidates.push(FALLBACK_ENDPOINT);
  }

  if (candidates.length === 0) {
    throw new Error("GraphQL endpoint is not configured.");
  }

  let lastError = null;

  for (const endpoint of candidates) {
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { 
          "content-type": "application/json",
          "apollo-require-preflight": "true",
         },
        body: JSON.stringify({ query, variables }),
        cache: "no-store",
      });

      if (!res.ok) {
        const text = await res.text().catch(() => res.statusText);
        lastError = new Error(`GraphQL request failed (${res.status}): ${text}`);
        continue;
      }

      const json = await res.json();
      if (json?.errors?.length) {
        const message = json.errors.map((e) => e.message).join(" | ");
        lastError = new Error(`GraphQL responded with errors: ${message}`);
        continue;
      }

      return json?.data ?? null;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
    }
  }

  throw lastError ?? new Error("GraphQL request failed with unknown error.");
}

export default executeServerGraphql;
