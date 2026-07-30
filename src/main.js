import {
  FIXED_STEP,
  TAU,
  bzCoordinates,
  chargeFromSignedArea,
  createMissionState,
  cuspPoints,
  foldBranchesAtU,
  makeMissions,
  mapToState,
  missionEvidence,
  orientationAt,
  orientationValue,
  periodicDistance,
  signedPeriodicDelta,
  stepMission,
} from "./game.js";
import { SINGULARITY_IDS } from "./singularity-types.js";
import {
  createTorusTutorialState,
  resetTorusTutorial,
  torusTutorialView,
  updateTorusTutorial,
} from "./tutorial.js";

const missions = makeMissions();

const ui = {
  missionNumber: document.querySelector("#mission-number"),
  missionEyebrow: document.querySelector("#mission-eyebrow"),
  missionTitle: document.querySelector("#mission-title"),
  missionBrief: document.querySelector("#mission-brief"),
  missionObjective: document.querySelector("#mission-objective"),
  missionHint: document.querySelector("#mission-hint"),
  gateProgress: document.querySelector("#gate-progress"),
  orientationCard: document.querySelector("#orientation-card"),
  orientationValue: document.querySelector("#orientation-value"),
  orientationWord: document.querySelector("#orientation-word"),
  multiplicityValue: document.querySelector("#multiplicity-value"),
  stretchValue: document.querySelector("#stretch-value"),
  stretchWord: document.querySelector("#stretch-word"),
  chargeValue: document.querySelector("#charge-value"),
  chargeTarget: document.querySelector("#charge-target"),
  timerValue: document.querySelector("#timer-value"),
  timerWord: document.querySelector("#timer-word"),
  sourceCoordinates: document.querySelector("#source-coordinates"),
  stateCoordinates: document.querySelector("#state-coordinates"),
  cameraPhase: document.querySelector("#camera-phase"),
  rawValue: document.querySelector("#raw-value"),
  signedValue: document.querySelector("#signed-value"),
  rawMeter: document.querySelector("#raw-meter"),
  signedMeter: document.querySelector("#signed-meter"),
  coverageMessage: document.querySelector("#coverage-message"),
  fieldEffectCard: document.querySelector("#field-effect-card"),
  fieldEffectName: document.querySelector("#field-effect-name"),
  fieldEffectAction: document.querySelector("#field-effect-action"),
  fieldEffectResult: document.querySelector("#field-effect-result"),
  cuspAlert: document.querySelector("#cusp-alert"),
  startScreen: document.querySelector("#start-screen"),
  startButton: document.querySelector("#start-button"),
  pauseScreen: document.querySelector("#pause-screen"),
  evidenceOverlay: document.querySelector("#evidence-overlay"),
  evidenceStatus: document.querySelector("#evidence-status"),
  evidenceEyebrow: document.querySelector("#evidence-eyebrow"),
  evidenceTitle: document.querySelector("#evidence-title"),
  evidenceSummary: document.querySelector("#evidence-summary"),
  evidenceSign: document.querySelector("#evidence-sign"),
  evidenceMultiplicity: document.querySelector("#evidence-multiplicity"),
  evidenceRaw: document.querySelector("#evidence-raw"),
  evidenceSigned: document.querySelector("#evidence-signed"),
  evidenceCharge: document.querySelector("#evidence-charge"),
  evidenceTime: document.querySelector("#evidence-time"),
  retryButton: document.querySelector("#retry-button"),
  nextButton: document.querySelector("#next-button"),
  nextLabel: document.querySelector("#next-label"),
  soundButton: document.querySelector("#sound-button"),
  soundIcon: document.querySelector("#sound-icon"),
  cameraButton: document.querySelector("#camera-button"),
  pulseButton: document.querySelector("#pulse-button"),
  liveBzPoint: document.querySelector("#live-bz-point"),
  liveBlochPoint: document.querySelector("#live-bloch-point"),
  liveCellCard: document.querySelector("#live-cell-card"),
  liveCellContribution: document.querySelector("#live-cell-contribution"),
  telemetry: document.querySelector("#telemetry"),
  liveCorrespondence: document.querySelector("#live-correspondence"),
  coverage: document.querySelector("#coverage"),
  tutorialStep: document.querySelector("#tutorial-step"),
  tutorialVerb: document.querySelector("#tutorial-verb"),
  tutorialDetail: document.querySelector("#tutorial-detail"),
  signBank: document.querySelector("#sign-bank"),
  signBankValue: document.querySelector("#sign-bank-value"),
  impactFeedback: document.querySelector("#impact-feedback"),
  impactSign: document.querySelector("#impact-sign"),
  impactTitle: document.querySelector("#impact-title"),
  impactDetail: document.querySelector("#impact-detail"),
};

const FIELD_EFFECT_COPY = {
  positive: {
    name: "HERE: A SMALL BZ PATCH ADDS AREA",
    action: "MOVE LEFT DOT → WHITE BLOCH DOT MOVES",
    result: "λ̄ > 0 · AN AUTHORED GATE HERE CARRIES +1",
  },
  fold: {
    name: "ON AMBER LINE: THE PATCH COLLAPSES TO A CURVE",
    action: "λ̄ ≈ 0 · THE WHITE IMAGE TURNS BACK",
    result: "det g = 0 · g⁻¹ UNAVAILABLE · NO DAMAGE",
  },
  "near-fold": {
    name: "NEAR AMBER CURVE: AREA IS BEING COMPRESSED",
    action: "λ̄ IS SMALL BUT NONZERO · THIS POINT IS STILL REGULAR",
    result: "det g > 0 · ORIENTATION SIGN STILL COUNTS",
  },
  reversed: {
    name: "INSIDE CORAL REGION: THE PATCH COUNTS BACKWARD",
    action: "MOVE LEFT DOT → WHITE IMAGE HAS REVERSED ORIENTATION",
    result: "λ̄ < 0 · AN AUTHORED GATE HERE CARRIES −1",
  },
  cusp: {
    name: "ON Σ AT AMBER TRIANGLE: THIS IS THE CUSP POINT",
    action: "SOURCE MOTION ALIGNS WITH THE COLLAPSED DIRECTION",
    result: "THIS POINT IS ON Σ · THE CUSP IS NOT AN ISOLATED SINGULAR SET",
  },
};

const domainCanvas = document.querySelector("#domain-canvas");
const surfaceCanvas = document.querySelector("#surface-canvas");
const evidenceDomain = document.querySelector("#evidence-domain");
const evidenceState = document.querySelector("#evidence-state");

let game = createMissionState(0, missions);
let accumulated = 0;
let previousTime = performance.now();
let paused = false;
let startedExperience = false;
let pulseQueued = false;
let overlayTimer = null;
let lastStatus = game.status;
let tutorial = createTorusTutorialState(game.mission.id);
const visualBursts = [];

