export const TAU = Math.PI * 2;
export const FIXED_STEP = 1 / 120;
export const PLAYER_RADIUS = 0.018;

const EPSILON = 1e-9;
const DEFAULT_SPEED = 0.245;
const DEFAULT_ACCELERATION = 2.8;
const DEFAULT_DRAG = 7.5;

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function wrap01(value) {
  return ((value % 1) + 1) % 1;
}

export function signedPeriodicDelta(from, to) {
  const raw = wrap01(to) - wrap01(from);
  if (raw > 0.5) return raw - 1;
  if (raw < -0.5) return raw + 1;
  return raw;
}

export function periodicDistance(a, b) {
  return Math.hypot(
    signedPeriodicDelta(a.u, b.u),
    signedPeriodicDelta(a.v, b.v),
  );
}

export function foldAmplitude(u) {
  return 1.18 + 0.32 * Math.cos(TAU * 3 * wrap01(u));
}

export function foldPhase(u, v) {
  const sourceV = clamp(v, 0, 1);
  const mapped = sourceV
    + (foldAmplitude(u) * Math.sin(TAU * sourceV)) / TAU;
  return clamp(mapped, 0, 1);
}

export function orientationValue(u, v) {
  return 1 + foldAmplitude(u) * Math.cos(TAU * wrap01(v));
}

export function orientationAt(u, v) {
  return orientationValue(u, v) < 0 ? -1 : 1;
}

export function mapToState(source) {
  return {
    u: wrap01(source.u),
    v: foldPhase(source.u, wrap01(source.v)),
  };
}

export function foldBranchesAtU(u) {
  const amplitude = foldAmplitude(u);
  if (amplitude < 1) return [];
  const first = Math.acos(-1 / amplitude) / TAU;
  return [first, 1 - first];
}

export function cuspPoints() {
  const ratio = (1 - 1.18) / 0.32;
  const angle = Math.acos(ratio);
  const points = [];
  for (let lobe = 0; lobe < 3; lobe += 1) {
    points.push({
      u: wrap01((angle + TAU * lobe) / (TAU * 3)),
      v: 0.5,
    });
    points.push({
      u: wrap01((TAU - angle + TAU * lobe) / (TAU * 3)),
      v: 0.5,
    });
  }
  return points.sort((a, b) => a.u - b.u);
}

function bisectRoot(u, targetV, left, right, iterations = 52) {
  let lo = left;
  let hi = right;
  let loValue = foldPhase(u, lo) - targetV;
  for (let iteration = 0; iteration < iterations; iteration += 1) {
    const mid = (lo + hi) / 2;
    const midValue = foldPhase(u, mid) - targetV;
    if (Math.abs(midValue) < EPSILON) return mid;
    if (Math.sign(midValue) === Math.sign(loValue)) {
      lo = mid;
      loValue = midValue;
    } else {
      hi = mid;
    }
  }
  return (lo + hi) / 2;
}

export function findSourcesForState(u, targetV, samples = 1024) {
  const target = clamp(targetV, 0, 1);
  const roots = [];
  let previousV = 0;
  let previousValue = foldPhase(u, previousV) - target;

  const addRoot = (root) => {
    if (
      root >= -EPSILON
      && root <= 1 + EPSILON
      && roots.every((existing) => Math.abs(existing - root) > 1e-5)
    ) {
      roots.push(clamp(root, 0, 1));
    }
  };

  if (Math.abs(previousValue) < EPSILON) addRoot(previousV);

  for (let index = 1; index <= samples; index += 1) {
    const currentV = index / samples;
    const currentValue = foldPhase(u, currentV) - target;
    if (Math.abs(currentValue) < EPSILON) {
      addRoot(currentV);
    } else if (Math.sign(previousValue) !== Math.sign(currentValue)) {
      addRoot(bisectRoot(u, target, previousV, currentV));
    }
    previousV = currentV;
    previousValue = currentValue;
  }

  return roots.sort((a, b) => a - b);
}

export function sourceMultiplicity(source) {
  const mapped = mapToState(source);
  return findSourcesForState(mapped.u, mapped.v).length;
}

