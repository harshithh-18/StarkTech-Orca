import { fileURLToPath, URL } from "node:url";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Mirrors the `paths` entry in tsconfig.json. TypeScript resolves "@/..." on its
      // own, but Vite needs telling separately or the build fails while typecheck passes.
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  server: {
    port: 5173,
    // The backend runs on :8000. Proxying keeps the frontend origin-relative, so the
    // deployed build needs no environment-specific URLs.
    proxy: {
      "/api": { target: "http://localhost:8000", changeOrigin: true },
      "/ws": { target: "ws://localhost:8000", ws: true },
    },
  },
});
