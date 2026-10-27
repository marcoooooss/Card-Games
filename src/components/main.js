import "./style.css";
import "./retro.css";
import { calculateMove, getTypeMultiplier } from "./game.js";
import {
  awardBattle,
  BOOSTER_COST,
  BOOSTER_SIZE,
  buildDeck,
  createProfile,
  DECK_SIZE,
  getCollectionIds,
  loadProfile,
  openBooster,
  saveProfile,
} from "./profile.js";
import {
  formatPokemonName,
  getBattleMoves,
  getPokemon,
  getRandomTeam,
} from "./services/pokeapi.js";

const MOVE_TIME = 1250;
const TURN_GAP = 600;
const elements = {
  arenaStatus: document.querySelector("#arena-status"),
  battleMessage: document.querySelector("#battle-message"),
  startButton: document.querySelector("#start-button"),
  playerHand: document.querySelector("#player-hand"),
  opponentHand: document.querySelector("#opponent-hand"),
  playerScore: document.querySelector("#player-score"),
  opponentScore: document.querySelector("#opponent-score"),
  roundCount: document.querySelector("#round-count"),
  roundDots: document.querySelector("#round-dots"),
  pixelStage: document.querySelector("#pixel-stage"),
  pixelRound: document.querySelector("#pixel-round"),
  pixelPlayerName: document.querySelector("#pixel-player-name"),
  pixelRivalName: document.querySelector("#pixel-rival-name"),
  pixelPlayerSprite: document.querySelector("#pixel-player-sprite"),
  pixelRivalSprite: document.querySelector("#pixel-rival-sprite"),
  pixelPlayerHp: document.querySelector("#pixel-player-hp"),
  pixelRivalHp: document.querySelector("#pixel-rival-hp"),
  pixelPlayerHpText: document.querySelector("#pixel-player-hp-text"),
  pixelRivalHpText: document.querySelector("#pixel-rival-hp-text"),
  pixelCallout: document.querySelector("#pixel-callout"),
  pixelBattleLog: document.querySelector("#pixel-battle-log"),
  coinCount: document.querySelector("#coin-count"),
  packWallet: document.querySelector("#pack-wallet"),
  openPackButton: document.querySelector("#open-pack-button"),
  packHint: document.querySelector("#pack-hint"),
  packResults: document.querySelector("#pack-results"),
  packPulls: document.querySelector("#pack-pulls"),
  deckCount: document.querySelector("#deck-count"),
  deckMeter: document.querySelector("#deck-meter"),
  deckSlots: document.querySelector("#deck-slots"),
  collectionCount: document.querySelector("#collection-count"),
  collectionGrid: document.querySelector("#collection-grid"),
  deckMessage: document.querySelector("#deck-message"),
  saveDeckButton: document.querySelector("#save-deck-button"),
  winCount: document.querySelector("#win-count"),
};

const state = {
  phase: "loading",
  view: "battle",
  profile: null,
  ownedPokemon: new Map(),
  draftDeck: [],
  playerTeam: [],
  opponentTeam: [],
  activePlayer: null,
  lastFaintedPlayer: null,
  activeOpponent: null,
  turn: 0,
  pixelScene: null,
  matchOutcome: null,
  lastBattleMessage: "",
  revealedPack: [],
};

function setMessage(message, tone = "") {
  elements.battleMessage.className = `battle-message${tone ? ` ${tone}` : ""}`;
  elements.battleMessage.innerHTML = `<span class="message-icon">✦</span><span>${message}</span>`;
}

function setDeckMessage(message, tone = "") {
  elements.deckMessage.className = `deck-message${tone ? ` ${tone}` : ""}`;
  elements.deckMessage.textContent = message;
}

function cardMarkup(pokemon, options = {}) {
  const {
    count = 1,
    action = "",
    selected = false,
    disabled = false,
    compact = false,
  } = options;
  const name = formatPokemonName(pokemon.name);

  return `
    <article class="pokemon-card collection-card ${compact ? "compact-card" : ""} ${selected ? "is-selected" : ""}" style="--type-color: ${getTypeColor(pokemon.types[0])}">
      <div class="card-top"><span class="card-id">N.º ${String(pokemon.id).padStart(3, "0")}</span><span class="type-badge">${pokemon.types[0]}</span></div>
      <div class="pokemon-art-wrap"><img class="pokemon-art" src="${pokemon.image}" alt="${name}" loading="lazy" /></div>
      <div class="card-name">${name}<span class="card-hp">HP ${pokemon.stats.hp}</span></div>
      <div class="type-list">${pokemon.types.map((type) => `<span>${type}</span>`).join("")}</div>
      <div class="collection-card-footer"><span>✦ ${count} ${count === 1 ? "CARTA" : "COPIAS"}</span>${action ? `<button class="collect-button ${selected ? "remove-from-deck" : ""}" data-collection-id="${pokemon.id}" type="button" ${disabled ? "disabled" : ""}>${selected ? "QUITAR" : "AÑADIR"} ${selected ? "−" : "+"}</button>` : ""}</div>
    </article>`;
}

