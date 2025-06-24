import React, { useState, useRef, useEffect } from "react";
import { useTheme } from "@/hooks/ThemeProvider";
import setList from "@/utils/setList";

/**
 * SetAutocomplete
 * PROPS:
 *   value: the code value (controlled)
 *   onChange: function(code)
 *   onSelect: function(code)
 */
export default function SetAutocomplete({ value, onChange, onSelect }) {
  const [displayValue, setDisplayValue] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const inputRef = useRef();
  const optionsRef = useRef();
  const { dark } = useTheme();

  // Sync input when value prop changes
  useEffect(() => {
    if (!value) {
      setDisplayValue("");
      return;
    }
    const setObj = setList.find(
      (set) =>
        set.code.toLowerCase() === value.toLowerCase() ||
        (set.abbr && set.abbr.toLowerCase() === value.toLowerCase())
    );
    setDisplayValue(setObj ? setObj.abbr || setObj.code : value);
  }, [value]);

  // Filtered options by code, abbr, or name
  const options = !displayValue
    ? []
    : setList
        .filter(
          (set) =>
            (set.code && set.code.toLowerCase().includes(displayValue.toLowerCase())) ||
            (set.abbr && set.abbr.toLowerCase().includes(displayValue.toLowerCase())) ||
            (set.name && set.name.toLowerCase().includes(displayValue.toLowerCase()))
        )
        .slice(0, 10);

  // Handle keyboard navigation and selection
  const onKeyDown = (e) => {
    if (!showDropdown) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => (h + 1) % options.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
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
                src={opt.logo}
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
