// src/data/achievementCriteria.js

/**
 * Returns true if the user signed up before the given date.
 * @param {object} context - { user, params }
 * @returns {boolean}
 */
export function signupBefore({ user, params }) {
  if (!user?.createdAt || !params?.date) return false;
  return new Date(user.createdAt) < new Date(params.date);
}

// Add more criteria functions as needed, always (context) => bool
