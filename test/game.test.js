import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

import {
  CoverageLedger,
  FIXED_STEP,
  bzCoordinates,
  clamp,
  createMissionState,
  cuspPoints,
  fieldEffectAt,
  findSourcesForState,
  foldBranchesAtU,
  isChargeComplete,
  makeMissions,
  mapToState,
  metricDeterminant,
  orientationAt,
  orientationValue,
  sourceFromBZ,
  sourceMultiplicity,
  signedPeriodicDelta,
  stepMission,
  stepSource,
} from "../src/game.js";

test("periodic wraparound returns through the opposite edge without losing velocity", () => {
  const moved = stepSource(
    { u: 0.995, v: 0.4, vx: 0.2, vy: 0 },
    { x: 1, y: 0 },
    0.1,
    { speed: 0.25, acceleration: 20 },
  );
  assert.equal(moved.wrappedU, true);
  assert.ok(moved.u > 0 && moved.u < 0.04);
  assert.ok(moved.vx > 0);
});

test("orientation reverses between the two branches of a fold", () => {
  const u = 0.6;
  const [upperEntry, lowerExit] = foldBranchesAtU(u);
  assert.equal(orientationAt(u, upperEntry - 0.01), 1);
  assert.equal(orientationAt(u, 0.6), -1);
  assert.equal(orientationAt(u, lowerExit + 0.01), 1);
});

test("the same visible state point has one source or three distinct sources", () => {
  const northPole = mapToState({ u: 0.1, v: 0.1 });
  const southPole = mapToState({ u: 0.6, v: 0.1 });
  const triple = findSourcesForState(southPole);
  const single = findSourcesForState(northPole);
  assert.equal(triple.length, 3);
  assert.equal(single.length, 1);
  for (const source of triple) {
    const mapped = mapToState(source);
    assert.ok(Math.hypot(
      mapped.x - southPole.x,
      mapped.y - southPole.y,
      mapped.z - southPole.z,
    ) < 1e-7);
  }
  assert.deepEqual(triple.map((source) => orientationAt(source.u, source.v)), [1, 1, -1]);
  assert.equal(sourceMultiplicity(triple[1]), 3);
});

test("oppositely oriented layers increase raw coverage while signed coverage cancels", () => {
  const ledger = new CoverageLedger();
  ledger.add("shared-patch", 1, 2);
  ledger.add("shared-patch", -1, 2);
  assert.deepEqual(ledger.snapshot(), {
    rawArea: 4,
    signedArea: 0,
    layers: [{ patch: "shared-patch", raw: 4, signed: 0 }],
  });
});

test("integer completion requires the signed target, all relays, and a closed path", () => {
  assert.equal(isChargeComplete({
    signedArea: 2,
    targetCharge: 2,
    allRequiredCollected: true,
    pathClosed: true,
  }), true);
  assert.equal(isChargeComplete({
    signedArea: 2,
    targetCharge: 2,
    allRequiredCollected: true,
    pathClosed: false,
  }), false);
  assert.equal(isChargeComplete({
    signedArea: 2.25,
    targetCharge: 2,
    allRequiredCollected: true,
    pathClosed: true,
  }), false);
});

test("identical fixed-step input streams produce identical simulation snapshots", () => {
  const run = () => {
    const state = createMissionState(0, makeMissions());
    for (let tick = 0; tick < 480; tick += 1) {
      stepMission(state, {
        x: tick < 240 ? 1 : 0,
        y: tick >= 240 ? -1 : 0,
        pulse: tick === 60,
      }, FIXED_STEP);
    }
    return {
      source: state.source,
      mapped: state.mapped,
      orientation: state.orientation,
      multiplicity: state.multiplicity,
      wraps: state.wrapCount,
      collected: state.collected,
    };
  };
  assert.deepEqual(run(), run());
});

test("cosmetic camera data cannot change mapping or charge", () => {
  const source = { u: 0.02, v: 0.5 };
  const mappedBefore = mapToState(source);
  const ledger = new CoverageLedger();
  ledger.add("a", 1);
  ledger.add("a", -1);
  const camera = { yaw: 0, pitch: 0.3 };
  camera.yaw += Math.PI * 3;
  camera.pitch = -0.6;
  assert.deepEqual(mapToState(source), mappedBefore);
  assert.equal(ledger.signedArea, 0);
});

