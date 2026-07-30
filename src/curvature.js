import {
  advanceCurvatureMission,
  answerCurvatureQuestion,
  createCurvatureState,
  currentCurvatureQuestion,
  currentMission,
  CURVATURE_MISSIONS,
  CURVATURE_QUESTIONS,
  startCurvatureRun,
} from "./curvature-mechanics.js";
import { foldRegularizationSample } from "./curvature-math.js";

const $ = (selector) => document.querySelector(selector);

const ui = {
  body: document.body,
  start: $("#forge-start"),
  end: $("#forge-end"),
  startButton: $("#start-button"),
  replayButton: $("#replay-button"),
  nextMission: $("#next-mission"),
  soundButton: $("#sound-button"),
  missionNumber: $("#mission-number"),
  missionKicker: $("#mission-kicker"),
  missionTitle: $("#mission-title"),
  missionBrief: $("#mission-brief"),
  missionRail: $("#mission-rail"),
  progressFill: $("#progress-fill"),
  progressLabel: $("#progress-label"),
  score: $("#score-value"),
  integrity: $("#integrity-value"),
  combo: $("#combo-value"),
  berryCharge: $("#berry-charge"),
  ricciCharge: $("#ricci-charge"),
  berryLane: $("[data-lane='berry']"),
  ricciLane: $("[data-lane='ricci']"),
  factorGate: $("#factor-gate"),
  operatorLabel: $("#operator-label"),
  before: $("#before-formula"),
  prompt: $("#question-prompt"),
  answers: $("#answer-grid"),
  impact: $("#impact-message"),
  missionClear: $("#mission-clear"),
  clearFormula: $("#clear-formula"),
  clearReason: $("#clear-reason"),
  receipt: $("#receipt"),
  receiptCount: $("#receipt-count"),
  convention: $("#current-convention"),
  foldConsole: $("#fold-console"),
  foldV: $("#fold-v"),
  foldVOutput: $("#fold-v-output"),
  foldEpsilon: $("#fold-epsilon"),
  foldEpsilonOutput: $("#fold-epsilon-output"),
  foldDet: $("#fold-det"),
  foldSigned: $("#fold-signed"),
  foldUnsigned: $("#fold-unsigned"),
  foldInverse: $("#fold-inverse"),
  endScore: $("#end-score"),
  endCombo: $("#end-combo"),
  endWrong: $("#end-wrong"),
};

const arenaCanvas = $("#forge-canvas");
const arenaContext = arenaCanvas.getContext("2d");
const foldCanvas = $("#fold-canvas");
const foldContext = foldCanvas.getContext("2d");

let state = createCurvatureState();
let answerLocked = false;
let soundEnabled = true;
let audioContext = null;
let animationTime = 0;
let lastFrame = performance.now();
let impacts = [];
let particles = [];

const missionOffsets = CURVATURE_MISSIONS.map((_, missionIndex) => (
  CURVATURE_MISSIONS.slice(0, missionIndex).reduce((sum, mission) => sum + mission.questions.length, 0)
));

function totalCompleted(currentState) {
  const offset = missionOffsets[currentState.missionIndex] ?? CURVATURE_QUESTIONS.length;
  if (currentState.status === "complete") return CURVATURE_QUESTIONS.length;
  if (currentState.status === "mission-clear") return offset + currentMission(currentState).questions.length;
  return offset + currentState.questionIndex;
}

function formatScore(value) {
  return String(value).padStart(5, "0");
}

function ensureAudio() {
  if (!soundEnabled) return null;
  if (!audioContext) {
    const AudioCtor = window.AudioContext || window.webkitAudioContext;
    if (AudioCtor) audioContext = new AudioCtor();
  }
  if (audioContext?.state === "suspended") audioContext.resume();
  return audioContext;
}

function tone(frequency, duration = 0.08, type = "sine", gain = 0.035, delay = 0) {
  const context = ensureAudio();
  if (!context) return;
  const oscillator = context.createOscillator();
  const volume = context.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, context.currentTime + delay);
  volume.gain.setValueAtTime(gain, context.currentTime + delay);
  volume.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + delay + duration);
  oscillator.connect(volume).connect(context.destination);
  oscillator.start(context.currentTime + delay);
  oscillator.stop(context.currentTime + delay + duration);
}

