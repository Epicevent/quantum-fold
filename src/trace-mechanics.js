import {
  FIXED_STEP,
  TAU,
  bzCoordinates,
  clamp,
  findSourcesForState,
  mapToState,
  periodicDistance,
  signedAreaDensity,
  sourceFromBZ,
  stateDistance,
} from "./game.js";

export const TRACE_STEP = FIXED_STEP;
export const MODE_CONTINUATION = "continuation";
export const MODE_RUNNER = "runner";

const ROOT_TOLERANCE = 1e-6;
const CUSP_Q = normalize({ x: -1, y: -1, z: -1 });
const CUSP_A = normalize({ x: 1, y: 1, z: -2 });
const CUSP_B = normalize({ x: 1, y: -1, z: 0 });

function normalize(vector) {
  const length = Math.hypot(vector.x, vector.y, vector.z) || 1;
  return { x: vector.x / length, y: vector.y / length, z: vector.z / length };
}

function dot(left, right) {
  return left.x * right.x + left.y * right.y + left.z * right.z;
}

function rounded(value, digits = 9) {
  return Number(value.toFixed(digits));
}

function sameMembers(left, right) {
  if (left.length !== right.length) return false;
  const orderedLeft = [...left].sort();
  const orderedRight = [...right].sort();
  return orderedLeft.every((value, index) => value === orderedRight[index]);
}

function permutations(values) {
  if (values.length <= 1) return [values];
  const result = [];
  for (let index = 0; index < values.length; index += 1) {
    const head = values[index];
    const tail = values.filter((_, candidate) => candidate !== index);
    for (const rest of permutations(tail)) result.push([head, ...rest]);
  }
  return result;
}

function combinations(values, count, start = 0, prefix = [], result = []) {
  if (prefix.length === count) {
    result.push([...prefix]);
    return result;
  }
  for (let index = start; index < values.length; index += 1) {
    prefix.push(values[index]);
    combinations(values, count, index + 1, prefix, result);
    prefix.pop();
  }
  return result;
}

function minimumContinuation(previous, current) {
  if (!previous.length || !current.length) return [];
  let best = null;
  let bestCost = Infinity;

  if (previous.length <= current.length) {
    const currentIndices = current.map((_, index) => index);
    for (const subset of combinations(currentIndices, previous.length)) {
      for (const order of permutations(subset)) {
        const matches = previous.map((_, index) => ({ previous: index, current: order[index] }));
        const cost = matches.reduce((sum, match) => (
          sum + periodicDistance(previous[match.previous].source, current[match.current].source)
        ), 0);
        if (cost < bestCost) {
          bestCost = cost;
          best = matches;
        }
      }
    }
  } else {
    const previousIndices = previous.map((_, index) => index);
    for (const subset of combinations(previousIndices, current.length)) {
      for (const order of permutations(subset)) {
        const matches = current.map((_, index) => ({ previous: order[index], current: index }));
        const cost = matches.reduce((sum, match) => (
          sum + periodicDistance(previous[match.previous].source, current[match.current].source)
        ), 0);
        if (cost < bestCost) {
          bestCost = cost;
          best = matches;
        }
      }
    }
  }
  return best ?? [];
}

function rawRootsForTarget(target, samples = 160) {
  return findSourcesForState(target, samples).map((source) => {
    const lambda = signedAreaDensity(source.u, source.v);
    const mapped = mapToState(source);
    return {
      source: { u: source.u, v: source.v },
      k: bzCoordinates(source),
      lambda,
      sign: Math.abs(lambda) < ROOT_TOLERANCE ? 0 : Math.sign(lambda),
      residual: stateDistance(mapped, target),
    };
  });
}

