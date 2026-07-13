// frontend/src/pages/search.js
// Batch Add to Collection workbench
//
// Redesigned:
// - Cleaner dark-only workbench layout
// - Better header and purpose explanation
// - Search panel separated from results
// - Results grid + sticky selected batch sidebar
// - Kept paging strategy
// - Kept smart presets
// - Kept bulk mutation
// - Kept toast feedback

"use client";

import React, {
  useState,
  useMemo,
  useCallback,
  useRef,
  useContext,
  startTransition,
  useEffect,
} from "react";
import { devError } from "@/utils/devLog";
import { useLazyQuery, useMutation } from "@apollo/client";
import { CARDSEARCH_QUERY, CARDSEARCH_BULK_ADD_TO_COLLECTION } from '@/graphql/collection';
import {
  pos, pickDisplayPrice, getBestPriceRow, formatGBP,
  canonicalCardKey, mergeCardLists, makeQueryKey, applyFiltersAndSort,
  GBP_SYMBOL, FALLBACK_SYMBOL_IMAGE, CARDSEARCH_PAGE_SIZE, CARDSEARCH_EXACT_LIMIT,
} from '@/utils/cardSearchUtils';
import Image from "next/image";

import Layout from "@/components/Layout/Layout";
import PokemonAutocomplete from "@/components/Collection/SearchComponents/PokemonAutocomplete";
import SetAutocomplete from "@/components/Collection/SearchComponents/SetAutocomplete";
import AdvancedFilters from "@/components/Collection/SearchComponents/AdvancedFilters";
import StatusMessage from "@/components/UI/StatusMessage";
import { AuthContext } from "@/components/Auth/AuthProvider";
import AuthModal from "@/components/Auth/AuthModal";
import CardDetailsModal from "@/components/Cards/CardDetailsModal";
import { getSetLogo } from "@/utils/setLogos";
import { formatVariation } from "@/utils/formatVariation";

// Matches the auth-service/collections-service session-rejection messages
// (e.g. "Authentication required", "Invalid or expired session") so we can
// show a login prompt instead of a raw error string.
const isAuthError = (message) => /authentic|session/i.test(message || "");

/* ---------------- GraphQL ---------------- */



const INITIAL_FILTERS = {
  minPrice: "",
  maxPrice: "",
  rarities: [],
  variations: [],
  sortBy: "relevance",
  onlyHasPrices: false,
  onlyHasReverse: false,
};

const SORT_OPTIONS = [
  { value: "relevance", label: "Sort: Relevance" },
  { value: "price-asc", label: "Price: Low → High" },
  { value: "price-desc", label: "Price: High → Low" },
  { value: "rarity-asc", label: "Rarity: Low → High" },
  { value: "rarity-desc", label: "Rarity: High → Low" },
  { value: "number-asc", label: "Card No: Ascending" },
  { value: "number-desc", label: "Card No: Descending" },
  { value: "name-asc", label: "Name: A → Z" },
  { value: "name-desc", label: "Name: Z → A" },
];


function mapCardsearchItems(items) {
  if (!Array.isArray(items) || items.length === 0) return [];

  return items.map((it, idx) => {
    const setRecord = it.set || {};
    const setCode = it.setCode || setRecord.code || "";
    const number = it.number || "";

    const id =
      it.cardId ||
      it.id ||
      (setCode && number ? `${setCode}-${number}` : `card-${idx}`);

    const image = it.images?.large || null;

    const variants = Array.isArray(it.variants)
      ? it.variants.map((v) =>
          typeof v === "string" ? v : v?.key || v?.label || "normal"
        )
      : ["normal"];

    return {
      id,
      cardId: id,
      name: it.name || "",
      set: setCode,
      setCode,
      setName: setRecord.name || setCode || "",
      number,
      image,
      tcgImageUrl: image,
      rarity: it.rarity || null,
      variations: variants,
      prices: Array.isArray(it.latestPrices) ? it.latestPrices : [],
    };
  });
}


function selectIntoBatch(prevSelection, cards, predicate) {
  const next = { ...prevSelection };

  cards.forEach((card, idx) => {
    if (predicate && !predicate(card)) return;

    const key =
      card.cardId ||
      card.id ||
      `${card.setCode || "UNK"}-${card.number || "0"}-${idx}`;

    if (!key) return;

    if (!next[key]) {
      next[key] = { card, quantity: 1 };
    }
  });

  return next;
}

/* ---------------- Small UI ---------------- */

function StatPill({ label, value }) {
  return (
    <div className="rounded-[10px] border border-vault-border bg-vault-raised px-4 py-3">
      <p className="font-vault-body text-[11px] font-semibold uppercase tracking-[0.06em] text-vault-textTertiary">
        {label}
      </p>
      <p className="mt-1 font-vault text-lg font-semibold text-vault-text">{value}</p>
    </div>
  );
}