function sound(kind) {
  if (kind === "shot") tone(330, 0.05, "square", 0.025);
  if (kind === "wrong") {
    tone(128, 0.16, "sawtooth", 0.045);
    tone(94, 0.18, "square", 0.025, 0.04);
  }
  if (kind === "correct") {
    tone(520, 0.1, "triangle", 0.04);
    tone(780, 0.16, "sine", 0.035, 0.055);
  }
  if (kind === "clear") {
    [392, 523, 659].forEach((frequency, index) => tone(frequency, 0.24, "triangle", 0.035, index * 0.08));
  }
}

function renderMissionRail() {
  ui.missionRail.replaceChildren(...CURVATURE_MISSIONS.map((mission, index) => {
    const item = document.createElement("span");
    const number = document.createElement("b");
    number.textContent = mission.number;
    item.append(number, document.createTextNode(mission.id.toUpperCase()));
    item.dataset.state = index < state.missionIndex
      ? "done"
      : index === state.missionIndex
        ? "active"
        : "pending";
    return item;
  }));
}

function renderReceipt() {
  ui.receiptCount.textContent = `${state.receipt.length} LINES VERIFIED`;
  if (!state.receipt.length) {
    ui.receipt.innerHTML = '<p class="receipt-empty">Correct hits will leave the exact equality and why it is valid.</p>';
    return;
  }
  const visible = state.receipt.slice(-8).reverse();
  ui.receipt.replaceChildren(...visible.map((line, reverseIndex) => {
    const absoluteIndex = state.receipt.length - reverseIndex;
    const article = document.createElement("article");
    const small = document.createElement("small");
    const code = document.createElement("code");
    const reason = document.createElement("p");
    small.textContent = `LINE ${String(absoluteIndex).padStart(2, "0")} · ${line.before}`;
    code.textContent = line.after;
    reason.textContent = line.reason;
    article.append(small, code, reason);
    return article;
  }));
}

function renderAnswerTargets(question) {
  ui.answers.replaceChildren(...question.choices.map((choice, index) => {
    const button = document.createElement("button");
    const number = document.createElement("span");
    const formula = document.createElement("code");
    button.type = "button";
    button.className = "answer-target";
    button.dataset.choice = String(index);
    button.dataset.firstTarget = String(question.id === "patch-scale" && index === question.correct);
    number.textContent = String(index + 1).padStart(2, "0");
    formula.textContent = choice;
    button.append(number, formula);
    button.addEventListener("click", () => chooseAnswer(index, button));
    return button;
  }));
}

function renderQuestion() {
  const mission = currentMission(state);
  const question = currentCurvatureQuestion(state);
  if (!mission || !question || state.status !== "active") return;
  ui.operatorLabel.textContent = `CALCULATION ${state.questionIndex + 1} / ${mission.questions.length}`;
  ui.before.textContent = question.before;
  ui.prompt.textContent = question.prompt;
  ui.impact.textContent = state.questionIndex === 0 && state.missionIndex === 0
    ? "첫 표적은 안내되어 있습니다. S=2를 누르면 계산이 시작됩니다."
    : "";
  delete ui.impact.dataset.kind;
  renderAnswerTargets(question);
}

function renderFoldConsole() {
  const visible = currentMission(state)?.id === "fold" || state.status === "complete";
  ui.foldConsole.hidden = !visible;
  if (!visible) return;
  updateFoldProbe();
}

