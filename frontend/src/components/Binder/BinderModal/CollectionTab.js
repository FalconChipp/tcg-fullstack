"use client";

import React from "react";
import BinderCollectionView from "@/components/Binder/BinderCollectionView";

/**
 * CollectionTab
 * 
 * Displays the user's available collection cards in a grid, minus any that are currently in the binder.
 * Props:
 *  - isOwnProfile: Boolean (can user drag/drop?)
 *  - userEntireCollection: Array of all user's cards (with quantity)
 *  - movedCards: Object mapping cardKey -> quantity moved to binder
 *  - setMovedCards: Function to update movedCards (comes from useBinderPages)
 *  - isLoading: Loading state (optional, default false)
 *  - error: Error message if fetch fails (optional)
 */
export default function CollectionTab({
  isOwnProfile,
  userEntireCollection,
  movedCards,
  setMovedCards,
  isLoading = false,
  error = null,
}) {
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
