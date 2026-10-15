# Pokéduel

Juego de cartas y combates por turnos de Pokémon para navegador, construido con Vite y JavaScript ES modules. Pokémon, ilustraciones, tipos, estadísticas, movimientos y sprites de combate se cargan desde [PokéAPI](https://pokeapi.co/api/v2/).

La interfaz combina colores luminosos, botones de aventura y cartas coleccionables de diseño propio. El combate pixelado se anima con los mismos Pokémon que el jugador escoge en su mazo; la energía refleja los PS de la batalla.

Cada perfil se guarda localmente en el navegador. El entrenador empieza con seis Pokémon y 100 monedas, puede construir un mazo de seis criaturas de su colección, abrir sobres de cinco Pokémon por 50 monedas y ganar monedas tras combatir.

## Ejecutar en local

```bash
npm install
npm run dev
```

Para generar y previsualizar la versión de producción:

```bash
npm run build
npm run preview
```

## Cómo se juega

- Elige manualmente un Pokémon activo de tu mazo de seis antes de empezar.
- Decide cada turno qué movimiento usar; el rival responde y los movimientos gastan PP.
- Cambiar de Pokémon durante un turno deja que el rival ataque.
- Los movimientos de apoyo recuperan PS; los ataques tienen potencia, precisión, STAB y efectividad de tipo.
- Los seis Pokémon tienen PS persistentes durante todo el combate. Gana al debilitar el equipo rival.
- La victoria da 50 monedas, el empate 35 y la derrota 25. Cada sobre cuesta 50 monedas e incluye cinco Pokémon sorpresa.
- La colección, el mazo y las monedas persisten en `localStorage`; no se necesita una cuenta ni un servidor.

El cliente conserva en memoria las respuestas de Pokémon ya consultados para evitar solicitudes duplicadas durante la partida.
