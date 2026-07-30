import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

import {
  MODE_CONTINUATION,
  MODE_RUNNER,
  continuationEvidence,
  continuationScenarios,
  createContinuationState,
  createRunnerState,
  currentContinuationView,
  meridianClosedFormRoots,
  rawMultiplicityAt,
  runnerEvidence,
  runnerStages,
  selectContinuationNode,
  startContinuation,
  startRunner,
  stepContinuation,
  stepRunner,
  tagRunnerRoot,
} from "../src/trace-mechanics.js";
import { periodicDistance, sourceFromBZ } from "../src/game.js";
import { SINGULARITY_IDS } from "../src/singularity-types.js";

function solveContinuationTask(state) {
  for (const id of state.task.shared) {
    selectContinuationNode(state, "previous", id);
    selectContinuationNode(state, "current", id);
  }
  if (state.task.pairIds.length === 2) {
    selectContinuationNode(state, state.task.pairLayer, state.task.pairIds[0]);
    selectContinuationNode(state, state.task.pairLayer, state.task.pairIds[1]);
  }
}

function stepUntil(state, predicate, limit = 2000) {
  for (let index = 0; index < limit; index += 1) {
    if (predicate()) return;
    if (state.mode === MODE_CONTINUATION) stepContinuation(state);
    else stepRunner(state, { moveX: 0, moveY: 0 });
  }
  assert.fail("condition did not become true within the deterministic step limit");
}

function driveRunnerToward(state, target, limit = 12000) {
  for (let index = 0; index < limit; index += 1) {
    const deltaA = target.a - state.coordinate.a;
    const deltaB = target.b - state.coordinate.b;
    if (Math.hypot(deltaA, deltaB) < 0.00055) return;
    stepRunner(state, {
      moveX: Math.abs(deltaB) < 0.00025 ? 0 : Math.sign(deltaB),
      moveY: Math.abs(deltaA) < 0.00025 ? 0 : -Math.sign(deltaA),
    });
    if (state.status !== "playing" || state.stageDelay !== null) return;
  }
  assert.fail("runner did not reach the waypoint");
}

test("the meridian uses the paper map's exact 3-to-1 fold roots", () => {
  const scenarios = continuationScenarios();
  const fold = scenarios.find((scenario) => scenario.id === "fold");
  assert.deepEqual(fold.frames.map((frame) => frame.roots.length), [3, 3, 3, 3, 1, 1]);
  assert.deepEqual(fold.frames.map((frame) => frame.signedMultiplicity), [1, 1, 1, 1, 1, 1]);

  const analytic = meridianClosedFormRoots(29.9);
  const numerical = fold.frames.find((frame) => frame.parameter === 29.9).roots;
  assert.equal(analytic.length, numerical.length);
  for (const root of analytic) {
    const source = sourceFromBZ(root.kx, root.ky);
    assert.ok(numerical.some((candidate) => periodicDistance(source, candidate.source) < 1e-8));
  }
  const foldPair = fold.frames[3].roots.filter((root) => !fold.frames[4].roots.some((next) => next.id === root.id));
  assert.deepEqual(foldPair.map((root) => root.sign).sort(), [-1, 1]);
  assert.ok(foldPair.every((root) => Math.abs(root.lambda) < 0.015));
});

test("the cusp trace preserves provenance and exchanges the survivor", () => {
  const cusp = continuationScenarios().find((scenario) => scenario.id === "cusp");
  assert.equal(cusp.geometry.featuredEntityId, SINGULARITY_IDS.CUSP_ON_FOLD_CURVE);
  assert.equal(cusp.geometry.encounter.point.id, SINGULARITY_IDS.ORDINARY_FOLD_POINT);
  assert.equal(cusp.geometry.encounter.locus.dimension, 1);
  assert.equal(cusp.geometry.encounter.cuspPointHit, false);
  assert.deepEqual(cusp.frames.map((frame) => frame.roots.length), [1, 1, 3, 3, 3, 1, 1]);
  const initialId = cusp.frames[0].roots[0].id;
  const bornIds = cusp.frames[2].born.map((root) => root.id);
  const diedIds = cusp.frames[5].died.map((root) => root.id);
  const finalId = cusp.frames.at(-1).roots[0].id;

  assert.equal(initialId, "S0");
  assert.notEqual(finalId, initialId);
  assert.ok(bornIds.includes(finalId), "the final survivor must be born at the first fold");
  assert.ok(diedIds.includes(initialId), "the original sheet must die at the second fold");
  assert.equal(cusp.frames.at(-1).signedMultiplicity, 1);
  assert.ok(cusp.frames.every((frame) => frame.roots.every((root) => root.residual < 1e-8)));
});

