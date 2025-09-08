// ADDED: Local JSON loader for set metadata (server-safe).
import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, "data", "sets");

export function listKnownSetCodes() {
  try {
    return fs
      .readdirSync(DATA_DIR)
      .filter((f) => f.endsWith(".json"))
      .map((f) => f.replace(/\.json$/i, ""));
  } catch {
    return [];
  }
}

export function getSetData(code) {
  if (!code) return null;
  const file = path.join(DATA_DIR, `${code.toLowerCase()}.json`);
  try {
    const raw = fs.readFileSync(file, "utf8");
    const json = JSON.parse(raw);
    // CHANGED: derive total if missing
    if (!json.totalCards && Array.isArray(json.cards)) {
      json.totalCards = json.cards.length;
    }
    return json;
  } catch {
    return null;
  }
}
