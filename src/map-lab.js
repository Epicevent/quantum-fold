import {
  PI,
  blochVector,
  cuspidalEdgeDensity,
  cuspidalEdgeMap,
  cuspidalEdgeRank,
  foldKyAt,
  formatPi,
  nearestFoldPoint,
  projectorCuspPoints,
  projectorDensity,
} from "./map-lab-math.js";

const front = {
  u: 0.72,
  v: 0.2,
  yaw: -0.72,
  pitch: 0.46,
};

const projector = {
  kx: 0.7 * PI,
  ky: 0.1 * PI,
  yaw: -0.55,
  pitch: 0.32,
};

const ui = {
  frontTab: document.querySelector("#front-tab"),
  projectorTab: document.querySelector("#projector-tab"),
  frontExample: document.querySelector("#front-example"),
  projectorExample: document.querySelector("#projector-example"),
  frontDomain: document.querySelector("#front-domain"),
  frontImage: document.querySelector("#front-image"),
  projectorDomain: document.querySelector("#projector-domain"),
  projectorImage: document.querySelector("#projector-image"),
  frontSourceValue: document.querySelector("#front-source-value"),
  frontImageValue: document.querySelector("#front-image-value"),
  frontRankBox: document.querySelector("#front-rank-box"),
  frontRankValue: document.querySelector("#front-rank-value"),
  projectorSourceValue: document.querySelector("#projector-source-value"),
  projectorImageValue: document.querySelector("#projector-image-value"),
  projectorRankBox: document.querySelector("#projector-rank-box"),
  projectorRankValue: document.querySelector("#projector-rank-value"),
  frontOnCurve: document.querySelector("#front-on-curve"),
  frontCross: document.querySelector("#front-cross"),
  projectorOnCurve: document.querySelector("#projector-on-curve"),
  projectorOnCusp: document.querySelector("#projector-on-cusp"),
  projectorCross: document.querySelector("#projector-cross"),
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

function canvasFrame(canvas) {
  const rect = canvas.getBoundingClientRect();
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.max(1, Math.round(rect.width));
  const height = Math.max(1, Math.round(rect.height));
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

function projectPoint(point, camera, width, height, scale) {
  const rotated = rotatePoint(point, camera.yaw, camera.pitch);
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

function drawFrontDomain() {
  const { context, width, height } = canvasFrame(ui.frontDomain);
  clearCanvas(context, width, height);
  const padding = 34;
  const plotWidth = width - 2 * padding;
  const plotHeight = height - 2 * padding;
  const toCanvas = (u, v) => ({
    x: padding + ((u + 1.35) / 2.7) * plotWidth,
    y: padding + ((1.1 - v) / 2.2) * plotHeight,
  });

  const zero = toCanvas(0, 0);
  context.fillStyle = palette.coralSoft;
  context.fillRect(padding, padding, zero.x - padding, plotHeight);
  context.fillStyle = palette.cyanSoft;
  context.fillRect(zero.x, padding, padding + plotWidth - zero.x, plotHeight);

  context.strokeStyle = palette.grid;
  context.lineWidth = 1;
  for (let index = 0; index <= 8; index += 1) {
    const x = padding + (plotWidth * index) / 8;
    context.beginPath();
    context.moveTo(x, padding);
    context.lineTo(x, padding + plotHeight);
    context.stroke();
  }
  for (let index = 0; index <= 6; index += 1) {
    const y = padding + (plotHeight * index) / 6;
    context.beginPath();
    context.moveTo(padding, y);
    context.lineTo(padding + plotWidth, y);
    context.stroke();
  }

  context.strokeStyle = palette.gridStrong;
  context.strokeRect(padding, padding, plotWidth, plotHeight);
  context.strokeStyle = palette.amber;
  context.lineWidth = 4;
  context.shadowColor = palette.amber;
  context.shadowBlur = 14;
  context.beginPath();
  context.moveTo(zero.x, padding);
  context.lineTo(zero.x, padding + plotHeight);
  context.stroke();
  context.shadowBlur = 0;

  context.fillStyle = palette.muted;
  context.font = "11px monospace";
  context.textAlign = "left";
  context.fillText("u < 0", padding + 10, padding + plotHeight - 10);
  context.textAlign = "right";
  context.fillText("u > 0", padding + plotWidth - 10, padding + plotHeight - 10);
  context.textAlign = "center";
  context.fillText("u", padding + plotWidth / 2, height - 9);
  context.textAlign = "right";
  context.fillText("v", padding - 9, padding + 10);

  const selected = toCanvas(front.u, front.v);
  drawMarker(context, selected, Math.abs(front.u) < 1e-7 ? palette.amber : palette.ink, 7);
}

function drawFrontImage() {
  const { context, width, height } = canvasFrame(ui.frontImage);
  clearCanvas(context, width, height);
  const camera = front;
  const scale = Math.min(width, height) * 0.25;
  const polygons = [];
  const uSteps = 16;
  const vSteps = 20;
  const addHalf = (uStart, uEnd, fill) => {
    for (let uiIndex = 0; uiIndex < uSteps; uiIndex += 1) {
      const u0 = mix(uStart, uEnd, uiIndex / uSteps);
      const u1 = mix(uStart, uEnd, (uiIndex + 1) / uSteps);
      for (let vi = 0; vi < vSteps; vi += 1) {
        const v0 = mix(-1.1, 1.1, vi / vSteps);
        const v1 = mix(-1.1, 1.1, (vi + 1) / vSteps);
        const corners = [
          cuspidalEdgeMap(u0, v0),
          cuspidalEdgeMap(u1, v0),
          cuspidalEdgeMap(u1, v1),
          cuspidalEdgeMap(u0, v1),
        ].map((point) => projectPoint(point, camera, width, height, scale));
        polygons.push({
          corners,
          fill,
          depth: corners.reduce((sum, point) => sum + point.depth, 0) / corners.length,
        });
      }
    }
  };
  addHalf(0, 1.2, palette.cyanSurface);
  addHalf(-1.2, 0, palette.coralSurface);
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
    context.strokeStyle = "rgba(205, 240, 235, 0.09)";
    context.lineWidth = 0.65;
    context.stroke();
  }

  const edge = [];
  for (let index = 0; index <= 100; index += 1) {
    edge.push(projectPoint(cuspidalEdgeMap(0, mix(-1.1, 1.1, index / 100)), camera, width, height, scale));
  }
  context.save();
  context.shadowColor = palette.amber;
  context.shadowBlur = 13;
  drawPolyline(context, edge, palette.amber, 4);
  context.restore();

  const mapped = projectPoint(cuspidalEdgeMap(front.u, front.v), camera, width, height, scale);
  drawMarker(context, mapped, Math.abs(front.u) < 1e-7 ? palette.amber : palette.ink, 7);
}

function updateFrontReadout() {
  const image = cuspidalEdgeMap(front.u, front.v);
  const density = cuspidalEdgeDensity(front.u);
  const singular = cuspidalEdgeRank(front.u, 1e-7) === 1;
  ui.frontSourceValue.textContent = `(u,v) = (${front.u.toFixed(2)}, ${front.v.toFixed(2)})`;
  ui.frontImageValue.textContent = `f = (${image.x.toFixed(2)}, ${image.y.toFixed(2)}, ${image.z.toFixed(2)})`;
  ui.frontRankBox.dataset.state = singular ? "singular" : front.u > 0 ? "positive" : "negative";
  ui.frontRankValue.textContent = singular
    ? "u = 0 · rank df = 1 · SINGULAR"
    : `λ = ${density.toFixed(3)} · rank df = 2`;
}

function projectorDomainTransform(width, height) {
  const padding = 34;
  const side = Math.min(width - 2 * padding, height - 2 * padding);
  const left = (width - side) / 2;
  const top = (height - side) / 2;
  return {
    left,
    top,
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
        const kyCandidates = foldKyAt(kx);
        if (!kyCandidates.length) continue;
        const ky = sign < 0 ? kyCandidates[0] : kyCandidates.at(-1);
        points.push({ kx, ky });
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

  context.strokeStyle = palette.grid;
  context.lineWidth = 1;
  for (let index = 0; index <= 8; index += 1) {
    const coordinate = transform.left + (transform.side * index) / 8;
    context.beginPath();
    context.moveTo(coordinate, transform.top);
    context.lineTo(coordinate, transform.top + transform.side);
    context.stroke();
    const horizontal = transform.top + (transform.side * index) / 8;
    context.beginPath();
    context.moveTo(transform.left, horizontal);
    context.lineTo(transform.left + transform.side, horizontal);
    context.stroke();
  }

  context.strokeStyle = palette.gridStrong;
  context.lineWidth = 1.5;
  context.strokeRect(transform.left, transform.top, transform.side, transform.side);

  context.save();
  context.strokeStyle = palette.amber;
  context.lineWidth = 4;
  context.shadowColor = palette.amber;
  context.shadowBlur = 13;
  for (const segment of cachedFoldSegments) {
    drawPolyline(context, segment.map(({ kx, ky }) => transform.point(kx, ky)), palette.amber, 4);
  }
  context.restore();

  for (const cusp of projectorCuspPoints()) {
    const point = transform.point(cusp.kx, cusp.ky);
    drawTriangle(context, point.x, point.y, 7, palette.amber, true);
  }

  const selected = transform.point(projector.kx, projector.ky);
  const singular = Math.abs(projectorDensity(projector.kx, projector.ky)) < 1e-7;
  drawMarker(context, selected, singular ? palette.amber : palette.ink, 7);

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
  context.fillStyle = palette.amber;
  context.textAlign = "center";
  context.fillText("↔ periodic ↔", transform.left + transform.side / 2, transform.top - 12);
  context.save();
  context.translate(transform.left + transform.side + 18, transform.top + transform.side / 2);
  context.rotate(Math.PI / 2);
  context.fillText("↔ periodic ↔", 0, 0);
  context.restore();
}

function spherePath(points, camera, width, height, scale, context, color, lineWidth) {
  let previous = null;
  for (const source of points) {
    const point = projectPoint(source, camera, width, height, scale);
    if (previous) {
      const frontFacing = (previous.depth + point.depth) / 2 >= 0;
      context.strokeStyle = frontFacing ? color : color.replace("1)", "0.24)");
      context.lineWidth = frontFacing ? lineWidth : Math.max(0.7, lineWidth * 0.55);
      context.beginPath();
      context.moveTo(previous.x, previous.y);
      context.lineTo(point.x, point.y);
      context.stroke();
    }
    previous = point;
  }
}

function drawProjectorImage() {
  const { context, width, height } = canvasFrame(ui.projectorImage);
  clearCanvas(context, width, height);
  const scale = Math.min(width, height) * 0.37;
  const camera = projector;

  context.fillStyle = "rgba(102, 255, 225, 0.035)";
  context.strokeStyle = palette.gridStrong;
  context.lineWidth = 1.2;
  context.beginPath();
  context.arc(width / 2, height / 2, scale, 0, Math.PI * 2);
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

  context.save();
  context.shadowColor = palette.amber;
  context.shadowBlur = 8;
  for (const segment of cachedFoldSegments) {
    const points = segment.map(({ kx, ky }) => blochVector(kx, ky));
    spherePath(points, camera, width, height, scale, context, "rgba(255, 200, 95, 1)", 3.2);
  }
  context.restore();

  for (const cusp of projectorCuspPoints()) {
    const point = projectPoint(blochVector(cusp.kx, cusp.ky), camera, width, height, scale);
    if (point.depth >= -0.05) drawTriangle(context, point.x, point.y, 6, palette.amber, true);
  }

  const vector = blochVector(projector.kx, projector.ky);
  const origin = projectPoint({ x: 0, y: 0, z: 0 }, camera, width, height, scale);
  const selected = projectPoint(vector, camera, width, height, scale);
  context.strokeStyle = "rgba(228, 250, 247, 0.38)";
  context.lineWidth = 1.2;
  context.beginPath();
  context.moveTo(origin.x, origin.y);
  context.lineTo(selected.x, selected.y);
  context.stroke();
  drawMarker(context, selected, Math.abs(projectorDensity(projector.kx, projector.ky)) < 1e-7 ? palette.amber : palette.ink, 7);
}

function cuspDistance(kx, ky) {
  return Math.min(...projectorCuspPoints().map((point) => Math.hypot(point.kx - kx, point.ky - ky)));
}

function updateProjectorReadout() {
  const image = blochVector(projector.kx, projector.ky);
  const density = projectorDensity(projector.kx, projector.ky);
  const singular = Math.abs(density) < 1e-7;
  const cusp = singular && cuspDistance(projector.kx, projector.ky) < 1e-6;
  ui.projectorSourceValue.textContent = `k = (${formatPi(projector.kx)}, ${formatPi(projector.ky)})`;
  ui.projectorImageValue.textContent = `n = (${image.x.toFixed(2)}, ${image.y.toFixed(2)}, ${image.z.toFixed(2)})`;
  ui.projectorRankBox.dataset.state = singular ? "singular" : density > 0 ? "positive" : "negative";
  if (cusp) {
    ui.projectorRankValue.textContent = "cusp point on Σ · λ̄ = 0 · rank dP = 1";
  } else if (singular) {
    ui.projectorRankValue.textContent = "ordinary fold on Σ · λ̄ = 0 · rank dP = 1";
  } else {
    ui.projectorRankValue.textContent = `λ̄ = ${density >= 0 ? "+" : ""}${density.toFixed(4)} · rank dP = 2`;
  }
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

function bindDomainDrag(canvas, update) {
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

function selectTab(selected) {
  const frontSelected = selected === "front";
  ui.frontTab.setAttribute("aria-selected", String(frontSelected));
  ui.projectorTab.setAttribute("aria-selected", String(!frontSelected));
  ui.frontExample.hidden = !frontSelected;
  ui.projectorExample.hidden = frontSelected;
}

function animateFrontCrossing() {
  front.u = 0.82;
  animation = {
    kind: "front-cross",
    started: performance.now(),
    duration: 2200,
  };
}

function animateProjectorCrossing() {
  projector.kx = 0.72 * PI;
  const fold = foldKyAt(projector.kx).at(-1);
  projector.ky = fold - 0.42;
  animation = {
    kind: "projector-cross",
    fold,
    started: performance.now(),
    duration: 2400,
  };
}

function updateAnimation(now) {
  if (!animation) return;
  const raw = clamp((now - animation.started) / animation.duration, 0, 1);
  const amount = easeInOut(raw);
  if (animation.kind === "front-cross") front.u = mix(0.82, -0.82, amount);
  if (animation.kind === "projector-cross") projector.ky = mix(animation.fold - 0.42, animation.fold + 0.42, amount);
  if (raw >= 1) animation = null;
}

ui.frontTab.addEventListener("click", () => selectTab("front"));
ui.projectorTab.addEventListener("click", () => selectTab("projector"));

bindDomainDrag(ui.frontDomain, ({ x, y, width, height }) => {
  const padding = 34;
  front.u = clamp(((x - padding) / Math.max(1, width - 2 * padding)) * 2.7 - 1.35, -1.35, 1.35);
  front.v = clamp(1.1 - ((y - padding) / Math.max(1, height - 2 * padding)) * 2.2, -1.1, 1.1);
  if (Math.abs(front.u) < 0.055) front.u = 0;
});

bindDomainDrag(ui.projectorDomain, ({ x, y, width, height }) => {
  const transform = projectorDomainTransform(width, height);
  projector.kx = clamp(((x - transform.left) / transform.side) * 2 * PI - PI, -PI, PI);
  projector.ky = clamp(PI - ((y - transform.top) / transform.side) * 2 * PI, -PI, PI);
  const nearest = nearestFoldPoint(projector.kx, projector.ky, 360);
  if (nearest && nearest.distance < 0.08) {
    projector.kx = nearest.kx;
    projector.ky = nearest.ky;
  }
});

bindCameraDrag(ui.frontImage, front);
bindCameraDrag(ui.projectorImage, projector);

ui.frontOnCurve.addEventListener("click", () => {
  animation = null;
  front.u = 0;
});
ui.frontCross.addEventListener("click", animateFrontCrossing);
ui.projectorOnCurve.addEventListener("click", () => {
  animation = null;
  projector.kx = 0.72 * PI;
  projector.ky = foldKyAt(projector.kx).at(-1);
});
ui.projectorOnCusp.addEventListener("click", () => {
  animation = null;
  projector.kx = PI / 2;
  projector.ky = PI / 2;
});
ui.projectorCross.addEventListener("click", animateProjectorCrossing);

function render(now) {
  updateAnimation(now);
  if (!ui.frontExample.hidden) {
    drawFrontDomain();
    drawFrontImage();
    updateFrontReadout();
  }
  if (!ui.projectorExample.hidden) {
    drawProjectorDomain();
    drawProjectorImage();
    updateProjectorReadout();
  }
  requestAnimationFrame(render);
}

requestAnimationFrame(render);