function render() {
  elements.coinCount.textContent = state.profile?.coins ?? 0;
  elements.packWallet.textContent = state.profile?.coins ?? 0;
  elements.winCount.textContent = state.profile?.wins ?? 0;
  elements.deckCount.textContent = `${state.profile?.deck.length ?? 0} / ${DECK_SIZE}`;
  renderNavigation();
  renderBattle();
  renderDeckBuilder();
  renderPackShop();
}

function renderNavigation() {
  document.querySelectorAll(".view-tab").forEach((tab) => {
    const active = tab.dataset.view === state.view;
    tab.classList.toggle("is-active", active);
    tab.setAttribute("aria-current", active ? "page" : "false");
    tab.disabled =
      tab.dataset.view === "deck" &&
      !["loading", "idle", "finished"].includes(state.phase);
  });

  document.querySelectorAll(".view-pane").forEach((pane) => {
    pane.hidden = pane.id !== `view-${state.view}`;
  });
}

function renderBattle() {
  const activeFighter = state.activePlayer;
  const activeRival = state.activeOpponent;
  const playerFainted = state.playerTeam.filter(({ currentHp }) => currentHp <= 0).length;
  const rivalFainted = state.opponentTeam.filter(({ currentHp }) => currentHp <= 0).length;

  elements.playerScore.textContent = state.playerTeam.length - playerFainted;
  elements.opponentScore.textContent = state.opponentTeam.length - rivalFainted;
  elements.roundCount.textContent = state.turn ? String(state.turn).padStart(2, "0") : "—";
  elements.roundDots.innerHTML = state.playerTeam.length
    ? state.playerTeam
        .map(
          (pokemon) =>
            `<span class="round-dot ${pokemon.currentHp <= 0 ? "lost" : "won"} ${pokemon.key === activeFighter?.key && !["finished", "idle", "loading"].includes(state.phase) ? "active" : ""}" aria-label="${formatPokemonName(pokemon.name)} ${pokemon.currentHp <= 0 ? "debilitado" : "en pie"}"></span>`,
        )
        .join("")
    : Array.from({ length: DECK_SIZE }, () => '<span class="round-dot"></span>').join("");

  elements.arenaStatus.textContent = {
    loading: "CARGANDO TU PERFIL",
    idle: "TU EQUIPO TE ESPERA",
    "loading-rival": "BUSCANDO ENTRENADOR RIVAL",
    "choose-active": "ELIGE TU POKÉMON ACTIVO",
    "loading-moves": "PREPARANDO MOVIMIENTOS",
    "player-turn": "TU TURNO · ELIGE UN MOVIMIENTO",
    "player-attack": "¡TU POKÉMON ATACA!",
    "opponent-attack": "EL RIVAL RESPONDE",
    switching: "¡CAMBIO DE POKÉMON!",
    "opponent-error": "MOVIMIENTOS DEL RIVAL",
    finished: "COMBATE FINALIZADO",
  }[state.phase] ?? "PREPARANDO COMBATE";

  renderTeam(state.playerTeam, true);
  renderTeam(state.opponentTeam, false);
  renderPixelBattle();

  const buttons = {
    loading: ["Cargando tu perfil...", true],
    idle: [
      state.profile?.deck.length === DECK_SIZE ? "¡A buscar rival!" : "Completa tu mazo primero",
      !state.profile || state.profile.deck.length !== DECK_SIZE,
    ],
    "loading-rival": ["Buscando rival...", true],
    "choose-active": ["Elige una carta de tu mazo", true],
    "loading-moves": ["Preparando movimientos...", true],
    "player-turn": ["Elige uno de los movimientos", true],
    "player-attack": ["Resolviendo movimiento...", true],
    "opponent-attack": ["Turno del rival...", true],
    switching: ["Cambiando de Pokémon...", true],
    "opponent-error": ["Reintentar respuesta del rival", false],
    finished: ["¡Nueva partida!", false],
  };
  const [label, disabled] = buttons[state.phase] ?? ["A combatir", true];
  elements.startButton.innerHTML = `<span>${label}</span><span class="button-arrow">✦</span>`;
  elements.startButton.disabled = disabled;

  if (state.phase === "idle") {
    setMessage("Tu mazo está preparado. Empieza cuando estés listo; esta vez eliges cada Pokémon y cada movimiento.");
  } else if (state.phase === "choose-active" && !state.activePlayer) {
    setMessage("Primero, elige manualmente qué Pokémon de tu mazo quieres enviar al combate.");
  } else if (state.phase === "player-turn" && activeFighter) {
    setMessage(`${formatPokemonName(activeFighter.name)} está en el campo. ¿Qué movimiento ordenas?`);
  } else if (state.phase === "finished") {
    const ending = state.matchOutcome === "win"
      ? `¡Victoria! Ganas ${state.matchReward} monedas para tus sobres.`
      : state.matchOutcome === "draw"
        ? `¡Empate! Ganas ${state.matchReward} monedas para tus sobres.`
        : `El rival se lleva la partida. Ganas ${state.matchReward} monedas para nuevos sobres.`;
    setMessage(`${ending} Tu mazo y tu colección siguen guardados.`, state.matchOutcome === "win" ? "success" : "");
  }
}

