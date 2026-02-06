// backend/src/modules/safety/resolvers.js
//
// UPDATED (2026-02-06):
// - CHANGE: Treat "full" restriction as the safe default when DOB is missing/invalid (depends on capabilities.js).
// - CHANGE: Parent email is ONLY applicable for "teen" accounts (under-16). For "child"/"full"/"none", parent fields are cleared.
// - FIX: Only reset parent verification/token if the parent email actually CHANGES (prevents unnecessary re-verification).
// - FIX: requestParentVerification now only allows "teen" (under-16). Blocks "child", "full", and "none" explicitly.
// - CHANGE: adminSetUserRestriction now allows "full" as well (so admins can force hard restriction if needed).
// - KEEP: DOB remains locked once set (server-side enforced).

import { User } from "../../models/index.js";
import { requireAdmin } from "../messages/helpers.js"; // you already have this
import { computeCapabilities, computeRestrictionLevel } from "./capabilities.js";
import { sendParentVerificationEmail } from "./parentVerification.js";

async function requireUserFromContext(ctx) {
  if (!ctx?.user?.id) throw new Error("Not authenticated");
  const u = await User.findByPk(ctx.user.id);
  if (!u) throw new Error("User not found");
  return u;
}

function cleanEmail(v) {
  if (!v) return null;
  const s = String(v).trim().toLowerCase();
  return s || null;
}

function cleanDob(v) {
  if (!v) return null;
  const s = String(v).trim();
  // Expect YYYY-MM-DD from <input type="date">
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  return s;
}

// Central rule: when parent email is NOT applicable, fully clear all parent-link fields
function clearParentLink(user) {
  user.parent_email = null;
  user.parent_verified_at = null;
  user.parent_verify_token_hash = null;
  user.parent_verify_token_expires_at = null;
}

