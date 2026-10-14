# Próximas expansiones (priorizadas)

Ordenadas por impacto en la experiencia y por lo bien que las soportan los
sistemas actuales.

## 1. Campaña con persistencia de la escuadra
**Qué:** cadena de 4–6 encuentros por región, con vida, heridas y bajas que
persisten entre batallas, y una recompensa entre combates.
**Ya existe:** `CAMPAIGN`, progreso en `localStorage`, encuentros como datos,
pantalla de mapa y resultado.
**Falta:** un `CampaignState` (escuadra persistente, día/región), aplicar ese
estado al construir la batalla (`buildState` acepta una escuadra) y una
pantalla de recompensa.

## 2. Reliquias y mejoras
**Qué:** reliquias que modifican reglas ("la consagración también cura 1", "las
cargas empujan 2 casillas") y mejoras por unidad.
**Ya existe:** efectos composables, filtros por etiqueta, ganchos de muerte,
`RULES` centralizado.
**Falta:** una capa de modificadores (lista de reliquias activas consultada en
`applyEffect`, `dealDamage` y `arriveOnTile`) y una UI de equipo. Es la
extensión más barata en código y la que más rejugabilidad aporta.

## 3. Jörmungandr — segundo jefe
**Qué:** una serpiente que **rodea el tablero y lo estrecha**: cada ronda su
anillo ocupa casillas del borde; partes de su cuerpo son atacables y moverse
entre sus anillos es la clave.
**Ya existe:** entidades multicasilla, `litany`, `registerSpecial`, telegrafía de
huellas arbitrarias, objetivos de jefe.
**Falta:** entidades con **cuerpo segmentado** (varias huellas enlazadas) y
terreno temporal (casillas que el jefe ocupa/libera).

## 4. Más tipos de objetivo y terreno
**Qué:** escoltar a un peregrino, proteger varias reliquias, sobrevivir N rondas,
casillas de fuego, niebla que bloquea líneas de visión, puentes que se rompen.
**Ya existe:** `ObjectiveKind` extensible, terreno por casilla, `arriveOnTile`.
**Falta:** definiciones de terreno como datos (hoy `floor/abyss/wall` son tipos
fijos) con hooks de entrada/fin de ronda.

## 5. Despliegue y selección de escuadra
**Qué:** elegir dónde empieza cada unidad y qué tres miembros de la Vigilia
llevar (con nuevos personajes desbloqueables).
**Ya existe:** casillas de inicio en la leyenda del mapa; unidades como datos.
**Falta:** fase de despliegue antes de la primera planificación enemiga.

## 6. El Demiurgo
**Qué:** un jefe que **reescribe reglas** a mitad de combate (invierte la
gravedad de los empujes, intercambia consagrado y corrupto, cambia el orden de
resolución).
**Ya existe:** reglas globales en `RULES`, orden de intenciones explícito.
**Falta:** reglas mutables por estado (mover `RULES` a `GameState.rules`) y
telegrafía de cambios de regla.

## Mejoras técnicas que habilitan lo anterior

- **Escuadra y reglas dentro del estado** (`GameState.rules`, `GameState.squad`):
  necesario para reliquias, campaña y el Demiurgo.
- **Arte final sustituible:** `sprite(id)` ya es el único punto de acceso; añadir
  un cargador de spritesheets (PNG + JSON de fotogramas) junto a los mapas
  actuales.
- **Localización:** los textos están en los datos de contenido y en la UI; mover
  las cadenas a tablas `en`/`es`.
- **Guardado de partida a mitad de batalla:** el estado ya es JSON; sólo falta
  serializarlo.
- **Adaptación táctil:** la entrada usa clic y hover; añadir "tocar para
  previsualizar, tocar de nuevo para confirmar" y un diseño de una columna.
- **IA con más carácter:** pesos por tipo de demonio (los Cantores prefieren
  distancia, los Sabuesos objetivos aislados) en lugar de los pesos globales.