function renderState({ preserveQuestion = false } = {}) {
  const mission = currentMission(state) ?? CURVATURE_MISSIONS.at(-1);
  ui.body.dataset.mission = mission.id;
  ui.body.dataset.status = state.status;
  ui.missionNumber.textContent = mission.number;
  ui.missionKicker.textContent = mission.kicker;
  ui.missionTitle.textContent = mission.title;
  ui.missionBrief.textContent = mission.brief;
  ui.score.textContent = formatScore(state.score);
  ui.integrity.textContent = `${state.integrity}%`;
  ui.combo.textContent = `×${state.combo}`;
  ui.berryCharge.textContent = state.berryCharge || "?";
  ui.ricciCharge.textContent = state.ricciCharge || "?";
  ui.berryLane.dataset.charged = String(state.berryCharge > 0);
  ui.ricciLane.dataset.charged = String(state.ricciCharge > 0);
  ui.factorGate.dataset.active = String(state.missionIndex >= 1);
  ui.convention.textContent = mission.id === "fold"
    ? "local fold: f(u,v)=(u,v²/2) · ε>0"
    : mission.id === "pullback"
      ? "paper convention: K_G=2 · Ω=λ̄ · det g=Ω²"
      : "S=1+|z|² · ∂z=½(∂x−i∂y)";

  const completed = totalCompleted(state);
  ui.progressFill.style.width = `${100 * completed / CURVATURE_QUESTIONS.length}%`;
  ui.progressLabel.textContent = `${completed} / ${CURVATURE_QUESTIONS.length}`;
  renderMissionRail();
  renderReceipt();
  renderFoldConsole();

  ui.missionClear.hidden = state.status !== "mission-clear";
  if (state.status === "mission-clear") {
    const last = state.receipt.at(-1);
    ui.clearFormula.textContent = last.after;
    ui.clearReason.textContent = last.reason;
  }

  if (!preserveQuestion && state.status === "active") renderQuestion();
}

function targetCenter(button) {
  const arena = arenaCanvas.getBoundingClientRect();
  const target = button.getBoundingClientRect();
  return {
    x: target.left + target.width / 2 - arena.left,
    y: target.top + target.height / 2 - arena.top,
  };
}

function spawnImpact(button, correct) {
  const target = targetCenter(button);
  impacts.push({ x: target.x, y: target.y, age: 0, correct });
  for (let index = 0; index < (correct ? 28 : 16); index += 1) {
    const angle = Math.PI * 2 * index / (correct ? 28 : 16) + Math.random() * 0.2;
    const speed = 35 + Math.random() * 95;
    particles.push({
      x: target.x,
      y: target.y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 0.45 + Math.random() * 0.35,
      age: 0,
      correct,
    });
  }
}

function chooseAnswer(choiceIndex, button) {
  if (answerLocked || state.status !== "active") return;
  answerLocked = true;
  sound("shot");
  const question = currentCurvatureQuestion(state);
  const correct = choiceIndex === question.correct;
  const next = answerCurvatureQuestion(state, choiceIndex);
  button.dataset.result = correct ? "correct" : "wrong";
  spawnImpact(button, correct);
  ui.answers.querySelectorAll("button").forEach((target) => { target.disabled = true; });

  if (!correct) {
    sound("wrong");
    state = next;
    ui.impact.dataset.kind = "wrong";
    ui.impact.textContent = `INVALID LINE · ${question.choices[choiceIndex]} · ${question.reason}`;
    renderState({ preserveQuestion: true });
    window.setTimeout(() => {
      answerLocked = false;
      renderQuestion();
    }, 900);
    return;
  }

  sound("correct");
  state = next;
  ui.impact.dataset.kind = "correct";
  ui.impact.textContent = `${question.after} · ${question.reason}`;
  renderState({ preserveQuestion: true });
  window.setTimeout(() => {
    answerLocked = false;
    if (state.status === "mission-clear") sound("clear");
    if (state.status === "active") renderQuestion();
    if (state.status === "complete") showEnd();
  }, 820);
}

function startRun() {
  ensureAudio();
  state = startCurvatureRun(createCurvatureState());
  answerLocked = false;
  ui.start.hidden = true;
  ui.end.hidden = true;
  renderState();
}

function showEnd() {
  ui.endScore.textContent = formatScore(state.score);
  ui.endCombo.textContent = `×${state.bestCombo}`;
  ui.endWrong.textContent = String(state.wrongAnswers);
  ui.end.hidden = false;
  sound("clear");
}

function advanceMission() {
  state = advanceCurvatureMission(state);
  answerLocked = false;
  renderState();
}

function toggleSound() {
  soundEnabled = !soundEnabled;
  ui.soundButton.setAttribute("aria-pressed", String(soundEnabled));
  ui.soundButton.textContent = soundEnabled ? "SOUND ON" : "SOUND OFF";
  if (soundEnabled) sound("shot");
}

function fitCanvas(canvas, context) {
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  const rect = canvas.getBoundingClientRect();
  const width = Math.max(1, Math.round(rect.width * ratio));
  const height = Math.max(1, Math.round(rect.height * ratio));
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  return { width: rect.width, height: rect.height };
}

