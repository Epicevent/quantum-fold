import {
  bzCoordinates,
  cuspPoints,
  fieldEffectAt,
  findSourcesForState,
  foldBranchesAtU,
  mapToState,
  metricDeterminant,
  orientationValue,
} from "./game.js";

const slider = document.querySelector("#scene-slider");
const presetButtons = [...document.querySelectorAll("[data-scene-v]")];
const sceneLab = document.querySelector(".scene-lab");
const vOutput = document.querySelector("#scene-v");
const sourcePoint = document.querySelector("#scene-source-point");
const sourceLabel = document.querySelector("#scene-source-label");
const sourceGuide = document.querySelector("#scene-source-guide");
const blochPoint = document.querySelector("#scene-bloch-point");
const blochLabel = document.querySelector("#scene-bloch-label");
const blochTrace = document.querySelector("#scene-bloch-trace");
const negativeRegion = document.querySelector("#scene-negative-region");
const foldTop = document.querySelector("#scene-fold-top");
const foldBottom = document.querySelector("#scene-fold-bottom");
const cuspGroup = document.querySelector("#scene-cusps");
const kReceipt = document.querySelector("#scene-k");
const nReceipt = document.querySelector("#scene-n");
const densityReceipt = document.querySelector("#scene-density");
const determinantReceipt = document.querySelector("#scene-det");
const multiplicityReceipt = document.querySelector("#scene-multiplicity");
const eventReceipt = document.querySelector("#scene-event");

const NS = "http://www.w3.org/2000/svg";
const sourceU = 0.6;
const domainBounds = { left: 22, top: 18, width: 316, height: 226 };

function formatSigned(value, precision = 3) {
  const fixed = Math.abs(value).toFixed(precision);
  if (value > 0) return `+${fixed}`;
  if (value < 0) return `−${fixed}`;
  return Number(fixed).toFixed(precision);
}

function domainPoint(source) {
  return {
    x: domainBounds.left + source.u * domainBounds.width,
    y: domainBounds.top + source.v * domainBounds.height,
  };
}

function spherePoint(state) {
  return {
    x: 180 + state.x * 98,
    y: 132 - state.z * 98,
  };
}

function path(points, close = false) {
  if (!points.length) return "";
  const commands = points.map((point, index) => (
    `${index === 0 ? "M" : "L"}${point.x.toFixed(2)},${point.y.toFixed(2)}`
  ));
  if (close) commands.push("Z");
  return commands.join(" ");
}

function drawDomainGeometry() {
  const upper = [];
  const lower = [];
  for (let index = 0; index <= 720; index += 1) {
    const u = index / 720;
    const branches = foldBranchesAtU(u);
    if (branches.length !== 2) continue;
    upper.push(domainPoint({ u, v: branches[0] }));
    lower.push(domainPoint({ u, v: branches[1] }));
  }

  foldTop.setAttribute("d", path(upper));
  foldBottom.setAttribute("d", path(lower));
  negativeRegion.setAttribute("d", path([...upper, ...lower.reverse()], true));

  for (const cusp of cuspPoints()) {
    const point = domainPoint(cusp);
    const polygon = document.createElementNS(NS, "polygon");
    polygon.setAttribute("points", `${point.x},${point.y - 6} ${point.x + 6},${point.y + 5} ${point.x - 6},${point.y + 5}`);
    cuspGroup.append(polygon);
  }

  const guideX = domainPoint({ u: sourceU, v: 0 }).x;
  sourceGuide.setAttribute("x1", guideX);
  sourceGuide.setAttribute("x2", guideX);
  sourceGuide.setAttribute("y1", domainBounds.top);
  sourceGuide.setAttribute("y2", domainBounds.top + domainBounds.height);
}

function drawBlochTrace() {
  const samples = [];
  for (let index = 0; index <= 220; index += 1) {
    const v = 0.15 + (0.6 - 0.15) * index / 220;
    samples.push(spherePoint(mapToState({ u: sourceU, v })));
  }
  blochTrace.setAttribute("d", path(samples));
}

function updateScene() {
  const source = { u: sourceU, v: Number(slider.value) };
  const mapped = mapToState(source);
  const density = orientationValue(source.u, source.v);
  const determinant = metricDeterminant(source.u, source.v);
  const effect = fieldEffectAt(source);
  const multiplicity = findSourcesForState(mapped).length;
  const { kx, ky } = bzCoordinates(source);
  const domain = domainPoint(source);
  const sphere = spherePoint(mapped);

  sourcePoint.setAttribute("cx", domain.x);
  sourcePoint.setAttribute("cy", domain.y);
  sourceLabel.setAttribute("x", domain.x);
  sourceLabel.setAttribute("y", Math.max(15, domain.y - 13));
  blochPoint.setAttribute("cx", sphere.x);
  blochPoint.setAttribute("cy", sphere.y);
  blochLabel.setAttribute("x", sphere.x);
  blochLabel.setAttribute("y", Math.max(15, sphere.y - 13));

  vOutput.value = source.v.toFixed(3);
  for (const button of presetButtons) {
    const selected = Math.abs(Number(button.dataset.sceneV) - source.v) < 0.0005;
    button.setAttribute("aria-pressed", String(selected));
  }
  kReceipt.textContent = `k=(${formatSigned(kx / Math.PI, 3)}π, ${formatSigned(ky / Math.PI, 3)}π)`;
  nReceipt.textContent = `n=(${formatSigned(mapped.x)}, ${formatSigned(mapped.y)}, ${formatSigned(mapped.z)})`;
  densityReceipt.textContent = `λ̄=${formatSigned(density, 6)}`;
  determinantReceipt.textContent = `det g=${determinant.toExponential(3)}`;
  multiplicityReceipt.textContent = `${multiplicity} source${multiplicity === 1 ? "" : "s"}`;
  sceneLab.dataset.kind = effect.kind;

  if (effect.kind === "fold") {
    eventReceipt.textContent = "노란 선에서 이 작은 BZ patch의 mapped area가 거의 0으로 눌린다. damage나 packet 획득은 없다.";
  } else if (effect.kind === "reversed") {
    eventReceipt.textContent = "선을 건넌 뒤 같은 크기의 BZ cell이 oriented Bloch area에서 음수로 빠진다.";
  } else {
    eventReceipt.textContent = "이 BZ cell이 만드는 oriented Bloch area는 양수로 더해진다.";
  }
}

drawDomainGeometry();
drawBlochTrace();
updateScene();
slider.addEventListener("input", updateScene);
for (const button of presetButtons) {
  button.addEventListener("click", () => {
    slider.value = button.dataset.sceneV;
    updateScene();
  });
}
