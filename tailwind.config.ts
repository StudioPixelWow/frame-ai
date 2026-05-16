import type { Config } from "tailwindcss";

/**
 * FrameAI Tailwind Configuration
 *
 * All color tokens reference CSS custom properties from globals.css
 * so they respond to the data-theme attribute (dark / light).
 */

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // ── Base surface tokens (driven by CSS vars → theme-aware) ─────────
        background:         "var(--background)",
        surface:            "var(--surface)",
        "surface-raised":   "var(--surface-raised)",
        foreground:         "var(--foreground)",
        "foreground-muted": "var(--foreground-muted)",
        "foreground-subtle":"var(--foreground-subtle)",
        border:             "var(--border)",
        "border-muted":     "var(--border-muted)",

        // ── Accent (Studio Pixel) ─────────────────────────────────────────
        accent: {
          DEFAULT:      "var(--accent)",
          hover:        "var(--accent-hover)",
          active:       "var(--accent-active)",
          muted:        "var(--accent-muted)",
          "muted-hover":"var(--accent-muted-hover)",
          border:       "var(--accent-border)",
          ring:         "var(--accent-ring)",
          text:         "var(--accent-text)",
        },

        // ── Secondary accent / CTA ────────────────────────────────────────
        accent2: "var(--accent2)",
        yellow:  "var(--yellow)",

        // ── Neon brand colors ─────────────────────────────────────────────
        neon: {
          yellow:  "var(--neon-yellow)",
          border:  "var(--neon-border)",
          "border-subtle": "var(--neon-border-subtle)",
        },
        cyan: {
          DEFAULT: "#02AFFE",
          light:   "#05E2FF",
          soft:    "#7DD3FC",
        },

        // ── Semantic ──────────────────────────────────────────────────────
        success: "var(--success)",
        warning: "var(--warning)",
        error:   "var(--error)",
      },

      // ── Ring ──────────────────────────────────────────────────────────
      ringWidth: {
        DEFAULT: "2px",
        "3": "3px",
      },
      ringColor: {
        DEFAULT: "var(--accent-ring)",
        accent:  "var(--accent-ring)",
      },

      // ── Border radius ─────────────────────────────────────────────────
      borderRadius: {
        sm:      "0.25rem",
        DEFAULT: "0.375rem",
        md:      "0.5rem",
        lg:      "0.75rem",
        xl:      "1rem",
      },

      // ── Box shadows (neon glow) ────────────────────────────────────────
      boxShadow: {
        "neon-sm":  "var(--neon-glow-sm)",
        "neon-md":  "var(--neon-glow-md)",
        "neon-lg":  "var(--neon-glow-lg)",
        card:       "var(--shadow-card)",
        "card-hover": "var(--shadow-card-hover)",
        elevated:   "var(--shadow-elevated)",
      },

      // ── Transitions ───────────────────────────────────────────────────
      transitionDuration: {
        DEFAULT: "150ms",
        fast:    "100ms",
        slow:    "300ms",
      },
    },
  },
  plugins: [],
};

export default config;
