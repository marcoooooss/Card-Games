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

export function getTypeMultiplier(moveType, defenderTypes) {
  return defenderTypes.reduce((multiplier, defenderType) => {
    if (TYPE_ADVANTAGES[moveType]?.includes(defenderType)) return multiplier * 2;
    if (TYPE_ADVANTAGES[defenderType]?.includes(moveType)) return multiplier * 0.5;
    return multiplier;
  }, 1);
}

export function calculateMove(attacker, defender, move, random = Math.random) {
  if (random() * 100 >= move.accuracy) {
    return { damage: 0, healing: 0, missed: true, effectiveness: 1 };
  }

  if (move.category === "status") {
    return {
      damage: 0,
      healing: Math.min(move.restore, attacker.stats.hp - attacker.currentHp),
      missed: false,
      effectiveness: 1,
    };
  }

  const special = move.category === "special";
  const attack = special ? attacker.stats["special-attack"] : attacker.stats.attack;
  const defense = special ? defender.stats["special-defense"] : defender.stats.defense;
  const stab = attacker.types.includes(move.type) ? 1.5 : 1;
  const effectiveness = getTypeMultiplier(move.type, defender.types);
  const baseDamage =
    (((2 * 50 / 5 + 2) * move.power * Math.max(1, attack) / Math.max(1, defense)) / 50 + 2) *
    stab *
    effectiveness;
  const variation = 0.85 + random() * 0.15;

  return {
    damage: Math.max(1, Math.floor(baseDamage * variation)),
    healing: 0,
    missed: false,
    effectiveness,
  };
}
