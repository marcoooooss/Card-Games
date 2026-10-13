const TYPE_ADVANTAGES = {
  bug: ["dark", "grass", "psychic"],
  dark: ["ghost", "psychic"],
  dragon: ["dragon"],
  electric: ["flying", "water"],
  fairy: ["dark", "dragon", "fighting"],
  fighting: ["dark", "ice", "normal", "rock", "steel"],
  fire: ["bug", "grass", "ice", "steel"],
  flying: ["bug", "fighting", "grass"],
  ghost: ["ghost", "psychic"],
  grass: ["ground", "rock", "water"],
  ground: ["electric", "fire", "poison", "rock", "steel"],
  ice: ["dragon", "flying", "grass", "ground"],
  normal: [],
  poison: ["fairy", "grass"],
  psychic: ["fighting", "poison"],
  rock: ["bug", "fire", "flying", "ice"],
  steel: ["fairy", "ice", "rock"],
  water: ["fire", "ground", "rock"],
};

export const STAT_OPTIONS = [
  { key: "attack", label: "ATAQUE", short: "ATK" },
  { key: "defense", label: "DEFENSA", short: "DEF" },
  { key: "speed", label: "VELOCIDAD", short: "VEL" },
];

export function getBattlePower(pokemon, opponent, stat) {
  const typeAdvantage = pokemon.types.some((type) =>
    TYPE_ADVANTAGES[type]?.some((advantage) => opponent.types.includes(advantage)),
  );
  const typeDisadvantage = opponent.types.some((type) =>
    TYPE_ADVANTAGES[type]?.some((advantage) => pokemon.types.includes(advantage)),
  );
  const multiplier = typeAdvantage && !typeDisadvantage ? 1.2 : typeDisadvantage && !typeAdvantage ? 0.8 : 1;

  return {
    value: pokemon.stats[stat] * multiplier,
    multiplier,
  };
}

export function getWinner(player, opponent, stat) {
  const playerPower = getBattlePower(player, opponent, stat);
  const opponentPower = getBattlePower(opponent, player, stat);

  if (playerPower.value === opponentPower.value) {
    return { winner: "draw", playerPower, opponentPower };
  }

  return {
    winner: playerPower.value > opponentPower.value ? "player" : "opponent",
    playerPower,
    opponentPower,
  };
}