test("every staged mission is deterministically completable at its authored integer", () => {
  const missionSet = makeMissions();

  const steerUntil = (state, target, predicate, maxTicks = 12000) => {
    for (let tick = 0; tick < maxTicks; tick += 1) {
      if (predicate()) return;
      assert.notEqual(state.status, "failed", `${state.mission.id} failed while routing`);
      const du = signedPeriodicDelta(state.source.u, target.u);
      const dv = signedPeriodicDelta(state.source.v, target.v);
      stepMission(state, {
        x: clamp(du * 10, -1, 1),
        y: clamp(dv * 10, -1, 1),
        pulse: false,
      }, FIXED_STEP);
    }
    assert.fail(`${state.mission.id} did not reach ${JSON.stringify(target)}`);
  };

  for (let missionIndex = 0; missionIndex < missionSet.length; missionIndex += 1) {
    const state = createMissionState(missionIndex, missionSet);
    for (const gate of state.mission.gates) {
      steerUntil(
        state,
        gate,
        () => state.collected.includes(gate.id),
      );
    }
    if (state.mission.home) {
      steerUntil(
        state,
        state.mission.home,
        () => state.status === "complete",
      );
    }
    assert.equal(state.status, "complete", `${state.mission.id} should complete`);
    if (state.mission.targetCharge !== null) {
      assert.equal(
        state.coverage.signedArea,
        state.mission.targetCharge,
        `${state.mission.id} should land on its authored charge`,
      );
    }
  }
});