export function nearestCuspDistance(source) {
  return cuspPoints().reduce(
    (closest, cusp) => Math.min(closest, periodicDistance(source, cusp)),
    Infinity,
  );
}

export function fieldEffectAt(source, {
  foldThreshold = 0.12,
  cuspRadius = 0.055,
} = {}) {
  const jacobian = orientationValue(source.u, source.v);
  const cuspDistance = nearestCuspDistance(source);

  if (cuspDistance < cuspRadius) {
    return {
      kind: "cusp",
      jacobian,
      sign: Math.sign(jacobian),
      localVResponse: "compressed",
      packetSign: null,
      causesDamage: false,
      isCollectible: false,
    };
  }

  if (Math.abs(jacobian) < foldThreshold) {
    return {
      kind: "fold",
      jacobian,
      sign: Math.sign(jacobian),
      localVResponse: "compressed",
      packetSign: null,
      causesDamage: false,
      isCollectible: false,
    };
  }

  if (jacobian < 0) {
    return {
      kind: "reversed",
      jacobian,
      sign: -1,
      localVResponse: "reversed",
      packetSign: -1,
      causesDamage: false,
      isCollectible: false,
    };
  }

  return {
    kind: "positive",
    jacobian,
    sign: 1,
    localVResponse: "preserved",
    packetSign: 1,
    causesDamage: false,
    isCollectible: false,
  };
}

export function stepSource(source, input, dt, options = {}) {
  const speed = options.speed ?? DEFAULT_SPEED;
  const acceleration = options.acceleration ?? DEFAULT_ACCELERATION;
  const drag = options.drag ?? DEFAULT_DRAG;
  const magnitude = Math.hypot(input.x, input.y);
  const normalized = magnitude > 1
    ? { x: input.x / magnitude, y: input.y / magnitude }
    : input;
  const targetX = normalized.x * speed;
  const targetY = normalized.y * speed;
  const response = 1 - Math.exp(-acceleration * dt * 4);
  let vx = source.vx + (targetX - source.vx) * response;
  let vy = source.vy + (targetY - source.vy) * response;

  if (magnitude < EPSILON) {
    const damping = Math.exp(-drag * dt);
    vx *= damping;
    vy *= damping;
  }

  const rawU = source.u + vx * dt;
  const rawV = source.v + vy * dt;
  return {
    u: wrap01(rawU),
    v: wrap01(rawV),
    vx,
    vy,
    wrappedU: rawU < 0 || rawU >= 1,
    wrappedV: rawV < 0 || rawV >= 1,
  };
}

export class CoverageLedger {
  constructor() {
    this.layers = new Map();
    this.rawArea = 0;
    this.signedArea = 0;
  }

  add(patch, orientation, area = 1) {
    const sign = orientation < 0 ? -1 : 1;
    const previous = this.layers.get(patch) ?? {
      raw: 0,
      signed: 0,
    };
    const next = {
      raw: previous.raw + area,
      signed: previous.signed + sign * area,
    };
    this.layers.set(patch, next);
    this.rawArea += area;
    this.signedArea += sign * area;
    return { patch, sign, area, ...next };
  }

  snapshot() {
    return {
      rawArea: this.rawArea,
      signedArea: this.signedArea,
      layers: [...this.layers.entries()].map(([patch, value]) => ({
        patch,
        ...value,
      })),
    };
  }
}

export function chargeFromSignedArea(signedArea, quantum = 1) {
  return signedArea / quantum;
}

export function isIntegerCharge(value, tolerance = 1e-8) {
  return Math.abs(value - Math.round(value)) <= tolerance;
}

export function isChargeComplete({
  signedArea,
  targetCharge,
  quantum = 1,
  allRequiredCollected = true,
  pathClosed = true,
}) {
  const charge = chargeFromSignedArea(signedArea, quantum);
  return allRequiredCollected
    && pathClosed
    && isIntegerCharge(charge)
    && Math.abs(charge - targetCharge) <= 1e-8;
}

