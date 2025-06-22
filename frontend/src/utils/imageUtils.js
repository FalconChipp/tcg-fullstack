// Default image settings.
const FALLBACK_CARD_IMAGE = "https://cdn.pidgi.net/images/f/f6/Card_back_INTL_-_Pokemon_Trading_Card_Game.png";
const FALLBACK_SYMBOL_IMAGE = "/images/set-symbol-placeholder.svg"; // Use local SVG fallback image
const DEFAULT_IMAGE_QUALITY = "high";
const DEFAULT_IMAGE_EXTENSION = "webp";

// Debug flag - set to true to enable detailed logging
const DEBUG_IMAGE_UTILS = true;

/**
 * Log debug information if debug flag is enabled
 * @param {string} message - Debug message
 * @param {any} data - Optional data to log
 * @param {boolean} force - Force logging regardless of debug flag
 */
function debugLog(message, data, force = false) {
  if (DEBUG_IMAGE_UTILS || force) {
    if (data !== undefined) {
      // console.log(`[ImageUtils] ${message}`, data);
    } else {
      // console.log(`[ImageUtils] ${message}`);
    }
  }
}

// Create a directory for fallback images if it doesn't exist
// Note: This is handled server-side or during build, not in the browser

/**
 * Helper function for card images.
 * Handles various URL formats and ensures proper formatting.
 * @param {string} baseUrl - The base URL for the card image
 * @param {Object} options - Optional configuration
 * @param {string} options.cardName - Card name for debugging
 * @param {string} options.cardId - Card ID for debugging
 * @returns {string} - Properly formatted image URL or fallback
 */
export function getCardImageUrl(baseUrl, options = {}) {
  if (!baseUrl || typeof baseUrl !== 'string' || baseUrl.trim() === '') {
    return FALLBACK_CARD_IMAGE;
  }
  baseUrl = baseUrl.trim();

  try {
    // Relative local images
    if (baseUrl.startsWith('/')) return baseUrl;

    // Check for TCGdex asset and force correct format
    if (baseUrl.includes('assets.tcgdex.net')) {
      if (baseUrl.match(/\.(webp|png|jpg|jpeg|gif)$/i)) {
        return baseUrl; // already an image file
      }
      // Just append /high.webp for all TCGdex
      return `${baseUrl.replace(/\/+$/, "")}/${DEFAULT_IMAGE_QUALITY}.${DEFAULT_IMAGE_EXTENSION}`;
    }

    // Already ends with .webp? Use as is
    if (baseUrl.match(/\.(webp|png|jpg|jpeg|gif)$/i)) {
      return baseUrl;
    }

    // Is it some other remote image? Append quality/extension if not present
    if (baseUrl.startsWith('http')) {
      let cleanUrl = baseUrl.replace(/\/+$/, "");
      return `${cleanUrl}/${DEFAULT_IMAGE_QUALITY}.${DEFAULT_IMAGE_EXTENSION}`;
    }

    // Fallback
    return FALLBACK_CARD_IMAGE;
  } catch {
    return FALLBACK_CARD_IMAGE;
  }
}

/**
 * Helper function for set symbol images.
 * Handles various URL formats and ensures proper formatting.
 * @param {string} value - The URL or identifier for the set symbol
 * @param {Object} options - Optional configuration
 * @param {string} options.setName - Set name for debugging
 * @param {string} options.setId - Set ID for debugging
 * @returns {string} - Properly formatted image URL or fallback
 */
export function getSetSymbolUrl(value, options = {}) {
  if (!value || typeof value !== 'string' || value.trim() === '') {
    return FALLBACK_SYMBOL_IMAGE;
  }
  value = value.trim();

  try {
    // Relative, use as is
    if (value.startsWith('/')) return value;

    // TCGdex
    if (value.includes('assets.tcgdex.net')) {
      // Typical TCGdex set symbol URL: .../set/symbol
      // Append /high.webp (or your chosen quality/ext)
      let cleanUrl = value.replace(/\/+$/, "");
      return `${cleanUrl}/${DEFAULT_IMAGE_QUALITY}.${DEFAULT_IMAGE_EXTENSION}`;
    }

    // Already has extension? Use as is
    if (value.match(/\.(webp|png|jpg|jpeg|gif|svg)$/i)) {
      return value;
    }

    // Any other URL, append extension
    if (value.startsWith('http')) {
      let cleanUrl = value.replace(/\/+$/, "");
      return `${cleanUrl}.${DEFAULT_IMAGE_EXTENSION}`;
    }

    return FALLBACK_SYMBOL_IMAGE;
  } catch {
    return FALLBACK_SYMBOL_IMAGE;
  }
}