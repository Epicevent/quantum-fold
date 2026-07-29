# Quantum Fold

A short arcade-cartography game built from the paper's two-band map from the Brillouin torus to the Bloch sphere. Five staged missions teach periodic momentum, fold-induced orientation reversal, one-to-three preimages, signed cancellation, and the model's Chern integer `+1`.

The paper-to-game specification in [`philosophy.html`](./philosophy.html) states exactly what is integrated, why the quantum metric inverse fails on the fold, what Appendix A's projector polynomial actually does, and which runtime elements are exact, conceptual, or gameplay proxies.

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

The deterministic tests independently check the analytic Berry-area density, `det g = λ̄²`, the four Whitney cusps, one-versus-three preimages, the full-Brillouin-zone Chern integral, signed cancellation, mission completion, fixed-step replay, and camera invariance. Simulation rules live in `src/game.js`; rendering and input in `src/main.js` only consume that state.

GitHub Pages deploys the static game from `main` after the same test suite passes.
