import React, { useEffect, useState } from "react";

/**
 * CachedImage:
 * Fetches an image via URL, caches it as a base64 data URL in localStorage,
 * and displays from cache if available for instant loading.
 * 
 * Props:
 *  - src: string (image URL)
 *  - alt: string
 *  - className: string
 *  - style: object
 *  - cacheKey: string (optional: override cache key)
 */
export default function CachedImage({ src, alt, className, style, cacheKey }) {
  const [dataUrl, setDataUrl] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!src) return;
    const storageKey = "achievementAssetCache:" + (cacheKey || src);
    // Try to load from localStorage
    const cached = localStorage.getItem(storageKey);
    if (cached) {
      setDataUrl(cached);
      return;
    }

    // Otherwise, fetch and cache
    fetch(src)
      .then(res => res.blob())
      .then(blob => {
        const reader = new FileReader();
        reader.onload = () => {
          try {
            localStorage.setItem(storageKey, reader.result);
          } catch (e) {
            // Handle quota exceeded
            // Optionally clear some cache here if needed
          }
          setDataUrl(reader.result);
        };
        reader.readAsDataURL(blob);
      })
      .catch(() => setError(true));
  }, [src, cacheKey]);

  // Show image if cached/fetched, else fallback (or loading indicator if you want)
  if (error) {
    return <span className="text-3xl">🏆</span>;
  }
  if (!src) {
    return <span className="text-3xl">🏆</span>;
  }
  if (!dataUrl) {
    // Optionally, add a skeleton or spinner here
    return (
      <span
        className="inline-block w-full h-full bg-gray-100 dark:bg-gray-700 animate-pulse rounded"
        aria-label={alt}
      ></span>
    );
  }
  return (
    <img
      src={dataUrl}
      alt={alt}
      className={className}
      style={style}
      loading="lazy"
      draggable={false}
    />
  );
}
