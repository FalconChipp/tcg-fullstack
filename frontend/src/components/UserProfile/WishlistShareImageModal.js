// src/components/UserProfile/WishlistShareImageModal.js
// UPDATED: the image is now rendered server-side by the gateway
// (GET /share/wishlist/:username.png) so web and the mobile app share the same PNG.
// This used to rasterize <WishlistShareCard> in the browser with html-to-image;
// props are unchanged so ProfileWishlistPanel needs no changes.

"use client";

import React, { useMemo } from "react";
import ShareImageModal from "@/components/UI/ShareImageModal";
import { wishlistShareImageUrl } from "@/utils/shareImages";
import { buildWishlistShareUrl } from "@/utils/wishlistShare";

export default function WishlistShareImageModal({ open, onClose, username, status }) {
  const user = typeof username === "string" ? username.trim() : "";

  const imageUrl = useMemo(() => wishlistShareImageUrl(user, status), [user, status]);
  const link = useMemo(
    () => (user ? buildWishlistShareUrl({ username: user, filters: status ? { status } : {} }) : ""),
    [user, status]
  );

  return (
    <ShareImageModal
      open={open}
      onClose={onClose}
      title="Wishlist share image"
      imageUrl={imageUrl}
      fileName={`${user || "wishlist"}-wishlist.png`}
      link={link}
      shareText={user ? `${user}'s wishlist on SixByFive TCG` : "Wishlist on SixByFive TCG"}
    />
  );
}
