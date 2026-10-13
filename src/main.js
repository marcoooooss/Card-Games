import "./style.css";
import "./retro.css";
import { formatPokemonName, getRandomTeam } from "./services/pokeapi.js";
import { getWinner, STAT_OPTIONS } from "./game.js";

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
};

const state = {
  phase: "loading",
  round: 0,
  playerScore: 0,
  opponentScore: 0,
  playerTeam: [],
  opponentTeam: [],
  playedPlayerIds: new Set(),
  playedOpponentIds: new Set(),
  roundResults: [],
  pixelScene: null,
};

function setMessage(message, tone = "") {
  elements.battleMessage.className = `battle-message${tone ? ` ${tone}` : ""}`;
  elements.battleMessage.innerHTML = `<span class="message-icon">✳</span><span>${message}</span>`;
}

function renderHand(team, playedIds, isPlayer) {
  const container = isPlayer ? elements.playerHand : elements.opponentHand;

  container.innerHTML = team
    .map((pokemon) => {
      const played = playedIds.has(pokemon.id);
      if (!isPlayer && !played) {
        return `
          <div class="opponent-card-back" aria-label="Carta rival oculta">
            <span class="card-back-symbol">✳</span>
            <span class="card-back-label">POKÉDUEL</span>
          </div>`;
      }

      const stats = [
        { key: "attack", label: "ATK" },
        { key: "defense", label: "DEF" },
        { key: "speed", label: "VEL" },
      ];

      return `
        <article class="pokemon-card ${isPlayer ? "player-card" : "rival-card"} ${played ? "is-played" : ""} ${pokemon.id === (isPlayer ? state.lastPlayerId : state.lastOpponentId) && ["battling", "resolved", "finished"].includes(state.phase) ? "is-selected" : ""}" style="--type-color: ${getTypeColor(pokemon.types[0])}">
          <div class="card-top">
            <span class="card-id">N.º ${String(pokemon.id).padStart(3, "0")}</span>
            <span class="type-badge">${pokemon.types[0]}</span>
          </div>
          <div class="pokemon-art-wrap">
            <span class="art-glow"></span>
            <img class="pokemon-art" src="${pokemon.image}" alt="${formatPokemonName(pokemon.name)}" loading="lazy" />
          </div>
          <div class="card-name">${formatPokemonName(pokemon.name)}<span class="card-hp">HP ${pokemon.stats.hp}</span></div>
          <div class="type-list">${pokemon.types.map((type) => `<span>${type}</span>`).join("")}</div>
          <div class="card-stats">
            ${stats
              .map(
                ({ key, label }) => `
                  <button class="stat-pick" type="button" data-pokemon-id="${pokemon.id}" data-stat="${key}" ${!isPlayer || state.phase !== "ready" || played ? "disabled" : ""} aria-label="Elegir ${label} para ${formatPokemonName(pokemon.name)}">
                    <span>${label}</span><strong>${pokemon.stats[key]}</strong>
                  </button>`,
              )
              .join("")}
          </div>
          ${
            played
              ? `<span class="played-label">${pokemon.id === (isPlayer ? state.lastPlayerId : state.lastOpponentId) ? "EN COMBATE" : "USADA"}</span>`
              : ""
          }
        </article>`;
    })
    .join("");
}

function getTypeColor(type) {
  const colors = {
    bug: "#9bc541", dark: "#75667c", dragon: "#8864da", electric: "#f5c83c",
    fairy: "#e998bb", fighting: "#e16653", fire: "#f47d42", flying: "#83a8e6",
    ghost: "#8879c9", grass: "#61b968", ground: "#d2a34c", ice: "#70cbd4",
    normal: "#aaa495", poison: "#ad6cc3", psychic: "#e67398", rock: "#bd9e53",
    steel: "#86aeb9", water: "#579be7",
  };
  return colors[type] ?? "#c6f36a";
}

