# Pokéduel

Juego de cartas Pokémon para navegador, construido con Vite y JavaScript ES modules. Los equipos, ilustraciones, tipos, estadísticas y sprites pixelados de combate se cargan desde [PokéAPI](https://pokeapi.co/api/v2/).

La interfaz combina colores luminosos, botones de aventura y cartas coleccionables de diseño propio. El combate pixelado se anima con los mismos Pokémon elegidos en las cartas; sus barras de energía avanzan junto al marcador de la partida.

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

- Cada entrenador recibe tres Pokémon aleatorios; el equipo rival permanece oculto.
- En cada ronda eliges un Pokémon y una estadística: ataque, defensa o velocidad.
- La ventaja de tipo modifica el valor comparado un 20 %.
- La pelea pixelada refleja cada enfrentamiento y el marcador reduce los PS del rival hasta el final.
- Gana el primero en alcanzar tres victorias, con un máximo de cinco rondas.

El cliente conserva en memoria las respuestas de Pokémon ya consultados para evitar solicitudes duplicadas durante la partida.
