import { defineConfig } from "vite";

export default defineConfig({
  // Electron loads the production renderer over file://, so assets must be
  // relative to index.html instead of rooted at /assets.
  base: "./"
});
