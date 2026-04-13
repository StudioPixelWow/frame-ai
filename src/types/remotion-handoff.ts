/**
 * PixelFrameAI — Remotion Runtime Handoff Types
 *
 * Type contracts for the bridge between the project data model
 * (RenderPayload v2.2) and the Remotion composition layer.
 *
 * These types define exactly what the PixelFrameComposition receives
 * as props. The worker reads _remotion from the DB and passes it
 * verbatim (after videoUrl substitution).
 *
 * Rule: In Remotion, always use `fontSizePx` (not fontSizeCSS),
 * `radiusPx` (not radiusCSS), and `shadow.css` / `stroke.css` for
 * their CSS string values. The `_css.*` convenience helpers and any
 * `*CSS` fields are for the SPA preview only.
 */

// ── Clip specification ────────────────────────────────────────────────────

export interface ClipSpec {
  mode: "full" | "trimmed";
  startSec: number; // seek position in source file (seconds)
  endSec: number;   // stop position in source file (seconds)
  durSec: number;   // actual clip length = endSec - startSec
}

// ── Font resolution ───────────────────────────────────────────────────────

export interface ResolvedFont {
  id: string;             // font key, e.g. 'inter'
  name: string;           // display name, e.g. 'Inter'
  cssFamily: string;      // short family, e.g. 'Inter'
  fontFamilyCSS: string;  // full CSS stack, e.g. "'Inter','Helvetica Neue',sans-serif"
  fontWeight: number;     // resolved weight, e.g. 600
  isRTL: boolean;         // true for Hebrew, Arabic
  dir: "ltr" | "rtl";
  googleFontsUrl: string; // full Google Fonts URL for this weight
  remotionImport: string; // '@remotion/google-fonts/Inter'
  loadFontCall: string;   // 'loadFont({ weights: ["600"] })' (for codegen)
  fallbackStack: string;  // CSS fallback string
  weightSnapped: number;  // nearest supported Google Fonts weight
}

// ── Subtitle render spec (fully resolved at approval time) ────────────────

export interface SubtitleStroke {
  enabled: boolean;
  color: string;     // hex
  widthPx: number;   // 1–4
  css: string;       // full -webkit-text-stroke string
}

export interface SubtitleShadow {
  enabled: boolean;
  intensity: "soft" | "medium" | "hard";
  css: string;       // full text-shadow CSS value
  offsetX: number;
  offsetY: number;
  blur: number;
  color: string;
}

export interface SubtitleBackground {
  enabled: boolean;
  hex: string;        // e.g. '#040a14'
  rgba: string;       // e.g. 'rgba(4,10,20,0.820)'
  opacity: number;    // 0–1
  r: number;
  g: number;
  b: number;
  radiusCSS: string;  // for web previews: '5px'
  radiusPx: number;   // USE THIS in Remotion: 6
  blurPx: number;     // backdrop-filter blur (6)
}

/**
 * Complete subtitle render specification.
 *
 * Output of `buildSubtitleRenderSpec()` — called once at approval time
 * and stored in `_remotion.subtitle`. The composition uses it directly;
 * no re-resolution at render time.
 */
export interface SubtitleRenderSpec {
  // Font
  font: ResolvedFont;

  // Typography
  fontFamilyCSS: string;     // shortcut alias for font.fontFamilyCSS
  fontWeight: number;        // shortcut alias for font.fontWeight
  fontSizeKey: "sm" | "md" | "lg" | "xl";
  fontSizeCSS: string;       // CSS rem value — for web previews only
  fontSizePx: number;        // USE THIS in Remotion (28|36|46|58)
  lineHeight: number;        // 1.4–1.45
  textColor: string;         // hex, e.g. '#ffffff'
  highlightColor: string;    // hex, e.g. '#00b5fe'
  highlightStyle: "color" | "bg" | "scale" | "bold";
  dir: "ltr" | "rtl";

  // Text effects
  stroke: SubtitleStroke;
  shadow: SubtitleShadow;

  // Background pill
  background: SubtitleBackground;

  // Layout
  position: "top" | "center" | "bottom";
  positionCSS: string;       // CSS positioning — web previews only
  positionY: number;         // 0–1 fractional position — optional reference
  animation: "none" | "fade" | "pop" | "slide" | "word";
  lineBreak: "automatic" | "balanced" | "compact";
  emphasisLevel: "standard" | "high" | "low";

  // CSS helpers (web preview only — do NOT use in Remotion)
  _css?: { bubble: string; text: string };
}

// ── Render segment ────────────────────────────────────────────────────────

/**
 * A subtitle segment with clip-relative timestamps.
 *
 * `startMs` / `endMs` are relative to the start of the clip,
 * NOT the source file. The SubtitleLayer adds `clip.startSec`
 * to convert back to source time for frame alignment.
 */
export interface RenderSegment {
  id: string;            // stable identity for highlight tracking
  startMs: number;       // clip-relative (not source-relative)
  endMs: number;         // clip-relative
  text: string;          // final text (segEdits already merged)
  role: "hook" | "benefit" | "cta" | "general";
  speaker?: string;
  totalScore?: number;
  adjustedScore?: number;
  highlight: boolean;    // set by transcript editor highlight toggle
}

// ── Edit direction ────────────────────────────────────────────────────────

/**
 * Edit parameters stored in `_remotion.edit`.
 *
 * In Phase 6.7 baseline, most fields are not yet consumed by the
 * composition. They are stored and passed through so the composition
 * can read them once transition and overlay layers are implemented.
 */
export interface EditDirection {
  pacingStyle: "fast" | "medium" | "slow";
  editIntensity: number;   // 0–1
  transitionPreference: "cut" | "fade" | "zoom" | "whip";
  brollPreference: "minimal" | "moderate" | "heavy";
  subtitleEmphasisLevel: "low" | "standard" | "high";
  toneBias: string;
  hookStyle: string;
  ctaStyle: string;
  segmentPriorityBias: string;
}

// ── Font preload manifest ─────────────────────────────────────────────────

/**
 * Font preload entry carried in `_remotion.fontPreloads`.
 * Used by `loadFontsFromPayload()` in the Remotion bundle to load
 * Google Fonts inside a `delayRender` block before frames render.
 */
export interface FontPreload {
  family: string;            // e.g. 'Inter'
  weight: string;            // e.g. '600'
  googleFontsUrl: string;    // full Google Fonts CSS URL
  remotionImport: string;    // '@remotion/google-fonts/Inter'
  loadFontCall: string;      // "loadFont({ weights: ['600'] })"
  isRTL: boolean;
}

// ── Complete input props for the composition ──────────────────────────────

/**
 * The full props object that `PixelFrameComposition` receives.
 *
 * This is the content of `render_payload._remotion` from the DB,
 * with `videoUrl` substituted by the worker from a signed storage URL.
 */
export interface PixelFrameRemotionProps {
  // Source video
  videoUrl: string | null;   // null in DB → substituted by worker with signed URL

  // Clip range
  clip: ClipSpec;

  // Subtitle display
  subtitleMode: "automatic" | "manual" | "none";
  subtitle: SubtitleRenderSpec | null;    // null when subtitleMode === 'none'
  segments: RenderSegment[];

  // Output format
  format: "9:16" | "1:1" | "4:5" | "16:9";

  // Brand / preset
  preset: string;    // 'Pixel Premium' | 'Pixel Performance' | 'Pixel Social'

  // Edit direction (Phase 6+ consumption)
  edit?: EditDirection;

  // Font preloads
  fontPreloads?: FontPreload[];
}
