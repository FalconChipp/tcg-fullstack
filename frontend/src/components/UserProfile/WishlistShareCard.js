// src/components/Wishlist/WishlistShareCard.js
// UPDATED (2026-01-11):
// - FIX: Proper footer strip (separate row) that ALWAYS sits at the bottom-right.
//   - Outer layout: [MAIN (minmax(0,1fr))] + [FOOTER (fixed height)]
//   - Footer no longer steals space from the pinned grid.
//
// - FIX: Left "Top wants" list NEVER overflows (WITHOUT overflow-hidden):
//   - Uses a fixed-row grid for EXACTLY MAX_HIGHLIGHTS rows
//   - Each row is minmax(0,1fr) so it always fits
//   - Each item is a flex row with line-clamp-1 so text can’t blow the height
//
// - FIX: Right header ("Pinned") no longer wastes height:
//   - Dedicated small header row with a tight line-height
//   - Pinned grid gets the rest of the column (flex-1 + min-h-0)
//
// - Keeps: Right side is a TRUE 2x2 grid of 4 identical tiles.
// - Keeps: Blurred background + foreground object-contain (no cropping).
// - Export-safe: plain <img>, no Next/Image.

import React, { forwardRef, useMemo } from "react";

function cleanStr(v) {
  return typeof v === "string" ? v.trim() : "";
}

function prettyStatus(status) {
  const s = cleanStr(status);
  if (!s) return "Wishlist";

  const map = {
    ACTIVE: "Active Hunt",
    GRAIL: "Grail Board",
    EVENTUAL: "Someday List",
    UPGRADE: "Upgrade Targets",
  };
  return map[s] || s;
}

function formatHighlight(card) {
  const name = cleanStr(card?.name) || "Unknown card";
  const setLabel = cleanStr(card?.setLabel) || cleanStr(card?.setName);
  const number =
    card?.number !== undefined && card?.number !== null ? String(card.number).trim() : "";

  const suffix = [setLabel || "", number ? `#${number}` : ""].filter(Boolean).join(" ");
  return suffix ? `${name} — ${suffix}` : name;
}

/**
 * Pinned tile:
 * - blurred background fill so the tile looks “full”
 * - foreground object-contain so card isn’t cropped
 * - consistent sizing across all 4 tiles
 */
