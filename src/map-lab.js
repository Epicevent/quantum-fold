import {
  PI,
  blochVector,
  cuspidalEdgeMap,
  cuspidalEdgeSingularSample,
  foldKyAt,
  projectorCuspPoints,
  projectorDensity,
  projectorFoldSample,
  swallowtailMap,
  swallowtailSingularSample,
} from "./map-lab-math.js";

const edge = {
  parameter: -0.72,
  yaw: -0.72,
  pitch: 0.46,
  probeOffset: 0,
};

const swallow = {
  parameter: -0.58,
  yaw: -0.58,
  pitch: 0.38,
  probeOffset: 0,
};

const projector = {
  parameter: -0.24,
  yaw: -0.55,
  pitch: 0.32,
  probeOffset: 0,
};

const ui = {
  edgeTab: document.querySelector("#edge-tab"),
  swallowTab: document.querySelector("#swallow-tab"),
  projectorTab: document.querySelector("#projector-tab"),
  edgeExample: document.querySelector("#edge-example"),
  swallowExample: document.querySelector("#swallow-example"),
  projectorExample: document.querySelector("#projector-example"),
  edgeDomain: document.querySelector("#edge-domain"),
  edgeImage: document.querySelector("#edge-image"),
  swallowDomain: document.querySelector("#swallow-domain"),
  swallowImage: document.querySelector("#swallow-image"),
  projectorDomain: document.querySelector("#projector-domain"),
  projectorImage: document.querySelector("#projector-image"),
  edgeParameter: document.querySelector("#edge-parameter"),
  swallowParameter: document.querySelector("#swallow-parameter"),
  projectorParameter: document.querySelector("#projector-parameter"),
  edgeParameterValue: document.querySelector("#edge-parameter-value"),
  edgeDetValue: document.querySelector("#edge-det-value"),
  edgeSpeedValue: document.querySelector("#edge-speed-value"),
  edgeVerdict: document.querySelector("#edge-verdict"),
  edgeSliderOutput: document.querySelector("#edge-slider-output"),
  swallowParameterValue: document.querySelector("#swallow-parameter-value"),
  swallowDetValue: document.querySelector("#swallow-det-value"),
  swallowSpeedValue: document.querySelector("#swallow-speed-value"),
  swallowVerdict: document.querySelector("#swallow-verdict"),
  swallowSliderOutput: document.querySelector("#swallow-slider-output"),
  swallowImageLabel: document.querySelector("#swallow-image-label"),
  projectorParameterValue: document.querySelector("#projector-parameter-value"),
  projectorDetValue: document.querySelector("#projector-det-value"),
  projectorSpeedValue: document.querySelector("#projector-speed-value"),
  projectorVerdict: document.querySelector("#projector-verdict"),
  projectorSliderOutput: document.querySelector("#projector-slider-output"),
  projectorImageLabel: document.querySelector("#projector-image-label"),
  edgeProbe: document.querySelector("#edge-probe"),
  edgePlay: document.querySelector("#edge-play"),
  swallowProbe: document.querySelector("#swallow-probe"),
  swallowPlay: document.querySelector("#swallow-play"),
  projectorProbe: document.querySelector("#projector-probe"),
  projectorPlay: document.querySelector("#projector-play"),
};

const palette = {
  ink: "#e4faf7",
  muted: "#89a4a1",
  grid: "rgba(151, 211, 205, 0.13)",
  gridStrong: "rgba(151, 211, 205, 0.26)",
  panel: "#061019",
  cyan: "#66ffe1",
  cyanSoft: "rgba(102, 255, 225, 0.12)",
  cyanSurface: "rgba(102, 255, 225, 0.23)",
  coral: "#ff7892",
  coralSoft: "rgba(255, 120, 146, 0.13)",
  coralSurface: "rgba(255, 120, 146, 0.25)",
  amber: "#ffc85f",
  amberSoft: "rgba(255, 200, 95, 0.22)",
};

let activeStage = "edge";
let animation = null;

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

function mix(a, b, amount) {
  return a + (b - a) * amount;
}

function easeInOut(amount) {
  return amount < 0.5
    ? 4 * amount * amount * amount
    : 1 - ((-2 * amount + 2) ** 3) / 2;
}

function signed(value, digits = 3) {
  if (Math.abs(value) < 0.5 * 10 ** -digits) return (0).toFixed(digits);
  return `${value > 0 ? "+" : "−"}${Math.abs(value).toFixed(digits)}`;
}

