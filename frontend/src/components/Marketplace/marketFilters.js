"use client";
import React, { useState, useEffect } from "react";
import { FaSearch } from "react-icons/fa";

// --- Options ---
const rarityOptions = [
  { value: "", label: "Any Rarity" },
  { value: "Common", label: "Common" },
  { value: "Rare", label: "Rare" },
  { value: "Ultra Rare", label: "Ultra Rare" },
  { value: "Secret Rare", label: "Secret Rare" },
];
const conditionOptions = [
  { value: "", label: "Any Condition" },
  { value: "Near Mint", label: "Near Mint" },
  { value: "Lightly Played", label: "Lightly Played" },
  { value: "Excellent", label: "Excellent" },
  { value: "Moderately Played", label: "Moderately Played" },
];
const languageOptions = [
  { value: "", label: "Any Language" },
  { value: "English", label: "English" },
  { value: "Japanese", label: "Japanese" },
];
const sortOptions = [
  { value: "newest", label: "Newest" },
  { value: "price_asc", label: "Lowest Price" },
  { value: "price_desc", label: "Highest Price" },
];

export default function MarketplaceFilters({
  filters,
  setFilters,
}) {
  // State for each filter
  const [search, setSearch] = useState(filters?.search || "");
  const [rarity, setRarity] = useState(filters?.rarity || "");
  const [condition, setCondition] = useState(filters?.condition || "");
  const [language, setLanguage] = useState(filters?.language || "");
  const [sort, setSort] = useState(filters?.sort || "newest");

  // Update parent whenever any filter changes
  useEffect(() => {
    setFilters({
      ...filters,
      search,
      rarity,
      condition,
      language,
      sort,
    });
    // eslint-disable-next-line
  }, [search, rarity, condition, language, sort]);

  return (
    <form
      className="
        flex flex-col md:flex-row flex-wrap items-center gap-4
        bg-light-surface dark:bg-dark-surface
        rounded-2xl p-4 mb-8 shadow
        border border-light-border dark:border-dark-border
      "
      onSubmit={e => e.preventDefault()}
    >
      {/* Search input (Card, Set, Seller) */}
      <div className="flex-1 w-full relative">
        <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-light-textMuted dark:text-dark-textMuted" />
        <input
          type="text"
          placeholder="Search by card, set, or seller"
          className="
            w-full pl-10 pr-3 py-2 rounded-xl bg-light-alt dark:bg-dark-alt
            border border-light-border dark:border-dark-border
            text-light-text dark:text-dark-text placeholder-light-textMuted dark:placeholder-dark-textMuted
            focus:border-light-accent dark:focus:border-dark-accent
            focus:outline-none transition
          "
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>
      {/* Rarity dropdown */}
      <select
        className="
          min-w-[140px] py-2 px-3 rounded-xl bg-light-alt dark:bg-dark-alt
          border border-light-border dark:border-dark-border
          text-light-text dark:text-dark-text focus:border-light-accent dark:focus:border-dark-accent
          transition
        "
        value={rarity}
        onChange={e => setRarity(e.target.value)}
      >
        {rarityOptions.map(opt => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
      {/* Condition dropdown */}
      <select
        className="
          min-w-[150px] py-2 px-3 rounded-xl bg-light-alt dark:bg-dark-alt
          border border-light-border dark:border-dark-border
          text-light-text dark:text-dark-text focus:border-light-accent dark:focus:border-dark-accent
          transition
        "
        value={condition}
        onChange={e => setCondition(e.target.value)}
      >
        {conditionOptions.map(opt => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
      {/* Language dropdown */}
      <select
        className="
          min-w-[140px] py-2 px-3 rounded-xl bg-light-alt dark:bg-dark-alt
          border border-light-border dark:border-dark-border
          text-light-text dark:text-dark-text focus:border-light-accent dark:focus:border-dark-accent
          transition
        "
        value={language}
        onChange={e => setLanguage(e.target.value)}
      >
        {languageOptions.map(opt => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
      {/* Sort dropdown */}
      <select
        className="
          min-w-[140px] py-2 px-3 rounded-xl bg-light-alt dark:bg-dark-alt
          border border-light-border dark:border-dark-border
          text-light-text dark:text-dark-text focus:border-light-accent dark:focus:border-dark-accent
          transition
        "
        value={sort}
        onChange={e => setSort(e.target.value)}
      >
        {sortOptions.map(opt => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </form>
  );
}
