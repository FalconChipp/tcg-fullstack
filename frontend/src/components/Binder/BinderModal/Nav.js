import React from "react";
import BinderCover from "@/components/Binder/BinderCover";

export default function BinderNav({
  pages,
  currentPage,
  handlers,
  isOwnProfile = false,
  hasUnsavedChanges = false,
  onClose = () => {},
  coverColor,
  accentColor,
  colorName = "",
  onEditCover = () => {},
}) {
  // Await save before closing
  const handleSaveAndClose = async () => {
    const result = await handlers.handleSaveBinder();
    if (result) onClose();
  };

  return (
    <nav
      className={`
        flex flex-wrap items-center gap-2 py-3 px-4 border-t
        bg-light-alt border-light-border
        dark:bg-dark-surface dark:border-dark-border
      `}
      aria-label="Binder Toolbar and Page Navigation"
    >
      {/* -- Action Buttons (left) -- */}
      <button
        className={`
          px-3 py-1 rounded-xl font-medium
          bg-light-primary text-white
          disabled:bg-light-border dark:disabled:bg-dark-border
          transition
        `}
        onClick={handlers.addPage}
        disabled={!isOwnProfile}
      >
        + Add Page
      </button>
      <button
        className={`
          px-3 py-1 rounded-xl font-medium
          bg-light-error text-white
          disabled:bg-light-border dark:disabled:bg-dark-border
          transition
        `}
        onClick={() => handlers.deletePage(currentPage)}
        disabled={!isOwnProfile || pages.length <= 1}
      >
        Delete Page
      </button>

      {/* -- Binder Colour Button (centered, only if own profile) -- */}
      {isOwnProfile && (
        <button
          type="button"
          onClick={onEditCover}
          className={`
            px-4 py-1 rounded-xl border border-light-border dark:border-dark-border
            bg-light-surface dark:bg-dark-alt
            hover:bg-light-accentLight hover:border-light-accent
            dark:hover:bg-dark-accentLight dark:hover:border-dark-accent
            shadow transition ml-6 mr-4
            font-semibold text-sm capitalize
          `}
          title="Change Binder Colour"
        >
          Binder Cover: {colorName || "Colour"}
        </button>
      )}
      <button
        className={`
          ml-auto px-4 py-1 rounded-xl font-bold
          bg-light-success text-white
          disabled:bg-light-border dark:disabled:bg-dark-border
          transition
        `}
        onClick={handlers.handleSaveBinder}
        disabled={!hasUnsavedChanges}
        title="Save Binder"
      >
        Save
      </button>
      <button
        className={`
          px-4 py-1 rounded-xl font-bold
          bg-light-success text-white
          disabled:bg-light-border dark:disabled:bg-dark-border
          transition
        `}
        onClick={handleSaveAndClose}
        disabled={!hasUnsavedChanges}
        title="Save & Close Binder"
      >
        Save & Close
      </button>

      {/* -- Page Nav Buttons (right) -- */}
      <div className="flex flex-wrap gap-2 ml-6">
        {pages.map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => handlers.setCurrentPage(i)}
            draggable
            tabIndex={0}
            aria-label={`Go to page ${i + 1}`}
            aria-current={currentPage === i ? "page" : undefined}
            onDragStart={e => handlers.handlePageNavDragStart(e, i)}
            onDragOver={handlers.handlePageNavDragOver}
            onDrop={e => handlers.handlePageNavDrop(e, i)}
            className={`
              px-3 py-1.5 rounded-xl font-bold text-sm transition-colors border-2
              ${
                currentPage === i
                  ? "bg-light-primary border-light-primary text-white shadow"
                  : "bg-light-surface border-light-border text-light-text hover:bg-light-accentLight hover:border-light-accent"
              }
              dark:${
                currentPage === i
                  ? "bg-dark-primary border-dark-primary text-white shadow"
                  : "bg-dark-alt border-dark-border text-dark-text hover:bg-dark-accentLight hover:border-dark-accent"
              }
              focus:outline-none focus:ring-2 focus:ring-light-accent dark:focus:ring-dark-accent
              cursor-pointer select-none
            `}
          >
            {i + 1}
          </button>
        ))}
      </div>
    </nav>
  );
}
