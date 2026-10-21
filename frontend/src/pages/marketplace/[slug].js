// Share link for a marketplace listing: /marketplace/<listingId>
// - Server-rendered so crawlers (Discord, iMessage, X, ...) see og:image = the listing's share image.
// - People are redirected back to the marketplace, where the listing opens in ListingDetailModal.
import Head from "next/head";
import { useEffect } from "react";
import { useRouter } from "next/router";
import { listingShareImageUrl } from "@/utils/shareImages";

const SITE = "https://tcg.sixbyfive.com";

export async function getServerSideProps({ params }) {
  const slug = typeof params?.slug === "string" ? params.slug : "";
  return { props: { slug } };
}

export default function ListingRedirect({ slug }) {
  const router = useRouter();

  useEffect(() => {
    if (!router.isReady) return;
    const dest = slug ? `/marketplace?listing=${slug}` : "/marketplace";
    router.replace(dest);
  }, [router.isReady, slug]); // eslint-disable-line react-hooks/exhaustive-deps

  const title = "Card listing – SixByFive TCG";
  const description = "See this listing on the SixByFive TCG marketplace.";
  const image = slug ? listingShareImageUrl(slug) : null;

  return (
    <Head>
      <title>{title}</title>
      <meta name="description" content={description} />
      <meta name="robots" content="noindex" />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:type" content="website" />
      {slug ? <meta property="og:url" content={`${SITE}/marketplace/${slug}`} /> : null}
      {image ? <meta property="og:image" content={image} /> : null}
      <meta name="twitter:card" content={image ? "summary_large_image" : "summary"} />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      {image ? <meta name="twitter:image" content={image} /> : null}
    </Head>
  );
}
