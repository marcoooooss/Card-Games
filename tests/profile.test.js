import test from "node:test";
import assert from "node:assert/strict";
import {
  awardBattle,
  BOOSTER_COST,
  BOOSTER_SIZE,
  buildDeck,
  createProfile,
  DECK_SIZE,
  loadProfile,
  openBooster,
  PROFILE_STORAGE_KEY,
  saveProfile,
} from "../src/profile.js";

const starterIds = [1, 4, 7, 25, 39, 52];
const createStorage = () => {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    values,
  };
};

test("a new profile starts with a six-Pokémon deck and 100 coins", () => {
  const profile = createProfile(starterIds);

  assert.equal(profile.deck.length, DECK_SIZE);
  assert.equal(profile.coins, 100);
  assert.deepEqual(profile.deck, starterIds);
});

test("deck builder only accepts six unique owned Pokémon", () => {
  const profile = createProfile(starterIds);

  assert.throws(() => buildDeck(profile, [1, 4]), /6 Pokémon distintos/);
  assert.throws(() => buildDeck(profile, [1, 1, 4, 7, 25, 39]), /6 Pokémon distintos/);
  assert.throws(() => buildDeck(profile, [1, 4, 7, 25, 39, 99]), /6 Pokémon distintos/);
  assert.deepEqual(buildDeck(profile, [52, 39, 25, 7, 4, 1]).deck, [52, 39, 25, 7, 4, 1]);
});

test("a booster charges coins and adds all five pulled Pokémon", () => {
  const profile = createProfile(starterIds);
  const pulledIds = [133, 150, 151, 152, 153];
  const result = openBooster(profile, pulledIds);

  assert.equal(result.coins, 100 - BOOSTER_COST);
  assert.equal(pulledIds.length, BOOSTER_SIZE);
  assert.ok(pulledIds.every((id) => result.collection[id] === 1));
  assert.equal(profile.coins, 100);
});

test("a booster allows duplicate pulls and rejects insufficient coins", () => {
  const profile = createProfile(starterIds);
  const duplicatePull = [1, 4, 7, 25, 39];

  assert.equal(openBooster(profile, duplicatePull).collection[1], 2);
  assert.throws(() => openBooster({ ...profile, coins: 0 }, duplicatePull), /monedas/);
});

test("match rewards increase coins and update the season record", () => {
  const profile = createProfile(starterIds);

  assert.deepEqual(
    { ...awardBattle(profile, "win"), collection: undefined, deck: undefined, version: undefined },
    { ...profile, coins: 150, wins: 1, collection: undefined, deck: undefined, version: undefined },
  );
  assert.equal(awardBattle(profile, "loss").coins, 125);
  assert.equal(awardBattle(profile, "draw").coins, 135);
  assert.throws(() => awardBattle(profile, "quit"), /Resultado de combate/);
});

test("profile persists and invalid JSON is reported instead of silently reset", () => {
  const storage = createStorage();
  const profile = createProfile(starterIds);

  saveProfile(profile, storage);
  assert.deepEqual(loadProfile(storage), profile);
  storage.setItem(PROFILE_STORAGE_KEY, "{bad json");
  assert.throws(() => loadProfile(storage), /No se pudo leer el perfil/);
});
