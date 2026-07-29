import {
  SHOOTER_STEP,
  createShooterState,
  currentShooterTarget,
  resetShooter,
  startShooter,
  stepShooter,
} from "./shooter-mechanics.js";

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const canvas = $("#strike-canvas");
const context = canvas.getContext("2d");
const shell = $("#arena-shell");
const startScreen = $("#strike-start");
const completeScreen = $("#strike-complete");
const rankWarning = $("#rank-warning");
const waveBanner = $("#wave-banner");

const ui = {
  waveNumber: $("#strike-wave-number"),
  waveKicker: $("#strike-wave-kicker"),
  title: $("#strike-title"),
  brief: $("#strike-brief"),
  score: $("#strike-score"),
  combo: $("#strike-combo"),
  coordinate: $("#target-coordinate"),
  targetName: $("#target-name"),
  orientation: $("#target-orientation"),
  gxx: $("#metric-xx"),
  gxyA: $("#metric-xy-a"),
  gxyB: $("#metric-xy-b"),
  gyy: $("#metric-yy"),
  lambda: $("#target-lambda"),
  determinant: $("#target-det"),
  inverseRow: $("#inverse-row"),
  inverse: $("#target-inverse"),
  limitRow: $("#limit-row"),
  limit: $("#target-limit"),
  hpText: $("#target-hp-text"),
  hpBar: $("#target-hp-bar"),
  note: $("#calculation-note"),
  limitCard: $("#limit-card"),
  limitStatus: $("#limit-status"),
  touchLimit: $("#touch-limit"),
};

const COLORS = {
  x: "#74f6ff",
  y: "#ff678f",
  limit: "#ffd262",
  positive: "#73f5dd",
  negative: "#ff5f93",
  fold: "#ffc857",
  ink: "#eafcff",
  grid: "rgba(120, 230, 242, 0.09)",
};

let game = createShooterState();
let width = 1;
let height = 1;
let pixelRatio = 1;
let lastTime = performance.now();
let accumulator = 0;
let shake = 0;
let whiteFlash = 0;
let warningTimer = 0;
let bannerTimer = 0;
let particles = [];
let floaters = [];
let shockwaves = [];
let soundEnabled = true;
let audioContext = null;

const keyboard = new Set();
const touchMove = new Set();
const pending = { x: false, y: false, limit: false };
const pointer = { x: 0.5, y: 0.1, inside: false };

function resizeCanvas() {
  const bounds = canvas.getBoundingClientRect();
  pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  width = Math.max(1, bounds.width);
  height = Math.max(1, bounds.height);
  canvas.width = Math.round(width * pixelRatio);
  canvas.height = Math.round(height * pixelRatio);
  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
}

function coordinate(value, axis) {
  return value * (axis === "x" ? width : height);
}

function signed(value, digits = 6) {
  const safe = Math.abs(value) < 5e-9 ? 0 : value;
  return `${safe >= 0 ? "+" : "−"}${Math.abs(safe).toFixed(digits)}`;
}

function compactExponent(value) {
  if (Math.abs(value) < 5e-13) return "0.000e+0";
  return value.toExponential(3).replace("e-", "e−").replace("e+", "e+");
}

function sourceLabel(target) {
  if (!target) return "k=(—,—)";
  if (target.id === "regular-a") return "k=(0,0)";
  if (target.id === "positive-b") return "k=(π,0)";
  if (target.id === "negative-b") return "k=(π,π)";
  return "k=(π,π/3)";
}

function formatScore(value) {
  return Math.round(value).toString().padStart(4, "0");
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

function tone(frequency, duration, type = "sine", gain = 0.05, slide = 1) {
  const audio = ensureAudio();
  if (!audio) return;
  const now = audio.currentTime;
  const oscillator = audio.createOscillator();
  const envelope = audio.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, now);
  oscillator.frequency.exponentialRampToValueAtTime(Math.max(40, frequency * slide), now + duration);
  envelope.gain.setValueAtTime(gain, now);
  envelope.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  oscillator.connect(envelope).connect(audio.destination);
  oscillator.start(now);
  oscillator.stop(now + duration);
}