const camera = {
  yaw: -0.34,
  pitch: 0.72,
  targetYaw: -0.34,
  targetPitch: 0.72,
  dragging: false,
  pointerX: 0,
  pointerY: 0,
};

const keys = new Set();
const touchDirections = new Set();

class SoundField {
  constructor() {
    this.context = null;
    this.output = null;
    this.enabled = true;
    this.lastCuspTone = -Infinity;
  }

  ensure() {
    if (!this.enabled) return;
    if (!this.context) {
      this.context = new AudioContext();
      this.output = this.context.createGain();
      this.output.gain.value = 0.28;
      this.output.connect(this.context.destination);
    }
    if (this.context.state === "suspended") this.context.resume();
  }

  tone(frequency, duration = 0.12, options = {}) {
    if (!this.enabled) return;
    this.ensure();
    if (!this.context) return;
    const now = this.context.currentTime;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = options.type ?? "sine";
    oscillator.frequency.setValueAtTime(frequency, now);
    if (options.slide) {
      oscillator.frequency.exponentialRampToValueAtTime(options.slide, now + duration);
    }
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(options.volume ?? 0.13, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    oscillator.connect(gain);
    gain.connect(this.output);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.02);
  }

  chord(frequencies, spacing = 0.06) {
    frequencies.forEach((frequency, index) => {
      window.setTimeout(() => this.tone(frequency, 0.22, {
        type: index % 2 ? "triangle" : "sine",
        volume: 0.1,
      }), index * spacing * 1000);
    });
  }

  event(event) {
    if (event.type === "collect") {
      this.tone(event.sign > 0 ? 620 : 230, 0.16, {
        slide: event.sign > 0 ? 890 : 145,
        type: event.sign > 0 ? "sine" : "sawtooth",
      });
    } else if (event.type === "orientation") {
      this.tone(event.orientation > 0 ? 510 : 170, 0.2, {
        slide: event.orientation > 0 ? 720 : 115,
        type: "triangle",
        volume: 0.09,
      });
    } else if (event.type === "cusp-warning") {
      this.chord([246.94, 369.99, 739.99], 0.035);
    } else if (event.type === "field") {
      this.tone(290, 0.16, { slide: 145, type: "triangle", volume: 0.075 });
    } else if (event.type === "wrap") {
      this.tone(330, 0.18, { slide: 660, type: "sine", volume: 0.08 });
    } else if (event.type === "pulse") {
      this.tone(880, 0.35, { slide: 220, type: "sine", volume: 0.075 });
    } else if (event.type === "complete") {
      this.chord([392, 523.25, 659.25, 783.99], 0.075);
    } else if (event.type === "failed") {
      this.chord([220, 185, 146], 0.09);
    }
  }

  toggle() {
    this.enabled = !this.enabled;
    if (this.enabled) {
      this.ensure();
      this.tone(520, 0.1, { slide: 720, volume: 0.07 });
    }
    return this.enabled;
  }
}

const sound = new SoundField();

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
  return { context, width, height, ratio };
}

function domainPoint(point, width, height, pad = 26) {
  return {
    x: pad + point.u * (width - pad * 2),
    y: pad + point.v * (height - pad * 2),
  };
}

function drawTriangle(context, x, y, radius, angle, color) {
  context.save();
  context.translate(x, y);
  context.rotate(angle);
  context.beginPath();
  context.moveTo(radius * 1.15, 0);
  context.lineTo(-radius * 0.78, radius * 0.68);
  context.lineTo(-radius * 0.45, 0);
  context.lineTo(-radius * 0.78, -radius * 0.68);
  context.closePath();
  context.fillStyle = color;
  context.shadowColor = color;
  context.shadowBlur = 18;
  context.fill();
  context.restore();
}

function drawFoldDomain(context, width, height, time) {
  const pad = 26;
  const usableWidth = width - pad * 2;
  const usableHeight = height - pad * 2;
  const samples = Math.max(180, Math.round(usableWidth / 2));

  context.save();
  for (let index = 0; index < samples; index += 1) {
    const u = (index + 0.5) / samples;
    const branches = foldBranchesAtU(u);
    if (branches.length !== 2) continue;
    const x = pad + (index / samples) * usableWidth;
    const y1 = pad + branches[0] * usableHeight;
    const y2 = pad + branches[1] * usableHeight;
    context.fillStyle = "rgba(255, 111, 145, 0.115)";
    if (orientationAt(u, (branches[0] + branches[1]) / 2) < 0) {
      context.fillRect(x, y1, usableWidth / samples + 1, y2 - y1);
    } else {
      context.fillRect(x, pad, usableWidth / samples + 1, y1 - pad);
      context.fillRect(x, y2, usableWidth / samples + 1, pad + usableHeight - y2);
    }
  }

  for (let branchIndex = 0; branchIndex < 2; branchIndex += 1) {
    context.beginPath();
    let drawing = false;
    for (let index = 0; index <= samples; index += 1) {
      const u = index / samples;
      const branches = foldBranchesAtU(u);
      if (branches.length !== 2) {
        drawing = false;
        continue;
      }
      const point = domainPoint({ u, v: branches[branchIndex] }, width, height, pad);
      if (!drawing) {
        context.moveTo(point.x, point.y);
        drawing = true;
      } else {
        context.lineTo(point.x, point.y);
      }
    }
    context.strokeStyle = "rgba(255, 201, 107, 0.8)";
    context.lineWidth = 1.25;
    context.shadowColor = "#ffc96b";
    context.shadowBlur = 7;
    context.stroke();
  }

  context.save();
  context.fillStyle = "rgba(255, 111, 145, 0.78)";
  context.font = '7px "IBM Plex Mono", monospace';
  context.textAlign = "center";
  context.textBaseline = "middle";
  for (const source of [{ u: 0.58, v: 0.58 }, { u: 0.72, v: 0.72 }]) {
    const point = domainPoint(source, width, height, pad);
    context.fillText("λ̄ < 0 · REVERSED", point.x, point.y);
  }
  context.restore();

  for (const cusp of cuspPoints()) {
    const point = domainPoint(cusp, width, height, pad);
    const pulse = 1 + 0.18 * Math.sin(time * 0.006 + cusp.u * TAU);
    context.save();
    context.translate(point.x, point.y);
    context.strokeStyle = "rgba(255, 201, 107, 0.95)";
    context.fillStyle = "rgba(255, 201, 107, 0.2)";
    context.lineWidth = 1;
    context.shadowColor = "#ffc96b";
    context.shadowBlur = 13;
    context.beginPath();
    context.moveTo(0, -6 * pulse);
    context.lineTo(6 * pulse, 5 * pulse);
    context.lineTo(-6 * pulse, 5 * pulse);
    context.closePath();
    context.fill();
    context.stroke();
    context.shadowBlur = 0;
    context.fillStyle = "rgba(255, 201, 107, 0.86)";
    context.font = '6px "IBM Plex Mono", monospace';
    context.textAlign = cusp.u > 0.78 ? "right" : "left";
    context.fillText("WHITNEY CUSP", cusp.u > 0.78 ? -9 : 9, -8);
    context.restore();
  }
  context.restore();
}

