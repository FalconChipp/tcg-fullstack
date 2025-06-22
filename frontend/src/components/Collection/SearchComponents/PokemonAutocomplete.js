import React, { useState, useRef, useEffect } from "react";
import { useTheme } from "@/hooks/ThemeProvider";
import pokemonList from "@/utils/pokemonList";

export default function PokemonAutocomplete({ value, onChange, onSelect }) {
  const [showDropdown, setShowDropdown] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const inputRef = useRef();
  const optionsRef = useRef();
  const { dark } = useTheme();

  // Filter options
  const options = !value
    ? []
    : pokemonList
        .filter((p) => p.name.toLowerCase().includes(value.toLowerCase()))
        .slice(0, 10);

  // Keyboard navigation
  const onKeyDown = (e) => {
    if (!showDropdown) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => (h + 1) % options.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => (h - 1 + options.length) % options.length);
    } else if (e.key === "Enter") {
      if (highlight >= 0 && options[highlight]) {
        selectOption(options[highlight]);
      }
    } else if (e.key === "Escape") {
      setShowDropdown(false);
    }
  };

  // Option select
  const selectOption = (opt) => {
    onChange(opt.name);
    if (onSelect) onSelect(opt.name);
    setShowDropdown(false);
    setHighlight(-1);
  };

  // Click outside to close
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
        value={value}
        placeholder="Enter card name"
        aria-label="Card Name"
        autoComplete="off"
        aria-autocomplete="list"
        aria-controls="pokemon-autocomplete-list"
        aria-activedescendant={
          highlight >= 0 && showDropdown
            ? `pokemon-option-${highlight}`
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
        onChange={(e) => {
          onChange(e.target.value);
          setShowDropdown(true);
        }}
        onFocus={() => setShowDropdown(true)}
        onKeyDown={onKeyDown}
      />
      {showDropdown && options.length > 0 && (
        <ul
          id="pokemon-autocomplete-list"
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
              key={opt.name}
              id={`pokemon-option-${idx}`}
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
                src={opt.sprite}
                alt={opt.name}
                width={28}
                height={28}
                className="rounded bg-light-alt dark:bg-dark-alt border border-light-border dark:border-dark-border"
                style={{ objectFit: "contain" }}
              />
              <span>{opt.name}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
