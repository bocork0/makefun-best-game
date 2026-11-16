// The screenshot scenes behind ?shot=title|play|over|win. Each one plays the real rules
// forward from a fresh world for a fixed number of steps, steered by a simple autopilot
// (guard the lantern, flee what gets close, gather embers, always fire at the gloom
// nearest the lantern), so the frame is what a real game looks like and the same seed
// always gives the same frame. The win scene's pilot also takes the lantern's blessings
// between waves, through the same chooseUpgrade the player uses.
import { FIELD, LANTERN, STEP } from './config.js';
import { drawUpgrades } from './upgrades.js';
import { EVENT_OVER, EVENT_WIN } from './world.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';

const TITLE_SECONDS = 6;
const PLAY_SECONDS = 75;
const END_LIMIT_SECONDS = 900;
const WIN_LIMIT_SECONDS = 1500;

/** The autopilot's control for one step: where to move, where to aim, whether to fire or dash. */
function autopilot(state) {
  const keeper = state.keeper;
  let nearest = null;
  let nearestDist = Infinity;
  let nearestToLantern = null;
  let nearestLanternDist = Infinity;
  for (const e of state.enemies) {
    if (!e.active) continue;
    const dKeeper = Math.hypot(e.x - keeper.x, e.y - keeper.y);
    if (dKeeper < nearestDist) {
      nearestDist = dKeeper;
      nearest = e;
    }
    const dLantern = Math.hypot(e.x - LANTERN.x, e.y - LANTERN.y);
    if (dLantern < nearestLanternDist) {
      nearestLanternDist = dLantern;
      nearestToLantern = e;
    }
  }

  let aimX = keeper.x + Math.cos(keeper.angle) * 100;
  let aimY = keeper.y + Math.sin(keeper.angle) * 100;
  const aimTarget = nearestDist < 150 ? nearest : nearestToLantern;
  if (aimTarget) {
    aimX = aimTarget.x;
    aimY = aimTarget.y;
  }

  let moveX = 0;
  let moveY = 0;
  if (nearest && nearestDist < 110) {
    // Flee: straight away from the closest gloom.
    moveX = (keeper.x - nearest.x) / nearestDist;
    moveY = (keeper.y - nearest.y) / nearestDist;
  } else {
    // Gather the nearest ember, if one is close.
    let ember = null;
    let emberDist = 230;
    for (const p of state.pickups) {
      if (!p.active) continue;
      const d = Math.hypot(p.x - keeper.x, p.y - keeper.y);
      if (d < emberDist) {
        emberDist = d;
        ember = p;
      }
    }
    if (ember) {
      moveX = (ember.x - keeper.x) / emberDist;
      moveY = (ember.y - keeper.y) / emberDist;
    } else if (nearestToLantern) {
      // Guard: stand between the lantern and the gloom nearest to it.
      const gx = LANTERN.x + ((keeper.x - nearestToLantern.x) / nearestLanternDist) * -170;
      const gy = LANTERN.y + ((keeper.y - nearestToLantern.y) / nearestLanternDist) * -170;
      const gd = Math.hypot(gx - keeper.x, gy - keeper.y);
      if (gd > 30) {
        moveX = (gx - keeper.x) / gd;
        moveY = (gy - keeper.y) / gd;
      }
    } else {
      // Nothing to do: drift back toward the lantern.
      const dx = LANTERN.x - keeper.x;
      const dy = LANTERN.y - keeper.y;
      const d = Math.hypot(dx, dy);
      if (d > 200) {
        moveX = dx / d;
        moveY = dy / d;
      }
    }
  }
  const len = Math.hypot(moveX, moveY);
  if (len > 0) {
    moveX /= len;
    moveY /= len;
  }
  return {
    moveX, moveY, aimX, aimY,
    firing: aimTarget !== null,
    dash: nearest !== null && nearestDist < 55 && keeper.dashCooldown <= 0,
  };
}

/** The win scene's blessing picks: mend the lantern when it is low, else grow the flame. */
function pickBlessing(offer, state) {
  const byId = (id) => offer.find((u) => u.id === id);
  if (state.lantern.light < 55 && byId('mend')) return byId('mend');
  return byId('twin') || byId('heavy') || byId('pierce') || byId('rapid') || offer[0];
}

/**
 * Set `world` to the named scene (title, play, over or win; any other name is title) and
 * return the screen to draw over it and the best score to show.
 */
export function stageShot(name, world, random) {
  world.reset();
  if (name !== 'play' && name !== 'over' && name !== 'win') {
    world.seedBackdrop();
    for (let i = 0; i < TITLE_SECONDS / STEP; i += 1) {
      world.step(STEP, { moveX: 0, moveY: 0, aimX: 640, aimY: 200, firing: false, dash: false }, true);
    }
    return { screen: SCREEN_TITLE, best: 0 };
  }

  world.begin();
  const limit = name === 'win' ? WIN_LIMIT_SECONDS : name === 'over' ? END_LIMIT_SECONDS : PLAY_SECONDS;
  const pilot = name === 'over'
    // The over scene's pilot never fires and never moves: the lantern is left to drain.
    ? () => ({ moveX: 0, moveY: 0, aimX: 640, aimY: 200, firing: false, dash: false })
    : () => autopilot(world.state);
  for (let i = 0; i < limit / STEP; i += 1) {
    if (world.state.wavePhase === 'offer' && !world.state.offer) {
      world.state.offer = drawUpgrades(random);
    }
    if (world.state.wavePhase === 'offer') {
      const chosen = name === 'win' ? pickBlessing(world.state.offer, world.state) : world.state.offer[0];
      world.chooseUpgrade(chosen);
    }
    const events = world.step(STEP, pilot(), false);
    if (events & EVENT_WIN) break;
    if (events & EVENT_OVER) break;
  }
  if (world.state.won) return { screen: SCREEN_WIN, best: world.state.score };
  if (world.state.over) return { screen: SCREEN_OVER, best: world.state.score };
  return { screen: SCREEN_PLAY, best: world.state.score };
}
