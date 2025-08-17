// src/components/SEO/SEO.js
"use client";
import React from "react";
import Head from "next/head";
import { useRouter } from "next/router";

const SITE_NAME = "SixByFive TCG";
const SITE_URL = "https://tcg.sixbyfive.com";
const DEFAULT_LOCALE = "en_GB";
const DEFAULT_TWITTER = "@sixbyfive"; // TODO: set or remove

const safeJson = (obj) => JSON.stringify(obj, null, 2);

const websiteSchema = () => ({
  "@context": "https://schema.org",
  "@type": "WebSite",
  "name": SITE_NAME,
  "url": SITE_URL,
  "potentialAction": {
    "@type": "SearchAction",
    "target": `${SITE_URL}/search?q={search_term_string}`,
    "query-input": "required name=search_term_string"
  }
});

const organizationSchema = () => ({
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": SITE_NAME,
  "url": SITE_URL,
  "logo": `${SITE_URL}/og-image.png`,
  "sameAs": [
    // Add your real profiles or remove
    "https://discord.gg/PRMbMbRE2H"
  ]
});

const faqSchema = (items = []) => ({
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": items.map(({ q, a }) => ({
    "@type": "Question",
    "name": q,
    "acceptedAnswer": { "@type": "Answer", "text": a }
  }))
});

export default function SEO({
  title = `${SITE_NAME} – UK Trading Card Collection & Marketplace`,
  description = "Track, value, and show off your Pokémon cards. Build digital binders, get price updates, and connect with UK collectors — free to start.",
  canonical,                         // full URL or path; defaults to current route
  ogImage = `${SITE_URL}/og-image.png`,
  ogImageAlt = "SixByFive TCG preview image",
  ogImageWidth = 1200,
  ogImageHeight = 630,
  locale = DEFAULT_LOCALE,
  robots = "index,follow",
  noindex = false,
  hreflangs = [
    { hrefLang: "en-gb", href: SITE_URL },
    { hrefLang: "x-default", href: SITE_URL }
  ],
  faqItems,                          // array of { q, a }
  extraJsonLd = [],                  // additional JSON-LD objects
}) {
  const router = useRouter();
  const path = router?.asPath || "/";
  const canon = canonical
    ? (canonical.startsWith("http") ? canonical : `${SITE_URL}${canonical}`)
    : `${SITE_URL}${path === "/" ? "/" : path}`;

  const allJsonLd = [
    websiteSchema(),
    organizationSchema(),
    ...(faqItems && faqItems.length ? [faqSchema(faqItems)] : []),
    ...extraJsonLd
  ];

  return (
    <Head>
      {/* Primary */}
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={canon} />

      {/* Robots */}
      <meta name="robots" content={noindex ? "noindex,nofollow" : robots} />
      <meta name="googlebot" content={noindex ? "noindex,nofollow" : robots} />

      {/* Icons (ensure in /public) */}
      <link rel="icon" href="/favicon-32x32.png" sizes="32x32" />
      <link rel="icon" href="/favicon-16x16.png" sizes="16x16" />
      <link rel="apple-touch-icon" href="/apple-touch-icon.png" sizes="180x180" />
      <link rel="manifest" href="/site.webmanifest" />

      {/* Theme colors */}
      <meta name="theme-color" content="#0B1220" media="(prefers-color-scheme: dark)" />
      <meta name="theme-color" content="#ffffff" media="(prefers-color-scheme: light)" />

      {/* Open Graph */}
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:type" content="website" />
      <meta property="og:url" content={canon} />
      <meta property="og:locale" content={locale} />
      <meta property="og:image" content={ogImage} />
      <meta property="og:image:alt" content={ogImageAlt} />
      <meta property="og:image:width" content={String(ogImageWidth)} />
      <meta property="og:image:height" content={String(ogImageHeight)} />

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      {/* Remove creator if you don't have a handle */}
      <meta name="twitter:creator" content={DEFAULT_TWITTER} />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={ogImage} />

      {/* hreflang */}
      {hreflangs?.map((alt) => (
        <link key={alt.hrefLang} rel="alternate" hrefLang={alt.hrefLang} href={alt.href} />
      ))}

      {/* JSON-LD */}
      {allJsonLd.map((obj, i) => (
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJson(obj) }} />
      ))}
    </Head>
  );
}
