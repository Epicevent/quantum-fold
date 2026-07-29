# Quantum Fold: torus map + differential strike

Two complementary browser games use the same two-band map:

- **Torus mode (`index.html`)** — move the cyan point on the Brillouin-zone board and watch its lower-band Bloch image. At the amber fold, the mapped area of a small BZ cell collapses to zero; after crossing, its orientation sign reverses.
- **Differential Strike (`shooter.html`)** — fire `∂xP` and `∂yP` rounds at the same target. Their Gram determinant produces area damage `√det g=|λ̄|`. At the fold the pair must deal zero damage because rank drops; that failure unlocks a `∂y²P` round measuring the transverse limit response `λ̄y`.

The paper integrates `λ̄(k) dkx dky` over the entire BZ, not along the player's trail. The game's gate packets do not perform that integral: they are authored `±1` samples that isolate its sign-cancellation rule.

The interactive [screen-to-calculation guide](./philosophy.html) begins with one actual fold crossing, then identifies the source point, Bloch image, signed cell contribution, full-BZ integral, cusp event, inverse-metric obstruction, and Appendix A projector polynomial.

## Play locally

Requires Node.js 20 or newer. There are no runtime dependencies or build step.

```bash
npm start
```

Open <http://127.0.0.1:4173>.

Torus controls: **WASD / arrows** move the cyan BZ point, **Space** reveals provenance echoes, **C** rotates the Bloch-sphere view, **M** toggles sound, **P** pauses, and **R** restarts.

Strike controls: **WASD / arrows** move, mouse aims, **left click / J** fires `∂xP`, **right click / K** fires `∂yP`, and **Space / L** fires the limit round after rank drop. Touch controls appear on compact screens.

## Verify

```bash
npm test
```

The deterministic tests independently check the analytic Berry-area density, `det g = λ̄²`, the four Whitney cusps, one-versus-three preimages, the full-BZ Chern integral, the packet-proxy distinction, mission completion, fixed-step replay, and camera invariance. They also verify that Strike's finite-difference probes recover `λ̄`, the fold makes `g⁻¹` unavailable, `λ̄y=−1/6` at its drill point, and only the second-derivative limit round damages that singular core. Pure simulation rules live in `src/game.js` and `src/shooter-mechanics.js`; rendering and input consume those states separately.

GitHub Pages deploys the static game from `main` after the same test suite passes.