function canvasFrame(canvas) {
  const rectangle = canvas.getBoundingClientRect();
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.max(1, Math.round(rectangle.width));
  const height = Math.max(1, Math.round(rectangle.height));
  const pixelWidth = Math.round(width * ratio);
  const pixelHeight = Math.round(height * ratio);
  if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
    canvas.width = pixelWidth;
    canvas.height = pixelHeight;
  }
  const context = canvas.getContext("2d");
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  return { context, width, height };
}

function clearCanvas(context, width, height) {
  context.clearRect(0, 0, width, height);
  context.fillStyle = palette.panel;
  context.fillRect(0, 0, width, height);
}

function rotatePoint(point, yaw, pitch) {
  const cy = Math.cos(yaw);
  const sy = Math.sin(yaw);
  const cp = Math.cos(pitch);
  const sp = Math.sin(pitch);
  const x = cy * point.x + sy * point.z;
  const z0 = -sy * point.x + cy * point.z;
  const y = cp * point.y - sp * z0;
  const z = sp * point.y + cp * z0;
  return { x, y, z };
}

function projectPoint(point, camera, width, height, scale, center = { x: 0, y: 0, z: 0 }) {
  const rotated = rotatePoint({
    x: point.x - center.x,
    y: point.y - center.y,
    z: point.z - center.z,
  }, camera.yaw, camera.pitch);
  return {
    x: width / 2 + rotated.x * scale,
    y: height / 2 - rotated.y * scale,
    depth: rotated.z,
  };
}

function drawPolyline(context, points, stroke, width = 1, close = false) {
  if (points.length < 2) return;
  context.beginPath();
  context.moveTo(points[0].x, points[0].y);
  for (let index = 1; index < points.length; index += 1) {
    context.lineTo(points[index].x, points[index].y);
  }
  if (close) context.closePath();
  context.strokeStyle = stroke;
  context.lineWidth = width;
  context.stroke();
}

function drawMarker(context, point, color, radius = 6) {
  context.save();
  context.shadowColor = color;
  context.shadowBlur = 16;
  context.fillStyle = palette.panel;
  context.strokeStyle = color;
  context.lineWidth = 2.5;
  context.beginPath();
  context.arc(point.x, point.y, radius, 0, Math.PI * 2);
  context.fill();
  context.stroke();
  context.fillStyle = color;
  context.beginPath();
  context.arc(point.x, point.y, 2.3, 0, Math.PI * 2);
  context.fill();
  context.restore();
}

function drawTriangle(context, x, y, size, color, filled = true) {
  context.beginPath();
  context.moveTo(x, y - size);
  context.lineTo(x + size * 0.86, y + size * 0.55);
  context.lineTo(x - size * 0.86, y + size * 0.55);
  context.closePath();
  context.fillStyle = filled ? color : palette.panel;
  context.strokeStyle = color;
  context.lineWidth = 1.5;
  if (filled) context.fill();
  context.stroke();
}

function drawArrow(context, origin, direction, length, color, label, dashed = false) {
  const magnitude = Math.hypot(direction.x, direction.y);
  if (magnitude < 1e-10) return;
  const dx = (direction.x / magnitude) * length;
  const dy = (direction.y / magnitude) * length;
  const tip = { x: origin.x + dx, y: origin.y + dy };
  const angle = Math.atan2(dy, dx);
  context.save();
  context.strokeStyle = color;
  context.fillStyle = color;
  context.lineWidth = dashed ? 2.4 : 5.2;
  context.setLineDash(dashed ? [6, 4] : []);
  context.shadowColor = color;
  context.shadowBlur = 9;
  context.beginPath();
  context.moveTo(origin.x, origin.y);
  context.lineTo(tip.x, tip.y);
  context.stroke();
  context.setLineDash([]);
  context.shadowBlur = 0;
  context.beginPath();
  context.moveTo(tip.x, tip.y);
  context.lineTo(tip.x - 10 * Math.cos(angle - 0.45), tip.y - 10 * Math.sin(angle - 0.45));
  context.lineTo(tip.x - 10 * Math.cos(angle + 0.45), tip.y - 10 * Math.sin(angle + 0.45));
  context.closePath();
  context.fill();
  context.font = "500 11px monospace";
  context.textAlign = dx >= 0 ? "left" : "right";
  context.textBaseline = dy >= 0 ? "top" : "bottom";
  context.fillText(label, tip.x + (dx >= 0 ? 7 : -7), tip.y + (dy >= 0 ? 5 : -5));
  context.restore();
}

