// frontend/src/components/Binder/BinderEditorModal.js
"use client";

import React, { useMemo, useState, useContext, useEffect } from "react";
import { devError } from "@/utils/devLog";
import { VIEW_MODES } from "@/utils/constants";
import BinderEditorHeader from "@/components/Binder/BinderModal/Header";
import PageGrid from "@/components/Binder/BinderModal/PageGrid";
import BinderNav from "@/components/Binder/BinderModal/Nav";
import CollectionTab from "@/components/Binder/BinderModal/CollectionTab";
import SearchTab from "@/components/Binder/BinderModal/SearchTab";
import { useBinderPages } from "@/hooks/useBinderPages";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import StatusMessage from "../UI/StatusMessage";
import BinderCover, { STANDARD_COLOURS } from "@/components/Binder/BinderCover";
import { AuthContext } from "@/components/Auth/AuthProvider";
import { executeMutation, COLLECTION_MUTATIONS } from "@/utils/graphqlUtils";
import { binderPagesTo2DArray } from "@/utils/binderPagesTo2DArray";
import { filterCollectionByBinderSlots } from "@/utils/filterCollectionByBinderSlots";

// ---- Debug toggle (set NEXT_PUBLIC_DEBUG=true to enable) ----
const DEBUG = process.env.NEXT_PUBLIC_DEBUG === 'true';
const dlog = (...args) => { if (DEBUG) console.debug("[BinderEditorModal]", ...args); };