function continueRoots(previous, rawCurrent, nextId) {
  const current = rawCurrent.map((root) => ({ ...root, id: null, bornAt: null }));
  const matches = minimumContinuation(previous, current);
  const matchedPrevious = new Set();
  const matchedCurrent = new Set();

  for (const match of matches) {
    const before = previous[match.previous];
    const after = current[match.current];
    after.id = before.id;
    after.bornAt = before.bornAt;
    matchedPrevious.add(match.previous);
    matchedCurrent.add(match.current);
  }

  let cursor = nextId;
  for (let index = 0; index < current.length; index += 1) {
    if (matchedCurrent.has(index)) continue;
    current[index].id = `S${cursor}`;
    current[index].bornAt = cursor;
    cursor += 1;
  }

  const born = current.filter((_, index) => !matchedCurrent.has(index));
  const died = previous.filter((_, index) => !matchedPrevious.has(index));
  const edges = matches.map((match) => ({
    id: current[match.current].id,
    from: previous[match.previous].source,
    to: current[match.current].source,
  }));

  return { roots: current, born, died, edges, nextId: cursor };
}

function firstRoots(target, samples = 160) {
  const roots = rawRootsForTarget(target, samples).map((root, index) => ({
    ...root,
    id: `S${index}`,
    bornAt: 0,
  }));
  return { roots, nextId: roots.length };
}

export function meridianTarget(degrees) {
  const theta = degrees * Math.PI / 180;
  return { x: Math.sin(theta), y: 0, z: -Math.cos(theta) };
}

export function cuspTarget(a, b) {
  return normalize({
    x: CUSP_Q.x + a * CUSP_A.x + b * CUSP_B.x,
    y: CUSP_Q.y + a * CUSP_A.y + b * CUSP_B.y,
    z: CUSP_Q.z + a * CUSP_A.z + b * CUSP_B.z,
  });
}

function traceFrames(targetEntries) {
  let previous = [];
  let nextId = 0;
  return targetEntries.map((entry, index) => {
    const target = entry.target;
    const tracked = index === 0
      ? firstRoots(target)
      : continueRoots(previous, rawRootsForTarget(target), nextId);
    nextId = tracked.nextId;
    const frame = {
      ...entry,
      roots: tracked.roots,
      born: tracked.born ?? tracked.roots,
      died: tracked.died ?? [],
      edges: tracked.edges ?? [],
      signedMultiplicity: tracked.roots.reduce((sum, root) => sum + root.sign, 0),
    };
    previous = tracked.roots;
    return frame;
  });
}

export function continuationScenarios() {
  return [
    {
      id: "fold",
      number: "A1",
      kicker: "ORDINARY FOLD",
      title: "Track the +/− pair that actually disappears",
      brief: "The target follows q(θ). Connect equal sheet IDs, then lock B⁺ and C⁻ as the death pair.",
      formula: "q(θ)=(sin θ,0,−cos θ) · θ:20°→35°",
      frames: traceFrames([20, 25, 29, 29.9, 30.1, 35].map((theta) => ({
        label: `θ=${theta}°`,
        parameter: theta,
        target: meridianTarget(theta),
      }))),
    },
    {
      id: "seam",
      number: "A2",
      kicker: "TORUS SEAM",
      title: "Keep an ID when its coordinate wraps",
      brief: "A source can jump from +π to −π on the drawing without changing sheet identity. Follow continuation, not sorting.",
      formula: "q(θ)=(sin θ,0,−cos θ) · θ:−8°→8°",
      frames: traceFrames([-8, -4, -0.5, 0.5, 4, 8].map((theta) => ({
        label: `θ=${theta}°`,
        parameter: theta,
        target: meridianTarget(theta),
      }))),
    },
    {
      id: "cusp",
      number: "A3",
      kicker: "CUSP EXCHANGE",
      title: "Prove that the final survivor is a new sheet",
      brief: "Count stays 1→3→1. Only the trace reveals S₀⁺ dies while the newly born positive sheet survives.",
      formula: "q(A,B)=normalize(qc+A eA+B eB) · A=0.04",
      frames: traceFrames([-0.012, -0.006, -0.005, 0, 0.005, 0.006, 0.012].map((b) => ({
        label: `B=${b.toFixed(3)}`,
        parameter: b,
        target: cuspTarget(0.04, b),
      }))),
    },
  ];
}

