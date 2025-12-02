// src/pages/blog/dev-blog-1-11-months-of-building.js
// -----------------------------------------------------------------------------
// Dev Blog #1 — 11 months of building SixByFive TCG
// Uses BlogPostLayout for the frame and JSX for the content.
// -----------------------------------------------------------------------------

"use client";

import React from "react";
import Layout from "@/components/Layout/Layout";
import BlogPostLayout from "@/components/Blog/BlogPostLayout";

export default function DevBlog1Page() {
  return (
    <Layout>
      <BlogPostLayout
        title="SixByFive TCG – 11 Months of Building"
        subtitle="A behind-the-scenes look at how the platform has grown, what’s been hard, and where it’s heading next."
        date="2 December 2025"
        readTime={8}
        tag="Dev Blog"
      >
        {/* INTRO ---------------------------------------------------------- */}
        <p>
          Hey everyone — welcome to the first official <strong>SixByFive TCG</strong>{" "}
          dev blog. This is something I&apos;ve wanted to start for a while. After
          nearly a year of building SixByFive TCG almost entriely on my own, it felt like
          the right time to zoom out and share what&apos;s actually been happening
          behind the scenes.
        </p>

        <p>
          My aim with this series is simple: document the journey honestly. That
          means the wins, the mistakes, the motivation highs and lows, and the
          decisions that shape where the platform goes next.
        </p>

        {/* WHY I STARTED -------------------------------------------------- */}
        <h2>Why I Started SixByFive TCG</h2>
        <p>
          Like most people building tools for collectors, I started as a collector
          who was slightly frustrated. I wanted:
        </p>
        <ul>
          <li>A digital way to track my Pokémon cards and binders.</li>
          <li>Pricing that wasn&apos;t a complete mystery.</li>
          <li>Something that felt modern, fast, and nice to use.</li>
        </ul>
        <p>
          There are great tools out there, but none of them felt like{" "}
          <em>exactly</em> what I wanted. So I did the thing developers do: I
          started building my own.
        </p>

        {/* WHAT'S BEEN BUILT --------------------------------------------- */}
        <h2>What I’ve Built So Far</h2>
        <p>
          Over the last 11 months, SixByFive TCG has grown from a rough prototype
          into a proper ecosystem. Under the hood there&apos;s a lot going on:
        </p>

        <h3>Core Features</h3>
        <ul>
          <li>Pokémon card search powered by a custom backend and GraphQL.</li>
          <li>Binder &amp; collection management with multiple binders per user.</li>
          <li>Wishlist &amp; set tracking so you can see what&apos;s missing.</li>
          <li>Pricing engine with daily observations and rollups.</li>
          <li>Foundations for a marketplace for physical products and cards.</li>
          <li>Mobile app on Google Play so you can use it away from the desk.</li>
          <li>Discord integration and admin tooling for managing data.</li>
        </ul>

        <h3>Infrastructure & Plumbing</h3>
        <ul>
          <li>Custom Node/Express + Apollo GraphQL backend.</li>
          <li>Scheduled jobs for price updates and data ingestion.</li>
          <li>
            Admin dashboards for sets, pricing, users, and marketplace listings.
          </li>
          <li>Dark mode + a full redesign using a proper design system.</li>
        </ul>

        <p>
          Most of this is invisible from the outside. You see a search bar, a
          binder grid, a price, a button. Behind each of those are a bunch of
          small decisions, tradeoffs, and systems that have gradually become more
          stable over time.
        </p>

        {/* MINI TIMELINE -------------------------------------------------- */}
        <h2>A Quick Timeline of the Last 11 Months</h2>
        <ul>
          <li>
            <strong>Month 1–2:</strong> First backend prototype, basic card search,
            and the very first binder implementation.
          </li>
          <li>
            <strong>Month 3–4:</strong> Proper auth, user accounts, and early
            collection features.
          </li>
          <li>
            <strong>Month 5–6:</strong> Pricing engine v1 and the start of the
            mobile app.
          </li>
          <li>
            <strong>Month 7–8:</strong> Refining binders, adding wishlist and
            better set support.
          </li>
          <li>
            <strong>Month 9–10:</strong> Marketplace foundations, listing models,
            admin tools, and product listings.
          </li>
          <li>
            <strong>Month 11:</strong> Focus on polish, UX tweaks, and now —
            starting this dev blog.
          </li>
        </ul>

        {/* MOTIVATION / HONEST SECTION ----------------------------------- */}
        <h2>Being Honest About Motivation</h2>
        <div className="border-l-4 border-light-accent dark:border-dark-accent bg-light-alt/60 dark:bg-dark-alt/60 px-4 py-3 rounded-lg">
          <p className="m-0 text-sm sm:text-base">
            There&apos;s no point pretending it&apos;s been smooth. Some days I feel
            unstoppable; other days I wonder if anyone will ever use what I&apos;m
            building. Low downloads, a small user base, and the sheer amount of
            work can make it easy to forget how far the project has already come.
          </p>
        </div>

        <p>
          When you&apos;re deep in code, it&apos;s easy to only see what&apos;s
          missing. Another feature to ship. Another bug to fix. Another edge case
          to patch. And if you aren&apos;t seeing big user numbers yet, your brain
          quietly starts asking: <em>&quot;Is this worth it?&quot;</em>
        </p>

        <p>
          Part of why this dev blog exists is to push back against that — to
          actually <strong>document progress</strong> and share the journey instead
          of just silently grinding through it. Even if the audience is small
          right now, it&apos;s still worth telling the story.
        </p>

        {/* WHAT'S NEXT ---------------------------------------------------- */}
        <h2>What’s Next for SixByFive TCG</h2>
        <p>
          Now that the product marketplace foundations are in place, the plan
          isn&apos;t to immediately jump into another massive feature. Instead, I
          want to focus on three main themes:
        </p>

        <h3>1. Polish What Already Exists</h3>
        <ul>
          <li>Make binder flows smoother and faster.</li>
          <li>Improve card detail pages with clearer pricing and metadata.</li>
          <li>Reduce friction in common actions like adding cards and sets.</li>
        </ul>

        <h3>2. Make Onboarding Less Intimidating</h3>
        <ul>
          <li>Simpler first-run experience: create binder → add first card.</li>
          <li>Better empty states that explain what you can do.</li>
          <li>
            Gentle nudges and tips rather than dumping the whole feature set on
            day one.
          </li>
        </ul>

        <h3>3. Share the Journey More</h3>
        <ul>
          <li>Regular dev blogs like this.</li>
          <li>Short-form content on TikTok showing features in action.</li>
          <li>
            More updates in Discord and wherever collectors are actually hanging
            out.
          </li>
        </ul>

        {/* HOW YOU CAN HELP ---------------------------------------------- */}
        <h2>How You Can Help</h2>
        <p>
          If you&apos;re reading this, you&apos;re already supporting the project by
          giving it your time and attention — and that genuinely matters. If you
          want to go a step further, a few things help more than you might think:
        </p>
        <ul>
          <li>
            <strong>
              <a
                href="https://play.google.com/store/apps/details?id=com.sixbyfive.sbftcgmobile"
                target="_blank"
                rel="noopener noreferrer"
                className="text-light-accent dark:text-dark-accent hover:underline"
              >
                Download the app
              </a>
            </strong>{" "}
            on Google Play and try it with your own collection.
          </li>

          <li>
            <strong>Tell another collector</strong> who might find it useful.
          </li>

          <li>
            <strong>
              <a
                href="https://discord.gg/PRMbMbRE2H"
                target="_blank"
                rel="noopener noreferrer"
                className="text-light-accent dark:text-dark-accent hover:underline"
              >
                Join the Discord
              </a>
            </strong>{" "}
            and share feedback, ideas, and wishes.
          </li>

          <li>
            <strong>Send honest feedback</strong> — good, bad, detailed, or simple.
            It all helps shape what I build next.
          </li>
        </ul>

        {/* CLOSING -------------------------------------------------------- */}
        <h2>Thank You</h2>
        <p>
          This first dev blog marks a bit of a reset — not for the project, but
          for how I think about it. Less silent grinding, more sharing, more
          connection with the people this is actually for.
        </p>

        <p>
          If you&apos;re curious about where this goes next, stick around. I&apos;ll
          be sharing more updates, more technical breakdowns, and more honest
          thoughts as SixByFive TCG continues to grow.
        </p>

        <p>
          <strong>More updates soon. – Ryan @ SixByFive</strong>
        </p>
        {/* CONTENT ENDS HERE */}
      </BlogPostLayout>
    </Layout>
  );
}
