// Sound only: every effect and the ambient music are synthesised with WebAudio, so the
// game ships no audio files. The engine is silent until the player first interacts (the
// browser only lets sound start after a gesture); screenshot scenes never start it.

const MUSIC_NOTES = [220.0, 261.63, 329.63, 392.0, 329.63, 261.63, 196.0, 246.94];
const MUSIC_STEP = 0.42;

export function createAudio() {
  let context = null;
  let master = null;
  let musicTimer = 0;
  let musicIndex = 0;
  let musicOn = false;

  function ensure() {
    if (context) return true;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return false;
      context = new AudioContext();
      master = context.createGain();
      master.gain.value = 0.35;
      master.connect(context.destination);
    } catch {
      return false;
    }
    return true;
  }

  /** Call from any user gesture: unlocks sound and starts the quiet music. */
  function unlock() {
    if (!ensure()) return;
    if (context.state === 'suspended') context.resume().catch(() => {});
    if (!musicOn) {
      musicOn = true;
      musicTimer = 0;
    }
  }

  function tone(freq, duration, type, volume, slideTo) {
    if (!context || context.state !== 'running') return;
    try {
      const now = context.currentTime;
      const osc = context.createOscillator();
      const gain = context.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, now);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), now + duration);
      gain.gain.setValueAtTime(volume, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
      osc.connect(gain);
      gain.connect(master);
      osc.start(now);
      osc.stop(now + duration + 0.02);
    } catch {
      // Sound is garnish: never let it break the game.
    }
  }

  function noise(duration, volume, lowpass) {
    if (!context || context.state !== 'running') return;
    try {
      const now = context.currentTime;
      const length = Math.max(1, Math.floor(context.sampleRate * duration));
      const buffer = context.createBuffer(1, length, context.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
      const source = context.createBufferSource();
      source.buffer = buffer;
      const filter = context.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = lowpass;
      const gain = context.createGain();
      gain.gain.setValueAtTime(volume, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
      source.connect(filter);
      filter.connect(gain);
      gain.connect(master);
      source.start(now);
    } catch {
      // Sound is garnish: never let it break the game.
    }
  }

  return {
    unlock,
    /** True once the audio context exists (screenshot scenes skip sound entirely). */
    get ready() {
      return context !== null;
    },
    shoot() {
      tone(880, 0.09, 'square', 0.08, 320);
    },
    hit() {
      noise(0.12, 0.16, 1400);
      tone(180, 0.1, 'sawtooth', 0.1, 60);
    },
    gloomDie() {
      tone(520, 0.16, 'triangle', 0.12, 140);
    },
    lanternHurt() {
      tone(140, 0.35, 'sawtooth', 0.16, 55);
      noise(0.25, 0.12, 700);
    },
    ember() {
      tone(1320, 0.12, 'sine', 0.1, 1760);
    },
    heart() {
      tone(523.25, 0.14, 'sine', 0.12);
      tone(783.99, 0.22, 'sine', 0.1);
    },
    upgrade() {
      tone(392, 0.12, 'triangle', 0.12);
      tone(523.25, 0.12, 'triangle', 0.12);
      tone(659.25, 0.24, 'triangle', 0.12);
    },
    waveHorn() {
      tone(196, 0.5, 'triangle', 0.14, 392);
      tone(294, 0.5, 'triangle', 0.08, 392);
    },
    bossRoar() {
      noise(0.7, 0.22, 500);
      tone(90, 0.7, 'sawtooth', 0.14, 45);
    },
    win() {
      [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
        setTimeout(() => tone(freq, 0.3, 'triangle', 0.12), i * 140);
      });
    },
    lose() {
      [392, 329.63, 261.63, 196].forEach((freq, i) => {
        setTimeout(() => tone(freq, 0.4, 'triangle', 0.1), i * 180);
      });
    },
    /** A slow, quiet arpeggio under the game; called every frame with the step time. */
    music(dt) {
      if (!musicOn || !context || context.state !== 'running') return;
      musicTimer -= dt;
      if (musicTimer > 0) return;
      musicTimer += MUSIC_STEP;
      const freq = MUSIC_NOTES[musicIndex % MUSIC_NOTES.length];
      musicIndex += 1;
      tone(freq, MUSIC_STEP * 1.8, 'sine', 0.045);
      if (musicIndex % 4 === 1) tone(freq / 2, MUSIC_STEP * 3.5, 'sine', 0.05);
    },
  };
}
