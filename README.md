# SANCTUMFALL

Estrategia táctica por turnos de fantasía oscura para navegador. Tres miembros de
la **Novena Vigilia** recuperan tierras reclamadas por entidades antiguas:
purifican el terreno, sellan heridas en el mundo y desafían a seres como el
**Leviatán**.

Este repositorio contiene el MVP jugable: dos batallas completas (la segunda, un
jefe), una campaña mínima, arte pixel y sonido generados por código, y un motor
de reglas determinista con pruebas.

## Ejecutar

Requisitos: Node 20+ (probado con Node 22).

```bash
npm install
npm run dev        # servidor de desarrollo → http://localhost:5173
npm test           # 62 pruebas de reglas (vitest)
npm run build      # typecheck + build estático en dist/ (se sirve desde cualquier carpeta)
npm run preview    # sirve el build
```

Herramientas de desarrollo:

```bash
npm run sim -- drowned_nave    # un bot voraz juega un encuentro con las reglas reales (balance)
npm run ascii -- ashen_parish 6  # muestra el tablero en ASCII y avanza N rondas pasivas
node scripts/smoke.mjs <dir>     # capturas de título, mapa, briefing y batalla (requiere `npm run dev`)
node scripts/play.mjs <dir> [encuentro] [pasos.mjs]   # conduce un turno real por la interfaz
```

`/sprites.html` (en `npm run dev`) muestra una hoja con todos los sprites generados.

## Cómo se juega

1. **Los demonios declaran primero.** Las casillas rojas rayadas muestran qué
   golpeará cada uno; el número indica el orden en que actuarán.
2. **Tu Vigilia actúa.** Cada unidad puede **moverse** (casillas azules) y luego
   **actuar una vez**. Al pasar el ratón sobre un objetivo ves exactamente qué
   ocurrirá (daño, empujones, muertes, terreno). Un clic lo confirma.
3. **El Juicio (Reckoning).** La Mácula daña a quien esté sobre ella, los ataques
   declarados se resuelven en orden y la corrupción se extiende.

Reglas clave:

- Los ataques conservan su **dirección**: si empujas a un demonio, su golpe se
  desplaza con él. Si lo matas, su ataque no ocurre.
- Lo que choca contra un muro, el borde, un pilar u otra unidad recibe 1 de daño
  (y también aquello contra lo que choca). Lo que cae al **abismo** se pierde.
- **Mácula (violeta):** la Vigilia sobre ella sufre 1 al final de la ronda; los
  demonios sobre ella golpean +1; los demonios sólo surgen de ella. Si cubre
  demasiadas casillas, la batalla se pierde.
- **Suelo consagrado (oro):** los demonios no lo pisan; si son empujados a él,
  arden (1). No puede corromperse y nada surge en él.
- **Heridas:** extienden Mácula y marcan puntos de aparición. Pisar un punto de
  aparición lo bloquea (1 de daño); consagrarlo también.

Controles: `clic` seleccionar / mover / confirmar · `clic derecho` o `Esc`
cancelar · `1` `2` habilidades · `Tab` siguiente unidad · `Z` deshacer
movimiento · `Espacio` terminar turno · `T` ocultar telegrafías · `F`
animaciones rápidas · `M` sonido · `H` ayuda.

Hay un **reinicio de turno** por batalla y un **deshacer movimiento** mientras la
unidad no haya actuado.

## Contenido del MVP

| | |
|---|---|
| **Escuadra** | Hermano Caius (*el Penitente*: daño y desplazamiento), Hermana Maelis (*la Consagradora*: purificación y protección), Inquisidor Voss (*el Interdictor*: arrastre e interrupción de amenazas) |
| **Demonios** | Hueco (cuerpo a cuerpo), Sabueso Desollado (carga en línea), Cantor de Bilis (artillería que esparce Mácula y empuja), Cantor Hereje (rito de área silenciable), Siervo Ahogado (empuja hacia el agua) |
| **Encuentros** | I · *La Parroquia Cenicienta* (sellar dos Heridas, proteger el santuario) · II · *La Nave Ahogada* (jefe: el Leviatán y sus campanas) |
| **Jefe** | El Leviatán ocupa 2×2 en el agua y sigue una **letanía visible**: Marea (arrastra dos filas hacia el abismo), Fauces (3 de daño en 2×2), Lo Profundo se Agita (reaparece donde está la Vigilia). Es inmune mientras suenen sus campanas; silenciar una le inflige 2. |

## Documentación

- [`docs/ARQUITECTURA.md`](docs/ARQUITECTURA.md) — capas, flujo de datos y cómo añadir contenido.
- [`docs/DISENO.md`](docs/DISENO.md) — decisiones de diseño y reglas completas.
- [`docs/ROADMAP.md`](docs/ROADMAP.md) — próximas expansiones priorizadas.
