const API_BASE = "https://pokeapi.co/api/v2";
const pokemonCache = new Map();
const moveCache = new Map();

export async function getRandomTeam(size = 3, excludedIds = []) {
  const excluded = new Set(excludedIds);
  const ids = new Set();

  while (ids.size < size) {
    const id = Math.floor(Math.random() * 1025) + 1;
    if (!excluded.has(id)) ids.add(id);
  }

  return Promise.all([...ids].map(getPokemon));
}

export async function getPokemon(id) {
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
        moveRefs: pokemon.moves.map(({ move }) => ({
          name: move.name,
          url: move.url,
        })),
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

export async function getBattleMoves(pokemon) {
  const moveRefs = [...pokemon.moveRefs]
    .sort(() => Math.random() - 0.5)
    .slice(0, 8);
  const moveResults = await Promise.all(moveRefs.map(getMove));
  const availableMoves = moveResults
    .filter((move) => move.power > 0 || move.category === "status")
    .sort(() => Math.random() - 0.5)
    .slice(0, 4);

  if (!availableMoves.some((move) => move.power > 0)) {
    availableMoves.push({
      name: "tackle",
      power: 40,
      accuracy: 100,
      pp: 35,
      type: "normal",
      category: "physical",
    });
  }

  return availableMoves.map((move) => ({
    ...move,
    power: move.category === "status" ? 0 : move.power,
    restore: move.category === "status" ? Math.max(12, Math.round(pokemon.stats.hp * 0.18)) : 0,
    maxPp: move.pp,
  }));
}

async function getMove(reference) {
  if (!moveCache.has(reference.url)) {
    const request = fetch(reference.url).then(async (response) => {
      if (!response.ok) {
        throw new Error(`PokéAPI respondió con el estado ${response.status} al cargar un movimiento.`);
      }

      const move = await response.json();
      return {
        name: move.name,
        power: move.power ?? 0,
        accuracy: move.accuracy ?? 100,
        pp: move.pp ?? 10,
        type: move.type.name,
        category: move.damage_class.name,
      };
    });

    moveCache.set(reference.url, request);
  }

  try {
    return await moveCache.get(reference.url);
  } catch (error) {
    moveCache.delete(reference.url);
    throw error;
  }
}

export function formatPokemonName(name) {
  return name
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
