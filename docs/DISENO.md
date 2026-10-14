# Diseño del MVP

## Objetivo

Que una parte pequeña de SANCTUMFALL sea completa: entender el juego, jugar
varios turnos con decisiones reales, descubrir una solución táctica y llegar a
una conclusión. Dos batallas en lugar de una: la primera enseña las reglas del
territorio, la segunda demuestra un jefe que es un problema distinto.

## Pilares y cómo se cumplen

**Información completa, sin azar oculto.** Todo ataque enemigo se anuncia con su
casilla, su dirección, su orden y su efecto exacto. El panel *The Reckoning*
lista la consecuencia de cada rito ("Sister Maelis -2", "strikes empty ground").
Al pasar el ratón sobre una acción propia, el tablero muestra el resultado y
**recalcula las intenciones enemigas tal como quedarían**. La aleatoriedad sólo
elige, con una ronda de antelación, dónde se extiende la Mácula y dónde surgen
demonios.

**El posicionamiento pesa más que el daño.** El daño es bajo (1–3) y la vida
escasa (3–4). Las herramientas más fuertes son el desplazamiento (empujar,
arrastrar, cargar), el control del terreno (consagrar) y la manipulación de
amenazas (girar o silenciar ritos).

**El territorio es un sistema.** La Mácula es el reloj de la batalla (límite de
casillas), potencia a los demonios (+1), daña a la Vigilia y es el único lugar
donde nacen enemigos. El suelo consagrado es terreno prohibido para los demonios
y un arma (quemadura al ser empujados).

## La escuadra

| Unidad | Papel | Habilidades |
|---|---|---|
| **Hermano Caius**, el Penitente (4 PV) | Romper formaciones | *Censer Flail*: 2 de daño y empuja 1. *Zealous Charge* (cada 2 rondas): carga en línea, 1 de daño y empuja. |
| **Hermana Maelis**, la Consagradora (3 PV) | Purificar y proteger | *Hallow* (alcance 3): limpia y consagra; 1 a demonios, 2 a heridas. *Sanctuary* (cada 2 rondas): escudo que absorbe un golpe. |
| **Inquisidor Voss**, el Interdictor (3 PV) | Interrumpir y manipular | *Chain of Judgment*: proyectil, 1 de daño y arrastra 1 hacia él. *Rebuke* (cada 2 rondas, alcance 3): invierte un ataque direccional o silencia un rito. |

Combinaciones previstas: arrastrar con la cadena a un demonio sobre suelo
consagrado; consagrar casillas para cerrar el paso a los demonios; empujar a un
demonio a la línea de carga de un Sabueso; invertir la Marea del Leviatán para que
expulse en lugar de arrastrar; proteger el santuario con un escudo en vez de atacar.

## Demonios

| Demonio | Función | Problema que plantea |
|---|---|---|
| Hueco | Cuerpo a cuerpo básico | Presión constante; amenaza estructuras. |
| Sabueso Desollado | Carga en línea, 2 + empuje | Golpea lo primero que encuentra: interponer a otro demonio lo vuelve contra los suyos. |
| Cantor de Bilis | Artillería 2–3 por encima de obstáculos | Siembra Mácula y desordena la formación empujando hacia fuera. |
| Cantor Hereje | Rito de área sin dirección | Corrompe en cruz; no se puede girar, sólo silenciar o matar. |
| Siervo Ahogado | Empuja a su víctima | Junto a pozos y al agua, empujar es matar. |

La IA estándar prueba cada destino y cada uso de habilidad sobre un clon, puntúa
los eventos resultantes (daño a la Vigilia, estructuras, Mácula; penaliza el
fuego amigo) y declara el mejor. Es determinista. Nunca telegrafía un ataque
inútil.

## Purificación

- **Heridas** (3 PV): cada ronda anuncian una casilla de propagación y un punto
  de aparición. Al sellarse limpian su entorno y consagran su sitio; sus anuncios
  pendientes desaparecen.
- **Santuario**: mantiene consagrado su entorno. Si cae, ese suelo pierde la
  gracia y su sitio se corrompe (objetivo extra: protegerlo).
- **Límite de Mácula**: derrota si la corrupción alcanza el límite al final de
  una ronda. Convierte la purificación en una necesidad y no en un adorno.

## El Leviatán

Problema táctico: **un enemigo invulnerable que controla el espacio.**

- Ocupa 2×2 en el agua; no se mueve por empujes.
- Su letanía de tres ritos está siempre visible (rito actual + dos siguientes):
  1. **Tidal Surge**: las dos filas que mira se desplazan 1 casilla hacia el
     abismo; lo que caiga a un pozo se ahoga (aliados o demonios). *Rebuke*
     invierte la marea.
  2. **Abyssal Maw**: 3 de daño en las 2×2 casillas frente a él.
  3. **The Deep Stirs**: se hunde y reaparece en las filas donde más Vigilia
     hay; la orilla estalla (2 de daño y empuje). No se puede invertir.
- **Dos campanas ahogadas** (heridas especiales, 5 PV) lo protegen: mientras
  suene una, es inmune. Silenciar una campana le inflige 2.

El jugador debe repartir esfuerzos entre las campanas, los siervos y la Mácula,
leer la letanía para saber cuándo acercarse a la orilla y usar la marea contra
los demonios (objetivo extra: ahogar a dos).

## Condiciones

Victoria: objetivos principales cumplidos (sellar heridas / desterrar al jefe).
Derrota: Vigilia aniquilada, Mácula en el límite, o un objetivo principal de
protección perdido. Los objetivos extra se muestran en el resultado.

## Validación de equilibrio

`npm run sim` lanza un bot voraz con información completa (prueba todos los
órdenes de unidad y todas las acciones contra la previsualización del Juicio).
Resultados actuales: la Parroquia se gana en 4 rondas sin bajas; la Nave en 6
rondas, terminando con el Penitente a 1 PV. Un jugador humano tardará más; el
bot marca el suelo de dificultad, no el techo.

## Dirección artística

- Pixel art nítido a escala entera (sin suavizado). Sprites hechos a mano como
  mapas de caracteres, con contorno automático; el Leviatán pintado con
  primitivas de píxel.
- Paleta restringida: negros cálidos, marrones, piedra, hueso, oro envejecido y
  rojo oscuro; violeta para la Mácula, verde azulado para lo ahogado.
- Iluminación con tramado ordenado (Bayer) y fuentes de luz por unidad. El
  tablero nunca se oscurece más del ~35% y las telegrafías se dibujan **encima**
  de la luz: la atmósfera no oculta información.
- Cada estado se distingue también por **patrón**, no sólo por color:
  movimiento (damero azul), objetivo (punteado oro), amenaza (rayado rojo),
  Mácula (rayado violeta + icono), consagración (sello).
- Sonido 100% sintetizado: drones por región, campanas con parciales
  inarmónicos, coros de quintas, ruido filtrado para impactos y mareas.