test("stable IDs survive a torus seam instead of being renumbered by coordinates", () => {
  const seam = continuationScenarios().find((scenario) => scenario.id === "seam");
  let wrappedIdentity = false;
  for (let index = 1; index < seam.frames.length; index += 1) {
    const before = seam.frames[index - 1];
    const after = seam.frames[index];
    for (const root of before.roots) {
      const next = after.roots.find((candidate) => candidate.id === root.id);
      if (next && Math.abs(root.k.kx - next.k.kx) > Math.PI) wrappedIdentity = true;
    }
  }
  assert.equal(wrappedIdentity, true);
  assert.equal(new Set(seam.frames.flatMap((frame) => frame.roots.map((root) => root.id))).size, 3);
});

test("Continuation Strike completes only after edges and fold parentage are both supplied", () => {
  const state = createContinuationState();
  startContinuation(state);
  assert.equal(state.mode, MODE_CONTINUATION);
  assert.equal(state.status, "playing");

  const opening = currentContinuationView(state);
  const wrongCurrent = opening.current.roots.find((root) => root.id !== opening.previous.roots[0].id);
  selectContinuationNode(state, "previous", opening.previous.roots[0].id);
  selectContinuationNode(state, "current", wrongCurrent.id);
  assert.deepEqual(state.solvedEdges, []);

  for (let guard = 0; guard < 100; guard += 1) {
    solveContinuationTask(state);
    stepUntil(state, () => state.advanceDelay === null || state.status !== "playing", 200);
    if (state.status === "complete") break;
  }
  assert.equal(state.status, "complete");
  assert.equal(state.receipts.length, 16);
  assert.ok(state.receipts.some((receipt) => receipt.died.length === 2));
  assert.ok(state.receipts.some((receipt) => receipt.born.length === 2));
  assert.ok(state.receipts.every((receipt) => receipt.signedBefore === 1 && receipt.signedAfter === 1));
  const singularReceipts = state.receipts.filter((receipt) => receipt.singularity);
  assert.ok(singularReceipts.length >= 3);
  assert.ok(singularReceipts.every((receipt) => (
    receipt.singularity.locus.dimension === 1
    && receipt.singularity.point.id === SINGULARITY_IDS.ORDINARY_FOLD_POINT
    && receipt.singularity.cuspPointHit === false
  )));
});

test("Continuation Strike fixed-step replay is deterministic", () => {
  const left = createContinuationState();
  const right = createContinuationState();
  startContinuation(left);
  startContinuation(right);
  for (const state of [left, right]) {
    const id = state.task.shared[0];
    selectContinuationNode(state, "previous", id);
    selectContinuationNode(state, "current", id);
  }
  for (let frame = 0; frame < 400; frame += 1) {
    stepContinuation(left);
    stepContinuation(right);
  }
  assert.deepEqual(continuationEvidence(left), continuationEvidence(right));
  assert.deepEqual(left.receipts, right.receipts);
});

test("the cusp chart has one, three, one roots with signed sum one", () => {
  assert.deepEqual(rawMultiplicityAt(0.04, -0.012), { count: 1, signs: [1], signed: 1 });
  const inside = rawMultiplicityAt(0.04, 0);
  assert.equal(inside.count, 3);
  assert.deepEqual([...inside.signs].sort(), [-1, 1, 1]);
  assert.equal(inside.signed, 1);
  assert.deepEqual(rawMultiplicityAt(0.04, 0.012), { count: 1, signs: [1], signed: 1 });
});

test("runner stages distinguish the cusp feature from ordinary fold crossings", () => {
  const [preserve, forge, exchange] = runnerStages();
  assert.equal(preserve.geometry.featuredEntityId, SINGULARITY_IDS.CUSP_ON_FOLD_CURVE);
  assert.equal(preserve.geometry.encounter.point.id, SINGULARITY_IDS.ORDINARY_FOLD_POINT);
  assert.equal(preserve.geometry.expectedEncounterCount, 0);
  for (const stage of [forge, exchange]) {
    assert.equal(stage.geometry.featuredEntityId, SINGULARITY_IDS.CUSP_ON_FOLD_CURVE);
    assert.equal(stage.geometry.encounter.point.id, SINGULARITY_IDS.ORDINARY_FOLD_POINT);
    assert.equal(stage.geometry.encounter.cuspPointHit, false);
  }
  assert.equal(forge.geometry.expectedEncounterCount, 1);
  assert.equal(exchange.geometry.expectedEncounterCount, 2);
});

