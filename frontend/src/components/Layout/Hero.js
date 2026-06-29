"use client";

import React, { useContext } from "react";
import { useRouter } from "next/router";
import { AuthContext } from "@/components/Auth/AuthProvider";


/*
  frontend/src/components/Layout/Hero.js

  Changed:
  - Removed carousel
  - Removed right-side mockup completely
  - Rebuilt as a clean full-width hero
  - Keeps dark-only styling
  - Keeps logged-in dashboard CTA
  - Keeps logged-out auth modal CTA
  - Keeps Search cards button behaviour
*/

function ArrowIcon({ className = "" }) {
  return (
    <svg
      className={className}
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M5 12h14"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M13 6l6 6-6 6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SearchIcon({ className = "" }) {
  return (
    <svg
      className={className}
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M10.8 18.1a7.3 7.3 0 1 1 0-14.6 7.3 7.3 0 0 1 0 14.6z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M16.2 16.2 21 21"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CheckIcon({ className = "" }) {
  return (
    <svg
      className={className}
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M5 12.5l4.2 4.2L19 7"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function FeatureItem({ children }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-vault-textTertiary">
      <CheckIcon className="text-vault-textTertiary" />
      {children}
    </span>
  );
}

export default function HeroSection() {
  const { user, openAuthModal } = useContext(AuthContext);
  const router = useRouter();

  function scrollToSearch() {
    if (typeof document !== "undefined") {
      const el = document.getElementById("card-search");

      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }
    }

    router.push("/search");
  }

  function handlePrimaryClick() {
    if (!user) {
      openAuthModal();
      return;
    }

    router.push("/dashboard");
  }

  return (
    <section className="relative isolate overflow-hidden bg-vault-bg px-5 sm:px-7">
      <div className="relative mx-auto flex max-w-7xl flex-col py-28 lg:py-36">
        <div className="max-w-3xl">
          <p className="mb-5 font-vault-body text-[11px] font-semibold uppercase tracking-[0.08em] text-vault-textTertiary">
            Built for Pokémon TCG collectors
          </p>

          <h1 className="max-w-2xl font-vault text-[44px] font-semibold leading-[1.1] tracking-tight text-vault-text sm:text-5xl lg:text-[56px]">
            Organise your Pokémon cards like a real collection.
          </h1>

          <p className="mt-5 max-w-xl text-[15px] leading-7 text-vault-textSecondary sm:text-base">
            Search cards, build digital binders, manage your wishlist, and keep
            your collection organised in one place.
          </p>

          <div className="mt-8 flex items-center gap-5">
            <button
              type="button"
              onClick={handlePrimaryClick}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-[10px] bg-vault-accent px-5 text-sm font-semibold text-vault-text transition-colors hover:bg-vault-accentHover"
            >
              {user ? "Open dashboard" : "Create free account"}
              <ArrowIcon />
            </button>

            <button
              type="button"
              onClick={scrollToSearch}
              className="inline-flex h-10 items-center gap-1.5 text-sm font-semibold text-vault-textSecondary transition-colors hover:text-vault-text"
            >
              <SearchIcon />
              Search cards
            </button>
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-vault-border pt-6">
            <FeatureItem>Card search</FeatureItem>
            <FeatureItem>Digital binders</FeatureItem>
            <FeatureItem>Wishlist</FeatureItem>
            <FeatureItem>Marketplace</FeatureItem>
          </div>
        </div>
      </div>
    </section>
  );
}