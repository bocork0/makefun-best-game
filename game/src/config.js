// Lanternkeep: every tuning number and colour in one place. The playfield is a fixed
// 1280x720 logical area; the renderer scales it to the window, so no rule below depends
// on the screen size. The great lantern stands at the centre; glooms crawl in from the
// dark edges to snuff it out.

export const FIELD = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

/** The centre of the field, where the great lantern stands. */
export const LANTERN = { x: 640, y: 360, radius: 34, maxLight: 100, startLight: 100 };

export const KEEPER = {
  radius: 16,
  speed: 300,
  fireInterval: 0.22,
  boltSpeed: 620,
  boltDamage: 1,
  dashSpeed: 780,
  dashTime: 0.16,
  dashCooldown: 1.6,
  /** Seconds of mercy after a gloom touches the keeper. */
  touchMercy: 0.8,
};

export const BOLT = { radius: 6, life: 1.1 };

/** How many of each pool the world allocates once, at boot; nothing allocates mid-game. */
export const POOL = { enemies: 96, bolts: 96, globs: 64, pickups: 48, particles: 320 };

/** A wave is a list of spawn groups: [kind, count, gapSeconds]. Waves run 1 to 10. */
export const WAVES = [
  [ ['wisp', 6, 1.4] ],
  [ ['wisp', 8, 1.2], ['dart', 3, 1.6] ],
  [ ['wisp', 10, 1.0], ['dart', 5, 1.4], ['spitter', 2, 3.0] ],
  [ ['wisp', 12, 0.9], ['dart', 7, 1.2], ['spitter', 3, 2.6] ],
  [ ['brute', 2, 4.0], ['wisp', 12, 0.9], ['dart', 8, 1.1] ],
  [ ['spitter', 5, 2.2], ['dart', 10, 1.0], ['wisp', 14, 0.8] ],
  [ ['brute', 4, 3.4], ['spitter', 5, 2.0], ['dart', 10, 0.9] ],
  [ ['brute', 5, 3.0], ['wisp', 18, 0.7], ['spitter', 6, 1.8] ],
  [ ['dart', 14, 0.8], ['brute', 6, 2.6], ['spitter', 7, 1.6] ],
  [ ['matriarch', 1, 0.1], ['wisp', 8, 1.2] ],
];
export const LAST_WAVE = WAVES.length;

/** Seconds of calm between one wave's last gloom and the next wave's banner. */
export const BETWEEN_WAVES = 2.5;

/** Light the lantern loses when a gloom reaches it, by kind. */
export const LANTERN_DAMAGE = { wisp: 6, dart: 5, spitter: 8, brute: 16, matriarch: 25 };

/** Score for a kill, by kind, before the combo multiplier. */
export const KILL_SCORE = { wisp: 10, dart: 15, spitter: 25, brute: 50, matriarch: 500 };

/** Combo: each kill within the window raises the multiplier by one step, to a cap. */
export const COMBO = { window: 4, step: 0.25, cap: 4 };

/** Embers: score and light a dropped ember gives when the keeper gathers it. */
export const EMBER = { score: 5, light: 1, magnetRadius: 150, collectRadius: 26 };

export const PALETTE = {
  backdrop: '#070a14',
  night: '#0d1226',
  ground: '#131a33',
  ring: '#1c2547',
  lanternGlow: '#ffb347',
  lanternCore: '#ffe9a8',
  keeper: '#7fe3ff',
  keeperDark: '#2b7ea6',
  bolt: '#ffe08a',
  wisp: '#b78cff',
  dart: '#ff7ad9',
  spitter: '#8cff9e',
  brute: '#ff5f4d',
  matriarch: '#ff2e63',
  glob: '#c9ff6b',
  ember: '#ffc46b',
  heart: '#ff6b81',
  text: '#f2ead8',
  muted: '#9aa3c0',
  panel: '#121830',
  panelEdge: '#2c3763',
  danger: '#ff5f4d',
  gold: '#f2c94c',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'lanternkeep.best';