function PinnedTile({ card }) {
  const src = cleanStr(card?.shareImageUrl);
  const title = cleanStr(card?.name) || "—";
  const meta = `${cleanStr(card?.setLabel)}${card?.number ? ` #${card.number}` : ""}`.trim();

  return (
    <div
      className="h-full w-full rounded-[14px] border border-white/15 bg-white/10 overflow-hidden relative"
      style={{
        backdropFilter: "blur(10px)",
        boxShadow: "0 20px 60px rgba(0,0,0,0.35)",
      }}
    >
      {src ? (
        <>
          {/* Blurred background fill */}
          <img
            src={src}
            alt=""
            crossOrigin="anonymous"
            className="absolute inset-0 w-full h-full object-cover"
            style={{
              filter: "blur(16px)",
              transform: "scale(1.35)",
              opacity: 0.55,
            }}
          />
          <div className="absolute inset-0 bg-black/25" />

          {/* Foreground card (no crop) */}
          <div className="absolute inset-0 flex items-center justify-center">
            <img
              src={src}
              alt={title}
              crossOrigin="anonymous"
              className="w-full h-full object-contain"
              style={{
                transform: "scale(1.18)",
                transformOrigin: "center",
              }}
            />
          </div>

          {/* Label fade */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />

          {/* Label */}
          <div className="absolute left-3 right-3 bottom-3">
            <div className="rounded-[10px] border border-white/15 bg-black/35 px-3 py-2">
              <div className="text-xs font-extrabold leading-tight truncate">{title}</div>
              <div className="mt-0.5 text-[11px] font-semibold opacity-90 truncate">{meta}</div>
            </div>
          </div>
        </>
      ) : (
        <div className="absolute inset-0 flex items-center justify-center text-sm font-bold opacity-70">
          —
        </div>
      )}
    </div>
  );
}

const WishlistShareCard = forwardRef(function WishlistShareCard(
  { username, status, setLabel, count, topCards = [], avatarUrl },
  ref
) {
  const boardLabel = useMemo(() => prettyStatus(status), [status]);
  const safeUser = cleanStr(username) || "User";
  const safeSet = cleanStr(setLabel);
  const safeAvatar = cleanStr(avatarUrl);

  // CHANGED: fixed number of highlight rows so it can NEVER overflow.
  const MAX_HIGHLIGHTS = 4;

  const highlights = useMemo(() => {
    if (!Array.isArray(topCards)) return [];
    return topCards.slice(0, MAX_HIGHLIGHTS).map(formatHighlight);
  }, [topCards]);

  const pinned = useMemo(() => {
    if (!Array.isArray(topCards)) return [];
    return topCards.slice(0, 4);
  }, [topCards]);

  // CHANGED: real footer height (keeps bottom spacing consistent)
  const FOOTER_H = 52;

  return (
    <div
      ref={ref}
      style={{ width: 1200, height: 630 }}
      className="relative overflow-hidden rounded-[32px] text-white"
    >
      {/* Background */}
      <div
        className="absolute inset-0"
        style={{
          background: "linear-gradient(135deg, #0B1020 0%, #0F1B3D 45%, #0B1020 100%)",
        }}
      />

      {/* Glow blobs */}
      <div
        className="absolute -top-40 -left-40 h-[520px] w-[520px] rounded-[6px] opacity-35 blur-3xl"
        style={{
          background: "radial-gradient(circle at 30% 30%, #2963FF 0%, transparent 60%)",
        }}
      />
      <div
        className="absolute -bottom-52 -right-52 h-[620px] w-[620px] rounded-[6px] opacity-30 blur-3xl"
        style={{
          background: "radial-gradient(circle at 30% 30%, #548DFF 0%, transparent 60%)",
        }}
      />

      {/* OUTER: MAIN + FOOTER */}
      <div className="relative h-full w-full p-10 grid grid-rows-[minmax(0,1fr)_auto] gap-0">
        {/* MAIN */}
        <div className="min-h-0 grid grid-cols-12 gap-6">
          {/* LEFT */}
          <div className="col-span-5 min-h-0 flex flex-col">
            {/* Brand bar */}
            <div className="flex items-center gap-4">
              {safeAvatar ? (
                <div
                  className="h-20 w-20 rounded-[10px] overflow-hidden border border-white/15"
                  style={{
                    boxShadow: "0 18px 60px rgba(0,0,0,0.35)",
                    backdropFilter: "blur(10px)",
                  }}
                >
                  <img
                    src={safeAvatar}
                    alt={`${safeUser} avatar`}
                    crossOrigin="anonymous"
                    referrerPolicy="no-referrer"
                    decoding="sync"
                    className="h-full w-full object-cover"
                  />
                </div>
              ) : (
                <div
                  className="h-14 w-14 rounded-[10px] "
                  style={{
                    background: "linear-gradient(135deg, #2963FF 0%, #548DFF 100%)",
                    boxShadow: "0 18px 60px rgba(41,99,255,0.35)",
                  }}
                />
              )}

              <div className="flex flex-col">
                <div className="text-base font-extrabold opacity-95">SixByFive TCG</div>
                <div className="text-sm font-semibold opacity-75">Wishlist Share</div>
              </div>
            </div>

            {/* Content area */}
            <div className="mt-8 min-h-0 flex flex-col">
              {/* Title block */}
              <div>
                <div className="text-6xl font-black leading-[1.05] tracking-[-1px]">
                  {safeUser}'s
                </div>
                <div className="mt-2 text-2xl font-extrabold opacity-95">{boardLabel}</div>

                <div className="mt-2 flex items-center gap-3 text-base font-semibold opacity-85">
                  {typeof count === "number" ? <span>{count} cards</span> : null}
                  {safeSet ? <span>•</span> : null}
                  {safeSet ? <span>{safeSet}</span> : null}
                </div>
              </div>

              {/* List */}
              <div className="mt-8 min-h-0 flex flex-col">
                <div className="text-sm font-extrabold opacity-80 mb-2">Top wants</div>

                {/* CHANGED:
                    - Fixed number of rows prevents overflow
                    - Each row gets equal height */}
                <div
                  className="min-h-0 grid gap-2"
                  style={{ gridTemplateRows: `repeat(${MAX_HIGHLIGHTS}, minmax(0, 1fr))` }}
                >
                  {Array.from({ length: MAX_HIGHLIGHTS }).map((_, idx) => {
                    const line = highlights[idx] || "";

                    return (
                      <div
                        key={idx}
                        className="h-full rounded-[10px] border border-white/15 bg-white/10 px-4 py-2.5 text-[15px] font-semibold flex items-center"
                        style={{ backdropFilter: "blur(10px)" }}
                      >
                        {/* CHANGED: clamp to 1 line so text never increases height */}
                        <div className="line-clamp-1">{line || "\u00A0"}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT */}
          {/* CHANGED:
              - Use a 2-row layout: tiny header + flexible grid
              - Stops the "Pinned" label from consuming a chunky block of height */}
          <div className="col-span-7 min-h-0 grid grid-rows-[auto_minmax(0,1fr)]">
            {/* Right header (tight) */}
            <div className="flex items-start justify-end">
              <div className="text-sm font-extrabold opacity-80 leading-none">Pinned</div>
            </div>

            {/* Pinned grid fills remaining height */}
            <div className="min-h-0 pt-4">
              <div className="h-full grid grid-cols-2 grid-rows-2 gap-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <PinnedTile key={i} card={pinned[i]} />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* FOOTER STRIP */}
        {/* CHANGED:
            - Fixed height footer
            - Add a little bottom padding so it sits nicely off the edge */}
        <div
          className="flex items-end justify-end"
          style={{ height: FOOTER_H, paddingBottom: 2 }}
        >
          <div className="text-right text-sm font-bold opacity-85">tcg.sixbyfive.com</div>
        </div>
      </div>
    </div>
  );
});

export default WishlistShareCard;