test("the analytic signed area density agrees with an independent Bloch-sphere derivative", () => {
  const delta = 1e-6;
  const cross = (a, b) => [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
  const dot = (a, b) => a.reduce((sum, value, index) => sum + value * b[index], 0);
  const vector = (point) => [point.x, point.y, point.z];

  for (const [kx, ky] of [[0, 0], [Math.PI, 0], [1.1, -0.7], [-2.2, 0.9]]) {
    const source = sourceFromBZ(kx, ky);
    const state = vector(mapToState(source));
    const plusX = vector(mapToState(sourceFromBZ(kx + delta, ky)));
    const minusX = vector(mapToState(sourceFromBZ(kx - delta, ky)));
    const plusY = vector(mapToState(sourceFromBZ(kx, ky + delta)));
    const minusY = vector(mapToState(sourceFromBZ(kx, ky - delta)));
    const derivativeX = plusX.map((value, index) => (value - minusX[index]) / (2 * delta));
    const derivativeY = plusY.map((value, index) => (value - minusY[index]) / (2 * delta));
    const numerical = 0.5 * dot(state, cross(derivativeX, derivativeY));
    assert.ok(Math.abs(numerical - orientationValue(source.u, source.v)) < 1e-8);
    assert.ok(Math.abs(metricDeterminant(source.u, source.v) - numerical ** 2) < 1e-8);
  }
});

test("signed preimage count and the Berry-curvature integral independently give Chern one", () => {
  const targets = [
    mapToState({ u: 0.1, v: 0.1 }),
    mapToState({ u: 0.6, v: 0.1 }),
    mapToState({ u: 0.31, v: 0.72 }),
  ];
  for (const target of targets) {
    const roots = findSourcesForState(target);
    const signedCount = roots.reduce(
      (sum, source) => sum + Math.sign(orientationValue(source.u, source.v)),
      0,
    );
    assert.equal(signedCount, 1);
  }

  const grid = 512;
  let berryIntegral = 0;
  for (let uIndex = 0; uIndex < grid; uIndex += 1) {
    for (let vIndex = 0; vIndex < grid; vIndex += 1) {
      berryIntegral += orientationValue(
        (uIndex + 0.5) / grid,
        (vIndex + 0.5) / grid,
      );
    }
  }
  berryIntegral *= (2 * Math.PI) ** 2 / (grid * grid);
  assert.ok(Math.abs(berryIntegral / (2 * Math.PI) - 1) < 1e-10);
});

test("the continuous area integral and mission packet proxy preserve cancellation but not units", () => {
  const grid = 1024;
  let continuousRaw = 0;
  let continuousSigned = 0;
  for (let uIndex = 0; uIndex < grid; uIndex += 1) {
    for (let vIndex = 0; vIndex < grid; vIndex += 1) {
      const jacobian = orientationValue(
        (uIndex + 0.5) / grid,
        (vIndex + 0.5) / grid,
      );
      continuousRaw += Math.abs(jacobian);
      continuousSigned += jacobian;
    }
  }
  const bzCellArea = (2 * Math.PI) ** 2 / (grid * grid);
  continuousRaw *= bzCellArea;
  continuousSigned *= bzCellArea;

  assert.ok(Math.abs(continuousRaw - 7.4703885) < 5e-6);
  assert.ok(Math.abs(continuousSigned - 2 * Math.PI) < 1e-10);

  const cancellationMission = makeMissions().find((mission) => mission.id === "cancel");
  const packetSigns = cancellationMission.gates.map((gate) => (
    orientationAt(gate.u, gate.v)
  ));
  const packetRaw = cancellationMission.gates.length;
  const packetSigned = packetSigns.reduce((sum, sign) => sum + sign, 0);

  assert.deepEqual(packetSigns, [1, -1, 1, -1, 1]);
  assert.equal(packetRaw, 5);
  assert.equal(packetSigned, 1);
  assert.ok(Math.abs(packetRaw - continuousRaw / (2 * Math.PI)) > 3);
});

test("the four documented points are Whitney cusps on a smooth singular curve", () => {
  assert.equal(cuspPoints().length, 4);
  const delta = 1e-5;
  for (const cusp of cuspPoints()) {
    const { kx, ky } = bzCoordinates(cusp);
    assert.ok(Math.abs(Math.abs(kx) - Math.PI / 2) < 1e-12);
    assert.ok(Math.abs(Math.abs(ky) - Math.PI / 2) < 1e-12);
    assert.ok(Math.abs(orientationValue(cusp.u, cusp.v)) < 1e-12);
    assert.ok(metricDeterminant(cusp.u, cusp.v) < 1e-24);

    const tangentSign = Math.sign(Math.sin(kx) * Math.sin(ky));
    const before = mapToState(sourceFromBZ(kx - delta, ky + tangentSign * delta));
    const after = mapToState(sourceFromBZ(kx + delta, ky - tangentSign * delta));
    assert.ok(Math.hypot(
      after.x - before.x,
      after.y - before.y,
      after.z - before.z,
    ) < 1e-8, "the fold tangent should lie in the map kernel at a cusp");
  }
});

test("field feedback distinguishes positive, fold, reversed, and cusp effects", () => {
  const ordinaryFold = {
    u: 0.6,
    v: foldBranchesAtU(0.6)[0],
  };
  const cusp = cuspPoints()[0];

  const positive = fieldEffectAt({ u: 0.1, v: 0.1 });
  const fold = fieldEffectAt(ordinaryFold);
  const reversed = fieldEffectAt({ u: 0.6, v: 0.6 });
  const cuspEffect = fieldEffectAt(cusp);

  assert.equal(positive.kind, "positive");
  assert.equal(positive.localResponse, "orientation-preserved");
  assert.equal(positive.packetSign, 1);

  assert.equal(fold.kind, "fold");
  assert.ok(Math.abs(fold.signedDensity) < 1e-12);
  assert.equal(fold.localResponse, "rank-loss");
  assert.equal(fold.packetSign, null);

  assert.equal(reversed.kind, "reversed");
  assert.equal(reversed.localResponse, "orientation-reversed");
  assert.equal(reversed.packetSign, -1);

  assert.equal(cuspEffect.kind, "cusp");
  assert.ok(Math.abs(cuspEffect.signedDensity) < 1e-12);
  assert.equal(cuspEffect.causesDamage, false);
  assert.equal(cuspEffect.isCollectible, false);
});

test("every philosophy claim anchor resolves to one exact source substring", () => {
  const root = resolve(import.meta.dirname, "..");
  const html = readFileSync(resolve(root, "philosophy.html"), "utf8");
  const anchors = [...html.matchAll(/data-source="([^"]+)" data-quote="([^"]+)"/g)];
  assert.ok(anchors.length >= 12);
  for (const [, sourcePath, quote] of anchors) {
    const source = readFileSync(resolve(root, sourcePath), "utf8");
    assert.equal(
      source.split(quote).length - 1,
      1,
      `${sourcePath} should contain the exact philosophy anchor once: ${quote}`,
    );
  }

  const southPole = mapToState({ u: 0.6, v: 0.1 });
  const workedRoots = findSourcesForState(southPole);
  assert.equal(workedRoots.length, 3);
  assert.deepEqual(
    workedRoots.map((source) => orientationAt(source.u, source.v)),
    [1, 1, -1],
  );
  for (const requiredReceipt of [
    "f⁻¹(n<sub>south</sub>)",
    "{(π,0),(0,π),(π,π)}",
    "+½",
    "−1/18",
  ]) {
    assert.ok(html.includes(requiredReceipt), `worked example should show: ${requiredReceipt}`);
  }
});

test("the philosophy page maps every hand-calculation object to an explicit game status", () => {
  const html = readFileSync(
    resolve(import.meta.dirname, "..", "philosophy.html"),
    "utf8",
  );
  const rows = [...html.matchAll(
    /<tr data-calculation-object="([^"]+)" data-game-status="([^"]+)"/g,
  )].map(([, object, status]) => [object, status]);

  assert.deepEqual(rows, [
    ["bz-point", "exact"],
    ["bloch-map", "exact"],
    ["signed-density", "exact"],
    ["metric-determinant", "exact"],
    ["regularized-inverse", "not-implemented"],
    ["singular-curve", "exact"],
    ["cusps", "exact"],
    ["multiplicity", "exact"],
    ["front", "conceptual"],
    ["singular-curvature", "not-computed"],
    ["chern-integral", "verified-not-played"],
    ["packet-score", "proxy"],
    ["projector-polynomial", "not-implemented"],
  ]);

  for (const requiredCalculation of [
    "dĀ=λ̄(k) dk<sub>x</sub>∧dk<sub>y</sub>",
    "det g=λ̄²",
    "(1/4π)∫K<sub>G</sub>dĀ=(1/2π)∫<sub>BZ</sub>λ̄ dk<sub>x</sub>dk<sub>y</sub>=C=1",
    "(1/2π)∫|λ̄|dk<sub>x</sub>dk<sub>y</sub>≈1.1889",
    "Q<sub>game</sub>=Σ ε<sub>j</sub>a<sub>j</sub>",
    "K<sub>α</sub>(H)",
    "g<sub>reg</sub><sup>−1</sup>=(g+λ<sub>reg</sub>I)<sup>−1</sup>",
    "(g+λ<sub>reg</sub>I)<sup>−1</sup>g=Q diag(sᵢ/(sᵢ+λ<sub>reg</sub>))Q<sup>T</sup>",
  ]) {
    assert.ok(
      html.includes(requiredCalculation),
      `philosophy should expose the calculation step: ${requiredCalculation}`,
    );
  }
});

test("the specification uses a neutral voice and exposes the amber geometry contract", () => {
  const root = resolve(import.meta.dirname, "..");
  const philosophy = readFileSync(resolve(root, "philosophy.html"), "utf8");
  const gameHtml = readFileSync(resolve(root, "index.html"), "utf8");
  const renderer = readFileSync(resolve(root, "src", "main.js"), "utf8");

  for (const requiredText of [
    "<title>Quantum Fold — Paper-to-Game Implementation Specification</title>",
    "어느 역행렬이, 어디서, 왜 사라지는가",
    "f:T²<sub>BZ</sub>→S²<sub>Bloch</sub>",
    "Σ={k:det g(k)=0}",
    "g<sub>reg</sub><sup>−1</sup>=(g+λ<sub>reg</sub>I)<sup>−1</sup>",
    "Fold의 kernel 고유값 <code>s₂=0</code>은 여전히 0이므로 잃어버린 방향을 복원하지 못한다.",
    "<code>λ<sub>reg</sub></code>와 <code>λ̄</code>는 서로 다른 양이다.",
    "dĀ=λ̄ dk<sub>x</sub>∧dk<sub>y</sub>",
    "손으로 적분한 양과 게임 meter의 대응",
    "“요상한 다항식”은 fold의 역행렬을 구하지 않는다",
    "실제 구현과 proxy를 분리한 대응표",
    "metric rank loss, four Whitney cusps, 1↔3 preimages, signed Berry area, Chern integer +1",
    "벽이나 damage zone이 아니다.",
  ]) {
    assert.ok(philosophy.includes(requiredText), `specification should include: ${requiredText}`);
  }

  for (const forbiddenText of [
    "Why Quantum Fold",
    "먼저 결론부터",
    "원 논문",
    "최초 제약",
    "제가 노린",
    "질문에 대한 직접 답",
    "설득의 조건",
    "게임적으로 속인",
    "논문 독자",
    "이 해석을 반증",
    "PLAY THE ARGUMENT",
    "Mapping Degree Game Specification",
    "T²→T²",
    "CUSP NORMAL FORM ≠ INVERSE-REPLACEMENT ALGORITHM",
    "singular Jacobian의 역행렬을 복구",
  ]) {
    assert.equal(
      philosophy.includes(forbiddenText),
      false,
      `specification should not contain author-process framing: ${forbiddenText}`,
    );
  }

  for (const gameContractText of [
    "WHITNEY CUSP · det g=0",
    "KERNEL TANGENT TO Σ · SINGULAR-CURVATURE WARNING",
    "Σ · det g=0",
    "AREA DENSITY |λ̄|",
    "BLOCH SPHERE",
  ]) {
    assert.ok(gameHtml.includes(gameContractText), `game HUD should include: ${gameContractText}`);
  }
  assert.ok(renderer.includes("λ̄ < 0 · ORIENTED BLOCH AREA SUBTRACTS"));
  assert.ok(renderer.includes("det g = λ̄² → 0 · g⁻¹ UNDEFINED"));
  assert.ok(renderer.includes("KERNEL TANGENT TO Σ · FOLD IMAGE FORMS A CUSP"));
  assert.ok(renderer.includes("SINGULAR-CURVATURE WARNING · NO DAMAGE · NO PICKUP"));
  assert.ok(renderer.includes("function drawSphereMesh"));
});
