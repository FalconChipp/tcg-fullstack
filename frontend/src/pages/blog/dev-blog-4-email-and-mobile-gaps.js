// src/pages/blog/dev-blog-4-email-and-mobile-gaps.js
// -----------------------------------------------------------------------------
// Dev Blog #4 — Here's What We've Been Building
// -----------------------------------------------------------------------------

"use client";

import React from "react";
import Layout from "@/components/Layout/Layout";
import BlogPostLayout from "@/components/Blog/BlogPostLayout";

export default function DevBlog4Page() {
  return (
    <Layout>
      <BlogPostLayout
        title="Dev Blog #4 — Here's What We've Been Building"
        subtitle="The redesign, marketplace, trading, subscriptions, real-time messaging, notifications, profiles, Discord integration, and more — a look at everything in progress."
        date="16 June 2026"
        readTime={14}
        tag="Dev Blog"
      >
        {/* INTRO ---------------------------------------------------------- */}
        <p>The last dev blog was in January.</p>

        <p>
          That was five months ago, and I won&apos;t pretend the silence was
          intentional. It&apos;s hard to stop and write when you&apos;re deep in
          building — every hour on a blog post is an hour not spent on the product.
        </p>

        <p>
          But a lot has been happening, and it&apos;s past time to share it.
        </p>

        <p>
          This isn&apos;t a release announcement and there are no dates attached to
          any of this. It&apos;s a look at what&apos;s been in development — the
          features that are taking shape and heading towards users.
        </p>

        {/* REDESIGN ------------------------------------------------------- */}
        <h2>The Redesign</h2>

        <p>The most visible change is that SixByFive will look different.</p>

        <p>
          The previous design worked, but it had grown piecemeal — a component here,
          a style decision there, nothing quite cohesive. As the feature set expanded,
          that started to show.
        </p>

        <p>
          The redesign has been about building a proper design system from scratch:
          consistent spacing, a real colour palette that matches the brand,
          typography that scales, and components that feel like they belong together.
          A lot of page layouts have been rebuilt in the process.
        </p>

        <p>
          The result feels much more like a finished product — not just something a
          developer built, but something with a considered identity.
        </p>

        {/* MARKETPLACE ---------------------------------------------------- */}
        <h2>Marketplace</h2>

        <p>
          The marketplace has been one of the biggest pieces of work — and one of the
          most complex to get right.
        </p>

        <p>
          It was mentioned as &quot;foundations&quot; back in the first dev blog. It&apos;s
          considerably further along than that now.
        </p>

        <p>Here&apos;s what&apos;s been built:</p>

        <ul>
          <li>
            <strong>Card listings</strong> — sellers can list individual cards with
            condition, photos, and pricing
          </li>
          <li>
            <strong>Product listings</strong> — for sealed products (booster boxes,
            tins, ETBs, etc.)
          </li>
          <li>
            <strong>Filters and search</strong> — browse by set, condition, price
            range, and more
          </li>
          <li>
            <strong>Checkout flow</strong> — cart, address entry, and payment
            through Stripe
          </li>
          <li>
            <strong>Seller tools</strong> — manage your active listings, handle
            orders, mark items as shipped
          </li>
          <li>
            <strong>Offers</strong> — buyers can make offers on listings rather
            than buying at the listed price
          </li>
          <li>
            <strong>Order management</strong> — dashboards for both buyers and
            sellers to track what&apos;s in progress
          </li>
          <li>
            <strong>Shipping integration</strong> — shipping options are tied into
            the checkout process
          </li>
        </ul>

        {/* TRADING -------------------------------------------------------- */}
        <h2>Trading</h2>

        <p>
          Trading looks simple from the outside and is genuinely complicated to
          build correctly.
        </p>

        <p>
          You need to track what each side is offering, handle counter-offers, manage
          state across both users simultaneously, deal with edge cases where something
          changes mid-trade, and make sure the whole thing feels fair and transparent
          to both parties.
        </p>

        <p>The trading system covers:</p>

        <ul>
          <li>
            Sending a trade offer from any card in someone&apos;s binder or collection
          </li>
          <li>Proposing what you&apos;re offering in return</li>
          <li>Counter-offers from either side</li>
          <li>Accepting, declining, or cancelling at any point</li>
          <li>Full trade history visible from your profile</li>
          <li>Notifications at every stage</li>
        </ul>

        <p>
          Trades will show up on public profiles too — your trade history and
          reputation are part of how other collectors get to know you.
        </p>

        {/* PAYMENTS + SUBSCRIPTIONS --------------------------------------- */}
        <h2>Payments, Subscriptions, and the Wallet</h2>

        <p>Three connected systems that came together as one piece of work.</p>

        <h3>Subscriptions</h3>

        <p>
          SixByFive will have paid subscription tiers. Subscribers get access to
          features and higher limits that aren&apos;t available on the free plan.
          Subscriptions are handled through Stripe and managed entirely from your
          account settings — upgrade, downgrade, and cancel without needing to
          contact anyone.
        </p>

        <h3>The Wallet</h3>

        <p>
          The wallet is a balance you can top up and use for marketplace purchases.
          The idea is to make buying simpler — add credit once, spend it across
          multiple listings without re-entering card details every time.
        </p>

        <h3>Payments Infrastructure</h3>

        <p>
          Behind the scenes, the payments service handles Stripe webhooks,
          subscription lifecycle events, checkout sessions, and wallet transactions.
          There&apos;s a lot of complexity in making Stripe&apos;s event system
          reliable — idempotency, out-of-order events, reconciling webhook state
          with your own database. That groundwork is all in place.
        </p>

        {/* REAL-TIME MESSENGER -------------------------------------------- */}
        <h2>Real-Time Messenger</h2>

        <p>The messaging system has been rebuilt as a proper real-time experience.</p>

        <p>
          Rather than a separate page, messages live in a floating panel that sits
          at the corner of the screen — you can keep browsing the marketplace or
          checking your binders while a conversation is open. Messages appear
          instantly without refreshing.
        </p>

        <p>
          The system handles thread management, unread counts, and report/block flows
          for dealing with any conversations that go wrong. The mobile app has its own
          native conversation screen that works the same way.
        </p>

        {/* NOTIFICATIONS ------------------------------------------------- */}
        <h2>Notification System</h2>

        <p>SixByFive has a full notification system — not just an icon in the header.</p>

        <p>
          Notifications arrive in real time via a WebSocket connection and cover
          everything across the platform: trade updates, messages, price alerts,
          marketplace activity, subscription events, and wallet activity.
        </p>

        <p>
          There&apos;s a notification bell with an unread count, a dropdown for a
          quick summary, and a full notifications page for the history. You can manage
          your preferences too — choosing which events you want to hear about and
          whether you want email for each category.
        </p>

        <p>
          All notification emails now go through a proper SMTP server with branded
          templates. Things like trade updates, payment confirmations, and
          subscription changes all look like they actually belong to SixByFive.
        </p>

        {/* USER PROFILES -------------------------------------------------- */}
        <h2>Public Profiles</h2>

        <p>Public profiles have had a major overhaul.</p>

        <p>
          Each user will have a proper profile page showing what they want other
          collectors to see — collection size, binders, trade history, active
          listings, wishlist, reputation, and achievements.
        </p>

        <p>
          Everything is opt-in. The defaults are private, and you open up what
          you&apos;re comfortable sharing.
        </p>

        <p>What&apos;s been built into profiles:</p>

        <ul>
          <li>
            <strong>Reputation</strong> — built through completed trades and
            marketplace transactions
          </li>
          <li>
            <strong>Achievements</strong> — milestones like completing a set,
            hitting collection sizes, or making your first trade
          </li>
          <li>
            <strong>Activity feed</strong> — optional public log of collecting
            activity
          </li>
          <li>
            <strong>Showcase</strong> — pin your favourite cards to the top of
            your profile
          </li>
          <li>
            <strong>Social links</strong> — link your Discord, Instagram, or other
            profiles
          </li>
          <li>
            <strong>Share to Discord</strong> — share your wishlist or binder pages
            to a Discord server, formatted properly
          </li>
        </ul>

        {/* DISCORD -------------------------------------------------------- */}
        <h2>Discord Integration</h2>

        <p>
          Discord is central to how a lot of Pokémon collectors communicate, and
          SixByFive is building proper integration with it.
        </p>

        <p>
          You&apos;ll be able to link your Discord account to your SixByFive profile,
          and share your binder pages, wishlist, and collection activity directly to
          Discord servers — formatted as something worth looking at, not just a raw
          URL.
        </p>

        <p>
          The SixByFive Discord bot handles role syncing for subscribers and will
          grow as the community side of the platform develops.
        </p>

        {/* PARTNER SPOTLIGHTS --------------------------------------------- */}
        <h2>Partner Spotlights</h2>

        <p>
          SixByFive has started building relationships with stores in the Pokémon
          TCG community.
        </p>

        <p>
          The partner spotlight on the home screen currently features{" "}
          <strong>Evolved TCG</strong> and <strong>Leo&apos;s Poké Vault</strong> —
          two stores worth knowing about if you&apos;re buying sealed product or
          singles.
        </p>

        <p>
          If you run a Pokémon TCG store and want to be featured, get in touch.
        </p>

        {/* BINDER IMPROVEMENTS -------------------------------------------- */}
        <h2>Binder Improvements</h2>

        <p>
          The binder editor is one of the most-used parts of SixByFive and it&apos;s
          had a lot of attention.
        </p>

        <p>What&apos;s new or improved:</p>

        <ul>
          <li>Drag-and-drop card reordering within a page</li>
          <li>
            Drag to the edge of the screen to move a card to the next or previous
            page
          </li>
          <li>
            <strong>Auto-arrange</strong> — sorts all cards on the current page by
            card code
          </li>
          <li>
            <strong>Clear empty</strong> — compacts filled slots to the front,
            removing gaps
          </li>
          <li>
            <strong>Page notes</strong> — write notes per page to track what
            you&apos;re hunting or remember why things are arranged a certain way
          </li>
          <li>
            <strong>Destination picker</strong> — change which page cards get added
            to without closing the drawer and swiping
          </li>
          <li>Page management — add, delete, and reorder pages</li>
          <li>Layout options — choose how many slots per page</li>
          <li>Cover customisation — colour and accent options per binder</li>
        </ul>

        {/* MOBILE APP ----------------------------------------------------- */}
        <h2>The Mobile App</h2>

        <p>
          The mobile app has kept pace with the web platform throughout all of this.
          The same marketplace, trading, subscriptions, messaging, and notification
          features are all coming to mobile alongside the web.
        </p>

        <p>
          The binder editor on mobile runs with touch-first drag-and-drop and has all
          the improvements listed above. Profiles, settings, price alerts, and
          subscriptions are all fully featured in the app.
        </p>

        {/* ADMIN + INFRASTRUCTURE ----------------------------------------- */}
        <h2>Infrastructure</h2>

        <p>
          There&apos;s a whole side of SixByFive that nobody sees: the services,
          tooling, and plumbing that keep everything running.
        </p>

        <p>
          The backend is now split into dedicated services — auth, catalog,
          collections, marketplace, trading, payments, notifications, real-time,
          shipping, media, and messaging — all routing through a central GraphQL
          gateway. It started as a monolith and has grown into something properly
          structured.
        </p>

        <p>
          The admin platform has grown alongside the product — there are now
          dashboards for managing users, sets, card data, listings, subscriptions,
          pricing, and more. A lot of what keeps the platform accurate and
          well-maintained happens through these tools.
        </p>

        <p>
          The mail server is also now fully operational. Inbound and outbound email
          both work, certificates renew automatically, and all transactional emails
          go through a proper SMTP server with branded templates.
        </p>

        {/* CLOSING -------------------------------------------------------- */}
        <h2>Where Things Are Heading</h2>

        <p>
          All of the above is in progress. Some of it is close to done, some of it
          is still being built. I&apos;m not going to attach dates to any of it —
          that always ends badly.
        </p>

        <p>
          What I can say is that the platform is in the best shape it&apos;s ever
          been, the features are more complete than the public-facing app currently
          suggests, and this is going to be a big year for SixByFive.
        </p>

        <p>
          More updates to follow — more regularly this time (maybe).
        </p>

        <p>
          <strong>– Ryan @ SixByFive</strong>
        </p>
      </BlogPostLayout>
    </Layout>
  );
}
