// src/components/Wishlist/WishlistShareImageModal.js
// UPDATED (2026-01-11):
// - Fetch avatar via /api/user-avatar?username=...
// - Use img-proxy + cache-bust so export always includes avatar
// - This avoids relying on any existing avatarUrl prop

"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import WishlistShareCard from "./WishlistShareCard";
import { exportNodeToPng } from "@/utils/exportNodeToPng";

export default function WishlistShareImageModal({
  open,
  onClose,
  username,
  status,
  setLabel,
  count,
  topCards,
  // avatarUrl prop no longer needed, but you can keep it as a fallback if you want
}) {
  const shareRef = useRef(null);

  const [resolvedAvatar, setResolvedAvatar] = useState("");
  const [avatarLoading, setAvatarLoading] = useState(false);

  // Close on ESC
  useEffect(() => {
    if (!open) return;
    function onKeyDown(e) {
      if (e.key === "Escape") onClose?.();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  // Body scroll lock while modal open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // NEW: resolve avatar from backend when modal opens
  useEffect(() => {
    if (!open) return;

    let alive = true;

    async function run() {
      try {
        const u = typeof username === "string" ? username.trim() : "";
        if (!u) {
          if (alive) setResolvedAvatar("");
          return;
        }

        if (alive) setAvatarLoading(true);

        const r = await fetch(`/api/user-avatar?username=${encodeURIComponent(u)}`, {
          cache: "no-store",
        });

        if (!r.ok) {
          if (alive) setResolvedAvatar("");
          return;
        }

        const data = await r.json();
        const raw = typeof data?.avatar === "string" ? data.avatar.trim() : "";

        if (!raw) {
          if (alive) setResolvedAvatar("");
          return;
        }

        // IMPORTANT: same-origin proxy + cachebust to avoid 304 weirdness during export
        const cb = Date.now();
        const proxied = `/api/img-proxy?url=${encodeURIComponent(raw)}&cb=${cb}`;

        if (alive) setResolvedAvatar(proxied);
      } catch (e) {
        if (alive) setResolvedAvatar("");
      } finally {
        if (alive) setAvatarLoading(false);
      }
    }

    run();
    return () => {
      alive = false;
    };
  }, [open, username]);

  const fileName = useMemo(() => {
    const safe = typeof username === "string" && username.trim() ? username.trim() : "wishlist";
    return `${safe}-wishlist.png`;
  }, [username]);

  async function handleDownload() {
    const node = shareRef.current;
    if (!node) return;

    await exportNodeToPng(node, { fileName, pixelRatio: 2 });
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[9999]">
      <button
        type="button"
        aria-label="Close share image modal"
        onClick={onClose}
        className="absolute inset-0 bg-black/70"
      />

      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="w-full max-w-7xl rounded-2xl border border-white/10 bg-black/40 backdrop-blur-xl shadow-2xl overflow-hidden">
          <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-white/10">
            <div className="flex flex-col">
              <div className="text-sm font-extrabold text-white/90">Wishlist share image</div>
              <div className="text-xs font-semibold text-white/60">
                {avatarLoading ? "Loading avatar…" : "Preview + download PNG"}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleDownload}
                className="inline-flex items-center justify-center rounded-xl bg-[#2963FF] hover:bg-[#548DFF] px-4 py-2 text-sm font-extrabold text-white transition"
              >
                Download PNG
              </button>

              <button
                type="button"
                onClick={onClose}
                className="inline-flex items-center justify-center rounded-xl px-3 py-2 text-sm font-bold text-white/80 hover:text-white hover:bg-white/10 transition"
              >
                Close
              </button>
            </div>
          </div>

          <div className="p-4 bg-[#070A14]">
            <div className="w-full overflow-x-auto">
              <div className="min-w-[1200px] flex justify-center">
                <WishlistShareCard
                  ref={shareRef}
                  username={username}
                  status={status}
                  setLabel={setLabel}
                  count={count}
                  topCards={topCards}
                  avatarUrl={resolvedAvatar} // ✅ now comes from GraphQL->proxy
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
