export const PROFILE_STORAGE_KEY = "pokeduel-profile-v1";
export const DECK_SIZE = 6;
export const BOOSTER_SIZE = 5;
export const BOOSTER_COST = 50;
export const BATTLE_REWARD = { win: 50, draw: 35, loss: 25 };

function validatePokemonIds(pokemonIds) {
  if (
    !Array.isArray(pokemonIds) ||
    pokemonIds.some((id) => !Number.isInteger(id) || id < 1 || id > 1025)
  ) {
    throw new Error("La selección contiene un número de Pokédex no válido.");
  }
}

export function createProfile(pokemonIds) {
  validatePokemonIds(pokemonIds);
  const ids = [...new Set(pokemonIds)];
  if (ids.length < DECK_SIZE) {
    throw new Error(`Necesitas al menos ${DECK_SIZE} Pokémon para crear un perfil.`);
  }

  return {
    version: 1,
    coins: 100,
    collection: Object.fromEntries(ids.map((id) => [id, 1])),
    deck: ids.slice(0, DECK_SIZE),
    wins: 0,
    losses: 0,
  };
}

export function validateProfile(profile) {
  if (
    !profile ||
    profile.version !== 1 ||
    !Number.isInteger(profile.coins) ||
    profile.coins < 0 ||
    !Number.isInteger(profile.wins) ||
    profile.wins < 0 ||
    !Number.isInteger(profile.losses) ||
    profile.losses < 0 ||
    !profile.collection ||
    Array.isArray(profile.collection) ||
    !Array.isArray(profile.deck)
  ) {
    throw new Error("El perfil de Pokéduel está dañado o tiene un formato no compatible.");
  }

  const ids = Object.keys(profile.collection);
  if (
    ids.some((id) => !/^\d+$/.test(id) || Number(id) < 1 || Number(id) > 1025 ||
      !Number.isInteger(profile.collection[id]) || profile.collection[id] < 1) ||
    profile.deck.length !== DECK_SIZE ||
    new Set(profile.deck).size !== DECK_SIZE ||
    profile.deck.some((id) => !ids.includes(String(id)))
  ) {
    throw new Error("El perfil de Pokéduel contiene un mazo o una colección no válidos.");
  }

  return profile;
}

export function loadProfile(storage = localStorage) {
  const savedProfile = storage.getItem(PROFILE_STORAGE_KEY);
  if (savedProfile === null) return null;

  try {
    return validateProfile(JSON.parse(savedProfile));
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error("No se pudo leer el perfil local de Pokéduel.", { cause: error });
    }
    throw error;
  }
}

export function saveProfile(profile, storage = localStorage) {
  storage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(validateProfile(profile)));
}

export function buildDeck(profile, pokemonIds) {
  validatePokemonIds(pokemonIds);
  const deck = [...pokemonIds];
  if (
    deck.length !== DECK_SIZE ||
    new Set(deck).size !== DECK_SIZE ||
    deck.some((id) => !profile.collection[id])
  ) {
    throw new Error(`El mazo debe tener ${DECK_SIZE} Pokémon distintos de tu colección.`);
  }

  return { ...profile, deck };
}

export function openBooster(profile, pokemonIds) {
  validatePokemonIds(pokemonIds);
  if (pokemonIds.length !== BOOSTER_SIZE) {
    throw new Error(`Un sobre debe contener exactamente ${BOOSTER_SIZE} Pokémon.`);
  }
  if (profile.coins < BOOSTER_COST) {
    throw new Error(`Necesitas ${BOOSTER_COST} monedas para comprar un sobre.`);
  }
  if (new Set(pokemonIds).size !== BOOSTER_SIZE) {
    throw new Error("Las cinco cartas del sobre deben ser Pokémon diferentes.");
  }

  const collection = { ...profile.collection };
  for (const id of pokemonIds) {
    collection[id] = (collection[id] ?? 0) + 1;
  }

  return {
    ...profile,
    coins: profile.coins - BOOSTER_COST,
    collection,
  };
}

export function awardBattle(profile, outcome) {
  const reward = BATTLE_REWARD[outcome];
  if (reward === undefined) throw new Error(`Resultado de combate no válido: ${outcome}.`);

  return {
    ...profile,
    coins: profile.coins + reward,
    wins: profile.wins + Number(outcome === "win"),
    losses: profile.losses + Number(outcome === "loss"),
  };
}

export function getCollectionIds(profile) {
  return Object.keys(profile.collection).map(Number);
}
