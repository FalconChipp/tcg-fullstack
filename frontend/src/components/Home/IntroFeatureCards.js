// src/components/Home/IntroFeatureCards.js
"use client";
import React from "react";

export default function IntroFeatureCards({ className = "" }) {
  return (
    <section className={`mx-auto max-w-6xl px-4 py-16 ${className}`}>
      {/* Heading */}
      <div className="text-center mb-12">
        <h2 className="text-3xl md:text-4xl font-bold text-light-primary dark:text-dark-primary">
          Everything you need to collect smarter.
        </h2>
        <p className="mt-3 text-lg text-light-textSecondary dark:text-dark-textSecondary max-w-2xl mx-auto">
          From fast search to beautiful binders — your whole Pokémon collection
          lives here, always in sync and always up to date.
        </p>
      </div>

      {/* Feature Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* FEATURE 1 — Collection Manager */}
        <div
          className="
            bg-light-surface dark:bg-dark-surface
            border border-light-border dark:border-dark-border
            rounded-2xl p-6 shadow-sm hover:shadow-md transition
          "
        >
          <div className="flex items-center justify-center h-12 w-12 rounded-full bg-light-accent/10 dark:bg-dark-accent/20 mx-auto mb-4">
            <span className="text-2xl" aria-hidden="true">
              🗃️
            </span>
          </div>
          <h3 className="font-semibold text-lg text-light-foreground dark:text-dark-foreground">
            Collection Manager
          </h3>
          <p className="mt-2 text-sm text-light-text dark:text-dark-text">
            Add cards in seconds and track your duplicates, sets, and total
            collection value in one place.
          </p>
        </div>

        {/* FEATURE 2 — Fast Search */}
        <div
          className="
            bg-light-surface dark:bg-dark-surface
            border border-light-border dark:border-dark-border
            rounded-2xl p-6 shadow-sm hover:shadow-md transition
          "
        >
          <div className="flex items-center justify-center h-12 w-12 rounded-full bg-light-accent/10 dark:bg-dark-accent/20 mx-auto mb-4">
            <span className="text-2xl" aria-hidden="true">
              🔍
            </span>
          </div>
          <h3 className="font-semibold text-lg text-light-foreground dark:text-dark-foreground">
            Fast, powerful search
          </h3>
          <p className="mt-2 text-sm text-light-text dark:text-dark-text">
            Find any English Pokémon card instantly by name, set code, or
            number, then add it straight to your collection.
          </p>
        </div>

        {/* FEATURE 3 — Digital Binders */}
        <div
          className="
            bg-light-surface dark:bg-dark-surface
            border border-light-border dark:border-dark-border
            rounded-2xl p-6 shadow-sm hover:shadow-md transition
          "
        >
          <div className="flex items-center justify-center h-12 w-12 rounded-full bg-light-accent/10 dark:bg-dark-accent/20 mx-auto mb-4">
            <span className="text-2xl" aria-hidden="true">
              📒
            </span>
          </div>
          <h3 className="font-semibold text-lg text-light-foreground dark:text-dark-foreground">
            Digital binders
          </h3>
          <p className="mt-2 text-sm text-light-text dark:text-dark-text">
            Build beautiful, custom binders for any set, theme, or showcase and
            share them with friends.
          </p>
        </div>

        {/* FEATURE 4 — Wishlist */}
        <div
          className="
            bg-light-surface dark:bg-dark-surface
            border border-light-border dark:border-dark-border
            rounded-2xl p-6 shadow-sm hover:shadow-md transition
          "
        >
          <div className="flex items-center justify-center h-12 w-12 rounded-full bg-light-accent/10 dark:bg-dark-accent/20 mx-auto mb-4">
            <span className="text-2xl" aria-hidden="true">
              ⭐
            </span>
          </div>
          <h3 className="font-semibold text-lg text-light-foreground dark:text-dark-foreground">
            Wishlist & wantlist
          </h3>
          <p className="mt-2 text-sm text-light-text dark:text-dark-text">
            Track your chase cards and never lose sight of the next pickup you
            want to add to your collection.
          </p>
        </div>
      </div>
    </section>
  );
}
