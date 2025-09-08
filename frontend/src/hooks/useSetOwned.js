// src/hooks/useSetOwned.js
import { useContext, useEffect, useMemo, useState } from "react";
import { AuthContext } from "@/components/Auth/AuthProvider";
import { getCookie } from "@/utils/cookieUtils";

const GRAPHQL_URL = process.env.NEXT_PUBLIC_GRAPHQL_ENDPOINT;

const MY_COLLECTION_QUERY = `
  query MyCollection {
    myCollection {
      cardId
      wishlist
      variation
      quantity
    }
  }
`;

export default function useSetOwned(setObj) {
  const { user, token: ctxToken } = useContext(AuthContext) || {};
  const [ownedSet, setOwnedSet] = useState(() => new Set());
  const [loading, setLoading] = useState(false);

  // valid card IDs for this set (only count those)
  const validIds = useMemo(() => {
    const cards = Array.isArray(setObj?.cards) ? setObj.cards : [];
    return new Set(cards.map((c) => c.id).filter(Boolean));
  }, [setObj]);

  useEffect(() => {
    let aborted = false;
    const token = ctxToken || getCookie?.("authToken"); // fallback to cookie if your AuthContext exposes token differently
    if (!user || !token) {
      setOwnedSet(new Set());
      return;
    }

    (async () => {
      try {
        setLoading(true);
        const res = await fetch(GRAPHQL_URL, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          cache: "no-store",
          body: JSON.stringify({ query: MY_COLLECTION_QUERY }),
        });
        const json = await res.json().catch(() => ({}));

        if (aborted) return;
        const all = Array.isArray(json?.data?.myCollection) ? json.data.myCollection : [];
        const next = new Set();
        for (const entry of all) {
          const id = entry?.cardId;
          const isWishlist =
            entry?.wishlist === true ||
            entry?.wishlist === 1 ||
            String(entry?.wishlist).toLowerCase() === "true";
          if (!id || isWishlist) continue;
          if (validIds.has(id)) next.add(id);
        }
        setOwnedSet(next);
      } catch {
        if (!aborted) setOwnedSet(new Set());
      } finally {
        if (!aborted) setLoading(false);
      }
    })();

    return () => {
      aborted = true;
    };
  }, [user, ctxToken, setObj, validIds]);

  const completedCount = useMemo(() => ownedSet.size, [ownedSet]);

  return { ownedSet, completedCount, loading };
}