function soundForEvent(event) {
  if (event.type === "fire") {
    const values = event.probe === "x" ? [370, "square"] : event.probe === "y" ? [255, "sawtooth"] : [610, "triangle"];
    tone(values[0], 0.075, values[1], 0.024, 1.45);
  } else if (event.type === "probe") {
    tone(event.probe === "x" ? 760 : 590, 0.09, "sine", 0.038, 0.75);
  } else if (event.type === "damage") {
    tone(event.mode === "limit" ? 135 : 92, 0.22, "sawtooth", 0.075, 0.45);
    setTimeout(() => tone(event.mode === "limit" ? 720 : 470, 0.16, "triangle", 0.045, 1.3), 24);
  } else if (event.type === "rank-drop") {
    tone(155, 0.36, "square", 0.055, 0.28);
  } else if (event.type === "destroy") {
    tone(110, 0.3, "sawtooth", 0.065, 0.24);
  } else if (event.type === "wave") {
    tone(420, 0.16, "triangle", 0.04, 1.5);
  } else if (event.type === "locked" || event.type === "glance") {
    tone(120, 0.1, "square", 0.025, 0.8);
  }
}

function burst(x, y, color, count, speed = 0.28, life = 0.5) {
  for (let index = 0; index < count; index += 1) {
    const angle = Math.random() * Math.PI * 2;
    const velocity = speed * (0.35 + Math.random() * 0.75);
    particles.push({
      x,
      y,
      vx: Math.cos(angle) * velocity,
      vy: Math.sin(angle) * velocity,
      life: life * (0.65 + Math.random() * 0.65),
      maxLife: life,
      color,
      size: 1.5 + Math.random() * 4,
    });
  }
}

function addFloater(x, y, text, color, large = false) {
  floaters.push({ x, y, text, color, life: large ? 1.15 : 0.72, maxLife: large ? 1.15 : 0.72, large });
}

function addShockwave(x, y, color, strong = false) {
  shockwaves.push({ x, y, color, life: strong ? 0.7 : 0.42, maxLife: strong ? 0.7 : 0.42, strong });
}

function processEvents(events) {
  for (const event of events) {
    soundForEvent(event);
    if (event.type === "probe") {
      const color = event.probe === "x" ? COLORS.x : COLORS.y;
      burst(event.x, event.y, color, 9, 0.18, 0.35);
      addFloater(event.x, event.y - 0.055, event.probe === "x" ? "∂xP STORED" : "∂yP STORED", color);
    }
    if (event.type === "damage") {
      const limit = event.mode === "limit";
      const color = limit ? COLORS.limit : COLORS.ink;
      shake = Math.max(shake, limit ? 15 : 9);
      whiteFlash = Math.max(whiteFlash, limit ? 0.36 : 0.22);
      burst(event.x, event.y, color, limit ? 40 : 24, limit ? 0.55 : 0.38, limit ? 0.8 : 0.55);
      addShockwave(event.x, event.y, color, limit);
      addFloater(event.x, event.y - 0.08, `${limit ? "LIMIT" : "AREA"} −${event.damage}`, color, true);
    }
    if (event.type === "rank-drop") {
      shake = Math.max(shake, 12);
      warningTimer = 2.25;
      whiteFlash = 0.28;
      burst(event.x, event.y, COLORS.fold, 30, 0.34, 0.8);
      addShockwave(event.x, event.y, COLORS.fold, true);
      addFloater(event.x, event.y - 0.09, "0 DAMAGE // RANK DROP", COLORS.fold, true);
    }
    if (event.type === "glance" || event.type === "locked") {
      addFloater(game.player.x, game.player.y - 0.05, "LIMIT ROUND LOCKED", COLORS.fold);
    }
    if (event.type === "destroy") {
      shake = Math.max(shake, 14);
      burst(event.x, event.y, "#ffffff", 46, 0.62, 0.85);
      addShockwave(event.x, event.y, COLORS.x, true);
    }
    if (event.type === "wave") {
      bannerTimer = 1.8;
      $("#wave-banner-text").textContent = game.wave.kicker;
    }
    if (event.type === "complete") completeScreen.hidden = false;
  }
}

function updateEffects(dt) {
  warningTimer = Math.max(0, warningTimer - dt);
  bannerTimer = Math.max(0, bannerTimer - dt);
  whiteFlash = Math.max(0, whiteFlash - dt * 1.8);
  shake *= Math.exp(-14 * dt);
  rankWarning.hidden = warningTimer <= 0;
  waveBanner.hidden = bannerTimer <= 0;

  for (const particle of particles) {
    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;
    particle.vx *= Math.exp(-2.6 * dt);
    particle.vy *= Math.exp(-2.6 * dt);
    particle.life -= dt;
  }
  particles = particles.filter((particle) => particle.life > 0);
  for (const floater of floaters) {
    floater.y -= 0.055 * dt;
    floater.life -= dt;
  }
  floaters = floaters.filter((floater) => floater.life > 0);
  for (const wave of shockwaves) wave.life -= dt;
  shockwaves = shockwaves.filter((wave) => wave.life > 0);
}

