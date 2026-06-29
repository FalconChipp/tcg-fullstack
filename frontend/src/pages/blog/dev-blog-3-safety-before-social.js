// src/pages/blog/dev-blog-3-safety-before-social.js
// -----------------------------------------------------------------------------
// Dev Blog #3 — Safety Before Social: Preparing SixByFive for Community Features
// Uses BlogPostLayout for the frame and JSX for the content.
// -----------------------------------------------------------------------------
//
// UPDATED (2026-01-30):
// - EXPANDED: More detail on what “social” will actually look like
// - ADDED: Concrete examples (feed posts, sharing, profiles, Discord linking)
// - ADDED: Specific safety systems (age gating, guardian email, reporting, rate limits)
// - ADDED: Rollout approach (phased release + defaults)
// - ADDED: What users can expect + how to help
//
// CLEANUP (2026-01-30):
// - FIX: Removed HTML <b> inside string (would not render as intended)
// - TWEAK: Reworded “trust” paragraph for smoother tone + clarity
// - FIX: Normalized indentation
//

"use client";

import React from "react";
import Layout from "@/components/Layout/Layout";
import BlogPostLayout from "@/components/Blog/BlogPostLayout";

export default function DevBlog3Page() {
  return (
    <Layout>
      <BlogPostLayout
        slug="dev-blog-3-safety-before-social"
        title="Dev Blog #3 — Safety Before Social: Preparing SixByFive for Community Features"
        subtitle="Social updates, sharing, and community tools are coming — but first SixByFive needs the safety rails that make those features safe for everyone."
        date="31 January 2026"
        readTime={10}
        tag="Dev Blog"
      >
        {/* INTRO ---------------------------------------------------------- */}
        <p>SixByFive is gearing up for a big shift.</p>

        <p>
          Over the last year it&apos;s grown into a proper collecting platform —
          binders, collections, wishlists, pricing, sets, and the mobile app.
        </p>

        <p>The next step is making it feel more alive.</p>

        <p>
          Not just “a place you manage your cards”, but a place you can share
          progress, celebrate milestones, and connect with the community (in a
          way that still keeps collecting at the centre).
        </p>

        <p>That means social updates, sharing, and community features.</p>

        <p>
          But before any of that ships publicly, there&apos;s one non-negotiable
          step:
        </p>

        <p>
          <strong>We need to implement safety features first.</strong>
        </p>

        {/* WHY SAFETY COMES FIRST ---------------------------------------- */}
        <h2>Why Safety Has to Come Before Social</h2>

        <p>
          SixByFive is used by adults, teenagers, parents, casual fans, and kids
          who are discovering Pokémon for the first time.
        </p>

        <p>As soon as you add social surface area, you take on responsibility.</p>

        <p>Even the “simple” stuff creates real questions:</p>

        <ul>
          <li>Who can message who?</li>
          <li>Who can comment or interact?</li>
          <li>What data is visible on profiles by default?</li>
          <li>How do we prevent spam, harassment, or grooming risks?</li>
          <li>How do we handle under-13 users responsibly?</li>
          <li>How do we enforce rules consistently?</li>
        </ul>

        <p>These aren&apos;t things you bolt on after launch.</p>

        <p>
          They shape the product from the inside out — permissions, defaults,
          moderation tooling, audit logs, and what gets shown to who.
        </p>

        {/* WHAT “SOCIAL” MEANS ------------------------------------------- */}
        <h2>What “Social” Means for SixByFive</h2>

        <p>I&apos;m not trying to turn SixByFive into “another social network”.</p>

        <p>
          The goal is a collecting-first platform where sharing is optional and
          controlled.
        </p>

        <p>Here&apos;s the kind of social content I mean:</p>

        <ul>
          <li>
            <strong>Milestones:</strong> “Completed Jungle”, “Hit 1,000 cards”,
            “First PSA slab added”
          </li>
          <li>
            <strong>Collection updates:</strong> “Added 12 cards today”, “New
            binder page filled”
          </li>
          <li>
            <strong>Wishlist activity:</strong> “Actively hunting: Charizard ex”
          </li>
          <li>
            <strong>Share links:</strong> share a binder page or wishlist view
            externally
          </li>
          <li>
            <strong>Optional profiles:</strong> choose what other collectors can
            see (or keep everything private)
          </li>
        </ul>

        <p>
          It&apos;s about celebrating progress — not turning your collection into
          public data by default.
        </p>

        {/* WHERE RISK APPEARS -------------------------------------------- */}
        <h2>Where Things Get Risky (Even If Intentions Are Good)</h2>

        <p>Social features create “contact points”.</p>

        <p>
          Contact points are where bad behaviour happens — even on niche hobby
          platforms.
        </p>

        <p>And the biggest risk isn&apos;t always the obvious stuff.</p>

        <p>It can be subtle:</p>

        <ul>
          <li>spam and scams in messages</li>
          <li>people repeatedly contacting younger users</li>
          <li>harassment through comments / reactions</li>
          <li>users sharing personal details without thinking</li>
          <li>Discord linking being used as a “backdoor” contact method</li>
          <li>abuse via mass sharing or automated behaviour</li>
        </ul>

        <p>
          If you don&apos;t design for these scenarios, you end up reacting to
          them later — and that&apos;s the worst time to build safety systems.
        </p>

        {/* WHAT'S BEING BUILT NOW ---------------------------------------- */}
        <h2>What I&apos;m Implementing Before Social Launch</h2>

        <p>
          This is the foundation work happening right now — the stuff that makes
          it possible to ship social features responsibly.
        </p>

        <ul>
          <li>
            <strong>Age-aware accounts:</strong> accounts have age flags so
            features can be enabled/disabled safely
          </li>
          <li>
            <strong>Under-13 handling:</strong> restricted experiences where
            needed (and no “open contact” features)
          </li>
          <li>
            <strong>Guardian/parent email:</strong> for younger users, adding a
            safeguard around account actions and contact surfaces
          </li>
          <li>
            <strong>Blocking + muting:</strong> control who can interact with you
          </li>
          <li>
            <strong>Reporting flows:</strong> report users/content quickly, with
            proper metadata for review
          </li>
          <li>
            <strong>Moderation tooling:</strong> internal tools to review, action,
            and enforce rules consistently
          </li>
          <li>
            <strong>Rate limits + abuse protection:</strong> prevent spam,
            brute-force behaviour, and automated misuse
          </li>
          <li>
            <strong>Permissions + defaults:</strong> “safe by default” settings
            for profiles, sharing, and messaging
          </li>
          <li>
            <strong>Audit logs:</strong> so moderation actions are trackable and
            defensible
          </li>
        </ul>

        <p>It&apos;s not glamorous work.</p>

        {/* ✅ CHANGED: cleaned up your added paragraph */}
        <p>
          But it&apos;s what turns “cool social features” into “cool social
          features that won&apos;t backfire”.
        </p>

        {/* ✅ ADDED/CHANGED: smoother trust tie-in + consistent formatting */}
        <p>
          Trust is the whole point — and it&apos;s also why bigger systems like
          marketplace and trading have taken longer. I&apos;d rather take extra
          time and get it right than rush something people can&apos;t rely on.
        </p>

        {/* DISCORD + SHARING --------------------------------------------- */}
        <h2>Discord Linking and Sharing Need Extra Care</h2>

        <p>Discord is a huge part of the Pokémon community.</p>

        <p>
          And SixByFive already has Discord-connected features in the pipeline
          (sharing, account linking, role syncing, community perks).
        </p>

        <p>
          But Discord integration can also become a direct contact channel — so
          it needs stricter rules than normal features.
        </p>

        <p>
          That means age-aware gating, permission checks, and strong controls
          around what gets shared and who can initiate contact.
        </p>

        {/* ROLLOUT PLAN --------------------------------------------------- */}
        <h2>How This Will Roll Out</h2>

        <p>
          When social features start landing, it won&apos;t be one giant switch.
        </p>

        <p>It will be phased, with privacy-first defaults:</p>

        <ul>
          <li>
            <strong>Phase 1:</strong> safety systems + account controls fully live. You’ll
            be asked to add your date of birth so we can apply the correct safety settings.
            Accounts without this info will default to a restricted experience.
          </li>
          <li>
            <strong>Phase 2:</strong> simple sharing features, basic messaging, and
            notifications
          </li>
          <li>
            <strong>Phase 3:</strong> groundwork for marketplace and trading features
          </li>
        </ul>

        <p>The goal is that social features launch with trust, not chaos.</p>

        {/* WHY THIS MATTERS ---------------------------------------------- */}
        <h2>What This Means for You</h2>

        <p>
          If you&apos;re using SixByFive right now, this work matters because it
          protects:
        </p>

        <ul>
          <li>your privacy</li>
          <li>younger collectors</li>
          <li>the quality of the community</li>
          <li>the platform&apos;s long-term future</li>
        </ul>

        <p>
          It also means that when social features arrive, they won&apos;t feel
          like a risky experiment.
        </p>

        <p>They&apos;ll feel like a natural extension of something stable.</p>

        {/* HOW USERS CAN HELP -------------------------------------------- */}
        <h2>How You Can Help During This Phase</h2>

        <p>
          If you spot anything that feels off — weird behaviour, edge cases,
          privacy concerns — message me about it.
        </p>

        <p>The best time to fix safety holes is before the spotlight is on.</p>

        {/* CLOSING -------------------------------------------------------- */}
        <h2>Thank You for Sticking With It</h2>

        <p>I&apos;m genuinely excited about what comes next.</p>

        <p>
          Big features are coming — social updates, sharing, community tools —
          but we&apos;re laying the safety rails first so they can launch the right
          way.
        </p>

        <p>More updates soon.</p>

        <p>
          <strong>– Ryan @ SixByFive</strong>
        </p>
      </BlogPostLayout>
    </Layout>
  );
}