export default function BinderEditorModal(props) {
  const {
    binder,
    settings,
    isOwnProfile,
    onSave,
    onClose,
    onCardAddedToBinder,
    userEntireCollection, // ← array from parent (profile page)
  } = props;

  // Initial logs on mount/prop change
  useEffect(() => {
    if (!DEBUG) return;
    console.groupCollapsed("[BinderEditorModal] props snapshot");
    console.debug("binder:", binder);
    console.debug("settings:", settings);
    console.debug("isOwnProfile:", isOwnProfile);
    console.debug("userEntireCollection length:", Array.isArray(userEntireCollection) ? userEntireCollection.length : "(not array)");
    console.groupEnd();
  }, [binder, settings, isOwnProfile, userEntireCollection]);

  // Memoize initial colors so they do not recalc on every render
  const initialCoverColor = useMemo(
    () => settings?.coverColor ?? binder?.coverColor ?? "#181822",
    [settings?.coverColor, binder?.coverColor]
  );
  const initialAccentColor = useMemo(
    () => settings?.accentColor ?? binder?.accentColor ?? "#7de95a",
    [settings?.accentColor, binder?.accentColor]
  );

  // Main binder state and handlers (see hook)
  const {
    binderName, setBinderName,
    binderValue,
    currentLayout, setCurrentLayout,
    rows, cols,
    viewMode, setViewMode,
    showShortcuts, setShowShortcuts,
    pages, setPages, currentPage,
    draggedPageIndex, hasUnsavedChanges,
    activeTab, setActiveTab,
    handlers,
    searchTerm, setSearchTerm,
    searchResults, setSearchResults,
    searchPage, setSearchPage,
    hasMoreResults, setHasMoreResults,
    collection, // may be seeded from userEntireCollection by the hook
    movedCards, setMovedCards,
    statusMessage, setStatusMessage,
    coverColor, setCoverColor,
    accentColor, setAccentColor,
  } = useBinderPages({
    binder,
    settings,
    isOwnProfile,
    onSave,
    onClose,
    onCardAddedToBinder,
    userEntireCollection, // pass through to seed the hook
    coverColor: initialCoverColor,
    accentColor: initialAccentColor
  });

  const { token } = useContext(AuthContext);

  // Color picker modal
  const [showCoverPicker, setShowCoverPicker] = useState(false);

  // Prefer the prop if it already contains cards; otherwise fall back to the hook’s array
  const sourceCollection = useMemo(() => {
    const picked = (Array.isArray(userEntireCollection) && userEntireCollection.length)
      ? userEntireCollection
      : (Array.isArray(collection) ? collection : []);
    if (DEBUG) {
      console.groupCollapsed("[BinderEditorModal] sourceCollection decision");
      console.debug("userEntireCollection length:", Array.isArray(userEntireCollection) ? userEntireCollection.length : "(not array)");
      console.debug("hook.collection length:", Array.isArray(collection) ? collection.length : "(not array)");
      console.debug("→ using sourceCollection length:", picked.length);
      console.groupEnd();
    }
    return picked;
  }, [userEntireCollection, collection]);

  // Find color object for the name display in nav
  const colorObj = STANDARD_COLOURS.find(
    c => c.color === coverColor && c.accent === accentColor
  );

  // Compute grid columns for CollectionTab
  const gridColumns = viewMode === VIEW_MODES.COMPACT ? cols + 1 : cols;

  useKeyboardShortcuts({
    handlers,
    currentPage,
    setViewMode,
    onClose,
  });

  // Only filter by slots for the sidebar collection view
  const filteredCollection = useMemo(() => {
    const result = filterCollectionByBinderSlots(sourceCollection, pages);
    if (DEBUG) {
      console.groupCollapsed("[BinderEditorModal] filteredCollection");
      console.debug("pages.length:", pages?.length);
      console.debug("sourceCollection.length:", sourceCollection?.length);
      console.debug("filteredCollection.length:", result?.length);
      if (result?.length === 0 && sourceCollection?.length > 0) {
        console.debug("NOTE: Filter produced 0 but source had items. Keys may not match (variation/condition/id).");
      }
      console.groupEnd();
    }
    return result;
  }, [sourceCollection, pages]);

  // ======================
  // BATCH SAVE LOGIC BELOW
  // ======================
  async function handleSaveBinder() {
    setStatusMessage({ type: "info", message: "Saving binder..." });

    // Build the pages and slots structure for the mutation input
    const inputPages = pages.map((page, idx) => {
      const slots = page
        .map((slot, position) =>
          slot
            ? {
                id: slot.id,
                cardId: slot.cardId,
                quantity: slot.quantity,
                position,
                notes: slot.notes,
              }
            : null
        )
        .filter(Boolean);

      return {
        id: page.id,
        title: page.title,
        layout: page.layout || currentLayout,
        pageOrder: idx,
        slots,
      };
    });

    try {
      const binderId = binder?.id;
      if (!binderId) throw new Error("No binder ID to save!");
      if (DEBUG) {
        console.groupCollapsed("[BinderEditorModal] SAVE payload");
        console.debug("binderId:", binderId);
        console.debug("inputPages:", inputPages);
        console.groupEnd();
      }

      const res = await executeMutation(
        COLLECTION_MUTATIONS.SAVE_BINDER_PAGES_AND_SLOTS,
        { binderId, pages: inputPages },
        token
      );

      setStatusMessage({ type: "success", message: "Binder saved!" });

      if (res?.saveBinderPagesAndSlots) {
        setPages(binderPagesTo2DArray(res.saveBinderPagesAndSlots.pages, rows * cols));
      }
      if (typeof onSave === "function") {
        onSave(res?.saveBinderPagesAndSlots);
      }
      return true;
    } catch (err) {
      setStatusMessage({ type: "error", message: err.message || "Failed to save binder." });
      if (DEBUG) devError("[BinderEditorModal] SAVE error:", err);
      return false;
    }
  }

  // Trace key UI state each render (collapsed)
  if (DEBUG) {
    console.groupCollapsed("[BinderEditorModal] render");
    console.debug("activeTab:", activeTab, "| layout:", currentLayout, "| rows x cols:", rows, "x", cols);
    console.debug("pages:", pages);
    console.debug("movedCards keys:", Object.keys(movedCards || {}).length);
    console.debug("sourceCollection.length:", sourceCollection.length, "| filteredCollection.length:", filteredCollection.length);
    console.groupEnd();
  }

  // --- Render
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
      style={{ minHeight: "100vh", minWidth: "100vw" }}
      onClick={onClose}
    >
      <div
        className={`
          relative flex flex-col w-full h-full max-w-none max-h-none
          bg-light-background dark:bg-dark-background
          rounded-none shadow-2xl overflow-hidden
        `}
        onClick={e => e.stopPropagation()}
      >
        {/* Status Message always top */}
        {statusMessage && (
          <StatusMessage
            type={statusMessage.type}
            message={statusMessage.message}
            onClose={() => setStatusMessage(null)}
          />
        )}

        {/* HEADER */}
        <BinderEditorHeader
          binderName={binderName}
          setBinderName={setBinderName}
          currentLayout={currentLayout}
          setCurrentLayout={setCurrentLayout}
          pages={pages}
          rows={rows}
          cols={cols}
          viewMode={viewMode}
          setViewMode={setViewMode}
          showShortcuts={showShortcuts}
          setShowShortcuts={setShowShortcuts}
          onClose={onClose}
          onSave={handleSaveBinder}
        />

        {/* MAIN BODY */}
        <div className="grid grid-cols-3 gap-8 w-full h-full min-h-0">
          {/* Slots/pages section: 2/3 */}
          <div className="col-span-2 min-h-0 flex flex-col overflow-y-auto">
            <PageGrid
              pages={pages}
              currentPage={currentPage}
              handlers={handlers}
              cols={cols}
              totalSlots={rows * cols}
              viewMode={viewMode}
              isOwnProfile={isOwnProfile}
              // Always give slot hydration the *unfiltered* source
              userCollection={sourceCollection}
            />
          </div>

          {/* Side tab: 1/3 */}
          <div className="col-span-1 min-h-0 flex flex-col overflow-y-auto">
            {/* Tab Switcher */}
            <div
              className="
                flex mb-4 border-b
                border-light-border dark:border-dark-border
                bg-transparent
              "
            >
              <button
                onClick={() => setActiveTab("collection")}
                className={`
                  flex-1 px-4 py-2 text-sm font-medium focus:outline-none transition-colors
                  ${activeTab === "collection"
                    ? "border-b-2 border-light-accent dark:border-dark-accent text-light-accent dark:text-dark-accent"
                    : "text-light-textMuted dark:text-dark-textMuted hover:text-light-accent"
                  }
                `}
              >
                Collection
              </button>
              <button
                onClick={() => setActiveTab("search")}
                className={`
                  flex-1 px-4 py-2 text-sm font-medium focus:outline-none transition-colors
                  ${activeTab === "search"
                    ? "border-b-2 border-light-accent dark:border-dark-accent text-light-accent dark:text-dark-accent"
                    : "text-light-textMuted dark:text-dark-textMuted hover:text-light-accent"
                  }
                `}
              >
                Search
              </button>
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-y-auto">
              {activeTab === "collection" ? (
                <CollectionTab
                  isOwnProfile={isOwnProfile}
                  // Filtered view for the sidebar (subtract cards already in slots)
                  userEntireCollection={filteredCollection}
                  gridColumns={gridColumns}
                  movedCards={movedCards}
                  setMovedCards={setMovedCards}
                />
              ) : (
                <SearchTab
                  isOwnProfile={isOwnProfile}
                  searchTerm={searchTerm}
                  onSearchTermChange={setSearchTerm}
                  searchResults={searchResults}
                  onSearchResultsChange={setSearchResults}
                  searchPage={searchPage}
                  onSearchPageChange={setSearchPage}
                  hasMoreResults={hasMoreResults}
                  onHasMoreResultsChange={setHasMoreResults}
                  onDragStart={handlers.handleCardDropped}
                />
              )}
            </div>
          </div>
        </div>

        {/* NAVIGATION (page dots/buttons) */}
        <BinderNav
          pages={pages}
          currentPage={currentPage}
          draggedPageIndex={draggedPageIndex}
          hasUnsavedChanges={hasUnsavedChanges}
          handlers={{
            ...handlers,
            handleSaveBinder, // Only use the local batch save handler!
          }}
          isOwnProfile={isOwnProfile}
          onClose={onClose}
          coverColor={coverColor}
          accentColor={accentColor}
          colorName={colorObj?.name || ""}
          onEditCover={() => setShowCoverPicker(true)}
        />

        {/* COVER PICKER MODAL */}
        {showCoverPicker && (
          <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/60">
            <div className="bg-light-surface dark:bg-dark-surface p-8 rounded-2xl max-w-2xl w-full shadow-2xl border border-light-border dark:border-dark-border">
              <h3 className="text-xl font-bold mb-4 text-center">Choose Binder Colour</h3>
              <div className="max-h-72 overflow-y-auto overflow-x-hidden pr-2">
                <div className="grid grid-cols-3 gap-4">
                  {STANDARD_COLOURS.map((c) => (
                    <button
                      key={c.name}
                      type="button"
                      className={`relative rounded-lg p-1 border-2 transition focus:outline-none ${
                        coverColor === c.color && accentColor === c.accent
                          ? "border-light-accent dark:border-dark-accent ring-2 ring-light-accent dark:ring-dark-accent"
                          : "border-transparent"
                      }`}
                      onClick={() => {
                        setCoverColor(c.color);
                        setAccentColor(c.accent);
                        setShowCoverPicker(false);
                      }}
                      aria-label={c.name}
                    >
                      <BinderCover color={c.color} accent={c.accent} text="SixByFive" />
                      <span className="block text-xs text-center mt-1">{c.name}</span>
                      {coverColor === c.color && accentColor === c.accent && (
                        <span className="absolute top-2 right-2 rounded-full bg-light-accent dark:bg-dark-accent p-1 flex items-center justify-center shadow">
                          <svg width="15" height="15" viewBox="0 0 20 20" fill="none">
                            <circle cx="10" cy="10" r="9" fill="#fff" opacity="0.9" />
                            <path d="M7 10.5L9.5 13L13 8" stroke="#22C55E" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex justify-end mt-6">
                <button
                  type="button"
                  onClick={() => setShowCoverPicker(false)}
                  className="px-5 py-2 font-semibold rounded-xl shadow transition bg-light-alt text-light-text hover:bg-light-border dark:bg-dark-alt dark:text-dark-text dark:hover:bg-dark-border"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