function taskForTransition(previous, current) {
  const currentIds = new Set(current.roots.map((root) => root.id));
  const previousIds = new Set(previous.roots.map((root) => root.id));
  const shared = previous.roots.filter((root) => currentIds.has(root.id)).map((root) => root.id);
  const born = current.roots.filter((root) => !previousIds.has(root.id)).map((root) => root.id);
  const died = previous.roots.filter((root) => !currentIds.has(root.id)).map((root) => root.id);
  return {
    shared,
    born,
    died,
    pairLayer: born.length === 2 ? "current" : died.length === 2 ? "previous" : null,
    pairIds: born.length === 2 ? born : died.length === 2 ? died : [],
  };
}

function loadContinuationTransition(state) {
  const scenario = state.scenarios[state.scenarioIndex];
  const previous = scenario.frames[state.transitionIndex - 1];
  const current = scenario.frames[state.transitionIndex];
  state.task = taskForTransition(previous, current);
  state.solvedEdges = [];
  state.pairSolved = state.task.pairIds.length === 0;
  state.selected = null;
  state.timeLeft = scenario.id === "cusp" ? 36 : 28;
  state.advanceDelay = null;
}

export function createContinuationState() {
  const state = {
    mode: MODE_CONTINUATION,
    status: "ready",
    elapsed: 0,
    score: 0,
    combo: 0,
    integrity: 3,
    scenarios: continuationScenarios(),
    scenarioIndex: 0,
    transitionIndex: 1,
    task: null,
    solvedEdges: [],
    pairSolved: false,
    selected: null,
    timeLeft: 10,
    advanceDelay: null,
    events: [],
    receipts: [],
  };
  loadContinuationTransition(state);
  return state;
}

export function startContinuation(state) {
  if (state.status === "ready") {
    state.status = "playing";
    state.events.push({ type: "start", mode: state.mode });
  }
  return state;
}

function continuationTaskComplete(state) {
  return state.task.shared.every((id) => state.solvedEdges.includes(id)) && state.pairSolved;
}

function resolveContinuationSelection(state, first, second) {
  if (first.layer !== second.layer) {
    const previousId = first.layer === "previous" ? first.id : second.id;
    const currentId = first.layer === "current" ? first.id : second.id;
    if (previousId === currentId && state.task.shared.includes(previousId) && !state.solvedEdges.includes(previousId)) {
      state.solvedEdges.push(previousId);
      state.combo += 1;
      const gain = 100 + state.combo * 25;
      state.score += gain;
      state.events.push({ type: "edge-correct", id: previousId, gain });
    } else {
      state.combo = 0;
      state.events.push({ type: "edge-wrong", previousId, currentId });
    }
  } else if (
    first.layer === state.task.pairLayer
    && sameMembers([first.id, second.id], state.task.pairIds)
  ) {
    state.pairSolved = true;
    state.combo += 1;
    const gain = 220 + state.combo * 35;
    state.score += gain;
    state.events.push({
      type: state.task.pairLayer === "current" ? "pair-born" : "pair-died",
      ids: [...state.task.pairIds],
      gain,
    });
  } else {
    state.combo = 0;
    state.events.push({ type: "pair-wrong", ids: [first.id, second.id] });
  }

  if (continuationTaskComplete(state) && state.advanceDelay === null) {
    const scenario = state.scenarios[state.scenarioIndex];
    const previous = scenario.frames[state.transitionIndex - 1];
    const current = scenario.frames[state.transitionIndex];
    state.receipts.push({
      scenario: scenario.id,
      from: previous.label,
      to: current.label,
      shared: [...state.task.shared],
      born: [...state.task.born],
      died: [...state.task.died],
      signedBefore: previous.signedMultiplicity,
      signedAfter: current.signedMultiplicity,
    });
    state.advanceDelay = 0.62;
    state.events.push({ type: "transition-clear", scenario: scenario.id });
  }
}

