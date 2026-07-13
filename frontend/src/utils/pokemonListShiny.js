import pokemonData from '@/data/pokemonList.json';

function buildShinySpriteUrl(normalSpriteUrl) {
  if (typeof normalSpriteUrl !== 'string' || !normalSpriteUrl.length) {
    return normalSpriteUrl;
  }
  return normalSpriteUrl.replace('/sprites/home/normal/', '/sprites/home/shiny/');
}

export function getPokemonDisplaySprite(pokemon, options = {}) {
  const {
    shinyChance = 0.05,
    forceShiny = null,
    rng = Math.random,
  } = options;

  const isShiny = typeof forceShiny === 'boolean' ? forceShiny : rng() < shinyChance;
  const normalSprite = pokemon?.sprite ?? null;
  const shinySprite = pokemon?.shinySprite ?? buildShinySpriteUrl(normalSprite);

  return {
    ...pokemon,
    displaySprite: isShiny && shinySprite ? shinySprite : normalSprite,
    isShiny,
  };
}

export function mapPokemonListWithDisplaySprites(list, options = {}) {
  if (!Array.isArray(list)) return [];
  return list.map((pokemon) => getPokemonDisplaySprite(pokemon, options));
}

const pokemonList = pokemonData;

export default pokemonList;