function renderTeam(team, isPlayer) {
  const container = isPlayer ? elements.playerHand : elements.opponentHand;
  const active = isPlayer ? state.activePlayer : state.activeOpponent;

  if (!team.length) {
    container.innerHTML = '<div class="loading-hand"><span class="loader"></span> Esperando un mazo...</div>';
    return;
  }

  container.innerHTML = team
    .map((fighter) => {
      const name = formatPokemonName(fighter.name);
      const isActive = active?.key === fighter.key;
      const isAlive = fighter.currentHp > 0;
      const canChoose =
        isPlayer &&
        isAlive &&
        ["choose-active", "player-turn"].includes(state.phase);
      const canUseMoves = isPlayer && isActive && state.phase === "player-turn";
      const hpPercent = Math.max(0, Math.round((fighter.currentHp / fighter.stats.hp) * 100));

      if (canUseMoves && fighter.moves.length && fighter.pp.every((pp) => pp <= 0)) {
        fighter.moves.push({
          name: "struggle",
          power: 45,
          accuracy: 100,
          type: "normal",
          category: "physical",
          maxPp: 1,
        });
        fighter.pp.push(1);
      }

      if (!isPlayer && !isActive && isAlive && state.phase !== "finished") {
        return `<div class="opponent-card-back ${state.phase === "finished" ? "revealed-card" : ""}" aria-label="Pokémon rival en reserva"><span class="card-back-symbol">✦</span><span class="card-back-label">RESERVA</span></div>`;
      }

      return `
        <article class="pokemon-card ${isPlayer ? "player-card" : "rival-card"} battle-card ${isActive ? "is-active-card" : ""} ${!isAlive ? "is-fainted" : ""}" style="--type-color: ${getTypeColor(fighter.types[0])}">
          <div class="card-top"><span class="card-id">N.º ${String(fighter.id).padStart(3, "0")}</span><span class="type-badge">${fighter.types[0]}</span></div>
          <div class="pokemon-art-wrap"><img class="pokemon-art" src="${fighter.image}" alt="${name}" loading="lazy" /></div>
          <div class="card-name">${name}<span class="card-hp">${fighter.currentHp}/${fighter.stats.hp} PS</span></div>
          <div class="type-list">${fighter.types.map((type) => `<span>${type}</span>`).join("")}</div>
          <div class="card-health-track"><span style="width:${hpPercent}%;--health:${hpPercent < 25 ? "#e65b62" : "#63b970"}"></span></div>
          ${
            !isAlive
              ? '<span class="played-label">DEBILITADO</span>'
              : isActive
                ? `<span class="active-ribbon">✦ EN COMBATE</span>
                    ${
                      fighter.moves.length
                        ? `<div class="move-list">${fighter.moves
                            .map((move, index) => {
                              const pp = fighter.pp[index];
                              const type = getTypeColor(move.type);
                              return `<button class="move-button" type="button" data-fighter-key="${fighter.key}" data-move-index="${index}" ${!canUseMoves || pp <= 0 ? "disabled" : ""} style="--move-color:${type}"><span class="move-name">${formatPokemonName(move.name)}</span><span class="move-meta"><span>${move.type.toUpperCase()} · ${move.category === "status" ? `+${move.restore} PS` : `${move.power} POT.`}</span><strong>${pp}/${move.maxPp}</strong></span></button>`;
                            })
                            .join("")}</div>`
                        : `<div class="active-loading"><span class="loader"></span>${state.phase === "loading-moves" ? "Cargando movimientos..." : "Aún sin movimientos"}</div>`
                    }`
                : canChoose
                  ? `<button class="choose-pokemon-button" type="button" data-fighter-key="${fighter.key}">${state.phase === "choose-active" ? "ELEGIR ESTE POKÉMON" : "CAMBIAR · PIERDES UN TURNO"} <span>↗</span></button>`
                  : '<span class="reserve-label">EN RESERVA</span>'
          }
        </article>`;
    })
    .join("");
}