export function selectContinuationNode(state, layer, id) {
  if (state.status !== "playing" || state.advanceDelay !== null) return state;
  const scenario = state.scenarios[state.scenarioIndex];
  const frame = layer === "previous"
    ? scenario.frames[state.transitionIndex - 1]
    : scenario.frames[state.transitionIndex];
  if (!frame.roots.some((root) => root.id === id)) return state;
  const candidate = { layer, id };
  if (!state.selected) {
    state.selected = candidate;
    state.events.push({ type: "node-armed", layer, id });
    return state;
  }
  if (state.selected.layer === layer && state.selected.id === id) {
    state.selected = null;
    return state;
  }
  const first = state.selected;
  state.selected = null;
  resolveContinuationSelection(state, first, candidate);
  return state;
}

function advanceContinuation(state) {
  const scenario = state.scenarios[state.scenarioIndex];
  state.transitionIndex += 1;
  if (state.transitionIndex < scenario.frames.length) {
    loadContinuationTransition(state);
    return;
  }
  state.events.push({ type: "scenario-clear", scenario: scenario.id });
  state.scenarioIndex += 1;
  if (state.scenarioIndex >= state.scenarios.length) {
    state.status = "complete";
    state.events.push({ type: "complete", mode: state.mode, score: state.score });
    return;
  }
  state.transitionIndex = 1;
  loadContinuationTransition(state);
}

export function stepContinuation(state, dt = TRACE_STEP) {
  if (state.status !== "playing") return state;
  state.elapsed += dt;
  if (state.advanceDelay !== null) {
    state.advanceDelay -= dt;
    if (state.advanceDelay <= 0) advanceContinuation(state);
    return state;
  }
  state.timeLeft -= dt;
  if (state.timeLeft <= 0) {
    state.integrity -= 1;
    state.combo = 0;
    state.events.push({ type: "timeout", integrity: state.integrity });
    if (state.integrity <= 0) {
      state.status = "failed";
      return state;
    }
    loadContinuationTransition(state);
  }
  return state;
}

export function currentContinuationView(state) {
  const scenario = state.scenarios[state.scenarioIndex];
  if (!scenario) return null;
  return {
    scenario,
    previous: scenario.frames[state.transitionIndex - 1],
    current: scenario.frames[state.transitionIndex],
    task: state.task,
  };
}

export function continuationEvidence(state) {
  const view = currentContinuationView(state);
  return {
    status: state.status,
    scenario: view?.scenario.id ?? "complete",
    transitionIndex: state.transitionIndex,
    score: state.score,
    combo: state.combo,
    integrity: state.integrity,
    timeLeft: rounded(state.timeLeft, 6),
    solvedEdges: [...state.solvedEdges],
    pairSolved: state.pairSolved,
    receiptCount: state.receipts.length,
  };
}

const RUNNER_STAGES = [
  {
    id: "preserve",
    number: "B1",
    kicker: "PRESERVE",
    title: "Carry S₀ around the cusp lobe",
    brief: "Reach the right gate without ever entering the three-root region.",
    start: { a: 0.04, b: -0.014 },
    goal: { a: 0.04, b: 0.014 },
    goalRadius: 0.0034,
    time: 34,
  },
  {
    id: "forge",
    number: "B2",
    kicker: "PAIR BIRTH",
    title: "Enter the lobe and tag the newborn +/− pair",
    brief: "Cross the first fold, then strike the two roots that were born together.",
    start: { a: 0.04, b: -0.014 },
    goal: { a: 0.04, b: 0 },
    goalRadius: 0.004,
    time: 30,
  },
  {
    id: "exchange",
    number: "B3",
    kicker: "SURVIVOR EXCHANGE",
    title: "Make the newborn positive sheet survive",
    brief: "Inside the lobe, tag S₀⁺ with S⁻ as the future death pair, then exit through the opposite fold.",
    start: { a: 0.04, b: -0.014 },
    goal: { a: 0.04, b: 0.014 },
    goalRadius: 0.0034,
    time: 38,
  },
];