function drawGrid(context, width, height) {
  context.save();
  context.strokeStyle = "rgba(116,175,176,.10)";
  context.lineWidth = 1;
  for (let x = 24; x < width; x += 48) {
    context.beginPath();
    context.moveTo(x, 0);
    context.lineTo(x, height);
    context.stroke();
  }
  for (let y = 24; y < height; y += 48) {
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(width, y);
    context.stroke();
  }
  context.restore();
}

function drawPatchStage(context, width, height, time) {
  const radius = Math.min(width, height) * 0.27;
  const centerX = width * 0.5;
  const centerY = height * 0.53;
  context.save();
  context.translate(centerX, centerY);
  context.rotate(time * 0.05);
  for (let ring = 1; ring <= 4; ring += 1) {
    context.beginPath();
    context.arc(0, 0, radius * ring / 4, 0, Math.PI * 2);
    context.strokeStyle = `rgba(98,255,224,${0.16 - ring * 0.022})`;
    context.stroke();
  }
  context.beginPath();
  context.moveTo(-radius * 1.3, 0);
  context.lineTo(radius * 1.3, 0);
  context.moveTo(0, -radius * 1.3);
  context.lineTo(0, radius * 1.3);
  context.strokeStyle = "rgba(255,199,101,.2)";
  context.stroke();
  const zX = radius * 0.5;
  context.beginPath();
  context.arc(zX, 0, 6 + Math.sin(time * 3) * 1.5, 0, Math.PI * 2);
  context.fillStyle = "#ffc765";
  context.shadowColor = "#ffc765";
  context.shadowBlur = 18;
  context.fill();
  context.restore();
}

function drawBundleStage(context, width, height, time, chern = false) {
  const y = height * 0.52;
  const left = width * 0.22;
  const right = width * 0.78;
  for (const [x, color, loops] of [[left, "#62ffe0", 1], [right, "#ff7299", 2]]) {
    context.save();
    context.translate(x, y);
    context.shadowColor = color;
    context.shadowBlur = 18;
    for (let ring = 0; ring < loops + 2; ring += 1) {
      context.beginPath();
      context.arc(0, 0, 42 + ring * 21, time * (0.18 + ring * .03), time * (0.18 + ring * .03) + Math.PI * (chern ? 1.8 : 1.25));
      context.strokeStyle = color;
      context.globalAlpha = .22 + .18 * (ring === loops);
      context.lineWidth = ring === loops ? 3 : 1;
      context.stroke();
    }
    context.restore();
  }
  context.save();
  context.setLineDash([5, 9]);
  context.beginPath();
  context.moveTo(left + 90, y);
  context.lineTo(right - 90, y);
  context.strokeStyle = "rgba(255,199,101,.32)";
  context.stroke();
  context.restore();
}

function drawPullbackStage(context, width, height, time) {
  const leftX = width * .2;
  const rightX = width * .8;
  const y = height * .54;
  context.save();
  context.translate(leftX, y);
  context.strokeStyle = "rgba(98,255,224,.32)";
  for (let row = -2; row <= 2; row += 1) {
    context.beginPath();
    context.ellipse(0, row * 12, 105, 44 - Math.abs(row) * 3, 0, 0, Math.PI * 2);
    context.stroke();
  }
  context.restore();
  context.save();
  context.translate(rightX, y);
  context.beginPath();
  context.arc(0, 0, 90, 0, Math.PI * 2);
  context.strokeStyle = "rgba(255,114,153,.4)";
  context.lineWidth = 2;
  context.stroke();
  context.beginPath();
  context.ellipse(0, 0, 90, 28, time * .08, 0, Math.PI * 2);
  context.strokeStyle = "rgba(255,199,101,.5)";
  context.stroke();
  context.restore();
  const gradient = context.createLinearGradient(leftX + 110, 0, rightX - 100, 0);
  gradient.addColorStop(0, "rgba(98,255,224,.18)");
  gradient.addColorStop(.5, "rgba(255,199,101,.8)");
  gradient.addColorStop(1, "rgba(255,114,153,.18)");
  context.beginPath();
  context.moveTo(leftX + 110, y);
  context.lineTo(rightX - 100, y);
  context.strokeStyle = gradient;
  context.lineWidth = 3;
  context.stroke();
}

