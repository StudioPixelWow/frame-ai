"use client";

export const dynamic = "force-dynamic";

/**
 * Creative PixelAI — adapt an existing creative (usually square) to ad formats
 * (Story 1080×1920, Feed 4:5 1080×1350, Square 1080×1080) WITHOUT touching the
 * original pixels: no redraw, no text changes, no stretching, no AI generation.
 * OpenAI is used for analysis/decisions only; execution is pure canvas.
 */

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import JSZip from "jszip";
import { useClients } from "@/lib/api/use-entity";
import { useToast } from "@/components/ui/toast";
import {
  FORMATS, type FormatId, type FormatSpec, type ScaleMode, type BackgroundType, type AdaptationOptions,
  renderAdaptation, validateAdaptation, extractDominantColors, canvasToBlob, loadImage,
} from "@/lib/creative-pixelai/adapter";

const BRAND = "#00B5FE";
const MAX_FILE_MB = 25;

function roleHeaders(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const h: Record<string, string> = {};
  const role = localStorage.getItem("frameai_role"); if (role) h["x-app-role"] = role;
  const uid = localStorage.getItem("frameai_user_id"); if (uid) h["x-app-user-id"] = uid;
  const eid = localStorage.getItem("frameai_employee_id"); if (eid) h["x-app-employee-id"] = eid;
  return h;
}

/** Upload a blob through the system's existing signed-URL pipeline. */
async function uploadBlob(blob: Blob, path: string, contentType: string): Promise<string> {
  const init = await fetch("/api/upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fileName: path, contentType, fileSize: blob.size }),
  });
  if (!init.ok) throw new Error("קבלת כתובת העלאה נכשלה");
  const { uploadUrl, publicUrl } = await init.json();
  if (!uploadUrl) throw new Error("שרת לא החזיר כתובת העלאה");
  const put = await fetch(uploadUrl, { method: "PUT", headers: { "Content-Type": contentType }, body: blob });
  if (!put.ok) throw new Error("ההעלאה לאחסון נכשלה");
  return publicUrl as string;
}

/** Downscaled JPEG data-URL for the OpenAI vision call (analysis only). */
function toAnalysisDataUrl(img: HTMLImageElement, maxDim = 1024): string {
  const scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight));
  const c = document.createElement("canvas");
  c.width = Math.round(img.naturalWidth * scale);
  c.height = Math.round(img.naturalHeight * scale);
  c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", 0.85);
}

/** Parse a fetch Response safely — surfaces non-JSON platform errors (e.g. a
 *  413 "Request Entity Too Large" returned as plain text) as a clean message
 *  instead of crashing on res.json() with "Unexpected token 'R'". */
async function parseResponse(res: Response): Promise<any> {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    if (res.status === 413 || /too large|request entity|entity too/i.test(text)) {
      throw new Error("הקובץ גדול מדי לשרת. נסה תמונה קטנה יותר או הקטן את הרזולוציה (עד ~4MB).");
    }
    throw new Error(text ? text.slice(0, 160) : `שגיאת רשת (${res.status})`);
  }
}

const BG_OPTIONS: { id: BackgroundType; label: string }[] = [
  { id: "blurred", label: "תמונה מטושטשת" },
  { id: "dominant_color", label: "צבע דומיננטי" },
  { id: "dark_gradient", label: "גרדיאנט כהה" },
  { id: "light_gradient", label: "גרדיאנט בהיר" },
  { id: "brand_color", label: "צבע מותג" },
  { id: "custom_image", label: "רקע מותאם (העלאה)" },
];

const MODE_OPTIONS: { id: ScaleMode; label: string; desc: string }[] = [
  { id: "auto", label: "Auto", desc: "לפי המלצת ה-AI" },
  { id: "fit", label: "Fit Full Creative", desc: "כל הקריאייטיב נראה, אפס חיתוך" },
  { id: "premium_center", label: "Premium Center", desc: "ממורכז עם נוכחות פרימיום" },
  { id: "fill_safe", label: "Fill Safe", desc: "ממלא יותר — רק אם בטוח" },
  { id: "top_focus", label: "Top Focus", desc: "מוצמד לחלק העליון" },
  { id: "bottom_focus", label: "Bottom Focus", desc: "מוצמד לחלק התחתון" },
  { id: "manual", label: "Manual", desc: "שליטה ידנית בגודל ומיקום" },
];

interface HistoryRow {
  id: string;
  original_file_name: string | null;
  selected_formats: string[];
  status: string;
  created_at: string;
  outputs: { id: string; output_format: string; output_asset_url: string }[];
}

