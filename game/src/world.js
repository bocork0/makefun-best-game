// The game's rules and state, with no drawing and no browser in it: the keeper, the
// lantern, the glooms and their waves, bolts, globs, pickups, particles, combo and score.
// step() advances one fixed step and returns what happened as bit flags, so the caller
// can react (sound, announcements) without the world knowing about screens or sound.
// Nothing here allocates after createWorld returns: every pool is filled once, at boot.
import {
  BOLT, BETWEEN_WAVES, COMBO, EMBER, FIELD, KEEPER, KILL_SCORE, LANTERN, LANTERN_DAMAGE,
  LAST_WAVE, POOL, STEP, WAVES,
} from './config.js';

export const KIND_WISP = 'wisp';
export const KIND_DART = 'dart';
export const KIND_SPITTER = 'spitter';
export const KIND_BRUTE = 'brute';
export const KIND_MATRIARCH = 'matriarch';

export const EVENT_LANTERN_HURT = 1;
export const EVENT_KILL = 2;
export const EVENT_PICKUP = 4;
export const EVENT_WAVE_CLEAR = 8;
export const EVENT_OVER = 16;
export const EVENT_WIN = 32;
export const EVENT_BOSS = 64;

const ENEMY_STATS = {
  wisp: { hp: 2, speed: 58, radius: 14, score: KILL_SCORE.wisp },
  dart: { hp: 1, speed: 155, radius: 11, score: KILL_SCORE.dart },
  spitter: { hp: 3, speed: 72, radius: 15, score: KILL_SCORE.spitter },
  brute: { hp: 12, speed: 40, radius: 26, score: KILL_SCORE.brute },
  matriarch: { hp: 130, speed: 46, radius: 44, score: KILL_SCORE.matriarch },
};

const PHASE_BANNER = 'banner';
const PHASE_ACTIVE = 'active';
const PHASE_CLEAR = 'clear';
const PHASE_OFFER = 'offer';

function distance(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by);
}

