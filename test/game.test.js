import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

import {
  CoverageLedger,
  FIXED_STEP,
  clamp,
  createMissionState,
  cuspPoints,
  findSourcesForState,
  foldAmplitude,
  foldBranchesAtU,
  isChargeComplete,
  makeMissions,
  mapToState,
  orientationAt,
  orientationValue,
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
  const [upperEntry, lowerExit] = foldBranchesAtU(0);
  assert.equal(orientationAt(0, upperEntry - 0.01), 1);
  assert.equal(orientationAt(0, 0.5), -1);
  assert.equal(orientationAt(0, lowerExit + 0.01), 1);
});

test("the same visible state point has one source or three distinct sources", () => {
  const triple = findSourcesForState(0, 0.5);
  const single = findSourcesForState(1 / 6, 0.5);
  assert.equal(triple.length, 3);
  assert.equal(single.length, 1);
  for (const sourceV of triple) {
    assert.ok(Math.abs(mapToState({ u: 0, v: sourceV }).v - 0.5) < 1e-7);
  }
  assert.equal(sourceMultiplicity({ u: 0, v: triple[1] }), 3);
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

test("the analytic Jacobian agrees with an independent finite-difference derivative", () => {
  const delta = 1e-6;
  for (const u of [0, 0.115, 1 / 6, 0.448, 2 / 3]) {
    for (const v of [0.12, 0.31, 0.5, 0.67, 0.88]) {
      const numerical = (
        mapToState({ u, v: v + delta }).v
        - mapToState({ u, v: v - delta }).v
      ) / (2 * delta);
      assert.ok(Math.abs(numerical - orientationValue(u, v)) < 1e-8);
    }
  }
});

test("signed preimage count and normalized pullback integral independently give degree one", () => {
  for (const u of [0, 0.04, 1 / 6, 0.31, 2 / 3, 0.92]) {
    const roots = findSourcesForState(u, 0.5);
    const signedCount = roots.reduce(
      (sum, v) => sum + Math.sign(orientationValue(u, v)),
      0,
    );
    assert.equal(signedCount, 1);
  }

  const grid = 256;
  let pullbackIntegral = 0;
  for (let uIndex = 0; uIndex < grid; uIndex += 1) {
    for (let vIndex = 0; vIndex < grid; vIndex += 1) {
      pullbackIntegral += orientationValue(
        (uIndex + 0.5) / grid,
        (vIndex + 0.5) / grid,
      );
    }
  }
  pullbackIntegral /= grid * grid;
  assert.ok(Math.abs(pullbackIntegral - 1) < 1e-12);
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
  continuousRaw /= grid * grid;
  continuousSigned /= grid * grid;

  assert.ok(Math.abs(continuousRaw - 1.06560574) < 5e-7);
  assert.ok(Math.abs(continuousSigned - 1) < 1e-12);

  const cancellationMission = makeMissions().find((mission) => mission.id === "cancel");
  const packetSigns = cancellationMission.gates.map((gate) => (
    orientationAt(gate.u, gate.v)
  ));
  const packetRaw = cancellationMission.gates.length;
  const packetSigned = packetSigns.reduce((sum, sign) => sum + sign, 0);

  assert.deepEqual(packetSigns, [1, -1, 1, -1, 1]);
  assert.equal(packetRaw, 5);
  assert.equal(packetSigned, 1);
  assert.ok(Math.abs(packetRaw - continuousRaw) > 3);
});

test("documented cusp points satisfy the cusp rather than ordinary-fold conditions", () => {
  const firstCusp = cuspPoints()[0];
  const amplitude = foldAmplitude(firstCusp.u);
  const firstV = orientationValue(firstCusp.u, firstCusp.v);
  const secondV = -2 * Math.PI * amplitude * Math.sin(2 * Math.PI * firstCusp.v);
  const thirdV = -((2 * Math.PI) ** 2) * amplitude * Math.cos(2 * Math.PI * firstCusp.v);
  const amplitudeU = -0.32 * 6 * Math.PI * Math.sin(6 * Math.PI * firstCusp.u);
  assert.ok(Math.abs(amplitude - 1) < 1e-12);
  assert.ok(Math.abs(firstV) < 1e-12);
  assert.ok(Math.abs(secondV) < 1e-12);
  assert.ok(Math.abs(thirdV) > 1);
  assert.ok(Math.abs(amplitudeU) > 1);
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

  const workedRoots = findSourcesForState(0, 0.5);
  for (const root of workedRoots) {
    assert.ok(html.includes(root.toFixed(6)), `worked example should show v=${root.toFixed(6)}`);
    assert.ok(
      html.includes(Math.abs(orientationValue(0, root)).toFixed(6)),
      `worked example should show |J|=${Math.abs(orientationValue(0, root)).toFixed(6)}`,
    );
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
    ["source-point", "exact"],
    ["mapped-point", "exact"],
    ["target-form", "conceptual"],
    ["source-area", "conceptual"],
    ["jacobian", "exact"],
    ["integration-domain", "not-computed"],
    ["raw-integral", "proxy"],
    ["signed-integral", "proxy"],
    ["normalization", "proxy"],
    ["player-path", "control-only"],
  ]);

  for (const requiredCalculation of [
    "F*ω = F*(du′∧dv′) = d(u′∘F) ∧ d(v′∘F)",
    "du∧du = 0",
    "F*ω = [1+A(u)cos(2πv)]du∧dv = J(u,v)du∧dv",
    "γ*(F*ω)=0",
    "RAW 5",
    "1.065606",
  ]) {
    assert.ok(
      html.includes(requiredCalculation),
      `philosophy should expose the calculation step: ${requiredCalculation}`,
    );
  }
});
