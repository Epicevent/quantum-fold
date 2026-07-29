import {
  MODE_CONTINUATION,
  MODE_RUNNER,
  TRACE_STEP,
  continuationEvidence,
  createContinuationState,
  createRunnerState,
  criticalCuspCurve,
  currentContinuationView,
  drainTraceEvents,
  runnerEvidence,
  runnerTarget,
  selectContinuationNode,
  startContinuation,
  startRunner,
  stepContinuation,
  stepRunner,
  tagRunnerRoot,
  torusLabel,
} from "./trace-mechanics.js";
import { bzCoordinates, foldBranchesAtU, sourceFromBZ } from "./game.js";

const canvas = document.querySelector("#trace-canvas");
const context = canvas.getContext("2d");

const ui = {
  app: document.querySelector("#trace-app"),
  modeName: document.querySelector("#trace-mode-name"),
  missionNumber: document.querySelector("#trace-mission-number"),
  kicker: document.querySelector("#trace-kicker"),
  title: document.querySelector("#trace-title"),
  brief: document.querySelector("#trace-brief"),
  score: document.querySelector("#trace-score"),
  combo: document.querySelector("#trace-combo"),
  integrity: document.querySelector("#trace-integrity"),
  timer: document.querySelector("#trace-timer"),
  formulaTarget: document.querySelector("#formula-target"),
  formulaRoots: document.querySelector("#formula-roots"),
  formulaSigned: document.querySelector("#formula-signed"),
  ledger: document.querySelector("#root-ledger"),
  receipt: document.querySelector("#trace-receipt"),
  event: document.querySelector("#trace-event"),
  controlsA: document.querySelector("#controls-a"),
  controlsB: document.querySelector("#controls-b"),
  overlay: document.querySelector("#trace-start"),
  end: document.querySelector("#trace-end"),
  endKicker: document.querySelector("#end-kicker"),
  endTitle: document.querySelector("#end-title"),
  endReceipt: document.querySelector("#end-receipt"),
  sound: document.querySelector("#trace-sound"),
};

const COLORS = {
  background: "#061019",
  panel: "#0b1b25",
  grid: "rgba(141,191,195,.15)",
  ink: "#eaf7f4",
  muted: "#89aaa9",
  positive: "#65ffe2",
  negative: "#ff6f91",
  fold: "#ffc96b",
  target: "#f4f2e9",
  wrong: "#ff395f",
};

let mode = MODE_CONTINUATION;
let game = createContinuationState();
let width = 1;
let height = 1;
let dpr = 1;
let lastTime = performance.now();
let accumulator = 0;
let hitNodes = [];
let shake = 0;
let soundEnabled = true;
let audioContext = null;
const keys = new Set();
const particles = [];
const floaters = [];
const cuspCurve = criticalCuspCurve(160);

function currentStage() {
  if (mode === MODE_CONTINUATION) return currentContinuationView(game)?.scenario ?? null;
  return game.stages[game.stageIndex] ?? null;
}

function activeRoots() {
  if (mode === MODE_CONTINUATION) return currentContinuationView(game)?.current.roots ?? [];
  return game.roots;
}

function signedMultiplicity() {
  return activeRoots().reduce((sum, root) => sum + root.sign, 0);
}

function ensureAudio() {
  if (!soundEnabled) return null;
  if (!audioContext) audioContext = new AudioContext();
  if (audioContext.state === "suspended") audioContext.resume();
  return audioContext;
}

function tone(frequency, duration = 0.08, type = "triangle", gain = 0.035, slide = 1) {
  const audio = ensureAudio();
  if (!audio) return;
  const oscillator = audio.createOscillator();
  const envelope = audio.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, audio.currentTime);
  oscillator.frequency.exponentialRampToValueAtTime(Math.max(30, frequency * slide), audio.currentTime + duration);
  envelope.gain.setValueAtTime(gain, audio.currentTime);
  envelope.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + duration);
  oscillator.connect(envelope).connect(audio.destination);
  oscillator.start();
  oscillator.stop(audio.currentTime + duration);
}

