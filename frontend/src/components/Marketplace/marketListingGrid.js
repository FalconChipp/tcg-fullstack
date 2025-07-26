"use client";
import React, { useState, useRef, useEffect, useCallback } from "react";
import MarketplaceListingCard from "./marketListingCard";
import MarketplaceFilters from "./marketFilters";
import MarketplaceListingModal from "./marketDetailModal";

// Dummy data for now
const mockListings = [
  {
    id: "1", cardName: "Charizard GX", cardImage: "/cards/charizard-gx.png", setName: "Hidden Fates", cardNumber: "SV49",
    rarity: "Secret Rare", price: 164.99, proofImage: true, seller: "pkmJohn", listedAt: "2025-07-17T10:45:00Z", condition: "Near Mint", language: "English",
  },
  {
    id: "2", cardName: "Pikachu VMAX", cardImage: "/cards/pikachu-vmax.png", setName: "Vivid Voltage", cardNumber: "044/185",
    rarity: "Ultra Rare", price: 47.5, proofImage: false, seller: "charmander_uk", listedAt: "2025-07-18T14:28:00Z", condition: "Lightly Played", language: "English",
  },
  {
    id: "3", cardName: "Mewtwo EX", cardImage: "/cards/mewtwo-ex.png", setName: "XY Evolutions", cardNumber: "52/108",
    rarity: "Rare", price: 18.75, proofImage: true, seller: "pokeLiz", listedAt: "2025-07-19T16:12:00Z", condition: "Excellent", language: "English",
  },
  {
    id: "4", cardName: "Gardevoir ex", cardImage: "/cards/gardevoir-ex.png", setName: "Scarlet & Violet", cardNumber: "245/198",
    rarity: "Ultra Rare", price: 29.99, proofImage: false, seller: "mystictrainer", listedAt: "2025-07-18T12:02:00Z", condition: "Near Mint", language: "English",
  },
  {
    id: "5", cardName: "Snorlax", cardImage: "/cards/snorlax.png", setName: "Base Set", cardNumber: "27/102",
    rarity: "Rare", price: 21.0, proofImage: true, seller: "vintageVince", listedAt: "2025-07-17T09:10:00Z", condition: "Moderately Played", language: "English",
  },
  {
    id: "6", cardName: "Sylveon V", cardImage: "/cards/sylveon-v.png", setName: "Evolving Skies", cardNumber: "184/203",
    rarity: "Ultra Rare", price: 36.25, proofImage: false, seller: "eeveelutioner", listedAt: "2025-07-19T11:36:00Z", condition: "Near Mint", language: "English",
  },
  {
    id: "7", cardName: "Professor's Research", cardImage: "/cards/professors-research.png", setName: "Celebrations", cardNumber: "024/025",
    rarity: "Rare", price: 6.5, proofImage: false, seller: "deckmaster", listedAt: "2025-07-20T08:21:00Z", condition: "Near Mint", language: "English",
  },
  {
    id: "8", cardName: "Rayquaza VMAX", cardImage: "/cards/rayquaza-vmax.png", setName: "Evolving Skies", cardNumber: "218/203",
    rarity: "Secret Rare", price: 112.75, proofImage: true, seller: "dragonhero", listedAt: "2025-07-18T22:10:00Z", condition: "Lightly Played", language: "Japanese",
  },

  // ---- 32 MORE UNIQUE LISTINGS BELOW ----
  {
    id: "9", cardName: "Umbreon Gold Star", cardImage: "/cards/umbreon-gold-star.png", setName: "POP Series 5", cardNumber: "17/17",
    rarity: "Ultra Rare", price: 899.99, proofImage: true, seller: "collectorSam", listedAt: "2025-07-20T08:50:00Z", condition: "Near Mint", language: "English",
  },
  {
    id: "10", cardName: "Lugia", cardImage: "/cards/lugia.png", setName: "Neo Genesis", cardNumber: "9/111",
    rarity: "Rare", price: 140.0, proofImage: true, seller: "pkmDreamer", listedAt: "2025-07-19T19:44:00Z", condition: "Lightly Played", language: "English",
  },
  {
    id: "11", cardName: "Greninja Star", cardImage: "/cards/greninja-star.png", setName: "Celebrations", cardNumber: "SWSH144",
    rarity: "Ultra Rare", price: 12.5, proofImage: false, seller: "froakiefriend", listedAt: "2025-07-18T17:22:00Z", condition: "Near Mint", language: "English",
  },
  {
    id: "12", cardName: "Zacian V", cardImage: "/cards/zacian-v.png", setName: "Sword & Shield", cardNumber: "138/202",
    rarity: "Ultra Rare", price: 7.9, proofImage: false, seller: "wolfblade", listedAt: "2025-07-18T14:40:00Z", condition: "Excellent", language: "French",
  },
  {
    id: "13", cardName: "Gengar VMAX", cardImage: "/cards/gengar-vmax.png", setName: "Fusion Strike", cardNumber: "271/264",
    rarity: "Secret Rare", price: 85.5, proofImage: true, seller: "haunter93", listedAt: "2025-07-19T10:19:00Z", condition: "Near Mint", language: "English",
  },
  {
    id: "14", cardName: "Eevee", cardImage: "/cards/eevee.png", setName: "Jungle", cardNumber: "51/64",
    rarity: "Common", price: 1.2, proofImage: false, seller: "eeveeMaster", listedAt: "2025-07-20T10:02:00Z", condition: "Near Mint", language: "English",
  },
  {
    id: "15", cardName: "M Rayquaza EX", cardImage: "/cards/m-rayquaza-ex.png", setName: "Roaring Skies", cardNumber: "76/108",
    rarity: "Ultra Rare", price: 44.4, proofImage: true, seller: "skyhigh", listedAt: "2025-07-18T21:30:00Z", condition: "Excellent", language: "German",
  },
  {
    id: "16", cardName: "Blastoise", cardImage: "/cards/blastoise.png", setName: "Base Set", cardNumber: "2/102",
    rarity: "Rare", price: 95.0, proofImage: true, seller: "squirtletroop", listedAt: "2025-07-17T10:00:00Z", condition: "Lightly Played", language: "English",
  },
  {
    id: "17", cardName: "Shining Magikarp", cardImage: "/cards/shining-magikarp.png", setName: "Neo Revelation", cardNumber: "66/64",
    rarity: "Secret Rare", price: 370.0, proofImage: false, seller: "goldfishguy", listedAt: "2025-07-20T15:18:00Z", condition: "Near Mint", language: "English",
  },
  {
    id: "18", cardName: "Garchomp C LV.X", cardImage: "/cards/garchomp-clvx.png", setName: "Supreme Victors", cardNumber: "145/147",
    rarity: "Ultra Rare", price: 27.5, proofImage: false, seller: "cynthiafan", listedAt: "2025-07-18T09:41:00Z", condition: "Excellent", language: "English",
  },
  {
    id: "19", cardName: "Espeon EX", cardImage: "/cards/espeon-ex.png", setName: "Unseen Forces", cardNumber: "102/115",
    rarity: "Ultra Rare", price: 299.0, proofImage: true, seller: "sunnyday", listedAt: "2025-07-19T12:09:00Z", condition: "Moderately Played", language: "English",
  },
  {
    id: "20", cardName: "Entei", cardImage: "/cards/entei.png", setName: "Neo Revelation", cardNumber: "6/64",
    rarity: "Rare", price: 16.8, proofImage: false, seller: "legendchaser", listedAt: "2025-07-20T08:44:00Z", condition: "Excellent", language: "English",
  },
  {
    id: "21", cardName: "Gardevoir GX", cardImage: "/cards/gardevoir-gx.png", setName: "Burning Shadows", cardNumber: "93/147",
    rarity: "Ultra Rare", price: 18.4, proofImage: true, seller: "psychicwave", listedAt: "2025-07-17T20:15:00Z", condition: "Lightly Played", language: "Italian",
  },
  {
    id: "22", cardName: "Lucario VSTAR", cardImage: "/cards/lucario-vstar.png", setName: "Crown Zenith", cardNumber: "GG38/GG70",
    rarity: "Ultra Rare", price: 11.5, proofImage: false, seller: "auraMaster", listedAt: "2025-07-18T11:25:00Z", condition: "Near Mint", language: "English",
  },
  {
    id: "23", cardName: "Alakazam", cardImage: "/cards/alakazam.png", setName: "Base Set", cardNumber: "1/102",
    rarity: "Rare", price: 67.8, proofImage: true, seller: "mindreader", listedAt: "2025-07-19T17:41:00Z", condition: "Moderately Played", language: "English",
  },
  {
    id: "24", cardName: "Pidgeot", cardImage: "/cards/pidgeot.png", setName: "Jungle", cardNumber: "8/64",
    rarity: "Rare", price: 14.9, proofImage: false, seller: "birdnerd", listedAt: "2025-07-17T14:29:00Z", condition: "Excellent", language: "English",
  },
  {
    id: "25", cardName: "Mew", cardImage: "/cards/mew.png", setName: "Fates Collide", cardNumber: "29/124",
    rarity: "Rare", price: 12.9, proofImage: true, seller: "ancientMystic", listedAt: "2025-07-18T17:54:00Z", condition: "Near Mint", language: "English",
  },
  {
    id: "26", cardName: "Pikachu", cardImage: "/cards/pikachu.png", setName: "Base Set", cardNumber: "58/102",
    rarity: "Common", price: 6.0, proofImage: false, seller: "electricAce", listedAt: "2025-07-20T10:27:00Z", condition: "Near Mint", language: "German",
  },
  {
    id: "27", cardName: "Tapu Lele GX", cardImage: "/cards/tapu-lele-gx.png", setName: "Guardians Rising", cardNumber: "60/145",
    rarity: "Ultra Rare", price: 15.7, proofImage: true, seller: "guardianKing", listedAt: "2025-07-19T16:31:00Z", condition: "Lightly Played", language: "English",
  },
  {
    id: "28", cardName: "Charizard", cardImage: "/cards/charizard-base.png", setName: "Base Set", cardNumber: "4/102",
    rarity: "Rare", price: 220.0, proofImage: true, seller: "vintageHunter", listedAt: "2025-07-17T09:14:00Z", condition: "Good", language: "English",
  },
  {
    id: "29", cardName: "Ditto VMAX", cardImage: "/cards/ditto-vmax.png", setName: "Shining Fates", cardNumber: "SV119/SV122",
    rarity: "Ultra Rare", price: 19.5, proofImage: false, seller: "transfigure", listedAt: "2025-07-18T16:00:00Z", condition: "Excellent", language: "English",
  },
  {
    id: "30", cardName: "Machamp", cardImage: "/cards/machamp.png", setName: "Base Set", cardNumber: "8/102",
    rarity: "Rare", price: 9.8, proofImage: false, seller: "fightingpro", listedAt: "2025-07-19T13:39:00Z", condition: "Near Mint", language: "English",
  },
  {
    id: "31", cardName: "Zapdos", cardImage: "/cards/zapdos.png", setName: "Fossil", cardNumber: "15/62",
    rarity: "Rare", price: 24.2, proofImage: true, seller: "stormwing", listedAt: "2025-07-20T09:09:00Z", condition: "Moderately Played", language: "French",
  },
  {
    id: "32", cardName: "Reshiram & Charizard GX", cardImage: "/cards/reshiram-charizard-gx.png", setName: "Unbroken Bonds", cardNumber: "217/214",
    rarity: "Secret Rare", price: 120.0, proofImage: true, seller: "dueldragon", listedAt: "2025-07-17T22:01:00Z", condition: "Near Mint", language: "English",
  },
  {
    id: "33", cardName: "Gyarados", cardImage: "/cards/gyarados.png", setName: "Base Set", cardNumber: "6/102",
    rarity: "Rare", price: 41.5, proofImage: false, seller: "waterblast", listedAt: "2025-07-18T13:30:00Z", condition: "Excellent", language: "English",
  },
  {
    id: "34", cardName: "Lapras", cardImage: "/cards/lapras.png", setName: "Fossil", cardNumber: "10/62",
    rarity: "Rare", price: 18.2, proofImage: false, seller: "sealadmiral", listedAt: "2025-07-19T18:18:00Z", condition: "Lightly Played", language: "English",
  },
  {
    id: "35", cardName: "Cynthia", cardImage: "/cards/cynthia.png", setName: "Ultra Prism", cardNumber: "119/156",
    rarity: "Ultra Rare", price: 55.9, proofImage: true, seller: "sinnohqueen", listedAt: "2025-07-18T17:10:00Z", condition: "Near Mint", language: "English",
  },
  {
    id: "36", cardName: "Dragonite", cardImage: "/cards/dragonite.png", setName: "Fossil", cardNumber: "4/62",
    rarity: "Rare", price: 66.0, proofImage: false, seller: "dracopower", listedAt: "2025-07-20T12:09:00Z", condition: "Excellent", language: "English",
  },
  {
    id: "37", cardName: "Jolteon", cardImage: "/cards/jolteon.png", setName: "Jungle", cardNumber: "4/64",
    rarity: "Rare", price: 39.8, proofImage: false, seller: "lightningjack", listedAt: "2025-07-19T15:16:00Z", condition: "Moderately Played", language: "Japanese",
  },
  {
    id: "38", cardName: "Moltres & Zapdos & Articuno GX", cardImage: "/cards/trio-gx.png", setName: "Hidden Fates", cardNumber: "SM210",
    rarity: "Ultra Rare", price: 49.5, proofImage: true, seller: "triforce", listedAt: "2025-07-18T23:18:00Z", condition: "Near Mint", language: "English",
  },
  {
    id: "39", cardName: "Eevee V", cardImage: "/cards/eevee-v.png", setName: "Brilliant Stars", cardNumber: "101/172",
    rarity: "Ultra Rare", price: 10.7, proofImage: false, seller: "eeveelover", listedAt: "2025-07-20T16:10:00Z", condition: "Near Mint", language: "English",
  },
  {
    id: "40", cardName: "Lucario GX", cardImage: "/cards/lucario-gx.png", setName: "Forbidden Light", cardNumber: "120/131",
    rarity: "Ultra Rare", price: 17.5, proofImage: true, seller: "dojoMaster", listedAt: "2025-07-18T19:29:00Z", condition: "Excellent", language: "English", 
  }, 
]