function renderPixelBattle() {
  const player = state.activePlayer ?? state.lastFaintedPlayer;
  const rival = state.activeOpponent;
  const outcome = state.pixelScene?.side ?? "";

  elements.pixelStage.dataset.mode = state.phase;
  elements.pixelStage.dataset.outcome = outcome;
  elements.pixelRound.textContent = state.turn ? String(state.turn).padStart(2, "0") : "—";
  updatePixelFighter(
    elements.pixelPlayerName,
    elements.pixelPlayerSprite,
    elements.pixelPlayerHp,
    elements.pixelPlayerHpText,
    player,
    "TU POKÉMON",
  );
  updatePixelFighter(
    elements.pixelRivalName,
    elements.pixelRivalSprite,
    elements.pixelRivalHp,
    elements.pixelRivalHpText,
    rival,
    "ENTRENADOR RIVAL",
  );
  elements.pixelBattleLog.textContent =
    state.pixelScene?.message ??
    (state.phase === "player-turn"
      ? `${formatPokemonName(rival?.name ?? "rival")} te observa... tu turno.`
      : "Elige un Pokémon activo; los dos equipos son tuyos para dirigir.");

  const callouts = {
    loading: ["¡TU AVENTURA!", "cargando tu colección"],
    idle: ["¡EQUIPO LISTO!", "tú eliges cómo empieza la pelea"],
    "loading-rival": ["¡UN RETO!", "buscando otro entrenador"],
    "choose-active": ["¡ADELANTE!", "elige quién sale al campo"],
    "loading-moves": ["¡CAMPO DE BATALLA!", "preparando los movimientos"],
    "player-turn": ["¡TU TURNO!", "elige el movimiento que quieres usar"],
    "player-attack": [state.pixelScene?.title ?? "¡MOVIMIENTO!", state.pixelScene?.message ?? "¡A combatir!"],
    "opponent-attack": [state.pixelScene?.title ?? "¡CONTRAATAQUE!", state.pixelScene?.message ?? "El rival responde"],
    switching: ["¡CAMBIO!", "el rival aprovechará el turno"],
    finished: [
      state.matchOutcome === "win" ? "¡VICTORIA!" : state.matchOutcome === "draw" ? "¡EMPATE!" : "¡FIN DEL COMBATE!",
      state.profile ? `✦ ${state.matchReward} MONEDAS` : "¡BUEN COMBATE!",
    ],
  };
  const [title, subtitle] = callouts[state.phase] ?? ["¡COMBATE!", "elige tu movimiento"];
  elements.pixelCallout.innerHTML = `<span>${title}</span><small>${subtitle}</small>`;
}

function updatePixelFighter(nameElement, spriteElement, hpElement, hpTextElement, fighter, fallbackName) {
  if (!fighter) {
    nameElement.textContent = fallbackName;
    spriteElement.removeAttribute("src");
    spriteElement.alt = "";
    hpElement.style.width = "100%";
    hpElement.dataset.level = "healthy";
    hpTextElement.textContent = "100 / 100";
    hpElement.parentElement.setAttribute("aria-valuenow", "100");
    return;
  }

  const hp = Math.max(0, fighter.currentHp);
  const hpPercent = Math.round((hp / fighter.stats.hp) * 100);
  nameElement.textContent = formatPokemonName(fighter.name);
  spriteElement.src = fighter.isPlayer ? fighter.pixelSprites.back : fighter.pixelSprites.front;
  spriteElement.alt = formatPokemonName(fighter.name);
  spriteElement.classList.toggle("is-fainted", hp === 0);
  hpElement.style.width = `${hpPercent}%`;
  hpElement.dataset.level = hpPercent <= 25 ? "low" : "healthy";
  hpTextElement.textContent = `${hp} / ${fighter.stats.hp}`;
  hpElement.parentElement.setAttribute("aria-valuenow", String(hpPercent));
}

function renderDeckBuilder() {
  if (!state.profile) return;
  const selectedIds = new Set(state.draftDeck);
  elements.deckMeter.textContent = `${state.draftDeck.length} / ${DECK_SIZE}`;
  elements.collectionCount.textContent = `${state.ownedPokemon.size} Pokémon · ${Object.values(state.profile.collection).reduce((sum, count) => sum + count, 0)} cartas`;
  elements.deckSlots.innerHTML = Array.from({ length: DECK_SIZE }, (_, index) => {
    const id = state.draftDeck[index];
    const pokemon = id ? state.ownedPokemon.get(id) : null;
    return pokemon
      ? `<div class="deck-slot">${cardMarkup(pokemon, { count: state.profile.collection[id], compact: true })}<button type="button" class="slot-remove" data-collection-id="${id}" aria-label="Quitar ${formatPokemonName(pokemon.name)} del mazo">×</button></div>`
      : `<div class="empty-slot"><span>${String(index + 1).padStart(2, "0")}</span><strong>ELIGE UN POKÉMON</strong></div>`;
  }).join("");
  elements.collectionGrid.innerHTML = [...state.ownedPokemon.values()]
    .sort((first, second) => first.id - second.id)
    .map((pokemon) =>
      cardMarkup(pokemon, {
        count: state.profile.collection[pokemon.id],
        action: "deck",
        selected: selectedIds.has(pokemon.id),
        disabled: !selectedIds.has(pokemon.id) && state.draftDeck.length >= DECK_SIZE,
      }),
    )
    .join("");
  const canSave =
    state.draftDeck.length === DECK_SIZE &&
    state.draftDeck.some((id, index) => id !== state.profile.deck[index]);
  elements.saveDeckButton.disabled = !canSave;
}