function gateVisibility(gate, index) {
  if (game.collected.includes(gate.id)) return 0.2;
  if (game.mission.ordered && index > game.nextGate) return 0.55;
  if (gate.kind === "source") return 1;
  if (gate.kind === "echo") return 0.58 + game.pulse * 0.42;
  return 0.58 + game.pulse * 0.3;
}

function drawDomainGate(context, gate, index, width, height, time) {
  const alpha = gateVisibility(gate, index);
  if (alpha <= 0) return;
  const point = domainPoint(gate, width, height);
  const active = !game.mission.ordered || index === game.nextGate;
  const collected = game.collected.includes(gate.id);
  const radius = 8 + (active ? 2.2 * Math.sin(time * 0.004 + index) : 0);
  const color = gate.requiredOrientation < 0 ? "#ff6f91" : "#65ffe2";

  context.save();
  context.globalAlpha = alpha;
  context.translate(point.x, point.y);
  context.strokeStyle = collected ? "rgba(121,145,143,.55)" : color;
  context.lineWidth = active ? 1.6 : 1;
  context.shadowColor = color;
  context.shadowBlur = active ? 14 : 5;
  context.beginPath();
  context.arc(0, 0, radius, 0, TAU);
  context.stroke();
  context.setLineDash([2, 4]);
  context.rotate(-time * 0.0004 * (gate.requiredOrientation < 0 ? -1 : 1));
  context.beginPath();
  context.arc(0, 0, radius + 5, 0, Math.PI * 1.45);
  context.stroke();
  context.setLineDash([]);
  context.fillStyle = collected ? "#79918f" : color;
  context.font = "7px monospace";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.shadowBlur = 0;
  context.fillText(collected ? "✓" : String(index + 1).padStart(2, "0"), 0, 0);
  context.restore();
}

function activeTargetGate() {
  if (game.mission.ordered) return game.mission.gates[game.nextGate] ?? null;
  const candidates = game.mission.gates.filter((gate) => !game.collected.includes(gate.id));
  return candidates.sort((a, b) => periodicDistance(game.source, a) - periodicDistance(game.source, b))[0] ?? null;
}

function drawTargetCompass(context, width, height, time) {
  const gate = activeTargetGate();
  if (!gate) return;
  const player = domainPoint(game.source, width, height);
  const du = signedPeriodicDelta(game.source.u, gate.u);
  const dv = signedPeriodicDelta(game.source.v, gate.v);
  const magnitude = Math.hypot(du, dv);
  if (magnitude < 0.02) return;
  const angle = Math.atan2(dv, du);
  const radius = Math.min(width, height) * 0.095;
  const x = player.x + Math.cos(angle) * radius;
  const y = player.y + Math.sin(angle) * radius;
  context.save();
  context.translate(x, y);
  context.rotate(angle + Math.PI / 2);
  context.fillStyle = `rgba(255,201,107,${0.78 + Math.sin(time * 0.008) * 0.18})`;
  context.shadowColor = "#ffc96b";
  context.shadowBlur = 12;
  context.beginPath();
  context.moveTo(0, -8);
  context.lineTo(6, 6);
  context.lineTo(-6, 6);
  context.closePath();
  context.fill();
  context.restore();
  context.save();
  context.fillStyle = "#ffc96b";
  context.font = "700 8px monospace";
  context.textAlign = "center";
  context.fillText(`${String(game.mission.gates.indexOf(gate) + 1).padStart(2, "0")} · ${Math.round(magnitude * 100)}%`, x, y + 18);
  context.restore();
}

function drawDomainBearings(context, width, height) {
  if (game.mission.id !== "echo" || game.pulse <= 0) return;
  const player = domainPoint(game.source, width, height);
  context.save();
  context.setLineDash([4, 6]);
  context.lineWidth = 1;
  for (const gate of game.mission.gates) {
    if (game.collected.includes(gate.id)) continue;
    const point = domainPoint(gate, width, height);
    context.strokeStyle = `rgba(101,255,226,${0.18 + game.pulse * 0.48})`;
    context.beginPath();
    context.moveTo(player.x, player.y);
    context.lineTo(point.x, point.y);
    context.stroke();
  }
  context.restore();
}

function drawDomainBursts(context, width, height) {
  for (const effect of visualBursts) {
    const point = domainPoint(effect.source, width, height);
    const progress = 1 - effect.life / 0.25;
    context.save();
    context.globalAlpha = Math.max(0, effect.life / 0.25);
    context.strokeStyle = effect.sign < 0 ? "#ff6f91" : "#65ffe2";
    context.lineWidth = 3 - progress * 1.5;
    context.shadowColor = context.strokeStyle;
    context.shadowBlur = 18;
    context.beginPath();
    context.arc(point.x, point.y, 10 + progress * 46, 0, TAU);
    context.stroke();
    context.restore();
  }
}

function drawDomainTrail(context, width, height) {
  const trail = game.sourceTrail;
  if (trail.length < 2) return;
  context.save();
  context.lineCap = "round";
  context.lineJoin = "round";
  for (let index = 1; index < trail.length; index += 1) {
    const previous = trail[index - 1];
    const current = trail[index];
    if (
      Math.abs(current.source.u - previous.source.u) > 0.5
      || Math.abs(current.source.v - previous.source.v) > 0.5
    ) continue;
    const start = domainPoint(previous.source, width, height);
    const end = domainPoint(current.source, width, height);
    const age = (trail.length - index) / trail.length;
    context.beginPath();
    context.moveTo(start.x, start.y);
    context.lineTo(end.x, end.y);
    context.strokeStyle = current.orientation > 0
      ? `rgba(101,255,226,${0.18 + (1 - age) * 0.52})`
      : `rgba(255,111,145,${0.2 + (1 - age) * 0.55})`;
    context.lineWidth = 1 + (1 - age) * 0.65;
    context.stroke();
  }
  context.restore();
}

