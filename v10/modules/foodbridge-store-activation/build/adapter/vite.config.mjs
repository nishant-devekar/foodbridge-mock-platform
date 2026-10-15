// Builds the adapter (main.tsx) with the module's own source beside it (../src, ../dev), React inside the bundle, and the
// module's Tailwind utilities generated from its sandbox config (which mirrors storefront-frontend's). Run by ../build.sh.
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import tailwindcss from "tailwindcss";
import autoprefixer from "autoprefixer";
import twConfig from "../sandbox/tailwind.config.js";

const here = (p) => fileURLToPath(new URL(p, import.meta.url));
export default defineConfig({
  root: here("."),
  base: "./",
  plugins: [react()],
  css: { postcss: { plugins: [tailwindcss({ ...twConfig, content: [here("./index.html"), here("./main.tsx"), here("../src") + "/**/*.{ts,tsx}"] }), autoprefixer()] } },
  build: { outDir: process.env.SA_OUT, emptyOutDir: true, assetsDir: "assets" },
});
