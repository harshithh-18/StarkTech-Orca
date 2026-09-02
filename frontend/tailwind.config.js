/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],

  // Class strategy, not media: the user's explicit choice must win over the OS, and a
  // demo laptop's OS theme is rarely the one you want on a projector.
  darkMode: "class",

  theme: {
    extend: {
      colors: {
        // ── Verdict ───────────────────────────────────────────────────────
        // The fisherman should recognise the colour before reading the word, so these
        // stay semantic (green / amber / red) however vibrant the rest of the UI gets.
        // `dark` variants are lifted for contrast against a navy background.
        verdict: {
          go: "#059669",
          "go-dark": "#34d399",
          caution: "#d97706",
          "caution-dark": "#fbbf24",
          nogo: "#dc2626",
          "nogo-dark": "#f87171",
        },

        // ── Ocean: the brand spine, deep navy → bright cyan ────────────────
        ocean: {
          50: "#ecfeff",
          100: "#cffafe",
          200: "#a5f3fc",
          300: "#67e8f9",
          400: "#22d3ee",
          500: "#06b6d4",
          600: "#0891b2",
          700: "#0e7490",
          800: "#155e75",
          900: "#164e63",
          950: "#083344",
          // Legacy aliases so existing markup keeps working.
          deep: "#0c2340",
          mid: "#0891b2",
          light: "#ecfeff",
        },

        // ── Abyss: dark-mode surfaces, blue-tinted rather than flat grey ───
        abyss: {
          50: "#f8fafc",
          800: "#111c30",
          850: "#0d1626",
          900: "#0a111e",
          950: "#060b14",
        },

        // ── Coral: the accent that stops everything reading as blue ────────
        coral: {
          300: "#fda4a0",
          400: "#fb7185",
          500: "#f43f5e",
          600: "#e11d48",
        },

        // ── Kelp: productivity / chlorophyll ───────────────────────────────
        kelp: {
          300: "#86efac",
          400: "#4ade80",
          500: "#22c55e",
          600: "#16a34a",
        },
      },

      fontFamily: {
        // Indic scripts need a fallback chain — a missing-glyph box in the middle of a
        // Telugu answer is a demo-killer.
        sans: [
          "Inter var",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Noto Sans",
          "Noto Sans Telugu",
          "Noto Sans Tamil",
          "Noto Sans Malayalam",
          "Noto Sans Bengali",
          "Noto Sans Devanagari",
          "sans-serif",
        ],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },

      // ── Motion ──────────────────────────────────────────────────────────
      // `fade-in` and `spin-slow` were referenced by the trace panel but never defined,
      // so every "new step arrives" animation was silently a no-op.
      keyframes: {
        "fade-in": {
          "0%": { opacity: "0", transform: "translateY(4px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "slide-up": {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "slide-in-right": {
          "0%": { opacity: "0", transform: "translateX(16px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
        "pulse-ring": {
          "0%": { transform: "scale(0.9)", opacity: "0.7" },
          "70%": { transform: "scale(1.6)", opacity: "0" },
          "100%": { transform: "scale(1.6)", opacity: "0" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        "gradient-drift": {
          "0%, 100%": { backgroundPosition: "0% 50%" },
          "50%": { backgroundPosition: "100% 50%" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.28s ease-out",
        "slide-up": "slide-up 0.32s cubic-bezier(0.22, 1, 0.36, 1)",
        "slide-in-right": "slide-in-right 0.3s cubic-bezier(0.22, 1, 0.36, 1)",
        "spin-slow": "spin 1.6s linear infinite",
        "pulse-ring": "pulse-ring 1.8s cubic-bezier(0.24, 0, 0.38, 1) infinite",
        shimmer: "shimmer 1.8s linear infinite",
        "gradient-drift": "gradient-drift 12s ease infinite",
      },

      boxShadow: {
        glow: "0 0 24px -4px rgb(34 211 238 / 0.45)",
        "glow-danger": "0 0 24px -4px rgb(248 113 113 / 0.5)",
        card: "0 1px 2px rgb(0 0 0 / 0.04), 0 8px 24px -8px rgb(8 51 68 / 0.18)",
      },

      backgroundImage: {
        "ocean-gradient": "linear-gradient(135deg, #083344 0%, #0e7490 50%, #06b6d4 100%)",
        "abyss-gradient": "linear-gradient(135deg, #060b14 0%, #0d1626 55%, #164e63 100%)",
      },
    },
  },

  plugins: [],
};