function gateFromSource(id, label, source, extra = {}) {
  const mapped = mapToState(source);
  return {
    id,
    label,
    kind: extra.kind ?? "source",
    u: source.u,
    v: source.v,
    stateU: mapped.u,
    stateV: mapped.v,
    patch: extra.patch ?? id,
    radius: extra.radius ?? 0.047,
    requiredOrientation: extra.requiredOrientation
      ?? orientationAt(source.u, source.v),
    rootV: extra.rootV,
  };
}

function echoGates() {
  const u = 0;
  const stateV = 0.5;
  return findSourcesForState(u, stateV).map((rootV, index) => gateFromSource(
    `echo-${index + 1}`,
    `Echo ${index + 1}`,
    { u, v: rootV },
    {
      kind: "echo",
      patch: "one-light",
      radius: 0.043,
      rootV,
    },
  ));
}

export function makeMissions() {
  const foldRunSources = [
    { u: 0.05, v: 0.28 },
    { u: 0.05, v: 0.48 },
    { u: 0.05, v: 0.72 },
  ];
  const cancellationSources = findSourcesForState(0, 0.5);

  return [
    {
      id: "seam",
      number: "01",
      eyebrow: "PERIODIC DRIFT",
      title: "No edge is an ending",
      brief: "Thread the cyan relays. The first is across the right seam—keep flying.",
      objective: "Cross the seam and collect all 4 relays",
      hint: "Move with WASD or the arrow keys. Space sends a survey pulse.",
      start: { u: 0.86, v: 0.2 },
      ordered: true,
      timeLimit: null,
      targetCharge: null,
      gates: [
        gateFromSource("seam-1", "Relay 1", { u: 0.04, v: 0.2 }),
        gateFromSource("seam-2", "Relay 2", { u: 0.12, v: 0.8 }),
        gateFromSource("seam-3", "Relay 3", { u: 0.88, v: 0.82 }),
        gateFromSource("seam-4", "Relay 4", { u: 0.72, v: 0.34 }),
      ],
    },
    {
      id: "reverse",
      number: "02",
      eyebrow: "FOLD CURRENT",
      title: "Read the sign",
      brief: "Steer the image through amber locks. Between the fold lines, your mapped motion reverses.",
      objective: "Cross + → − → + and lock all 3 state rings",
      hint: "Watch the right-hand image: the source keeps obeying you while its image can turn against you.",
      start: { u: 0.05, v: 0.18 },
      ordered: true,
      timeLimit: null,
      targetCharge: 1,
      gates: foldRunSources.map((source, index) => gateFromSource(
        `reverse-${index + 1}`,
        ["Positive lock", "Negative lock", "Positive lock"][index],
        source,
        {
          kind: "state",
          patch: index < 2 ? "reverse-overlap" : "reverse-exit",
          radius: 0.041,
        },
      )),
    },
    {
      id: "echo",
      number: "03",
      eyebrow: "PROVENANCE",
      title: "One light, three origins",
      brief: "The white state beacon has three source echoes. Touch every origin, not just the image.",
      objective: "Resolve all 3 sources of the same visible point",
      hint: "Press Space to reveal echo bearings. Their signs are +, −, +.",
      start: { u: 0.86, v: 0.5 },
      ordered: false,
      timeLimit: null,
      targetCharge: 1,
      gates: echoGates(),
    },
    {
      id: "cancel",
      number: "04",
      eyebrow: "SIGNED COVERAGE",
      title: "More can become less",
      brief: "Survey five layers. Opposite signs on the same patch cancel, even while raw coverage climbs.",
      objective: "Reach raw 5 with signed charge +1",
      hint: "Follow the numbered locks. The large meter shows signed progress, not raw sweep.",
      start: { u: 0.88, v: cancellationSources[0] },
      ordered: true,
      timeLimit: 70,
      targetCharge: 1,
      gates: [
        gateFromSource("cancel-1", "A+", { u: 0, v: cancellationSources[0] }, { kind: "state", patch: "patch-a" }),
        gateFromSource("cancel-2", "A−", { u: 0, v: cancellationSources[1] }, { kind: "state", patch: "patch-a" }),
        gateFromSource("cancel-3", "B+", { u: 1 / 3, v: cancellationSources[2] }, { kind: "state", patch: "patch-b" }),
        gateFromSource("cancel-4", "C−", { u: 2 / 3, v: cancellationSources[1] }, { kind: "state", patch: "patch-c" }),
        gateFromSource("cancel-5", "C+", { u: 2 / 3, v: cancellationSources[0] }, { kind: "state", patch: "patch-c" }),
      ],
    },
    {
      id: "free",
      number: "05",
      eyebrow: "FREE CHARGE",
      title: "Assemble a global +2",
      brief: "Choose your route through six relays, then return home. Local twists are noise; the integer is the mission.",
      objective: "Collect all relays, close the path, finish at charge +2",
      hint: "Any order works. Four positive layers and two negative layers make the same robust answer.",
      start: { u: 0.5, v: 0.08 },
      home: { u: 0.5, v: 0.08, radius: 0.062 },
      ordered: false,
      timeLimit: 105,
      targetCharge: 2,
      gates: [
        gateFromSource("free-1", "North pulse", { u: 0.08, v: 0.12 }, { patch: "north" }),
        gateFromSource("free-2", "East pulse", { u: 0.28, v: 0.82 }, { patch: "east" }),
        gateFromSource("free-3", "South pulse", { u: 0.55, v: 0.18 }, { patch: "south" }),
        gateFromSource("free-4", "West pulse", { u: 0.86, v: 0.86 }, { patch: "west" }),
        gateFromSource("free-5", "Dark fold", { u: 0, v: 0.5 }, { patch: "fold-a" }),
        gateFromSource("free-6", "Dark fold", { u: 2 / 3, v: 0.5 }, { patch: "fold-b" }),
      ],
    },
  ];
}

