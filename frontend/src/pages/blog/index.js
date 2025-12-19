// src/pages/blog/index.js
// -----------------------------------------------------------------------------
// Blog index page
// - Hero explaining what this dev blog is
// - Highlights latest post in a feature card
// - Lists remaining posts underneath
// -----------------------------------------------------------------------------

"use client";

import React from "react";
import Link from "next/link";
import Layout from "@/components/Layout/Layout";

// UPDATED: newest post (Dev Blog #2) first, older ones after
const POSTS = [
  {
    slug: "dev-blog-2-data-accuracy",
    title: "Dev Blog #2 — Why I’m Focusing on Data Accuracy Instead of New Features",
    excerpt:
      "Collecting only works if you can trust the data. Why I’m slowing down big launches to fix edge cases, clean up sets, and make the foundations reliable.",
    date: "19 December 2025",
    readTime: 7,
    tag: "Dev Blog",
  },
  {
    slug: "dev-blog-1-11-months-of-building",
    title: "SixByFive TCG – 11 Months of Building",
    excerpt:
      "A behind-the-scenes look at everything built so far, the challenges, and what’s next for SixByFive TCG.",
    date: "2 December 2025",
    readTime: 8,
    tag: "Dev Blog",
  },
];

export default function BlogIndexPage() {
  const hasPosts = POSTS.length > 0;
  const latestPost = hasPosts ? POSTS[0] : null;
  const otherPosts = hasPosts ? POSTS.slice(1) : [];

  const seo = {
    title: "Dev Blog — SixByFive TCG",
    description:
      "Follow the journey of building SixByFive TCG — a Pokémon TCG collection platform — from early prototypes to trading, marketplace, and beyond.",
    canonical: "/blog",
  };

  return (
    <Layout seo={seo}>
      <div className="min-h-screen bg-light-background dark:bg-dark-background text-light-text dark:text-dark-text transition-colors pb-16">
        {/* HERO / INTRO */}
        <section className="w-full border-b border-light-border/70 dark:border-dark-border/70 bg-gradient-to-br from-light-alt via-light-background to-[#e5f1ff] dark:from-[#151521] dark:via-dark-surface dark:to-dark-background px-4 pt-10 pb-10 sm:pb-12">
          <div className="mx-auto max-w-5xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-light-border/70 dark:border-dark-border/70 bg-light-surface/70 dark:bg-dark-surface/60 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-light-textMuted dark:text-dark-textMuted shadow-sm mb-4">
              <span className="h-1.5 w-1.5 rounded-full bg-light-accent dark:bg-dark-accent" />
              Dev log · In the open
            </div>

            <h1 className="font-heading text-3xl sm:text-4xl md:text-[2.6rem] font-extrabold tracking-tight text-light-primary dark:text-dark-primary">
              SixByFive TCG Dev Blog
            </h1>

            <p className="mt-3 max-w-2xl text-sm sm:text-base text-light-textSecondary dark:text-dark-textSecondary leading-relaxed">
              A behind-the-scenes journal of building a Pokémon TCG collection
              platform — what shipped, what broke, and how the product is
              evolving for collectors over time.
            </p>

            <p className="mt-3 text-xs sm:text-[13px] text-light-textMuted dark:text-dark-textMuted">
              Think of this as the changelog with a bit more story: architecture
              decisions, UX experiments, pricing work, and everything in between.
            </p>
          </div>
        </section>

        <main className="px-4 pt-6 sm:px-6 md:px-8">
          <div className="mx-auto max-w-5xl space-y-10 sm:space-y-12">
            {/* FEATURED / LATEST POST */}
            {latestPost && (
              <section aria-labelledby="latest-post-heading">
                <div className="flex items-baseline justify-between gap-2 mb-3">
                  <h2
                    id="latest-post-heading"
                    className="text-sm font-semibold tracking-wide uppercase text-light-textMuted dark:text-dark-textMuted"
                  >
                    Latest post
                  </h2>
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-light-surface dark:bg-dark-surface border border-light-border/70 dark:border-dark-border/70 text-light-textMuted dark:text-dark-textMuted">
                    Newest first
                  </span>
                </div>

                <article
                  className="
                    group relative overflow-hidden rounded-3xl
                    border border-light-border dark:border-dark-border
                    bg-light-surface dark:bg-dark-surface
                    shadow-lg ring-1 ring-black/5 dark:ring-black/30
                    transition-transform duration-150 hover:-translate-y-0.5
                  "
                >
                  <div className="absolute inset-0 pointer-events-none">
                    <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-light-accent/10 dark:bg-dark-accent/12 blur-2xl" />
                  </div>

                  <div className="relative p-6 sm:p-7 flex flex-col gap-3">
                    {/* Tag + meta */}
                    <div className="flex flex-wrap items-center gap-3 text-xs sm:text-[13px] text-light-textMuted dark:text-dark-textMuted">
                      <span className="inline-flex items-center rounded-full bg-light-alt dark:bg-dark-alt px-3 py-1 text-[11px] font-medium text-light-textSecondary dark:text-dark-textSecondary">
                        {latestPost.tag}
                      </span>
                      <span>{latestPost.date}</span>
                      {latestPost.readTime && (
                        <>
                          <span className="h-1 w-1 rounded-full bg-light-border dark:bg-dark-border" />
                          <span>{latestPost.readTime} min read</span>
                        </>
                      )}
                    </div>

                    {/* Title */}
                    <h2 className="font-heading text-xl sm:text-2xl font-semibold text-light-text dark:text-dark-text">
                      <Link
                        href={`/blog/${latestPost.slug}`}
                        className="hover:text-light-accent dark:hover:text-dark-accent transition-colors"
                      >
                        {latestPost.title}
                      </Link>
                    </h2>

                    {/* Excerpt */}
                    <p className="text-sm sm:text-base text-light-textSecondary dark:text-dark-textSecondary max-w-2xl">
                      {latestPost.excerpt}
                    </p>

                    <div className="mt-1">
                      <Link
                        href={`/blog/${latestPost.slug}`}
                        className="inline-flex items-center text-sm font-medium text-light-accent dark:text-dark-accent hover:underline"
                      >
                        Read the post
                        <span className="ml-1.5 transition-transform group-hover:translate-x-0.5">
                          →
                        </span>
                      </Link>
                    </div>
                  </div>
                </article>
              </section>
            )}

            {/* ALL POSTS LIST */}
            <section aria-labelledby="all-posts-heading">
              <div className="flex items-baseline justify-between mb-4">
                <h2
                  id="all-posts-heading"
                  className="text-sm font-semibold tracking-wide uppercase text-light-textMuted dark:text-dark-textMuted"
                >
                  All posts
                </h2>
              </div>

              {!hasPosts && (
                <p className="text-sm text-light-textMuted dark:text-dark-textMuted">
                  No posts yet. Check back soon — the first dev log will land
                  here once the product has a little more mileage.
                </p>
              )}

              {hasPosts && (
                <div className="space-y-5">
                  {otherPosts.length === 0 ? (
                    <p className="text-sm text-light-textMuted dark:text-dark-textMuted">
                      More posts will appear here as new dev logs and updates
                      are published.
                    </p>
                  ) : (
                    otherPosts.map((post) => (
                      <article
                        key={post.slug}
                        className="
                          group rounded-2xl border border-light-border dark:border-dark-border
                          bg-light-surface dark:bg-dark-surface
                          p-5 sm:p-6 shadow-sm
                          transition-[border,transform] duration-150
                          hover:border-light-accent dark:hover:border-dark-accent hover:-translate-y-0.5
                        "
                      >
                        <div className="flex flex-wrap items-center gap-3 text-xs sm:text-[13px] text-light-textMuted dark:text-dark-textMuted mb-2">
                          <span className="inline-flex items-center rounded-full bg-light-alt dark:bg-dark-alt px-3 py-1 text-[11px] font-medium text-light-textSecondary dark:text-dark-textSecondary">
                            {post.tag}
                          </span>
                          <span>{post.date}</span>
                          {post.readTime && (
                            <>
                              <span className="h-1 w-1 rounded-full bg-light-border dark:bg-dark-border" />
                              <span>{post.readTime} min read</span>
                            </>
                          )}
                        </div>

                        <h3 className="font-heading text-lg sm:text-xl font-semibold text-light-text dark:text-dark-text">
                          <Link
                            href={`/blog/${post.slug}`}
                            className="hover:text-light-accent dark:hover:text-dark-accent transition-colors"
                          >
                            {post.title}
                          </Link>
                        </h3>

                        <p className="mt-1.5 text-sm sm:text-[15px] text-light-textMuted dark:text-dark-textMuted">
                          {post.excerpt}
                        </p>

                        <div className="mt-3">
                          <Link
                            href={`/blog/${post.slug}`}
                            className="inline-flex items-center text-sm font-medium text-light-accent dark:text-dark-accent hover:underline"
                          >
                            Read more
                            <span className="ml-1.5 transition-transform group-hover:translate-x-0.5">
                              →
                            </span>
                          </Link>
                        </div>
                      </article>
                    ))
                  )}
                </div>
              )}
            </section>
          </div>
        </main>
      </div>
    </Layout>
  );
}
