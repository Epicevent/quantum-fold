# Quantum Fold

A short arcade-cartography game about steering a point through a periodic domain while reading its folded image on a state surface. Five staged missions teach edge wrapping, orientation reversal, one-to-three provenance, signed cancellation, and a final integer-charge run through play.

The mathematical design argument—and the exact boundary between mapping degree and the game's discrete proxy—is documented in [`philosophy.html`](./philosophy.html).

## Play locally

Requires Node.js 20 or newer. There are no runtime dependencies or build step.

```bash
npm start
```

Open <http://127.0.0.1:4173>.

Controls: **WASD / arrows** steer, **Space** pulses the provenance scanner, **C** rotates the state-surface view, **M** toggles sound, **P** pauses, and **R** restarts the mission. Touch controls appear on compact screens.

## Verify

```bash
npm test
```

The deterministic tests exercise periodic wraparound, fold-sign reversal, one-versus-three sources, signed cancellation, integer completion, fixed-step replay, and camera invariance. Simulation rules live in `src/game.js`; rendering and input in `src/main.js` only consume that state.

GitHub Pages deploys the static game from `main` after the same test suite passes.
