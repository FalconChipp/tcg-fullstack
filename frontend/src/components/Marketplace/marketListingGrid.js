"use client";
import React, { useState } from "react";
import MarketplaceListingCard from "./marketListingCard";
import MarketplaceFilters from "./marketFilters";
import MarketplaceListingModal from "./marketDetailModal";

// Dummy data for now
const mockListings = [
  {
    id: "1",
    cardName: "Charizard GX",
    cardImage: "/cards/charizard-gx.png",
    setName: "Hidden Fates",
    cardNumber: "SV49",
    rarity: "Secret Rare",
    price: 164.99,
    proofImage: true,
    seller: "pkmJohn",
    listedAt: "2025-07-17T10:45:00Z",
    condition: "Near Mint",
    language: "English",
  },
  {
    id: "2",
    cardName: "Pikachu VMAX",
    cardImage: "/cards/pikachu-vmax.png",
    setName: "Vivid Voltage",
    cardNumber: "044/185",
    rarity: "Ultra Rare",
    price: 47.5,
    proofImage: false,
    seller: "charmander_uk",
    listedAt: "2025-07-18T14:28:00Z",
    condition: "Lightly Played",
    language: "English",
  },
  {
    id: "3",
    cardName: "Mewtwo EX",
    cardImage: "/cards/mewtwo-ex.png",
    setName: "XY Evolutions",
    cardNumber: "52/108",
    rarity: "Rare",
    price: 18.75,
    proofImage: true,
    seller: "pokeLiz",
    listedAt: "2025-07-19T16:12:00Z",
    condition: "Excellent",
    language: "English",
  },
  {
    id: "4",
    cardName: "Gardevoir ex",
    cardImage: "/cards/gardevoir-ex.png",
    setName: "Scarlet & Violet",
    cardNumber: "245/198",
    rarity: "Ultra Rare",
    price: 29.99,
    proofImage: false,
    seller: "mystictrainer",
    listedAt: "2025-07-18T12:02:00Z",
    condition: "Near Mint",
    language: "English",
  },
  {
    id: "5",
    cardName: "Snorlax",
    cardImage: "/cards/snorlax.png",
    setName: "Base Set",
    cardNumber: "27/102",
    rarity: "Rare",
    price: 21.0,
    proofImage: true,
    seller: "vintageVince",
    listedAt: "2025-07-17T09:10:00Z",
    condition: "Moderately Played",
    language: "English",
  },
  {
    id: "6",
    cardName: "Sylveon V",
    cardImage: "/cards/sylveon-v.png",
    setName: "Evolving Skies",
    cardNumber: "184/203",
    rarity: "Ultra Rare",
    price: 36.25,
    proofImage: false,
    seller: "eeveelutioner",
    listedAt: "2025-07-19T11:36:00Z",
    condition: "Near Mint",
    language: "English",
  },
  {
    id: "7",
    cardName: "Professor's Research",
    cardImage: "/cards/professors-research.png",
    setName: "Celebrations",
    cardNumber: "024/025",
    rarity: "Rare",
    price: 6.5,
    proofImage: false,
    seller: "deckmaster",
    listedAt: "2025-07-20T08:21:00Z",
    condition: "Near Mint",
    language: "English",
  },
  {
    id: "8",
    cardName: "Rayquaza VMAX",
    cardImage: "/cards/rayquaza-vmax.png",
    setName: "Evolving Skies",
    cardNumber: "218/203",
    rarity: "Secret Rare",
    price: 112.75,
    proofImage: true,
    seller: "dragonhero",
    listedAt: "2025-07-18T22:10:00Z",
    condition: "Lightly Played",
    language: "Japanese",
  },
];

// Filtering function
function filterListings(listings, filters) {
  let filtered = [...listings];

  // Search by card name, set, or seller (case-insensitive)
  if (filters.search) {
    const term = filters.search.toLowerCase();
    filtered = filtered.filter(
      (l) =>
        l.cardName.toLowerCase().includes(term) ||
        l.setName.toLowerCase().includes(term) ||
        l.seller.toLowerCase().includes(term)
    );
  }
  // Filter by rarity
  if (filters.rarity) {
    filtered = filtered.filter((l) => l.rarity === filters.rarity);
  }
  // Filter by condition
  if (filters.condition) {
    filtered = filtered.filter((l) => l.condition === filters.condition);
  }
  // Filter by language
  if (filters.language) {
    filtered = filtered.filter((l) => l.language === filters.language);
  }
  // Sort
  if (filters.sort === "price_asc") {
    filtered.sort((a, b) => a.price - b.price);
  } else if (filters.sort === "price_desc") {
    filtered.sort((a, b) => b.price - a.price);
  } // else newest (default order)
  return filtered;
}

export default function MarketplaceListingGrid() {
  // Add more filters as needed (e.g. condition, language)
  const [filters, setFilters] = useState({
    search: "",
    rarity: "",
    sort: "newest",
    condition: "",
    language: "",
  });

  const [modalListing, setModalListing] = useState(null);

  const visibleListings = filterListings(mockListings, filters);

  return (
    <>
      <MarketplaceFilters filters={filters} setFilters={setFilters} />
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-7">
        {visibleListings.length ? (
          visibleListings.map((listing) => (
            <MarketplaceListingCard
              key={listing.id}
              listing={listing}
              onClick={() => setModalListing(listing)}
            />
          ))
        ) : (
          <div className="col-span-full text-center py-16 text-lg text-light-textMuted dark:text-dark-textMuted">
            No listings found. Try adjusting your filters.
          </div>
        )}
      </div>

      {modalListing && (
        <MarketplaceListingModal
          listing={modalListing}
          onClose={() => setModalListing(null)}
        />
      )}
    </>
  );
}
