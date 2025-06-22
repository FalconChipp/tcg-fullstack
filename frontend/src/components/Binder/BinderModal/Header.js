"use client";

import React from "react";
import { VIEW_MODES } from "@/utils/constants";

/**
 * BinderEditorHeader
 * - All colors replaced with Tailwind palette classes from your config.
 */
export default function BinderEditorHeader({
  binderName,
  setBinderName,
  currentLayout,
  setCurrentLayout,
  pages,
  rows,
  cols,
  viewMode,
  setViewMode,
  showShortcuts,
  setShowShortcuts,
  onClose,
  dark = false, // for logic if needed
}) {
  const totalSlotsPerPage = rows * cols;

  return (
    <>
      <div
        className={`
          flex items-center justify-between px-4 md:px-6 py-3 md:py-4 border-b sticky top-0 z-20
          bg-light-alt border-light-border
          dark:bg-dark-surface dark:border-dark-border
        `}
        style={{ backdropFilter: "blur(8px)" }}
      >
        {/* LEFT: Editable Title */}
        <div className="flex items-center space-x-4 flex-shrink min-w-0">
          <input
            type="text"
            value={binderName}
            onChange={(e) => setBinderName(e.target.value)}
            className={`
              text-lg md:text-xl font-bold transition-colors
              text-light-text bg-light-alt border-0 border-b-2 border-light-border focus:border-light-primary
              dark:text-dark-text dark:bg-dark-surface dark:border-dark-border dark:focus:border-dark-primary
              p-1 rounded-none focus:ring-0 truncate outline-none
            `}
            placeholder="Binder Name"
            maxLength={48}
          />
        </div>

        {/* RIGHT: Controls */}
        <div className="flex items-center gap-2 md:gap-4">
          {/* Layout selector */}
          <select
            value={currentLayout}
            onChange={(e) => {
              const [r, c] = e.target.value.split("x").map(Number);
              if (
                r * c < totalSlotsPerPage &&
                pages.some((pg) => pg.slice(r * c).some((slot) => slot !== null))
              ) {
                if (
                  !window.confirm(
                    "Changing to a smaller layout may drop cards off the end. Continue?"
                  )
                )
                  return;
              }
              setCurrentLayout(e.target.value);
            }}
            className={`
              hidden sm:inline-block px-3 py-1.5 rounded-xl border text-sm font-medium transition
              bg-light-surface border-light-border text-light-text focus:border-light-primary
              dark:bg-dark-alt dark:border-dark-border dark:text-dark-text dark:focus:border-dark-primary
            `}
            title="Change Binder Layout"
          >
            <option value="2x2">2×2</option>
            <option value="3x3">3×3</option>
            <option value="4x3">4×3</option>
          </select>

          {/* View mode toggles */}
          <div className="hidden sm:flex gap-1">
            {Object.values(VIEW_MODES).map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                title={`${mode.charAt(0).toUpperCase() + mode.slice(1)} View`}
                className={`
                  px-2 py-1 text-xs md:px-3 md:py-1.5 md:text-sm rounded-xl font-semibold transition
                  ${viewMode === mode
                    ? "bg-light-primary text-white shadow dark:bg-dark-primary dark:text-white"
                    : "bg-light-surface text-light-text hover:bg-light-border dark:bg-dark-alt dark:text-dark-text dark:hover:bg-dark-border dark:hover:text-white"
                  }
                `}
              >
                {mode.charAt(0).toUpperCase()}
              </button>
            ))}
          </div>

          {/* Shortcuts toggle */}
          <button
            onClick={() => setShowShortcuts((s) => !s)}
            title="Toggle Keyboard Shortcuts"
            className={`
              p-2 rounded-xl transition-colors
              text-light-text hover:bg-light-border
              dark:text-dark-text dark:hover:bg-dark-border dark:hover:text-white
            `}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18" />
            </svg>
          </button>

          {/* Close button */}
          <button
            onClick={onClose}
            title="Close Editor"
            className={`
              p-2 rounded-xl transition-colors
              text-light-text hover:bg-light-error/20 hover:text-light-error
              dark:text-dark-text dark:hover:bg-dark-error/10 dark:hover:text-dark-error
            `}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Shortcuts Panel */}
      {showShortcuts && (
        <div className={`
          px-4 py-4 border-b grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 text-xs md:text-sm
          bg-light-alt border-light-border text-light-text
          dark:bg-dark-surface dark:border-dark-border dark:text-dark-text
        `}>
          {[
            { title: 'Navigation', keys: [{ k: '←', d: 'Prev Page' }, { k: '→', d: 'Next Page' }] },
            { title: 'View Modes', keys: [{ k: 'G', d: 'Grid' }, { k: 'L', d: 'List' }, { k: 'C', d: 'Compact' }] },
            { title: 'Pages', keys: [{ k: 'Alt+N', d: 'New Page' }, { k: 'Del', d: 'Delete Page' }] },
            { title: 'Modal', keys: [{ k: 'Esc', d: 'Close Modal' }] }
          ].map((group) => (
            <div key={group.title}>
              <h3 className="font-semibold mb-2">{group.title}</h3>
              {group.keys.map(item => (
                <div key={item.k} className="flex items-center gap-2 mb-1">
                  <kbd className={`
                    px-1.5 py-0.5 rounded border font-mono text-xs font-bold
                    bg-light-surface text-light-text border-light-border
                    dark:bg-dark-alt dark:text-dark-text dark:border-dark-border
                  `}>{item.k}</kbd>
                  <span>{item.d}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
