// Redirect all /marketplace/[id] URLs back to the marketplace
// Card listings open in the ListingDetailModal on /marketplace
import { useEffect } from "react";
import { useRouter } from "next/router";

export default function ListingRedirect() {
  const router = useRouter();
  const { slug } = router.query;

  useEffect(() => {
    if (!router.isReady) return;
    const dest = slug ? `/marketplace?listing=${slug}` : "/marketplace";
    router.replace(dest);
  }, [router.isReady, slug]); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}
