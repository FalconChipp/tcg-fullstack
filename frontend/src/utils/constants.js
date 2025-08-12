/**
 * Constants used throughout the application
 */

export const VIEW_MODES = {
  GRID: 'grid',
  LIST: 'list',
  COMPACT: 'compact'
};

// Add other constants as needed
export const CARD_CONDITIONS = {
  MINT: 'Mint',
  NEAR_MINT: 'Near Mint',
  LIGHTLY_PLAYED: 'Lightly Played',
  MODERATELY_PLAYED: 'Moderately Played',
  HEAVILY_PLAYED: 'Heavily Played',
  DAMAGED: 'Damaged'
};

export const CARD_RARITIES = {
  COMMON: 'Common',
  UNCOMMON: 'Uncommon',
  RARE: 'Rare',
  HOLO_RARE: 'Holo Rare',
  ULTRA_RARE: 'Ultra Rare',
  SECRET_RARE: 'Secret Rare'
}; 

export const WP_GRAPHQL_URL = process.env.NEXT_PUBLIC_GRAPHQL_ENDPOINT;