function render() {
  elements.playerScore.textContent = state.playerScore;
  elements.opponentScore.textContent = state.opponentScore;
  elements.roundCount.textContent = state.round ? `${String(state.round).padStart(2, "0")} / 05` : "— / 05";
  elements.roundDots.innerHTML = Array.from({ length: 5 }, (_, index) => {
    const result = state.roundResults[index];
    const outcome = result === "player" ? "won" : result === "opponent" ? "lost" : result === "draw" ? "draw" : "";
    return `<span class="round-dot ${index + 1 === state.round && state.phase !== "finished" ? "active" : ""} ${outcome}" aria-label="Ronda ${index + 1}"></span>`;
  }).join("");

  renderHand(state.playerTeam, state.playedPlayerIds, true);
  renderHand(state.opponentTeam, state.playedOpponentIds, false);
  renderPixelBattle();

  if (state.phase === "ready") {
    elements.arenaStatus.textContent = "ELIGE TU JUGADA";
    elements.startButton.innerHTML = `<span>Elige una estadística</span><span class="button-arrow">↗</span>`;
    elements.startButton.disabled = true;
  } else if (state.phase === "battling") {
    elements.arenaStatus.textContent = "¡COMBATE EN CURSO!";
    elements.startButton.innerHTML = `<span>Resolviendo combate...</span><span class="button-arrow">✦</span>`;
    elements.startButton.disabled = true;
  } else if (state.phase === "resolved") {
    elements.arenaStatus.textContent = "RONDA RESUELTA";
    elements.startButton.innerHTML = `<span>Siguiente ronda</span><span class="button-arrow">↗</span>`;
    elements.startButton.disabled = false;
  } else if (state.phase === "finished") {
    elements.arenaStatus.textContent = "COMBATE FINALIZADO";
    const playerWon = state.playerScore > state.opponentScore;
    elements.startButton.innerHTML = `<span>${playerWon ? "Jugar otra vez" : "Revancha"}</span><span class="button-arrow">↗</span>`;
    elements.startButton.disabled = false;
  }
}

function renderPixelBattle() {
  const { pixelScene } = state;
  const battleOutcome =
    state.phase === "finished"
      ? state.playerScore === state.opponentScore
        ? "draw"
        : state.playerScore > state.opponentScore
          ? "player"
          : "opponent"
      : pixelScene?.winner ?? "";
  const playerHp = Math.max(0, 100 - (state.playerScore / 3) * 100);
  const rivalHp = Math.max(0, 100 - (state.opponentScore / 3) * 100);
  const playerHpRounded = Math.round(playerHp);
  const rivalHpRounded = Math.round(rivalHp);

  elements.pixelStage.dataset.mode = state.phase;
  elements.pixelStage.dataset.outcome = battleOutcome;
  elements.pixelRound.textContent = state.round ? String(state.round).padStart(2, "0") : "—";
  elements.pixelPlayerHp.style.width = `${playerHp}%`;
  elements.pixelRivalHp.style.width = `${rivalHp}%`;
  elements.pixelPlayerHpText.textContent = `${playerHpRounded} / 100`;
  elements.pixelRivalHpText.textContent = `${rivalHpRounded} / 100`;
  elements.pixelPlayerHp.parentElement.setAttribute("aria-valuenow", String(playerHpRounded));
  elements.pixelRivalHp.parentElement.setAttribute("aria-valuenow", String(rivalHpRounded));
  elements.pixelPlayerHp.dataset.level = playerHpRounded <= 33 ? "low" : "healthy";
  elements.pixelRivalHp.dataset.level = rivalHpRounded <= 33 ? "low" : "healthy";

  if (pixelScene) {
    const { player, opponent, stat } = pixelScene;
    const statLabel = STAT_OPTIONS.find((option) => option.key === stat).label;
    elements.pixelPlayerName.textContent = formatPokemonName(player.name);
    elements.pixelRivalName.textContent = formatPokemonName(opponent.name);
    elements.pixelPlayerSprite.src = player.pixelSprites.back;
    elements.pixelPlayerSprite.alt = formatPokemonName(player.name);
    elements.pixelRivalSprite.src = opponent.pixelSprites.front;
    elements.pixelRivalSprite.alt = formatPokemonName(opponent.name);
    elements.pixelBattleLog.textContent =
      state.phase === "battling"
        ? `${formatPokemonName(player.name)} usa ${statLabel}... ¡a por todas!`
        : `${formatPokemonName(player.name)} y ${formatPokemonName(opponent.name)} se enfrentan en ${statLabel.toLowerCase()}.`;
  } else {
    elements.pixelPlayerName.textContent = "TU POKÉMON";
    elements.pixelRivalName.textContent = "RIVAL";
    elements.pixelPlayerSprite.removeAttribute("src");
    elements.pixelPlayerSprite.alt = "";
    elements.pixelRivalSprite.removeAttribute("src");
    elements.pixelRivalSprite.alt = "";
    elements.pixelBattleLog.textContent =
      state.phase === "ready"
        ? "Elige una carta para descubrir quién sale a combatir."
        : "Cada carta elegida se convierte en un turno de combate.";
  }

  const callouts = {
    idle: ["¡EQUIPO LISTO!", "el combate empieza cuando tú quieras"],
    loading: ["¡A PREPARAR!", "cargando tu equipo Pokémon"],
    ready: ["¡ELIGE TU POKÉMON!", "tu primera jugada te espera"],
    battling: ["¡A COMBATIR!", "las cartas cobran vida"],
    resolved: ["¡BUEN COMBATE!", "el marcador y los PS avanzan juntos"],
    finished: [
      state.playerScore === state.opponentScore
        ? "¡EMPATE!"
        : state.playerScore > state.opponentScore
          ? "¡VICTORIA!"
          : "¡FIN DEL COMBATE!",
      `resultado ${state.playerScore} — ${state.opponentScore}`,
    ],
  };
  const [title, subtitle] = callouts[state.phase];
  elements.pixelCallout.innerHTML = `<span>${title}</span><small>${subtitle}</small>`;
}