function drawFoldStage(context, width, height, time) {
  const centerX = width / 2;
  const centerY = height * .54;
  context.save();
  context.translate(centerX, centerY);
  context.beginPath();
  for (let index = -120; index <= 120; index += 1) {
    const v = index / 120;
    const x = v * width * .3;
    const y = -v * v * height * .18;
    if (index === -120) context.moveTo(x, y);
    else context.lineTo(x, y);
  }
  context.strokeStyle = "rgba(255,199,101,.68)";
  context.lineWidth = 3;
  context.shadowColor = "#ffc765";
  context.shadowBlur = 16;
  context.stroke();
  context.beginPath();
  context.moveTo(-width * .34, 0);
  context.lineTo(width * .34, 0);
  context.strokeStyle = "rgba(98,255,224,.25)";
  context.lineWidth = 1;
  context.stroke();
  const pulse = 7 + Math.sin(time * 4) * 2;
  context.beginPath();
  context.arc(0, 0, pulse, 0, Math.PI * 2);
  context.fillStyle = "#ff7299";
  context.shadowColor = "#ff7299";
  context.shadowBlur = 22;
  context.fill();
  context.restore();
}

function drawImpacts(context, delta) {
  impacts = impacts.filter((impact) => {
    impact.age += delta;
    const alpha = Math.max(0, 1 - impact.age / .42);
    context.save();
    context.globalAlpha = alpha;
    context.beginPath();
    context.moveTo(arenaCanvas.clientWidth / 2, arenaCanvas.clientHeight * .88);
    context.lineTo(impact.x, impact.y);
    context.strokeStyle = impact.correct ? "#62ffe0" : "#ff7299";
    context.lineWidth = 2 + alpha * 5;
    context.shadowColor = context.strokeStyle;
    context.shadowBlur = 20;
    context.stroke();
    context.restore();
    return impact.age < .42;
  });
  particles = particles.filter((particle) => {
    particle.age += delta;
    particle.x += particle.vx * delta;
    particle.y += particle.vy * delta;
    particle.vx *= .97;
    particle.vy *= .97;
    const alpha = Math.max(0, 1 - particle.age / particle.life);
    context.save();
    context.globalAlpha = alpha;
    context.fillStyle = particle.correct ? "#62ffe0" : "#ff7299";
    context.fillRect(particle.x - 1.5, particle.y - 1.5, 3, 3);
    context.restore();
    return particle.age < particle.life;
  });
}

function drawArena(now) {
  const delta = Math.min(.05, (now - lastFrame) / 1000);
  lastFrame = now;
  animationTime += delta;
  const { width, height } = fitCanvas(arenaCanvas, arenaContext);
  arenaContext.clearRect(0, 0, width, height);
  const background = arenaContext.createRadialGradient(width / 2, height * .52, 20, width / 2, height * .52, Math.max(width, height) * .65);
  background.addColorStop(0, "rgba(20,57,66,.38)");
  background.addColorStop(1, "rgba(3,14,21,.04)");
  arenaContext.fillStyle = background;
  arenaContext.fillRect(0, 0, width, height);
  drawGrid(arenaContext, width, height);
  const missionId = currentMission(state)?.id ?? "patch";
  if (missionId === "patch") drawPatchStage(arenaContext, width, height, animationTime);
  if (missionId === "curvatures") drawBundleStage(arenaContext, width, height, animationTime, false);
  if (missionId === "chern") drawBundleStage(arenaContext, width, height, animationTime, true);
  if (missionId === "pullback") drawPullbackStage(arenaContext, width, height, animationTime);
  if (missionId === "fold") drawFoldStage(arenaContext, width, height, animationTime);
  drawImpacts(arenaContext, delta);
  requestAnimationFrame(drawArena);
}

function formatProbe(value) {
  if (Math.abs(value) >= 1000) return value.toExponential(2);
  return value.toFixed(4);
}

