# Quantum Fold: torus map + differential strike

Two complementary browser games use the same two-band map:

- **Torus mode (`index.html`)** — move the cyan point on the Brillouin-zone board and watch its lower-band Bloch image. At the amber fold, the mapped area of a small BZ cell collapses to zero; after crossing, its orientation sign reverses.
- **Differential Strike (`shooter.html`)** — the screen asks for an actual derivative value, such as `∂xn` at a displayed `k`, and places three vector answers in the arena. The requested operator is loaded automatically; shoot the correct value to rewrite the live formula. Correct first derivatives build `√det g=|λ̄|`. At the fold, `∂yn=0` makes `g⁻¹` unavailable, opening the `∂y²n` vector question and then the decisive scalar question `λ̄y=?`. The run ends only after the player shoots `−1/6`.

The paper integrates `λ̄(k) dkx dky` over the entire BZ, not along the player's trail. The game's gate packets do not perform that integral: they are authored `±1` samples that isolate its sign-cancellation rule.

The interactive [screen-to-calculation guide](./philosophy.html) begins with one actual fold crossing, then identifies the source point, Bloch image, signed cell contribution, full-BZ integral, cusp event, inverse-metric obstruction, and Appendix A projector polynomial.

## Play locally

Requires Node.js 20 or newer. There are no runtime dependencies or build step.

```bash
npm start
```

Open <http://127.0.0.1:4173>.

Torus controls: **WASD / arrows** move the cyan BZ point, **Space** reveals provenance echoes, **C** rotates the Bloch-sphere view, **M** toggles sound, **P** pauses, and **R** restarts.

Strike controls: **WASD / arrows** move, the mouse aims, and **click / Space** fires the currently displayed operator. Aim at the answer value, not the core. On touch screens, tap a value directly.

## Verify

```bash
npm test
```

The deterministic tests independently check the analytic Berry-area density, `det g = λ̄²`, the four Whitney cusps, one-versus-three preimages, the full-BZ Chern integral, the packet-proxy distinction, mission completion, fixed-step replay, and camera invariance. They also cross-check Strike's analytic chain-rule derivatives against independent finite differences, reject incorrect answer values without advancing the formula, and verify the complete answer path through `∂yn=0`, unavailable `g⁻¹`, and `λ̄y=−1/6`. Pure simulation rules live in `src/game.js` and `src/shooter-mechanics.js`; rendering and input consume those states separately.

GitHub Pages deploys the static game from `main` after the same test suite passes.
