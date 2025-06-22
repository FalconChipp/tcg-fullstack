'use client'; // <— Important for Next.js 13 App Router

import React, { createContext, useContext, useState, useEffect } from 'react';
import { setCookie, getCookie } from '@/utils/cookieUtils';

const defaultState = {
  dark: true,
  toggleDark: () => {},
};

const ThemeContext = createContext(defaultState);

// Set initial dark mode class before hydration
if (typeof document !== 'undefined') {
  const userPreference = getCookie('darkMode');
  const systemPreference = window.matchMedia?.('(prefers-color-scheme: dark)').matches;
  const isDark = userPreference ? userPreference === 'true' : systemPreference;
  if (isDark) {
    document.documentElement.classList.add('dark');
  }
}

export const ThemeProvider = ({ children }) => {
  // 1) Check if user preference is in cookies or system setting
  const [dark, setDark] = useState(() => {
    if (typeof window === 'undefined') {
      return true; // Default to dark mode on server
    }
    const userPreference = getCookie('darkMode');
    if (userPreference) {
      return userPreference === 'true';
    }
    // If no cookie, fall back to system preference
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches;
  });

  // 2) Listen for changes to system dark mode & store preference
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleChange = (event) => {
        const newPref = event.matches;
        setDark(newPref);
        setCookie('darkMode', newPref.toString(), 3650);
      };
      mediaQuery.addEventListener('change', handleChange);

      // Write current value to cookie
      setCookie('darkMode', dark.toString(), 3650);

      return () => {
        mediaQuery.removeEventListener('change', handleChange);
      };
    }
  }, [dark]);

  // 3) Add/remove dark class to html element
  useEffect(() => {
    if (typeof document !== 'undefined') {
      if (dark) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    }
  }, [dark]);

  // 4) Toggle function
  const toggleDark = () => {
    setDark((prevDark) => !prevDark);
  };

  return (
    <ThemeContext.Provider value={{ dark, toggleDark }}>
      {children}
    </ThemeContext.Provider>
  );
};

// Hook to use in other components
export const useTheme = () => useContext(ThemeContext);
