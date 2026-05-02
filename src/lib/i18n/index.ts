/**
 * PixelManageAI — i18n Module
 *
 * Centralised locale access. Currently Hebrew-only (the app is RTL-first).
 * If multi-language support is needed later, this module becomes the
 * switching point — components always import `t` from here.
 *
 * Usage:
 *   import { t } from '@/lib/i18n';
 *
 *   <button>{t.actions.continue}</button>
 *   <h1>{t.core.projects}</h1>
 */

import * as he from "./he";

// ── Current locale ────────────────────────────────────────────────────────

export const LOCALE = "he" as const;
export const DIR = "rtl" as const;
export const LANG = "he" as const;

// ── Translation accessor ──────────────────────────────────────────────────

/**
 * The translation dictionary. All UI strings are accessed through this
 * object. Namespaced by domain (core, actions, status, etc.).
 *
 * Example:
 *   t.core.project        → "פרויקט"
 *   t.actions.approve      → "אישור"
 *   t.toasts.renderComplete → "עיבוד הושלם — הוידאו מוכן"
 */
export const t = {
  core: he.core,
  roles: he.roles,
  wizardSteps: he.wizardSteps,
  status: he.status,
  nav: he.nav,
  actions: he.actions,
  subtitleModes: he.subtitleModes,
  subtitleStyle: he.subtitleStyle,
  reviewPanel: he.reviewPanel,
  transcriptEditor: he.transcriptEditor,
  projectReview: he.projectReview,
  processing: he.processing,
  toasts: he.toasts,
} as const;

// ── Type exports ──────────────────────────────────────────────────────────

export type TranslationDict = typeof t;
export type TranslationNamespace = keyof TranslationDict;
