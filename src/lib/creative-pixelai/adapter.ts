"use client";

/**
 * Creative PixelAI — adaptation engine.
 *
 * IRON RULE: the original creative is a LOCKED, pixel-perfect layer.
 * We never redraw, stretch, OCR-rebuild or AI-generate it. The engine only:
 *   1. renders a background (blur / color / gradient / custom) on the output canvas
 *   2. draws the ORIGINAL image uniformly scaled (same ratio, never distorted)
 *   3. applies optional shadow / rounded corners around it
 *
 * All rendering happens on a full-resolution <canvas> (e.g. 1080x1920), so the
 * exported PNG/JPG is final-quality — no server-side image library needed.
 */

export type FormatId = "story" | "feed_4_5" | "square";
export type ScaleMode = "auto" | "fit" | "premium_center" | "fill_safe" | "top_focus" | "bottom_focus" | "manual";
export type BackgroundType = "blurred" | "dominant_color" | "dark_gradient" | "light_gradient" | "brand_color" | "custom_image";

export interface FormatSpec {
  id: FormatId;
  label: string;
  width: number;
  height: number;
  safe: { top: number; bottom: number; sides: number };
}

export const FORMATS: FormatSpec[] = [
  { id: "story", label: "Story / Reels · 1080×1920", width: 1080, height: 1920, safe: { top: 180, bottom: 260, sides: 60 } },
  { id: "feed_4_5", label: "Feed 4:5 · 1080×1350", width: 1080, height: 1350, safe: { top: 80, bottom: 120, sides: 60 } },
  { id: "square", label: "Square · 1080×1080", width: 1080, height: 1080, safe: { top: 60, bottom: 60, sides: 60 } },
];

export interface AdaptationOptions {
  format: FormatSpec;
  scaleMode: ScaleMode;
  background: BackgroundType;
  brandColor?: string;          // for brand_color
  customBgImage?: HTMLImageElement | null; // for custom_image
  padding: number;              // extra padding (px at output scale)
  blurAmount: number;           // px, for blurred background
  brightness: number;           // 0.4–1.2, background brightness
  verticalOffset: number;       // -1..1 manual vertical nudge (fraction of free space)
  manualScale: number;          // 0.5..1.5 multiplier on computed scale (manual mode)
  shadow: boolean;
  roundedCorners: boolean;
  dominantColors?: string[];    // pre-extracted (from analysis or local)
  riskLevel?: "low" | "medium" | "high";
}

export interface ComputedLayout {
  scale: number;
  drawW: number;
  drawH: number;
  x: number;
  y: number;
  cropped: boolean;             // true only in fill_safe when output area < image area
}

/* ── Dominant color extraction (local, no AI) ───────────────────────────── */
export function extractDominantColors(img: HTMLImageElement, count = 3): string[] {
  try {
    const c = document.createElement("canvas");
    const size = 40;
    c.width = size; c.height = size;
    const ctx = c.getContext("2d");
    if (!ctx) return ["#222222"];
    ctx.drawImage(img, 0, 0, size, size);
    const data = ctx.getImageData(0, 0, size, size).data;
    const buckets = new Map<string, { r: number; g: number; b: number; n: number }>();
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
      if (a < 128) continue;
      const key = `${r >> 5}-${g >> 5}-${b >> 5}`;
      const e = buckets.get(key) || { r: 0, g: 0, b: 0, n: 0 };
      e.r += r; e.g += g; e.b += b; e.n++;
      buckets.set(key, e);
    }
    const sorted = [...buckets.values()].sort((a, b) => b.n - a.n).slice(0, count);
    const hex = (v: number) => Math.round(v).toString(16).padStart(2, "0");
    return sorted.map((e) => `#${hex(e.r / e.n)}${hex(e.g / e.n)}${hex(e.b / e.n)}`);
  } catch {
    return ["#222222"];
  }
}