function drawDomainPlayer(context, width, height, time) {
  const player = domainPoint(game.source, width, height);
  const speed = Math.hypot(game.source.vx, game.source.vy);
  const angle = speed > 0.002
    ? Math.atan2(game.source.vy, game.source.vx)
    : -Math.PI / 2;
  const color = game.orientation > 0 ? "#65ffe2" : "#ff6f91";

  const copies = [{ x: player.x, y: player.y, alpha: 1 }];
  const pad = 26;
  const usableWidth = width - pad * 2;
  const usableHeight = height - pad * 2;
  const threshold = 0.065;
  if (game.source.u < threshold) copies.push({ x: player.x + usableWidth, y: player.y, alpha: 0.35 });
  if (game.source.u > 1 - threshold) copies.push({ x: player.x - usableWidth, y: player.y, alpha: 0.35 });
  if (game.source.v < threshold) copies.push({ x: player.x, y: player.y + usableHeight, alpha: 0.35 });
  if (game.source.v > 1 - threshold) copies.push({ x: player.x, y: player.y - usableHeight, alpha: 0.35 });

  for (const copy of copies) {
    context.save();
    context.globalAlpha = copy.alpha;
    context.strokeStyle = color;
    context.globalAlpha *= 0.22;
    context.beginPath();
    context.arc(copy.x, copy.y, 12 + Math.sin(time * 0.006) * 1.5, 0, TAU);
    context.stroke();
    context.restore();
    drawTriangle(context, copy.x, copy.y, 8.5, angle, color);
  }

  if (game.pulse > 0) {
    const radius = (1 - game.pulse) * Math.min(width, height) * 0.34 + 15;
    context.save();
    context.strokeStyle = `rgba(101,255,226,${game.pulse * 0.55})`;
    context.lineWidth = 1;
    context.beginPath();
    context.arc(player.x, player.y, radius, 0, TAU);
    context.stroke();
    context.restore();
  }
}

function drawDomain(time) {
  const { context, width, height } = canvasFrame(domainCanvas);
  context.clearRect(0, 0, width, height);
  const pad = 26;
  const left = pad;
  const top = pad;
  const arenaWidth = width - pad * 2;
  const arenaHeight = height - pad * 2;

  const gradient = context.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, "rgba(9, 27, 36, 0.96)");
  gradient.addColorStop(1, "rgba(4, 14, 21, 0.98)");
  context.fillStyle = gradient;
  context.fillRect(0, 0, width, height);

  context.save();
  context.beginPath();
  context.rect(left, top, arenaWidth, arenaHeight);
  context.clip();

  context.strokeStyle = "rgba(121, 177, 174, 0.075)";
  context.lineWidth = 1;
  for (let index = 0; index <= 12; index += 1) {
    const x = left + (index / 12) * arenaWidth;
    const y = top + (index / 12) * arenaHeight;
    context.beginPath();
    context.moveTo(x, top);
    context.lineTo(x, top + arenaHeight);
    context.stroke();
    context.beginPath();
    context.moveTo(left, y);
    context.lineTo(left + arenaWidth, y);
    context.stroke();
  }

  context.strokeStyle = "rgba(101, 255, 226, 0.08)";
  context.setLineDash([1, 7]);
  for (let index = -12; index < 24; index += 1) {
    context.beginPath();
    context.moveTo(left + index * 38 + (time * 0.003) % 38, top);
    context.lineTo(left + index * 38 + arenaHeight + (time * 0.003) % 38, top + arenaHeight);
    context.stroke();
  }
  context.setLineDash([]);

  drawFoldDomain(context, width, height, time);
  drawDomainTrail(context, width, height);

  if (game.mission.home) {
    const home = domainPoint(game.mission.home, width, height);
    const ready = game.collected.length === game.mission.gates.length;
    context.save();
    context.strokeStyle = ready ? "#ffc96b" : "rgba(255,201,107,.25)";
    context.lineWidth = ready ? 2 : 1;
    context.setLineDash([4, 5]);
    context.beginPath();
    context.arc(home.x, home.y, 18 + Math.sin(time * 0.004) * 2, 0, TAU);
    context.stroke();
    context.setLineDash([]);
    context.fillStyle = ready ? "#ffc96b" : "rgba(255,201,107,.45)";
    context.font = "7px monospace";
    context.textAlign = "center";
    context.fillText("HOME", home.x, home.y + 2);
    context.restore();
  }

  game.mission.gates.forEach((gate, index) => {
    drawDomainGate(context, gate, index, width, height, time);
  });
  drawDomainBearings(context, width, height);
  drawTargetCompass(context, width, height, time);
  drawDomainPlayer(context, width, height, time);
  drawDomainBursts(context, width, height);
  context.restore();

  context.save();
  context.strokeStyle = game.cuspRisk < 0.068
    ? `rgba(255,201,107,${0.55 + Math.sin(time * 0.012) * 0.25})`
    : "rgba(101,255,226,.22)";
  context.lineWidth = game.cuspRisk < 0.068 ? 2 : 1;
  context.strokeRect(left + 0.5, top + 0.5, arenaWidth - 1, arenaHeight - 1);
  context.restore();
}

function sphereWorld(point) {
  const radius = 1.48;
  return {
    x: radius * point.x,
    y: radius * point.y,
    z: radius * point.z,
  };
}

function projectWorld(world, width, height) {
  const cosYaw = Math.cos(camera.yaw);
  const sinYaw = Math.sin(camera.yaw);
  const cosPitch = Math.cos(camera.pitch);
  const sinPitch = Math.sin(camera.pitch);
  const rotatedX = world.x * cosYaw - world.y * sinYaw;
  const rotatedY = world.x * sinYaw + world.y * cosYaw;
  const screenY = world.z * cosPitch - rotatedY * sinPitch;
  const depth = rotatedY * cosPitch + world.z * sinPitch;
  const scale = Math.min(width / 3.7, height / 3.25);
  return {
    x: width / 2 + rotatedX * scale,
    y: height / 2 + screenY * scale,
    depth,
    scale,
  };
}

function projectState(point, width, height) {
  return projectWorld(sphereWorld(point), width, height);
}

function spherePoint(longitude, latitude) {
  const sinLatitude = Math.sin(latitude);
  return {
    x: sinLatitude * Math.cos(longitude),
    y: sinLatitude * Math.sin(longitude),
    z: Math.cos(latitude),
  };
}

function buildSphereMesh(width, height) {
  const longitudeSegments = 48;
  const latitudeSegments = 24;
  const quads = [];
  for (let longitudeIndex = 0; longitudeIndex < longitudeSegments; longitudeIndex += 1) {
    for (let latitudeIndex = 0; latitudeIndex < latitudeSegments; latitudeIndex += 1) {
      const longitude0 = TAU * longitudeIndex / longitudeSegments;
      const longitude1 = TAU * (longitudeIndex + 1) / longitudeSegments;
      const latitude0 = Math.PI * latitudeIndex / latitudeSegments;
      const latitude1 = Math.PI * (latitudeIndex + 1) / latitudeSegments;
      const points = [
        projectState(spherePoint(longitude0, latitude0), width, height),
        projectState(spherePoint(longitude1, latitude0), width, height),
        projectState(spherePoint(longitude1, latitude1), width, height),
        projectState(spherePoint(longitude0, latitude1), width, height),
      ];
      quads.push({
        points,
        depth: points.reduce((sum, point) => sum + point.depth, 0) / points.length,
        longitude: (longitude0 + longitude1) / 2,
        latitude: (latitude0 + latitude1) / 2,
      });
    }
  }
  return quads.sort((a, b) => a.depth - b.depth);
}

