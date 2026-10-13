# Pokéduel

Juego de cartas Pokémon para navegador, construido con Vite y JavaScript ES modules. Los equipos, ilustraciones, tipos y estadísticas se cargan en directo desde [PokéAPI](https://pokeapi.co/api/v2/).

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
- Gana el primero en alcanzar tres victorias, con un máximo de cinco rondas.

El cliente conserva en memoria las respuestas de Pokémon ya consultados para evitar solicitudes duplicadas durante la partida.