function burst(x, y, color, count = 26, speed = 190) {
  for (let index = 0; index < count; index += 1) {
    const angle = Math.random() * Math.PI * 2;
    const velocity = speed * (0.25 + Math.random() * 0.75);
    particles.push({
      x,
      y,
      vx: Math.cos(angle) * velocity,
      vy: Math.sin(angle) * velocity,
      life: 0.35 + Math.random() * 0.45,
      maxLife: 0.8,
      color,
      radius: 1.5 + Math.random() * 3.5,
    });
  }
}

function floater(text, color = COLORS.ink, x = width * 0.5, y = height * 0.15) {
  floaters.push({ text, color, x, y, life: 1.05 });
}

function eventMessage(message, kind = "neutral") {
  ui.event.textContent = message;
  ui.event.dataset.kind = kind;
}

function processEvents() {
  for (const event of drainTraceEvents(game)) {
    if (["edge-correct", "runner-pair-correct"].includes(event.type)) {
      tone(240 + (game.combo ?? 0) * 38, 0.11, "square", 0.045, 1.8);
      burst(width * 0.5, height * 0.47, COLORS.positive, 30, 230);
      shake = Math.max(shake, 7);
      floater(event.type === "edge-correct" ? `${event.id} // TRACE LOCK` : "PAIR PREDICTION LOCKED", COLORS.positive);
      eventMessage(event.type === "edge-correct" ? `${event.id} continuation confirmed.` : "The predicted pair is armed.", "positive");
    } else if (["pair-born", "runner-pair-born"].includes(event.type)) {
      tone(130, 0.2, "sawtooth", 0.055, 2.4);
      burst(width * 0.5, height * 0.46, COLORS.fold, 54, 270);
      shake = Math.max(shake, 12);
      floater("+/− PAIR BORN", COLORS.fold);
      eventMessage("A positive and negative sheet were born at one fold.", "fold");
    } else if (["pair-died", "runner-pair-died"].includes(event.type)) {
      tone(360, 0.16, "sawtooth", 0.06, 0.35);
      burst(width * 0.5, height * 0.46, COLORS.negative, 64, 290);
      shake = Math.max(shake, 15);
      floater("+/− PAIR CANCELLED", COLORS.fold);
      eventMessage("The tagged opposite sheets met at λ̄=0 and disappeared.", "fold");
    } else if (["edge-wrong", "pair-wrong", "runner-pair-wrong"].includes(event.type)) {
      tone(110, 0.18, "sawtooth", 0.05, 0.55);
      shake = Math.max(shake, 9);
      floater("PROVENANCE BREAK", COLORS.wrong);
      eventMessage("That link cannot be part of f⁻¹(γ). Trace the identity, not the nearest label.", "wrong");
    } else if (["timeout", "runner-fail"].includes(event.type)) {
      tone(75, 0.32, "sawtooth", 0.06, 0.45);
      burst(width * 0.5, height * 0.52, COLORS.wrong, 40, 250);
      shake = Math.max(shake, 18);
      floater("TRACE RECEIPT REJECTED", COLORS.wrong);
      eventMessage(event.reason ? `Contract failed: ${event.reason}.` : "Time layer lost. The same transition is reloaded.", "wrong");
    } else if (["transition-clear", "scenario-clear", "runner-stage-clear"].includes(event.type)) {
      tone(460, 0.18, "triangle", 0.055, 2.1);
      burst(width * 0.5, height * 0.42, COLORS.positive, 72, 330);
      shake = Math.max(shake, 13);
      floater("SIGNED TRACE ACCEPTED", COLORS.positive);
      eventMessage("Every transition is explained; signed multiplicity stayed invariant.", "positive");
    } else if (event.type === "complete") {
      tone(300, 0.35, "sawtooth", 0.07, 3.4);
      setTimeout(() => tone(620, 0.28, "triangle", 0.05, 1.8), 140);
    }
  }
}

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  width = Math.max(320, rect.width);
  height = Math.max(360, rect.height);
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  context.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function clearCanvas() {
  context.save();
  const offsetX = shake ? (Math.random() - 0.5) * shake : 0;
  const offsetY = shake ? (Math.random() - 0.5) * shake : 0;
  context.translate(offsetX, offsetY);
  context.fillStyle = COLORS.background;
  context.fillRect(-30, -30, width + 60, height + 60);
  const gradient = context.createRadialGradient(width * 0.5, height * 0.45, 0, width * 0.5, height * 0.45, width * 0.7);
  gradient.addColorStop(0, "rgba(38,111,112,.12)");
  gradient.addColorStop(1, "rgba(6,16,25,0)");
  context.fillStyle = gradient;
  context.fillRect(0, 0, width, height);
  context.restore();
  shake *= 0.86;
}

