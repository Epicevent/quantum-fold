import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

import {
  PI,
  blochVector,
  cuspidalEdgeDensity,
  cuspidalEdgeMap,
  cuspidalEdgeRank,
  foldKyAt,
  projectorCuspPoints,
  projectorDensity,
} from "../src/map-lab-math.js";

test("the local front exposes the whole line u=0 as its singular curve", () => {
  for (const v of [-1.0, -0.3, 0, 0.7, 1.0]) {
    assert.deepEqual(cuspidalEdgeMap(0, v), { x: 0, y: 0, z: v });
    assert.equal(cuspidalEdgeDensity(0), 0);
    assert.equal(cuspidalEdgeRank(0), 1);
  }
  assert.ok(cuspidalEdgeDensity(0.2) > 0);
  assert.ok(cuspidalEdgeDensity(-0.2) < 0);
  assert.equal(cuspidalEdgeRank(0.2), 2);
});

test("the two-band fold branches are exactly the zero set of signed area density", () => {
  for (const kx of [-0.94 * PI, -0.63 * PI, 0.4 * PI, 0.78 * PI]) {
    const branches = foldKyAt(kx);
    assert.equal(branches.length, 2);
    for (const ky of branches) {
      assert.ok(Math.abs(projectorDensity(kx, ky)) < 1e-11);
      const image = blochVector(kx, ky);
      assert.ok(Math.abs(Math.hypot(image.x, image.y, image.z) - 1) < 1e-12);
    }
  }
  assert.deepEqual(foldKyAt(0), []);
});

test("the four cusp points are special points on the same one-dimensional fold curve", () => {
  const cusps = projectorCuspPoints();
  assert.equal(cusps.length, 4);
  assert.equal(new Set(cusps.map(({ kx, ky }) => `${kx},${ky}`)).size, 4);
  for (const cusp of cusps) {
    assert.ok(Math.abs(projectorDensity(cusp.kx, cusp.ky)) < 1e-12);
    assert.ok(foldKyAt(cusp.kx).some((ky) => Math.abs(ky - cusp.ky) < 1e-12));
  }
});

test("the browser exposes both draggable examples and labels the full singular loci", () => {
  const root = resolve(import.meta.dirname, "..");
  const html = readFileSync(resolve(root, "map-lab.html"), "utf8");
  const index = readFileSync(resolve(root, "index.html"), "utf8");
  const shooter = readFileSync(resolve(root, "shooter.html"), "utf8");

  for (const phrase of [
    "f<sub>C</sub>(u,v) = (u², u³, v)",
    "SINGULAR CURVE · u = 0",
    "Σ · λ̄(k) = 0 · 1D CLOSED CURVE",
    "four cusp points on Σ",
    "ordinary fold 위에 놓기",
    "fold를 가로질러 보기",
  ]) {
    assert.ok(html.includes(phrase), `map lab should expose: ${phrase}`);
  }
  assert.match(index, /href="\.\/map-lab\.html"/);
  assert.match(shooter, /href="\.\/map-lab\.html"/);
});
