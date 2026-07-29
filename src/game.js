export const TAU = Math.PI * 2;
export const FIXED_STEP = 1 / 120;
export const PLAYER_RADIUS = 0.018;
export const BZ_OFFSET = 0.1;

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

export function bzCoordinates(source) {
  return {
    kx: TAU * signedPeriodicDelta(BZ_OFFSET, source.u),
    ky: TAU * signedPeriodicDelta(BZ_OFFSET, source.v),
  };
}

export function sourceFromBZ(kx, ky) {
  return {
    u: wrap01(kx / TAU + BZ_OFFSET),
    v: wrap01(ky / TAU + BZ_OFFSET),
  };
}

export function blochHamiltonianVector(source) {
  const { kx, ky } = bzCoordinates(source);
  return {
    x: Math.sin(kx),
    y: Math.sin(ky),
    z: 1 - Math.cos(kx) - Math.cos(ky),
  };
}

export function mapToState(source) {
  const d = blochHamiltonianVector(source);
  const length = Math.hypot(d.x, d.y, d.z);
  const x = -d.x / length;
  const y = -d.y / length;
  const z = -d.z / length;
  return {
    x,
    y,
    z,
    u: wrap01(Math.atan2(y, x) / TAU),
    v: Math.acos(clamp(z, -1, 1)) / Math.PI,
  };
}

export function signedAreaDensity(u, v) {
  const source = { u, v };
  const { kx, ky } = bzCoordinates(source);
  const cx = Math.cos(kx);
  const cy = Math.cos(ky);
  const d = blochHamiltonianVector(source);
  const length = Math.hypot(d.x, d.y, d.z);
  return (cx + cy - cx * cy) / (2 * length ** 3);
}

export function metricDeterminant(u, v) {
  return signedAreaDensity(u, v) ** 2;
}

export function orientationValue(u, v) {
  return signedAreaDensity(u, v);
}

export function orientationAt(u, v) {
  return signedAreaDensity(u, v) < 0 ? -1 : 1;
}

export function foldBranchesAtU(u) {
  const { kx } = bzCoordinates({ u, v: BZ_OFFSET });
  const cx = Math.cos(kx);
  if (cx > 0.5 + EPSILON || Math.abs(cx - 1) < EPSILON) return [];
  const cy = clamp(cx / (cx - 1), -1, 1);
  const ky = Math.acos(cy);
  const branches = [
    sourceFromBZ(kx, -ky).v,
    sourceFromBZ(kx, ky).v,
  ];
  return [...new Set(branches.map((value) => Number(value.toFixed(12))))]
    .sort((a, b) => a - b);
}

export function cuspPoints() {
  const points = [];
  for (const kx of [-Math.PI / 2, Math.PI / 2]) {
    for (const ky of [-Math.PI / 2, Math.PI / 2]) {
      points.push(sourceFromBZ(kx, ky));
    }
  }
  return points.sort((a, b) => a.u - b.u || a.v - b.v);
}

export function stateDistance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

