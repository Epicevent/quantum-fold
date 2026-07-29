import {
  TAU,
  findSourcesForState,
  foldAmplitude,
  foldBranchesAtU,
  foldPhase,
  orientationValue,
} from "./game.js";

const slider = document.querySelector("#u-slider");
const uValue = document.querySelector("#u-value");
const amplitudeValue = document.querySelector("#amplitude-value");
const multiplicityValue = document.querySelector("#multiplicity-value");
const degreeValue = document.querySelector("#degree-value");
const conclusion = document.querySelector("#live-conclusion");
const rootTable = document.querySelector("#root-table");
const gridGroup = document.querySelector("#plot-grid");
const identityLine = document.querySelector("#identity-line");
const targetLine = document.querySelector("#target-line");
const foldCurve = document.querySelector("#fold-curve");
const criticalMarks = document.querySelector("#critical-marks");
const rootMarks = document.querySelector("#root-marks");

const NS = "http://www.w3.org/2000/svg";
const bounds = { left: 64, right: 704, top: 34, bottom: 374 };
const targetV = 0.5;

function xScale(value) {
  return bounds.left + value * (bounds.right - bounds.left);
}

function yScale(value) {
  return bounds.bottom - value * (bounds.bottom - bounds.top);
}

function makeSvg(name, attributes = {}) {
  const element = document.createElementNS(NS, name);
  for (const [key, value] of Object.entries(attributes)) {
    element.setAttribute(key, String(value));
  }
  return element;
}

function pathFor(points) {
  return points.map((point, index) => `${index === 0 ? "M" : "L"}${xScale(point.x).toFixed(2)},${yScale(point.y).toFixed(2)}`).join(" ");
}

function drawStaticFrame() {
  for (let tick = 0; tick <= 4; tick += 1) {
    const value = tick / 4;
    gridGroup.append(makeSvg("line", {
      x1: xScale(value), y1: bounds.top, x2: xScale(value), y2: bounds.bottom, class: "grid-line",
    }));
    gridGroup.append(makeSvg("line", {
      x1: bounds.left, y1: yScale(value), x2: bounds.right, y2: yScale(value), class: "grid-line",
    }));
    const xLabel = makeSvg("text", { x: xScale(value), y: bounds.bottom + 20, class: "root-label" });
    xLabel.textContent = value.toFixed(2);
    gridGroup.append(xLabel);
    const yLabel = makeSvg("text", { x: bounds.left - 15, y: yScale(value) + 4, class: "root-label" });
    yLabel.textContent = value.toFixed(2);
    gridGroup.append(yLabel);
  }
  identityLine.setAttribute("d", pathFor([{ x: 0, y: 0 }, { x: 1, y: 1 }]));
  targetLine.setAttribute("d", pathFor([{ x: 0, y: targetV }, { x: 1, y: targetV }]));
}

function rootShape(root, sign) {
  const x = xScale(root);
  const y = yScale(targetV);
  if (sign > 0) {
    return makeSvg("circle", { cx: x, cy: y, r: 8, class: "root-positive" });
  }
  return makeSvg("rect", {
    x: x - 7, y: y - 7, width: 14, height: 14,
    transform: `rotate(45 ${x} ${y})`, class: "root-negative",
  });
}

function formatSign(value) {
  return value > 0 ? `+${value.toFixed(6)}` : value.toFixed(6).replace("-", "−");
}

function updatePlot() {
  const u = Number(slider.value);
  const amplitude = foldAmplitude(u);
  const roots = findSourcesForState(u, targetV);
  const signedDegree = roots.reduce((sum, root) => sum + Math.sign(orientationValue(u, root)), 0);
  const samples = Array.from({ length: 321 }, (_, index) => {
    const v = index / 320;
    return { x: v, y: foldPhase(u, v) };
  });

  foldCurve.setAttribute("d", pathFor(samples));
  rootMarks.replaceChildren();
  criticalMarks.replaceChildren();
  rootTable.replaceChildren();

  for (const branch of foldBranchesAtU(u)) {
    const x = xScale(branch);
    const y = yScale(foldPhase(u, branch));
    criticalMarks.append(makeSvg("rect", {
      x: x - 5, y: y - 5, width: 10, height: 10,
      transform: `rotate(45 ${x} ${y})`, class: "critical",
    }));
  }

  for (const [index, root] of roots.entries()) {
    const jacobian = orientationValue(u, root);
    const sign = Math.sign(jacobian);
    rootMarks.append(rootShape(root, sign));
    const label = makeSvg("text", {
      x: xScale(root), y: yScale(targetV) - 15 - (index % 2) * 5, class: "root-label",
    });
    label.textContent = sign > 0 ? "+" : "−";
    rootMarks.append(label);

    const row = document.createElement("tr");
    const vCell = document.createElement("td");
    const jCell = document.createElement("td");
    const signCell = document.createElement("td");
    vCell.textContent = root.toFixed(6);
    jCell.textContent = formatSign(jacobian);
    signCell.textContent = sign > 0 ? "+1" : "−1";
    signCell.className = sign > 0 ? "positive" : "negative";
    row.append(vCell, jCell, signCell);
    rootTable.append(row);
  }

  uValue.value = u.toFixed(3);
  amplitudeValue.textContent = amplitude.toFixed(3);
  multiplicityValue.textContent = String(roots.length);
  degreeValue.textContent = signedDegree > 0 ? `+${signedDegree}` : String(signedDegree);
  conclusion.textContent = roots.length === 3
    ? "세 겹이 보이지만 부호는 +, −, +이므로 signed multiplicity는 1이다."
    : "겹은 하나뿐이고 그 orientation은 +이므로 signed multiplicity는 여전히 1이다.";
}

drawStaticFrame();
updatePlot();
slider.addEventListener("input", updatePlot);
