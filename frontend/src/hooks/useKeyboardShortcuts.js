// src/hooks/useKeyboardShortcuts.js
import { useEffect } from 'react';
import { VIEW_MODES } from '@/utils/constants';

/**
 * Hook to bind editor keyboard shortcuts.
 * @param {object} handlers - functions for various actions
 * @param {number} currentPage
 * @param {function} setViewMode
 * @param {function} onClose
 */
export function useKeyboardShortcuts({ handlers, currentPage, setViewMode, onClose }) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.defaultPrevented) return;

      // Navigation
      if (e.key === 'ArrowLeft') {
        handlers.goToPage(Math.max(0, currentPage - 1));
        e.preventDefault();
      } else if (e.key === 'ArrowRight') {
        handlers.goToPage(currentPage + 1);
        e.preventDefault();
      }

      // View modes
      else if (e.altKey && e.key.toLowerCase() === 'g') {
        setViewMode(VIEW_MODES.GRID);
        e.preventDefault();
      } else if (e.altKey && e.key.toLowerCase() === 'l') {
        setViewMode(VIEW_MODES.LIST);
        e.preventDefault();
      } else if (e.altKey && e.key.toLowerCase() === 'c') {
        setViewMode(VIEW_MODES.COMPACT);
        e.preventDefault();
      }

      // Pages
      else if (e.altKey && e.key.toLowerCase() === 'n') {
        handlers.addPage();
        e.preventDefault();
      } else if (e.key === 'Delete') {
        handlers.deletePage(currentPage);
        e.preventDefault();
      }

      // Modal
      else if (e.key === 'Escape') {
        onClose();
        e.preventDefault();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handlers, currentPage, setViewMode, onClose]);
}