function drawGrid(context, transform, xSteps = 8, ySteps = 7) {
  context.strokeStyle = palette.grid;
  context.lineWidth = 1;
  for (let index = 0; index <= xSteps; index += 1) {
    const x = transform.left + (transform.width * index) / xSteps;
    context.beginPath();
    context.moveTo(x, transform.top);
    context.lineTo(x, transform.top + transform.height);
    context.stroke();
  }
  for (let index = 0; index <= ySteps; index += 1) {
    const y = transform.top + (transform.height * index) / ySteps;
    context.beginPath();
    context.moveTo(transform.left, y);
    context.lineTo(transform.left + transform.width, y);
    context.stroke();
  }
  context.strokeStyle = palette.gridStrong;
  context.lineWidth = 1.3;
  context.strokeRect(transform.left, transform.top, transform.width, transform.height);
}

function planeTransform(width, height, bounds) {
  const padding = 34;
  const plotWidth = width - 2 * padding;
  const plotHeight = height - 2 * padding;
  return {
    left: padding,
    top: padding,
    width: plotWidth,
    height: plotHeight,
    point(x, y) {
      return {
        x: padding + ((x - bounds.xMin) / (bounds.xMax - bounds.xMin)) * plotWidth,
        y: padding + ((bounds.yMax - y) / (bounds.yMax - bounds.yMin)) * plotHeight,
      };
    },
  };
}

function drawSurface(context, width, height, configuration) {
  const polygons = [];
  const {
    camera,
    map,
    uMin,
    uMax,
    vMin,
    vMax,
    uSteps,
    vSteps,
    scale,
    center,
    side,
  } = configuration;
  for (let uiIndex = 0; uiIndex < uSteps; uiIndex += 1) {
    const u0 = mix(uMin, uMax, uiIndex / uSteps);
    const u1 = mix(uMin, uMax, (uiIndex + 1) / uSteps);
    for (let vi = 0; vi < vSteps; vi += 1) {
      const v0 = mix(vMin, vMax, vi / vSteps);
      const v1 = mix(vMin, vMax, (vi + 1) / vSteps);
      const averageU = (u0 + u1) / 2;
      const averageV = (v0 + v1) / 2;
      const corners = [
        map(u0, v0),
        map(u1, v0),
        map(u1, v1),
        map(u0, v1),
      ].map((point) => projectPoint(point, camera, width, height, scale, center));
      polygons.push({
        corners,
        fill: side(averageU, averageV) >= 0 ? palette.cyanSurface : palette.coralSurface,
        depth: corners.reduce((sum, point) => sum + point.depth, 0) / corners.length,
      });
    }
  }
  polygons.sort((left, right) => left.depth - right.depth);
  for (const polygon of polygons) {
    context.beginPath();
    context.moveTo(polygon.corners[0].x, polygon.corners[0].y);
    for (let index = 1; index < polygon.corners.length; index += 1) {
      context.lineTo(polygon.corners[index].x, polygon.corners[index].y);
    }
    context.closePath();
    context.fillStyle = polygon.fill;
    context.fill();
    context.strokeStyle = "rgba(205, 240, 235, 0.085)";
    context.lineWidth = 0.6;
    context.stroke();
  }
}

function drawImageVelocity(context, image, velocity, camera, width, height, scale, center) {
  const speed = Math.hypot(velocity.x, velocity.y, velocity.z);
  const origin = projectPoint(image, camera, width, height, scale, center);
  if (speed < 1e-7) {
    context.save();
    context.strokeStyle = palette.amber;
    context.lineWidth = 3;
    context.shadowColor = palette.amber;
    context.shadowBlur = 16;
    context.beginPath();
    context.arc(origin.x, origin.y, 14, 0, 2 * Math.PI);
    context.stroke();
    context.restore();
    return;
  }
  const tip3 = {
    x: image.x + (velocity.x / speed) * 0.3,
    y: image.y + (velocity.y / speed) * 0.3,
    z: image.z + (velocity.z / speed) * 0.3,
  };
  const tip = projectPoint(tip3, camera, width, height, scale, center);
  drawArrow(context, origin, { x: tip.x - origin.x, y: tip.y - origin.y }, 42, palette.cyan, "IMAGE VELOCITY");
}

function drawProbe(context, base, ghost, color = palette.coral) {
  if (!ghost || Math.hypot(ghost.x - base.x, ghost.y - base.y) < 0.5) return;
  context.save();
  context.setLineDash([5, 5]);
  context.strokeStyle = color;
  context.lineWidth = 1.5;
  context.beginPath();
  context.moveTo(base.x, base.y);
  context.lineTo(ghost.x, ghost.y);
  context.stroke();
  context.restore();
  drawMarker(context, ghost, color, 4.5);
}

