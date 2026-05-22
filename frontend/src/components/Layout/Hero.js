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

function FeaturePill({ children }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-dark-border bg-dark-surface/80 px-3 py-1.5 text-xs font-bold text-dark-textMuted shadow-sm shadow-black/20">
      <CheckIcon className="text-dark-accentLight" />
      {children}
    </span>
  );
}

function FlowStep({ number, title, text }) {
  return (
    <div className="rounded-3xl border border-dark-border bg-dark-surface/70 p-5 shadow-lg shadow-black/10 backdrop-blur">
      <div className="mb-4 flex h-9 w-9 items-center justify-center rounded-2xl bg-dark-accent/15 text-sm font-black text-dark-accentLight">
        {number}
      </div>

      <h3 className="text-sm font-black text-dark-strong">{title}</h3>

      <p className="mt-2 text-sm leading-6 text-dark-textMuted">{text}</p>
    </div>
  );
}

export default function HeroSection({ onOpenAuthModal }) {
  const { user } = useContext(AuthContext);
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
      onOpenAuthModal?.();
      return;
    }

    router.push("/dashboard");
  }

  return (
    <section className="relative isolate overflow-hidden bg-dark-background">
      {/* Background */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-[-160px] h-[620px] w-[620px] -translate-x-1/2 rounded-full bg-dark-accent/12 blur-3xl" />
        <div className="absolute bottom-[-260px] left-[-180px] h-[520px] w-[520px] rounded-full bg-cyan-500/8 blur-3xl" />
        <div className="absolute bottom-[-260px] right-[-180px] h-[520px] w-[520px] rounded-full bg-purple-500/10 blur-3xl" />

        <div
          className="absolute inset-0 opacity-[0.045]"
          style={{
            backgroundImage:
              "linear-gradient(to right, rgba(255,255,255,0.22) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.22) 1px, transparent 1px)",
            backgroundSize: "56px 56px",
          }}
        />

        <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-dark-background to-transparent" />
      </div>

      <div className="relative mx-auto flex min-h-[calc(100vh-5rem)] max-w-7xl flex-col justify-center px-5 py-20 sm:px-7 lg:py-24">
        {/* Main hero content */}
        <div className="max-w-4xl">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-dark-border bg-dark-surface/80 px-3 py-1.5 text-xs font-bold text-dark-textMuted shadow-lg shadow-black/20">
            <span className="h-2 w-2 rounded-full bg-dark-accentLight" />
            Built for Pokémon TCG collectors
          </div>

          <h1 className="max-w-4xl text-4xl font-black tracking-tight text-dark-strong sm:text-5xl lg:text-7xl">
            Organise your Pokémon cards like a real collection.
          </h1>

          <p className="mt-6 max-w-2xl text-base leading-8 text-dark-textMuted sm:text-lg">
            Search cards, build digital binders, manage your wishlist, and keep
            your collection organised in one place.
          </p>

          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={handlePrimaryClick}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-dark-accent px-6 text-sm font-black text-white shadow-xl shadow-dark-accent/20 transition hover:bg-dark-accentLight"
            >
              {user ? "Open dashboard" : "Start free"}
              <ArrowIcon />
            </button>

            <button
              type="button"
              onClick={scrollToSearch}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-dark-border bg-dark-surface px-6 text-sm font-black text-dark-strong transition hover:border-dark-accent hover:bg-dark-alt"
            >
              <SearchIcon />
              Search cards
            </button>
          </div>

          <div className="mt-7 flex flex-wrap gap-2">
            <FeaturePill>Card search</FeaturePill>
            <FeaturePill>Digital binders</FeaturePill>
            <FeaturePill>Wishlist</FeaturePill>
            <FeaturePill>Marketplace</FeaturePill>
          </div>
        </div>

        {/* Simple product flow instead of mockup */}
        <div className="mt-14 grid max-w-5xl grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <FlowStep
            number="1"
            title="Search cards"
            text="Find cards by name, set, number, or expansion."
          />

          <FlowStep
            number="2"
            title="Add to collection"
            text="Track what you own, want, and plan to collect next."
          />

          <FlowStep
            number="3"
            title="Build binders"
            text="Organise cards visually around real collecting goals."
          />

          <FlowStep
            number="4"
            title="Browse listings"
            text="Find cards listed by other collectors when ready."
          />
        </div>
      </div>
    </section>
  );
}