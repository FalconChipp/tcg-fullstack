// src/modules/safety/capabilities.js
//
// UPDATED (2026-02-06):
// - KEEP: If no DOB (or invalid) => restrictionLevel "full" (safe default).
// - KEEP: Unrestricted threshold is 16+ (teen < 16).
// - KEEP: "full" blocks ALL community/interactive features.
// - KEEP: "child" (<13) blocks community/interactive features (even if parent verified).
// - FIX: requiresParentApproval is now TRUE for "full" as well (because the next action is: set DOB).
//        (This is optional, but it makes the UI/logic consistent: "you need to do something to unlock".)
// - ADD: Small server-side guard helpers (requireCanMessage/Trade/Post/Discord) so you can ENFORCE
//        restrictions in resolvers (not just compute them).
//
// NOTE:
// - Computing capabilities does NOT enforce anything by itself.
// - You must call the guard helpers in message/trade/post/discord resolvers to actually restrict actions.

function computeAge(dob) {
  if (!dob) return null;

  const birth = new Date(dob);
  if (Number.isNaN(birth.getTime())) return null;

  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();

  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;

  return age;
}

function computeRestrictionLevel(user) {
  // If you manually set it, trust it.
  // NOTE: This is DB snake_case. That's fine here (backend model field).
  if (user?.restriction_level) return user.restriction_level;

  // Otherwise compute from DOB.
  const age = computeAge(user?.dob);

  // ✅ Safe fallback: unknown DOB => full restriction
  if (age == null) return "full";

  if (age < 13) return "child";
  if (age < 16) return "teen";
  return "none";
}

function computeCapabilities(user) {
  const restrictionLevel = computeRestrictionLevel(user);
  const parentVerified = Boolean(user?.parent_verified_at);

  const isFull = restrictionLevel === "full";
  const isChild = restrictionLevel === "child";
  const isTeen = restrictionLevel === "teen";
  const isAdult = restrictionLevel === "none";

  // Core permissions (collection/binder is always ok)
  const canUseCollection = true;

  // ✅ Full restriction blocks all interactive/community features
  // ✅ Child blocks all interactive/community features
  // ✅ Teen unlocks ONLY with parent verification
  const canMessage = !isFull && isAdult ? true : !isFull && isTeen && parentVerified;
  const canTrade = !isFull && isAdult ? true : !isFull && isTeen && parentVerified;
  const canPost = !isFull && isAdult ? true : !isFull && isTeen && parentVerified;

  // Discord is treated as outbound identity/linking
  // ✅ NEVER for child, NEVER for full
  const canConnectDiscord = !isFull && (isAdult || (isTeen && parentVerified));
  const canShareToDiscord = !isFull && (isAdult || (isTeen && parentVerified));

  return {
    restrictionLevel,

    // ✅ Full is treated as minor/locked state for safety
    isMinor: isFull ? true : !isAdult,

    // ✅ CHANGED: if "full", we consider it requiring an approval step (DOB) to unlock features.
    // (If you *only* want this to mean "parent approval", you can revert to: isTeen && !parentVerified)
    requiresParentApproval: isFull ? true : isTeen && !parentVerified,

    canUseCollection,

    canMessage,
    canTrade,
    canPost,

    // ✅ KEEP: hard-block for child
    canConnectDiscord: isChild ? false : canConnectDiscord,
    canShareToDiscord: isChild ? false : canShareToDiscord,
  };
}

/* =========================================================
   ✅ ENFORCEMENT HELPERS (use inside resolvers)
   These are the missing piece if you're asking:
   "Have we restricted messaging?"
   -> Only if your message send/query resolvers call these.
========================================================= */

function assertCapability(user, key, message) {
  const caps = computeCapabilities(user);
  if (!caps?.[key]) {
    const err = new Error(message || "Action not allowed for this account.");
    err.code = "CAPABILITY_DENIED";
    err.capability = key;
    err.restrictionLevel = caps?.restrictionLevel || "unknown";
    throw err;
  }
  return caps;
}

function requireCanMessage(user) {
  return assertCapability(
    user,
    "canMessage",
    "Messaging is restricted for this account. Add DOB and/or complete parent verification to unlock."
  );
}

function requireCanTrade(user) {
  return assertCapability(
    user,
    "canTrade",
    "Trading is restricted for this account. Add DOB and/or complete parent verification to unlock."
  );
}

function requireCanPost(user) {
  return assertCapability(
    user,
    "canPost",
    "Posting is restricted for this account. Add DOB and/or complete parent verification to unlock."
  );
}

function requireCanConnectDiscord(user) {
  return assertCapability(
    user,
    "canConnectDiscord",
    "Discord linking is restricted for this account. Add DOB and/or complete parent verification to unlock."
  );
}

function requireCanShareToDiscord(user) {
  return assertCapability(
    user,
    "canShareToDiscord",
    "Discord sharing is restricted for this account. Add DOB and/or complete parent verification to unlock."
  );
}

export {
  computeAge,
  computeRestrictionLevel,
  computeCapabilities,

  // guards (import these into message/trade resolvers)
  assertCapability,
  requireCanMessage,
  requireCanTrade,
  requireCanPost,
  requireCanConnectDiscord,
  requireCanShareToDiscord,
};
