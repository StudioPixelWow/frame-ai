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
  /** Duration in ms — default: 2800 (range 2000–4000) */
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
  const burst = Math.exp(-Math.pow((progress - 0.15) * 4, 2)); // gaussian burst at 15%
  const glow = Math.exp(-progress * 2);
  // Secondary pulse for sustained color
  const pulse2 = Math.exp(-Math.pow((progress - 0.45) * 3, 2));

  return {
    position: "absolute",
    inset: "-20%",
    zIndex: 21,
    pointerEvents: "none",
    background: `radial-gradient(ellipse 140% 140% at 50% 50%,
      rgba(255,255,255,${0.95 * burst}) 0%,
      rgba(255,50,50,${0.7 * burst}) 8%,
      rgba(255,200,0,${0.6 * bell}) 16%,
      rgba(0,255,100,${0.55 * bell}) 24%,
      rgba(0,220,255,${0.55 * bell}) 32%,
      rgba(80,80,255,${0.5 * bell}) 40%,
      rgba(180,0,255,${0.45 * bell}) 50%,
      rgba(255,0,200,${0.4 * bell}) 60%,
      rgba(255,100,60,${0.25 * pulse2}) 72%,
      transparent 90%)`,
    opacity: Math.min(1, bell * 1.1),
    filter: `blur(${1 + glow * 6}px) brightness(${1 + burst * 2.5}) saturate(${1.2 + bell * 0.8})`,
    mixBlendMode: "screen" as const,
    transform: `scale(${0.7 + bell * 0.5})`,
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
    durationMs = 2800,
    container = document.body,
    onComplete,
  } = options;

  // Clamp duration — allow much longer flashes
  const dur = Math.max(2000, Math.min(4000, durationMs));

  // Build overlay
  const overlay = document.createElement("div");
  overlay.className = "spectrum-impact-flash-overlay";
  overlay.style.setProperty("--sif-duration", `${dur}ms`);

  if (coverage === "contained") {
    overlay.style.position = "absolute";
  } else {
    // Ensure true fullscreen coverage
    overlay.style.position = "fixed";
    overlay.style.inset = "0";
    overlay.style.width = "100vw";
    overlay.style.height = "100vh";
    overlay.style.zIndex = "999999";
  }

  // Intensity scaling
  const opacityScale = intensity === "subtle" ? 0.6 : intensity === "standard" ? 0.85 : 1;
  overlay.style.opacity = String(opacityScale);

  // Color mode filter
  if (colorMode === "warm-spectrum") {
    overlay.style.filter = "hue-rotate(-20deg) saturate(1.4)";
  } else if (colorMode === "cool-spectrum") {
    overlay.style.filter = "hue-rotate(20deg) saturate(1.3)";
  } else if (colorMode === "monochrome") {
    overlay.style.filter = "saturate(0.15) brightness(1.3)";
  }

  // Build layers — all core layers
  const burst = document.createElement("div");
  burst.className = "spectrum-impact-flash-burst";

  const chromatic = document.createElement("div");
  chromatic.className = "spectrum-impact-flash-chromatic";

  const bloom = document.createElement("div");
  bloom.className = "spectrum-impact-flash-bloom";

  const rgbSplit = document.createElement("div");
  rgbSplit.className = "spectrum-impact-flash-rgb-split";

  const rainbowSweep = document.createElement("div");
  rainbowSweep.className = "spectrum-impact-flash-rainbow-sweep";

  const rings = document.createElement("div");
  rings.className = "spectrum-impact-flash-rings";

  overlay.appendChild(burst);
  overlay.appendChild(chromatic);
  overlay.appendChild(bloom);
  overlay.appendChild(rgbSplit);
  overlay.appendChild(rainbowSweep);
  overlay.appendChild(rings);

  // Glow layer (optional based on glowLevel)
  if (glowLevel !== "low") {
    const glow = document.createElement("div");
    glow.className = "spectrum-impact-flash-glow";
    if (glowLevel === "medium") {
      glow.style.opacity = "0.6";
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

  // Cleanup — glow lingers 1.8x the main duration
  const totalDur = dur * 1.8;
  setTimeout(() => {
    overlay.remove();
    onComplete?.();
  }, totalDur);
}
