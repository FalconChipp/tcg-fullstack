import React, { useState, useRef, useEffect, useMemo } from "react";
import { gql, useApolloClient } from "@apollo/client";
import { useTheme } from "@/hooks/ThemeProvider";
import { getSetLogo } from "@/utils/setLogos";
import fallbackSetList from "@/utils/setList";
import { normalizeSearchText } from "@/utils/normalizeSearchText";

const CARDSEARCH_SETS_QUERY = gql`
  query CardsearchSetAutocomplete($limit: Int!, $offset: Int!) {
    cardsearchSets(limit: $limit, offset: $offset) {
      code
      abbr
      name
      series
      releasedAt
      lang
    }
  }
`;

const CARDSEARCH_SET_PAGE_SIZE = 500;
const CARDSEARCH_SET_MAX_PAGES = 5;

/**
 * SetAutocomplete
 * PROPS:
 *   value: the code value (controlled)
 *   onChange: function(code)
 *   onSelect: function(code)
 */
export default function SetAutocomplete({ value, onChange, onSelect }) {
  const client = useApolloClient();
  const [displayValue, setDisplayValue] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const [sets, setSets] = useState([]);
  const [isLoadingSets, setIsLoadingSets] = useState(false);
  const [fetchError, setFetchError] = useState(null);
  const inputRef = useRef();
  const optionsRef = useRef();
  const { dark } = useTheme();

  useEffect(() => {
    let active = true;

    const loadSets = async () => {
      setIsLoadingSets(true);
      setFetchError(null);
      const aggregated = [];
      let offset = 0;

      try {
        for (let page = 0; page < CARDSEARCH_SET_MAX_PAGES; page += 1) {
          const { data } = await client.query({
            query: CARDSEARCH_SETS_QUERY,
            variables: { limit: CARDSEARCH_SET_PAGE_SIZE, offset },
            fetchPolicy: "cache-first",
          });

          const chunk = Array.isArray(data?.cardsearchSets) ? data.cardsearchSets : [];
          if (chunk.length === 0) break;

          aggregated.push(...chunk);
          if (chunk.length < CARDSEARCH_SET_PAGE_SIZE) break;
          offset += chunk.length;
        }

        if (!active) return;

        const normalized = [];
        const seenCodes = new Set();

        aggregated.forEach((set) => {
          if (!set || !set.code) return;
          const code = String(set.code).trim();
          if (!code) return;
          const key = code.toLowerCase();
          const name = set.name || code.toUpperCase();
          const lang = set.lang ? String(set.lang).trim().toLowerCase() : null;
          if (lang && lang !== "en") return;

          if (seenCodes.has(key)) return;
          seenCodes.add(key);

          const fallback = fallbackSetList.find((s) => String(s.code).toLocaleLowerCase() === key);
          const abbr = set.abbr ?? (fallback ? fallback.abbr : null); 

          normalized.push({
            code,
            abbr,
            name,
            logo: getSetLogo(name, code),
            series: set.series ?? null,
            releasedAt: set.releasedAt ?? null,
            lang: set.lang ?? null,
          });
        });

        if (normalized.length > 0) {
          setSets(normalized);
        } else if (fallbackSetList?.length) {
          setSets(fallbackSetList.map((set) => ({ ...set })));
        }
      } catch (err) {
        if (!active) return;
        setFetchError(err);
        if (fallbackSetList?.length) {
          setSets(fallbackSetList.map((set) => ({ ...set })));
        }
      } finally {
        if (active) setIsLoadingSets(false);
      }
    };

    loadSets();

    return () => {
      active = false;
    };
  }, [client]);

  // Sync input when value prop changes
  useEffect(() => {
    if (!value) {
      setDisplayValue("");
      return;
    }
    const setObj = sets.find(
      (set) =>
        set.code.toLowerCase() === value.toLowerCase() ||
        (set.abbr && set.abbr.toLowerCase() === value.toLowerCase())
    );
    setDisplayValue(setObj ? setObj.abbr || setObj.code : value);
  }, [value, sets]);

  // Filtered options by code, abbr, or name
  const options = useMemo(() => {
    if (!displayValue) return [];
    const query = normalizeSearchText(displayValue);
    if (!query) return [];

    return sets
      .filter(
        (set) =>
          (set.code && normalizeSearchText(set.code).includes(query)) ||
          (set.abbr && normalizeSearchText(set.abbr).includes(query)) ||
          (set.name && normalizeSearchText(set.name).includes(query))
      )
      .slice(0, 10);
  }, [displayValue, sets]);

  // Handle keyboard navigation and selection
  const onKeyDown = (e) => {
    if (!showDropdown) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!options.length) return;
      setHighlight((h) => (h + 1) % options.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (!options.length) return;
      setHighlight((h) => (h - 1 + options.length) % options.length);
    } else if (e.key === "Enter") {
      if (highlight >= 0 && options[highlight]) selectOption(options[highlight]);
    } else if (e.key === "Escape") {
      setShowDropdown(false);
    }
  };

  // Option select handler
  const selectOption = (opt) => {
    setDisplayValue(opt.abbr || opt.code);
    onChange(opt.code);
    if (onSelect) onSelect(opt.code);
    setShowDropdown(false);
    setHighlight(-1);
  };

  // Input handler
  const handleInputChange = (e) => {
    const val = e.target.value;
    setDisplayValue(val);
    setShowDropdown(true);
    setHighlight(-1); 
    onChange(val);    
  };


  // Click outside closes dropdown
  useEffect(() => {
    const onDocClick = (e) => {
      if (
        !inputRef.current?.contains(e.target) &&
        !optionsRef.current?.contains(e.target)
      ) {
        setShowDropdown(false);
      }
    };
    if (showDropdown) document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [showDropdown]);

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="text"
        value={displayValue}
        placeholder="e.g. Name, Code or Abbr"
        aria-label="Set Code"
        autoComplete="off"
        aria-autocomplete="list"
        aria-controls="set-autocomplete-list"
        aria-activedescendant={
          highlight >= 0 && showDropdown
            ? `set-option-${highlight}`
            : undefined
        }
        aria-expanded={showDropdown}
        role="combobox"
        className={`
          w-full border-[1.5px] rounded-xl px-4 py-3 text-base
          bg-light-alt dark:bg-dark-alt
          border-light-border dark:border-dark-border
          text-light-text dark:text-dark-text
          focus:border-light-accent dark:focus:border-dark-accent
          focus:outline-none transition
          `}
        onChange={handleInputChange}
        onFocus={() => setShowDropdown(true)}
        onKeyDown={onKeyDown}
      />
      {showDropdown && isLoadingSets && options.length === 0 && (
        <div
          className={`
            absolute left-0 top-full w-full mt-1 rounded-xl shadow-lg z-50
            border border-light-border dark:border-dark-border
            bg-light-surface dark:bg-dark-surface
            px-4 py-3 text-sm text-light-textMuted dark:text-dark-textMuted
          `}
        >
          Loading sets...
        </div>
      )}
      {showDropdown && fetchError && !isLoadingSets && options.length === 0 && (
        <div
          className={`
            absolute left-0 top-full w-full mt-1 rounded-xl shadow-lg z-50
            border border-light-border dark:border-dark-border
            bg-light-surface dark:bg-dark-surface
            px-4 py-3 text-sm text-light-textMuted dark:text-dark-textMuted
          `}
        >
          Unable to load sets. Showing fallback list.
        </div>
      )}
      {showDropdown && options.length > 0 && (
        <ul
          id="set-autocomplete-list"
          role="listbox"
          ref={optionsRef}
          className={`
            absolute left-0 top-full w-full mt-1 max-h-56 overflow-y-auto
            rounded-xl shadow-lg z-50
            border border-light-border dark:border-dark-border
            bg-light-surface dark:bg-dark-surface
            transition
          `}
        >
          {options.map((opt, idx) => (
            <li
              key={opt.code}
              id={`set-option-${idx}`}
              role="option"
              aria-selected={highlight === idx}
              tabIndex={-1}
              className={`
                flex items-center gap-2 px-4 py-2 cursor-pointer
                ${
                  highlight === idx
                    ? "bg-light-accent/20 dark:bg-dark-accent/20 text-light-accent dark:text-dark-accent font-semibold"
                    : "bg-light-surface dark:bg-dark-surface text-light-text dark:text-dark-text"
                }
                transition
              `}
              onMouseDown={() => selectOption(opt)}
              onMouseEnter={() => setHighlight(idx)}
            >
              <img
                src={opt.logo || getSetLogo(opt.name, opt.code)}
                alt={opt.name}
                width={56}
                height={56}
                // className="rounded bg-light-alt dark:bg-dark-alt border border-light-border dark:border-dark-border"
                style={{ objectFit: "contain" }}
              />
              <span className="min-w-[40px] font-bold">
                {opt.abbr || opt.code.toUpperCase()}
              </span>
              <span className="text-light-textMuted dark:text-dark-textMuted">
                {opt.name}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