function renderPackShop() {
  const affordable = (state.profile?.coins ?? 0) >= BOOSTER_COST;
  elements.openPackButton.disabled = !state.profile || !affordable;
  elements.openPackButton.innerHTML = affordable
    ? '<span>Abrir sobre · 50 monedas</span><span class="button-arrow">✦</span>'
    : '<span>Necesitas más monedas</span><span class="button-arrow">✦</span>';
  elements.packHint.textContent = affordable
    ? "Cada sobre incluye cinco Pokémon sorpresa."
    : "Completa un combate y consigue monedas para el siguiente sobre.";
}

function getTypeColor(type) {
  const colors = {
    bug: "#9bc541", dark: "#75667c", dragon: "#8864da", electric: "#f5c83c",
    fairy: "#e998bb", fighting: "#e16653", fire: "#f47d42", flying: "#83a8e6",
    ghost: "#8879c9", grass: "#61b968", ground: "#d2a34c", ice: "#70cbd4",
    normal: "#aaa495", poison: "#ad6cc3", psychic: "#e67398", rock: "#bd9e53",
    steel: "#86aeb9", water: "#579be7",
  };
  return colors[type] ?? "#eab946";
}

function getOwnedFighter(id, index) {
  const pokemon = state.ownedPokemon.get(id);
  return makeFighter(pokemon, index, true);
}

function makeFighter(pokemon, index, isPlayer) {
  return {
    ...pokemon,
    key: `${pokemon.id}-${index}`,
    currentHp: pokemon.stats.hp,
    isPlayer,
    moves: [],
    pp: [],
  };
}

async function initializeProfile() {
  state.phase = "loading";
  render();

  try {
    let profile = loadProfile();
    let ownedPokemon;

    if (profile) {
      const collectionIds = getCollectionIds(profile);
      ownedPokemon = await Promise.all(collectionIds.map(getPokemon));
    } else {
      const starterTeam = await getRandomTeam(DECK_SIZE);
      profile = createProfile(starterTeam.map(({ id }) => id));
      ownedPokemon = starterTeam;
      saveProfile(profile);
    }

    state.profile = profile;
    state.ownedPokemon = new Map(ownedPokemon.map((pokemon) => [pokemon.id, pokemon]));
    state.draftDeck = [...profile.deck];
    state.playerTeam = profile.deck.map(getOwnedFighter);
    state.opponentTeam = [];
    state.activePlayer = null;
    state.lastFaintedPlayer = null;
    state.activeOpponent = null;
    state.turn = 0;
    state.phase = "idle";
    render();
  } catch (error) {
    console.error("No se pudo cargar el perfil de Pokéduel:", error);
    state.phase = "idle";
    render();
    setMessage(`No se pudo cargar tu partida: ${error.message}`, "danger");
  }
}

async function startBattle() {
  if (!state.profile || state.profile.deck.length !== DECK_SIZE) {
    switchView("deck");
    setDeckMessage("Elige seis Pokémon y guarda el mazo antes de combatir.", "danger");
    return;
  }

  state.phase = "loading-rival";
  state.playerTeam = state.profile.deck.map(getOwnedFighter);
  state.opponentTeam = [];
  state.activePlayer = null;
  state.activeOpponent = null;
  state.pixelScene = null;
  state.turn = 0;
  state.matchOutcome = null;
  state.matchReward = 0;
  render();

  try {
    const rivalTeam = await getRandomTeam(
      DECK_SIZE,
      state.profile.deck,
    );
    state.opponentTeam = rivalTeam.map((pokemon, index) =>
      makeFighter(pokemon, index, false),
    );
    state.activeOpponent = state.opponentTeam[0];
    state.phase = "choose-active";
    render();
  } catch (error) {
    console.error("No se pudo preparar al rival:", error);
    state.phase = "idle";
    render();
    setMessage(`No se pudo encontrar un rival: ${error.message}`, "danger");
  }
}

