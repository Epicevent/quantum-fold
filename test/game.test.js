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
  signedAreaDensity,
  signedPeriodicDelta,
  stepMission,
  stepSource,
} from "../src/game.js";
import {
  applyAnswerHit,
  applyProbeHit,
  createShooterState,
  currentShooterQuestion,
  currentShooterTarget,
  finiteDifferenceGeometryAt,
  probeGeometryAt,
  shooterEvidence,
  sourceForFoldDrill,
  startShooter,
  stepShooter,
} from "../src/shooter-mechanics.js";

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

test("the first interactive scene crosses one actual fold and exposes the live correspondence", () => {
  const root = resolve(import.meta.dirname, "..");
  const html = readFileSync(resolve(root, "philosophy.html"), "utf8");
  const script = readFileSync(resolve(root, "src", "philosophy.js"), "utf8");
  const gameHtml = readFileSync(resolve(root, "index.html"), "utf8");
  const readme = readFileSync(resolve(root, "README.md"), "utf8");
  const [firstFold] = foldBranchesAtU(0.6);

  assert.ok(firstFold > 0.15 && firstFold < 0.6);
  assert.equal(orientationAt(0.6, 0.15), 1);
  assert.equal(orientationAt(0.6, 0.6), -1);
  assert.ok(html.includes('id="scene-slider" type="range" min="0.15" max="0.60"'));
  assert.ok(script.includes("const sourceU = 0.6;"));
  assert.ok(script.includes("const mapped = mapToState(source);"));
  assert.ok(script.includes("const density = orientationValue(source.u, source.v);"));
  assert.ok(script.includes("const multiplicity = findSourcesForState(mapped).length;"));

  for (const liveId of [
    "live-bz-point",
    "live-bloch-point",
    "live-cell-contribution",
  ]) {
    assert.ok(gameHtml.includes(`id="${liveId}"`));
  }
  for (const misleadingLabel of ["GLOBAL CHARGE", "RAW AREA", "SIGNED AREA"]) {
    assert.equal(gameHtml.includes(misleadingLabel), false);
  }
  assert.ok(readme.includes("not along the player's trail"));
  assert.ok(readme.includes("do not perform that integral"));
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
    ["bz-domain", "exact"],
    ["bz-point", "exact"],
    ["bloch-map", "exact"],
    ["signed-density", "exact"],
    ["metric-determinant", "exact"],
    ["singular-curve", "exact"],
    ["cusps", "exact"],
    ["multiplicity", "exact"],
    ["chern-integral", "verified-not-played"],
    ["packet-score", "proxy"],
    ["front", "conceptual"],
    ["singular-curvature", "not-computed"],
    ["projector-polynomial", "not-implemented"],
  ]);

  for (const requiredCalculation of [
    "λ̄(k)dk<sub>x</sub>dk<sub>y</sub>",
    "dĀ=λ̄(k)dk<sub>x</sub>∧dk<sub>y</sub>",
    "det g=λ̄²",
    "(1/4π)∫K<sub>G</sub>dĀ=(1/2π)∫<sub>BZ</sub>λ̄ dk<sub>x</sub>dk<sub>y</sub>=C=1",
    "Q<sub>game</sub>=Σ<sub>j</sub>ε<sub>j</sub>",
    "K<sub>α</sub>(H)",
  ]) {
    assert.ok(
      html.includes(requiredCalculation),
      `philosophy should expose the calculation step: ${requiredCalculation}`,
    );
  }
});