function drawEdgeDomain() {
  const { context, width, height } = canvasFrame(ui.edgeDomain);
  clearCanvas(context, width, height);
  const transform = planeTransform(width, height, { xMin: -1.25, xMax: 1.25, yMin: -1.1, yMax: 1.1 });
  const zero = transform.point(0, 0);
  context.fillStyle = palette.coralSoft;
  context.fillRect(transform.left, transform.top, zero.x - transform.left, transform.height);
  context.fillStyle = palette.cyanSoft;
  context.fillRect(zero.x, transform.top, transform.left + transform.width - zero.x, transform.height);
  drawGrid(context, transform);
  context.save();
  context.shadowColor = palette.amber;
  context.shadowBlur = 13;
  drawPolyline(context, [transform.point(0, -1.1), transform.point(0, 1.1)], palette.amber, 4);
  context.restore();
  const sample = cuspidalEdgeSingularSample(edge.parameter);
  const selected = transform.point(sample.source.u, sample.source.v);
  drawArrow(context, selected, { x: 0, y: -1 }, 62, palette.cyan, "γ′");
  drawArrow(context, selected, { x: 1, y: 0 }, 62, palette.coral, "η", true);
  drawMarker(context, selected, palette.ink, 7);
  const probeSource = transform.point(
    sample.source.u + sample.nullDirection.u * edge.probeOffset,
    sample.source.v + sample.nullDirection.v * edge.probeOffset,
  );
  drawProbe(context, selected, probeSource);
}

function drawEdgeImage() {
  const { context, width, height } = canvasFrame(ui.edgeImage);
  clearCanvas(context, width, height);
  const scale = Math.min(width, height) * 0.235;
  const center = { x: 0.52, y: 0, z: 0 };
  drawSurface(context, width, height, {
    camera: edge,
    map: cuspidalEdgeMap,
    uMin: -1.18,
    uMax: 1.18,
    vMin: -1.08,
    vMax: 1.08,
    uSteps: 28,
    vSteps: 20,
    scale,
    center,
    side: (u) => u,
  });
  const edgePath = [];
  for (let index = 0; index <= 120; index += 1) {
    const parameter = mix(-1.08, 1.08, index / 120);
    edgePath.push(projectPoint(cuspidalEdgeMap(0, parameter), edge, width, height, scale, center));
  }
  context.save();
  context.shadowColor = palette.amber;
  context.shadowBlur = 12;
  drawPolyline(context, edgePath, palette.amber, 4);
  context.restore();
  const sample = cuspidalEdgeSingularSample(edge.parameter);
  const selected = projectPoint(sample.image, edge, width, height, scale, center);
  drawImageVelocity(context, sample.image, sample.imageVelocity, edge, width, height, scale, center);
  drawMarker(context, selected, palette.ink, 7);
  const probeImage = cuspidalEdgeMap(
    sample.source.u + sample.nullDirection.u * edge.probeOffset,
    sample.source.v + sample.nullDirection.v * edge.probeOffset,
  );
  drawProbe(context, selected, projectPoint(probeImage, edge, width, height, scale, center));
}

function updateEdgeReadout() {
  const sample = cuspidalEdgeSingularSample(edge.parameter);
  ui.edgeParameter.value = String(edge.parameter);
  ui.edgeSliderOutput.value = signed(edge.parameter, 2);
  ui.edgeParameterValue.textContent = `s = ${signed(edge.parameter, 3)}`;
  ui.edgeDetValue.textContent = `det(γ′,η) = ${signed(sample.determinant, 3)}`;
  ui.edgeSpeedValue.textContent = `|(f∘γ)′| = ${sample.imageSpeed.toFixed(3)}`;
  ui.edgeVerdict.dataset.state = "regular";
  ui.edgeVerdict.querySelector("b").textContent = "TRANSVERSE · NO CUSP POINT";
}

