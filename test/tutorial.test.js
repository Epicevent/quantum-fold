import assert from "node:assert/strict";
import test from "node:test";

import {
  createContinuationState,
  createRunnerState,
  currentContinuationView,
  runnerRootCountGrid,
  selectContinuationNode,
  startContinuation,
  startRunner,
  stepContinuation,
  stepRunner,
} from "../src/trace-mechanics.js";
import {
  continuationTutorialView,
  createTorusTutorialState,
  createTraceTutorialState,
  torusTutorialView,
  updateTorusTutorial,
} from "../src/tutorial.js";
import { createMissionState, makeMissions, stepMission } from "../src/game.js";

function torusScene(overrides = {}) {
  return {
    mission: {
      id: "seam",
      number: "01",
      objective: "Cross the seam and collect all 4 relays",
      hint: "Move",
      gates: [{}, {}, {}, {}],
    },
    collected: [],
    remaining: null,
    ...overrides,
  };
}

function stepUntil(state, predicate, input = { moveX: 0, moveY: 0 }, limit = 12000) {
  for (let index = 0; index < limit; index += 1) {
    if (predicate()) return;
    stepRunner(state, input);
  }
  assert.fail("deterministic runner condition was not reached");
}

test("Torus tutorial orders a same-frame seam crossing before its pickup and banks the actual sign", () => {
  const scene = torusScene();
  const tutorial = createTorusTutorialState("seam");
  assert.equal(torusTutorialView(tutorial, scene).command, "HOLD EAST  →");

  scene.collected = ["seam-1"];
  updateTorusTutorial(tutorial, scene, [
    { type: "wrap", axes: ["u"] },
    { type: "collect", sign: -1, gate: { label: "Relay 1", requiredOrientation: 1 } },
  ]);
  assert.equal(torusTutorialView(tutorial, scene).feedback.title, "SEAM CONNECTED");
  assert.deepEqual(torusTutorialView(tutorial, scene).bankedSigns, [-1]);
  assert.equal(tutorial.authoredSignDiscovery, true);

  updateTorusTutorial(tutorial, scene, [], 0.91);
  assert.equal(torusTutorialView(tutorial, scene).feedback.title, "− BANKED");
  assert.equal(torusTutorialView(tutorial, scene).command, "TOUCH ②");
});

test("the authored first relay cannot be collected before the visible seam wrap", () => {
  const game = createMissionState(0, makeMissions());
  const eventTypes = [];
  for (let frame = 0; frame < 2400 && game.collected.length === 0; frame += 1) {
    stepMission(game, { x: 1, y: 0, pulse: false });
    eventTypes.push(...game.events.map((event) => event.type));
  }
  assert.equal(game.collected[0], "seam-1");
  assert.ok(eventTypes.includes("wrap"));
  assert.ok(eventTypes.indexOf("wrap") < eventTypes.indexOf("collect"));
});

test("Continuation Strike leaves the first decision untimed, then starts the clock after one correct beam", () => {
  const state = createContinuationState();
  const tutorial = createTraceTutorialState("continuation");
  startContinuation(state);
  const openingTime = state.timeLeft;
  for (let frame = 0; frame < 600; frame += 1) stepContinuation(state);
  assert.equal(state.timeLeft, openingTime);

  const view = currentContinuationView(state);
  const guide = continuationTutorialView(tutorial, state, view);
  assert.equal(guide.command, "CLICK ANY ROOT ON THE LEFT");
  const id = view.task.shared[0];
  selectContinuationNode(state, "previous", id);
  assert.equal(continuationTutorialView(tutorial, state, view).command, `CLICK ${id} ON THE RIGHT`);
  selectContinuationNode(state, "current", id);
  stepContinuation(state);
  assert.ok(state.timeLeft < openingTime);
});

test("Sheet Runner gives one Preserve rewind, restores one root, then judges the repeated crossing", () => {
  const state = createRunnerState();
  startRunner(state);
  stepUntil(state, () => state.inputLock === 0, { moveX: 0, moveY: 0 }, 300);
  stepUntil(state, () => state.events.some((event) => event.type === "runner-grace"), { moveX: 1, moveY: 0 });
  assert.equal(state.integrity, 3);
  assert.equal(state.roots.length, 1);
  assert.equal(state.everTriple, false);
  assert.equal(state.graceAvailable, false);
  assert.ok(state.inputLock > 0);

  stepUntil(state, () => state.inputLock === 0, { moveX: 0, moveY: 0 }, 300);
  stepUntil(state, () => state.events.some((event) => event.type === "runner-fail"), { moveX: 1, moveY: 0 });
  assert.equal(state.integrity, 2);
});

test("the cached runner risk grid distinguishes one-root and three-root cells", () => {
  const first = runnerRootCountGrid(24, 24);
  const second = runnerRootCountGrid(24, 24);
  assert.equal(first, second);
  assert.ok(first.cells.some((cell) => cell.count === 1));
  assert.ok(first.cells.some((cell) => cell.count === 3));
});
