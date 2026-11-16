// Keyboard and pointer input. Held keys and the mouse give a move direction and an aim
// point; one-shot presses (start, restart, pause, dash, upgrade picks) are queued as bit
// flags and taken once by the loop, so a press between two frames is never lost and never
// counted twice.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_DASH = 4;
export const ACTION_PICK_1 = 8;
export const ACTION_PICK_2 = 16;
export const ACTION_PICK_3 = 32;

const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const CONFIRM = new Set(['Space', 'Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const DASH = new Set(['ShiftLeft', 'ShiftRight']);

export function createInput(canvas) {
  let up = false;
  let down = false;
  let left = false;
  let right = false;
  let firing = false;
  let actions = 0;
  /** Aim in canvas pixels (the renderer converts it to field coordinates). */
  const aim = { x: 640, y: 300 };

  function setKey(code, held) {
    if (UP.has(code)) up = held;
    else if (DOWN.has(code)) down = held;
    else if (LEFT.has(code)) left = held;
    else if (RIGHT.has(code)) right = held;
  }

  window.addEventListener('keydown', (event) => {
    if (CONFIRM.has(event.code)) {
      if (!event.repeat) actions |= ACTION_CONFIRM;
    } else if (PAUSE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_PAUSE;
    } else if (DASH.has(event.code)) {
      if (!event.repeat) actions |= ACTION_DASH;
    } else if (event.code === 'Digit1') {
      if (!event.repeat) actions |= ACTION_PICK_1;
    } else if (event.code === 'Digit2') {
      if (!event.repeat) actions |= ACTION_PICK_2;
    } else if (event.code === 'Digit3') {
      if (!event.repeat) actions |= ACTION_PICK_3;
    } else if (UP.has(event.code) || DOWN.has(event.code) || LEFT.has(event.code) || RIGHT.has(event.code)) {
      setKey(event.code, true);
    } else return;
    event.preventDefault();
  });
  window.addEventListener('keyup', (event) => setKey(event.code, false));
  // A key released while the tab is hidden never sends keyup: let go of everything on blur.
  window.addEventListener('blur', () => {
    up = false;
    down = false;
    left = false;
    right = false;
    firing = false;
  });

  canvas.addEventListener('pointermove', (event) => {
    const rect = canvas.getBoundingClientRect();
    aim.x = event.clientX - rect.left;
    aim.y = event.clientY - rect.top;
  });
  canvas.addEventListener('pointerdown', (event) => {
    if (event.button === 2) {
      actions |= ACTION_DASH;
      return;
    }
    firing = true;
    actions |= ACTION_CONFIRM;
  });
  canvas.addEventListener('pointerup', (event) => {
    if (event.button === 0) firing = false;
  });
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());

  return {
    aim,
    /** Normalised move direction from the held keys: {x, y}, each -1, 0 or 1. */
    move() {
      const x = (right ? 1 : 0) - (left ? 1 : 0);
      const y = (down ? 1 : 0) - (up ? 1 : 0);
      if (x !== 0 && y !== 0) {
        const inv = 1 / Math.SQRT2;
        return { x: x * inv, y: y * inv };
      }
      return { x, y };
    },
    /** True while the mouse button (or Space) is held: the keeper keeps firing. */
    get firing() {
      return firing;
    },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}
