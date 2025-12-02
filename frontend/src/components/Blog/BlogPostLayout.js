// src/components/Blog/BlogPostLayout.js
// -----------------------------------------------------------------------------
// Reusable layout for a single blog post.
// -----------------------------------------------------------------------------

import React from "react";
import Link from "next/link";

export default function BlogPostLayout({
  title,
  subtitle,
  date,
  readTime,
  tag = "Dev Blog",
  children,
}) {
  return (
    <div className="min-h-screen bg-light-background dark:bg-dark-background text-light-text dark:text-dark-text">
      {/* Top accent bar */}
      <div className="h-1 w-full bg-light-accent dark:bg-dark-accent" />

      <main className="px-4 py-10 sm:px-6 md:px-8">
        <div className="mx-auto max-w-7xl">
          {/* Back link */}
          <div className="mb-4">
            <Link
              href="/blog"
              aria-label="Back to blog"
              className="inline-flex items-center text-sm text-light-textMuted dark:text-dark-textMuted hover:text-light-accent dark:hover:text-dark-accent transition-colors"
            >
              ← Back to blog
            </Link>
          </div>

          {/* Card wrapper for the post */}
          <div className="rounded-2xl border border-light-border dark:border-dark-border bg-light-surface dark:bg-dark-surface px-5 py-6 sm:px-7 sm:py-8 shadow-sm">
            {/* Header */}
            <header className="mb-6 sm:mb-8">
              {/* Tag pill */}
              <span className="inline-flex items-center rounded-full bg-light-alt dark:bg-dark-alt px-3 py-1 text-xs font-medium text-light-textSecondary dark:text-dark-textSecondary">
                {tag}
              </span>

              {/* Title */}
              <h1 className="mt-4 font-heading text-3xl sm:text-4xl md:text-5xl font-semibold tracking-tight text-light-text dark:text-dark-text">
                {title}
              </h1>

              {/* Subtitle */}
              {subtitle && (
                <p className="mt-3 text-base sm:text-lg text-light-textMuted dark:text-dark-textMuted">
                  {subtitle}
                </p>
              )}

              {/* Meta row */}
              {(date || readTime) && (
                <div className="mt-4 flex flex-wrap items-center gap-3 text-xs sm:text-sm text-light-textMuted dark:text-dark-textMuted">
                  {date && (
                    <span className="inline-flex items-center">
                      <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-light-accent dark:bg-dark-accent" />
                      {date}
                    </span>
                  )}
                  {date && readTime && (
                    <span className="h-1 w-1 rounded-full bg-light-border dark:bg-dark-border" />
                  )}
                  {readTime && <span>{readTime} min read</span>}
                </div>
              )}
            </header>

            {/* Divider between header + body */}
            <div className="h-px w-full bg-light-border/70 dark:bg-dark-border/70 mb-6 sm:mb-8" />

            {/* Body */}
            <article
              className="
                prose prose-slate dark:prose-invert
                prose-headings:font-heading prose-headings:font-semibold
                prose-h2:mt-10 prose-h2:mb-3 prose-h2:text-2xl
                prose-h3:mt-8 prose-h3:mb-2 prose-h3:text-xl
                prose-p:leading-relaxed
                prose-ul:mt-3 prose-ul:mb-5
                prose-li:mt-1.5
                prose-a:text-light-accent dark:prose-a:text-dark-accent
                prose-a:no-underline hover:prose-a:underline
                max-w-none
              "
            >
              {children}
            </article>
          </div>
        </div>
      </main>
    </div>
  );
}
