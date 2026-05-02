/**
 * WOW Moment System — Cinematic celebrations for key actions
 *
 * Usage:
 *   import { wow } from '@/lib/wow';
 *   wow.campaignCreated();
 *   wow.aiGenerated();
 *   wow.uploadComplete();
 *   wow.leadAssigned();
 *   wow.reportReady();
 *   wow.custom({ flash: true, rings: true, confetti: true, sound: 'success' });
 */

import { fireConfetti } from "@/lib/confetti";
import { sound } from "@/lib/sound-feedback";

interface WowOptions {
  flash?: boolean;
  rings?: boolean;
  confetti?: boolean | number;
  sound?: "success" | "aiSparkle" | "pop";
}

function createFlash() {
  const el = document.createElement("div");
  el.className = "ux-wow-flash";
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1300);
}

function createRings(count = 3) {
  for (let i = 0; i < count; i++) {
    const ring = document.createElement("div");
    ring.className = "ux-wow-ring";
    ring.style.animationDelay = `${i * 150}ms`;
    // Vary the border color per ring
    const colors = [
      "rgba(0,181,254,0.5)",
      "rgba(0,181,254,0.4)",
      "rgba(0,217,255,0.3)",
    ];
    ring.style.borderColor = colors[i % colors.length];
    document.body.appendChild(ring);
    setTimeout(() => ring.remove(), 1200);
  }
}

function runWow(options: WowOptions) {
  if (options.flash) createFlash();
  if (options.rings) createRings();
  if (options.confetti) {
    const count = typeof options.confetti === "number" ? options.confetti : 50;
    setTimeout(() => fireConfetti(count, 3500), 100);
  }
  if (options.sound) {
    sound[options.sound]();
  }
}

export const wow = {
  /** Campaign successfully created */
  campaignCreated() {
    runWow({ flash: true, rings: true, confetti: 60, sound: "success" });
  },

  /** AI variations / copy generated */
  aiGenerated() {
    runWow({ flash: true, confetti: 30, sound: "aiSparkle" });
  },

  /** File upload completed */
  uploadComplete() {
    runWow({ rings: true, sound: "success" });
  },

  /** Lead assigned to pipeline */
  leadAssigned() {
    runWow({ flash: true, sound: "pop" });
  },

  /** Report / analysis ready */
  reportReady() {
    runWow({ flash: true, rings: true, confetti: 40, sound: "success" });
  },

  /** Generic save success */
  saved() {
    runWow({ sound: "success" });
  },

  /** Custom wow moment */
  custom(options: WowOptions) {
    runWow(options);
  },
};
