/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],

  darkMode: "class",

  theme: {
    extend: {
      colors: {
        // ── Safety Verdict ────────────────────────────────────────────────
        verdict: {
          go: "#059669",
          "go-dark": "#34d399",
          caution: "#d97706",
          "caution-dark": "#fbbf24",
          nogo: "#dc2626",
          "nogo-dark": "#f87171",
        },

        // ── Ocean: deep navy → azure → bright cyan ───────────────────────
        ocean: {
          50: "#f0f9ff",
          100: "#e0f2fe",
          200: "#bae6fd",
          300: "#7dd3fc",
          400: "#38bdf8",
          500: "#0ea5e9",
          600: "#0284c7",
          700: "#0369a1",
          800: "#075985",
          900: "#0c4a6e",
          950: "#082f49",
          // Legacy aliases
          deep: "#071a30",
          mid: "#0284c7",
          light: "#f0f9ff",
        },

        // ── Marine: seafoam & emerald (vital ocean life & productivity) ───
        marine: {
          50: "#f0fdfa",
          100: "#ccfbf1",
          200: "#99f6e4",
          300: "#5eead4",
          400: "#2dd4bf",
          500: "#14b8a6",
          600: "#0d9488",
          700: "#0f766e",
          800: "#115e59",
          900: "#134e4a",
          950: "#042f2e",
        },

        // ── Abyss: dark-mode surfaces, oceanic midnight depth ─────────────
        abyss: {
          50: "#f0f6fc",
          700: "#172b47",
          800: "#0e1e34",
          850: "#0a1729",
          900: "#06101e",
          950: "#030813",
        },

        // ── Coral: alerts, warmth & navigational markers ──────────────────
        coral: {
          300: "#fda4a0",
          400: "#fb7185",
          500: "#f43f5e",
          600: "#e11d48",
        },

        // ── Kelp: chlorophyll & biological health ─────────────────────────
        kelp: {
          300: "#86efac",
          400: "#4ade80",
          500: "#22c55e",
          600: "#16a34a",
        },
      },

      fontFamily: {
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
          "0%": { transform: "scale(0.9)", opacity: "0.8" },
          "70%": { transform: "scale(1.7)", opacity: "0" },
          "100%": { transform: "scale(1.7)", opacity: "0" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        "gradient-drift": {
          "0%, 100%": { backgroundPosition: "0% 50%" },
          "50%": { backgroundPosition: "100% 50%" },
        },
        "radar-sweep": {
          "0%": { transform: "rotate(0deg)" },
          "100%": { transform: "rotate(360deg)" },
        },
        "wave-pulse": {
          "0%, 100%": { transform: "translateY(0) scale(1)", opacity: "0.9" },
          "50%": { transform: "translateY(-3px) scale(1.02)", opacity: "1" },
        },
      },

      animation: {
        "fade-in": "fade-in 0.28s ease-out",
        "slide-up": "slide-up 0.32s cubic-bezier(0.22, 1, 0.36, 1)",
        "slide-in-right": "slide-in-right 0.3s cubic-bezier(0.22, 1, 0.36, 1)",
        "spin-slow": "spin 1.6s linear infinite",
        "pulse-ring": "pulse-ring 2s cubic-bezier(0.24, 0, 0.38, 1) infinite",
        shimmer: "shimmer 1.8s linear infinite",
        "gradient-drift": "gradient-drift 12s ease infinite",
        "radar-sweep": "radar-sweep 4s linear infinite",
        "wave-pulse": "wave-pulse 3s ease-in-out infinite",
      },

      boxShadow: {
        glow: "0 0 20px -2px rgb(14 165 233 / 0.45)",
        "glow-marine": "0 0 20px -2px rgb(20 184 166 / 0.45)",
        "glow-emerald": "0 0 20px -2px rgb(16 185 129 / 0.5)",
        "glow-danger": "0 0 20px -2px rgb(244 63 94 / 0.5)",
        card: "0 1px 3px rgb(0 0 0 / 0.05), 0 10px 28px -10px rgb(6 24 44 / 0.15)",
        "card-dark": "0 4px 20px -4px rgb(0 0 0 / 0.6), 0 0 0 1px rgb(255 255 255 / 0.07)",
      },

      backgroundImage: {
        "ocean-gradient": "linear-gradient(135deg, #07172c 0%, #0369a1 50%, #0d9488 100%)",
        "abyss-gradient": "linear-gradient(135deg, #030813 0%, #08162b 50%, #0f3057 100%)",
        "marine-gradient": "linear-gradient(135deg, #0284c7 0%, #0d9488 60%, #10b981 100%)",
        "coastal-card": "linear-gradient(180deg, rgba(255, 255, 255, 0.95) 0%, rgba(240, 249, 255, 0.85) 100%)",
      },
    },
  },

  plugins: [],
};
