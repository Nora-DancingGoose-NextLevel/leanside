import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// `base: "./"` makes every asset URL relative, so the built site works at any
// path: GitHub Pages (https://<user>.github.io/leanside/), a local preview, or
// any static host.
export default defineConfig({
  base: "./",
  plugins: [react()],
});
