'use client';

import React, { useState, useEffect } from 'react';
import { useTheme } from '@/hooks/ThemeProvider';

export default function BackToTop() {
  const [isVisible, setIsVisible] = useState(false);
  const { dark } = useTheme();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleScroll = () => setIsVisible(window.scrollY > 300);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <button
      onClick={scrollToTop}
      className={`
        fixed bottom-6 left-6 z-50 w-12 h-12 rounded-full shadow-lg focus:outline-none 
        transition-all duration-300 ease-in-out transform hover:scale-105
        bg-light-accent dark:bg-dark-accent
        hover:bg-light-accentLight dark:hover:bg-dark-accentLight
        text-light-surface dark:text-dark-surface
        focus:ring-2 focus:ring-light-accent dark:focus:ring-dark-accent
        border-2 border-light-accent dark:border-dark-accent
        hover:border-light-accentLight dark:hover:border-dark-accentLight
        ${isVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'}
      `}
      aria-label="Back to Top"
    >
      <i className="fas fa-arrow-up text-2xl text-white" />
    </button>
  );
}
