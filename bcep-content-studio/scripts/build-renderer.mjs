import { build } from "esbuild";
import { mkdir } from "node:fs/promises";

await mkdir("dist", { recursive: true });

await build({
  entryPoints: ["src/renderer/app.js"],
  bundle: true,
  outfile: "dist/renderer.js",
  platform: "browser",
  format: "iife",
  sourcemap: true,
  loader: {
    ".css": "css"
  }
});

console.log("Renderer built.");
