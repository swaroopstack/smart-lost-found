import type { Config } from "tailwindcss";

/**
 * Design tokens generated with the UI/UX Pro Max design-system engine
 * (query: "campus lost and found education dashboard", variance 4, motion 4,
 * density 7). Semantic names only - components never use raw hex values.
 */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: "#F0FDFA",
        surface: {
          DEFAULT: "#FFFFFF",
          muted: "#F6FBFB",
          sunken: "#E8F1F4",
        },
        ink: {
          DEFAULT: "#134E4A",
          strong: "#0B2B28",
          soft: "#3F6F6B",
        },
        muted: {
          DEFAULT: "#E8F1F4",
          fg: "#475569",
        },
        line: {
          DEFAULT: "#E1EEED",
          strong: "#5EEAD4",
        },
        brand: {
          DEFAULT: "#0D9488",
          strong: "#0F766E",
          soft: "#CCFBF1",
          ink: "#134E4A",
        },
        accent: {
          DEFAULT: "#D97706",
          strong: "#B45309",
          soft: "#FEF3C7",
        },
        danger: {
          DEFAULT: "#DC2626",
          strong: "#B91C1C",
          soft: "#FEE2E2",
        },
        success: {
          DEFAULT: "#15803D",
          strong: "#166534",
          soft: "#DCFCE7",
        },
        info: {
          DEFAULT: "#1D4ED8",
          strong: "#1E40AF",
          soft: "#DBEAFE",
        },
      },
      fontFamily: {
        sans: ['"Fira Sans"', "ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
        mono: ['"Fira Code"', "ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      fontSize: {
        "2xs": ["0.6875rem", { lineHeight: "1rem" }],
      },
      boxShadow: {
        card: "0 1px 2px rgba(19, 78, 74, 0.04), 0 1px 3px rgba(19, 78, 74, 0.06)",
        raised: "0 4px 12px -4px rgba(19, 78, 74, 0.12), 0 2px 4px -2px rgba(19, 78, 74, 0.08)",
        pop: "0 18px 40px -18px rgba(19, 78, 74, 0.35), 0 8px 16px -12px rgba(19, 78, 74, 0.2)",
      },
      keyframes: {
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "slide-up": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "scale-in": {
          from: { opacity: "0", transform: "scale(0.97)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
      },
      animation: {
        "fade-in": "fade-in 180ms ease-out both",
        "slide-up": "slide-up 220ms cubic-bezier(0.16, 1, 0.3, 1) both",
        "scale-in": "scale-in 160ms cubic-bezier(0.16, 1, 0.3, 1) both",
      },
      transitionTimingFunction: {
        "out-quint": "cubic-bezier(0.16, 1, 0.3, 1)",
      },
    },
  },
  plugins: [],
} satisfies Config;
