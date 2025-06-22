"use client";
import React from "react";
import PageGrid from "@/components/Binder/BinderModal/PageGrid";
import Image from "next/image";

// Helper to build slot grid from flat array
function buildSlotsForPage(pages, currentPage, rows, cols) {
  const slotsPerPage = rows * cols;
  const slots = Array(slotsPerPage).fill(null);
  if (!Array.isArray(pages)) return slots;
  pages
    .filter(card => (card.page === (currentPage + 1)))
    .forEach(card => {
      // Positions are usually 1-based; convert to 0-based
      const idx = (card.position ?? 1) - 1;
      if (idx >= 0 && idx < slotsPerPage) slots[idx] = card;
    });
  return slots;
}

export default function BinderViewModal({ binder, onClose }) {
  if (!binder) return null;
  const { name, layout, pages, coverImageUrl, description } = binder;
  const safeLayout = typeof layout === "string" && layout.includes("x") ? layout : "3x3";
  const [rows, cols] = safeLayout.split("x").map(Number);
  const currentPage = 0; // Show first page only

  // Build slots for the first page
  const slots = buildSlotsForPage(pages, currentPage, rows, cols);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70" onClick={onClose}>
      <div
        className="
          relative bg-[#222234] dark:bg-[#181822] rounded-2xl shadow-2xl w-full max-w-4xl
          max-h-[90vh] flex flex-col overflow-y-auto
        "
        onClick={e => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          className="absolute top-5 right-5 z-10 p-2 rounded-full bg-[#272744] hover:bg-[#372e58] transition"
          onClick={onClose}
          title="Close"
        >
          <svg width={20} height={20} viewBox="0 0 20 20" stroke="currentColor" fill="none">
            <line x1="4" y1="4" x2="16" y2="16" stroke="currentColor" strokeWidth="2" />
            <line x1="16" y1="4" x2="4" y2="16" stroke="currentColor" strokeWidth="2" />
          </svg>
        </button>
        {/* Header with cover, name, desc */}
        <div className="flex flex-col sm:flex-row items-center gap-4 bg-gradient-to-r from-[#282246] to-[#23233b] p-6">
          <div className="w-[100px] h-[140px] rounded-xl overflow-hidden border-2 border-[#6842ba] flex-shrink-0 flex items-center justify-center bg-[#181822]">
            <Image
              src={coverImageUrl || "https://placehold.co/100x140?text=Binder"}
              alt={name}
              width={100}
              height={140}
              className="object-cover"
            />
          </div>
          <div className="flex-1 flex flex-col items-start">
            <h3 className="text-2xl font-bold text-[#d9cfff]">{name}</h3>
            <span className="text-sm text-[#a7a7b7] mt-1">
              {description || <span className="italic text-[#888]">No description</span>}
            </span>
            <span className="text-xs text-[#cac8e2] mt-2">
              {pages?.length || 0} cards • {rows * cols} slots/page
            </span>
          </div>
        </div>
        {/* Pages grid - view only */}
        <div className="p-6 bg-[#23233b] rounded-b-2xl overflow-x-auto">
          <PageGrid
            slots={slots}
            currentPage={currentPage}
            handlers={{}}
            cols={cols}
            totalSlots={rows * cols}
            viewMode={'grid'}
            isOwnProfile={false}
          />
        </div>
      </div>
    </div>
  );
}
