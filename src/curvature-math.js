import { projectorDensity } from "./map-lab-math.js";

export const TWO_PI = 2 * Math.PI;

export function cp1Scale(x, y) {
  return 1 + x * x + y * y;
}

export function fsMetricCoefficient(x, y) {
  return 1 / cp1Scale(x, y) ** 2;
}

export function berryDensityXY(x, y) {
  return 2 * fsMetricCoefficient(x, y);
}

export function ricciDensityXY(x, y) {
  return 2 * berryDensityXY(x, y);
}

export function cp1DiskIntegral(radius, lane = "berry") {
  if (!Number.isFinite(radius) || radius < 0) {
    throw new RangeError("radius must be a finite nonnegative number");
  }
  const berry = TWO_PI * (1 - 1 / (1 + radius * radius));
  return lane === "ricci" ? 2 * berry : berry;
}

export function cp1ChernCharge(lane = "berry") {
  return lane === "ricci" ? 2 : 1;
}

export function paperCurvatureBridge(kx, ky) {
  const berry = projectorDensity(kx, ky);
  return {
    berry,
    pulledBackRicci: 2 * berry,
    signedGauss: 2 * berry,
  };
}

export function localFoldMetric(v) {
  return {
    g11: 1,
    g12: 0,
    g22: v * v,
    determinant: v * v,
    unsignedDensity: Math.abs(v),
    signedDensity: v,
  };
}

export function regularizedFoldInverse(v, epsilon) {
  if (!Number.isFinite(epsilon) || epsilon <= 0) {
    throw new RangeError("epsilon must be positive");
  }
  return {
    inverse11: 1 / (1 + epsilon),
    inverse12: 0,
    inverse22: 1 / (v * v + epsilon),
    regularizedDeterminant: (1 + epsilon) * (v * v + epsilon),
    regularizedAreaDensity: Math.sqrt((1 + epsilon) * (v * v + epsilon)),
  };
}

export function foldRegularizationSample(v, epsilon) {
  return {
    v,
    epsilon,
    ...localFoldMetric(v),
    ...regularizedFoldInverse(v, epsilon),
  };
}
