# Arquitectura

TypeScript + Vite, sin motor de juego ni dependencias de ejecución salvo tres
fuentes pixel (`@fontsource/*`). Canvas 2D para el tablero, DOM para la interfaz,
WebAudio para el sonido.

```
src/
  core/       reglas puras y deterministas (sin DOM). Todo el juego vive aquí.
  content/    datos: unidades, habilidades, jefes y encuentros. Registran en core.
  render/     arte procedural, renderer del tablero, animador de eventos.
  ui/         pantallas (título, mapa, briefing, batalla, resultado) y HUD.
  audio/      síntesis de efectos y ambiente.
tests/        pruebas de reglas (vitest).
scripts/      herramientas: bot de balance, ASCII, capturas con Playwright.
```

## Principios

1. **El estado es datos planos.** `GameState` es JSON clonable. Eso permite
   deshacer, reiniciar turno, previsualizar y que la IA simule sin efectos
   secundarios.
2. **Las reglas emiten eventos.** Cada acción muta el estado y devuelve una lista
   de `GameEvent` (`push`, `damage`, `death`, `tile`, `spawn`...). La presentación
   los reproduce como animaciones y, al terminar, **se sincroniza con el estado
   real**: la imagen no puede desviarse de las reglas.
3. **Las previsualizaciones usan el mismo motor.** `forecastUse`,
   `forecastIntent` y `forecastReckoning` ejecutan las reglas reales sobre un
   clon. La interfaz nunca reimplementa reglas para dibujar una predicción. Una
   prueba de fuzzing comprueba que la previsualización coincide siempre con el
   resultado.
4. **El contenido es datos registrados por id.** El motor busca habilidades,
   unidades y encuentros en `core/registry.ts`. Añadir contenido no toca el motor.
5. **Sin azar oculto.** El PRNG vive dentro del estado y sólo desempata eventos
   que se anuncian una ronda antes (casillas de propagación, puntos de aparición).

## Flujo de una ronda (`core/turn.ts`)

```
beginRound:  emergen apariciones → los demonios planifican (moverse + intención)
             → las heridas anuncian propagación y apariciones → fase del jugador
endTurn:     resolveReckoning (Mácula daña → intenciones en orden → propagación)
             → comprobar resultado → beginRound
```

`BattleSession` (`core/session.ts`) envuelve esto con deshacer movimiento y un
reinicio de turno por batalla.

## Habilidades: un intérprete para todos

Jugador, demonios y jefes usan el mismo `AbilityDef`:

```ts
{
  id: 'censer_flail',
  targeting: { kind: 'melee' },              // melee | projectile | charge | artillery | tile | self
  effects: [{ op: 'damage', amount: 2 }, { op: 'push', dir: 'forward' }],
  cooldown: 2,                                // opcional
  animation: 'melee', icon: 'flail',
}
```

Efectos disponibles: `damage` (con filtro `only` por etiqueta), `push`
(`forward`/`back`/`outward`), `corrupt`, `cleanse`, `consecrate`, `shield`,
`heal`, `rebuke`; cada uno con área `target`/`plus`/`adjacent`.

Una intención enemiga es un `AbilityUse` guardado **en coordenadas relativas**
(`dir`, `dist`, `offset`). Por eso un demonio empujado se lleva su ataque: es la
regla central de "interrumpir desplazando".

Mecánicas que no encajan en el intérprete se registran como **specials**
(`registerSpecial(id, { resolve, footprint, choose })`) reutilizando primitivas
(`pushEntity`, `dealDamage`). El Leviatán está hecho así.

## Cómo añadir contenido

**Una unidad nueva** — `content/units.ts`:

```ts
{ id: 'flagellant', name: '…', title: '…', faction: 'vigil', hp: 3, move: 4,
  tags: ['human'], abilities: ['censer_flail', 'mi_habilidad'], blurb: '…', sprite: 'flagellant' }
```

Añade su mapa de píxeles en `render/sprites-data.ts` (o reutiliza un sprite
existente mientras tanto). Para que aparezca en la escuadra, usa un carácter en la
leyenda del encuentro.

**Un enemigo con otro comportamiento** — define su unidad con
`faction: 'demon'`. El comportamiento `standard` (búsqueda de movimiento +
ataque puntuando eventos simulados, pesos en `AI_WEIGHTS`) funciona con
cualquier habilidad. Para algo distinto, `registerBehavior('mi_ia', fn)`.

**Una habilidad o efecto nuevo** — añade un `AbilityDef` en
`content/abilities.ts`. Si necesita un efecto nuevo, añade un caso a `Effect` en
`core/types.ts` y a `applyEffect` en `core/abilities.ts`; queda disponible para
todas las unidades.

**Un encuentro** — un archivo en `content/encounters/` con un mapa ASCII:

```ts
registerEncounter({
  id: 'mi_encuentro', name: '…', region: 'ash', seed: 1,
  map: ['..,W,...', …],            // leyenda en encounters/legend.ts
  legend: BASE_LEGEND, taintLimit: 24, spawnPool: ['hollow'], maxEnemies: 4,
  spawnFromRound: 1, spreadPerWound: 1,
  objectives: [{ kind: 'sealWounds', label: '…' }], briefing: ['…'],
});
```

e impórtalo en `content/index.ts` (y en `CAMPAIGN` si es parte de la campaña).

**Un jefe** — unidad con `behavior: 'litany'` y `litany: [...]` (ciclo de ritos
visible para el jugador) más sus `specials`. Ver
`content/bosses/leviathan.ts`.

**Un objetivo** — añade el tipo a `ObjectiveKind` y su evaluación a
`objectiveStatus` (`core/objectives.ts`).

**Ganchos de muerte** — `registerDeathHook('id', fn)` y `onDeath: 'id'` en la
unidad (heridas que se sellan, santuarios que se profanan, campanas que hieren al
jefe).

**Arte** — los sprites son mapas de caracteres (`render/sprites-data.ts`) con la
paleta de `render/palette.ts`; el contorno, los fotogramas de respiración, el
destello de impacto y el fantasma tramado se generan solos. Las baldosas son
procedurales (`render/tiles.ts`) por región (`REGIONS` en la paleta). Para usar
arte final basta con que `sprite(id)` devuelva otro canvas/imagen: la lógica no
cambia.

## Equilibrio

Los números viven en datos: daño y alcances en `content/abilities.ts`, vida y
movimiento en `content/units.ts`, límites de Mácula y oleadas en cada encuentro,
reglas globales (choques, quemadura, Mácula) en `core/rules.ts`, pesos de la IA
en `AI_WEIGHTS` (`core/ai.ts`). `npm run sim` permite medir cambios.

## Pruebas

`tests/` cubre movimiento y ocupación, alcances, previsualización de
intenciones, resolución e interrupciones, empujones y colisiones, efectos de
terreno, propagación y apariciones, victoria y derrota, deshacer/reinicio/
reinicio de batalla, el jefe completo y una prueba de fuzzing con partidas
aleatorias que verifica invariantes y que cada previsualización coincide con su
resultado.
