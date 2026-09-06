import type { Config } from "tailwindcss";

/**
 * Tailwind is a thin mapping onto the CSS custom properties in globals.css.
 * Changing a colour, radius or shadow happens there, once, and propagates
 * through every component in the product.
 */
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: "var(--background)",
        "canvas-deep": "var(--background-deep)",
        surface: "var(--surface)",
        "surface-muted": "var(--surface-secondary)",
        "surface-sunken": "var(--surface-sunken)",

        line: "var(--border)",
        "line-strong": "var(--border-strong)",

        ink: "var(--text)",
        "ink-soft": "var(--text-secondary)",
        "ink-muted": "var(--text-muted)",
        "ink-faint": "var(--text-faint)",
        "ink-inverse": "var(--text-inverse)",

        blush: {
          tint: "var(--blush-tint)",
          mid: "var(--blush-mid)",
          deep: "var(--blush-deep)",
          100: "var(--blush-tint)",
          300: "var(--blush-mid)",
          500: "var(--blush-deep)",
        },
        sky: {
          tint: "var(--sky-tint)",
          mid: "var(--sky-mid)",
          deep: "var(--sky-deep)",
          100: "var(--sky-tint)",
          300: "var(--sky-mid)",
          500: "var(--sky-deep)",
        },
        lilac: {
          tint: "var(--lilac-tint)",
          mid: "var(--lilac-mid)",
          deep: "var(--lilac-deep)",
          100: "var(--lilac-tint)",
          300: "var(--lilac-mid)",
          500: "var(--lilac-deep)",
        },
        butter: {
          tint: "var(--butter-tint)",
          mid: "var(--butter-mid)",
          deep: "var(--butter-deep)",
          100: "var(--butter-tint)",
          300: "var(--butter-mid)",
          500: "var(--butter-deep)",
        },
        mint: {
          tint: "var(--mint-tint)",
          mid: "var(--mint-mid)",
          deep: "var(--mint-deep)",
          100: "var(--mint-tint)",
          300: "var(--mint-mid)",
          500: "var(--mint-deep)",
        },
        peach: {
          tint: "var(--peach-tint)",
          mid: "var(--peach-mid)",
          deep: "var(--peach-deep)",
          100: "var(--peach-tint)",
          300: "var(--peach-mid)",
          500: "var(--peach-deep)",
        },
      },

      borderRadius: {
        xs: "var(--radius-xs)",
        sm: "var(--radius-sm)",
        DEFAULT: "var(--radius)",
        md: "var(--radius-sm)",
        lg: "var(--radius)",
        xl: "var(--radius)",
        "2xl": "var(--radius-lg)",
        "3xl": "var(--radius-lg)",
        "4xl": "var(--radius-xl)",
        "5xl": "var(--radius-2xl)",
        pill: "var(--radius-pill)",
      },

      boxShadow: {
        xs: "var(--shadow-xs)",
        sm: "var(--shadow-sm)",
        card: "var(--shadow)",
        "card-hover": "var(--shadow-lg)",
        pop: "var(--shadow-xl)",
        ring: "0 0 0 1px var(--border)",
      },

      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        serif: ["var(--font-serif)", "Georgia", "serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },

      letterSpacing: {
        tightest: "-0.042em",
        tighter: "-0.03em",
        wider: "0.16em",
      },

      maxWidth: {
        shell: "1180px",
        wide: "1400px",
        prose: "62ch",
      },

      transitionTimingFunction: {
        out: "var(--ease-out)",
        spring: "var(--ease-spring)",
      },

      spacing: {
        gutter: "var(--gutter)",
        section: "var(--section)",
      },
    },
  },
  plugins: [],
};

export default config;