test("the artifacts show one concrete scene before naming principles or formulas", () => {
  const root = resolve(import.meta.dirname, "..");
  const philosophy = readFileSync(resolve(root, "philosophy.html"), "utf8");
  const gameHtml = readFileSync(resolve(root, "index.html"), "utf8");
  const renderer = readFileSync(resolve(root, "src", "main.js"), "utf8");

  for (const requiredText of [
    "<title>Quantum Fold — 왼쪽 BZ 점, 오른쪽 Bloch 점, 그리고 실제 적분</title>",
    "왼쪽 점을 움직이면 오른쪽 점이 움직인다. 노란 선에서 작은 면적이 0으로 눌린 뒤 부호가 바뀐다",
    "실제 게임 장면 하나",
    "적분영역은 궤적이 아니라 왼쪽 보드 전체다",
    "노란 선과 삼각형에 들어가면 화면에서 무엇이 달라지는가",
    "위 장면을 만드는 two-band map과 막히는 계산",
    "f:T²<sub>BZ</sub>→S²<sub>Bloch</sub>",
    "damage도 pickup도 없고 packet sign도 없다.",
    "게임 packet은 그 적분값이 아니라 부호 상쇄만 연습시키는 proxy다.",
    "다항식은 노란 fold에서 <code>g⁻¹</code>를 만드는 장치가 아니다",
    "화면·손계산·구현의 최종 대응",
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
    "IMPLEMENTED MATHEMATICAL TARGET",
    "THE ACTUAL OBSTRUCTION",
  ]) {
    assert.equal(
      philosophy.includes(forbiddenText),
      false,
      `specification should not contain author-process framing: ${forbiddenText}`,
    );
  }

  const sceneIndex = philosophy.indexOf("실제 게임 장면 하나");
  const integralIndex = philosophy.indexOf("적분영역은 궤적이 아니라 왼쪽 보드 전체다");
  const mathIndex = philosophy.indexOf("위 장면을 만드는 two-band map과 막히는 계산");
  assert.ok(sceneIndex > 0 && sceneIndex < integralIndex && integralIndex < mathIndex);

  for (const gameContractText of [
    "1 · YOU MOVE THIS BZ POINT",
    "2 · THE MAP DRAWS THIS BLOCH POINT",
    "3 · THIS SMALL BZ CELL CONTRIBUTES",
    "PAPER:</b> sum every BZ cell",
    "GAME:</b> collected gate packets only imitate the sign cancellation",
    "AT THIS AMBER TRIANGLE, THE FOLD ITSELF TURNS",
    "PACKET SUM",
    "GAME PROXY RECEIPT",
  ]) {
    assert.ok(gameHtml.includes(gameContractText), `game HUD should include: ${gameContractText}`);
  }
  assert.ok(renderer.includes("HERE: A SMALL BZ PATCH ADDS AREA"));
  assert.ok(renderer.includes("ON AMBER LINE: THE PATCH COLLAPSES TO A CURVE"));
  assert.ok(renderer.includes("INSIDE CORAL REGION: THE PATCH COUNTS BACKWARD"));
  assert.ok(renderer.includes("AT AMBER TRIANGLE: THE FOLD ITSELF TURNS"));
  assert.ok(renderer.includes("This is not the BZ integral."));
  assert.ok(renderer.includes("function drawSphereMesh"));
});

