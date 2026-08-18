// Redirect to marketplace — "My Listings" is now a slide-in drawer on /marketplace
import { useEffect } from "react";
import { useRouter } from "next/router";

export default function MyListingsRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace("/marketplace"); }, [router]);
  return null;
}