test("Sheet Runner Preserve, Forge, and Exchange contracts are all achievable", () => {
  const state = createRunnerState();
  startRunner(state);
  assert.equal(state.mode, MODE_RUNNER);

  driveRunnerToward(state, { a: -0.012, b: -0.014 });
  driveRunnerToward(state, { a: -0.012, b: 0.014 });
  driveRunnerToward(state, { a: 0.04, b: 0.014 });
  stepUntil(state, () => state.stageIndex === 1, 400);
  assert.equal(state.receipts[0].stage, "preserve");
  assert.equal(state.receipts[0].initialId, state.receipts[0].finalId);
  assert.deepEqual(state.receipts[0].singularEncounters, []);

  for (let guard = 0; guard < 9000 && state.stageDelay === null; guard += 1) {
    stepRunner(state, { moveX: 1, moveY: 0 });
    if (state.lastBornPair.length === 2 && !state.pairTagged) {
      tagRunnerRoot(state, state.lastBornPair[0]);
      tagRunnerRoot(state, state.lastBornPair[1]);
    }
  }
  stepUntil(state, () => state.stageIndex === 2, 400);
  assert.equal(state.receipts[1].stage, "forge");
  assert.equal(state.receipts[1].pairTagged, true);
  assert.ok(state.receipts[1].singularEncounters.every((event) => (
    event.singularity.point.id === SINGULARITY_IDS.ORDINARY_FOLD_POINT
  )));

  for (let guard = 0; guard < 12000 && state.stageDelay === null; guard += 1) {
    stepRunner(state, { moveX: 1, moveY: 0 });
    if (state.roots.length === 3 && !state.pairTagged) {
      const negative = state.roots.find((root) => root.sign < 0);
      tagRunnerRoot(state, state.initialId);
      tagRunnerRoot(state, negative.id);
    }
  }
  stepUntil(state, () => state.status === "complete", 500);
  const exchange = state.receipts[2];
  assert.equal(exchange.stage, "exchange");
  assert.notEqual(exchange.finalId, exchange.initialId);
  assert.equal(exchange.signedMultiplicity, 1);
  assert.ok(exchange.singularEncounters.every((event) => (
    event.singularity.point.id === SINGULARITY_IDS.ORDINARY_FOLD_POINT
    && event.singularity.cuspPointHit === false
  )));
});

test("a direct Preserve route fails because it enters the three-sheet region", () => {
  const state = createRunnerState();
  startRunner(state);
  for (let frame = 0; frame < 5000 && state.stageDelay === null; frame += 1) {
    stepRunner(state, { moveX: 1, moveY: 0 });
  }
  assert.equal(state.integrity, 2);
  assert.equal(state.receipts.length, 0);
  assert.ok(state.events.some((event) => event.type === "runner-fail" && event.reason === "entered-three-sheet-region"));
  const forbiddenCrossing = state.events.find((event) => event.type === "runner-pair-born");
  assert.equal(forbiddenCrossing.singularity.point.id, SINGULARITY_IDS.ORDINARY_FOLD_POINT);
  assert.equal(forbiddenCrossing.singularity.locus.dimension, 1);
});

test("Sheet Runner fixed-step replay and root continuation are deterministic", () => {
  const left = createRunnerState();
  const right = createRunnerState();
  startRunner(left);
  startRunner(right);
  for (let frame = 0; frame < 900; frame += 1) {
    const input = frame < 240
      ? { moveX: 0, moveY: 1 }
      : frame < 600
        ? { moveX: 1, moveY: 0 }
        : { moveX: 0, moveY: -1 };
    stepRunner(left, input);
    stepRunner(right, input);
  }
  assert.deepEqual(runnerEvidence(left), runnerEvidence(right));
  assert.deepEqual(left.receipts, right.receipts);
  assert.deepEqual(left.history, right.history);
});

test("trace simulation is separated from effects and the browser exposes both modes", () => {
  const root = resolve(import.meta.dirname, "..");
  const mechanics = readFileSync(resolve(root, "src", "trace-mechanics.js"), "utf8");
  const renderer = readFileSync(resolve(root, "src", "trace-game.js"), "utf8");
  const html = readFileSync(resolve(root, "shooter.html"), "utf8");

  assert.doesNotMatch(mechanics, /document\.|canvas|getContext|AudioContext|Math\.random/);
  assert.match(renderer, /createContinuationState/);
  assert.match(renderer, /createRunnerState/);
  assert.match(html, /data-start-mode="continuation"/);
  assert.match(html, /data-start-mode="runner"/);
  assert.match(html, /id="root-ledger"/);
  assert.match(html, /id="trace-receipt"/);
  assert.match(html, /id="formula-geometry"/);
  assert.match(html, /isolated branch point/);
  assert.match(renderer, /drawDomainCuspPoints/);
  assert.match(renderer, /CUSP VALUE · ONE POINT ON f\(Σ\)/);
});
