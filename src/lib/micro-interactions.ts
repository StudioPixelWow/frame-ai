"use client";

/* ═══════════════════════════════════════════════════════════════════════════
   Micro-interactions — Lightweight utility for delightful UI feedback

   Usage:
     import { microInteractions } from '@/lib/micro-interactions';
     microInteractions.confetti();
     microInteractions.successPulse(element);
     microInteractions.ripple(event);
   ═══════════════════════════════════════════════════════════════════════════ */

/** Trigger confetti burst (for new client, milestone completion, etc.) */
function confetti(options?: {
  origin?: { x: number; y: number };
  count?: number;
  colors?: string[];
  spread?: number;
}) {
  const {
    origin = { x: 0.5, y: 0.5 },
    count = 40,
    colors = ["#00B5FE", "#F0FF02", "#22c55e", "#a78bfa", "#f472b6", "#fbbf24"],
    spread = 360,
  } = options || {};

  const container = document.createElement("div");
  container.style.cssText = `
    position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
    pointer-events: none; z-index: 999999; overflow: hidden;
  `;
  document.body.appendChild(container);

  const originX = window.innerWidth * origin.x;
  const originY = window.innerHeight * origin.y;

  for (let i = 0; i < count; i++) {
    const particle = document.createElement("div");
    const color = colors[Math.floor(Math.random() * colors.length)];
    const size = 4 + Math.random() * 6;
    const angle = (Math.random() * spread - spread / 2) * (Math.PI / 180);
    const velocity = 200 + Math.random() * 400;
    const dx = Math.cos(angle) * velocity;
    const dy = -Math.abs(Math.sin(angle) * velocity) - 100 - Math.random() * 200;
    const rotation = Math.random() * 720 - 360;
    const isCircle = Math.random() > 0.5;

    particle.style.cssText = `
      position: absolute;
      left: ${originX}px; top: ${originY}px;
      width: ${size}px; height: ${isCircle ? size : size * 0.6}px;
      background: ${color};
      border-radius: ${isCircle ? "50%" : "2px"};
      opacity: 1;
    `;
    container.appendChild(particle);

    const duration = 800 + Math.random() * 600;
    particle.animate(
      [
        { transform: "translate(0, 0) rotate(0deg)", opacity: 1 },
        { transform: `translate(${dx}px, ${dy + 500}px) rotate(${rotation}deg)`, opacity: 0 },
      ],
      { duration, easing: "cubic-bezier(0.25, 0.46, 0.45, 0.94)", fill: "forwards" }
    );
  }

  setTimeout(() => container.remove(), 2000);
}

/** Green pulse flash on an element (for success actions) */
function successPulse(element: HTMLElement | null) {
  if (!element) return;
  element.style.transition = "box-shadow 300ms ease, transform 200ms ease";
  element.style.boxShadow = "0 0 0 3px rgba(34, 197, 94, 0.4), 0 0 20px rgba(34, 197, 94, 0.2)";
  element.style.transform = "scale(1.02)";
  setTimeout(() => {
    element.style.boxShadow = "";
    element.style.transform = "";
  }, 600);
}

/** Error shake on an element */
function errorShake(element: HTMLElement | null) {
  if (!element) return;
  element.animate(
    [
      { transform: "translateX(0)" },
      { transform: "translateX(-6px)" },
      { transform: "translateX(6px)" },
      { transform: "translateX(-4px)" },
      { transform: "translateX(4px)" },
      { transform: "translateX(0)" },
    ],
    { duration: 400, easing: "ease-in-out" }
  );
}