export default {
  User: {
    // ✅ expose camelCase fields on User
    dob: (user) => (user?.dob ? String(user.dob) : null),
    restrictionLevel: (user) => computeRestrictionLevel(user),
    parentEmail: (user) => (user?.parent_email ? String(user.parent_email) : null),
    parentVerifiedAt: (user) => (user?.parent_verified_at ? user.parent_verified_at.toISOString() : null),

    capabilities: (user) => computeCapabilities(user),
  },

  Mutation: {
    updateSafetyProfile: async (_, { dob, parentEmail }, ctx) => {
      try {
        const user = await requireUserFromContext(ctx);

        // =========================================================
        // DOB (LOCKED once set)
        // =========================================================
        if (dob !== undefined) {
          const hasDobAlready = !!user.dob;

          if (!hasDobAlready) {
            const normalized = cleanDob(dob);
            // allow null/empty => stays null (not set yet)
            user.dob = normalized || null;
          }
          // If DOB already exists, ignore any incoming value (locked).
        }

        // We re-check restriction after potential DOB change
        const restrictionLevel = computeRestrictionLevel(user);
        // Expected values (based on your capabilities.js): "full" | "child" | "teen" | "none"

        // =========================================================
        // Parent email
        // - ONLY allowed/kept for "teen" accounts (under-16)
        // - For "full"/"child"/"none": clear parent link entirely
        // =========================================================
        if (parentEmail !== undefined) {
          const nextParentEmail = cleanEmail(parentEmail);

          // If DOB is missing or user isn't teen, parent email is not applicable
          if (!user.dob || restrictionLevel !== "teen") {
            // ✅ CHANGED: fully clear parent link for non-teen or missing DOB
            clearParentLink(user);
          } else {
            // Teen: allow setting/updating parent email
            const current = cleanEmail(user.parent_email);

            user.parent_email = nextParentEmail;

            // ✅ FIX: only reset verification/tokens if the email actually CHANGED
            // (or if it was verified but email is now blank)
            const changed = current !== nextParentEmail;

            if (changed) {
              user.parent_verified_at = null;
              user.parent_verify_token_hash = null;
              user.parent_verify_token_expires_at = null;
            }
          }
        } else {
          // ✅ ADDED: Even if parentEmail isn't being updated, enforce clearing for non-teen states.
          // This prevents stale parent_email/verified_at lingering if user becomes "none" via admin override,
          // or if your restriction rules change.
          if (!user.dob || restrictionLevel !== "teen") {
            clearParentLink(user);
          }
        }

        await user.save();
        return { ok: true, user };
      } catch (e) {
        return { ok: false, error: e?.message || "update_failed", user: null };
      }
    },

    requestParentVerification: async (_, __, ctx) => {
      try {
        const user = await requireUserFromContext(ctx);

        // Must have DOB set (otherwise restriction should be "full")
        if (!user.dob) {
          return { ok: false, error: "dob_required", user };
        }

        const restrictionLevel = computeRestrictionLevel(user);

        // ✅ CHANGED: only teens (under-16) can do parent verification
        if (restrictionLevel === "none") {
          return { ok: false, error: "not_required_for_adults", user };
        }
        if (restrictionLevel === "child") {
          return { ok: false, error: "under_13_not_supported_for_verification", user };
        }
        if (restrictionLevel === "full") {
          // This generally means DOB missing/invalid, but keep explicit in case rules change
          return { ok: false, error: "dob_required", user };
        }
        if (restrictionLevel !== "teen") {
          return { ok: false, error: "not_eligible", user };
        }

        const parentEmail = cleanEmail(user.parent_email);
        if (!parentEmail) {
          return { ok: false, error: "parent_email_required", user };
        }

        // Already verified
        if (user.parent_verified_at) {
          return { ok: true, user };
        }

        const { tokenHash, expiresAt } = await sendParentVerificationEmail({
          parentEmail,
          userId: user.id,
          childUsername: user.username,
        });

        user.parent_verify_token_hash = tokenHash;
        user.parent_verify_token_expires_at = expiresAt;
        await user.save();

        return { ok: true, user };
      } catch (e) {
        return { ok: false, error: e?.message || "verification_request_failed", user: null };
      }
    },

    // =========================
    // Admin overrides
    // =========================
    adminSetUserRestriction: async (_, { userId, restrictionLevel }, ctx) => {
      try {
        requireAdmin(ctx.token);

        const user = await User.findByPk(userId);
        if (!user) return { ok: false, error: "user_not_found", user: null };

        // ✅ CHANGED: allow "full" too (hard restriction / unknown DOB state)
        const allowed = new Set(["full", "child", "teen", "none"]);
        const rl = String(restrictionLevel || "").toLowerCase();
        if (!allowed.has(rl)) return { ok: false, error: "invalid_restriction_level", user: null };

        user.restriction_level = rl;

        // ✅ ADDED: if admin forces non-teen state, clear parent link to avoid stale approvals
        if (rl !== "teen") {
          clearParentLink(user);
        }

        await user.save();
        return { ok: true, user };
      } catch (e) {
        return { ok: false, error: e?.message || "admin_set_failed", user: null };
      }
    },

    adminSetParentVerified: async (_, { userId, verified }, ctx) => {
      try {
        requireAdmin(ctx.token);

        const user = await User.findByPk(userId);
        if (!user) return { ok: false, error: "user_not_found", user: null };

        // Only meaningful for teen accounts with DOB + parent_email
        const restrictionLevel = computeRestrictionLevel(user);

        if (verified) {
          if (!user.dob) return { ok: false, error: "dob_required", user: null };
          if (restrictionLevel !== "teen") return { ok: false, error: "not_eligible", user: null };
          if (!cleanEmail(user.parent_email)) return { ok: false, error: "parent_email_required", user: null };

          user.parent_verified_at = new Date();
          user.parent_verify_token_hash = null;
          user.parent_verify_token_expires_at = null;
        } else {
          user.parent_verified_at = null;
        }

        await user.save();
        return { ok: true, user };
      } catch (e) {
        return { ok: false, error: e?.message || "admin_set_failed", user: null };
      }
    },

    adminClearParentLink: async (_, { userId }, ctx) => {
      try {
        requireAdmin(ctx.token);

        const user = await User.findByPk(userId);
        if (!user) return { ok: false, error: "user_not_found", user: null };

        clearParentLink(user);
        await user.save();

        return { ok: true, user };
      } catch (e) {
        return { ok: false, error: e?.message || "admin_clear_failed", user: null };
      }
    },
  },
};