export function runnerStages() {
  return RUNNER_STAGES.map((stage) => ({
    ...stage,
    start: { ...stage.start },
    goal: { ...stage.goal },
  }));
}

function initializeRunnerStage(state) {
  const stage = state.stages[state.stageIndex];
  state.coordinate = { ...stage.start };
  state.velocity = { a: 0, b: 0 };
  const tracked = firstRoots(cuspTarget(stage.start.a, stage.start.b), 192);
  state.roots = tracked.roots;
  state.nextId = tracked.nextId;
  state.initialId = state.roots[0]?.id ?? null;
  state.selectedRoots = [];
  state.pairTagged = false;
  state.lastBornPair = [];
  state.lastDiedPair = [];
  state.everTriple = false;
  state.timeLeft = stage.time;
  state.stageDelay = null;
  state.history = [{
    a: state.coordinate.a,
    b: state.coordinate.b,
    roots: state.roots.map((root) => ({ id: root.id, source: { ...root.source }, sign: root.sign })),
  }];
  state.historyClock = 0;
}

export function createRunnerState() {
  const state = {
    mode: MODE_RUNNER,
    status: "ready",
    elapsed: 0,
    score: 0,
    combo: 0,
    integrity: 3,
    stages: runnerStages(),
    stageIndex: 0,
    coordinate: { a: 0.04, b: -0.014 },
    velocity: { a: 0, b: 0 },
    roots: [],
    nextId: 0,
    initialId: null,
    selectedRoots: [],
    pairTagged: false,
    lastBornPair: [],
    lastDiedPair: [],
    everTriple: false,
    timeLeft: 34,
    stageDelay: null,
    history: [],
    historyClock: 0,
    events: [],
    receipts: [],
  };
  initializeRunnerStage(state);
  return state;
}

export function startRunner(state) {
  if (state.status === "ready") {
    state.status = "playing";
    state.events.push({ type: "start", mode: state.mode });
  }
  return state;
}

function failRunnerStage(state, reason) {
  if (state.stageDelay !== null || state.status !== "playing") return;
  state.integrity -= 1;
  state.combo = 0;
  state.stageDelay = 1.05;
  state.events.push({ type: "runner-fail", reason, integrity: state.integrity });
  if (state.integrity <= 0) state.status = "failed";
}

function runnerExpectedPair(state) {
  const stage = state.stages[state.stageIndex];
  if (stage.id === "forge") return state.lastBornPair;
  if (stage.id === "exchange") {
    const negative = state.roots.find((root) => root.sign < 0);
    return negative && state.initialId ? [state.initialId, negative.id] : [];
  }
  return [];
}

export function tagRunnerRoot(state, id) {
  if (state.status !== "playing" || state.stageDelay !== null) return state;
  if (!state.roots.some((root) => root.id === id)) return state;
  if (state.selectedRoots.includes(id)) {
    state.selectedRoots = state.selectedRoots.filter((candidate) => candidate !== id);
    return state;
  }
  state.selectedRoots.push(id);
  state.events.push({ type: "runner-root-armed", id });
  if (state.selectedRoots.length < 2) return state;

  const expected = runnerExpectedPair(state);
  if (expected.length === 2 && sameMembers(state.selectedRoots, expected)) {
    state.pairTagged = true;
    state.combo += 1;
    const gain = 450 + state.combo * 75;
    state.score += gain;
    state.events.push({ type: "runner-pair-correct", ids: [...expected], gain });
  } else {
    state.combo = 0;
    state.events.push({ type: "runner-pair-wrong", ids: [...state.selectedRoots] });
  }
  state.selectedRoots = [];
  return state;
}

