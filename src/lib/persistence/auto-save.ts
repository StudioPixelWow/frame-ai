/**
 * PixelFrameAI — Auto-Save Utilities
 *
 * Provides debounced auto-save wiring for wizard state.
 *
 * Save triggers:
 * - wizNext() step advance → immediate save (no debounce)
 * - Field edits (prompt, subtitle text, clip handles) → 3s debounce
 * - "Save Draft" button → immediate save
 * - Approval → immediate save with renderPayloadSnapshot
 *
 * What does NOT trigger a save:
 * - Step navigation backwards (wizPrev)
 * - Hover, focus, tooltip interactions
 * - Transient UI progress flags (_nf.analyzing, _nf.processing, etc.)
 */

const AUTO_SAVE_DELAY_MS = 3000;

type SaveFunction = () => Promise<void>;

interface AutoSaveController {
  /** Schedule a debounced save (resets timer on each call). */
  schedule: () => void;
  /** Save immediately (cancels pending debounced save). */
  saveNow: () => Promise<void>;
  /** Cancel any pending debounced save. */
  cancel: () => void;
  /** Whether a save is currently in flight. */
  isSaving: boolean;
}

/**
 * Create an auto-save controller wrapping a save function.
 *
 * @param saveFn  The async function that performs the actual API PATCH.
 * @param delayMs Debounce delay in milliseconds (default: 3000).
 */
export function createAutoSave(
  saveFn: SaveFunction,
  delayMs: number = AUTO_SAVE_DELAY_MS,
): AutoSaveController {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let saving = false;

  const controller: AutoSaveController = {
    get isSaving() {
      return saving;
    },

    schedule() {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        controller.saveNow().catch(() => {
          // Non-blocking — UI continues normally; next save will retry
        });
      }, delayMs);
    },

    async saveNow() {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      if (saving) return; // don't stack saves
      saving = true;
      try {
        await saveFn();
      } finally {
        saving = false;
      }
    },

    cancel() {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    },
  };

  return controller;
}
