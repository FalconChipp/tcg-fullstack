/**
 * generateBrunoFromSchema.js
 *
 * FIXED (2026-02-03):
 * - CHANGED: Bruno request format from:
 *     request { url, method }
 *   to:
 *     post { url }
 *   ✅ Bruno indexes requests only when the method is the block name.
 *
 * - ADDED: optional BASE_URL usage (recommended)
 * - KEPT: Query/Mutation extraction logic
 *
 * Run:
 *   cd H:\tcg-fullstack\backend
 *   node scripts/generateBrunoFromSchema.js
 */

import fs from "fs";
import path from "path";

// -------------------------
// CONFIG (EDIT IF NEEDED)
// -------------------------

// Exported GraphQL schema file
const SCHEMA_PATH = "H:\\tcg-fullstack\\SixByFive API\\schema.graphql";

// Bruno collection folder (contains bruno.json)
const COLLECTION_PATH = "H:\\tcg-fullstack\\SixByFive API";

// Prefer a variable (set BASE_URL in Bruno Vars)
// Example: BASE_URL = http://localhost:4000
const GRAPHQL_URL = "{{BASE_URL}}/graphql";

// Where to generate
const QUERIES_DIR_NAME = "Queries";
const MUTATIONS_DIR_NAME = "Mutations";

// -------------------------
// HELPERS
// -------------------------

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function safeFileName(name) {
  // Windows-safe file names
  return name.replace(/[<>:"/\\|?*]+/g, "_");
}

/**
 * Extract root field names from:
 *   type Query { ... }
 *   type Mutation { ... }
 *
 * Returns:
 *   { Query: string[], Mutation: string[] }
 */
function extractRootFields(schemaText) {
  const result = { Query: [], Mutation: [] };

  for (const rootType of ["Query", "Mutation"]) {
    // Match: type Query { ... }
    const re = new RegExp(`type\\s+${rootType}\\s*{([\\s\\S]*?)\\n}`, "m");
    const match = schemaText.match(re);
    if (!match) continue;

    const block = match[1];

    // Each line usually looks like:
    // me: User
    // card(id: ID!): Card
    // searchCards(input: SearchInput!): [Card!]!
    const lines = block
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .filter((l) => !l.startsWith("#"));

    for (const line of lines) {
      // Take field name up to "(" or ":" (ignores args/return type)
      const name = line.split("(")[0].split(":")[0].trim();
      if (name) result[rootType].push(name);
    }
  }

  // De-dup + sort
  result.Query = [...new Set(result.Query)].sort();
  result.Mutation = [...new Set(result.Mutation)].sort();

  return result;
}

/**
 * ✅ Bruno-compatible .bru file format for GraphQL:
 *
 * meta { name: ... type: graphql }
 * post { url: ... }
 * body:graphql { ... }
 *
 * NOTE: Bruno will NOT index files using `request { method: POST }`.
 */
function makeBruFile({ name, operationType }) {
  const isMutation = operationType === "Mutation";
  const gqlOp = isMutation ? "mutation" : "query";

  return `meta {
  name: ${name}
  type: graphql
}

post {
  url: ${GRAPHQL_URL}
}

headers {
  Content-Type: application/json
}

body:graphql {
  ${gqlOp} ${safeFileName(name)} {
    ${name}
  }
}
`;
}

/**
 * Remove all .bru files in a directory (so stale bad-format files don't remain)
 */
function clearBruFiles(dir) {
  if (!fs.existsSync(dir)) return;
  const files = fs.readdirSync(dir);
  for (const f of files) {
    if (f.toLowerCase().endsWith(".bru")) {
      fs.unlinkSync(path.join(dir, f));
    }
  }
}

// -------------------------
// MAIN
// -------------------------

if (!fs.existsSync(SCHEMA_PATH)) {
  console.error(`❌ Schema not found: ${SCHEMA_PATH}`);
  process.exit(1);
}
if (!fs.existsSync(COLLECTION_PATH)) {
  console.error(`❌ Collection not found: ${COLLECTION_PATH}`);
  process.exit(1);
}

const schemaText = fs.readFileSync(SCHEMA_PATH, "utf8");
const roots = extractRootFields(schemaText);

const queriesDir = path.join(COLLECTION_PATH, QUERIES_DIR_NAME);
const mutationsDir = path.join(COLLECTION_PATH, MUTATIONS_DIR_NAME);

ensureDir(queriesDir);
ensureDir(mutationsDir);

// Clear old invalid .bru files so Bruno doesn't keep ignoring them
clearBruFiles(queriesDir);
clearBruFiles(mutationsDir);

// Generate Query requests
for (const fieldName of roots.Query) {
  const content = makeBruFile({ name: fieldName, operationType: "Query" });
  const filePath = path.join(queriesDir, `${safeFileName(fieldName)}.bru`);
  fs.writeFileSync(filePath, content, "utf8");
}

// Generate Mutation requests
for (const fieldName of roots.Mutation) {
  const content = makeBruFile({ name: fieldName, operationType: "Mutation" });
  const filePath = path.join(mutationsDir, `${safeFileName(fieldName)}.bru`);
  fs.writeFileSync(filePath, content, "utf8");
}

console.log("✅ Generated Bruno requests (Bruno-compatible format):");
console.log(`- Queries: ${roots.Query.length} -> ${queriesDir}`);
console.log(`- Mutations: ${roots.Mutation.length} -> ${mutationsDir}`);
console.log("");
console.log("Next:");
console.log("- Restart Bruno");
console.log('- Set Collection Vars: BASE_URL = "http://localhost:4000" (or your prod URL)');