async function choosePlayerPokemon(key) {
  if (!["choose-active", "player-turn"].includes(state.phase)) return;

  const fighter = state.playerTeam.find((candidate) => candidate.key === key);
  if (!fighter || fighter.currentHp <= 0) return;
  const isSwitch = state.phase === "player-turn" && state.activePlayer?.key !== key;
  if (state.phase === "player-turn" && !isSwitch) return;

  if (isSwitch) state.turn += 1;
  state.activePlayer = fighter;
  state.lastFaintedPlayer = null;
  state.phase = isSwitch ? "switching" : "loading-moves";
  state.pixelScene = null;
  render();
  setMessage(isSwitch ? `${formatPokemonName(fighter.name)} entra al campo. El cambio deja al rival atacar.` : `${formatPokemonName(fighter.name)} entra en combate. Preparando sus movimientos...`);

  try {
    const [playerMoves, rivalMoves] = await Promise.all([
      fighter.moves.length ? fighter.moves : getBattleMoves(fighter),
      state.activeOpponent.moves.length
        ? state.activeOpponent.moves
        : getBattleMoves(state.activeOpponent),
    ]);
    fighter.moves = playerMoves;
    if (!fighter.pp.length) fighter.pp = playerMoves.map((move) => move.maxPp);
    state.activeOpponent.moves = rivalMoves;
    if (!state.activeOpponent.pp.length) {
      state.activeOpponent.pp = rivalMoves.map((move) => move.maxPp);
    }

    if (isSwitch) {
      state.phase = "opponent-attack";
      render();
      await sleep(TURN_GAP);
      await opponentTurn();
    } else {
      state.phase = "player-turn";
      render();
      setMessage(`Elige el primer movimiento de ${formatPokemonName(fighter.name)}.`);
    }
  } catch (error) {
    console.error("No se pudieron preparar los movimientos:", error);
    state.phase = "choose-active";
    render();
    setMessage(`No se pudieron cargar los movimientos: ${error.message}. Vuelve a elegir el Pokémon.`, "danger");
  }
}

async function playMove(key, moveIndex) {
  if (state.phase !== "player-turn" || state.activePlayer?.key !== key) return;
  const playerMove = state.activePlayer.moves[moveIndex];
  if (!playerMove || state.activePlayer.pp[moveIndex] <= 0) return;

  state.phase = "player-attack";
  state.turn += 1;
  state.activePlayer.pp[moveIndex] -= 1;
  const result = calculateMove(state.activePlayer, state.activeOpponent, playerMove);
  applyMoveResult(state.activePlayer, state.activeOpponent, playerMove, result);
  state.pixelScene = {
    side: playerMove.category === "status" ? "support" : "player",
    title: playerMove.category === "status" ? "¡APOYO!" : "¡ATACA!",
    message: battleText(state.activePlayer, state.activeOpponent, playerMove, result),
  };
  render();
  setMessage(state.pixelScene.message);
  await sleep(MOVE_TIME);

  if (state.activeOpponent.currentHp <= 0) {
    if (!await replaceFaintedOpponent()) return;
    state.phase = "player-turn";
    state.pixelScene = null;
    render();
    setMessage(`${formatPokemonName(state.activeOpponent.name)} sale a combatir. ¡Elige tu siguiente movimiento!`);
    return;
  }

  state.phase = "opponent-attack";
  state.pixelScene = {
    side: "opponent",
    title: "¡EL RIVAL ATACA!",
    message: `${formatPokemonName(state.activeOpponent.name)} se prepara para responder...`,
  };
  render();
  setMessage(state.pixelScene.message, "danger");
  await sleep(TURN_GAP);
  await opponentTurn();
}

function applyMoveResult(attacker, defender, move, result) {
  if (result.missed) return;
  if (move.category === "status") {
    attacker.currentHp = Math.min(attacker.stats.hp, attacker.currentHp + result.healing);
    return;
  }

  defender.currentHp = Math.max(0, defender.currentHp - result.damage);
}

function battleText(attacker, defender, move, result) {
  const attackerName = formatPokemonName(attacker.name);
  const moveName = formatPokemonName(move.name);

  if (result.missed) return `¡${attackerName} usa ${moveName}, pero falla!`;
  if (move.category === "status") {
    return `¡${attackerName} usa ${moveName} y recupera ${result.healing} PS!`;
  }
  const effectiveness = result.effectiveness > 1
    ? " ¡Es supereficaz!"
    : result.effectiveness < 1
      ? " No es muy eficaz..."
      : "";
  const knockout = defender.currentHp <= 0 ? ` ¡${formatPokemonName(defender.name)} se debilita!` : "";
  return `¡${attackerName} usa ${moveName}! ${result.damage} de daño.${effectiveness}${knockout}`;
}

