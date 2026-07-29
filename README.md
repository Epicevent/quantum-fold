# Quantum Fold: one BZ point, one Bloch image

Move the cyan point on the left Brillouin-zone board. The white point on the right is its lower-band Bloch image. At the amber fold, the mapped area of a small BZ cell collapses to zero; after crossing, its orientation sign reverses.

The paper integrates `λ̄(k) dkx dky` over the entire BZ, not along the player's trail. The game's gate packets do not perform that integral: they are authored `±1` samples that isolate its sign-cancellation rule.

The interactive [screen-to-calculation guide](./philosophy.html) begins with one actual fold crossing, then identifies the source point, Bloch image, signed cell contribution, full-BZ integral, cusp event, inverse-metric obstruction, and Appendix A projector polynomial.

## Play locally

Requires Node.js 20 or newer. There are no runtime dependencies or build step.

```bash
npm start
```

Open <http://127.0.0.1:4173>.

Controls: **WASD / arrows** move the cyan BZ point, **Space** reveals provenance echoes, **C** rotates the Bloch-sphere view, **M** toggles sound, **P** pauses, and **R** restarts. Touch controls appear on compact screens.

## Verify

```bash
npm test
```

The deterministic tests independently check the analytic Berry-area density, `det g = λ̄²`, the four Whitney cusps, one-versus-three preimages, the full-BZ Chern integral, the packet-proxy distinction, mission completion, fixed-step replay, and camera invariance. Simulation rules live in `src/game.js`; rendering and input in `src/main.js` consume that state.

GitHub Pages deploys the static game from `main` after the same test suite passes.
