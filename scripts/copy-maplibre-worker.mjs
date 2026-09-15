/**
 * MapLibre GL 5+ runs tile decoding in a module Web Worker (maplibre-gl-worker.mjs, which imports
 * maplibre-gl-shared.mjs). Next.js bundles MapLibre's main code but not the worker, so MapLibre's
 * default worker URL points into /_next/static/chunks/ where no worker exists and the map never
 * draws. This copies the installed worker files to public/maplibre/ (served at /maplibre/) and
 * runs automatically before `npm run dev` and `npm run build`, so they always match the installed
 * version. SchoolMap calls setWorkerUrl() with that path.
 */
import { copyFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const FILES = ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"];
const target = path.join(process.cwd(), "public", "maplibre");

mkdirSync(target, { recursive: true });
for (const file of FILES) {
  const source = require.resolve(`maplibre-gl/dist/${file}`);
  copyFileSync(source, path.join(target, file));
}
console.log(`maplibre worker: copied ${FILES.join(", ")} to public/maplibre/`);