/* ── Layout computation ─────────────────────────────────────────────────── */
export function computeLayout(
  imgW: number, imgH: number, opt: AdaptationOptions,
): ComputedLayout {
  const { format, padding } = opt;
  const safe = format.safe;
  let mode = opt.scaleMode;

  // Auto: pick by risk — high risk ⇒ always full fit with generous padding.
  if (mode === "auto") {
    mode = opt.riskLevel === "high" ? "fit" : "premium_center";
  }

  const innerW = format.width - safe.sides * 2 - padding * 2;
  const innerH = format.height - safe.top - safe.bottom - padding * 2;

  // Base FIT scale — the whole creative always visible inside safe area.
  const fitScale = Math.min(innerW / imgW, innerH / imgH);

  let scale = fitScale;
  let cropped = false;

  if (mode === "premium_center") {
    // Slightly larger presence but still fully visible (clamped to fit).
    scale = Math.min(fitScale * 1.0, fitScale); // identical to fit by design — premium look comes from bg
  } else if (mode === "fill_safe") {
    // May scale up to fill more of the frame; the original is NEVER cropped at
    // the canvas edge beyond the safe area, and callers must downgrade to fit
    // when AI flags important content near edges (riskLevel high).
    const fillScale = Math.min(
      (format.width - padding * 2) / imgW,
      (format.height - padding * 2) / imgH,
    );
    scale = opt.riskLevel === "high" ? fitScale : Math.min(fillScale, fitScale * 1.35);
    cropped = scale * imgH > innerH || scale * imgW > innerW;
  }

  if (mode === "manual") {
    scale = fitScale * (opt.manualScale || 1);
  }

  const drawW = imgW * scale;
  const drawH = imgH * scale;

  // Horizontal: always centered.
  const x = (format.width - drawW) / 2;

  // Vertical placement.
  const freeTop = safe.top + padding;
  const freeBottom = format.height - safe.bottom - padding;
  const freeSpace = (freeBottom - freeTop) - drawH;
  let y: number;
  if (mode === "top_focus") y = freeTop;
  else if (mode === "bottom_focus") y = freeBottom - drawH;
  else y = freeTop + freeSpace / 2;

  // Manual vertical nudge (-1 top … +1 bottom) within free space.
  if (opt.verticalOffset) {
    y += (opt.verticalOffset * Math.max(0, freeSpace)) / 2;
    y = Math.max(freeTop, Math.min(freeBottom - drawH, y));
  }

  return { scale, drawW, drawH, x, y, cropped };
}

/* ── Background renderers ───────────────────────────────────────────────── */
function drawBackground(ctx: CanvasRenderingContext2D, img: HTMLImageElement, opt: AdaptationOptions) {
  const { width: W, height: H } = opt.format;

  if (opt.background === "blurred") {
    // Cover-scale the ORIGINAL image, blur + brightness — classic premium look.
    const cover = Math.max(W / img.naturalWidth, H / img.naturalHeight) * 1.1;
    const bw = img.naturalWidth * cover, bh = img.naturalHeight * cover;
    ctx.save();
    ctx.filter = `blur(${opt.blurAmount}px) brightness(${opt.brightness})`;
    ctx.drawImage(img, (W - bw) / 2, (H - bh) / 2, bw, bh);
    ctx.restore();
    // gentle dark overlay for contrast
    ctx.fillStyle = "rgba(0,0,0,0.12)";
    ctx.fillRect(0, 0, W, H);
    return;
  }

  if (opt.background === "dominant_color") {
    const cols = opt.dominantColors && opt.dominantColors.length > 0 ? opt.dominantColors : extractDominantColors(img, 2);
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, cols[0]);
    g.addColorStop(1, cols[1] || cols[0]);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = `rgba(0,0,0,${1 - Math.min(1, opt.brightness)})`;
    ctx.fillRect(0, 0, W, H);
    return;
  }

  if (opt.background === "dark_gradient") {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#171a21");
    g.addColorStop(0.55, "#0e1116");
    g.addColorStop(1, "#05070a");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    return;
  }

  if (opt.background === "light_gradient") {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#ffffff");
    g.addColorStop(0.6, "#eef2f7");
    g.addColorStop(1, "#dde5ee");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    return;
  }

  if (opt.background === "brand_color") {
    const base = opt.brandColor || "#00B5FE";
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, base);
    g.addColorStop(1, shadeColor(base, -25));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    return;
  }

  if (opt.background === "custom_image" && opt.customBgImage) {
    const bg = opt.customBgImage;
    const cover = Math.max(W / bg.naturalWidth, H / bg.naturalHeight);
    const bw = bg.naturalWidth * cover, bh = bg.naturalHeight * cover;
    ctx.save();
    ctx.filter = `brightness(${opt.brightness})`;
    ctx.drawImage(bg, (W - bw) / 2, (H - bh) / 2, bw, bh);
    ctx.restore();
    return;
  }

  // fallback
  ctx.fillStyle = "#111418";
  ctx.fillRect(0, 0, W, H);
}

