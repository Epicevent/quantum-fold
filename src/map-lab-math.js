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

export function projectorDensity(kx, ky) {
  const cx = Math.cos(kx);
  const cy = Math.cos(ky);
  const dx = Math.sin(kx);
  const dy = Math.sin(ky);
  const dz = 1 - cx - cy;
  const length = Math.hypot(dx, dy, dz);
  return (cx + cy - cx * cy) / (2 * length ** 3);
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
