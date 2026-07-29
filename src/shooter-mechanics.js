import {
  FIXED_STEP,
  clamp,
  mapToState,
  sourceFromBZ,
} from "./game.js";

export const SHOOTER_STEP = FIXED_STEP;
export const PROBE_X = "x";
export const PROBE_Y = "y";
export const PROBE_LIMIT = "limit";

const DIFFERENCE_STEP = 1e-4;
const BULLET_SPEED = 1.18;
const PLAYER_SPEED = 0.46;

function vectorAdd(a, b) {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

function vectorScale(vector, scale) {
  return { x: vector.x * scale, y: vector.y * scale, z: vector.z * scale };
}

function vectorDot(a, b) {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

function vectorCross(a, b) {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

function stateAt(kx, ky) {
  return mapToState(sourceFromBZ(kx, ky));
}

function firstDifference(kx, ky, axis, h) {
  const plus = stateAt(kx + (axis === "x" ? h : 0), ky + (axis === "y" ? h : 0));
  const minus = stateAt(kx - (axis === "x" ? h : 0), ky - (axis === "y" ? h : 0));
  return vectorScale({
    x: plus.x - minus.x,
    y: plus.y - minus.y,
    z: plus.z - minus.z,
  }, 1 / (2 * h));
}

function secondDifference(kx, ky, axis, h) {
  const center = stateAt(kx, ky);
  const plus = stateAt(kx + (axis === "x" ? h : 0), ky + (axis === "y" ? h : 0));
  const minus = stateAt(kx - (axis === "x" ? h : 0), ky - (axis === "y" ? h : 0));
  return vectorScale(vectorAdd(vectorAdd(plus, minus), vectorScale(center, -2)), 1 / (h * h));
}

export function probeGeometryAt(source, h = DIFFERENCE_STEP) {
  const kx = Math.PI * 2 * (((source.u - 0.1 + 0.5) % 1 + 1) % 1 - 0.5);
  const ky = Math.PI * 2 * (((source.v - 0.1 + 0.5) % 1 + 1) % 1 - 0.5);
  const state = stateAt(kx, ky);
  const tangentX = firstDifference(kx, ky, "x", h);
  const tangentY = firstDifference(kx, ky, "y", h);
  const secondY = secondDifference(kx, ky, "y", h);
  const gxx = 0.5 * vectorDot(tangentX, tangentX);
  const gxy = 0.5 * vectorDot(tangentX, tangentY);
  const gyy = 0.5 * vectorDot(tangentY, tangentY);
  const determinant = Math.max(0, gxx * gyy - gxy * gxy);
  const lambda = 0.5 * vectorDot(state, vectorCross(tangentX, tangentY));
  const lambdaV = 0.5 * vectorDot(state, vectorCross(tangentX, secondY));
  const inverseAvailable = determinant > 1e-8;

  return {
    source: { u: source.u, v: source.v },
    kx,
    ky,
    state,
    tangentX,
    tangentY,
    secondY,
    gxx,
    gxy,
    gyy,
    determinant,
    lambda,
    lambdaV,
    inverseAvailable,
    inverse: inverseAvailable ? {
      xx: gyy / determinant,
      xy: -gxy / determinant,
      yy: gxx / determinant,
    } : null,
  };
}

const WAVE_BLUEPRINTS = [
  {
    id: "regular",
    number: "01",
    kicker: "FIRST DERIVATIVES",
    title: "Cross two tangent rounds to make area",
    brief: "Tag the same drone with ∂xP and ∂yP. Their oriented parallelogram becomes impact damage.",
    enemies: [
      { id: "regular-a", label: "REGULAR CELL", kx: 0, ky: 0, x: 0.5, y: 0.31, hp: 150 },
    ],
  },
  {
    id: "orientation",
    number: "02",
    kicker: "ORIENTATION FLIP",
    title: "Same impact, opposite orientation",
    brief: "The coral drone carries λ̄<0. Damage uses |λ̄|; the sign records which way its mapped area faces.",
    enemies: [
      { id: "positive-b", label: "+ SHEET", kx: Math.PI, ky: 0, x: 0.32, y: 0.32, hp: 132 },
      { id: "negative-b", label: "− SHEET", kx: Math.PI, ky: Math.PI, x: 0.68, y: 0.32, hp: 92 },
    ],
  },
  {
    id: "fold",
    number: "03",
    kicker: "RANK DROP",
    title: "First derivatives fail. Differentiate again.",
    brief: "At k=(π,π/3), ∂yP vanishes. Force the 0-damage pair, then combine ∂xP with ∂y²P to break the fold core.",
    enemies: [
      { id: "fold-core", label: "FOLD CORE", kx: Math.PI, ky: Math.PI / 3, x: 0.5, y: 0.29, hp: 250, fold: true },
    ],
  },
];

export function shooterWaves() {
  return WAVE_BLUEPRINTS.map((wave) => ({
    ...wave,
    enemies: wave.enemies.map((enemy) => ({ ...enemy })),
  }));
}

function makeEnemy(blueprint) {
  const source = sourceFromBZ(blueprint.kx, blueprint.ky);
  return {
    ...blueprint,
    source,
    geometry: probeGeometryAt(source),
    maxHp: blueprint.hp,
    probes: { x: false, y: false },
    rankDropSeen: false,
    dead: false,
    phase: 0,
    radius: blueprint.fold ? 0.084 : 0.064,
  };
}

function enemiesForWave(waves, index) {
  return waves[index].enemies.map(makeEnemy);
}

export function createShooterState() {
  const waves = shooterWaves();
  return {
    waves,
    waveIndex: 0,
    wave: waves[0],
    status: "ready",
    elapsed: 0,
    score: 0,
    combo: 0,
    player: { x: 0.5, y: 0.82, vx: 0, vy: 0, aimX: 0, aimY: -1 },
    enemies: enemiesForWave(waves, 0),
    bullets: [],
    events: [],
    nextId: 1,
    fireCooldown: 0,
    waveDelay: null,
    limitUnlocked: false,
    lastImpact: null,
  };
}

export function startShooter(state) {
  if (state.status === "ready") {
    state.status = "playing";
    state.events = [{ type: "start", wave: state.wave.id }];
  }
  return state;
}

function areaDamage(geometry) {
  return Math.round(42 + 84 * clamp(Math.abs(geometry.lambda) / 0.5, 0, 1));
}

function limitDamage(geometry) {
  return Math.round(70 + 34 * clamp(Math.abs(geometry.lambdaV) / (1 / 6), 0, 1));
}

function damageEnemy(state, enemy, damage, mode) {
  enemy.hp = Math.max(0, enemy.hp - damage);
  state.score += damage;
  state.combo += 1;
  state.lastImpact = { enemy: enemy.id, damage, mode, elapsed: state.elapsed };
  state.events.push({
    type: "damage",
    enemy: enemy.id,
    damage,
    mode,
    x: enemy.x,
    y: enemy.y,
    lambda: enemy.geometry.lambda,
    determinant: enemy.geometry.determinant,
  });
  if (enemy.hp <= 0) {
    enemy.dead = true;
    state.score += 250;
    state.events.push({ type: "destroy", enemy: enemy.id, x: enemy.x, y: enemy.y });
  }
}

function resolveFirstDerivativePair(state, enemy) {
  if (!enemy.probes.x || !enemy.probes.y) return;
  enemy.probes.y = false;
  if (!enemy.geometry.inverseAvailable) {
    enemy.rankDropSeen = true;
    state.limitUnlocked = true;
    state.combo = 0;
    state.lastImpact = { enemy: enemy.id, damage: 0, mode: "rank-drop", elapsed: state.elapsed };
    state.events.push({
      type: "rank-drop",
      enemy: enemy.id,
      damage: 0,
      x: enemy.x,
      y: enemy.y,
      determinant: enemy.geometry.determinant,
      lambda: enemy.geometry.lambda,
    });
    return;
  }
  enemy.probes.x = false;
  damageEnemy(state, enemy, areaDamage(enemy.geometry), "area");
}

export function applyProbeHit(state, enemy, probe) {
  if (!enemy || enemy.dead) return state;
  if (probe === PROBE_X) {
    enemy.probes.x = true;
    state.events.push({ type: "probe", probe, enemy: enemy.id, x: enemy.x, y: enemy.y });
    resolveFirstDerivativePair(state, enemy);
    return state;
  }
  if (probe === PROBE_Y) {
    enemy.probes.y = true;
    state.events.push({ type: "probe", probe, enemy: enemy.id, x: enemy.x, y: enemy.y });
    resolveFirstDerivativePair(state, enemy);
    return state;
  }
  if (probe === PROBE_LIMIT) {
    if (state.limitUnlocked && enemy.rankDropSeen && enemy.probes.x) {
      enemy.probes.x = false;
      damageEnemy(state, enemy, limitDamage(enemy.geometry), "limit");
    } else {
      state.combo = 0;
      state.events.push({ type: "glance", probe, enemy: enemy.id, x: enemy.x, y: enemy.y });
    }
  }
  return state;
}

function spawnBullet(state, probe) {
  if (state.fireCooldown > 0) return;
  if (probe === PROBE_LIMIT && !state.limitUnlocked) {
    state.events.push({ type: "locked", probe });
    return;
  }
  const length = Math.hypot(state.player.aimX, state.player.aimY) || 1;
  const aimX = state.player.aimX / length;
  const aimY = state.player.aimY / length;
  state.bullets.push({
    id: state.nextId,
    probe,
    x: state.player.x + aimX * 0.035,
    y: state.player.y + aimY * 0.035,
    vx: aimX * BULLET_SPEED,
    vy: aimY * BULLET_SPEED,
    life: 1.15,
    radius: probe === PROBE_LIMIT ? 0.018 : 0.012,
  });
  state.nextId += 1;
  state.fireCooldown = probe === PROBE_LIMIT ? 0.24 : 0.115;
  state.events.push({ type: "fire", probe });
}

function updatePlayer(state, input, dt) {
  const magnitude = Math.hypot(input.moveX, input.moveY);
  const moveX = magnitude > 1 ? input.moveX / magnitude : input.moveX;
  const moveY = magnitude > 1 ? input.moveY / magnitude : input.moveY;
  const response = 1 - Math.exp(-18 * dt);
  state.player.vx += (moveX * PLAYER_SPEED - state.player.vx) * response;
  state.player.vy += (moveY * PLAYER_SPEED - state.player.vy) * response;
  state.player.x = clamp(state.player.x + state.player.vx * dt, 0.045, 0.955);
  state.player.y = clamp(state.player.y + state.player.vy * dt, 0.13, 0.94);
  if (Math.hypot(input.aimX, input.aimY) > 0.01) {
    state.player.aimX = input.aimX;
    state.player.aimY = input.aimY;
  }
}

function updateEnemies(state, dt) {
  for (let index = 0; index < state.enemies.length; index += 1) {
    const enemy = state.enemies[index];
    enemy.phase += dt;
    const direction = index % 2 === 0 ? 1 : -1;
    const amplitude = enemy.fold ? 0.018 : 0.028;
    enemy.x = clamp(enemy.x + Math.sin(state.elapsed * 1.2 + index) * amplitude * dt * direction, 0.12, 0.88);
    enemy.y = clamp(enemy.y + Math.cos(state.elapsed * 1.5 + index * 0.7) * amplitude * dt, 0.17, 0.56);
  }
}

function updateBullets(state, dt) {
  for (const bullet of state.bullets) {
    bullet.x += bullet.vx * dt;
    bullet.y += bullet.vy * dt;
    bullet.life -= dt;
    for (const enemy of state.enemies) {
      if (enemy.dead) continue;
      if (Math.hypot(bullet.x - enemy.x, bullet.y - enemy.y) <= enemy.radius + bullet.radius) {
        bullet.life = -1;
        applyProbeHit(state, enemy, bullet.probe);
        break;
      }
    }
  }
  state.bullets = state.bullets.filter((bullet) => (
    bullet.life > 0
    && bullet.x > -0.08
    && bullet.x < 1.08
    && bullet.y > -0.08
    && bullet.y < 1.08
  ));
}

function updateWave(state, dt) {
  if (state.enemies.some((enemy) => !enemy.dead)) return;
  if (state.waveDelay === null) {
    state.waveDelay = 1.05;
    state.events.push({ type: "wave-clear", wave: state.wave.id });
    return;
  }
  state.waveDelay -= dt;
  if (state.waveDelay > 0) return;
  state.waveIndex += 1;
  state.waveDelay = null;
  if (state.waveIndex >= state.waves.length) {
    state.status = "complete";
    state.events.push({ type: "complete", score: state.score, elapsed: state.elapsed });
    return;
  }
  state.wave = state.waves[state.waveIndex];
  state.enemies = enemiesForWave(state.waves, state.waveIndex);
  state.bullets = [];
  state.combo = 0;
  state.limitUnlocked = false;
  state.events.push({ type: "wave", wave: state.wave.id });
}

export function stepShooter(state, input, dt = SHOOTER_STEP) {
  state.events = [];
  if (state.status !== "playing") return state;
  state.elapsed += dt;
  state.fireCooldown = Math.max(0, state.fireCooldown - dt);
  updatePlayer(state, input, dt);
  updateEnemies(state, dt);
  if (input.fireX) spawnBullet(state, PROBE_X);
  if (input.fireY) spawnBullet(state, PROBE_Y);
  if (input.fireLimit) spawnBullet(state, PROBE_LIMIT);
  updateBullets(state, dt);
  updateWave(state, dt);
  return state;
}

export function currentShooterTarget(state) {
  return state.enemies.find((enemy) => !enemy.dead) ?? null;
}

export function shooterEvidence(state) {
  const target = currentShooterTarget(state);
  return {
    status: state.status,
    wave: state.wave?.id ?? "complete",
    waveIndex: state.waveIndex,
    elapsed: state.elapsed,
    score: state.score,
    combo: state.combo,
    limitUnlocked: state.limitUnlocked,
    target: target ? {
      id: target.id,
      hp: target.hp,
      lambda: target.geometry.lambda,
      lambdaV: target.geometry.lambdaV,
      determinant: target.geometry.determinant,
      inverseAvailable: target.geometry.inverseAvailable,
      probes: { ...target.probes },
      rankDropSeen: target.rankDropSeen,
    } : null,
  };
}

export function autoAimInput(state, probe) {
  const target = currentShooterTarget(state);
  if (!target) return { aimX: state.player.aimX, aimY: state.player.aimY, probe };
  return {
    aimX: target.x - state.player.x,
    aimY: target.y - state.player.y,
    probe,
  };
}

export function resetShooter() {
  return createShooterState();
}

export function sourceForFoldDrill() {
  return sourceFromBZ(Math.PI, Math.PI / 3);
}