function createTrailPoint(source, elapsed) {
  const mapped = mapToState(source);
  return {
    source: { u: source.u, v: source.v },
    mapped,
    orientation: orientationAt(source.u, source.v),
    elapsed,
  };
}

export function createMissionState(index = 0, missions = makeMissions()) {
  const mission = missions[index];
  if (!mission) throw new RangeError(`Unknown mission index ${index}`);
  const source = {
    ...mission.start,
    vx: 0,
    vy: 0,
  };
  return {
    missions,
    missionIndex: index,
    mission,
    status: "ready",
    source,
    mapped: mapToState(source),
    orientation: orientationAt(source.u, source.v),
    multiplicity: sourceMultiplicity(source),
    elapsed: 0,
    remaining: mission.timeLimit,
    started: false,
    collected: [],
    nextGate: 0,
    coverage: new CoverageLedger(),
    sourceTrail: [createTrailPoint(source, 0)],
    events: [],
    pulse: 0,
    cuspRisk: nearestCuspDistance(source),
    fieldEffect: fieldEffectAt(source),
    wrapCount: 0,
    pathClosed: !mission.home,
    lastTrailAt: 0,
  };
}

function gateHit(state, gate) {
  const source = state.source;
  if (gate.kind === "source") {
    return periodicDistance(source, gate) <= gate.radius;
  }

  const stateDistance = periodicDistance(state.mapped, {
    u: gate.stateU,
    v: gate.stateV,
  });
  if (stateDistance > gate.radius) return false;
  if (orientationAt(source.u, source.v) !== gate.requiredOrientation) return false;
  if (gate.rootV !== undefined) {
    return Math.abs(signedPeriodicDelta(source.v, gate.rootV)) <= 0.052;
  }
  return true;
}

function collectGate(state, gate) {
  if (state.collected.includes(gate.id)) return;
  state.collected.push(gate.id);
  const sign = orientationAt(state.source.u, state.source.v);
  const coverage = state.coverage.add(gate.patch, sign);
  state.events.push({
    type: "collect",
    gate,
    sign,
    coverage,
    elapsed: state.elapsed,
  });
  if (state.mission.ordered) state.nextGate += 1;
}

function allCollected(state) {
  return state.collected.length === state.mission.gates.length;
}