function pathPolygon(ctx, x, y, radius, sides, rotation = 0) {
  ctx.beginPath();
  for (let index = 0; index < sides; index += 1) {
    const angle = rotation + (Math.PI * 2 * index) / sides;
    const px = x + Math.cos(angle) * radius;
    const py = y + Math.sin(angle) * radius;
    if (index === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

function drawBackground(ctx) {
  const gradient = ctx.createRadialGradient(width * 0.5, height * 0.32, 0, width * 0.5, height * 0.32, width * 0.75);
  gradient.addColorStop(0, "#102737");
  gradient.addColorStop(0.45, "#081823");
  gradient.addColorStop(1, "#030910");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = COLORS.grid;
  ctx.lineWidth = 1;
  const gap = Math.max(28, width / 17);
  const drift = (game.elapsed * 9) % gap;
  for (let x = -gap + drift; x < width + gap; x += gap) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  for (let y = -gap + drift; y < height + gap; y += gap) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  if (game.wave?.id === "fold") {
    const foldY = height * 0.29;
    ctx.save();
    ctx.strokeStyle = "rgba(255, 203, 82, 0.22)";
    ctx.shadowColor = COLORS.fold;
    ctx.shadowBlur = 18;
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 9]);
    ctx.beginPath();
    for (let x = -10; x <= width + 10; x += 8) {
      const y = foldY + Math.sin(x * 0.026 + game.elapsed * 0.8) * 18;
      if (x < 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.restore();
  }
}

function enemyColor(enemy) {
  if (enemy.fold) return COLORS.fold;
  return enemy.geometry.lambda >= 0 ? COLORS.positive : COLORS.negative;
}

function drawEnemy(ctx, enemy) {
  if (enemy.dead) return;
  const x = coordinate(enemy.x, "x");
  const y = coordinate(enemy.y, "y");
  const radius = enemy.radius * Math.min(width, height);
  const color = enemyColor(enemy);
  const pulse = 1 + Math.sin(game.elapsed * 4 + enemy.phase) * 0.045;

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(game.elapsed * (enemy.fold ? -0.35 : 0.52));
  ctx.shadowColor = color;
  ctx.shadowBlur = enemy.fold ? 27 : 17;
  ctx.strokeStyle = color;
  ctx.lineWidth = enemy.fold ? 3 : 2;
  pathPolygon(ctx, 0, 0, radius * 1.18 * pulse, enemy.fold ? 8 : 6, Math.PI / 6);
  ctx.stroke();
  ctx.rotate(-game.elapsed * (enemy.fold ? -0.7 : 1.04));
  ctx.globalAlpha = 0.16;
  ctx.fillStyle = color;
  pathPolygon(ctx, 0, 0, radius * 0.9, enemy.fold ? 8 : 6, 0);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.fillStyle = "#071019";
  ctx.beginPath();
  ctx.arc(0, 0, radius * 0.48, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.55)";
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();

  const hpRatio = enemy.hp / enemy.maxHp;
  ctx.strokeStyle = "rgba(255,255,255,0.12)";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(x, y, radius * 1.47, -Math.PI * 0.82, Math.PI * 0.82);
  ctx.stroke();
  ctx.strokeStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, radius * 1.47, -Math.PI * 0.82, -Math.PI * 0.82 + Math.PI * 1.64 * hpRatio);
  ctx.stroke();

  const markers = [
    enemy.probes.x ? { text: "∂x", color: COLORS.x, dx: -radius * 1.15 } : null,
    enemy.probes.y ? { text: "∂y", color: COLORS.y, dx: radius * 1.15 } : null,
  ].filter(Boolean);
  for (const marker of markers) {
    ctx.fillStyle = marker.color;
    ctx.shadowColor = marker.color;
    ctx.shadowBlur = 10;
    ctx.font = `700 ${Math.max(12, radius * 0.34)}px ui-monospace, monospace`;
    ctx.textAlign = "center";
    ctx.fillText(marker.text, x + marker.dx, y - radius * 0.72);
  }
  ctx.shadowBlur = 0;
  ctx.fillStyle = "rgba(234,252,255,0.72)";
  ctx.font = "700 10px ui-monospace, monospace";
  ctx.textAlign = "center";
  ctx.fillText(enemy.label, x, y + radius * 1.85);
}

function drawBullet(ctx, bullet) {
  const x = coordinate(bullet.x, "x");
  const y = coordinate(bullet.y, "y");
  const previousX = x - bullet.vx * width * 0.026;
  const previousY = y - bullet.vy * height * 0.026;
  const color = COLORS[bullet.probe];
  const gradient = ctx.createLinearGradient(previousX, previousY, x, y);
  gradient.addColorStop(0, "transparent");
  gradient.addColorStop(1, color);
  ctx.save();
  ctx.strokeStyle = gradient;
  ctx.shadowColor = color;
  ctx.shadowBlur = bullet.probe === "limit" ? 22 : 13;
  ctx.lineWidth = bullet.probe === "limit" ? 7 : 4;
  ctx.beginPath();
  ctx.moveTo(previousX, previousY);
  ctx.lineTo(x, y);
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, bullet.probe === "limit" ? 5 : 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawPlayer(ctx) {
  const x = coordinate(game.player.x, "x");
  const y = coordinate(game.player.y, "y");
  const angle = Math.atan2(game.player.aimY * height, game.player.aimX * width);
  const size = Math.max(17, Math.min(width, height) * 0.043);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle + Math.PI / 2);
  ctx.shadowColor = COLORS.x;
  ctx.shadowBlur = 20;
  ctx.fillStyle = "#dffeff";
  ctx.strokeStyle = COLORS.x;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, -size);
  ctx.lineTo(size * 0.66, size * 0.72);
  ctx.lineTo(0, size * 0.42);
  ctx.lineTo(-size * 0.66, size * 0.72);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = COLORS.y;
  ctx.globalAlpha = 0.8;
  ctx.beginPath();
  ctx.moveTo(-size * 0.28, size * 0.68);
  ctx.lineTo(0, size * (0.95 + Math.sin(game.elapsed * 25) * 0.12));
  ctx.lineTo(size * 0.28, size * 0.68);
  ctx.fill();
  ctx.restore();
}

function drawReticle(ctx) {
  if (!pointer.inside) return;
  const x = pointer.x * width;
  const y = pointer.y * height;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(game.elapsed * 0.7);
  ctx.strokeStyle = "rgba(220, 253, 255, 0.62)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(0, 0, 12, 0, Math.PI * 2);
  ctx.stroke();
  for (let index = 0; index < 4; index += 1) {
    ctx.rotate(Math.PI / 2);
    ctx.beginPath();
    ctx.moveTo(16, 0);
    ctx.lineTo(23, 0);
    ctx.stroke();
  }
  ctx.restore();
}

function drawEffects(ctx) {
  for (const wave of shockwaves) {
    const progress = 1 - wave.life / wave.maxLife;
    ctx.strokeStyle = wave.color;
    ctx.globalAlpha = 1 - progress;
    ctx.lineWidth = wave.strong ? 4 : 2;
    ctx.beginPath();
    ctx.arc(coordinate(wave.x, "x"), coordinate(wave.y, "y"), progress * Math.min(width, height) * (wave.strong ? 0.24 : 0.13), 0, Math.PI * 2);
    ctx.stroke();
  }
  for (const particle of particles) {
    ctx.globalAlpha = Math.max(0, particle.life / particle.maxLife);
    ctx.fillStyle = particle.color;
    ctx.shadowColor = particle.color;
    ctx.shadowBlur = 8;
    ctx.fillRect(coordinate(particle.x, "x"), coordinate(particle.y, "y"), particle.size, particle.size);
  }
  ctx.shadowBlur = 0;
  ctx.textAlign = "center";
  for (const floater of floaters) {
    const progress = 1 - floater.life / floater.maxLife;
    ctx.globalAlpha = Math.min(1, floater.life * 3);
    ctx.fillStyle = floater.color;
    ctx.font = `${floater.large ? 900 : 700} ${floater.large ? 19 : 11}px ui-monospace, monospace`;
    ctx.fillText(floater.text, coordinate(floater.x, "x"), coordinate(floater.y, "y") - progress * 8);
  }
  ctx.globalAlpha = 1;
}

function renderArena() {
  context.save();
  const offsetX = shake > 0.1 ? (Math.random() - 0.5) * shake : 0;
  const offsetY = shake > 0.1 ? (Math.random() - 0.5) * shake : 0;
  context.translate(offsetX, offsetY);
  drawBackground(context);
  for (const enemy of game.enemies) drawEnemy(context, enemy);
  for (const bullet of game.bullets) drawBullet(context, bullet);
  drawPlayer(context);
  drawEffects(context);
  drawReticle(context);
  context.restore();
  if (whiteFlash > 0) {
    context.fillStyle = `rgba(255,255,255,${whiteFlash})`;
    context.fillRect(0, 0, width, height);
  }
}

function calculationNote(target) {
  if (!target) return ["DRILL CLEARED.", "The local calculation is complete; return to the torus to see how these patches add globally."];
  if (target.fold) {
    if (target.rankDropSeen) {
      if (target.probes.x) {
        return ["NOW: differentiate the vanished direction again.", "∂xP is tagged. Fire ∂y²P: its triple product λ̄y measures how the signed area leaves zero across the fold."];
      }
      return ["RELOAD THE SURVIVING DIRECTION.", "Tag ∂xP again, then fire ∂y²P. Every limit impact explicitly rebuilds the pair (∂xP, ∂y²P)."];
    }
    return ["MAKE THE FAILURE VISIBLE.", "Hit the core with ∂xP and ∂yP. Here ∂yP=0, so det g=λ̄²=0 and the ordinary area attack must deal zero damage."];
  }
  if (target.geometry.lambda < 0) {
    return ["THE DAMAGE STAYS POSITIVE; THE ORIENTATION FLIPS.", "This target has λ̄<0. The magnitude is mapped area; the minus sign says the sheet covers the Bloch sphere in the opposite orientation."];
  }
  return ["FIRST: make both derivatives visible.", "The first shot stores one tangent. The second closes their parallelogram and converts √det g=|λ̄| into impact."];
}

function updateUi() {
  const target = currentShooterTarget(game);
  ui.waveNumber.textContent = game.wave?.number ?? "✓";
  ui.waveKicker.textContent = game.wave?.kicker ?? "COMPLETE";
  ui.title.textContent = game.wave?.title ?? "Local calculation complete";
  ui.brief.textContent = game.wave?.brief ?? "Return to the torus to add the oriented sheets globally.";
  ui.score.textContent = formatScore(game.score);
  ui.combo.textContent = `COMBO ×${game.combo}`;
  ui.coordinate.textContent = sourceLabel(target);
  ui.targetName.textContent = target?.label ?? "NO LIVE TARGET";

  if (!target) {
    ui.orientation.textContent = "LOCAL DRILL COMPLETE";
    ui.hpText.textContent = "0 / 0";
    ui.hpBar.style.width = "0%";
    const [title, text] = calculationNote(null);
    ui.note.innerHTML = `<b>${title}</b><p>${text}</p>`;
    return;
  }

  const geometry = target.geometry;
  const sign = geometry.lambda > 1e-7 ? "> 0 · ORIENTATION +" : geometry.lambda < -1e-7 ? "< 0 · ORIENTATION −" : "= 0 · RANK DROP";
  ui.orientation.textContent = `λ̄ ${sign}`;
  ui.gxx.textContent = geometry.gxx.toFixed(3);
  ui.gxyA.textContent = signed(geometry.gxy, 3);
  ui.gxyB.textContent = signed(geometry.gxy, 3);
  ui.gyy.textContent = geometry.gyy.toFixed(3);
  ui.lambda.textContent = `λ̄=${signed(geometry.lambda)}`;
  ui.determinant.textContent = `det g=${compactExponent(geometry.determinant)}`;
  ui.inverse.textContent = geometry.inverseAvailable ? "g⁻¹ READY" : "g⁻¹ UNDEFINED";
  ui.inverseRow.classList.toggle("is-locked", !geometry.inverseAvailable);
  ui.limit.textContent = `λ̄y=${signed(geometry.lambdaV)}`;
  ui.limitRow.classList.toggle("is-hot", target.rankDropSeen);
  ui.hpText.textContent = `${target.hp} / ${target.maxHp}`;
  ui.hpBar.style.width = `${(target.hp / target.maxHp) * 100}%`;
  ui.hpBar.style.backgroundColor = enemyColor(target);
  const [title, text] = calculationNote(target);
  ui.note.innerHTML = `<b>${title}</b><p>${text}</p>`;

  ui.limitCard.setAttribute("aria-disabled", String(!game.limitUnlocked));
  ui.limitCard.classList.toggle("is-unlocked", game.limitUnlocked);
  ui.limitStatus.textContent = game.limitUnlocked ? "UNLOCKED · λ̄y LIMIT" : "locked until rank drops";
  ui.touchLimit.disabled = !game.limitUnlocked;
}

function buildInput() {
  const moveLeft = keyboard.has("ArrowLeft") || keyboard.has("KeyA") || touchMove.has("left");
  const moveRight = keyboard.has("ArrowRight") || keyboard.has("KeyD") || touchMove.has("right");
  const moveUp = keyboard.has("ArrowUp") || keyboard.has("KeyW") || touchMove.has("up");
  const moveDown = keyboard.has("ArrowDown") || keyboard.has("KeyS") || touchMove.has("down");
  const target = currentShooterTarget(game);
  let aimX = pointer.x - game.player.x;
  let aimY = pointer.y - game.player.y;
  if (!pointer.inside && target) {
    aimX = target.x - game.player.x;
    aimY = target.y - game.player.y;
  }
  const input = {
    moveX: Number(moveRight) - Number(moveLeft),
    moveY: Number(moveDown) - Number(moveUp),
    aimX,
    aimY,
    fireX: pending.x || keyboard.has("KeyJ"),
    fireY: pending.y || keyboard.has("KeyK"),
    fireLimit: pending.limit || keyboard.has("Space") || keyboard.has("KeyL"),
  };
  pending.x = false;
  pending.y = false;
  pending.limit = false;
  return input;
}

function frame(now) {
  const realDelta = Math.min(0.05, (now - lastTime) / 1000);
  lastTime = now;
  accumulator += realDelta;
  while (accumulator >= SHOOTER_STEP) {
    stepShooter(game, buildInput(), SHOOTER_STEP);
    processEvents(game.events);
    updateEffects(SHOOTER_STEP);
    accumulator -= SHOOTER_STEP;
  }
  updateUi();
  renderArena();
  requestAnimationFrame(frame);
}

function start() {
  ensureAudio();
  startShooter(game);
  processEvents(game.events);
  startScreen.hidden = true;
  canvas.focus();
}

function restart() {
  game = resetShooter();
  particles = [];
  floaters = [];
  shockwaves = [];
  completeScreen.hidden = true;
  startScreen.hidden = true;
  startShooter(game);
  processEvents(game.events);
}

function updatePointer(event) {
  const bounds = canvas.getBoundingClientRect();
  pointer.x = Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width));
  pointer.y = Math.max(0, Math.min(1, (event.clientY - bounds.top) / bounds.height));
  pointer.inside = true;
}