function roundedRect(rect, radius = 12) {
  context.beginPath();
  context.roundRect(rect.x, rect.y, rect.w, rect.h, radius);
}

function panel(rect, label) {
  roundedRect(rect, 10);
  context.fillStyle = "rgba(9,27,37,.82)";
  context.fill();
  context.strokeStyle = "rgba(111,176,177,.24)";
  context.lineWidth = 1;
  context.stroke();
  context.fillStyle = COLORS.muted;
  context.font = "600 10px ui-monospace, monospace";
  context.fillText(label, rect.x + 12, rect.y + 18);
}

function bzPoint(source, rect) {
  const { kx, ky } = bzCoordinates(source);
  return {
    x: rect.x + (kx + Math.PI) / (Math.PI * 2) * rect.w,
    y: rect.y + (Math.PI - ky) / (Math.PI * 2) * rect.h,
  };
}

function drawDomainGrid(rect) {
  context.save();
  roundedRect(rect, 4);
  context.clip();
  context.strokeStyle = COLORS.grid;
  context.lineWidth = 1;
  for (let index = 0; index <= 4; index += 1) {
    const x = rect.x + rect.w * index / 4;
    const y = rect.y + rect.h * index / 4;
    context.beginPath();
    context.moveTo(x, rect.y);
    context.lineTo(x, rect.y + rect.h);
    context.stroke();
    context.beginPath();
    context.moveTo(rect.x, y);
    context.lineTo(rect.x + rect.w, y);
    context.stroke();
  }
  context.restore();
  context.strokeStyle = "rgba(172,224,220,.32)";
  context.strokeRect(rect.x, rect.y, rect.w, rect.h);
}

function drawFoldCurve(rect) {
  for (const sign of [-1, 1]) {
    context.beginPath();
    let started = false;
    for (let index = 0; index <= 260; index += 1) {
      const kx = -Math.PI + Math.PI * 2 * index / 260;
      const cx = Math.cos(kx);
      if (cx > 0.5 || Math.abs(cx - 1) < 1e-8) {
        started = false;
        continue;
      }
      const ky = sign * Math.acos(Math.max(-1, Math.min(1, cx / (cx - 1))));
      const point = bzPoint(sourceFromBZ(kx, ky), rect);
      if (!started) context.moveTo(point.x, point.y);
      else context.lineTo(point.x, point.y);
      started = true;
    }
    context.strokeStyle = COLORS.fold;
    context.lineWidth = 1.7;
    context.shadowColor = COLORS.fold;
    context.shadowBlur = 8;
    context.stroke();
    context.shadowBlur = 0;
  }
}

function rootColor(root) {
  return root.sign < 0 ? COLORS.negative : root.sign > 0 ? COLORS.positive : COLORS.fold;
}

