/**
 * Prismatic Flash Sweep — Official Motion Signature
 *
 * A premium RGB light sweep effect with holographic prismatic glow,
 * white-hot core, chromatic aberration, and cinematic motion.
 *
 * Replaces all "Cinematic Dissolve" transitions system-wide.
 */

export interface PrismaticFlashSweepOptions {
  /** Entry position — default: "bottom-corner" */
  position?: "bottom-corner" | "center" | "top-corner";
  /** Sweep angle in degrees — default: 45 */
  angle?: number;
  /** Size of the sweep — default: "large" */
  size?: "small" | "medium" | "large";
  /** Intensity level — default: "premium" */
  intensity?: "subtle" | "standard" | "premium";
  /** Color mode — default: "prismatic-rgb" */
  colorMode?: "prismatic-rgb" | "warm" | "cool" | "monochrome";
  /** Play sound signature — default: true */
  sound?: boolean;
  /** Duration in ms — default: 900 (range 700–1200) */
  durationMs?: number;
  /** Target container — default: document.body */
  container?: HTMLElement;
  /** Callback when sweep completes */
  onComplete?: () => void;
}

const SOUND_URL = "/sounds/prismatic-sweep.mp3";

let audioCache: HTMLAudioElement | null = null;

function getAudio(): HTMLAudioElement {
  if (!audioCache) {
    audioCache = new Audio(SOUND_URL);
    audioCache.volume = 0.3;
  }
  return audioCache;
}

function playSound(): void {
  try {
    const audio = getAudio();
    audio.currentTime = 0;
    audio.play().catch(() => {
      // Silent fail — user may not have interacted yet
    });
  } catch {
    // Audio not available
  }
}

/**
 * Trigger the Prismatic Flash Sweep effect.
 *
 * Usage:
 * ```ts
 * triggerPrismaticFlashSweep({
 *   position: "bottom-corner",
 *   angle: 45,
 *   size: "large",
 *   intensity: "premium",
 *   colorMode: "prismatic-rgb",
 *   sound: true
 * })
 * ```
 */