window.addEventListener("resize", resizeCanvas);
window.addEventListener("keydown", (event) => {
  if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(event.code)) event.preventDefault();
  keyboard.add(event.code);
  if ((event.code === "Enter" || event.code === "Space") && game.status === "ready") start();
});
window.addEventListener("keyup", (event) => keyboard.delete(event.code));
window.addEventListener("blur", () => keyboard.clear());

canvas.addEventListener("pointermove", updatePointer);
canvas.addEventListener("pointerenter", updatePointer);
canvas.addEventListener("pointerleave", () => { pointer.inside = false; });
canvas.addEventListener("pointerdown", (event) => {
  event.preventDefault();
  updatePointer(event);
  pending[event.button === 2 ? "y" : "x"] = true;
});
canvas.addEventListener("contextmenu", (event) => event.preventDefault());

for (const button of $$("[data-move]")) {
  const direction = button.dataset.move;
  const down = (event) => { event.preventDefault(); touchMove.add(direction); button.setPointerCapture?.(event.pointerId); };
  const up = () => touchMove.delete(direction);
  button.addEventListener("pointerdown", down);
  button.addEventListener("pointerup", up);
  button.addEventListener("pointercancel", up);
  button.addEventListener("lostpointercapture", up);
}

for (const button of $$("[data-fire]")) {
  button.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    pending[button.dataset.fire] = true;
    pointer.inside = false;
  });
}

$("#strike-start-button").addEventListener("click", start);
$("#strike-restart").addEventListener("click", restart);
$("#strike-sound").addEventListener("click", (event) => {
  soundEnabled = !soundEnabled;
  event.currentTarget.setAttribute("aria-pressed", String(soundEnabled));
  event.currentTarget.classList.toggle("is-muted", !soundEnabled);
  if (soundEnabled) tone(520, 0.1, "sine", 0.035, 1.3);
});

resizeCanvas();
updateUi();
requestAnimationFrame(frame);
