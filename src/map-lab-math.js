export const PI = Math.PI;
export const TAU = Math.PI * 2;

export function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

export function cuspidalEdgeMap(u, v) {
  return { x: u * u, y: u * u * u, z: v };
}

export function cuspidalEdgeDensity(u) {
  return u * Math.sqrt(4 + 9 * u * u);
}

export function cuspidalEdgeRank(u, epsilon = 1e-9) {
  return Math.abs(u) <= epsilon ? 1 : 2;
}

export function cuspidalEdgeSingularSample(parameter) {
  return {
    parameter,
    source: { u: 0, v: parameter },
    tangent: { u: 0, v: 1 },
    nullDirection: { u: 1, v: 0 },
    determinant: -1,
    image: cuspidalEdgeMap(0, parameter),
    imageVelocity: { x: 0, y: 0, z: 1 },
    imageSpeed: 1,
  };
}

export function swallowtailMap(u, v) {
  return {
    x: 3 * u ** 4 + u * u * v,
    y: 4 * u ** 3 + 2 * u * v,
    z: v,
  };
}

export function swallowtailSingularSample(parameter) {
  const u = parameter;
  const v = u === 0 ? 0 : -6 * u * u;
  const imageVelocity = {
    x: -12 * u ** 3,
    y: -24 * u * u,
    z: -12 * u,
  };
  return {
    parameter,
    source: { u, v },
    tangent: { u: 1, v: -12 * u },
    nullDirection: { u: 1, v: 0 },
    determinant: 12 * u,
    image: swallowtailMap(u, v),
    imageVelocity,
    imageSpeed: Math.hypot(imageVelocity.x, imageVelocity.y, imageVelocity.z),
  };
}

export function blochVector(kx, ky) {
  const dx = Math.sin(kx);
  const dy = Math.sin(ky);
  const dz = 1 - Math.cos(kx) - Math.cos(ky);
  const length = Math.hypot(dx, dy, dz);
  return {
    x: -dx / length,
    y: -dy / length,
    z: -dz / length,
  };
}

export function blochDerivatives(kx, ky) {
  const cx = Math.cos(kx);
  const cy = Math.cos(ky);
  const dx = Math.sin(kx);
  const dy = Math.sin(ky);
  const dz = 1 - cx - cy;
  const length = Math.hypot(dx, dy, dz);
  const unit = { x: dx / length, y: dy / length, z: dz / length };
  const rawX = { x: cx, y: 0, z: dx };
  const rawY = { x: 0, y: cy, z: dy };
  const projected = (raw) => {
    const radial = unit.x * raw.x + unit.y * raw.y + unit.z * raw.z;
    return {
      x: -(raw.x - radial * unit.x) / length,
      y: -(raw.y - radial * unit.y) / length,
      z: -(raw.z - radial * unit.z) / length,
    };
  };
  return { kx: projected(rawX), ky: projected(rawY) };
}

export function foldNumerator(kx, ky) {
  const cx = Math.cos(kx);
  const cy = Math.cos(ky);
  return cx + cy - cx * cy;
}

export function projectorDensity(kx, ky) {
  const cx = Math.cos(kx);
  const cy = Math.cos(ky);
  const dx = Math.sin(kx);
  const dy = Math.sin(ky);
  const dz = 1 - cx - cy;
  const length = Math.hypot(dx, dy, dz);
  return foldNumerator(kx, ky) / (2 * length ** 3);
}

export function foldKyAt(kx) {
  const cx = Math.cos(kx);
  if (cx > 0.5 + 1e-12 || Math.abs(cx - 1) < 1e-12) return [];
  const cy = clamp(cx / (cx - 1), -1, 1);
  const ky = Math.acos(cy);
  return ky < 1e-12 ? [0] : [-ky, ky];
}

export function projectorCuspPoints() {
  const points = [];
  for (const kx of [-PI / 2, PI / 2]) {
    for (const ky of [-PI / 2, PI / 2]) points.push({ kx, ky });
  }
  return points;
}

function normalize2(vector) {
  const length = Math.hypot(vector.u, vector.v);
  return length > 1e-14
    ? { u: vector.u / length, v: vector.v / length }
    : { u: 0, v: 0 };
}

export function projectorNullDirection(kx, ky) {
  const derivatives = blochDerivatives(kx, ky);
  const normX = derivatives.kx.x ** 2 + derivatives.kx.y ** 2 + derivatives.kx.z ** 2;
  const normY = derivatives.ky.x ** 2 + derivatives.ky.y ** 2 + derivatives.ky.z ** 2;
  const dot = (
    derivatives.kx.x * derivatives.ky.x
    + derivatives.kx.y * derivatives.ky.y
    + derivatives.kx.z * derivatives.ky.z
  );
  if (normX >= normY && normX > 1e-18) {
    return normalize2({ u: dot / normX, v: -1 });
  }
  if (normY > 1e-18) {
    return normalize2({ u: 1, v: -dot / normY });
  }
  return { u: 1, v: 0 };
}

export function projectorFoldSample(parameter, cusp = { kx: PI / 2, ky: PI / 2 }) {
  const kx = cusp.kx + parameter;
  const branches = foldKyAt(kx);
  if (!branches.length) throw new RangeError("Parameter left the fold branch chart");
  const ky = cusp.ky < 0 ? branches[0] : branches.at(-1);
  const hx = -Math.sin(kx) * (1 - Math.cos(ky));
  const hy = -Math.sin(ky) * (1 - Math.cos(kx));
  const tangentRaw = { u: 1, v: -hx / hy };
  const tangent = normalize2(tangentRaw);
  const nullDirection = projectorNullDirection(kx, ky);
  const determinant = tangent.u * nullDirection.v - tangent.v * nullDirection.u;
  const derivatives = blochDerivatives(kx, ky);
  const imageVelocity = {
    x: derivatives.kx.x + tangentRaw.v * derivatives.ky.x,
    y: derivatives.kx.y + tangentRaw.v * derivatives.ky.y,
    z: derivatives.kx.z + tangentRaw.v * derivatives.ky.z,
  };
  return {
    parameter,
    source: { kx, ky },
    tangent,
    tangentRaw,
    nullDirection,
    determinant,
    image: blochVector(kx, ky),
    imageVelocity,
    imageSpeed: Math.hypot(imageVelocity.x, imageVelocity.y, imageVelocity.z),
  };
}

export function nearestFoldPoint(kx, ky, samples = 720) {
  let best = null;
  for (let index = 0; index <= samples; index += 1) {
    const candidateX = -PI + (TAU * index) / samples;
    for (const candidateY of foldKyAt(candidateX)) {
      const dx = candidateX - kx;
      const dy = candidateY - ky;
      const distance = Math.hypot(dx, dy);
      if (!best || distance < best.distance) {
        best = { kx: candidateX, ky: candidateY, distance };
      }
    }
  }
  return best;
}

export function formatPi(value) {
  if (Math.abs(value) < 1e-8) return "0";
  const ratio = value / PI;
  if (Math.abs(Math.abs(ratio) - 1) < 1e-8) return ratio < 0 ? "-π" : "π";
  if (Math.abs(Math.abs(ratio) - 0.5) < 1e-8) return ratio < 0 ? "-π/2" : "π/2";
  return `${ratio.toFixed(2)}π`;
}