export function findSourcesForState(target, samples = 128) {
  const q = { x: -target.x, y: -target.y, z: -target.z };
  let maximumRadius = 3.05;
  if (Math.abs(q.x) > EPSILON) maximumRadius = Math.min(maximumRadius, 1 / Math.abs(q.x));
  if (Math.abs(q.y) > EPSILON) maximumRadius = Math.min(maximumRadius, 1 / Math.abs(q.y));
  const roots = [];

  const addRoot = (radius, cosXSign, cosYSign) => {
    const sinX = clamp(radius * q.x, -1, 1);
    const sinY = clamp(radius * q.y, -1, 1);
    const cosX = cosXSign * Math.sqrt(Math.max(0, 1 - sinX ** 2));
    const cosY = cosYSign * Math.sqrt(Math.max(0, 1 - sinY ** 2));
    const source = sourceFromBZ(Math.atan2(sinX, cosX), Math.atan2(sinY, cosY));
    if (roots.every((existing) => periodicDistance(existing, source) > 1e-5)) {
      roots.push(source);
    }
  };

  for (const cosXSign of [-1, 1]) {
    for (const cosYSign of [-1, 1]) {
      const equation = (radius) => (
        1
        - cosXSign * Math.sqrt(Math.max(0, 1 - radius ** 2 * q.x ** 2))
        - cosYSign * Math.sqrt(Math.max(0, 1 - radius ** 2 * q.y ** 2))
        - radius * q.z
      );
      let previousRadius = 1e-8;
      let previousValue = equation(previousRadius);
      for (let index = 1; index <= samples; index += 1) {
        const radius = maximumRadius * index / samples;
        const value = equation(radius);
        let root = null;
        if (Math.abs(value) < 1e-9) {
          root = radius;
        } else if (previousValue * value < 0) {
          let lo = previousRadius;
          let hi = radius;
          let loValue = previousValue;
          for (let iteration = 0; iteration < 52; iteration += 1) {
            const mid = (lo + hi) / 2;
            const midValue = equation(mid);
            if (loValue * midValue <= 0) {
              hi = mid;
            } else {
              lo = mid;
              loValue = midValue;
            }
          }
          root = (lo + hi) / 2;
        }
        if (root !== null && root > EPSILON) addRoot(root, cosXSign, cosYSign);
        previousRadius = radius;
        previousValue = value;
      }
    }
  }

  return roots.sort((a, b) => a.u - b.u || a.v - b.v);
}

export function sourceMultiplicity(source) {
  return findSourcesForState(mapToState(source)).length;
}

export function nearestCuspDistance(source) {
  return cuspPoints().reduce(
    (closest, cusp) => Math.min(closest, periodicDistance(source, cusp)),
    Infinity,
  );
}

