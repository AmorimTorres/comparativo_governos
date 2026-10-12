import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// base relativa: o site funciona em GitHub Pages (subpasta) ou Cloudflare Pages.
export default defineConfig({
  base: "./",
  plugins: [react()],
  build: { outDir: "dist", sourcemap: false },
});