export function triggerPrismaticFlashSweep(options: PrismaticFlashSweepOptions = {}): void {
  const {
    position = "bottom-corner",
    angle = 45,
    size = "large",
    intensity = "premium",
    colorMode = "prismatic-rgb",
    sound = true,
    durationMs = 900,
    container,
    onComplete,
  } = options;

  // Clamp duration to valid range
  const duration = Math.max(700, Math.min(1200, durationMs));

  // Play sound signature
  if (sound) {
    playSound();
  }

  // Create overlay
  const overlay = document.createElement("div");
  overlay.className = "prismatic-flash-sweep-overlay";
  overlay.style.setProperty("--pfs-duration", `${duration}ms`);

  // Size multiplier
  const sizeMultiplier = size === "small" ? 0.6 : size === "medium" ? 0.8 : 1;

  // Intensity → opacity multiplier
  const intensityOpacity = intensity === "subtle" ? 0.5 : intensity === "standard" ? 0.75 : 1;

  // Color adjustments
  let beamGradient: string;
  switch (colorMode) {
    case "warm":
      beamGradient = `linear-gradient(90deg,
        transparent 0%,
        rgba(255,200,100,0.05) 10%,
        rgba(255,160,80,0.15) 20%,
        rgba(255,120,60,0.3) 30%,
        rgba(255,100,80,0.4) 40%,
        rgba(255,255,255,0.85) 48%,
        rgba(255,255,255,1) 50%,
        rgba(255,255,255,0.85) 52%,
        rgba(255,180,100,0.4) 60%,
        rgba(255,140,80,0.3) 70%,
        rgba(255,200,120,0.12) 80%,
        rgba(255,220,160,0.05) 90%,
        transparent 100%
      )`;
      break;
    case "cool":
      beamGradient = `linear-gradient(90deg,
        transparent 0%,
        rgba(0,200,255,0.05) 10%,
        rgba(0,150,255,0.15) 20%,
        rgba(60,100,255,0.3) 30%,
        rgba(100,80,255,0.4) 40%,
        rgba(255,255,255,0.85) 48%,
        rgba(255,255,255,1) 50%,
        rgba(255,255,255,0.85) 52%,
        rgba(100,140,255,0.4) 60%,
        rgba(60,120,255,0.3) 70%,
        rgba(0,180,255,0.12) 80%,
        rgba(0,220,255,0.05) 90%,
        transparent 100%
      )`;
      break;
    case "monochrome":
      beamGradient = `linear-gradient(90deg,
        transparent 0%,
        rgba(255,255,255,0.03) 15%,
        rgba(255,255,255,0.15) 30%,
        rgba(255,255,255,0.4) 42%,
        rgba(255,255,255,0.85) 48%,
        rgba(255,255,255,1) 50%,
        rgba(255,255,255,0.85) 52%,
        rgba(255,255,255,0.4) 58%,
        rgba(255,255,255,0.15) 70%,
        rgba(255,255,255,0.03) 85%,
        transparent 100%
      )`;
      break;
    default: // prismatic-rgb
      beamGradient = `linear-gradient(90deg,
        transparent 0%,
        rgba(0,255,255,0.05) 10%,
        rgba(0,200,255,0.15) 20%,
        rgba(100,120,255,0.3) 30%,
        rgba(180,140,255,0.4) 40%,
        rgba(255,255,255,0.85) 48%,
        rgba(255,255,255,1) 50%,
        rgba(255,255,255,0.85) 52%,
        rgba(255,140,220,0.4) 60%,
        rgba(255,100,180,0.3) 70%,
        rgba(255,160,80,0.12) 80%,
        rgba(255,200,100,0.05) 90%,
        transparent 100%
      )`;
  }

  // Build beam
  const beam = document.createElement("div");
  beam.className = "prismatic-flash-sweep-beam";
  beam.style.background = beamGradient;
  beam.style.opacity = String(intensityOpacity);
  beam.style.width = `${250 * sizeMultiplier}%`;
  beam.style.height = `${250 * sizeMultiplier}%`;

  // Build ambient glow
  const glow = document.createElement("div");
  glow.className = "prismatic-flash-sweep-glow";
  glow.style.opacity = String(intensityOpacity * 0.6);

  // Build bloom
  const bloom = document.createElement("div");
  bloom.className = "prismatic-flash-sweep-bloom";
  bloom.style.opacity = String(intensityOpacity * 0.8);
  bloom.style.width = `${120 * sizeMultiplier}px`;
  bloom.style.height = `${120 * sizeMultiplier}px`;

  // Position adjustments
  if (position === "center") {
    beam.style.transformOrigin = "center center";
  } else if (position === "top-corner") {
    beam.style.transformOrigin = "top right";
    beam.style.animationName = "prismatic-flash-sweep-top";
  }

  // Angle adjustment
  if (angle !== 45) {
    beam.style.setProperty("--pfs-angle", `${angle}deg`);
  }

  overlay.appendChild(glow);
  overlay.appendChild(beam);
  overlay.appendChild(bloom);

  const target = container || document.body;
  target.appendChild(overlay);

  // Auto-cleanup
  const cleanup = () => {
    overlay.remove();
    if (onComplete) onComplete();
  };

  setTimeout(cleanup, duration + 100);
}

/**
 * Prismatic Flash Sweep as an inline transition overlay (for video preview/render).
 * Returns CSS style object for a div overlay at a given progress (0–1).
 */
export function getPrismaticFlashSweepStyle(progress: number): React.CSSProperties {
  // Bell curve for intensity
  const bell = Math.sin(progress * Math.PI);
  const sweepPos = progress * 200 - 50; // -50% to 150%

  return {
    position: "absolute",
    inset: 0,
    zIndex: 21,
    pointerEvents: "none" as const,
    background: `
      linear-gradient(
        ${45}deg,
        transparent ${sweepPos - 30}%,
        rgba(0,255,255,0.05) ${sweepPos - 20}%,
        rgba(0,200,255,0.12) ${sweepPos - 12}%,
        rgba(100,120,255,0.25) ${sweepPos - 6}%,
        rgba(180,140,255,0.35) ${sweepPos - 3}%,
        rgba(255,255,255,${0.7 * bell}) ${sweepPos}%,
        rgba(255,140,220,0.35) ${sweepPos + 3}%,
        rgba(255,100,180,0.25) ${sweepPos + 6}%,
        rgba(255,160,80,0.1) ${sweepPos + 12}%,
        rgba(255,200,100,0.04) ${sweepPos + 20}%,
        transparent ${sweepPos + 30}%
      )
    `,
    opacity: bell * 0.95,
    filter: `blur(${2 + bell * 3}px)`,
    mixBlendMode: "screen" as const,
  };
}

export default triggerPrismaticFlashSweep;