function updateCompletion(state) {
  if (!allCollected(state)) return;
  if (state.mission.home) {
    state.pathClosed = periodicDistance(state.source, state.mission.home)
      <= state.mission.home.radius;
    if (!state.pathClosed) return;
  }

  if (state.mission.targetCharge !== null) {
    const complete = isChargeComplete({
      signedArea: state.coverage.signedArea,
      targetCharge: state.mission.targetCharge,
      allRequiredCollected: true,
      pathClosed: state.pathClosed,
    });
    if (!complete) {
      state.status = "failed";
      state.events.push({
        type: "failed",
        reason: "charge",
        elapsed: state.elapsed,
      });
      return;
    }
  }

  state.status = "complete";
  state.events.push({ type: "complete", elapsed: state.elapsed });
}

export function stepMission(state, input, dt = FIXED_STEP) {
  if (state.status === "complete" || state.status === "failed") return state;
  state.events = [];
  if (input.pulse) {
    state.pulse = 1;
    state.events.push({ type: "pulse", elapsed: state.elapsed });
  }
  state.pulse = Math.max(0, state.pulse - dt * 1.4);

  const activeInput = Math.hypot(input.x, input.y) > EPSILON;
  if (activeInput) {
    state.started = true;
    state.status = "playing";
  }
  if (!state.started) return state;

  const previousOrientation = state.orientation;
  const previousFieldKind = state.fieldEffect.kind;
  const nextSource = stepSource(state.source, input, dt);
  state.source = nextSource;
  state.elapsed += dt;
  if (state.remaining !== null) {
    state.remaining = Math.max(0, state.mission.timeLimit - state.elapsed);
  }

  if (nextSource.wrappedU || nextSource.wrappedV) {
    state.wrapCount += Number(nextSource.wrappedU) + Number(nextSource.wrappedV);
    state.events.push({
      type: "wrap",
      axes: [nextSource.wrappedU ? "u" : null, nextSource.wrappedV ? "v" : null].filter(Boolean),
      elapsed: state.elapsed,
    });
  }

  state.mapped = mapToState(state.source);
  state.orientation = orientationAt(state.source.u, state.source.v);
  state.multiplicity = sourceMultiplicity(state.source);
  state.cuspRisk = nearestCuspDistance(state.source);
  state.fieldEffect = fieldEffectAt(state.source);

  if (
    state.fieldEffect.kind !== previousFieldKind
    && ["fold", "cusp"].includes(state.fieldEffect.kind)
  ) {
    state.events.push({
      type: "field",
      effect: state.fieldEffect,
      elapsed: state.elapsed,
    });
  }

  if (state.orientation !== previousOrientation) {
    state.events.push({
      type: "orientation",
      orientation: state.orientation,
      elapsed: state.elapsed,
    });
  }

  if (state.elapsed - state.lastTrailAt >= 1 / 30) {
    state.sourceTrail.push(createTrailPoint(state.source, state.elapsed));
    if (state.sourceTrail.length > 1800) state.sourceTrail.shift();
    state.lastTrailAt = state.elapsed;
  }

  const candidates = state.mission.ordered
    ? [state.mission.gates[state.nextGate]].filter(Boolean)
    : state.mission.gates.filter((gate) => !state.collected.includes(gate.id));
  for (const gate of candidates) {
    if (gateHit(state, gate)) {
      collectGate(state, gate);
      if (state.mission.ordered) break;
    }
  }

  updateCompletion(state);

  if (
    state.status !== "complete"
    && state.remaining !== null
    && state.remaining <= 0
  ) {
    state.status = "failed";
    state.events.push({
      type: "failed",
      reason: "coherence",
      elapsed: state.elapsed,
    });
  }

  return state;
}

export function missionEvidence(state) {
  return {
    mission: state.mission.id,
    status: state.status,
    elapsed: state.elapsed,
    orientation: state.orientation,
    multiplicity: state.multiplicity,
    fieldEffect: state.fieldEffect,
    rawArea: state.coverage.rawArea,
    signedArea: state.coverage.signedArea,
    charge: chargeFromSignedArea(state.coverage.signedArea),
    wraps: state.wrapCount,
    collected: state.collected.length,
    required: state.mission.gates.length,
    pathClosed: state.pathClosed,
    sourcePath: state.sourceTrail.map((point) => point.source),
    mappedPath: state.sourceTrail.map((point) => point.mapped),
  };
}
