// src/components/Home/OnboardingQuickStart.js
"use client";
import React from "react";
import HowItWorks from "@/components/Layout/HowItWorks";

// NEW: expose defaults so other pages can reuse/override consistently
export const DEFAULT_STEPS = [
  {
    // CHANGED: Title Case to match your existing headings
    title: "Create Your Account",
    // CHANGED: concise, acquisition-friendly copy
    description: "Sign up in seconds — it’s free to start.",
  },
  {
    title: "Add Your First 5 Cards", // CHANGED: Title Case
    description:
      "Search by name or set & number (e.g., SVI 210) to kick-start your collection.", // CHANGED: includes example, UK tone
  },
  {
    title: "Create a Binder", // CHANGED: Title Case
    description:
      "Pick a layout, set a theme, and share your first page.", // (kept concise)
  },
];

export default function OnboardingQuickStart({
  steps = DEFAULT_STEPS, // NEW: allow overrides while keeping sane defaults
}) {
  return <HowItWorks steps={steps} />;
}
