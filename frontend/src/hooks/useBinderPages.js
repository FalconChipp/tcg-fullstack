import { useRef, useState, useCallback, useEffect, useContext } from 'react';
import { deepClonePages } from '../utils/deepClonePages';
import { getCardKey } from '@/utils/cardUtils';
import { AuthContext } from '@/components/Auth/AuthProvider';
import { slotsTo2DArray } from '@/utils/slotsTo2DArray';
// ADDED: Import uuid for unique slot IDs
import { v4 as uuidv4 } from "uuid";

/**
 * useBinderPages: Handles all binder editing state, including movedCards,
 * but no longer exposes any save handler.
 */
export function useBinderPages({
  binder,
  settings,
  isOwnProfile,
  onSave,
  onClose,
  onCardAddedToBinder,
  userEntireCollection,
  coverColor: initialCoverColor,
  accentColor: initialAccentColor
}) {
  // ---- GET AUTH TOKEN (adjust if you use a different context) ----
  const { token } = useContext(AuthContext);

  // Layout setup
  const defaultLayout = '3x3';
  const newLayout = settings?.layout || defaultLayout;
  const initialLayout = binder?.layout || newLayout;
  const [currentLayout, setCurrentLayout] = useState(initialLayout);
  const [rows, cols] = currentLayout.split('x').map(Number);
  const totalSlots = rows * cols;

  // ----- Binder Cover and Accent Color State -----
  const [coverColor, setCoverColor] = useState(
    initialCoverColor ?? binder?.coverColor ?? "#181822"
  );
  const [accentColor, setAccentColor] = useState(
    initialAccentColor ?? binder?.accentColor ?? "#7de95a"
  );

  // Main state
  const [pages, setPages] = useState(() => {
    if (binder?.pages?.length) {
      if (Array.isArray(binder.pages[0])) return binder.pages;
      return slotsTo2DArray(binder.pages, binder.slotsPerPage || totalSlots);
    }
    return [Array(totalSlots).fill(null)];
  });
  const [binderName, setBinderName] = useState(
    (typeof binder?.name === "string" && binder?.name.length > 0)
      ? binder.name
      : (typeof settings?.name === "string" && settings.name.length > 0)
        ? settings.name
        : "My New Binder"
  );
  const [binderDescription, setBinderDescription] = useState(binder?.description || settings?.description || '');
  const [currentPage, setCurrentPage] = useState(0);
  const [draggedPageIndex, setDraggedPageIndex] = useState(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [activeTab, setActiveTab] = useState('collection');
  const [viewMode, setViewMode] = useState(settings?.viewMode || binder?.viewMode || 'grid');
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchPage, setSearchPage] = useState(1);
  const [hasMoreResults, setHasMoreResults] = useState(true);
  const [collection, setCollection] = useState(userEntireCollection || []);
  const [movedCards, setMovedCards] = useState({});
  const [statusMessage, setStatusMessage] = useState(null);

  // Ref for async
  const currentPageRef = useRef(currentPage);
  useEffect(() => { currentPageRef.current = currentPage; }, [currentPage]);

  // Reset state if binder/settings change
  const prevBinderId = useRef(binder?.id);
  const prevSettingsString = useRef(JSON.stringify(settings));
  useEffect(() => {
    const settingsString = JSON.stringify(settings);
    if (binder?.id !== prevBinderId.current || settingsString !== prevSettingsString.current) {
      const layout = binder?.layout || settings?.layout || defaultLayout;
      setCurrentLayout(layout);
      const [r, c] = layout.split('x').map(Number);
      const slots = (r * c) || 9;
      if (binder?.pages?.length) {
        if (Array.isArray(binder.pages[0])) {
          setPages(binder.pages);
        } else {
          setPages(slotsTo2DArray(binder.pages, binder.slotsPerPage || slots));
        }
      } else {
        setPages([Array(slots).fill(null)]);
      }

      setBinderName(
        (typeof binder?.name === "string" && binder.name.length > 0)
          ? binder.name
          : (typeof settings?.name === "string" && settings.name.length > 0)
            ? settings.name
            : "My New Binder"
      );
      setBinderDescription(binder?.description || settings?.description || '');

      setCoverColor(
        initialCoverColor ?? binder?.coverColor ?? "#181822"
      );
      setAccentColor(
        initialAccentColor ?? binder?.accentColor ?? "#7de95a"
      );

      setCurrentPage(0);
      setHasUnsavedChanges(false);
      prevBinderId.current = binder?.id;
      prevSettingsString.current = settingsString;
    }
    setCollection(userEntireCollection || []);
    // eslint-disable-next-line
  }, [binder, settings, userEntireCollection, initialCoverColor, initialAccentColor]);

  // --- Track ALL changes for unsaved state ---
  useEffect(() => {
    if (
      binderName !== (binder?.name || "") ||
      currentLayout !== (binder?.layout || "") ||
      coverColor !== (binder?.coverColor || "#181822") ||
      accentColor !== (binder?.accentColor || "#7de95a")
    ) {
      setHasUnsavedChanges(true);
    }
    // eslint-disable-next-line
  }, [binderName, currentLayout, coverColor, accentColor]);

  useEffect(() => {
    setHasUnsavedChanges(true);
    // eslint-disable-next-line
  }, [pages]);

  // --- Page nav drag & drop ---
  const handlePageNavDragStart = useCallback((e, idx) => {
    e.dataTransfer.setData('text/plain', idx);
    setDraggedPageIndex(idx);
  }, []);
  const handlePageNavDragOver = useCallback(e => { e.preventDefault(); }, []);
  const handlePageNavDrop = useCallback((e, targetIdx) => {
    e.preventDefault();
    const src = +e.dataTransfer.getData('text/plain');
    if (src === targetIdx) return setDraggedPageIndex(null);
    setPages(p => {
      const np = [...p];
      const [m] = np.splice(src, 1);
      np.splice(targetIdx, 0, m);
      setHasUnsavedChanges(true);
      return np;
    });
    setCurrentPage(prev => {
      if (prev === src) return targetIdx;
      if (src < targetIdx && prev > src && prev <= targetIdx) return prev - 1;
      if (src > targetIdx && prev < src && prev >= targetIdx) return prev + 1;
      return prev;
    });
    setDraggedPageIndex(null);
  }, []);

  // --- Add / Remove Page ---
  const handleDeletePage = useCallback(idx => {
    setPages(p => {
      const np = deepClonePages(p);
      np.splice(idx, 1);
      setHasUnsavedChanges(true);
      return np.length ? np : [Array(totalSlots).fill(null)];
    });
    setCurrentPage(prev => Math.max(0, prev - 1));
  }, [totalSlots]);
  const handleAddPage = useCallback(() => {
    setPages(p => { const np = deepClonePages(p); np.push(Array(totalSlots).fill(null)); setHasUnsavedChanges(true); return np; });
    setCurrentPage(pages.length);
  }, [pages.length, totalSlots]);

  // --- Remove card from binder slot ---
  const handleRemoveCard = useCallback((pageIdx, slotIdx) => {
    setPages(p => {
      const np = deepClonePages(p);
      const removedCard = np[pageIdx]?.[slotIdx];

      if (np[pageIdx]) {
        np[pageIdx][slotIdx] = null;
        setHasUnsavedChanges(true);
      }

      if (removedCard && removedCard.isCollectionDrag) {
        setCollection(prev => {
          const idx = prev.findIndex(
            c =>
              getCardKey(c) === getCardKey(removedCard) &&
              c.condition === removedCard.condition &&
              c.variation === removedCard.variation
          );
          if (idx !== -1) {
            const updated = [...prev];
            updated[idx] = {
              ...updated[idx],
              quantity: (Number(updated[idx].quantity) || 1) + 1,
            };
            return updated;
          } else {
            return [
              ...prev,
              {
                ...removedCard,
                quantity: 1,
              },
            ];
          }
        });
        window.dispatchEvent(
          new CustomEvent("cardRemovedFromBinder", { detail: { card: removedCard } })
        );
      }

      return np;
    });
  }, []);

  // --- Main card move/drop logic (NO SWAP, NO OVERWRITE) ---
  const handleCardDropped = useCallback((card, targetSlotIdx, fromSlotIdx = null) => {
    if (!isOwnProfile) return;

    const isCollectionDrag = card.isCollectionDrag;
    setPages(prevPages => {
      const pageIdx = currentPageRef.current;
      const np = deepClonePages(prevPages);
      const page = np[pageIdx];

      if (page[targetSlotIdx]) return np;

      let sourceIdx = -1;
      if (!isCollectionDrag && typeof fromSlotIdx === "number") {
        sourceIdx = fromSlotIdx;
      } else if (!isCollectionDrag) {
        sourceIdx = page.findIndex(
          s => s && getCardKey(s) === getCardKey(card) && (s.id ? s.id === card.id : true)
        );
      }

      if (!isCollectionDrag && sourceIdx === targetSlotIdx) {
        return np;
      }

      // CHANGED: Always assign a unique id to every slot
      const movingCard = {
        ...card,
        id: card.id || uuidv4(), // ADDED: Ensure all slots have a unique id (backend needs this)
        page: pageIdx + 1,
        position: targetSlotIdx,
        quantity: card.quantity || 1,
        notes: card.notes || "",
      };

      page[targetSlotIdx] = movingCard;
      if (!isCollectionDrag && sourceIdx !== -1) {
        page[sourceIdx] = null;
      }

      setHasUnsavedChanges(true);
      return np;
    });

    if (card.isCollectionDrag) {
      setCollection(prevCollection => {
        const idx = prevCollection.findIndex(
          c =>
            getCardKey(c) === getCardKey(card) &&
            c.condition === card.condition &&
            c.variation === card.variation
        );
        if (idx !== -1) {
          const updated = [...prevCollection];
          const currentQty = Number(updated[idx].quantity) || 1;
          if (currentQty > 1) {
            updated[idx] = {
              ...updated[idx],
              quantity: currentQty - 1,
            };
          } else {
            updated.splice(idx, 1);
          }
          return updated;
        }
        return prevCollection;
      });

      const cardKey = getCardKey(card);
      setMovedCards(prev => ({
        ...prev,
        [cardKey]: (prev[cardKey] || 0) + 1
      }));
    }

    if (onCardAddedToBinder) onCardAddedToBinder({
      ...card,
      page: currentPageRef.current + 1,
      position: targetSlotIdx
    });
  }, [isOwnProfile, onCardAddedToBinder]);

  // --- Misc handlers ---
  const handlePageDragOver = useCallback(e => { e.preventDefault(); }, []);
  const handlePageDragLeave = useCallback(e => { e.preventDefault(); }, []);
  const handlePageDrop = useCallback(e => { e.preventDefault(); }, []);

  // --- Return state and handlers (NO save handler!) ---
  return {
    binderName, setBinderName,
    binderDescription, setBinderDescription,
    currentLayout, setCurrentLayout,
    rows, cols,
    coverColor, setCoverColor,
    accentColor, setAccentColor,
    viewMode, setViewMode,
    pages, setPages,
    currentPage, setCurrentPage,
    draggedPageIndex,
    hasUnsavedChanges,
    activeTab, setActiveTab,
    showShortcuts, setShowShortcuts,
    searchTerm, setSearchTerm,
    searchResults, setSearchResults,
    searchPage, setSearchPage,
    hasMoreResults, setHasMoreResults,
    movedCards, setMovedCards,
    collection,
    statusMessage, setStatusMessage,
    handlers: {
      handlePageNavDragStart, handlePageNavDragOver, handlePageNavDrop,
      addPage: handleAddPage, deletePage: handleDeletePage, setCurrentPage,
      handlePageDragOver, handlePageDragLeave, handlePageDrop,
      handleRemoveCard, handleCardDropped,
      searchPage, setSearchPage,
      hasMoreResults, setHasMoreResults,
      // NO handleSaveBinder here!
    }
  };
}
