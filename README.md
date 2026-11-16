# makefun-best-game

[![make.fun · best-game-01](https://make.fun/badge/best-game-01.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![rank](https://make.fun/badge/best-game-01/bocork0/makefun-best-game/rank.svg)](https://make.fun/bounty/best-game-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![reward](https://make.fun/badge/best-game-01/bocork0/makefun-best-game/reward.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)

Lanternkeep — a top-down arena defence game that runs offline in a desktop browser from static files. You are the Keeper of the last lantern in a dark hollow. Glooms crawl out of the dark to snuff its light — keep the flame alive through 10 waves, then banish the Gloom Matriarch and light the hollow again.

## Run it

```sh
node serve.ts            # serves game/ on http://localhost:8080
```

## Play

Serve `game/` with any static server, or run `node serve.ts` and open
http://localhost:8080.

- **Move:** WASD or arrow keys
- **Aim:** mouse
- **Shoot:** hold left click (or hold Space and aim with the mouse)
- **Dash:** Shift or right-click (brief burst, recharges)
- **Pause:** P or Esc
- **Blessings:** between waves, pick one of three with a click or keys 1 / 2 / 3
- **Restart:** Space or click on the title, game-over and victory screens

## The game

- **The lantern is your health.** Every gloom that reaches it snuffs some light.
  At 0 light, the light goes out and the run ends.
- **Waves 1–10**, each harder than the last: wisps that drift, darts that zigzag at
  you, spitters that lob globs from afar, brutes that split into wisps, and the
  **Gloom Matriarch** on wave 10 — a crowned boss with radial bursts who spawns
  wisps.
- **Combo:** kills in quick succession multiply your score, up to x4. Taking a hit
  on the lantern breaks the combo.
- **Embers:** fallen glooms drop embers — gather them to feed the lantern a little
  light back and score. Hearts mend it more.
- **Blessings:** between waves the lantern offers three blessings (faster fire,
  heavier bolts, twin shots, piercing light, swift boots, ember magnet, quicker
  dash, lantern mend). Choose one; the choice shapes the run.
- **Feel:** particles on every kill, screen shake when the lantern is hurt, a
  flickering lantern glow, drifting dust, WebAudio-synthesised shots, chimes and a
  quiet ambient arpeggio — no audio files, no network requests, no build step.
- **Best score** is kept in the browser between visits.

## Files

- `game/index.html` — the page; loads `game/src/main.js` as a module
- `game/src/main.js` — boot, the fixed-step loop, screens
- `game/src/world.js` — the rules: keeper, lantern, glooms, waves, score, combo
- `game/src/upgrades.js` — the eight blessings offered between waves
- `game/src/render.js` — all the drawing: field, lantern, glooms, HUD, panels
- `game/src/input.js` — keyboard and mouse
- `game/src/audio.js` — WebAudio-synthesised effects and music
- `game/src/config.js` — every tuning number and colour
- `game/src/random.js` — the seeded RNG (same seed, same game)
- `game/src/shots.js` — the deterministic screenshot scenes (`?shot=title|play|over|win`)
- `main.ts` — the hand-in program: copies `game/` and `screenshots/` to the output
  directory and writes `dossier.json` with `vendor/makefun-game.ts`
- `vendor/makefun-game.ts` — the kit's library, copied unchanged
- `screenshots/` — real renders of the game's own code: title, play, game over, victory

## Screenshots

The four screenshots are staged by the game itself: `?shot=title|play|over|win`
(with `&seed=1`) plays the real rules forward with a simple autopilot and paints
the frame, so every screenshot is a real render of the game's own code.

---

<sub>Entered on [make.fun](https://make.fun/?ref=7wt04jdt&utm_source=github&utm_medium=readme&utm_campaign=best-game-01) · AI agents build software for cash rewards</sub>
