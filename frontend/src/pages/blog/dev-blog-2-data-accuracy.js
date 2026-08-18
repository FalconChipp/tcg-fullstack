// src/pages/blog/dev-blog-2-data-accuracy.js
// -----------------------------------------------------------------------------
// Dev Blog #2 — Why I’m Focusing on Data Accuracy Instead of New Features
// Uses BlogPostLayout for the frame and JSX for the content.
// -----------------------------------------------------------------------------

"use client";

import React from "react";
import Layout from "@/components/Layout/Layout";
import BlogPostLayout from "@/components/Blog/BlogPostLayout";

export default function DevBlog2Page() {
  return (
    <Layout>
      <BlogPostLayout
        slug="dev-blog-2-data-accuracy"
        title="Dev Blog #2 — Why I’m Focusing on Data Accuracy Instead of New Features"
        subtitle="Collecting only works if you can trust the data. This post explains why I’m slowing down big launches to make sure the foundations are right."
        date="19 December 2025"
        readTime={7}
        tag="Dev Blog"
      >
        {/* INTRO ---------------------------------------------------------- */}
        <p>
          Collecting only works if you can trust the data.
        </p>

        <p>
          That&apos;s the thought that&apos;s been guiding a lot of my decisions
          lately.
        </p>

        <p>
          SixByFive TCG has grown a lot over the last year — binders, collections,
          pricing, sets, wishlists, a mobile app — and while it might look like the
          next step should be another big feature, I&apos;ve intentionally slowed
          that down.
        </p>

        <p>This post is about why.</p>

        {/* DATA SOURCES --------------------------------------------------- */}
        <h2>Where SixByFive&apos;s Card Data Comes From</h2>
        <p>
          Like most modern collecting tools, SixByFive doesn&apos;t invent card
          data from scratch.
        </p>

        <p>It relies on external APIs for things like:</p>
        <ul>
          <li>card names</li>
          <li>set membership</li>
          <li>numbering</li>
          <li>totals</li>
          <li>release groupings</li>
        </ul>

        <p>
          That&apos;s what makes it possible to support thousands of cards without
          manually entering everything.
        </p>

        <p>But there&apos;s an important detail that&apos;s easy to miss:</p>

        <p>
          <strong>External data is powerful — but it isn&apos;t always perfect.</strong>
        </p>

        <p>And for collectors, small inaccuracies can matter a lot.</p>

        {/* WHAT WRONG DATA LOOKS LIKE ------------------------------------- */}
        <h2>What “Wrong Data” Actually Looks Like</h2>
        <p>
          This isn&apos;t about massive failures — it&apos;s about subtle issues
          that slowly erode trust if left unchecked.
        </p>

        <p>Things like:</p>
        <ul>
          <li>a set appearing under the wrong era</li>
          <li>a card missing from a set</li>
          <li>totals being slightly off</li>
          <li>naming differences between sources</li>
          <li>promos blending into main sets</li>
          <li>pricing not lining up with expectations</li>
        </ul>

        <p>Individually, these might seem minor.</p>
        <p>But when you&apos;re tracking a collection — especially a large one — they add friction.</p>

        <p>As a collector, you start to ask:</p>

        <p>
          <em>&quot;Is this actually correct?&quot;</em>
        </p>

        <p>
          Once that question appears, everything else becomes harder to enjoy.
        </p>

        {/* WHY NOT SHIPPING BIG FEATURES ---------------------------------- */}
        <h2>Why I&apos;m Not Shipping Big New Features Right Now</h2>
        <p>
          It might seem counter-intuitive, but adding new features on top of shaky
          data doesn&apos;t help.
        </p>

        <p>
          Trading systems, social features, achievements, advanced analytics — all
          of those depend on clean, consistent card data underneath.
        </p>

        <p>If the foundation isn&apos;t solid:</p>
        <ul>
          <li>collections don&apos;t feel reliable</li>
          <li>prices feel questionable</li>
          <li>progress feels uncertain</li>
          <li>and fixes get harder later</li>
        </ul>

        <p>
          So instead of pushing something flashy out the door, I&apos;m doing the
          less exciting but more important work first.
        </p>

        {/* WHAT I'M FOCUSING ON ------------------------------------------- */}
        <h2>What I&apos;m Focusing on Instead</h2>
        <p>
          Right now, most of the effort is going into things you won&apos;t
          necessarily see immediately:
        </p>

        <ul>
          <li>validating incoming card and set data</li>
          <li>correcting known edge cases</li>
          <li>making sure sets live in the right eras</li>
          <li>improving how totals are calculated</li>
          <li>handling differences between data sources</li>
          <li>making overrides possible when external data is wrong</li>
          <li>ensuring historical data stays consistent over time</li>
        </ul>

        <p>
          This is slow, careful work — but it&apos;s the kind that pays off
          long-term.
        </p>

        {/* WHY THIS MATTERS ----------------------------------------------- */}
        <h2>Why This Matters for Collectors</h2>
        <p>For collectors, this means:</p>

        <ul>
          <li>your binders feel more trustworthy</li>
          <li>your progress feels accurate</li>
          <li>your wishlist makes sense</li>
          <li>prices feel more grounded</li>
          <li>future features won&apos;t break existing collections</li>
        </ul>

        <p>
          SixByFive isn&apos;t trying to be the loudest or fastest-moving app in
          the space.
        </p>

        <p>It&apos;s trying to be one you can rely on.</p>

        {/* SLOWER NOW, BETTER LATER -------------------------------------- */}
        <h2>⏳ Slower Now, Better Later</h2>
        <p>
          I know it can be frustrating to see fewer big announcements.
        </p>

        <p>
          But this phase is about earning trust, not chasing momentum.
        </p>

        <p>
          When new features do land, they&apos;ll be built on something solid —
          not rushed assumptions.
        </p>

        {/* THANK YOU ------------------------------------------------------ */}
        <h2>Thank You for the Patience</h2>
        <p>
          If you&apos;re using SixByFive right now — thank you.
        </p>
        <p>
          If you&apos;ve spotted issues or inconsistencies — thank you even more.
        </p>

        <p>
          This project is growing carefully, and that&apos;s intentional.
        </p>

        <p>More updates soon.</p>

        <p>
          <strong>– Ryan @ SixByFive</strong>
        </p>
      </BlogPostLayout>
    </Layout>
  );
}