async function opponentTurn() {
  if (state.phase !== "opponent-attack") return;
  if (!state.activePlayer || state.activePlayer.currentHp <= 0) {
    await requestNextPlayer();
    return;
  }
  if (!state.activeOpponent || state.activeOpponent.currentHp <= 0) {
    if (!await replaceFaintedOpponent()) return;
    state.phase = "player-turn";
    state.pixelScene = null;
    render();
    setMessage("El rival ha enviado a su siguiente Pokémon. Tu turno.");
    return;
  }

  if (!state.activeOpponent.moves.length) {
    try {
      state.activeOpponent.moves = await getBattleMoves(state.activeOpponent);
      state.activeOpponent.pp = state.activeOpponent.moves.map((move) => move.maxPp);
    } catch (error) {
      console.error("No se pudieron cargar los movimientos del rival:", error);
      state.phase = "opponent-error";
      render();
      setMessage(`No se pudieron cargar los movimientos del rival: ${error.message}. Pulsa para reintentar.`, "danger");
      return;
    }
  }

  const moveIndex = chooseComputerMove(state.activeOpponent, state.activePlayer);
  const move = state.activeOpponent.moves[moveIndex];
  state.activeOpponent.pp[moveIndex] -= 1;
  const result = calculateMove(state.activeOpponent, state.activePlayer, move);
  applyMoveResult(state.activeOpponent, state.activePlayer, move, result);
  state.pixelScene = {
    side: move.category === "status" ? "support" : "opponent",
    title: move.category === "status" ? "¡EL RIVAL SE CUIDA!" : "¡CONTRAATAQUE!",
    message: battleText(state.activeOpponent, state.activePlayer, move, result),
  };
  render();
  setMessage(state.pixelScene.message, "danger");
  await sleep(MOVE_TIME);

  if (state.activePlayer.currentHp <= 0) {
    const knockoutMessage = state.pixelScene.message;
    state.lastFaintedPlayer = state.activePlayer;
    state.activePlayer = null;
    if (state.playerTeam.every(({ currentHp }) => currentHp <= 0)) {
      finishBattle("loss");
      return;
    }

    state.phase = "choose-active";
    state.pixelScene = null;
    render();
    setMessage(`${knockoutMessage} Elige otro Pokémon para continuar.`, "danger");
    return;
  }

  state.phase = "player-turn";
  state.pixelScene = null;
  render();
  setMessage(`${formatPokemonName(state.activePlayer.name)} sigue en el campo. Elige su próximo movimiento.`);
}

function chooseComputerMove(fighter, target) {
  const available = fighter.moves
    .map((move, index) => ({ move, index, pp: fighter.pp[index] }))
    .filter(({ pp }) => pp > 0);

  if (!available.length) {
    const struggle = {
      name: "struggle",
      power: 45,
      accuracy: 100,
      type: "normal",
      category: "physical",
      maxPp: 1,
    };
    fighter.moves.push(struggle);
    fighter.pp.push(1);
    return fighter.moves.length - 1;
  }

  const heal = available.find(
    ({ move }) =>
      move.category === "status" && fighter.currentHp <= fighter.stats.hp * 0.45,
  );
  if (heal) return heal.index;

  return available.reduce((best, option) => {
    const optionScore = (option.move.power || 0) *
      getTypeMultiplier(option.move.type, target.types);
    const bestScore = (best.move.power || 0) *
      getTypeMultiplier(best.move.type, target.types);
    return optionScore > bestScore ? option : best;
  }).index;
}

async function replaceFaintedOpponent() {
  const nextFighter = state.opponentTeam.find(({ currentHp }) => currentHp > 0);
  if (!nextFighter) {
    finishBattle("win");
    return false;
  }

  state.activeOpponent = nextFighter;
  state.pixelScene = {
    side: "opponent",
    title: "¡A POR EL SIGUIENTE!",
    message: `${formatPokemonName(nextFighter.name)} entra en el campo.`,
  };
  render();
  setMessage(`${formatPokemonName(nextFighter.name)} toma el relevo en el equipo rival.`);
  try {
    nextFighter.moves = await getBattleMoves(nextFighter);
    nextFighter.pp = nextFighter.moves.map((move) => move.maxPp);
    return true;
  } catch (error) {
    console.error("No se pudieron cargar los movimientos del rival:", error);
    state.phase = "opponent-error";
    state.pixelScene = null;
    render();
    setMessage(`No se pudieron cargar los movimientos del rival: ${error.message}. Pulsa para reintentar.`, "danger");
    return false;
  }
}

async function retryOpponentTurn() {
  if (state.phase !== "opponent-error") return;
  state.phase = "opponent-attack";
  render();
  await opponentTurn();
}

async function requestNextPlayer() {
  if (state.playerTeam.every(({ currentHp }) => currentHp <= 0)) {
    finishBattle("loss");
    return;
  }
  state.phase = "choose-active";
  state.activePlayer = null;
  render();
  setMessage("Elige otro Pokémon de tu mazo para continuar.");
}

function finishBattle(outcome) {
  if (state.phase === "finished") return;
  state.matchOutcome = outcome;
  const rewardedProfile = awardBattle(state.profile, outcome);
  state.matchReward = rewardedProfile.coins - state.profile.coins;
  state.profile = rewardedProfile;
  state.phase = "finished";
  state.pixelScene = {
    side: outcome === "win" ? "player" : outcome === "loss" ? "opponent" : "",
  };
  saveProfile(state.profile);
  render();
}