function drawSwallowDomain() {
  const { context, width, height } = canvasFrame(ui.swallowDomain);
  clearCanvas(context, width, height);
  const bounds = { xMin: -0.8, xMax: 0.8, yMin: -3.0, yMax: 0.45 };
  const transform = planeTransform(width, height, bounds);
  drawGrid(context, transform, 8, 8);
  const curve = [];
  for (let index = 0; index <= 180; index += 1) {
    const parameter = mix(-0.68, 0.68, index / 180);
    curve.push(transform.point(parameter, -6 * parameter * parameter));
  }
  context.save();
  context.shadowColor = palette.amber;
  context.shadowBlur = 13;
  drawPolyline(context, curve, palette.amber, 4);
  context.restore();
  const sample = swallowtailSingularSample(swallow.parameter);
  const selected = transform.point(sample.source.u, sample.source.v);
  const tangentEnd = transform.point(
    sample.source.u + sample.tangent.u * 0.1,
    sample.source.v + sample.tangent.v * 0.1,
  );
  const nullEnd = transform.point(sample.source.u + 0.2, sample.source.v);
  drawArrow(context, selected, { x: tangentEnd.x - selected.x, y: tangentEnd.y - selected.y }, 66, palette.cyan, "γ′");
  drawArrow(context, selected, { x: nullEnd.x - selected.x, y: nullEnd.y - selected.y }, 66, palette.coral, "η", true);
  drawMarker(context, selected, Math.abs(sample.determinant) < 0.03 ? palette.amber : palette.ink, 7);
  const probeSource = transform.point(
    sample.source.u + sample.nullDirection.u * swallow.probeOffset,
    sample.source.v,
  );
  drawProbe(context, selected, probeSource);
}

function drawSwallowImage() {
  const { context, width, height } = canvasFrame(ui.swallowImage);
  clearCanvas(context, width, height);
  const scale = Math.min(width, height) * 0.18;
  const center = { x: -0.12, y: 0, z: -1.05 };
  drawSurface(context, width, height, {
    camera: swallow,
    map: swallowtailMap,
    uMin: -0.72,
    uMax: 0.72,
    vMin: -2.9,
    vMax: 0.62,
    uSteps: 34,
    vSteps: 28,
    scale,
    center,
    side: (u, v) => v + 6 * u * u,
  });
  const curve = [];
  for (let index = 0; index <= 180; index += 1) {
    const parameter = mix(-0.68, 0.68, index / 180);
    curve.push(projectPoint(swallowtailSingularSample(parameter).image, swallow, width, height, scale, center));
  }
  context.save();
  context.shadowColor = palette.amber;
  context.shadowBlur = 12;
  drawPolyline(context, curve, palette.amber, 4);
  context.restore();
  const sample = swallowtailSingularSample(swallow.parameter);
  const selected = projectPoint(sample.image, swallow, width, height, scale, center);
  drawImageVelocity(context, sample.image, sample.imageVelocity, swallow, width, height, scale, center);
  drawMarker(context, selected, Math.abs(sample.determinant) < 0.03 ? palette.amber : palette.ink, 7);
  const probeImage = swallowtailMap(
    sample.source.u + sample.nullDirection.u * swallow.probeOffset,
    sample.source.v,
  );
  drawProbe(context, selected, projectPoint(probeImage, swallow, width, height, scale, center));
}

function updateSwallowReadout() {
  const sample = swallowtailSingularSample(swallow.parameter);
  const aligned = Math.abs(swallow.parameter) < 0.006;
  ui.swallowParameter.value = String(swallow.parameter);
  ui.swallowSliderOutput.value = signed(swallow.parameter, 2);
  ui.swallowParameterValue.textContent = `t = ${signed(swallow.parameter, 3)}`;
  ui.swallowDetValue.textContent = `det(γ′,η) = ${signed(sample.determinant, 3)}`;
  ui.swallowSpeedValue.textContent = `|(f∘γ)′| = ${sample.imageSpeed.toFixed(3)}`;
  ui.swallowVerdict.dataset.state = aligned ? "singular" : swallow.parameter < 0 ? "negative" : "positive";
  ui.swallowVerdict.querySelector("b").textContent = aligned
    ? "ALIGNMENT · SWALLOWTAIL"
    : swallow.parameter < 0
      ? "TRANSVERSE · det < 0"
      : "TRANSVERSE · det > 0";
  ui.swallowImageLabel.textContent = aligned ? "IMAGE STOPPED · TAIL TURN" : "IMAGE EDGE IS MOVING";
}

function projectorDomainTransform(width, height) {
  const padding = 34;
  const side = Math.min(width - 2 * padding, height - 2 * padding);
  const left = (width - side) / 2;
  const top = (height - side) / 2;
  return {
    left,
    top,
    width: side,
    height: side,
    side,
    point(kx, ky) {
      return {
        x: left + ((kx + PI) / (2 * PI)) * side,
        y: top + ((PI - ky) / (2 * PI)) * side,
      };
    },
  };
}

