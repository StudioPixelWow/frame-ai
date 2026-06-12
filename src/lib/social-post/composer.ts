"use client";

/**
 * Social Post Composer — turns a bare AI visual into a FINISHED, publishable
 * social post: the image as a full-bleed background, a premium bottom scrim, a
 * 2-line RTL Hebrew promotional headline, a brand-colored CTA pill, and the
 * client logo — rendered on a real <canvas> so the export is final-quality.
 *
 * Soul (the image engine) can't render Hebrew text, so ALL text + logo are drawn
 * here on top — this is what makes the result look like a real agency post.
 */

export interface ComposeOptions {
  imageUrl: string;          // the AI visual (will be proxied for clean export)
  message: string;           // 1-2 line Hebrew promotional headline
  cta?: string;              // short Hebrew call to action
  logoUrl?: string;          // client logo
  brandColor?: string;       // client brand color (hex)
  format?: "portrait" | "square" | "story";
}

const SIZES = {
  portrait: { W: 1080, H: 1350 },
  square: { W: 1080, H: 1080 },
  story: { W: 1080, H: 1920 },
};

const proxy = (url: string) =>
  /^https?:\/\//i.test(url) && !url.startsWith(window.location.origin)
    ? `/api/proxy-image?url=${encodeURIComponent(url)}`
    : url;

