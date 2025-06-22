'use client';

import React, { useState, useEffect } from 'react';
import { useTheme } from '@/hooks/ThemeProvider';

export default function CookieBanner({ onShowSettings, onAccept }) {
  const [isVisible, setIsVisible] = useState(false);
  const { dark } = useTheme();

  // Cookie helpers (unchanged)
  const setCookie = (name, value, days) => {
    if (typeof document === 'undefined') return;
    let expires = '';
    if (days) {
      const date = new Date();
      date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000);
      expires = `; expires=${date.toUTCString()}`;
    }
    document.cookie = `${name}=${value || ''}${expires}; path=/`;
  };

  const getCookie = (name) => {
    if (typeof document === 'undefined') return null;
    const nameEQ = `${name}=`;
    const ca = document.cookie.split(';');
    for (let i = 0; i < ca.length; i++) {
      let c = ca[i];
      while (c.charAt(0) === ' ') c = c.substring(1, c.length);
      if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
    }
    return null;
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const cookieConsent = getCookie('cookieConsent');
      if (cookieConsent !== 'true') {
        setIsVisible(true);
      }
    }
  }, []);

  const acceptCookies = () => {
    setCookie('cookieConsent', 'true', 365);
    setIsVisible(false);
    if (onAccept) onAccept();
  };

  if (!isVisible) return null;

  return (
    <div
      className={`
        fixed bottom-0 left-0 right-0 z-50 p-3 md:p-4
        bg-light-surface/95 dark:bg-dark-surface/95
        border-t border-light-border dark:border-dark-border
        shadow-2xl
        backdrop-blur
        transition-colors
      `}
      aria-live="polite"
    >
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex-1">
          <p className="text-sm text-light-textSecondary dark:text-dark-textSecondary">
            We use cookies to enhance your experience. By continuing to visit this site you agree to our use of cookies.
          </p>
        </div>
        <div className="flex items-center gap-3 mt-2 md:mt-0">
          <button
            onClick={onShowSettings}
            className={`
              px-4 py-2 rounded-lg text-sm font-medium underline underline-offset-2
              bg-transparent
              text-light-accent dark:text-dark-accent
              hover:text-light-primary dark:hover:text-dark-primary
              focus:outline-none focus-visible:ring-2 focus-visible:ring-light-accent dark:focus-visible:ring-dark-accent
              transition-colors
            `}
            type="button"
          >
            Cookie Settings
          </button>
          <button
            onClick={acceptCookies}
            className={`
              px-5 py-2 rounded-full text-sm font-bold
              bg-light-accent hover:bg-light-accentLight
              dark:bg-dark-accent dark:hover:bg-dark-accentLight
              text-white
              focus:outline-none focus-visible:ring-2 focus-visible:ring-light-accent dark:focus-visible:ring-dark-accent
              shadow transition
              transition-colors
            `}
            type="button"
          >
            Accept All
          </button>
        </div>
      </div>
    </div>
  );
}