function foldSegments(samples = 240) {
  const segments = [];
  for (const [start, end] of [[-PI, -PI / 3], [PI / 3, PI]]) {
    for (const sign of [-1, 1]) {
      const points = [];
      for (let index = 0; index <= samples; index += 1) {
        const kx = mix(start, end, index / samples);
        const branches = foldKyAt(kx);
        if (!branches.length) continue;
        points.push({ kx, ky: sign < 0 ? branches[0] : branches.at(-1) });
      }
      segments.push(points);
    }
  }
  return segments;
}

const cachedFoldSegments = foldSegments();

function drawProjectorDomain() {
  const { context, width, height } = canvasFrame(ui.projectorDomain);
  clearCanvas(context, width, height);
  const transform = projectorDomainTransform(width, height);
  const cells = 54;
  const cell = transform.side / cells;
  for (let row = 0; row < cells; row += 1) {
    const ky = PI - (2 * PI * (row + 0.5)) / cells;
    for (let column = 0; column < cells; column += 1) {
      const kx = -PI + (2 * PI * (column + 0.5)) / cells;
      context.fillStyle = projectorDensity(kx, ky) >= 0 ? palette.cyanSoft : palette.coralSoft;
      context.fillRect(transform.left + column * cell, transform.top + row * cell, cell + 0.4, cell + 0.4);
    }
  }
  drawGrid(context, transform, 8, 8);
  context.save();
  context.shadowColor = palette.amber;
  context.shadowBlur = 13;
  for (const segment of cachedFoldSegments) {
    drawPolyline(context, segment.map(({ kx, ky }) => transform.point(kx, ky)), palette.amber, 4);
  }
  context.restore();
  for (const cusp of projectorCuspPoints()) {
    const point = transform.point(cusp.kx, cusp.ky);
    drawTriangle(context, point.x, point.y, 7, palette.amber, cusp.kx !== PI / 2 || cusp.ky !== PI / 2);
  }
  const sample = projectorFoldSample(projector.parameter);
  const selected = transform.point(sample.source.kx, sample.source.ky);
  drawArrow(context, selected, { x: sample.tangent.u, y: -sample.tangent.v }, 64, palette.cyan, "γ′");
  drawArrow(context, selected, { x: sample.nullDirection.u, y: -sample.nullDirection.v }, 64, palette.coral, "η", true);
  drawMarker(context, selected, Math.abs(sample.determinant) < 0.006 ? palette.amber : palette.ink, 7);
  const probe = transform.point(
    sample.source.kx + sample.nullDirection.u * projector.probeOffset,
    sample.source.ky + sample.nullDirection.v * projector.probeOffset,
  );
  drawProbe(context, selected, probe);

  context.fillStyle = palette.muted;
  context.font = "10px monospace";
  context.textAlign = "center";
  context.fillText("−π", transform.left, transform.top + transform.side + 18);
  context.fillText("0", transform.left + transform.side / 2, transform.top + transform.side + 18);
  context.fillText("π", transform.left + transform.side, transform.top + transform.side + 18);
  context.textAlign = "right";
  context.fillText("π", transform.left - 9, transform.top + 4);
  context.fillText("0", transform.left - 9, transform.top + transform.side / 2 + 4);
  context.fillText("−π", transform.left - 9, transform.top + transform.side + 4);
}

function spherePath(points, camera, width, height, scale, context, color, lineWidth) {
  let previous = null;
  for (const source of points) {
    const point = projectPoint(source, camera, width, height, scale);
    if (previous) {
      const frontFacing = (previous.depth + point.depth) / 2 >= 0;
      context.strokeStyle = frontFacing ? color : color.replace("1)", "0.22)");
      context.lineWidth = frontFacing ? lineWidth : Math.max(0.7, lineWidth * 0.55);
      context.beginPath();
      context.moveTo(previous.x, previous.y);
      context.lineTo(point.x, point.y);
      context.stroke();
    }
    previous = point;
  }
}