function drawRoot(root, point, layer, radius = 14) {
  const color = rootColor(root);
  context.save();
  context.translate(point.x, point.y);
  context.shadowColor = color;
  context.shadowBlur = 16;
  context.fillStyle = "rgba(4,13,20,.94)";
  context.strokeStyle = color;
  context.lineWidth = 2.4;
  context.beginPath();
  context.arc(0, 0, radius, 0, Math.PI * 2);
  context.fill();
  context.stroke();
  context.shadowBlur = 0;
  context.fillStyle = color;
  context.font = "800 10px ui-monospace, monospace";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(`${root.id}${root.sign < 0 ? "−" : root.sign > 0 ? "+" : "0"}`, 0, 0);
  context.restore();
  hitNodes.push({ layer, id: root.id, x: point.x, y: point.y, radius: radius + 8 });
}

function drawTargetBadge(target, x, y) {
  const size = 38;
  const gradient = context.createRadialGradient(x - 8, y - 8, 2, x, y, size);
  gradient.addColorStop(0, "#ffffff");
  gradient.addColorStop(0.35, "#c9e4e1");
  gradient.addColorStop(1, "#263d4c");
  context.fillStyle = gradient;
  context.beginPath();
  context.arc(x, y, size, 0, Math.PI * 2);
  context.fill();
  context.strokeStyle = "rgba(255,255,255,.5)";
  context.stroke();
  context.fillStyle = COLORS.background;
  context.font = "800 10px ui-monospace, monospace";
  context.textAlign = "center";
  context.fillText(`q=(${target.x.toFixed(2)},${target.y.toFixed(2)},${target.z.toFixed(2)})`, x, y + size + 17);
}

function drawContinuation() {
  const view = currentContinuationView(game);
  if (!view) return;
  const margin = Math.max(22, width * 0.035);
  const gap = Math.max(46, width * 0.075);
  const top = 82;
  const boardSize = Math.min((width - margin * 2 - gap) / 2, height - 145);
  const previousRect = { x: margin, y: top, w: boardSize, h: boardSize };
  const currentRect = { x: margin + boardSize + gap, y: top, w: boardSize, h: boardSize };
  panel({ x: previousRect.x - 12, y: previousRect.y - 34, w: previousRect.w + 24, h: previousRect.h + 58 }, `t−1  ${view.previous.label}`);
  panel({ x: currentRect.x - 12, y: currentRect.y - 34, w: currentRect.w + 24, h: currentRect.h + 58 }, `t  ${view.current.label}`);
  drawDomainGrid(previousRect);
  drawDomainGrid(currentRect);
  drawFoldCurve(previousRect);
  drawFoldCurve(currentRect);

  for (const id of game.solvedEdges) {
    const before = view.previous.roots.find((root) => root.id === id);
    const after = view.current.roots.find((root) => root.id === id);
    if (!before || !after) continue;
    const a = bzPoint(before.source, previousRect);
    const b = bzPoint(after.source, currentRect);
    context.strokeStyle = COLORS.positive;
    context.lineWidth = 3;
    context.shadowColor = COLORS.positive;
    context.shadowBlur = 14;
    context.beginPath();
    context.moveTo(a.x, a.y);
    context.bezierCurveTo(a.x + gap * 0.55, a.y, b.x - gap * 0.55, b.y, b.x, b.y);
    context.stroke();
    context.shadowBlur = 0;
  }

  for (const root of view.previous.roots) drawRoot(root, bzPoint(root.source, previousRect), "previous");
  for (const root of view.current.roots) drawRoot(root, bzPoint(root.source, currentRect), "current");

  if (game.selected) {
    const frame = game.selected.layer === "previous" ? view.previous : view.current;
    const rect = game.selected.layer === "previous" ? previousRect : currentRect;
    const root = frame.roots.find((candidate) => candidate.id === game.selected.id);
    if (root) {
      const point = bzPoint(root.source, rect);
      context.strokeStyle = COLORS.target;
      context.lineWidth = 2;
      context.setLineDash([5, 5]);
      context.beginPath();
      context.arc(point.x, point.y, 23 + Math.sin(game.elapsed * 7) * 3, 0, Math.PI * 2);
      context.stroke();
      context.setLineDash([]);
    }
  }

  drawTargetBadge(view.current.target, width * 0.5, 40);
  context.fillStyle = COLORS.muted;
  context.font = "600 10px ui-monospace, monospace";
  context.textAlign = "center";
  context.fillText("CLICK A ROOT AT t−1, THEN ITS CONTINUATION AT t · SAME-LAYER DOUBLE SELECTION LOCKS A FOLD PAIR", width * 0.5, height - 22);
}

