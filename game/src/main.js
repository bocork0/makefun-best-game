// Boot and the one loop: input is read every frame, the world advances in fixed 1/60 s
// steps (several in a slow frame, none in a fast one), and the renderer paints what is
// there. The game moves between six screens: title, play, blessing (between waves),
// paused, game over and victory.
//
// ?seed=N fixes the spawn pattern. ?shot=title|play|over|win (with &seed=N) stages that
// scene instead of running the loop, paints it twice and sets window.__shotReady for a
// screenshot.
import { BEST_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import { createAudio } from './audio.js';
import { createWorld, EVENT_KILL, EVENT_LANTERN_HURT, EVENT_OVER, EVENT_PICKUP, EVENT_WAVE_CLEAR, EVENT_WIN } from './world.js';
import { drawUpgrades } from './upgrades.js';
import { ACTION_CONFIRM, ACTION_DASH, ACTION_PAUSE, ACTION_PICK_1, ACTION_PICK_2, ACTION_PICK_3, createInput } from './input.js';
import { createRenderer, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_UPGRADE, SCREEN_WIN } from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const random = createRandom(seed);
const world = createWorld(random);
const renderer = createRenderer(canvas);
const audio = createAudio();

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best score then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, world, random);
  window.__shotState = JSON.stringify({
    screen: scene.screen,
    score: world.state.score,
    wave: world.state.wave,
    kills: world.state.kills,
    alive: world.state.enemies.filter((e) => e.active).length,
    light: Math.round(world.state.lantern.light),
    over: world.state.over,
    won: world.state.won,
  });
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, scene.best, null, 6, null);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();
  let clock = 0;

  // Screen readers (and anyone watching the page's text) hear the screen changes and each hit.
  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    world.reset();
    world.begin();
    accumulator = 0;
    screen = SCREEN_PLAY;
    audio.unlock();
    announce(`Playing. Wave 1. Keep the lantern lit.`);
  }

  function endGame(won) {
    screen = won ? SCREEN_WIN : SCREEN_OVER;
    if (world.state.score > best) {
      best = world.state.score;
      saveBest(best);
    }
    if (won) {
      audio.win();
      announce(`Victory! Score ${world.state.score}. Best ${best}.`);
    } else {
      audio.lose();
      announce(`The light went out. Score ${world.state.score}. Best ${best}.`);
    }
  }

  function handleActions(actions) {
    if (actions & ACTION_CONFIRM) audio.unlock();
    if (screen === SCREEN_TITLE || screen === SCREEN_OVER || screen === SCREEN_WIN) {
      if (actions & ACTION_CONFIRM) startGame();
      return;
    }
    if (screen === SCREEN_UPGRADE) {
      const offer = world.state.offer;
      if (!offer) return;
      let picked = -1;
      if (actions & ACTION_PICK_1) picked = 0;
      else if (actions & ACTION_PICK_2) picked = 1;
      else if (actions & ACTION_PICK_3) picked = 2;
      if (picked >= 0 && picked < offer.length) {
        audio.upgrade();
        world.chooseUpgrade(offer[picked]);
        screen = SCREEN_PLAY;
        announce(`Blessing taken: ${offer[picked].name}. Wave ${world.state.wave}.`);
      }
      return;
    }
    if (actions & ACTION_PAUSE) {
      if (screen === SCREEN_PLAY) {
        screen = SCREEN_PAUSED;
        announce('Paused.');
      } else if (screen === SCREEN_PAUSED) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
    }
  }

  function controlFromInput(actions) {
    const move = input.move();
    const aim = renderer.toField(input.aim.x, input.aim.y);
    return {
      moveX: move.x,
      moveY: move.y,
      aimX: aim.x,
      aimY: aim.y,
      firing: input.firing,
      dash: (actions & ACTION_DASH) !== 0,
    };
  }

  function step(control, harmless) {
    const events = world.step(STEP, control, harmless);
    if (events & EVENT_KILL) audio.gloomDie();
    if (events & EVENT_PICKUP) audio.ember();
    if (events & EVENT_LANTERN_HURT) {
      audio.lanternHurt();
      announce(`The lantern is hurt. Light ${Math.round(world.state.lantern.light)}.`);
    }
    if (events & EVENT_WAVE_CLEAR) {
      audio.waveHorn();
      announce(`Wave ${world.state.wave} cleared.`);
    }
    if (events & EVENT_WIN) endGame(true);
    else if (events & EVENT_OVER) endGame(false);
    return events;
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    // One-shot presses are taken once per frame and shared by the screens and the step.
    const actions = input.takeActions();
    handleActions(actions);
    if (screen === SCREEN_TITLE) {
      while (accumulator >= STEP) {
        clock += STEP;
        step({ moveX: 0, moveY: 0, aimX: 640, aimY: 200, firing: false, dash: false }, true);
        accumulator -= STEP;
      }
    } else if (screen === SCREEN_PLAY) {
      while (accumulator >= STEP && screen === SCREEN_PLAY) {
        clock += STEP;
        audio.music(STEP);
        step(controlFromInput(actions), false);
        accumulator -= STEP;
        if (world.state.wavePhase === world.PHASE_OFFER && !world.state.offer) {
          world.state.offer = drawUpgrades(random);
          screen = SCREEN_UPGRADE;
          audio.upgrade();
          announce('Wave cleared. Choose a blessing: 1, 2 or 3.');
        }
      }
    } else {
      accumulator = 0;
    }
    const aim = screen === SCREEN_PLAY || screen === SCREEN_UPGRADE
      ? renderer.toField(input.aim.x, input.aim.y)
      : null;
    renderer.draw(world.state, screen, best, world.state.offer, clock, aim);
  }

  // Leaving the tab pauses a running game rather than letting glooms feed unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  // Clicking a blessing card picks it.
  canvas.addEventListener('click', () => {
    if (screen !== SCREEN_UPGRADE || !world.state.offer) return;
    const field = renderer.toField(input.aim.x, input.aim.y);
    const cardWidth = 300;
    const gap = 32;
    const total = 3 * cardWidth + 2 * gap;
    const startX = (1280 - total) / 2;
    const y = 260;
    const height = 170;
    if (field.y < y || field.y > y + height) return;
    for (let i = 0; i < 3; i += 1) {
      const x = startX + i * (cardWidth + gap);
      if (field.x >= x && field.x <= x + cardWidth) {
        audio.upgrade();
        const picked = world.state.offer[i];
        world.chooseUpgrade(picked);
        screen = SCREEN_PLAY;
        announce(`Blessing taken: ${picked.name}. Wave ${world.state.wave}.`);
        return;
      }
    }
  });

  world.seedBackdrop();
  announce('Lanternkeep. Press Space or click to begin.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
