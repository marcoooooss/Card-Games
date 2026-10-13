import test from "node:test";
import assert from "node:assert/strict";
import { calculateMove, getBattlePower, getTypeMultiplier, getWinner } from "../src/game.js";

const pokemon = (types, stats = {}) => ({
  types,
  stats: {
    hp: 50,
    attack: 50,
    defense: 50,
    speed: 50,
    "special-attack": 50,
    "special-defense": 50,
    ...stats,
  },
});

test("type advantage raises the selected stat by twenty percent", () => {
  const fire = pokemon(["fire"], { attack: 80 });
  const grass = pokemon(["grass"]);

  assert.deepEqual(getBattlePower(fire, grass, "attack"), {
    value: 96,
    multiplier: 1.2,
  });
});

test("type disadvantage lowers the selected stat by twenty percent", () => {
  const grass = pokemon(["grass"], { speed: 70 });
  const fire = pokemon(["fire"]);

  assert.deepEqual(getBattlePower(grass, fire, "speed"), {
    value: 56,
    multiplier: 0.8,
  });
});

test("the winner is calculated using type-modified stats", () => {
  const water = pokemon(["water"], { attack: 50 });
  const fire = pokemon(["fire"], { attack: 60 });

  assert.equal(getWinner(water, fire, "attack").winner, "player");
});

test("equal battle power results in a draw", () => {
  const first = pokemon(["normal"], { defense: 63 });
  const second = pokemon(["normal"], { defense: 63 });

  assert.equal(getWinner(first, second, "defense").winner, "draw");
});

test("a move applies same-type and weakness bonuses in the damage formula", () => {
  const fire = {
    ...pokemon(["fire"], { attack: 80 }),
    currentHp: 100,
  };
  const grass = {
    ...pokemon(["grass"], { defense: 60 }),
    currentHp: 100,
  };
  const move = { power: 40, accuracy: 100, type: "fire", category: "physical" };
  const result = calculateMove(fire, grass, move, () => 0);
  const neutralDamage = calculateMove(
    fire,
    pokemon(["normal"], { defense: 60 }),
    move,
    () => 0,
  ).damage;

  assert.equal(getTypeMultiplier("fire", ["grass"]), 2);
  assert.ok(result.damage > neutralDamage);
  assert.equal(result.effectiveness, 2);
});

test("misses do no damage and status moves restore missing HP", () => {
  const attacker = { ...pokemon(["normal"]), currentHp: 20 };
  const defender = { ...pokemon(["normal"]), currentHp: 20 };
  const missed = calculateMove(attacker, defender, {
    power: 90, accuracy: 50, type: "normal", category: "physical",
  }, () => 0.9);
  const healed = calculateMove(attacker, defender, {
    power: 0, accuracy: 100, type: "normal", category: "status", restore: 18,
  }, () => 0);

  assert.equal(missed.damage, 0);
  assert.equal(missed.missed, true);
  assert.equal(healed.healing, 18);
});