function finishBattle() {
  state.phase = "finished";
  render();
  setMessage(
    state.playerScore === state.opponentScore
      ? `¡Combate igualado! Marcador final ${state.playerScore}–${state.opponentScore}.`
      : state.playerScore > state.opponentScore
        ? `¡Victoria de entrenador! Cierras la arena ${state.playerScore}–${state.opponentScore}.`
        : `El rival se lleva esta. Marcador final ${state.playerScore}–${state.opponentScore}. ¡Pide la revancha!`,
    state.playerScore >= state.opponentScore ? "success" : "danger",
  );
}

async function loadFirstHand() {
  try {
    state.playerTeam = await getRandomTeam(3);
    state.phase = "idle";
    render();
    elements.startButton.disabled = false;
    elements.startButton.innerHTML = `<span>Entrar en la arena</span><span class="button-arrow">↗</span>`;
    setMessage("Tu equipo está listo. ¿Preparado para el combate?");
  } catch (error) {
    console.error("No se pudo cargar el equipo Pokémon:", error);
    elements.arenaStatus.textContent = "ERROR DE CONEXIÓN";
    elements.startButton.disabled = false;
    elements.startButton.innerHTML = `<span>Volver a intentar</span><span class="button-arrow">↻</span>`;
    setMessage("No se pudo conectar con PokéAPI. Comprueba tu conexión y vuelve a intentarlo.", "danger");
  }
}

async function startBattle() {
  elements.startButton.disabled = true;
  elements.startButton.innerHTML = `<span>Preparando rival...</span><span class="button-arrow"><span class="button-loader"></span></span>`;
  elements.arenaStatus.textContent = "CARGANDO RIVAL";
  setMessage("Un rival está entrando en la arena...");

  try {
    state.opponentTeam = await getRandomTeam(3, state.playerTeam.map(({ id }) => id));
    state.phase = "ready";
    state.round = 1;
    state.playerScore = 0;
    state.opponentScore = 0;
    state.playedPlayerIds = new Set();
    state.playedOpponentIds = new Set();
    state.roundResults = [];
    state.pixelScene = null;
    setMessage("Elige una carta y la estadística con la que quieres atacar.");
    render();
  } catch (error) {
    console.error("No se pudo cargar el rival:", error);
    elements.startButton.disabled = false;
    elements.startButton.innerHTML = `<span>Reintentar</span><span class="button-arrow">↻</span>`;
    elements.arenaStatus.textContent = "ERROR DE CONEXIÓN";
    setMessage("No se pudo cargar el rival desde PokéAPI. Inténtalo de nuevo.", "danger");
  }
}