export function createWorld(random) {
  const keeper = {
    x: FIELD.width / 2, y: FIELD.height / 2 + 150, angle: -Math.PI / 2,
    fireTimer: 0, dashTime: 0, dashCooldown: 0, dashX: 0, dashY: 0, mercy: 0,
  };
  const stats = {
    speed: KEEPER.speed, fireInterval: KEEPER.fireInterval, boltDamage: KEEPER.boltDamage,
    bolts: 1, pierce: 0, magnet: EMBER.magnetRadius, dashCooldown: KEEPER.dashCooldown,
  };
  const lantern = { light: LANTERN.startLight, flash: 0 };
  const enemies = [];
  for (let i = 0; i < POOL.enemies; i += 1) {
    enemies.push({ active: false, kind: KIND_WISP, x: 0, y: 0, hp: 1, maxHp: 1, speed: 0, radius: 10, age: 0, shootTimer: 0, spawnTimer: 0, vx: 0, vy: 0 });
  }
  const bolts = [];
  for (let i = 0; i < POOL.bolts; i += 1) {
    bolts.push({ active: false, x: 0, y: 0, vx: 0, vy: 0, damage: 1, pierce: 0, life: 0 });
  }
  const globs = [];
  for (let i = 0; i < POOL.globs; i += 1) {
    globs.push({ active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0 });
  }
  const pickups = [];
  for (let i = 0; i < POOL.pickups; i += 1) {
    pickups.push({ active: false, kind: 'ember', x: 0, y: 0, vx: 0, vy: 0, age: 0 });
  }
  const particles = [];
  for (let i = 0; i < POOL.particles; i += 1) {
    particles.push({ active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 1, color: '#ffffff', size: 3 });
  }

  const state = {
    keeper, stats, lantern, enemies, bolts, globs, pickups, particles,
    score: 0, wave: 0, wavePhase: PHASE_BANNER, bannerTimer: 1.6, betweenTimer: 0,
    spawnGroups: [], spawnTimer: 0, offer: null, combo: 0, comboTimer: 0,
    kills: 0, elapsed: 0, shake: 0, over: false, won: false, bossSpawned: false,
    shotsFired: 0, shotsHit: 0,
  };

  function reset() {
    keeper.x = FIELD.width / 2;
    keeper.y = FIELD.height / 2 + 150;
    keeper.angle = -Math.PI / 2;
    keeper.fireTimer = 0;
    keeper.dashTime = 0;
    keeper.dashCooldown = 0;
    keeper.mercy = 0;
    stats.speed = KEEPER.speed;
    stats.fireInterval = KEEPER.fireInterval;
    stats.boltDamage = KEEPER.boltDamage;
    stats.bolts = 1;
    stats.pierce = 0;
    stats.magnet = EMBER.magnetRadius;
    stats.dashCooldown = KEEPER.dashCooldown;
    lantern.light = LANTERN.startLight;
    lantern.flash = 0;
    for (const e of enemies) e.active = false;
    for (const b of bolts) b.active = false;
    for (const g of globs) g.active = false;
    for (const p of pickups) p.active = false;
    for (const p of particles) p.active = false;
    state.score = 0;
    state.wave = 0;
    state.wavePhase = PHASE_BANNER;
    state.bannerTimer = 1.6;
    state.betweenTimer = 0;
    state.spawnGroups = [];
    state.spawnTimer = 0;
    state.offer = null;
    state.combo = 0;
    state.comboTimer = 0;
    state.kills = 0;
    state.elapsed = 0;
    state.shake = 0;
    state.over = false;
    state.won = false;
    state.bossSpawned = false;
    state.shotsFired = 0;
    state.shotsHit = 0;
  }

  function free(pool) {
    for (let i = 0; i < pool.length; i += 1) if (!pool[i].active) return pool[i];
    return null;
  }

  function burst(x, y, color, count, speed, size) {
    for (let i = 0; i < count; i += 1) {
      const p = free(particles);
      if (!p) return;
      const angle = random() * Math.PI * 2;
      const v = speed * (0.4 + random() * 0.8);
      p.active = true;
      p.x = x;
      p.y = y;
      p.vx = Math.cos(angle) * v;
      p.vy = Math.sin(angle) * v;
      p.maxLife = 0.35 + random() * 0.45;
      p.life = p.maxLife;
      p.color = color;
      p.size = size * (0.6 + random() * 0.8);
    }
  }

  function edgePoint() {
    const side = Math.floor(random() * 4);
    const margin = 24;
    if (side === 0) return { x: random() * FIELD.width, y: -margin };
    if (side === 1) return { x: random() * FIELD.width, y: FIELD.height + margin };
    if (side === 2) return { x: -margin, y: random() * FIELD.height };
    return { x: FIELD.width + margin, y: random() * FIELD.height };
  }

  function spawnEnemy(kind, atX, atY) {
    const e = free(enemies);
    if (!e) return null;
    const base = ENEMY_STATS[kind];
    const point = atX === undefined ? edgePoint() : { x: atX, y: atY };
    const hpScale = 1 + 0.1 * (state.wave - 1);
    e.active = true;
    e.kind = kind;
    e.x = point.x;
    e.y = point.y;
    e.maxHp = Math.round(base.hp * hpScale);
    e.hp = e.maxHp;
    e.speed = base.speed * (1 + 0.02 * (state.wave - 1));
    e.radius = base.radius;
    e.age = 0;
    e.shootTimer = 1.2 + random() * 1.4;
    e.spawnTimer = 0;
    e.vx = 0;
    e.vy = 0;
    return e;
  }

  function dropPickup(x, y, kind) {
    const p = free(pickups);
    if (!p) return;
    const angle = random() * Math.PI * 2;
    p.active = true;
    p.kind = kind;
    p.x = x;
    p.y = y;
    p.vx = Math.cos(angle) * 40;
    p.vy = Math.sin(angle) * 40;
    p.age = 0;
  }

  function startWave(wave) {
    state.wave = wave;
    state.wavePhase = PHASE_BANNER;
    state.bannerTimer = 1.6;
    state.bossSpawned = false;
    state.spawnGroups = WAVES[wave - 1].map(([kind, count, gap]) => ({ kind, left: count, gap, timer: 0.4 + random() * 0.6 }));
    state.spawnTimer = 0;
  }

  function hurtLantern(amount, events) {
    lantern.light = Math.max(0, lantern.light - amount);
    lantern.flash = 0.5;
    state.combo = 0;
    state.comboTimer = 0;
    state.shake = Math.max(state.shake, 10);
    burst(LANTERN.x, LANTERN.y, '#ffb347', 14, 180, 4);
    if (lantern.light <= 0) {
      state.over = true;
      return events | EVENT_OVER;
    }
    return events | EVENT_LANTERN_HURT;
  }

  function killEnemy(e, events) {
    e.active = false;
    state.kills += 1;
    state.combo += 1;
    state.comboTimer = COMBO.window;
    const multiplier = Math.min(COMBO.cap, 1 + (state.combo - 1) * COMBO.step);
    state.score += Math.round(ENEMY_STATS[e.kind].score * multiplier);
    burst(e.x, e.y, colorOf(e.kind), 12, 160, 4);
    if (e.kind === KIND_BRUTE) {
      spawnEnemy(KIND_WISP, e.x - 20, e.y);
      spawnEnemy(KIND_WISP, e.x + 20, e.y);
    }
    if (e.kind === KIND_MATRIARCH) {
      for (let i = 0; i < 5; i += 1) dropPickup(e.x + (random() - 0.5) * 80, e.y + (random() - 0.5) * 80, 'ember');
      dropPickup(e.x, e.y, 'heart');
      state.shake = Math.max(state.shake, 16);
    } else if (random() < 0.55) {
      dropPickup(e.x, e.y, 'ember');
    } else if (random() < 0.08) {
      dropPickup(e.x, e.y, 'heart');
    }
    return events | EVENT_KILL;
  }

  function colorOf(kind) {
    if (kind === KIND_WISP) return '#b78cff';
    if (kind === KIND_DART) return '#ff7ad9';
    if (kind === KIND_SPITTER) return '#8cff9e';
    if (kind === KIND_BRUTE) return '#ff5f4d';
    return '#ff2e63';
  }

  function fireBolt(angle) {
    const b = free(bolts);
    if (!b) return;
    b.active = true;
    b.x = keeper.x + Math.cos(angle) * (KEEPER.radius + 6);
    b.y = keeper.y + Math.sin(angle) * (KEEPER.radius + 6);
    b.vx = Math.cos(angle) * KEEPER.boltSpeed;
    b.vy = Math.sin(angle) * KEEPER.boltSpeed;
    b.damage = stats.boltDamage;
    b.pierce = stats.pierce;
    b.life = BOLT.life;
  }

  function fireGlob(x, y, angle, speed) {
    const g = free(globs);
    if (!g) return;
    g.active = true;
    g.x = x;
    g.y = y;
    g.vx = Math.cos(angle) * speed;
    g.vy = Math.sin(angle) * speed;
    g.life = 4;
  }

  function anyEnemyAlive() {
    for (const e of enemies) if (e.active) return true;
    return false;
  }

  function spawnStep(dt) {
    let pending = false;
    for (const group of state.spawnGroups) {
      if (group.left <= 0) continue;
      pending = true;
      group.timer -= dt;
      if (group.timer <= 0) {
        group.timer += group.gap;
        group.left -= 1;
        const spawned = spawnEnemy(group.kind);
        if (spawned && group.kind === KIND_MATRIARCH) {
          state.bossSpawned = true;
        }
      }
    }
    return pending;
  }

  /**
   * One fixed step. `control` is {moveX, moveY, aimX, aimY, firing, dash} from the input;
   * with `harmless` set (the title screen's backdrop) glooms drift but nothing scores and
   * the lantern cannot be hurt.
   */
  function step(dt, control, harmless) {
    let events = 0;
    state.elapsed += dt;
    if (state.shake > 0) state.shake = Math.max(0, state.shake - dt * 26);
    if (lantern.flash > 0) lantern.flash = Math.max(0, lantern.flash - dt);
    if (state.comboTimer > 0) {
      state.comboTimer -= dt;
      if (state.comboTimer <= 0) state.combo = 0;
    }

    // The keeper moves, aims and fires.
    keeper.angle = Math.atan2(control.aimY - keeper.y, control.aimX - keeper.x);
    if (keeper.dashCooldown > 0) keeper.dashCooldown -= dt;
    if (keeper.mercy > 0) keeper.mercy -= dt;
    if (control.dash && keeper.dashCooldown <= 0 && keeper.dashTime <= 0) {
      const mx = control.moveX;
      const my = control.moveY;
      const len = Math.hypot(mx, my);
      if (len > 0) {
        keeper.dashX = mx / len;
        keeper.dashY = my / len;
      } else {
        keeper.dashX = Math.cos(keeper.angle);
        keeper.dashY = Math.sin(keeper.angle);
      }
      keeper.dashTime = KEEPER.dashTime;
      keeper.dashCooldown = stats.dashCooldown;
      burst(keeper.x, keeper.y, '#7fe3ff', 8, 120, 3);
    }
    if (keeper.dashTime > 0) {
      keeper.dashTime -= dt;
      keeper.x += keeper.dashX * KEEPER.dashSpeed * dt;
      keeper.y += keeper.dashY * KEEPER.dashSpeed * dt;
    } else {
      keeper.x += control.moveX * stats.speed * dt;
      keeper.y += control.moveY * stats.speed * dt;
    }
    keeper.x = Math.min(FIELD.width - KEEPER.radius, Math.max(KEEPER.radius, keeper.x));
    keeper.y = Math.min(FIELD.height - KEEPER.radius, Math.max(KEEPER.radius, keeper.y));

    keeper.fireTimer -= dt;
    if (control.firing && keeper.fireTimer <= 0 && !harmless) {
      keeper.fireTimer = stats.fireInterval;
      const spread = 0.14;
      for (let i = 0; i < stats.bolts; i += 1) {
        fireBolt(keeper.angle + (i - (stats.bolts - 1) / 2) * spread);
      }
      state.shotsFired += 1;
    }

    // Wave flow: banner, spawning, fighting, the calm between waves, the blessing.
    if (!harmless && !state.over && !state.won) {
      if (state.wavePhase === PHASE_BANNER) {
        state.bannerTimer -= dt;
        if (state.bannerTimer <= 0) state.wavePhase = PHASE_ACTIVE;
      } else if (state.wavePhase === PHASE_ACTIVE) {
        const pending = spawnStep(dt);
        if (!pending && !anyEnemyAlive()) {
          if (state.wave >= LAST_WAVE) {
            state.won = true;
            events |= EVENT_WIN;
          } else {
            state.wavePhase = PHASE_CLEAR;
            state.betweenTimer = BETWEEN_WAVES;
            events |= EVENT_WAVE_CLEAR;
          }
        }
      } else if (state.wavePhase === PHASE_CLEAR) {
        state.betweenTimer -= dt;
        if (state.betweenTimer <= 0) {
          state.wavePhase = PHASE_OFFER;
        }
      }
    }

    // Enemies hunt the lantern (and the keeper).
    for (const e of enemies) {
      if (!e.active) continue;
      e.age += dt;
      const dxLantern = LANTERN.x - e.x;
      const dyLantern = LANTERN.y - e.y;
      const distLantern = Math.hypot(dxLantern, dyLantern) || 1;
      const dxKeeper = keeper.x - e.x;
      const dyKeeper = keeper.y - e.y;
      const distKeeper = Math.hypot(dxKeeper, dyKeeper) || 1;
      let vx = 0;
      let vy = 0;
      if (e.kind === KIND_WISP) {
        const wobble = Math.sin(e.age * 3 + e.x * 0.01) * 0.5;
        vx = (dxLantern / distLantern + -dyLantern / distLantern * wobble) * e.speed;
        vy = (dyLantern / distLantern + dxLantern / distLantern * wobble) * e.speed;
      } else if (e.kind === KIND_DART) {
        const zig = Math.sin(e.age * 6) * 0.8;
        vx = (dxKeeper / distKeeper + -dyKeeper / distKeeper * zig) * e.speed;
        vy = (dyKeeper / distKeeper + dxKeeper / distKeeper * zig) * e.speed;
      } else if (e.kind === KIND_SPITTER) {
        if (distLantern > 320) {
          vx = (dxLantern / distLantern) * e.speed;
          vy = (dyLantern / distLantern) * e.speed;
        } else {
          vx = (-dyLantern / distLantern) * e.speed * 0.4;
          vy = (dxLantern / distLantern) * e.speed * 0.4;
        }
        e.shootTimer -= dt;
        if (e.shootTimer <= 0 && !harmless) {
          e.shootTimer = 2.4 + random() * 0.8;
          fireGlob(e.x, e.y, Math.atan2(dyLantern, dxLantern), 210);
        }
      } else if (e.kind === KIND_BRUTE) {
        vx = (dxLantern / distLantern) * e.speed;
        vy = (dyLantern / distLantern) * e.speed;
      } else if (e.kind === KIND_MATRIARCH) {
        if (distLantern > 280) {
          vx = (dxLantern / distLantern) * e.speed;
          vy = (dyLantern / distLantern) * e.speed;
        } else {
          vx = (-dyLantern / distLantern) * e.speed * 0.7;
          vy = (dxLantern / distLantern) * e.speed * 0.7;
        }
        e.shootTimer -= dt;
        if (e.shootTimer <= 0 && !harmless) {
          e.shootTimer = 3.0;
          for (let i = 0; i < 10; i += 1) fireGlob(e.x, e.y, (i / 10) * Math.PI * 2 + e.age, 170);
          events |= EVENT_BOSS;
        }
        e.spawnTimer -= dt;
        if (e.spawnTimer <= 0 && !harmless) {
          e.spawnTimer = 6;
          spawnEnemy(KIND_WISP);
          spawnEnemy(KIND_WISP);
        }
      }
      e.x += vx * dt;
      e.y += vy * dt;

      // A gloom that reaches the lantern snuffs some of its light and dies (the
      // matriarch is too big to die that way: she backs off and tries again).
      if (distLantern < LANTERN.radius + e.radius) {
        if (harmless) {
          e.active = false;
        } else if (e.kind === KIND_MATRIARCH) {
          events = hurtLantern(LANTERN_DAMAGE.matriarch, events);
          e.x = LANTERN.x + (dxLantern / distLantern) * -1 * (LANTERN.radius + e.radius + 60);
          e.y = LANTERN.y + (dyLantern / distLantern) * -1 * (LANTERN.radius + e.radius + 60);
        } else {
          e.active = false;
          burst(e.x, e.y, colorOf(e.kind), 10, 140, 4);
          events = hurtLantern(LANTERN_DAMAGE[e.kind], events);
        }
        if (state.over) return events;
        continue;
      }

      // A gloom that touches the keeper is knocked back and stung; the keeper is briefly
      // safe. (Never on the title backdrop: nothing there scores or dies by the keeper.)
      if (!harmless && distKeeper < KEEPER.radius + e.radius && keeper.mercy <= 0 && keeper.dashTime <= 0) {
        keeper.mercy = KEEPER.touchMercy;
        e.hp -= 1;
        e.x -= (dxKeeper / distKeeper) * 30;
        e.y -= (dyKeeper / distKeeper) * 30;
        burst(keeper.x, keeper.y, '#7fe3ff', 8, 140, 3);
        state.shake = Math.max(state.shake, 6);
        if (e.hp <= 0) events = killEnemy(e, events);
      }
    }

    // Bolts fly and sting glooms.
    for (const b of bolts) {
      if (!b.active) continue;
      b.life -= dt;
      if (b.life <= 0) {
        b.active = false;
        continue;
      }
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (b.x < -20 || b.x > FIELD.width + 20 || b.y < -20 || b.y > FIELD.height + 20) {
        b.active = false;
        continue;
      }
      for (const e of enemies) {
        if (!e.active) continue;
        if (distance(b.x, b.y, e.x, e.y) < BOLT.radius + e.radius) {
          e.hp -= b.damage;
          state.shotsHit += 1;
          burst(b.x, b.y, '#ffe08a', 4, 90, 3);
          if (b.pierce > 0) {
            b.pierce -= 1;
          } else {
            b.active = false;
          }
          if (e.hp <= 0) events = killEnemy(e, events);
          break;
        }
      }
    }

    // Globs drift and snuff light where they land.
    for (const g of globs) {
      if (!g.active) continue;
      g.life -= dt;
      if (g.life <= 0) {
        g.active = false;
        continue;
      }
      g.x += g.vx * dt;
      g.y += g.vy * dt;
      if (distance(g.x, g.y, LANTERN.x, LANTERN.y) < LANTERN.radius + 8) {
        g.active = false;
        if (!harmless) events = hurtLantern(4, events);
        if (state.over) return events;
        continue;
      }
      if (distance(g.x, g.y, keeper.x, keeper.y) < KEEPER.radius + 8 && keeper.mercy <= 0 && keeper.dashTime <= 0) {
        g.active = false;
        keeper.mercy = KEEPER.touchMercy;
        burst(keeper.x, keeper.y, '#c9ff6b', 8, 120, 3);
      }
    }

    // Pickups drift, feel the keeper's pull, and are gathered.
    for (const p of pickups) {
      if (!p.active) continue;
      p.age += dt;
      if (p.age > 12) {
        p.active = false;
        continue;
      }
      const dx = keeper.x - p.x;
      const dy = keeper.y - p.y;
      const dist = Math.hypot(dx, dy) || 1;
      if (dist < stats.magnet) {
        const pull = 420 * (1 - dist / stats.magnet) + 120;
        p.vx += (dx / dist) * pull * dt;
        p.vy += (dy / dist) * pull * dt;
      }
      p.vx *= 1 - 2 * dt;
      p.vy *= 1 - 2 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (dist < EMBER.collectRadius) {
        p.active = false;
        if (p.kind === 'ember') {
          state.score += EMBER.score;
          lantern.light = Math.min(LANTERN.maxLight, lantern.light + EMBER.light);
        } else {
          lantern.light = Math.min(LANTERN.maxLight, lantern.light + 12);
        }
        burst(p.x, p.y, p.kind === 'ember' ? '#ffc46b' : '#ff6b81', 6, 100, 3);
        events |= EVENT_PICKUP;
      }
    }

    // Particles fade.
    for (const p of particles) {
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 1 - 1.5 * dt;
      p.vy *= 1 - 1.5 * dt;
    }

    return events;
  }

  function healLantern(amount) {
    lantern.light = Math.min(LANTERN.maxLight, lantern.light + amount);
  }

  /** Start the run: wave 1's banner. */
  function begin() {
    startWave(1);
  }

  /** Take a blessing between waves and open the next wave. */
  function chooseUpgrade(upgrade) {
    if (state.wavePhase !== PHASE_OFFER || !upgrade) return false;
    upgrade.apply(stats, { healLantern });
    state.offer = null;
    startWave(state.wave + 1);
    return true;
  }

  /** For the title screen's backdrop: a few glooms drifting, nothing at stake. */
  function seedBackdrop() {
    for (let i = 0; i < 5; i += 1) spawnEnemy(i % 2 === 0 ? KIND_WISP : KIND_DART);
  }

  reset();
  return { state, reset, step, begin, chooseUpgrade, healLantern, seedBackdrop, PHASE_BANNER, PHASE_ACTIVE, PHASE_CLEAR, PHASE_OFFER };
}
