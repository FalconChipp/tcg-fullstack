"use client";
import React, { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { formatCurrency } from "@/utils/formatCurrency";
import BinderEditorModal from "@/components/Binder/BinderEditorModal";
import BinderSettingsModal from "@/components/Binder/BinderSettingsModal";
import Portal from "@/components/UI/Portal";
import CardSkeleton from "@/components/UI/CardSkeleton";
import BinderCover from "../Binder/BinderCover";

const WP_GRAPHQL_URL = process.env.NEXT_PUBLIC_GRAPHQL_ENDPOINT || "http://localhost:4000/graphql";

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
  const [selectedBinder, setSelectedBinder] = useState(null);
  const [showBinderEditor, setShowBinderEditor] = useState(false);
  const [showBinderSettings, setShowBinderSettings] = useState(false);
  const [newBinderSettings, setNewBinderSettings] = useState(null);
  const [statusMessage, setStatusMessage] = useState(null);

  const [bindersWithValues, setBindersWithValues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Fetch binders
  const fetchBinders = useCallback(() => {
    if (!userId) return;
    setLoading(true);
    setError("");
    const GET_BINDERS = `
      query GetUserBinders($userId: ID!, $page: Int, $pageSize: Int) {
        browseBinders(userId: $userId, page: $page, pageSize: $pageSize) {
          binders {
            id userId name description coverImage accentColor visibility slug createdAt updatedAt
          }
        }
      }
    `;
    fetch(WP_GRAPHQL_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: GET_BINDERS, variables: { userId: String(userId), page: 1, pageSize: 100 } })
    })
      .then((r) => r.json())
      .then(({ data, errors }) => {
        if (errors) {
          setError(errors?.[0]?.message || "Failed to load binders.");
          setBindersWithValues([]);
        } else {
          const userBinders = data?.browseBinders?.binders || [];
          const processed = userBinders.map((binder) => {
            const totalValue = (binder.pages || []).reduce(
              (total, page) => total + (page.tcgplayerMid || page.cardmarketAverageSell || 0),
              0
            );
            const cardsCount = (binder.pages || []).length;
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
  }, [userId]);

  useEffect(() => { fetchBinders(); }, [fetchBinders]);
  const refetch = () => fetchBinders();

  // Modal handlers
  const handleCreateBinder = () => setShowBinderSettings(true);
  const handleBinderSettingsConfirm = (settings) => {
    setNewBinderSettings(settings);
    setShowBinderSettings(false);
    setShowBinderEditor(true);
    setSelectedBinder(null);
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

  // ----- Skeleton grid (for loading/empty states) -----
  const SkeletonGrid = ({ count = 5 }) => (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6 mt-6">
      {/* If own profile, first panel is Add Binder card, rest are skeletons */}
      {isOwnProfile && (
        <div
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

  // ----- Main Render -----
  if (loading) {
    return (
      <section className="w-full max-w-8xl mx-auto mt-6">
        <SkeletonGrid />
      </section>
    );
  }

  if (error) {
    return (
      <section className="w-full max-w-8xl mx-auto mt-6">
        <div className="col-span-full text-light-error dark:text-dark-error py-10 text-center">
          Error loading binders: {error}
        </div>
        <SkeletonGrid />
      </section>
    );
  }

  if (bindersWithValues.length === 0) {
    return (
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
  }

  return (
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
      {/* Binder Settings Modal (for new binder) */}
      {showBinderSettings && (
        <BinderSettingsModal
          onConfirm={handleBinderSettingsConfirm}
          onClose={() => setShowBinderSettings(false)}
          // Always provide default colors for the modal, in case user skips color picker
          defaultCoverColor="#181822"
          defaultAccentColor="#7de95a"
        />
      )}
      {/* Binder Editor Modal (for new or edit) */}
      {showBinderEditor && (
        <Portal>
          <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
            <div className="bg-light-surface dark:bg-dark-surface rounded-lg shadow-xl w-full max-w-7xl h-full">
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
