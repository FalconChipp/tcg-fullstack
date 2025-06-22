/**
 * Formats a card variation string into a user-friendly display format
 * 
 * @param {string} variation - The variation string to format (e.g., 'reverse_holo', 'first_edition')
 * @returns {string} - The formatted variation string
 */
export function formatVariation(variation) {
  if (!variation) return 'Standard';
  
  // Handle camelCase by inserting spaces before capital letters
  if (variation.match(/[A-Z]/)) {
    variation = variation.replace(/([A-Z])/g, ' $1').trim();
  }
  
  // Convert to title case and handle special cases
  return variation
    .toLowerCase()
    .split(/[_\s]/)
    .map(word => {
      // Handle special cases
      if (word === 'holofoil' || word === 'holo') return 'Holo';
      if (word === 'reverseholofoil' || word === 'reverse') return 'Reverse Holo';
      if (word === 'normal' || word === 'standard') return 'Standard';
      if (word === '1st' || word === 'first') return '1st Edition';
      if (word === 'unlimited') return 'Unlimited';
      if (word === 'nm') return 'Near Mint';
      if (word === 'lp') return 'Lightly Played';
      if (word === 'mp') return 'Moderately Played';
      if (word === 'hp') return 'Heavily Played';
      if (word === 'dmg') return 'Damaged';
      
      // Capitalize first letter
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ')
    .trim() || 'Standard';
}

/**
 * Formats a card condition string into a user-friendly display format
 * 
 * @param {string} condition - The condition string to format (e.g., 'near_mint', 'played')
 * @returns {string} - The formatted condition string
 */
export function formatCondition(condition) {
  if (!condition) return 'Unknown';
  
  return condition
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}