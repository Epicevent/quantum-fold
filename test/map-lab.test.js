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
  cuspidalEdgeSingularSample,
  foldKyAt,
  projectorCuspPoints,
  projectorDensity,
  projectorFoldSample,
  swallowtailMap,
  swallowtailSingularSample,
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

test("the Annals cuspidal edge keeps its singular and null directions transverse", () => {
  for (const parameter of [-1, -0.4, 0, 0.7, 1]) {
    const sample = cuspidalEdgeSingularSample(parameter);
    assert.deepEqual(sample.source, { u: 0, v: parameter });
    assert.deepEqual(sample.tangent, { u: 0, v: 1 });
    assert.deepEqual(sample.nullDirection, { u: 1, v: 0 });
    assert.equal(sample.determinant, -1);
    assert.equal(sample.imageSpeed, 1);
  }
});

test("the standard swallowtail aligns once and its singular image stops there", () => {
  const before = swallowtailSingularSample(-0.2);
  const cusp = swallowtailSingularSample(0);
  const after = swallowtailSingularSample(0.2);
  assert.ok(before.determinant < 0);
  assert.equal(cusp.determinant, 0);
  assert.ok(after.determinant > 0);
  assert.equal(cusp.imageSpeed, 0);
  assert.deepEqual(cusp.image, swallowtailMap(0, 0));
  assert.ok(before.imageSpeed > 0 && after.imageSpeed > 0);
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

test("the projector fold tangent aligns with ker dP exactly at the Whitney cusp", () => {
  const before = projectorFoldSample(-0.1);
  const cusp = projectorFoldSample(0);
  const after = projectorFoldSample(0.1);
  assert.ok(before.determinant > 0);
  assert.ok(after.determinant < 0);
  assert.ok(Math.abs(cusp.determinant) < 1e-12);
  assert.ok(cusp.imageSpeed < 1e-12);
  assert.ok(before.imageSpeed > 0.1);
  assert.ok(after.imageSpeed > 0.1);
});

test("the browser exposes both draggable examples and labels the full singular loci", () => {
  const root = resolve(import.meta.dirname, "..");
  const html = readFileSync(resolve(root, "map-lab.html"), "utf8");
  const index = readFileSync(resolve(root, "index.html"), "utf8");
  const shooter = readFileSync(resolve(root, "shooter.html"), "utf8");

  for (const phrase of [
    "f<sub>C</sub>(u,v) = (u², u³, v)",
    "f<sub>S</sub>(u,v) = (3u⁴+u²v, 4u³+2uv, v)",
    "det(γ′,η) = 0",
    "alignment를 통과하기",
    "Whitney cusp를 통과하기",
    "projector cusp도 같은 alignment 사건",
  ]) {
    assert.ok(html.includes(phrase), `map lab should expose: ${phrase}`);
  }
  assert.match(index, /href="\.\/map-lab\.html"/);
  assert.match(shooter, /href="\.\/map-lab\.html"/);
});