function shadeColor(hex: string, percent: number): string {
  const n = parseInt(hex.replace("#", ""), 16);
  const amt = Math.round(2.55 * percent);
  const r = Math.max(0, Math.min(255, (n >> 16) + amt));
  const g = Math.max(0, Math.min(255, ((n >> 8) & 0xff) + amt));
  const b = Math.max(0, Math.min(255, (n & 0xff) + amt));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

/* ── Main render ────────────────────────────────────────────────────────── */
export function renderAdaptation(
  canvas: HTMLCanvasElement,
  img: HTMLImageElement,
  opt: AdaptationOptions,
): ComputedLayout {
  const { width: W, height: H } = opt.format;
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  // 1) background
  drawBackground(ctx, img, opt);

  // 2) layout for the LOCKED original layer
  const layout = computeLayout(img.naturalWidth, img.naturalHeight, opt);

  // 3) shadow
  ctx.save();
  if (opt.shadow) {
    ctx.shadowColor = "rgba(0,0,0,0.45)";
    ctx.shadowBlur = Math.round(W * 0.035);
    ctx.shadowOffsetY = Math.round(W * 0.012);
  }

  // 4) rounded-corner clip (clips the drawing region, not the pixels' content ratio)
  if (opt.roundedCorners) {
    const r = Math.round(Math.min(layout.drawW, layout.drawH) * 0.035);
    roundRectPath(ctx, layout.x, layout.y, layout.drawW, layout.drawH, r);
    // draw shadow rect first (shadow needs a fill), then clip+draw image
    if (opt.shadow) { ctx.fillStyle = "rgba(0,0,0,0.001)"; ctx.fill(); }
    ctx.clip();
  }

  // 5) the ORIGINAL creative — uniform scale only (drawW/drawH keep exact ratio)
  ctx.drawImage(img, layout.x, layout.y, layout.drawW, layout.drawH);
  ctx.restore();

  return layout;
}

function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/* ── Validation ─────────────────────────────────────────────────────────── */
export function validateAdaptation(
  imgW: number, imgH: number, layout: ComputedLayout, opt: AdaptationOptions,
): { ok: boolean; problems: string[] } {
  const problems: string[] = [];
  // Aspect ratio preserved? (uniform scale check)
  const ratioOriginal = imgW / imgH;
  const ratioDrawn = layout.drawW / layout.drawH;
  if (Math.abs(ratioOriginal - ratioDrawn) > 0.001) problems.push("יחס התמונה השתנה — חל איסור על מתיחה");
  // Output dimensions correct?
  // (canvas size is set from format inside renderAdaptation — verified by caller)
  // No crop in fit modes:
  const fitModes: ScaleMode[] = ["fit", "premium_center", "auto", "top_focus", "bottom_focus"];
  if (fitModes.includes(opt.scaleMode) && layout.cropped) problems.push("נחתך תוכן במצב Fit — אסור");
  return { ok: problems.length === 0, problems };
}

/* ── Export helpers ─────────────────────────────────────────────────────── */
export function canvasToBlob(canvas: HTMLCanvasElement, type: "image/png" | "image/jpeg", quality = 0.95): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob failed"))), type, quality);
  });
}

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("טעינת התמונה נכשלה"));
    img.src = src;
  });
}
