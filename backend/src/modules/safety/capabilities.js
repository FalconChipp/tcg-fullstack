// src/modules/safety/capabilities.js

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
  if (user?.restriction_level) return user.restriction_level;

  // Otherwise compute from DOB.
  const age = computeAge(user?.dob);

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

  const canMessage = !isFull && isAdult ? true : !isFull && isTeen && parentVerified;
  const canTrade = !isFull && isAdult ? true : !isFull && isTeen && parentVerified;
  const canPost = !isFull && isAdult ? true : !isFull && isTeen && parentVerified;

  const canConnectDiscord = !isFull && (isAdult || (isTeen && parentVerified));
  const canShareToDiscord = !isFull && (isAdult || (isTeen && parentVerified));

  return {
    restrictionLevel,

    isMinor: isFull ? true : !isAdult,

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
