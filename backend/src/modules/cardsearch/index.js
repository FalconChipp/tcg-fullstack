// src/modules/cardsearch/index.js
// Module bootstrap for Card Search.
// - Exposes GraphQL { typeDefs, resolvers } for Apollo
// - Optionally mounts the admin HTTP routes under /admin/cardsearch (or a custom basePath)
// - Works with different admin/routes.js export styles (Router instance or factory)
// - No top-level await; admin routes are loaded lazily when needed.

import typeDefs from "./typeDefs.js";
import resolvers from "./resolvers.js";

/** Module id used by your loader/scheduler logs */
export const name = "cardsearch";

/** Return GraphQL SDL string (for loaders that call functions) */
export function getTypeDefs() {
  return typeDefs;
}

/** Return GraphQL resolvers map */
export function getResolvers() {
  return resolvers;
}

/* -----------------------------------------------------------------------------
 * Admin routes (lazy loaded)
 * -------------------------------------------------------------------------- */

let _adminLoaded = false;
let _adminDefault = null;       // default export (Router or factory)
let _createAdminRouter = null;  // named export factory

async function loadAdminModule() {
  if (_adminLoaded) return;
  _adminLoaded = true;
  try {
    // eslint-disable-next-line import/no-unresolved
    const mod = await import("./admin/routes.js");
    _adminDefault = mod?.default ?? null;
    _createAdminRouter = mod?.createAdminRouter ?? null;
  } catch {
    // Admin routes are optional; ignore if not present.
    _adminDefault = null;
    _createAdminRouter = null;
  }
}

/**
 * Internal: resolve a Router from whatever admin export style is present.
 * Supports:
 *   1) default export: Express.Router instance
 *   2) default export: factory function returning an Express.Router
 *   3) named export:   createAdminRouter() -> Express.Router
 * @returns {Promise<import('express').Router|null>}
 */
async function resolveAdminRouter() {
  await loadAdminModule();

  // If default export is an Express Router (has .use or .handle), use it.
  if (_adminDefault && (typeof _adminDefault === "function" || typeof _adminDefault === "object")) {
    const maybeRouter = _adminDefault;

    // Heuristic: Express routers are functions with .use/.handle or objects with .use
    if (
      (typeof maybeRouter === "function" && (maybeRouter.use || maybeRouter.handle)) ||
      (typeof maybeRouter === "object" && maybeRouter.use)
    ) {
      return /** @type {import('express').Router} */ (maybeRouter);
    }

    // Otherwise if it's a function, treat it as a factory
    if (typeof maybeRouter === "function") {
      const built = maybeRouter();
      if (built && (built.use || built.handle)) return built;
    }
  }

  // Named factory fallback
  if (typeof _createAdminRouter === "function") {
    const built = _createAdminRouter();
    if (built && (built.use || built.handle)) return built;
  }

  return null;
}

/**
 * Mount the admin UI/API routes to an Express app.
 * @param {import('express').Express} app - Express app instance
 * @param {string} [basePath="/admin/cardsearch"] - Mount point for admin routes
 * @returns {Promise<{ basePath: string } | null>} - Info about the mount, or null if not mounted
 */
export async function mountAdmin(app, basePath = "/admin/cardsearch") {
  if (!app || typeof app.use !== "function") return null;
  const router = await resolveAdminRouter();
  if (!router) return null;
  app.use(basePath, router);
  return { basePath };
}

/* -----------------------------------------------------------------------------
 * Default export: shape many loaders expect
 * -------------------------------------------------------------------------- */

const mod = {
  name,
  typeDefs,
  resolvers,
  // Note: default export keeps async function, so callers can await if needed.
  mountAdmin,
};

export default mod;
