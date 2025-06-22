'use client';

import React, { useState, useEffect } from 'react';
import { setCookie, getCookie } from '@/utils/cookieUtils';
import { useTheme } from '@/hooks/ThemeProvider';

export default function CookieSettingsModal({ onClose, onSave }) {
  const [trackingEnabled, setTrackingEnabled] = useState(true);
  const { dark } = useTheme();

  // Only read cookies client-side
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const trackingConsent = getCookie('trackingCookies');
      if (trackingConsent === 'false') {
        setTrackingEnabled(false);
      }
    }
  }, []);

  const saveSettings = () => {
    setCookie('trackingCookies', trackingEnabled ? 'true' : 'false', 365);
    if (onSave) onSave();
    onClose();
  };

  return (
    <div
      className="
        fixed inset-0 z-50 flex items-center justify-center
        bg-black/60 backdrop-blur-sm transition
      "
      aria-modal="true"
      role="dialog"
    >
      <div
        className="
          bg-light-surface dark:bg-dark-surface
          border border-light-border dark:border-dark-border
          rounded-2xl shadow-2xl
          w-full max-w-md mx-4 p-7
          transition-colors
        "
      >
        <h3 className="text-2xl font-bold mb-6 text-light-accent dark:text-dark-accent text-center">
          Cookie Settings
        </h3>
        <div className="mb-5">
          <label className="flex items-center gap-3 cursor-not-allowed">
            <input
              type="checkbox"
              checked
              disabled
              className="
                w-5 h-5 rounded border border-light-border dark:border-dark-border
                accent-light-accent dark:accent-dark-accent
                cursor-not-allowed
              "
              aria-disabled="true"
            />
            <span className="text-light-textMuted dark:text-dark-textMuted">
              Essential Cookies <span className="text-xs">(cannot be disabled)</span>
            </span>
          </label>
        </div>
        <div className="mb-8">
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={trackingEnabled}
              onChange={() => setTrackingEnabled((v) => !v)}
              className="
                w-5 h-5 rounded border border-light-border dark:border-dark-border
                accent-light-accent dark:accent-dark-accent
                focus:ring-2 focus:ring-light-accent dark:focus:ring-dark-accent
                transition
              "
              aria-checked={trackingEnabled}
            />
            <span className="text-light-text dark:text-dark-text">
              Enable Tracking Cookies
            </span>
          </label>
        </div>
        <div className="flex justify-center gap-4">
          <button
            onClick={saveSettings}
            className="
              px-6 py-2 rounded-full font-bold text-white
              bg-light-accent hover:bg-light-accentLight
              dark:bg-dark-accent dark:hover:bg-dark-accentLight
              shadow focus:outline-none focus-visible:ring-2
              focus-visible:ring-light-accent dark:focus-visible:ring-dark-accent
              transition
            "
            type="button"
          >
            Save Settings
          </button>
          <button
            onClick={onClose}
            className="
              px-6 py-2 rounded-full font-semibold
              bg-transparent border border-light-accent dark:border-dark-accent
              text-light-accent dark:text-dark-accent
              hover:bg-light-accent/10 dark:hover:bg-dark-accent/10
              focus:outline-none focus-visible:ring-2
              focus-visible:ring-light-accent dark:focus-visible:ring-dark-accent
              transition
            "
            type="button"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