// ---- Infinite Scroll settings ----
const PAGE_SIZE = 8; // Listings per page

// Filtering function (unchanged)
function filterListings(listings, filters) {
  let filtered = [...listings];
  if (filters.search) {
    const term = filters.search.toLowerCase();
    filtered = filtered.filter(
      (l) =>
        l.cardName.toLowerCase().includes(term) ||
        l.setName.toLowerCase().includes(term) ||
        l.seller.toLowerCase().includes(term)
    );
  }
  if (filters.rarity) {
    filtered = filtered.filter((l) => l.rarity === filters.rarity);
  }
  if (filters.condition) {
    filtered = filtered.filter((l) => l.condition === filters.condition);
  }
  if (filters.language) {
    filtered = filtered.filter((l) => l.language === filters.language);
  }
  if (filters.sort === "price_asc") {
    filtered.sort((a, b) => a.price - b.price);
  } else if (filters.sort === "price_desc") {
    filtered.sort((a, b) => b.price - a.price);
  }
  return filtered;
}

export default function MarketplaceListingGrid({ onAddToCart }) {
  // State for filters and modal (same)
  const [filters, setFilters] = useState({
    search: "",
    rarity: "",
    sort: "newest",
    condition: "",
    language: "",
  });
  const [modalListing, setModalListing] = useState(null);

  // --- Infinite scroll state ---
  const [page, setPage] = useState(1); // current loaded page
  const [isFetching, setIsFetching] = useState(false); // for UX/loader
  const loaderRef = useRef();

  // Filtered (full) listings
  const filteredListings = filterListings(mockListings, filters);

  // Listings to display on the grid (current page)
  const visibleListings = filteredListings.slice(0, PAGE_SIZE * page);

  // Reset page when filters/search changes
  useEffect(() => {
    setPage(1);
  }, [filters]);

  // Infinite scroll logic using IntersectionObserver
  const handleObserver = useCallback(
    (entries) => {
      const target = entries[0];
      if (target.isIntersecting && !isFetching && visibleListings.length < filteredListings.length) {
        setIsFetching(true);
        // Fake fetch delay for demo
        setTimeout(() => {
          setPage((prev) => prev + 1);
          setIsFetching(false);
        }, 400);
      }
    },
    [isFetching, visibleListings.length, filteredListings.length]
  );

  useEffect(() => {
    const option = { root: null, rootMargin: "80px", threshold: 0 };
    const observer = new window.IntersectionObserver(handleObserver, option);
    if (loaderRef.current) observer.observe(loaderRef.current);
    return () => {
      if (loaderRef.current) observer.unobserve(loaderRef.current);
    };
  }, [handleObserver]);

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
              onAddToCart={onAddToCart}
            />
          ))
        ) : (
          <div className="col-span-full text-center py-16 text-lg text-light-textMuted dark:text-dark-textMuted">
            No listings found. Try adjusting your filters.
          </div>
        )}
      </div>
      {/* Infinite scroll loader */}
      {visibleListings.length < filteredListings.length && (
        <div ref={loaderRef} className="py-8 flex justify-center">
          <div className="w-8 h-8 border-4 border-light-accent border-t-transparent rounded-full animate-spin" />
        </div>
      )}
      {/* Modal */}
      {modalListing && (
        <MarketplaceListingModal
          listing={modalListing}
          onClose={() => setModalListing(null)}
        />
      )}
    </>
  );
}