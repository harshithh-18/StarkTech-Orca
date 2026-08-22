/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Verdict colours — used by VerdictCard and AlertBanner. Keep these consistent:
        // the fisherman should recognise the colour before reading the word.
        verdict: {
          go: "#15803d",
          caution: "#b45309",
          nogo: "#b91c1c",
        },
        ocean: {
          deep: "#0c2340",
          mid: "#12507a",
          light: "#dbeafe",
        },
      },
    },
  },
  plugins: [],
};
