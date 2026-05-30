"use client";

import React, { useEffect } from "react";
import ProfileListingsPanel from "@/components/UserProfile/ProfileListingsPanel";

export default function MyListingsDrawer({ open, onClose, token, onCreateListing }) {
  // Prevent body scroll while drawer is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function onKey(e) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <>
      {/* Backdrop */}
      <div
        className={[
          "fixed inset-0 z-40 bg-black/50 backdrop-blur-sm transition-opacity duration-300",
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none",
        ].join(" ")}
        aria-hidden="true"
        onClick={onClose}
      />

      {/* Drawer panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="My Listings"
        className={[
          "fixed top-0 right-0 z-50 h-full w-full max-w-xl",
          "bg-[#0d0f17] border-l border-white/[0.08] shadow-2xl",
          "flex flex-col",
          "transition-transform duration-300 ease-in-out",
          open ? "translate-x-0" : "translate-x-full",
        ].join(" ")}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06] shrink-0">
          <div>
            <h2 className="text-sm font-semibold text-neutral-100">My Listings</h2>
            <p className="text-xs text-neutral-500 mt-0.5">Manage listings and submit proof photos.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="w-8 h-8 rounded-full flex items-center justify-center text-neutral-500 hover:text-neutral-100 hover:bg-white/[0.08] transition"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content — scrollable */}
        <div className="flex-1 overflow-y-auto px-5 py-5">
          {open && (
            <ProfileListingsPanel
              isOwnProfile={true}
              token={token}
              compact={true}
              fixedStatus="ACTIVE"
              onCreateListing={onCreateListing}
            />
          )}
        </div>
      </div>
    </>
  );
}
