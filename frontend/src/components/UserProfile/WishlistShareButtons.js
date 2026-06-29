// src/components/Wishlist/WishlistShareButtons.js
// UPDATED (2026-01-11):
// - Share image now opens a modal preview instead of exporting a hidden node.
// - Replaced onShareImage with onOpenShareImage (parent shows modal + handles export).
// - Keeps existing Copy link + Copy Discord behavior unchanged.

import React, { useMemo, useRef, useState } from "react";
import {
  buildWishlistShareUrl,
  buildDiscordWishlistShare,
  copyToClipboard,
} from "@/utils/wishlistShare";

/**
 * @param {object} props
 * @param {string} props.username
 * @param {object} [props.filters]
 * @param {string} [props.filters.status]
 * @param {string} [props.filters.set]
 * @param {string} [props.filters.search]
 * @param {number} [props.count]
 * @param {string} [props.setName]
 * @param {Array}  [props.topCards]
 * @param {string} [props.baseUrl]
 * @param {function} [props.onOpenShareImage] - opens modal preview
 */
export default function WishlistShareButtons({
  username,
  filters = {},
  count,
  setName,
  topCards,
  baseUrl,
  onOpenShareImage, // CHANGED
}) {
  const [copied, setCopied] = useState("");
  const timeoutRef = useRef(null);

  const normalizedFilters = useMemo(() => {
    const clean = (v) => (typeof v === "string" ? v.trim() : "");
    const status = clean(filters.status);
    const set = clean(filters.set);
    const search = clean(filters.search);

    return {
      ...(status ? { status } : {}),
      ...(set ? { set } : {}),
      ...(search ? { search } : {}),
    };
  }, [filters.status, filters.set, filters.search]);

  const shareUrl = useMemo(() => {
    return buildWishlistShareUrl({ username, filters: normalizedFilters, baseUrl });
  }, [username, normalizedFilters, baseUrl]);

  const discordText = useMemo(() => {
    return buildDiscordWishlistShare({
      username,
      url: shareUrl,
      count,
      status: normalizedFilters?.status || null,
      setName: setName || null,
      topCards: topCards || [],
    });
  }, [username, shareUrl, count, normalizedFilters?.status, setName, topCards]);

  function bumpCopied(state) {
    setCopied(state);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setCopied(""), 1800);
  }

  async function handleCopyLink() {
    const ok = await copyToClipboard(shareUrl);
    bumpCopied(ok ? "link" : "error");
  }

  async function handleCopyDiscord() {
    const ok = await copyToClipboard(discordText);
    bumpCopied(ok ? "discord" : "error");
  }

  function handleOpenShareImage() {
    try {
      if (typeof onOpenShareImage !== "function") return;
      onOpenShareImage();
    } catch (err) {
      bumpCopied("error");
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={handleCopyLink}
        aria-label="Copy wishlist link"
        className="inline-flex items-center justify-center rounded-[10px] bg-vault-accent px-4 py-2 text-sm font-semibold text-white hover:bg-vault-accentHover transition"
      >
        {copied === "link" ? "Copied!" : "Copy link"}
      </button>

      <button
        type="button"
        onClick={handleCopyDiscord}
        aria-label="Copy Discord-ready wishlist share text"
        className="inline-flex items-center justify-center rounded-[10px] bg-vault-surface px-4 py-2 text-sm font-semibold text-vault-text dark:text-white border border-vault-border hover:bg-vault-raised dark:hover:bg-vault-raised transition"
      >
        {copied === "discord" ? "Copied!" : "Copy Discord share"}
      </button>

      <button
        type="button"
        onClick={handleOpenShareImage}
        disabled={typeof onOpenShareImage !== "function"}
        aria-label="Preview & download wishlist share image"
        className={`
          inline-flex items-center justify-center rounded-[10px] px-4 py-2 text-sm font-semibold transition
          border border-vault-border
          ${
            typeof onOpenShareImage === "function"
              ? "bg-vault-surface text-vault-text dark:text-white hover:bg-vault-raised dark:hover:bg-vault-raised"
              : "bg-vault-raised text-vault-textTertiary cursor-not-allowed"
          }
        `}
      >
        Share image
      </button>

      {copied === "error" ? (
        <span className="text-sm font-semibold text-red-500">
          Couldn’t copy/export — try again
        </span>
      ) : null}
    </div>
  );
}
