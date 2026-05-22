// frontend/src/pages/marketplace.js
// Marketplace page — JSX, Pages Router, SSR disabled

"use client";

import React, { useContext, useState } from "react";
import dynamic from "next/dynamic";
import { gql, useQuery } from "@apollo/client";

import Layout from "@/components/Layout/Layout";
import SecondaryHeader from "@/components/Marketplace/SecondaryHeader";
import FiltersBar from "@/components/Marketplace/FiltersBar";
import ListingGrid from "@/components/Marketplace/ListingGrid";
import ListingDetailModal from "@/components/Marketplace/ListingDetailModal";
import CreateListingModal from "@/components/Marketplace/CreateListingModal";
import MarketplaceRulesModal from "@/components/Marketplace/MarketplaceRulesModal";
import { AuthContext } from "@/components/Auth/AuthProvider";

const HAS_AGREED_QUERY = gql`
  query HasAgreedToMarketplaceRules {
    hasAgreedToMarketplaceRules
  }
`;

function MarketplacePage() {
  const auth = useContext(AuthContext) || {};
  const isLoggedIn = !!(auth.isAuthenticated || auth.accessToken || auth.token);

  const { data: agreedData, loading: agreedLoading, refetch: refetchAgreed } = useQuery(
    HAS_AGREED_QUERY,
    { skip: !isLoggedIn, fetchPolicy: "network-only" }
  );
  const hasAgreed = !isLoggedIn || agreedData?.hasAgreedToMarketplaceRules === true;
  const showRulesModal = isLoggedIn && !agreedLoading && !hasAgreed;

  const [filters, setFilters] = useState({
    type: "CARD",
    status: "ACTIVE",
    search: "",
    sort: "",
  });

  const [detailListing, setDetailListing] = useState(null);
  const [showCreateListing, setShowCreateListing] = useState(false);

  function handleFiltersChange(next) {
    const nextStatus = (next && next.status) || "ACTIVE";

    setFilters(
      Object.assign(
        {
          type: "CARD",
          status: nextStatus,
          search: "",
          sort: "",
        },
        next,
        {
          type: "CARD",
          status: nextStatus,
        }
      )
    );
  }

  const gridStatus = filters.status || "ACTIVE";
  const gridSearch = filters.search || undefined;
  const gridSort = filters.sort || undefined;

  return (
    <Layout>
      <div className="mx-auto max-w-7xl px-4 py-8">
        {/* ── Heading ── */}
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-light-strong dark:text-dark-strong">
              Marketplace
            </h1>
            <p className="text-sm text-light-muted dark:text-dark-muted mt-0.5">
              Browse community-listed Pokémon cards.
            </p>
          </div>

          {isLoggedIn && hasAgreed && (
            <button
              type="button"
              onClick={() => setShowCreateListing(true)}
              className="rounded-full px-5 py-2 text-sm font-semibold text-white bg-light-accent hover:bg-light-accentLight dark:bg-dark-accent dark:hover:bg-dark-accentLight transition-colors"
            >
              + List a card
            </button>
          )}
        </div>

        {/* ── Secondary header ── */}
        <div className="mb-6">
          <SecondaryHeader />
        </div>

        {/* ── Search/sort + grid ── */}
        <FiltersBar value={filters} onChange={handleFiltersChange} />

        <ListingGrid
          type="CARD"
          status={gridStatus}
          search={gridSearch}
          sort={gridSort}
          pageSize={24}
          onListingClick={(listing) => setDetailListing(listing)}
        />
      </div>

      {/* ── Modals ── */}
      {detailListing && (
        <ListingDetailModal
          listing={detailListing}
          onClose={() => setDetailListing(null)}
        />
      )}

      {showCreateListing && (
        <CreateListingModal
          onClose={() => setShowCreateListing(false)}
          onCreated={() => setShowCreateListing(false)}
        />
      )}

      {showRulesModal && (
        <MarketplaceRulesModal onAgreed={() => refetchAgreed()} />
      )}
    </Layout>
  );
}

export default dynamic(() => Promise.resolve(MarketplacePage), { ssr: false });