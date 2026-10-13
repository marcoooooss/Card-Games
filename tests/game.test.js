import test from "node:test";
import assert from "node:assert/strict";
import { getBattlePower, getWinner } from "../src/game.js";

const pokemon = (types, stats = {}) => ({
  types,
  stats: { attack: 50, defense: 50, speed: 50, ...stats },
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
