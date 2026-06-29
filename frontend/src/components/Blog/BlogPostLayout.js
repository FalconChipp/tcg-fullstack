// src/components/Blog/BlogPostLayout.js
// -----------------------------------------------------------------------------
// Reusable layout for a single blog post — two-column: content + sticky
// sidebar (post numeral, meta, prev/next nav through the dev log).
// -----------------------------------------------------------------------------

import React from "react";
import Link from "next/link";
import { DEV_BLOG_POSTS } from "@/data/devBlogPosts";

export default function BlogPostLayout({
  slug,
  title,
  subtitle,
  date,
  readTime,
  tag = "Dev Blog",
  children,
}) {
  const index = DEV_BLOG_POSTS.findIndex((p) => p.slug === slug);
  const post = index >= 0 ? DEV_BLOG_POSTS[index] : null;
  // POSTS is newest-first, so "previous" chronologically is the next array index.
  const olderPost = index >= 0 ? DEV_BLOG_POSTS[index + 1] : null;
  const newerPost = index > 0 ? DEV_BLOG_POSTS[index - 1] : null;

  return (
    <div className="min-h-screen bg-vault-bg text-vault-text">
      <main className="px-5 py-14 sm:px-7">
        <div className="mx-auto grid max-w-5xl grid-cols-1 gap-12 lg:grid-cols-[1fr_240px]">
          {/* Main content column */}
          <div className="max-w-3xl">
            <div className="mb-8">
              <Link
                href="/blog"
                aria-label="Back to blog"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-vault-textTertiary transition-colors hover:text-vault-text"
              >
                <span aria-hidden="true">←</span> Back to blog
              </Link>
            </div>

            <header className="mb-8">
              <span className="inline-flex items-center rounded-[6px] bg-vault-raised px-2 py-1 font-vault-body text-[11px] font-semibold uppercase tracking-[0.06em] text-vault-textSecondary">
                {tag}
              </span>

              <h1 className="mt-4 font-vault text-[32px] font-semibold leading-[1.15] tracking-tight text-vault-text sm:text-4xl">
                {title}
              </h1>

              {subtitle && (
                <p className="mt-3 text-base leading-7 text-vault-textSecondary">
                  {subtitle}
                </p>
              )}

              {(date || readTime) && (
                <div className="mt-4 flex flex-wrap items-center gap-3 text-[13px] text-vault-textTertiary">
                  {date && <span>{date}</span>}
                  {date && readTime && (
                    <span className="h-1 w-1 rounded-full bg-vault-border" />
                  )}
                  {readTime && <span>{readTime} min read</span>}
                </div>
              )}
            </header>

            <div className="mb-8 h-px w-full bg-vault-border" />

            <article
              className="
                prose prose-invert
                prose-headings:font-vault prose-headings:font-semibold prose-headings:text-vault-text
                prose-h2:mt-10 prose-h2:mb-3 prose-h2:text-2xl
                prose-h3:mt-8 prose-h3:mb-2 prose-h3:text-xl
                prose-p:leading-relaxed prose-p:text-vault-textSecondary
                prose-strong:text-vault-text
                prose-ul:mt-3 prose-ul:mb-5
                prose-li:mt-1.5 prose-li:text-vault-textSecondary
                prose-a:text-vault-accent prose-a:no-underline hover:prose-a:underline
                prose-blockquote:border-vault-border prose-blockquote:text-vault-textSecondary
                prose-code:text-vault-text
                max-w-none
              "
            >
              {children}
            </article>

            {/* Prev/next — mobile + tablet (sidebar is desktop-only) */}
            {(olderPost || newerPost) && (
              <div className="mt-12 grid grid-cols-1 gap-4 border-t border-vault-border pt-8 sm:grid-cols-2 lg:hidden">
                {newerPost ? (
                  <Link
                    href={`/blog/${newerPost.slug}`}
                    className="rounded-[10px] border border-vault-border p-4 transition-colors hover:border-vault-borderStrong"
                  >
                    <p className="font-vault-body text-[11px] font-semibold uppercase tracking-[0.06em] text-vault-textTertiary">
                      Newer
                    </p>
                    <p className="mt-1 font-vault text-sm font-semibold text-vault-text">
                      {newerPost.title}
                    </p>
                  </Link>
                ) : (
                  <div />
                )}

                {olderPost && (
                  <Link
                    href={`/blog/${olderPost.slug}`}
                    className="rounded-[10px] border border-vault-border p-4 text-right transition-colors hover:border-vault-borderStrong"
                  >
                    <p className="font-vault-body text-[11px] font-semibold uppercase tracking-[0.06em] text-vault-textTertiary">
                      Older
                    </p>
                    <p className="mt-1 font-vault text-sm font-semibold text-vault-text">
                      {olderPost.title}
                    </p>
                  </Link>
                )}
              </div>
            )}
          </div>

          {/* Sticky sidebar — desktop only */}
          <aside className="hidden lg:block">
            <div className="sticky top-28 space-y-8">
              {post && (
                <div>
                  <span className="font-vault text-5xl font-semibold text-vault-accent">
                    {post.number}
                  </span>
                  <p className="mt-1 font-vault-body text-[11px] font-semibold uppercase tracking-[0.06em] text-vault-textTertiary">
                    Entry in the dev log
                  </p>
                </div>
              )}

              <div className="h-px w-full bg-vault-border" />

              <div className="space-y-1">
                <p className="font-vault-body text-[11px] font-semibold uppercase tracking-[0.06em] text-vault-textTertiary">
                  More dev blogs
                </p>

                {newerPost && (
                  <Link
                    href={`/blog/${newerPost.slug}`}
                    className="block py-2 text-sm font-medium text-vault-textSecondary transition-colors hover:text-vault-accent"
                  >
                    {newerPost.title}
                  </Link>
                )}

                {olderPost && (
                  <Link
                    href={`/blog/${olderPost.slug}`}
                    className="block py-2 text-sm font-medium text-vault-textSecondary transition-colors hover:text-vault-accent"
                  >
                    {olderPost.title}
                  </Link>
                )}

                {!newerPost && !olderPost && (
                  <p className="py-2 text-sm text-vault-textTertiary">
                    More entries coming soon.
                  </p>
                )}
              </div>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