function localPoint(coordinate, rect) {
  return {
    x: rect.x + (coordinate.b + 0.018) / 0.036 * rect.w,
    y: rect.y + (0.072 - coordinate.a) / 0.09 * rect.h,
  };
}

function drawRunner() {
  const margin = Math.max(18, width * 0.025);
  const gap = Math.max(22, width * 0.035);
  const top = 58;
  const available = height - 102;
  const domainSize = Math.min(width * 0.57, available);
  const domainRect = { x: margin, y: top, w: domainSize, h: domainSize };
  const targetRect = {
    x: domainRect.x + domainRect.w + gap,
    y: top,
    w: Math.max(160, width - domainRect.x - domainRect.w - gap - margin),
    h: domainSize,
  };
  panel({ x: domainRect.x - 10, y: domainRect.y - 32, w: domainRect.w + 20, h: domainRect.h + 52 }, "SOURCE ROOTS · T²");
  panel({ x: targetRect.x - 10, y: targetRect.y - 32, w: targetRect.w + 20, h: targetRect.h + 52 }, "TARGET STEERING · S² CUSP CHART");
  drawDomainGrid(domainRect);
  drawFoldCurve(domainRect);

  const trails = new Map();
  for (const sample of game.history) {
    for (const root of sample.roots) {
      if (!trails.has(root.id)) trails.set(root.id, []);
      trails.get(root.id).push(root);
    }
  }
  for (const roots of trails.values()) {
    context.beginPath();
    roots.forEach((root, index) => {
      const point = bzPoint(root.source, domainRect);
      if (index === 0) context.moveTo(point.x, point.y);
      else context.lineTo(point.x, point.y);
    });
    context.strokeStyle = rootColor(roots[roots.length - 1]);
    context.globalAlpha = 0.42;
    context.lineWidth = 2;
    context.stroke();
    context.globalAlpha = 1;
  }
  for (const root of game.roots) drawRoot(root, bzPoint(root.source, domainRect), "runner", 15);

  context.save();
  roundedRect(targetRect, 4);
  context.clip();
  context.strokeStyle = COLORS.grid;
  for (let index = 0; index <= 6; index += 1) {
    const x = targetRect.x + targetRect.w * index / 6;
    const y = targetRect.y + targetRect.h * index / 6;
    context.beginPath();
    context.moveTo(x, targetRect.y);
    context.lineTo(x, targetRect.y + targetRect.h);
    context.stroke();
    context.beginPath();
    context.moveTo(targetRect.x, y);
    context.lineTo(targetRect.x + targetRect.w, y);
    context.stroke();
  }

  context.beginPath();
  cuspCurve.forEach((coordinate, index) => {
    const point = localPoint(coordinate, targetRect);
    if (index === 0) context.moveTo(point.x, point.y);
    else context.lineTo(point.x, point.y);
  });
  context.strokeStyle = COLORS.fold;
  context.lineWidth = 3;
  context.shadowColor = COLORS.fold;
  context.shadowBlur = 12;
  context.stroke();
  context.shadowBlur = 0;

  context.beginPath();
  game.history.forEach((sample, index) => {
    const point = localPoint(sample, targetRect);
    if (index === 0) context.moveTo(point.x, point.y);
    else context.lineTo(point.x, point.y);
  });
  context.strokeStyle = COLORS.target;
  context.globalAlpha = 0.7;
  context.lineWidth = 2.4;
  context.stroke();
  context.globalAlpha = 1;

  const stage = game.stages[game.stageIndex];
  const goal = localPoint(stage.goal, targetRect);
  context.fillStyle = "rgba(101,255,226,.12)";
  context.strokeStyle = COLORS.positive;
  context.lineWidth = 2;
  context.beginPath();
  context.arc(goal.x, goal.y, 16, 0, Math.PI * 2);
  context.fill();
  context.stroke();
  context.fillStyle = COLORS.positive;
  context.font = "800 9px ui-monospace, monospace";
  context.textAlign = "center";
  context.fillText("GOAL", goal.x, goal.y + 3);

  const current = localPoint(game.coordinate, targetRect);
  context.strokeStyle = COLORS.target;
  context.lineWidth = 2;
  context.beginPath();
  context.arc(current.x, current.y, 10 + Math.sin(game.elapsed * 8) * 2, 0, Math.PI * 2);
  context.stroke();
  context.beginPath();
  context.moveTo(current.x - 17, current.y);
  context.lineTo(current.x + 17, current.y);
  context.moveTo(current.x, current.y - 17);
  context.lineTo(current.x, current.y + 17);
  context.stroke();
  context.restore();
  context.strokeStyle = "rgba(172,224,220,.32)";
  context.strokeRect(targetRect.x, targetRect.y, targetRect.w, targetRect.h);

  context.fillStyle = COLORS.muted;
  context.font = "600 10px ui-monospace, monospace";
  context.textAlign = "center";
  context.fillText("STEER q(A,B) · TAG TWO SOURCE ROOTS TO PREDICT THE FOLD PAIR", width * 0.5, height - 19);
}

