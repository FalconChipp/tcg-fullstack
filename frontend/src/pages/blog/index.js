// src/pages/blog/index.js
// -----------------------------------------------------------------------------
// Blog index page — vertical dev-log timeline.
// -----------------------------------------------------------------------------

"use client";

import React from "react";
import Link from "next/link";
import Layout from "@/components/Layout/Layout";
import { DEV_BLOG_POSTS } from "@/data/devBlogPosts";

export default function BlogIndexPage() {
  const hasPosts = DEV_BLOG_POSTS.length > 0;

  const seo = {
    title: "Dev Blog — SixByFive TCG",
    description:
      "Follow the journey of building SixByFive TCG — a Pokémon TCG collection platform — from early prototypes to trading, marketplace, and beyond.",
    canonical: "/blog",
  };

  return (
    <Layout seo={seo}>
      <div className="min-h-screen bg-vault-bg pb-24">
        {/* HERO / INTRO */}
        <section className="w-full border-b border-vault-border px-5 pt-16 pb-12 sm:px-7">
          <div className="mx-auto max-w-3xl">
            <p className="mb-4 font-vault-body text-[11px] font-semibold uppercase tracking-[0.08em] text-vault-textTertiary">
              Dev log · In the open
            </p>

            <h1 className="font-vault text-[36px] font-semibold leading-[1.15] tracking-tight text-vault-text sm:text-[42px]">
              SixByFive TCG Dev Blog
            </h1>

            <p className="mt-4 max-w-2xl text-[15px] leading-7 text-vault-textSecondary">
              A behind-the-scenes journal of building a Pokémon TCG collection
              platform — what shipped, what broke, and how the product is
              evolving for collectors over time.
            </p>
          </div>
        </section>

        <main className="px-5 pt-16 sm:px-7">
          <div className="mx-auto max-w-3xl">
            {!hasPosts && (
              <p className="text-sm text-vault-textTertiary">
                No posts yet. Check back soon — the first dev log will land
                here once the product has a little more mileage.
              </p>
            )}

            {hasPosts && (
              <div className="relative">
                {/* Connecting timeline rail */}
                <div
                  aria-hidden="true"
                  className="absolute left-10 top-2 bottom-2 w-px bg-vault-border"
                />

                <div className="space-y-14">
                  {DEV_BLOG_POSTS.map((post, index) => {
                    const isLatest = index === 0;

                    return (
                      <article key={post.slug} className="relative flex gap-6">
                        <div className="relative z-10 flex h-20 w-20 flex-none items-center justify-center bg-vault-bg">
                          <span
                            className={`font-vault text-3xl font-semibold ${
                              isLatest ? "text-vault-accent" : "text-vault-textTertiary"
                            }`}
                          >
                            {post.number}
                          </span>
                        </div>

                        <div className="flex-1 pb-2 pt-2">
                          <div className="mb-2 flex flex-wrap items-center gap-3">
                            {isLatest && (
                              <span className="inline-flex items-center rounded-[6px] bg-vault-accent/10 px-2 py-1 font-vault-body text-[11px] font-semibold uppercase tracking-[0.06em] text-vault-accent">
                                Latest
                              </span>
                            )}
                            <span className="font-vault-body text-[11px] font-semibold uppercase tracking-[0.06em] text-vault-textSecondary">
                              {post.tag}
                            </span>
                            <span className="text-[13px] text-vault-textTertiary">
                              {post.date}
                            </span>
                            {post.readTime && (
                              <>
                                <span className="h-1 w-1 rounded-full bg-vault-border" />
                                <span className="text-[13px] text-vault-textTertiary">
                                  {post.readTime} min read
                                </span>
                              </>
                            )}
                          </div>

                          <h2 className="font-vault text-xl font-semibold text-vault-text sm:text-2xl">
                            <Link
                              href={`/blog/${post.slug}`}
                              className="transition-colors hover:text-vault-accent"
                            >
                              {post.title}
                            </Link>
                          </h2>

                          <p className="mt-3 max-w-2xl text-[15px] leading-7 text-vault-textSecondary">
                            {post.excerpt}
                          </p>

                          <Link
                            href={`/blog/${post.slug}`}
                            className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-vault-accent hover:text-vault-accentHover"
                          >
                            Read the post
                            <span aria-hidden="true">→</span>
                          </Link>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </Layout>
  );
}