function drawSphereMesh(context, width, height) {
  const mesh = buildSphereMesh(width, height);
  for (const quad of mesh) {
    const light = Math.round(10 + ((quad.depth + 1.5) / 3) * 11);
    const stripe = Math.sin(quad.latitude * 6 + quad.longitude * 2) * 1.6;
    context.beginPath();
    context.moveTo(quad.points[0].x, quad.points[0].y);
    for (let index = 1; index < quad.points.length; index += 1) {
      context.lineTo(quad.points[index].x, quad.points[index].y);
    }
    context.closePath();
    context.fillStyle = `hsl(${184 + stripe * 2} 31% ${light + stripe}%)`;
    context.strokeStyle = quad.depth > 0.3
      ? "rgba(117, 198, 190, 0.12)"
      : "rgba(66, 112, 111, 0.055)";
    context.lineWidth = 0.55;
    context.fill();
    context.stroke();
  }
}

function drawProjectedCurve(context, points, width, height, options = {}) {
  if (points.length < 2) return;
  context.save();
  context.beginPath();
  let previous = projectState(points[0], width, height);
  context.moveTo(previous.x, previous.y);
  for (let index = 1; index < points.length; index += 1) {
    const projected = projectState(points[index], width, height);
    context.lineTo(projected.x, projected.y);
    previous = projected;
  }
  context.strokeStyle = options.color ?? "rgba(255,201,107,.7)";
  context.lineWidth = options.width ?? 1;
  context.globalAlpha = options.alpha ?? 1;
  context.shadowColor = options.shadow ?? options.color ?? "#ffc96b";
  context.shadowBlur = options.blur ?? 0;
  context.stroke();
  context.restore();
}

function drawStateFolds(context, width, height) {
  const samples = 360;
  for (let branchIndex = 0; branchIndex < 2; branchIndex += 1) {
    let segment = [];
    for (let index = 0; index <= samples; index += 1) {
      const u = index / samples;
      const branches = foldBranchesAtU(u);
      if (branches.length !== 2) {
        if (segment.length > 1) {
          drawProjectedCurve(context, segment, width, height, {
            color: "rgba(255,201,107,.66)",
            width: 1.1,
            blur: 7,
          });
        }
        segment = [];
        continue;
      }
      segment.push(mapToState({ u, v: branches[branchIndex] }));
    }
    if (segment.length > 1) {
      drawProjectedCurve(context, segment, width, height, {
        color: "rgba(255,201,107,.66)",
        width: 1.1,
        blur: 7,
      });
    }
  }
}

function drawStateTrail(context, width, height) {
  const trail = game.sourceTrail;
  if (trail.length < 2) return;
  context.save();
  context.lineCap = "round";
  for (let index = 1; index < trail.length; index += 1) {
    const previous = projectState(trail[index - 1].mapped, width, height);
    const current = projectState(trail[index].mapped, width, height);
    const freshness = index / trail.length;
    context.beginPath();
    context.moveTo(previous.x, previous.y);
    context.lineTo(current.x, current.y);
    context.strokeStyle = trail[index].orientation > 0
      ? `rgba(101,255,226,${0.12 + freshness * 0.6})`
      : `rgba(255,111,145,${0.14 + freshness * 0.62})`;
    context.lineWidth = 1 + freshness * 1.15;
    context.shadowColor = trail[index].orientation > 0 ? "#65ffe2" : "#ff6f91";
    context.shadowBlur = freshness > 0.85 ? 6 : 0;
    context.stroke();
  }
  context.restore();
}

function drawStateGate(context, gate, index, width, height, time) {
  const collected = game.collected.includes(gate.id);
  const active = !game.mission.ordered || index === game.nextGate;
  const alpha = collected ? 0.22 : (active ? 1 : 0.55);
  const point = projectState({ x: gate.stateX, y: gate.stateY, z: gate.stateZ }, width, height);
  const scale = Math.max(0.72, 1 + point.depth * 0.11);
  const color = gate.requiredOrientation < 0 ? "#ff6f91" : "#65ffe2";
  const radius = (9 + (active ? Math.sin(time * 0.004 + index) * 2 : 0)) * scale;

  context.save();
  context.globalAlpha = alpha;
  context.translate(point.x, point.y);
  context.strokeStyle = color;
  context.fillStyle = "rgba(5,14,20,.75)";
  context.lineWidth = active ? 1.6 : 1;
  context.shadowColor = color;
  context.shadowBlur = active ? 16 : 4;
  context.beginPath();
  context.arc(0, 0, radius, 0, TAU);
  context.fill();
  context.stroke();
  context.setLineDash([2, 3]);
  context.beginPath();
  context.arc(0, 0, radius + 5, time * 0.001, time * 0.001 + Math.PI * 1.45);
  context.stroke();
  context.setLineDash([]);
  context.shadowBlur = 0;
  context.fillStyle = color;
  context.font = "7px monospace";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(collected ? "✓" : String(index + 1).padStart(2, "0"), 0, 0);
  context.restore();
}

function drawStateBursts(context, width, height) {
  for (const effect of visualBursts) {
    const point = projectState(effect.mapped, width, height);
    const progress = 1 - effect.life / 0.25;
    context.save();
    context.globalAlpha = Math.max(0, effect.life / 0.25);
    context.strokeStyle = effect.sign < 0 ? "#ff6f91" : "#65ffe2";
    context.lineWidth = 3 - progress * 1.5;
    context.shadowColor = context.strokeStyle;
    context.shadowBlur = 18;
    context.beginPath();
    context.arc(point.x, point.y, 10 + progress * 42, 0, TAU);
    context.stroke();
    context.restore();
  }
}

function drawCoverageStamps(context, width, height, time) {
  for (let index = 0; index < game.collected.length; index += 1) {
    const gate = game.mission.gates.find((candidate) => candidate.id === game.collected[index]);
    if (!gate) continue;
    const projected = projectState({ x: gate.stateX, y: gate.stateY, z: gate.stateZ }, width, height);
    const sign = gate.requiredOrientation;
    context.save();
    context.globalAlpha = 0.22;
    context.strokeStyle = sign > 0 ? "#65ffe2" : "#ff6f91";
    context.lineWidth = 5;
    context.shadowColor = context.strokeStyle;
    context.shadowBlur = 17;
    context.beginPath();
    context.arc(
      projected.x,
      projected.y,
      16 + ((time * 0.008 + index * 3) % 11),
      0,
      TAU,
    );
    context.stroke();
    context.restore();
  }
}

