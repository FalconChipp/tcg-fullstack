"use client";

import React, { useEffect } from "react";
import BinderCollectionView from "@/components/Binder/BinderCollectionView";

// ---- Debug toggle (set NEXT_PUBLIC_DEBUG=true to enable) ----
const DEBUG = process.env.NEXT_PUBLIC_DEBUG === 'true';

export default function CollectionTab({
  isOwnProfile,
  userEntireCollection,
  movedCards,
  setMovedCards,
  isLoading = false,
  error = null,
  gridColumns, // (not used directly here but keep signature intact)
}) {
  useEffect(() => {
    if (!DEBUG) return;
    console.groupCollapsed("[CollectionTab] props snapshot");
    console.debug("isOwnProfile:", isOwnProfile);
    console.debug("userEntireCollection length:", Array.isArray(userEntireCollection) ? userEntireCollection.length : "(not array)");
    console.debug("movedCards keys:", Object.keys(movedCards || {}).length);
    console.debug("isLoading:", isLoading, "| error:", error);
    console.groupEnd();
  }, [isOwnProfile, userEntireCollection, movedCards, isLoading, error]);

  return (
    <BinderCollectionView
      isOwnProfile={isOwnProfile}
      userEntireCollection={userEntireCollection}
      movedCards={movedCards}
      setMovedCards={setMovedCards}
      isLoading={isLoading}
      error={error}
    />
  );
}