function loadImg(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

// Ensure a premium Hebrew font is available to the canvas (falls back silently).
let fontReady: Promise<void> | null = null;
function ensureFont(): Promise<void> {
  if (fontReady) return fontReady;
  fontReady = (async () => {
    try {
      if (!document.getElementById("heebo-font-link")) {
        const link = document.createElement("link");
        link.id = "heebo-font-link";
        link.rel = "stylesheet";
        link.href = "https://fonts.googleapis.com/css2?family=Heebo:wght@500;700;900&display=swap";
        document.head.appendChild(link);
      }
      if ((document as any).fonts?.load) {
        await Promise.all([
          (document as any).fonts.load("900 64px Heebo"),
          (document as any).fonts.load("700 36px Heebo"),
        ]);
        await (document as any).fonts.ready;
      }
    } catch { /* system font fallback */ }
  })();
  return fontReady;
}

function shade(hex: string, pct: number): string {
  try {
    const n = parseInt(hex.replace("#", ""), 16);
    const amt = Math.round(2.55 * pct);
    const r = Math.max(0, Math.min(255, (n >> 16) + amt));
    const g = Math.max(0, Math.min(255, ((n >> 8) & 0xff) + amt));
    const b = Math.max(0, Math.min(255, (n & 0xff) + amt));
    return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
  } catch { return hex; }
}

// RTL word-wrap → lines that fit maxWidth at the given font.
function wrapRTL(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number): string[] {
  const words = (text || "").trim().split(/\s+/);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const test = cur ? `${cur} ${w}` : w;
    if (ctx.measureText(test).width > maxWidth && cur) {
      lines.push(cur);
      cur = w;
      if (lines.length === maxLines - 1) break;
    } else {
      cur = test;
    }
  }
  if (cur && lines.length < maxLines) lines.push(cur);
  // Append any leftover words to the last line (truncate with … if needed).
  return lines.slice(0, maxLines);
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Render a finished post onto a canvas. Returns nothing; read canvas after. */
export async function renderSocialPost(canvas: HTMLCanvasElement, opts: ComposeOptions): Promise<void> {
  const { W, H } = SIZES[opts.format || "portrait"];
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  await ensureFont();
  const brand = opts.brandColor || "#00B5FE";
  const font = `Heebo, -apple-system, "Segoe UI", Arial, sans-serif`;

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  // 1) Background image — cover.
  const img = await loadImg(proxy(opts.imageUrl));
  if (img) {
    const cover = Math.max(W / img.naturalWidth, H / img.naturalHeight);
    const bw = img.naturalWidth * cover, bh = img.naturalHeight * cover;
    ctx.drawImage(img, (W - bw) / 2, (H - bh) / 2, bw, bh);
  } else {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, shade(brand, 10)); g.addColorStop(1, shade(brand, -40));
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }

  // 2) Bottom scrim for text legibility.
  const scrim = ctx.createLinearGradient(0, H * 0.42, 0, H);
  scrim.addColorStop(0, "rgba(0,0,0,0)");
  scrim.addColorStop(0.55, "rgba(0,0,0,0.55)");
  scrim.addColorStop(1, "rgba(0,0,0,0.9)");
  ctx.fillStyle = scrim;
  ctx.fillRect(0, Math.round(H * 0.42), W, Math.round(H * 0.58));

  // RTL text setup.
  ctx.direction = "rtl";
  ctx.textAlign = "right";
  const margin = Math.round(W * 0.075);
  const rightX = W - margin;

  // 3) CTA pill (bottom-right), if present.
  let ctaTop = H - margin;
  if (opts.cta && opts.cta.trim()) {
    ctx.font = `700 38px ${font}`;
    const tw = ctx.measureText(opts.cta).width;
    const padX = 34, padY = 22;
    const pillW = tw + padX * 2, pillH = 38 + padY * 2;
    const pillX = rightX - pillW, pillY = H - margin - pillH;
    ctx.fillStyle = brand;
    roundRect(ctx, pillX, pillY, pillW, pillH, pillH / 2);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.textBaseline = "middle";
    ctx.fillText(opts.cta, rightX - padX, pillY + pillH / 2 + 2);
    ctaTop = pillY - 28;
  }

  // 4) Headline — 2 lines max, drawn upward from above the CTA.
  ctx.textBaseline = "alphabetic";
  let fontSize = 70;
  let lines: string[] = [];
  const maxTextW = W - margin * 2;
  for (; fontSize >= 44; fontSize -= 4) {
    ctx.font = `900 ${fontSize}px ${font}`;
    lines = wrapRTL(ctx, opts.message || "", maxTextW, 2);
    const fits = lines.every((l) => ctx.measureText(l).width <= maxTextW);
    if (fits && lines.length <= 2) break;
  }
  const lineH = Math.round(fontSize * 1.22);
  ctx.font = `900 ${fontSize}px ${font}`;
  ctx.shadowColor = "rgba(0,0,0,0.55)";
  ctx.shadowBlur = 14;
  ctx.shadowOffsetY = 2;
  ctx.fillStyle = "#ffffff";
  let y = ctaTop - (lines.length - 1) * lineH;
  for (const line of lines) {
    ctx.fillText(line, rightX, y);
    y += lineH;
  }
  ctx.shadowColor = "transparent"; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;

  // 5) Brand accent bar above the headline.
  const barY = (ctaTop - (lines.length - 1) * lineH) - fontSize - 26;
  ctx.fillStyle = brand;
  roundRect(ctx, rightX - 84, barY, 84, 9, 4.5);
  ctx.fill();

  // 6) Logo — top-right, contained on a soft rounded white chip.
  if (opts.logoUrl) {
    const logo = await loadImg(proxy(opts.logoUrl));
    if (logo) {
      const box = 150, pad = 18, chip = box + pad * 2;
      const cx = W - margin - chip, cy = margin;
      ctx.save();
      ctx.shadowColor = "rgba(0,0,0,0.25)"; ctx.shadowBlur = 18; ctx.shadowOffsetY = 4;
      ctx.fillStyle = "rgba(255,255,255,0.94)";
      roundRect(ctx, cx, cy, chip, chip, 26);
      ctx.fill();
      ctx.restore();
      const r = Math.min((box) / logo.naturalWidth, (box) / logo.naturalHeight);
      const lw = logo.naturalWidth * r, lh = logo.naturalHeight * r;
      ctx.drawImage(logo, cx + pad + (box - lw) / 2, cy + pad + (box - lh) / 2, lw, lh);
    }
  }
}

/** Compose a finished post and return a PNG data URL. */
export async function composeSocialPost(opts: ComposeOptions): Promise<string> {
  const canvas = document.createElement("canvas");
  await renderSocialPost(canvas, opts);
  return canvas.toDataURL("image/png");
}