function drawMappedPlayer(context, width, height, time) {
  const point = projectState(game.mapped, width, height);
  const color = game.orientation > 0 ? "#65ffe2" : "#ff6f91";
  const pulse = 1 + Math.sin(time * 0.008) * 0.08;
  context.save();
  context.translate(point.x, point.y);
  context.rotate(time * 0.0012 * game.orientation);
  context.strokeStyle = color;
  context.fillStyle = "#f2fffc";
  context.shadowColor = color;
  context.shadowBlur = 22;
  context.lineWidth = 1.5;
  context.beginPath();
  context.rect(-6 * pulse, -6 * pulse, 12 * pulse, 12 * pulse);
  context.fill();
  context.stroke();
  context.restore();

  if (game.multiplicity === 3) {
    context.save();
    context.strokeStyle = "rgba(255,201,107,.62)";
    context.setLineDash([2, 4]);
    for (let ring = 0; ring < 3; ring += 1) {
      context.beginPath();
      context.arc(point.x, point.y, 12 + ring * 4 + Math.sin(time * 0.004 + ring) * 1.5, 0, TAU);
      context.stroke();
    }
    context.restore();
  }
}

function drawSurface(time) {
  const { context, width, height } = canvasFrame(surfaceCanvas);
  context.clearRect(0, 0, width, height);
  const background = context.createRadialGradient(
    width * 0.5,
    height * 0.45,
    0,
    width * 0.5,
    height * 0.5,
    Math.max(width, height) * 0.7,
  );
  background.addColorStop(0, "rgba(21, 38, 48, .92)");
  background.addColorStop(0.55, "rgba(7, 16, 24, .97)");
  background.addColorStop(1, "rgba(4, 10, 15, 1)");
  context.fillStyle = background;
  context.fillRect(0, 0, width, height);

  context.save();
  context.strokeStyle = "rgba(117, 170, 169, .035)";
  for (let radius = 40; radius < Math.max(width, height); radius += 46) {
    context.beginPath();
    context.arc(width / 2, height / 2, radius, 0, TAU);
    context.stroke();
  }
  context.restore();

  drawSphereMesh(context, width, height);
  drawStateFolds(context, width, height);
  drawCoverageStamps(context, width, height, time);
  drawStateTrail(context, width, height);
  game.mission.gates.forEach((gate, index) => {
    drawStateGate(context, gate, index, width, height, time);
  });
  drawMappedPlayer(context, width, height, time);
  drawStateBursts(context, width, height);
}

function formatSigned(value, precision = 0) {
  const fixed = Number(value).toFixed(precision);
  if (value > 0) return `+${fixed}`;
  return fixed;
}

function updateTelemetry() {
  const mission = game.mission;
  ui.missionNumber.textContent = mission.number;
  ui.missionEyebrow.textContent = mission.eyebrow;
  ui.missionTitle.textContent = mission.title;
  ui.missionBrief.textContent = mission.brief;
  ui.missionObjective.textContent = mission.objective;
  ui.missionHint.textContent = mission.hint;
  ui.gateProgress.textContent = `${game.collected.length} / ${mission.gates.length}`;

  ui.orientationValue.textContent = game.orientation > 0 ? "+" : "−";
  ui.orientationWord.textContent = game.orientation > 0 ? "POSITIVE" : "REVERSED";
  ui.orientationCard.classList.toggle("orientation-positive", game.orientation > 0);
  ui.orientationCard.classList.toggle("orientation-negative", game.orientation < 0);
  ui.multiplicityValue.textContent = `${game.multiplicity}×`;

  const density = Math.abs(orientationValue(game.source.u, game.source.v));
  ui.stretchValue.textContent = density.toFixed(3);
  ui.stretchWord.textContent = density < 0.035
    ? "RANK LOSS"
    : density > 0.3
      ? "STRONG AREA"
      : "REGULAR";

  const fieldEffect = game.fieldEffect;
  const atCuspPoint = fieldEffect.singularPoint?.id
    === SINGULARITY_IDS.CUSP_ON_FOLD_CURVE;
  const displayKind = atCuspPoint ? "cusp" : fieldEffect.kind;
  const fieldCopy = FIELD_EFFECT_COPY[displayKind];
  ui.fieldEffectCard.dataset.kind = displayKind;
  ui.fieldEffectName.textContent = `${fieldCopy.name} · λ̄ ${formatSigned(fieldEffect.signedDensity, 3)}`;
  ui.fieldEffectAction.textContent = fieldCopy.action;
  ui.fieldEffectResult.textContent = fieldCopy.result;
  ui.cuspAlert.hidden = !fieldEffect.cuspProximity.withinWarningRadius;

  const charge = chargeFromSignedArea(game.coverage.signedArea);
  ui.chargeValue.textContent = formatSigned(charge);
  ui.chargeTarget.textContent = mission.targetCharge === null
    ? "AUTHORED PROXY"
    : `PACKET TARGET ${formatSigned(mission.targetCharge)}`;

  if (game.remaining === null) {
    ui.timerValue.textContent = "∞";
    ui.timerWord.textContent = "OPEN RUN";
  } else {
    ui.timerValue.textContent = Math.ceil(game.remaining).toString();
    ui.timerWord.textContent = game.remaining < 15 ? "FIELD DECAY" : "SECONDS";
  }

  ui.sourceCoordinates.textContent = `u ${game.source.u.toFixed(3)} // v ${game.source.v.toFixed(3)}`;
  ui.stateCoordinates.textContent = `n (${game.mapped.x.toFixed(2)}, ${game.mapped.y.toFixed(2)}, ${game.mapped.z.toFixed(2)})`;
  const { kx, ky } = bzCoordinates(game.source);
  ui.liveBzPoint.textContent = `k=(${formatSigned(kx / Math.PI, 2)}π, ${formatSigned(ky / Math.PI, 2)}π)`;
  ui.liveBlochPoint.textContent = `n=(${game.mapped.x.toFixed(2)}, ${game.mapped.y.toFixed(2)}, ${game.mapped.z.toFixed(2)})`;
  ui.liveCellCard.dataset.kind = displayKind;
  const contributionCopy = {
    positive: "ADDS ORIENTED AREA",
    "near-fold": "APPROACHES AREA COLLAPSE",
    fold: "MAPPED PATCH COLLAPSES",
    reversed: "SUBTRACTS ORIENTED AREA",
    cusp: "ON Σ AT A CUSP POINT",
  }[displayKind];
  ui.liveCellContribution.textContent = `λ̄=${formatSigned(fieldEffect.signedDensity, 3)} · ${contributionCopy}`;
  ui.cameraPhase.textContent = `VIEW ${String(Math.round((((camera.yaw % TAU) + TAU) % TAU) * 180 / Math.PI)).padStart(3, "0")}°`;
  ui.rawValue.textContent = game.coverage.rawArea.toFixed(0);
  ui.signedValue.textContent = formatSigned(game.coverage.signedArea);

  const maxArea = Math.max(1, mission.gates.length);
  ui.rawMeter.style.width = `${Math.min(50, (game.coverage.rawArea / maxArea) * 50)}%`;
  const signedRatio = Math.max(-1, Math.min(1, game.coverage.signedArea / maxArea));
  ui.signedMeter.style.left = signedRatio < 0 ? `${50 + signedRatio * 50}%` : "50%";
  ui.signedMeter.style.width = `${Math.abs(signedRatio) * 50}%`;
  ui.signedMeter.style.background = signedRatio < 0
    ? "linear-gradient(90deg, #ff6f91, rgba(255,111,145,.54))"
    : "linear-gradient(90deg, rgba(101,255,226,.54), #65ffe2)";

  if (game.coverage.rawArea === 0) {
    ui.coverageMessage.textContent = "No packet has been collected. This is not the BZ integral.";
  } else if (Math.abs(game.coverage.signedArea) < game.coverage.rawArea) {
    ui.coverageMessage.textContent = "More packets were visited, but opposite signs cancelled.";
  } else {
    ui.coverageMessage.textContent = "Every collected packet currently has the same sign.";
  }
  renderTutorial();
}