function drawParticles(dt) {
  for (const particle of particles) {
    particle.life -= dt;
    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;
    particle.vx *= 0.98;
    particle.vy *= 0.98;
    context.globalAlpha = Math.max(0, particle.life / particle.maxLife);
    context.fillStyle = particle.color;
    context.beginPath();
    context.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
    context.fill();
  }
  context.globalAlpha = 1;
  particles.splice(0, particles.length, ...particles.filter((particle) => particle.life > 0));

  for (const item of floaters) {
    item.life -= dt;
    item.y -= dt * 34;
    context.globalAlpha = Math.max(0, item.life);
    context.fillStyle = item.color;
    context.font = "900 15px ui-monospace, monospace";
    context.textAlign = "center";
    context.fillText(item.text, item.x, item.y);
  }
  context.globalAlpha = 1;
  floaters.splice(0, floaters.length, ...floaters.filter((item) => item.life > 0));
}

function formatVector(target) {
  return `q=(${target.x.toFixed(4)}, ${target.y.toFixed(4)}, ${target.z.toFixed(4)})`;
}

function renderLedger(roots) {
  ui.ledger.innerHTML = roots.map((root) => `
    <li data-sign="${root.sign}">
      <span><i></i><b>${root.id}${root.sign < 0 ? "−" : "+"}</b><code>${torusLabel(root)}</code></span>
      <span><small>λ̄</small><strong>${root.lambda >= 0 ? "+" : ""}${root.lambda.toFixed(6)}</strong></span>
      <span><small>residual</small><strong>${root.residual.toExponential(1)}</strong></span>
    </li>
  `).join("");
}

function renderReceipt() {
  const receipts = game.receipts ?? [];
  if (!receipts.length) {
    ui.receipt.innerHTML = "<p>No accepted transition yet. The receipt records lineage, not only the final count.</p>";
    return;
  }
  const recent = receipts.slice(-4).reverse();
  ui.receipt.innerHTML = recent.map((receipt) => {
    if (mode === MODE_CONTINUATION) {
      return `<p><b>${receipt.scenario.toUpperCase()}</b> ${receipt.from}→${receipt.to}<br><span>edges ${receipt.shared.join(",") || "none"} · born ${receipt.born.join(",") || "—"} · died ${receipt.died.join(",") || "—"} · m ${receipt.signedBefore}→${receipt.signedAfter}</span></p>`;
    }
    return `<p><b>${receipt.stage.toUpperCase()}</b> ${receipt.initialId}→${receipt.finalId}<br><span>born ${receipt.bornPair.join(",") || "—"} · died ${receipt.diedPair.join(",") || "—"} · m=${receipt.signedMultiplicity}</span></p>`;
  }).join("");
}

