const API_BASE = "https://pokeapi.co/api/v2";
const pokemonCache = new Map();

export async function getRandomTeam(size = 3, excludedIds = []) {
  const excluded = new Set(excludedIds);
  const ids = new Set();

  while (ids.size < size) {
    const id = Math.floor(Math.random() * 1025) + 1;
    if (!excluded.has(id)) ids.add(id);
  }

  return Promise.all([...ids].map(getPokemon));
}

async function getPokemon(id) {
  if (!pokemonCache.has(id)) {
    const request = fetch(`${API_BASE}/pokemon/${id}`).then(async (response) => {
      if (!response.ok) {
        throw new Error(`PokéAPI respondió con el estado ${response.status}.`);
      }

      const pokemon = await response.json();
      return {
        id: pokemon.id,
        name: pokemon.name,
        image:
          pokemon.sprites.other["official-artwork"].front_default ??
          pokemon.sprites.front_default,
        pixelSprites: {
          front: pokemon.sprites.front_default,
          back: pokemon.sprites.back_default ?? pokemon.sprites.front_default,
        },
        types: pokemon.types.map(({ type }) => type.name),
        stats: Object.fromEntries(
          pokemon.stats.map(({ base_stat, stat }) => [stat.name, base_stat]),
        ),
      };
    });

    pokemonCache.set(id, request);
  }

  try {
    return await pokemonCache.get(id);
  } catch (error) {
    pokemonCache.delete(id);
    throw error;
  }
}

export function formatPokemonName(name) {
  return name
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
