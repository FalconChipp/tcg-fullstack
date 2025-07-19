// src/data/achievements.js

const ACHIEVEMENTS = [
  {
    code: "pre_signup",
    name: "Pre-launch Sign-up",
    description: "Signed up for SixByFive TCG before the official launch.",
    tier: "gold",
    iconUrl: "/achievements/day_1.png",
    points: 100,
    isHidden: false,
    isActive: true,
    criteria: { signupBefore: "2025-07-25" },
  },
];

export default ACHIEVEMENTS;