function drawSphere(context, width, height, camera, scale) {
  context.fillStyle = "rgba(102, 255, 225, 0.035)";
  context.strokeStyle = palette.gridStrong;
  context.lineWidth = 1.2;
  context.beginPath();
  context.arc(width / 2, height / 2, scale, 0, 2 * PI);
  context.fill();
  context.stroke();
  for (let latitude = -60; latitude <= 60; latitude += 30) {
    const phi = (latitude * PI) / 180;
    const points = [];
    for (let index = 0; index <= 120; index += 1) {
      const theta = (2 * PI * index) / 120;
      points.push({
        x: Math.cos(phi) * Math.cos(theta),
        y: Math.sin(phi),
        z: Math.cos(phi) * Math.sin(theta),
      });
    }
    spherePath(points, camera, width, height, scale, context, "rgba(151, 211, 205, 1)", 0.9);
  }
  for (let longitude = 0; longitude < 180; longitude += 30) {
    const theta = (longitude * PI) / 180;
    const points = [];
    for (let index = 0; index <= 120; index += 1) {
      const phi = -PI / 2 + (PI * index) / 120;
      points.push({
        x: Math.cos(phi) * Math.cos(theta),
        y: Math.sin(phi),
        z: Math.cos(phi) * Math.sin(theta),
      });
    }
    spherePath(points, camera, width, height, scale, context, "rgba(151, 211, 205, 1)", 0.9);
  }
}

function drawProjectorImage() {
  const { context, width, height } = canvasFrame(ui.projectorImage);
  clearCanvas(context, width, height);
  const scale = Math.min(width, height) * 0.37;
  drawSphere(context, width, height, projector, scale);
  context.save();
  context.shadowColor = palette.amber;
  context.shadowBlur = 8;
  for (const segment of cachedFoldSegments) {
    spherePath(segment.map(({ kx, ky }) => blochVector(kx, ky)), projector, width, height, scale, context, "rgba(255, 200, 95, 1)", 3.2);
  }
  context.restore();
  const sample = projectorFoldSample(projector.parameter);
  const selected = projectPoint(sample.image, projector, width, height, scale);
  drawImageVelocity(context, sample.image, sample.imageVelocity, projector, width, height, scale, { x: 0, y: 0, z: 0 });
  drawMarker(context, selected, Math.abs(sample.determinant) < 0.006 ? palette.amber : palette.ink, 7);
  const probeImage = blochVector(
    sample.source.kx + sample.nullDirection.u * projector.probeOffset,
    sample.source.ky + sample.nullDirection.v * projector.probeOffset,
  );
  drawProbe(context, selected, projectPoint(probeImage, projector, width, height, scale));
}

function updateProjectorReadout() {
  const sample = projectorFoldSample(projector.parameter);
  const aligned = Math.abs(projector.parameter) < 0.004;
  ui.projectorParameter.value = String(projector.parameter);
  ui.projectorSliderOutput.value = signed(projector.parameter, 2);
  ui.projectorParameterValue.textContent = `r = ${signed(projector.parameter, 3)}`;
  ui.projectorDetValue.textContent = `det(γ′,η) = ${signed(sample.determinant, 3)}`;
  ui.projectorSpeedValue.textContent = `|(P∘γ)′| = ${sample.imageSpeed.toFixed(3)}`;
  ui.projectorVerdict.dataset.state = aligned ? "singular" : sample.determinant > 0 ? "positive" : "negative";
  ui.projectorVerdict.querySelector("b").textContent = aligned
    ? "ALIGNMENT · WHITNEY CUSP"
    : "TRANSVERSE · ORDINARY FOLD";
  ui.projectorImageLabel.textContent = aligned ? "P(Σ) STOPPED · CUSP" : "P(Σ) IS STILL MOVING";
}

function pointerPosition(event, canvas) {
  const rectangle = canvas.getBoundingClientRect();
  return {
    x: event.clientX - rectangle.left,
    y: event.clientY - rectangle.top,
    width: rectangle.width,
    height: rectangle.height,
  };
}

function bindCurveDrag(canvas, update) {
  let dragging = false;
  canvas.addEventListener("pointerdown", (event) => {
    animation = null;
    dragging = true;
    canvas.setPointerCapture(event.pointerId);
    update(pointerPosition(event, canvas));
  });
  canvas.addEventListener("pointermove", (event) => {
    if (dragging) update(pointerPosition(event, canvas));
  });
  const release = (event) => {
    dragging = false;
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
  };
  canvas.addEventListener("pointerup", release);
  canvas.addEventListener("pointercancel", release);
}

