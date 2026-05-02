/**
 * PixelManageAI — Remotion Font Loader
 *
 * Loads Google Fonts inside a Remotion `delayRender` block before
 * any composition frames are rendered. Without this, the first frames
 * render with a fallback system font.
 *
 * Usage (in PixelManageComposition):
 *   useEffect(() => {
 *     if (props.fontPreloads?.length) {
 *       loadFontsFromPayload(props.fontPreloads);
 *     }
 *   }, []);
 *
 * Font resolution happens at approval time (buildSubtitleRenderSpec).
 * This loader only executes the pre-computed import paths.
 *
 * RTL fonts (Hebrew, Arabic) load with correct subsets automatically
 * based on the `isRTL` flag in the font preload manifest.
 *
 * NOTE: This module uses Remotion APIs (delayRender/continueRender)
 * and is only importable inside the Remotion bundle environment.
 */

import type { FontPreload } from "@/types/remotion-handoff";

/**
 * Dynamically load fonts from the preload manifest.
 *
 * Each font gets its own `delayRender` handle — Remotion waits for
 * all handles to resolve before rendering any frame. On failure,
 * `continueRender` is still called so the render proceeds with
 * fallback fonts rather than hanging indefinitely.
 *
 * @param fontPreloads  Array of font preload entries from _remotion.fontPreloads
 * @param delayRenderFn   Remotion's delayRender (injected for testability)
 * @param continueRenderFn Remotion's continueRender (injected for testability)
 */
export function loadFontsFromPayload(
  fontPreloads: FontPreload[],
  delayRenderFn: (label: string) => number,
  continueRenderFn: (handle: number) => void,
): void {
  for (const preload of fontPreloads) {
    const handle = delayRenderFn(`Loading font: ${preload.family}`);

    // Dynamic import — the remotionImport string is the package path
    // '@remotion/google-fonts/Inter' → import('@remotion/google-fonts/Inter')
    import(/* @vite-ignore */ preload.remotionImport)
      .then(
        (mod: { loadFont: (opts: { weights: string[]; subsets: string[] }) => void }) => {
          mod.loadFont({
            weights: [preload.weight],
            subsets: preload.isRTL ? ["hebrew", "arabic"] : ["latin"],
          });
          return undefined;
        },
      )
      .then(() => continueRenderFn(handle))
      .catch((err: unknown) => {
        console.error(
          `Font load failed for ${preload.family}:`,
          err instanceof Error ? err.message : err,
        );
        // Continue even on failure — fallback font renders instead of hanging
        continueRenderFn(handle);
      });
  }
}
