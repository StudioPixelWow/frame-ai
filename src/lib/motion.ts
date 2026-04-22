/**
 * PixelManageAI — Motion Utility System
 *
 * Reusable motion primitives for success feedback, branded confetti,
 * error animation, and toast notifications.
 *
 * Usage:
 *   import { triggerSuccessAnimation, fireConfetti, showToast, shakeElement } from '@/lib/motion';
 *
 *   triggerSuccessAnimation('major');  // confetti + toast
 *   triggerSuccessAnimation('minor');  // toast only
 *   fireConfetti();                   // standalone confetti
 *   showToast('Saved!', 'success');   // premium toast
 *   shakeElement(inputRef.current);   // error shake
 */

// ── Brand palette for confetti ──────────────────────────────────────────
const BRAND_COLORS = [
  "#02AFFE", // primary blue
  "#05E2FF", // cyan
  "#00B5FE", // accent
  "#F0FF02", // CTA lime
  "#C8FF00", // CTA green
  "#ffffff", // white accent
];

// ── Confetti ────────────────────────────────────────────────────────────
interface ConfettiOptions {
  count?: number;
  duration?: number;
  spread?: number;
  colors?: string[];
}

export function fireConfetti(options: ConfettiOptions = {}): void {
  if (typeof document === "undefined") return;

  const {
    count = 40,
    duration = 2800,
    spread = 200,
    colors = BRAND_COLORS,
  } = options;

  const container = document.createElement("div");
  container.style.cssText = "position:fixed;inset:0;pointer-events:none;z-index:10001;overflow:hidden;";
  document.body.appendChild(container);

  for (let i = 0; i < count; i++) {
    const piece = document.createElement("div");
    piece.className = "pm-confetti-piece";

    const color = colors[Math.floor(Math.random() * colors.length)];
    const size = 5 + Math.random() * 6;
    const drift = (Math.random() - 0.5) * spread;
    const spin = 360 + Math.random() * 720;
    const dur = (duration * 0.7 + Math.random() * duration * 0.6) / 1000;
    const delay = Math.random() * 0.3;
    const startX = 30 + Math.random() * 40; // % from left
    const isCircle = Math.random() > 0.6;

    piece.style.cssText = `
      left: ${startX}%;
      --c-color: ${color};
      --c-size: ${size}px;
      --c-drift: ${drift}px;
      --c-spin: ${spin}deg;
      --c-dur: ${dur}s;
      --c-radius: ${isCircle ? "50%" : "2px"};
      animation-delay: ${delay}s;
    `;

    container.appendChild(piece);
  }

  setTimeout(() => container.remove(), duration + 500);
}

// ── Success animation ───────────────────────────────────────────────────
export function triggerSuccessAnimation(
  type: "minor" | "major",
  message?: string,
): void {
  if (type === "major") {
    fireConfetti({ count: 35, duration: 2500 });
    showToast(message ?? "הושלם בהצלחה!", "success", 4000);
  } else {
    showToast(message ?? "נשמר בהצלחה", "success", 3000);
  }
}

// ── Toast ────────────────────────────────────────────────────────────────
type ToastType = "success" | "error" | "warning" | "info";

const TOAST_ICONS: Record<ToastType, string> = {
  success: "✓",
  error: "✕",
  warning: "⚠",
  info: "ℹ",
};

let activeToast: HTMLElement | null = null;

export function showToast(
  message: string,
  type: ToastType = "info",
  duration = 4000,
): void {
  if (typeof document === "undefined") return;

  // Remove existing toast
  if (activeToast) {
    activeToast.classList.add("pm-toast-exit");
    const old = activeToast;
    setTimeout(() => old.remove(), 300);
  }

  const toast = document.createElement("div");
  toast.className = `pm-toast pm-toast-${type}`;
  toast.innerHTML = `
    <span class="pm-toast-icon">${TOAST_ICONS[type]}</span>
    <span>${message}</span>
    <div class="pm-toast-progress" style="--toast-dur: ${duration}ms"></div>
  `;

  document.body.appendChild(toast);
  activeToast = toast;

  // Auto-dismiss
  const timer = setTimeout(() => {
    toast.classList.add("pm-toast-exit");
    setTimeout(() => {
      toast.remove();
      if (activeToast === toast) activeToast = null;
    }, 300);
  }, duration);

  // Click to dismiss
  toast.addEventListener("click", () => {
    clearTimeout(timer);
    toast.classList.add("pm-toast-exit");
    setTimeout(() => {
      toast.remove();
      if (activeToast === toast) activeToast = null;
    }, 300);
  });
}

// ── Element animations ──────────────────────────────────────────────────

/** Shake an element (e.g., invalid form field) */
export function shakeElement(el: HTMLElement | null): void {
  if (!el) return;
  el.classList.remove("pm-shake");
  // Force reflow to restart animation
  void el.offsetWidth;
  el.classList.add("pm-shake");
  el.addEventListener("animationend", () => el.classList.remove("pm-shake"), { once: true });
}

/** Flash an error pulse on an element */
export function errorPulse(el: HTMLElement | null): void {
  if (!el) return;
  el.classList.remove("pm-error-pulse");
  void el.offsetWidth;
  el.classList.add("pm-error-pulse");
  el.addEventListener("animationend", () => el.classList.remove("pm-error-pulse"), { once: true });
}

/** Flash a success glow on an element */
export function successGlow(el: HTMLElement | null): void {
  if (!el) return;
  el.classList.remove("pm-success-glow");
  void el.offsetWidth;
  el.classList.add("pm-success-glow");
  el.addEventListener("animationend", () => el.classList.remove("pm-success-glow"), { once: true });
}

/** Flash a data-updated highlight on an element */
export function dataFlash(el: HTMLElement | null): void {
  if (!el) return;
  el.classList.remove("pm-data-updated");
  void el.offsetWidth;
  el.classList.add("pm-data-updated");
  el.addEventListener("animationend", () => el.classList.remove("pm-data-updated"), { once: true });
}

/** Add birth animation to a newly created element */
export function animateNewItem(el: HTMLElement | null): void {
  if (!el) return;
  el.classList.add("pm-item-born");
  el.addEventListener("animationend", () => el.classList.remove("pm-item-born"), { once: true });
}