export function fieldEffectAt(source, {
  foldThreshold = 0.035,
  cuspRadius = 0.05,
} = {}) {
  const signedDensity = signedAreaDensity(source.u, source.v);
  const cuspDistance = nearestCuspDistance(source);

  if (cuspDistance < cuspRadius) {
    return {
      kind: "cusp",
      signedDensity,
      metricDeterminant: signedDensity ** 2,
      sign: Math.sign(signedDensity),
      localResponse: "rank-loss",
      packetSign: null,
      causesDamage: false,
      isCollectible: false,
    };
  }

  if (Math.abs(signedDensity) < foldThreshold) {
    return {
      kind: "fold",
      signedDensity,
      metricDeterminant: signedDensity ** 2,
      sign: Math.sign(signedDensity),
      localResponse: "rank-loss",
      packetSign: null,
      causesDamage: false,
      isCollectible: false,
    };
  }

  if (signedDensity < 0) {
    return {
      kind: "reversed",
      signedDensity,
      metricDeterminant: signedDensity ** 2,
      sign: -1,
      localResponse: "orientation-reversed",
      packetSign: -1,
      causesDamage: false,
      isCollectible: false,
    };
  }

  return {
    kind: "positive",
    signedDensity,
    metricDeterminant: signedDensity ** 2,
    sign: 1,
    localResponse: "orientation-preserved",
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
  const kind = extra.kind ?? "source";
  return {
    id,
    label,
    kind,
    u: source.u,
    v: source.v,
    stateU: mapped.u,
    stateV: mapped.v,
    stateX: mapped.x,
    stateY: mapped.y,
    stateZ: mapped.z,
    patch: extra.patch ?? id,
    radius: extra.radius ?? (kind === "source" ? 0.047 : 0.095),
    requiredOrientation: extra.requiredOrientation
      ?? orientationAt(source.u, source.v),
    rootSource: extra.rootSource,
  };
}

function echoGates() {
  const southPole = mapToState({ u: 0.6, v: 0.1 });
  return findSourcesForState(southPole).map((rootSource, index) => gateFromSource(
    `echo-${index + 1}`,
    `Echo ${index + 1}`,
    rootSource,
    {
      kind: "echo",
      patch: "one-light",
      radius: 0.085,
      rootSource,
    },
  ));
}

export function makeMissions() {
  const foldRunSources = [
    { u: 0.6, v: 0.15 },
    { u: 0.6, v: 0.6 },
    { u: 0.6, v: 0.05 },
  ];

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
      brief: "Steer the Bloch image through amber locks. Across Σ, the signed area density reverses.",
      objective: "Cross + → − → + and lock all 3 state rings",
      hint: "Watch λ̄: det g reaches zero on the amber curve, then the oriented image flips.",
      start: { u: 0.6, v: 0.08 },
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
      brief: "The south-pole Bloch state has three BZ preimages. Touch every origin, not just the image.",
      objective: "Resolve all 3 sources of the same visible point",
      hint: "Press Space to reveal echo bearings. Their signs are +, +, −, so the signed sum is +1.",
      start: { u: 0.82, v: 0.48 },
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
      start: { u: 0.82, v: 0.48 },
      ordered: true,
      timeLimit: 70,
      targetCharge: 1,
      gates: [
        gateFromSource("cancel-1", "A+", { u: 0.6, v: 0.1 }, { kind: "state", patch: "patch-a" }),
        gateFromSource("cancel-2", "A−", { u: 0.6, v: 0.6 }, { kind: "state", patch: "patch-a" }),
        gateFromSource("cancel-3", "B+", { u: 0.1, v: 0.6 }, { kind: "state", patch: "patch-b" }),
        gateFromSource("cancel-4", "C−", { u: 0.58, v: 0.58 }, { kind: "state", patch: "patch-c" }),
        gateFromSource("cancel-5", "C+", { u: 0.1, v: 0.1 }, { kind: "state", patch: "patch-c" }),
      ],
    },
    {
      id: "free",
      number: "05",
      eyebrow: "CHERN RECEIPT",
      title: "Assemble the model's global +1",
      brief: "Choose your route through five evidence relays, then return home. Local singular geometry leaves a stable integer.",
      objective: "Collect all relays, close the path, finish at charge +1",
      hint: "Any order works. Three positive packets and two negative packets reproduce C = +1.",
      start: { u: 0.5, v: 0.08 },
      home: { u: 0.5, v: 0.08, radius: 0.062 },
      ordered: false,
      timeLimit: 105,
      targetCharge: 1,
      gates: [
        gateFromSource("free-1", "North pole", { u: 0.1, v: 0.1 }, { patch: "north" }),
        gateFromSource("free-2", "South preimage A", { u: 0.6, v: 0.1 }, { patch: "south-a" }),
        gateFromSource("free-3", "Cusp flank", { u: 0.35, v: 0.28 }, { patch: "cusp-flank" }),
        gateFromSource("free-4", "Reversed sheet A", { u: 0.6, v: 0.6 }, { patch: "fold-a" }),
        gateFromSource("free-5", "Reversed sheet B", { u: 0.7, v: 0.7 }, { patch: "fold-b" }),
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
    lastMultiplicityAt: 0,
  };
}

function gateHit(state, gate) {
  const source = state.source;
  if (gate.kind === "source") {
    return periodicDistance(source, gate) <= gate.radius;
  }

  const mappedDistance = stateDistance(state.mapped, {
    x: gate.stateX,
    y: gate.stateY,
    z: gate.stateZ,
  });
  if (mappedDistance > gate.radius) return false;
  if (orientationAt(source.u, source.v) !== gate.requiredOrientation) return false;
  if (gate.rootSource !== undefined) {
    return periodicDistance(source, gate.rootSource) <= 0.052;
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
  if (state.elapsed - state.lastMultiplicityAt >= 1 / 15) {
    state.multiplicity = sourceMultiplicity(state.source);
    state.lastMultiplicityAt = state.elapsed;
  }
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
