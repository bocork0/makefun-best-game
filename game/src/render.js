// Drawing only: the world's state and the current screen in, pixels out. The 1280x720
// playfield is scaled to fit the window and centred, the margin filled with the backdrop
// colour. Everything is drawn with canvas shapes and gradients: the lantern's glow, the
// glooms' wobble, the keeper's flame, particles and the HUD. Text that holds a number is
// rebuilt only when the number changes, so a frame allocates nothing.
import { FIELD, FONT, KEEPER, LANTERN, PALETTE } from './config.js';
import { KIND_BRUTE, KIND_DART, KIND_MATRIARCH, KIND_SPITTER, KIND_WISP } from './world.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_UPGRADE = 'upgrade';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_WIN = 'win';

/** The panel's width; its height grows with its lines: room for the title, the lines and the prompt. */
const PANEL = { width: 640, top: 150, line: 34, bottom: 76 };
const LIGHT_BAR = { x: 24, y: 56, width: 260, height: 16 };

function cachedLabel(prefix) {
  let value = -1;
  let text = '';
  return function label(next) {
    if (next !== value) {
      value = next;
      text = prefix + next;
    }
    return text;
  };
}

function colorOf(kind) {
  if (kind === KIND_WISP) return PALETTE.wisp;
  if (kind === KIND_DART) return PALETTE.dart;
  if (kind === KIND_SPITTER) return PALETTE.spitter;
  if (kind === KIND_BRUTE) return PALETTE.brute;
  return PALETTE.matriarch;
}

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0, width: 1280, height: 720 };
  const scoreLabel = cachedLabel('Score ');
  const waveLabel = cachedLabel('Wave ');
  const finalLabel = cachedLabel('Score ');
  const bestLabel = cachedLabel('Best ');
  const killsLabel = cachedLabel('Glooms banished ');
  const comboLabel = cachedLabel('x');
  const fonts = new Map();

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.width = width;
    view.height = height;
    view.scale = Math.min(width / FIELD.width, height / FIELD.height);
    view.x = (width - FIELD.width * view.scale) / 2;
    view.y = (height - FIELD.height * view.scale) / 2;
  }

  /** Canvas pixels to field coordinates (for the mouse aim). */
  function toField(px, py) {
    return { x: (px - view.x) / view.scale, y: (py - view.y) / view.scale };
  }

  function text(value, x, y, size, color, align) {
    if (!fonts.has(size)) fonts.set(size, `${size}px ${FONT}`);
    context.font = fonts.get(size);
    context.fillStyle = color;
    context.textAlign = align;
    context.fillText(value, x, y);
  }

  function drawBackground(clock, light) {
    const glow = context.createRadialGradient(
      LANTERN.x, LANTERN.y, 20, LANTERN.x, LANTERN.y, 460,
    );
    glow.addColorStop(0, 'rgba(255, 179, 71, 0.30)');
    glow.addColorStop(0.45, 'rgba(255, 179, 71, 0.10)');
    glow.addColorStop(1, 'rgba(255, 179, 71, 0)');
    context.fillStyle = PALETTE.night;
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    context.fillStyle = glow;
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    // Concentric stone rings around the lantern.
    context.strokeStyle = PALETTE.ring;
    context.lineWidth = 2;
    for (let r = 120; r <= 480; r += 120) {
      context.beginPath();
      context.arc(LANTERN.x, LANTERN.y, r, 0, Math.PI * 2);
      context.stroke();
    }
    // Drifting dust motes, placed by a fixed hash of their index so they never jump.
    context.fillStyle = 'rgba(242, 234, 216, 0.20)';
    for (let i = 0; i < 40; i += 1) {
      const hx = ((i * 2654435761) % 1280 + 1280) % 1280;
      const hy = ((i * 40503) % 720 + 720) % 720;
      const x = (hx + Math.sin(clock * 0.11 + i) * 14 + 1280) % 1280;
      const y = (hy + Math.cos(clock * 0.07 + i * 2) * 10 + 720) % 720;
      context.beginPath();
      context.arc(x, y, 1.6, 0, Math.PI * 2);
      context.fill();
    }
    void light;
  }

  function drawLantern(state, clock) {
    const flicker = 1 + Math.sin(clock * 7) * 0.04 + Math.sin(clock * 13.7) * 0.03;
    const radius = LANTERN.radius * flicker;
    const flash = state.lantern.flash;
    const glow = context.createRadialGradient(LANTERN.x, LANTERN.y, 4, LANTERN.x, LANTERN.y, 130 * flicker);
    glow.addColorStop(0, flash > 0 ? 'rgba(255, 95, 77, 0.55)' : 'rgba(255, 179, 71, 0.55)');
    glow.addColorStop(1, 'rgba(255, 179, 71, 0)');
    context.fillStyle = glow;
    context.beginPath();
    context.arc(LANTERN.x, LANTERN.y, 130 * flicker, 0, Math.PI * 2);
    context.fill();
    // The lantern itself: a stone base, a brass cage and a flame.
    context.fillStyle = '#3a2f22';
    context.fillRect(LANTERN.x - 22, LANTERN.y + 14, 44, 12);
    context.fillStyle = '#6b5636';
    context.fillRect(LANTERN.x - 18, LANTERN.y - 20, 36, 38);
    context.fillStyle = PALETTE.lanternCore;
    context.beginPath();
    context.ellipse(LANTERN.x, LANTERN.y - 2, 9 * flicker, 15 * flicker, 0, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = '#8a6d3b';
    context.lineWidth = 2;
    context.strokeRect(LANTERN.x - 18, LANTERN.y - 20, 36, 38);
    context.beginPath();
    context.moveTo(LANTERN.x - 18, LANTERN.y - 20);
    context.lineTo(LANTERN.x, LANTERN.y - 34);
    context.lineTo(LANTERN.x + 18, LANTERN.y - 20);
    context.stroke();
  }

  function drawEnemy(e, clock) {
    const color = colorOf(e.kind);
    const wobble = Math.sin(clock * 4 + e.x * 0.02) * 2;
    context.fillStyle = color;
    if (e.kind === KIND_WISP) {
      context.beginPath();
      context.arc(e.x, e.y + wobble, e.radius, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = 'rgba(255, 255, 255, 0.75)';
      context.beginPath();
      context.arc(e.x - 4, e.y - 3 + wobble, 2.5, 0, Math.PI * 2);
      context.arc(e.x + 4, e.y - 3 + wobble, 2.5, 0, Math.PI * 2);
      context.fill();
      // A wisp's trailing tail.
      context.strokeStyle = color;
      context.globalAlpha = 0.5;
      context.lineWidth = 3;
      context.beginPath();
      context.moveTo(e.x, e.y + e.radius);
      context.quadraticCurveTo(e.x + 8, e.y + e.radius + 12, e.x - 4, e.y + e.radius + 22);
      context.stroke();
      context.globalAlpha = 1;
    } else if (e.kind === KIND_DART) {
      const angle = Math.atan2(LANTERN.y - e.y, LANTERN.x - e.x);
      context.save();
      context.translate(e.x, e.y);
      context.rotate(angle);
      context.beginPath();
      context.moveTo(e.radius + 6, 0);
      context.lineTo(-e.radius, -e.radius * 0.8);
      context.lineTo(-e.radius * 0.4, 0);
      context.lineTo(-e.radius, e.radius * 0.8);
      context.closePath();
      context.fill();
      context.restore();
    } else if (e.kind === KIND_SPITTER) {
      context.beginPath();
      context.arc(e.x, e.y, e.radius, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = PALETTE.glob;
      context.beginPath();
      context.arc(e.x, e.y, e.radius * 0.45, 0, Math.PI * 2);
      context.fill();
      context.strokeStyle = color;
      context.lineWidth = 2;
      for (let i = 0; i < 6; i += 1) {
        const a = (i / 6) * Math.PI * 2 + clock * 0.8;
        context.beginPath();
        context.moveTo(e.x + Math.cos(a) * e.radius, e.y + Math.sin(a) * e.radius);
        context.lineTo(e.x + Math.cos(a) * (e.radius + 7), e.y + Math.sin(a) * (e.radius + 7));
        context.stroke();
      }
    } else if (e.kind === KIND_BRUTE) {
      context.save();
      context.translate(e.x, e.y);
      context.rotate(Math.sin(clock * 2 + e.y) * 0.08);
      context.fillRect(-e.radius, -e.radius, e.radius * 2, e.radius * 2);
      context.fillStyle = 'rgba(0, 0, 0, 0.35)';
      context.fillRect(-e.radius, -e.radius, e.radius * 2, 8);
      context.fillStyle = '#ffd9d4';
      context.fillRect(-e.radius * 0.5, -6, 6, 6);
      context.fillRect(e.radius * 0.5 - 6, -6, 6, 6);
      context.restore();
    } else {
      // The Gloom Matriarch: a crowned ring of thorns around a dark heart.
      context.save();
      context.translate(e.x, e.y);
      context.rotate(clock * 0.5);
      context.fillStyle = color;
      for (let i = 0; i < 8; i += 1) {
        const a = (i / 8) * Math.PI * 2;
        context.beginPath();
        context.moveTo(Math.cos(a) * e.radius * 0.7, Math.sin(a) * e.radius * 0.7);
        context.lineTo(Math.cos(a) * (e.radius + 16), Math.sin(a) * (e.radius + 16));
        context.lineTo(Math.cos(a + 0.3) * e.radius * 0.7, Math.sin(a + 0.3) * e.radius * 0.7);
        context.closePath();
        context.fill();
      }
      context.restore();
      context.fillStyle = '#1a0b1e';
      context.beginPath();
      context.arc(e.x, e.y, e.radius * 0.72, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = color;
      context.beginPath();
      context.arc(e.x, e.y, e.radius * 0.4, 0, Math.PI * 2);
      context.fill();
    }
    // A health bar for anything that takes more than one bolt.
    if (e.maxHp > 2) {
      const width = e.radius * 2;
      const ratio = Math.max(0, e.hp / e.maxHp);
      context.fillStyle = 'rgba(0, 0, 0, 0.55)';
      context.fillRect(e.x - width / 2, e.y - e.radius - 12, width, 5);
      context.fillStyle = color;
      context.fillRect(e.x - width / 2, e.y - e.radius - 12, width * ratio, 5);
    }
  }

  function drawKeeper(state, clock) {
    const keeper = state.keeper;
    const blink = keeper.mercy > 0 && Math.floor(clock * 12) % 2 === 0;
    if (blink) return;
    // A soft glow and a cloak, a hood, and the little flame the keeper carries.
    const glow = context.createRadialGradient(keeper.x, keeper.y, 4, keeper.x, keeper.y, 52);
    glow.addColorStop(0, 'rgba(127, 227, 255, 0.35)');
    glow.addColorStop(1, 'rgba(127, 227, 255, 0)');
    context.fillStyle = glow;
    context.beginPath();
    context.arc(keeper.x, keeper.y, 52, 0, Math.PI * 2);
    context.fill();
    context.save();
    context.translate(keeper.x, keeper.y);
    context.rotate(keeper.angle);
    context.fillStyle = PALETTE.keeperDark;
    context.beginPath();
    context.moveTo(18, 0);
    context.lineTo(-12, -12);
    context.lineTo(-16, 0);
    context.lineTo(-12, 12);
    context.closePath();
    context.fill();
    context.restore();
    context.fillStyle = PALETTE.keeper;
    context.beginPath();
    context.arc(keeper.x, keeper.y, KEEPER.radius, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#0d1226';
    context.beginPath();
    context.arc(keeper.x + Math.cos(keeper.angle) * 5, keeper.y + Math.sin(keeper.angle) * 5, 5, 0, Math.PI * 2);
    context.fill();
    // The flame at the keeper's hand, pointing where they aim.
    const fx = keeper.x + Math.cos(keeper.angle) * 22;
    const fy = keeper.y + Math.sin(keeper.angle) * 22;
    context.fillStyle = PALETTE.bolt;
    context.beginPath();
    context.arc(fx, fy, 5 + Math.sin(clock * 10) * 1.2, 0, Math.PI * 2);
    context.fill();
    // Dash recharge ring under the keeper.
    if (keeper.dashCooldown > 0) {
      const ratio = 1 - keeper.dashCooldown / state.stats.dashCooldown;
      context.strokeStyle = 'rgba(127, 227, 255, 0.5)';
      context.lineWidth = 3;
      context.beginPath();
      context.arc(keeper.x, keeper.y, KEEPER.radius + 8, -Math.PI / 2, -Math.PI / 2 + ratio * Math.PI * 2);
      context.stroke();
    }
  }

  function drawField(state, clock, aim) {
    drawBackground(clock, state.lantern.light);
    for (const p of state.pickups) {
      if (!p.active) continue;
      const bob = Math.sin(clock * 3 + p.x) * 2;
      if (p.kind === 'ember') {
        context.fillStyle = PALETTE.ember;
        context.beginPath();
        context.arc(p.x, p.y + bob, 7, 0, Math.PI * 2);
        context.fill();
        context.fillStyle = 'rgba(255, 196, 107, 0.35)';
        context.beginPath();
        context.arc(p.x, p.y + bob, 12, 0, Math.PI * 2);
        context.fill();
      } else {
        context.fillStyle = PALETTE.heart;
        context.beginPath();
        context.arc(p.x - 4, p.y + bob, 5, 0, Math.PI * 2);
        context.arc(p.x + 4, p.y + bob, 5, 0, Math.PI * 2);
        context.fill();
        context.beginPath();
        context.moveTo(p.x - 8, p.y + 2 + bob);
        context.lineTo(p.x, p.y + 10 + bob);
        context.lineTo(p.x + 8, p.y + 2 + bob);
        context.closePath();
        context.fill();
      }
    }
    drawLantern(state, clock);
    for (const e of state.enemies) if (e.active) drawEnemy(e, clock);
    for (const g of state.globs) {
      if (!g.active) continue;
      context.fillStyle = PALETTE.glob;
      context.beginPath();
      context.arc(g.x, g.y, 7, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = 'rgba(201, 255, 107, 0.35)';
      context.beginPath();
      context.arc(g.x, g.y, 12, 0, Math.PI * 2);
      context.fill();
    }
    for (const b of state.bolts) {
      if (!b.active) continue;
      context.strokeStyle = PALETTE.bolt;
      context.lineWidth = 4;
      context.lineCap = 'round';
      context.beginPath();
      context.moveTo(b.x - b.vx * 0.02, b.y - b.vy * 0.02);
      context.lineTo(b.x, b.y);
      context.stroke();
    }
    drawKeeper(state, clock);
    for (const p of state.particles) {
      if (!p.active) continue;
      context.globalAlpha = Math.max(0, p.life / p.maxLife);
      context.fillStyle = p.color;
      context.beginPath();
      context.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      context.fill();
    }
    context.globalAlpha = 1;
    // The aim reticle.
    if (aim) {
      context.strokeStyle = 'rgba(242, 234, 216, 0.8)';
      context.lineWidth = 2;
      context.beginPath();
      context.arc(aim.x, aim.y, 10, 0, Math.PI * 2);
      context.stroke();
      context.beginPath();
      context.moveTo(aim.x - 14, aim.y);
      context.lineTo(aim.x - 6, aim.y);
      context.moveTo(aim.x + 6, aim.y);
      context.lineTo(aim.x + 14, aim.y);
      context.moveTo(aim.x, aim.y - 14);
      context.lineTo(aim.x, aim.y - 6);
      context.moveTo(aim.x, aim.y + 6);
      context.lineTo(aim.x, aim.y + 14);
      context.stroke();
    }
  }

  function drawHud(state, clock) {
    context.textBaseline = 'top';
    text(scoreLabel(state.score), 24, 16, 28, PALETTE.text, 'left');
    text(waveLabel(Math.max(1, state.wave)), FIELD.width / 2, 16, 28, PALETTE.text, 'center');
    // Lantern light bar, top left under the score.
    const lightRatio = state.lantern.light / LANTERN.maxLight;
    context.fillStyle = 'rgba(0, 0, 0, 0.55)';
    context.fillRect(LIGHT_BAR.x - 2, LIGHT_BAR.y - 2, LIGHT_BAR.width + 4, LIGHT_BAR.height + 4);
    context.fillStyle = lightRatio > 0.35 ? PALETTE.lanternGlow : PALETTE.danger;
    context.fillRect(LIGHT_BAR.x, LIGHT_BAR.y, LIGHT_BAR.width * lightRatio, LIGHT_BAR.height);
    text('Lantern light', LIGHT_BAR.x, LIGHT_BAR.y + LIGHT_BAR.height + 6, 16, PALETTE.muted, 'left');
    // Combo, top right, only while it burns.
    if (state.combo >= 2) {
      const mult = Math.min(4, 1 + (state.combo - 1) * 0.25);
      text(`Combo x${mult.toFixed(2).replace(/0$/, '')}  (${state.combo})`, FIELD.width - 24, 16, 26, PALETTE.gold, 'right');
    }
    // Dash hint, bottom right.
    const dashReady = state.keeper.dashCooldown <= 0;
    text(dashReady ? 'Shift / right-click: Dash ready' : 'Dash recharging…', FIELD.width - 24, FIELD.height - 34, 16, dashReady ? PALETTE.keeper : PALETTE.muted, 'right');
    void clock;
  }

  function drawWaveBanner(state) {
    if (state.wavePhase !== 'banner' || state.wave < 1) return;
    const name = state.wave === 10 ? 'Wave 10 — The Gloom Matriarch' : `Wave ${state.wave}`;
    context.textBaseline = 'alphabetic';
    context.globalAlpha = Math.min(1, state.bannerTimer * 2);
    text(name, FIELD.width / 2, 200, 52, PALETTE.text, 'center');
    text(state.wave === 10 ? 'Banish her, and the hollow is yours.' : 'Hold the light.', FIELD.width / 2, 244, 24, PALETTE.muted, 'center');
    context.globalAlpha = 1;
  }

  function drawPanel(title, lines, prompt) {
    const height = PANEL.top + lines.length * PANEL.line + PANEL.bottom;
    const x = (FIELD.width - PANEL.width) / 2;
    const y = (FIELD.height - height) / 2;
    context.fillStyle = 'rgba(7, 10, 20, 0.72)';
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    context.fillStyle = PALETTE.panel;
    context.fillRect(x, y, PANEL.width, height);
    context.strokeStyle = PALETTE.panelEdge;
    context.lineWidth = 2;
    context.strokeRect(x, y, PANEL.width, height);
    context.textBaseline = 'alphabetic';
    text(title, FIELD.width / 2, y + 78, 48, PALETTE.text, 'center');
    for (let index = 0; index < lines.length; index += 1) {
      text(lines[index], FIELD.width / 2, y + PANEL.top + index * PANEL.line, 22, PALETTE.muted, 'center');
    }
    text(prompt, FIELD.width / 2, y + height - 40, 24, PALETTE.gold, 'center');
  }

  function drawUpgradeCards(offer) {
    if (!offer) return;
    context.fillStyle = 'rgba(7, 10, 20, 0.72)';
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    context.textBaseline = 'alphabetic';
    text('The lantern offers a blessing', FIELD.width / 2, 150, 40, PALETTE.text, 'center');
    text('Choose one — click it, or press 1, 2 or 3', FIELD.width / 2, 192, 22, PALETTE.muted, 'center');
    const cardWidth = 300;
    const cardHeight = 170;
    const gap = 32;
    const total = 3 * cardWidth + 2 * gap;
    const startX = (FIELD.width - total) / 2;
    const y = 260;
    for (let i = 0; i < offer.length; i += 1) {
      const card = offer[i];
      const x = startX + i * (cardWidth + gap);
      context.fillStyle = PALETTE.panel;
      context.fillRect(x, y, cardWidth, cardHeight);
      context.strokeStyle = PALETTE.panelEdge;
      context.lineWidth = 2;
      context.strokeRect(x, y, cardWidth, cardHeight);
      text(`${i + 1}`, x + cardWidth / 2, y + 44, 22, PALETTE.gold, 'center');
      text(card.name, x + cardWidth / 2, y + 86, 26, PALETTE.text, 'center');
      text(card.desc, x + cardWidth / 2, y + 124, 19, PALETTE.muted, 'center');
    }
  }

  const TITLE_LINES = [
    'Glooms crawl out of the dark to snuff the great lantern.',
    'Keep its light alive through 10 waves — then banish the Matriarch.',
    'Move with WASD or arrows. Aim with the mouse, hold click to shoot.',
    'Shift or right-click to dash. Gather embers to feed the flame.',
    '',
  ];
  const PAUSED_LINES = ['The glooms wait in the dark.'];
  const OVER_LINES = ['', ''];
  const WIN_LINES = ['', '', ''];

  /** Paint one frame: the field, then the HUD or a panel for the screen the game is on. */
  function draw(state, screen, best, offer, clock, aim) {
    const shakeX = state.shake > 0 ? (Math.random() - 0.5) * state.shake : 0;
    const shakeY = state.shake > 0 ? (Math.random() - 0.5) * state.shake : 0;
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = PALETTE.backdrop;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.setTransform(view.scale, 0, 0, view.scale, view.x + shakeX * view.scale, view.y + shakeY * view.scale);
    drawField(state, clock, screen === SCREEN_PLAY || screen === SCREEN_UPGRADE ? aim : null);
    if (screen === SCREEN_TITLE) {
      TITLE_LINES[4] = best > 0 ? bestLabel(best) : 'No keeper has held the light yet — be the first.';
      drawPanel('Lanternkeep', TITLE_LINES, 'Press Space or click to begin');
      return;
    }
    drawHud(state, clock);
    drawWaveBanner(state);
    if (screen === SCREEN_UPGRADE) drawUpgradeCards(offer);
    else if (screen === SCREEN_PAUSED) drawPanel('Paused', PAUSED_LINES, 'Press P to return to the light');
    else if (screen === SCREEN_OVER) {
      OVER_LINES[0] = finalLabel(state.score);
      OVER_LINES[1] = bestLabel(best);
      drawPanel('The light went out', OVER_LINES, 'Press Space or click to try again');
    } else if (screen === SCREEN_WIN) {
      WIN_LINES[0] = finalLabel(state.score);
      WIN_LINES[1] = killsLabel(state.kills);
      WIN_LINES[2] = bestLabel(best);
      drawPanel('The hollow is lit again', WIN_LINES, 'Press Space or click to keep again');
    }
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw, toField };
}
