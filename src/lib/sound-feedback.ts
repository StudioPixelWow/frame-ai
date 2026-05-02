/**
 * Sound Feedback Engine — Web Audio API micro-sounds
 * Zero dependencies, tiny footprint, respects mute toggle.
 *
 * Usage:
 *   import { sound } from '@/lib/sound-feedback';
 *   sound.click();
 *   sound.success();
 *   sound.error();
 *   sound.toggleMute();
 */

let audioCtx: AudioContext | null = null;
let muted = false;

// Lazy-init AudioContext (must be triggered by user gesture)
function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!audioCtx) {
    try {
      audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    } catch {
      return null;
    }
  }
  return audioCtx;
}

function playTone(
  frequency: number,
  duration: number,
  type: OscillatorType = "sine",
  volume = 0.08,
  ramp?: { freq: number; time: number }
) {
  if (muted) return;
  const ctx = getCtx();
  if (!ctx) return;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(frequency, ctx.currentTime);

  if (ramp) {
    osc.frequency.linearRampToValueAtTime(ramp.freq, ctx.currentTime + ramp.time);
  }

  gain.gain.setValueAtTime(volume, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + duration);
}

export const sound = {
  /** Subtle click — button press, selection */
  click() {
    playTone(800, 0.06, "sine", 0.04);
  },

  /** Rising chime — success, save, completion */
  success() {
    playTone(523, 0.12, "sine", 0.06); // C5
    setTimeout(() => playTone(659, 0.12, "sine", 0.06), 80); // E5
    setTimeout(() => playTone(784, 0.18, "sine", 0.07), 160); // G5
  },

  /** Short descending — error, validation fail */
  error() {
    playTone(400, 0.15, "square", 0.04, { freq: 250, time: 0.12 });
  },

  /** Soft pop — notification, toast */
  pop() {
    playTone(600, 0.08, "sine", 0.05, { freq: 900, time: 0.04 });
  },

  /** Whoosh — navigation, transition */
  whoosh() {
    playTone(200, 0.2, "sine", 0.03, { freq: 800, time: 0.15 });
  },

  /** AI sparkle — AI action triggered */
  aiSparkle() {
    playTone(880, 0.1, "sine", 0.04);
    setTimeout(() => playTone(1100, 0.1, "sine", 0.04), 60);
    setTimeout(() => playTone(1320, 0.15, "sine", 0.05), 120);
  },

  /** Toggle mute on/off */
  toggleMute() {
    muted = !muted;
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("frame-sound-muted", muted ? "1" : "0");
      } catch {
        /* ignore */
      }
    }
    return muted;
  },

  /** Check if muted */
  isMuted() {
    return muted;
  },

  /** Init from stored preference */
  init() {
    if (typeof window === "undefined") return;
    try {
      muted = localStorage.getItem("frame-sound-muted") === "1";
    } catch {
      /* ignore */
    }
  },
};
