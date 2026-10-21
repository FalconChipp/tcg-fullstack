// src/components/UI/ShareImageModal.js
// Generic preview modal for the gateway-rendered share images (wishlist, listing, trade).
// Shows the PNG exactly as it will be shared, with download / share / copy actions.

"use client";

import React, { useEffect, useRef, useState } from "react";
import { copyToClipboard } from "@/utils/wishlistShare";
import {
  canShareFiles,
  copyShareImage,
  downloadShareImage,
  shareImageNatively,
  withCacheBust,
} from "@/utils/shareImages";

const btnPrimary =
  "inline-flex items-center justify-center rounded-[10px] bg-[#2963FF] hover:bg-[#548DFF] px-4 py-2 text-sm font-extrabold text-white transition disabled:opacity-50";
const btnSecondary =
  "inline-flex items-center justify-center rounded-[10px] border border-white/15 bg-white/5 hover:bg-white/10 px-4 py-2 text-sm font-bold text-white/90 transition disabled:opacity-50";

/**
 * @param {object} props
 * @param {boolean} props.open
 * @param {function} props.onClose
 * @param {string} props.title        - modal heading, e.g. "Wishlist share image"
 * @param {string} props.imageUrl     - gateway share-image URL
 * @param {string} props.fileName     - download name, e.g. "TestUser2-wishlist.png"
 * @param {string} [props.link]       - page the image should point people to (optional)
 * @param {string} [props.shareText]  - text for the native share sheet
 */
export default function ShareImageModal({ open, onClose, title, imageUrl, fileName, link, shareText }) {
  const [state, setState] = useState("loading"); // loading | ready | error
  const [attempt, setAttempt] = useState(0);
  const [note, setNote] = useState({ kind: "", text: "" });
  const [busy, setBusy] = useState(false);
  const noteTimer = useRef(null);

  // Reset whenever the modal opens or the target image changes.
  useEffect(() => {
    if (!open) return;
    setState("loading");
    setAttempt(0);
    setNote({ kind: "", text: "" });
  }, [open, imageUrl]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e) => e.key === "Escape" && onClose?.();
    window.addEventListener("keydown", onKeyDown);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  useEffect(() => () => clearTimeout(noteTimer.current), []);

  if (!open) return null;

  const src = attempt ? withCacheBust(imageUrl, attempt) : imageUrl;
  const ready = state === "ready";

  function flash(kind, text) {
    setNote({ kind, text });
    clearTimeout(noteTimer.current);
    noteTimer.current = setTimeout(() => setNote({ kind: "", text: "" }), 2200);
  }

  async function run(fn, okText) {
    if (busy) return;
    setBusy(true);
    try {
      const result = await fn();
      if (result !== false && okText) flash("ok", okText);
    } catch (err) {
      flash("error", err?.message || "Something went wrong — try again");
    } finally {
      setBusy(false);
    }
  }

  const handleDownload = () => run(() => downloadShareImage(src, fileName), "Downloaded");
  const handleCopyImage = () => run(() => copyShareImage(src), "Image copied");
  const handleCopyLink = () =>
    run(async () => {
      const ok = await copyToClipboard(link || imageUrl);
      if (!ok) throw new Error("Couldn't copy the link");
    }, "Link copied");
  const handleShare = () =>
    run(() => shareImageNatively(src, { fileName, title, text: shareText, link }));

  return (
    <div className="fixed inset-0 z-[9999]">
      <button
        type="button"
        aria-label="Close share image modal"
        onClick={onClose}
        className="absolute inset-0 bg-black/70"
      />

      <div className="absolute inset-0 flex items-center justify-center p-4 pointer-events-none">
        <div className="pointer-events-auto w-full max-w-3xl rounded-[10px] border border-white/10 bg-[#0B1020]/95 backdrop-blur-xl overflow-hidden">
          <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-white/10">
            <div className="flex flex-col">
              <div className="text-sm font-extrabold text-white/90">{title}</div>
              <div className="text-xs font-semibold text-white/60">
                {state === "loading" ? "Rendering image…" : "This is exactly what will be shared"}
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center justify-center rounded-[10px] px-3 py-2 text-sm font-bold text-white/80 hover:text-white hover:bg-white/10 transition"
            >
              Close
            </button>
          </div>

          <div className="p-4 bg-[#070A14]">
            <div
              className="relative w-full overflow-hidden rounded-[10px] border border-white/10 bg-white/[0.03]"
              style={{ aspectRatio: "1200 / 630" }}
            >
              {state === "loading" && (
                <div className="absolute inset-0 flex items-center justify-center text-sm font-semibold text-white/50 animate-pulse">
                  Rendering…
                </div>
              )}
              {state === "error" && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center">
                  <p className="text-sm font-semibold text-red-400">
                    Couldn’t create this share image. It may have been removed or isn’t public.
                  </p>
                  <button
                    type="button"
                    className={btnSecondary}
                    onClick={() => {
                      setState("loading");
                      setAttempt((n) => n + 1);
                    }}
                  >
                    Try again
                  </button>
                </div>
              )}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                key={src}
                src={src}
                alt={title}
                crossOrigin="anonymous"
                onLoad={() => setState("ready")}
                onError={() => setState("error")}
                className={`h-full w-full object-contain transition-opacity ${ready ? "opacity-100" : "opacity-0"}`}
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-t border-white/10">
            <button type="button" onClick={handleDownload} disabled={!ready || busy} className={btnPrimary}>
              Download PNG
            </button>
            {canShareFiles() && (
              <button type="button" onClick={handleShare} disabled={!ready || busy} className={btnSecondary}>
                Share…
              </button>
            )}
            <button type="button" onClick={handleCopyImage} disabled={!ready || busy} className={btnSecondary}>
              Copy image
            </button>
            <button type="button" onClick={handleCopyLink} disabled={busy} className={btnSecondary}>
              {link ? "Copy link" : "Copy image link"}
            </button>
            {note.text ? (
              <span
                className={`text-sm font-semibold ${note.kind === "error" ? "text-red-400" : "text-emerald-400"}`}
                role="status"
              >
                {note.text}
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
