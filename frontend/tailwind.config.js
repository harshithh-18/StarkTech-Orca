/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],

  darkMode: "class",

  theme: {
    extend: {
      colors: {
        // ── Safety Verdict (SOLAS / IMO Maritime Standard) ─────────────
        verdict: {
          go: "#10b981",
          "go-dark": "#34d399",
          caution: "#f59e0b",
          "caution-dark": "#fbbf24",
          nogo: "#ef4444",
          "nogo-dark": "#f87171",
        },

        // ── Ocean: Admiralty & Naval Blue (command deck & maritime telemetry) ─
        ocean: {
          50: "#eff6ff",
          100: "#dbeafe",
          200: "#bfdbfe",
          300: "#93c5fd",
          400: "#60a5fa",
          500: "#3b82f6",
          600: "#2563eb",
          700: "#1d4ed8",
          800: "#1e40af",
          900: "#1e3a8a",
          950: "#172554",
          // Legacy aliases
          deep: "#0a152e",
          mid: "#2563eb",
          light: "#eff6ff",
        },

        // ── Hydro: Bathymetry, sonar sweep & oceanographic depth ──────────
        hydro: {
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
        },

        // ── Marine: Oceanic life, chlorophyll & biological productivity ───
        marine: {
          50: "#f0fdf4",
          100: "#dcfce7",
          200: "#bbf7d0",
          300: "#86efac",
          400: "#4ade80",
          500: "#22c55e",
          600: "#16a34a",
          700: "#15803d",
          800: "#166534",
          900: "#14532d",
          950: "#052e16",
        },

        // ── Abyss: Deep Naval Obsidian & Bridge Console Surfaces ───────────
        abyss: {
          50: "#f8fafc",
          700: "#1e293b",
          750: "#162035",
          800: "#0f172a",
          850: "#0c1527",
          900: "#080e1c",
          950: "#050914",
        },

        // ── Coral: Alerts, navigational beacons & emergency markers ───────
        coral: {
          300: "#fca5a5",
          400: "#f87171",
          500: "#ef4444",
          600: "#dc2626",
        },

        // ── Kelp: Chlorophyll & biomass concentration ─────────────────────
        kelp: {
          300: "#86efac",
          400: "#4ade80",
          500: "#22c55e",
          600: "#16a34a",
        },
      },

      fontFamily: {
        sans: [
          "Plus Jakarta Sans",
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
        mono: ["JetBrains Mono", "ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
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
        "sonar-ping": {
          "0%": { transform: "scale(0.8)", opacity: "0.9" },
          "100%": { transform: "scale(2.2)", opacity: "0" },
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
        "spin-slow": "spin 2.2s linear infinite",
        "pulse-ring": "pulse-ring 2s cubic-bezier(0.24, 0, 0.38, 1) infinite",
        "sonar-ping": "sonar-ping 2.5s cubic-bezier(0.2, 0.8, 0.2, 1) infinite",
        shimmer: "shimmer 1.8s linear infinite",
        "gradient-drift": "gradient-drift 12s ease infinite",
        "radar-sweep": "radar-sweep 5s linear infinite",
        "wave-pulse": "wave-pulse 3s ease-in-out infinite",
      },

      boxShadow: {
        glow: "0 0 25px -2px rgb(37 99 235 / 0.45)",
        "glow-marine": "0 0 25px -2px rgb(16 185 129 / 0.45)",
        "glow-emerald": "0 0 25px -2px rgb(16 185 129 / 0.5)",
        "glow-danger": "0 0 25px -2px rgb(239 68 68 / 0.5)",
        card: "0 1px 3px rgb(0 0 0 / 0.05), 0 10px 28px -10px rgb(6 24 44 / 0.15)",
        "card-dark": "0 4px 20px -4px rgb(0 0 0 / 0.7), 0 0 0 1px rgb(255 255 255 / 0.08)",
        "tactical-elevated": "0 16px 36px -8px rgb(0 0 0 / 0.85), 0 0 0 1px rgb(59 130 246 / 0.25)",
      },

      backgroundImage: {
        "ocean-gradient": "linear-gradient(135deg, #060c18 0%, #1e3a8a 50%, #0369a1 100%)",
        "abyss-gradient": "linear-gradient(135deg, #050914 0%, #0c1527 50%, #111e38 100%)",
        "marine-gradient": "linear-gradient(135deg, #1d4ed8 0%, #0284c7 60%, #10b981 100%)",
        "coastal-card": "linear-gradient(180deg, rgba(255, 255, 255, 0.98) 0%, rgba(244, 247, 251, 0.92) 100%)",
        "command-deck": "linear-gradient(135deg, #050914 0%, #0c1527 55%, #142240 100%)",
      },
    },
  },

  plugins: [],
};
