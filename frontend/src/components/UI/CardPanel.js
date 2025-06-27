import React, { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { formatCurrency } from "@/utils/formatCurrency";
import BinderEditorModal from "@/components/Binder/BinderEditorModal";
import BinderSettingsModal from "@/components/Binder/BinderSettingsModal";
import Portal from "@/components/UI/Portal";

// --- CHANGES: Remove hardcoded colors, use only palette tokens everywhere ---

const WP_GRAPHQL_URL = process.env.NEXT_PUBLIC_GRAPHQL_ENDPOINT || "http://localhost:4000/graphql";

export default function ProfileBindersPanel({
  userId,
  isOwnProfile = false,
  dark = false,
  userEntireCollection = [],
  onBinderEditorOpen = () => {},
  onBinderEditorClose = () => {},
}) {
  // Modal/Editor State
  const [selectedBinder, setSelectedBinder] = useState(null);
  const [showBinderEditor, setShowBinderEditor] = useState(false);
  const [showBinderSettings, setShowBinderSettings] = useState(false);
  const [newBinderSettings, setNewBinderSettings] = useState(null);
  const [statusMessage, setStatusMessage] = useState(null);

  // Data State
  const [bindersWithValues, setBindersWithValues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Fetch binders
  const fetchBinders = useCallback(() => {
    if (!userId) return;
    setLoading(true);
    setError("");
    const GET_BINDERS = `
      query GetUserBinders($userId: ID!) {
        binders(userId: $userId) {
          id
          userId
          name
          layout
          slotsPerPage
          coverImageUrl
          createdAt
          updatedAt
          pages {
            id
            binderId
            userId
            cardId
            owned
            page
            position
            externalId
            name
            imageUrl
            setName
            setSymbolUrl
            rarity
            tcgplayerMarket
            tcgplayerMid
            cardmarketTrendPrice
            cardmarketAverageSell
            createdAt
            updatedAt
          }
        }
      }
    `;
    fetch(WP_GRAPHQL_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: GET_BINDERS, variables: { userId: String(userId) } })
    })
      .then((r) => r.json())
      .then(({ data, errors }) => {
        if (errors) {
          setError(errors?.[0]?.message || "Failed to load binders.");
          setBindersWithValues([]);
        } else {
          const userBinders = data?.binders || [];
          const processed = userBinders.map((binder) => {
            const totalValue = (binder.pages || []).reduce((total, page) => {
              return total + (page.tcgplayerMid || page.cardmarketAverageSell || 0);
            }, 0);
            const cardsCount = (binder.pages || []).length;
            return { ...binder, totalValue, cardsCount };
          });
          setBindersWithValues(processed);
          setError(""); // Clear any previous error
        }
        setLoading(false);
      })
      .catch(() => {
        setError("Failed to load binders.");
        setBindersWithValues([]);
        setLoading(false);
      });
  }, [userId]);

  useEffect(() => {
    fetchBinders();
  }, [fetchBinders]);

  // Refetch after save/edit
  const refetch = () => fetchBinders();

  // Modal handlers
  const handleCreateBinder = () => setShowBinderSettings(true);

  const handleBinderSettingsConfirm = (settings) => {
    setNewBinderSettings(settings);
    setShowBinderSettings(false);
    setShowBinderEditor(true);
    setSelectedBinder(null); // For new binder
  };

  const handleOpenBinder = (binder) => {
    setSelectedBinder(binder);
    setShowBinderEditor(true);
    setShowBinderSettings(false);
    setNewBinderSettings(null);
    onBinderEditorOpen();
  };

  const handleCloseEditor = () => {
    setShowBinderEditor(false);
    setSelectedBinder(null);
    setNewBinderSettings(null);
    onBinderEditorClose();
    refetch();
  };

  // --- Save logic (unchanged) ---
  async function handleSaveBinder(data) {
    setStatusMessage({ type: "info", message: "Saving binder..." });
    try {
      const isUpdate = !!data.id;
      const mutation = isUpdate
        ? `
        mutation UpdateBinder($id: ID!, $input: BinderInput!) {
          updateBinder(id: $id, input: $input) {
            id
            name
            description
            accentColor
            visibility
            slug
            createdAt
            updatedAt
          }
        }
      `
        : `
        mutation CreateBinder($input: BinderInput!) {
          createBinder(input: $input) {
            id
            name
            description
            accentColor
            visibility
            slug
            createdAt
            updatedAt
          }
        }
      `;

      const variables = isUpdate
        ? { id: data.id, input: { name: data.name, description: data.description, accentColor: data.accentColor, visibility: data.visibility || "public" } }
        : { input: { name: data.name, description: data.description, accentColor: data.accentColor, visibility: data.visibility || "public" } };

      const res = await fetch(WP_GRAPHQL_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: mutation, variables }),
      });

      const { data: result, errors } = await res.json();
      const key = isUpdate ? "updateBinder" : "createBinder";
      if (errors || !result?.[key]) {
        setStatusMessage({ type: "error", message: "Failed to save binder." });
        return false;
      }
      setStatusMessage({ type: "success", message: "Binder saved!" });
      return true;
    } catch (err) {
      setStatusMessage({ type: "error", message: err.message || "Error saving binder." });
      return false;
    }
  }

  // --- Skeleton grid, now fully palette based ---
  const skeletonGrid = (
    <>
      {isOwnProfile && (
        <div
          className="bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border rounded-2xl shadow p-4 flex flex-col items-center justify-center min-h-[230px] hover:bg-light-alt dark:hover:bg-dark-alt cursor-pointer transition"
          onClick={handleCreateBinder}
        >
          <div className="text-5xl text-light-textMuted dark:text-dark-textMuted mb-2 font-bold">+</div>
          <span className="text-light-textSecondary dark:text-dark-textSecondary font-semibold">New Binder</span>
        </div>
      )}
      {Array.from({ length: isOwnProfile ? 3 : 4 }).map((_, idx) => (
        <div
          key={idx}
          className="bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border rounded-2xl shadow flex flex-col p-3 min-h-[230px] pointer-events-none"
        >
          <div className="w-full aspect-[245/337] bg-light-alt dark:bg-dark-alt rounded-xl mb-3 relative"></div>
          <div className="mt-2 flex flex-col gap-2">
            <div className="h-3.5 bg-light-alt dark:bg-dark-alt rounded w-full"></div>
            <div className="h-3.5 bg-light-alt dark:bg-dark-alt rounded w-3/4"></div>
            <div className="h-3.5 bg-light-alt dark:bg-dark-alt rounded w-1/2"></div>
          </div>
        </div>
      ))}
    </>
  );

  // --- Binder card component, fully palette-based ---
  function BinderCard({ binder }) {
    return (
      <div
        className={`
          bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border
          rounded-2xl shadow p-4 flex flex-col relative group hover:shadow-xl transition
          cursor-pointer
        `}
        onClick={() => handleOpenBinder(binder)}
      >
        <div className="flex items-center gap-3 mb-3">
          <div className="w-14 h-14 rounded-lg overflow-hidden border-2 border-light-accent dark:border-dark-accent bg-light-alt dark:bg-dark-alt flex-shrink-0">
            <Image
              src={binder.coverImage || "https://placehold.co/100x100?text=Binder"}
              alt={binder.name}
              width={56}
              height={56}
              className="object-cover"
            />
          </div>
          <div>
            <div className="font-bold text-lg text-light-text dark:text-dark-text truncate">{binder.name}</div>
            <div className="text-sm text-light-textMuted dark:text-dark-textMuted">
              {binder.cardsCount} cards
            </div>
          </div>
        </div>
        <div className="flex-1 mb-3 text-sm text-light-textSecondary dark:text-dark-textSecondary">
          {binder.description || (
            <span className="italic text-light-textMuted dark:text-dark-textMuted">No description</span>
          )}
        </div>
        <div className="flex justify-between items-end mt-auto">
          <span className="text-xs text-light-textMuted dark:text-dark-textMuted">
            {binder.pages?.length || 0} pages
          </span>
          <span className="text-sm font-semibold text-light-accent dark:text-dark-accent">
            {formatCurrency(binder.totalValue)}
          </span>
        </div>
      </div>
    );
  }

  return (
    <section className="w-full max-w-8xl mx-auto mt-6">
      {/* Status Message */}
      {statusMessage && (
        <div
          className={`
            rounded-xl p-3 my-3 text-center font-semibold
            ${
              statusMessage.type === "success"
                ? "bg-light-success dark:bg-dark-success text-white"
                : statusMessage.type === "error"
                ? "bg-light-error dark:bg-dark-error text-white"
                : "bg-light-secondary dark:bg-dark-secondary text-white"
            }
          `}
        >
          {statusMessage.message}
        </div>
      )}

      {/* Grid layout */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {loading ? (
          skeletonGrid
        ) : error ? (
          <div className="col-span-full text-light-error dark:text-dark-error py-10 text-center">
            Error loading binders: {error}
          </div>
        ) : (
          <>
            {/* Add Binder card always first for own profile */}
            {isOwnProfile && (
              <div
                className="bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border rounded-2xl shadow p-4 flex flex-col items-center justify-center min-h-[230px] hover:bg-light-alt dark:hover:bg-dark-alt cursor-pointer transition"
                onClick={handleCreateBinder}
              >
                <div className="text-5xl text-light-textMuted dark:text-dark-textMuted mb-2 font-bold">+</div>
                <span className="text-light-textSecondary dark:text-dark-textSecondary font-semibold">New Binder</span>
              </div>
            )}
            {/* Skeletons + empty state if no binders */}
            {bindersWithValues.length === 0 ? (
              <>
                {Array.from({ length: isOwnProfile ? 3 : 4 }).map((_, idx) => (
                  <div
                    key={idx}
                    className="bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border rounded-2xl shadow flex flex-col p-3 min-h-[230px] pointer-events-none"
                  >
                    <div className="w-full aspect-[245/337] bg-light-alt dark:bg-dark-alt rounded-xl mb-3 relative"></div>
                    <div className="mt-2 flex flex-col gap-2">
                      <div className="h-3.5 bg-light-alt dark:bg-dark-alt rounded w-full"></div>
                      <div className="h-3.5 bg-light-alt dark:bg-dark-alt rounded w-3/4"></div>
                      <div className="h-3.5 bg-light-alt dark:bg-dark-alt rounded w-1/2"></div>
                    </div>
                  </div>
                ))}
              </>
            ) : (
              // All binder cards (after Add Binder card if own profile)
              bindersWithValues.map((binder) => (
                <BinderCard binder={binder} key={binder.id} />
              ))
            )}
          </>
        )}
      </div>

      {/* Binder Settings Modal (for new binder) */}
      {showBinderSettings && (
        <BinderSettingsModal
          onConfirm={handleBinderSettingsConfirm}
          onClose={() => setShowBinderSettings(false)}
        />
      )}

      {/* Binder Editor Modal (for new or edit) */}
      {showBinderEditor && (
        <Portal>
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
            <div className="bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border rounded-2xl shadow-2xl w-full max-w-7xl h-full">
              <BinderEditorModal
                binder={selectedBinder}
                settings={newBinderSettings}
                onSave={handleSaveBinder}
                onClose={handleCloseEditor}
                isOwnProfile={isOwnProfile}
                userEntireCollection={userEntireCollection}
              />
            </div>
          </div>
        </Portal>
      )}
    </section>
  );
}
