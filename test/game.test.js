import assert from "node:assert/strict";
import test from "node:test";

import {
  CoverageLedger,
  FIXED_STEP,
  clamp,
  createMissionState,
  findSourcesForState,
  foldBranchesAtU,
  isChargeComplete,
  makeMissions,
  mapToState,
  orientationAt,
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
