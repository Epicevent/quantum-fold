import {
  bzCoordinates,
  foldBranchesAtU,
  orientationValue,
} from "./game.js";

const slider = document.querySelector("#u-slider");
const uValue = document.querySelector("#u-value");
const kxValue = document.querySelector("#amplitude-value");
const intersectionValue = document.querySelector("#multiplicity-value");
const degreeValue = document.querySelector("#degree-value");
const conclusion = document.querySelector("#live-conclusion");
const rootTable = document.querySelector("#root-table");
const gridGroup = document.querySelector("#plot-grid");
const baseline = document.querySelector("#target-line");
const unusedIdentity = document.querySelector("#identity-line");
const densityCurve = document.querySelector("#fold-curve");
const criticalMarks = document.querySelector("#critical-marks");
const overlayGroup = document.querySelector("#root-marks");

const NS = "http://www.w3.org/2000/svg";
const bounds = { left: 64, right: 704, top: 34, bottom: 374 };
const yMin = -0.1;
const yMax = 0.55;

function xScale(value) {
  return bounds.left + value * (bounds.right - bounds.left);
}

function yScale(value) {
  return bounds.bottom - ((value - yMin) / (yMax - yMin)) * (bounds.bottom - bounds.top);
}

function makeSvg(name, attributes = {}) {
  const element = document.createElementNS(NS, name);
  for (const [key, value] of Object.entries(attributes)) {
    element.setAttribute(key, String(value));
  }
  return element;
}

function pathFor(points) {
  return points
    .map((point, index) => `${index === 0 ? "M" : "L"}${xScale(point.x).toFixed(2)},${yScale(point.y).toFixed(2)}`)
    .join(" ");
}

function drawStaticFrame() {
  for (let tick = 0; tick <= 4; tick += 1) {
    const x = tick / 4;
    gridGroup.append(makeSvg("line", {
      x1: xScale(x), y1: bounds.top, x2: xScale(x), y2: bounds.bottom, class: "grid-line",
    }));
    const label = makeSvg("text", { x: xScale(x), y: bounds.bottom + 20, class: "root-label" });
    label.textContent = x.toFixed(2);
    gridGroup.append(label);
  }
  for (const y of [-0.1, 0, 0.1, 0.2, 0.3, 0.4, 0.5]) {
    gridGroup.append(makeSvg("line", {
      x1: bounds.left, y1: yScale(y), x2: bounds.right, y2: yScale(y), class: "grid-line",
    }));
    const label = makeSvg("text", { x: bounds.left - 20, y: yScale(y) + 4, class: "root-label" });
    label.textContent = y.toFixed(1);
    gridGroup.append(label);
  }
  unusedIdentity.setAttribute("d", "");
  baseline.setAttribute("d", pathFor([{ x: 0, y: 0 }, { x: 1, y: 0 }]));
}

function negativeSegments(samples) {
  const segments = [];
  let current = [];
  for (let index = 0; index < samples.length; index += 1) {
    const sample = samples[index];
    const adjacentToNegative = sample.y < 0
      || samples[index - 1]?.y < 0
      || samples[index + 1]?.y < 0;
    if (adjacentToNegative) {
      current.push(sample);
    } else if (current.length) {
      segments.push(current);
      current = [];
    }
  }
  if (current.length) segments.push(current);
  return segments;
}

function updatePlot() {
  const u = Number(slider.value);
  const samples = Array.from({ length: 401 }, (_, index) => {
    const v = index / 400;
    return { x: v, y: orientationValue(u, v) };
  });
  const branches = foldBranchesAtU(u);
  const { kx } = bzCoordinates({ u, v: 0 });

  densityCurve.setAttribute("d", pathFor(samples));
  overlayGroup.replaceChildren();
  criticalMarks.replaceChildren();
  rootTable.replaceChildren();

  for (const segment of negativeSegments(samples)) {
    overlayGroup.append(makeSvg("path", {
      d: pathFor(segment),
      class: "density-negative",
    }));
  }

  for (const branch of branches) {
    const x = xScale(branch);
    const y = yScale(0);
    criticalMarks.append(makeSvg("rect", {
      x: x - 6, y: y - 6, width: 12, height: 12,
      transform: `rotate(45 ${x} ${y})`, class: "critical",
    }));

    const { ky } = bzCoordinates({ u, v: branch });
    const row = document.createElement("tr");
    const vCell = document.createElement("td");
    const kyCell = document.createElement("td");
    const densityCell = document.createElement("td");
    vCell.textContent = branch.toFixed(6);
    kyCell.textContent = `${ky / Math.PI >= 0 ? "+" : ""}${(ky / Math.PI).toFixed(6)}`;
    densityCell.textContent = orientationValue(u, branch).toExponential(2);
    row.append(vCell, kyCell, densityCell);
    rootTable.append(row);
  }

  uValue.value = u.toFixed(3);
  kxValue.textContent = `${kx / Math.PI >= 0 ? "+" : ""}${(kx / Math.PI).toFixed(3)}`;
  intersectionValue.textContent = String(branches.length);
  degreeValue.textContent = "+1";
  conclusion.textContent = branches.length === 2
    ? "이 slice는 fold를 두 번 지나며 λ̄의 부호가 + → − → +로 바뀐다."
    : branches.length === 1
      ? "이 slice는 cusp에서 두 fold branch가 합쳐지는 임계 slice다."
      : "이 slice에는 fold 교점이 없고 λ̄의 orientation이 한 부호로 유지된다.";
}

drawStaticFrame();
updatePlot();
slider.addEventListener("input", updatePlot);