function renderTutorial() {
  const view = torusTutorialView(tutorial, game);
  document.body.dataset.tutorialPhase = startedExperience ? view.phase : "splash";
  ui.tutorialStep.textContent = view.step;
  ui.tutorialVerb.textContent = view.command;
  ui.tutorialDetail.textContent = view.detail;
  ui.signBankValue.textContent = view.bankedSigns.length
    ? view.bankedSigns.map((sign) => sign > 0 ? "+" : "−").join("  ")
    : "EMPTY";

  for (const element of document.querySelectorAll("[data-hud]")) {
    const key = element.dataset.hud;
    const visible = key === "timer"
      ? game.remaining !== null
      : Boolean(view.reveal[key]);
    element.classList.toggle("hud-concealed", !visible);
  }
  ui.liveCorrespondence.classList.toggle("hud-concealed", !view.reveal.correspondence);
  ui.coverage.classList.toggle("hud-concealed", !view.reveal.packet);
  ui.fieldEffectCard.classList.toggle("hud-concealed", !view.reveal.fieldEffect);
  ui.cameraButton.hidden = !view.reveal.camera;

  const feedback = view.feedback;
  ui.impactFeedback.hidden = !feedback;
  if (feedback) {
    const sign = feedback.sign ?? (feedback.type === "wrap" ? 1 : 0);
    ui.impactFeedback.dataset.kind = sign < 0 ? "negative" : "positive";
    ui.impactSign.textContent = feedback.sign ? (feedback.sign > 0 ? "+" : "−") : "◎";
    ui.impactTitle.textContent = feedback.title;
    ui.impactDetail.textContent = feedback.detail;
  }
}

const completionCopy = {
  seam: {
    title: "The seam is a passage.",
    summary: "The cyan k point left one edge and re-entered at the opposite edge. The square drawing represents one periodic BZ torus.",
  },
  reverse: {
    title: "The white image folded back.",
    summary: "At the amber line λ̄ reached zero; after crossing it, the same small BZ patch contributed with the opposite orientation. Nothing damaged the player.",
  },
  echo: {
    title: "One light held three histories.",
    summary: "Three distinct cyan source points landed on one white Bloch point. The packet signs +, +, − summed to +1; the three λ̄ magnitudes were not added as packet values.",
  },
  cancel: {
    title: "Five authored packets summed to one.",
    summary: "The game added +1, −1, +1, −1, +1. This demonstrates sign cancellation; it is not numerical quadrature of the full BZ.",
  },
  free: {
    title: "Packet proxy locked at +1.",
    summary: "Three positive and two negative gate packets summed to +1. The paper's Chern number comes from integrating every BZ cell, not from these five gates.",
  },
};

function drawEvidencePath(canvas, points, orientationTrail, statePath = false) {
  const context = canvas.getContext("2d");
  const width = canvas.width;
  const height = canvas.height;
  context.clearRect(0, 0, width, height);
  context.fillStyle = "#050d14";
  context.fillRect(0, 0, width, height);
  context.strokeStyle = "rgba(121,177,174,.08)";
  context.lineWidth = 1;
  for (let index = 1; index < 8; index += 1) {
    context.beginPath();
    context.moveTo((index / 8) * width, 0);
    context.lineTo((index / 8) * width, height);
    context.stroke();
    context.beginPath();
    context.moveTo(0, (index / 8) * height);
    context.lineTo(width, (index / 8) * height);
    context.stroke();
  }
  const pad = 12;
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    if (
      Math.abs(current.u - previous.u) > 0.5
      || Math.abs(current.v - previous.v) > 0.5
    ) continue;
    context.beginPath();
    context.moveTo(pad + previous.u * (width - pad * 2), pad + previous.v * (height - pad * 2));
    context.lineTo(pad + current.u * (width - pad * 2), pad + current.v * (height - pad * 2));
    context.strokeStyle = orientationTrail[index] > 0
      ? "rgba(101,255,226,.72)"
      : "rgba(255,111,145,.78)";
    context.lineWidth = statePath ? 1.8 : 1.4;
    context.stroke();
  }
}

function showEvidence() {
  if (game.status !== "complete" && game.status !== "failed") return;
  const evidence = missionEvidence(game);
  const complete = game.status === "complete";
  const copy = complete
    ? completionCopy[game.mission.id]
    : {
      title: "The field lost coherence.",
      summary: game.remaining === 0
        ? "Time expired, but the receipt remains. Compare the raw and signed paths, then route through the compressed region more directly."
        : "The collected layers did not assemble the target integer. The receipt shows where the signs diverged.",
    };

  ui.evidenceStatus.textContent = complete ? "MISSION LOCKED" : "RUN INCOMPLETE";
  ui.evidenceStatus.style.color = complete ? "#65ffe2" : "#ff6f91";
  ui.evidenceEyebrow.textContent = `RUN ${game.mission.number} // EVIDENCE`;
  ui.evidenceTitle.textContent = copy.title;
  ui.evidenceSummary.textContent = copy.summary;
  ui.evidenceSign.textContent = game.orientation > 0 ? "+" : "−";
  ui.evidenceMultiplicity.textContent = `${evidence.multiplicity}×`;
  ui.evidenceRaw.textContent = evidence.rawArea.toFixed(0);
  ui.evidenceSigned.textContent = formatSigned(evidence.signedArea);
  ui.evidenceCharge.textContent = formatSigned(evidence.charge);
  ui.evidenceTime.textContent = `${evidence.elapsed.toFixed(1)}s`;
  ui.nextLabel.textContent = !complete
    ? "TRY AGAIN"
    : game.missionIndex === missions.length - 1
      ? "FLY AGAIN"
      : "NEXT MISSION";

  const orientations = game.sourceTrail.map((point) => point.orientation);
  drawEvidencePath(evidenceDomain, evidence.sourcePath, orientations, false);
  drawEvidencePath(evidenceState, evidence.mappedPath, orientations, true);
  ui.evidenceOverlay.hidden = false;
  ui.nextButton.focus();
}