function renderUI() {
  const stage = currentStage();
  if (!stage) return;
  ui.app.dataset.mode = mode;
  ui.modeName.textContent = mode === MODE_CONTINUATION ? "A · CONTINUATION STRIKE" : "B · SHEET RUNNER";
  ui.missionNumber.textContent = stage.number;
  ui.kicker.textContent = stage.kicker;
  ui.title.textContent = stage.title;
  ui.brief.textContent = stage.brief;
  ui.score.textContent = String(game.score).padStart(5, "0");
  ui.combo.textContent = `TRACE COMBO ×${game.combo}`;
  ui.integrity.textContent = "◆".repeat(game.integrity) + "◇".repeat(Math.max(0, 3 - game.integrity));
  ui.timer.textContent = `${Math.max(0, game.timeLeft).toFixed(1)}s`;
  ui.controlsA.hidden = mode !== MODE_CONTINUATION;
  ui.controlsB.hidden = mode !== MODE_RUNNER;

  if (mode === MODE_CONTINUATION) {
    const view = currentContinuationView(game);
    ui.formulaTarget.textContent = `${stage.formula} · ${formatVector(view.current.target)}`;
    ui.formulaRoots.textContent = `roots ${view.previous.roots.length}→${view.current.roots.length} · continue ${view.task.shared.join(",") || "none"} · pair ${view.task.pairIds.join("+") || "none"}`;
    ui.formulaSigned.textContent = `Σ sgn λ̄ = ${view.previous.signedMultiplicity} → ${view.current.signedMultiplicity}`;
    renderLedger(view.current.roots);
  } else {
    const target = runnerTarget(game);
    ui.formulaTarget.textContent = `q(A,B)=normalize(qc+A eA+B eB) · A=${game.coordinate.a.toFixed(4)} · B=${game.coordinate.b.toFixed(4)} · ${formatVector(target)}`;
    ui.formulaRoots.textContent = `roots ${game.roots.length} · IDs ${game.roots.map((root) => root.id).join(", ")} · initial ${game.initialId}`;
    ui.formulaSigned.textContent = `Σ sgn λ̄ = ${signedMultiplicity()} · pair tag ${game.pairTagged ? "LOCKED" : "OPEN"}`;
    renderLedger(game.roots);
  }
  renderReceipt();

  document.querySelectorAll("[data-mode-button]").forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.modeButton === mode));
  });

  if (["complete", "failed"].includes(game.status)) showEnd();
}

function showEnd() {
  ui.end.hidden = false;
  const complete = game.status === "complete";
  ui.endKicker.textContent = complete ? "GLOBAL TRACE ACCEPTED" : "TRACE CONTRACT FAILED";
  ui.endTitle.innerHTML = complete ? "THE ROOTS KEPT<br><em>THEIR HISTORY.</em>" : "THE FINAL NUMBER<br><em>WAS NOT ENOUGH.</em>";
  const evidence = mode === MODE_CONTINUATION ? continuationEvidence(game) : runnerEvidence(game);
  ui.endReceipt.textContent = JSON.stringify(evidence, null, 2);
}

function render(now) {
  hitNodes = [];
  clearCanvas();
  context.save();
  const offsetX = shake ? (Math.random() - 0.5) * shake : 0;
  const offsetY = shake ? (Math.random() - 0.5) * shake : 0;
  context.translate(offsetX, offsetY);
  if (mode === MODE_CONTINUATION) drawContinuation();
  else drawRunner();
  context.restore();
  drawParticles(Math.min(0.04, (now - lastTime) / 1000));
}