export default function CreativePixelAIPage() {
  const toast = useToast();
  const { data: clients } = useClients();

  /* ── Source creative ── */
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [fileName, setFileName] = useState("");
  const [mimeType, setMimeType] = useState("image/png");
  const [originalBlob, setOriginalBlob] = useState<Blob | null>(null);
  const [dragging, setDragging] = useState(false);

  /* ── Options ── */
  const [selectedFormats, setSelectedFormats] = useState<FormatId[]>(["story", "feed_4_5", "square"]);
  const [scaleMode, setScaleMode] = useState<ScaleMode>("auto");
  const [background, setBackground] = useState<BackgroundType>("blurred");
  const [brandColor, setBrandColor] = useState(BRAND);
  const [customBg, setCustomBg] = useState<HTMLImageElement | null>(null);
  const [padding, setPadding] = useState(80);
  const [blurAmount, setBlurAmount] = useState(45);
  const [brightness, setBrightness] = useState(0.75);
  const [verticalOffset, setVerticalOffset] = useState(0);
  const [manualScale, setManualScale] = useState(1);
  const [shadow, setShadow] = useState(true);
  const [rounded, setRounded] = useState(true);

  /* ── AI analysis ── */
  const [analysis, setAnalysis] = useState<any>(null);
  const [analyzing, setAnalyzing] = useState(false);

  /* ── Preview / export / save ── */
  const [activeFormat, setActiveFormat] = useState<FormatId>("story");
  const [showBefore, setShowBefore] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveClientId, setSaveClientId] = useState("");
  const canvasRefs = useRef<Record<string, HTMLCanvasElement | null>>({});
  const [renderTick, setRenderTick] = useState(0);

  /* ── History ── */
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  /* ── AI refine-by-note (iterative feedback loop) ── */
  const [refineNote, setRefineNote] = useState("");
  const [refining, setRefining] = useState(false);
  const [refineLog, setRefineLog] = useState<{ note: string; explanation: string }[]>([]);

  /* ── Engine: clean canvas vs AI background generation (outpainting) ── */
  const [engine, setEngine] = useState<"canvas" | "ai">("ai");
  const [aiMode, setAiMode] = useState<"redesign" | "outpaint">("redesign");
  const [aiResults, setAiResults] = useState<Record<string, string>>({});       // formatId → dataURL
  const [aiGenerating, setAiGenerating] = useState<string | null>(null);        // formatId in progress
  const [aiStylePrompt, setAiStylePrompt] = useState("");
  const [aiHighQuality, setAiHighQuality] = useState(false);
  const [aiTextWarn, setAiTextWarn] = useState<Record<string, string[]>>({}); // formatId → missing/changed text lines
  const [approvedFormats, setApprovedFormats] = useState<Record<string, boolean>>({}); // formatId → locked/approved
  const [cardNote, setCardNote] = useState<Record<string, string>>({}); // formatId → per-version fix note
  const [fixingFormat, setFixingFormat] = useState<string | null>(null);
  const [manualTexts, setManualTexts] = useState(""); // user-confirmed exact source text — overrides OCR
  const [detectedTexts, setDetectedTexts] = useState(""); // last auto-detected original (for the "fill from detection" button)
  const [showTextEditor, setShowTextEditor] = useState(false);

  /* ── Mode: single image vs carousel (up to 10 → each square→4:5) ── */
  const [pageMode, setPageMode] = useState<"single" | "carousel">("single");
  type CarouselItem = { id: string; name: string; src: string; img: HTMLImageElement; out: string | null };
  const [carItems, setCarItems] = useState<CarouselItem[]>([]);
  const [carBusy, setCarBusy] = useState(false);
  const [carProgress, setCarProgress] = useState<{ done: number; total: number } | null>(null);
  const CAROUSEL_MAX = 10;

  const addCarouselFiles = useCallback(async (files: FileList | File[]) => {
    const arr = Array.from(files).filter((f) => /^image\/(png|jpe?g|webp)$/.test(f.type));
    if (arr.length === 0) return;
    setCarItems((prev) => {
      const room = CAROUSEL_MAX - prev.length;
      if (room <= 0) { toast(`אפשר עד ${CAROUSEL_MAX} תמונות בקרוסלה`, "error"); return prev; }
      return prev; // actual append happens after images load below
    });
    const loaded: CarouselItem[] = [];
    for (const f of arr) {
      try {
        const url = URL.createObjectURL(f);
        const image = await loadImage(url);
        loaded.push({ id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, name: f.name, src: url, img: image, out: null });
      } catch { /* skip bad file */ }
    }
    setCarItems((prev) => [...prev, ...loaded].slice(0, CAROUSEL_MAX));
  }, [toast]);

  const removeCarItem = (id: string) => setCarItems((prev) => prev.filter((it) => it.id !== id));

  // Convert any image to 4:5 (1080×1350) — blurred cover background + full image
  // contained on top so NO information is ever cropped.
  const convertTo45 = (image: HTMLImageElement): string => {
    const W = 1080, H = 1350;
    const c = document.createElement("canvas"); c.width = W; c.height = H;
    const ctx = c.getContext("2d")!;
    const iw = image.naturalWidth || image.width, ih = image.naturalHeight || image.height;
    // Blurred cover background fills the frame.
    const cover = Math.max(W / iw, H / ih);
    const bw = iw * cover, bh = ih * cover;
    ctx.filter = "blur(38px) brightness(0.82)";
    ctx.drawImage(image, (W - bw) / 2, (H - bh) / 2, bw, bh);
    ctx.filter = "none";
    // Full image contained (centered) — nothing cropped.
    const contain = Math.min(W / iw, H / ih);
    const fw = iw * contain, fh = ih * contain;
    ctx.drawImage(image, (W - fw) / 2, (H - fh) / 2, fw, fh);
    return c.toDataURL("image/jpeg", 0.95);
  };

  // AI reframe to 4:5 — the "ChatGPT way": send the WHOLE image and let the model
  // intelligently recompose it to a vertical 4:5, keeping every element & text and
  // extending the design to fill the frame. The model output is used directly
  // (no strip paste-back), which is what produces the impressive result.
  const aiConvertTo45 = async (image: HTMLImageElement): Promise<string> => {
    const f = FORMATS.find((x) => x.id === "feed_4_5")!;
    const maxDim = 1536;
    const ds = Math.min(1, maxDim / Math.max(image.naturalWidth, image.naturalHeight));
    const c = document.createElement("canvas");
    c.width = Math.round(image.naturalWidth * ds);
    c.height = Math.round(image.naturalHeight * ds);
    const cx = c.getContext("2d")!;
    cx.imageSmoothingQuality = "high";
    cx.drawImage(image, 0, 0, c.width, c.height);
    const inputDataUrl = c.toDataURL("image/jpeg", 0.9);

    const res = await fetch("/api/creative-pixelai/generate-ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imagePng: inputDataUrl, format: "feed_4_5", mode: "reframe", quality: "high", prompt: aiStylePrompt.trim() || undefined }),
    });
    const json = await parseResponse(res);
    if (!res.ok) throw new Error(json.error || "היצירה נכשלה");
    const genImg = await loadImage(json.image);

    const fin = document.createElement("canvas");
    fin.width = f.width; fin.height = f.height;
    const fctx = fin.getContext("2d")!;
    fctx.imageSmoothingQuality = "high";
    const s = Math.max(f.width / genImg.naturalWidth, f.height / genImg.naturalHeight);
    fctx.drawImage(genImg, (f.width - genImg.naturalWidth * s) / 2, (f.height - genImg.naturalHeight * s) / 2, genImg.naturalWidth * s, genImg.naturalHeight * s);
    return fin.toDataURL("image/png");
  };

  const runCarousel = async () => {
    if (carItems.length === 0) { toast("העלה תמונות לקרוסלה", "error"); return; }
    setCarBusy(true);
    setCarProgress({ done: 0, total: carItems.length });
    let failures = 0;
    try {
      for (let i = 0; i < carItems.length; i++) {
        let out: string;
        try {
          out = await aiConvertTo45(carItems[i].img); // AI engine
        } catch {
          out = convertTo45(carItems[i].img); // graceful fallback so the slot isn't empty
          failures++;
        }
        // eslint-disable-next-line no-loop-func
        setCarItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, out } : it)));
        setCarProgress({ done: i + 1, total: carItems.length });
      }
      if (failures > 0) toast(`הותאמו ${carItems.length} תמונות (${failures} בעיבוד רגיל — ה-AI נכשל עליהן)`, "info");
      else toast("הקרוסלה הותאמה ל-4:5 עם AI ✨", "success");
    } finally {
      setCarBusy(false);
    }
  };

  const downloadCarItem = (it: CarouselItem, idx: number) => {
    if (!it.out) return;
    const a = document.createElement("a");
    a.href = it.out; a.download = `carousel_${String(idx + 1).padStart(2, "0")}_4x5.jpg`; a.click();
  };

  const downloadCarouselZip = async () => {
    const ready = carItems.filter((it) => it.out);
    if (ready.length === 0) { toast("אין תמונות מותאמות להורדה", "error"); return; }
    try {
      const zip = new JSZip();
      ready.forEach((it, idx) => {
        const b64 = (it.out as string).split(",")[1];
        zip.file(`carousel_${String(idx + 1).padStart(2, "0")}_4x5.jpg`, b64, { base64: true });
      });
      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = "carousel_4x5.zip"; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    } catch { toast("יצירת ה-ZIP נכשלה", "error"); }
  };

  const carDoneCount = carItems.filter((it) => it.out).length;

  const dominantColors = useMemo(() => (img ? extractDominantColors(img, 3) : []), [img]);

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const res = await fetch("/api/creative-pixelai/adaptations", { headers: roleHeaders() });
      const json = await res.json();
      setHistory(Array.isArray(json.adaptations) ? json.adaptations : []);
    } catch { setHistory([]); }
    finally { setHistoryLoading(false); }
  }, []);
  useEffect(() => { loadHistory(); }, [loadHistory]);

  /* ── Upload handling ── */
  const handleFile = useCallback(async (file: File) => {
    if (!/^image\/(png|jpe?g|webp)$/i.test(file.type)) { toast("פורמט לא נתמך — רק JPG / PNG / WEBP", "error"); return; }
    if (file.size > MAX_FILE_MB * 1024 * 1024) { toast(`קובץ גדול מדי (מקסימום ${MAX_FILE_MB}MB)`, "error"); return; }
    try {
      const url = URL.createObjectURL(file);
      const image = await loadImage(url);
      setImg(image);
      setFileName(file.name);
      setMimeType(file.type);
      setOriginalBlob(file);
      setAnalysis(null);
      // Auto-analyze (decisions only — never generation).
      runAnalysis(image);
    } catch {
      toast("טעינת התמונה נכשלה", "error");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const runAnalysis = useCallback(async (image: HTMLImageElement) => {
    setAnalyzing(true);
    try {
      const dataUrl = toAnalysisDataUrl(image);
      const res = await fetch("/api/creative-pixelai/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl: dataUrl, width: image.naturalWidth, height: image.naturalHeight }),
      });
      const json = await res.json();
      const a = json.analysis;
      setAnalysis(a || null);
      if (a) {
        // Apply AI recommendations as starting point (user can override).
        if (a.riskLevel === "high") {
          setScaleMode("fit");
          setPadding(Math.max(100, a.recommendedPadding || 100));
          toast("⚠️ זוהה סיכון גבוה לחיתוך — הופעל מצב Fit מלא עם padding מוגדל", "info");
        } else {
          setPadding(a.recommendedPadding || 80);
        }
        if (a.recommendedBackground) setBackground(a.recommendedBackground);
      }
    } catch {
      toast("הניתוח נכשל — ממשיכים במצב בטוח", "error");
    } finally { setAnalyzing(false); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── Build options per format ── */
  const optionsFor = useCallback((format: FormatSpec): AdaptationOptions => ({
    format, scaleMode, background, brandColor, customBgImage: customBg,
    padding, blurAmount, brightness, verticalOffset, manualScale,
    shadow, roundedCorners: rounded,
    dominantColors: analysis?.dominantColors?.length ? analysis.dominantColors : dominantColors,
    riskLevel: analysis?.riskLevel || "medium",
  }), [scaleMode, background, brandColor, customBg, padding, blurAmount, brightness, verticalOffset, manualScale, shadow, rounded, analysis, dominantColors]);

  /* ── Render previews whenever anything changes ── */
  useEffect(() => {
    if (!img) return;
    for (const f of FORMATS) {
      if (!selectedFormats.includes(f.id)) continue;
      const canvas = canvasRefs.current[f.id];
      if (!canvas) continue;
      try { renderAdaptation(canvas, img, optionsFor(f)); } catch { /* canvas not ready */ }
    }
  }, [img, selectedFormats, optionsFor, renderTick]);

  /* ── Export ── */
  const renderFullRes = useCallback(async (f: FormatSpec, type: "image/png" | "image/jpeg") => {
    if (!img) throw new Error("אין תמונה");
    const canvas = document.createElement("canvas");
    const layout = renderAdaptation(canvas, img, optionsFor(f));
    const v = validateAdaptation(img.naturalWidth, img.naturalHeight, layout, optionsFor(f));
    if (!v.ok) throw new Error(v.problems.join(" · "));
    if (canvas.width !== f.width || canvas.height !== f.height) throw new Error("מידות הפלט שגויות");
    return canvasToBlob(canvas, type, 0.95);
  }, [img, optionsFor]);

  const download = (blob: Blob, name: string) => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  };

  const exportOne = async (type: "image/png" | "image/jpeg") => {
    const f = FORMATS.find((x) => x.id === activeFormat)!;
    setExporting(true);
    try {
      const blob = await getOutputBlob(f, type);
      download(blob, `${baseName()}_${f.id}.${type === "image/png" ? "png" : "jpg"}`);
      toast("✓ הקובץ ירד", "success");
    } catch (e) { toast(e instanceof Error ? e.message : "הייצוא נכשל", "error"); }
    finally { setExporting(false); }
  };

  const exportZip = async () => {
    if (!img) return;
    setExporting(true);
    try {
      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();
      for (const f of FORMATS) {
        if (!selectedFormats.includes(f.id)) continue;
        const blob = await getOutputBlob(f, "image/png");
        zip.file(`${baseName()}_${f.id}.png`, blob);
      }
      const out = await zip.generateAsync({ type: "blob" });
      download(out, `${baseName()}_all-formats.zip`);
      toast("✓ ZIP ירד עם כל הפורמטים", "success");
    } catch (e) { toast(e instanceof Error ? e.message : "יצירת ה-ZIP נכשלה", "error"); }
    finally { setExporting(false); }
  };

  const baseName = () => (fileName || "creative").replace(/\.[^.]+$/, "");

  /* ── Save to campaign assets (Supabase) ── */
  const saveToAssets = async () => {
    if (!img || !originalBlob) return;
    setSaving(true);
    try {
      const stamp = Date.now();
      // 1) original (locked source)
      const origUrl = await uploadBlob(originalBlob, `creative-assets/originals/${stamp}_${fileName || "original.png"}`, mimeType);
      // 2) each format output
      const outputs: any[] = [];
      for (const f of FORMATS) {
        if (!selectedFormats.includes(f.id)) continue;
        const blob = await getOutputBlob(f, "image/png");
        const url = await uploadBlob(blob, `creative-assets/adaptations/${stamp}/${f.id}.png`, "image/png");
        outputs.push({
          format: f.id, width: f.width, height: f.height, url,
          backgroundType: background, placement: scaleMode, scaleMode,
          padding, blurAmount, brightness, exportType: "png",
        });
      }
      // 3) persist
      const res = await fetch("/api/creative-pixelai/adaptations", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...roleHeaders() },
        body: JSON.stringify({
          originalAssetUrl: origUrl, originalFileName: fileName,
          originalWidth: img.naturalWidth, originalHeight: img.naturalHeight,
          originalMimeType: mimeType, clientId: saveClientId || null,
          analysis, selectedFormats, status: "completed", outputs,
        }),
      });
      if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(j.error || "השמירה נכשלה"); }
      toast("✓ נשמר לנכסי הקמפיין", "success");
      loadHistory();
    } catch (e) { toast(e instanceof Error ? e.message : "השמירה נכשלה", "error"); }
    finally { setSaving(false); }
  };

  /* ── AI GENERATION (outpainting): the model fills the surroundings at full ad
     size; the ORIGINAL creative is composited back on top pixel-perfect, so
     text / price / phone / logo can never be corrupted. ── */
  const generateAIFor = useCallback(async (formatId: FormatId) => {
    if (!img) return;
    const f = FORMATS.find((x) => x.id === formatId)!;
    setAiGenerating(formatId);
    try {
      const genW = 1024;
      const genH = formatId === "square" ? 1024 : 1536;

      let inputDataUrl: string;
      let composite: { gx: number; gy: number; gw: number; gh: number } | null = null;

      if (aiMode === "redesign") {
        // FULL REDESIGN — 1536px keeps text crisp for the model while staying fast
        // enough to fit the serverless time budget.
        const maxDim = 1536;
        const ds = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight));
        const c = document.createElement("canvas");
        c.width = Math.round(img.naturalWidth * ds);
        c.height = Math.round(img.naturalHeight * ds);
        const cx = c.getContext("2d")!;
        cx.imageSmoothingQuality = "high";
        cx.drawImage(img, 0, 0, c.width, c.height);
        // JPEG keeps the request body small (PNG of a full photo can exceed the
        // serverless body limit → "Request Entity Too Large").
        inputDataUrl = c.toDataURL("image/jpeg", 0.9);
      } else {
        // FULL-WIDTH 1:1 — the original spans the ENTIRE width (edge-to-edge, looks
        // native/full-bleed); the AI only completes the missing strips above/below
        // (sky/architecture up, design panel colors down). ZERO text/logo changes.
        let fullScale = genW / img.naturalWidth;
        if (img.naturalHeight * fullScale > genH) fullScale = genH / img.naturalHeight; // never clip the original
        const gw = img.naturalWidth * fullScale;
        const gh = img.naturalHeight * fullScale;
        const gx = (genW - gw) / 2;
        const freeH = Math.max(0, genH - gh);
        const gy = scaleMode === "top_focus" ? 0
          : scaleMode === "bottom_focus" ? freeH
          : Math.round(freeH * 0.45); // slightly above center — sky extension reads better on top
        composite = { gx, gy, gw, gh };
        const genCanvas = document.createElement("canvas");
        genCanvas.width = genW; genCanvas.height = genH;
        const gctx = genCanvas.getContext("2d")!;
        gctx.clearRect(0, 0, genW, genH);
        gctx.imageSmoothingQuality = "high";
        gctx.drawImage(img, gx, gy, gw, gh);
        inputDataUrl = genCanvas.toDataURL("image/png");
      }

      const res = await fetch("/api/creative-pixelai/generate-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imagePng: inputDataUrl, format: formatId, mode: aiMode, quality: aiHighQuality ? "high" : "medium", prompt: aiStylePrompt.trim() || undefined, correctTexts: manualTexts.trim() || undefined }),
      });
      const json = await parseResponse(res);
      if (!res.ok) throw new Error(json.error || "היצירה נכשלה");
      const genImg = await loadImage(json.image);

      // Compose the FINAL canvas at the exact ad size (cover-scale the generation).
      const fin = document.createElement("canvas");
      fin.width = f.width; fin.height = f.height;
      const fctx = fin.getContext("2d")!;
      fctx.imageSmoothingQuality = "high";
      const s = Math.max(f.width / genImg.naturalWidth, f.height / genImg.naturalHeight);
      const ox = (f.width - genImg.naturalWidth * s) / 2, oy = (f.height - genImg.naturalHeight * s) / 2;
      fctx.drawImage(genImg, ox, oy, genImg.naturalWidth * s, genImg.naturalHeight * s);

      // Outpaint mode: paste the ORIGINAL back over its region (smart, full-bleed —
      // the AI-extended background fills the rest, exactly like the Story result).
      const is45 = f.id === "feed_4_5" || (Math.abs(f.width / f.height - 4 / 5) < 0.02);
      if (composite) {
        const s2 = Math.max(f.width / genW, f.height / genH);
        const ow = composite.gw * s2, oh = composite.gh * s2;
        let ox2 = composite.gx * s2 + (f.width - genW * s2) / 2;
        let oy2 = composite.gy * s2 + (f.height - genH * s2) / 2;
        // 4:5 cover-scale used to crop the original's edges (logo). SHIFT the original
        // back into frame (don't shrink it) so no info is cut, while the AI background
        // still fills full-bleed behind it. Story/Square keep their exact behavior.
        if (is45) {
          if (ow <= f.width) ox2 = Math.max(0, Math.min(ox2, f.width - ow));
          if (oh <= f.height) oy2 = Math.max(0, Math.min(oy2, f.height - oh));
        }
        fctx.drawImage(img, ox2, oy2, ow, oh);
      }

      setAiResults((r) => ({ ...r, [formatId]: fin.toDataURL("image/png") }));
      setApprovedFormats((a) => { const n = { ...a }; delete n[formatId]; return n; }); // fresh gen → needs re-approval
      setActiveFormat(formatId);
      // Surface AI text-fidelity check (redesign mode).
      if (json.textCheck?.original && !manualTexts.trim()) setDetectedTexts(json.textCheck.original); // remember for the "fill from detection" button
      if (json.textCheck && !json.textCheck.ok && Array.isArray(json.textCheck.missing) && json.textCheck.missing.length) {
        setAiTextWarn((w) => ({ ...w, [formatId]: json.textCheck.missing }));
      } else {
        setAiTextWarn((w) => { const n = { ...w }; delete n[formatId]; return n; });
      }
      toast(aiMode === "redesign" ? `✓ נוצר ${f.label} — בדוק התאמת טקסט` : `✓ נוצר ${f.label}`, "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "היצירה נכשלה", "error");
    } finally { setAiGenerating(null); }
  }, [img, scaleMode, aiStylePrompt, aiMode, aiHighQuality, manualTexts, toast]);

  const [bulkProgress, setBulkProgress] = useState<{ done: number; total: number; current: string } | null>(null);
  const generateAllAI = async () => {
    const targets = FORMATS.filter((f) => selectedFormats.includes(f.id));
    if (targets.length === 0) return;
    setBulkProgress({ done: 0, total: targets.length, current: targets[0].label });
    for (let i = 0; i < targets.length; i++) {
      setBulkProgress({ done: i, total: targets.length, current: targets[i].label });
      await generateAIFor(targets[i].id);
    }
    setBulkProgress(null);
    toast(`✓ נוצרו כל ${targets.length} המידות — מוכן לייצוא`, "success");
  };

  /** Output blob for export/save — AI result when in AI mode, else clean canvas render. */
  const getOutputBlob = useCallback(async (f: FormatSpec, type: "image/png" | "image/jpeg"): Promise<Blob> => {
    if (engine === "ai") {
      const dataUrl = aiResults[f.id];
      if (!dataUrl) throw new Error(`עדיין לא נוצר ${f.label} ב-AI — לחץ "צור"`);
      const srcImg = await loadImage(dataUrl);
      const c = document.createElement("canvas");
      c.width = f.width; c.height = f.height;
      c.getContext("2d")!.drawImage(srcImg, 0, 0, f.width, f.height);
      return canvasToBlob(c, type, 0.95);
    }
    return renderFullRes(f, type);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine, aiResults]);

  /* ── Per-version AI fix: send the CURRENT generated version back for a targeted
     edit per the user's note (ChatGPT-style iteration). Previous kept for undo. ── */
  const prevAiResultRef = useRef<Record<string, string>>({});

  /** Fix a SPECIFIC generated version per its own note (targeted edit). */
  const aiFixFor = async (formatId: FormatId, note: string) => {
    const current = aiResults[formatId];
    if (!current || !note.trim()) return;
    setFixingFormat(formatId);
    try {
      const curImg = await loadImage(current);
      const maxDim = 1536;
      const ds = Math.min(1, maxDim / Math.max(curImg.naturalWidth, curImg.naturalHeight));
      const c = document.createElement("canvas");
      c.width = Math.round(curImg.naturalWidth * ds);
      c.height = Math.round(curImg.naturalHeight * ds);
      c.getContext("2d")!.drawImage(curImg, 0, 0, c.width, c.height);

      const res = await fetch("/api/creative-pixelai/generate-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imagePng: c.toDataURL("image/jpeg", 0.92), format: formatId, mode: "edit", quality: aiHighQuality ? "high" : "medium", prompt: note.trim() }),
      });
      const json = await parseResponse(res);
      if (!res.ok) throw new Error(json.error || "התיקון נכשל");
      const genImg = await loadImage(json.image);
      const f = FORMATS.find((x) => x.id === formatId)!;
      const fin = document.createElement("canvas");
      fin.width = f.width; fin.height = f.height;
      const fctx = fin.getContext("2d")!;
      fctx.imageSmoothingQuality = "high";
      const s = Math.max(f.width / genImg.naturalWidth, f.height / genImg.naturalHeight);
      fctx.drawImage(genImg, (f.width - genImg.naturalWidth * s) / 2, (f.height - genImg.naturalHeight * s) / 2, genImg.naturalWidth * s, genImg.naturalHeight * s);

      prevAiResultRef.current[formatId] = current;
      setAiResults((r) => ({ ...r, [formatId]: fin.toDataURL("image/png") }));
      setCardNote((n) => ({ ...n, [formatId]: "" }));
      toast("✓ הגרסה תוקנה — בדוק ואשר", "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "התיקון נכשל", "error");
    } finally { setFixingFormat(null); }
  };

  const undoAiFixFor = (formatId: FormatId) => {
    const prev = prevAiResultRef.current[formatId];
    if (!prev) return;
    setAiResults((r) => ({ ...r, [formatId]: prev }));
    delete prevAiResultRef.current[formatId];
    setApprovedFormats((a) => { const n = { ...a }; delete n[formatId]; return n; });
  };

  const selectedDone = FORMATS.filter((f) => selectedFormats.includes(f.id) && aiResults[f.id]);
  const allApproved = selectedDone.length > 0 && selectedDone.every((f) => approvedFormats[f.id]);

  /* ── Refine by note: AI maps Hebrew feedback → parameter changes, re-render is instant ── */
  const applyRefine = async () => {
    if (!refineNote.trim() || !img) return;
    setRefining(true);
    try {
      const res = await fetch("/api/creative-pixelai/refine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          note: refineNote.trim(),
          currentSettings: { scaleMode, background, padding, blurAmount, brightness, verticalOffset, manualScale, shadow, roundedCorners: rounded },
          analysis,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "התיקון נכשל");
      const s = json.settings || {};
      if (s.scaleMode) setScaleMode(s.scaleMode);
      if (s.background) setBackground(s.background);
      if (typeof s.padding === "number") setPadding(s.padding);
      if (typeof s.blurAmount === "number") setBlurAmount(s.blurAmount);
      if (typeof s.brightness === "number") setBrightness(s.brightness);
      if (typeof s.verticalOffset === "number") setVerticalOffset(s.verticalOffset);
      if (typeof s.manualScale === "number") { setManualScale(s.manualScale); if (!s.scaleMode) setScaleMode("manual"); }
      if (typeof s.shadow === "boolean") setShadow(s.shadow);
      if (typeof s.roundedCorners === "boolean") setRounded(s.roundedCorners);
      setRefineLog((l) => [{ note: refineNote.trim(), explanation: json.explanation || "עודכן" }, ...l].slice(0, 5));
      setRefineNote("");
      toast(`✓ ${json.explanation || "עודכן לפי ההערה"}`, "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "התיקון נכשל", "error");
    } finally { setRefining(false); }
  };

  const deleteAdaptation = async (id: string) => {
    if (!confirm("למחוק את ההתאמה הזו?")) return;
    try {
      const res = await fetch(`/api/creative-pixelai/adaptations/${id}`, { method: "DELETE", headers: roleHeaders() });
      if (!res.ok) throw new Error();
      setHistory((h) => h.filter((r) => r.id !== id));
      toast("נמחק", "info");
    } catch { toast("המחיקה נכשלה", "error"); }
  };

  const downloadHistoryZip = async (row: HistoryRow) => {
    try {
      const res = await fetch("/api/creative-pixelai/export-zip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          zipName: row.original_file_name || "creative",
          files: row.outputs.map((o) => ({ name: `${o.output_format}.png`, url: o.output_asset_url })),
        }),
      });
      if (!res.ok) throw new Error();
      download(await res.blob(), `${(row.original_file_name || "creative").replace(/\.[^.]+$/, "")}_formats.zip`);
    } catch { toast("הורדת ה-ZIP נכשלה", "error"); }
  };

  const riskColor = analysis?.riskLevel === "high" ? "#ef4444" : analysis?.riskLevel === "medium" ? "#f59e0b" : "#16a34a";

  const ModeToggle = (
    <div style={{ display: "inline-flex", gap: 4, background: "var(--surface)", border: `1px solid var(--border)`, borderRadius: 12, padding: 4, marginBottom: 20 }}>
      {([["single", "🖼️ תמונה בודדת"], ["carousel", "🎠 קרוסלה (4:5)"]] as const).map(([m, label]) => (
        <button key={m} onClick={() => setPageMode(m)}
          style={{ padding: "0.5rem 1rem", borderRadius: 9, fontSize: 13, fontWeight: 800, cursor: "pointer", border: "none",
            background: pageMode === m ? BRAND : "transparent", color: pageMode === m ? "#fff" : "var(--foreground)" }}>
          {label}
        </button>
      ))}
    </div>
  );

  /* ═══════════════════════════ CAROUSEL MODE ═══════════════════════════ */
  if (pageMode === "carousel") {
    return (
      <div dir="rtl" style={{ maxWidth: 1100, margin: "0 auto", padding: "2rem 1.75rem 4rem" }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 6, color: "var(--foreground)" }}>🎨 Creative PixelAI</h1>
        <p style={{ color: "var(--foreground-muted)", fontSize: 14, marginBottom: 18 }}>
          התאמת קרוסלה לאינסטגרם — העלה עד {CAROUSEL_MAX} תמונות, וכל אחת תותאם לפורמט 4:5 בלי לאבד מידע.
        </p>
        {ModeToggle}

        {/* Upload */}
        <div className="premium-card" style={{ padding: "1.25rem", marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: "var(--foreground)" }}>1 · העלאת תמונות הקרוסלה</div>
            <div style={{ fontSize: 12, color: "var(--foreground-muted)" }}>{carItems.length}/{CAROUSEL_MAX}</div>
          </div>
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => { e.preventDefault(); setDragging(false); if (e.dataTransfer.files?.length) addCarouselFiles(e.dataTransfer.files); }}
            onClick={() => document.getElementById("cpai-car-input")?.click()}
            style={{ border: `2px dashed ${dragging ? BRAND : "var(--border)"}`, borderRadius: 12, padding: "1.5rem", textAlign: "center", cursor: "pointer", background: dragging ? "rgba(0,181,254,0.05)" : "var(--surface)" }}>
            <div style={{ fontSize: 26, marginBottom: 6 }}>🎠</div>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--foreground)" }}>גרור תמונות לכאן או לחץ להעלאה (עד {CAROUSEL_MAX})</div>
            <div style={{ fontSize: 11.5, color: "var(--foreground-muted)", marginTop: 4 }}>JPG · PNG · WEBP</div>
          </div>
          <input id="cpai-car-input" type="file" accept="image/png,image/jpeg,image/webp" multiple style={{ display: "none" }}
            onChange={(e) => { if (e.target.files?.length) addCarouselFiles(e.target.files); e.currentTarget.value = ""; }} />

          {carItems.length > 0 && (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 12, marginTop: 16 }}>
                {carItems.map((it, idx) => (
                  <div key={it.id} style={{ border: `1px solid var(--border)`, borderRadius: 10, overflow: "hidden", background: "var(--surface)", position: "relative" }}>
                    <div style={{ position: "absolute", top: 6, right: 6, background: "rgba(0,0,0,0.6)", color: "#fff", borderRadius: 6, fontSize: 11, fontWeight: 800, padding: "1px 7px", zIndex: 2 }}>{idx + 1}</div>
                    <button onClick={() => removeCarItem(it.id)} title="הסר"
                      style={{ position: "absolute", top: 6, left: 6, background: "rgba(0,0,0,0.6)", color: "#fff", border: "none", borderRadius: 6, fontSize: 12, fontWeight: 800, padding: "1px 7px", cursor: "pointer", zIndex: 2 }}>✕</button>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={it.out || it.src} alt="" style={{ width: "100%", aspectRatio: it.out ? "4 / 5" : "1 / 1", objectFit: it.out ? "cover" : "contain", background: "#0001", display: "block" }} />
                    <div style={{ padding: "6px 8px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6 }}>
                      <span style={{ fontSize: 11, color: it.out ? "#16a34a" : "var(--foreground-muted)", fontWeight: 700 }}>{it.out ? "✓ 4:5" : "ממתין"}</span>
                      {it.out && <button onClick={() => downloadCarItem(it, idx)} style={{ fontSize: 11, fontWeight: 700, color: BRAND, background: "none", border: "none", cursor: "pointer" }}>⬇ הורד</button>}
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 16, alignItems: "center" }}>
                <button onClick={runCarousel} disabled={carBusy}
                  style={{ background: carBusy ? "#cbd5e1" : BRAND, color: "#fff", border: "none", borderRadius: 10, padding: "0.7rem 1.3rem", fontWeight: 800, fontSize: 14, cursor: carBusy ? "wait" : "pointer" }}>
                  {carBusy && carProgress ? `מתאים… ${carProgress.done}/${carProgress.total}` : `🚀 התאם את הקרוסלה ל-4:5 (${carItems.length})`}
                </button>
                {carDoneCount > 0 && (
                  <button onClick={downloadCarouselZip}
                    style={{ background: "#16a34a", color: "#fff", border: "none", borderRadius: 10, padding: "0.7rem 1.3rem", fontWeight: 800, fontSize: 14, cursor: "pointer" }}>
                    📦 הורד את כל הקרוסלה (ZIP)
                  </button>
                )}
                <button onClick={() => setCarItems([])} disabled={carBusy}
                  style={{ background: "none", color: "var(--foreground-muted)", border: `1px solid var(--border)`, borderRadius: 10, padding: "0.7rem 1rem", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
                  נקה הכל
                </button>
              </div>
            </>
          )}
        </div>

        <p style={{ fontSize: 12, color: "var(--foreground-muted)" }}>
          * ההתאמה נעשית עם AI (אותו מנגנון של «עיצוב מלא לפורמט»): העיצוב המקורי נשמר פיקסל-פרפקט במלוא הרוחב, וה-AI משלים את הרקע למעלה/למטה כדי למלא את הפריים — תוצאה 1080×1350 px לאינסטגרם, בלי לאבד מידע. כל תמונה לוקחת מספר שניות.
        </p>
      </div>
    );
  }

  /* ═══════════════════════════ JSX ═══════════════════════════ */
  return (
    <div dir="rtl" style={{ maxWidth: 1320, margin: "0 auto", padding: "2rem 1.75rem 4rem" }}>
      {/* Header */}
      <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 6, color: "var(--foreground)" }}>🎨 Creative PixelAI</h1>
      <p style={{ color: "var(--foreground-muted)", fontSize: 14, marginBottom: 18 }}>
        התאמת קריאייטיבים לכל פורמט פרסום — בלי לגעת בפיקסל אחד של העיצוב המקורי. ה-AI מנתח וממליץ; הביצוע הוא עיבוד תמונה נקי.
      </p>
      {ModeToggle}

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1.2fr)", gap: 20, alignItems: "start" }}>
        {/* ─── LEFT: controls ─── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          {/* 1. Upload */}
          <div className="premium-card" style={{ padding: "1.25rem" }}>
            <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 10, color: "var(--foreground)" }}>1 · העלאת קריאייטיב</div>
            <div
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files?.[0]; if (f) handleFile(f); }}
              onClick={() => document.getElementById("cpai-file-input")?.click()}
              style={{
                border: `2px dashed ${dragging ? BRAND : "var(--border)"}`,
                borderRadius: 12, padding: img ? "0.75rem" : "2rem", textAlign: "center", cursor: "pointer",
                background: dragging ? "rgba(0,181,254,0.05)" : "var(--surface)",
                transition: "all 150ms ease",
              }}
            >
              {img ? (
                <div style={{ display: "flex", alignItems: "center", gap: 12, textAlign: "right" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img.src} alt="" style={{ width: 64, height: 64, objectFit: "contain", borderRadius: 8, background: "#0002" }} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "var(--foreground)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{fileName}</div>
                    <div style={{ fontSize: 11.5, color: "var(--foreground-muted)" }}>{img.naturalWidth}×{img.naturalHeight}px · לחץ להחלפה</div>
                  </div>
                </div>
              ) : (
                <>
                  <div style={{ fontSize: 28, marginBottom: 8 }}>🖼️</div>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--foreground)" }}>גרור תמונה לכאן או לחץ להעלאה</div>
                  <div style={{ fontSize: 11.5, color: "var(--foreground-muted)", marginTop: 4 }}>JPG · PNG · WEBP · עד {MAX_FILE_MB}MB</div>
                </>
              )}
            </div>
            <input id="cpai-file-input" type="file" accept="image/png,image/jpeg,image/webp" style={{ display: "none" }}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.currentTarget.value = ""; }} />
          </div>

          {/* 1.5 Engine */}
          <div className="premium-card" style={{ padding: "1.25rem" }}>
            <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 10, color: "var(--foreground)" }}>מנוע יצירה</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <button onClick={() => setEngine("ai")}
                style={{ padding: "0.6rem", borderRadius: 10, fontSize: 12.5, fontWeight: 700, cursor: "pointer", textAlign: "right", border: `1px solid ${engine === "ai" ? BRAND : "var(--border)"}`, background: engine === "ai" ? "rgba(0,181,254,0.08)" : "transparent", color: engine === "ai" ? BRAND : "var(--foreground)" }}>
                ✨ יצירת AI
                <div style={{ fontSize: 10, fontWeight: 400, color: "var(--foreground-muted)", marginTop: 2 }}>הרקע נוצר מחדש במידות המלאות; המקור מודבק חזרה פיקסל-פרפקט</div>
              </button>
              <button onClick={() => setEngine("canvas")}
                style={{ padding: "0.6rem", borderRadius: 10, fontSize: 12.5, fontWeight: 700, cursor: "pointer", textAlign: "right", border: `1px solid ${engine === "canvas" ? BRAND : "var(--border)"}`, background: engine === "canvas" ? "rgba(0,181,254,0.08)" : "transparent", color: engine === "canvas" ? BRAND : "var(--foreground)" }}>
                🧼 עיבוד נקי
                <div style={{ fontSize: 10, fontWeight: 400, color: "var(--foreground-muted)", marginTop: 2 }}>רקע טשטוש/גרדיאנט — מיידי וחינמי</div>
              </button>
            </div>
            {engine === "ai" && (
              <div style={{ marginTop: 12 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
                  <button onClick={() => setAiMode("redesign")}
                    style={{ padding: "0.5rem", borderRadius: 10, fontSize: 11.5, fontWeight: 700, cursor: "pointer", textAlign: "right", border: `1px solid ${aiMode === "redesign" ? BRAND : "var(--border)"}`, background: aiMode === "redesign" ? "rgba(0,181,254,0.08)" : "transparent", color: aiMode === "redesign" ? BRAND : "var(--foreground)" }}>
                    🎨 עיצוב מלא לפורמט
                    <div style={{ fontSize: 9.5, fontWeight: 400, color: "var(--foreground-muted)", marginTop: 2 }}>ה-AI פורס את המודעה מחדש על כל הפריים — נאמנות גבוהה לטקסט ולוגו</div>
                  </button>
                  <button onClick={() => setAiMode("outpaint")}
                    style={{ padding: "0.5rem", borderRadius: 10, fontSize: 11.5, fontWeight: 700, cursor: "pointer", textAlign: "right", border: `1px solid ${aiMode === "outpaint" ? BRAND : "var(--border)"}`, background: aiMode === "outpaint" ? "rgba(0,181,254,0.08)" : "transparent", color: aiMode === "outpaint" ? BRAND : "var(--foreground)" }}>
                    🔒 הרחבה 1:1
                    <div style={{ fontSize: 9.5, fontWeight: 400, color: "var(--foreground-muted)", marginTop: 2 }}>המקור נעול פיקסל-פרפקט; ה-AI רק משלים למעלה/למטה</div>
                  </button>
                </div>
                {aiMode === "redesign" && (
                  <div style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.3)", borderRadius: 8, padding: "0.45rem 0.65rem", fontSize: 10.5, color: "#b45309", marginBottom: 8 }}>
                    💡 הטקסטים נשמרים בנאמנות גבוהה — בכל זאת הגיה מחירים וטלפונים לפני פרסום. שיבוש? צור שוב או עבור ל"הרחבה 1:1".
                  </div>
                )}
                <input className="form-input ux-input" value={aiStylePrompt} onChange={(e) => setAiStylePrompt(e.target.value)}
                  placeholder="סגנון (אופציונלי): למשל ׳שמיים כחולים, אווירת יוקרה׳" style={{ fontSize: 12, marginBottom: 8 }} />

                {aiMode === "redesign" && (
                  <div style={{ marginBottom: 8 }}>
                    <button onClick={() => setShowTextEditor((v) => !v)} style={{ width: "100%", textAlign: "right", background: manualTexts.trim() ? "rgba(16,185,129,0.08)" : "var(--surface)", border: `1px solid ${manualTexts.trim() ? "rgba(16,185,129,0.4)" : "var(--border)"}`, borderRadius: 8, padding: "0.45rem 0.65rem", fontSize: 11.5, fontWeight: 700, color: manualTexts.trim() ? "#059669" : "var(--foreground)", cursor: "pointer" }}>
                      {manualTexts.trim() ? "✓ טקסט מקור מוגדר ידנית" : "✏️ הגדר טקסט מקור מדויק"} {showTextEditor ? "▲" : "▼"}
                    </button>
                    {showTextEditor && (
                      <div style={{ marginTop: 6, padding: "0.6rem", border: "1px solid var(--border)", borderRadius: 8, background: "var(--surface)" }}>
                        <div style={{ fontSize: 10.5, color: "var(--foreground-muted)", lineHeight: 1.55, marginBottom: 6 }}>
                          אם הזיהוי האוטומטי טעה — רשום כאן את הטקסטים המדויקים, שורה לכל טקסט. המערכת תשתמש בזה גם ליצירה וגם לבדיקת הנאמנות (במקום הזיהוי האוטומטי).
                        </div>
                        <textarea className="form-input ux-input" value={manualTexts} onChange={(e) => setManualTexts(e.target.value)} rows={6}
                          placeholder={"החל מ-3,290,000₪\nא.א. אבן יהודה יזמות\nTHE PLACE TO BE\n…"} style={{ fontSize: 12, width: "100%", resize: "vertical", lineHeight: 1.6 }} />
                        <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                          {detectedTexts && (
                            <button className="mod-btn-ghost ux-btn" onClick={() => setManualTexts(detectedTexts)} style={{ fontSize: 11 }} title="מלא מהזיהוי האחרון ואז תקן ידנית">
                              ↧ מלא מהזיהוי
                            </button>
                          )}
                          {manualTexts.trim() && (
                            <button className="mod-btn-ghost ux-btn" onClick={() => setManualTexts("")} style={{ fontSize: 11 }}>נקה</button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
                <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, color: "var(--foreground)", cursor: "pointer", marginBottom: 8 }}>
                  <input type="checkbox" checked={aiHighQuality} onChange={(e) => setAiHighQuality(e.target.checked)} />
                  💎 איכות מקסימלית (איטי יותר — אם נקטע, הפעל Fluid Compute ב-Vercel)
                </label>
                {/* Primary: adapt to ALL sizes automatically */}
                <button className="mod-btn-primary ux-btn ux-btn-glow" disabled={!img || !!aiGenerating} onClick={generateAllAI}
                  style={{ width: "100%", fontSize: 14, fontWeight: 800, padding: "0.75rem", marginBottom: 8, opacity: !img || aiGenerating ? 0.6 : 1 }}>
                  {bulkProgress
                    ? `⏳ יוצר ${bulkProgress.done + 1}/${bulkProgress.total} — ${bulkProgress.current}`
                    : `🚀 התאם לכל המידות (${selectedFormats.length})`}
                </button>
                <button className="mod-btn-ghost ux-btn" disabled={!img || !!aiGenerating} onClick={() => generateAIFor(activeFormat)}
                  style={{ width: "100%", fontSize: 12, opacity: !img || aiGenerating ? 0.5 : 1 }}>
                  {aiGenerating && !bulkProgress ? `⏳ יוצר…` : `או רק ${activeFormat === "story" ? "Story" : activeFormat === "feed_4_5" ? "4:5" : "Square"} ✨`}
                </button>
                <div style={{ fontSize: 10, color: "var(--foreground-muted)", marginTop: 6 }}>
                  ⚡ כ-20-40 שניות לפורמט · הטקסט, המחיר והלוגו מוגנים — מודבקים מהמקור, לא מג׳ונרטים
                </div>
              </div>
            )}
          </div>

          {/* 2. Formats */}
          <div className="premium-card" style={{ padding: "1.25rem" }}>
            <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 10, color: "var(--foreground)" }}>2 · פורמטים</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {FORMATS.map((f) => {
                const on = selectedFormats.includes(f.id);
                return (
                  <label key={f.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "0.55rem 0.75rem", borderRadius: 10, border: `1px solid ${on ? BRAND : "var(--border)"}`, background: on ? "rgba(0,181,254,0.06)" : "transparent", cursor: "pointer" }}>
                    <input type="checkbox" checked={on} onChange={() => {
                      setSelectedFormats((prev) => on ? prev.filter((x) => x !== f.id) : [...prev, f.id]);
                      if (!on) setActiveFormat(f.id);
                    }} />
                    <span style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)" }}>{f.label}</span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* 3. Mode */}
          <div className="premium-card" style={{ padding: "1.25rem" }}>
            <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 10, color: "var(--foreground)" }}>3 · מצב התאמה</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {MODE_OPTIONS.map((m) => (
                <button key={m.id} onClick={() => setScaleMode(m.id)} title={m.desc}
                  style={{
                    padding: "0.5rem 0.6rem", borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: "pointer", textAlign: "right",
                    border: `1px solid ${scaleMode === m.id ? BRAND : "var(--border)"}`,
                    background: scaleMode === m.id ? "rgba(0,181,254,0.08)" : "transparent",
                    color: scaleMode === m.id ? BRAND : "var(--foreground)",
                  }}>
                  {m.label}
                  <div style={{ fontSize: 10, fontWeight: 400, color: "var(--foreground-muted)", marginTop: 2 }}>{m.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* 4. Background */}
          <div className="premium-card" style={{ padding: "1.25rem" }}>
            <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 10, color: "var(--foreground)" }}>4 · רקע</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {BG_OPTIONS.map((b) => (
                <button key={b.id} onClick={() => setBackground(b.id)}
                  style={{
                    padding: "0.5rem 0.6rem", borderRadius: 10, fontSize: 12, fontWeight: 600, cursor: "pointer",
                    border: `1px solid ${background === b.id ? BRAND : "var(--border)"}`,
                    background: background === b.id ? "rgba(0,181,254,0.08)" : "transparent",
                    color: background === b.id ? BRAND : "var(--foreground)",
                  }}>{b.label}</button>
              ))}
            </div>
            {background === "brand_color" && (
              <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 12, color: "var(--foreground-muted)" }}>צבע:</span>
                <input type="color" value={brandColor} onChange={(e) => setBrandColor(e.target.value)} style={{ width: 42, height: 28, border: "none", background: "transparent", cursor: "pointer" }} />
                {dominantColors.map((c) => (
                  <button key={c} onClick={() => setBrandColor(c)} title={c} style={{ width: 22, height: 22, borderRadius: 6, background: c, border: "1px solid var(--border)", cursor: "pointer" }} />
                ))}
              </div>
            )}
            {background === "custom_image" && (
              <div style={{ marginTop: 10 }}>
                <input type="file" accept="image/*" className="ux-input" style={{ fontSize: 12 }}
                  onChange={async (e) => {
                    const f = e.target.files?.[0]; if (!f) return;
                    try { setCustomBg(await loadImage(URL.createObjectURL(f))); } catch { toast("טעינת הרקע נכשלה", "error"); }
                  }} />
              </div>
            )}
          </div>

          {/* 5. Controls */}
          <div className="premium-card" style={{ padding: "1.25rem" }}>
            <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 12, color: "var(--foreground)" }}>5 · כוונון עדין</div>
            {([
              { label: `Padding · ${padding}px`, min: 0, max: 200, step: 4, val: padding, set: (v: number) => setPadding(v) },
              { label: `טשטוש רקע · ${blurAmount}px`, min: 10, max: 80, step: 2, val: blurAmount, set: (v: number) => setBlurAmount(v) },
              { label: `בהירות רקע · ${Math.round(brightness * 100)}%`, min: 40, max: 120, step: 5, val: Math.round(brightness * 100), set: (v: number) => setBrightness(v / 100) },
              { label: `מיקום אנכי · ${verticalOffset > 0 ? "+" : ""}${Math.round(verticalOffset * 100)}`, min: -100, max: 100, step: 5, val: Math.round(verticalOffset * 100), set: (v: number) => setVerticalOffset(v / 100) },
            ] as const).map((s) => (
              <div key={s.label} style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11.5, color: "var(--foreground-muted)", marginBottom: 4 }}>{s.label}</div>
                <input type="range" min={s.min} max={s.max} step={s.step} value={s.val} onChange={(e) => s.set(Number(e.target.value))} style={{ width: "100%" }} />
              </div>
            ))}
            {scaleMode === "manual" && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11.5, color: "var(--foreground-muted)", marginBottom: 4 }}>גודל ידני · ×{manualScale.toFixed(2)}</div>
                <input type="range" min={50} max={150} step={5} value={Math.round(manualScale * 100)} onChange={(e) => setManualScale(Number(e.target.value) / 100)} style={{ width: "100%" }} />
              </div>
            )}
            <div style={{ display: "flex", gap: 16, marginTop: 4 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "var(--foreground)", cursor: "pointer" }}>
                <input type="checkbox" checked={shadow} onChange={(e) => setShadow(e.target.checked)} /> צל
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "var(--foreground)", cursor: "pointer" }}>
                <input type="checkbox" checked={rounded} onChange={(e) => setRounded(e.target.checked)} /> פינות מעוגלות
              </label>
              <button onClick={() => setRenderTick((t) => t + 1)} style={{ marginInlineStart: "auto", fontSize: 11.5, fontWeight: 700, color: BRAND, background: "none", border: "none", cursor: "pointer" }}>↺ רענן וריאציה</button>
            </div>
          </div>

          {/* 6. AI Analysis */}
          <div className="premium-card" style={{ padding: "1.25rem" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: "var(--foreground)" }}>🧠 ניתוח AI</div>
              {img && (
                <button onClick={() => runAnalysis(img)} disabled={analyzing}
                  style={{ fontSize: 11.5, fontWeight: 700, color: BRAND, background: "none", border: `1px solid ${BRAND}40`, borderRadius: 8, padding: "0.25rem 0.7rem", cursor: "pointer", opacity: analyzing ? 0.6 : 1 }}>
                  {analyzing ? "מנתח…" : "נתח מחדש"}
                </button>
              )}
            </div>
            {!img ? (
              <div style={{ fontSize: 12.5, color: "var(--foreground-muted)" }}>העלה תמונה כדי לקבל ניתוח</div>
            ) : analyzing ? (
              <div style={{ fontSize: 12.5, color: BRAND }}>⏳ מנתח את הקריאייטיב…</div>
            ) : analysis ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 12.5 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ color: "var(--foreground-muted)" }}>רמת סיכון:</span>
                  <span style={{ fontWeight: 800, color: riskColor }}>
                    {analysis.riskLevel === "high" ? "גבוהה 🔴" : analysis.riskLevel === "medium" ? "בינונית 🟠" : "נמוכה 🟢"}
                  </span>
                </div>
                <div style={{ color: "var(--foreground)" }}>📝 אזורי טקסט חשובים: <b>{analysis.importantTextAreas?.length ?? 0}</b> · לוגו: <b>{analysis.logoAreas?.length ?? 0}</b></div>
                <div style={{ color: "var(--foreground)" }}>
                  {analysis.hasPhoneNumber && "📞 טלפון · "}{analysis.hasPrice && "💰 מחיר · "}{analysis.hasCTA && "👆 CTA"}
                  {!analysis.hasPhoneNumber && !analysis.hasPrice && !analysis.hasCTA && "ללא טלפון/מחיר/CTA מזוהים"}
                </div>
                <div style={{ color: "var(--foreground-muted)" }}>המלצה: {analysis.recommendedScaleMode} · רקע {analysis.recommendedBackground} · padding {analysis.recommendedPadding}px</div>
                {analysis.warnings?.length > 0 && (
                  <div style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.3)", borderRadius: 8, padding: "0.5rem 0.7rem" }}>
                    {analysis.warnings.map((w: string, i: number) => (
                      <div key={i} style={{ color: "#b45309", fontSize: 11.5 }}>⚠️ {w}</div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div style={{ fontSize: 12.5, color: "var(--foreground-muted)" }}>אין ניתוח עדיין</div>
            )}
          </div>
        </div>

        {/* ─── RIGHT: preview + export ─── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16, position: "sticky", top: 16 }}>
          <div className="premium-card" style={{ padding: "1.25rem" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: "var(--foreground)" }}>תצוגה מקדימה</div>
              <div style={{ display: "inline-flex", gap: 2, padding: 3, borderRadius: 10, background: "var(--surface)", border: "1px solid var(--border)" }}>
                {FORMATS.filter((f) => selectedFormats.includes(f.id)).map((f) => (
                  <button key={f.id} onClick={() => setActiveFormat(f.id)}
                    style={{ padding: "0.3rem 0.7rem", fontSize: 11.5, fontWeight: 700, border: "none", borderRadius: 8, cursor: "pointer", background: activeFormat === f.id ? "var(--surface-raised)" : "transparent", color: activeFormat === f.id ? BRAND : "var(--foreground-muted)", boxShadow: activeFormat === f.id ? "0 1px 3px rgba(0,0,0,0.15)" : "none" }}>
                    {f.id === "story" ? "Story" : f.id === "feed_4_5" ? "4:5" : "Square"}
                  </button>
                ))}
                {img && (
                  <button onClick={() => setShowBefore((v) => !v)}
                    style={{ padding: "0.3rem 0.7rem", fontSize: 11.5, fontWeight: 700, border: "none", borderRadius: 8, cursor: "pointer", background: showBefore ? "var(--surface-raised)" : "transparent", color: showBefore ? "#f59e0b" : "var(--foreground-muted)" }}>
                    {showBefore ? "אחרי ←" : "לפני"}
                  </button>
                )}
              </div>
            </div>

            {!img ? (
              <div style={{ textAlign: "center", padding: "4rem 1rem", color: "var(--foreground-muted)" }}>
                <div style={{ fontSize: 36, marginBottom: 10 }}>🎨</div>
                <div style={{ fontSize: 14, fontWeight: 700 }}>אין קריאייטיבים עדיין</div>
                <div style={{ fontSize: 12.5, marginTop: 4 }}>העלה תמונה כדי להתחיל</div>
              </div>
            ) : showBefore ? (
              <div style={{ display: "flex", justifyContent: "center", background: "var(--surface)", borderRadius: 12, padding: 12 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img.src} alt="מקור" style={{ maxWidth: "100%", maxHeight: 480, objectFit: "contain", borderRadius: 8 }} />
              </div>
            ) : engine === "ai" ? (
              /* ── Review board: every selected format side-by-side. Each version
                 has its own fix-note + "אשר גודל" lock. Export unlocks only when
                 all selected formats are approved. ── */
              <div>
                {allApproved && (
                  <div style={{ background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.4)", borderRadius: 10, padding: "0.6rem 0.9rem", marginBottom: 12, fontSize: 12.5, fontWeight: 700, color: "#059669", textAlign: "center" }}>
                    ✓ כל הגדלים אושרו — אפשר לייצא / לשמור ללקוח / להוריד למטה
                  </div>
                )}
                <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(selectedFormats.length, 3)}, 1fr)`, gap: 14 }}>
                  {FORMATS.filter((f) => selectedFormats.includes(f.id)).map((f) => {
                    const fLabel = f.id === "story" ? "Story 9:16" : f.id === "feed_4_5" ? "Feed 4:5" : "Square 1:1";
                    const busy = aiGenerating === f.id || fixingFormat === f.id;
                    const result = aiResults[f.id];
                    const approved = !!approvedFormats[f.id];
                    const warn = aiTextWarn[f.id] || [];
                    return (
                      <div key={f.id} style={{ borderRadius: 14, border: `2px solid ${approved ? "#10b981" : "var(--border)"}`, background: "var(--surface)", overflow: "hidden", display: "flex", flexDirection: "column" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.5rem 0.7rem", background: approved ? "rgba(16,185,129,0.08)" : "var(--surface-raised)", borderBottom: "1px solid var(--border)" }}>
                          <span style={{ fontSize: 12, fontWeight: 800, color: approved ? "#059669" : "var(--foreground)" }}>{approved ? "🔒 " : ""}{fLabel}</span>
                          <span style={{ fontSize: 10, color: "var(--foreground-muted)" }}>{f.width}×{f.height}</span>
                        </div>
                        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 10, minHeight: 160, background: "var(--background)" }}>
                          {busy ? (
                            <div style={{ textAlign: "center", color: BRAND, fontSize: 12, fontWeight: 700 }}>⏳ {fixingFormat === f.id ? "מתקן…" : "יוצר…"}<div style={{ fontSize: 10, color: "var(--foreground-muted)", marginTop: 4 }}>20-40 שניות</div></div>
                          ) : result ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={result} alt={fLabel} style={{ maxWidth: "100%", maxHeight: 360, borderRadius: 8, display: "block" }} />
                          ) : (
                            <div style={{ textAlign: "center", color: "var(--foreground-muted)", fontSize: 11.5 }}>
                              עוד לא נוצר<div style={{ marginTop: 8 }}><button className="mod-btn-primary ux-btn" onClick={() => generateAIFor(f.id)} disabled={!img || !!aiGenerating} style={{ fontSize: 11.5 }}>✨ צור {fLabel}</button></div>
                            </div>
                          )}
                        </div>
                        {result && (
                          <div style={{ padding: "0.6rem 0.7rem", display: "flex", flexDirection: "column", gap: 7, borderTop: "1px solid var(--border)" }}>
                            {warn.length > 0 && !approved && (
                              <div style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 8, padding: "0.4rem 0.55rem", fontSize: 10.5 }}>
                                <div style={{ fontWeight: 800, color: "#dc2626", marginBottom: 2 }}>⚠️ ייתכן שיבוש טקסט:</div>
                                <div style={{ color: "#b45309", lineHeight: 1.5 }}>{warn.slice(0, 4).map((t, i) => <div key={i}>• {t}</div>)}</div>
                                <button onClick={() => { if (detectedTexts && !manualTexts.trim()) setManualTexts(detectedTexts); setShowTextEditor(true); window.scrollTo({ top: 0, behavior: "smooth" }); }} style={{ marginTop: 4, background: "none", border: "none", color: "#dc2626", fontWeight: 700, fontSize: 10.5, cursor: "pointer", padding: 0, textDecoration: "underline" }}>
                                  זיהוי שגוי? תקן את טקסט המקור ←
                                </button>
                              </div>
                            )}
                            {approved ? (
                              <button className="mod-btn-ghost ux-btn" onClick={() => setApprovedFormats((a) => { const n = { ...a }; delete n[f.id]; return n; })} style={{ fontSize: 11.5, color: "#059669" }}>
                                🔓 בטל אישור — ערוך שוב
                              </button>
                            ) : (
                              <>
                                <div style={{ display: "flex", gap: 6 }}>
                                  <input
                                    className="form-input ux-input"
                                    value={cardNote[f.id] || ""}
                                    onChange={(e) => setCardNote((n) => ({ ...n, [f.id]: e.target.value }))}
                                    onKeyDown={(e) => { if (e.key === "Enter" && (cardNote[f.id] || "").trim()) aiFixFor(f.id, cardNote[f.id] || ""); }}
                                    placeholder="הזן תיקון לגרסה זו…"
                                    style={{ flex: 1, fontSize: 11.5 }}
                                    disabled={busy}
                                  />
                                  <button className="mod-btn-ghost ux-btn" onClick={() => aiFixFor(f.id, cardNote[f.id] || "")} disabled={busy || !(cardNote[f.id] || "").trim()} style={{ fontSize: 11.5, whiteSpace: "nowrap", opacity: busy || !(cardNote[f.id] || "").trim() ? 0.5 : 1 }}>
                                    תקן ✨
                                  </button>
                                  {prevAiResultRef.current[f.id] && (
                                    <button className="mod-btn-ghost ux-btn" onClick={() => undoAiFixFor(f.id)} disabled={busy} title="החזר גרסה קודמת" style={{ fontSize: 11.5 }}>↩</button>
                                  )}
                                </div>
                                {/* Start over for THIS size — if the fix-note can't salvage it,
                                    regenerate from scratch from the original (fresh attempt). */}
                                <button className="mod-btn-ghost ux-btn" onClick={() => generateAIFor(f.id)} disabled={busy || !img || !!aiGenerating} title="התחל מחדש — יצירה חדשה מאפס מהמקור" style={{ fontSize: 11.5, opacity: busy || !!aiGenerating ? 0.5 : 1 }}>
                                  🔄 צור גודל מחדש
                                </button>
                                <button className="mod-btn-primary ux-btn" onClick={() => setApprovedFormats((a) => ({ ...a, [f.id]: true }))} disabled={busy} style={{ fontSize: 12, background: "#10b981", opacity: busy ? 0.5 : 1 }}>
                                  ✓ אשר גודל
                                </button>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", justifyContent: "center", background: "var(--surface)", borderRadius: 12, padding: 12 }}>
                {FORMATS.map((f) => (
                  <canvas
                    key={f.id}
                    ref={(el) => { canvasRefs.current[f.id] = el; }}
                    style={{
                      display: selectedFormats.includes(f.id) && activeFormat === f.id ? "block" : "none",
                      maxWidth: "100%", maxHeight: 520, borderRadius: 10,
                      aspectRatio: `${f.width} / ${f.height}`,
                    }}
                  />
                ))}
              </div>
            )}
          </div>

          {/* 7.5 Canvas refine-by-note — AI mode fixes live per-card on the board above */}
          {engine !== "ai" && (
          <div className="premium-card" style={{ padding: "1.25rem" }}>
            <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 4, color: "var(--foreground)" }}>🛠 תיקון לפי הערה</div>
            <div style={{ fontSize: 11.5, color: "var(--foreground-muted)", marginBottom: 10 }}>
              כתוב מה לא טוב בתוצאה (״גדול מדי״, ״תוריד למטה״, ״רקע כהה יותר״…) — ה-AI יכוון את ההגדרות והתצוגה תתעדכן מיד.
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                className="form-input ux-input"
                value={refineNote}
                onChange={(e) => setRefineNote(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") applyRefine(); }}
                placeholder="למשל: הקריאייטיב קטן מדי והרקע בהיר מדי"
                style={{ flex: 1, fontSize: 13 }}
                disabled={!img || refining}
              />
              <button className="mod-btn-primary ux-btn" onClick={applyRefine} disabled={!img || refining || !refineNote.trim()}
                style={{ fontSize: 12.5, whiteSpace: "nowrap", opacity: !img || refining || !refineNote.trim() ? 0.5 : 1 }}>
                {refining ? "⏳ מתקן…" : "תקן ✨"}
              </button>
            </div>
            {refineLog.length > 0 && (
              <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 5 }}>
                {refineLog.map((r, i) => (
                  <div key={i} style={{ fontSize: 11, color: "var(--foreground-muted)", background: "var(--surface)", borderRadius: 8, padding: "0.4rem 0.6rem" }}>
                    <span style={{ fontWeight: 700, color: "var(--foreground)" }}>"{r.note}"</span> ← {r.explanation}
                  </div>
                ))}
              </div>
            )}
          </div>
          )}

          {/* 8. Export — in AI mode, locked until every selected size is approved */}
          {(() => {
            const aiGate = engine === "ai";
            const exportLocked = aiGate && !allApproved;
            return (
          <div className="premium-card" style={{ padding: "1.25rem", opacity: exportLocked ? 0.55 : 1 }}>
            <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 12, color: "var(--foreground)" }}>
              ייצוא ושמירה
              {exportLocked && <span style={{ fontSize: 11.5, fontWeight: 600, color: "var(--foreground-muted)", marginInlineStart: 8 }}>🔒 אשר את כל הגדלים כדי לפתוח</span>}
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button className="mod-btn-primary ux-btn" disabled={!img || exporting || exportLocked} onClick={() => exportOne("image/png")} style={{ fontSize: 12.5, opacity: !img || exporting || exportLocked ? 0.5 : 1 }}>
                ⬇ PNG ({activeFormat === "story" ? "Story" : activeFormat === "feed_4_5" ? "4:5" : "Square"})
              </button>
              <button className="mod-btn-ghost ux-btn" disabled={!img || exporting || exportLocked} onClick={() => exportOne("image/jpeg")} style={{ fontSize: 12.5, opacity: !img || exporting || exportLocked ? 0.5 : 1 }}>
                ⬇ JPG
              </button>
              <button className="mod-btn-ghost ux-btn" disabled={!img || exporting || exportLocked || selectedFormats.length === 0} onClick={exportZip} style={{ fontSize: 12.5, opacity: !img || exporting || exportLocked ? 0.5 : 1 }}>
                {exporting ? "⏳ מייצא…" : "📦 הכל כ-ZIP"}
              </button>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 14, flexWrap: "wrap" }}>
              <select className="form-select ux-input" value={saveClientId} onChange={(e) => setSaveClientId(e.target.value)} style={{ fontSize: 12.5, minWidth: 170 }}>
                <option value="">ללא שיוך לקוח</option>
                {(clients || []).map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <button className="mod-btn-primary ux-btn ux-btn-glow" disabled={!img || saving || exportLocked} onClick={saveToAssets} style={{ fontSize: 12.5, background: "#10b981", opacity: !img || saving || exportLocked ? 0.5 : 1 }}>
                {saving ? "⏳ שומר נכסים…" : "💾 שמור לנכסי קמפיין"}
              </button>
            </div>
          </div>
            );
          })()}

          {/* History */}
          <div className="premium-card" style={{ padding: "1.25rem" }}>
            <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 12, color: "var(--foreground)" }}>היסטוריה</div>
            {historyLoading ? (
              <div style={{ fontSize: 12.5, color: "var(--foreground-muted)" }}>⏳ טוען…</div>
            ) : history.length === 0 ? (
              <div style={{ fontSize: 12.5, color: "var(--foreground-muted)" }}>לא נוצרו פורמטים עדיין</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {history.slice(0, 12).map((row) => (
                  <div key={row.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "0.55rem 0.7rem", borderRadius: 10, background: "var(--surface)", border: "1px solid var(--border)" }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--foreground)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.original_file_name || "קריאייטיב"}</div>
                      <div style={{ fontSize: 10.5, color: "var(--foreground-muted)" }}>
                        {new Date(row.created_at).toLocaleDateString("he-IL")} · {(row.selected_formats || []).join(", ")} · {row.status === "completed" ? "✓ הושלם" : row.status}
                      </div>
                    </div>
                    {row.outputs?.[0] && (
                      <a href={row.outputs[0].output_asset_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11.5, fontWeight: 700, color: BRAND, textDecoration: "none" }}>פתח</a>
                    )}
                    <button onClick={() => downloadHistoryZip(row)} style={{ fontSize: 11.5, fontWeight: 700, color: "var(--foreground)", background: "none", border: "1px solid var(--border)", borderRadius: 7, padding: "0.2rem 0.6rem", cursor: "pointer" }}>⬇ ZIP</button>
                    <button onClick={() => deleteAdaptation(row.id)} style={{ fontSize: 11.5, color: "#f87171", background: "none", border: "none", cursor: "pointer" }}>✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
