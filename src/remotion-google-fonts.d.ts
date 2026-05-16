/**
 * Type declarations for @remotion/google-fonts subpath imports.
 * These are needed because bundler moduleResolution doesn't always
 * resolve the package's per-font export maps correctly.
 */
declare module "@remotion/google-fonts/Heebo" {
  export function loadFont(
    style?: string,
    options?: { weights?: string[]; subsets?: string[] }
  ): { fontFamily: string };
}

declare module "@remotion/google-fonts/Rubik" {
  export function loadFont(
    style?: string,
    options?: { weights?: string[]; subsets?: string[] }
  ): { fontFamily: string };
}

declare module "@remotion/google-fonts/Assistant" {
  export function loadFont(
    style?: string,
    options?: { weights?: string[]; subsets?: string[] }
  ): { fontFamily: string };
}

declare module "@remotion/google-fonts/Inter" {
  export function loadFont(
    style?: string,
    options?: { weights?: string[]; subsets?: string[] }
  ): { fontFamily: string };
}