test("the explanation exposes explicit before, fold, and after states", () => {
  const root = resolve(import.meta.dirname, "..");
  const philosophy = readFileSync(resolve(root, "philosophy.html"), "utf8");
  const controller = readFileSync(resolve(root, "src", "philosophy.js"), "utf8");

  assert.match(philosophy, /data-scene-v="0\.150"/);
  assert.match(philosophy, /data-scene-v="0\.266666666667"/);
  assert.match(philosophy, /data-scene-v="0\.400"/);
  assert.match(controller, /button\.addEventListener\("click"/);
});

test("shooter probes recover the signed area density and det g = lambda squared", () => {
  for (const [kx, ky] of [
    [0, 0],
    [Math.PI, 0],
    [Math.PI, Math.PI],
  ]) {
    const source = sourceFromBZ(kx, ky);
    const geometry = probeGeometryAt(source);
    assert.ok(Math.abs(geometry.lambda - signedAreaDensity(source.u, source.v)) < 1e-7);
    assert.ok(Math.abs(geometry.determinant - geometry.lambda ** 2) < 1e-8);
    assert.equal(geometry.inverseAvailable, true);
  }
});

test("the displayed chain-rule derivatives agree with an independent finite-difference route", () => {
  for (const [kx, ky] of [
    [0, 0],
    [Math.PI, 0],
    [Math.PI, Math.PI],
    [Math.PI, Math.PI / 3],
  ]) {
    const source = sourceFromBZ(kx, ky);
    const analytic = probeGeometryAt(source);
    const finite = finiteDifferenceGeometryAt(source);
    for (const key of ["x", "y", "z"]) {
      assert.ok(Math.abs(analytic.tangentX[key] - finite.tangentX[key]) < 1e-7);
      assert.ok(Math.abs(analytic.tangentY[key] - finite.tangentY[key]) < 1e-7);
      assert.ok(Math.abs(analytic.secondY[key] - finite.secondY[key]) < 1e-6);
    }
  }
});

test("the fold target makes first derivative damage fail and exposes the next derivative", () => {
  const geometry = probeGeometryAt(sourceForFoldDrill());
  assert.ok(geometry.gyy < 1e-12);
  assert.ok(geometry.determinant < 1e-12);
  assert.ok(Math.abs(geometry.lambda) < 1e-7);
  assert.equal(geometry.inverseAvailable, false);
  assert.ok(Math.abs(geometry.lambdaV + 1 / 6) < 1e-6);
});

test("combat damage follows the calculation: area at regular points, limit response at the fold", () => {
  const regularState = createShooterState();
  const regular = regularState.enemies[0];
  const regularHp = regular.hp;
  applyProbeHit(regularState, regular, "x");
  assert.equal(regular.hp, regularHp);
  applyProbeHit(regularState, regular, "y");
  assert.ok(regular.hp < regularHp);
  assert.equal(regularState.lastImpact.mode, "area");

  const foldState = createShooterState();
  const fold = foldState.enemies[0];
  fold.fold = true;
  fold.hp = 250;
  fold.maxHp = 250;
  fold.geometry = probeGeometryAt(sourceForFoldDrill());
  const foldHp = fold.hp;
  applyProbeHit(foldState, fold, "x");
  applyProbeHit(foldState, fold, "y");
  assert.equal(fold.hp, foldHp);
  assert.equal(fold.rankDropSeen, true);
  assert.equal(foldState.limitUnlocked, true);
  assert.equal(foldState.lastImpact.mode, "rank-drop");
  assert.equal(fold.probes.x, true, "the surviving tangent remains tagged for the limit round");
  applyProbeHit(foldState, fold, "limit");
  assert.ok(fold.hp < foldHp);
  assert.equal(foldState.lastImpact.mode, "limit");
  const firstLimitHp = fold.hp;
  applyProbeHit(foldState, fold, "limit");
  assert.equal(fold.hp, firstLimitHp, "a limit round cannot reuse a consumed x tangent");
  applyProbeHit(foldState, fold, "x");
  applyProbeHit(foldState, fold, "limit");
  assert.ok(fold.hp < firstLimitHp, "each later limit hit rebuilds the (x, second-y) pair");
});

test("shooter fixed-step replay is deterministic", () => {
  const left = createShooterState();
  const right = createShooterState();
  startShooter(left);
  startShooter(right);
  for (let frame = 0; frame < 240; frame += 1) {
    const input = {
      moveX: frame < 80 ? 0.4 : -0.25,
      moveY: frame < 120 ? -0.2 : 0.1,
      aimX: 0,
      aimY: -1,
      fireX: frame === 12,
      fireY: frame === 72,
      fireLimit: false,
    };
    stepShooter(left, input);
    stepShooter(right, input);
  }
  assert.deepEqual(shooterEvidence(left), shooterEvidence(right));
  assert.deepEqual(left.player, right.player);
  assert.deepEqual(left.bullets, right.bullets);
});

test("wrong values cannot advance the formula and correct values produce the decisive fold answer", () => {
  const state = createShooterState();
  startShooter(state);
  const noInput = { moveX: 0, moveY: 0, aimX: 0, aimY: -1, fireX: false, fireY: false, fireLimit: false };
  const answerCorrectly = () => {
    const question = currentShooterQuestion(state);
    const target = currentShooterTarget(state);
    const correct = question.choices.find((choice) => choice.correct);
    applyAnswerHit(state, target, correct, question.expectedProbe);
  };
  const advanceWave = () => {
    for (let frame = 0; frame < 150; frame += 1) stepShooter(state, noInput);
  };

  const openingQuestion = currentShooterQuestion(state);
  assert.equal(openingQuestion.prompt, "At k=(0,0), which value is ∂ₓn?");
  const wrong = openingQuestion.choices.find((choice) => !choice.correct);
  applyAnswerHit(state, currentShooterTarget(state), wrong, openingQuestion.expectedProbe);
  assert.equal(currentShooterTarget(state).questionStage, "x");
  assert.deepEqual(currentShooterTarget(state).operations, { x: 0, y: 0, limit: 0, contract: 0 });

  answerCorrectly();
  assert.equal(currentShooterQuestion(state).stage, "y");
  answerCorrectly();
  assert.equal(currentShooterTarget(state), null);
  advanceWave();
  assert.equal(state.wave.id, "orientation");

  answerCorrectly();
  answerCorrectly();
  assert.equal(currentShooterTarget(state).id, "negative-b");
  answerCorrectly();
  answerCorrectly();
  advanceWave();
  assert.equal(state.wave.id, "fold");

  answerCorrectly();
  assert.equal(currentShooterQuestion(state).stage, "y");
  answerCorrectly();
  const fold = currentShooterTarget(state);
  assert.equal(fold.rankDropSeen, true);
  assert.equal(fold.hp, 104, "the correct zero tangent diagnoses rank loss but deals no damage");
  assert.equal(currentShooterQuestion(state).stage, "limit");
  assert.equal(currentShooterQuestion(state).choices.find((choice) => choice.correct).label, "(0, 1/2, −1/(2√3))");
  answerCorrectly();
  assert.equal(fold.hp, 104, "the second jet is revealed before the final contraction is answered");
  assert.equal(currentShooterQuestion(state).stage, "lambda");
  assert.equal(currentShooterQuestion(state).choices.find((choice) => choice.correct).label, "−1/6");
  const wrongScalar = currentShooterQuestion(state).choices.find((choice) => !choice.correct);
  applyAnswerHit(state, fold, wrongScalar, currentShooterQuestion(state).expectedProbe);
  assert.equal(fold.hp, 104);
  assert.equal(currentShooterQuestion(state).stage, "lambda");
  answerCorrectly();
  assert.ok(Math.abs(fold.geometry.lambdaV + 1 / 6) < 1e-12);
  advanceWave();
  assert.equal(state.status, "complete");
});

test("the added shooter is a separate playable mode with an explicit calculation contract", () => {
  const root = resolve(import.meta.dirname, "..");
  const index = readFileSync(resolve(root, "index.html"), "utf8");
  const shooter = readFileSync(resolve(root, "shooter.html"), "utf8");
  const renderer = readFileSync(resolve(root, "src", "shooter.js"), "utf8");
  const philosophy = readFileSync(resolve(root, "philosophy.html"), "utf8");

  assert.match(index, /href="\.\/shooter\.html"/);
  for (const requiredText of [
    "DIFFERENTIAL STRIKE",
    "∂<sub>x</sub>P",
    "∂<sub>y</sub>P",
    "√det g = |λ̄|",
    "0 DAMAGE · g<sup>−1</sup> LOCKED",
    "∂<sub>y</sub>²P",
    "At k*=(π,π/3): evaluate",
    "∂<sub>y</sub>n=(0,0,0)",
    "λ̄<sub>y</sub>=½n·(∂<sub>x</sub>n×∂<sub>y</sub>²n)=−1/6",
  ]) {
    assert.ok(shooter.includes(requiredText), `shooter screen should expose: ${requiredText}`);
  }
  assert.ok(renderer.includes("THE DAMAGE IS THE CALCULATION") || shooter.includes("THE DAMAGE IS THE CALCULATION"));
  assert.ok(renderer.includes("drawAnswerChoices"));
  assert.ok(renderer.includes("CORRECT ${event.label}"));
  assert.match(shooter, /id="target-lambda">λ̄=PENDING/);
  assert.match(shooter, /id="target-limit">λ̄<sub>y<\/sub>=PENDING/);
  assert.ok(philosophy.includes("shooter는 “어느 미분이 사라져 역행렬이 막히며 다음 미분이 무엇을 복구하는가”"));
  assert.ok(philosophy.includes("singular curvature 적분 자체를 shooter damage라고 부르지는 않는다"));
});