function drawFoldProbe(sample) {
  const { width, height } = fitCanvas(foldCanvas, foldContext);
  foldContext.clearRect(0, 0, width, height);
  foldContext.fillStyle = "#06131c";
  foldContext.fillRect(0, 0, width, height);
  const margin = { left: 48, right: 24, top: 24, bottom: 34 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;
  const xFor = (v) => margin.left + (v + 1) * .5 * plotWidth;
  const yFor = (value) => margin.top + (1.25 - value) / 2.5 * plotHeight;

  foldContext.strokeStyle = "rgba(128,191,188,.18)";
  foldContext.lineWidth = 1;
  foldContext.beginPath();
  foldContext.moveTo(xFor(-1), yFor(0));
  foldContext.lineTo(xFor(1), yFor(0));
  foldContext.moveTo(xFor(0), yFor(-1.25));
  foldContext.lineTo(xFor(0), yFor(1.25));
  foldContext.stroke();

  const curves = [
    { color: "#62ffe0", value: (v) => v, label: "signed v" },
    { color: "#ffc765", value: (v) => Math.abs(v), label: "unsigned |v|" },
    { color: "#ff7299", value: (v) => Math.sqrt((1 + sample.epsilon) * (v * v + sample.epsilon)), label: "regularized" },
  ];
  for (const curve of curves) {
    foldContext.beginPath();
    for (let index = 0; index <= 240; index += 1) {
      const v = -1 + index / 120;
      const x = xFor(v);
      const y = yFor(curve.value(v));
      if (index === 0) foldContext.moveTo(x, y);
      else foldContext.lineTo(x, y);
    }
    foldContext.strokeStyle = curve.color;
    foldContext.lineWidth = 2;
    foldContext.stroke();
  }
  const selectedX = xFor(sample.v);
  foldContext.beginPath();
  foldContext.moveTo(selectedX, margin.top);
  foldContext.lineTo(selectedX, height - margin.bottom);
  foldContext.strokeStyle = "rgba(237,249,246,.55)";
  foldContext.setLineDash([4, 6]);
  foldContext.stroke();
  foldContext.setLineDash([]);
  curves.forEach((curve) => {
    foldContext.beginPath();
    foldContext.arc(selectedX, yFor(curve.value(sample.v)), 4, 0, Math.PI * 2);
    foldContext.fillStyle = curve.color;
    foldContext.fill();
  });
  foldContext.font = '10px "DM Mono", monospace';
  curves.forEach((curve, index) => {
    foldContext.fillStyle = curve.color;
    foldContext.fillText(curve.label, margin.left + index * 118, 15);
  });
}

function updateFoldProbe() {
  const v = Number(ui.foldV.value);
  const exponent = Number(ui.foldEpsilon.value);
  const epsilon = 10 ** exponent;
  const sample = foldRegularizationSample(v, epsilon);
  ui.foldVOutput.textContent = v.toFixed(2).replace("-", "−");
  ui.foldEpsilonOutput.textContent = exponent.toFixed(1).replace("-", "−");
  ui.foldDet.textContent = formatProbe(sample.determinant);
  ui.foldSigned.textContent = formatProbe(sample.signedDensity).replace("-", "−");
  ui.foldUnsigned.textContent = formatProbe(sample.unsignedDensity);
  ui.foldInverse.textContent = formatProbe(sample.inverse22);
  drawFoldProbe(sample);
}

ui.startButton.addEventListener("click", startRun);
ui.replayButton.addEventListener("click", startRun);
ui.nextMission.addEventListener("click", advanceMission);
ui.soundButton.addEventListener("click", toggleSound);
ui.foldV.addEventListener("input", updateFoldProbe);
ui.foldEpsilon.addEventListener("input", updateFoldProbe);

window.addEventListener("keydown", (event) => {
  if (event.key.toLowerCase() === "m") {
    toggleSound();
    return;
  }
  if (event.key.toLowerCase() === "r") {
    startRun();
    return;
  }
  if (state.status === "mission-clear" && (event.key === "Enter" || event.key === " ")) {
    event.preventDefault();
    advanceMission();
    return;
  }
  const index = Number(event.key) - 1;
  if (index >= 0 && index < 3) {
    const target = ui.answers.querySelector(`[data-choice="${index}"]`);
    if (target) chooseAnswer(index, target);
  }
});

new ResizeObserver(() => {
  if (!ui.foldConsole.hidden) updateFoldProbe();
}).observe(foldCanvas);

renderState();
requestAnimationFrame(drawArena);