function renderPackPulls() {
  elements.packPulls.innerHTML = state.revealedPack
    .map((pokemon, index) => {
      const count = state.profile.collection[pokemon.id];
      return `<div class="pack-pull-card" style="--pull-index:${index}">${cardMarkup(pokemon, {
        count,
      })}<span class="pull-stamp">${count === 1 ? "¡NUEVO!" : "¡COPIA AÑADIDA!"}</span></div>`;
    })
    .join("");
}

async function openPack() {
  if (!state.profile || state.profile.coins < BOOSTER_COST) return;
  elements.openPackButton.disabled = true;
  elements.openPackButton.innerHTML = '<span>Abriendo tu sobre...</span><span class="button-arrow">✦</span>';
  elements.packHint.textContent = "¡A ver qué Pokémon aparece!";
  elements.packResults.hidden = true;

  try {
    const pulledPokemon = await getRandomTeam(BOOSTER_SIZE);
    const nextProfile = openBooster(
      state.profile,
      pulledPokemon.map(({ id }) => id),
    );
    saveProfile(nextProfile);
    for (const pokemon of pulledPokemon) state.ownedPokemon.set(pokemon.id, pokemon);
    state.profile = nextProfile;
    state.draftDeck = [...nextProfile.deck];
    state.revealedPack = pulledPokemon;
    render();
    elements.packResults.hidden = false;
    renderPackPulls();
    elements.packHint.textContent = "¡Las cinco cartas ya están en tu colección!";
  } catch (error) {
    console.error("No se pudo abrir el sobre:", error);
    elements.packHint.textContent = `No se pudo abrir el sobre: ${error.message}. No se han cobrado las monedas.`;
    renderPackShop();
  }
}

async function saveDeck() {
  try {
    const nextProfile = buildDeck(state.profile, state.draftDeck);
    saveProfile(nextProfile);
    state.profile = nextProfile;
    state.playerTeam = nextProfile.deck.map(getOwnedFighter);
    if (state.phase === "finished") {
      state.phase = "idle";
      state.turn = 0;
      state.activePlayer = null;
      state.lastFaintedPlayer = null;
      state.activeOpponent = null;
      state.opponentTeam = [];
      state.pixelScene = null;
    }
    setDeckMessage("¡Mazo guardado! Tus Pokémon están listos para combatir.", "success");
    render();
  } catch (error) {
    setDeckMessage(error.message, "danger");
  }
}

function toggleDeckCard(id) {
  if (state.draftDeck.includes(id)) {
    state.draftDeck = state.draftDeck.filter((cardId) => cardId !== id);
  } else if (state.draftDeck.length < DECK_SIZE) {
    state.draftDeck = [...state.draftDeck, id];
  }

  renderDeckBuilder();
  setDeckMessage(
    state.draftDeck.length === DECK_SIZE
      ? "¡Mazo completo! Guarda los cambios para usarlo en combate."
      : `Has elegido ${state.draftDeck.length} de ${DECK_SIZE} Pokémon.`,
  );
}

function switchView(view) {
  if (
    view === "deck" &&
    !["loading", "idle", "finished"].includes(state.phase)
  ) {
    setMessage("Termina el combate para cambiar tu mazo; tu partida seguirá exactamente donde está.");
    return;
  }
  state.view = view;
  renderNavigation();
  if (view === "deck") renderDeckBuilder();
  if (view === "packs") {
    renderPackShop();
    if (state.revealedPack.length) {
      elements.packResults.hidden = false;
      renderPackPulls();
    }
  }
}

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

elements.playerHand.addEventListener("click", (event) => {
  const move = event.target.closest(".move-button");
  if (move && !move.disabled) {
    void playMove(move.dataset.fighterKey, Number(move.dataset.moveIndex));
    return;
  }

  const choice = event.target.closest(".choose-pokemon-button");
  if (choice && !choice.disabled) void choosePlayerPokemon(choice.dataset.fighterKey);
});

elements.startButton.addEventListener("click", () => {
  if (state.phase === "idle") void startBattle();
  else if (state.phase === "finished") void startBattle();
  else if (state.phase === "opponent-error") void retryOpponentTurn();
});

elements.openPackButton.addEventListener("click", () => void openPack());
elements.saveDeckButton.addEventListener("click", () => void saveDeck());

elements.collectionGrid.addEventListener("click", (event) => {
  const button = event.target.closest(".collect-button");
  if (button) toggleDeckCard(Number(button.dataset.collectionId));
});

elements.deckSlots.addEventListener("click", (event) => {
  const button = event.target.closest(".slot-remove");
  if (button) toggleDeckCard(Number(button.dataset.collectionId));
});

document.querySelector(".view-nav").addEventListener("click", (event) => {
  const tab = event.target.closest(".view-tab");
  if (tab) switchView(tab.dataset.view);
});

void initializeProfile();