function updateRunnerRoots(state) {
  const target = cuspTarget(state.coordinate.a, state.coordinate.b);
  const tracked = continueRoots(state.roots, rawRootsForTarget(target, 96), state.nextId);
  state.roots = tracked.roots;
  state.nextId = tracked.nextId;
  if (tracked.born.length === 2) {
    state.lastBornPair = tracked.born.map((root) => root.id);
    state.everTriple = true;
    state.events.push({
      type: "runner-pair-born",
      ids: [...state.lastBornPair],
      signs: tracked.born.map((root) => root.sign),
    });
  }
  if (tracked.died.length === 2) {
    state.lastDiedPair = tracked.died.map((root) => root.id);
    state.events.push({
      type: "runner-pair-died",
      ids: [...state.lastDiedPair],
      signs: tracked.died.map((root) => root.sign),
    });
  }
}

function runnerGoalReached(state) {
  const stage = state.stages[state.stageIndex];
  return Math.hypot(
    state.coordinate.a - stage.goal.a,
    state.coordinate.b - stage.goal.b,
  ) <= stage.goalRadius;
}

function clearRunnerStage(state) {
  const stage = state.stages[state.stageIndex];
  const finalId = state.roots[0]?.id ?? null;
  state.receipts.push({
    stage: stage.id,
    initialId: state.initialId,
    finalId,
    everTriple: state.everTriple,
    bornPair: [...state.lastBornPair],
    diedPair: [...state.lastDiedPair],
    pairTagged: state.pairTagged,
    signedMultiplicity: state.roots.reduce((sum, root) => sum + root.sign, 0),
  });
  state.score += 900 + Math.round(state.timeLeft * 20);
  state.events.push({ type: "runner-stage-clear", stage: stage.id, finalId });
  state.stageDelay = 1.1;
}

function evaluateRunnerStage(state) {
  const stage = state.stages[state.stageIndex];
  if (stage.id === "preserve" && state.roots.length > 1) {
    failRunnerStage(state, "entered-three-sheet-region");
    return;
  }
  if (!runnerGoalReached(state)) return;

  if (stage.id === "preserve") {
    if (!state.everTriple && state.roots.length === 1 && state.roots[0].id === state.initialId) {
      clearRunnerStage(state);
    } else {
      failRunnerStage(state, "provenance-not-preserved");
    }
    return;
  }

  if (stage.id === "forge") {
    if (state.roots.length === 3 && state.everTriple && state.pairTagged) {
      clearRunnerStage(state);
    }
    return;
  }

  const finalId = state.roots[0]?.id ?? null;
  if (
    stage.id === "exchange"
    && state.roots.length === 1
    && state.everTriple
    && state.pairTagged
    && finalId
    && finalId !== state.initialId
  ) {
    clearRunnerStage(state);
  } else if (stage.id === "exchange") {
    failRunnerStage(state, "survivor-not-exchanged");
  }
}

function advanceRunnerStage(state) {
  state.stageIndex += 1;
  if (state.stageIndex >= state.stages.length) {
    state.status = "complete";
    state.events.push({ type: "complete", mode: state.mode, score: state.score });
    return;
  }
  initializeRunnerStage(state);
  state.events.push({ type: "runner-stage", stage: state.stages[state.stageIndex].id });
}

function recordRunnerHistory(state, dt) {
  state.historyClock += dt;
  if (state.historyClock < 0.07) return;
  state.historyClock = 0;
  state.history.push({
    a: state.coordinate.a,
    b: state.coordinate.b,
    roots: state.roots.map((root) => ({ id: root.id, source: { ...root.source }, sign: root.sign })),
  });
  if (state.history.length > 180) state.history.shift();
}