async function playTurn(pokemonId, stat) {
  if (state.phase !== "ready") return;

  const player = state.playerTeam.find(({ id }) => id === pokemonId);
  const remainingOpponents = state.opponentTeam.filter(({ id }) => !state.playedOpponentIds.has(id));
  const opponent = remainingOpponents[Math.floor(Math.random() * remainingOpponents.length)];
  const result = getWinner(player, opponent, stat);

  state.pixelScene = { player, opponent, stat, winner: result.winner };
  state.lastPlayerId = player.id;
  state.lastOpponentId = opponent.id;
  state.playedPlayerIds.add(player.id);
  state.playedOpponentIds.add(opponent.id);
  if (result.winner === "player") state.playerScore += 1;
  if (result.winner === "opponent") state.opponentScore += 1;
  state.roundResults.push(result.winner);

  state.phase = "battling";
  render();
  setMessage(`${formatPokemonName(player.name)} entra en combate. ¡${STAT_OPTIONS.find((option) => option.key === stat).label.toLowerCase()}!`);
  await new Promise((resolve) => setTimeout(resolve, 1500));
  state.phase = "resolved";
  if (state.round >= 5 || state.playerScore >= 3 || state.opponentScore >= 3) {
    finishBattle();
    return;
  }

  render();
  const winner = result.winner;
  const label = STAT_OPTIONS.find((option) => option.key === stat).label.toLowerCase();
  const playerValue = Math.round(result.playerPower.value);
  const opponentValue = Math.round(result.opponentPower.value);
  if (winner === "draw") {
    setMessage(`¡Empate! ${formatPokemonName(player.name)} y ${formatPokemonName(opponent.name)} igualan en ${label} (${playerValue}).`);
  } else {
    const winnerName = winner === "player" ? formatPokemonName(player.name) : formatPokemonName(opponent.name);
    const advantage = result[`${winner}Power`]?.multiplier === 1.2 ? " · ventaja de tipo" : "";
    setMessage(`${winnerName} gana ${winner === "player" ? playerValue : opponentValue}–${winner === "player" ? opponentValue : playerValue} en ${label}${advantage}.`, winner === "player" ? "success" : "danger");
  }
}

async function nextRound() {
  if (state.phase === "finished") {
    state.phase = "idle";
    state.round = 0;
    state.playerScore = 0;
    state.opponentScore = 0;
    state.playerTeam = [];
    state.opponentTeam = [];
    state.playedPlayerIds.clear();
    state.playedOpponentIds.clear();
    state.roundResults = [];
    state.pixelScene = null;
    state.lastPlayerId = undefined;
    state.lastOpponentId = undefined;
    elements.startButton.disabled = true;
    elements.arenaStatus.textContent = "PREPARANDO ARENA";
    elements.startButton.innerHTML = `<span>Cargando Pokémon...</span><span class="button-arrow"><span class="button-loader"></span></span>`;
    await loadFirstHand();
    render();
    return;
  }

  if (state.round >= 5 || state.playerScore >= 3 || state.opponentScore >= 3) {
    finishBattle();
    return;
  }

  elements.startButton.disabled = true;
  elements.startButton.innerHTML = `<span>Repartiendo cartas...</span><span class="button-arrow"><span class="button-loader"></span></span>`;
  setMessage("Preparando la siguiente ronda...");

  try {
    const excluded = [
      ...state.playerTeam.map(({ id }) => id),
      ...state.opponentTeam.map(({ id }) => id),
    ];
    const playerTeam = await getRandomTeam(3, excluded);
    const opponentTeam = await getRandomTeam(3, [
      ...excluded,
      ...playerTeam.map(({ id }) => id),
    ]);

    state.playerTeam = playerTeam;
    state.opponentTeam = opponentTeam;
    state.playedPlayerIds = new Set();
    state.playedOpponentIds = new Set();
    state.lastPlayerId = undefined;
    state.lastOpponentId = undefined;
    state.pixelScene = null;
    state.round += 1;
    state.phase = "ready";
    setMessage("Nuevas cartas, nueva oportunidad. Elige tu jugada.");
    render();
  } catch (error) {
    console.error("No se pudieron repartir las cartas:", error);
    elements.startButton.disabled = false;
    elements.startButton.innerHTML = `<span>Reintentar ronda</span><span class="button-arrow">↻</span>`;
    setMessage("No se pudieron repartir nuevas cartas. Vuelve a intentarlo.", "danger");
  }
}

elements.playerHand.addEventListener("click", (event) => {
  const button = event.target.closest(".stat-pick");
  if (button && !button.disabled) playTurn(Number(button.dataset.pokemonId), button.dataset.stat);
});

elements.startButton.addEventListener("click", () => {
  if (state.phase === "idle") startBattle();
  else if (state.phase === "resolved" || state.phase === "finished") nextRound();
  else if (state.phase === "loading") loadFirstHand();
});

loadFirstHand();
