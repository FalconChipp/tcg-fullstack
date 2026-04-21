"use client";
import React, { useState, useEffect, useCallback, useContext } from "react";
import Image from "next/image";
import { formatCurrency } from "@/utils/formatCurrency";
import BinderEditorModal from "@/components/Binder/BinderEditorModal";
import BinderSettingsModal from "@/components/Binder/BinderSettingsModal";
import Portal from "@/components/UI/Portal";
import CardSkeleton from "@/components/UI/CardSkeleton";
import BinderCover from "../Binder/BinderCover";
import { AuthContext } from "@/components/Auth/AuthProvider";
import { executeMutation, COLLECTION_MUTATIONS } from "@/utils/graphqlUtils";

const WP_GRAPHQL_URL = process.env.NEXT_PUBLIC_GRAPHQL_ENDPOINT;

// Helper: Fills first row to 5 with skeletons (for grid parity)
const fillFirstRowSkeletons = (cardCount, isOwnProfile) => {
  const toFill = cardCount >= 5 ? 0 : 5 - cardCount;
  return Array.from({ length: toFill }).map((_, idx) => (
    <CardSkeleton key={`binder-skeleton-fill-${idx}`} />
  ));
};

export default function ProfileBindersPanel({
  userId,
  isOwnProfile = false,
  dark = false,
  userEntireCollection = [],
  onBinderEditorOpen = () => {},
  onBinderEditorClose = () => {},
}) {
  const { token } = useContext(AuthContext);

  const [selectedBinder, setSelectedBinder] = useState(null);
  const [showBinderEditor, setShowBinderEditor] = useState(false);
  const [showBinderSettings, setShowBinderSettings] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null);
  const [creating, setCreating] = useState(false);

  const [bindersWithValues, setBindersWithValues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // --- Fetch binders from backend ---
  const fetchBinders = useCallback(() => {
    if (!userId) return;
    setLoading(true);
    setError("");

    // Own profile: use myBinders (includes private binders, requires auth)
    // Other profile: use browseBinders (public only)
    const MY_BINDERS = `
      query MyBinders {
        myBinders {
          id userId name description coverColor accentColor visibility slug createdAt updatedAt
          pages { id layout pageOrder slots { id cardId position quantity notes } }
        }
      }
    `;
    const BROWSE_BINDERS = `
      query GetUserBinders($userId: ID!, $page: Int, $pageSize: Int) {
        browseBinders(userId: $userId, page: $page, pageSize: $pageSize) {
          binders {
            id userId name description coverColor accentColor visibility slug createdAt updatedAt
            pages { id layout pageOrder slots { id cardId position quantity notes } }
          }
        }
      }
    `;

    const query = isOwnProfile ? MY_BINDERS : BROWSE_BINDERS;
    const variables = isOwnProfile ? {} : { userId: String(userId), page: 1, pageSize: 100 };
    const headers = { "Content-Type": "application/json" };
    if (isOwnProfile && token) headers["Authorization"] = `Bearer ${token}`;

    fetch(WP_GRAPHQL_URL, {
      method: "POST",
      headers,
      body: JSON.stringify({ query, variables })
    })
      .then((r) => r.json())
      .then(({ data, errors }) => {
        if (errors) {
          setError(errors?.[0]?.message || "Failed to load binders.");
          setBindersWithValues([]);
        } else {
          const userBinders = isOwnProfile
            ? (data?.myBinders || [])
            : (data?.browseBinders?.binders || []);
          const processed = userBinders.map((binder) => {
            const totalValue = 0;
            const cardsCount = (binder.pages || []).reduce(
              (sum, p) => sum + (p.slots?.length || 0),
              0
            );
            return { ...binder, totalValue, cardsCount };
          });
          setBindersWithValues(processed);
          setError("");
        }
        setLoading(false);
      })
      .catch(() => {
        setError("Failed to load binders.");
        setBindersWithValues([]);
        setLoading(false);
      });
  }, [userId, isOwnProfile, token]);

  useEffect(() => { fetchBinders(); }, [fetchBinders]);
  const refetch = () => fetchBinders();

  // --- Modal handlers ---
  const handleCreateBinder = () => {
    setShowBinderSettings(true);
  };

  // -------- THE MAIN NEW CREATION FLOW ---------
  // Handle data returned from BinderSettingsModal.
  // The modal already performs the mutation to create the binder and first page
  // and passes the created binder back via onConfirm. We simply store it.
  const handleBinderSettingsConfirm = (binder) => {
    setCreating(true);
    try {
      setBindersWithValues(prev => [binder, ...prev]);
      setShowBinderSettings(false);
      setSelectedBinder(binder);
      setShowBinderEditor(true);
      setStatusMessage({ type: "success", message: "Binder created!" });
    } catch (err) {
      setStatusMessage({ type: "error", message: err.message || "Failed to create binder." });
    }
    setCreating(false);
  };

  const handleOpenBinder = (binder) => {
    setSelectedBinder(binder);
    setShowBinderEditor(true);
    setShowBinderSettings(false);
    onBinderEditorOpen();
  };
  const handleCloseEditor = () => {
    setShowBinderEditor(false);
    setSelectedBinder(null);
    onBinderEditorClose();
    refetch();
  };

  async function handleSaveBinder(data) {
    setStatusMessage({ type: "info", message: "Saving binder..." });
    try {
      const isUpdate = !!data.id;
      const mutation = isUpdate
        ? COLLECTION_MUTATIONS.UPDATE_BINDER
        : COLLECTION_MUTATIONS.CREATE_BINDER;

      const variables = isUpdate
        ? { id: data.id, input: {
            name: data.name,
            description: data.description,
            accentColor: data.accentColor,
            coverColor: data.coverColor,
            visibility: data.visibility || "public"
          } }
        : { input: {
            name: data.name,
            description: data.description,
            accentColor: data.accentColor,
            coverColor: data.coverColor,
            visibility: data.visibility || "public"
          } };

      const binderRes = await executeMutation(mutation, variables, token);

      const key = isUpdate ? "updateBinder" : "createBinder";
      if (!binderRes?.[key]) {
        setStatusMessage({ type: "error", message: "Failed to save binder." });
        return false;
      }

      // Optionally: update cards/pages/slots here if you want to push slot updates

      setStatusMessage({ type: "success", message: "Binder saved!" });
      refetch(); // Refresh the panel
      return true;
    } catch (err) {
      setStatusMessage({ type: "error", message: err.message || "Error saving binder." });
      return false;
    }
  }

  // ----- Skeleton grid (for loading/empty states) -----
  const SkeletonGrid = ({ count = 5 }) => (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6 mt-6">
      {/* If own profile, first panel is Add Binder card, rest are skeletons */}
      {isOwnProfile && (
        <div
          id="binder-create-btn"
          className="bg-light-surface dark:bg-dark-surface rounded-xl shadow p-3 flex flex-col items-center justify-center min-h-[420px] hover:bg-light-accent/10 dark:hover:bg-dark-accent/10 cursor-pointer transition"
          onClick={handleCreateBinder}
        >
          <div className="text-5xl text-light-textMuted dark:text-dark-textMuted mb-2 font-bold">+</div>
          <span className="text-light-textSecondary dark:text-dark-textSecondary font-semibold">New Binder</span>
        </div>
      )}
      {Array.from({ length: isOwnProfile ? count - 1 : count }).map((_, idx) => (
        <CardSkeleton key={`binder-skeleton-${idx}`} />
      ))}
    </div>
  );

  // ----- Binder Card (matches card panel size/layout) -----
  function BinderCard({ binder }) {
    return (
      <div
        className="bg-light-surface dark:bg-dark-surface rounded-xl shadow p-3 flex flex-col items-center min-h-[420px] hover:shadow-xl transition group"
        onClick={() => handleOpenBinder(binder)}
        style={{ cursor: "pointer" }}
      >
        <div className="w-full aspect-[245/337] bg-light-alt dark:bg-dark-alt rounded-lg mb-2 overflow-hidden flex items-center justify-center">
          <BinderCover
            color={binder.coverColor || "#181822"}
            accent={binder.accentColor || "#7de95a"}
            text="SixByFive"
            style={{ width: 350, height: 450 }}
          />
        </div>
        <div className="w-full flex flex-col items-start mt-1 flex-1">
          <span className="text-base font-bold truncate mb-1 text-light-text dark:text-dark-text">{binder.name}</span>
          <span className="text-sm text-light-textMuted dark:text-dark-textMuted">{binder.cardsCount} cards</span>
          <span className="text-xs text-light-textSecondary dark:text-dark-textSecondary">{binder.pages?.length || 0} pages</span>
          <span className="text-xs text-light-textSecondary dark:text-dark-textSecondary mt-1">
            {binder.description || <span className="italic text-light-textMuted dark:text-dark-textMuted">No description</span>}
          </span>
          <span className="text-sm font-semibold text-light-accent dark:text-dark-accent mt-2">{formatCurrency(binder.totalValue)}</span>
        </div>
      </div>
    );
  }

  // ---------- Main UI Content as Variable ----------
  let mainContent;
  if (loading) {
    mainContent = (
      <section className="w-full max-w-8xl mx-auto mt-6">
        <SkeletonGrid />
      </section>
    );
  } else if (error) {
    mainContent = (
      <section className="w-full max-w-8xl mx-auto mt-6">
        <div className="col-span-full text-light-error dark:text-dark-error py-10 text-center">
          Error loading binders: {error}
        </div>
        <SkeletonGrid />
      </section>
    );
  } else if (bindersWithValues.length === 0) {
    mainContent = (
      <section className="w-full max-w-8xl mx-auto mt-6">
        <div className="text-center py-8">
          <div className="flex flex-col items-center gap-2 mb-2">
            <span className="text-2xl font-bold text-light-accent dark:text-dark-accent">
              {isOwnProfile ? "You haven't created any binders yet." : "No binders to display."}
            </span>
            <span className="text-base text-light-textSecondary dark:text-dark-textSecondary">
              {isOwnProfile ? "Start a new binder to organise your cards!" : "No binders found for this user."}
            </span>
          </div>
        </div>
        <SkeletonGrid />
      </section>
    );
  } else {
    mainContent = (
      <section className="w-full max-w-8xl mx-auto mt-6">
        {/* Status Message */}
        {statusMessage && (
          <div
            className={`rounded p-3 my-3 text-center font-semibold ${
              statusMessage.type === "success"
                ? "bg-light-success dark:bg-dark-success text-white"
                : statusMessage.type === "error"
                ? "bg-light-error dark:bg-dark-error text-white"
                : "bg-light-accent dark:bg-dark-accent text-white"
            }`}
          >
            {statusMessage.message}
          </div>
        )}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
          {/* Add Binder panel always first if own profile */}
          {isOwnProfile && (
            <div
              id="binder-create-btn"
              className="bg-light-surface dark:bg-dark-surface rounded-xl shadow p-3 flex flex-col items-center justify-center min-h-[420px] hover:bg-light-accent/10 dark:hover:bg-dark-accent/10 cursor-pointer transition"
              onClick={handleCreateBinder}
            >
              <div className="text-5xl text-light-textMuted dark:text-dark-textMuted mb-2 font-bold">+</div>
              <span className="text-light-textSecondary dark:text-dark-textSecondary font-semibold">New Binder</span>
            </div>
          )}
          {/* Actual binder cards */}
          {bindersWithValues.map((binder) => (
            <BinderCard binder={binder} key={binder.id} />
          ))}
          {/* Fill first row to 5 with skeletons */}
          {fillFirstRowSkeletons(isOwnProfile ? bindersWithValues.length + 1 : bindersWithValues.length, isOwnProfile)}
        </div>
      </section>
    );
  }

  // -------------- Always Render Modals at End ----------------
  return (
    <>
      {mainContent}

      {/* Always render modals, regardless of content above */}
      {showBinderSettings && (
        <BinderSettingsModal
          onConfirm={handleBinderSettingsConfirm}
          onClose={() => setShowBinderSettings(false)}
          defaultCoverColor="#181822"
          defaultAccentColor="#7de95a"
          creating={creating}
        />
      )}
      {showBinderEditor && (
        <Portal>
          <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
            <div className="bg-light-surface dark:bg-dark-surface rounded-lg shadow-xl w-full max-w-7xl h-full">
              <BinderEditorModal
                binder={selectedBinder}
                onSave={handleSaveBinder}
                onClose={handleCloseEditor}
                isOwnProfile={isOwnProfile}
                userEntireCollection={userEntireCollection}
              />
            </div>
          </div>
        </Portal>
      )}
    </>
  );
}