function inputForRunner() {
  const left = keys.has("ArrowLeft") || keys.has("KeyA") || document.body.dataset.touchLeft === "true";
  const right = keys.has("ArrowRight") || keys.has("KeyD") || document.body.dataset.touchRight === "true";
  const up = keys.has("ArrowUp") || keys.has("KeyW") || document.body.dataset.touchUp === "true";
  const down = keys.has("ArrowDown") || keys.has("KeyS") || document.body.dataset.touchDown === "true";
  return { moveX: Number(right) - Number(left), moveY: Number(down) - Number(up) };
}

function update(dt) {
  if (mode === MODE_CONTINUATION) stepContinuation(game, dt);
  else stepRunner(game, inputForRunner(), dt);
  processEvents();
}

function frame(now) {
  const delta = Math.min(0.1, (now - lastTime) / 1000);
  lastTime = now;
  accumulator += delta;
  while (accumulator >= TRACE_STEP) {
    update(TRACE_STEP);
    accumulator -= TRACE_STEP;
  }
  renderUI();
  render(now);
  requestAnimationFrame(frame);
}

function begin(nextMode) {
  mode = nextMode;
  game = mode === MODE_RUNNER ? createRunnerState() : createContinuationState();
  if (mode === MODE_RUNNER) startRunner(game);
  else startContinuation(game);
  ui.overlay.hidden = true;
  ui.end.hidden = true;
  eventMessage(mode === MODE_CONTINUATION
    ? "Build f⁻¹(γ): connect identities, then lock fold pairs."
    : "Steer q(A,B). The source roots move because the target moved.");
  ensureAudio();
}

canvas.addEventListener("pointerdown", (event) => {
  if (game.status !== "playing") return;
  const rect = canvas.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  const hit = hitNodes
    .filter((node) => Math.hypot(node.x - x, node.y - y) <= node.radius)
    .sort((left, right) => Math.hypot(left.x - x, left.y - y) - Math.hypot(right.x - x, right.y - y))[0];
  if (!hit) return;
  if (mode === MODE_CONTINUATION) selectContinuationNode(game, hit.layer, hit.id);
  else tagRunnerRoot(game, hit.id);
  processEvents();
});

window.addEventListener("keydown", (event) => {
  if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Space"].includes(event.code)) event.preventDefault();
  keys.add(event.code);
  if (event.code === "Digit1") begin(MODE_CONTINUATION);
  if (event.code === "Digit2") begin(MODE_RUNNER);
  if (event.code === "KeyR" && ["complete", "failed"].includes(game.status)) begin(mode);
});

window.addEventListener("keyup", (event) => keys.delete(event.code));
window.addEventListener("blur", () => keys.clear());
window.addEventListener("resize", resizeCanvas);

document.querySelectorAll("[data-start-mode], [data-mode-button]").forEach((button) => {
  button.addEventListener("click", () => begin(button.dataset.startMode ?? button.dataset.modeButton));
});

document.querySelectorAll("[data-move]").forEach((button) => {
  const key = `touch${button.dataset.move[0].toUpperCase()}${button.dataset.move.slice(1)}`;
  const set = (value) => {
    document.body.dataset[key] = String(value);
  };
  button.addEventListener("pointerdown", () => set(true));
  button.addEventListener("pointerup", () => set(false));
  button.addEventListener("pointercancel", () => set(false));
  button.addEventListener("pointerleave", () => set(false));
});

document.querySelector("#trace-retry").addEventListener("click", () => begin(mode));
document.querySelector("#trace-choose").addEventListener("click", () => {
  ui.end.hidden = true;
  ui.overlay.hidden = false;
});
ui.sound.addEventListener("click", () => {
  soundEnabled = !soundEnabled;
  ui.sound.setAttribute("aria-pressed", String(soundEnabled));
  ui.sound.textContent = soundEnabled ? "SOUND ON" : "SOUND OFF";
});

resizeCanvas();
renderUI();
requestAnimationFrame(frame);
