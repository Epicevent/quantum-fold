# Quantum Fold: a torus map and two global-trace games

All three browser modes use the lower-band map

`f:T²→S²`, `d(k)=(sin kx,sin ky,1−cos kx−cos ky)`, `f(k)=−d(k)/|d(k)|`.

- **Torus mode (`index.html`)** — move one source point in the periodic Brillouin zone and watch its Bloch-sphere image. The amber curve is `λ̄=0`; crossing it reverses orientation.
- **A · Continuation Strike (`shooter.html`)** — a target path is fixed. Connect each source root to the same sheet in the next time layer, then strike the actual `+/−` pair born or killed at a fold. Levels cover an ordinary fold, torus seam wrap, and cusp survivor exchange.
- **B · Sheet Runner (`shooter.html`)** — steer the target path on `S²` while all roots move on `T²`. Preserve a sheet by routing around the cusp lobe, tag a newborn pair, then cross the lobe so the newly born positive sheet becomes the final survivor.

The trace games do not accept only a root count or final integer. Their receipt stores the target path, stable sheet IDs, source roots, signs, continuation edges, fold parentage, residuals, and signed multiplicity. This distinguishes the real cusp trace

`S₀⁺ → {S₀⁺, Snew⁺, S⁻} → Snew⁺`

from the false story in which `S₀⁺` survived.

The paper integrates `λ̄(k) dkx dky` over the whole BZ, not along the player's trail. Torus-mode gate packets do not perform that integral; they remain an authored sign-cancellation proxy.

## Run

Requires Node.js 20 or newer. There are no runtime dependencies or build step.

```bash
npm start
```

Open <http://127.0.0.1:4173>.

- Torus: **WASD / arrows** move, **Space** shows provenance echoes, **C** rotates the representation, **M** toggles sound, **P** pauses, **R** restarts.
- A: tap/click a root at `t−1`, then its continuation at `t`; select two roots on one layer to lock a fold pair.
- B: **WASD / arrows** or the touch pad steer the target; tap two source roots to tag the predicted birth/death pair.

## Verify

```bash
npm test
```

The deterministic suite checks periodic wrap, orientation reversal, one/three preimages, signed cancellation, Chern-number integration, and the torus missions. Trace tests additionally check the closed-form meridian roots, stable IDs across a torus seam, `+/−` fold parentage, the cusp's `S₀→Snew` survivor exchange, deterministic fixed-step replay, Preserve/Forge/Exchange mission predicates, and the separation of simulation from rendering.

Pure rules live in `src/game.js` and `src/trace-mechanics.js`; `src/trace-game.js` only handles input, sound, effects, and drawing. GitHub Pages deploys the static game from `main` after the tests pass.
