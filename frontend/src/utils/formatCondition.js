/**
 * Formats a card condition string for display
 * Converts snake_case to Title Case (e.g., "near_mint" -> "Near Mint")
 * 
 * @param {string} condition - The condition string to format
 * @returns {string} - The formatted condition string
 */
export function formatCondition(condition) {
  if (!condition) return "Unknown";
  
  return condition
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Gets a CSS class for a condition based on its value
 * 
 * @param {string} condition - The condition string
 * @returns {string} - The CSS class name
 */
export function getConditionClass(condition) {
  if (!condition) return "condition-unknown";
  
  const conditionMap = {
    'mint': 'condition-mint',
    'near_mint': 'condition-near-mint',
    'excellent': 'condition-excellent',
    'good': 'condition-good',
    'light_played': 'condition-light-played',
    'played': 'condition-played',
    'poor': 'condition-poor',
    'damaged': 'condition-damaged'
  };
  
  return conditionMap[condition.toLowerCase()] || 'condition-unknown';
}
