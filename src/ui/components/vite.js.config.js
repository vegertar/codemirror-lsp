/* eslint-env node */

import { svelte } from "@sveltejs/vite-plugin-svelte";
import { defineConfig } from "vite";
import { basename, extname, resolve } from "path";
import * as packageJson from "./package.json";

const defaultEntry = resolve(__dirname, packageJson.exports["."].svelte);

export default defineConfig({
  build: {
    sourcemap: true,
    // Reduce bloat from legacy polyfills.
    target: "esnext",
    // Leave minification up to applications.
    minify: false,
    lib: {
      entry: defaultEntry,
      formats: ["es"],
      fileName: basename(defaultEntry, extname(defaultEntry)),
    },
    outDir: "dist-js",
  },
  plugins: [svelte()],
});
