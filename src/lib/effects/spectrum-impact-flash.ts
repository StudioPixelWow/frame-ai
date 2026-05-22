/**
 * Spectrum Impact Flash — Fullscreen Cinematic Color Flash
 *
 * A premium RGB cinematic flash burst with holographic fullscreen impact,
 * chromatic aberration, RGB split, bloom, and lingering energy glow.
 *
 * Replaces all "Premium Slide" (החלקה פרימיום) transitions system-wide.
 * Separate system from Prismatic Flash Sweep — both coexist.
 */

export interface SpectrumImpactFlashOptions {
  /** Intensity level — default: "cinematic" */
  intensity?: "subtle" | "standard" | "cinematic";
  /** Coverage — default: "fullscreen" */
  coverage?: "fullscreen" | "contained";
  /** Color mode — default: "spectrum-prismatic" */
  colorMode?: "spectrum-prismatic" | "warm-spectrum" | "cool-spectrum" | "monochrome";
  /** Glow level — default: "high" */
  glowLevel?: "low" | "medium" | "high";
  /** Play sound signature — default: true */
  sound?: boolean;
  /** Duration in ms — default: 900 (range 600–1200) */
  durationMs?: number;
  /** Target container — default: document.body */
  container?: HTMLElement;
  /** Callback when flash completes */
  onComplete?: () => void;
}

// ─── Sound cache ──────────────────────────────────────────────────────────────

let _audioCache: HTMLAudioElement | null = null;

function getSpectrumImpactSound(): HTMLAudioElement {
  if (!_audioCache) {
    _audioCache = new Audio();
    // Deep cinematic impact + digital shimmer + bass hit
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const duration = 0.9;
    const sr = ctx.sampleRate;
    const buf = ctx.createBuffer(2, sr * duration, sr);

    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < d.length; i++) {
        const t = i / sr;
        const env = Math.exp(-t * 4) * 0.7;
        // Deep bass impact
        const bass = Math.sin(2 * Math.PI * 55 * t) * env * 0.5;
        // Sub-bass rumble
        const sub = Math.sin(2 * Math.PI * 30 * t) * Math.exp(-t * 3) * 0.3;
        // Digital shimmer (high freq layered sweep)
        const shimmer = Math.sin(2 * Math.PI * (3000 + t * 2000) * t) * Math.exp(-t * 6) * 0.08;
        // Energy whoosh
        const whoosh = (Math.random() * 2 - 1) * Math.exp(-t * 5) * 0.12;
        // Cinematic ring-out
        const ring = Math.sin(2 * Math.PI * 440 * t) * Math.exp(-t * 8) * 0.04;

        d[i] = bass + sub + shimmer + whoosh + ring;
      }
    }

    const src = ctx.createBufferSource();
    src.buffer = buf;
    const gain = ctx.createGain();
    gain.gain.value = 0.35;
    src.connect(gain).connect(ctx.destination);
    src.start();
  }
  return _audioCache;
}

// ─── Style getter for inline video preview overlays ───────────────────────────

export function getSpectrumImpactFlashStyle(progress: number): React.CSSProperties {
  // progress: 0 → 1 over the transition duration
  const bell = Math.sin(progress * Math.PI);
  const burst = Math.exp(-Math.pow((progress - 0.2) * 5, 2)); // gaussian burst at 20%
  const glow = Math.exp(-progress * 3);

  return {
    position: "absolute",
    inset: "-10%",
    zIndex: 21,
    pointerEvents: "none",
    background: `radial-gradient(ellipse 120% 120% at 50% 50%,
      rgba(255,255,255,${0.9 * burst}) 0%,
      rgba(0,255,255,${0.5 * bell}) 15%,
      rgba(80,120,255,${0.45 * bell}) 28%,
      rgba(180,60,255,${0.4 * bell}) 42%,
      rgba(255,60,200,${0.3 * bell}) 56%,
      rgba(255,100,60,${0.15 * bell}) 70%,
      transparent 85%)`,
    opacity: bell * 0.95,
    filter: `blur(${2 + glow * 8}px) brightness(${1 + burst * 2})`,
    mixBlendMode: "screen" as const,
    transform: `scale(${0.8 + bell * 0.4})`,
    transition: "none",
  };
}

// ─── Main trigger function ────────────────────────────────────────────────────

export function triggerSpectrumImpactFlash(options: SpectrumImpactFlashOptions = {}): void {
  if (typeof window === "undefined") return;

  const {
    intensity = "cinematic",
    coverage = "fullscreen",
    colorMode = "spectrum-prismatic",
    glowLevel = "high",
    sound = true,
    durationMs = 900,
    container = document.body,
    onComplete,
  } = options;

  // Clamp duration
  const dur = Math.max(600, Math.min(1200, durationMs));

  // Build overlay
  const overlay = document.createElement("div");
  overlay.className = "spectrum-impact-flash-overlay";
  overlay.style.setProperty("--sif-duration", `${dur}ms`);

  if (coverage === "contained") {
    overlay.style.position = "absolute";
  }

  // Intensity scaling
  const opacityScale = intensity === "subtle" ? 0.5 : intensity === "standard" ? 0.75 : 1;
  overlay.style.opacity = String(opacityScale);

  // Color mode filter
  if (colorMode === "warm-spectrum") {
    overlay.style.filter = "hue-rotate(-20deg) saturate(1.2)";
  } else if (colorMode === "cool-spectrum") {
    overlay.style.filter = "hue-rotate(20deg) saturate(1.1)";
  } else if (colorMode === "monochrome") {
    overlay.style.filter = "saturate(0.15) brightness(1.3)";
  }

  // Build layers
  const burst = document.createElement("div");
  burst.className = "spectrum-impact-flash-burst";

  const chromatic = document.createElement("div");
  chromatic.className = "spectrum-impact-flash-chromatic";

  const bloom = document.createElement("div");
  bloom.className = "spectrum-impact-flash-bloom";

  const rgbSplit = document.createElement("div");
  rgbSplit.className = "spectrum-impact-flash-rgb-split";

  overlay.appendChild(burst);
  overlay.appendChild(chromatic);
  overlay.appendChild(bloom);
  overlay.appendChild(rgbSplit);

  // Glow layer (optional based on glowLevel)
  if (glowLevel !== "low") {
    const glow = document.createElement("div");
    glow.className = "spectrum-impact-flash-glow";
    if (glowLevel === "medium") {
      glow.style.opacity = "0.5";
    }
    overlay.appendChild(glow);
  }

  container.appendChild(overlay);

  // Sound
  if (sound) {
    try {
      getSpectrumImpactSound();
    } catch {
      // Audio context may not be available
    }
  }

  // Cleanup
  const totalDur = dur * 1.6; // glow lingers
  setTimeout(() => {
    overlay.remove();
    onComplete?.();
  }, totalDur);
}
