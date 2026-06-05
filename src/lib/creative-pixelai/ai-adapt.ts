"use client";

/**
 * Reusable AI adaptation — used by the Creative PixelAI page AND by content
 * tasks ("התאם גדלים" on an approved post task). Redesign mode: GPT Image 2
 * rebuilds the ad natively for the target format; the result is cover-composed
 * to the exact output size.
 */

import { FORMATS, type FormatId, loadImage, canvasToBlob } from "./adapter";

export async function aiAdaptImageToFormat(
  img: HTMLImageElement,
  formatId: FormatId,
  opts?: { quality?: "medium" | "high"; stylePrompt?: string },
): Promise<Blob> {
  const f = FORMATS.find((x) => x.id === formatId);
  if (!f) throw new Error("פורמט לא מוכר");

  // Downscale input to 1536 max — crisp enough for text, fast enough for serverless.
  const maxDim = 1536;
  const ds = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight));
  const c = document.createElement("canvas");
  c.width = Math.round(img.naturalWidth * ds);
  c.height = Math.round(img.naturalHeight * ds);
  const cx = c.getContext("2d");
  if (!cx) throw new Error("Canvas unavailable");
  cx.imageSmoothingQuality = "high";
  cx.drawImage(img, 0, 0, c.width, c.height);

  const res = await fetch("/api/creative-pixelai/generate-ai", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      imagePng: c.toDataURL("image/png"),
      format: formatId,
      mode: "redesign",
      quality: opts?.quality || "medium",
      prompt: opts?.stylePrompt || undefined,
    }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "היצירה נכשלה");

  const genImg = await loadImage(json.image);
  const fin = document.createElement("canvas");
  fin.width = f.width; fin.height = f.height;
  const fctx = fin.getContext("2d");
  if (!fctx) throw new Error("Canvas unavailable");
  fctx.imageSmoothingQuality = "high";
  const s = Math.max(f.width / genImg.naturalWidth, f.height / genImg.naturalHeight);
  const ox = (f.width - genImg.naturalWidth * s) / 2;
  const oy = (f.height - genImg.naturalHeight * s) / 2;
  fctx.drawImage(genImg, ox, oy, genImg.naturalWidth * s, genImg.naturalHeight * s);
  return canvasToBlob(fin, "image/png", 0.95);
}