function setMission(index) {
  if (overlayTimer) window.clearTimeout(overlayTimer);
  game = createMissionState(index, missions);
  resetTorusTutorial(tutorial, game.mission.id);
  accumulated = 0;
  lastStatus = game.status;
  ui.evidenceOverlay.hidden = true;
  updateTelemetry();
}

function startExperience() {
  if (startedExperience) return;
  startedExperience = true;
  ui.startScreen.classList.add("dismissed");
  renderTutorial();
  sound.ensure();
  sound.chord([261.63, 392, 523.25], 0.075);
  domainCanvas.focus?.();
}

function advanceMission() {
  if (game.status === "failed") {
    setMission(game.missionIndex);
    return;
  }
  const next = game.missionIndex === missions.length - 1
    ? 0
    : game.missionIndex + 1;
  setMission(next);
}

function restartMission() {
  setMission(game.missionIndex);
}

function togglePause() {
  if (!startedExperience || !ui.evidenceOverlay.hidden) return;
  paused = !paused;
  ui.pauseScreen.hidden = !paused;
  if (!paused) previousTime = performance.now();
}

function rotateCamera() {
  camera.targetYaw += Math.PI / 3;
  sound.tone(410, 0.08, { slide: 510, volume: 0.045 });
}

function directionPressed(...names) {
  return names.some((name) => keys.has(name) || touchDirections.has(name));
}

function currentInput() {
  const x = Number(directionPressed("d", "arrowright", "right"))
    - Number(directionPressed("a", "arrowleft", "left"));
  const y = Number(directionPressed("s", "arrowdown", "down"))
    - Number(directionPressed("w", "arrowup", "up"));
  const pulse = pulseQueued;
  pulseQueued = false;
  return { x, y, pulse };
}

function handleGameEvents(events, dt) {
  updateTorusTutorial(tutorial, game, events, dt);
  for (const event of events) {
    sound.event(event);
    if (["collect", "orientation", "wrap"].includes(event.type)) {
      visualBursts.push({
        life: 0.25,
        source: { u: game.source.u, v: game.source.v },
        mapped: { ...game.mapped },
        sign: event.sign ?? event.orientation ?? game.orientation,
      });
    }
    if (event.type === "orientation") {
      ui.orientationCard.classList.remove("orientation-flash");
      void ui.orientationCard.offsetWidth;
      ui.orientationCard.classList.add("orientation-flash");
    }
  }
}

function simulate(dt) {
  const input = currentInput();
  stepMission(game, input, dt);
  handleGameEvents(game.events, dt);
  if (game.status !== lastStatus) {
    lastStatus = game.status;
    if (game.status === "complete" || game.status === "failed") {
      overlayTimer = window.setTimeout(showEvidence, 620);
    }
  }
}

function frame(time) {
  const delta = Math.min(0.05, (time - previousTime) / 1000);
  previousTime = time;
  if (!paused && startedExperience && ui.evidenceOverlay.hidden) {
    accumulated += delta;
    while (accumulated >= FIXED_STEP) {
      simulate(FIXED_STEP);
      accumulated -= FIXED_STEP;
    }
  }

  camera.yaw += (camera.targetYaw - camera.yaw) * 0.09;
  camera.pitch += (camera.targetPitch - camera.pitch) * 0.09;
  for (const effect of visualBursts) effect.life -= delta;
  visualBursts.splice(0, visualBursts.length, ...visualBursts.filter((effect) => effect.life > 0));
  drawDomain(time);
  drawSurface(time);
  updateTelemetry();
  requestAnimationFrame(frame);
}

window.addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase();
  if (["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(key)) {
    event.preventDefault();
  }
  if (key === "enter") {
    if (!startedExperience) startExperience();
    else if (!ui.evidenceOverlay.hidden) advanceMission();
    return;
  }
  if (key === "r") {
    restartMission();
    return;
  }
  if (key === "p") {
    togglePause();
    return;
  }
  if (key === "m") {
    const enabled = sound.toggle();
    ui.soundButton.setAttribute("aria-pressed", String(enabled));
    ui.soundIcon.textContent = enabled ? "◖))" : "◖×";
    return;
  }
  if (key === "c") {
    rotateCamera();
    return;
  }
  if (key === " ") {
    pulseQueued = true;
    sound.ensure();
    return;
  }
  keys.add(key);
  if (["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(key)) {
    startExperience();
    sound.ensure();
  }
});

window.addEventListener("keyup", (event) => {
  keys.delete(event.key.toLowerCase());
});

window.addEventListener("blur", () => {
  keys.clear();
  touchDirections.clear();
});

document.addEventListener("visibilitychange", () => {
  if (document.hidden && startedExperience && !paused && ui.evidenceOverlay.hidden) {
    togglePause();
  }
});

for (const button of document.querySelectorAll("[data-direction]")) {
  const direction = button.dataset.direction;
  const release = (event) => {
    event.preventDefault();
    touchDirections.delete(direction);
  };
  button.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    startExperience();
    sound.ensure();
    touchDirections.add(direction);
    button.setPointerCapture?.(event.pointerId);
  });
  button.addEventListener("pointerup", release);
  button.addEventListener("pointercancel", release);
  button.addEventListener("pointerleave", release);
}

surfaceCanvas.addEventListener("pointerdown", (event) => {
  if (game.mission.id !== "free" || window.matchMedia("(max-width: 940px)").matches) return;
  camera.dragging = true;
  camera.pointerX = event.clientX;
  camera.pointerY = event.clientY;
  surfaceCanvas.setPointerCapture?.(event.pointerId);
});

surfaceCanvas.addEventListener("pointermove", (event) => {
  if (!camera.dragging) return;
  const dx = event.clientX - camera.pointerX;
  const dy = event.clientY - camera.pointerY;
  camera.targetYaw += dx * 0.008;
  camera.targetPitch = Math.max(0.25, Math.min(1.22, camera.targetPitch + dy * 0.005));
  camera.pointerX = event.clientX;
  camera.pointerY = event.clientY;
});

surfaceCanvas.addEventListener("pointerup", () => {
  camera.dragging = false;
});
surfaceCanvas.addEventListener("pointercancel", () => {
  camera.dragging = false;
});

ui.startButton.addEventListener("click", startExperience);
ui.retryButton.addEventListener("click", restartMission);
ui.nextButton.addEventListener("click", advanceMission);
ui.cameraButton.addEventListener("click", rotateCamera);
ui.soundButton.addEventListener("click", () => {
  const enabled = sound.toggle();
  ui.soundButton.setAttribute("aria-pressed", String(enabled));
  ui.soundIcon.textContent = enabled ? "◖))" : "◖×";
});
ui.pulseButton.addEventListener("pointerdown", (event) => {
  event.preventDefault();
  startExperience();
  pulseQueued = true;
  sound.ensure();
});

updateTelemetry();
requestAnimationFrame(frame);
