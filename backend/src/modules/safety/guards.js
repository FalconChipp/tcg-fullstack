// src/modules/safety/guards.js

import { computeCapabilities } from "./capabilities.js";

/* ------------------------- helpers ------------------------- */

function safeStr(v) {
  if (v == null) return "";
  return String(v);
}

function buildBlockedMessage({ action, caps }) {
  // Keep it user-friendly (and consistent).
  // You can swap this for ApolloError later if you want typed errors.
  const base = action ? `You cannot ${action}.` : "Action not allowed.";

  // If teen + not parent verified, be explicit.
  if (caps?.requiresParentApproval) {
    return `${base} Parent approval is required for this feature.`;
  }

  // For children, be explicit but short.
  if (caps?.restrictionLevel === "child") {
    return `${base} This feature is not available for child accounts.`;
  }

  return base;
}

/* ------------------------- main API ------------------------- */

/**
 * Enforce a computed capability.
 *
 * @param {object} user - The authenticated user object (should include dob, restriction_level, parent_verified_at).
 * @param {string} key - Capability key e.g. "canMessage", "canTrade", "canConnectDiscord"
 * @param {object} [opts]
 * @param {string} [opts.action] - Human readable action name for error message.
 * @param {object} [opts.meta] - Extra info you might want to log at call sites.
 * @param {function} [opts.onDeny] - Optional callback before throwing (for logging).
 * @returns {object} caps - Returns computed capabilities if allowed.
 * @throws Error if not allowed.
 */
export function requireCapability(user, key, opts = {}) {
  const caps = computeCapabilities(user);

  const capabilityKey = safeStr(key);
  const allowed = Boolean(caps && capabilityKey && caps[capabilityKey] === true);

  if (!allowed) {
    if (typeof opts.onDeny === "function") {
      try {
        opts.onDeny({ userId: user?.id, key: capabilityKey, caps, meta: opts.meta });
      } catch {
        // never block on logging
      }
    }

    const msg = buildBlockedMessage({ action: opts.action, caps });
    throw new Error(msg);
  }

  return caps;
}

/**
 * Non-throwing version (useful for conditional UI data on the backend)
 */
export function hasCapability(user, key) {
  const caps = computeCapabilities(user);
  return Boolean(caps && key && caps[key] === true);
}

/**
 * Optional helper if you want to re-check capabilities using a DB-fresh user.
 * Use this when the user object might be JWT payload only.
 *
 * @param {object} UserModel - Sequelize User model
 * @param {string|number} userId
 * @param {string} key
 * @param {object} opts
 */
export async function requireCapabilityFresh(UserModel, userId, key, opts = {}) {
  if (!UserModel) throw new Error("User model missing for capability check");
  const user = await UserModel.findByPk(userId);
  if (!user) throw new Error("User not found");
  return requireCapability(user, key, opts);
}