/** Material ripple effect on click */
function ripple(event: React.MouseEvent<HTMLElement> | MouseEvent) {
  const target = event.currentTarget as HTMLElement;
  if (!target) return;

  const rect = target.getBoundingClientRect();
  const x = (event as MouseEvent).clientX - rect.left;
  const y = (event as MouseEvent).clientY - rect.top;
  const maxDim = Math.max(rect.width, rect.height);

  const rippleEl = document.createElement("span");
  rippleEl.style.cssText = `
    position: absolute; border-radius: 50%; pointer-events: none;
    width: ${maxDim * 2}px; height: ${maxDim * 2}px;
    left: ${x - maxDim}px; top: ${y - maxDim}px;
    background: rgba(255,255,255,0.15);
    transform: scale(0); opacity: 1;
  `;

  // Ensure parent has position for absolute ripple
  const prevPos = target.style.position;
  const prevOverflow = target.style.overflow;
  target.style.position = target.style.position || "relative";
  target.style.overflow = "hidden";
  target.appendChild(rippleEl);

  rippleEl.animate(
    [
      { transform: "scale(0)", opacity: 0.4 },
      { transform: "scale(1)", opacity: 0 },
    ],
    { duration: 500, easing: "ease-out", fill: "forwards" }
  );

  setTimeout(() => {
    rippleEl.remove();
    target.style.position = prevPos;
    target.style.overflow = prevOverflow;
  }, 500);
}

/** Notification pulse — add a pulsing dot to an element */
function notificationPulse(element: HTMLElement | null, color = "var(--error)") {
  if (!element) return;
  const dot = document.createElement("span");
  dot.className = "mi-notification-dot";
  dot.style.cssText = `
    position: absolute; top: -3px; right: -3px;
    width: 10px; height: 10px;
    background: ${color}; border-radius: 50%;
    animation: mi-pulse-ring 1.5s ease infinite;
    z-index: 10;
  `;
  element.style.position = element.style.position || "relative";
  element.appendChild(dot);
  return () => dot.remove();
}

/** Bounce-in animation for new elements */
function bounceIn(element: HTMLElement | null) {
  if (!element) return;
  element.animate(
    [
      { transform: "scale(0.3)", opacity: 0 },
      { transform: "scale(1.05)", opacity: 0.8 },
      { transform: "scale(0.97)", opacity: 1 },
      { transform: "scale(1)", opacity: 1 },
    ],
    { duration: 500, easing: "cubic-bezier(0.34, 1.56, 0.64, 1)", fill: "forwards" }
  );
}

/** Slide in from direction */
function slideIn(element: HTMLElement | null, direction: "up" | "down" | "left" | "right" = "up") {
  if (!element) return;
  const offsets: Record<string, string> = {
    up: "translateY(20px)",
    down: "translateY(-20px)",
    left: "translateX(20px)",   // RTL: positive = left
    right: "translateX(-20px)",
  };
  element.animate(
    [
      { transform: offsets[direction], opacity: 0 },
      { transform: "translate(0, 0)", opacity: 1 },
    ],
    { duration: 350, easing: "cubic-bezier(0.22, 1, 0.36, 1)", fill: "forwards" }
  );
}

/** Counter increment flash — briefly highlight a number change */
function counterFlash(element: HTMLElement | null, direction: "up" | "down" = "up") {
  if (!element) return;
  const color = direction === "up" ? "rgba(34, 197, 94, 0.15)" : "rgba(239, 68, 68, 0.15)";
  element.style.transition = "background-color 200ms ease";
  element.style.backgroundColor = color;
  element.style.borderRadius = "6px";
  setTimeout(() => {
    element.style.backgroundColor = "";
  }, 800);
}

/** Magnetic hover — element subtly follows cursor on hover */
function magneticHover(element: HTMLElement, strength = 0.15) {
  const handleMove = (e: MouseEvent) => {
    const rect = element.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = (e.clientX - cx) * strength;
    const dy = (e.clientY - cy) * strength;
    element.style.transform = `translate(${dx}px, ${dy}px)`;
  };
  const handleLeave = () => {
    element.style.transform = "";
    element.style.transition = "transform 0.3s ease";
    setTimeout(() => { element.style.transition = ""; }, 300);
  };
  element.addEventListener("mousemove", handleMove);
  element.addEventListener("mouseleave", handleLeave);
  return () => {
    element.removeEventListener("mousemove", handleMove);
    element.removeEventListener("mouseleave", handleLeave);
  };
}

export const microInteractions = {
  confetti,
  successPulse,
  errorShake,
  ripple,
  notificationPulse,
  bounceIn,
  slideIn,
  counterFlash,
  magneticHover,
};
