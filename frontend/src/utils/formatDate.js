import { devWarn, devError } from "@/utils/devLog";

/**
 * Formats a date string into a more readable format
 * 
 * @param {string} dateString - The date string to format
 * @param {Object} options - Formatting options
 * @param {boolean} options.includeTime - Whether to include the time in the output
 * @returns {string} - The formatted date string
 */
export function formatDate(dateString, options = {}) {
  if (!dateString) return "Unknown";
  
  try {
    const date = new Date(dateString);
    
    // Check if date is valid
    if (isNaN(date.getTime())) {
      devWarn(`Invalid date: ${dateString}`);
      return "Invalid Date";
    }
    
    const { includeTime = false } = options;
    
    const dateOptions = { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric'
    };
    
    if (includeTime) {
      dateOptions.hour = '2-digit';
      dateOptions.minute = '2-digit';
    }
    
    return date.toLocaleDateString(undefined, dateOptions);
  } catch (error) {
    devError(`Error formatting date: ${dateString}`, error);
    return "Date Error";
  }
}

/**
 * Formats a date string as a relative time (e.g., "2 days ago")
 * 
 * @param {string} dateString - The date string to format
 * @returns {string} - The relative time string
 */
export function formatRelativeTime(dateString) {
  if (!dateString) return "Unknown";
  
  try {
    const date = new Date(dateString);
    
    // Check if date is valid
    if (isNaN(date.getTime())) {
      devWarn(`Invalid date for relative time: ${dateString}`);
      return "Invalid Date";
    }
    
    const now = new Date();
    const diffInSeconds = Math.floor((now - date) / 1000);
    
    // Less than a minute
    if (diffInSeconds < 60) {
      return "just now";
    }
    
    // Less than an hour
    if (diffInSeconds < 3600) {
      const minutes = Math.floor(diffInSeconds / 60);
      return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'} ago`;
    }
    
    // Less than a day
    if (diffInSeconds < 86400) {
      const hours = Math.floor(diffInSeconds / 3600);
      return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
    }
    
    // Less than a week
    if (diffInSeconds < 604800) {
      const days = Math.floor(diffInSeconds / 86400);
      return `${days} ${days === 1 ? 'day' : 'days'} ago`;
    }
    
    // Less than a month
    if (diffInSeconds < 2592000) {
      const weeks = Math.floor(diffInSeconds / 604800);
      return `${weeks} ${weeks === 1 ? 'week' : 'weeks'} ago`;
    }
    
    // Less than a year
    if (diffInSeconds < 31536000) {
      const months = Math.floor(diffInSeconds / 2592000);
      return `${months} ${months === 1 ? 'month' : 'months'} ago`;
    }
    
    // More than a year
    const years = Math.floor(diffInSeconds / 31536000);
    return `${years} ${years === 1 ? 'year' : 'years'} ago`;
  } catch (error) {
    devError(`Error formatting relative time: ${dateString}`, error);
    return "Date Error";
  }
}
