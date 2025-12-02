// src/pages/blog/index.js
// -----------------------------------------------------------------------------
// Blog index page
// - Lists recent posts with title, date, read time, and short description
// - Uses your global Layout component if you have one
// -----------------------------------------------------------------------------

"use client";

import React from "react";
import Link from "next/link";
import Layout from "@/components/Layout/Layout"; // adjust path if needed

// TODO: Replace this with real data / MDX later.
const POSTS = [
  {
    slug: "dev-blog-1-11-months-of-building",
    title: "SixByFive TCG – 11 Months of Building",
    excerpt:
      "A behind-the-scenes look at everything built so far, the challenges, and what’s next for SixByFive TCG.",
    date: "2 December 2025",
    readTime: 6,
    tag: "Dev Blog",
  },
  // Add more posts here as you publish them
];

export default function BlogIndexPage() {
  return (
    <Layout>
      <div className="min-h-screen bg-light-background dark:bg-dark-background text-light-text dark:text-dark-text">
        <div className="px-4 py-10 sm:px-6 md:px-8">
          <div className="mx-auto max-w-4xl">
            {/* Page header */}
            <header className="mb-10">
              <h1 className="font-heading text-3xl sm:text-4xl font-semibold tracking-tight text-light-text dark:text-dark-text">
                SixByFive TCG Dev Blog
              </h1>
              <p className="mt-3 text-sm sm:text-base text-light-textMuted dark:text-dark-textMuted max-w-2xl">
                Follow the journey of building a Pokémon TCG collection platform—
                from features and architecture to design decisions and real-world
                challenges.
              </p>
            </header>

            {/* Posts list */}
            <div className="space-y-6">
              {POSTS.map((post) => (
                <article
                  key={post.slug}
                  className="group rounded-2xl border border-light-border dark:border-dark-border bg-light-surface dark:bg-dark-surface p-5 sm:p-6 transition-transform transition-colors hover:border-light-accent dark:hover:border-dark-accent hover:-translate-y-0.5"
                >
                  {/* Tag + meta */}
                  <div className="flex flex-wrap items-center gap-3 text-xs sm:text-sm text-light-textMuted dark:text-dark-textMuted mb-2">
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

                  {/* Title */}
                  <h2 className="font-heading text-xl sm:text-2xl font-semibold text-light-text dark:text-dark-text">
                    <Link
                      href={`/blog/${post.slug}`}
                      className="hover:text-light-accent dark:hover:text-dark-accent transition-colors"
                    >
                      {post.title}
                    </Link>
                  </h2>

                  {/* Excerpt */}
                  <p className="mt-2 text-sm sm:text-base text-light-textMuted dark:text-dark-textMuted">
                    {post.excerpt}
                  </p>

                  {/* Read more */}
                  <div className="mt-4">
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
              ))}

              {POSTS.length === 0 && (
                <p className="text-light-textMuted dark:text-dark-textMuted">
                  No posts yet. Check back soon.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
