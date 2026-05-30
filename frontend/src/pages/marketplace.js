// frontend/src/pages/marketplace.js
// Marketplace page — JSX, Pages Router, SSR disabled

"use client";

import React, { useContext, useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/router";
import { gql, useQuery } from "@apollo/client";

import Layout from "@/components/Layout/Layout";
import SecondaryHeader from "@/components/Marketplace/SecondaryHeader";
import FiltersBar from "@/components/Marketplace/FiltersBar";
import ListingGrid from "@/components/Marketplace/ListingGrid";
import ListingDetailModal from "@/components/Marketplace/ListingDetailModal";
import CreateListingModal from "@/components/Marketplace/CreateListingModal";
import MarketplaceRulesModal from "@/components/Marketplace/MarketplaceRulesModal";
import MyListingsDrawer from "@/components/Marketplace/MyListingsDrawer";
import BulkListingModal from "@/components/Marketplace/BulkListingModal";
import { AuthContext } from "@/components/Auth/AuthProvider";

const HAS_AGREED_QUERY = gql`
  query HasAgreedToMarketplaceRules {
    hasAgreedToMarketplaceRules
  }
`;

// Used when a notification link lands on /marketplace?listing=<id>
const GET_LISTING_BY_ID = gql`
  query GetListingById($id: ID!) {
    listing(id: $id) {
      __typename id type price currency quantity allowOffers status createdAt updatedAt
      ... on CardListing {
        cardId condition variation allowOffers willTrade moderationResult pendingOfferCount
        seller { id username avatar }
        cardInfo { id name number rarity setName imageSmall imageLarge }
      }
    }
  }
`;

function MarketplacePage() {
  const auth = useContext(AuthContext) || {};
  const token = auth.token || null;
  const isLoggedIn = !!(auth.user || token);

  const router = useRouter();

  const { data: agreedData, loading: agreedLoading, refetch: refetchAgreed } = useQuery(
    HAS_AGREED_QUERY,
    { skip: !isLoggedIn, fetchPolicy: "network-only" }
  );

  const hasAgreed = agreedData?.hasAgreedToMarketplaceRules === true;

  // Rules modal: only show for logged-in users who have a real server response.
  // agreedData stays undefined when the query is skipped (logged-out), so a stale
  // token can never flash the modal before auth settles.
  const showRulesModal = isLoggedIn && !agreedLoading && agreedData !== undefined && !hasAgreed;

  const [filters, setFilters] = useState({
    type: "CARD",
    status: "ACTIVE",
    search: "",
    sort: "",
  });

  const [detailListing, setDetailListing] = useState(null);
  const [showCreateListing, setShowCreateListing] = useState(false);
  const [showMyListings, setShowMyListings] = useState(false);
  const [showBulkListing, setShowBulkListing] = useState(false);

  // If a notification link lands on /marketplace?listing=<id>, auto-open the modal
  const [directListingId, setDirectListingId] = useState(null);
  useEffect(() => {
    const id = router.query?.listing;
    if (id && typeof id === "string") {
      setDirectListingId(id);
      // Strip the param from the URL without a full reload
      router.replace("/marketplace", undefined, { shallow: true });
    }
  }, [router.query?.listing]); // eslint-disable-line react-hooks/exhaustive-deps

  const { data: directListingData } = useQuery(GET_LISTING_BY_ID, {
    skip: !directListingId,
    variables: { id: directListingId },
    fetchPolicy: "network-only",
  });

  useEffect(() => {
    if (directListingData?.listing) {
      setDetailListing(directListingData.listing);
      setDirectListingId(null);
    }
  }, [directListingData]); // eslint-disable-line react-hooks/exhaustive-deps

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

          {isLoggedIn && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowMyListings(true)}
                className="rounded-full px-4 py-2 text-sm font-medium text-light-muted dark:text-dark-muted border border-light-border dark:border-dark-border hover:bg-light-surface dark:hover:bg-dark-surface transition-colors"
              >
                My listings
              </button>
              {hasAgreed && (
                <>
                  <button
                    type="button"
                    onClick={() => setShowBulkListing(true)}
                    className="rounded-full px-4 py-2 text-sm font-medium text-light-muted dark:text-dark-muted border border-light-border dark:border-dark-border hover:bg-light-surface dark:hover:bg-dark-surface transition-colors"
                  >
                    Bulk list
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowCreateListing(true)}
                    className="rounded-full px-5 py-2 text-sm font-semibold text-white bg-light-accent hover:bg-light-accentLight dark:bg-dark-accent dark:hover:bg-dark-accentLight transition-colors"
                  >
                    + List a card
                  </button>
                </>
              )}
            </div>
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
          onViewListings={() => {
            setShowCreateListing(false);
            setShowMyListings(true);
          }}
        />
      )}

      <MyListingsDrawer
        open={showMyListings}
        onClose={() => setShowMyListings(false)}
        token={token}
        onCreateListing={() => {
          setShowMyListings(false);
          setShowCreateListing(true);
        }}
      />

      <BulkListingModal
        open={showBulkListing}
        onClose={() => setShowBulkListing(false)}
        onComplete={() => {
          setShowBulkListing(false);
          setShowMyListings(true);
        }}
      />

      {showRulesModal && (
        <MarketplaceRulesModal
          isLoggedIn={isLoggedIn}
          onAgreed={() => refetchAgreed()}
        />
      )}
    </Layout>
  );
}

export default dynamic(() => Promise.resolve(MarketplacePage), { ssr: false });