export function stepRunner(state, input, dt = TRACE_STEP) {
  if (state.status !== "playing") return state;
  state.elapsed += dt;
  if (state.stageDelay !== null) {
    state.stageDelay -= dt;
    if (state.stageDelay <= 0) {
      if (state.integrity <= 0) {
        state.status = "failed";
      } else if (state.receipts.length > state.stageIndex) {
        advanceRunnerStage(state);
      } else {
        initializeRunnerStage(state);
      }
    }
    return state;
  }

  const moveX = clamp(input.moveX ?? 0, -1, 1);
  const moveY = clamp(input.moveY ?? 0, -1, 1);
  const response = 1 - Math.exp(-12 * dt);
  state.velocity.b += (moveX * 0.0105 - state.velocity.b) * response;
  state.velocity.a += ((-moveY) * 0.021 - state.velocity.a) * response;
  state.coordinate.b = clamp(state.coordinate.b + state.velocity.b * dt, -0.018, 0.018);
  state.coordinate.a = clamp(state.coordinate.a + state.velocity.a * dt, -0.018, 0.072);
  state.timeLeft -= dt;
  updateRunnerRoots(state);
  recordRunnerHistory(state, dt);
  evaluateRunnerStage(state);
  if (state.timeLeft <= 0) failRunnerStage(state, "timeout");
  return state;
}

export function runnerEvidence(state) {
  const stage = state.stages[state.stageIndex];
  return {
    status: state.status,
    stage: stage?.id ?? "complete",
    coordinate: { a: rounded(state.coordinate.a, 8), b: rounded(state.coordinate.b, 8) },
    rootIds: state.roots.map((root) => root.id),
    signs: state.roots.map((root) => root.sign),
    signedMultiplicity: state.roots.reduce((sum, root) => sum + root.sign, 0),
    initialId: state.initialId,
    everTriple: state.everTriple,
    pairTagged: state.pairTagged,
    score: state.score,
    integrity: state.integrity,
    timeLeft: rounded(state.timeLeft, 6),
    receiptCount: state.receipts.length,
  };
}

export function criticalCuspCurve(samples = 100) {
  const result = [];
  for (let index = 0; index <= samples; index += 1) {
    const c = -0.22 + 0.44 * index / samples;
    const cy = -c / (1 - c);
    if (Math.abs(cy) > 1) continue;
    const source = sourceFromBZ(Math.acos(c), Math.acos(cy));
    const target = mapToState(source);
    const denominator = dot(target, CUSP_Q);
    result.push({
      a: dot(target, CUSP_A) / denominator,
      b: dot(target, CUSP_B) / denominator,
    });
  }
  return result;
}

export function runnerTarget(state) {
  return cuspTarget(state.coordinate.a, state.coordinate.b);
}

export function drainTraceEvents(state) {
  const events = state.events;
  state.events = [];
  return events;
}

export function resetTraceMode(mode) {
  return mode === MODE_RUNNER ? createRunnerState() : createContinuationState();
}

export function torusLabel(root) {
  const { kx, ky } = root.k ?? bzCoordinates(root.source);
  const format = (value) => {
    if (Math.abs(value - Math.PI) < 1e-5) return "π";
    if (Math.abs(value + Math.PI) < 1e-5) return "−π";
    if (Math.abs(value) < 1e-5) return "0";
    return `${(value / Math.PI).toFixed(2)}π`;
  };
  return `(${format(kx)}, ${format(ky)})`;
}

export function rawMultiplicityAt(a, b) {
  const roots = rawRootsForTarget(cuspTarget(a, b), 192);
  return {
    count: roots.length,
    signs: roots.map((root) => root.sign),
    signed: roots.reduce((sum, root) => sum + root.sign, 0),
  };
}

export function meridianClosedFormRoots(degrees) {
  const theta = degrees * Math.PI / 180;
  const roots = [{ id: "A", kx: -Math.PI + theta, ky: 0, sign: 1 }];
  const tangent = Math.tan(theta);
  const discriminant = 1 - 3 * tangent ** 2;
  if (theta >= 0 && discriminant >= -1e-12 && Math.abs(tangent) > 1e-12) {
    const square = Math.sqrt(Math.max(0, discriminant));
    for (const [id, numerator, sign] of [
      ["B", 1 - square, 1],
      ["C", 1 + square, -1],
    ]) {
      const t = numerator / (3 * tangent);
      roots.push({ id, kx: -2 * Math.atan(t), ky: Math.PI, sign });
    }
  }
  return roots;
}

export function wrapRadians(value) {
  return ((value + Math.PI) % TAU + TAU) % TAU - Math.PI;
}
