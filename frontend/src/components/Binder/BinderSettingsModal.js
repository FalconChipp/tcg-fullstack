import React, { useState, useEffect, useRef } from 'react';
import BinderCover, { STANDARD_COLOURS } from "@/components/Binder/BinderCover";

const LAYOUT_OPTIONS = [
  { value: '2x2', label: '2×2 (4 slots)', slots: 4 },
  { value: '3x3', label: '3×3 (9 slots)', slots: 9 },
  { value: '4x3', label: '4×3 (12 slots)', slots: 12 },
];

// Add these props for color defaults!
export default function BinderSettingsModal({
  onConfirm,
  onClose,
  dark = false,
  defaultCoverColor = "#181822",
  defaultAccentColor = "#7de95a"
}) {
  const [name, setName] = useState('');
  const [layout, setLayout] = useState('2x2');
  const [coverColor, setCoverColor] = useState(defaultCoverColor);
  const [accentColor, setAccentColor] = useState(defaultAccentColor);

  // Find default index for highlight
  const defaultIdx = STANDARD_COLOURS.findIndex(
    c => c.color === defaultCoverColor && c.accent === defaultAccentColor
  );
  const [selectedIdx, setSelectedIdx] = useState(defaultIdx >= 0 ? defaultIdx : 0);

  const modalRef = useRef();

  // Overlay click & ESC to close
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape') onClose();
    }
    function handleClick(e) {
      if (modalRef.current && !modalRef.current.contains(e.target)) onClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClick);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClick);
    };
  }, [onClose]);

  function handleSubmit(e) {
    e.preventDefault();
    const slots = LAYOUT_OPTIONS.find(o => o.value === layout).slots;
    onConfirm({
      name,
      layout,
      slots,
      coverColor,
      accentColor,
    });
  }

  // SCROLLABLE colour picker
  function renderColorPicker() {
    return (
      <div className="flex flex-col gap-2">
        <label className="block text-sm font-medium mb-2">
          Binder Colour
        </label>
        <div className="max-h-72 overflow-y-auto pr-1 overflow-x-hidden">
          <div className="grid grid-cols-3 md:grid-cols-3 gap-3">
            {STANDARD_COLOURS.map((c, idx) => (
              <button
                key={c.name}
                type="button"
                tabIndex={0}
                onClick={() => {
                  setCoverColor(c.color);
                  setAccentColor(c.accent);
                  setSelectedIdx(idx);
                }}
                className={`
                  relative group rounded-lg focus:outline-none p-0.5 border-2 transition
                  ${selectedIdx === idx ? "border-light-accent dark:border-dark-accent ring-2 ring-light-accent dark:ring-dark-accent" : "border-transparent"}
                `}
                aria-label={c.name}
              >
                <div className="flex flex-col items-center">
                  <BinderCover color={c.color} accent={c.accent} text="SixByFive" />
                  <span className="text-xs mt-1">{c.name}</span>
                </div>
                {selectedIdx === idx && (
                  <span className="absolute top-1 right-1 rounded-full bg-light-accent dark:bg-dark-accent p-1 flex items-center justify-center shadow">
                    <svg width="15" height="15" viewBox="0 0 20 20" fill="none">
                      <circle cx="10" cy="10" r="9" fill="#fff" opacity="0.9" />
                      <path d="M7 10.5L9.5 13L13 8" stroke="#22C55E" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div
        ref={modalRef}
        className={`
          w-full max-w-5xl p-8 rounded-2xl shadow-2xl border transition-all
          bg-light-surface border-light-border text-light-text
          dark:bg-dark-surface dark:border-dark-border dark:text-dark-text
        `}
      >
        <h2 className="text-2xl font-extrabold mb-8 text-center tracking-tight">
          Create New Binder
        </h2>
        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Left: Name and Layout */}
            <div className="flex flex-col gap-6">
              <div>
                <label htmlFor="binder-name" className="block text-sm font-medium mb-2">
                  Binder Name
                </label>
                <input
                  id="binder-name"
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  required
                  autoFocus
                  className={`
                    w-full px-4 py-2 rounded-xl border outline-none transition
                    bg-light-alt border-light-border text-light-text placeholder-light-textMuted
                    focus:border-light-accent
                    dark:bg-dark-alt dark:border-dark-border dark:text-dark-text dark:placeholder-dark-textMuted dark:focus:border-dark-accent
                  `}
                  placeholder="e.g. My Trades or Base Set"
                />
              </div>
              <div>
                <label htmlFor="binder-layout" className="block text-sm font-medium mb-2">
                  Layout
                </label>
                <select
                  id="binder-layout"
                  value={layout}
                  onChange={e => setLayout(e.target.value)}
                  required
                  className={`
                    w-full px-4 py-2 rounded-xl border outline-none transition
                    bg-light-alt border-light-border text-light-text
                    focus:border-light-accent
                    dark:bg-dark-alt dark:border-dark-border dark:text-dark-text dark:focus:border-dark-accent
                  `}
                >
                  {LAYOUT_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            </div>
            {/* Right: Colour Picker */}
            <div>
              {renderColorPicker()}
            </div>
          </div>
          {/* Modal buttons */}
          <div className="flex justify-end gap-4 mt-10">
            <button
              type="button"
              onClick={onClose}
              className={`
                px-5 py-2 font-semibold rounded-xl shadow transition
                bg-light-alt text-light-text hover:bg-light-border
                dark:bg-dark-alt dark:text-dark-text dark:hover:bg-dark-border
              `}
            >
              Cancel
            </button>
            <button
              type="submit"
              className={`
                px-7 py-2 font-bold rounded-xl shadow transition
                bg-light-primary text-white hover:bg-light-accent
                dark:bg-dark-primary dark:hover:bg-dark-accent
              `}
            >
              Create
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
