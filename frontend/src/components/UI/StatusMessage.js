import React, { useEffect, useRef } from 'react';
import {
  CheckCircleIcon,
  ExclamationCircleIcon,
  InformationCircleIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';

/**
 * StatusMessage Toast
 * - Glassy, theme-aware, fade in/out, accessible.
 * - @param {'success'|'error'|'warning'|'info'} type
 * - @param {string} message
 * - @param {function} onClose
 */
export default function StatusMessage({ type = 'info', message, onClose }) {
  const messageRef = useRef(null);

  // Auto-dismiss after 4.8s
  useEffect(() => {
    const timer = setTimeout(() => {
      if (onClose) onClose();
    }, 4800);
    return () => clearTimeout(timer);
  }, [onClose]);

  // Type-dependent palette and icon
  const typeColor = {
    success: 'border-green-400 bg-green-50/90 dark:bg-green-900/90',
    error: 'border-red-400 bg-red-50/90 dark:bg-red-900/90',
    warning: 'border-yellow-300 bg-yellow-50/95 dark:bg-yellow-900/90',
    info: 'border-blue-400 bg-blue-50/90 dark:bg-blue-900/90',
  }[type] || 'border-blue-400 bg-blue-50/90 dark:bg-blue-900/90';

  // Icon
  const icon = {
    success: <CheckCircleIcon className="h-6 w-6 text-green-500" />,
    error: <ExclamationCircleIcon className="h-6 w-6 text-red-500" />,
    warning: <ExclamationCircleIcon className="h-6 w-6 text-yellow-500" />,
    info: <InformationCircleIcon className="h-6 w-6 text-blue-500" />,
  }[type];

  // Title
  const title = {
    success: 'Success',
    error: 'Error',
    warning: 'Warning',
    info: 'Info',
  }[type];

  return (
    <div
      ref={messageRef}
      className={`
        fixed top-6 right-4 z-[9999] w-full max-w-sm sm:max-w-md
        animate-in slide-in-from-top-4 fade-in
        transition-all duration-300
      `}
      role="alert"
      aria-live="polite"
      tabIndex={0}
    >
      <div
        className={`
          flex items-start gap-3 px-4 py-3 rounded-2xl shadow-2xl border-l-8
          backdrop-blur-md bg-opacity-95
          ${typeColor}
          dark:shadow-purple-950/30 shadow-purple-900/10
        `}
      >
        {/* Status Icon */}
        <div className="pt-0.5">{icon}</div>
        {/* Message */}
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm text-gray-900 dark:text-gray-100">
            {title}
          </div>
          <div className={`text-sm mt-0.5 break-words ${
            type === 'warning'
              ? 'text-yellow-800 dark:text-yellow-100'
              : 'text-gray-700 dark:text-gray-300'
          }`}>
            {message}
          </div>
        </div>
        {/* Close button */}
        <button
          onClick={onClose}
          className={`
            ml-2 flex-shrink-0 rounded-full p-1
            text-gray-400 hover:text-gray-700 dark:hover:text-gray-200
            focus:outline-none
            focus-visible:ring-2 focus-visible:ring-light-accent dark:focus-visible:ring-dark-accent
            focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-dark-surface
            transition
            hover:bg-black/5 dark:hover:bg-white/10
          `}
          aria-label="Close"
        >
          <XMarkIcon className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