function WorkbenchButton({
  children,
  onClick,
  disabled,
  variant = "secondary",
  type = "button",
}) {
  const cls =
    variant === "primary"
      ? "bg-vault-accent text-vault-text hover:bg-vault-accentHover disabled:opacity-50"
      : variant === "danger"
      ? "border border-vault-danger/30 bg-vault-danger/10 text-vault-danger hover:bg-vault-danger/20 disabled:opacity-40"
      : "border border-vault-border bg-transparent text-vault-textSecondary hover:border-vault-borderStrong hover:text-vault-text disabled:opacity-40";

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center rounded-[10px] px-4 py-2.5 text-sm font-semibold transition-colors disabled:cursor-not-allowed ${cls}`}
    >
      {children}
    </button>
  );
}

/* ---------------- Page ---------------- */

export default function CardSearchWorkbenchPage() {
  const { user } = useContext(AuthContext);
  const [authModalOpen, setAuthModalOpen] = useState(false);

  const [name, setName] = useState("");
  const [setCode, setSetCode] = useState("");
  const [number, setNumber] = useState("");

  const [filters, setFilters] = useState(INITIAL_FILTERS);

  const [results, setResults] = useState([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [searchError, setSearchError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const [submitResult, setSubmitResult] = useState(null);
  const [submitErrors, setSubmitErrors] = useState([]);
  const [expandedCard, setExpandedCard] = useState(null);
  const [toast, setToast] = useState(null);

  const bucketsRef = useRef(new Map());
  const lastKeyRef = useRef(null);
  const loadingMoreRef = useRef(false);
  const loadMoreTriggerRef = useRef(null);
  const observerRef = useRef(null);

  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const isExactCardSearch = useMemo(
    () => Boolean(setCode && number),
    [setCode, number]
  );

  const [runSearch, { loading, fetchMore }] = useLazyQuery(CARDSEARCH_QUERY, {
    fetchPolicy: "network-only",
    nextFetchPolicy: "cache-first",
    notifyOnNetworkStatusChange: true,
    returnPartialData: false,
  });

  const [selectedCards, setSelectedCards] = useState({});
  const [batchPanelOpen, setBatchPanelOpen] = useState(false);

  const [bulkAddToCollection, { loading: adding }] = useMutation(
    CARDSEARCH_BULK_ADD_TO_COLLECTION
  );

  const showToast = useCallback((type, message) => {
    setToast({ type, message });
  }, []);

  const availableRarities = useMemo(() => {
    const s = new Set();

    results.forEach((card) => {
      if (card.rarity) s.add(card.rarity);
    });

    return Array.from(s).sort();
  }, [results]);

  const availableVariations = useMemo(() => {
    const s = new Set();

    results.forEach((card) => {
      if (Array.isArray(card.variations)) {
        card.variations.forEach((v) => v && s.add(v));
      }
    });

    return Array.from(s).sort();
  }, [results]);

  const filteredResults = useMemo(
    () => applyFiltersAndSort(results, filters),
    [results, filters]
  );

  const hasResults = filteredResults.length > 0;

  const currentKey = useMemo(
    () => makeQueryKey({ name, setCode, number }),
    [name, setCode, number]
  );

  const disconnectObserver = useCallback(() => {
    if (observerRef.current) {
      try {
        observerRef.current.disconnect();
      } catch {}

      observerRef.current = null;
    }
  }, []);

  useEffect(() => {
    setSearchError(null);
    setSubmitting(false);
    loadingMoreRef.current = false;
    setSubmitResult(null);
    setSubmitErrors([]);
    setToast(null);
    // Stop any in-progress pagination so loadMoreResults can't fire with the
    // old lastKeyRef while the inputs have already changed to something new.
    setHasMore(false);
    setIsLoadingMore(false);
    disconnectObserver();
  }, [name, setCode, number, disconnectObserver]);

  const handleSearch = useCallback(
    async (e) => {
      if (e?.preventDefault) e.preventDefault();

      setHasSearched(true);

      const key = makeQueryKey({ name, setCode, number });
      lastKeyRef.current = key;
      loadingMoreRef.current = false;

      disconnectObserver();

      const bucket = bucketsRef.current.get(key);

      if (bucket) {
        startTransition(() => {
          setResults(bucket.items);
          setHasMore(bucket.hasNextPage);
          setIsLoadingMore(false);
        });
      } else {
        startTransition(() => {
          setResults([]);
          setHasMore(false);
          setIsLoadingMore(false);
        });
      }

      const limit = isExactCardSearch
        ? Math.min(CARDSEARCH_PAGE_SIZE, CARDSEARCH_EXACT_LIMIT)
        : CARDSEARCH_PAGE_SIZE;

      const variables = {
        input: {
          name: name || undefined,
          set: setCode || undefined,
          number: number || undefined,
          limit,
          offset: 0,
        },
      };

      setSearchError(null);
      setSubmitting(true);

      try {
        const res = await runSearch({
          variables,
          context: { queryDeduplication: false },
        });

        const payload = res?.data?.searchCards;

        if (!payload) {
          if (bucket) setHasMore(bucket.hasNextPage);
          return;
        }

        const items = mapCardsearchItems(payload.items);
        const totalCount = Number(payload.total ?? items.length);
        const initialOffset = Number(payload.offset ?? 0);
        const nextOffset = Math.min(initialOffset + items.length, totalCount);
        const pageSize = Number(payload.limit ?? limit);

        const bucketNext = {
          items,
          hasNextPage: nextOffset < totalCount,
          totalCount,
          nextOffset,
          pageSize,
          // Record the exact params used for this search so loadMoreResults
          // always paginates against the same query, not the current input state.
          queryParams: {
            name: name || undefined,
            set: setCode || undefined,
            number: number || undefined,
          },
        };

        bucketsRef.current.set(key, bucketNext);

        if (lastKeyRef.current === key) {
          startTransition(() => {
            setResults(items);
            setHasMore(bucketNext.hasNextPage);
            setIsLoadingMore(false);
          });
        }
      } catch (err) {
        setSearchError(err instanceof Error ? err : new Error(String(err)));
        showToast("error", "Search failed. Please try again.");

        if (bucket) setHasMore(bucket.hasNextPage);
      } finally {
        setSubmitting(false);
      }
    },
    [
      name,
      setCode,
      number,
      runSearch,
      isExactCardSearch,
      disconnectObserver,
      showToast,
    ]
  );

  const loadMoreResults = useCallback(async () => {
    if (loadingMoreRef.current || !hasMore) return;

    loadingMoreRef.current = true;
    setIsLoadingMore(true);

    try {
      const key = lastKeyRef.current || currentKey;
      const prev = bucketsRef.current.get(key);
      const totalCount = Number(prev?.totalCount ?? 0);
      const pageSize = Number(prev?.pageSize ?? CARDSEARCH_PAGE_SIZE);
      const currentCount = Array.isArray(prev?.items) ? prev.items.length : 0;
      const nextOffset = Number(prev?.nextOffset ?? currentCount);

      if (!prev || nextOffset >= totalCount) {
        if (prev) {
          const merged = { ...prev, hasNextPage: false, nextOffset };
          bucketsRef.current.set(key, merged);
        }

        if (lastKeyRef.current === key) {
          startTransition(() => setHasMore(false));
        }

        return;
      }

      // Use the params stored when this bucket was created, not the current
      // input state — the user may have changed inputs since the last Search.
      const vars = {
        input: {
          name: prev.queryParams?.name,
          set: prev.queryParams?.set,
          number: prev.queryParams?.number,
          limit: pageSize,
          offset: nextOffset,
        },
      };

      const res = await fetchMore({ variables: vars });
      const payload = res?.data?.searchCards;

      if (!payload) {
        const merged = { ...prev, hasNextPage: false, nextOffset };
        bucketsRef.current.set(key, merged);

        if (lastKeyRef.current === key) {
          startTransition(() => setHasMore(false));
        }

        return;
      }

      const newItems = mapCardsearchItems(payload.items);
      const combined = mergeCardLists(prev.items, newItems);
      const mergedTotal = Number(
        payload.total ?? prev.totalCount ?? combined.length
      );
      const mergedOffset = Math.min(nextOffset + newItems.length, mergedTotal);

      const merged = {
        ...prev,
        items: combined,
        totalCount: mergedTotal,
        nextOffset: mergedOffset,
        pageSize: Number(payload.limit ?? pageSize),
        hasNextPage: mergedOffset < mergedTotal,
      };

      bucketsRef.current.set(key, merged);

      if (lastKeyRef.current === key) {
        startTransition(() => {
          setResults(combined);
          setHasMore(merged.hasNextPage);
          setIsLoadingMore(false);
        });
      }
    } catch (err) {
      setSearchError(err instanceof Error ? err : new Error(String(err)));
      showToast("error", "Couldn’t load more cards. Please try again.");

      const key = lastKeyRef.current || currentKey;

      if (key) {
        const prev = bucketsRef.current.get(key);

        const merged = prev
          ? { ...prev, hasNextPage: false }
          : {
              items: [],
              hasNextPage: false,
              totalCount: 0,
              nextOffset: 0,
              pageSize: CARDSEARCH_PAGE_SIZE,
            };

        bucketsRef.current.set(key, merged);

        if (lastKeyRef.current === key) {
          startTransition(() => {
            setHasMore(false);
            setIsLoadingMore(false);
          });
        }
      }
    } finally {
      loadingMoreRef.current = false;
      setIsLoadingMore(false);
    }
  }, [fetchMore, hasMore, currentKey, showToast]);

  useEffect(() => {
    if (!hasMore) {
      disconnectObserver();
      return;
    }

    const node = loadMoreTriggerRef.current;
    if (!node) return;

    disconnectObserver();

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            loadMoreResults();
          }
        });
      },
      { root: null, rootMargin: "400px", threshold: 0 }
    );

    observerRef.current = observer;
    observer.observe(node);

    return () => disconnectObserver();
  }, [
    hasMore,
    loadMoreResults,
    filteredResults.length,
    currentKey,
    disconnectObserver,
  ]);

  function handleResetSearch() {
    setName("");
    setSetCode("");
    setNumber("");
    setFilters(INITIAL_FILTERS);
    setResults([]);
    setHasSearched(false);
    setSearchError(null);
    setHasMore(false);
    setIsLoadingMore(false);
    bucketsRef.current.clear();
    lastKeyRef.current = null;
    disconnectObserver();
    setSubmitResult(null);
    setSubmitErrors([]);
    setToast(null);
  }

  const handleCardSelect = useCallback((card) => {
    setSelectedCards((prev) => {
      const key = card.cardId || card.id;
      const existing = prev[key];
      const nextQty = existing ? existing.quantity + 1 : 1;

      return {
        ...prev,
        [key]: { card, quantity: nextQty },
      };
    });
  }, []);

  function handleQuantityChange(key, quantity) {
    setSelectedCards((prev) => {
      if (!prev[key]) return prev;

      const q = Math.max(0, Number(quantity) || 0);

      if (q === 0) {
        const clone = { ...prev };
        delete clone[key];
        return clone;
      }

      return {
        ...prev,
        [key]: { ...prev[key], quantity: q },
      };
    });
  }

  function handleRemove(key) {
    setSelectedCards((prev) => {
      if (!prev[key]) return prev;

      const clone = { ...prev };
      delete clone[key];

      return clone;
    });
  }

  function handleClearAll() {
    if (Object.keys(selectedCards).length === 0) return;

    setSelectedCards({});
    setSubmitResult(null);
    setSubmitErrors([]);
    showToast("info", "Selection cleared.");
  }

  const selectedList = useMemo(
    () => Object.values(selectedCards),
    [selectedCards]
  );

  const selectedCount = selectedList.length;

  const totalQuantity = selectedList.reduce(
    (sum, entry) => sum + (entry.quantity || 0),
    0
  );

  const estimatedBatchValue = useMemo(() => {
    return selectedList.reduce((sum, entry) => {
      const { card, quantity } = entry;
      const bestRow = getBestPriceRow(card.prices);
      const unit = pickDisplayPrice(bestRow);

      if (!unit || !quantity) return sum;

      return sum + unit * quantity;
    }, 0);
  }, [selectedList]);

  const loadAllPagesForKey = useCallback(
    async (key, baseInput) => {
      let bucket = bucketsRef.current.get(key);

      if (!bucket) {
        const limit = CARDSEARCH_PAGE_SIZE;

        const res = await runSearch({
          variables: {
            input: { ...baseInput, limit, offset: 0 },
          },
          context: { queryDeduplication: false },
        });

        const payload = res?.data?.searchCards;
        const itemsRaw = payload?.items || [];
        const items = mapCardsearchItems(itemsRaw);
        const totalCount = Number(payload?.total ?? items.length);
        const initialOffset = Number(payload?.offset ?? 0);
        const nextOffset = Math.min(initialOffset + items.length, totalCount);
        const pageSize = Number(payload?.limit ?? limit);

        bucket = {
          items,
          hasNextPage: nextOffset < totalCount,
          totalCount,
          nextOffset,
          pageSize,
        };

        bucketsRef.current.set(key, bucket);
      }

      while (bucket.hasNextPage) {
        const res = await fetchMore({
          variables: {
            input: {
              ...baseInput,
              limit: bucket.pageSize,
              offset: bucket.nextOffset,
            },
          },
        });

        const payload = res?.data?.searchCards;

        if (!payload) {
          bucket = { ...bucket, hasNextPage: false };
          bucketsRef.current.set(key, bucket);
          break;
        }

        const newItems = mapCardsearchItems(payload.items);
        const combined = mergeCardLists(bucket.items, newItems);
        const mergedTotal = Number(
          payload.total ?? bucket.totalCount ?? combined.length
        );
        const mergedOffset = Math.min(
          bucket.nextOffset + newItems.length,
          mergedTotal
        );

        bucket = {
          ...bucket,
          items: combined,
          totalCount: mergedTotal,
          nextOffset: mergedOffset,
          pageSize: Number(payload.limit ?? bucket.pageSize),
          hasNextPage: mergedOffset < mergedTotal,
        };

        bucketsRef.current.set(key, bucket);
      }

      if (lastKeyRef.current === key) {
        startTransition(() => {
          setResults(bucket.items);
          setHasMore(bucket.hasNextPage);
          setIsLoadingMore(false);
        });
      }

      return bucket.items;
    },
    [runSearch, fetchMore]
  );

  const fetchSetCards = useCallback(async () => {
    if (!setCode) return [];

    const key = makeQueryKey({ name: "", setCode, number: "" });
    lastKeyRef.current = key;

    const baseInput = { set: setCode };
    const items = await loadAllPagesForKey(key, baseInput);

    return items;
  }, [setCode, loadAllPagesForKey]);

  const handlePresetFullSet = useCallback(async () => {
    if (!setCode) {
      showToast("info", "Pick a set first to use this preset.");
      setSubmitResult({
        ok: false,
        message: "Pick a set first to use this preset.",
      });
      return;
    }

    setSubmitting(true);

    try {
      const cards = await fetchSetCards();
      if (!cards.length) return;

      setSelectedCards((prev) => selectIntoBatch(prev, cards, () => true));
      showToast("success", `Added ${setCode} set cards to selection.`);
    } catch (err) {
      devError(err);
      setSearchError(err instanceof Error ? err : new Error(String(err)));
      showToast("error", "Preset failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }, [setCode, fetchSetCards, showToast]);

  const handlePresetCommonsUncommons = useCallback(async () => {
    if (!setCode) {
      showToast("info", "Pick a set first to use this preset.");
      setSubmitResult({
        ok: false,
        message: "Pick a set first to use this preset.",
      });
      return;
    }

    const allowed = new Set(["Common", "Uncommon", "Common ", "Uncommon "]);

    setSubmitting(true);

    try {
      const cards = await fetchSetCards();
      if (!cards.length) return;

      setSelectedCards((prev) =>
        selectIntoBatch(prev, cards, (card) => allowed.has(card.rarity))
      );
      showToast("success", "Added Commons / Uncommons to selection.");
    } catch (err) {
      devError(err);
      setSearchError(err instanceof Error ? err : new Error(String(err)));
      showToast("error", "Preset failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }, [setCode, fetchSetCards, showToast]);

  const handlePresetAddVisibleResults = useCallback(() => {
    if (!filteredResults.length) return;

    setSelectedCards((prev) =>
      selectIntoBatch(prev, filteredResults, () => true)
    );

    showToast("success", "Added visible results to selection.");
  }, [filteredResults, showToast]);

  const handleSelectAllVisible = useCallback(() => {
    if (!filteredResults.length) return;

    setSelectedCards((prev) =>
      selectIntoBatch(prev, filteredResults, () => true)
    );

    showToast("success", "Selected all visible results.");
  }, [filteredResults, showToast]);

  async function handleAddAllToCollection() {
    if (selectedList.length === 0) return;

    if (!user) {
      setAuthModalOpen(true);
      return;
    }

    setSubmitResult(null);
    setSubmitErrors([]);

    const items = selectedList
      .map((entry) => {
        const { card, quantity } = entry;
        const cardId = card?.cardId || card?.id || null;
        const qty = Number(quantity || 0);

        if (!cardId || !Number.isFinite(qty) || qty <= 0) return null;

        return { cardId, quantity: qty };
      })
      .filter(Boolean);

    if (!items.length) {
      const msg = "No valid items to add.";
      setSubmitResult({ ok: false, message: msg });
      showToast("warning", msg);
      return;
    }

    try {
      const res = await bulkAddToCollection({
        variables: {
          input: {
            cards: items,
          },
        },
      });

      const payload = res?.data?.cardsearchBulkAddToCollection;
      const ok = Boolean(payload?.ok);

      const message =
        payload?.message ||
        (ok ? "Added to collection." : "Completed with errors.");

      const itemErrors = Array.isArray(payload?.items)
        ? payload.items.filter((x) => x?.error)
        : [];

      setSubmitResult({ ok, message });

      if (itemErrors.length) {
        setSubmitErrors(itemErrors);
      }

      if (ok && itemErrors.length === 0) {
        showToast("success", message || "All cards added to your collection.");
        setSelectedCards({});
      } else if (ok && itemErrors.length > 0) {
        showToast(
          "warning",
          `Added with ${itemErrors.length} issue(s). Some cards need attention.`
        );
      } else {
        showToast("error", message || "Failed to add cards to your collection.");
      }
    } catch (err) {
      devError(err);

      const msg = err?.message || "Something went wrong while adding cards.";

      if (isAuthError(msg)) {
        setAuthModalOpen(true);
        return;
      }

      setSubmitResult({ ok: false, message: msg });
      showToast("error", msg);
    }
  }

  return (
    <Layout title="Batch Add to Collection">
      {toast && (
        <StatusMessage
          type={toast.type}
          message={toast.message}
          onClose={() => setToast(null)}
        />
      )}

      <div className="min-h-screen bg-vault-bg text-vault-text">
        <main className="mx-auto max-w-7xl px-5 py-12 sm:px-7">
          {/* Header */}
          <section className="mb-8">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="mb-4 font-vault-body text-[11px] font-semibold uppercase tracking-[0.08em] text-vault-textTertiary">
                  Collection workbench
                </p>

                <h1 className="font-vault text-[32px] font-semibold leading-[1.15] tracking-tight text-vault-text sm:text-[36px]">
                  Batch Add to Collection
                </h1>

                <p className="mt-3 max-w-2xl text-[15px] leading-7 text-vault-textSecondary">
                  Search across cards, build a temporary batch, adjust
                  quantities, then save everything to your collection in one go.
                </p>
              </div>

              <div className="grid grid-cols-3 gap-3 sm:min-w-[420px]">
                <StatPill label="Selected" value={selectedCount} />
                <StatPill label="Copies" value={totalQuantity} />
                <StatPill
                  label="Est. value"
                  value={estimatedBatchValue > 0 ? formatGBP(estimatedBatchValue) : "--"}
                />
              </div>
            </div>
          </section>

          {/* Search panel */}
          <section className="mb-8 rounded-[14px] border border-vault-border bg-vault-surface p-5 sm:p-6">
            <form
              onSubmit={handleSearch}
              className="space-y-5 text-sm"
              id="card-search-workbench-form"
            >
              <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_1fr_0.7fr_auto_auto] md:items-end">
                <div>
                  <label className="mb-2 block font-vault-body text-[11px] font-semibold uppercase tracking-[0.06em] text-vault-textTertiary">
                    Card Name
                  </label>

                  <PokemonAutocomplete
                    value={name}
                    onChange={setName}
                    onSelect={setName}
                    className="w-full"
                    inputClassName="w-full rounded-[10px] border border-vault-border bg-vault-raised px-4 py-3 text-sm text-vault-text outline-none placeholder:text-vault-textTertiary focus:border-vault-accent"
                  />
                </div>

                <div>
                  <label className="mb-2 block font-vault-body text-[11px] font-semibold uppercase tracking-[0.06em] text-vault-textTertiary">
                    Set
                  </label>

                  <SetAutocomplete
                    value={setCode}
                    onChange={setSetCode}
                    onSelect={setSetCode}
                    className="w-full"
                    inputClassName="w-full rounded-[10px] border border-vault-border bg-vault-raised px-4 py-3 text-sm text-vault-text outline-none placeholder:text-vault-textTertiary focus:border-vault-accent"
                  />
                </div>

                <div>
                  <label className="mb-2 block font-vault-body text-[11px] font-semibold uppercase tracking-[0.06em] text-vault-textTertiary">
                    Number
                  </label>

                  <input
                    type="text"
                    value={number}
                    onChange={(e) => setNumber(e.target.value)}
                    placeholder="e.g. 004"
                    className="w-full rounded-[10px] border border-vault-border bg-vault-raised px-4 py-3 text-sm text-vault-text outline-none placeholder:text-vault-textTertiary focus:border-vault-accent"
                  />
                </div>

                <WorkbenchButton
                  type="submit"
                  disabled={submitting || loading}
                  variant="primary"
                >
                  {submitting || loading ? "Searching..." : "Search"}
                </WorkbenchButton>

                <WorkbenchButton onClick={handleResetSearch}>
                  Clear
                </WorkbenchButton>
              </div>

              {setCode && (
                <div className="rounded-[10px] border border-vault-border bg-vault-raised p-4">
                  <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-vault-body text-[11px] font-semibold uppercase tracking-[0.06em] text-vault-textTertiary">
                        Smart presets
                      </p>

                      <p className="mt-1 text-sm text-vault-textSecondary">
                        Quick actions for{" "}
                        <span className="font-semibold text-vault-text">
                          {setCode}
                        </span>
                        .
                      </p>
                    </div>

                    {hasResults && (
                      <WorkbenchButton onClick={handlePresetAddVisibleResults}>
                        Add current results
                      </WorkbenchButton>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <WorkbenchButton
                      onClick={handlePresetFullSet}
                      disabled={submitting || loading}
                      variant="primary"
                    >
                      Add 1x of every card
                    </WorkbenchButton>

                    <WorkbenchButton
                      onClick={handlePresetCommonsUncommons}
                      disabled={submitting || loading}
                    >
                      Add Commons / Uncommons
                    </WorkbenchButton>
                  </div>
                </div>
              )}

              {searchError && (
                <p className="text-sm font-medium text-vault-danger" role="alert">
                  {searchError.message || "Search failed"}
                </p>
              )}

              {submitResult && (
                <div
                  className={`rounded-[10px] border px-4 py-3 text-sm ${
                    submitResult.ok
                      ? "border-vault-success/30 bg-vault-success/10 text-vault-success"
                      : "border-vault-danger/30 bg-vault-danger/10 text-vault-danger"
                  }`}
                  role="status"
                >
                  <div className="font-semibold">
                    {submitResult.ok
                      ? "Collection updated"
                      : "Collection update failed"}
                  </div>

                  <div className="mt-1 opacity-90">{submitResult.message}</div>

                  {submitErrors.length > 0 && (
                    <div className="mt-3">
                      <div className="font-semibold">Some items failed:</div>

                      <ul className="mt-1 list-disc space-y-1 pl-4 text-xs">
                        {submitErrors.slice(0, 8).map((it) => (
                          <li key={`${it.cardId}-${it.error}`}>
                            <span className="font-medium">{it.cardId}</span>:{" "}
                            {it.error}
                          </li>
                        ))}

                        {submitErrors.length > 8 && (
                          <li>…and {submitErrors.length - 8} more</li>
                        )}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </form>
          </section>

          {/* Workbench */}
          <section className="grid grid-cols-1 gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
            {/* Filters sidebar */}
            <aside className="rounded-[14px] border border-vault-border bg-vault-surface p-5 lg:sticky lg:top-28 lg:self-start">
              <AdvancedFilters
                filters={filters}
                onChange={setFilters}
                availableRarities={availableRarities}
                availableVariations={availableVariations}
              />
            </aside>

            {/* Results */}
            <div className="rounded-[14px] border border-vault-border bg-vault-surface p-4 sm:p-5">
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="font-vault text-xl font-semibold text-vault-text">
                    Results
                  </h2>

                  <p className="mt-1 text-sm text-vault-textTertiary">
                    {loading && "Searching..."}
                    {searchError && !loading && "Error loading cards"}
                    {!loading &&
                      !searchError &&
                      hasResults &&
                      `Showing ${filteredResults.length} of ${results.length} cards`}
                    {!loading &&
                      !searchError &&
                      hasSearched &&
                      !hasResults &&
                      "No matching cards"}
                    {!loading &&
                      !hasSearched &&
                      "Search for cards to start building your batch."}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={filters?.sortBy || "relevance"}
                    onChange={(e) =>
                      setFilters({ ...filters, sortBy: e.target.value })
                    }
                    className="rounded-[6px] border border-vault-border bg-vault-raised px-3 py-2 text-xs text-vault-text outline-none focus:border-vault-accent"
                    aria-label="Sort results"
                  >
                    {SORT_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>

                  <WorkbenchButton onClick={() => setBatchPanelOpen(true)}>
                    Batch ({selectedCount})
                  </WorkbenchButton>

                  <WorkbenchButton
                    onClick={handleSelectAllVisible}
                    disabled={!hasResults}
                  >
                    Select all visible
                  </WorkbenchButton>
                </div>
              </div>

              <div className="max-h-[calc(100vh-350px)] min-h-[460px] overflow-y-auto pr-1">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
                  {filteredResults.map((card, idx) => {
                    const key =
                      card.cardId ||
                      card.id ||
                      `${card.setCode}-${card.number}-${idx}`;

                    const inSelection = !!selectedCards[key];
                    const selectedQty = selectedCards[key]?.quantity ?? 0;
                    const bestRow = getBestPriceRow(card.prices);
                    const displayPrice = pickDisplayPrice(bestRow);

                    return (
                      <article
                        key={key}
                        className={`group flex flex-col rounded-[10px] border p-2 transition-colors ${
                          inSelection
                            ? "border-vault-accent bg-vault-accent/10"
                            : "border-vault-border bg-vault-raised hover:border-vault-borderStrong"
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => setExpandedCard(card)}
                          aria-label={`Expand ${card.name || "card"} image`}
                          className="relative mb-2 aspect-[3/4] overflow-hidden rounded-[6px] bg-black/30 cursor-zoom-in focus:outline-none focus:ring-1 focus:ring-vault-accent"
                        >
                          {card.tcgImageUrl || card.image ? (
                            <Image
                              src={card.tcgImageUrl || card.image}
                              alt={card.name}
                              fill
                              className="object-contain"
                            />
                          ) : null}
                        </button>

                        <div className="flex flex-1 flex-col justify-between text-xs">
                          <div>
                            <div className="flex items-start justify-between gap-2">
                              <div className="line-clamp-2 font-semibold text-vault-text">
                                {card.name}
                              </div>

                              <img
                                src={getSetLogo(card.setName, card.setCode)}
                                alt={card.setName || "Set logo"}
                                className="h-5 w-8 rounded bg-vault-surface"
                                onError={(e) => {
                                  e.currentTarget.onerror = null;
                                  e.currentTarget.src = FALLBACK_SYMBOL_IMAGE;
                                }}
                                loading="lazy"
                                decoding="async"
                              />
                            </div>

                            <div className="mt-1 flex justify-between gap-2 text-[11px] text-vault-textTertiary">
                              <span className="truncate">{card.setName}</span>
                              <span className="font-medium">#{card.number}</span>
                            </div>

                            <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
                              <span className="font-vault font-semibold text-vault-text">
                                {formatGBP(displayPrice)}
                              </span>

                              {bestRow?.variation &&
                                bestRow.variation !== "normal" && (
                                  <span className="text-vault-textTertiary">
                                    ({formatVariation(bestRow.variation)})
                                  </span>
                                )}
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleCardSelect(card)}
                            className={`mt-3 w-full rounded-[6px] px-2 py-2 text-xs font-semibold transition-colors ${
                              inSelection
                                ? "bg-vault-accent text-vault-text"
                                : "bg-vault-surface text-vault-textSecondary hover:bg-vault-accent hover:text-vault-text"
                            }`}
                          >
                            {inSelection
                              ? `Selected (${selectedQty})`
                              : "Add to batch"}
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>

                {!loading && !searchError && hasSearched && !hasResults && (
                  <div className="flex min-h-[360px] items-center justify-center rounded-[10px] border border-dashed border-vault-border text-center text-sm text-vault-textTertiary">
                    No cards match your search. Try changing the filters.
                  </div>
                )}

                {!hasSearched && !loading && (
                  <div className="flex min-h-[360px] flex-col items-center justify-center rounded-[10px] border border-dashed border-vault-border px-6 text-center">
                    <p className="font-vault text-base font-semibold text-vault-text">
                      Ready to build a batch?
                    </p>

                    <p className="mt-2 max-w-md text-sm leading-6 text-vault-textTertiary">
                      Search by card name, set, or number. Add cards to the
                      sidebar and keep searching — your batch stays selected.
                    </p>
                  </div>
                )}

                <div ref={loadMoreTriggerRef} className="h-4" />

                {(hasMore || isLoadingMore) && (
                  <div className="mt-4 flex items-center justify-center gap-3 text-sm text-vault-textTertiary">
                    {isLoadingMore ? (
                      <>
                        <span className="inline-block h-4 w-4 rounded-full border-2 border-vault-accent border-r-transparent animate-spin" />
                        Loading more cards…
                      </>
                    ) : (
                      <span>Scroll down to load more cards</span>
                    )}
                  </div>
                )}
              </div>

              {hasResults && !loading && !searchError && (
                <p className="mt-4 text-xs text-vault-textTertiary">
                  Prices shown are the latest market snapshot from SixByFive TCG
                  and may not include every variant or price point yet.
                </p>
              )}
            </div>
          </section>

          {/* Batch drawer */}
          {batchPanelOpen && (
            <div
              className="fixed inset-0 z-40 bg-black/60"
              onClick={() => setBatchPanelOpen(false)}
            />
          )}

          <aside
            className={`fixed right-0 top-0 z-50 h-full w-full max-w-md transform overflow-y-auto border-l border-vault-border bg-vault-overlay p-4 shadow-[0_8px_24px_rgba(0,0,0,0.4)] transition-transform duration-300 sm:p-5 ${
              batchPanelOpen ? "translate-x-0" : "translate-x-full"
            }`}
          >
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-vault text-xl font-semibold text-vault-text">
                    Selected batch
                  </h2>

                  <p className="mt-1 text-sm text-vault-textTertiary">
                    {selectedCount} cards • {totalQuantity} copies
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  {estimatedBatchValue > 0 && (
                    <div className="rounded-[10px] border border-vault-border bg-vault-raised px-3 py-2 text-right">
                      <p className="font-vault-body text-[10px] font-semibold uppercase tracking-[0.06em] text-vault-textTertiary">
                        Est.
                      </p>
                      <p className="font-vault text-sm font-semibold text-vault-text">
                        {formatGBP(estimatedBatchValue)}
                      </p>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => setBatchPanelOpen(false)}
                    aria-label="Close batch panel"
                    className="rounded-[6px] p-1.5 text-vault-textTertiary transition-colors hover:bg-vault-raised hover:text-vault-text"
                  >
                    ✕
                  </button>
                </div>
              </div>

              <div className="mb-4 rounded-[10px] border border-vault-border bg-vault-raised p-3 text-xs leading-5 text-vault-textSecondary">
                Build your temporary batch here. Adjust quantities before saving.
                This only updates your personal collection.
              </div>

              <div className="max-h-[calc(100vh-430px)] min-h-[260px] space-y-2 overflow-y-auto pr-1">
                {selectedList.length === 0 && (
                  <div className="rounded-[10px] border border-dashed border-vault-border bg-vault-raised p-4 text-sm text-vault-textSecondary">
                    <p className="font-semibold text-vault-text">
                      No cards selected yet.
                    </p>

                    <ul className="mt-3 list-disc space-y-1 pl-4 text-xs">
                      <li>Add cards from multiple searches.</li>
                      <li>Set quantities before saving.</li>
                      <li>Clear the batch without changing your collection.</li>
                    </ul>
                  </div>
                )}

                {Object.entries(selectedCards).map(([key, { card, quantity }]) => {
                  const bestRow = getBestPriceRow(card.prices);
                  const unitPrice = pickDisplayPrice(bestRow);
                  const lineTotal =
                    unitPrice && quantity ? unitPrice * quantity : null;

                  return (
                    <div
                      key={key}
                      className="flex gap-3 rounded-[10px] border border-vault-border bg-vault-raised p-3"
                    >
                      <div className="relative h-16 w-12 shrink-0 overflow-hidden rounded-[6px] bg-black/30">
                        {card.tcgImageUrl || card.image ? (
                          <Image
                            src={card.tcgImageUrl || card.image}
                            alt={card.name}
                            fill
                            className="object-contain"
                          />
                        ) : null}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="line-clamp-1 text-sm font-semibold text-vault-text">
                              {card.name}
                            </p>

                            <p className="mt-0.5 line-clamp-1 text-xs text-vault-textTertiary">
                              {card.setName} #{card.number}
                            </p>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleRemove(key)}
                            className="text-xs font-semibold text-vault-danger hover:text-vault-danger/80"
                          >
                            Remove
                          </button>
                        </div>

                        <div className="mt-3 flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-vault-textTertiary">
                              Qty
                            </span>

                            <input
                              type="number"
                              min={0}
                              value={quantity}
                              onChange={(e) =>
                                handleQuantityChange(key, e.target.value)
                              }
                              className="w-16 rounded-[6px] border border-vault-border bg-vault-surface px-2 py-1 text-xs text-vault-text outline-none focus:border-vault-accent"
                            />
                          </div>

                          <div className="text-right">
                            {unitPrice != null && (
                              <p className="font-vault text-xs font-semibold text-vault-text">
                                {formatGBP(unitPrice)} each
                              </p>
                            )}

                            {lineTotal != null && quantity > 1 && (
                              <p className="text-[11px] text-vault-textTertiary">
                                {formatGBP(lineTotal)}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-4 space-y-2 border-t border-vault-border pt-4">
                <WorkbenchButton
                  disabled={selectedList.length === 0 || adding}
                  onClick={handleAddAllToCollection}
                  variant="primary"
                >
                  {adding
                    ? "Adding..."
                    : user
                      ? "Add all to Collection"
                      : "Log in to add to Collection"}
                </WorkbenchButton>

                <button
                  type="button"
                  disabled={selectedList.length === 0}
                  onClick={handleClearAll}
                  className="w-full rounded-[10px] border border-vault-border bg-vault-raised px-4 py-2.5 text-sm font-semibold text-vault-textSecondary transition-colors hover:border-vault-danger/40 hover:text-vault-danger disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Clear selection
                </button>
              </div>
            </aside>
        </main>
      </div>

      {expandedCard && (
        <CardDetailsModal
          card={expandedCard}
          owned={false}
          dark
          onClose={() => setExpandedCard(null)}
        />
      )}

      {authModalOpen && (
        <AuthModal
          isOpen={authModalOpen}
          onClose={() => setAuthModalOpen(false)}
          onAuthSuccess={() => setAuthModalOpen(false)}
          defaultMode="login"
        />
      )}
    </Layout>
  );
}