function bindCameraDrag(canvas, camera) {
  let dragging = false;
  let previous = null;
  canvas.addEventListener("pointerdown", (event) => {
    dragging = true;
    previous = { x: event.clientX, y: event.clientY };
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener("pointermove", (event) => {
    if (!dragging) return;
    camera.yaw += (event.clientX - previous.x) * 0.008;
    camera.pitch = clamp(camera.pitch + (event.clientY - previous.y) * 0.008, -1.2, 1.2);
    previous = { x: event.clientX, y: event.clientY };
  });
  const release = (event) => {
    dragging = false;
    previous = null;
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
  };
  canvas.addEventListener("pointerup", release);
  canvas.addEventListener("pointercancel", release);
}

function selectStage(stage) {
  activeStage = stage;
  animation = null;
  const selected = {
    edge: ui.edgeTab,
    swallow: ui.swallowTab,
    projector: ui.projectorTab,
  };
  for (const [id, tab] of Object.entries(selected)) {
    tab.setAttribute("aria-selected", String(id === stage));
  }
  ui.edgeExample.hidden = stage !== "edge";
  ui.swallowExample.hidden = stage !== "swallow";
  ui.projectorExample.hidden = stage !== "projector";
}

function startFollow(stage) {
  const ranges = {
    edge: [-1, 1, 3200],
    swallow: [-0.68, 0.68, 4400],
    projector: [-0.34, 0.34, 4400],
  };
  const [from, to, duration] = ranges[stage];
  animation = { kind: "follow", stage, from, to, duration, started: performance.now() };
}

function startProbe(stage) {
  animation = { kind: "probe", stage, duration: 1900, started: performance.now() };
}

function updateAnimation(now) {
  edge.probeOffset = 0;
  swallow.probeOffset = 0;
  projector.probeOffset = 0;
  if (!animation) return;
  const raw = clamp((now - animation.started) / animation.duration, 0, 1);
  if (animation.kind === "follow") {
    const amount = easeInOut(raw);
    const state = animation.stage === "edge" ? edge : animation.stage === "swallow" ? swallow : projector;
    state.parameter = mix(animation.from, animation.to, amount);
  } else {
    const state = animation.stage === "edge" ? edge : animation.stage === "swallow" ? swallow : projector;
    const amplitude = animation.stage === "projector" ? 0.22 : 0.3;
    state.probeOffset = Math.sin(raw * PI * 2) * amplitude;
  }
  if (raw >= 1) animation = null;
}

ui.edgeTab.addEventListener("click", () => selectStage("edge"));
ui.swallowTab.addEventListener("click", () => selectStage("swallow"));
ui.projectorTab.addEventListener("click", () => selectStage("projector"));

ui.edgeParameter.addEventListener("input", () => {
  animation = null;
  edge.parameter = Number(ui.edgeParameter.value);
});
ui.swallowParameter.addEventListener("input", () => {
  animation = null;
  swallow.parameter = Number(ui.swallowParameter.value);
});
ui.projectorParameter.addEventListener("input", () => {
  animation = null;
  projector.parameter = Number(ui.projectorParameter.value);
});

bindCurveDrag(ui.edgeDomain, ({ y, height }) => {
  const padding = 34;
  edge.parameter = clamp(1.1 - ((y - padding) / Math.max(1, height - 2 * padding)) * 2.2, -1, 1);
});
bindCurveDrag(ui.swallowDomain, ({ x, width }) => {
  const padding = 34;
  swallow.parameter = clamp(((x - padding) / Math.max(1, width - 2 * padding)) * 1.6 - 0.8, -0.68, 0.68);
});
bindCurveDrag(ui.projectorDomain, ({ x, width, height }) => {
  const transform = projectorDomainTransform(width, height);
  const kx = ((x - transform.left) / transform.side) * 2 * PI - PI;
  projector.parameter = clamp(kx - PI / 2, -0.34, 0.34);
});

bindCameraDrag(ui.edgeImage, edge);
bindCameraDrag(ui.swallowImage, swallow);
bindCameraDrag(ui.projectorImage, projector);

ui.edgeProbe.addEventListener("click", () => startProbe("edge"));
ui.edgePlay.addEventListener("click", () => startFollow("edge"));
ui.swallowProbe.addEventListener("click", () => startProbe("swallow"));
ui.swallowPlay.addEventListener("click", () => startFollow("swallow"));
ui.projectorProbe.addEventListener("click", () => startProbe("projector"));
ui.projectorPlay.addEventListener("click", () => startFollow("projector"));

function render(now) {
  updateAnimation(now);
  if (activeStage === "edge") {
    drawEdgeDomain();
    drawEdgeImage();
    updateEdgeReadout();
  } else if (activeStage === "swallow") {
    drawSwallowDomain();
    drawSwallowImage();
    updateSwallowReadout();
  } else {
    drawProjectorDomain();
    drawProjectorImage();
    updateProjectorReadout();
  }
  requestAnimationFrame(render);
}

requestAnimationFrame(render);
